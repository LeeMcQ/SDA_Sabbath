#!/usr/bin/env python3
"""
Import hymn-to-tune matches into the offline music library.

  python tools/import_tune_map.py <folder or .zip with the filled CSV files> [--dry-run]

Each CSV is one hymnbook, named like "03-web-rejnac-xhosa.csv" (the hymnbook id after the number). Columns used:
  n           the hymn number in that hymnbook
  sdah        the SDA Hymnal (1985) number whose tune it is sung to (empty: no SDA Hymnal tune)
  confidence  high / medium / low   (low and empty are not imported, only listed)

For every match the hymn gets the SDA Hymnal's MIDI file and verse plan in data/music/index.json, the same way
Advent Lofliedere was linked. A hymnbook in the files replaces that hymnbook's earlier matches. Sister hymnbooks
with the same numbers (tools/tune_map_twins.json: SID isiXhosa, SID Setswana, Hymnals Data Swahili) get the
matches too, for the numbers where both books have the same hymn.

Afterwards: python tools/build.py, then the tests (tests/smoke.py, tests/offline.py).
"""
import csv, io, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'data', 'music', 'index.json')
TWINS = os.path.join(ROOT, 'tools', 'tune_map_twins.json')
KEEP = {'high', 'medium'}


def read_csvs(src):
    """Yield (filename, text) for every CSV in a folder (any depth) or a zip."""
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            for name in sorted(z.namelist()):
                if name.lower().endswith('.csv') and not os.path.basename(name).startswith(('.', '_')):
                    yield os.path.basename(name), decode(z.read(name))
        return
    for d, _, fs in sorted(os.walk(src)):
        for f in sorted(fs):
            if f.lower().endswith('.csv') and not f.startswith(('.', '_')):
                with open(os.path.join(d, f), 'rb') as fh:
                    yield f, decode(fh.read())


def decode(b):
    for enc in ('utf-8-sig', 'cp1252'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('utf-8', 'replace')


def rows_of(text):
    # The delimiter comes from the header line only (Excel in some countries saves with ";"): the hymn text in
    # the other lines is full of commas and semicolons.
    header = text.lstrip('﻿').split('\n', 1)[0]
    delim = max(',;\t', key=header.count)
    r = csv.DictReader(io.StringIO(text.lstrip('﻿')), delimiter=delim)
    for row in r:
        yield {(k or '').strip().lower(): (v or '').strip() for k, v in row.items() if k is not None}


def book_id(filename):
    stem = os.path.splitext(filename)[0]
    stem = re.sub(r'\s*\(\d+\)$', '', stem)            # "03-web-rejnac-xhosa (1).csv" from a second download
    return re.sub(r'^\d+[-_ ]+', '', stem).strip()


def number(s):
    m = re.search(r'\d+', s or '')
    return int(m.group()) if m else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)
    index = json.load(open(INDEX, encoding='utf-8'))
    sdah = index['books']['sda-online']['hymns']
    twins = json.load(open(TWINS, encoding='utf-8')) if os.path.exists(TWINS) else {}
    done = {}
    problems = []
    for fname, text in read_csvs(args[0]):
        bid = book_id(fname)
        if bid == 'sda-online':
            problems.append('%s: the SDA Hymnal itself is the reference, skipped' % fname)
            continue
        hymns, low, none, seen = {}, [], 0, set()
        for i, row in enumerate(rows_of(text), 2):
            n = number(row.get('n'))
            if not n:
                continue
            if n in seen:
                problems.append('%s line %d: hymn %d appears twice, the first is kept' % (fname, i, n))
                continue
            seen.add(n)
            s = number(row.get('sdah'))
            conf = row.get('confidence', '').lower()
            if not s:
                none += 1
                continue
            if conf not in KEEP:
                low.append('%d→%d' % (n, s))
                continue
            if str(s) not in sdah:
                problems.append('%s line %d: hymn %d → SDA Hymnal %d, which has no music file' % (fname, i, n, s))
                continue
            hymns[str(n)] = dict(sdah[str(s)])
        if not seen:
            problems.append('%s: no rows with a hymn number (is it the right file?)' % fname)
            continue
        done[bid] = hymns
        print('%-28s %4d hymns: %4d linked, %3d low (not imported), %4d no SDA Hymnal tune'
              % (bid, len(seen), len(hymns), len(low), none))
        if low:
            print('    low, check later: ' + ', '.join(low[:40]) + (' …' if len(low) > 40 else ''))
    for twin, t in twins.items():
        if t['from'] in done:
            same = set(t['same'])
            done[twin] = {n: e for n, e in done[t['from']].items() if int(n) in same}
            print('%-28s %4d linked (same numbers as %s)' % (twin, len(done[twin]), t['from']))
    for p in problems:
        print('! ' + p)
    if not done:
        print('Nothing to import.')
        sys.exit(1)
    if dry:
        print('Dry run: index.json not changed.')
        return
    for bid, hymns in done.items():
        old = index['books'].get(bid, {})
        entry = {'pack': index['books']['sda-online']['pack'], 'hymns': dict(sorted(hymns.items(), key=lambda kv: int(kv[0])))}
        entry['note'] = old.get('note') or 'Same tunes as the SDA Hymnal, matched by hymn: hymn number -> the SDA Hymnal tune'
        index['books'][bid] = entry
    with open(INDEX, 'w', encoding='utf-8') as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))
    print('Saved %s. Now run: python tools/build.py, then the tests.' % os.path.relpath(INDEX, ROOT))


if __name__ == '__main__':
    main()
