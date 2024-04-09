import path from "path";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { existsSync, unlink, writeFile } from "fs";
import { TranscriptionJob } from "./types";

export const localTranscribeAudioBuffer = async ({ audioBuffer, data, io }: TranscriptionJob) => {
  const model = process.env.ENV === "development" ? "ggml-base-q5_0.bin" : "ggml-base.bin";
  const modelPath = path.join(`whisper_model/models/${model}`);
  const whisperPath = path.join("whisper_model/main");
  const tempDir = path.join("whisper_data");
  const tempAudioPath = path.join(tempDir, `${data.id}.wav`);

  writeFile(tempAudioPath, Buffer.from(audioBuffer), (error) => {
    if (error) return console.error("Error writing audio buffer to file:", error);

    const transcribeCommand = `${whisperPath} -nt -m ${modelPath} -f - `;
    const transcribeProcess = spawn(transcribeCommand, {
      shell: true,
    });

    ffmpeg()
      .input(tempAudioPath)
      .inputFormat("wav")
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .on("error", (error) => {
        console.error("FFmpeg error:", error);
      })
      .on("end", () => {
        console.info("FFmpeg processing completed");

        if (existsSync(tempAudioPath)) {
          unlink(tempAudioPath, (error) => {
            if (error) console.error("Error deleting temp audio file:", error);
            console.info("Temp audio file deleted");
          });
        }
      })
      .pipe(transcribeProcess.stdin, { end: true });

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
    });
  });
};
