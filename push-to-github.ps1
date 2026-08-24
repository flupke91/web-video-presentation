# GitHub 发布脚本
# 使用方法：编辑下面的  变量，然后在 PowerShell 中运行此脚本

param(
    [string] = "YOUR_GITHUB_USERNAME"
)

Write-Host "即将发布到 GitHub..." -ForegroundColor Green
Write-Host "仓库地址：https://github.com//web-video-presentation" -ForegroundColor Cyan

# 检查是否已设置远程仓库
 = git remote -v 2> | Select-String -Pattern "origin\s+" -Quiet
if () {
    Write-Host "远程仓库已存在，正在更新..." -ForegroundColor Yellow
    git remote set-url origin "https://github.com//web-video-presentation.git"
} else {
    Write-Host "添加远程仓库..." -ForegroundColor Green
    git remote add origin "https://github.com//web-video-presentation.git"
}

# 切换到 main 分支并推送
Write-Host "切换到 main 分支..." -ForegroundColor Green
git branch -M main

Write-Host "推送代码到 GitHub..." -ForegroundColor Green
git push -u origin main

if ( -eq 0) {
    Write-Host "✅ 发布成功！" -ForegroundColor Green
    Write-Host "访问 https://github.com//web-video-presentation 查看仓库" -ForegroundColor Cyan
} else {
    Write-Host "❌ 推送失败，请检查错误信息" -ForegroundColor Red
    Write-Host "可能的原因：" -ForegroundColor Yellow
    Write-Host "1. 仓库尚未在 GitHub 上创建" -ForegroundColor Yellow
    Write-Host "2. GitHub 认证问题" -ForegroundColor Yellow
    Write-Host "3. 网络连接问题" -ForegroundColor Yellow
}
