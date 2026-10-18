@echo off
title LuckyWheel Launcher
cd /d "%~dp0"

if not exist "node_modules\" (
    echo [LuckyWheel] First-time setup: Installing dependencies...
    call npm install
)

if not exist "dist\index.html" (
    echo [LuckyWheel] Building production bundle...
    call npm run build
)

echo [LuckyWheel] Starting LuckyWheel Studio + Background Explorer Engine...
start "" ".\node_modules\electron\dist\electron.exe" "."
exit
