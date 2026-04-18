import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { encodeMp3FromSamples, encodeOggFromSamples } from '../lib/audioExport';
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

const HISTORY_STORAGE_KEY = 'retro-sfx-history-v1';
const SAMPLE_RATE_OPTIONS: SfxSampleRate[] = [44100, 22050, 11025, 8000];
const BIT_DEPTH_OPTIONS: SfxBitDepth[] = [16, 8];
const DEFAULT_EXPANDED_SECTIONS = {
  envelope: true,
  frequency: true,
  modulation: false,
  texture: false,
  filter: false,
} as const;
const EXPORT_OPTIONS = [
  { value: 'wav', label: 'Download .wav' },
  { value: 'json', label: 'Download .json' },
  { value: 'mp3', label: 'Download .mp3' },
  { value: 'ogg', label: 'Download .ogg' },
] as const;

export type ExportFormat = (typeof EXPORT_OPTIONS)[number]['value'];
export type SavedSfxHistoryItem = {
  id: string;
  name: string;
  savedAt: string;
  presetId: SfxPresetId | null;
  params: SfxParams;
  sampleRate: SfxSampleRate;
  bitDepth: SfxBitDepth;
  waveform: SfxWaveform;
};

type ControlSectionId = keyof typeof DEFAULT_EXPANDED_SECTIONS;
type Snapshot = Omit<SavedSfxHistoryItem, 'id' | 'savedAt'>;
type SliderConfig = {
  key: keyof SfxParams;
  label: string;
  hint: string;
  min: number;
  max: number;
  step?: number;
  signed?: boolean;
};
type ControlSection = {
  id: ControlSectionId;
  title: string;
  description: string;
  fields: SliderConfig[];
};

const WAVEFORM_OPTIONS: Array<{ value: SfxWaveform; label: string; detail: string; glyph: string }> = [
  { value: 'square', label: '方波', detail: '街机味最强，适合金币、菜单和跳跃。', glyph: '[]' },
  { value: 'sawtooth', label: '锯齿波', detail: '更亮更硬，适合激光和切割感。', glyph: '/|' },
  { value: 'sine', label: '正弦波', detail: '更圆润干净，适合提示音。', glyph: '~' },
  { value: 'noise', label: '噪声', detail: '颗粒更粗，适合爆炸和命中。', glyph: '::' },
];
const WAVEFORM_LABELS: Record<SfxWaveform, string> = {
  square: '方波',
  sawtooth: '锯齿波',
  sine: '正弦波',
  noise: '噪声',
};
const PRESET_LABELS: Record<SfxPresetId, string> = {
  random: '随机', pickupCoin: '金币', laserShoot: '激光', explosion: '爆炸', powerup: '强化', hitHurt: '受击', jump: '跳跃', click: '点击', blipSelect: '选择', synth: '合成', tone: '音调', mutate: '变异',
};
const PRESET_DETAILS: Record<SfxPresetId, string> = {
  random: '探索灵感', pickupCoin: '奖励反馈', laserShoot: '射击脉冲', explosion: '爆裂冲击', powerup: '升级提示', hitHurt: '受击反馈', jump: '动作起跳', click: '轻量点击', blipSelect: '菜单选择', synth: '电子音色', tone: '单音底色', mutate: '快速变体',
};
const PRESET_GLYPHS: Record<SfxPresetId, string> = {
  random: 'RND', pickupCoin: 'COIN', laserShoot: 'LAS', explosion: 'EXP', powerup: 'UP', hitHurt: 'HIT', jump: 'JMP', click: 'CLK', blipSelect: 'SEL', synth: 'SYN', tone: 'TON', mutate: 'ALT',
};
const CONTROL_SECTIONS: ControlSection[] = [
  { id: 'envelope', title: '音量轮廓', description: '控制起音、保持、冲击和衰减。', fields: [
    { key: 'attack', label: '起音', hint: '数值越高，开头越柔和。', min: 0, max: 1 },
    { key: 'sustain', label: '保持', hint: '决定声音主体持续多久。', min: 0, max: 1 },
    { key: 'sustainPunch', label: '冲击', hint: '让保持阶段更有爆发感。', min: 0, max: 1 },
    { key: 'decay', label: '衰减', hint: '控制尾音时长。', min: 0, max: 1 },
  ]},
  { id: 'frequency', title: '频率', description: '决定起始音高、下限与滑音。', fields: [
    { key: 'startFrequency', label: '起始', hint: '越高越尖锐。', min: 0, max: 1 },
    { key: 'minFrequency', label: '下限', hint: '避免下滑过低。', min: 0, max: 1 },
    { key: 'slide', label: '滑音', hint: '负值向下滑，正值向上滑。', min: -1, max: 1, signed: true },
    { key: 'deltaSlide', label: '滑音变化', hint: '让滑音加速或减速。', min: -1, max: 1, signed: true },
  ]},
  { id: 'modulation', title: '调制', description: '增加颤音与跳变。', fields: [
    { key: 'vibratoDepth', label: '颤音深度', hint: '控制摆动幅度。', min: 0, max: 1 },
    { key: 'vibratoSpeed', label: '颤音速度', hint: '控制摆动速度。', min: 0, max: 1 },
    { key: 'changeAmount', label: '转调', hint: '中段音高跳变。', min: -1, max: 1, signed: true },
    { key: 'changeSpeed', label: '转调时机', hint: '控制跳变发生的时点。', min: 0, max: 1 },
  ]},
  { id: 'texture', title: '质感', description: '调整占空比、重复与移相。', fields: [
    { key: 'squareDuty', label: '占空比', hint: '主要影响方波厚度。', min: 0, max: 1 },
    { key: 'dutySweep', label: '占空比扫动', hint: '让占空比随时间变化。', min: -1, max: 1, signed: true },
    { key: 'repeatSpeed', label: '重复', hint: '周期性重置声音形态。', min: 0, max: 1 },
    { key: 'phaserOffset', label: '移相偏移', hint: '增加科幻感。', min: -1, max: 1, signed: true },
    { key: 'phaserSweep', label: '移相扫动', hint: '让相位随时间移动。', min: -1, max: 1, signed: true },
  ]},
  { id: 'filter', title: '滤波', description: '决定亮度、共振与低频清理。', fields: [
    { key: 'lowPassCutoff', label: '低通', hint: '越低越暗。', min: 0, max: 1 },
    { key: 'lowPassSweep', label: '低通扫动', hint: '让亮度随时间变化。', min: -1, max: 1, signed: true },
    { key: 'lowPassResonance', label: '共振', hint: '在截止频率附近增加个性。', min: 0, max: 1 },
    { key: 'highPassCutoff', label: '高通', hint: '切掉浑浊低频。', min: 0, max: 1 },
    { key: 'highPassSweep', label: '高通扫动', hint: '让低频切除量变化。', min: -1, max: 1, signed: true },
    { key: 'masterVolume', label: '音量', hint: '最终输出增益。', min: 0, max: 1 },
  ]},
];

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function isSampleRate(value: unknown): value is SfxSampleRate { return value === 44100 || value === 22050 || value === 11025 || value === 8000; }
function isBitDepth(value: unknown): value is SfxBitDepth { return value === 16 || value === 8; }
function isWaveform(value: unknown): value is SfxWaveform { return value === 'square' || value === 'sawtooth' || value === 'sine' || value === 'noise'; }
function isPresetId(value: unknown): value is SfxPresetId { return typeof value === 'string' && SFX_PRESET_ORDER.includes(value as SfxPresetId); }
function formatPercent(value: number): string { return `${Math.round(value * 100)}%`; }
function formatSignedPercent(value: number): string { return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`; }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / (1024 * 1024)).toFixed(2)} MB`; }
function formatSampleRateChip(value: SfxSampleRate): string { return value >= 1000 ? `${value / 1000}k` : `${value}`; }
function formatSampleRateMeta(value: SfxSampleRate): string { return value % 1000 === 0 ? `${value / 1000}kHz` : `${(value / 1000).toFixed(2)}kHz`; }
function pad2(value: number): string { return value.toString().padStart(2, '0'); }
function formatHistoryDetail(savedAt: string): string { const date = new Date(savedAt); return Number.isNaN(date.getTime()) ? '保存时间未知' : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }
function createId(): string { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sfx-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function createDefaultHistoryName(presetId: SfxPresetId | null, savedAt: string): string { const date = new Date(savedAt); const label = presetId ? PRESET_LABELS[presetId] : '自定义'; return `${label} / ${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }
function createSnapshotName(presetId: SfxPresetId | null): string { return presetId ? PRESET_LABELS[presetId] : 'custom'; }
function sanitizeFileStem(value: string): string { return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-') || 'retro-sfx'; }
function downloadBlob(blob: Blob, fileName: string): void { const objectUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = objectUrl; link.download = fileName; link.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
function drawWaveform(canvas: HTMLCanvasElement | null, samples: Float32Array): void {
  if (!canvas) return;
  const width = 720;
  const height = 180;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
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
    if (x === 0) context.moveTo(x, y1); else context.lineTo(x, y1);
    context.lineTo(x, y2);
  }
  context.stroke();
}

function parseHistoryItem(value: unknown): SavedSfxHistoryItem | null {
  if (!isRecord(value)) return null;
  const params = clampSfxParams(isRecord(value.params) ? (value.params as Partial<SfxParams>) : DEFAULT_SFX_PARAMS);
  const waveform = isWaveform(value.waveform) ? value.waveform : params.waveform;
  const presetId = isPresetId(value.presetId) ? value.presetId : null;
  const sampleRate = isSampleRate(value.sampleRate) ? value.sampleRate : 44100;
  const bitDepth = isBitDepth(value.bitDepth) ? value.bitDepth : 16;
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString();
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : createDefaultHistoryName(presetId, savedAt);
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : createId();
  return { id, name, savedAt, presetId, params: { ...params, waveform }, sampleRate, bitDepth, waveform };
}
function loadHistoryFromStorage(): SavedSfxHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseHistoryItem).filter((item): item is SavedSfxHistoryItem => item !== null);
  } catch {
    return [];
  }
}
function saveHistoryToStorage(history: SavedSfxHistoryItem[]): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch {}
}
function createHistoryItem(snapshot: Snapshot): SavedSfxHistoryItem {
  const savedAt = new Date().toISOString();
  return { id: createId(), name: createDefaultHistoryName(snapshot.presetId, savedAt), savedAt, presetId: snapshot.presetId, params: clampSfxParams(snapshot.params), sampleRate: snapshot.sampleRate, bitDepth: snapshot.bitDepth, waveform: snapshot.waveform };
}
function toSnapshot(item: SavedSfxHistoryItem): Snapshot { return { name: item.name, presetId: item.presetId, params: item.params, sampleRate: item.sampleRate, bitDepth: item.bitDepth, waveform: item.waveform }; }
async function exportSnapshot(format: ExportFormat, snapshot: Snapshot): Promise<Blob> {
  if (format === 'json') return new Blob([serializeSfxParams(snapshot.params)], { type: 'application/json' });
  const rendered = renderSfx(snapshot.params, { sampleRate: snapshot.sampleRate, bitDepth: snapshot.bitDepth });
  if (format === 'wav') return encodeSfxWav(rendered.samples, snapshot.sampleRate, snapshot.bitDepth);
  if (format === 'mp3') return encodeMp3FromSamples(rendered.samples, snapshot.sampleRate);
  return encodeOggFromSamples(rendered.samples, snapshot.sampleRate, snapshot.name);
}

function SliderField(props: { label: string; hint: string; value: number; display: string; min: number; max: number; step?: number; onChange: (nextValue: number) => void }) {
  const { label, hint, value, display, min, max, step = 0.01, onChange } = props;
  return (
    <label className="slider-card">
      <div className="slider-card__topline"><span className="slider-card__label">{label}</span><span className="slider-card__value">{display}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{hint}</small>
    </label>
  );
}

function ExportMenu(props: { menuId: string; label: string; variant?: 'console' | 'inline'; isOpen: boolean; isExporting: boolean; triggerClassName: string; onToggle: (menuId: string) => void; onExport: (format: ExportFormat) => void }) {
  const { menuId, label, variant = 'inline', isOpen, isExporting, triggerClassName, onToggle, onExport } = props;
  return (
    <div className={`export-menu ${isOpen ? 'is-open' : ''}`}>
      <button className={triggerClassName} type="button" aria-haspopup="menu" aria-expanded={isOpen} aria-label={label} disabled={isExporting} onClick={() => onToggle(menuId)}>
        {variant === 'console' ? (
          <>
            <span className="export-menu__copy">
              <span className="export-menu__eyebrow">{isExporting ? 'Encoding' : 'File Output'}</span>
              <span className="export-menu__title">{isExporting ? '导出中...' : '导出音效'}</span>
            </span>
            <span className="export-menu__caret export-menu__caret--console" aria-hidden="true">▾</span>
          </>
        ) : (
          <>
            <span>{isExporting ? '导出中...' : '导出'}</span>
            <span className="export-menu__caret" aria-hidden="true">▾</span>
          </>
        )}
      </button>
      {isOpen ? (
        <div className="export-menu__list" role="menu" aria-label={`${label} 菜单`}>
          {EXPORT_OPTIONS.map((option) => (
            <button key={option.value} className="export-menu__item" type="button" role="menuitem" onClick={() => onExport(option.value)}>{option.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function GameSfxGenerator() {
  const [params, setParams] = useState<SfxParams>(DEFAULT_SFX_PARAMS);
  const [sampleRate, setSampleRate] = useState<SfxSampleRate>(44100);
  const [bitDepth, setBitDepth] = useState<SfxBitDepth>(16);
  const [activePreset, setActivePreset] = useState<SfxPresetId | null>(null);
  const [serialized, setSerialized] = useState(() => serializeSfxParams(DEFAULT_SFX_PARAMS));
  const [status, setStatus] = useState('已加载默认音色。先选一个预设，再从音量轮廓和频率开始微调。');
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState<SavedSfxHistoryItem[]>(() => loadHistoryFromStorage());
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null);
  const [exportingMenuId, setExportingMenuId] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryName, setEditingHistoryName] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<ControlSectionId, boolean>>({ ...DEFAULT_EXPANDED_SECTIONS });

  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const rendered = useMemo(() => renderSfx(params, { sampleRate, bitDepth }), [params, sampleRate, bitDepth]);
  const currentSnapshot = useMemo<Snapshot>(() => ({ name: createSnapshotName(activePreset), presetId: activePreset, params, sampleRate, bitDepth, waveform: params.waveform }), [activePreset, params, sampleRate, bitDepth]);

  useEffect(() => { drawWaveform(waveformCanvasRef.current, rendered.samples); }, [rendered.samples]);
  useEffect(() => { setSerialized(serializeSfxParams(params)); }, [params]);
  useEffect(() => { saveHistoryToStorage(history); }, [history]);
  useEffect(() => () => {
    try { sourceRef.current?.stop(); } catch {}
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  const commitParams = (nextValue: SfxParams | ((current: SfxParams) => SfxParams)): void => setParams((current) => clampSfxParams(typeof nextValue === 'function' ? nextValue(current) : nextValue));
  const updateParam = <K extends keyof SfxParams>(key: K, value: SfxParams[K]): void => { setActivePreset(null); commitParams((current) => ({ ...current, [key]: value })); };
  const toggleSection = (sectionId: ControlSectionId): void => setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  const handlePreset = (preset: SfxPresetId): void => { commitParams((current) => createSfxPreset(preset, current)); setActivePreset(preset); setStatus(`已生成「${PRESET_LABELS[preset]}」预设。`); };
  const ensureAudioContext = async (): Promise<AudioContext> => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  };
  const playSnapshot = async (snapshot: Snapshot, message: string): Promise<void> => {
    const audioContext = await ensureAudioContext();
    const nextRendered = renderSfx(snapshot.params, { sampleRate: snapshot.sampleRate, bitDepth: snapshot.bitDepth });
    try { sourceRef.current?.stop(); } catch {}
    const buffer = audioContext.createBuffer(1, nextRendered.samples.length, snapshot.sampleRate);
    buffer.getChannelData(0).set(nextRendered.samples);
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
    setStatus(message);
  };

  const handlePlayCurrent = async (): Promise<void> => {
    try { await playSnapshot(currentSnapshot, '正在试听当前音效。'); }
    catch (error) { setStatus(error instanceof Error ? error.message : '播放失败。'); }
  };
  const handlePlayHistory = async (item: SavedSfxHistoryItem): Promise<void> => {
    try { await playSnapshot(toSnapshot(item), `正在试听历史「${item.name}」。`); }
    catch (error) { setStatus(error instanceof Error ? error.message : '历史试听失败。'); }
  };
  const handleCopyJson = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(serialized);
      setStatus('参数 JSON 已复制到剪贴板。');
    } catch {
      setStatus('复制失败。');
    }
  };
  const handleApplyJson = (): void => {
    try {
      const nextParams = deserializeSfxParams(serialized);
      setActivePreset(null);
      commitParams(nextParams);
      setStatus('参数 JSON 已应用到工作台。');
    } catch (error) {
      setStatus(error instanceof Error ? `JSON 无效：${error.message}` : 'JSON 无效。');
    }
  };
  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => setSerialized(event.target.value);
  const saveCurrentToHistory = (): void => {
    const nextItem = createHistoryItem(currentSnapshot);
    setHistory((current) => [nextItem, ...current]);
    setEditingHistoryId(nextItem.id);
    setEditingHistoryName(nextItem.name);
    setStatus(`已保存到生成历史：「${nextItem.name}」。`);
  };
  const applyHistoryToWorkbench = (item: SavedSfxHistoryItem): void => {
    const nextParams = clampSfxParams({ ...item.params, waveform: item.waveform });
    setParams(nextParams);
    setSampleRate(item.sampleRate);
    setBitDepth(item.bitDepth);
    setActivePreset(item.presetId);
    setSerialized(serializeSfxParams(nextParams));
    setStatus(`已应用回工作台：「${item.name}」。`);
    setOpenExportMenu(null);
  };
  const deleteHistoryItem = (item: SavedSfxHistoryItem): void => {
    setHistory((current) => current.filter((entry) => entry.id !== item.id));
    if (editingHistoryId === item.id) {
      setEditingHistoryId(null);
      setEditingHistoryName('');
    }
    if (openExportMenu === `history-${item.id}`) {
      setOpenExportMenu(null);
    }
    setStatus(`已删除历史记录：「${item.name}」。`);
  };
  const commitHistoryRename = (): void => {
    if (!editingHistoryId) return;
    setHistory((current) => current.map((item) => item.id === editingHistoryId ? { ...item, name: editingHistoryName.trim() || item.name } : item));
    setEditingHistoryId(null);
    setEditingHistoryName('');
  };
  const handleHistoryRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commitHistoryRename();
    if (event.key === 'Escape') { setEditingHistoryId(null); setEditingHistoryName(''); }
  };
  const toggleExportMenu = (menuId: string): void => setOpenExportMenu((current) => current === menuId ? null : menuId);
  const runExport = async (format: ExportFormat, snapshot: Snapshot, menuId: string, sourceLabel: string): Promise<void> => {
    setExportingMenuId(menuId);
    setStatus(`正在导出 ${sourceLabel} 的 .${format} 文件。`);
    try {
      const blob = await exportSnapshot(format, snapshot);
      downloadBlob(blob, `${sanitizeFileStem(snapshot.name)}.${format}`);
      setStatus(`${sourceLabel} 已导出为 .${format}。`);
      setOpenExportMenu(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `导出 .${format} 失败。`);
    } finally {
      setExportingMenuId(null);
    }
  };

  return (
    <section className="workbench-card" aria-label="音效工作台">
      <div className="workbench-layout">
        <div className="editor-column">
          <section className="console-surface preset-rack" aria-labelledby="preset-strip-title">
            <div className="panel-head">
              <div><p className="section-kicker">Preset Rack</p><h3 id="preset-strip-title">音效预设</h3></div>
              <span>先选方向，再微调参数。</span>
            </div>
            <div className="preset-strip" role="toolbar" aria-label="音效预设">
              {SFX_PRESET_ORDER.map((preset) => (
                <button key={preset} type="button" aria-pressed={activePreset === preset} className={`preset-button ${preset === 'mutate' ? 'preset-button--mutate' : ''} ${activePreset === preset ? 'is-active' : ''}`} onClick={() => handlePreset(preset)}>
                  <span className="preset-button__glyph" aria-hidden="true">{PRESET_GLYPHS[preset]}</span>
                  <span className="preset-button__copy"><span className="preset-button__label">{PRESET_LABELS[preset]}</span><small>{PRESET_DETAILS[preset]}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="console-surface waveform-bay" aria-labelledby="waveform-panel-title">
            <div className="panel-head">
              <div><p className="section-kicker">Waveform</p><h3 id="waveform-panel-title">基础波形</h3></div>
              <span>先选底色，再修细节。</span>
            </div>
            <div className="waveform-grid">
              {WAVEFORM_OPTIONS.map((option) => (
                <label key={option.value} className={`mode-pill ${params.waveform === option.value ? 'is-active' : ''}`}>
                  <input type="radio" name="sfx-waveform" checked={params.waveform === option.value} aria-label={option.label} onChange={() => updateParam('waveform', option.value)} />
                  <div className="mode-pill__badge" aria-hidden="true">{option.glyph}</div>
                  <div className="mode-pill__copy"><span className="mode-pill__label">{option.label}</span><small>{option.detail}</small></div>
                </label>
              ))}
            </div>
          </section>

          <div className="section-stack">
            {CONTROL_SECTIONS.map((section) => {
              const expanded = expandedSections[section.id];
              return (
                <section key={section.id} className={`console-surface control-section ${expanded ? 'is-open' : ''}`}>
                  <button className="control-section__toggle" type="button" aria-expanded={expanded} aria-controls={`control-section-panel-${section.id}`} onClick={() => toggleSection(section.id)}>
                    <div><p className="section-kicker">Control Group</p><h3>{section.title}</h3><span>{section.description}</span></div>
                    <span className="control-section__state">{expanded ? '收起' : '展开'}</span>
                  </button>
                  <div id={`control-section-panel-${section.id}`} hidden={!expanded}>
                    <div className="slider-grid">
                      {section.fields.map((field) => {
                        const value = params[field.key] as number;
                        return <SliderField key={field.key} label={field.label} hint={field.hint} value={value} display={field.signed ? formatSignedPercent(value) : formatPercent(value)} min={field.min} max={field.max} step={field.step} onChange={(nextValue) => updateParam(field.key, nextValue)} />;
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
              <div><p className="section-kicker">Live Monitor</p><h3 id="preview-title">预览</h3></div>
              <span className="preview-dock__meta">{WAVEFORM_LABELS[params.waveform]} · {formatSampleRateMeta(sampleRate)} · {bitDepth} bit</span>
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
                    <button key={option} className={`segmented-button ${sampleRate === option ? 'is-active' : ''}`} type="button" onClick={() => setSampleRate(option)}>{formatSampleRateChip(option)}</button>
                  ))}
                </div>
              </div>
              <div className="inline-options">
                <span>位深</span>
                <div className="chip-group">
                  {BIT_DEPTH_OPTIONS.map((option) => (
                    <button key={option} className={`segmented-button ${bitDepth === option ? 'is-active' : ''}`} type="button" onClick={() => setBitDepth(option)}>{option} bit</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="monitor-actions">
              <button className="primary-button play-button" type="button" aria-label={isPlaying ? '重新播放音效' : '播放音效'} onClick={() => { void handlePlayCurrent(); }}>
                <span className="play-button__icon" aria-hidden="true">{isPlaying ? '↻' : '▶'}</span>
                <span className="play-button__copy"><span className="play-button__label">{isPlaying ? '重新播放' : '播放音效'}</span><small>{isPlaying ? '从头试听当前音效' : '立即试听当前音效'}</small></span>
              </button>
              <button className="secondary-button secondary-button--teal save-button" type="button" aria-label="保存当前音效" onClick={saveCurrentToHistory}>保存到历史</button>
              <div className="preview-dock__footer">
                <div className="option-card option-card--monitor"><span>预计导出体积</span><strong>{formatBytes(rendered.stats.estimatedByteSize)}</strong></div>
                <ExportMenu menuId="current" label="当前音效导出" variant="console" isOpen={openExportMenu === 'current'} isExporting={exportingMenuId === 'current'} triggerClassName="export-menu__trigger export-menu__trigger--console" onToggle={toggleExportMenu} onExport={(format) => { void runExport(format, currentSnapshot, 'current', '当前音效'); }} />
              </div>
            </div>
            <div className={`status-banner ${isPlaying ? 'status-banner--live' : ''}`} role="status">{status}</div>
          </section>

          <section className="console-surface history-panel" aria-labelledby="history-title">
            <div className="panel-head">
              <div><p className="section-kicker">History</p><h3 id="history-title">生成历史</h3></div>
              <span>{history.length > 0 ? `已保存 ${history.length} 条记录` : '保存后会显示在这里。'}</span>
            </div>
            {history.length === 0 ? (
              <div className="history-empty" data-testid="history-empty-state"><strong>还没有保存记录</strong><p>点击“保存到历史”后，会显示在这里。</p></div>
            ) : (
              <div className="history-list">
                {history.map((item) => {
                  const isEditing = editingHistoryId === item.id;
                  const menuId = `history-${item.id}`;
                  return (
                    <article key={item.id} className="history-card">
                      <div className="history-card__head">
                        {isEditing ? (
                          <input className="history-card__input" autoFocus aria-label="历史记录名称" value={editingHistoryName} onChange={(event) => setEditingHistoryName(event.target.value)} onBlur={commitHistoryRename} onKeyDown={handleHistoryRenameKeyDown} />
                        ) : (
                          <button className="history-card__title" type="button" onClick={() => { setEditingHistoryId(item.id); setEditingHistoryName(item.name); }}>{item.name}</button>
                        )}
                        <button className="ghost-button history-card__rename" type="button" onClick={() => deleteHistoryItem(item)}>删除</button>
                      </div>
                      <div className="history-card__meta">{formatHistoryDetail(item.savedAt)}</div>
                      <div className="history-card__chips">
                        <span className="history-chip">{item.presetId ? PRESET_LABELS[item.presetId] : '自定义'}</span>
                        <span className="history-chip">{WAVEFORM_LABELS[item.waveform]}</span>
                        <span className="history-chip">{formatSampleRateMeta(item.sampleRate)}</span>
                        <span className="history-chip">{item.bitDepth} bit</span>
                      </div>
                      <div className="history-card__actions">
                        <button className="ghost-button" type="button" onClick={() => applyHistoryToWorkbench(item)}>应用</button>
                        <button className="ghost-button" type="button" onClick={() => { void handlePlayHistory(item); }}>播放</button>
                        <ExportMenu menuId={menuId} label={`${item.name} 导出`} variant="inline" isOpen={openExportMenu === menuId} isExporting={exportingMenuId === menuId} triggerClassName="ghost-button export-menu__trigger export-menu__trigger--inline" onToggle={toggleExportMenu} onExport={(format) => { void runExport(format, toSnapshot(item), menuId, `历史记录「${item.name}」`); }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="console-surface advanced-editor-panel" aria-labelledby="json-panel-title">
            <div className="panel-head">
              <div><p className="section-kicker">Advanced</p><h3 id="json-panel-title">参数 JSON</h3></div>
              <span>复制、粘贴或直接编辑参数。</span>
            </div>
            <div className="advanced-editor">
              <textarea id="sfx-json-editor" className="json-editor" aria-label="参数 JSON 编辑器" value={serialized} onChange={handleJsonChange} />
              <div className="json-actions">
                <button className="ghost-button" type="button" onClick={() => { void handleCopyJson(); }}>复制 JSON</button>
                <button className="ghost-button" type="button" onClick={handleApplyJson}>应用 JSON</button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
