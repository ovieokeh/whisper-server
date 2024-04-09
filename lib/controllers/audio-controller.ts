import { Server } from "socket.io";

import { localTranscribeAudioBuffer } from "../utils/transcriber";
import { concatArrayBuffers, extractWavHeader, getAudioDuration } from "../utils/audio-utils";
import { CustomAudioChunk, AudioProcessorType, TranscriptionJob } from "../utils/types";

const TRANSCRIPTION_JOBS: {
  [id: string]: {
    headerBuffer: ArrayBuffer;
  };
} = {};

const TRANSCRIPTIONS_HANDLED: {
  [key: string]: boolean;
} = {};

const processAudio = async ({ id, audioBuffer, data, io }: TranscriptionJob) => {
  try {
    console.info("processAudio > processing", id);

    const audioDuration = getAudioDuration(audioBuffer, 16000);
    console.info("processAudio > audio duration", audioDuration);
    if (audioDuration < 70) {
      console.info("processAudio > silent chunk > exiting", id);
      return;
    }

    localTranscribeAudioBuffer({
      id,
      audioBuffer,
      data,
      io,
    });
  } catch (error) {
    console.error("processAudio > error", error);
  }
};

const processArrayBufferChunk = ({
  id,
  buffer,
  data,
  isLastChunk,
  timestamp,
  io,
}: AudioProcessorType & {
  buffer: ArrayBuffer;
}) => {
  if (isLastChunk) {
    if (!buffer) {
      console.error("batchTranscriptionJob > last chunk > no buffer", id);
      return;
    }

    console.info("batchTranscriptionJob > audio stopped > flushing buffer", id);
    if (TRANSCRIPTION_JOBS[id]) {
      delete TRANSCRIPTION_JOBS[id];
    }

    return processAudio({
      id,
      audioBuffer: buffer,
      data,
      io,
    });
  }

  const batchedAudio = TRANSCRIPTION_JOBS[id];
  let currentCustomAudioBuffer = buffer;
  if (batchedAudio?.headerBuffer) {
    currentCustomAudioBuffer = concatArrayBuffers([batchedAudio.headerBuffer, buffer]);
  }

  if (!batchedAudio) {
    console.info("batchTranscriptionJob > creating buffer cache", id);
    TRANSCRIPTION_JOBS[id] = {
      headerBuffer: extractWavHeader(buffer),
    };
  }

  console.info("batchTranscriptionJob > silent chunk > buffer found > processing audio", id);

  processAudio({
    id,
    audioBuffer: currentCustomAudioBuffer,
    data,
    io,
  });

  TRANSCRIPTIONS_HANDLED[timestamp] = true;
  return;
};

export async function batchTranscriptionJob({ data, io }: { data: CustomAudioChunk; io: Server }) {
  const { timestamp, id, buffer, isLastChunk } = data;
  try {
    if (timestamp && TRANSCRIPTIONS_HANDLED[timestamp]) {
      console.info("batchTranscriptionJob > duplicate chunk > exiting", timestamp);
      return;
    }

    if (!buffer) {
      console.error("batchTranscriptionJob > no buffer", id);
      return;
    }

    processArrayBufferChunk({
      id,
      buffer: buffer,
      data,
      isLastChunk,
      timestamp,
      io,
    });
  } catch (error) {
    console.error("batchTranscriptionJob > error", error);
  }
}
