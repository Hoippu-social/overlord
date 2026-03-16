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

cd /d "%~dp0"

REM Шаг 1: Lavalink ПЕРВЫМ (бот требует его при запуске)
echo [1/3] Запуск Lavalink сервера (DEV)...
start "Dev Lavalink" cmd /k "cd lavalink && java -jar Lavalink.jar"
echo Ожидание запуска Lavalink (15 секунд)...
timeout /t 15 /nobreak >nul

REM Шаг 2: Бот
echo [2/3] Запуск Discord бота (DEV)...
start "Dev Bot" cmd /k "cd bot && npm run dev"
timeout /t 3 /nobreak >nul

REM Шаг 3: Dashboard
echo [3/3] Запуск Dashboard (порт 3001)...
start "Dev Dashboard" cmd /k "cd dashboard && npm run dev"

echo.
echo ✓ Все компоненты Dev бота запущены!
echo ✓ Порядок: Lavalink → Бот → Dashboard
echo ✓ Дэшборд доступен на: http://localhost:3001
echo.
pause
