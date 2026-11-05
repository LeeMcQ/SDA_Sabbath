#!/usr/bin/env python3
"""Shared Hymns inbox: songs sent from the app (Hymns → Share with all churches) arrive in the SDA Sabbath cloud
(Supabase, feedback with page 'share-hymn'). Every hour (.github/workflows/hymn-inbox.yml) this turns each new one
into a "Hymn:" issue for the maintainer, runs the robot's checks on it (tools/chorus_bot.py) and tells the church in
the app that it arrived. Approving works as before: the label "chorus-approved" publishes it; the church then sees
"Published as number … in Shared Hymns – …" in Settings → Account → My messages and replies.

Settings: SUPABASE_SERVICE_KEY (secret), SUPABASE_URL (optional), GH_TOKEN, AUTO_PUBLISH (optional).
Only standard Python is used. The song text is untrusted: it is only parsed as text, never run.
"""
import base64, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import chorus_bot as bot  # noqa: E402

def rest(method, path, data=None):
    return bot.cloud(method, path, data)


def answer(fid, status, reply):
    bot.cloud_answer(fid, status, reply)


def issue_body(row):
    i = row.get('info') or {}
    lyrics = str(i.get('lyrics') or '').replace('```', "'''")
    nr = lambda v: (str(v).strip() or '_No response_')
    return '\n'.join([
        'Sent from the SDA Sabbath app (Hymns → Share with all churches).', '<!-- cloud-message: %d -->' % row['id'], '',
        '### Song title', '', nr(i.get('t')), '',
        '### Language', '', nr(i.get('language') or i.get('lang')), '',
        '### Writer', '', nr(i.get('a')), '',
        '### Lyrics', '', '```text', lyrics, '```', '',
        '### May these words be shared with every church?', '', nr(i.get('rights')), '',
        '### Shared by (church)', '', nr(i.get('church')), '',
        '### MIDI file (optional)', '', '_No response_', '',
        '### Confirmation', '', '- [X] I am allowed to share these words, and they may be shown in every church that uses SDA Sabbath.'])


def main():
    if not os.environ.get('SUPABASE_SERVICE_KEY'):
        print('No SUPABASE_SERVICE_KEY secret yet (GitHub → Settings → Secrets and variables → Actions). Nothing to do.')
        return
    rows = rest('GET', 'feedback?page=eq.share-hymn&status=eq.new&select=id,info,created_at&order=id.asc&limit=20') or []
    print(len(rows), 'new shared songs')
    if not rows:
        return
    bot.ensure_labels()
    for row in rows:
        info = row.get('info') or {}
        if info.get('share') != 'hymn' or not info.get('t'):
            answer(row['id'], 'seen', 'Thank you. This message could not be read as a song.')
            continue
        f = bot.parse_form(issue_body(row))
        song, midi, errors, warns, notes = bot.run_checks(f)
        if info.get('midi'):   # the church's own MIDI, sent with the song (small files only)
            try:
                raw = base64.b64decode(info['midi'])[:2 * 1048576]
                if raw[:4] == b'MThd':
                    midi = raw
                    notes.append('MIDI: sent by the church with the song (%d KB).' % max(1, len(raw) // 1024))
            except Exception:
                pass
        lang = bot.lang_of(f)
        issue = bot.api('POST', '/repos/%s/issues' % bot.REPO, {'title': 'Hymn: ' + song['t'], 'body': issue_body(row), 'labels': ['chorus']})
        num = issue['number']
        answer(row['id'], 'seen', 'Thank you for “%s” (%s). It arrived and is being checked.' % (song['t'], bot.lang_name(lang)))   # never twice
        auto = os.environ.get('AUTO_PUBLISH', '').strip().lower() == 'true' and not errors and not warns
        bot.comment(num, bot.report(song, errors, warns, notes, auto))
        bot.set_labels(num, add=['chorus', 'chorus-needs-attention' if (errors or warns) else 'chorus-checked'])
        if errors:
            answer(row['id'], 'seen', 'Thank you for “%s”. It cannot be shared yet: %s' % (song['t'], ' '.join(errors)[:900]))
            continue
        if auto:
            n = bot.publish(num, f, song, midi, False)
            if n:
                bot.set_labels(num, add=['chorus-published'], remove=['chorus-checked'])
                bot.api('PATCH', '/repos/%s/issues/%d' % (bot.REPO, num), {'state': 'closed', 'state_reason': 'completed'})
                answer(row['id'], 'done', 'Published as number %d in Shared Hymns – %s. Every church with %s gets it when it is online. Thank you!' % (n, bot.lang_name(lang), bot.lang_name(lang)))
                continue
        answer(row['id'], 'seen', 'Thank you for “%s” (%s). It arrived and is waiting for the maintainer to check it.' % (song['t'], bot.lang_name(lang)))
        # On approval the robot fetches the church's MIDI from the cloud (tools/chorus_bot.py, cloud_midi).


if __name__ == '__main__':
    main()
