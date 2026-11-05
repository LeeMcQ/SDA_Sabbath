#!/usr/bin/env python3
"""
SDA Sabbath smoke tests. They run on GitHub before every deploy: if one fails, the deploy stops and the
website keeps the last working version.

    pip install playwright && python -m playwright install chromium
    python tests/smoke.py              # tests the folder this file is in
    python tests/smoke.py path/to/site # tests another copy (e.g. the minified deploy folder)

Each check prints PASS or FAIL; the exit code is the number of failures.
"""
import json, os, socket, subprocess, sys, threading, time, traceback
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = ['index.html', 'display.html', 'stage.html', 'obs.html', 'privacy.html', 'terms.html', 'delete-account.html', 'companion.html', 'feedback.html', 'admin.html']
TABS = ['bible', 'hymns', 'ai', 'slides', 'video', 'web', 'plan', 'tools', 'settings']
# Requests that are allowed to fail on a plain web server (the companion's /api is only there when it runs).
# The published website is not what is tested: off github.io the app asks it for shared choruses and the
# companion downloads, and before the first deploy of a feature those files are not online yet.
OK_404 = ('/api/', 'favicon', '://leemcq.github.io/', '://ssdesk.online/')

results = []


def check(name):
    def deco(fn):
        def run(*a):
            t = time.time()
            try:
                fn(*a)
                results.append((name, True, ''))
                print('PASS  %-46s %.1fs' % (name, time.time() - t), flush=True)
            except Exception as e:
                results.append((name, False, str(e)))
                print('FAIL  %-46s %s' % (name, e), flush=True)
                if os.environ.get('VERBOSE'): traceback.print_exc()
        return run
    return deco


def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    httpd = ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, 'http://127.0.0.1:%d/' % port


# ------------------------------------------------------------------ files
@check('offline list: every file exists')
def t_manifest():
    m = json.load(open(os.path.join(ROOT, 'asset-manifest.json')))
    missing = [f for f in m['files'] if not os.path.isfile(os.path.join(ROOT, f))]
    assert not missing, 'missing: ' + ', '.join(missing[:5])
    assert len(m['files']) > 100, 'only %d files listed' % len(m['files'])
    empty = [f for f in m['files'] if f.endswith(('.js', '.css', '.html', '.json')) and os.path.getsize(os.path.join(ROOT, f)) == 0]
    assert not empty, 'empty files: ' + ', '.join(empty[:5])


@check('service worker parses')
def t_sw():
    r = subprocess.run(['node', '--check', os.path.join(ROOT, 'sw.js')], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr.strip()[:200]


# ------------------------------------------------------------------ browser
def new_page(ctx, errs, bad):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('response', lambda r: bad.append('%d %s' % (r.status, r.url)) if r.status >= 400 and not any(x in r.url for x in OK_404) else None)
    return pg


def wait_text(pg, text, timeout=10000):
    """Poll the page text from here (the app's security policy blocks Playwright's own waiting code)."""
    end = time.time() + timeout / 1000
    while time.time() < end:
        if text in pg.inner_text('body'): return
        pg.wait_for_timeout(250)
    raise AssertionError('%r not shown' % text)


def main():
    from playwright.sync_api import sync_playwright
    t_manifest(); t_sw()
    httpd, base = serve()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
            ctx = b.new_context(viewport={'width': 1400, 'height': 900}, service_workers='block')

            @check('every page opens without errors')
            def t_pages():
                errs, bad = [], []
                pg = new_page(ctx, errs, bad)
                for u in PAGES:
                    pg.goto(base + u); pg.wait_for_timeout(800)
                pg.close()
                assert not errs, '; '.join(errs[:3])
                assert not bad, '; '.join(bad[:3])
            t_pages()

            errs, bad = [], []
            pg = new_page(ctx, errs, bad)
            pg.goto(base + 'index.html'); pg.wait_for_timeout(1000)

            @check('first-start setup is a real dialog for keyboard and screen readers')
            def t_welcome_keys():
                pg.wait_for_selector('.welcome', timeout=8000); pg.wait_for_timeout(500)
                inside = "(() => !!(document.activeElement && document.activeElement.closest('.welcome')))()"
                assert pg.evaluate(inside), 'focus is not in the setup dialog at the start'
                assert pg.evaluate("[...document.body.children].filter(e => !e.classList.contains('welcome') && !e.classList.contains('toasts')).every(e => e.inert)"), 'the page behind is not inert'
                assert 'Step 1' in pg.evaluate("document.querySelector('.welcome .sr').textContent"), 'the step is not announced'
                out = 0
                for k in range(25):
                    pg.keyboard.press('Tab')
                    if not pg.evaluate(inside): out += 1
                for k in range(5):
                    pg.keyboard.press('Shift+Tab')
                    if not pg.evaluate(inside): out += 1
                assert out == 0, 'Tab left the setup dialog %d times' % out
                pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
                if pg.locator('.welcome').count():  # cloud on: step 1 is the account step; a second Escape skips the rest
                    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
                assert pg.locator('.welcome').count() == 0, 'Escape did not skip the setup'
                assert not pg.evaluate("[...document.body.children].some(e => e.inert)"), 'the page stayed inert'
            t_welcome_keys()

            pg.evaluate("import('./js/core/settings.js').then(m => (m.settings.set('app.setupDone', true), m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() }))))")
            pg.reload(); pg.wait_for_selector('#presentBtn'); pg.wait_for_timeout(1500)

            @check('every tab opens')
            def t_tabs():
                for t in TABS:
                    pg.evaluate('id => window.selah.showTab(id)', t); pg.wait_for_timeout(500)
                    assert not pg.locator('.tab-error').count(), t + ' shows an error panel'
                assert not errs, '; '.join(errs[:3])
            t_tabs()

            def present(q):
                go = pg.locator('input[placeholder^="Go to"]').first
                go.fill(q); pg.wait_for_timeout(900); go.press('Enter'); pg.wait_for_timeout(900)
                pg.click('#presentBtn'); pg.wait_for_timeout(1200)
                return pg.evaluate("import('./js/core/live.js').then(m => m.live.cue && (m.live.cue.title + ' | ' + (m.live.cue.sub || '')))")

            @check('a Bible verse goes live')
            def t_bible():
                title = present('John 3:16')
                assert title and 'John 3' in title, 'live is %r' % title
                wait_text(pg, 'God so loved')
            t_bible()

            @check('rapid Present taps and F5 repeats do not carry the live screen on')
            def t_rapid_present():
                present('John 3:16')
                pg.wait_for_timeout(700)
                # Count how many times something really went live: 40 taps in 0.4 s, then 3 F5 presses, are one each.
                pg.evaluate("import('./js/core/live.js').then((m) => { window.__takes = 0; m.live.on('live', () => { window.__takes++; }); })")
                pg.wait_for_timeout(100)
                pg.evaluate("async () => { const b = document.getElementById('presentBtn'); for (let i = 0; i < 40; i++) { b.click(); await new Promise((r) => setTimeout(r, 10)); } }")
                pg.wait_for_timeout(1000)
                taps = pg.evaluate('window.__takes')
                pg.evaluate('window.__takes = 0')
                pg.keyboard.press('F5'); pg.keyboard.press('F5'); pg.keyboard.press('F5'); pg.wait_for_timeout(1000)
                keys = pg.evaluate('window.__takes')
                assert taps == 1, '40 quick taps on Present put %d items live (should be 1)' % taps
                assert keys == 1, '3 quick F5 presses put %d items live (should be 1)' % keys
            t_rapid_present()

            @check('phone header: Present stays on screen at 320 px while the offline copy is saving')
            def t_present_320():
                c = b.new_context(viewport={'width': 320, 'height': 640}, has_touch=True, is_mobile=True)
                p3 = c.new_page()
                p3.goto(base + 'index.html'); p3.wait_for_timeout(800)
                p3.evaluate("import('./js/core/settings.js').then(m => (m.settings.set('app.setupDone', true), m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() }))))")
                p3.reload(); p3.wait_for_selector('#presentBtn'); p3.wait_for_timeout(1200)
                p3.evaluate("() => { window.selah.cacheProgress = { t: 'progress', done: 73, total: 100 }; window.dispatchEvent(new CustomEvent('selah-cache', { detail: { done: 73, total: 100 } })); }")
                p3.wait_for_timeout(400)
                r = p3.evaluate("() => { const p = document.getElementById('presentBtn').getBoundingClientRect(); return [Math.round(p.right), innerWidth, Math.round(p.width)]; }")
                c.close()
                assert r[0] <= r[1], 'Present runs %d px past the right edge (width %d)' % (r[0] - r[1], r[2])
                assert r[2] <= 60, 'Present is not an icon at 320 px (width %d)' % r[2]
            t_present_320()

            @check('statistics: recorded offline while signed in, delivered when back online')
            def t_stats_offline():
                import json as _json
                c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
                sent, answer = [], {'v': 'null'}
                def cfg(route):   # this test's own (pretend) cloud project
                    route.fulfill(status=200, content_type='text/javascript', body="export const CLOUD = { url: 'https://stats-test.supabase.co', anonKey: 'anon', google: false, requireSignIn: false, googleClientId: '' };")
                def sb(route):
                    u = route.request.url
                    if '/rpc/ping' in u:
                        sent.append(_json.loads(route.request.post_data or '{}'))
                        route.fulfill(status=200, content_type='application/json', body=answer['v'])
                    else:
                        route.fulfill(status=200, content_type='application/json', body='false' if 'is_admin' in u else '{}')
                c.route('**/js/core/cloud-config.js', cfg)
                c.route('https://stats-test.supabase.co/**', sb)
                q = c.new_page()
                try:
                    q.goto(base + 'index.html'); q.wait_for_timeout(800)
                    q.evaluate("""() => Promise.all([import('./js/core/settings.js'), import('./js/core/storens.js')]).then(([m, n]) => {
                      m.settings.set('app.setupDone', true); m.settings.set('app.stats', true);
                      m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() }));
                      m.settings.set('church', Object.assign({}, m.settings.v.church, { name: 'Test Church', town: 'Malmesbury', lat: -33.4612, lon: 18.7275 }));
                      localStorage.setItem(n.lsKey('cloud.session'), JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 7200, user: { email: 'church@example.com' } })); })""")
                    q.reload(); q.wait_for_selector('#presentBtn'); q.wait_for_timeout(1500)
                    assert q.evaluate("window.selah.cloud.statsOn()"), 'statistics are not on for a signed-in church'
                    # This test blocks the offline copy (service worker), so the hymnbooks are loaded before going offline.
                    q.evaluate("window.selah.showTab('hymns').then((t) => t.whenReady && t.whenReady())"); q.wait_for_timeout(300)
                    q.evaluate("window.selah.showTab('bible')"); q.wait_for_timeout(300)
                    c.set_offline(True)
                    for ref in ('hymn 73', 'John 3:16'):
                        go = q.locator('input[placeholder^="Go to"]').first
                        go.fill(ref); q.wait_for_timeout(700); go.press('Enter'); q.wait_for_timeout(700)
                        q.click('#presentBtn'); q.wait_for_timeout(900)
                    q.evaluate("window.dispatchEvent(new CustomEvent('selah-search-empty', { detail: 'hymn 9999' }))")
                    day = q.evaluate("import('./js/core/storens.js').then((n) => Object.values(JSON.parse(localStorage.getItem(n.lsKey('cloud.pending')) || '{}'))[0] || {})")
                    assert any(k.split('|')[1] == '73' for k in (day.get('hymns') or {})), 'hymn 73 was not recorded offline: %r' % day
                    assert 'John 3:16' in (day.get('texts') or {}), 'John 3:16 was not recorded offline: %r' % day
                    assert (day.get('empty') or {}).get('hymn 9999') == 1, 'the empty search was not recorded: %r' % day
                    assert not sent, 'something was sent while offline'
                    # Back online with an older database (answers nothing): only minutes go, the new counts wait.
                    c.set_offline(False)
                    q.evaluate("window.selah.cloud.ping()"); q.wait_for_timeout(1500)
                    assert sent, 'nothing was sent after coming back online'
                    left = q.evaluate("import('./js/core/storens.js').then((n) => Object.values(JSON.parse(localStorage.getItem(n.lsKey('cloud.pending')) || '{}'))[0] || {})")
                    assert left.get('hymns'), 'an older database dropped the hymn counts: %r' % left
                    # The updated database answers 2: everything is delivered and taken off the device.
                    answer['v'] = '2'; sent.clear()
                    q.evaluate("window.selah.cloud.ping()"); q.wait_for_timeout(1500)
                    assert sent, 'nothing sent the second time'
                    d0 = sent[-1]['p_days'][0]; info = sent[-1]['p_info']
                    assert any(k.split('|')[1] == '73' for k in d0.get('hymns', {})) and 'John 3:16' in d0.get('texts', {}), 'the report lacks the hymn or passage: %r' % d0
                    assert info.get('church') == 'Test Church' and info.get('lat') == -33.5 and info.get('lon') == 18.7, 'church or rounded place wrong: %r' % info
                    assert isinstance(info.get('equip'), dict) and info.get('app') and 'setup' in info, 'equipment, app or setup missing: %r' % info
                    left = q.evaluate("import('./js/core/storens.js').then((n) => JSON.parse(localStorage.getItem(n.lsKey('cloud.pending')) || '{}'))")
                    assert not any((v.get('hymns') or v.get('texts')) for v in left.values()), 'sent counts stayed on the device: %r' % left
                    # Signed out: nothing is recorded.
                    q.evaluate("import('./js/core/cloud.js').then((m) => { m.cloud.user = null; })")
                    assert not q.evaluate("window.selah.cloud.statsOn()"), 'statistics stay on after signing out'
                finally:
                    c.close()
            t_stats_offline()

            @check('several verses without a keyboard (Range button)')
            def t_range():
                pg.evaluate("window.selah.showTab('bible')"); pg.wait_for_timeout(400)
                pg.fill('.ref-in', 'John 3'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
                pg.click('.verse-list .vr[data-v="16"]'); pg.wait_for_timeout(200)
                pg.click('.range-btn'); pg.click('.verse-list .vr[data-v="18"]'); pg.wait_for_timeout(400)
                n = pg.evaluate("document.querySelectorAll('.verse-list .vr.sel').length")
                assert n == 3, 'Range selected %d verses, not 3' % n
                assert pg.get_attribute('.range-btn', 'aria-pressed') == 'false', 'Range stayed on'
            t_range()

            @check('a hymn goes live')
            def t_hymn():
                title = present('hymn 73')
                assert title and ('73' in title or 'Holy' in title), 'live is %r' % title
            t_hymn()

            @check('a copyrighted hymn shows its title and how to add licensed words')
            def t_hymn_licensed():
                pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'sda-online' }))"); pg.wait_for_timeout(900)
                assert pg.locator('.licence-panel').first.is_visible(), 'no licence panel for a hymn without words'
                assert pg.locator('.licence-panel', has_text='Church Hymnal 1941 #73').count() == 1, 'no link to the public-domain 1941 words'
                frames = pg.evaluate("window.selah.tab('hymns').then(() => import('./js/tabs/hymns.js')).then(m => { const s = m.parseSongSelect('Amazing Grace\\n\\nVerse 1\\nAmazing grace how sweet the sound\\nThat saved a wretch like me\\n\\nChorus\\nMy chains are gone\\n\\nCCLI Song # 4768151\\n'); return [s.t, s.ccli, s.v.length, !!s.c]; })")
                assert frames == ['Amazing Grace', '4768151', 1, True], 'SongSelect text not read: %r' % frames
                usr = pg.evaluate("import('./js/tabs/hymns.js').then(m => { const s = m.parseSongSelect('[S A1234]\\nTitle=Test Song\\nAuthor=A|B\\nFields=Verse 1/tChorus\\nWords=Line one/nLine two/tChorus line\\n'); return [s.t, s.ccli, s.v.length, s.c && s.c[0]]; })")
                assert usr == ['Test Song', '1234', 1, 'Chorus line'], 'SongSelect .usr not read: %r' % usr
            t_hymn_licensed()

            @check('next / previous step through a hymn')
            def t_steps():
                # A hymn with words (the 1941 Church Hymnal is included with its words).
                pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'church-1941' }))"); pg.wait_for_timeout(900)
                pg.click('#presentBtn'); pg.wait_for_timeout(1200)
                i0 = pg.evaluate("import('./js/core/live.js').then(m => m.live.index)")
                pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(500)
                i1 = pg.evaluate("import('./js/core/live.js').then(m => m.live.index)")
                assert i1 == i0 + 1, 'index %s -> %s' % (i0, i1)
            t_steps()

            @check('the stage screen opens and follows live')
            def t_stage():
                with ctx.expect_page(timeout=10000) as pop:
                    pg.evaluate("import('./js/core/stagehub.js').then(m => m.hub.openWindow(1))")
                st = pop.value
                st.on('pageerror', lambda e: errs.append('stage: ' + str(e)[:200]))
                st.wait_for_load_state()
                present('John 3:16')
                wait_text(st, 'God so loved')
                st.close()
            t_stage()

            @check('black screen toggles')
            def t_black():
                pg.keyboard.press('b'); pg.wait_for_timeout(400)
                on = pg.evaluate("import('./js/core/live.js').then(m => m.live.blank)")
                pg.keyboard.press('b'); pg.wait_for_timeout(400)
                off = pg.evaluate("import('./js/core/live.js').then(m => m.live.blank)")
                assert on and not off, 'blank %r then %r' % (on, off)
            t_black()

            @check('Plan tab, Basic: order of service, Show, Next and Blank')
            def t_basic():
                pg.evaluate("window.selah.showTab('plan')"); pg.wait_for_timeout(800)
                pg.click('.plan-view [data-view="basic"]'); pg.wait_for_timeout(500)
                assert pg.locator('.basic-panel').is_visible(), 'the Basic order of service is not shown'
                assert pg.locator('#rail').is_visible(), 'the tabs must stay in Basic (it only changes the Plan tab)'
                if not pg.locator('.bp-row').count():
                    pg.click('.bp-empty .btn.primary'); pg.wait_for_timeout(1500)
                row = pg.locator('.bp-row:not(.empty)').filter(has=pg.locator('.bp-play')).first   # a hymn part
                row.locator('.bp-show').click(); pg.wait_for_timeout(1500)
                i0 = pg.evaluate("import('./js/core/live.js').then(m => m.live.cue ? m.live.index : -1)")
                assert i0 >= 0, 'Show put nothing on screen'
                # The slim row steps the slides of what is on screen (a hymn without licensed words has only its title slide).
                if pg.evaluate("import('./js/core/live.js').then(m => m.live.cue.deck.frames.length)") > 1:
                    pg.click('.bb-slides .bs-b[aria-label="Next slide"]'); pg.wait_for_timeout(600)
                    i1 = pg.evaluate("import('./js/core/live.js').then(m => m.live.index)")
                    assert i1 == i0 + 1, 'slide row: slide %s -> %s' % (i0, i1)
                # The big Next goes to the next part of the service, even with more stanzas left.
                cur = "window.selah.showTab('plan').then((t) => t.snapshot().cur)"
                part0 = pg.evaluate(cur)
                pg.click('.bb-next'); pg.wait_for_timeout(1200)
                part1 = pg.evaluate(cur)
                assert part1 == part0 + 1, 'Next did not move to the next part (%s -> %s)' % (part0, part1)
                pg.click('.bb-back'); pg.wait_for_timeout(1200)
                assert pg.evaluate(cur) == part0, 'Back did not return to the part before'
                pg.click('.bb-blank'); pg.wait_for_timeout(300)
                assert pg.evaluate("import('./js/core/live.js').then(m => m.live.blank)") == 'black', 'Blank did not black out'
                pg.click('.bb-blank'); pg.wait_for_timeout(300)
                assert not pg.evaluate("import('./js/core/live.js').then(m => m.live.blank)"), 'Blank did not show the screen again'
                assert not errs, '; '.join(errs[:3])
            t_basic()

            @check('Plan tab, Advanced: plan pictures; Tools: Listen')
            def t_advanced():
                pg.click('.plan-view [data-view="advanced"]'); pg.wait_for_timeout(800)
                assert not pg.locator('.basic-panel').is_visible(), 'the Basic panel still shows'
                assert pg.locator('.plan-addbar').is_visible(), 'the plan editor does not show in Advanced'
                assert pg.locator('.plan-item .pi-slide').count() > 0, 'no slide pictures in the plan'
                pg.evaluate("window.selah.showTab('listen')"); pg.wait_for_timeout(800)
                assert pg.locator('.tools-part-listen .ls-toggle').is_visible(), 'Tools → Listen does not open'
                pg.evaluate("window.selah.showTab('translate')"); pg.wait_for_timeout(800)
                tr = pg.locator('.tools-part-listen .tr-card .tr-bar')
                assert tr.is_visible() and 'Live translation' in tr.inner_text(), 'Live translation is not in Tools → Listen & Translate'
                pg.locator('.tools-part-listen .tr-more > summary').click(); pg.wait_for_timeout(300)
                assert 'English captions' in pg.inner_text('.tools-part-listen .tr-more'), 'the Live translation settings are missing'
                pg.locator('.tools-part-listen .tr-more > summary').click()
                assert pg.locator('.tools-part-listen .ls-toggle').is_visible(), 'Listen is not in the same part as Live translation'
                got = pg.evaluate("""import('./js/core/spokenref.js').then(m => [
                    'as it says in John chapter three verse sixteen', 'Romans 8 28', 'first Corinthians thirteen verses four to seven',
                    'let us sing hymn number one hundred', 'Johannes drie vers sestien', 'the Lord is my shepherd'
                  ].map(t => m.findRefs(t).map(r => r.kind === 'hymn' ? 'hymn ' + r.n : r.ref).join(',')))""")
                assert got == ['John 3:16', 'Romans 8:28', '1 Corinthians 13:4-7', 'hymn 100', 'John 3:16', ''], 'heard %r' % got
                pg.evaluate("window.selah.listener.hear('turn with me to John chapter three verse sixteen')"); pg.wait_for_timeout(1500)
                assert pg.locator('.ls-card').count() == 1, 'no suggestion card'
                pg.locator('.ls-card .btn.primary').click(); pg.wait_for_timeout(1200)
                st = pg.evaluate("import('./js/core/live.js').then(m => m.live.staged && m.live.staged.title)")
                assert st and 'John 3' in st, 'Put on Next staged %r' % st
                assert not errs, '; '.join(errs[:3])
            t_advanced()

            @check('listening: hymns by name and following the singing')
            def t_hymn_listen():
                pg.evaluate("window.selah.listener.ready()"); pg.wait_for_timeout(800)
                pg.evaluate("window.selah.listener.hear('please stand and let us sing great is thy faithfulness')"); pg.wait_for_timeout(1200)
                ref = pg.locator('.ls-card:not(.ls-follow) .ls-ref').first.inner_text()
                assert '100' in ref, 'hymn by name offered %r' % ref
                # Hymn 73 (1941 Church Hymnal, with words) on screen at its title; the congregation sings the third stanza.
                pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'church-1941' }))"); pg.wait_for_timeout(1000)
                pg.click('#presentBtn'); pg.wait_for_timeout(1200)
                pg.evaluate("import('./js/core/live.js').then(m => m.live.go(0))"); pg.wait_for_timeout(300)
                pg.evaluate("window.selah.listener.hear('though the darkness hide thee though the eye of man thy great glory may not see')"); pg.wait_for_timeout(600)
                assert pg.locator('.ls-follow').count() == 1, 'no "being sung now" card'
                pg.locator('.ls-follow .btn.primary').click(); pg.wait_for_timeout(500)
                lab = pg.evaluate("import('./js/core/live.js').then(m => m.live.cue.labels[m.live.index])")
                assert lab.startswith('3'), 'showing %r instead of stanza 3' % lab
                assert not errs, '; '.join(errs[:3])
                pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'sda-online' }))"); pg.wait_for_timeout(600)   # back to the main hymnal
            t_hymn_listen()

            @check('listening through the offline translator (quoted verse, reference, hymn)')
            def t_offline_listen():
                pg.evaluate("window.selah.listener.fromTranslator('line', { af: 'Die Here is my herder, niks sal my ontbreek nie', en: 'The Lord is my shepherd, I shall lack nothing', verse: { ref: 'Psalms 23:1', text: '' } })")
                pg.evaluate("window.selah.listener.fromTranslator('ref', { q: 'Romeine 8:28', af: 'Romeine agt vers agt en twintig' })")
                pg.evaluate("window.selah.listener.fromTranslator('hymn', { n: 73, af: 'kom ons sing gesang drie en sewentig' })")
                pg.wait_for_timeout(1500)
                refs = pg.evaluate("[...document.querySelectorAll('.ls-card:not(.ls-follow) .ls-ref')].map(e => e.textContent).join(' | ')")
                assert 'Psalm' in refs and '23:1' in refs and 'Romans 8:28' in refs and 'Hymn 73' in refs, 'cards: %s' % refs
                assert not errs, '; '.join(errs[:3])
            t_offline_listen()

            @check('translator blocked by Chrome (Local network access): the steps are shown')
            def t_translator_lna():
                pg.evaluate("window.selah.showTab('translate')"); pg.wait_for_timeout(800)
                pg.evaluate("""async () => { const m = await import('./js/core/livecaptions.js');
                  m.captions.lnaState = async () => 'denied'; m.captions.state.connected = false; await m.captions.checkBlocked(); }""")
                pg.wait_for_timeout(500)
                st = pg.inner_text('.tools-part-listen .tr-st')
                assert 'Local network access' in st and 'Allow' in st, 'translator status: %s' % st
                pg.evaluate("""async () => { const m = await import('./js/core/livecaptions.js');
                  m.captions.lnaState = async () => 'granted'; await m.captions.checkBlocked(); }""")
                pg.wait_for_timeout(300)
                assert 'Local network access' not in pg.inner_text('.tools-part-listen .tr-st'), 'the message stays after it was allowed'
                tipw = pg.evaluate("[...document.querySelectorAll('.ls-src .tip')].map(e => e.dataset.tip).join(' ')")
                assert 'licensed Afrikaans Bible is installed' in tipw and 'It also recognises Bible verses the preacher quotes' not in tipw, 'Listen help: %s' % tipw[:300]
                assert not errs, '; '.join(errs[:3])
            t_translator_lna()

            @check('translation on phones: QR slide and the phone view')
            def t_tr_phone():
                pg.evaluate("window.selah.showTab('listen')"); pg.wait_for_timeout(600)
                pg.locator('.tools-part-listen').get_by_role('button', name='Put on Next').click(); pg.wait_for_timeout(4000)
                st = pg.evaluate("import('./js/core/live.js').then(m => m.live.staged && [m.live.staged.title, m.live.staged.deck.frames[0].src.size])")
                assert st and st[0] == 'Translation on your phone' and st[1] > 20000, 'phone slide on Next: %r' % (st,)
                with ctx.expect_page(timeout=10000) as pop:
                    pg.evaluate("window.open('stage.html?via=win&v=tr', 'trphone', 'popup=yes,width=390,height=800')")
                ph = pop.value
                ph.on('pageerror', lambda e: errs.append('phone: ' + str(e)[:200]))
                ph.wait_for_load_state(); ph.wait_for_timeout(2500)
                pg.evaluate("window.selah.stage.setTranslation(true)")
                pg.evaluate("window.selah.stage.addCaption({ af: 'Want so lief het God die wêreld gehad', en: 'For God so loved the world', verse: { ref: 'John 3:16' } })")
                ph.wait_for_timeout(800)
                txt = ph.locator('.tr-line.now').inner_text()
                assert 'For God so loved the world' in txt and 'John 3:16' in txt, 'phone shows %r' % txt
                assert pg.evaluate("window.selah.stage.readers().length") == 1, 'the phone is not counted as a reader'
                assert not ph.locator('.ss-ctrl, .ss-now').first.is_visible(), 'the phone shows stage controls'
                ph.close()
                assert not errs, '; '.join(errs[:3])
            t_tr_phone()

            @check('live translation suggestions: verse and hymn cards (Put on Next)')
            def t_tr_suggest():
                pg.evaluate("window.selah.showTab('plan')"); pg.wait_for_timeout(300)
                pg.evaluate("import('./js/core/settings.js').then(m => { m.settings.set('captions.suggest', true); m.settings.set('captions.on', true); })")
                pg.wait_for_timeout(1500)
                pg.evaluate("window.selah.listener.ready()"); pg.wait_for_timeout(600)
                inj = "(a) => import('./js/core/livecaptions.js').then(m => m.captions.inject(a[0], a[1]))"
                cards = "[...document.querySelectorAll('.ls-card:not(.ls-follow) .ls-ref')].map(e => e.textContent).join(' | ')"
                # One at a time: the panel keeps the newest three cards, and each card is made at its own speed.
                def offered(event, data, want, what):
                    pg.evaluate(inj, [event, data])
                    for _ in range(20):
                        refs = pg.evaluate(cards)
                        if any(w in refs for w in want): return
                        pg.wait_for_timeout(200)
                    raise AssertionError('%s missing: %s' % (what, refs))
                offered('ref', {'q': 'Jesaja 58:13', 'af': 'Jesaja agt en vyftig vers dertien'}, ['Isaiah 58:13', 'Jesaja 58:13'], 'named reference')
                offered('line', {'af': 'Kom na My toe almal wat vermoeid en belas is', 'en': 'Come to me, all you who are weary and burdened', 'verse': {'ref': 'Matthew 11:28'}}, ['Matthew 11:28', 'Matteus 11:28'], 'quoted verse')
                offered('line', {'af': 'Kom ons sing nou Amazing Grace', 'en': 'Let us now sing Amazing Grace how sweet the sound'}, ['Hymn 108'], 'hymn by name')
                offered('hymn', {'n': 462, 'af': 'kom ons sing gesang vier honderd twee en sestig'}, ['Hymn 462'], 'hymn by number')
                assert pg.locator('.listen-box').is_visible(), 'the cards are hidden while Listen is off'
                assert not pg.locator('.toast', has_text='Preacher:').count(), 'the old Set as Next pop-up still shows'
                pg.locator('.ls-card:not(.ls-follow)', has_text='Hymn 462').locator('.btn.primary').click(); pg.wait_for_timeout(1200)
                st = pg.evaluate("import('./js/core/live.js').then(m => m.live.staged && m.live.staged.title)")
                assert st and '462' in st, 'Put on Next staged %r' % st
                pg.evaluate("import('./js/core/settings.js').then(m => m.settings.set('captions.on', false))")
                assert not errs, '; '.join(errs[:3])
            t_tr_suggest()

            @check('backup reminder: asks at start-up, then not again within 24 hours')
            def t_backup_nag():
                pg.evaluate("import('./js/core/settings.js').then(m => m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() - 25 * 3600 * 1000 })))")
                pg.reload(); pg.wait_for_selector('#presentBtn'); pg.wait_for_timeout(4000)
                title = pg.locator('.modal h2').first.inner_text() if pg.locator('.modal h2').count() else ''
                assert 'back up' in title.lower(), 'no backup reminder at start-up (dialog: %r)' % title
                assert pg.locator('.modal').get_by_role('button', name='Save a backup file').count() or pg.locator('.modal').get_by_role('button', name='Sign in with Google & back up').count(), 'no backup button'
                pg.locator('.modal').get_by_role('button', name='Not now').click(); pg.wait_for_timeout(300)
                pg.reload(); pg.wait_for_selector('#presentBtn'); pg.wait_for_timeout(4000)
                assert not pg.locator('.modal').count(), 'the reminder came back within 24 hours'
                assert not errs, '; '.join(errs[:3])
            t_backup_nag()

            @check('two windows changing settings keep both changes')
            def t_two_windows():
                other = new_page(ctx, errs, bad)
                other.goto(base + 'index.html'); other.wait_for_selector('#presentBtn'); other.wait_for_timeout(1200)
                pg.evaluate("import('./js/core/settings.js').then(m => m.settings.set('display.font', 'serif'))")
                pg.wait_for_timeout(150)  # two separate operators, not two writes in the same millisecond
                other.evaluate("import('./js/core/settings.js').then(m => m.settings.set('display.pad', 50))")
                pg.wait_for_timeout(150)  # two separate operators, not two writes in the same millisecond
                pg.evaluate("import('./js/core/settings.js').then(m => m.settings.set('app.railSide', 'right'))")
                pg.wait_for_timeout(150)  # two separate operators, not two writes in the same millisecond
                other.evaluate("import('./js/core/settings.js').then(m => m.settings.set('app.theme', 'light'))")
                pg.wait_for_timeout(500)
                saved = pg.evaluate("import('./js/core/storens.js').then(n => { const s = JSON.parse(localStorage.getItem(n.lsKey('settings.v1'))); return [s.display.font, s.display.pad, s.app.railSide, s.app.theme]; })")
                synced = other.evaluate("import('./js/core/settings.js').then(m => [m.settings.v.display.font, m.settings.v.app.railSide])")
                pg.evaluate("import('./js/core/settings.js').then(m => { m.settings.set('display.font', 'sans'); m.settings.set('display.pad', 96); m.settings.set('app.railSide', 'left'); m.settings.set('app.theme', 'dark'); })")
                other.close()
                assert saved == ['serif', 50, 'right', 'light'], 'stored after both windows: %r' % saved
                assert synced == ['serif', 'right'], 'the other window did not take over the changes: %r' % synced
            t_two_windows()

            @check('Alt+1…9 open tabs, also from a search box')
            def t_alt_keys():
                pg.evaluate("window.selah.showTab('bible')"); pg.wait_for_timeout(500)
                cur = "(document.querySelector('#rail [aria-selected=true]') || {}).dataset.tab"
                got = []
                for key, want in (('Alt+2', 'hymns'), ('Alt+7', 'plan'), ('Alt+1', 'bible')):
                    pg.locator('input[placeholder^="Go to"]').first.focus()
                    pg.keyboard.press(key); pg.wait_for_timeout(500)
                    got.append(pg.evaluate(cur) == want)
                assert all(got), 'Alt shortcuts from a search box: %r' % got
            t_alt_keys()

            @check('a database missing stores is completed, saving works')
            def t_db_upgrade():
                c2 = b.new_context()
                p2 = c2.new_page()
                p2.goto(base + 'privacy.html'); p2.wait_for_timeout(300)
                name = p2.evaluate("import('./js/core/storens.js').then(n => n.DB_NAME)")
                p2.evaluate("""n => new Promise((res) => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { r.result.close(); res(); }; })""", name)
                ok = p2.evaluate("""async () => { const { db } = await import('./js/core/db.js');
                  await db.put('plans', 'test', { id: 'test', name: 'Test', items: [] }); const v = await db.get('plans', 'test');
                  await db.put('files', 'f1', { id: 'f1' }); return !!(v && v.name === 'Test') && !!(await db.get('files', 'f1')); }""")
                c2.close()
                assert ok, 'saving into a database that lacked stores failed'
            t_db_upgrade()

            @check('Sabbath near the poles: 18:00, and the greeting says why')
            def t_polar():
                r = pg.evaluate("""import('./js/core/sabbath.js').then(m => {
                  const day = m.sabbathNow(new Date(2026, 5, 19, 20, 0), 69.65, 18.96);           // Tromsø, midnight sun
                  const night = m.sabbathNow(new Date(2026, 11, 18, 18, 30), 69.65, 18.96);       // polar night
                  const cape = m.sabbathNow(new Date(2026, 9, 30, 20, 0), -33.46, 18.73);         // Malmesbury
                  return [day.on, m.sabbathWords(day).ends, night.on, m.sabbathWords(night).ends, cape.on, m.sabbathWords(cape).ends]; })""")
                assert r[0] and 'No sunset' in r[1] and '18:00' in r[1], 'midnight sun: %r' % r[:2]
                assert r[2] and 'No sunset' in r[3], 'polar night: %r' % r[2:4]
                assert r[4] and r[5].startswith('Sabbath ends at sunset'), 'Malmesbury: %r' % r[4:]
            t_polar()

            @check('a shared plan file opens')
            def t_plan():
                data = list(open(os.path.join(HERE, 'fixtures', 'sample.sdaplan'), 'rb').read())
                n = pg.evaluate("""async (bytes) => {
                  const m = await import('./js/core/planpack.js');
                  const f = new File([new Uint8Array(bytes)], 'sample.sdaplan');
                  const pkg = await m.openPackage(f);
                  return pkg.manifest.items.length;
                }""", data)
                assert n > 0, 'no items in the plan'
            t_plan()

            @check('a Bible file imports (helloao format, NT only)')
            def t_import():
                bk = {'translation': {'shortName': 'TST', 'englishName': 'Test', 'language': 'zul'}, 'books': [{'id': 'JHN', 'name': 'UJohane', 'chapters': [
                    {'chapter': {'number': 3, 'content': [{'type': 'verse', 'number': n, 'content': ['Ivesi %d' % n]} for n in range(1, 120)]}}]}]}
                r = pg.evaluate("""async (txt) => {
                  const m = await import('./js/core/bibledata.js');
                  const p = await m.parseBibleFile(new File([txt], 't.json'));
                  return [...p.books.keys()];
                }""", json.dumps(bk))
                assert r == [43], 'books %r' % r
            t_import()

            @check('Bible formats of all three sources read correctly')
            def t_formats():
                vs = range(1, 120)
                # bible.helloao.org complete.simple.json (verse text in "text")
                simple = {'translation': {'shortName': 'S', 'englishName': 'S', 'language': 'eng'}, 'books': [{'id': 'JHN', 'name': 'John', 'order': 43, 'chapters': [
                    {'chapter': {'number': 3, 'content': [{'type': 'heading', 'text': 'H'}, {'type': 'line_break'}] + [{'type': 'verse', 'number': n, 'text': 'Simple %d' % n, 'footnotes': []} for n in vs]}}]}]}
                # bible.helloao.org complete.json (verse content[] with formatted text and footnote markers)
                full = {'translation': {'shortName': 'F', 'englishName': 'F', 'language': 'eng'}, 'books': [{'id': 'JHN', 'name': 'John', 'order': 43, 'chapters': [
                    {'chapter': {'number': 3, 'content': [{'type': 'verse', 'number': n, 'content': ['Full', {'text': str(n), 'wordsOfJesus': True}, {'noteId': 1}]} for n in vs]}}]}]}
                # getBible v2 {abbr}.json
                gb = {'translation': 'G', 'abbreviation': 'g', 'lang': 'en', 'language': 'English', 'books': [{'nr': 43, 'name': 'John', 'chapters': [
                    {'chapter': 3, 'name': 'John 3', 'verses': [{'chapter': 3, 'verse': n, 'name': 'John 3:%d' % n, 'text': 'Get %d ' % n} for n in vs]}]}]}
                r = pg.evaluate("""async (files) => {
                  const m = await import('./js/core/bibledata.js');
                  const out = [];
                  for (const f of files) { const p = await m.parseBibleFile(new File([f], 'x.json')); out.push([[...p.books.keys()], p.books.get(43)[2][15]]); }
                  return out;
                }""", [json.dumps(simple), json.dumps(full), json.dumps(gb)])
                assert r[0] == [[43], 'Simple 16'], 'helloao simple %r' % r[0]
                assert r[1] == [[43], 'Full 16'], 'helloao complete %r' % r[1]
                assert r[2] == [[43], 'Get 16'], 'getBible %r' % r[2]
            t_formats()

            @check('Bible corpus: Xhosa listed and CES XML imports')
            def t_corpus():
                xml = ('<?xml version="1.0" ?><cesDoc version="4"><cesHeader><fileDesc><titleStmt><h.title>Bible(XHO)</h.title></titleStmt></fileDesc>'
                       '<profileDesc><langUsage><language id="xh" iso639="xho">Xhosa</language></langUsage></profileDesc></cesHeader><text><body>'
                       '<div id="b.JOH" type="book"><div id="b.JOH.3" type="chapter">'
                       + ''.join("<seg id='b.JOH.3.%d' type='verse'>Ivesi %d</seg>" % (n, n) for n in range(1, 120))
                       + '</div></div></body></text></cesDoc>')
                r = pg.evaluate("""async (txt) => {
                  const m = await import('./js/core/bibledata.js');
                  const c = await import('./js/core/biblecorpus.js');
                  const p = await m.parseBibleFile(new File([txt], 't.xml'));
                  return { books: [...p.books.keys()], v16: p.books.get(43)[2][15], xho: c.CORPUS.some((x) => x[1] === 'xho') };
                }""", xml)
                assert r['books'] == [43] and r['v16'] == 'Ivesi 16', 'parsed %r' % r
                assert r['xho'], 'Xhosa missing from the corpus list'
            t_corpus()

            @check('hymnbook formats: VideoPsalm (.vpc), SID markdown, Hymnals Data')
            def t_hymn_formats():
                import io, zipfile
                # VideoPsalm writes keys without quotes and each stanza on one line; Tag marks the chorus.
                vp = ('{Abbreviation:"UE",Text:"UKristu Engomeni",Songs:[{ID:1,Text:"Vuthelani Ixilongo",Verses:['
                      '{Text:"Mlindi, vuthel’ ixilongo, Banike isiyalo; Lowo uvayo indaba, Angaguquk’ aphile."},'
                      '{Tag:1,ID:0,Text:"Mlindi, khalis’ ixilongo, Likhalise kakhulu."},'
                      '{ID:2,Text:"Likhalise entabeni, Kuyo yonke indawo; Base lwandle mememzani, Indaba yokuphila."},'
                      '{Tag:1,ID:0,Text:"Mlindi, khalis’ ixilongo, Likhalise kakhulu."}]},{ID:2,Text:"Empty",Verses:[]}]}')
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('UKristu Engomeni.json', vp)
                md = ('## What a Friend\n\nWhat a friend we have in Jesus,\nall our sins and griefs to bear!\n\nChorus\n'
                      'Precious Savior,\nstill our refuge\n\nHave we trials and temptations?\nIs there trouble anywhere?\n')
                gs = {'songs': {'0': {'id': 1, 'title': 'HOLY SABBATH.', 'author': '', 'stanzas': {
                    '1': 'The pure, unfailing Word of God\r\nFoundation ever sure', '2': 'In paradise where man was led,\r\nThe word will safely guide;'}, 'choruses': {}}}}
                r = pg.evaluate("""async ([vpc, md, gs]) => {
                  const m = await import('./js/core/hymnparse.js');
                  const b = await m.parseHymnFile(new File([new Uint8Array(vpc)], 'UKristu Engomeni.vpc'));
                  const s = m.fromMarkdownHymn(md, 100);
                  const g = m.normaliseBook(gs, 'HGPP');
                  return { name: b.name, short: b.short, n: b.hymns.length, skipped: b.skipped, v1: b.hymns[0].v[0], stanzas: b.hymns[0].v.length, c: b.hymns[0].c,
                    md: [s.t, s.v.length, s.c && s.c[0]], gs: [g.hymns[0].t, g.hymns[0].v.length, g.hymns[0].v[0][1]] };
                }""", [list(buf.getvalue()), md, gs])
                assert [r['name'], r['short'], r['n'], r['skipped']] == ['UKristu Engomeni', 'UE', 1, 1], 'VideoPsalm book %r' % r
                assert r['v1'] == ['Mlindi, vuthel’ ixilongo,', 'Banike isiyalo;', 'Lowo uvayo indaba,', 'Angaguquk’ aphile.'], 'lines %r' % r['v1']
                assert r['stanzas'] == 2 and r['c'] == ['Mlindi, khalis’ ixilongo,', 'Likhalise kakhulu.'], 'chorus %r %r' % (r['stanzas'], r['c'])
                assert r['md'] == ['What a Friend', 2, 'Precious Savior,'], 'SID markdown %r' % r['md']
                assert r['gs'] == ['Holy Sabbath', 2, 'Foundation ever sure'], 'Hymnals Data %r' % r['gs']
            t_hymn_formats()

            @check('Add a hymnbook: isiXhosa offline, SDA Hymnal words with music, remove')
            def t_add_hymnbook():
                xh = json.dumps({'Abbreviation': 'UE', 'Text': 'UKristu Engomeni', 'Songs': [
                    {'ID': n, 'Text': 'Iculo %d' % n, 'Verses': [{'Text': 'Umgca wokuqala %d, Umgca wesibini.' % n}]} for n in range(1, 11)]})
                sdah = json.dumps({'Abbreviation': 'SDAH', 'Text': 'SDAH Hymnal', 'Songs': [
                    {'ID': 73, 'Text': 'Holy, Holy, Holy', 'Verses': [{'Text': 'Holy, holy, holy! Lord God Almighty! Early in the morning our song shall rise to Thee.'}]},
                    {'ID': 696, 'Text': 'He Brought Me Out', 'Verses': [{'Text': 'My heart was distressed, Beneath the dread frown.'}]}]})
                hits = []
                def raw(route):
                    u = route.request.url; hits.append(u)
                    body = xh if 'xhosa-hymnal' in u else sdah if 'sdah-hymnal' in u else None
                    if body is None: route.fulfill(status=404, body='', headers={'Access-Control-Allow-Origin': '*'}); return
                    route.fulfill(status=200, body=body, headers={'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*'})
                ctx.route('https://raw.githubusercontent.com/**', raw)
                try:
                    pg.evaluate("window.selah.showTab('hymns').then((t) => t.whenReady && t.whenReady())"); pg.wait_for_timeout(500)
                    pg.locator('section .toolbar button[aria-label="More"]:visible').first.click(); pg.wait_for_timeout(200)
                    pg.locator('.menu button', has_text='Add a hymnbook').click(); pg.wait_for_timeout(400)
                    pg.locator('.modal input[type=search]').fill('xhose'); pg.wait_for_timeout(200)  # misspelt on purpose: the Bible search finds it too
                    row = pg.locator('.modal .row', has_text='UKristu Engomeni').filter(has_text='SDA hymnals (Rejnac)')
                    assert row.count() == 1, 'isiXhosa not found by "xhose"'
                    row.locator('button').click()
                    wait_text(pg, 'UKristu Engomeni added')
                    pg.wait_for_timeout(600)
                    assert any('/rejnac/xhosa-hymnal/main/' in u for u in hits), 'not downloaded from the rejnac repository: %r' % hits[:2]
                    assert pg.evaluate("document.querySelector('select[aria-label=Hymnbook]').value") == 'web-rejnac-xhosa', 'the new hymnbook was not opened'
                    pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 3, book: 'web-rejnac-xhosa' }))"); pg.wait_for_timeout(700)
                    wait_text(pg, 'Umgca wokuqala 3,')
                    # English SDA Hymnal: also fills the built-in SDA Hymnal (numbers and titles), where the music is.
                    pg.evaluate("import('./js/tabs/hymn-import.js').then(m => m.addHymnbookDialog())"); pg.wait_for_timeout(400)
                    pg.locator('.modal input[type=search]').fill('English'); pg.wait_for_timeout(200)
                    pg.locator('.modal .row', has_text='SDA Hymnal with words').locator('button').click()
                    wait_text(pg, 'filled in for 1 hymn of the SDA Hymnal')
                    pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'sda-online' }))"); pg.wait_for_timeout(800)
                    assert pg.locator('.licence-panel:visible').count() == 0, 'SDA Hymnal 73 still has no words'
                    wait_text(pg, 'Lord God Almighty!')
                    # Settings lists both, with Remove; removing the English book takes its words out of the SDA Hymnal again.
                    pg.evaluate("window.selah.showTab('settings')"); pg.wait_for_timeout(400)
                    pg.locator('.set-nav button', has_text='Bibles & hymns').click(); pg.wait_for_timeout(800)
                    wait_text(pg, 'UE — UKristu Engomeni')
                    wait_text(pg, 'words for 1 hymn added on this device')
                    pg.evaluate("import('./js/tabs/hymn-import.js').then(m => m.removeHymnbook('web-rejnac-english'))"); pg.wait_for_timeout(600)
                    pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 73, book: 'sda-online' }))"); pg.wait_for_timeout(800)
                    assert pg.locator('.licence-panel:visible').count() == 1, 'the words stayed after the hymnbook was removed'
                    pg.evaluate("window.selah.showTab('settings')"); pg.wait_for_timeout(500)
                    pg.locator('button[aria-label="Remove UKristu Engomeni"]').evaluate('b => b.click()'); pg.wait_for_timeout(300)
                    pg.locator('.modal .modal-f button', has_text='Remove').click(); pg.wait_for_timeout(800)
                    assert pg.locator('button[aria-label="Remove UKristu Engomeni"]').count() == 0, 'still listed in Settings after Remove'
                    opts = pg.evaluate("[...document.querySelectorAll('select[aria-label=Hymnbook] option')].map(o => o.value)")
                    assert 'web-rejnac-xhosa' not in opts and 'sda-online' in opts, 'hymnbook list after removing: %r' % opts
                finally:
                    ctx.unroute('https://raw.githubusercontent.com/**', raw)
            t_add_hymnbook()

            @check('first-start setup: install first, church languages, their Bible and hymns downloaded')
            def t_setup_languages():
                xml = ('<?xml version="1.0" ?><cesDoc version="4"><cesHeader><fileDesc><titleStmt><h.title>Bible(XHO)</h.title></titleStmt></fileDesc>'
                       '<profileDesc><langUsage><language id="xh" iso639="xho">Xhosa</language></langUsage></profileDesc></cesHeader><text><body>'
                       '<div id="b.JOH" type="book"><div id="b.JOH.3" type="chapter">'
                       + ''.join("<seg id='b.JOH.3.%d' type='verse'>Ivesi %d</seg>" % (n, n) for n in range(1, 120)) + '</div></div></body></text></cesDoc>')
                sdah = json.dumps({'Text': 'SDAH', 'Songs': [{'ID': 73, 'Text': 'Holy, Holy, Holy', 'Verses': [{'Text': 'Holy, holy, holy! Lord God Almighty!'}]}]})
                H = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8'}
                def raw(route):
                    u = route.request.url
                    if 'bible-corpus' in u: return route.fulfill(status=200, body=xml, headers=H)
                    if 'sdah-hymnal' in u: return route.fulfill(status=200, body=sdah, headers=H)
                    # eBible corpus: one verse per line, in the order of metadata/vref.txt
                    if 'BibleNLP/ebible' in u and u.endswith('vref.txt'): return route.fulfill(status=200, body='\n'.join('JHN 3:%d' % n for n in range(1, 120)), headers=H)
                    if 'BibleNLP/ebible' in u: return route.fulfill(status=200, body='\n'.join('Temana %d' % n for n in range(1, 120)), headers=H)
                    if 'sid_hymnal' in u and u.endswith('meta.json'): return route.fulfill(status=200, body=json.dumps({'title': 'x', 'songs': {str(n): 'S%d' % n for n in range(1, 6)}}), headers=H)
                    if 'sid_hymnal' in u: n = int(u.rsplit('/', 1)[1][:3]); return route.fulfill(status=200, body='## Iculo %d\n\nUmgca %d\nUmgca wesibini\n' % (n, n), headers=H)
                    route.fulfill(status=404, body='', headers=H)
                c = b.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
                c.route('https://raw.githubusercontent.com/**', raw)
                c.route('https://bible.helloao.org/**', lambda r: r.abort())
                c.route('https://api.getbible.net/**', lambda r: r.abort())
                q = c.new_page(); qerr = []
                q.on('pageerror', lambda e: qerr.append(str(e)[:200]))
                try:
                    q.goto(base + 'index.html'); q.wait_for_selector('.welcome', timeout=8000); q.wait_for_timeout(600)
                    title = lambda: q.inner_text('#welcome-title')
                    if q.locator('.welcome-nav button', has_text='Not now').count() and 'Install' not in title():   # the sign-in step comes first when the cloud is on
                        q.locator('.welcome-nav button', has_text='Not now').click(); q.wait_for_timeout(400)
                    assert 'Install' in title(), 'install is not the first step: %r' % title()
                    q.click('.welcome-nav button.primary'); q.wait_for_timeout(400)
                    assert 'Your church' in title(), title()
                    assert q.locator('select[aria-label="Main language"]').input_value() == 'en', 'English is not the default'
                    q.select_option('select[aria-label="Second language"]', 'xh')
                    q.select_option('select[aria-label="Third language"]', 'xh')   # the same language twice is cleared
                    assert q.locator('select[aria-label="Third language"]').input_value() == '', 'a language could be chosen twice'
                    q.select_option('select[aria-label="Third language"]', 'tn'); q.wait_for_timeout(200)
                    for _ in range(6):
                        if 'Bibles and hymns' in title(): break
                        q.click('.welcome-nav button.primary'); q.wait_for_timeout(600)
                    assert 'Bibles and hymns' in title(), 'no download step: %r' % title()
                    q.wait_for_timeout(600)
                    q.locator('.welcome-card button', has_text='Download now').click()
                    end = time.time() + 20
                    while time.time() < end and 'Everything is on this device' not in q.inner_text('.welcome-card'): q.wait_for_timeout(300)
                    assert 'Everything is on this device' in q.inner_text('.welcome-card'), q.inner_text('.welcome-card')[-400:]
                    q.wait_for_timeout(500)
                    st = q.evaluate("[window.selah.settings.v.church.languages, window.selah.settings.v.bible.primary, window.selah.settings.v.bible.parallel, window.selah.settings.v.hymns.book]")
                    assert st == [['en', 'xh', 'tn'], 'kjv', 'imp-xho-bc', 'sda-online'], 'settings after the downloads: %r' % st
                    books = q.evaluate("import('./js/tabs/hymn-import.js').then(m => m.addedHymnbooks()).then(l => l.map(b => b.id).sort())")
                    assert books == ['web-rejnac-english', 'web-sid-tn', 'web-sid-xh'], 'hymnbooks: %r' % books
                    tsn = q.evaluate("import('./js/core/bibledata.js').then(m => m.listTranslations(true)).then(l => l.some(t => t.id === 'imp-tsn-eb'))")
                    assert tsn, 'the Setswana Bible (eBible corpus) was not added'
                    # Afrikaans: a church's own licensed file fills the built-in Advent Lofliedere by number.
                    n = q.evaluate("import('./js/tabs/hymn-import.js').then(m => m.fillBuiltInWords('afrikaans-sda', [{ n: 1, t: 'Buig', v: [['Reël een', 'Reël twee']] }, { n: 9999, t: 'x', v: [['y']] }]))")
                    assert n == 1, 'Advent Lofliedere words filled: %r' % n
                    assert not qerr, '; '.join(qerr[:3])
                finally:
                    c.close()
            t_setup_languages()

            @check('Banners → Make: three sections, + Slide in the toolbar, Save asks the name, More menu')
            def t_banner_make():
                pg.evaluate("window.selah.showTab('ai')"); pg.wait_for_timeout(1200)
                secs = pg.evaluate("[...document.querySelectorAll('.bn-make .bn-sec')].map(d => [d.querySelector('summary').textContent, d.open])")
                assert secs == [['Kind and words', True], ['Colours and picture', False], ['Text style', False]], 'sections: %r' % secs
                assert pg.locator('.bn-make .bn-side-seg, .bn-make .bn-insert').count() == 0, 'the old tabs or Insert section are still there'
                kinds = pg.evaluate("[...document.querySelectorAll('select[aria-label=\"Kind of banner\"] option')].map(o => o.textContent)")
                assert 'Title' in kinds and 'Closing blessing' not in kinds, 'kinds: %r' % kinds
                pg.select_option('select[aria-label="Kind of banner"]', 'title'); pg.wait_for_timeout(600)
                big = pg.evaluate("(() => { const t = document.querySelector('.bn-screen .fb-title'); return t ? [t.textContent, parseFloat(getComputedStyle(t).fontSize)] : null; })()")
                assert big and big[0] == 'Divine Service', 'Title slide: %r' % big
                pg.select_option('select[aria-label="Kind of banner"]', 'announce'); pg.wait_for_timeout(500)
                assert pg.evaluate("document.querySelector('select[aria-label=\"Kind of banner\"]').value") == 'announce', 'kind not changed'
                n0 = pg.locator('.bn-strip-it').count()
                pg.locator('.se-toolbar button[aria-label="New slide"]').click(); pg.wait_for_timeout(200)
                pg.locator('.menu button', has_text='Blank slide').click(); pg.wait_for_timeout(600)
                assert pg.locator('.bn-strip-it').count() == n0 + 1, 'the toolbar + Slide did not add a slide'
                assert 'Not saved yet' in pg.inner_text('.bn-save-info'), pg.inner_text('.bn-save-info')
                pg.locator('.bn-actions button', has_text='Save').click(); pg.wait_for_timeout(300)
                assert pg.locator('.modal', has_text='Save banner').count() == 1, 'Save did not ask for a name'
                pg.fill('.modal input[aria-label="Banner name"]', 'Test notice')
                pg.locator('.modal .modal-f button', has_text='Save').click(); pg.wait_for_timeout(600)
                assert 'Test notice' in pg.inner_text('.bn-save-info'), 'saved name not shown: %r' % pg.inner_text('.bn-save-info')
                pg.locator('.bn-actions button', has_text='More').click(); pg.wait_for_timeout(200)
                items = pg.evaluate("[...document.querySelectorAll('.menu button')].map(b => b.textContent)")
                for want in ['Add to plan', 'Add to loop', 'Background music', 'Rename or move to group', 'Duplicate this banner', 'New banner']:
                    assert any(want in x for x in items), 'More menu lacks %r: %r' % (want, items)
                pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
                pg.evaluate("document.querySelector('.menu') && document.querySelector('.menu').remove()")
            t_banner_make()

            @check('Banners → Make on a 320 px phone: toolbar fits, actions on one row, + Slide by the slides')
            def t_banner_make_phone():
                c = b.new_context(viewport={'width': 320, 'height': 700}, service_workers='block', is_mobile=True, has_touch=True)
                q = c.new_page()
                try:
                    q.goto(base + 'index.html'); q.wait_for_timeout(1200)
                    q.evaluate("window.selah.settings.set('app.setupDone', true)")
                    for _ in range(3):
                        if q.locator('.welcome').count(): q.keyboard.press('Escape'); q.wait_for_timeout(300)
                    q.evaluate("window.selah.showTab('ai')"); q.wait_for_timeout(1500)
                    tb = q.evaluate("(() => { const t = document.querySelector('.bn-make .se-toolbar'); return [t.scrollWidth, t.clientWidth]; })()")
                    assert tb[0] <= tb[1] + 1, 'toolbar wider than the phone: %r' % tb
                    tops = q.evaluate("[...document.querySelectorAll('.bn-actions > .btn')].map(x => Math.round(x.getBoundingClientRect().top))")
                    assert len(set(tops)) == 1, 'action buttons on several rows: %r' % tops
                    assert q.locator('.bn-strip .bn-strip-add').is_visible(), '+ Slide is not beside the slides'
                    n0 = q.locator('.bn-strip-it').count()
                    q.locator('.bn-strip .bn-strip-add').click(); q.wait_for_timeout(200)
                    q.locator('.menu button', has_text='Blank slide').click(); q.wait_for_timeout(500)
                    assert q.locator('.bn-strip-it').count() == n0 + 1, '+ Slide did not add a slide on the phone'
                finally:
                    c.close()
            t_banner_make_phone()

            @check('Shared Hymns: grouped list, Malmesbury in English 101–148, a book per language, new song asks the language')
            def t_shared_hymns():
                pg.evaluate("window.selah.showTab('hymns').then((t) => t.whenReady && t.whenReady())"); pg.wait_for_timeout(600)
                groups = pg.evaluate("[...document.querySelectorAll('select[aria-label=Hymnbook] optgroup')].map(g => [g.label, [...g.children].map(o => o.textContent)])")
                assert groups and groups[0][0] == 'Hymnals' and 'SDA Hymnal 1985 (698)' in groups[0][1], 'hymnals: %r' % groups
                assert groups[-1][0] == 'Shared Hymns' and 'English (92)' in groups[-1][1], 'shared: %r' % groups
                assert not any('Malmesbury' in o for g in groups for o in g[1]), 'Malmesbury Praise is still a separate book'
                # A plan made before the merge: Malmesbury Praise 1 opens as Shared Hymns – English 101.
                t = pg.evaluate("window.selah.tab('hymns').then(t => t.open({ n: 1, book: 'malmesbury' })).then(c => c && c.title)")
                assert t and 'Fill My Cup Lord' in t and '101' in t, 'old Malmesbury plan item: %r' % t
                # Shared hymns from other churches, by language (the list on GitHub, mocked here).
                doc = json.dumps({'rev': 1, 'updated': '2026-11-05', 'songs': [{'n': 501, 'lang': 'af', 't': 'Ek Sal Die Heer Loof', 'v': [['Ek sal die Heer loof', 'al my dae']], 'added': '2026-11-05'}]})
                route = lambda r: r.fulfill(status=200, body=doc, headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
                ctx.route('https://leemcq.github.io/**/shared.json*', route)
                try:
                    pg.evaluate("window.selah.settings.set('hymns.shared', ['en', 'af'])")
                    r = pg.evaluate("import('./js/core/community.js').then(m => m.syncCommunity({ force: true }))")
                    assert r.get('byLang') == {'af': 1}, 'sync: %r' % r
                    pg.evaluate("window.dispatchEvent(new CustomEvent('selah-hymnbooks', { detail: { select: 'shared-af' } }))"); pg.wait_for_timeout(900)
                    opts = pg.evaluate("[...document.querySelectorAll('select[aria-label=Hymnbook] optgroup[label=\"Shared Hymns\"] option')].map(o => o.textContent)")
                    assert 'Afrikaans (1)' in opts, 'Afrikaans shared book: %r' % opts
                    wait_text(pg, 'Ek Sal Die Heer Loof')
                    # New song: the language first, then the next number (below 501 for a church's own songs).
                    pg.locator('section .toolbar button[aria-label="More"]:visible').first.click(); pg.wait_for_timeout(200)
                    pg.locator('.menu button', has_text='New song').click(); pg.wait_for_timeout(400)
                    sel = 'select[aria-label="Language of the new song"]'
                    assert pg.locator(sel).input_value() == 'shared-af', 'language not preset to the open book'
                    num = lambda: pg.locator('.modal input[type=number]').input_value()
                    assert num() == '1', 'first own Afrikaans number: %r' % num()
                    pg.select_option(sel, 'choruses'); pg.wait_for_timeout(200)
                    assert num() == '149', 'next own English number: %r' % num()
                    pg.select_option(sel, 'shared-af'); pg.wait_for_timeout(200)
                    pg.locator('.modal input[placeholder="Title"]').fill('Ons Lied')
                    pg.locator('.modal textarea').fill('Reël een\nReël twee')
                    # The install card must never cover a dialog's buttons (it did, 5 Nov 2026).
                    assert pg.evaluate("(() => { const b = [...document.querySelectorAll('.modal .modal-f button')].find(x => x.textContent === 'Save'); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!top && (top === b || b.contains(top)); })()"), 'something covers the Save button of the dialog'
                    pg.locator('.modal .modal-f button', has_text='Save').click(); pg.wait_for_timeout(600)
                    opts = pg.evaluate("[...document.querySelectorAll('select[aria-label=Hymnbook] optgroup[label=\"Shared Hymns\"] option')].map(o => o.textContent)")
                    assert 'Afrikaans (2)' in opts, 'the new song is not in Afrikaans: %r' % opts
                    assert pg.locator('button', has_text='Share with all churches').first.is_visible(), 'cannot share the new song'
                finally:
                    ctx.unroute('https://leemcq.github.io/**/shared.json*', route)
                    pg.evaluate("window.selah.settings.set('hymns.shared', [])")
            t_shared_hymns()

            @check('new address: the old copy moves its data to ssdesk.online in one step')
            def t_move_address():
                def serve_as(prefix):
                    def handler(route):
                        from urllib.parse import urlparse
                        path = urlparse(route.request.url).path
                        rel = path[len(prefix):] if path.startswith(prefix) else path.lstrip('/')
                        f = os.path.join(ROOT, rel or 'index.html')
                        if os.path.isdir(f): f = os.path.join(f, 'index.html')
                        if os.path.isfile(f): route.fulfill(path=f, headers={'Access-Control-Allow-Origin': '*'})
                        else: route.fulfill(status=404, body='')
                    return handler
                c = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
                c.route('https://leemcq.github.io/SDA_Sabbath/**', serve_as('/SDA_Sabbath/'))
                c.route('https://ssdesk.online/**', serve_as('/'))
                c.route('https://**.supabase.co/**', lambda r: r.abort())
                try:
                    old = c.new_page()
                    old.goto('https://leemcq.github.io/SDA_Sabbath/index.html'); old.wait_for_timeout(1500)
                    for _ in range(3):
                        if old.locator('.welcome').count(): old.keyboard.press('Escape'); old.wait_for_timeout(300)
                    old.evaluate("""async () => {
                      window.selah.settings.set('church.name', 'Move Test Church');
                      const { db } = await import('./js/core/db.js');
                      await db.put('hymnbooks', 'book-move', { id: 'book-move', name: 'Moved hymnbook', lang: 'en', hymns: [{ n: 1, t: 'Song', v: [['Line']] }] });
                    }""")
                    old.evaluate("import('./js/move.js').then(m => m.offerMove())"); old.wait_for_timeout(300)
                    assert 'ssdesk.online' in old.inner_text('.modal'), 'the move message does not name the new address'
                    with c.expect_page(timeout=15000) as pop:
                        old.locator('.modal .modal-f button', has_text='Move my data').click()
                    new = pop.value
                    new.wait_for_selector('.modal >> text=Bring in your data', timeout=20000)
                    assert '1 hymnbooks' in new.inner_text('.modal') or 'hymnbooks' in new.inner_text('.modal'), new.inner_text('.modal')
                    with new.expect_navigation(timeout=20000):
                        new.locator('.modal .modal-f button', has_text='Bring it in').click()
                    new.wait_for_timeout(1500)
                    got = new.evaluate("""async () => {
                      const { db } = await import('./js/core/db.js');
                      const bk = await db.get('hymnbooks', 'book-move');
                      return [location.hostname, bk && bk.name, window.selah && window.selah.settings.v.church.name];
                    }""")
                    assert got == ['ssdesk.online', 'Moved hymnbook', 'Move Test Church'], 'at the new address: %r' % got
                    wait_text(old, 'Moved ✓')
                finally:
                    c.close()
            t_move_address()

            @check('remote buttons (Stream Deck) control the app')
            def t_remote():
                L = lambda: pg.evaluate("import('./js/core/live.js').then(m => ({ live: m.live.cue && m.live.cue.title, i: m.live.index, staged: m.live.staged && m.live.staged.title, blank: m.live.blank }))")
                pg.evaluate("window.selah.remoteCommand('goto', { q: 'Psalm 23' })"); pg.wait_for_timeout(1200)
                s1 = L(); assert s1['staged'] and 'Psalm' in s1['staged'], 'goto staged %r' % s1
                pg.evaluate("window.selah.remoteCommand('present')"); pg.wait_for_timeout(1000)
                s2 = L(); assert s2['live'] and 'Psalm' in s2['live'], 'present: live %r' % s2
                pg.evaluate("window.selah.remoteCommand('next')"); pg.wait_for_timeout(500)
                assert L()['i'] == s2['i'] + 1, 'next did not move'
                pg.evaluate("window.selah.remoteCommand('black')"); pg.wait_for_timeout(300)
                assert L()['blank'] == 'black', 'black did not switch on'
                pg.evaluate("window.selah.remoteCommand('black')"); pg.wait_for_timeout(300)
                assert not L()['blank'], 'black did not switch off'
            t_remote()

            @check('a PDF opens on Next and taps never present')
            def t_pdf():
                L = lambda: pg.evaluate("import('./js/core/live.js').then(m => ({ live: m.live.cue && m.live.cue.title, i: m.live.index, staged: m.live.staged && m.live.staged.title }))")
                before = L()['live']
                pg.evaluate("window.selah.showTab('slides')"); pg.wait_for_timeout(600)
                pg.locator('.tabpanel:not([hidden]) input[type=file]').first.set_input_files(os.path.join(HERE, 'fixtures', 'deck.pdf'))
                for _ in range(40):
                    if L()['staged'] == 'deck': break
                    pg.wait_for_timeout(250)
                s = L(); assert s['staged'] == 'deck' and s['live'] == before, 'opening the PDF changed live: %r' % s
                th = pg.locator('.tabpanel:not([hidden]) button.thumb')
                th.nth(1).click(); pg.wait_for_timeout(300); th.nth(1).dblclick(); pg.wait_for_timeout(500)
                assert L()['live'] == before, 'tapping a slide presented it'
                pg.click('#presentBtn'); pg.wait_for_timeout(1000)
                s = L(); assert s['live'] == 'deck' and s['i'] == 1, 'Present showed %r' % s
            t_pdf()

            @check('a backup file can be made and read back')
            def t_backup():
                r = pg.evaluate("""async () => {
                  const { db } = await import('./js/core/db.js');
                  await db.put('plans', 'smoke-plan', { id: 'smoke-plan', name: 'Smoke test plan', items: [], updated: Date.now() });
                  const b = await import('./js/core/backup.js');
                  const { blob, stats } = await b.buildBackup({ slides: true, videos: false, device: 'test' });
                  const pkg = await b.readBackup(new File([blob], 'x' + b.EXT));
                  return { plans: pkg.manifest.stores.plans.map((x) => x[0]), slides: stats.slides, size: blob.size };
                }""")
                assert 'smoke-plan' in r['plans'], 'plan missing from the backup: %r' % r
                assert r['slides'] >= 1, 'slides missing from the backup: %r' % r
            t_backup()

            @check('hymn music plays (SoundFont loads)')
            def t_music():
                r = pg.evaluate("""async () => {
                  const { MusicEngine } = await import('./js/core/musicengine.js');
                  const e = new MusicEngine(); e.unlock(); await e.init();
                  const an = e.ctx.createAnalyser(); an.fftSize = 2048; e.gain.connect(an);
                  await e.play({ book: 'sda-online', n: 73 });
                  await new Promise((r) => setTimeout(r, 5000));
                  const buf = new Float32Array(an.fftSize); let peak = 0;
                  for (let k = 0; k < 20; k++) { an.getFloatTimeDomainData(buf); for (const x of buf) peak = Math.max(peak, Math.abs(x)); await new Promise((r) => setTimeout(r, 50)); }
                  e.stop(); return peak;
                }""")
                assert r > 0.05, 'no sound (peak %.3f)' % r
            t_music()

            @check('high-quality piano and organ, church echo')
            def t_music_hq():
                r = pg.evaluate("""async () => {
                  const m = await import('./js/core/musicengine.js');
                  await m.hqRemove();
                  // The pack downloads in the background (a hymn never waits for it); then hymns use it.
                  const pre = await m.hqPrefetch();
                  const e = new m.MusicEngine(); e.unlock(); await e.init();
                  const an = e.ctx.createAnalyser(); an.fftSize = 2048; e.gain.connect(an);
                  const peakFor = async (instrument) => {
                    await e.play({ book: 'sda-online', n: 73, instrument, fx: { hq: 'on', room: 'church', natural: true } });
                    await new Promise((r) => setTimeout(r, 3500));
                    const buf = new Float32Array(an.fftSize); let peak = 0;
                    for (let k = 0; k < 20; k++) { an.getFloatTimeDomainData(buf); for (const x of buf) peak = Math.max(peak, Math.abs(x)); await new Promise((r) => setTimeout(r, 50)); }
                    e.stop(); return peak;
                  };
                  const piano = await peakFor('piano'), organ = await peakFor('organ');
                  const banks = e.synth.soundBankManager.priorityOrder;
                  return { pre, piano, organ, hq: e.hq, banks, stored: await m.hqStored(), wet: e.wet.gain.value, ir: e.conv.buffer && e.conv.buffer.duration };
                }""")
                assert r['hq'] and r['banks'][0] == 'hq', 'sound pack not in use: %r' % r
                assert r['stored'], 'sound pack not kept for offline use'
                assert r['piano'] > 0.05 and r['organ'] > 0.05, 'no sound: %r' % r
                assert r['ir'] and r['ir'] > 1.5 and r['wet'] > 0.1, 'church echo not on: %r' % r
            t_music_hq()

            @check('Studio piano and organ (all 16 piano layers)')
            def t_music_studio():
                r = pg.evaluate("""async () => {
                  const m = await import('./js/core/musicengine.js');
                  await m.hqRemove('studio');
                  const pre = await m.hqPrefetch('studio');
                  const e = new m.MusicEngine(); e.unlock(); await e.init();
                  const an = e.ctx.createAnalyser(); an.fftSize = 2048; e.gain.connect(an);
                  const peakFor = async (instrument) => {
                    await e.play({ book: 'sda-online', n: 73, instrument, fx: { hq: 'studio', room: 'church' } });
                    await new Promise((r) => setTimeout(r, 3500));
                    const buf = new Float32Array(an.fftSize); let peak = 0;
                    for (let k = 0; k < 20; k++) { an.getFloatTimeDomainData(buf); for (const x of buf) peak = Math.max(peak, Math.abs(x)); await new Promise((r) => setTimeout(r, 50)); }
                    e.stop(); return peak;
                  };
                  const piano = await peakFor('piano'), organ = await peakFor('organ');
                  const out = { pre, piano, organ, pack: e.pack, mem: navigator.deviceMemory, banks: e.synth.soundBankManager.priorityOrder, stored: await m.hqStored('studio'), hqKept: await m.hqStored('hq') };
                  await m.hqRemove('studio'); out.afterRemove = await m.hqStored('studio');
                  return out;
                }""")
                if r['mem'] is not None and r['mem'] < 4:
                    return  # low-memory devices use High quality instead
                assert r['pack'] == 'studio' and r['banks'][0] == 'hq', 'Studio pack not in use: %r' % r
                assert r['stored'] and r['hqKept'], 'packs not kept side by side: %r' % r
                assert r['piano'] > 0.05 and r['organ'] > 0.05, 'no sound: %r' % r
                assert not r['afterRemove'], 'Remove Studio did not remove it'
            t_music_studio()

            @check('sound settings change while a hymn plays')
            def t_music_live():
                r = pg.evaluate("""async () => {
                  const m = await import('./js/core/musicengine.js');
                  const e = new m.MusicEngine(); e.unlock(); await e.init();
                  const pre = e.ctx.createAnalyser(), post = e.ctx.createAnalyser();
                  [pre, post].forEach((a) => { a.fftSize = 8192; a.smoothingTimeConstant = 0; });
                  e.gain.connect(pre); e.eq[e.eq.length - 1].connect(post);
                  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
                  const band = async (lo, hi) => { const a = new Float32Array(pre.frequencyBinCount), b = new Float32Array(post.frequencyBinCount); let sa = 0, sb = 0;
                    for (let k = 0; k < 10; k++) { pre.getFloatFrequencyData(a); post.getFloatFrequencyData(b);
                      for (let i = Math.floor(lo / (e.ctx.sampleRate / 2) * a.length); i <= Math.ceil(hi / (e.ctx.sampleRate / 2) * a.length); i++) if (isFinite(a[i]) && isFinite(b[i]) && a[i] > -110) { sa += 10 ** (a[i] / 10); sb += 10 ** (b[i] / 10); }
                      await wait(60); }
                    return 10 * Math.log10(sb / sa); };
                  await e.play({ book: 'sda-online', n: 73, fx: { hq: 'off', room: 'church', eq: [0, 0, 0, 0, 0] } });
                  await wait(2500);
                  e.applyEffects({ eq: [12, 0, 0, 0, -12], room: 'large' }); await wait(400);
                  const bass = await band(40, 90), treble = await band(8000, 12000), wet = e.wet.gain.value;
                  const t0 = e.seq.currentTime; e.rearrange({ instrument: 'organ', natural: false }); await wait(600);
                  const r = { bass, treble, wet, carried: e.seq.currentTime >= t0 - 0.2, playing: e.playing };
                  e.stop(); return r;
                }""")
                assert r['bass'] > 8 and r['treble'] < -8, 'equaliser not applied while playing: %r' % r
                assert r['wet'] > 0.3, 'church echo not changed while playing: %r' % r
                assert r['carried'] and r['playing'], 'instrument change restarted or stopped the hymn: %r' % r
            t_music_live()

            @check('phones: nothing runs off the screen (portrait and landscape)')
            def t_phone():
                bad_tabs = []
                for (w, hh) in [(320, 640), (360, 740), (844, 390), (740, 360)]:  # 320: a 412 px phone with Android's page zoom at 130 %
                    c2 = b.new_context(viewport={'width': w, 'height': hh}, is_mobile=True, has_touch=True, service_workers='block')
                    p2 = c2.new_page(); e2 = []
                    p2.on('pageerror', lambda e: e2.append(str(e)[:120]))
                    p2.goto(base + 'index.html'); p2.wait_for_timeout(800)
                    p2.evaluate("import('./js/core/settings.js').then(m => (m.settings.set('app.setupDone', true), m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() }))))")
                    p2.reload(); p2.wait_for_selector('#presentBtn'); p2.wait_for_timeout(1200)
                    p2.evaluate("import('./js/core/settings.js').then(m => m.settings.set('app.planView', 'advanced'))"); p2.wait_for_timeout(300)   # the plan editor (Basic is checked below)
                    p2.evaluate("window.selah.showTab('plan')"); p2.wait_for_timeout(300)
                    for q in ['Closing prayer', 'hymn 135', 'John 3:16']:   # parts with buttons, so the plan rows are tested too
                        bx = p2.locator('.tabpanel:not([hidden]) input.field').first; bx.fill(q); bx.press('Enter'); p2.wait_for_timeout(300)
                    for t in TABS:
                        p2.evaluate('id => window.selah.showTab(id)', t); p2.wait_for_timeout(350)
                        # A tab's page area must not be wider than the phone (toolbars and button rows may scroll sideways on purpose).
                        inner = p2.evaluate("""() => [...document.querySelectorAll('.tabpanel:not([hidden]) .scroll, .tabpanel:not([hidden]) .plan-list, .tabpanel:not([hidden]) .split')]
                          .filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2).map((e) => e.className + ' ' + (e.scrollWidth - e.clientWidth) + 'px')""")
                        if inner: bad_tabs.append('%dx%d %s: %s' % (w, hh, t, inner[0]))
                        over = p2.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                        present = p2.evaluate("(() => { const r = document.getElementById('presentBtn').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })()")
                        if over > 1 or not present: bad_tabs.append('%dx%d %s (%dpx wider%s)' % (w, hh, t, over, '' if present else ', Present off screen'))
                    # The Plan tab in Basic: the same plan, the big buttons and the Present button all on the screen.
                    p2.evaluate("window.selah.showTab('plan')"); p2.wait_for_timeout(300)
                    p2.evaluate("import('./js/core/settings.js').then(m => m.settings.set('app.planView', 'basic'))"); p2.wait_for_timeout(500)
                    over = p2.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                    fits = p2.evaluate("""(() => ['#presentBtn', '.bb-next', '.bb-blank', '.plan-view'].every((q) => { const r = document.querySelector(q).getBoundingClientRect();
                      return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }))()""")
                    if over > 1 or not fits: bad_tabs.append('%dx%d Plan Basic (%dpx wider%s)' % (w, hh, over, '' if fits else ', a button off screen'))
                    assert not e2, '%dx%d: %s' % (w, hh, e2[0])
                    c2.close()
                assert not bad_tabs, '; '.join(bad_tabs[:4])
            t_phone()

            @check('works offline after the first visit (Bible, hymns, music, pages)')
            def t_offline():
                c3 = b.new_context(viewport={'width': 1280, 'height': 800})
                p3 = c3.new_page()
                p3.goto(base + 'index.html'); p3.wait_for_timeout(800)
                p3.evaluate("import('./js/core/settings.js').then(m => (m.settings.set('app.setupDone', true), m.settings.set('backup', Object.assign({}, m.settings.v.backup, { remindAt: Date.now() }))))")
                st = None
                for _ in range(150):   # the service worker stores every file of the app
                    st = p3.evaluate("""async () => { const m = await (await fetch('asset-manifest.json', { cache: 'no-store' })).json();
                      const ks = (await caches.keys()).filter((k) => k.startsWith('selah-/'));
                      if (!ks.length) return [0, m.files.length];
                      return [(await (await caches.open(ks[ks.length - 1])).keys()).length, m.files.length]; }""")
                    if st[0] >= st[1]: break
                    p3.wait_for_timeout(1000)
                assert st and st[0] >= st[1], 'not everything stored: %r' % st
                p3.reload(); p3.wait_for_timeout(1500)
                c3.set_offline(True)
                e3 = []
                p3.on('pageerror', lambda e: e3.append(str(e)[:150]))
                p3.reload(); p3.wait_for_selector('#presentBtn', timeout=20000); p3.wait_for_timeout(1500)
                for t in TABS:
                    p3.evaluate('id => window.selah.showTab(id)', t); p3.wait_for_timeout(400)
                r = p3.evaluate("""async () => {
                  const b = await window.selah.tab('bible'); await b.open({ ref: 'John 3:16' });
                  const { live } = await import('./js/core/live.js');
                  const staged = live.staged && live.staged.title;
                  window.selah.showTab('hymns'); await new Promise((r) => setTimeout(r, 800));
                  const rows = document.querySelectorAll('.tabpanel:not([hidden]) .list > button').length;
                  const midi = await (await fetch('data/music/sda-online-midi.zip')).arrayBuffer();
                  return { staged, rows, midi: midi.byteLength }; }""")
                assert r['staged'] == 'John 3:16' and r['rows'] > 100 and r['midi'] > 100000, 'offline: %r' % r
                for pgname in ('display.html', 'stage.html', 'privacy.html'):
                    q = c3.new_page(); q.goto(base + pgname, timeout=15000); q.wait_for_timeout(600)
                    assert 'SDA Sabbath' in q.title(), pgname + ' offline: ' + q.title()
                    q.close()
                assert not e3, '; '.join(e3[:3])
                c3.close()
            t_offline()

            @check('OBS page: not connected after 15 s shows why, with the church-network address')
            def t_obs_timeout():
                e4, b4 = [], []
                q = new_page(ctx, e4, b4)
                q.goto(base + 'obs.html?mode=lower&lan=http://192.168.1.20:7777'); q.wait_for_timeout(16500)
                t = q.inner_text('.obs-pill')
                assert 'not connected after 15 s' in t and 'http://192.168.1.20:7777/obs.html?via=lan&mode=lower' in t, 'OBS banner: %s' % t
                q.goto(base + 'obs.html?mode=full&lan=javascript:alert(1)'); q.wait_for_timeout(16500)
                t = q.inner_text('.obs-pill')
                assert 'http://localhost:7777/obs.html?via=lan&mode=full' in t and 'javascript' not in t, 'OBS banner (bad lan): %s' % t
                q.close()
                assert not e4, '; '.join(e4[:3])
            t_obs_timeout()

            @check('no errors on the main page')
            def t_clean():
                assert not errs, '; '.join(errs[:3])
                assert not bad, '; '.join(bad[:3])
            t_clean()
            b.close()
    finally:
        httpd.shutdown()
    fails = [r for r in results if not r[1]]
    print('\n%d passed, %d failed' % (len(results) - len(fails), len(fails)))
    sys.exit(len(fails))


if __name__ == '__main__':
    main()
