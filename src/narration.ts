/**
 * Narration 数据定义
 * 实际项目中由 Phase 2 生成，这里作为示例
 */

export interface NarrationEntry {
  chapter: number;
  step: number;
  narration: string;
  /** 可选视觉提示 */
  visualHint?: string;
}

export interface TimelineEntry {
  chapter: number;
  step: number;
  start: number;
  end: number;
  duration: number;
  narration: string;
}

export const DEFAULT_NARRATIONS: NarrationEntry[] = [
  {
    chapter: 1,
    step: 1,
    narration: '欢迎来到本视频。今天我们将探讨一个重要的技术话题。'
  },
  {
    chapter: 1,
    step: 2,
    narration: '首先，让我们了解什么是自动渲染流水线。'
  },
  {
    chapter: 1,
    step: 3,
    narration: '这是一个将网页视频自动转换为最终 MP4 文件的完整流程。'
  },
  {
    chapter: 2,
    step: 1,
    narration: '第二章，我们将深入技术细节。'
  },
  {
    chapter: 2,
    step: 2,
    narration: '自动字幕系统是整个流程中非常重要的一环。'
  },
  {
    chapter: 2,
    step: 3,
    narration: '它能够根据原文字幕自动生成 SRT 和 ASS 格式的字幕文件。'
  },
  {
    chapter: 2,
    step: 4,
    narration: '再用 FFmpeg 合成最终视频。'
  },
  {
    chapter: 3,
    step: 1,
    narration: '最后，总结一下这个技能的核心价值。'
  },
  {
    chapter: 3,
    step: 2,
    narration: '它保留了原有的视觉设计自由，同时增加了全自动渲染能力。'
  },
  {
    chapter: 3,
    step: 3,
    narration: '感谢观看，希望这个技能对你有帮助。'
  }
];