@echo off
rem ============================================================
rem  pmcrwf launcher (Windows)
rem
rem  Serves this folder and opens the sheet in your browser:
rem      pmcrwf          start (or reuse) the server, then open the sheet
rem      pmcrwf stop     stop the server running on the port
rem      pmcrwf help     show usage
rem
rem  Finds its own folder via %~dp0, so it works wherever the repo lives
rem  and from any working directory. Put this folder on your PATH to be
rem  able to just type "pmcrwf" anywhere (see README).
rem
rem  Env overrides:  PMCRWF_PORT (default 8931), PMCRWF_NO_OPEN=1 (don't
rem  launch a browser -- handy for scripts).
rem ============================================================
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
if not defined PMCRWF_PORT set "PMCRWF_PORT=8931"
set "PORT=%PMCRWF_PORT%"
set "URL=http://localhost:%PORT%/character-sheet.html"

if /i "%~1"=="stop" goto :stop
if /i "%~1"=="help" goto :help
if /i "%~1"=="-h" goto :help
if /i "%~1"=="--help" goto :help
if not "%~1"=="" echo Unknown argument "%~1" -- ignoring. Try "pmcrwf help".

if not exist "%ROOT%\character-sheet.html" (
  echo [pmcrwf] character-sheet.html is not in "%ROOT%".
  echo          Keep pmcrwf.cmd in the same folder as the sheet.
  exit /b 1
)

rem --- already being served? then just open it ---
call :isup
if not errorlevel 1 (
  echo [pmcrwf] Already serving port %PORT%.
  goto :open
)

rem --- locate a Python interpreter ---
set "PY="
call :trypy py -3
if not defined PY call :trypy python
if not defined PY call :trypy python3
if not defined PY (
  echo [pmcrwf] No working Python found on PATH.
  echo          Install it from https://www.python.org/downloads/ and tick "Add Python to PATH".
  exit /b 1
)

echo [pmcrwf] Serving "%ROOT%" on port %PORT% ^(%PY%^)...
start "pmcrwf server (port %PORT%)" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server %PORT%"

rem --- wait for the port to come up (~15s max) ---
for /l %%I in (1,1,30) do (
  call :isup
  if not errorlevel 1 goto :open
  call :nap
)
echo [pmcrwf] Server did not come up on port %PORT%. Check the "pmcrwf server" window for errors.
exit /b 1

:open
if defined PMCRWF_NO_OPEN (
  echo [pmcrwf] Ready: %URL%
  exit /b 0
)
echo [pmcrwf] Opening %URL%
start "" "%URL%"
echo [pmcrwf] The server keeps running in its own minimized window. Stop it with "pmcrwf stop" or by closing that window.
exit /b 0

:stop
set "PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT% "') do set "PID=%%P"
if not defined PID (
  echo [pmcrwf] Nothing is serving port %PORT%.
  exit /b 0
)
taskkill /pid %PID% /t /f >nul 2>&1
if errorlevel 1 (
  echo [pmcrwf] Could not stop the process on port %PORT% ^(pid %PID%^).
  exit /b 1
)
echo [pmcrwf] Stopped whatever was serving port %PORT% ^(pid %PID%^).
exit /b 0

:help
echo pmcrwf - serve this folder and open the character sheet
echo.
echo   pmcrwf         start (or reuse) the local server, then open the sheet
echo   pmcrwf stop    stop the server on port %PORT%
echo   pmcrwf help    this message
echo.
echo   Folder : %ROOT%
echo   URL    : %URL%
echo   Env    : PMCRWF_PORT (default 8931), PMCRWF_NO_OPEN=1 to skip the browser
exit /b 0

rem --- helpers ---

:isup
rem exit code 0 when something is LISTENING on %PORT%
netstat -an | findstr "LISTENING" | findstr ":%PORT% " >nul 2>&1
exit /b %errorlevel%

:trypy
rem %* is a candidate interpreter; sets PY if it actually runs
for /f "delims=" %%X in ('%* -c "print(1)" 2^>nul') do if "%%X"=="1" set "PY=%*"
exit /b 0

:nap
rem ~1s sleep that also works when stdin is redirected
timeout /t 1 /nobreak >nul 2>&1 || ping -n 2 127.0.0.1 >nul 2>&1
exit /b 0
