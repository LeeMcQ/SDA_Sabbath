# SDA Sabbath — offline church presenter for SDA media teams

SDA Sabbath shows Bible passages, hymns, slides, videos, web pages and your PC screen on the projector
(the extended screen) while the operator prepares what comes next on the main screen. It is a
Progressive Web App: install it once and it runs with **no internet**, on old PCs and 1–2 GB phones.

```
┌ SDA Sabbath ─ ● Display: Projector ─ [ Go to… John 3:16 / hymn 73 ] ────── [▶ Present  F5 ] ┐
│ Bible  │                                                         │ ○ Next  (green)          │
│ Hymns  │   the selected tab's options for what goes on next      │ ● Live  (red)            │
│ Slides │                                                         │ Black · Logo · Clear     │
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
| **Plan** | Prepare the order of service at home (Divine Service, Sabbath School and Vespers templates), export it, and step through it in church with **Next item**. |
| **Settings** | Fonts (Atkinson Hyperlegible, serif), colours, background picture, logo, margins, text sizes, fade/cut, 4:3 projectors, light/dark theme, tabs left or right, low-power mode, backups, Bibles. |

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
| Alt+1 … Alt+7 | Switch tabs |
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
js/tabs/                     bible, hymns, slides, video, web, screen (PC view), plan, settings
js/lib/                      pdf (pdf.js wrapper), pptx renderer, screen capture, subtitles
js/display/display.js        projector renderer (also used for "this device" and Cast)
data/bibles/<id>/            info.json + 01.json … 66.json per translation
data/hymns/                  hymnbooks
companion/                   Rust companion (std only); build.rs embeds the app
data/music/                  hymn MIDI pack, verse index, GeneralUser GS subset (hymnal.sf2)
js/core/musicengine.js       SoundFont player (SpessaSynth), arrangement of intro + sung stanzas
js/core/hymnmusic.js         music controller: this device, or the PC display when used as a remote
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

## Service tools (new)

The **Tools** tab (under More) adds:

- Stage / confidence monitor window (current + next item + timer)
- Lower-third / overlay window suitable for OBS browser source
- Service timer and countdown presets (5/10/20 min)
- Responsive readings
- Communion / Ordinance of Humility step-through slides
- Offering and tithe graphics
- Streaming overlay window
- Experimental live captions via browser speech recognition

Children’s story templates were intentionally left out.

## AI tab

The **AI** tab (under More) adds two on-the-spot helpers:

### Banner / Screensaver
Choose from predefined master styles (Sabbath Welcome, Verse of the Day, Event, Offering, Closing). Edit a few fields and generate a full-screen banner. Fully offline.

### Quick Research
Type a topic (Sabbath, prayer, baptism, communion, second coming, creation, tithe). The app produces a short, easy-to-read, child-friendly summary on 1–2 slides. Inappropriate topics are blocked. You can also paste your own short summary.

Both can be presented immediately to the projector.

## Online AI

In **Settings → AI** you can add an API key for OpenAI, Google Gemini, or Anthropic Claude.

- **AI image (online)** — uses OpenAI DALL-E to generate a beautiful banner from the master prompt + your fields.
- **AI research (online)** — asks the selected LLM for a short, child-safe summary on 1–2 slides.

Keys stay on this device only. Offline modes still work without a key.

## AI provider selection

Settings → AI now has a dropdown of providers that support text and images:

- OpenAI (text + DALL-E)
- Google Gemini (text + Imagen)
- xAI Grok (text + images)
- Together AI (text + Flux)
- OpenRouter (many models)
- Anthropic Claude (text only, excellent research)

Selecting a provider shows instructions and a link to get a key. The key stays on this device.
