#!/usr/bin/env python3
"""Live translation logic that needs no models: Bible quotes, spoken references, hymn numbers, Adventist words.
usage: python tests/test_translator.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'translator'))
import livetranslate as L

fails = []
def ok(c, m):
    print(('PASS  ' if c else 'FAIL  ') + m)
    if not c: fails.append(m)

b = L.Bible('web')
def ref(s):
    m = b.match(s); return b.ref_text(*m[:4]) if m else None
ok(ref('Want so lief het God die wêreld gehad, dat Hy sy eniggebore Seun gegee het, sodat elkeen wat in Hom glo, nie verlore mag gaan nie, maar die ewige lewe kan hê.') == 'John 3:16', 'whole verse quoted → John 3:16')
ok(ref('Want so lief het God die wêreld gehad dat Hy sy eniggebore Seun gegee het') == 'John 3:16', 'part of a verse → John 3:16')
ok(ref('Gedenk die sabbatdag, dat jy dit heilig.') == 'Exodus 20:8', 'the fourth commandment → Exodus 20:8')
ok(b.english(18, 23, 1).startswith('The LORD is my shepherd'), 'World English Bible says "the LORD", as preached')
for s in ['Want God het die wêreld so lief gehad dat Hy sy Seun gestuur het om ons te red.', 'Die Sabbat is die dag wat God geseën en geheilig het vir ons.',
          'Ons glo dat die Bybel die Woord van God is en dat dit ons lewe kan verander.', 'Die Here Jesus kom weer, broers en susters, en ons moet gereed wees.']:
    ok(ref(s) is None, 'own words are translated, not taken for a verse: ' + s[:40])
for s, want in [('Ons lees uit Johannes hoofstuk drie vers sestien.', ['John 3:16']), ('Johannes 3:16 sê', ['John 3:16']),
                ('Kom ons lees Eerste Korintiërs dertien verse vier tot sewe', ['1 Corinthians 13:4-7']),
                ('Romeine agt vers agt-en-twintig', ['Romans 8:28']), ('Openbaring veertien vers ses', ['Revelation 14:6']),
                ('Psalm drie en twintig', ['Psalms 23']), ('Johannes het vir hulle gesê', [])]:
    ok(b.refs(s) == want, 'reference heard: %s → %s' % (s, b.refs(s)))
for s, want in [('Kom ons sing gesang nommer honderd.', [100]), ('Ons sing lied 214', [214]), ('Ons sing saam', [])]:
    ok(L.hymns_named(s) == want, 'hymn heard: %s → %s' % (s, L.hymns_named(s)))
g = L.Glossary()
ok(g.before('Die Sewendedag-Adventiste Kerk hou die Sabbat en glo in die Gees van die Profesie.') ==
   'Die Seventh-day Adventist Church hou die Sabbath en glo in die Spirit of Prophecy.', 'Adventist words fixed before translating')
ok(g.after('the Here Jesus') == 'the Lord Jesus', 'English corrected after translating')
ok(g.junk('Teksting deur Amara.org') and not g.junk('Ons bid saam.'), 'phantom subtitle lines dropped')
print('\n%d failed' % len(fails)); sys.exit(len(fails))
