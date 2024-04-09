import os from "os";
import path from "path";
import { spawn } from "child_process";
import { existsSync, unlink, writeFileSync } from "fs";
import ffmpeg from "fluent-ffmpeg";

import { TranscriptionJob } from "./types";

class InMemoryQueue<T> {
  private queue: T[] = [];

  enqueue(item: T) {
    this.queue.push(item);
  }

  dequeue(): T | undefined {
    return this.queue.shift();
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  peek(): T | undefined {
    return this.queue[0];
  }

  get length(): number {
    return this.queue.length;
  }
}

function canSpawnNewJob(): boolean {
  const freeMemory = os.freemem();
  const requiredDevMemory = 500 * 1024 * 1024;
  const requiredProdMemory = 4 * 1024 * 1024 * 1024;

  const requiredMemory = process.env.ENV === "development" ? requiredDevMemory : requiredProdMemory;
  return freeMemory > requiredMemory;
}

const transcriptionJobsQueue = new InMemoryQueue<TranscriptionJob>();

async function processTranscriptionQueue() {
  while (!transcriptionJobsQueue.isEmpty && canSpawnNewJob()) {
    const job = transcriptionJobsQueue.dequeue();
    if (job) {
      await localTranscribeAudioBuffer(job);
    }
  }
}

export const localTranscribeAudioBuffer = async (job: TranscriptionJob) => {
  console.log("Processing transcription...");

  await processAudio(job);
  processTranscriptionQueue();
};

export const processAudio = async ({ audioBuffer, data, io }: TranscriptionJob) => {
  const model = process.env.ENV === "development" ? "ggml-base-q5_0.bin" : "ggml-large-v3.bin";
  const modelPath = path.join(`whisper_model/models/${model}`);
  const whisperPath = path.join("whisper_model/main");
  const tempDir = path.join("whisper_data");
  const tempAudioPath = path.join(tempDir, `${data.id}.wav`);
  const tempFfmpegOutputPath = path.join(tempDir, `${data.id}_ffmpeg.wav`);

  try {
    writeFileSync(tempAudioPath, Buffer.from(audioBuffer));
  } catch (error) {
    if (error) return console.error("Error writing audio buffer to file:", error);
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(tempAudioPath)
      .inputFormat("wav")
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .save(tempFfmpegOutputPath)
      .on("error", (error) => {
        console.error("FFmpeg error:", error);
        reject(error);
      })
      .on("end", () => {
        if (!existsSync(tempFfmpegOutputPath)) {
          console.error("FFmpeg output file does not exist");
          return;
        }

        console.info("FFmpeg processing completed");
        const transcribeCommand = `${whisperPath} -nt -m ${modelPath} -f -i ${tempFfmpegOutputPath}`;
        const transcribeProcess = spawn(transcribeCommand, {
          shell: true,
        });

        transcribeProcess.on("error", (error) => {
          console.error("Error executing transcribe script:", error);
        });
        transcribeProcess.stderr?.on("data", (stderr) => {
          console.error("Transcribe stderr:", stderr.toString());
        });

        transcribeProcess.stdout?.on("data", (stdout) => {
          const transcription = stdout.toString();
          console.log("Transcription:>>>>>>", transcription);
          if (!transcription || transcription.includes("output: tmp/")) return;

          io.emit("audio-transcription-end", {
            ...data,
            message: transcription,
          });

          if (existsSync(tempFfmpegOutputPath)) {
            unlink(tempFfmpegOutputPath, (error) => {
              if (error) console.error("Error deleting temp FFmpeg output file:", error);
              console.info("Temp FFmpeg output file deleted");
            });
          }

          if (existsSync(tempAudioPath)) {
            unlink(tempAudioPath, (error) => {
              if (error) console.error("Error deleting temp audio file:", error);
              console.info("Temp audio file deleted");
            });
          }

          resolve();
        });
      });
  });
};
