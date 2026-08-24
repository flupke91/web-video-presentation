# GitHub 仓库发布指南

## 步骤 1：创建 GitHub 仓库
1. 访问 https://github.com 并登录
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: web-video-presentation (或其他名称)
   - Description: 将文章/口播稿制作成交互式网页视频演示，支持自动 TTS 音频生成、视频录制和字幕合成
   - Public (推荐) 或 Private
   - 不要勾选 "Initialize this repository with a README" (我们已经有了)
   - 不要勾选 "Add .gitignore" (我们已经有了)
   - 不要勾选 "Add a license"
4. 点击 "Create repository"

## 步骤 2：关联远程仓库
运行以下命令（将 YOUR_USERNAME 替换为你的 GitHub 用户名）：

git remote add origin https://github.com/YOUR_USERNAME/web-video-presentation.git
git branch -M main
git push -u origin main

## 步骤 3：验证
访问 https://github.com/YOUR_USERNAME/web-video-presentation 确认代码已上传
