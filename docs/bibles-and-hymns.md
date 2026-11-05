# Bibles and hymns

## Bibles

Built in (public domain): **KJV** and **WEB**.
The **Afrikaanse Bybel 1933/53** (© Bybelgenootskap van Suid-Afrika 1933, 1953), **NIV** (© Biblica) and the
**1975 Xhosa Bible** (© Bible Society of South Africa) cannot be shipped publicly; for the Afrikaans Bible a
complete text in an app needs the Bible Society's written permission (copyright@biblesociety.co.za). Each church adds its own licensed copy:

- **On one device:** Settings → Bibles & hymns → **Add a Bible**. Search the list and press **Add**, or choose a
  file (Zefania XML, OSIS XML, CES XML, JSON, CSV). The `xho75.json` file from Joy in the Journey imports directly.
- The list in **Add a Bible** searches three sources together (buttons above the results show each source and its
  count, and filter to one source): bible.helloao.org (Free Use Bible API), getBible, and the multilingual
  [Bible corpus](https://github.com/christos-c/bible-corpus) by Christodoulopoulos and Steedman (about 100
  languages, including the full Xhosa, Shona, Somali, Amharic and Malagasy Bibles and the Zulu, Swahili, Ewe,
  Wolof and Dinka New Testaments). The corpus is where the Xhosa Bible in Joy in the Journey comes from. Its
  catalogue is in `js/core/biblecorpus.js`; each translation keeps its own copyright (the Xhosa text is
  © Bible Society of South Africa). getBible's list is also built in (`js/core/biblegetbible.js`), so it shows
  even when api.getbible.net is slow; bible.helloao.org's list loads live, and a Bible from it downloads in one
  file or, when the site has no single file, chapter by chapter.
- A fourth source, the **eBible corpus** ([github.com/BibleNLP/ebible](https://github.com/BibleNLP/ebible), openly
  licensed texts from eBible.org, mostly CC BY-SA from Biblica), adds the Setswana New Testament and modern Bibles in
  isiNdebele, Chichewa, Shona, Kikuyu, Dholuo, Kiswahili and Twi (`js/core/biblesources.js`, `EBIBLE`). Sesotho,
  Sepedi, Xitsonga, Tshivenda, siSwati and a full isiZulu Bible have no openly licensed text online: a church adds
  its Bible Society copy as a file (Add a Bible, or *Our church's own Bible file* in the first-start setup).
- **For your whole installation:** drop the file into `licensed/` and run `python tools/build.py --bibles`
  (see `licensed/README.md`). The folder is git-ignored, so it never becomes public.

## Hymns

### Add a hymnbook (the same way as Add a Bible)

**Hymns → ⋯ → Add a hymnbook**, or **Settings → Bibles & hymns → Add a hymnbook**. Search the list (“Xhosa”, “isiZulu”,
“Sesotho”, “French” … the same search as Add a Bible, southern African languages first) and press **Add**: the hymnbook
downloads once from GitHub, is converted and then works offline on that device (and goes into your backups). **Update**
downloads it again. Settings → Bibles & hymns lists every hymnbook, built in or added, with **Remove** for the added ones.

The list (`js/core/hymnsources.js`) is built in, so it shows even when GitHub is slow. Three sources:

- **SDA hymnals (Rejnac)** — [github.com/rejnac/compiled-hymnal](https://github.com/rejnac/compiled-hymnal): 26 languages,
  prepared in VideoPsalm by the Rejnac Foundation (MIT licence): Chichewa, Dholuo, Ekegusii, English (SDA Hymnal, 695
  hymns plus 257 more songs), French (Hymnes et Louanges), Icibemba, isiZulu/Ndebele, Kalenjin, Kamba, Kikuyu,
  Kinyarwanda, Maasai, Portuguese (Novo Hinário Adventista), Russian, Sepedi, Shona, Sesotho, Spanish (Himnario
  Adventista), Swahili, Tonga, Setswana, Tumbuka, Twi, Tshivenda, isiXhosa and Xitsonga. These files keep each stanza on
  one line, so SDA Sabbath breaks it into lines where a new line of the hymn starts (punctuation, then a capital) and
  halves lines that are still too long.
  **The English SDA Hymnal** also fills in the words of the built-in *SDA Hymnal 1985* (numbers and titles only) for
  every hymn whose title matches and that has no words yet, so those hymns play with their offline music, and plans and
  “hymn 73” keep working. Removing the downloaded book removes those words again; words the church added itself are
  never replaced.
- **SID Hymnal** — [github.com/sidadventist/sid_hymnal](https://github.com/sidadventist/sid_hymnal): English, isiXhosa
  (U-Kristu Engomeni) and Setswana (Keresete Mo Kopelong), with the same numbers in all three. One file per hymn, so it
  downloads hymn by hymn (8 at a time).
- **Hymnals Data** — [github.com/GospelSounders/hymnals-data](https://github.com/GospelSounders/hymnals-data): *Hymns for
  God's Peculiar People* (1849, James White, public domain) and Nyimbo za Kristo (Swahili).

Hymn words belong to their owners. The compilers share these hymnbooks for worship use, but a church still checks that it
may use the words (many SDA Hymnal texts are under copyright), and a live stream also needs a CCLI Streaming Licence.

**Advent Lofliedere** (Afrikaans) has no words in any download list, because its words are copyrighted. A church
that has them as a file fills the built-in book by number: Hymns → ⋯ → Import licensed words, or *Our church's own
hymnbook file* for Afrikaans in the first-start setup. The setup offers the same for any language without a download.

**From a file** (in the same dialog): VideoPsalm songbooks (`.vpc`, which is a zip, or the `.json` inside it), SDA Sabbath
hymnbooks (`.json`), the Liedboek JSON format, and text with `# 73 Title` before each hymn. **Import licensed words**
reads VideoPsalm songbooks too, so a church with the English SDA Hymnal in VideoPsalm can fill in the built-in book by
number.

The parsers are in `js/core/hymnparse.js`. To add another hymnbook to the list, add a row to `HYMNALS` in
`js/core/hymnsources.js` (source, key, name, short name, language code, language, number of hymns, size in KB, path).
Shipped and added hymnbooks are separate: shipping one with the app is still done in `data/hymns/index.json` (below).

### Built-in hymnbooks

Built in (listed in `data/hymns/index.json`): the 1941 Church Hymnal (703, with words), and by **number and title
only** the SDA Hymnal 1985 (698), Advent Lofliedere (Afrikaans, 481) and the songs of **Shared Hymns – English** — their
words are copyrighted, so only the public-domain songs in them include words. A church that is licensed (CCLI, or
the publisher's permission) adds the words on its own devices:

- **Hymns → ⋯ → Import licensed words…**: a SongSelect file (`.usr` or `.txt`, matched to the hymn by title), or a
  hymnbook file (`.json` or `# 73 Title` text) whose numbers fill in the built-in book.
- Or pick a hymn and press **Add the words**. For SDA Hymnal hymns that are also in the 1941 Church Hymnal, a button
  opens the older public-domain words.
- **Advent Lofliedere words:** Hymns → ⋯ → Add a hymnbook → search “Lofliedere” → **Add** (the words are shared with the owners' permission; one download, then offline). They fill in the built-in Advent Lofliedere, so the hymns keep their music. Without internet: Import licensed words… with the same file (`downloads/lofliedere-words.json` in the repository).
- **Afrikaans Lofliedere music:** hymns that are the same hymn as one in the SDA Hymnal (about 150, matched by number) play the SDA Hymnal's tune. Other Lofliedere hymns can take a MIDI file of your own (Add MIDI file…).
- A hymn without words still has its title slide (number and title), so the congregation can follow in the hymnal.
- Showing words on a live stream also needs the church's **CCLI Streaming Licence**.

Your own hymnbook files go in with
**Hymns → ⋯ → Add a hymnbook** (the form under the list):

- JSON (SDA Sabbath format, formerly "Selah"):
  ```json
  { "id": "sda-en", "name": "SDA Hymnal", "short": "SDAH", "lang": "en",
    "hymns": [ { "n": 73, "t": "Holy, Holy, Holy", "a": "Reginald Heber",
                 "v": [["line 1", "line 2"], ["stanza 2 …"]], "c": ["chorus line 1", "…"] } ] }
  ```
- JSON as in the Afrikaans Liedboek site: `[ { "number": 1, "title": "…", "lyrics": "…" } ]`
  (stanzas separated by an empty line, chorus starting with `Chorus:` / `Koor:` / `Refrain:`).
- Plain text: each hymn starts with `# 73 Holy, Holy, Holy`, stanzas separated by empty lines.

To ship a hymnbook with the app, put the JSON in `data/hymns/` and list it in `data/hymns/index.json`.

### Shared Hymns (every language grows, every church gets new songs)

The hymnbook list has two groups: **Hymnals** (SDA Hymnal 1985, Church Hymnal 1941, Advent Lofliedere and any you add)
and **Shared Hymns**, with one book per language: *English*, *Afrikaans*, *isiXhosa* …

- **Which languages:** the church's service languages from the first-start setup are added automatically (the setup's
  last language step says so); **Hymns → ⋯ → Shared Hymns in another language…** or **Settings → Bibles & hymns** adds
  or removes others (`hymns.shared` in the settings).
- **Shared Hymns – English** holds the praise choruses (1–45) and **Malmesbury Praise (101–148: MP 1 is 101)** with
  their own titles. Plans made before the merge, words and MIDI files a church added to Malmesbury Praise move along
  by themselves.
- **Numbers:** 501 and up are the songs shared by all churches, in every language. A song a church adds itself takes
  the next free number below 501 (English: 149 and up; other languages: 1 and up).
- **Adding a song:** **Hymns → ⋯ → New song** asks the **language** first, gives the next number, and the rest is as
  before (title, writer, words). Find lyrics online keeps songs in Shared Hymns too.
- **Sharing:** pick your song and press **Share with all churches**. Say whether the words may be shared (public domain,
  written by your church, or with the writer's permission; CCLI songs may not be shared), then **Share on GitHub** opens
  a ready-filled "Share a hymn" issue with the language filled in (a free GitHub account is needed; **Copy the song**
  sends it another way).
- **Getting new songs:** the app checks a few seconds after it starts (at most every 6 hours, and whenever the internet
  comes back); **Hymns → ⋯ → Check for new shared hymns** checks at once. It says how many arrived per language
  ("2 new shared hymns: Afrikaans 1, English 1"). They are marked *Shared* and work offline afterwards.

**The robot** (`.github/workflows/chorus.yml`, `tools/chorus_bot.py`) answers on the issue within minutes: it reads the
language, tidies the words (capitals, spaces, quotes), refuses songs already in SDA Sabbath in that language or not cleared
for sharing, flags typos and near-duplicates, compares the words with a public lyrics database (LRCLIB), and looks for a MIDI
file (a .zip dropped into the issue, or a close title match on BitMidi). **The maintainer adds the label `chorus-approved`** and
the robot adds the song to `data/hymns/community/shared.json` with its language and the next shared number in that language,
rebuilds the website and closes the issue. (English songs are also written to `choruses.json` for app copies older than
5 November 2026.) To publish songs that pass every check without waiting, set the repository variable
`AUTO_PUBLISH_CHORUSES` to `true`.

**Monthly report:** the maintainer's monthly email (`tools/monthly_report.py`) puts the new Shared Hymns of the month near
the top ("New Shared Hymns: 2 songs — Afrikaans 1 (501 …); English 1 (501 …)"), lists them by language with the church that
shared them, and adds the count to the subject line.

### Find lyrics online

**Hymns → ⋯ → Find lyrics online** searches public lyric sites (LRCLIB and Lyrics.ovh) for a title, a first line
or any words (add “by singer” to narrow it). Songs already on the device are shown first. Online results are
ranked with a match label and a preview, so you can pick the right one; if an AI key is set, **Ask AI to help
identify** can also suggest which songs the words belong to (the lyrics always come from the lyric sites, never
from AI). The chosen words are split into stanzas and a chorus (shown as the slides they will become), can be
corrected, and are kept **offline** in a book (Shared Hymns – English by default) with **Add and put on Next**.
If nothing is found, links to other sites and a paste box are offered. Song words belong to their owners: check
that your church’s CCLI (or other) licence covers showing them.

### Hymn music (offline)

695 hymns of the English SDA Hymnal (1–695) have their accompaniment built in, marked ♪ in the list. The church's
MIDI files are played by a SoundFont synthesizer inside the browser (SpessaSynth) with the **GeneralUser GS 2.0.3**
SoundFont and the author's recommended GS reverb (59) and chorus (43, Chorus 3) — the same sound you get from
Falcosoft MIDI Player with that SoundFont. Nothing is streamed: it works with no internet.

- **Play music** plays the accompaniment for exactly the stanzas you chose to sing: introduction, then one verse of
  music per stanza, with the real ending on the last one. **Present & play** puts the hymn on the screen and starts
  the music together; press **M** to play/pause.
- **Words follow music:** while the hymn is live, the slides change with the music (title during the introduction,
  each stanza and chorus as it is reached). Press → / ← at any time to take over.
- **Tempo** (60–140 %), **Key** (±6 semitones), **Instrument** (as arranged, piano, organ, strings, choir), jump to the
  introduction or any verse, **Fade** and **Stop**. Volume, sound quality, church echo, reverb and chorus are in
  **Hymns → ⚙ Hymn options**.
- **Phone as remote:** when a phone controls the church PC through the companion, the music plays on the PC (the
  display window). Open the display on the PC from `http://localhost:7777` — browsers only allow the synthesizer on
  `https://` or `localhost`. Click the projector window once at the start so it may play sound.
- 33 hymns (mostly the short responses 660–695) are through-composed, so they always play as recorded; 25 hymns have
  fewer verses of music than stanzas, so the verse music is repeated. Hymns 696–698 have no MIDI yet.

#### Sound quality (Hymns → ⚙ Hymn options → Music)

- **Instruments → High quality:** a recorded concert grand piano (Salamander Grand Piano, Yamaha C5) and a recorded
  church pipe organ (Montre 8', Prestant 4', Bourdon 8' from the GrandOrgue demo organ) replace the standard piano and
  organ. The hymnal's own arrangements, which use an electric piano, play on the grand piano too. It is an 18 MB
  download the first time (then offline, kept across app updates). **Automatic** switches it on for PCs and laptops
  and leaves phones on the standard 4 MB sounds; when a phone is the remote, the church PC decides.
- **Instruments → Studio** (for the church PC): all 16 recorded loudness layers of the grand piano, so every change
  in touch is a different recording, a longer natural ring, finer audio, and a fuller organ (adds Flûte harmonique
  8' and Octavin 2'). A larger one-time download (`data/music/studio.sf3`), then offline. Devices with little
  memory use High quality instead. The **Best** preset and the setup's "The church PC" choose it.
- **Church echo:** the sound of a church (small room, church or large church) instead of the synthesizer's reverb.
- **Sound preset:** Best (church PC), Balanced, Light (phone, old PC), Large church with organ, or Small room and clear.
  Each sets the instruments, church echo, quality and equaliser together; changing any of them makes it Custom.
- **Equaliser:** five bands (bass, low, middle, presence, treble, ±12 dB) with presets: Flat, Warm, Clear words,
  Small speakers, Big hall, Bass boost and Organ.
- **Sound quality** (Best or Lighter sample interpolation) and **Notes at once** (96–350): lower them on old PCs
  and phones that crackle.
  It is calculated in the app, so it costs no download.
- **Natural playing:** the melody (top note of each chord) sings out, the inner parts sit back and every note varies a
  little, instead of every note being struck equally hard. The timing is not changed, so the words stay in step.

To rebuild the sound pack: `node tools/build_hq_soundfont.mjs <SalamanderGrandPiano clone> <GrandOrgue demo folder>`
(details at the top of the script).

To rebuild after changing the MIDI files (put the numbered `.mid` files in `sources/hymn-midi/`):

```
pip install mido; npm i spessasynth_core                # once
python tools/build_hymn_music.py sources/hymn-midi     # verse/intro analysis → data/music/index.json + MIDI pack
node tools/build_hymn_soundfont.mjs path/to/GeneralUser-GS.sf2 sources/hymn-midi   # → data/music/hymnal.sf2
node tools/compress_soundfont.mjs data/music/hymnal.sf2 data/music/hymnal.sf3   # → the 4 MB file the app uses
python tools/build.py
```

[← Back to the README](../README.md)
