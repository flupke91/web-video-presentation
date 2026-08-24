# PowerShell script to publish web-video-presentation to GitHub
# Usage: .\publish-github.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host " web-video-presentation - GitHub Publish"
Write-Host "========================================"
Write-Host ""

$repoName = Read-Host "GitHub 仓库名称（默认 web-video-presentation）"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "web-video-presentation"
}

$githubUser = Read-Host "GitHub 用户名/组织名"
if ([string]::IsNullOrWhiteSpace($githubUser)) {
    throw "错误：必须输入 GitHub 用户名"
}

Write-Host ""
Write-Host "请确保已在 GitHub 手动创建空仓库: $githubUser/$repoName"
Read-Host "按 Enter 继续"

if (-not (Test-Path ".git")) {
    Write-Host "[1/5] git init"
    git init
} else {
    Write-Host "[1/5] Git 仓库已存在"
}

Write-Host "[2/5] git add ."
git add .

Write-Host "[3/5] git commit"
git commit -m "Initial commit: web-video-presentation with Phase 4 Auto Render & Subtitle"

Write-Host "[4/5] 添加远程仓库"
git remote remove origin 2>$null
git remote add origin "https://github.com/$githubUser/$repoName.git"

Write-Host "[5/5] git push -u origin main"
git branch -M main
git push -u origin main

Write-Host ""
Write-Host "========================================"
Write-Host " 发布完成: https://github.com/$githubUser/$repoName"
Write-Host "========================================"