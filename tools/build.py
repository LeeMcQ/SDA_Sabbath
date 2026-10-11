#!/usr/bin/env python3
"""
Prepare Selah for deployment.

  python tools/build.py              # list every app file in asset-manifest.json and stamp sw.js
  python tools/build.py --bibles     # also rebuild data/bibles from ./sources (and ./licensed)

The service worker downloads everything listed in asset-manifest.json in one go when the app
is installed, so the whole app (Bibles, hymns, fonts, pdf.js) works offline afterwards.
Licensed Bibles in data/bibles-private/ are included only in builds made on your own machine
(that folder is git-ignored, so it never reaches a public repository).
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_DIRS = ['css', 'js', 'vendor', 'fonts', 'icons', 'data']
INCLUDE_FILES = ['index.html', 'display.html', 'manifest.webmanifest']
SKIP = re.compile(r'(\.map$|\.md$|LICENSE|\.txt$|\.DS_Store)')


def collect():
    files = list(INCLUDE_FILES)
    for d in INCLUDE_DIRS:
        for base, dirs, names in os.walk(os.path.join(ROOT, d)):
            dirs.sort()
            for n in sorted(names):
                rel = os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/')
                if not SKIP.search(rel):
                    files.append(rel)
    return files


def main():
    if '--bibles' in sys.argv:
        subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'build_bibles.py'), '--licensed'])
    files = collect()
    h = hashlib.sha256()
    total = 0
    for f in files:
        with open(os.path.join(ROOT, f), 'rb') as fh:
            b = fh.read()
        total += len(b)
        h.update(f.encode()); h.update(b)
    version = h.hexdigest()[:12]
    with open(os.path.join(ROOT, 'asset-manifest.json'), 'w') as fh:
        json.dump({'version': version, 'bytes': total, 'files': files}, fh, indent=0)
    sw = os.path.join(ROOT, 'sw.js')
    src = open(sw, encoding='utf-8').read()
    src = re.sub(r"const VERSION = '[^']*';", "const VERSION = '%s';" % version, src, count=1)
    open(sw, 'w', encoding='utf-8', newline='\n').write(src)
    print('Selah build %s: %d files, %.1f MB to cache offline' % (version, len(files), total / 1048576))
    # Pre-compressed copies for the companion (smaller .exe, faster loads over church Wi-Fi).
    import gzip, shutil
    emb = os.path.join(ROOT, 'companion', 'embed')
    shutil.rmtree(emb, ignore_errors=True)
    gz_total = 0
    for f in files + ['asset-manifest.json', 'sw.js']:
        if not re.search(r'\.(json|js|mjs|css|html|webmanifest|svg|txt)$', f):
            continue
        src = os.path.join(ROOT, f)
        dst = os.path.join(emb, f + '.gz')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(src, 'rb') as a:
            data = gzip.compress(a.read(), compresslevel=9, mtime=0)
        with open(dst, 'wb') as b:
            b.write(data)
        gz_total += len(data)
    print('Companion: compressed text assets to %.1f MB' % (gz_total / 1048576))


if __name__ == '__main__':
    main()
