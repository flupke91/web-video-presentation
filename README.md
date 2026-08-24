# web-video-presentation

将文章/口播稿制作成网页视频，并可选自动渲染为 MP4。

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173` 手动播放；打开 `http://localhost:5173/?auto=1` 自动播放。

## Phase 4 自动成片

```bash
# 先确保有 TTS 音频：out/audio/ch01_step01.mp3 ...
npm run render:check
npm run render
```

输出：

```text
out/final/video.mp4
out/subtitles/subtitles.ass
out/subtitles/subtitles.srt
out/timeline/timeline.json
out/qa/render-report.md
```

## 局部重跑

```bash
npm run render:audio       # 重新生成 timeline
npm run render:subtitles   # 重新生成字幕
npm run render:full        # 全量重跑
```

## 环境检查

```bash
npm run render:check
```

会检查 Node、npm、FFmpeg、ffprobe、Playwright、Chromium、字体。

## 结构

见 `SKILL.md`。