# 最简单的推送脚本
Write-Host "1. 请先在浏览器中创建 GitHub 仓库:" -ForegroundColor Yellow
Write-Host "   访问 https://github.com/new" -ForegroundColor Cyan
Write-Host "   创建 'web-video-presentation' 仓库" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. 仓库创建后，按 Enter 继续..." -ForegroundColor Green
pause
Write-Host ""
Write-Host "3. 正在配置远程仓库..." -ForegroundColor Yellow
git remote add origin https://github.com/kity/web-video-presentation.git
git branch -M main
Write-Host ""
Write-Host "4. 正在推送代码..." -ForegroundColor Yellow
git push -u origin main
Write-Host ""
if ( -eq 0) {
    Write-Host "✅ 发布成功！" -ForegroundColor Green
    Write-Host "访问 https://github.com/kity/web-video-presentation" -ForegroundColor Cyan
} else {
    Write-Host "❌ 推送失败" -ForegroundColor Red
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "  a) 仓库名称错误" -ForegroundColor Yellow
    Write-Host "  b) 需要 GitHub 认证" -ForegroundColor Yellow
    Write-Host "  c) 网络问题" -ForegroundColor Yellow
}
