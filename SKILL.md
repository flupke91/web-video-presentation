# web-video-presentation

> Article/口播稿 → 1920×1080 网页视频 → [Phase 4] TTS → 自动录制 → 自动字幕 → FFmpeg 合成 → MP4

本 Skill 用于把文章或口播稿制作成可独立播放的网页视频，并可进入 Phase 4 自动成片。

它保留原有 `web-video-presentation` 三个核心阶段：

- Phase 1: 文章/原始材料
- Phase 2: 口播稿 + outline
- Phase 3: Vite + React + TypeScript 网页视频

Phase 4 是在网页实现完成 + 音频完成之后新增的自动成片层：

- 真实 TTS 音频时长生成 `render/timeline.json`
- Playwright + Chromium 自动录制 `1920×1080`
- 根据 narration script 自动生成 SRT/ASS 字幕
- FFmpeg 合成 H.264/AAC MP4
- 输出 QC 报告

## 核心设计原则

### 保留：视觉自由

- 1920×1080 固定舞台
- Vite + React + TypeScript
- `(chapter, step)` 推进模型
- 一段 narration beat 对应一个视觉 step
- 每个 step 独占完整舞台
- 主题 token / theme architecture
- animation / motion 设计方式
- Anti-AI / Anti-template 设计原则
- 动画由章节开发阶段自主设计
- outline 只负责节奏与信息密度，不负责规定动画
- 素材处理逻辑
- TTS provider abstraction
- 协作 checkpoints

### Phase 4：只自动化“渲染”，不自动化“设计”

自动渲染模块不负责设计画面。它只负责：

1. 读取已有网页
2. 自动播放
3. 自动录制
4. 生成字幕
5. 最终合成

禁止在 Phase 4 引入固定镜头、固定转场、固定字幕模板、固定页面布局、固定视觉动画。

## 工作流总览

```text
Phase 1: 文章/原始材料
Phase 2: 口播稿 + outline
Phase 3: Vite + React + TS 网页视频
TTS
Phase 4: Auto Render & Subtitle
最终 MP4
```

## Chapter / Step 机制

- 逻辑时间单位仍然是 `(chapter, step)`。
- 每个 step 对应一句 narration beat。
- timeline entry 是 `(chapter, step)` 在最终视频中的时间段。
- 禁止把 step 改名为 Scene（除非仅作为内部映射）。

示例：

```json
{
  "chapter": 2,
  "step": 4,
  "start": 18.42,
  "end": 23.71,
  "duration": 5.29,
  "narration": "这里是本段口播内容"
}
```

## TTS

- 使用已有 TTS provider abstraction 生成每段 narration 的音频。
- 音频输出到 `out/audio/`，命名建议：`ch01_step01.mp3`。
- 必须使用 ffprobe / 音频 metadata 读取真实 duration，禁止用模型估算时长。

## Phase 4 自动成片

### 输出目录

```text
out/
├── audio/
│   ├── ch01_step01.mp3
│   └── ...
├── timeline/
│   └── timeline.json
├── raw/
│   └── recording.webm
├── subtitles/
│   ├── subtitles.srt
│   └── subtitles.ass
├── final/
│   └── video.mp4
└── qa/
    ├── duration.json
    └── render-report.md
```

### 时间轴

1. 生成 TTS
2. 读取每段真实音频 duration
3. 建立累计时间轴
4. 生成 `out/timeline/timeline.json`
5. Playwright 根据 timeline 播放网页
6. 字幕根据 timeline 生成
7. FFmpeg 根据 timeline 合成

`timeline.json` 是唯一可信时间源。

### 自动播放模式

网页提供两种模式：

- `normal mode`：人工点击 `next` / `prev`，原有手动模式继续存在。
- `?auto=1`：自动模式，从 chapter 1 step 1 自动执行到最后。
  - 自驱动：页面自行 fetch `/timeline/timeline.json` 推进。
  - 外驱动：`?auto=1&driver=renderer` 时，页面等待 Renderer 通过 `window.__WEB_VIDEO_RENDER__.goto(chapter, step)` 推进。

页面必须提供：

```js
window.__WEB_VIDEO_READY__ = true;
window.__WEB_VIDEO_DONE__ = false;

window.__WEB_VIDEO_RENDER__ = {
  ready: true,
  chapter: 1,
  step: 1,
  done: false,
  goto(chapter, step) {},
  next() {},
  prev() {}
};
```

### Render Server

Renderer 自动启动 HTTP server，等待 health check，再启动 Playwright，录制结束关闭 browser 与 server。服务器异常退出时清理。

### Playwright 录制

- Chromium
- viewport: `1920×1080`
- `deviceScaleFactor: 1`
- 不使用窗口自适应
- 打开 `http://localhost:PORT/?auto=1&driver=renderer`
- 等待字体加载
- 等待图片加载
- 等待 React hydration
- 等待 `window.__WEB_VIDEO_READY__`
- 开始 recording
- 按 timeline 驱动 chapter/step
- 等待 `window.__WEB_VIDEO_DONE__`
- 停止 recording
- 保存 `out/raw/recording.webm`

### 字幕

- 优先从原始 narration script 生成，禁止默认 ASR。
- 自动按标点、语义停顿、最大字符数、最大显示时间切分。
- 中文默认每行 8~16 字、最多 2 行，英文自动适配。
- 字幕放置底部安全区，`bottom margin >= 90px`，必要时上移。
- 默认白字、半透明深色背景、圆角矩形。
- 必须使用 theme token：

```css
--subtitle-font
--subtitle-size
--subtitle-color
--subtitle-bg
--subtitle-radius
--subtitle-shadow
```

### FFmpeg 合成

- 输入：raw video + TTS audio + ASS subtitle
- 输出：H.264 / AAC / 1920×1080
- 建议：`libx264 -crf 18~23 -preset medium`, audio `48kHz`
- 必须确保 `video duration ≈ audio duration ≈ timeline duration`，偏差超过阈值报错。

### 自动 QC

- `final/video.mp4` 存在
- ffprobe 读取 duration / width / height / codec / fps / audio codec
- 比较 video / audio / timeline duration，默认允许 `<= 100ms`
- 检查字幕文件存在、时间非负、end <= video duration、不逆序、无大量空字幕
- 分辨率必须 `1920×1080`

### 失败处理

失败时输出 `RENDER FAILED` 并明确阶段：

- `SERVER_START_FAILED`
- `PAGE_READY_TIMEOUT`
- `PLAYWRIGHT_RECORD_FAILED`
- `AUDIO_DURATION_FAILED`
- `TIMELINE_INVALID`
- `SUBTITLE_GENERATION_FAILED`
- `FFMPEG_FAILED`
- `QC_FAILED`

### CLI

```bash
npm run render            # timeline → 录制 → 字幕 → ffmpeg → qc
npm run render:audio      # 只重新生成 timeline/audio duration 数据
npm run render:subtitles  # 只重新生成字幕
npm run render:full       # 全量重跑
npm run render:check      # 检查环境
npm run render:preview    # 只启动 ?auto=1 供人工检查
```

### 局部重跑

- step narration 修改后，只重新生成该 step 的 TTS audio，再更新 timeline。
- 支持 audio-only / subtitle-only / full rerender。
- 第一版至少提供 `render:audio`、`render:subtitles`、`render:full`。

## 环境要求

- Node.js
- npm
- Playwright + Chromium
- ffmpeg / ffprobe
- 系统字体（中文/英文字体）

`npm run render:check` 会检查以上项目，缺失时明确提示。

## 兼容性

- Linux / macOS / Windows
- 路径使用 Node.js `path.join()`
- 禁止硬编码 `/`、`\`、`C:\`
- FFmpeg concat 文件使用绝对路径

## Phase 4 最终输出

完成后生成 `out/qa/render-report.md`，包含：

Project / Resolution / FPS / Video duration / Audio duration / Timeline duration / Subtitle count / Chapters / Steps / Render time / FFmpeg version / Browser version / QC result

CLI 输出：

```text
✓ Render complete

Video:
out/final/video.mp4

Subtitles:
out/subtitles/subtitles.ass

Timeline:
out/timeline/timeline.json

QC:
PASS
```

## 协作 Checkpoints

- 完成 Phase 2 后与用户确认口播稿/outline
- 完成 Phase 3 网页后与用户确认视觉
- TTS 后确认音频
- Phase 4 全自动执行，最终给用户视频与报告