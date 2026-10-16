# SDA Sabbath — offline church presenter for SDA media teams

SDA Sabbath shows Bible passages, hymns, slides, videos, web pages and your PC screen on the projector
(the extended screen) while the operator prepares what comes next on the main screen. It is a
Progressive Web App: install it once and it runs with **no internet**, on old PCs and 1–2 GB phones.

```
┌ SDA Sabbath ─ ● Display: Projector ─ [ Go to… John 3:16 / hymn 73 ] ────── [▶ Present  F5 ] ┐
│ Bible  │                                                         │ ○ Next  (green)          │
│ Hymns  │   the selected tab's options for what goes on next      │ ● Live  (red)            │
│ Banners│                                                         │ Black · Logo · Clear     │
│ Slides │                                                         │                          │
│ Video  │                                                         │                          │
│ Web    │                                                         │                          │
│ PC view│                                                         │                          │
│ Plan   │                                                         │                          │
└────────┴─────── control bar while something is live (adapts to Bible / hymn / video …) ─────┘
```

Nothing reaches the projector until **Present** (F5 or Ctrl+Enter). Each tab keeps its own
“next” item, shown in the green **Next** monitor; the red **Live** monitor shows the projector.

## What each tab does

| Tab | What you can do |
|---|---|
| **Bible** | Type `John 3:16-18`, `Ps 23`, `Joh 3:16` (Afrikaans) or tap book → chapter → verses. KJV, WEB and the Afrikaans 1933/53 Bible are built in; add NIV, Xhosa or any licensed Bible. Two translations side by side (e.g. English + isiXhosa). Text grows to fill the screen; long passages split into readable slides automatically. “Keep reading” shows the next verses when the preacher carries on. Full-text search. |
| **Hymns** | Type the number or words. Title slide, one stanza per slide, chorus repeated automatically, choose which stanzas to sing (1, 2, 4). Jump to any stanza from the control bar. Edit or add hymns; import or export hymnbooks. |
| **Slides** | PDF, PowerPoint (.pptx) and pictures. Converted once on import and kept offline. Speaker notes shown to the operator. Auto-advance loop for announcements. |
| **Video** | VLC-style player: playlist with auto-next and repeat, speed 0.25×–4×, A-B repeat, loop, frame step, fade in/out, volume boost to 200 %, 10-band equaliser with presets, fit/fill/stretch, zoom, rotate, mirror, brightness/contrast/colour/hue, .srt/.vtt subtitles, snapshots. Music can play **in the background** while lyrics stay on screen. |
| **Web** | **Mirror a tab** — the projector shows exactly that browser tab, without the mouse pointer (scroll/zoom it from SDA Sabbath in Chrome). **Embed** — YouTube and embeddable sites load directly on the display. |
| **PC view** | Share the whole screen, one window (e.g. PowerPoint or a Bible app) or a tab; see it live inside SDA Sabbath. **Freeze** keeps the last picture up while you work privately. The **mini controller** floats on top of other programs. |
| **Plan** | Prepare the order of service at home (one-tap Divine Service, Sabbath School and Vespers templates), attach media to each part, drag parts into order, see progress and what is **On screen**, undo a removal, copy the order as text, export it, and step through it in church with **Next part** (it becomes Next; Present shows it). |
| **Banners** | Welcome, verse, announcement, offering (with giving QR code), countdown and Sabbath-sunset banners drawn live on the display; a self-running pre-service loop; key verses for the 28 Fundamental Beliefs and sermon topics. See [Banners](#banners). |
| **Settings** | Fonts (Atkinson Hyperlegible, serif), colours, background picture, logo, margins, text sizes, fade/cut, 4:3 projectors, light/dark theme, tabs left or right, low-power mode, backups, Bibles, church details, online AI. |

**Live translation** (sermon → captions in another language) is planned; the caption line is already
built into the display.

## Keyboard and clicker

| Key | Action |
|---|---|
| F5 · Ctrl+Enter | Present the Next item |
| → ↓ Page Down Space | Next verse / stanza / slide (Space plays/pauses a video) |
| ← ↑ Page Up | Previous |
| B or . | Black screen (press again to return) |
| L | Logo |
| Esc or C | Clear the screen |
| / or Ctrl+K | Go to a reference or hymn number |
| Alt+1 … Alt+9 | Switch tabs (Bible, Hymns, Banners, Slides, Video, Web, PC view, Plan, Tools) |
| F (on the projector window) | Full screen on/off |

Presentation clickers send Page Up / Page Down, so they work out of the box — even if the projector
window has focus.

## Getting started

### 1. Open the app and install it

The app is published from this repository to **https://leemcq.github.io/SDA_Sabbath/** by the
included GitHub Pages workflow (repository **Settings → Pages → Source: GitHub Actions**).

On each church PC or phone, open that address in Chrome or Edge and choose **Install**. Every
file (Bibles, hymns, fonts, PDF engine) downloads in one go; after that SDA Sabbath works offline.

### 2. Projector setup (PC)

1. Connect the projector as an **extended** display (Windows: Win+P → Extend).
2. Press **Present** once. In Chrome/Edge, allow **Window management** when asked — from then on
   the display opens straight onto the projector.
3. Click the projector screen once so videos may play with sound (not needed once SDA Sabbath is installed).

### 3. The SDA Sabbath companion (optional, recommended for the church PC)

One program (about 25 MB — most of it the hymn-music instrument sounds; no installer, no other software) that contains the whole app:

- **Windows:** download `selah-windows-x64.exe` from the [Releases page](https://github.com/LeeMcQ/SDA_Sabbath/releases/latest) and double-click it.
  SDA Sabbath opens at `http://localhost:7777`. To add Start-menu and desktop shortcuts in one go:

  ```powershell
  irm https://github.com/LeeMcQ/SDA_Sabbath/releases/latest/download/selah-windows-x64.exe -OutFile $env:TEMP\selah.exe; & $env:TEMP\selah.exe --install
  ```
- **Raspberry Pi / Linux / Mac:** `selah-linux-arm64`, `selah-linux-x64`, `selah-macos-arm64` — `chmod +x` and run.

What it adds:

| | |
|---|---|
| **Phone remote** | Phones on the church Wi-Fi open `http://<pc>:7777/remote` (or scan the QR code in Settings → Displays) and enter the PIN. |
| **TV or second PC as the screen** | Open `http://<pc>:7777/display` in the TV's browser. |
| **Videos from the PC** | Files in `Videos\Selah` appear in the Video tab on every device, and stream with seeking. |
| **Exact PowerPoint** | If LibreOffice is installed, .pptx files are converted to PDF so they look exactly as designed. Without it SDA Sabbath uses its built-in renderer (text, pictures, shapes, backgrounds). |

Options: `--port`, `--media <folder>`, `--pin <NNNN>`, `--no-browser`, `--install`. The PIN and folder
are remembered in `%APPDATA%\Selah\companion.txt`. Windows asks once to allow network access — allow
it for private networks.

### Casting to a TV or wireless display

- **Cast (Chromecast, Google TV, Android TV)** in the display menu uses the browser’s own casting. It only finds
  Google Cast devices. Most other TVs and projectors (Samsung, LG, Hisense, “Screen mirroring”) use **Miracast**,
  which a web page cannot reach, so they never appear in that list — on Android too.
- **Windows: Connect to a wireless display…** (display menu) opens the Windows Connect panel (also **Windows + K**,
  or Settings → System → Display → *Connect to a wireless display*). Pick the TV, choose **Extend** (Windows + P),
  and press **Present on the wireless display**: the TV is then a second screen with only the slides on it.
- **Android phones:** use the SDA Sabbath companion (the TV’s browser opens the companion address), or **Use this
  device as the screen** and then the phone’s *Smart View / Screen Cast / Screen mirroring*.
- While a display is connected, the **×** beside the display button stops it (Stop casting / Close the display
  window). The display menu also has **Cast to another device…**. Closing or reloading the app stops a cast and
  closes the display window; a cast TV that loses its controller goes black and ends the cast after a few seconds.

### Phones and tablets

Press **Present** and choose:
- **This device** — full screen on the phone itself (HDMI adapter or screen mirroring).
- **Cast** — Chromecast or a wireless display (Chrome on Android).
- **SDA Sabbath companion** — use the phone as a remote for the church PC or TV.

## Bibles

Built in (public domain): **KJV**, **WEB**, **Afrikaanse Bybel 1933/53**.
**NIV** (© Biblica) and the **1975 Xhosa Bible** (© Bible Society of South Africa) cannot be shipped
publicly. Each church adds its own licensed copy:

- **On one device:** Settings → Bibles & hymns → **Add a Bible** (Zefania XML, OSIS XML, JSON, CSV).
  The `xho75.json` file from Joy in the Journey imports directly.
- **For your whole installation:** drop the file into `licensed/` and run `python tools/build.py --bibles`
  (see `licensed/README.md`). The folder is git-ignored, so it never becomes public.

## Hymns

`data/hymns/sda-sample.json` holds sample hymns whose words are public domain, numbered as in the
1985 SDA Hymnal. Replace or add hymnbooks with **Hymns → ⋯ → Import a hymnbook**:

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

### Find lyrics online

**Hymns → ⋯ → Find lyrics online** searches public lyric sites (LRCLIB and Lyrics.ovh) for a title, a first line
or any words (add “by singer” to narrow it). Songs already on the device are shown first. Online results are
ranked with a match label and a preview, so you can pick the right one; if an AI key is set, **Ask AI to help
identify** can also suggest which songs the words belong to (the lyrics always come from the lyric sites, never
from AI). The chosen words are split into stanzas and a chorus (shown as the slides they will become), can be
corrected, and are kept **offline** in a book (Praise Choruses by default) with **Add and put on Next**.
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
  introduction or any verse, **Fade** and **Stop**. Volume, reverb and chorus are in **Hymns → ⚙ Hymn options**.
- **Phone as remote:** when a phone controls the church PC through the companion, the music plays on the PC (the
  display window). Open the display on the PC from `http://localhost:7777` — browsers only allow the synthesizer on
  `https://` or `localhost`. Click the projector window once at the start so it may play sound.
- 33 hymns (mostly the short responses 660–695) are through-composed, so they always play as recorded; 25 hymns have
  fewer verses of music than stanzas, so the verse music is repeated. Hymns 696–698 have no MIDI yet.

To rebuild after changing the MIDI files (put the numbered `.mid` files in `sources/hymn-midi/`):

```
pip install mido; npm i spessasynth_core                # once
python tools/build_hymn_music.py sources/hymn-midi     # verse/intro analysis → data/music/index.json + MIDI pack
node tools/build_hymn_soundfont.mjs path/to/GeneralUser-GS.sf2 sources/hymn-midi   # → data/music/hymnal.sf2
python tools/build.py
```

## Built for weak computers

- **No framework.** Plain JavaScript modules, about 0.3 MB in total; each tab loads only when first opened.
- **One book at a time.** Bibles are stored per book (~70 KB), not as 6 MB files; at most eight books sit in memory.
- **Render once.** PDF pages and pictures are converted when imported and cached; presenting never re-renders.
- **Hardware video.** Video uses the browser's built-in, usually hardware-accelerated decoders, which is far
  lighter than running VLC itself. The equaliser and volume boost switch on only when used.
- **Low-power mode** (automatic on ≤2 GB RAM or ≤2 cores): no fades, no live video thumbnail, slides at 1280 px,
  screen sharing at 15 fps.
- **Rust where it pays off.** The companion is written in Rust with no third-party crates: one program
  that serves the app, relays the phone remote over WebSockets, streams media and runs LibreOffice.

Measured in testing: before hymn music was added the whole app installed (262 files, 14 MB) in about 3 seconds on a LAN; it is now 276 files, 34 MB, and updates only download the files that changed; each window uses
about 8 MB of JavaScript memory; with the CPU slowed six times, a 24-verse passage is laid out in about
0.5 s and Present + Next takes about 0.4 s.

## Development

```
python tools/build.py              # update the offline file list (run before deploying)
python tools/build.py --bibles     # rebuild Bibles from ./sources (KJV, WEB, AFR from Joy in the Journey)
cd companion && cargo build --release
./companion/target/release/selah --app-dir .     # serve this folder live while editing
```

Any static web server also works (`python -m http.server`), but service workers and screen sharing need
`https://` or `http://localhost`.

```
index.html, display.html     control screen and projector output
css/                         app.css (control UI), stage.css (projector + monitors)
js/app.js                    tabs, Present, display menu, shortcuts, service worker
js/core/                     render (text fitting), live (Next/Live), link (display connections),
                             wire (network protocol), books (reference parser), bibledata, db, settings, ui
js/tabs/                     bible, hymns, banners (ai.js), slides, video, web, screen (PC view), plan, tools, settings
js/lib/                      pdf (pdf.js wrapper), pptx renderer, screen capture, subtitles
js/display/display.js        projector renderer (also used for "this device" and Cast)
data/bibles/<id>/            info.json + 01.json … 66.json per translation
data/hymns/                  hymnbooks
companion/                   Rust companion (std only); build.rs embeds the app
data/music/                  hymn MIDI pack, verse index, GeneralUser GS subset (hymnal.sf2)
js/core/musicengine.js       SoundFont player (SpessaSynth), arrangement of intro + sung stanzas
js/core/hymnmusic.js         music controller: this device, or the PC display when used as a remote
js/core/bannerframe.js       banner slides on the display (palettes, countdown, corner clock)
js/core/church.js            church details, Sabbath date and offline sunset times
js/core/ai.js                optional online AI (text, background pictures, model lists)
js/tabs/ai.js                Banners tab (make, saved, pre-service loop, topics, Ask AI)
js/tabs/ai-full.js           the “full banner” AI picture maker
js/core/lyrics.js            online lyrics finder: sources, ranking, stanza/chorus detection
data/topics/topics.json      key verses for the 28 Fundamental Beliefs and sermon topics
js/lib/smf.js                MIDI file reader/writer and section joining
vendor/spessasynth/          SpessaSynth (Apache 2.0)
tools/                       build.py, build_bibles.py, build_hymn_music.py, build_hymn_soundfont.mjs
```

## Credits and licences

- Bible texts: KJV and WEB (public domain), Afrikaanse Bybel 1933/53 — converted from the Joy in the Journey app
  (`github.com/LeeMcQ/joy-in-the-journey`).
- Sample hymn words: public domain.
- Fonts: Atkinson Hyperlegible Next and Source Serif 4 (SIL Open Font License).
- pdf.js (Apache 2.0), fflate (MIT), qrcode-generator (MIT), SpessaSynth (Apache 2.0).
- GeneralUser GS 2.0.3 SoundFont by S. Christian Collins — free to use and modify
  (`data/music/GeneralUser-GS-LICENSE.txt`, https://www.schristiancollins.com).
- Hymn MIDI files: supplied by the church for its own services.
- SDA Sabbath code: MIT.

## Service tools

The **Tools** tab (under More) adds:

- Stage / confidence monitor window (current + next item + timer)
- Lower thirds: **Set as Next** for the projector, or **Show on stream overlay** (a separate window for OBS)
- Service timer and countdown presets (5/10/20 min)
- Responsive readings (Leader / People in the accent colour) — click to put on Next, double-click to show at once
- Communion / Ordinance of Humility as one four-slide sequence: Present, then → for each step
- Streaming overlay window
- Experimental live captions via browser speech recognition, on the display's caption line over whatever is showing

Like every tab, Tools slides go to the green **Next** screen first; Present (F5) shows them.

Offering banners (verse + giving QR code) are in **Banners**. Children’s story templates were intentionally left out.

## Banners

Like every other tab, nothing in **Banners** reaches the projector until **Present**: buttons say **Set as Next**.

- **Make** — Welcome, Bible verse, Announcement, Tithe & offering, Countdown, Sabbath sunset, Closing blessing,
  Blank and Picture banners. Banners are drawn live on the display like Bible verses, so the text is sharp, fills
  the screen and fits 4:3 projectors too. The preview updates as you type.
  - **Filled in for you** from **Church details** (Settings → Church): church name, the coming Sabbath’s date,
    the sunset time (“Sabbath begins at sunset: 18:58”, worked out offline from the church’s location), the
    service time for the countdown and a **QR code for online giving** (https links only).
  - **Bible verse banners** take a reference (e.g. `Ps 23:1-3`) and fill in the text from any installed Bible.
  - **Look**: eight colour palettes chosen for readable contrast, patterns, text position, sans or serif, your
    logo, and **your own photos** as backgrounds (darkened automatically so text stays readable).
  - **Countdown** counts down to the service time on the display itself and shows “Welcome” at zero.
- **Saved** — your banners, kept in the app’s database (works offline): Set as Next, Edit, Rename, Duplicate,
  Delete, Add to plan, Add to loop. Banners made with the old Banner tab are moved here automatically.
- **Pre-service loop** — banners and announcement slide decks take turns every 5–30 seconds, with an optional
  “Service starts in 4:32” clock in the corner; when it is time, the loop can switch to your Welcome banner. The
  loop runs **on the display itself**, so it keeps going if the phone or PC that started it goes to sleep.
  Pause / resume from the bottom bar; Next / Previous move by hand.
- **Topics** — key Bible verses for the **28 Fundamental Beliefs** and about 40 sermon topics (prayer, hope, grace,
  health, children, mothers, Christmas, Easter …), shown from the Bible you choose (KJV, WEB, Afrikaans, or an
  imported NIV / Xhosa). Search in English or Afrikaans (“wederkoms”, “gebed”), type a reference, or any words to
  search the Bible. **Set all as Next** puts every verse on slides; **Banner** turns one verse into a banner;
  topics can be added to the service plan.

Service plans can link banners, the pre-service loop and topic verses (Plan → Link media → Banner or loop).

## Online AI (optional)

In **Settings → AI** choose a provider (OpenAI, Google Gemini, xAI Grok, Together AI, OpenRouter or Anthropic
Claude — text only), paste your key and press **Test key**: it shows the models your key can use and lets you
choose a text and a picture model (or leave both on Automatic). If a model is retired, SDA Sabbath picks a
current one by itself and remembers it.

- Banners → Make has **two AI picture makers**:
  1. **Make background** makes a **background picture without text**; the banner words stay sharp on top.
  2. **Make full banner…** makes **one finished picture with all your words in it** (church name, heading,
     message, bottom line, anything else) built around **pictures you attach** (a photo of the church, people, your
     logo). OpenAI (gpt-image) and Google Gemini accept attached pictures; other providers use the words only.
     AI can misspell, so the result is shown for checking and can be remade before you use it. The giving QR
     code is never drawn by AI (the app adds the real one on top).
  Pictures are saved on the device, so they work offline afterwards.
- **Ask AI** in Banners → Topics answers a question in **three slide-sized ways** (a short answer, an answer with
  the Bible’s own words, and key points). You choose one, edit it, optionally add an AI or own picture, and press
  Set as Next. Bible references are checked against the installed Bible and the verse shown is the Bible’s own text.
- **AI summary (online)** in Banners → Topics writes 2–3 short slides into edit boxes. Every Bible reference is
  checked against the installed Bible (✓ with the verse text, or a warning when it does not exist) and words
  worth a second look are pointed out. Nothing is shown until you press Set as Next and then Present.

Keys stay on this device only and are never included in backups. Everything else works without a key or internet.
