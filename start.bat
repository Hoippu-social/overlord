@echo off
REM ===============================================
REM DEVELOPMENT BOT - ЗАПУСК
REM ===============================================
REM Этот скрипт запускает тестовую версию бота
REM Работает на порту 3001

echo ╔════════════════════════════════════════╗
echo ║   DEVELOPMENT BOT - DEV VERSION        ║
echo ╚════════════════════════════════════════╝
echo.
echo Запуск тестовой версии бота...
echo Дэшборд: http://localhost:3001
echo.

cd /d "%~dp0"

REM Запуск бота
echo [1/3] Запуск Discord бота (DEV)...
start "Dev Bot" cmd /k "cd bot && npm run dev"
timeout /t 3 /nobreak >nul

REM Запуск Lavalink
echo [2/3] Запуск Lavalink сервера (DEV)...
start "Dev Lavalink" cmd /k "cd lavalink && java -jar Lavalink.jar"
timeout /t 5 /nobreak >nul

REM Запуск Dashboard
echo [3/3] Запуск Dashboard (порт 3001)...
start "Dev Dashboard" cmd /k "cd dashboard && npm run dev"

echo.
echo ✓ Все компоненты Dev бота запущены!
echo ✓ Дэшборд доступен на: http://localhost:3001
echo.
pause
