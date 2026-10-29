// The church's own details (name, town, location, service time, giving link) and the dates and
// sunset times worked out from them, offline. Used by Banners and Settings → Church.
import { settings } from './settings.js';

export const church = () => {
  const c = settings.v.church || {};
  return {
    name: (c.name || '').trim() || (settings.v.display.logoText || '').trim(),
    town: (c.town || '').trim(),
    conference: (c.conference || '').trim(),
    union: (c.union || '').trim(),
    lat: typeof c.lat === 'number' && isFinite(c.lat) ? c.lat : null,
    lon: typeof c.lon === 'number' && isFinite(c.lon) ? c.lon : null,
    service: /^\d{1,2}:\d{2}$/.test(c.service || '') ? c.service : '09:30',
    givingUrl: (c.givingUrl || '').trim(),
    givingLabel: (c.givingLabel || '').trim() || 'Scan to give online',
  };
};
export const hasLocation = () => { const c = church(); return c.lat != null && c.lon != null; };

export { sunTimes, hhmm } from './sabbath.js';
import { sunTimes, hhmm } from './sabbath.js';

/** "Sabbath begins at sunset: 18:52" (Friday), "Sabbath ends at sunset: 18:53" (Sabbath), else next Friday's. */
export function sabbathSunsetLine(now = new Date()) {
  const c = church();
  if (c.lat == null || c.lon == null) return '';
  const day = now.getDay();
  if (day === 6) { const t = sunTimes(now, c.lat, c.lon); return t ? 'Sabbath ends at sunset: ' + hhmm(t.sunset) : ''; }
  const fri = new Date(now); fri.setDate(now.getDate() + ((5 - day + 7) % 7));
  const t = sunTimes(fri, c.lat, c.lon);
  if (!t) return '';
  return (day === 5 ? 'Sabbath begins at sunset: ' : 'Sabbath begins Friday at sunset: ') + hhmm(t.sunset);
}

/** The coming Sabbath (today when it is Saturday). */
export function nextSabbath(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}
/** "Sabbath, 17 October 2026" */
export function sabbathDateLine(now = new Date()) {
  return 'Sabbath, ' + nextSabbath(now).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * When "HH:MM" next happens: today, unless that was more than three hours ago (then tomorrow).
 * A countdown that ran out a few minutes ago keeps showing its "Welcome" text instead of jumping a day.
 */
export function nextTime(hm, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!m) return null;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0, 0);
  if (now - t > 3 * 3600000) t.setDate(t.getDate() + 1);
  return t;
}

/** Only https links (and plain web addresses) become giving QR codes. */
export function safeGivingUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (/^www\./i.test(u)) u = 'https://' + u;
  return /^https:\/\/[^\s]+$/i.test(u) && u.length <= 600 ? u : '';
}
