# Retro SFX Lab

A standalone front-end repository for generating retro and arcade-style game sound effects.

## What It Does

- Procedural game sound generation inspired by `sfxr` / `jsfxr`
- Quick presets for coin, laser, explosion, jump, click, and more
- Realtime browser playback
- Export to `WAV`
- Export and re-import parameter `JSON`
- Unit tests with `Vitest`

## Tech Stack

- `Vite`
- `React`
- `TypeScript`
- `Vitest`

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

Build for production:

```bash
npm run build
```

## Project Scope

This repository only contains the standalone sound generator. It no longer includes video-to-spritesheet, chroma key, or Spine export features from the original project.
