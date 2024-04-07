import { WaveFile } from "wavefile";

export function isSilenceDetected(wavData: ArrayBuffer, silenceThreshold: number, maxSilenceDuration: number): boolean {
  try {
    const wav = new WaveFile(Buffer.from(wavData));
    const samples = wav.getSamples(true, Int16Array);
    // @ts-expect-error
    const sampleRate = wav.fmt.sampleRate || 16000;

    const threshold = silenceThreshold * 32768; // Adjust based on the bit depth
    const maxSilentSamples = sampleRate * (maxSilenceDuration / 1000);

    // Start checking from the last `maxSilenceDuration` milliseconds of the audio
    const startSampleIndex = Math.max(0, samples.length - maxSilentSamples);
    let silentSamples = 0;

    for (let i = startSampleIndex; i < samples.length; i++) {
      if (Math.abs(samples[i]) < threshold) {
        silentSamples++;
        if (silentSamples >= maxSilentSamples) {
          return true; // Detected silence in the last portion of the audio
        }
      } else {
        silentSamples = 0; // Reset counter if a loud enough sample is found
      }
    }

    return false; // Silence not detected in the last portion of the audio
  } catch (error: any) {
    console.error("Error checking if WAV is silent", error.message);
    return true; // Assume it's silent if there's an error
  }
}

export function concatArrayBuffers(views: ArrayBuffer[]): ArrayBuffer {
  let totalLength = 0;
  for (const view of views) {
    if (!view) continue;
    totalLength += view.byteLength;
  }

  const concatenatedBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const view of views) {
    if (!view) continue;
    concatenatedBuffer.set(new Uint8Array(view), offset);
    offset += view.byteLength;
  }

  return concatenatedBuffer.buffer;
}

export function extractWavHeader(arrayBuffer: ArrayBuffer) {
  // WAV header is typically 44 bytes long
  const HEADER_SIZE = 44;
  if (arrayBuffer?.byteLength < HEADER_SIZE) {
    throw new Error("ArrayBuffer is too small to contain a valid WAV header.");
  }

  const headerBuffer = arrayBuffer.slice(0, HEADER_SIZE);
  return headerBuffer;
}

export function getAudioDuration(arrayBuffer: ArrayBuffer, sampleRate: number) {
  const numberOfFrames = arrayBuffer.byteLength / 2; // For 16-bit PCM audio

  const durationInSeconds = numberOfFrames / sampleRate;
  const durationInMilliseconds = durationInSeconds * 1000;

  return durationInMilliseconds;
}

export function sliceLastDuration({
  audioBuffer,
  durationMs,
  sampleRate = 16000,
  bitDepth = 16,
  channels = 2,
}: {
  audioBuffer?: ArrayBuffer;
  durationMs: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
}): ArrayBuffer {
  if (!audioBuffer) {
    return new ArrayBuffer(0);
  }

  const bytesPerSample = bitDepth / 8;
  const byteRate = sampleRate * bytesPerSample * channels;
  const durationBytes = byteRate * (durationMs / 1000);

  const start = Math.max(0, audioBuffer.byteLength - durationBytes);
  const end = audioBuffer.byteLength;

  return audioBuffer.slice(start, end);
}
