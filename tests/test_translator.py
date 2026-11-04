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
if b.af:   # the licensed Afrikaans Bible is installed on this machine
    ok(ref('Want so lief het God die wêreld gehad, dat Hy sy eniggebore Seun gegee het, sodat elkeen wat in Hom glo, nie verlore mag gaan nie, maar die ewige lewe kan hê.') == 'John 3:16', 'whole verse quoted → John 3:16')
    ok(ref('Want so lief het God die wêreld gehad dat Hy sy eniggebore Seun gegee het') == 'John 3:16', 'part of a verse → John 3:16')
    ok(ref('Gedenk die sabbatdag, dat jy dit heilig.') == 'Exodus 20:8', 'the fourth commandment → Exodus 20:8')
else:
    print('SKIP  Bible quote checks: the Afrikaans 1933/53 Bible is licensed and not in this copy')
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
t, marks = g.protect(g.normalise('Die Sewendedag-Adventiste Kerk hou die Sabbat en glo in die Gees van die Profesie.'))
ok(t == 'Die 9301 hou die 9302 en glo in die 9303.' and [w for _, w in marks] == ['Seventh-day Adventist Church', 'Sabbath', 'Spirit of Prophecy'],
   'Adventist terms marked for fixed English: %s' % t)
ok(g.restore('The 9301 keeps the 9302 and believes in the 9303.', marks) == 'The Seventh-day Adventist Church keeps the Sabbath and believes in the Spirit of Prophecy.', 'markers become the fixed English')
ok(g.restore('The church keeps the day.', marks) is None, 'a lost marker is noticed (then translated again, words inline)')
t, marks = g.protect('Broer Fortuin en suster Swart kom van Malmesbury.')
ok([w for _, w in marks] == ['Fortuin', 'Swart', 'Malmesbury'], 'names never translated: %s' % t)
ok(g.protect('Swart mense en wit mense')[1] == [] or g.protect('die swart hond')[1] == [], 'ordinary lower-case words are not taken for names')
g.set_keep(['Riebeek-Kasteel', 'Pastoor Botha'])
ok([w for _, w in g.protect('Pastoor Botha preek in Riebeek-Kasteel.')[1]] == ['Pastoor Botha', 'Riebeek-Kasteel'], 'names sent by SDA Sabbath are kept')
t, marks = g.protect('Die Here is goed, dames en here.')
ok([w for _, w in marks] == ['The Lord'] and 'dames en here' in t, '"die Here" is the Lord; lower-case "here" (gentlemen) is left alone')
for a, b in [("Ek's so bly djy's hie vandag.", 'Ek is so bly jy is hier vandag.'), ('Die laaities moet stil sit.', 'Die kinders moet stil sit.'),
             ('Dit issie maklik nie.', 'Dit is nie maklik nie.'), ('Hy het mos gesê hy sal kom, nè?', 'Hy het gesê hy sal kom?'),
             ('Ons gaan nou-nou sing.', 'Ons gaan binnekort sing.'), ('Ek wiet nie wat om te sê nie.', 'Ek weet nie wat om te sê nie.')]:
    ok(g.normalise(a) == b, 'slang: %s → %s' % (a, g.normalise(a)))
ok(g.after('the Here Jesus') == 'the Lord Jesus', 'English corrected after translating')
ok(g.junk('Teksting deur Amara.org') and not g.junk('Ons bid saam.'), 'phantom subtitle lines dropped')
# fillers: "ek sê" only on its own; uhm, eh, ag always
for a, want in [('Ek sê vir julle, Hy kom weer.', 'Ek sê vir julle, Hy kom weer.'), ('Dit was lekker, ek sê!', 'Dit was lekker!'),
                ('Luister na wat ek sê.', 'Luister na wat ek sê.'), ('Uhm, ons gaan eh nou bid.', 'Ons gaan nou bid.'), ('Ag, ek weet nie.', 'Ek weet nie.')]:
    ok(g.normalise(a) == want, 'filler: %s → %s' % (a, g.normalise(a)))
# church words
g2 = L.Glossary()
for a, want in [('Die preek was lank.', ['The sermon']), ('Die preek van vandag gaan oor genade.', ["Today's sermon", 'grace']),
                ('Laat ons buig vir gebed.', ['Let us bow in prayer']), ('Ons buig vir gebed.', ['bow in prayer']),
                ]:
    ok([w for _, w in g2.protect(g2.normalise(a))[1]] == want, 'word list: %s → %s' % (a, [w for _, w in g2.protect(a)[1]]))
ok('sermon' not in str(g2.protect('Pastoor Botha preek in Riebeek-Kasteel.')[1]), 'the verb "preek" (preaches) is not made "sermon"')
b = L.Bible('web')
# spoken numbers in references become digits
for a, want in [('Psalm drie-en-twintig is my gunsteling.', 'Psalm 23 is my gunsteling.'), ('Kom ons lees uit Johannes drie vers sestien.', 'Kom ons lees uit Johannes 3 vers 16.'),
                ('Openbaring veertien vers ses tot twaalf praat van die drie engele.', 'Openbaring 14 vers 6 tot 12 praat van die drie engele.'),
                ('Psalm drie en twintig', 'Psalm 23'), ('Romeine agt vers agt-en-twintig', 'Romeine 8 vers 28'),
                ('Johannes het vir hulle gesê', 'Johannes het vir hulle gesê'), ('Ons sing lied drie', 'Ons sing lied drie'), ('Johannes 3:16 sê', 'Johannes 3:16 sê')]:
    ok(b.digits(a) == want, 'reference digits: %s → %s' % (a, b.digits(a)))
# long run-on speech is split before translating; short sentences are not
LONG = ('Broers en susters ek wil vanoggend met julle praat oor die liefde van God want so dikwels vergeet ons dat Hy ons elke dag dra '
        'en as ons terugkyk na die afgelope jaar dan sien ons hoe getrou Hy was in die siekte en in die swaar tye en ook in die goeie tye '
        'en daarom wil ek julle vra om saam met my te dank en te bid vir die gemeente en vir ons families')
parts = L.split_long(LONG)
ok(len(parts) >= 3 and all(len(p.split()) <= L.LONG_WORDS + 6 for p in parts) and ' '.join(parts).split() == LONG.split(),
   'long speech (%d words) split into %d pieces, no word lost' % (len(LONG.split()), len(parts)))
ok(L.split_long('Ons bid vir die siekes in ons gemeente.') == ['Ons bid vir die siekes in ons gemeente.'], 'a short sentence is not split')
class FakeMT:
    def __call__(self, xs): return ['<%s>' % x for x in xs]
r = L.TextTranslator(FakeMT(), L.Glossary(), b)([LONG])[0]
ok(r['en'].count('<') == len(parts), 'long speech: each piece translated, then joined into one caption')
# speech model: recommend turbo on a fast PC, keep the default on a slow one
_cfg = L.config
L.config = lambda: {'speeds': {'small': 0.07}, 'hw': 'cpu', 'asr': 'small'}
ml = L.model_list(); ok(ml['recommended'] == 'turbo' and 'turbo' in L.upgrade_words('small', ml), 'fast PC without graphics card: turbo recommended (%s)' % ml['recommended'])
L.config = lambda: {'speeds': {'small': 0.4}, 'hw': 'cpu', 'asr': 'small'}
ml = L.model_list(); ok(ml['recommended'] == 'small' and L.upgrade_words('small', ml) == '', 'slow PC: stays on small, no upgrade suggested')
L.config = _cfg
# the Bible check only promises quoted verses when the licensed Afrikaans Bible is installed
ok(('Afrikaans verses for Bible quotes' in L.af_words()) == bool(b.af), 'Bible check wording follows the Afrikaans Bible: %s' % L.af_words()[:60])
L.DEMO = True; ok(('Afrikaans verses' in L.demo_check('words')['detail']) == bool(b.af), 'demo Bible check follows it too'); L.DEMO = False

import argparse
p_, n_, _ = L.quality(argparse.Namespace(dry=True, mt=None, english='web'), quiet=True)
ok(p_ == n_, 'quality test set, without a model: %d / %d prepared correctly' % (p_, n_))
print('\n%d failed' % len(fails)); sys.exit(len(fails))
