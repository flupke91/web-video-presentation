@echo off
chcp 65001 >nul
echo ========================================
echo  web-video-presentation - GitHub Publish
echo ========================================
echo.

set /p REPO_NAME=GitHub 仓库名称（默认 web-video-presentation）:
if "%REPO_NAME%"=="" set REPO_NAME=web-video-presentation

set /p GITHUB_USER=GitHub 用户名/组织名:
if "%GITHUB_USER%"=="" (
  echo 错误：必须输入 GitHub 用户名
  exit /b 1
)

echo.
echo 请确保已在 GitHub 手动创建空仓库: %GITHUB_USER%/%REPO_NAME%
pause

if not exist .git (
  echo.
  echo [1/5] git init
  git init
) else (
  echo.
  echo [1/5] Git 仓库已存在
)

echo.
echo [2/5] git add .
git add .

echo.
echo [3/5] git commit
git commit -m "Initial commit: web-video-presentation with Phase 4 Auto Render & Subtitle"

echo.
echo [4/5] 添加远程仓库
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo.
echo [5/5] git push -u origin main
git branch -M main
git push -u origin main

echo.
echo ========================================
echo  发布完成: https://github.com/%GITHUB_USER%/%REPO_NAME%
echo ========================================
pause