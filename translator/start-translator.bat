@echo off
setlocal
title SDA Sabbath translator
cd /d "%~dp0"
rem SDA Sabbath live translation (Afrikaans sermon to English captions, offline).
rem First run: installs everything by itself (Python included), downloads the models, tests them. Needs internet once.

if exist "bin\uv.exe" goto have_uv
echo Getting the installer tool...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; New-Item -ItemType Directory -Force bin | Out-Null; Invoke-WebRequest 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' -OutFile 'bin\uv.zip'; Expand-Archive -Force 'bin\uv.zip' 'bin'; Remove-Item 'bin\uv.zip'"
if not exist "bin\uv.exe" goto fail
:have_uv

if exist ".venv\Scripts\python.exe" goto have_python
echo Installing Python and the translator - first time only, a few minutes...
"bin\uv.exe" venv --python 3.12 .venv
if errorlevel 1 goto fail
"bin\uv.exe" pip install --python ".venv\Scripts\python.exe" -r requirements.txt
if errorlevel 1 goto fail
:have_python

findstr /c:"setup_done" config.json >nul 2>&1
if not errorlevel 1 goto run
".venv\Scripts\python.exe" livetranslate.py setup
if errorlevel 1 goto fail
call :shortcuts

:run
echo.
echo ============================================================================
echo  The translator is running. Keep this window open during the service.
echo  In SDA Sabbath: Settings - Live translation - Start listening.
echo ============================================================================
".venv\Scripts\python.exe" livetranslate.py serve %*
pause
exit /b 0

:shortcuts
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SDA Sabbath translator.lnk'); $s.TargetPath='%~dp0start-translator.bat'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo A shortcut "SDA Sabbath translator" is on the desktop.
choice /c YN /m "Start the translator by itself when this PC starts"
if errorlevel 2 exit /b 0
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut([Environment]::GetFolderPath('Startup')+'\SDA Sabbath translator.lnk'); $s.TargetPath='%~dp0start-translator.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
echo It will start by itself, minimised, when Windows starts.
exit /b 0

:fail
echo.
echo Something went wrong. Check the internet connection and double-click start-translator.bat again.
pause
exit /b 1
