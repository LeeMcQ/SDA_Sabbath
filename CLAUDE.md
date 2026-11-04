# SDA Sabbath — notes for Claude

Offline church presenter for Seventh-day Adventist media teams (Bible, hymns, slides, video, banners, plans, stage
screen, OBS, live translation). A PWA on GitHub Pages: https://leemcq.github.io/SDA_Sabbath/. Maintainer: Leo
(LeeMcQ). Users are church volunteers on old PCs and phones, often with no internet on Sabbath.

## Working rules

- **Look before reading.** Big files: `js/tabs/ai.js` (1800 lines), `slide-editor.js`, `plan.js`, `hymns.js` (1200 each).
  Grep for the function you need and read that part; don't read whole files.
- **Offline first.** Nothing may need the internet to present. Online features (downloads, AI, cloud, lyrics search)
  are optional and only run when the person asks. No CDNs: every script is in the repo (`vendor/`); `index.html`'s CSP
  only allows `script-src 'self'`.
- **Plain JavaScript modules**, no framework, no bundler. Build DOM with `h()` from `js/core/util.js`; dialogs, toasts,
  menus from `js/core/ui.js`. Lazy-load rarely used modules with `import()`.
- **Old browsers:** no regex lookbehind (older iPad Safari fails to load the whole module). Keep code that runs on
  1–2 GB phones light.
- **Copyright:** never ship copyrighted Bible or hymn words. They come from downloads the church chooses (with a licence
  note) or from the church's own file. SDA Hymnal 1985 and Advent Lofliedere are built in as numbers and titles only.
- **Independent apps:** SDA_Sabbath and Church_Service (LeeMcQ/Church_Service) are separate. Change only this repo unless
  Leo asks to port something.
- **Words in the app:** short plain English for volunteers ("Download now", "On this device ✓"), no jargon.
- **Every fix gets a regression test** in `tests/smoke.py`.

## Build, test, deploy

```
python tools/build.py          # ALWAYS before committing: lists files in asset-manifest.json, stamps sw.js and js/app.js BUILD
python tests/smoke.py          # ~45 Playwright checks, ~5 min
python tests/offline.py        # 17 offline checks, ~3 min
```
- Needs `pip install playwright` + Chromium. In Claude's cloud workspace `playwright install` fails: launch with
  `executable_path='/usr/bin/google-chrome'` (wrap `BrowserType.launch` in a small runner script).
- Tests mock the internet with `ctx.route('https://raw.githubusercontent.com/**', …)`; the main context blocks service
  workers. `window.selah` is the app context (`selah.tab('hymns')`, `selah.showTab(id)`, `selah.settings`).
- **Deploy = push to `main`.** `.github/workflows/pages.yml` runs build + both test suites and only publishes if they pass.
  Leo's flow: branch → pull request → merge. In Claude sessions `gh pr create` fails (GraphQL blocked): use
  `gh api repos/LeeMcQ/SDA_Sabbath/pulls --method POST …` and `…/pulls/N/merge --method PUT`.
- Don't wait on the deploy unless asked; GitHub reports a failed deploy.
- `MIN_APP_VERSION` in `tools/build.py` refuses an old `js/app.js` (another tool once overwrote newer work).

## Where things are

```
index.html / js/app.js        control screen: tabs, Present, display menu, shortcuts, service worker, install prompt
display.html, js/display/     projector output        stage.html, js/stage-main.js   stage screen
js/tabs/*.js                  one module per tab: bible, hymns, ai (Banners & Music), slides, video, web, plan, tools, settings
js/tabs/welcome.js            first-start setup: sign-in, install, church + languages, screens, sound,
                              "Bibles and hymns for your languages" (downloads), ready, stats
js/tabs/bible-import.js       Add a Bible dialog       js/tabs/hymn-import.js   Add a hymnbook dialog (+ fillBuiltInWords)
js/core/settings.js           DEFAULTS (add new settings here), serviceLang()
js/core/db.js                 IndexedDB stores: kv, files, renders, bibles, hymnbooks, plans
js/core/bibledata.js          Bible files: parseBibleFile, saveImported, listTranslations
js/core/biblesources.js       Bible downloads: helloao (live list), getBible, Bible corpus, eBible corpus; addBible()
js/core/hymnparse.js          hymnbook formats (own JSON, Liedboek, text, VideoPsalm .vpc/.json, SID markdown, Hymnals Data)
js/core/hymnsources.js        hymnbook download list (rejnac 26 languages, SID Hymnal, Hymnals Data); downloadHymnal()
js/core/langs.js              languages for the setup (joins hymn and Bible lists); langsearch.js: language search
js/core/hymnmusic.js, musicengine.js   offline MIDI hymn music (SoundFont); music is keyed to book 'sda-online'
data/hymns/index.json         built-in hymnbooks       data/bibles/   built-in Bibles (KJV, WEB)
companion/                    Rust companion (std only)          translator/   offline Afrikaans→English translator
docs/                         user docs; docs/features.md is the full feature list
```
- Events on `window`: `selah-bibles` (Bible list changed), `selah-hymnbooks` (hymnbooks changed; `detail.select` opens one).
- Words for a built-in numbers-and-titles book are an overlay record `overlay:<book id>` in the `hymnbooks` store.

## When a feature changes

Update the docs that describe it: `docs/*.md` (usually `bibles-and-hymns.md`, `getting-started.md`, `features.md`) and the
README table. The claude.ai project doc `claude/features.md` mirrors `docs/features.md`.
