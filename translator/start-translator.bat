@echo off
rem SDA Sabbath live translation (Afrikaans to English, offline). First run installs everything (needs internet once).
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Setting up the translator for the first time...
  py -3 -m venv .venv || python -m venv .venv || (echo Install Python 3.10 or newer from python.org first. & pause & exit /b 1)
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt || (pause & exit /b 1)
)
if not exist models\opus-mt-af-en (
  .venv\Scripts\python livetranslate.py get-models || (pause & exit /b 1)
)
.venv\Scripts\python livetranslate.py serve %*
pause
