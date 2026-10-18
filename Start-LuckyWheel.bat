@echo off
title LuckyWheel Pro Studio Launcher
cd /d "%~dp0"
if not exist "node_modules" (
    echo Installing LuckyWheel dependencies for the first time...
    call npm install
)
if not exist "dist\index.html" (
    echo Building LuckyWheel production studio...
    call npm run build
)
echo Launching LuckyWheel Desktop Studio...
start "" ".\node_modules\electron\dist\electron.exe" .
