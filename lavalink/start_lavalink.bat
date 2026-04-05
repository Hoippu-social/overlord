@echo off
setlocal
set "JAVA_BIN=%LAVALINK_JAVA_BIN%"
if not defined JAVA_BIN set "JAVA_BIN=D:\prgrm languages\java\jdk-25\bin\java.exe"
set "JAVA_OPTS=%LAVALINK_JAVA_OPTS%"
if not defined JAVA_OPTS set "JAVA_OPTS=-Xms128m -Xmx384m"

echo Starting Lavalink Server...
echo.
"%JAVA_BIN%" %JAVA_OPTS% -jar Lavalink.jar
endlocal
pause
