import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SFX_PARAMS,
  deserializeSfxParams,
  encodeSfxWav,
  renderSfx,
} from './sfx';

describe('sfx renderer', () => {
  it('renders a bounded sample buffer with stats', () => {
    const rendered = renderSfx(
      {
        ...DEFAULT_SFX_PARAMS,
        waveform: 'square',
        sustain: 0.2,
        decay: 0.24,
        startFrequency: 0.78,
        slide: -0.25,
      },
      {
        sampleRate: 22050,
        bitDepth: 16,
      },
    );

    expect(rendered.samples.length).toBe(rendered.stats.samples);
    expect(rendered.samples.length).toBeGreaterThan(1000);
    expect(rendered.stats.durationSeconds).toBeGreaterThan(0.18);
    expect(rendered.stats.peak).toBeLessThanOrEqual(1);
    expect(rendered.stats.peak).toBeGreaterThan(0.05);
  });

  it('serializes to a valid wav header', async () => {
    const wav = encodeSfxWav(Float32Array.from([0, -1, 1, 0.5]), 8000, 8);
    const bytes = new Uint8Array(await readBlobAsArrayBuffer(wav));
    const view = new DataView(bytes.buffer);

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(8);
    expect(view.getUint32(40, true)).toBe(4);
  });

  it('clamps deserialized params into the supported range', () => {
    const params = deserializeSfxParams(
      JSON.stringify({
        waveform: 'noise',
        attack: 10,
        slide: -4,
        masterVolume: 2,
      }),
    );

    expect(params.waveform).toBe('noise');
    expect(params.attack).toBe(1);
    expect(params.slide).toBe(-1);
    expect(params.masterVolume).toBe(1);
  });
});

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('failed to read blob'));
    };

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('blob result is not ArrayBuffer'));
    };

    reader.readAsArrayBuffer(blob);
  });
}
