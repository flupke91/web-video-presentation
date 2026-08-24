# 完整的 GitHub 发布流程指南

Write-Host "🎯 GitHub 发布流程" -ForegroundColor Cyan
Write-Host "=" * 40
Write-Host ""

Write-Host "第 1 步：登录 GitHub CLI" -ForegroundColor Green
Write-Host "运行以下命令登录 GitHub:" -ForegroundColor Yellow
Write-Host "  gh auth login" -ForegroundColor White
Write-Host "按照提示选择："
Write-Host "  1. GitHub.com"
Write-Host "  2. HTTPS"
Write-Host "  3. 选择 'Login with a web browser'"
Write-Host ""
Write-Host "第 2 步：创建 GitHub 仓库" -ForegroundColor Green
Write-Host "运行以下命令创建仓库:" -ForegroundColor Yellow
Write-Host "  gh repo create web-video-presentation --public --source=. --remote=origin --push" -ForegroundColor White
Write-Host ""
Write-Host "第 3 步：或者手动创建（如果上面命令失败）" -ForegroundColor Green
Write-Host "访问：https://github.com/new" -ForegroundColor Yellow
Write-Host "填写："
Write-Host "  Repository name: web-video-presentation" -ForegroundColor White
Write-Host "  Description: 将文章/口播稿制作成交互式网页视频演示，支持自动 TTS 音频生成、视频录制和字幕合成" -ForegroundColor White
Write-Host "  不要勾选：'Initialize this repository with a README'" -ForegroundColor White
Write-Host ""
Write-Host "第 4 步：手动推送" -ForegroundColor Green
Write-Host "如果手动创建了仓库，运行：" -ForegroundColor Yellow
Write-Host "  git remote add origin https://github.com/kity/web-video-presentation.git" -ForegroundColor White
Write-Host "  git branch -M main" -ForegroundColor White
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "第 5 步：验证" -ForegroundColor Green
Write-Host "访问：https://github.com/kity/web-video-presentation" -ForegroundColor Cyan
Write-Host ""
Write-Host "注意事项：" -ForegroundColor Yellow
Write-Host "• 你可能需要 GitHub Personal Access Token (PAT)" -ForegroundColor Yellow
Write-Host "• 如果需要 PAT，请访问：https://github.com/settings/tokens" -ForegroundColor Yellow
Write-Host "• 创建 token 时选择 'repo' 权限" -ForegroundColor Yellow
Write-Host ""
Write-Host "项目信息：" -ForegroundColor Cyan
Write-Host "• 文件数: 34" -ForegroundColor White
Write-Host "• 提交数: 3" -ForegroundColor White
Write-Host "• 分支: main" -ForegroundColor White
Write-Host ""
