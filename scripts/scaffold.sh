#!/usr/bin/env bash
# web-video-presentation scaffold
# 创建项目基础目录结构

set -euo pipefail

PROJECT_DIR="${1:-.}"

mkdir -p "$PROJECT_DIR/src"
mkdir -p "$PROJECT_DIR/public"
mkdir -p "$PROJECT_DIR/scripts/render/lib"
mkdir -p "$PROJECT_DIR/out/audio"
mkdir -p "$PROJECT_DIR/out/timeline"
mkdir -p "$PROJECT_DIR/out/raw"
mkdir -p "$PROJECT_DIR/out/subtitles"
mkdir -p "$PROJECT_DIR/out/final"
mkdir -p "$PROJECT_DIR/out/qa"

echo "✓ Scaffold created at $PROJECT_DIR"