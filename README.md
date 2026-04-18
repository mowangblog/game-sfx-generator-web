# Retro SFX Lab / 复古游戏音效生成器

一个运行在浏览器里的复古游戏音效工作台，面向独立游戏开发、原型制作和快速音效迭代。

基于 `sfxr` 的参数合成思路，支持直接在页面里选择预设、切换波形、调节参数、实时试听，并导出可直接用于项目的音频文件或参数快照。

- 在线体验：[mowangblog.github.io/game-sfx-generator-web](https://mowangblog.github.io/game-sfx-generator-web/)

## 功能概览

- 内置常用复古音效预设：金币、激光、爆炸、跳跃、点击、受击、强化、选择等
- 支持基础波形切换：方波、锯齿波、正弦波、噪声
- 参数按分组管理，适合快速微调轮廓、频率、调制、质感和滤波
- 调整预设、波形和参数后会自动试听，减少来回点播放的操作
- 右侧预览区提供波形画布、统计信息、采样率和位深切换
- 支持保存到浏览器本地生成历史，并可随时应用回工作台
- 支持历史记录单条播放、单条导出、删除和标题重命名
- 支持一键导出当前音效或历史记录
- 支持批量导出全部历史记录，并按所选格式打包为 ZIP

## 导出格式

当前支持以下导出格式：

- `WAV`
- `JSON`
- `MP3`
- `OGG`

说明：

- 所有音频都在本地浏览器内生成，不依赖后端服务
- `JSON` 用于保存和恢复参数快照
- 历史区的“全部导出”会把所有历史记录按所选格式分别生成后再打成一个 `.zip`

## 生成历史

点击“保存到历史”后，当前音效快照会保存到浏览器缓存。

每条历史记录会保存：

- 名称
- 保存时间
- 对应预设或自定义状态
- 当前参数
- 波形
- 采样率
- 位深

你可以对历史记录执行这些操作：

- `应用`：恢复到当前工作台
- `播放`：试听该记录，不覆盖当前工作台
- `导出`：导出该记录
- `删除`：从历史中移除

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

运行测试：

```bash
npm run test
```

本地预览生产构建：

```bash
npm run preview
```

## 技术栈

- `React 18`
- `TypeScript`
- `Vite`
- `Vitest`
- `lamejs`
- `vorbis-encoder-js`

## 项目结构

```text
src/
  components/
    GameSfxGenerator.tsx
    GameSfxGenerator.test.tsx
  lib/
    sfx.ts
    sfx.test.ts
    audioExport.ts
    zip.ts
  App.tsx
  styles.css
```

## 部署

项目可以直接部署到静态站点环境，例如 GitHub Pages、Vercel 或 Netlify。

如果你使用 GitHub Pages：

1. 在仓库中启用 Pages
2. 将发布源设置为 `GitHub Actions`
3. 推送到主分支后执行构建与部署

## 适用场景

- 独立游戏原型阶段快速搓音效
- Game Jam 或小项目的临时音效生成
- 菜单点击、拾取反馈、命中、爆炸等复古风格音效制作
- 导出参数快照，方便多人协作和复用

## License

`GPL-3.0-only`
