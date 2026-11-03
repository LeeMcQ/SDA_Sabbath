#!/usr/bin/env python3
"""
Keep copyrighted song words out of the public app (licensing review, 3 Nov 2026).

For the hymnbooks below only the number, title and author stay in the public files ("words": false).
Words are kept only for songs listed in KEEP_WORDS, which are public domain (text written before 1928
and author dead for more than 70 years, or traditional). Churches add the words of the other songs
under their own licence (CCLI or the publisher's permission) in the app: Hymns -> More -> Import
licensed words, or Edit on a hymn. Those words stay on the church's own devices.

    python tools/strip_licensed_hymns.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS = {
    'sda-online.json': set(),        # SDA Hymnal 1985: compilation and edited texts (c) Review and Herald / GC
    'afrikaans.json': set(),         # Advent Lofliedere: translations (c) the church / translators
    'choruses.json': {8, 14, 35, 43},  # Give Me Oil in My Lamp, Kum Ba Yah, God Is So Good, What a Mighty God We Serve (traditional)
    'malmesbury.json': {6, 19, 22, 24, 26},  # Love Lifted Me (1912), Just As I Am (1835), His Eye Is on the Sparrow (1905),
                                             # When We All Get to Heaven (1898), Amazing Grace (1779)
}
KEEP_FIELDS = ('n', 't', 'a', 'ccli')

for name, keep in BOOKS.items():
    path = os.path.join(ROOT, 'data', 'hymns', name)
    d = json.load(open(path, encoding='utf-8'))
    out = []
    for x in d['hymns']:
        if x.get('n') in keep and x.get('v'):
            y = dict(x); y['pd'] = True
        else:
            y = {k: x[k] for k in KEEP_FIELDS if x.get(k)}
            y['words'] = False
        out.append(y)
    d['hymns'] = out
    d['licence'] = ('Numbers and titles only. The words are copyrighted: add them under your church\'s own licence '
                    '(Hymns -> More -> Import licensed words).') if not keep else \
                   'Public-domain songs include their words; for the others add the words under your church\'s own licence.'
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(name, len(out), 'songs,', sum(1 for y in out if y.get('pd')), 'with public-domain words')
