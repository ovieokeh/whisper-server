import path from "path";
import { unlink, writeFile } from "fs";
import { spawn } from "child_process";
import { Server } from "socket.io";
import ffmpeg from "fluent-ffmpeg";

export const localTranscribeAudioBuffer = async ({
  audioBuffer,
  data,
  io,
}: {
  id: string;
  audioBuffer: ArrayBuffer;
  data: any;
  io: Server;
}) => {
  const modelPath = path.join("whisper/models/ggml-base.bin");
  const whisperPath = path.join("whisper/main");
  const tempFilePath = path.join("whisper-data", `${data.id}.wav`);
  const tempOutputPath = path.join("whisper-data", `${data.id}-transcribed.wav`);

  writeFile(tempFilePath, Buffer.from(audioBuffer), (error) => {
    if (error) {
      console.error("Error writing audio buffer to file:", error);
      return;
    }

    ffmpeg()
      .input(tempFilePath)
      .inputFormat("wav")
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .saveToFile(tempOutputPath)
      .on("error", (error) => {
        console.error("FFmpeg error:", error);
      })
      .on("end", () => {
        console.info("FFmpeg processing completed");
        const transcribeCommand = `${whisperPath} -nt -m ${modelPath} -f -i ${tempOutputPath}`;
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

          io.emit("audio-message", {
            ...data,
            message: transcription,
          });

          unlink(tempFilePath, (error) => {
            if (error) console.error("Error deleting temp file:", error);
          });
          unlink(tempOutputPath, (error) => {
            if (error) console.error("Error deleting temp output file:", error);
          });
        });
      });
  });
};
