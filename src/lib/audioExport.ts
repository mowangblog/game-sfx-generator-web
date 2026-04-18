import lamejsScriptUrl from 'lamejs/lame.all.js?url';
import type { SfxSampleRate } from './sfx';

type Mp3EncoderInstance = {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
  flush: () => Int8Array;
};

type Mp3EncoderCtor = new (channels: number, sampleRate: number, kbps: number) => Mp3EncoderInstance;

type VorbisEncoderInstance = {
  encode: (buffers: Float32Array[]) => void;
  finish: (mimeType?: string) => Blob;
};

type VorbisEncoderCtor = new (
  sampleRate: number,
  channelCount: number,
  quality: number,
  tags?: Record<string, string>,
) => VorbisEncoderInstance;

type LameJsGlobal = {
  Mp3Encoder?: Mp3EncoderCtor;
};

declare global {
  interface Window {
    lamejs?: LameJsGlobal;
  }
}

let lameScriptPromise: Promise<Mp3EncoderCtor> | null = null;

function getGlobalMp3Encoder(): Mp3EncoderCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.lamejs?.Mp3Encoder ?? null;
}

async function loadMp3Encoder(): Promise<Mp3EncoderCtor> {
  const existing = getGlobalMp3Encoder();
  if (existing) {
    return existing;
  }

  if (!lameScriptPromise) {
    lameScriptPromise = new Promise<Mp3EncoderCtor>((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('MP3 encoder can only load in the browser.'));
        return;
      }

      const script = document.createElement('script');
      script.src = lamejsScriptUrl;
      script.async = true;
      script.onload = () => {
        const encoder = getGlobalMp3Encoder();
        if (!encoder) {
          reject(new Error('MP3 encoder loaded but no global entry was found.'));
          return;
        }

        resolve(encoder);
      };
      script.onerror = () => reject(new Error('Failed to load the MP3 encoder script.'));
      document.head.appendChild(script);
    });
  }

  return lameScriptPromise;
}

function resolveVorbisEncoder(module: unknown): VorbisEncoderCtor {
  const candidate = module as {
    encoder?: VorbisEncoderCtor;
    default?: { encoder?: VorbisEncoderCtor };
  };

  if (candidate.encoder) {
    return candidate.encoder;
  }

  if (candidate.default?.encoder) {
    return candidate.default.encoder;
  }

  throw new Error('Failed to load the OGG encoder.');
}

function toInt16Pcm(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = sample < 0
      ? Math.round(sample * 0x8000)
      : Math.round(sample * 0x7fff);
  }

  return pcm;
}

export async function encodeMp3FromSamples(
  samples: Float32Array,
  sampleRate: SfxSampleRate,
): Promise<Blob> {
  const Mp3Encoder = await loadMp3Encoder();
  const encoder = new Mp3Encoder(1, sampleRate, sampleRate >= 32000 ? 128 : 96);
  const pcm = toInt16Pcm(samples);
  const chunks: ArrayBuffer[] = [];
  const blockSize = 1152;

  for (let index = 0; index < pcm.length; index += blockSize) {
    const chunk = pcm.subarray(index, index + blockSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) {
      const bytes = Uint8Array.from(encoded);
      chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    const bytes = Uint8Array.from(flushed);
    chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }

  return new Blob(chunks, { type: 'audio/mpeg' });
}

export async function encodeOggFromSamples(
  samples: Float32Array,
  sampleRate: SfxSampleRate,
  title: string,
): Promise<Blob> {
  const module = await import('vorbis-encoder-js');
  const VorbisEncoder = resolveVorbisEncoder(module);
  const encoder = new VorbisEncoder(sampleRate, 1, 0.4, { TITLE: title });
  const blockSize = 4096;

  for (let index = 0; index < samples.length; index += blockSize) {
    encoder.encode([samples.slice(index, index + blockSize)]);
  }

  return encoder.finish('audio/ogg');
}
