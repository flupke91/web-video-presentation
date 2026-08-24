/**
 * Subtitle generation utilities
 *
 * 从 timeline（narration script + 真实音频时长）生成 SRT 和 ASS。
 * 不使用 ASR，直接使用原始 narration。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * 将一段 narration 按标点和最大长度切分为字幕片段
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.maxChars=16]
 * @param {number} [opts.maxLines=2]
 * @returns {string[]} subtitle lines (without line breaks)
 */
export function splitNarration(text, opts = {}) {
  const maxChars = opts.maxChars || 16;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];

  // 先按标点切成小段
  const chunks = trimmed
    .split(/(?<=[，。！？；、,.!?;:…·])/)
    .map(c => c.trim())
    .filter(Boolean);

  const result = [];
  let buffer = '';

  const flushBuffer = () => {
    if (buffer) {
      result.push(buffer);
      buffer = '';
    }
  };

  for (const chunk of chunks) {
    // 如果单个 chunk 超过最大字符数，优先按词/字符切
    const pieces = breakLongChunk(chunk, maxChars);
    for (const piece of pieces) {
      if (buffer && (visibleLength(buffer) + visibleLength(piece) > maxChars)) {
        flushBuffer();
      }
      if (buffer) {
        buffer += piece;
      } else {
        buffer = piece;
      }
    }
  }

  flushBuffer();

  return result;
}

function visibleLength(s) {
  // 中文/日文按 1 长度；英文按单词 + 空格粗略，简化按字符计
  return s.length;
}

function breakLongChunk(chunk, maxChars) {
  if (visibleLength(chunk) <= maxChars) return [chunk];

  const englishWords = chunk.split(/\s+/).filter(Boolean);
  if (englishWords.length > 1) {
    const pieces = [];
    let current = '';
    for (const word of englishWords) {
      const next = current ? `${current} ${word}` : word;
      if (visibleLength(next) > maxChars && current) {
        pieces.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) pieces.push(current);
    return pieces;
  }

  const pieces = [];
  let current = '';
  for (const char of chunk) {
    if (visibleLength(current) >= maxChars) {
      pieces.push(current);
      current = '';
    }
    current += char;
  }
  if (current) pieces.push(current);
  return pieces;
}

function endsWithPause(text) {
  return /[，。！？；、,.!?;:…·]$/.test(text.trim());
}

function cueWeight(text) {
  const base = Math.max(1, visibleLength(text));
  return base + (endsWithPause(text) ? 6 : 0);
}

function allocateDurations(totalDuration, weights, minDuration, maxDuration) {
  const n = weights.length;
  if (n === 0) return [];
  if (n === 1) return [totalDuration];

  const minPerCue = Math.min(minDuration, totalDuration / n);
  const maxPerCue = Math.max(maxDuration, totalDuration / n);
  const sumWeight = weights.reduce((a, b) => a + Math.max(0.0001, b), 0);

  const durations = weights.map(w => (totalDuration * Math.max(0.0001, w)) / sumWeight);

  for (let i = 0; i < n; i++) {
    if (durations[i] < minPerCue) {
      durations[i] = minPerCue;
    } else if (durations[i] > maxPerCue) {
      durations[i] = maxPerCue;
    }
  }

  let rest = totalDuration - durations.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (Math.abs(rest) > 1e-6 && guard < 10) {
    guard += 1;
    const adjustable = [];
    for (let i = 0; i < n; i++) {
      if (rest > 0 && durations[i] < maxPerCue - 1e-6) adjustable.push(i);
      if (rest < 0 && durations[i] > minPerCue + 1e-6) adjustable.push(i);
    }
    if (adjustable.length === 0) break;
    const per = rest / adjustable.length;
    for (const idx of adjustable) {
      durations[idx] += per;
      if (durations[idx] > maxPerCue) durations[idx] = maxPerCue;
      if (durations[idx] < minPerCue) durations[idx] = minPerCue;
    }
    rest = totalDuration - durations.reduce((a, b) => a + b, 0);
  }

  const currentSum = durations.reduce((a, b) => a + b, 0);
  const correction = totalDuration - currentSum;
  durations[n - 1] = Math.max(minPerCue, Math.min(maxPerCue, durations[n - 1] + correction));
  return durations;
}

function parseCssVars(cssText) {
  const vars = {};
  const matches = cssText.matchAll(/--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g);
  for (const m of matches) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function parseCssColor(input, fallback = { r: 255, g: 255, b: 255, a: 1 }) {
  if (!input || typeof input !== 'string') return fallback;
  const color = input.trim();
  const hex = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(',').map(s => s.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts[3] === undefined ? 1 : Number(parts[3]);
    if ([r, g, b, a].every(Number.isFinite)) {
      return {
        r: Math.max(0, Math.min(255, r)),
        g: Math.max(0, Math.min(255, g)),
        b: Math.max(0, Math.min(255, b)),
        a: Math.max(0, Math.min(1, a)),
      };
    }
  }
  return fallback;
}

function toAssColor({ r, g, b, a }) {
  const aa = Math.round((1 - a) * 255);
  return `&H${aa.toString(16).padStart(2, '0').toUpperCase()}${Math.round(b).toString(16).padStart(2, '0').toUpperCase()}${Math.round(g).toString(16).padStart(2, '0').toUpperCase()}${Math.round(r).toString(16).padStart(2, '0').toUpperCase()}`;
}

function parsePixelNumber(value, fallback) {
  if (!value) return fallback;
  const m = String(value).match(/([0-9.]+)/);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFontName(value, fallback) {
  if (!value) return fallback;
  const first = value.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return first || fallback;
}

function loadSubtitleThemeTokens(themePath) {
  const cssPath = themePath || path.join(PROJECT_ROOT, 'src', 'styles.css');
  const defaults = {
    font: 'Noto Sans SC',
    size: 26,
    primary: '&H00FFFFFF',
    outline: '&H00000000',
    back: '&H96000000',
    marginV: 90,
  };
  try {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const vars = parseCssVars(css);
    return {
      font: normalizeFontName(vars['subtitle-font'], defaults.font),
      size: parsePixelNumber(vars['subtitle-size'], defaults.size),
      primary: toAssColor(parseCssColor(vars['subtitle-color'], { r: 255, g: 255, b: 255, a: 1 })),
      outline: '&H00000000',
      back: toAssColor(parseCssColor(vars['subtitle-bg'], { r: 0, g: 0, b: 0, a: 0.65 })),
      marginV: defaults.marginV,
    };
  } catch {
    return defaults;
  }
}

/**
 * 生成字幕 cue
 *
 * @param {Array<{chapter, step, start, end, duration, narration}>} timeline
 * @param {object} [opts]
 * @returns {Array<{index, start, end, text}>}
 */
export function generateCues(timeline, opts = {}) {
  const maxChars = opts.maxChars || 16;
  const minDuration = opts.minDuration || 0.5;
  const maxDuration = opts.maxDuration || 6;

  const cues = [];
  let index = 1;

  for (const entry of timeline) {
    const textLines = splitNarration(entry.narration, { maxChars });
    if (textLines.length === 0) continue;

    const segmentDuration = entry.duration;
    const weights = textLines.map(line => cueWeight(line));
    const durations = allocateDurations(segmentDuration, weights, minDuration, maxDuration);

    let cursor = entry.start;
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      const end = i === textLines.length - 1 ? entry.end : Math.min(cursor + durations[i], entry.end);
      if (end > cursor + 0.05) {
        cues.push({
          index: index++,
          start: cursor,
          end,
          text: line
        });
      }
      cursor = end;
    }
  }

  return cues;
}

/**
 * 时间戳格式化 SRT
 */
function formatSrtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

/**
 * 时间戳格式化 ASS (h:mm:ss.cc)
 */
function formatAssTime(seconds) {
  const cs = Math.round(seconds * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const cent = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
}

/**
 * 生成 SRT
 * @param {Array} cues
 * @param {string} outputPath
 */
export function writeSrt(cues, outputPath) {
  const lines = cues.map(cue => {
    return [
      cue.index,
      `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}`,
      cue.text,
      ''
    ].join('\n');
  });
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  return outputPath;
}

/**
 * Escape ASS text (override codes {} and special chars)
 */
function escapeAssText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

/**
 * 生成 ASS
 * 样式使用 theme token 的默认视觉：白字、半透明深色背景、圆角矩形近似用 BorderStyle=3 + outline
 * ASS 支持基本圆角（BorderStyle=3 为模糊背景框）
 *
 * @param {Array} cues
 * @param {string} outputPath
 */
export function writeAss(cues, outputPath) {
  const theme = loadSubtitleThemeTokens();
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${theme.font},${Math.round(theme.size)},${theme.primary},&H000000FF,${theme.outline},${theme.back},0,0,0,0,100,100,0,0,3,0,0,2,60,60,${Math.round(theme.marginV)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues.map(cue => {
    const text = escapeAssText(cue.text);
    return `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${text}`;
  });

  fs.writeFileSync(outputPath, header + events.join('\n') + '\n', 'utf-8');
  return outputPath;
}

/**
 * 检查字幕文件合法性
 * @param {Array} cues
 * @param {number} videoDuration
 * @returns {object} { valid, errors }
 */
export function validateCues(cues, videoDuration, opts = {}) {
  const timeline = opts.timeline || null;
  const coverageTolerance = opts.coverageTolerance ?? 0.08;
  const errors = [];
  if (!Array.isArray(cues)) return { valid: false, errors: ['Cues must be array'] };
  let prevEnd = 0;
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.start < 0) errors.push(`Cue ${i}: start < 0`);
    if (cue.end < 0) errors.push(`Cue ${i}: end < 0`);
    if (cue.start > cue.end) errors.push(`Cue ${i}: start > end`);
    if (cue.end > videoDuration + 0.5) errors.push(`Cue ${i}: end ${cue.end} > video duration ${videoDuration}`);
    if (i > 0 && cue.start < prevEnd - 0.01) errors.push(`Cue ${i}: start before previous end`);
    if (!cue.text || cue.text.trim().length === 0) errors.push(`Cue ${i}: empty text`);
    prevEnd = cue.end;
  }

  if (Array.isArray(timeline)) {
    let cueIndex = 0;
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      const overlaps = [];
      while (cueIndex < cues.length && cues[cueIndex].end <= entry.start + coverageTolerance) {
        cueIndex += 1;
      }
      let localIdx = cueIndex;
      while (localIdx < cues.length && cues[localIdx].start < entry.end - coverageTolerance) {
        if (cues[localIdx].end > entry.start + coverageTolerance) {
          overlaps.push(cues[localIdx]);
        }
        localIdx += 1;
      }

      if (overlaps.length === 0) {
        errors.push(`Coverage ${i}: no cues for chapter ${entry.chapter} step ${entry.step}`);
        continue;
      }

      if (overlaps[0].start > entry.start + coverageTolerance) {
        errors.push(`Coverage ${i}: starts late (${overlaps[0].start.toFixed(3)} > ${entry.start.toFixed(3)})`);
      }
      if (overlaps[overlaps.length - 1].end < entry.end - coverageTolerance) {
        errors.push(`Coverage ${i}: ends early (${overlaps[overlaps.length - 1].end.toFixed(3)} < ${entry.end.toFixed(3)})`);
      }

      for (let j = 1; j < overlaps.length; j++) {
        const gap = overlaps[j].start - overlaps[j - 1].end;
        if (gap > coverageTolerance) {
          errors.push(`Coverage ${i}: internal gap ${gap.toFixed(3)}s`);
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 根据 out 目录生成字幕
 */
export function generateSubtitleFiles(timeline, outSubtitlesDir, opts = {}) {
  if (!fs.existsSync(outSubtitlesDir)) {
    fs.mkdirSync(outSubtitlesDir, { recursive: true });
  }
  const cues = generateCues(timeline, opts);
  const srtPath = path.join(outSubtitlesDir, 'subtitles.srt');
  const assPath = path.join(outSubtitlesDir, 'subtitles.ass');
  writeSrt(cues, srtPath);
  writeAss(cues, assPath);
  return { cues, srtPath, assPath };
}