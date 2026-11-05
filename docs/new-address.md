# Moving to ssdesk.online

SDA Sabbath's new address is **https://ssdesk.online/** ("Sabbath Service Desk", registered at domains.co.za). It is
still published by GitHub Pages from this repository; only the address changes.

## 1. DNS at domains.co.za (Leo)

In the domains.co.za client area → **ssdesk.online** → **DNS / Manage DNS zone**, remove any default parking or "A"
records for `@` and `www`, then add:

| Type  | Name / Host | Value                     |
|-------|-------------|---------------------------|
| A     | @           | 185.199.108.153           |
| A     | @           | 185.199.109.153           |
| A     | @           | 185.199.110.153           |
| A     | @           | 185.199.111.153           |
| AAAA  | @           | 2606:50c0:8000::153       |
| AAAA  | @           | 2606:50c0:8001::153       |
| AAAA  | @           | 2606:50c0:8002::153       |
| AAAA  | @           | 2606:50c0:8003::153       |
| CNAME | www         | leemcq.github.io          |

Leave the MX (email) records alone. Changes usually show within an hour (up to 24 hours).

## 2. GitHub (Leo, or ask Claude)

1. **github.com → your profile picture → Settings → Pages → Add a domain**: `ssdesk.online`. GitHub shows a TXT record
   (`_github-pages-challenge-LeeMcQ`): add it at domains.co.za and press **Verify**. This stops anyone else using the
   domain with GitHub Pages.
2. **LeeMcQ/SDA_Sabbath → Settings → Pages → Custom domain**: `ssdesk.online` → **Save**. Wait for the DNS check to turn
   green and the certificate to be issued (minutes to an hour), then tick **Enforce HTTPS**.

From then on `leemcq.github.io/SDA_Sabbath/…` redirects to `ssdesk.online/…`. (The site is deployed by GitHub
Actions, so no `CNAME` file is needed in the repository.)

## 3. What the app does by itself

- Copies already opened or installed at the old address keep working offline. Once ssdesk.online answers, they show
  **"SDA Sabbath has a new address"** with **Move my data**: it copies plans, hymnbooks, Bibles, banners, slides and
  settings to the new address in one step (the new address only accepts data from the old one, and asks first). Videos
  are not copied. "Not now" asks again the next day. (`js/move.js`)
- A browser keeps each address's data apart, so this step is needed once per device. A backup file (Settings → Backup)
  restored at the new address does the same.
- The app, the stage-screen QR codes, shared hymns and the companion download page work at both addresses.

## 4. After the new address works (Claude)

- `js/core/site.js`: `LIVE = true` (the companion and localhost copies then use ssdesk.online), and the addresses in
  `index.html` (canonical, social preview), the other pages, `tools/monthly_report.py`, README and docs.
- **Supabase → Authentication → URL Configuration**: Site URL `https://ssdesk.online/`; add `https://ssdesk.online/**` to the
  redirect URLs (keep the old ones for now).
- **Google Cloud console → OAuth client**: add `https://ssdesk.online` to the authorised JavaScript origins and
  `https://ssdesk.online/oauth.html` to the redirect URIs (Google Drive backup and Google sign-in).
- **Live translator:** allows ssdesk.online from its next build (`translator/livetranslate.py`). Churches that use it
  install the new version (Tools → Translate shows the download).

[← Back to the README](../README.md)
