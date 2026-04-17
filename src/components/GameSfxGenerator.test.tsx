import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import GameSfxGenerator from './GameSfxGenerator';

const writeText = vi.fn().mockResolvedValue(undefined);
const originalClipboard = navigator.clipboard;
const originalAudioContext = globalThis.AudioContext;
const originalGetContext = HTMLCanvasElement.prototype.getContext;

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

  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

beforeEach(() => {
  writeText.mockClear();
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

  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('GameSfxGenerator', () => {
  it('renders the redesigned workbench with default section states', () => {
    render(<GameSfxGenerator />);

    expect(screen.getByRole('heading', { name: '音效工作台' })).not.toBeNull();
    expect(screen.getByRole('toolbar', { name: '音效预设' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '预览台' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '导出' })).not.toBeNull();

    expect(screen.getByRole('button', { name: /包络/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /频率/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /调制/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /质感/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /滤波/ }).getAttribute('aria-expanded')).toBe('false');

    expect(screen.getByRole('button', { name: '播放' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '停止' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '复制 JSON' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '应用 JSON' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '导出 WAV' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '导出 JSON' })).not.toBeNull();
  });

  it('keeps the primary actions wired after the redesign', async () => {
    const user = userEvent.setup();

    render(<GameSfxGenerator />);

    await user.click(screen.getByRole('button', { name: '播放' }));
    expect(screen.getByRole('status').textContent).toContain('正在播放当前音效。');

    await user.click(screen.getByRole('button', { name: '停止' }));
    expect(screen.getByRole('status').textContent).toContain('已停止播放。');

    await user.click(screen.getByRole('button', { name: '应用 JSON' }));
    expect(screen.getByRole('status').textContent).toContain('参数 JSON 已应用。');
  });
});
