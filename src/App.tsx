import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NARRATIONS, type NarrationEntry, type TimelineEntry } from './narration';
import { MamboAvatar } from './MamboAvatar';

interface RenderBridge {
  ready: boolean;
  chapter: number;
  step: number;
  done: boolean;
  goto: (chapter: number, step: number) => void;
  next: () => void;
  prev: () => void;
}

declare global {
  interface Window {
    __WEB_VIDEO_READY__: boolean;
    __WEB_VIDEO_DONE__: boolean;
    __WEB_VIDEO_RENDER__: RenderBridge;
  }
}

function buildFallbackTimeline(narrations: NarrationEntry[]): TimelineEntry[] {
  let t = 0;
  return narrations.map(n => {
    const duration = 4.5;
    const start = t;
    const end = start + duration;
    t = end;
    return { ...n, start, end, duration };
  });
}

const CHAPTER_TITLES: Record<number, string> = {
  1: '痛点剖析与极简破局',
  2: '六层分层架构与数据流',
  3: '五道零依赖门禁与端侧落地',
};

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const auto = params.get('auto') === '1';
  const externalDriver = params.get('driver') === 'renderer';

  const [timeline, setTimeline] = useState<TimelineEntry[]>(() =>
    auto ? [] : buildFallbackTimeline(DEFAULT_NARRATIONS)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasTimeline, setHasTimeline] = useState(!auto);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const gotoRef = useRef<(chapter: number, step: number) => void>(() => {});
  const doneRef = useRef<() => void>(() => {});

  const current = timeline[currentIndex];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const goToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(timeline.length - 1, index));
    setCurrentIndex(clamped);
    if (timeline[clamped]) {
      window.__WEB_VIDEO_RENDER__ && (window.__WEB_VIDEO_RENDER__.chapter = timeline[clamped].chapter);
      window.__WEB_VIDEO_RENDER__ && (window.__WEB_VIDEO_RENDER__.step = timeline[clamped].step);
    }
  }, [timeline]);

  const goto = useCallback((chapter: number, step: number) => {
    const index = timeline.findIndex(t => t.chapter === chapter && t.step === step);
    if (index >= 0) goToIndex(index);
  }, [timeline, goToIndex]);

  const next = useCallback(() => {
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex]);

  const prev = useCallback(() => {
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  const finish = useCallback(() => {
    window.__WEB_VIDEO_DONE__ = true;
    if (window.__WEB_VIDEO_RENDER__) window.__WEB_VIDEO_RENDER__.done = true;
  }, []);

  doneRef.current = finish;
  gotoRef.current = goto;

  // Ready signal
  useEffect(() => {
    if (!hasTimeline || timelineError) return;

    window.__WEB_VIDEO_READY__ = true;

    const bridge: RenderBridge = {
      ready: true,
      chapter: current?.chapter ?? 0,
      step: current?.step ?? 0,
      done: false,
      goto: (chapter, step) => gotoRef.current(chapter, step),
      next: () => next(),
      prev: () => prev(),
    };
    window.__WEB_VIDEO_RENDER__ = bridge;
    window.__WEB_VIDEO_DONE__ = false;

    return () => {
      window.__WEB_VIDEO_READY__ = false;
      window.__WEB_VIDEO_DONE__ = false;
    };
  }, [hasTimeline, timelineError, current?.chapter, current?.step, next, prev]);

  // Load timeline before ready
  useEffect(() => {
    if (!auto) {
      setHasTimeline(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/timeline/timeline.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TimelineEntry[];
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setTimelineError(null);
          setTimeline(data);
          setHasTimeline(true);
          return;
        }
        throw new Error('Empty timeline');
      } catch (err) {
        if (!cancelled) {
          setTimelineError('TIMELINE_NOT_FOUND');
          setHasTimeline(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [auto, clearTimers]);

  // Auto scheduling
  useEffect(() => {
    if (!auto || !hasTimeline || externalDriver || timeline.length === 0) return;

    clearTimers();
    timeline.forEach((entry, index) => {
      const timeout = window.setTimeout(() => {
        goToIndex(index);
        if (index === timeline.length - 1) {
          window.setTimeout(finish, Math.max(0, entry.duration * 1000));
        }
      }, entry.start * 1000);
      timersRef.current.push(timeout);
    });

    if (timeline.length === 0) {
      const t = window.setTimeout(finish, 100);
      timersRef.current.push(t);
    }

    return clearTimers;
  }, [auto, hasTimeline, externalDriver, timeline, clearTimers, goToIndex, finish]);

  const progress = timeline.length > 0 ? ((currentIndex + 1) / timeline.length) * 100 : 0;
  const currentChapterTitle = current ? CHAPTER_TITLES[current.chapter] || `第 ${current.chapter} 章` : '';

  return (
    <div className="stage">
      {/* Top Header Navigation */}
      <header className="top-header">
        <div className="header-brand">
          <span className="brand-pill">CANON-KB</span>
          <span className="brand-title">longform-canon-kb · 原著知识库与游戏运行包</span>
        </div>
        <div className="header-chapter">
          {current && (
            <>
              <span className="chapter-badge">CH {current.chapter} · STEP {current.step}</span>
              <span className="chapter-name">{currentChapterTitle}</span>
            </>
          )}
        </div>
        <div className="header-status">
          <span className="status-dot"></span>
          <span>1080P HD / 曼波解说中</span>
        </div>
      </header>

      {/* Main Body */}
      <div className="stage-body">
        {/* Left: Mambo Avatar */}
        <div className="mambo-host-wrapper">
          <MamboAvatar hint={current?.visualHint} isSpeaking={true} />
        </div>

        {/* Right: Rich Interactive Slide */}
        <div className="content-canvas">
          <div className="slide-inner" key={`${current?.chapter}-${current?.step}`}>
            {renderSlideContent(current?.visualHint)}
          </div>
        </div>
      </div>

      {/* Bottom Subtitle */}
      <div className="bottom-subtitle-box">
        <div className="subtitle-text">
          {current?.narration || '渲染准备中...'}
        </div>
      </div>

      {/* Navigation Controls (when not auto) */}
      {!auto && (
        <div className="nav-controls-box">
          <button onClick={prev} disabled={currentIndex === 0}>← 上一步</button>
          <button onClick={next} disabled={currentIndex === timeline.length - 1}>下一步 →</button>
        </div>
      )}

      {/* Bottom Progress Bar */}
      <div className="bottom-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

function renderSlideContent(hint?: string) {
  switch (hint) {
    case 'mambo-pain':
      return (
        <>
          <div className="slide-title-area">
            <div className="slide-category">Problem Analysis · 痛点洞察</div>
            <h1 className="slide-main-title">网文 AI 跑团的三大典型翻车现场</h1>
          </div>
          <div className="pain-cards-grid">
            <div className="pain-card">
              <div className="card-icon">💥</div>
              <h3>战力崩塌 / 设定吃了</h3>
              <p>前一章还是元婴老祖，下一章被筑基修士一拳秒杀；境界体系彻底失控。</p>
            </div>
            <div className="pain-card">
              <div className="card-icon">👻</div>
              <h3>死人复活 / 记忆断层</h3>
              <p>第10轮剧情里战死牺牲的核心角色，在第20轮突然若无其事地现身喝茶。</p>
            </div>
            <div className="pain-card">
              <div className="card-icon">🌀</div>
              <h3>无中生有 / 幻觉脑补</h3>
              <p>原文未记载的法宝和宗门，模型凭空乱编，世界观瞬间背离原著。</p>
            </div>
          </div>
          <div className="banner-warning">
            ⚠️ 传统 RAG 的试错命中机制，在长篇复杂网文中极易累积误差，最终导致自相矛盾！
          </div>
        </>
      );

    case 'two-files':
      return (
        <>
          <div className="slide-title-area">
            <div className="slide-category">Core Solution · 极简破局</div>
            <h1 className="slide-main-title">只需两份文件，即可随时开局</h1>
          </div>
          <div className="two-files-container">
            <div className="file-hero-card">
              <span className="file-badge-pill">唯一的知识来源</span>
              <h2>kb.json</h2>
              <div className="file-desc">原著事实 + 实体倒排索引 + 证据定位锚点</div>
              <div className="feature-tag-list">
                <div className="feature-tag-item">🔹 单文件自洽结构，避免碎文件丢失</div>
                <div className="feature-tag-item">🔹 压缩至目标字节预算（手机端秒开）</div>
                <div className="feature-tag-item">🔹 实体、别名、时间坐标严格倒排检索</div>
              </div>
            </div>

            <div className="plus-symbol">+</div>

            <div className="file-hero-card rule-card">
              <span className="file-badge-pill">唯一的规则输入</span>
              <h2>prompt.md</h2>
              <div className="file-desc">开局协议 + 检索路由 + 叙事状态机裁判</div>
              <div className="feature-tag-list">
                <div className="feature-tag-item">🔸 零依赖纯规则定义，跨模型通用</div>
                <div className="feature-tag-item">🔸 严苛防幻觉协议：查不到写 UNKNOWN</div>
                <div className="feature-tag-item">🔸 玩家互动状态机，永不反向污染知识库</div>
              </div>
            </div>
          </div>
        </>
      );

    case 'three-rules':
      return (
        <>
          <div className="slide-title-area">
            <div className="slide-category">Design Principles · 核心准则</div>
            <h1 className="slide-main-title">三条不可让步的原著铁律</h1>
          </div>
          <div className="rules-grid">
            <div className="rule-box">
              <div className="rule-num">1</div>
              <h3>事实强可回指</h3>
              <p>面向游戏的每一条事实，必须严丝合缝定位回原文的具体章节、段落块与字符区间，带有哈希与短摘录。</p>
            </div>
            <div className="rule-box">
              <div className="rule-num">2</div>
              <h3>会话绝不污染源</h3>
              <p>玩家的生死选择、剧情分支、原创角色只记录在临时会话层，原著事实库永远保持纯净只读！</p>
            </div>
            <div className="rule-box">
              <div className="rule-num">3</div>
              <h3>严格版权边界</h3>
              <p>交付的成品质检库只保留短摘录（默认≤120字），杜绝拼装还原原著连续文本，合规安全。</p>
            </div>
          </div>
        </>
      );

    case 'arch-l0-l1':
      return (
        <div className="arch-layout">
          <div className="arch-svg-frame focus-l0-l1">
            <img src="/architecture.svg" alt="架构图 L0-L1" />
          </div>
          <div className="arch-details-column">
            <span className="arch-step-badge">分层剖析 · 第一阶段</span>
            <h2 style={{ fontSize: '28px', color: '#fff', fontWeight: 800 }}>L0 源文本层 ➔ L1 证据层</h2>
            <div className="arch-node-item">
              <h4>L0 源文本（只读）</h4>
              <p>数百万字长篇源文本，按章节标准切分，生成 SHA-256 全局指纹进行校验锁定。</p>
            </div>
            <div className="arch-node-item">
              <h4>L1 证据微块 (800~2000字)</h4>
              <p>严格切在句子、对白或行动边界，确保事实证据在细粒度上具备原子可定位性。</p>
            </div>
            <div className="arch-node-item">
              <h4>L1 父场景块 (3000~8000字)</h4>
              <p>包含大情节上下文，避免切片断章取义，为抽取层提供因果脉络。</p>
            </div>
          </div>
        </div>
      );

    case 'arch-l2-l3':
      return (
        <div className="arch-layout">
          <div className="arch-svg-frame focus-l2-l3">
            <img src="/architecture.svg" alt="架构图 L2-L3" />
          </div>
          <div className="arch-details-column">
            <span className="arch-step-badge">分层剖析 · 第二阶段</span>
            <h2 style={{ fontSize: '28px', color: '#fff', fontWeight: 800 }}>L2 抽取层 ➔ L3 验证层</h2>
            <div className="arch-node-item accent-gold">
              <h4>A0~A9 专门子 Agent 矩阵并行抽取</h4>
              <p>分别负责世界观、宗门势力、力量体系器物、人物关系与伏笔因果，精准结构化。</p>
            </div>
            <div className="arch-node-item accent-gold">
              <h4>L3 回读验证机制</h4>
              <p>对照原始证据块反向复核：分为 supported、uncertain、contradicted 多种状态。</p>
            </div>
            <div className="arch-node-item accent-gold">
              <h4>真冲突并列保存</h4>
              <p>原作者前后笔误或设定伏笔分歧？并列展示真实冲突，绝不让 AI 擅自静默抹平！</p>
            </div>
          </div>
        </div>
      );

    case 'arch-l4-l5':
      return (
        <div className="arch-layout">
          <div className="arch-svg-frame focus-l4-l5">
            <img src="/architecture.svg" alt="架构图 L4-L5" />
          </div>
          <div className="arch-details-column">
            <span className="arch-step-badge">分层剖析 · 第三阶段</span>
            <h2 style={{ fontSize: '28px', color: '#fff', fontWeight: 800 }}>L4 编译层 ➔ L5 运行时资产</h2>
            <div className="arch-node-item accent-green">
              <h4>单文件编译器</h4>
              <p>分配全局稳定 ID，构建倒排索引字典，按自引用字节预算打包压缩。</p>
            </div>
            <div className="arch-node-item accent-green">
              <h4>运行时检索模型：一次命中</h4>
              <p>玩家输入 ➔ NFKC 归一化 ➔ 实体/章节/时间路由 ➔ 精确取卡，彻底告别盲目试错！</p>
            </div>
            <div className="arch-node-item accent-green">
              <h4>最终两份交付物</h4>
              <p>生成干净轻便的 kb.json 与 prompt.md，开箱即玩。</p>
            </div>
          </div>
        </div>
      );

    case 'five-gates':
      return (
        <>
          <div className="slide-title-area">
            <div className="slide-category">Quality Assurance · 质量门禁</div>
            <h1 className="slide-main-title">五道零依赖 Node 门禁流水线</h1>
          </div>
          <div className="gates-container">
            <div className="gate-card">
              <div className="gate-status">✓</div>
              <h4>validate-kb</h4>
              <p>校验结构规范、卡长、行长与交叉引用闭合性</p>
            </div>
            <div className="gate-card">
              <div className="gate-status">✓</div>
              <h4>index-hygiene</h4>
              <p>扫描噪音键、重复倒排 posting 与覆盖空洞</p>
            </div>
            <div className="gate-card">
              <div className="gate-status">✓</div>
              <h4>query-probe</h4>
              <p>高频词查询回归测试，防止锚点挤占实体 Top-K</p>
            </div>
            <div className="gate-card">
              <div className="gate-status">✓</div>
              <h4>validate-chatbox</h4>
              <p>针对 Chatbox 运行环境的卡片字段与字节上限校验</p>
            </div>
            <div className="gate-card">
              <div className="gate-status">✓</div>
              <h4>compact-kb</h4>
              <p>字节预算压制工具，受保护高优事实 0 遗漏</p>
            </div>
          </div>
          <div className="banner-warning" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' }}>
            🛡️ 全部脚本零依赖（仅需 Node 18+），非零退出码直接阻断 CI，让“能否发布”成为确定性指标！
          </div>
        </>
      );

    case 'chatbox-sync':
      return (
        <>
          <div className="slide-title-area">
            <div className="slide-category">Ecosystem & Play · 客户端落地</div>
            <h1 className="slide-main-title">无缝对接 Chatbox 客户端</h1>
          </div>
          <div className="chatbox-hero-view">
            <div className="chatbox-mockup-frame">
              <div className="mockup-header">
                <span className="mockup-circle c1"></span>
                <span className="mockup-circle c2"></span>
                <span className="mockup-circle c3"></span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>Chatbox · AI 剧情互动模式</span>
              </div>
              <div className="mockup-body">
                <div className="chat-bubble-user">
                  我要去藏经阁借阅《九转玄功》，守护长老会如何盘问我？
                </div>
                <div className="chat-bubble-ai">
                  <strong>【藏经阁守阁长老 · 传音】</strong><br />
                  （调取 kb.json 设定：藏经阁三层需真传弟子令牌；长老性格孤僻护短）<br />
                  “小辈止步！九转玄功非真传弟子不可轻启。报上师承与宗门功勋，否则休怪老夫法阵无情！”
                </div>
              </div>
            </div>

            <div className="arch-details-column">
              <div className="arch-node-item">
                <h4>全平台开箱即用</h4>
                <p>Chatbox 支持 Windows、Mac、Linux、iOS 和 Android，随身携带千万字小说宇宙！</p>
              </div>
              <div className="arch-node-item">
                <h4>本地隐私与秒级响应</h4>
                <p>所有记忆保存在本地设备，搭配本地模型或云端 API，告别网络延迟与数据泄露。</p>
              </div>
            </div>
          </div>
        </>
      );

    case 'mambo-success':
      return (
        <div className="success-banner-box">
          <div className="trophy-badge">🏆</div>
          <h1 className="highlight-motto">一次命中 · 绝不吃书</h1>
          <p style={{ fontSize: '20px', color: '#94a3b8', maxWidth: '800px', lineHeight: 1.6 }}>
            从百万字原始文本，到结构化证据分层，再到严苛门禁与轻量化开局。<br />
            <strong>longform-canon-kb + web-video-presentation</strong>，让长篇剧情跑团从此告别幻觉！
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
            <span className="chapter-badge">✨ 曼波大成功！</span>
            <span className="chapter-badge" style={{ borderColor: '#34d399', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' }}>🚀 欢迎在 GitHub 体验</span>
          </div>
        </div>
      );

    default:
      return <div>加载中...</div>;
  }
}