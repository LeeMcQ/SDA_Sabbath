# Licensed Bibles (kept private)

Put Bible files your church is licensed to use here — for example the NIV, or the 1975 Xhosa
Bible (`xho75.json` from the Joy in the Journey app). This folder is git-ignored, so the files
never reach a public repository.

Then run:

```
python tools/build.py --bibles
```

They are converted into `data/bibles-private/` (also git-ignored) and become part of **your**
installation: they download with the rest of the app and work offline, on every device that
installs SDA Sabbath from your own PC or companion.

Optional: add `<name>.meta.json` next to a file to set its labels, e.g. `xho75.meta.json`:

```json
{ "id": "xho75", "abbr": "XHO", "name": "IZibhalo Ezingcwele 1975", "lang": "xh",
  "license": "© 1975 Bible Society of South Africa — used with permission" }
```

**Afrikaans 1933/53 Bible.** It is © Bybelgenootskap van Suid-Afrika 1933, 1953 and is no longer part of the
public app. If your church has the Bible Society's permission (copyright@biblesociety.co.za), put your copy here
as `afr53.json` with this `afr53.meta.json`, then run the build. Keeping the id `afr53` means the Afrikaans
settings, the live translator's Bible quotes and older service plans find it again:

```json
{ "id": "afr53", "abbr": "AFR", "name": "Afrikaanse Bybel 1933/53", "lang": "af", "titles": true,
  "license": "© Bybelgenootskap van Suid-Afrika 1933, 1953 — used with permission" }
```

For the live translator on the church PC, copy the built `data/bibles-private/afr53` folder into the
translator's `licensed/` folder.

`lang` (`en`, `af` or `xh`) decides the book names shown (John / Johannes / Yohane).

Supported formats: Zefania XML, JSON (Joy in the Journey flat or nested, thiagobodruk),
CSV/TSV (`book, chapter, verse, text`). Inside the app, **Settings → Bibles & hymns → Add a
Bible** also accepts OSIS XML and stores the Bible on that one device only.
