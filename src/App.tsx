import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NARRATIONS, type NarrationEntry, type TimelineEntry } from './narration';

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
    const duration = 2.5;
    const start = t;
    const end = start + duration;
    t = end;
    return { ...n, start, end, duration };
  });
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const auto = params.get('auto') === '1';
  const externalDriver = params.get('driver') === 'renderer';

  const [timeline, setTimeline] = useState<TimelineEntry[]>(() =>
    auto ? [] : buildFallbackTimeline(DEFAULT_NARRATIONS)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasTimeline, setHasTimeline] = useState(!auto);
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
  }, [timeline.length, timeline]);

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

  // Ready signal after hydration and timeline ready
  useEffect(() => {
    if (!hasTimeline) return; // Wait for timeline before signaling ready

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
  }, [hasTimeline, current?.chapter, current?.step, next, prev]);

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
          setTimeline(data);
          setHasTimeline(true);
        }
      } catch (err) {
        console.warn('Timeline not found, fallback to default narrations', err);
        if (!cancelled) {
          setTimeline(buildFallbackTimeline(DEFAULT_NARRATIONS));
          setHasTimeline(true);
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

    // If timeline empty for some reason
    if (timeline.length === 0) {
      const t = window.setTimeout(finish, 100);
      timersRef.current.push(t);
    }

    return clearTimers;
  }, [auto, hasTimeline, externalDriver, timeline, clearTimers, goToIndex, finish]);

  // External driver: when renderer is controlling, page just waits.
  // Renderer will call goto and finish. Still keep a safety fallback to finish after timeline end.
  useEffect(() => {
    if (!auto || !externalDriver || !hasTimeline || timeline.length === 0) return;
    const last = timeline[timeline.length - 1];
    const timer = window.setTimeout(finish, (last.end + 3) * 1000);
    return () => window.clearTimeout(timer);
  }, [auto, externalDriver, hasTimeline, timeline, finish]);

  const progress = timeline.length > 0 ? ((currentIndex + 1) / timeline.length) * 100 : 0;

  if (!hasTimeline && auto) {
    return (
      <div className="stage">
        <div className="chapter-indicator">Loading timeline…</div>
      </div>
    );
  }

  return (
    <div className="stage">
      {current ? (
        <div className="step-content" key={`${current.chapter}-${current.step}`}>
          <div className="chapter-indicator">Chapter {current.chapter}</div>
          <h1>{current.narration}</h1>
          <p>Step {current.step} / {timeline.length}</p>
        </div>
      ) : (
        <div className="step-content">
          <h1>Done</h1>
        </div>
      )}

      <div className="step-counter">
        {current ? `Chapter ${current.chapter} · Step ${current.step}` : 'End'}
      </div>

      {auto && (
        <div className="auto-indicator">
          AUTO {externalDriver ? '· RENDERER DRIVEN' : '· SELF DRIVEN'}
        </div>
      )}

      {!auto && (
        <div className="nav-controls">
          <button onClick={prev} disabled={currentIndex === 0}>← Prev</button>
          <button onClick={next} disabled={currentIndex === timeline.length - 1}>Next →</button>
        </div>
      )}

      <div className="progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}