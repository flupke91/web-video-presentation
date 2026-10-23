import re
import os
import sys
import asyncio
import edge_tts

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open("src/narration.ts", "r", encoding="utf-8") as f:
    content = f.read()

entries = []
pattern = re.compile(r"chapter:\s*(\d+),\s*step:\s*(\d+),\s*narration:\s*'([^']*)'")
for match in pattern.finditer(content):
    entries.append({
        "chapter": int(match.group(1)),
        "step": int(match.group(2)),
        "narration": match.group(3)
    })

os.makedirs("out/audio", exist_ok=True)

async def main():
    print(f"Synthesizing {len(entries)} audio clips with edge-tts...")
    for item in entries:
        filename = f"ch{item['chapter']:02d}_step{item['step']:02d}.mp3"
        out_path = os.path.join("out/audio", filename)
        if os.path.exists(out_path):
            print(f"✓ {filename} already exists")
            continue
        communicate = edge_tts.Communicate(item["narration"], "zh-CN-XiaoxiaoNeural")
        await communicate.save(out_path)
        print(f"✓ Generated {filename}: {item['narration']}")
    print("ALL_AUDIO_DONE")

if __name__ == "__main__":
    asyncio.run(main())
