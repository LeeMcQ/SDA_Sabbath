#!/bin/sh
# SDA Sabbath live translation (Afrikaans to English, offline). First run installs everything (needs internet once).
cd "$(dirname "$0")"
if ! command -v uv >/dev/null 2>&1 && [ ! -x bin/uv ]; then
  mkdir -p bin && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="$PWD/bin" UV_NO_MODIFY_PATH=1 sh || exit 1
fi
UV=$(command -v uv || echo bin/uv)
[ -x .venv/bin/python ] || { "$UV" venv --python 3.12 .venv && "$UV" pip install --python .venv/bin/python -r requirements.txt; } || exit 1
grep -q setup_done config.json 2>/dev/null || .venv/bin/python livetranslate.py setup || exit 1
exec .venv/bin/python livetranslate.py serve "$@"
