/**
 * Narration 数据定义 - 基于 longform-canon-kb 架构定制
 */

export interface NarrationEntry {
  chapter: number;
  step: number;
  narration: string;
  visualHint?: string;
}

export interface TimelineEntry {
  chapter: number;
  step: number;
  start: number;
  end: number;
  duration: number;
  narration: string;
  visualHint?: string;
}

export const DEFAULT_NARRATIONS: NarrationEntry[] = [
  // Chapter 1: 痛点与破局
  {
    chapter: 1,
    step: 1,
    narration: '用长篇小说做 AI 剧情游戏，玩到第20轮就会战力崩塌、角色复活、疯狂瞎编！',
    visualHint: 'mambo-pain'
  },
  {
    chapter: 1,
    step: 2,
    narration: 'longform-canon-kb 的破局解法是：只需两份文件——kb.json加prompt.md！',
    visualHint: 'two-files'
  },
  {
    chapter: 1,
    step: 3,
    narration: '三条不可让步的原著铁律：事实可回指、会话不污染原著、严格遵循版权短摘录。',
    visualHint: 'three-rules'
  },
  // Chapter 2: 六层分层架构与数据流
  {
    chapter: 2,
    step: 1,
    narration: '来看核心架构：从 L0 源文本只读层，切出微块与场景块，形成带哈希的证据表。',
    visualHint: 'arch-l0-l1'
  },
  {
    chapter: 2,
    step: 2,
    narration: '进入 L2 抽取层，A0到A9子Agent并行抽取；L3验证层保留真冲突，绝不静默抹平。',
    visualHint: 'arch-l2-l3'
  },
  {
    chapter: 2,
    step: 3,
    narration: '单文件编译器按字节预算压缩，输出稳定 ID 与一次命中的运行时资产！',
    visualHint: 'arch-l4-l5'
  },
  // Chapter 3: 零依赖门禁与端侧落地
  {
    chapter: 3,
    step: 1,
    narration: '发布前必过五道零依赖 Node 门禁：结构校验、索引卫生、回归探针与体积压缩。',
    visualHint: 'five-gates'
  },
  {
    chapter: 3,
    step: 2,
    narration: '专项适配 Chatbox 客户端，在手机和桌面端都能毫秒级检索，顺畅开局！',
    visualHint: 'chatbox-sync'
  },
  {
    chapter: 3,
    step: 3,
    narration: '曼波大功告成！用工程化流水线，让长篇剧情游戏一次命中，绝不吃书！',
    visualHint: 'mambo-success'
  }
];