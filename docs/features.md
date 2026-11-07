# SDA Sabbath: full feature list

An offline church presenter for Seventh-day Adventist media teams. It is a Progressive Web App (installs from the browser, runs with no internet) with an optional free companion program and an optional offline live translator. Free, MIT-licensed, and independent of the sister app Church Service.

Status marks: **✔** built and tested · **◐** built, but not yet proven in real use (see the end of this list)

---

## 1. Core presenting

- **Present on a projector or TV**: shows on an extended screen; the operator prepares on the main screen.
- **Next / Live monitors**: green *Next* preview and red *Live* view. Nothing reaches the congregation until **Present** (F5 or Ctrl+Enter).
- **Go to… box**: type `John 3:16`, `Joh 3:16` (Afrikaans), `Ps 23` or `hymn 73` to jump straight there.
- **Black, Logo and Clear** buttons, **undo** (Ctrl+Z returns to the previous screen at the same slide), and a control bar that adapts to what is live (Bible, hymn, video…).
- **Stays full screen**: if the projector drops out of full screen, the next click or key press restores it. Can be turned off.
- **Small popup screen** in the corner of a phone or PC when no projector is connected.
- **Screen shapes**: 16:9 and 4:3 projectors, and several screens.
- **Casting**: Chromecast, Google TV, Android TV; Miracast TVs through Windows (Win + K).
- **TV or second PC as the screen** through the companion (`/display`).
- **Mobile layout**: the phone layout puts the controls at the bottom and the Bible and hymn lists above.

## 2. Bible

- **Built-in Bibles**: King James and World English Bible (public domain). Licensed Bibles, such as the Afrikaans 1933/53, are added by each church.
- **Add more**: any licensed Bible (NIV, ESV, NKJV, 1975 Xhosa…) from a file (Zefania, OSIS, CES, JSON, CSV), or from three online sources (bible.helloao.org, getBible and a ~100-language Bible corpus). Licensed Bibles can also be built into one installation without ever becoming public.
- **Smart reference entry**: `John 3:16-18`, `Ps 23`, English or Afrikaans book names.
- **Two translations side by side**, for example English and isiXhosa.
- **Auto-fit text** that fills the screen; long passages split into readable slides automatically.
- **Keep reading**: shows the next verses when the preacher carries on.
- **Full-text search**.
- **Verse-number row**: any verse is one tap away, and the list keeps the live verse in view.
- **Keys 1–9** select a verse as Next.
- **Verse banners** with the text filled in from any installed Bible.

## 3. Hymns and choruses

- **Own screen look for Bible and hymns**: Bible → ⋯ (Bible on screen) and Hymns → options each have *Use an own look*: font, weight, text and number colours, background colour, shadow, alignment, margin, smallest and largest text (and hymn word size), with a live preview. Everything else keeps the Settings → Screen look.
- **Built-in books**: 1941 Church Hymnal (703, with words); Advent Lofliedere in Afrikaans (481, with words and, for about 150, the SDA Hymnal tune); SDA Hymnal 1985 (698, with words and 695 tunes, included with the owners' permission); **Import licensed words** adds a church's own licensed words for the songs that have none (Shared Hymns).
- **Shared Hymns in every language**: one book per language (English, Afrikaans, isiXhosa …), added for the church's service languages in the setup. English holds the praise choruses and Malmesbury Praise (101–148). **New song** asks the language first and gives the next number; **Share with all churches** sends it for approval, and every church with that language gets it (501 and up). The monthly report highlights new shared hymns.
- **Find by number or words**.
- **Title slide, one stanza per slide**, chorus repeated automatically.
- **Choose which stanzas to sing** (for example 1, 2, 4).
- **Jump to any stanza** while the hymn is on screen.
- **Add a hymnbook**, the same way as Add a Bible: search the list and press **Add**, and it downloads once and works offline. SDA hymnals in 26 languages from the [rejnac collection](https://github.com/rejnac/compiled-hymnal) (isiXhosa, isiZulu/Ndebele, Sesotho, Setswana, Sepedi, Shona, Tshivenda, Xitsonga, Chichewa, Tonga, Icibemba, Tumbuka, Swahili, Kinyarwanda, Kikuyu, Kamba, Kalenjin, Dholuo, Ekegusii, Maasai, Twi, French, Portuguese, Spanish, Russian and English), the **SID Hymnal** (English, isiXhosa and Setswana with the same numbers) and early Adventist hymnals (Hymns for God's Peculiar People, 1849). The English SDA Hymnal words also fill in the built-in SDA Hymnal, so those hymns keep their offline music. Also from a file: VideoPsalm songbooks (`.vpc` or `.json`), SDA Sabbath hymnbooks and text. In Hymns → More and in Settings → Bibles & hymns (which lists every hymnbook, with Remove).
- **Edit or add hymns**; export hymnbooks.
- **Lyrics search online** (when connected).

## 4. Hymn music (offline)

- **Plays the hymn accompaniment** from MIDI files through a SoundFont synthesizer, fully offline.
- **Three instrument quality levels**: standard (GeneralUser GS), High-quality (Salamander piano and pipe organ), and **Studio** (the largest pack, about 83 MB, optional download).
- **Sound presets**: Best (church PC), Balanced, Light (phone or old PC), Large church / organ, and Small room / clear.
- **Adjustable live**: room reverb (small, medium, large, church), reverb and chorus levels, interpolation, voice count, natural-sound option.
- **Equaliser** with presets.
- **Tempo and playback controls**; M key to play or pause.
- **Setup recommends settings** for the device (church PC, laptop, phone), hall size and what the music is heard through (sound desk, small speakers, TV), with a *Play a test* button.
- **Music inside the display window** when a phone controls the church PC, so the sound comes from the PC.

## 5. Slides

- **Import PDF, PowerPoint (.pptx) and pictures**, converted once and kept offline.
- **Speaker notes** are shown to the operator and on the stage screen.
- **Auto-advance loop** for announcements.
- **Google Slides links** download as offline slides, and *Update from Google Slides* refreshes them (needs the cloud setup).
- **Exact PowerPoint rendering** through the companion when LibreOffice is installed.

## 6. Video and audio

- **VLC-style player**: playlist with auto-next and repeat, speed 0.25×–4×, A–B repeat, loop, frame step, fade in/out.
- **Volume boost to 200 %** and a **10-band equaliser** with presets.
- **Picture controls**: fit / fill / stretch, zoom, rotate, mirror, brightness, contrast, colour and hue.
- **Subtitles** (.srt, .vtt) and **snapshots**.
- **Background music** keeps playing while lyrics stay on screen.
- **Videos from the PC**: the companion serves the *Videos\SDA Sabbath* folder to every device, with seeking.

## 7. Web page and PC screen

- **Mirror a browser tab** (without the mouse pointer) or **embed** YouTube and other embeddable sites.
- **Share the whole screen, one window (such as PowerPoint) or a tab**, viewed live inside the app.
- **Freeze** keeps the last picture up while you work privately.
- **Mini controller** floats on top of other programs.

## 8. Banners and music

- **Banner types**: Welcome, Bible verse, Announcement, Tithe and offering (with a real giving QR code), Countdown, Sabbath sunset, Title (large words in the centre), Blank and Picture.
- **Filled in from your church details**: church name, the coming Sabbath's date, sunset time (worked out offline from the church's location) and service time.
- **Look**: eight readable colour palettes, patterns, **Advent Sans** (the church typeface), serif or clear sans, your church's own logo or a neutral open-Bible mark, and your own photos as backgrounds (darkened automatically for readable text).
- **Google-Slides-style editor**:
  - Insert text boxes, pictures (upload, paste, drag), 27 shapes, lines and arrows.
  - Self-filling fields: `{date}`, `{sunset}`, `{church}`, `{town}`, `{service}`, `{today}`.
  - Move, resize, rotate, snap guides, multi-select, arrow-key nudge.
  - Text formatting: 22 fonts, size, bold, italic, underline, colours, spacing, lists, shadow and outline, autofit.
  - Fill and border options.
- **Saved banners**: set as Next, edit, rename, duplicate, delete, add to plan or loop.
- **Pre-service loop**: banners and announcement decks take turns every 5–30 seconds, with a "Service starts in 4:32" clock, switching to your Welcome banner at service time. It runs on the display itself, so it keeps going if the controlling device sleeps.
- **Topics**: key verses for the **28 Fundamental Beliefs** and about 40 sermon topics, searchable in English or Afrikaans.
- **Banner music**: background music that starts with the banners and fades out when something else goes on screen.
- **Optional online AI** for background pictures and full banners (OpenAI, Gemini, Grok, Together, OpenRouter, Claude for text). Results are always shown for checking first, and the picture is saved for offline use.

## 9. Service plan

- **Basic mode** (default, for the volunteer at the desk): the order of service with a **Show** button per part, and three big buttons: **Back, Next, Blank**. Next steps through the slides, then on to the next part.
- **Advanced mode**: full plan editor with first-slide thumbnails.
- **Ready-made templates**: Divine Service, Sabbath School, Vespers / AY, Communion, Prayer Meeting, Thirteenth Sabbath, Baptism, Child Dedication, Pathfinder / Adventurer Investiture, Week of Prayer, with suggested roles.
- **Your own templates**: save a plan (with or without its hymns and readings), and set it as the default.
- **Smart Add box**: type "hymn 73", "Amazing grace" or "John 3:16-18" and pick a suggestion.
- **Add media**: Bible ranges and chapters, hymns and choruses, slides, video, banners, web pages.
- **Per-part tools**: attach or change media, rename, add who leads, drag to reorder, planned time (starts the stage countdown), progress and "On screen" marks, undo removal.
- **Share and export**: copy as text, export to Word, save or share as a `.sdaplan` file (with its slides, pictures, banners and videos), share templates, and open a shared plan or template on another device.

## 10. Control: keyboard, clicker, phone

- **Full shortcut set**: F5, arrows, Page Up / Down, Home / End, B / . / W for black, L for logo, C or Esc twice for clear, / or Ctrl+K to go to, 1–9 to pick a verse or stanza, Alt+1…9 for tabs, ? for help.
- **Presentation clickers work out of the box** (Logitech, Targus, Norwii…), including from inside search boxes and on the projector window, and in mouse mode.
- **Clicker setup and test** shows what each button sends and lets you **teach** any button.
- **Phone remote** through the companion: PIN-protected, with a QR code.
- **Mini controller** over other programs.
- **Stream Deck-style buttons** for the stage and OBS controls.

## 11. Stage screen (for the platform)

- **Confidence monitor** that the congregation never sees: current slide, next slide, speaker notes, clock, timers, messages and the order of service.
- **Layouts**: Full, Words (very large type), Slides, Timer, with text size, 12/24-hour clock and **mirror** for teleprompter glass.
- **Timers**: Speaker countdown, Service stopwatch, up to 8 countdowns, stopwatches and "ends at…" clocks. The featured timer turns green → amber → red and counts overtime.
- **Messages from the desk** ("5 minutes left"), with optional flashing and a chime, and a quick-message list you can edit.
- **Talk back**: stage screens send quick replies ("Ready", "Microphone problem…") to the media desk.
- **Connect any way**: another monitor, Cast, phones and laptops by QR code or short room code (no app, no account), or the church network through the companion.
- **Private and secure**: slides go peer-to-peer, encrypted; no server sees them. Only the real media desk is followed (key fingerprint checked), so someone with only the room code cannot show fake slides.
- **Optional control from the stage** with a PIN, per-device permission, and limited PIN tries.

## 12. Live stream (OBS)

- **Lower thirds** that show the Bible verse or hymn words automatically when they go on screen (hymn verses change along the bottom of the stream as the verse changes), fully customisable (colours, position, height, size, letters), plus names, titles, announcements, a ticker and the church logo.
- **Slides as a full-screen Presentation source**, with an option for text over the camera.
- **One-click OBS set-up** over WebSocket (OBS 28+).
- **Automatic scene switching**: slides, banners and pictures go to the Presentation scene; Bible, hymns and black go back to the camera scene.
- **Start / stop streaming and recording** with a pre-flight check, stream health, and a red ● LIVE / ● REC mark in the top bar.
- **OBS on another computer** through the companion or an HDMI capture card, or by hand with a copied address.
- **Names of today's plan leaders** are one click away for lower thirds.

## 13. Listen & Translate

### Listen for verses and hymns
- Offers Bible verses and hymns mentioned in the service as cards ("John three sixteen", "hymn 100", "let us sing Great Is Thy Faithfulness").
- Follows the singing and offers the stanza being sung.
- **Nothing goes on screen by itself.**
- **Hear with**: the offline translator, the browser (Chrome or Edge, online), or Automatic.

### Live translation: Afrikaans sermon → English captions (offline)
- **Runs on the church PC** with no internet and no subscription. It is a separate program (Windows installer or zip).
- **Pipeline**: sound desk → cut at pauses → Afrikaans speech recognition (Fluister) → Bible-quote check → Adventist words → English (OPUS-MT) → caption line.
- **Exact Bible quotes**: when the church has installed its licensed Afrikaans 1933/53, a sentence that matches a verse comes out as the English verse itself, with its reference (World English Bible, or KJV).
- **Adventist vocabulary**: Sabbath, Spirit of Prophecy, Second Coming, sanctuary, investigative judgment and more, from an editable word list.
- **Never-translate dictionary**: names, towns, surnames and words like Amen, Maranata and braai stay as spoken. Your own names are added from the app, and the church name and town are included automatically.
- **South African and Kaaps slang** is turned into standard Afrikaans before translating; filler words are dropped.
- **Junk filtering**: music and silence are cut; known phantom lines are dropped.
- **Falls back to a lighter mode** if it gets behind, then returns to full accuracy.
- **Windows installer** (about 75 MB, no administrator rights) with desktop and Start-menu shortcuts.
- **Step-by-step first-run setup** with eight checks, each shown as ✔, ! or ✘: program parts, Bibles and word list, translation model, PC speed, speech model, speech recognition, translation quality and sound input.
- **PC speed test** that recommends the most accurate speech model that keeps up live (★), and lets you choose another.
- **50-sentence quality test** (Adventist terms, names, slang, mixed English, sermon lines, Bible quotes) with a report.
- **Simple Live translation page**: on/off, status, sound meter, Start / Stop, sound input, speech model, the list of sentences, a **Check each part** button (including a test caption on the screen), and all other settings under *Settings*. Every explanation sits behind an (i) icon.
- **Captions** on the display, with how long they stay and whether to show them.
- **English on phones**: a QR slide lets people read the translation on their own phones, with bigger text and optional Afrikaans underneath. Phones receive the translation only, never controls.
- **Optional improvement** (free, on Colab): fine-tune the translation on Bible verse pairs, and recognition on your pastor's voice.
- **Private**: nothing is sent anywhere; only SDA Sabbath's own addresses may talk to it.

## 14. Seventh-day Adventist identity

- **Logo slide** with your church's logo (or a neutral mark), church name, conference and union, with "Happy Sabbath" (or "Geseënde Sabbat" in Afrikaans) from Friday sunset to Sabbath sunset, and a greeting when the Sabbath ends.
- **Sabbath times worked out offline** from the church's location.
- **Advent Sans** typeface and the Adventist design toolkit, colours and logos.
- **The top bar greets the media team** according to the time of the week.
- **Service types** built in: Sabbath School, Divine Service, Vespers / AY, Communion, 13th Sabbath, Baptism, Child Dedication, Investiture, Week of Prayer.

## 15. Offline safety

- **Everything stored on install**: Bibles, hymns, music, fonts and the PDF engine; the build refuses anything that would load from the internet.
- **Readiness badge**: ✔ Ready offline, Saving… %, ⚠ files missing, Update ready, with a self-check panel.
- **Self-repair** every 30 minutes and whenever the internet returns.
- **Updates that cannot half-happen**: a new version downloads completely first; a broken update is refused and the working version stays.
- **No updates during the Sabbath**: held from Friday midday to Saturday night and whenever something is on screen.
- **Protected storage** so the browser never clears the data.
- **Protection from bad networks**: Wi-Fi login pages are never stored; downloads time out instead of hanging; first visit is quick on 3G.
- **Failures are contained**: one broken tab shows *Try again / Repair*, and every other tab keeps working. A help page replaces a blank screen.
- **Emergency USB copy**: the companion program plus a backup on a USB stick runs on any PC with no internet.
- **Friday-evening two-minute check** is documented.
- **Automatic tests on every deploy**: the offline test, 38 browser smoke tests, and translator tests. A failing test stops the deploy and the site keeps the last good version.

## 16. Companion program (optional, free)

- **One file (about 25 MB)** with the whole app inside: Windows, Linux (x64 and arm64, including Raspberry Pi) and macOS.
- Runs at `http://localhost:7777`; can install Start-menu and desktop shortcuts.
- **Adds**: phone remote with PIN, TV or second PC as screen, videos from a PC folder, exact PowerPoint through LibreOffice, OBS over the church network and stage screens without internet.
- **Security**: only its own pages can use it without the PIN; protection against outside websites and DNS-rebinding; slides are cleaned before they are drawn on other screens.
- **Options**: `--port`, `--media`, `--pin`, `--no-browser`, `--install`.
- Does not interfere with the Church Service companion on the same PC.

## 17. Backup and moving devices

- **Back up** settings, plans and templates, hymnbooks, added Bibles, banners and their pictures, and banner music; optionally slides and videos.
- **Two ways**: Google Drive (folder *SDA Sabbath backup*, only files the app created) or a `.sdabackup` file (USB, OneDrive, WhatsApp).
- **Restore on another device**; the first-start setup also offers it.
- **Backup reminders**.
- An AI key is never included.

## 18. Setup, settings and help

- **First-start setup**: **install on this device** first, then church details with the **service languages** (English by default plus up to two more, from every language in the hymnbook and Bible download lists), screens, hymn music, **Bibles and hymns for your languages** (one Bible and one hymnbook per language proposed and downloaded once, so the church's languages are ready offline from the first Sabbath; the main language opens first and the second language's Bible goes side by side), and **Ready for Sabbath** (saved offline, protect data, clicker test). Can be run again.
- **Settings**: fonts (Atkinson Hyperlegible, serif), colours, background picture, logo, margins, text sizes, text shadow and outline, fade or cut, 4:3, light and dark theme, tabs on the left or right, low-power mode, displays, hymn sound options, backup, Bibles and hymns, church details, AI, offline, updates, version details for problem reports, reset.
- **Low-power mode** and tuning for 1–2 GB phones and old PCs.
- **Languages**: English and Afrikaans (Bible and greetings); service in English, Afrikaans or both.
- **Install prompts** for every browser, with the right steps for iPhone, iPad and Mac Safari.
- **Shortcuts** from the installed icon: Bible, Hymns, Service plan, Stage, Join a stage screen. Opens PDFs, pictures and PowerPoint files directly from the desktop.

## 19. Accounts, statistics and feedback (optional, maintainer-run)

- **Email-code or Google sign-in** (free Supabase project).
- **Usage statistics for the maintainer** (`admin.html`): devices, active churches, hours used, features used, versions, screen layouts.
- **Comments and suggestions** from inside the app and `feedback.html`, with replies.
- **Privacy and terms pages.**
- The app works fully without any of this.

## 20. Quality and engineering

- **Offline-first PWA** with service-worker versioning and file fingerprints.
- **Automated GitHub Pages deploy**, gated by tests.
- **Free technology only**: all models and libraries are free licences (MIT, Apache 2.0, CC BY).
- **Independent of Church Service**: separate repository, storage and companion.

---

## Not yet proven in real use ◐

- **Live translation accuracy and speed**: the real speech and translation models have not yet run, because my workspace could not reach the model host. Only the preparation, word lists, the app, the page and the installer's build checks were tested. A first run on the church PC (with `quality/report.md`) gives the real numbers.
- **The Windows translator installer on a real PC**: the build and its checks pass on GitHub, but a first install with the model downloads is untested. Windows will warn because the installer is not signed (*More info → Run anyway*).
- **Cloud features** (accounts, statistics, Google Drive, Google Slides) need the maintainer's one-time setup before they work.
