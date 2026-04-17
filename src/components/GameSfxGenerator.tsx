import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  DEFAULT_SFX_PARAMS,
  SFX_PRESET_ORDER,
  clampSfxParams,
  createSfxPreset,
  deserializeSfxParams,
  encodeSfxWav,
  renderSfx,
  serializeSfxParams,
  type SfxBitDepth,
  type SfxParams,
  type SfxPresetId,
  type SfxSampleRate,
  type SfxWaveform,
} from '../lib/sfx';

const SAMPLE_RATE_OPTIONS: SfxSampleRate[] = [44100, 22050, 11025, 8000];
const BIT_DEPTH_OPTIONS: SfxBitDepth[] = [16, 8];
const WAVEFORM_OPTIONS: Array<{ value: SfxWaveform; label: string }> = [
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'sine', label: 'Sine' },
  { value: 'noise', label: 'Noise' },
];
const PRESET_LABELS: Record<SfxPresetId, string> = {
  random: 'Random',
  pickupCoin: 'Coin',
  laserShoot: 'Laser',
  explosion: 'Explosion',
  powerup: 'Powerup',
  hitHurt: 'Hit',
  jump: 'Jump',
  click: 'Click',
  blipSelect: 'Select',
  synth: 'Synth',
  tone: 'Tone',
  mutate: 'Mutate',
};

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const kiloBytes = value / 1024;
  if (kiloBytes < 1024) {
    return `${kiloBytes.toFixed(1)} KB`;
  }

  return `${(kiloBytes / 1024).toFixed(2)} MB`;
}

function drawWaveform(canvas: HTMLCanvasElement | null, samples: Float32Array): void {
  if (!canvas) {
    return;
  }

  const width = 720;
  const height = 180;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#fff6df');
  gradient.addColorStop(1, '#eef5ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = 'rgba(15, 23, 42, 0.12)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();

  context.strokeStyle = '#2563eb';
  context.lineWidth = 2;
  context.beginPath();

  const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));
  for (let x = 0; x < width; x += 1) {
    const start = x * samplesPerPixel;
    const end = Math.min(samples.length, start + samplesPerPixel);
    let min = 1;
    let max = -1;

    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }

    const y1 = ((1 - max) * height) / 2;
    const y2 = ((1 - min) * height) / 2;
    if (x === 0) {
      context.moveTo(x, y1);
    } else {
      context.lineTo(x, y1);
    }
    context.lineTo(x, y2);
  }

  context.stroke();
}

function SliderField(props: {
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (nextValue: number) => void;
}) {
  const { label, hint, value, display, min, max, step = 0.01, onChange } = props;

  return (
    <label className="range-field sfx-range-field">
      <span>{label}: {display}</span>
      <input min={min} max={max} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{hint}</small>
    </label>
  );
}

export default function GameSfxGenerator() {
  const [params, setParams] = useState<SfxParams>(DEFAULT_SFX_PARAMS);
  const [sampleRate, setSampleRate] = useState<SfxSampleRate>(44100);
  const [bitDepth, setBitDepth] = useState<SfxBitDepth>(16);
  const [serialized, setSerialized] = useState(() => serializeSfxParams(DEFAULT_SFX_PARAMS));
  const [status, setStatus] = useState('Default patch loaded. Try a preset or randomize it.');
  const [isPlaying, setIsPlaying] = useState(false);

  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const rendered = useMemo(() => renderSfx(params, { sampleRate, bitDepth }), [bitDepth, params, sampleRate]);
  const wavBlob = useMemo(() => encodeSfxWav(rendered.samples, sampleRate, bitDepth), [bitDepth, rendered.samples, sampleRate]);

  useEffect(() => {
    drawWaveform(waveformCanvasRef.current, rendered.samples);
  }, [rendered.samples]);

  useEffect(() => {
    setSerialized(serializeSfxParams(params));
  }, [params]);

  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.stop();
      } catch {}

      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const commitParams = (nextValue: SfxParams | ((current: SfxParams) => SfxParams)): void => {
    setParams((current) => clampSfxParams(typeof nextValue === 'function' ? nextValue(current) : nextValue));
  };

  const updateParam = <K extends keyof SfxParams>(key: K, value: SfxParams[K]): void => {
    commitParams((current) => ({ ...current, [key]: value }));
  };

  const handlePreset = (preset: SfxPresetId): void => {
    commitParams((current) => createSfxPreset(preset, current));
    setStatus(`Generated a ${PRESET_LABELS[preset]} style effect.`);
  };

  const ensureAudioContext = async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const handlePlay = async (): Promise<void> => {
    try {
      const audioContext = await ensureAudioContext();

      try {
        sourceRef.current?.stop();
      } catch {}

      const buffer = audioContext.createBuffer(1, rendered.samples.length, sampleRate);
      buffer.getChannelData(0).set(rendered.samples);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null;
          setIsPlaying(false);
        }
      };
      source.start();

      sourceRef.current = source;
      setIsPlaying(true);
      setStatus('Playing the current sound effect.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Playback failed.');
    }
  };

  const handleStop = (): void => {
    try {
      sourceRef.current?.stop();
    } catch {}

    sourceRef.current = null;
    setIsPlaying(false);
    setStatus('Playback stopped.');
  };

  const handleCopyJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serialized);
      setStatus('Parameter JSON copied to clipboard.');
    } catch {
      setStatus('Clipboard copy failed. You can copy from the text area instead.');
    }
  };

  const handleApplyJson = (): void => {
    try {
      commitParams(deserializeSfxParams(serialized));
      setStatus('Parameter JSON applied.');
    } catch (error) {
      setStatus(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.');
    }
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setSerialized(event.target.value);
  };

  return (
    <section className="generator-card" aria-labelledby="generator-title">
      <div className="panel-head panel-head--stack">
        <div>
          <h2 id="generator-title">Procedural SFX Workbench</h2>
          <p className="panel-subtitle">
            Inspired by sfxr and jsfxr, but extracted into a standalone repository focused only on game audio generation.
          </p>
        </div>
        <span>Realtime browser synthesis. No upload required.</span>
      </div>

      <div className="status-banner status-banner--global">{status}</div>

      <div className="preset-strip" role="toolbar" aria-label="SFX presets">
        {SFX_PRESET_ORDER.map((preset) => (
          <button key={preset} className={`ghost-button preset-button ${preset === 'mutate' ? 'preset-button--accent' : ''}`} type="button" onClick={() => handlePreset(preset)}>
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      <div className="generator-layout">
        <div className="controls-column">
          <div className="panel-card">
            <div className="panel-head">
              <h3>Waveform</h3>
              <span>Choose the sonic base before shaping it.</span>
            </div>
            <div className="waveform-grid">
              {WAVEFORM_OPTIONS.map((option) => (
                <label key={option.value} className={`mode-pill ${params.waveform === option.value ? 'is-active' : ''}`}>
                  <input checked={params.waveform === option.value} type="radio" name="sfx-waveform" onChange={() => updateParam('waveform', option.value)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="controls-grid">
            <div className="panel-card">
              <div className="panel-head"><h3>Envelope</h3><span>Attack, hold, and decay.</span></div>
              <SliderField label="Attack" hint="Higher values soften the start." value={params.attack} display={formatPercent(params.attack)} min={0} max={1} onChange={(value) => updateParam('attack', value)} />
              <SliderField label="Sustain" hint="Controls the body of the sound." value={params.sustain} display={formatPercent(params.sustain)} min={0} max={1} onChange={(value) => updateParam('sustain', value)} />
              <SliderField label="Punch" hint="Adds extra impact at the beginning of the sustain stage." value={params.sustainPunch} display={formatPercent(params.sustainPunch)} min={0} max={1} onChange={(value) => updateParam('sustainPunch', value)} />
              <SliderField label="Decay" hint="Controls how long the tail lasts." value={params.decay} display={formatPercent(params.decay)} min={0} max={1} onChange={(value) => updateParam('decay', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>Frequency</h3><span>Pitch and slide direction.</span></div>
              <SliderField label="Start" hint="Higher values produce a sharper starting pitch." value={params.startFrequency} display={formatPercent(params.startFrequency)} min={0} max={1} onChange={(value) => updateParam('startFrequency', value)} />
              <SliderField label="Min" hint="Prevents the pitch from falling too low." value={params.minFrequency} display={formatPercent(params.minFrequency)} min={0} max={1} onChange={(value) => updateParam('minFrequency', value)} />
              <SliderField label="Slide" hint="Negative falls, positive rises." value={params.slide} display={formatSignedPercent(params.slide)} min={-1} max={1} onChange={(value) => updateParam('slide', value)} />
              <SliderField label="Delta Slide" hint="Accelerates or slows the slide over time." value={params.deltaSlide} display={formatSignedPercent(params.deltaSlide)} min={-1} max={1} onChange={(value) => updateParam('deltaSlide', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>Modulation</h3><span>Vibrato and jumpy pitch behavior.</span></div>
              <SliderField label="Vibrato Depth" hint="How much the pitch wobbles." value={params.vibratoDepth} display={formatPercent(params.vibratoDepth)} min={0} max={1} onChange={(value) => updateParam('vibratoDepth', value)} />
              <SliderField label="Vibrato Speed" hint="How fast the wobble happens." value={params.vibratoSpeed} display={formatPercent(params.vibratoSpeed)} min={0} max={1} onChange={(value) => updateParam('vibratoSpeed', value)} />
              <SliderField label="Arpeggio" hint="Makes the pitch jump in the middle of the sound." value={params.changeAmount} display={formatSignedPercent(params.changeAmount)} min={-1} max={1} onChange={(value) => updateParam('changeAmount', value)} />
              <SliderField label="Arp Speed" hint="Controls when that jump occurs." value={params.changeSpeed} display={formatPercent(params.changeSpeed)} min={0} max={1} onChange={(value) => updateParam('changeSpeed', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>Texture</h3><span>Duty cycle, retrigger, and phaser color.</span></div>
              <SliderField label="Duty" hint="Mostly affects square-wave thickness." value={params.squareDuty} display={formatPercent(params.squareDuty)} min={0} max={1} onChange={(value) => updateParam('squareDuty', value)} />
              <SliderField label="Duty Sweep" hint="Shifts duty over time." value={params.dutySweep} display={formatSignedPercent(params.dutySweep)} min={-1} max={1} onChange={(value) => updateParam('dutySweep', value)} />
              <SliderField label="Repeat" hint="Periodically resets the sound shape." value={params.repeatSpeed} display={formatPercent(params.repeatSpeed)} min={0} max={1} onChange={(value) => updateParam('repeatSpeed', value)} />
              <SliderField label="Phaser Offset" hint="Adds retro sci-fi phase spacing." value={params.phaserOffset} display={formatSignedPercent(params.phaserOffset)} min={-1} max={1} onChange={(value) => updateParam('phaserOffset', value)} />
              <SliderField label="Phaser Sweep" hint="Moves the phase spacing over time." value={params.phaserSweep} display={formatSignedPercent(params.phaserSweep)} min={-1} max={1} onChange={(value) => updateParam('phaserSweep', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>Filters</h3><span>Brightness, resonance, and low-end cleanup.</span></div>
              <SliderField label="Low-pass" hint="Lower is darker, higher is brighter." value={params.lowPassCutoff} display={formatPercent(params.lowPassCutoff)} min={0} max={1} onChange={(value) => updateParam('lowPassCutoff', value)} />
              <SliderField label="LP Sweep" hint="Changes brightness over time." value={params.lowPassSweep} display={formatSignedPercent(params.lowPassSweep)} min={-1} max={1} onChange={(value) => updateParam('lowPassSweep', value)} />
              <SliderField label="Resonance" hint="Adds character around the filter cutoff." value={params.lowPassResonance} display={formatPercent(params.lowPassResonance)} min={0} max={1} onChange={(value) => updateParam('lowPassResonance', value)} />
              <SliderField label="High-pass" hint="Cuts muddy low frequencies." value={params.highPassCutoff} display={formatPercent(params.highPassCutoff)} min={0} max={1} onChange={(value) => updateParam('highPassCutoff', value)} />
              <SliderField label="HP Sweep" hint="Changes the low cut over time." value={params.highPassSweep} display={formatSignedPercent(params.highPassSweep)} min={-1} max={1} onChange={(value) => updateParam('highPassSweep', value)} />
              <SliderField label="Volume" hint="Final output gain." value={params.masterVolume} display={formatPercent(params.masterVolume)} min={0} max={1} onChange={(value) => updateParam('masterVolume', value)} />
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <div className="panel-card preview-card">
            <div className="panel-head">
              <h3>Preview</h3>
              <span>{params.waveform} · {sampleRate / 1000}kHz · {bitDepth} bit</span>
            </div>
            <div className="waveform-frame"><canvas ref={waveformCanvasRef} className="waveform-canvas" /></div>

            <div className="stats-grid">
              <div className="stat-card"><span>Duration</span><strong>{rendered.stats.durationSeconds.toFixed(2)}s</strong></div>
              <div className="stat-card"><span>Samples</span><strong>{rendered.stats.samples.toLocaleString()}</strong></div>
              <div className="stat-card"><span>Peak</span><strong>{rendered.stats.peak.toFixed(2)}</strong></div>
              <div className="stat-card"><span>Clipped</span><strong>{rendered.stats.clippedSamples.toLocaleString()}</strong></div>
            </div>

            <div className="preview-options">
              <div className="inline-options">
                <span>Sample Rate</span>
                <div className="chip-group">
                  {SAMPLE_RATE_OPTIONS.map((option) => (
                    <button key={option} className={`segmented-button ${sampleRate === option ? 'is-active' : ''}`} type="button" onClick={() => setSampleRate(option)}>
                      {option >= 1000 ? `${option / 1000}k` : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-options">
                <span>Bit Depth</span>
                <div className="chip-group">
                  {BIT_DEPTH_OPTIONS.map((option) => (
                    <button key={option} className={`segmented-button ${bitDepth === option ? 'is-active' : ''}`} type="button" onClick={() => setBitDepth(option)}>
                      {option} bit
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="option-card">
              <span>Estimated Export Size</span>
              <strong>{formatBytes(rendered.stats.estimatedByteSize)}</strong>
              <small>Mono WAV file generated locally.</small>
            </div>

            <div className="action-grid">
              <button className="primary-button" type="button" onClick={() => { void handlePlay(); }}>{isPlaying ? 'Replay' : 'Play'}</button>
              <button className="ghost-button" type="button" onClick={handleStop}>Stop</button>
              <button className="secondary-button secondary-button--violet" type="button" onClick={() => downloadBlob(wavBlob, 'game-sfx.wav')}>Download WAV</button>
              <button className="secondary-button secondary-button--emerald" type="button" onClick={() => downloadBlob(new Blob([serialized], { type: 'application/json' }), 'game-sfx.json')}>Download JSON</button>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-head">
              <h3>Parameter JSON</h3>
              <span>Copy it out, save it, or paste it back later.</span>
            </div>
            <textarea className="json-editor" value={serialized} onChange={handleJsonChange} />
            <div className="json-actions">
              <button className="ghost-button" type="button" onClick={() => { void handleCopyJson(); }}>Copy JSON</button>
              <button className="ghost-button" type="button" onClick={handleApplyJson}>Apply JSON</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

