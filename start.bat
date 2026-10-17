@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo  Comptel Sumqayit server ishe salinir...
echo ========================================
echo.
node server.js
pause
