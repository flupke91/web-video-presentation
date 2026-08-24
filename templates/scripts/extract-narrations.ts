/**
 * 从文章/口播稿中提取 narration 数据
 * 输出格式适用于 web-video-presentation
 *
 * 用法: npx ts-node templates/scripts/extract-narrations.ts <article.md>
 *
 * 输出: JSON 数组:
 * [{
 *   chapter: number,
 *   step: number,
 *   narration: string,
 *   visualHint?: string
 * }, ...]
 */

import * as fs from 'fs';

// 简单实现：根据段落分割
function extractNarrations(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  const narrations: { chapter: number; step: number; narration: string }[] = [];
  let chapter = 1;
  let step = 1;
  for (const line of lines) {
    if (line.startsWith('#')) {
      // 新章节
      chapter = parseInt(line.match(/\d+/)?.[0] || '1');
      step = 1;
      continue;
    }
    if (line.trim()) {
      narrations.push({
        chapter,
        step: step++,
        narration: line.trim()
      });
    }
  }
  return narrations;
}

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: npx ts-node templates/scripts/extract-narrations.ts <article.md>');
  process.exit(1);
}

const text = fs.readFileSync(inputFile, 'utf-8');
const narrations = extractNarrations(text);
console.log(JSON.stringify(narrations, null, 2));