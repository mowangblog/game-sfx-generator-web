export type SfxWaveform = 'square' | 'sawtooth' | 'sine' | 'noise';

export type SfxPresetId =
  | 'random'
  | 'pickupCoin'
  | 'laserShoot'
  | 'explosion'
  | 'powerup'
  | 'hitHurt'
  | 'jump'
  | 'click'
  | 'blipSelect'
  | 'synth'
  | 'tone'
  | 'mutate';

export type SfxParams = {
  waveform: SfxWaveform;
  attack: number;
  sustain: number;
  sustainPunch: number;
  decay: number;
  startFrequency: number;
  minFrequency: number;
  slide: number;
  deltaSlide: number;
  vibratoDepth: number;
  vibratoSpeed: number;
  changeAmount: number;
  changeSpeed: number;
  squareDuty: number;
  dutySweep: number;
  repeatSpeed: number;
  phaserOffset: number;
  phaserSweep: number;
  lowPassCutoff: number;
  lowPassSweep: number;
  lowPassResonance: number;
  highPassCutoff: number;
  highPassSweep: number;
  masterVolume: number;
};

export type SfxBitDepth = 8 | 16;
export type SfxSampleRate = 8000 | 11025 | 22050 | 44100;

export type SfxRenderOptions = {
  sampleRate: SfxSampleRate;
  bitDepth: SfxBitDepth;
};

export type SfxRenderStats = {
  durationSeconds: number;
  samples: number;
  clippedSamples: number;
  peak: number;
  estimatedByteSize: number;
};

export type SfxRenderResult = {
  samples: Float32Array;
  stats: SfxRenderStats;
};

export const DEFAULT_SFX_PARAMS: SfxParams = {
  waveform: 'square',
  attack: 0,
  sustain: 0.18,
  sustainPunch: 0.28,
  decay: 0.26,
  startFrequency: 0.42,
  minFrequency: 0,
  slide: 0,
  deltaSlide: 0,
  vibratoDepth: 0,
  vibratoSpeed: 0,
  changeAmount: 0,
  changeSpeed: 0,
  squareDuty: 0.5,
  dutySweep: 0,
  repeatSpeed: 0,
  phaserOffset: 0,
  phaserSweep: 0,
  lowPassCutoff: 1,
  lowPassSweep: 0,
  lowPassResonance: 0,
  highPassCutoff: 0,
  highPassSweep: 0,
  masterVolume: 0.56,
};

export const SFX_PRESET_ORDER: SfxPresetId[] = [
  'random',
  'pickupCoin',
  'laserShoot',
  'explosion',
  'powerup',
  'hitHurt',
  'jump',
  'click',
  'blipSelect',
  'synth',
  'tone',
  'mutate',
];

const PHASER_BUFFER_SIZE = 2048;
const MAX_FREQUENCY = 12000;
const MIN_DURATION_SECONDS = 0.18;

export function clampSfxParams(params: Partial<SfxParams>): SfxParams {
  const merged = {
    ...DEFAULT_SFX_PARAMS,
    ...params,
  };

  return {
    waveform: isWaveform(merged.waveform) ? merged.waveform : DEFAULT_SFX_PARAMS.waveform,
    attack: clamp(merged.attack, 0, 1),
    sustain: clamp(merged.sustain, 0, 1),
    sustainPunch: clamp(merged.sustainPunch, 0, 1),
    decay: clamp(merged.decay, 0, 1),
    startFrequency: clamp(merged.startFrequency, 0, 1),
    minFrequency: clamp(merged.minFrequency, 0, 1),
    slide: clamp(merged.slide, -1, 1),
    deltaSlide: clamp(merged.deltaSlide, -1, 1),
    vibratoDepth: clamp(merged.vibratoDepth, 0, 1),
    vibratoSpeed: clamp(merged.vibratoSpeed, 0, 1),
    changeAmount: clamp(merged.changeAmount, -1, 1),
    changeSpeed: clamp(merged.changeSpeed, 0, 1),
    squareDuty: clamp(merged.squareDuty, 0, 1),
    dutySweep: clamp(merged.dutySweep, -1, 1),
    repeatSpeed: clamp(merged.repeatSpeed, 0, 1),
    phaserOffset: clamp(merged.phaserOffset, -1, 1),
    phaserSweep: clamp(merged.phaserSweep, -1, 1),
    lowPassCutoff: clamp(merged.lowPassCutoff, 0, 1),
    lowPassSweep: clamp(merged.lowPassSweep, -1, 1),
    lowPassResonance: clamp(merged.lowPassResonance, 0, 1),
    highPassCutoff: clamp(merged.highPassCutoff, 0, 1),
    highPassSweep: clamp(merged.highPassSweep, -1, 1),
    masterVolume: clamp(merged.masterVolume, 0, 1),
  };
}

export function serializeSfxParams(params: SfxParams): string {
  return JSON.stringify(params, null, 2);
}

export function deserializeSfxParams(serialized: string): SfxParams {
  const parsed = JSON.parse(serialized) as Partial<SfxParams>;
  return clampSfxParams(parsed);
}

export function mutateSfxParams(current: SfxParams): SfxParams {
  return clampSfxParams({
    ...current,
    attack: current.attack + randomRange(-0.08, 0.08),
    sustain: current.sustain + randomRange(-0.12, 0.12),
    sustainPunch: current.sustainPunch + randomRange(-0.15, 0.15),
    decay: current.decay + randomRange(-0.12, 0.12),
    startFrequency: current.startFrequency + randomRange(-0.18, 0.18),
    minFrequency: current.minFrequency + randomRange(-0.12, 0.12),
    slide: current.slide + randomRange(-0.24, 0.24),
    deltaSlide: current.deltaSlide + randomRange(-0.16, 0.16),
    vibratoDepth: current.vibratoDepth + randomRange(-0.2, 0.2),
    vibratoSpeed: current.vibratoSpeed + randomRange(-0.18, 0.18),
    changeAmount: current.changeAmount + randomRange(-0.24, 0.24),
    changeSpeed: current.changeSpeed + randomRange(-0.24, 0.24),
    squareDuty: current.squareDuty + randomRange(-0.18, 0.18),
    dutySweep: current.dutySweep + randomRange(-0.24, 0.24),
    repeatSpeed: current.repeatSpeed + randomRange(-0.2, 0.2),
    phaserOffset: current.phaserOffset + randomRange(-0.28, 0.28),
    phaserSweep: current.phaserSweep + randomRange(-0.18, 0.18),
    lowPassCutoff: current.lowPassCutoff + randomRange(-0.2, 0.2),
    lowPassSweep: current.lowPassSweep + randomRange(-0.18, 0.18),
    lowPassResonance: current.lowPassResonance + randomRange(-0.14, 0.14),
    highPassCutoff: current.highPassCutoff + randomRange(-0.14, 0.14),
    highPassSweep: current.highPassSweep + randomRange(-0.12, 0.12),
    masterVolume: current.masterVolume + randomRange(-0.08, 0.08),
  });
}

export function createSfxPreset(
  preset: SfxPresetId,
  current: SfxParams = DEFAULT_SFX_PARAMS,
): SfxParams {
  switch (preset) {
    case 'random':
      return clampSfxParams({
        waveform: randomWaveform(),
        attack: Math.random() * 0.12,
        sustain: randomRange(0.05, 0.44),
        sustainPunch: Math.random(),
        decay: randomRange(0.08, 0.52),
        startFrequency: randomRange(0.12, 0.95),
        minFrequency: Math.random() * 0.3,
        slide: randomRange(-0.65, 0.42),
        deltaSlide: randomRange(-0.22, 0.22),
        vibratoDepth: Math.random() * 0.7,
        vibratoSpeed: Math.random() * 0.8,
        changeAmount: randomRange(-0.7, 0.7),
        changeSpeed: Math.random() * 0.9,
        squareDuty: Math.random(),
        dutySweep: randomRange(-0.4, 0.4),
        repeatSpeed: Math.random() * 0.7,
        phaserOffset: randomRange(-0.8, 0.8),
        phaserSweep: randomRange(-0.3, 0.3),
        lowPassCutoff: randomRange(0.2, 1),
        lowPassSweep: randomRange(-0.25, 0.18),
        lowPassResonance: Math.random() * 0.7,
        highPassCutoff: Math.random() * 0.25,
        highPassSweep: randomRange(-0.12, 0.1),
        masterVolume: randomRange(0.38, 0.72),
      });
    case 'pickupCoin':
      return clampSfxParams({
        waveform: Math.random() > 0.5 ? 'square' : 'sine',
        sustain: randomRange(0.04, 0.12),
        sustainPunch: randomRange(0.35, 0.8),
        decay: randomRange(0.08, 0.16),
        startFrequency: randomRange(0.66, 0.92),
        changeAmount: randomRange(0.18, 0.42),
        changeSpeed: randomRange(0.18, 0.38),
        squareDuty: randomRange(0.25, 0.58),
        lowPassCutoff: 0.96,
        highPassCutoff: randomRange(0.02, 0.08),
        masterVolume: 0.54,
      });
    case 'laserShoot':
      return clampSfxParams({
        waveform: Math.random() > 0.6 ? 'sawtooth' : 'square',
        sustain: randomRange(0.08, 0.22),
        sustainPunch: randomRange(0.12, 0.34),
        decay: randomRange(0.14, 0.34),
        startFrequency: randomRange(0.48, 0.92),
        minFrequency: randomRange(0.02, 0.16),
        slide: randomRange(-0.72, -0.24),
        deltaSlide: randomRange(-0.08, 0.12),
        vibratoDepth: randomRange(0, 0.24),
        vibratoSpeed: randomRange(0.2, 0.62),
        squareDuty: randomRange(0.05, 0.4),
        dutySweep: randomRange(-0.34, 0.18),
        phaserOffset: randomRange(-0.45, 0.45),
        phaserSweep: randomRange(-0.08, 0.08),
        highPassCutoff: randomRange(0.05, 0.16),
        masterVolume: 0.56,
      });
    case 'explosion':
      return clampSfxParams({
        waveform: 'noise',
        sustain: randomRange(0.18, 0.44),
        sustainPunch: randomRange(0.12, 0.44),
        decay: randomRange(0.24, 0.62),
        startFrequency: randomRange(0.06, 0.22),
        minFrequency: 0,
        slide: randomRange(-0.38, -0.08),
        repeatSpeed: randomRange(0.02, 0.16),
        phaserOffset: randomRange(-0.4, 0.4),
        phaserSweep: randomRange(-0.06, 0.06),
        lowPassCutoff: randomRange(0.2, 0.52),
        lowPassSweep: randomRange(-0.12, -0.02),
        lowPassResonance: randomRange(0.2, 0.55),
        highPassCutoff: randomRange(0.02, 0.12),
        masterVolume: 0.66,
      });
    case 'powerup':
      return clampSfxParams({
        waveform: Math.random() > 0.5 ? 'square' : 'sawtooth',
        sustain: randomRange(0.14, 0.28),
        sustainPunch: randomRange(0.18, 0.45),
        decay: randomRange(0.16, 0.3),
        startFrequency: randomRange(0.24, 0.44),
        slide: randomRange(0.18, 0.42),
        changeAmount: randomRange(0.08, 0.32),
        changeSpeed: randomRange(0.18, 0.42),
        squareDuty: randomRange(0.2, 0.6),
        dutySweep: randomRange(0.04, 0.2),
        lowPassCutoff: 0.9,
        masterVolume: 0.56,
      });
    case 'hitHurt':
      return clampSfxParams({
        waveform: Math.random() > 0.5 ? 'noise' : 'square',
        sustain: randomRange(0.02, 0.12),
        sustainPunch: randomRange(0.2, 0.55),
        decay: randomRange(0.08, 0.2),
        startFrequency: randomRange(0.26, 0.68),
        slide: randomRange(-0.44, -0.08),
        highPassCutoff: randomRange(0.06, 0.18),
        lowPassCutoff: randomRange(0.45, 0.9),
        masterVolume: 0.56,
      });
    case 'jump':
      return clampSfxParams({
        waveform: Math.random() > 0.35 ? 'square' : 'sine',
        sustain: randomRange(0.08, 0.16),
        sustainPunch: randomRange(0.12, 0.28),
        decay: randomRange(0.12, 0.24),
        startFrequency: randomRange(0.38, 0.62),
        slide: randomRange(0.08, 0.28),
        squareDuty: randomRange(0.2, 0.5),
        highPassCutoff: randomRange(0.02, 0.1),
        masterVolume: 0.54,
      });
    case 'click':
      return clampSfxParams({
        waveform: 'square',
        sustain: randomRange(0.01, 0.04),
        sustainPunch: randomRange(0.18, 0.48),
        decay: randomRange(0.01, 0.06),
        startFrequency: randomRange(0.42, 0.78),
        squareDuty: randomRange(0.1, 0.34),
        highPassCutoff: randomRange(0.08, 0.22),
        masterVolume: 0.44,
      });
    case 'blipSelect':
      return clampSfxParams({
        waveform: Math.random() > 0.5 ? 'square' : 'sine',
        sustain: randomRange(0.02, 0.08),
        sustainPunch: randomRange(0.08, 0.3),
        decay: randomRange(0.04, 0.12),
        startFrequency: randomRange(0.44, 0.82),
        squareDuty: randomRange(0.25, 0.6),
        highPassCutoff: randomRange(0.02, 0.1),
        masterVolume: 0.5,
      });
    case 'synth':
      return clampSfxParams({
        waveform: Math.random() > 0.5 ? 'sawtooth' : 'sine',
        attack: randomRange(0.02, 0.1),
        sustain: randomRange(0.22, 0.54),
        sustainPunch: randomRange(0, 0.2),
        decay: randomRange(0.22, 0.54),
        startFrequency: randomRange(0.16, 0.68),
        slide: randomRange(-0.08, 0.12),
        vibratoDepth: randomRange(0.06, 0.36),
        vibratoSpeed: randomRange(0.18, 0.62),
        changeAmount: randomRange(-0.12, 0.12),
        squareDuty: randomRange(0.22, 0.7),
        lowPassCutoff: randomRange(0.5, 0.92),
        lowPassResonance: randomRange(0.06, 0.38),
        highPassCutoff: randomRange(0.01, 0.08),
        masterVolume: 0.58,
      });
    case 'tone':
      return clampSfxParams({
        waveform: 'sine',
        attack: randomRange(0.01, 0.08),
        sustain: randomRange(0.38, 0.62),
        sustainPunch: 0,
        decay: randomRange(0.18, 0.42),
        startFrequency: randomRange(0.18, 0.82),
        lowPassCutoff: 1,
        highPassCutoff: 0,
        masterVolume: 0.52,
      });
    case 'mutate':
      return mutateSfxParams(current);
    default:
      return clampSfxParams(current);
  }
}

export function renderSfx(
  params: SfxParams,
  options: SfxRenderOptions,
): SfxRenderResult {
  const safeParams = clampSfxParams(params);
  const attackSeconds = safeParams.attack * 0.4;
  const sustainSeconds = 0.02 + safeParams.sustain * 1.2;
  const decaySeconds = safeParams.decay * 1.8;
  const durationSeconds = Math.max(
    MIN_DURATION_SECONDS,
    attackSeconds + sustainSeconds + decaySeconds,
  );

  const attackSamples = Math.max(0, Math.floor(attackSeconds * options.sampleRate));
  const sustainSamples = Math.max(1, Math.floor(sustainSeconds * options.sampleRate));
  const decaySamples = Math.max(1, Math.floor(decaySeconds * options.sampleRate));
  const totalSamples = Math.max(
    Math.floor(durationSeconds * options.sampleRate),
    attackSamples + sustainSamples + decaySamples,
  );

  const samples = new Float32Array(totalSamples);
  const startFrequency = normalizedFrequency(safeParams.startFrequency);
  const minFrequency = Math.min(startFrequency, normalizedFrequency(safeParams.minFrequency));
  const initialSlide = signedCurve(safeParams.slide) * 0.00008;
  const slideDelta = signedCurve(safeParams.deltaSlide) * 0.00000008;
  const initialDuty = clamp(0.05 + safeParams.squareDuty * 0.9, 0.05, 0.95);
  const dutyDelta = safeParams.dutySweep * 0.00004;
  const vibratoRate = 0.5 + safeParams.vibratoSpeed * 18;
  const vibratoDepth = safeParams.vibratoDepth * 0.35;
  const repeatLimit = safeParams.repeatSpeed > 0.01
    ? Math.max(128, Math.floor(options.sampleRate * (0.12 + (1 - safeParams.repeatSpeed) * 1.48)))
    : 0;
  const changeLimit = safeParams.changeSpeed > 0.01
    ? Math.max(128, Math.floor(options.sampleRate * (0.05 + (1 - safeParams.changeSpeed) * 1.3)))
    : 0;
  const changeMultiplier = safeParams.changeAmount >= 0
    ? 1 + safeParams.changeAmount * 1.5
    : 1 / (1 + Math.abs(safeParams.changeAmount) * 1.5);

  const phaserBuffer = new Float32Array(PHASER_BUFFER_SIZE);
  let phaserOffset = safeParams.phaserOffset * 1024;
  const phaserSweep = safeParams.phaserSweep * 0.3;
  let phaserIndex = 0;

  let lowPassCutoff = clamp(0.02 + safeParams.lowPassCutoff ** 2 * 0.48, 0.02, 1);
  const lowPassSweep = safeParams.lowPassSweep * 0.00002;
  const lowPassDamping = clamp(1 - safeParams.lowPassResonance * 0.4, 0.45, 0.995);
  let lowPassState = 0;
  let lowPassDelta = 0;

  let highPassAlpha = clamp(0.999 - safeParams.highPassCutoff ** 2 * 0.94, 0.02, 0.999);
  const highPassSweep = safeParams.highPassSweep * 0.00002;
  let highPassPrevInput = 0;
  let highPassPrevOutput = 0;

  let frequency = startFrequency;
  let slide = initialSlide;
  let duty = initialDuty;
  let phase = 0;
  let repeatCounter = 0;
  let changeCounter = 0;
  let changeTriggered = false;
  let vibratoPhase = 0;
  let noiseValue = randomSigned();
  let clippedSamples = 0;
  let peak = 0;

  const resetCycle = (): void => {
    frequency = startFrequency;
    slide = initialSlide;
    duty = initialDuty;
    phase = 0;
    repeatCounter = 0;
    changeCounter = 0;
    changeTriggered = false;
    noiseValue = randomSigned();
  };

  for (let index = 0; index < totalSamples; index += 1) {
    if (repeatLimit > 0 && repeatCounter >= repeatLimit) {
      resetCycle();
    }

    repeatCounter += 1;
    changeCounter += 1;

    if (!changeTriggered && changeLimit > 0 && changeCounter >= changeLimit) {
      frequency = clamp(frequency * changeMultiplier, minFrequency, MAX_FREQUENCY);
      changeTriggered = true;
    }

    slide += slideDelta;
    frequency = clamp(frequency * (1 + slide), minFrequency, MAX_FREQUENCY);
    duty = clamp(duty + dutyDelta, 0.02, 0.98);
    vibratoPhase += (Math.PI * 2 * vibratoRate) / options.sampleRate;

    const effectiveFrequency = clamp(
      frequency * (1 + Math.sin(vibratoPhase) * vibratoDepth),
      minFrequency,
      MAX_FREQUENCY,
    );

    phase += effectiveFrequency / options.sampleRate;
    while (phase >= 1) {
      phase -= 1;
      if (safeParams.waveform === 'noise') {
        noiseValue = randomSigned();
      }
    }

    let sample = getWaveformSample(safeParams.waveform, phase, duty, noiseValue);

    lowPassCutoff = clamp(lowPassCutoff + lowPassSweep, 0.001, 1);
    lowPassDelta += (sample - lowPassState) * lowPassCutoff;
    lowPassDelta *= lowPassDamping;
    lowPassState += lowPassDelta;
    sample = lowPassState;

    highPassAlpha = clamp(highPassAlpha + highPassSweep, 0.02, 0.999);
    const highPassed = highPassAlpha * (highPassPrevOutput + sample - highPassPrevInput);
    highPassPrevInput = sample;
    highPassPrevOutput = highPassed;
    sample = highPassed;

    phaserOffset = clamp(
      phaserOffset + phaserSweep,
      -(PHASER_BUFFER_SIZE - 1),
      PHASER_BUFFER_SIZE - 1,
    );
    const phaserDelay = Math.abs(Math.round(phaserOffset));
    const delayedIndex = (phaserIndex - phaserDelay + PHASER_BUFFER_SIZE) % PHASER_BUFFER_SIZE;
    sample += phaserBuffer[delayedIndex] * 0.65 * Math.sign(phaserOffset || 1);
    phaserBuffer[phaserIndex] = sample;
    phaserIndex = (phaserIndex + 1) % PHASER_BUFFER_SIZE;

    sample *= getEnvelopeLevel(
      index,
      attackSamples,
      sustainSamples,
      decaySamples,
      safeParams.sustainPunch,
    );
    sample *= safeParams.masterVolume;

    if (Math.abs(sample) > 1) {
      clippedSamples += 1;
    }

    const clampedSample = clamp(sample, -1, 1);
    peak = Math.max(peak, Math.abs(clampedSample));
    samples[index] = clampedSample;
  }

  return {
    samples,
    stats: {
      durationSeconds,
      samples: totalSamples,
      clippedSamples,
      peak,
      estimatedByteSize: 44 + totalSamples * (options.bitDepth / 8),
    },
  };
}

export function encodeSfxWav(
  samples: Float32Array,
  sampleRate: SfxSampleRate,
  bitDepth: SfxBitDepth,
): Blob {
  const channelCount = 1;
  const bytesPerSample = bitDepth / 8;
  const byteRate = sampleRate * channelCount * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = clamp(samples[index] ?? 0, -1, 1);
    if (bitDepth === 16) {
      const value = sample < 0
        ? Math.round(sample * 0x8000)
        : Math.round(sample * 0x7fff);
      view.setInt16(offset, value, true);
      offset += 2;
    } else {
      const value = Math.round((sample * 0.5 + 0.5) * 255);
      view.setUint8(offset, clamp(value, 0, 255));
      offset += 1;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getWaveformSample(
  waveform: SfxWaveform,
  phase: number,
  duty: number,
  noiseValue: number,
): number {
  switch (waveform) {
    case 'square':
      return phase < duty ? 1 : -1;
    case 'sawtooth':
      return 1 - phase * 2;
    case 'sine':
      return Math.sin(phase * Math.PI * 2);
    case 'noise':
      return noiseValue;
    default:
      return 0;
  }
}

function getEnvelopeLevel(
  index: number,
  attackSamples: number,
  sustainSamples: number,
  decaySamples: number,
  sustainPunch: number,
): number {
  if (attackSamples > 0 && index < attackSamples) {
    return index / attackSamples;
  }

  const sustainStart = attackSamples;
  const sustainEnd = sustainStart + sustainSamples;
  if (index < sustainEnd) {
    const sustainProgress = sustainSamples <= 1
      ? 1
      : (index - sustainStart) / sustainSamples;
    return 1 + (1 - sustainProgress) * sustainPunch * 0.8;
  }

  const decayStart = sustainEnd;
  const decayEnd = decayStart + decaySamples;
  if (index < decayEnd) {
    const decayProgress = decaySamples <= 1
      ? 1
      : (index - decayStart) / decaySamples;
    return Math.max(0, 1 - decayProgress);
  }

  return 0;
}

function normalizedFrequency(value: number): number {
  return 32 * 2 ** (clamp(value, 0, 1) * 6.5);
}

function signedCurve(value: number): number {
  const clamped = clamp(value, -1, 1);
  return Math.sign(clamped) * Math.abs(clamped) ** 3;
}

function randomWaveform(): SfxWaveform {
  const waveforms: SfxWaveform[] = ['square', 'sawtooth', 'sine', 'noise'];
  return waveforms[Math.floor(Math.random() * waveforms.length)] ?? 'square';
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomSigned(): number {
  return Math.random() * 2 - 1;
}

function isWaveform(value: unknown): value is SfxWaveform {
  return value === 'square' || value === 'sawtooth' || value === 'sine' || value === 'noise';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
