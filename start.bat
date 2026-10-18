@echo off
title WhatsApp Reminder Mobile App
echo ====================================================
echo Starting WhatsApp Reminder Server...
echo ====================================================
cd /d "%~dp0"
node server.js
pause
