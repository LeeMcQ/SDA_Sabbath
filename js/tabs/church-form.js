// "Your church" form, used in Settings → Church and in the Banners tab. Every field saves as it changes.
import { h } from '../core/util.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/ui.js';
import { sunTimes, hhmm, safeGivingUrl } from '../core/church.js';

export function churchForm(settings, onChange) {
  const C = () => settings.v.church || {};
  const set = (k, v) => { settings.set('church.' + k, v); if (onChange) onChange(k, v); showSun(); };
  const text = (k, ph, attrs) => h('input.field', Object.assign({ value: C()[k] || '', placeholder: ph, style: { width: '100%' },
    onchange: (e) => { set(k, e.target.value.trim()); if (k === 'name' || k === 'town') autoLocate(); } }, attrs || {}));

  const lat = h('input.field', { inputmode: 'decimal', placeholder: 'Latitude, e.g. -33.46', 'aria-label': 'Latitude', style: { width: '150px' },
    value: C().lat == null ? '' : String(C().lat), onchange: () => setNum('lat', lat, 90) });
  const lon = h('input.field', { inputmode: 'decimal', placeholder: 'Longitude, e.g. 18.73', 'aria-label': 'Longitude', style: { width: '150px' },
    value: C().lon == null ? '' : String(C().lon), onchange: () => setNum('lon', lon, 180) });
  function setNum(k, inp, max) {
    const v = inp.value.trim().replace(',', '.');
    if (!v) { set(k, null); return; }
    const n = +v;
    if (!isFinite(n) || Math.abs(n) > max) { toast('That ' + (k === 'lat' ? 'latitude' : 'longitude') + ' is not valid.', 'err'); inp.value = C()[k] == null ? '' : String(C()[k]); return; }
    set(k, Math.round(n * 10000) / 10000);
  }
  const here = h('button.btn.sm', { type: 'button', onclick: () => {
    if (!navigator.geolocation) { toast('This device cannot share its location. Type the numbers instead.', 'err'); return; }
    here.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      here.disabled = false;
      lat.value = String(Math.round(p.coords.latitude * 10000) / 10000); setNum('lat', lat, 90);
      lon.value = String(Math.round(p.coords.longitude * 10000) / 10000); setNum('lon', lon, 180);
      toast('Location saved. Sunset times now work offline.', 'ok');
    }, (e) => { here.disabled = false; toast('Location not available (' + (e.message || 'permission refused') + '). Type the numbers instead.', 'err', 6000); },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  } }, icon('pin'), h('span', 'Use this device’s location'));
  // Name or town typed and no location yet: look the place up online (Open-Meteo place search, no account needed);
  // if nothing is found, ask this device for its location. Only runs when online and only fills an empty location.
  let locating = false;
  async function autoLocate() {
    const c = C();
    if (locating || typeof c.lat === 'number' || typeof c.lon === 'number') return;
    const q = (c.town || '').trim() || (c.name || '').replace(/\b(seventh[- ]day adventist|sda|church|congregation|assembly|company)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 3) return;
    locating = true;
    try {
      let hit = null;
      try {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=3&language=en&format=json&name=' + encodeURIComponent(q));
        const j = r.ok ? await r.json() : null;
        hit = j && j.results && j.results[0];
      } catch (e) { /* offline: fall back to the device */ }
      if (hit && typeof C().lat !== 'number') {
        lat.value = String(Math.round(hit.latitude * 10000) / 10000); setNum('lat', lat, 90);
        lon.value = String(Math.round(hit.longitude * 10000) / 10000); setNum('lon', lon, 180);
        toast('Location estimated: ' + [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ') + '. Check it, or use this device’s location.', 'ok', 7000);
      } else if (!hit && navigator.geolocation && typeof C().lat !== 'number') {
        toast('Could not find “' + q + '” online. Allow this device to share its location to fill it in.', '', 5000);
        here.click();
      }
    } finally { locating = false; }
  }
  const sunNote = h('p.note');
  function showSun() {
    const c = C();
    if (typeof c.lat !== 'number' || typeof c.lon !== 'number') { sunNote.textContent = 'Needed only for the sunset time on banners. Find it on a map app (long-press your church), or press the button while at church.'; return; }
    const t = sunTimes(new Date(), c.lat, c.lon);
    sunNote.textContent = t ? 'Sunset today: ' + hhmm(t.sunset) + ' (worked out on this device, no internet needed).' : 'No sunset at this location today.';
  }
  showSun();
  const svc = h('input.field', { type: 'time', value: C().service || '09:30', 'aria-label': 'Service starts at', style: { width: '130px' },
    onchange: () => { if (/^\d{1,2}:\d{2}$/.test(svc.value)) set('service', svc.value); } });
  const giving = text('givingUrl', 'https://… (SnapScan, Zapper or online giving page)', { inputmode: 'url', onchange: (e) => {
    const v = e.target.value.trim();
    if (v && !safeGivingUrl(v)) { toast('Use a full https:// link for the giving QR code.', 'err'); return; }
    set('givingUrl', v ? safeGivingUrl(v) : '');
    e.target.value = v ? safeGivingUrl(v) : '';
  } });

  return h('div.form',
    h('label', 'Church name'), text('name', 'e.g. Malmesbury SDA Church'),
    h('label', 'Town'), text('town', 'e.g. Malmesbury'),
    h('label', 'Conference'), h('div.col', text('conference', 'e.g. Cape Conference'), h('p.note', 'Shown with the union under the church name on the default logo slide and in the order of service.')),
    h('label', 'Union'), text('union', 'e.g. Southern Africa Union Conference'),
    h('label', 'Location'), h('div.col', { style: { alignItems: 'flex-start' } }, h('div.row.wrap', lat, lon), here, sunNote),
    h('label', 'Service starts'), h('div.row', svc, h('span.note', 'Used by the countdown')),
    h('label', 'Giving link'), h('div.col', giving, h('p.note', 'Shown as a QR code on the Tithe & offering banner. Only https:// links.')),
    h('label', 'QR caption'), text('givingLabel', 'Scan to give online'));
}
