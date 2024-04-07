import path from "path";
import { writeFileSync } from "fs";
import { Server } from "socket.io";

const { RUNPOD_API_KEY, ENDPOINT_ID } = process.env;

const fetchInstance = async (audioUrl: string) => {
  try {
    const fetchConfig = {
      url: "https://api.runpod.ai/v2/faster-whisper/runsync",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          audio: audioUrl,
          model: "large-v2",
        },
        enable_vad: true,
      }),
    };

    const response = await fetch(fetchConfig.url, {
      method: fetchConfig.method,
      headers: fetchConfig.headers,
      body: fetchConfig.body,
    });

    const responseJson = (await response.json()) as any;

    return responseJson;
  } catch (error) {
    console.error("An error occurred:", error);
    return {};
  }
};
const fetchJobStatus = async (jobId: string) => {
  try {
    const fetchConfig = {
      url: `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
    };

    const response = await fetch(fetchConfig.url, {
      method: fetchConfig.method,
      headers: fetchConfig.headers,
    });

    const responseJson = (await response.json()) as any;

    return responseJson;
  } catch (error) {
    console.error("An error occurred:", error);
    return {};
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const runpodTranscribeBuffer = async ({
  audioBuffer,
  data,
  io,
}: {
  id: string;
  audioBuffer: ArrayBuffer;
  data: any;
  io: Server;
}) => {
  const tempFilePath = path.join("data", `${data.id}.wav`);
  const audioPublicUrl = `${process.env.PUBLIC_URL}${tempFilePath}`;

  console.log("audioPublicUrl", audioPublicUrl);

  writeFileSync(tempFilePath, Buffer.from(audioBuffer));

  // sleep for 1 second to ensure file is written
  await sleep(1000);

  const result: any = await fetchInstance(audioPublicUrl);

  console.log(result);
  const transcription = result?.output?.transcription;

  if (transcription) {
    console.log("Transcription:", transcription);
    io.emit("audio-message", {
      ...data,
      message: transcription,
    });
    return;
  }

  if (!result?.id || result?.status !== "IN_QUEUE") {
    console.error("No ID returned from endpoint.run");
    return;
  }

  // Poll the status of the operation until it completes or fails
  try {
    let isComplete = false;
    while (!isComplete) {
      const status = await fetchJobStatus(result.id);
      console.log(`Current status`, status);

      if (status.status === "COMPLETED" || status.status === "FAILED") {
        isComplete = true; // Exit the loop
        console.log(`Operation ${status.status.toLowerCase()}.`);

        if (status.status === "COMPLETED") {
          console.log("Output:", status);

          const transcription = status.output.transcription;
          console.log("Transcription:", transcription);
          io.emit("audio-message", {
            ...data,
            message: transcription,
          });
        } else {
          console.error("Error details:", status);
        }
      } else {
        await sleep(300); // Adjust the delay as needed
      }
    }
  } catch (error: any) {
    console.error("An error occurred:", error.message);
  }
};
