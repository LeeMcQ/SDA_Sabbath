#!/bin/sh
# SDA Sabbath live translation (Afrikaans to English, offline). First run installs everything (needs internet once).
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -r requirements.txt; } || exit 1
[ -d models/opus-mt-af-en ] || .venv/bin/python livetranslate.py get-models || exit 1
exec .venv/bin/python livetranslate.py serve "$@"
