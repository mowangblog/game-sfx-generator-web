import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import GameSfxGenerator from './GameSfxGenerator';

const HISTORY_STORAGE_KEY = 'retro-sfx-history-v1';
const writeText = vi.fn().mockResolvedValue(undefined);
const createObjectUrl = vi.fn(() => 'blob:test');
const revokeObjectUrl = vi.fn();
const anchorClick = vi.fn();
const originalClipboard = navigator.clipboard;
const originalAudioContext = globalThis.AudioContext;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalAnchorClick = HTMLAnchorElement.prototype.click;

class MockBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;

  connect(): void {}

  start(): void {}

  stop(): void {
    this.onended?.();
  }
}

class MockAudioContext {
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;

  createBuffer(_channels: number, length: number): AudioBuffer {
    return {
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    return new MockBufferSource() as unknown as AudioBufferSourceNode;
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  });

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
  });

  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    configurable: true,
    value: anchorClick,
  });

  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

beforeEach(() => {
  localStorage.clear();
  writeText.mockClear();
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
  anchorClick.mockClear();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: originalAudioContext,
  });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectURL,
  });

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectURL,
  });

  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    configurable: true,
    value: originalAnchorClick,
  });

  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('GameSfxGenerator', () => {
  it('renders the workbench with preview, history and default section states', () => {
    render(<GameSfxGenerator />);

    expect(screen.getByRole('toolbar', { name: '音效预设' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '预览' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '生成历史' })).not.toBeNull();
    expect(screen.getByTestId('history-empty-state')).not.toBeNull();

    expect(screen.getByRole('button', { name: /音量轮廓/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /频率/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /调制/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /质感/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /滤波/ }).getAttribute('aria-expanded')).toBe('false');

    expect(screen.getByRole('button', { name: '播放音效' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '保存当前音效' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '当前音效导出' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '复制 JSON' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '应用 JSON' })).not.toBeNull();
  });

  it('saves history into localStorage and loads it back after rerender', async () => {
    const user = userEvent.setup();
    render(<GameSfxGenerator />);

    await user.click(screen.getByRole('button', { name: '保存当前音效' }));

    const storedRaw = localStorage.getItem(HISTORY_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const stored = JSON.parse(storedRaw ?? '[]') as Array<{ name: string }>;
    expect(stored).toHaveLength(1);

    cleanup();
    render(<GameSfxGenerator />);

    expect(screen.queryByTestId('history-empty-state')).toBeNull();
    expect(screen.getByText(stored[0]?.name ?? '')).not.toBeNull();
  });

  it('plays history without overwriting the current workbench and can apply it back', async () => {
    const user = userEvent.setup();
    render(<GameSfxGenerator />);

    await user.click(screen.getByLabelText('噪声'));
    await user.click(screen.getByRole('button', { name: '8k' }));
    await user.click(screen.getByRole('button', { name: '保存当前音效' }));
    await user.keyboard('{Enter}');

    await user.click(screen.getByLabelText('正弦波'));
    expect((screen.getByLabelText('正弦波') as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole('button', { name: '播放' }));
    expect(screen.getByRole('status').textContent).toContain('正在试听历史');
    expect((screen.getByLabelText('正弦波') as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByRole('status').textContent).toContain('应用回工作台');
    expect((screen.getByLabelText('噪声') as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText(/8kHz/).length).toBeGreaterThan(0);
  });

  it('opens unified export menus for the current snapshot and history items', async () => {
    const user = userEvent.setup();
    render(<GameSfxGenerator />);

    await user.click(screen.getByRole('button', { name: '当前音效导出' }));
    expect(screen.getByRole('menuitem', { name: 'Download .wav' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Download .json' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Download .mp3' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Download .ogg' })).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '保存当前音效' }));
    await user.keyboard('{Enter}');

    const exportButtons = screen.getAllByRole('button', { name: /导出/ });
    await user.click(exportButtons[1] as HTMLButtonElement);
    expect(screen.getAllByRole('menuitem', { name: 'Download .wav' }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('menuitem', { name: 'Download .json' })[0] as HTMLButtonElement);
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
  });
});
