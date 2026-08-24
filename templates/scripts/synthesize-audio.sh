#!/usr/bin/env bash
# web-video-presentation TTS synthesis
# 用法: ./synthesize-audio.sh <narration.json>
# narration.json 格式: [{chapter, step, narration}, ...]
# 输出: out/audio/ch{chapter}_step{step}.mp3

set -euo pipefail

NARRATION_FILE="${1:-narration.json}"
AUDIO_DIR="out/audio"

if [ ! -f "$NARRATION_FILE" ]; then
  echo "Usage: $0 <narration.json>"
  exit 1
fi

mkdir -p "$AUDIO_DIR"

# 使用 edge-tts 作为默认 TTS provider
# 也可替换为其他 TTS（如 openai TTS, google TTS 等）
# 通过环境变量 TTS_PROVIDER 选择

TTS_PROVIDER="${TTS_PROVIDER:-edge-tts}"
VOICE="${VOICE:-zh-CN-XiaoxiaoNeural}"

entries=$(cat "$NARRATION_FILE" | jq -c '.[]')

echo "$entries" | while read -r entry; do
  chapter=$(echo "$entry" | jq -r '.chapter')
  step=$(echo "$entry" | jq -r '.step')
  narration=$(echo "$entry" | jq -r '.narration')
  filename="ch$(printf '%02d' $chapter)_step$(printf '%02d' $step).mp3"
  output="$AUDIO_DIR/$filename"

  if [ -f "$output" ]; then
    echo "✓ $output exists, skip"
    continue
  fi

  echo "→ Generating $filename..."

  case "$TTS_PROVIDER" in
    edge-tts)
      edge-tts --voice "$VOICE" --text "$narration" --write-media "$output"
      ;;
    openai)
      # 需要配置 OPENAI_API_KEY
      curl -s -X POST "https://api.openai.com/v1/audio/speech" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"tts-1\",\"voice\":\"alloy\",\"input\":\"$narration\"}" \
        -o "$output"
      ;;
    *)
      echo "Unknown TTS provider: $TTS_PROVIDER"
      exit 1
      ;;
  esac

  echo "✓ $filename generated"
done

echo "✓ All audio synthesized"