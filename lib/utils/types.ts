import { Server } from "socket.io";

export interface CustomAudioChunk {
  id: string;
  buffer?: ArrayBuffer;
  isLastChunk: boolean;
  timestamp: string;
}

export type TranscriptionJob = CustomAudioChunk &
  Partial<{
    io: Server;
    openaiAPIKey: string;
  }>;
