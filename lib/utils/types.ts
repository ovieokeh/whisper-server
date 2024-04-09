import { Server } from "socket.io";

export interface CustomAudioChunk {
  id: string;
  buffer?: ArrayBuffer;
  isLastChunk: boolean;
  timestamp: string;
}

export interface AudioProcessorType {
  id: string;
  data: CustomAudioChunk;
  isLastChunk: boolean;
  timestamp: string;
  io: Server;
}

export interface TranscriptionJob {
  id: string;
  audioBuffer: ArrayBuffer;
  data: CustomAudioChunk;
  io: Server;
}
