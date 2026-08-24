/**
 * Subtitle generation utilities
 *
 * 从 timeline（narration script + 真实音频时长）生成 SRT 和 ASS。
 * 不使用 ASR，直接使用原始 narration。
 */
import fs from 'fs';
import path from 'path';

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
    // 如果单个 chunk 超过最大字符数，按字符硬切
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

  // 如果结果太多，可以合并非常短的行？这里保持简单不合并
  return result;
}

function visibleLength(s) {
  // 中文/日文按 1 长度；英文按单词 + 空格粗略，简化按字符计
  return s.length;
}

function breakLongChunk(chunk, maxChars) {
  if (visibleLength(chunk) <= maxChars) return [chunk];
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
    const totalChars = textLines.reduce((sum, line) => sum + Math.max(1, visibleLength(line)), 0);

    let cursor = entry.start;
    for (const line of textLines) {
      const weight = Math.max(1, visibleLength(line)) / totalChars;
      let duration = segmentDuration * weight;
      // 限制最短/最长
      duration = Math.max(minDuration, duration);
      duration = Math.min(maxDuration, duration);
      // 如果超过 segment end，截断到 end
      const end = Math.min(cursor + duration, entry.end);
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
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans SC,26,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,2,0,2,60,60,90,1

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
export function validateCues(cues, videoDuration) {
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