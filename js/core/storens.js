// Keeps this app's saved data apart from any other app on the same website.
//
// leemcq.github.io serves several apps from one origin (SDA_Sabbath, Church_Service, …). A browser gives one
// origin a single localStorage, sessionStorage, IndexedDB and Cache Storage, so names decide what is shared.
//
// SDA_Sabbath is the app that first used the 'selah…' names, so what it saved before stays exactly where it is
// (settings, plans, hymnbooks, slides, stage screens): nothing is copied or moved, and nothing is lost.
// Church_Service copied that data once when it separated and has used its own 'cs/Church_Service/…' names since;
// it never changes or deletes these.
//
// Everything that came with newer features is named after this app's own address folder ('ss/SDA_Sabbath/…'), so
// it never picks up what another app saved under the old shared names (a Google or cloud sign-in, for example).
import { APP_SCOPE } from './util.js';

export const NS = 'ss' + APP_SCOPE;                 // 'ss/SDA_Sabbath/'

/** This app's names from before the separation (short name → stored name): kept so existing data carries on. */
const KEPT = {
  'settings.v1': 'selah.settings.v1',
  'aikey.session': 'selah.aikey.session',            // sessionStorage
  'castId': 'selah.castId',                          // sessionStorage
  'stage.local': 'selah.stage.local',
  'stage.hosts': 'selah.stage.hosts',
  'slide-clipboard': 'selah-slide-clipboard',
  'recent-colours': 'selah-recent-colours',
  'bn-wide': 'selah-bn-wide',
  'ai-history': 'selah-ai-history',
};
export const lsKey = (name) => KEPT[name] || NS + name;
export const DB_NAME = 'selah';                     // IndexedDB: this app's database since the start
export const CACHE_NS = NS + 'cache:';              // Cache Storage names (not the service worker's own)

/** Old 'selah…' name → short name. Backup files use the short names; older backups used these. */
export const LEGACY_LOCAL = Object.fromEntries(Object.entries(KEPT).map(([short, stored]) => [stored, short]));
