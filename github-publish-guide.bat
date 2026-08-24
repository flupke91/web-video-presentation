@echo off
echo =========================================
echo     GitHub ???? (web-video-presentation)
echo =========================================
echo.

echo [1] ???? Git ??
echo -----------------------------------------
git status
echo.

echo [2] ??????
echo -----------------------------------------
git log --oneline -5
echo.

echo [3] ????
echo -----------------------------------------
echo.
echo ????:
echo   1. ??????
echo   2. ??: https://github.com/new
echo   3. ???????: web-video-presentation
echo   4. ???????????
echo.
echo [4] ???? (??????)
echo -----------------------------------------
echo git remote add origin https://github.com/kity/web-video-presentation.git
echo git branch -M main
echo git push -u origin main
echo.
echo [5] ????
echo -----------------------------------------
echo ???????????:
echo git remote set-url origin https://kity:YOUR_TOKEN@github.com/kity/web-video-presentation.git
echo git push
echo.
echo [6] ?? GitHub Token
echo -----------------------------------------
echo ???? token???:
echo https://github.com/settings/tokens
echo ?? "repo" ??
echo.
pause
