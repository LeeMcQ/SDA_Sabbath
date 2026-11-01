#!/usr/bin/env python3
"""Build the Windows program: PyInstaller makes "SDA Sabbath Translator" (Python and every part included), then the
data it needs is put beside it. The GitHub workflow (.github/workflows/translator-exe.yml) then wraps the folder in
an installer with Inno Setup (installer.iss). Models are not included: the first start downloads them.

    pip install -r requirements.txt pyinstaller
    python build_exe.py            -> dist/SDA Sabbath Translator/
"""
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'SDA Sabbath Translator'
DIST = os.path.join(HERE, 'dist', NAME)


def main():
    cmd = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--console', '--name', NAME,
           '--icon', os.path.join(HERE, 'app.ico'), '--distpath', os.path.join(HERE, 'dist'), '--workpath', os.path.join(HERE, 'build'),
           '--specpath', os.path.join(HERE, 'build')]
    for pkg in ('numpy', 'faster_whisper', 'ctranslate2', 'onnxruntime', 'sounddevice', '_sounddevice_data', 'soundfile', '_soundfile_data',
                'tokenizers', 'av', 'truststore', 'huggingface_hub', 'sentencepiece'):
        try:
            __import__(pkg)
            cmd += ['--collect-all', pkg]
        except Exception:                   # not installed (or, on Linux, no sound library): leave it out
            pass
    for mod in ('scipy', 'torch', 'tensorflow', 'matplotlib', 'PIL', 'tkinter', 'IPython', 'pandas'):
        cmd += ['--exclude-module', mod]
    cmd.append(os.path.join(HERE, 'livetranslate.py'))
    subprocess.run(cmd, check=True)
    # data beside the program (it looks next to its .exe): word list, quality test, Bibles, guide, licence notes
    for f in ('glossary.json', 'README.md', 'finetune_mt.py'):
        shutil.copy(os.path.join(HERE, f), DIST)
    shutil.copytree(os.path.join(HERE, 'quality'), os.path.join(DIST, 'quality'), dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('report*.md'))
    src = os.path.join(HERE, 'bibles') if os.path.isdir(os.path.join(HERE, 'bibles')) else os.path.join(HERE, '..', 'data', 'bibles')
    for b in ('afr53', 'web', 'kjv'):
        shutil.copytree(os.path.join(src, b), os.path.join(DIST, 'bibles', b), dirs_exist_ok=True)
    print('Built', DIST)


if __name__ == '__main__':
    main()
