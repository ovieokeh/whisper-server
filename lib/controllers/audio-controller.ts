import { whisperTranscriber } from "../utils/transcriber-whisper";
import { concatArrayBuffers, extractWavHeader, getAudioDuration } from "../utils/audio-utils";
import { TranscriptionJob } from "../utils/types";

const TRANSCRIPTION_JOBS: {
  [id: string]: {
    headerBuffer: ArrayBuffer;
  };
} = {};

const TRANSCRIPTIONS_HANDLED: {
  [key: string]: boolean;
} = {};

const transcribeAudio = async (job: TranscriptionJob) => {
  const { id, buffer, io } = job;
  if (!buffer || !io) {
    console.error("transcribeAudio > no buffer", id);
    return;
  }

  try {
    console.info("transcribeAudio > processing", id);

    const audioDuration = getAudioDuration(buffer, 16000);
    console.info("transcribeAudio > audio duration", audioDuration);
    if (audioDuration < 70) {
      console.info("transcribeAudio > silent chunk > exiting", id);
      return;
    }

    io.emit("audio-transcription-start", {
      ...job,
      buffer: null,
      io: null,
    });

    await whisperTranscriber(job);
  } catch (error) {
    console.error("transcribeAudio > error", error);
  }
};

export const processAudioJob = (job: TranscriptionJob) => {
  const { timestamp, id, buffer, isLastChunk } = job;

  if (isLastChunk) {
    if (!buffer) {
      console.error("batchTranscriptionJob > last chunk > no buffer", id);
      return;
    }

    console.info("batchTranscriptionJob > audio stopped > flushing buffer", id);
    if (TRANSCRIPTION_JOBS[id]) {
      delete TRANSCRIPTION_JOBS[id];
    }

    return transcribeAudio(job);
  }

  if (!buffer) {
    console.info("batchTranscriptionJob > silent chunk > no buffer", id);
    return;
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

  transcribeAudio({
    ...job,
    buffer: currentCustomAudioBuffer,
  });

  TRANSCRIPTIONS_HANDLED[timestamp] = true;
  return;
};
