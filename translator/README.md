# Live translation: Afrikaans sermon → English captions (offline)

A small program that runs on the church PC next to SDA Sabbath. It listens to the sound desk, writes down the
Afrikaans sermon and shows English captions on the screen, with no internet and no subscription.

```
Sound desk ─► cut at pauses ─► Afrikaans speech → text ─► Bible quote?  yes ─► the English verse itself
              (Silero VAD)     (Fluister: Afrikaans                       no  ─► Adventist words ─► English
                                Whisper, 8-bit)                                   (OPUS-MT af-en, 8-bit)
                                                   ─► SDA Sabbath: caption line, "Set as Next" suggestions
```

## Why it is built this way

| Choice | Reason |
|---|---|
| **Fluister** (Whisper trained further on Afrikaans, MIT) | Standard Whisper is weak in Afrikaans and drifts into Dutch spellings. Fluister turbo reports 8.6 % word errors on the NCHLT Afrikaans test. |
| **Two steps** (Afrikaans text, then English) | Whisper turbo cannot translate, and the model that can (large) is too slow without a graphics card. Two steps also allow the Bible and the word list in between. |
| **OPUS-MT af-en** (Apache 2.0) | Small and fast, with Bible text in its training data. One runtime (CTranslate2) runs both models in 8-bit. |
| **Cut at pauses, whole sentences** | Each second of audio is recognised once. Captions do not change after they appear. |
| **Python + CTranslate2, not Rust** | The work is the models' maths, which is already optimised C++. A Rust wrapper would gain about 1–2 %, and it would make the Afrikaans models much harder to swap or improve. |
| **Free** | MIT, Apache 2.0 and CC BY models. Nothing is sent anywhere. |

## Accuracy for Adventist preaching

- **Bible quotes come out exact.** When a sentence matches a verse of the Afrikaans 1933/53 Bible, the caption is the English verse itself with its reference:
  - World English Bible, with "the LORD" as in its LORD editions;
  - or King James.
- **Adventist words are kept right.** [`glossary.json`](glossary.json) steers recognition and fixes translation: Sabbath, Sabbath School, Spirit of Prophecy, Second Coming, investigative judgment, three angels' messages, and more. Edit it freely, for example to add your pastor's and church's names.
- **The operator gets suggestions, not surprises.**
  - "Johannes drie vers sestien" offers **John 3:16 · Set as Next**.
  - "gesang nommer honderd" offers **hymn 100**.
  - Nothing reaches the screen without the operator.
- **Junk is filtered out.** Organ music and silence are cut out before recognition, and Whisper's known phantom lines ("Teksting deur…") are dropped.
- **It speeds up when it falls behind.** If more than two pieces are waiting, it switches to a lighter search until it catches up, then returns to full accuracy.

## Install (once, with internet): one double-click

1. In SDA Sabbath: **Tools → Listen & Translate → Download for Windows**. Unzip it on the church PC, for example into Documents.
2. Double-click **`start-translator.bat`**. If Windows warns, choose *More info → Run anyway*.
   - The first time, it does everything by itself, in about 15 minutes. **No Python install is needed.**
   - It fetches its own Python, installs the translator and downloads the Afrikaans models.
   - It **measures this PC** and chooses the most accurate model the PC can run live.
   - It runs the **quality test** and shows the score.
   - It finds the sound-desk input.
   - It puts a **desktop shortcut** on the PC, and can start by itself with Windows.
3. Back in SDA Sabbath, switch **Live translation** on and press **Start listening**.
   - The browser may ask to allow access to devices on the local network. Allow it.

After that, it works without internet: just use the shortcut. Take the sound from the sound desk (aux or USB), not a microphone in the room. This matters more than anything else.

## Words never translated, and South African Afrikaans

All of these are in [`glossary.json`](glossary.json). Open it with Notepad to add your own.

| List | What it does | Examples |
|---|---|---|
| `keep` | **Never translated**, written exactly as said. Matched with the same capitals, so the name *Swart* is kept but *swart* (black) is translated. | Amen, Maranata, Malmesbury, Riebeek-Kasteel, Van der Merwe, De Wet, Fortuin, Koopman, braai, bakkie |
| `terms` / `terms_exact` | Always this English | Sabbat → Sabbath, Gees van die Profesie → Spirit of Prophecy, die Here → the Lord (but *dames en here* stays "ladies and gentlemen") |
| `slang` | Everyday and Kaaps Afrikaans made standard before translating | djy → jy, hie → hier, issie → is nie, laaities → kinders, nou-nou → binnekort, tjommie → vriend, ek's → ek is |
| `fillers` | Left out: they add nothing in English | mos, nè, nogal |

**Names from SDA Sabbath are added by themselves.** Use *Tools → Listen & Translate → Never translate* (one per line: pastor, elders, speakers). The church name and town from *Settings → Church* are added too.

Kept words and terms are swapped for number markers while translating, because the model copies numbers exactly. If a marker gets lost, the sentence is translated again with the words written inline, so nothing is dropped.

## Quality test

```
.venv\Scripts\python livetranslate.py test
```

The test translates 50 sentences, in [`quality/adventist-af-en.tsv`](quality/adventist-af-en.tsv). Each one has a correct English reference, words that must appear and words that must not:
- Adventist terms
- names that must not be translated
- South African slang and Kaaps
- English mixed into Afrikaans
- everyday sermon lines
- Bible quotes

The report (`quality/report.md`) shows the score per kind, an automatic similarity score against the reference (chrF), and every sentence side by side. Setup runs it by itself. `test --dry` checks the preparation without a model. Add your own sentences to the file at any time.

## Which model on which PC

Run the test first (see the next section). It tells you whether your PC keeps up.

| PC | Use | |
|---|---|---|
| Any NVIDIA graphics card | turbo (setup picks it) | comfortably live |
| Modern i5 / Ryzen 5, 2018 or newer | `--asr turbo` | check the test: under 0.8 × real time keeps up |
| Older or weak PC | `--asr small` | live, less accurate |

Examples: `start-translator.bat --asr small` and `start-translator.bat --device 3` (`livetranslate.py devices` lists the inputs).

## Test it on your own sermon

```
.venv\Scripts\python livetranslate.py bench sermon.wav --ref sermon-correct.txt
```

This writes `sermon.translation.md`:
- speed (× real time);
- the Afrikaans word error rate, if a corrected text is given;
- every sentence in Afrikaans and English, with Bible verses marked, for a bilingual member to check.

Compare models with `--asr small` / `--asr turbo`.

## Making it better for your church (optional, free)

1. **Teach the translator church language.** On Google Colab or Kaggle, run `python finetune_mt.py`.
   - It trains OPUS-MT on about 28,000 Afrikaans–English verse pairs.
   - It reports the score before and after, and keeps the result only if it improved.
   - The translator then uses it automatically. Confirm with `bench` on a sermon.
2. **Teach recognition your pastor's voice.** This is the biggest gain.
   - Take 2–5 hours of sermons and use the `.af.txt` that `bench` writes as a first draft.
   - Have someone correct it.
   - Fine-tune Fluister on those recordings with a LoRA on Colab.
   - Convert the result with `ct2-transformers-converter --quantization int8` into `models/fluister-<name>` and start with `--asr <name>`.

## For developers

- `livetranslate.py serve` listens on `http://127.0.0.1:7790`:
  - `GET /status` and `GET /events` (server-sent events: `line`, `ref`, `hymn`, `status`);
  - `POST /start {device}`, `POST /stop`, `POST /config {english}`.
- Only SDA Sabbath's own addresses are accepted:
  - leemcq.github.io, this PC, and the church network;
  - a page from any other website gets 403 and cannot switch on the microphone.
- `--lan` makes it reachable from other PCs on the church network.
- `livetranslate.py demo` sends fake captions, for testing the app without models.

**Licences**
- Fluister: MIT, by DigiPhyte, from OpenAI Whisper (Apache 2.0). Training data is CC BY 4.0 and NCHLT CC BY 3.0.
- OPUS-MT af-en: Apache 2.0, by the University of Helsinki.
- Silero VAD: MIT.
- The Bibles are public domain.

## If the first-time setup stops

- **"certificate verify failed"**: the setup now checks certificates the way Windows does and, if Python still
  cannot download, uses Windows' own downloader (curl.exe / PowerShell). Download the latest translator (Tools →
  Listen & Translate → Download for Windows), unzip it over the old folder (the models already downloaded are
  kept) and double-click start-translator.bat again.
- **Still stuck on a school or office network**: that network may block the model download. Run the setup once on
  another connection (for example a phone hotspot); after that the translator needs no internet.
