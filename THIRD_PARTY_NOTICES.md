# Third-party notices

SDA Sabbath's own code is MIT-licensed (`LICENSE`). Everything below keeps its own licence and owner.

## Bibles
| Data | Status |
|---|---|
| King James Version (`data/bibles/kjv`) | Public domain (outside the UK, where Crown rights apply to printing) |
| World English Bible (`data/bibles/web`) | Public domain |
| Afrikaanse Bybel 1933/53 | **Not included.** © Bybelgenootskap van Suid-Afrika 1933, 1953 (digital edition © 2012). A church with the Bible Society's permission adds its own copy (`licensed/README.md`). |
| Bibles a church adds (NIV, Xhosa 1975, …) | Each keeps its own copyright; they stay on the church's own devices or its own build (`licensed/`, `data/bibles-private/`, git-ignored). |

## Hymns and songs
| Data | Status |
|---|---|
| Church Hymnal 1941 (`data/hymns/church-1941.json`) | Older hymn texts, included with words |
| SDA Hymnal 1985 (`data/hymns/sda-online.json`) | Numbers and titles only. The hymnal (compilation, edited texts) is © Review and Herald Publishing / General Conference; many texts are owned by other publishers. |
| Advent Lofliedere (`data/hymns/afrikaans.json`) | Words © their owners; included with their permission (held by the maintainer). |
| Praise Choruses (`data/hymns/choruses.json`) | Titles and authors; words only for traditional (public-domain) choruses. Others © their publishers (mostly administered by CCLI). |
| Malmesbury Praise (`data/hymns/malmesbury.json`) | Titles; words only for public-domain hymns (written before 1928, author died over 70 years ago). |
| Words a church imports | The church's responsibility under its own licence (CCLI Church Copyright Licence; a CCLI Streaming Licence for live streams). Stored only on its own devices. |

`tools/strip_licensed_hymns.py` keeps the public files this way.

## Music and sounds
- GeneralUser GS 2.0.3 SoundFont by S. Christian Collins: free to use (`data/music/GeneralUser-GS-LICENSE.txt`).
- Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0) and the GrandOrgue demo organ, recordings by Lars Palo (CC BY-SA 2.5): `data/music/HQ-SOUNDS-LICENSE.txt`.
- Hymn MIDI files: supplied for churches' own services; tunes and arrangements keep their owners' rights.

## Fonts
Atkinson Hyperlegible Next, Source Serif 4 and Advent Sans: SIL Open Font License 1.1 (see `fonts/`).

## Libraries
pdf.js (Apache 2.0), fflate (MIT), qrcode-generator (MIT), SpessaSynth (Apache 2.0), Trystero and noble-secp256k1 (MIT). Versions: `vendor/VERSIONS.md`.

## Trademarks
"Seventh-day Adventist®", "Adventist®" and the Church symbol are registered trademarks of the General Conference of Seventh-day Adventists®. SDA Sabbath is independent and not an official Church product. It does not ship the Church symbol; its default logo is an original neutral open-Bible mark, and each church may upload its own logo.

## Accuracy
- **AI**: AI answers, summaries and pictures can be wrong or doctrinally wrong. Check them against Scripture before showing them.
- **Live translation**: computer translation can be wrong or leave things out; it is not an exact translation.
- **Streaming**: copyrighted song words on a live stream or recording need the church's CCLI Streaming Licence.
