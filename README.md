# Retro SFX Lab / 复古游戏音效生成器

一个面向独立开发者与开源项目的浏览器端游戏音效生成器，专注于快速制作 `sfxr` 风格的复古与街机音效。你可以直接选择预设、调整参数、实时试听，并导出可用于游戏项目的音频与参数文件。

- 在线体验: [mowangblog.github.io/game-sfx-generator-web](https://mowangblog.github.io/game-sfx-generator-web/)

## 功能亮点

- 基于 `sfxr` / `jsfxr` 思路的程序化音效生成
- 内置金币、激光、爆炸、跳跃、点击、强化等常用预设
- 浏览器内实时试听，无需上传任何素材
- 支持导出 `WAV` 音频文件
- 支持导出与重新导入参数 `JSON`

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

运行测试：

```bash
npm run test
```

构建生产版本：

```bash
npm run build
```

## GitHub Pages 部署

仓库已内置 GitHub Actions 工作流：`.github/workflows/deploy.yml`。

启用方式：

1. 打开 GitHub 仓库。
2. 进入 `Settings` -> `Pages`。
3. 将 `Source` 设置为 `GitHub Actions`。
4. 后续只要推送到 `main`，GitHub 就会自动构建并发布 `dist/` 内容。

当前 Vite 的 `base` 路径已经为该仓库配置好，发布后可直接在 `/game-sfx-generator-web/` 下正常访问。

## 技术栈

- `React`
- `TypeScript`
- `Vite`
- `Vitest`

## 路线图

- 增加更多面向不同游戏类型的预设组合
- 支持可分享的参数链接或预设包
- 补充更多波形、调制与滤波控制
- 增加一组可直接复用的示例音效库

## License

`GPL-3.0-only`
