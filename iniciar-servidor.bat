@echo off
cd /d "%~dp0"
start "" http://localhost:8080/loja/index.html
node server.js
