// When the Sabbath begins and ends (sunset Friday to sunset Sabbath), worked out on the device with no internet.
// No settings here, so the display, stage and OBS pages can use it as well as the control app.
const RAD = Math.PI / 180;
/**
 * Sunrise and sunset for a local calendar day (NOAA / "sunrise equation", within about 2 minutes).
 * lat: degrees north (South Africa is negative), lon: degrees east. Returns Dates, or null near the poles.
 */
export function sunTimes(day, lat, lon) {
  const jdNoon = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12) / 86400000 + 2440587.5;
  const n = Math.round(jdNoon - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinD = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinD) / (Math.cos(lat * RAD) * cosD);
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { sunrise: toDate(jTransit - w / 360), sunset: toDate(jTransit + w / 360) };
}

export const hhmm = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });


/**
 * Is it the Sabbath now? lat/lon: the church's location (Settings → Church). Without a location, Friday from
 * 18:00 until Sabbath 18:00 counts, and no times are given.
 * Returns { on, begins: Date|null, ends: Date|null }.
 */
export function sabbathNow(now = new Date(), lat = null, lon = null) {
  const day = now.getDay();
  const sunset = (d) => { const t = lat != null && lon != null ? sunTimes(d, lat, lon) : null; return t ? t.sunset : null; };
  const at6 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0);
  const shift = (n) => { const d = new Date(now); d.setDate(now.getDate() + n); return d; };
  const known = lat != null && lon != null;
  const edge = (d) => sunset(d) || at6(d);
  // Near the poles the sun may not set for weeks (or not rise): 18:00 is used then, and the words say so.
  if (day === 5 && now >= edge(now)) return { on: true, begins: known ? edge(now) : null, ends: known ? edge(shift(1)) : null, noSunset: known && (!sunset(now) || !sunset(shift(1))) };
  if (day === 6 && now < edge(now)) return { on: true, begins: known ? edge(shift(-1)) : null, ends: known ? edge(now) : null, noSunset: known && (!sunset(shift(-1)) || !sunset(now)) };
  const toFri = (5 - day + 7) % 7 || 7;
  return { on: false, begins: known ? sunset(shift(day === 5 ? 0 : toFri)) : null, ends: null };
}

/** The greeting and the closing time in the church's language ('af' = Afrikaans). */
export function sabbathWords(state, lang = 'en') {
  const af = lang === 'af';
  return {
    greeting: af ? 'Geseënde Sabbat' : 'Happy Sabbath',
    ends: state && state.noSunset
      ? (af ? 'Geen sononder hier vandag nie: die Sabbat eindig om ' : 'No sunset at this latitude today: the Sabbath ends at ') + hhmm(state.ends || new Date(2000, 0, 1, 18, 0))
      : state && state.ends ? (af ? 'Die Sabbat eindig met sononder om ' : 'Sabbath ends at sunset, ') + hhmm(state.ends) : '',
  };
}
