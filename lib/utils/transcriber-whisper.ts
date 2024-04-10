import os from "os";
import { OpenAI, toFile } from "openai";

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

  console.log({
    freeMemory,
    requiredMemory: process.env.ENV === "development" ? requiredDevMemory : requiredProdMemory,
  });

  const requiredMemory = process.env.ENV === "development" ? requiredDevMemory : requiredProdMemory;
  return freeMemory > requiredMemory;
}

const transcriptionJobsQueue = new InMemoryQueue<TranscriptionJob>();

async function processTranscriptionQueue() {
  while (!transcriptionJobsQueue.isEmpty && canSpawnNewJob()) {
    const job = transcriptionJobsQueue.dequeue();
    if (job) {
      await whisperTranscriber(job);
    }
  }
}

export const whisperTranscriber = async (job: TranscriptionJob) => {
  console.log("Processing transcription...");

  await processAudio(job);
  processTranscriptionQueue();
};

const processAudio = async (job: TranscriptionJob) => {
  const { buffer, io, openaiAPIKey } = job;
  if (!buffer || !io) {
    console.error("processAudio > no io");
    return;
  }

  const openai = new OpenAI({
    apiKey: openaiAPIKey,
  });

  const audioFile = await toFile(buffer, `audio-${job.id}.wav`);

  const transcriptionResponse = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
  });

  const transcription = transcriptionResponse.text;

  io.emit("audio-transcription-end", {
    ...job,
    buffer: null,
    io: null,
    message: transcription,
  });
};
