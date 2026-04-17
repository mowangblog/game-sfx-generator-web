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
const DEFAULT_EXPANDED_SECTIONS = {
  envelope: true,
  frequency: true,
  modulation: false,
  texture: false,
  filter: false,
} as const;

const WAVEFORM_OPTIONS: Array<{ value: SfxWaveform; label: string; detail: string }> = [
  { value: 'square', label: '方波', detail: '街机感最强，适合金币、UI、跳跃。' },
  { value: 'sawtooth', label: '锯齿波', detail: '更明亮尖锐，适合激光、切割、推进。' },
  { value: 'sine', label: '正弦波', detail: '更圆润干净，适合提示音、合成器色彩。' },
  { value: 'noise', label: '噪声', detail: '颗粒更粗，适合爆炸、命中、环境碎裂。' },
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

type SliderConfig = {
  key: keyof SfxParams;
  label: string;
  hint: string;
  min: number;
  max: number;
  step?: number;
  signed?: boolean;
};

type ControlSectionId = keyof typeof DEFAULT_EXPANDED_SECTIONS;

type ControlSection = {
  id: ControlSectionId;
  title: string;
  description: string;
  fields: SliderConfig[];
};

const CONTROL_SECTIONS: ControlSection[] = [
  {
    id: 'envelope',
    title: '包络',
    description: '控制起音、保持、冲击和衰减，先把节奏感调舒服。',
    fields: [
      { key: 'attack', label: '起音', hint: '数值越高，声音开头越柔和。', min: 0, max: 1 },
      { key: 'sustain', label: '保持', hint: '决定声音主体持续多久。', min: 0, max: 1 },
      { key: 'sustainPunch', label: '冲击', hint: '让保持阶段开头更有爆发感。', min: 0, max: 1 },
      { key: 'decay', label: '衰减', hint: '控制尾音持续时间。', min: 0, max: 1 },
    ],
  },
  {
    id: 'frequency',
    title: '频率',
    description: '定义起始音高、下限和滑音方向，是音效性格的核心。',
    fields: [
      { key: 'startFrequency', label: '起始', hint: '越高代表初始音高越尖锐。', min: 0, max: 1 },
      { key: 'minFrequency', label: '下限', hint: '避免音高下降得过低。', min: 0, max: 1 },
      { key: 'slide', label: '滑音', hint: '负值向下滑，正值向上滑。', min: -1, max: 1, signed: true },
      { key: 'deltaSlide', label: '滑音变化', hint: '让滑音随时间加速或减速。', min: -1, max: 1, signed: true },
    ],
  },
  {
    id: 'modulation',
    title: '调制',
    description: '给音高增加摆动和跳变，让声音更像电子合成器。',
    fields: [
      { key: 'vibratoDepth', label: '颤音深度', hint: '决定音高摆动幅度。', min: 0, max: 1 },
      { key: 'vibratoSpeed', label: '颤音速度', hint: '决定摆动发生得有多快。', min: 0, max: 1 },
      { key: 'changeAmount', label: '琶音', hint: '让音高在中段发生跳变。', min: -1, max: 1, signed: true },
      { key: 'changeSpeed', label: '琶音速度', hint: '控制跳变发生的时机。', min: 0, max: 1 },
    ],
  },
  {
    id: 'texture',
    title: '质感',
    description: '处理占空比、重复触发和移相器，让音色更有颗粒感。',
    fields: [
      { key: 'squareDuty', label: '占空比', hint: '主要影响方波的厚度。', min: 0, max: 1 },
      { key: 'dutySweep', label: '占空比扫动', hint: '让占空比随时间变化。', min: -1, max: 1, signed: true },
      { key: 'repeatSpeed', label: '重复', hint: '周期性重置声音形状。', min: 0, max: 1 },
      { key: 'phaserOffset', label: '移相偏移', hint: '增加复古科幻感的相位间距。', min: -1, max: 1, signed: true },
      { key: 'phaserSweep', label: '移相扫动', hint: '让相位间距随时间移动。', min: -1, max: 1, signed: true },
    ],
  },
  {
    id: 'filter',
    title: '滤波',
    description: '控制亮度、共振和低频清理，决定最后的空气感和锐度。',
    fields: [
      { key: 'lowPassCutoff', label: '低通', hint: '越低越暗，越高越亮。', min: 0, max: 1 },
      { key: 'lowPassSweep', label: '低通扫动', hint: '让亮度随时间变化。', min: -1, max: 1, signed: true },
      { key: 'lowPassResonance', label: '共振', hint: '在截止频率附近增加个性。', min: 0, max: 1 },
      { key: 'highPassCutoff', label: '高通', hint: '切掉浑浊的低频部分。', min: 0, max: 1 },
      { key: 'highPassSweep', label: '高通扫动', hint: '让低频切除量随时间变化。', min: -1, max: 1, signed: true },
      { key: 'masterVolume', label: '音量', hint: '最终输出增益。', min: 0, max: 1 },
    ],
  },
];

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
  gradient.addColorStop(0, '#f4e6c2');
  gradient.addColorStop(1, '#cfe6ea');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = 'rgba(34, 58, 78, 0.14)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();

  context.strokeStyle = '#126f83';
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
    <label className="slider-card">
      <div className="slider-card__topline">
        <span className="slider-card__label">{label}</span>
        <span className="slider-card__value">{display}</span>
      </div>
      <input
        min={min}
        max={max}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{hint}</small>
    </label>
  );
}

export default function GameSfxGenerator() {
  const [params, setParams] = useState<SfxParams>(DEFAULT_SFX_PARAMS);
  const [sampleRate, setSampleRate] = useState<SfxSampleRate>(44100);
  const [bitDepth, setBitDepth] = useState<SfxBitDepth>(16);
  const [serialized, setSerialized] = useState(() => serializeSfxParams(DEFAULT_SFX_PARAMS));
  const [status, setStatus] = useState('已加载默认音色。试试一个预设，或者先从包络和频率开始塑形。');
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<ControlSectionId, boolean>>({
    ...DEFAULT_EXPANDED_SECTIONS,
  });

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

  const toggleSection = (sectionId: ControlSectionId): void => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
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
      if (!navigator.clipboard) {
        throw new Error('clipboard-unavailable');
      }

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
    <section className="workbench-card" aria-labelledby="generator-title">
      <div className="workbench-layout">
        <div className="editor-column">
          <header className="console-surface workbench-intro">
            <p className="section-kicker">Workbench</p>
            <div className="workbench-intro__row">
              <div>
                <h2 id="generator-title">音效工作台</h2>
                <p className="workbench-intro__subtitle">
                  左侧负责塑形，右侧负责试听与导出。先选模板，再围绕包络和频率把声音调到位。
                </p>
              </div>
              <div className="console-readout">
                <span>Current Voice</span>
                <strong>{WAVEFORM_LABELS[params.waveform]}</strong>
              </div>
            </div>
          </header>

          <section className="console-surface preset-rack" aria-labelledby="preset-strip-title">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Preset Rack</p>
                <h3 id="preset-strip-title">音效预设</h3>
              </div>
              <span>选一个起点，再按你的游戏反馈继续细调。</span>
            </div>

            <div className="preset-strip" role="toolbar" aria-label="音效预设">
              {SFX_PRESET_ORDER.map((preset) => (
                <button
                  key={preset}
                  className={`preset-button ${preset === 'mutate' ? 'preset-button--accent' : ''}`}
                  type="button"
                  onClick={() => handlePreset(preset)}
                >
                  {PRESET_LABELS[preset]}
                </button>
              ))}
            </div>
          </section>

          <section className="console-surface waveform-bay" aria-labelledby="waveform-panel-title">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Waveform</p>
                <h3 id="waveform-panel-title">基础波形</h3>
              </div>
              <span>先定底色，再决定包络和滤波该往哪一边拉。</span>
            </div>

            <div className="waveform-grid">
              {WAVEFORM_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`mode-pill ${params.waveform === option.value ? 'is-active' : ''}`}
                >
                  <input
                    checked={params.waveform === option.value}
                    type="radio"
                    name="sfx-waveform"
                    onChange={() => updateParam('waveform', option.value)}
                  />
                  <span className="mode-pill__label">{option.label}</span>
                  <small>{option.detail}</small>
                </label>
              ))}
            </div>
          </section>

          <div className="section-stack">
            {CONTROL_SECTIONS.map((section) => {
              const expanded = expandedSections[section.id];

              return (
                <section key={section.id} className={`console-surface control-section ${expanded ? 'is-open' : ''}`}>
                  <button
                    className="control-section__toggle"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`control-section-panel-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                  >
                    <div>
                      <p className="section-kicker">Control Group</p>
                      <h3>{section.title}</h3>
                      <span>{section.description}</span>
                    </div>
                    <span className="control-section__state">{expanded ? '收起' : '展开'}</span>
                  </button>

                  <div id={`control-section-panel-${section.id}`} hidden={!expanded}>
                    <div className="slider-grid">
                      {section.fields.map((field) => {
                        const value = params[field.key] as number;

                        return (
                          <SliderField
                            key={field.key}
                            label={field.label}
                            hint={field.hint}
                            value={value}
                            display={field.signed ? formatSignedPercent(value) : formatPercent(value)}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            onChange={(nextValue) => updateParam(field.key, nextValue)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="preview-column">
          <section className={`console-surface preview-dock ${isPlaying ? 'is-live' : ''}`} aria-labelledby="preview-title">
            <div className="panel-head preview-dock__head">
              <div>
                <p className="section-kicker">Live Monitor</p>
                <h3 id="preview-title">预览台</h3>
              </div>
              <span className="preview-dock__meta">
                {WAVEFORM_LABELS[params.waveform]} · {sampleRate / 1000}kHz · {bitDepth} bit
              </span>
            </div>

            <div className="waveform-frame">
              <canvas ref={waveformCanvasRef} className="waveform-canvas" />
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>时长</span>
                <strong>{rendered.stats.durationSeconds.toFixed(2)}s</strong>
              </div>
              <div className="stat-card">
                <span>采样数</span>
                <strong>{rendered.stats.samples.toLocaleString()}</strong>
              </div>
              <div className="stat-card">
                <span>峰值</span>
                <strong>{rendered.stats.peak.toFixed(2)}</strong>
              </div>
              <div className="stat-card">
                <span>削波数</span>
                <strong>{rendered.stats.clippedSamples.toLocaleString()}</strong>
              </div>
            </div>

            <div className="preview-options">
              <div className="inline-options">
                <span>采样率</span>
                <div className="chip-group">
                  {SAMPLE_RATE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      className={`segmented-button ${sampleRate === option ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => setSampleRate(option)}
                    >
                      {option >= 1000 ? `${option / 1000}k` : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-options">
                <span>位深</span>
                <div className="chip-group">
                  {BIT_DEPTH_OPTIONS.map((option) => (
                    <button
                      key={option}
                      className={`segmented-button ${bitDepth === option ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => setBitDepth(option)}
                    >
                      {option} bit
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="monitor-actions">
              <button className="primary-button" type="button" onClick={() => { void handlePlay(); }}>
                {isPlaying ? '重新播放' : '播放'}
              </button>
              <button className="ghost-button" type="button" onClick={handleStop}>
                停止
              </button>
            </div>

            <div className={`status-banner ${isPlaying ? 'status-banner--live' : ''}`} role="status">
              {status}
            </div>
          </section>

          <section className="console-surface export-dock" aria-labelledby="export-title">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Export</p>
                <h3 id="export-title">导出</h3>
              </div>
              <span>保存参数或直接导出成资源文件。</span>
            </div>

            <div className="option-card option-card--monitor">
              <span>预计导出体积</span>
              <strong>{formatBytes(rendered.stats.estimatedByteSize)}</strong>
              <small>本地生成的单声道 WAV 文件，不经过任何服务器。</small>
            </div>

            <div className="export-actions">
              <button
                className="secondary-button secondary-button--amber"
                type="button"
                onClick={() => downloadBlob(wavBlob, 'game-sfx.wav')}
              >
                导出 WAV
              </button>
              <button
                className="secondary-button secondary-button--teal"
                type="button"
                onClick={() => downloadBlob(new Blob([serialized], { type: 'application/json' }), 'game-sfx.json')}
              >
                导出 JSON
              </button>
            </div>

            <div className="advanced-editor">
              <label className="advanced-editor__label" htmlFor="sfx-json-editor">
                参数 JSON
              </label>
              <textarea
                id="sfx-json-editor"
                className="json-editor"
                aria-label="参数 JSON 编辑器"
                value={serialized}
                onChange={handleJsonChange}
              />
              <div className="json-actions">
                <button className="ghost-button" type="button" onClick={() => { void handleCopyJson(); }}>
                  复制 JSON
                </button>
                <button className="ghost-button" type="button" onClick={handleApplyJson}>
                  应用 JSON
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
