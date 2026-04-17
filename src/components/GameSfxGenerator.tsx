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
  { value: 'square', label: '方波' },
  { value: 'sawtooth', label: '锯齿波' },
  { value: 'sine', label: '正弦波' },
  { value: 'noise', label: '噪声' },
];
const WAVEFORM_LABELS: Record<SfxWaveform, string> = {
  square: '方波',
  sawtooth: '锯齿波',
  sine: '正弦波',
  noise: '噪声',
};
const PRESET_LABELS: Record<SfxPresetId, string> = {
  random: '随机',
  pickupCoin: '金币',
  laserShoot: '激光',
  explosion: '爆炸',
  powerup: '强化',
  hitHurt: '受击',
  jump: '跳跃',
  click: '点击',
  blipSelect: '选择',
  synth: '合成',
  tone: '音调',
  mutate: '变异',
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
  const [status, setStatus] = useState('已加载默认音色。试试一个预设，或者直接随机生成。');
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
    setStatus(`已生成「${PRESET_LABELS[preset]}」风格音效。`);
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
      setStatus('正在播放当前音效。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '播放失败。');
    }
  };

  const handleStop = (): void => {
    try {
      sourceRef.current?.stop();
    } catch {}

    sourceRef.current = null;
    setIsPlaying(false);
    setStatus('已停止播放。');
  };

  const handleCopyJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serialized);
      setStatus('参数 JSON 已复制到剪贴板。');
    } catch {
      setStatus('复制失败，你也可以直接从文本框手动复制。');
    }
  };

  const handleApplyJson = (): void => {
    try {
      commitParams(deserializeSfxParams(serialized));
      setStatus('参数 JSON 已应用。');
    } catch (error) {
      setStatus(error instanceof Error ? `JSON 无效：${error.message}` : 'JSON 无效。');
    }
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setSerialized(event.target.value);
  };

  return (
    <section className="generator-card" aria-labelledby="generator-title">
      <div className="panel-head panel-head--stack">
        <div>
          <h2 id="generator-title">程序化音效工作台</h2>
          <p className="panel-subtitle">
            灵感来自 sfxr 与 jsfxr，现在被拆分为一个只专注于游戏音效生成的独立仓库。
          </p>
        </div>
        <span>浏览器实时合成，无需上传素材。</span>
      </div>

      <div className="status-banner status-banner--global">{status}</div>

      <div className="preset-strip" role="toolbar" aria-label="音效预设">
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
              <h3>波形</h3>
              <span>先确定基础音色，再继续塑形。</span>
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
              <div className="panel-head"><h3>包络</h3><span>控制起音、保持与衰减。</span></div>
              <SliderField label="起音" hint="数值越高，声音开头越柔和。" value={params.attack} display={formatPercent(params.attack)} min={0} max={1} onChange={(value) => updateParam('attack', value)} />
              <SliderField label="保持" hint="决定声音主体持续多久。" value={params.sustain} display={formatPercent(params.sustain)} min={0} max={1} onChange={(value) => updateParam('sustain', value)} />
              <SliderField label="冲击" hint="为保持阶段开头增加额外力度。" value={params.sustainPunch} display={formatPercent(params.sustainPunch)} min={0} max={1} onChange={(value) => updateParam('sustainPunch', value)} />
              <SliderField label="衰减" hint="控制尾音持续时间。" value={params.decay} display={formatPercent(params.decay)} min={0} max={1} onChange={(value) => updateParam('decay', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>频率</h3><span>控制音高与滑音方向。</span></div>
              <SliderField label="起始" hint="越高代表初始音高越尖锐。" value={params.startFrequency} display={formatPercent(params.startFrequency)} min={0} max={1} onChange={(value) => updateParam('startFrequency', value)} />
              <SliderField label="下限" hint="避免音高下降得过低。" value={params.minFrequency} display={formatPercent(params.minFrequency)} min={0} max={1} onChange={(value) => updateParam('minFrequency', value)} />
              <SliderField label="滑音" hint="负值向下滑，正值向上滑。" value={params.slide} display={formatSignedPercent(params.slide)} min={-1} max={1} onChange={(value) => updateParam('slide', value)} />
              <SliderField label="滑音变化" hint="让滑音随时间加速或减速。" value={params.deltaSlide} display={formatSignedPercent(params.deltaSlide)} min={-1} max={1} onChange={(value) => updateParam('deltaSlide', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>调制</h3><span>控制颤音与跳音行为。</span></div>
              <SliderField label="颤音深度" hint="决定音高摆动幅度。" value={params.vibratoDepth} display={formatPercent(params.vibratoDepth)} min={0} max={1} onChange={(value) => updateParam('vibratoDepth', value)} />
              <SliderField label="颤音速度" hint="决定摆动发生得有多快。" value={params.vibratoSpeed} display={formatPercent(params.vibratoSpeed)} min={0} max={1} onChange={(value) => updateParam('vibratoSpeed', value)} />
              <SliderField label="琶音" hint="让音高在声音中段发生跳变。" value={params.changeAmount} display={formatSignedPercent(params.changeAmount)} min={-1} max={1} onChange={(value) => updateParam('changeAmount', value)} />
              <SliderField label="琶音速度" hint="控制跳变发生的时机。" value={params.changeSpeed} display={formatPercent(params.changeSpeed)} min={0} max={1} onChange={(value) => updateParam('changeSpeed', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>质感</h3><span>控制占空比、重复触发与移相器色彩。</span></div>
              <SliderField label="占空比" hint="主要影响方波的厚度。" value={params.squareDuty} display={formatPercent(params.squareDuty)} min={0} max={1} onChange={(value) => updateParam('squareDuty', value)} />
              <SliderField label="占空比扫动" hint="让占空比随时间变化。" value={params.dutySweep} display={formatSignedPercent(params.dutySweep)} min={-1} max={1} onChange={(value) => updateParam('dutySweep', value)} />
              <SliderField label="重复" hint="周期性重置声音形状。" value={params.repeatSpeed} display={formatPercent(params.repeatSpeed)} min={0} max={1} onChange={(value) => updateParam('repeatSpeed', value)} />
              <SliderField label="移相偏移" hint="增加复古科幻感的相位间距。" value={params.phaserOffset} display={formatSignedPercent(params.phaserOffset)} min={-1} max={1} onChange={(value) => updateParam('phaserOffset', value)} />
              <SliderField label="移相扫动" hint="让相位间距随时间移动。" value={params.phaserSweep} display={formatSignedPercent(params.phaserSweep)} min={-1} max={1} onChange={(value) => updateParam('phaserSweep', value)} />
            </div>

            <div className="panel-card">
              <div className="panel-head"><h3>滤波</h3><span>控制亮度、共振与低频清理。</span></div>
              <SliderField label="低通" hint="越低越暗，越高越亮。" value={params.lowPassCutoff} display={formatPercent(params.lowPassCutoff)} min={0} max={1} onChange={(value) => updateParam('lowPassCutoff', value)} />
              <SliderField label="低通扫动" hint="让亮度随时间变化。" value={params.lowPassSweep} display={formatSignedPercent(params.lowPassSweep)} min={-1} max={1} onChange={(value) => updateParam('lowPassSweep', value)} />
              <SliderField label="共振" hint="在截止频率附近增加个性。" value={params.lowPassResonance} display={formatPercent(params.lowPassResonance)} min={0} max={1} onChange={(value) => updateParam('lowPassResonance', value)} />
              <SliderField label="高通" hint="切掉浑浊的低频部分。" value={params.highPassCutoff} display={formatPercent(params.highPassCutoff)} min={0} max={1} onChange={(value) => updateParam('highPassCutoff', value)} />
              <SliderField label="高通扫动" hint="让低频切除量随时间变化。" value={params.highPassSweep} display={formatSignedPercent(params.highPassSweep)} min={-1} max={1} onChange={(value) => updateParam('highPassSweep', value)} />
              <SliderField label="音量" hint="最终输出增益。" value={params.masterVolume} display={formatPercent(params.masterVolume)} min={0} max={1} onChange={(value) => updateParam('masterVolume', value)} />
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <div className="panel-card preview-card">
            <div className="panel-head">
              <h3>预览</h3>
              <span>{WAVEFORM_LABELS[params.waveform]} · {sampleRate / 1000}kHz · {bitDepth} bit</span>
            </div>
            <div className="waveform-frame"><canvas ref={waveformCanvasRef} className="waveform-canvas" /></div>

            <div className="stats-grid">
              <div className="stat-card"><span>时长</span><strong>{rendered.stats.durationSeconds.toFixed(2)}s</strong></div>
              <div className="stat-card"><span>采样数</span><strong>{rendered.stats.samples.toLocaleString()}</strong></div>
              <div className="stat-card"><span>峰值</span><strong>{rendered.stats.peak.toFixed(2)}</strong></div>
              <div className="stat-card"><span>削波数</span><strong>{rendered.stats.clippedSamples.toLocaleString()}</strong></div>
            </div>

            <div className="preview-options">
              <div className="inline-options">
                <span>采样率</span>
                <div className="chip-group">
                  {SAMPLE_RATE_OPTIONS.map((option) => (
                    <button key={option} className={`segmented-button ${sampleRate === option ? 'is-active' : ''}`} type="button" onClick={() => setSampleRate(option)}>
                      {option >= 1000 ? `${option / 1000}k` : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-options">
                <span>位深</span>
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
              <span>预计导出体积</span>
              <strong>{formatBytes(rendered.stats.estimatedByteSize)}</strong>
              <small>本地生成的单声道 WAV 文件。</small>
            </div>

            <div className="action-grid">
              <button className="primary-button" type="button" onClick={() => { void handlePlay(); }}>{isPlaying ? '重新播放' : '播放'}</button>
              <button className="ghost-button" type="button" onClick={handleStop}>停止</button>
              <button className="secondary-button secondary-button--violet" type="button" onClick={() => downloadBlob(wavBlob, 'game-sfx.wav')}>导出 WAV</button>
              <button className="secondary-button secondary-button--emerald" type="button" onClick={() => downloadBlob(new Blob([serialized], { type: 'application/json' }), 'game-sfx.json')}>导出 JSON</button>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-head">
              <h3>参数 JSON</h3>
              <span>可以复制、保存，之后再粘贴回来继续编辑。</span>
            </div>
            <textarea className="json-editor" value={serialized} onChange={handleJsonChange} />
            <div className="json-actions">
              <button className="ghost-button" type="button" onClick={() => { void handleCopyJson(); }}>复制 JSON</button>
              <button className="ghost-button" type="button" onClick={handleApplyJson}>应用 JSON</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}