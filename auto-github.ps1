# PowerShell script to create and push to GitHub

param(
    [string] = "web-video-presentation",
    [string] = "Interactive web video presentation tool with auto TTS, recording, and subtitle generation"
)

Write-Host "正在创建并推送至 GitHub..." -ForegroundColor Cyan

# 检查 Git 状态
Write-Host "检查 Git 状态..." -ForegroundColor Yellow
 = git status --short
if () {
    Write-Host "有未提交的更改：" -ForegroundColor Yellow
    git status
     = Read-Host "是否要提交这些更改？(y/n)"
    if ( -eq 'y') {
        git add .
        git commit -m "Auto commit before GitHub push"
    }
}

# 显示当前提交
Write-Host "当前提交历史：" -ForegroundColor Yellow
git log --oneline -3

Write-Host ""
Write-Host "请按 Enter 继续创建 GitHub 仓库..." -ForegroundColor Green
Pause

# 尝试创建仓库
Write-Host "尝试创建 GitHub 仓库..." -ForegroundColor Yellow

# 方法 1: 如果你已经有 GitHub 凭据管理器
Write-Host "方法 1: 使用标准推送..." -ForegroundColor Cyan
Write-Host "1. 删除已有的远程仓库" -ForegroundColor Gray
git remote remove origin 2>
Write-Host "2. 添加远程仓库" -ForegroundColor Gray
git remote add origin https://github.com/kity/.git
Write-Host "3. 切换到 main 分支" -ForegroundColor Gray
git branch -M main

# 尝试推送
Write-Host "4. 尝试推送到 GitHub (可能需要登录)" -ForegroundColor Cyan
try {
    git push -u origin main
    Write-Host "✅ 推送成功！" -ForegroundColor Green
    Write-Host "仓库地址: https://github.com/kity/" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "❌ 推送失败，需要手动创建仓库" -ForegroundColor Red
    Write-Host ""
    Write-Host "手动创建步骤：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://github.com/new" -ForegroundColor White
    Write-Host "2. 输入仓库名称: " -ForegroundColor White
    Write-Host "3. 描述: " -ForegroundColor White
    Write-Host "4. 不要勾选任何初始化选项" -ForegroundColor White
    Write-Host "5. 点击 Create repository" -ForegroundColor White
    Write-Host "6. 创建后，运行以下命令：" -ForegroundColor White
    Write-Host "   git remote add origin https://github.com/kity/.git" -ForegroundColor Gray
    Write-Host "   git branch -M main" -ForegroundColor Gray
    Write-Host "   git push -u origin main" -ForegroundColor Gray
}

Write-Host ""
Write-Host "脚本完成。" -ForegroundColor Cyan
