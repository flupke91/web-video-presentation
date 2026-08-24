Write-Host "GitHub Repository Setup" -ForegroundColor Cyan
Write-Host "========================"
Write-Host ""
Write-Host "Step 1: Create Repository on GitHub"
Write-Host "------------------------------------"
Write-Host "Please open your browser and go to:"
Write-Host "https://github.com/new"
Write-Host ""
Write-Host "Create repository with these settings:"
Write-Host "- Repository name: web-video-presentation"
Write-Host "- Description: Interactive web video presentation tool with auto TTS, recording and subtitles"
Write-Host "- DO NOT check any initialization boxes"
Write-Host ""
Write-Host "After creating the repository, come back here and press Enter..."
pause
Write-Host ""
Write-Host "Step 2: Configure Git Remote" -ForegroundColor Yellow
git remote add origin https://github.com/kity/web-video-presentation.git
Write-Host "Remote configured."
Write-Host ""
Write-Host "Step 3: Switch to main branch" -ForegroundColor Yellow
git branch -M main
Write-Host "Switched to main branch."
Write-Host ""
Write-Host "Step 4: Push Code to GitHub" -ForegroundColor Yellow
git push -u origin main
Write-Host ""
if (True -eq True) {
    Write-Host "[SUCCESS] Code pushed to GitHub!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/kity/web-video-presentation" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Push failed" -ForegroundColor Red
    Write-Host "Possible reasons:" -ForegroundColor Yellow
    Write-Host "1. Repository not created on GitHub" -ForegroundColor Yellow
    Write-Host "2. Authentication required (GitHub login)" -ForegroundColor Yellow
    Write-Host "3. Network issues" -ForegroundColor Yellow
}
