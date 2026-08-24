# 发布到 GitHub

以下是将本项目发布到 GitHub 的步骤。

## 前提条件

- 安装 Git（https://git-scm.com/）
- 拥有 GitHub 账号（https://github.com/）
- 已登录 Git 命令行

## 步骤

### 1. 初始化本地 Git 仓库

```bash
cd web-video-presentation
git init
git add .
git commit -m "Initial commit: web-video-presentation with Phase 4 Auto Render & Subtitle"
```

### 2. 创建 GitHub 远程仓库

在 GitHub 上新建一个仓库（不要勾选 "Initialize this repository with a README"，因为我们已经有了）：

- 仓库名称：`web-video-presentation`（或你喜欢的名称）
- 描述：`Article/口播稿 → 网页视频 → TTS → 自动录制 → 自动字幕 → FFmpeg 合成 → MP4`
- 公开或私有：按需选择

### 3. 关联远程仓库

```bash
git remote add origin https://github.com/你的用户名/web-video-presentation.git
git branch -M main
git push -u origin main
```

### 4. 验证

访问 `https://github.com/你的用户名/web-video-presentation` 确认文件已上传。

## 常见问题

### 如果提交时忘了加 .gitignore

```bash
git rm -r --cached node_modules/
git rm -r --cached out/
git rm -r --cached dist/
echo "node_modules/" >> .gitignore
echo "out/" >> .gitignore
echo "dist/" >> .gitignore
git add .gitignore
git commit -m "Add .gitignore"
```

### 如果仓库已存在，强制覆盖（谨慎使用）

```bash
git push -u origin main --force
```

## 后续维护

### 更新代码后推送

```bash
git add .
git commit -m "描述你的改动"
git push
```

### 发布 Release

在 GitHub 仓库页面点击 "Releases" → "Create a new release"，填写版本号和说明。

## 依赖安装

用户克隆仓库后需要：

```bash
npm install
npx playwright install chromium
```

确保系统已安装 FFmpeg（https://ffmpeg.org/）并加入 PATH。