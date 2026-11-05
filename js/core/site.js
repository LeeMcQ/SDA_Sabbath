// Where SDA Sabbath is published. The new address is ssdesk.online ("Sabbath Service Desk"); the old one,
// leemcq.github.io/SDA_Sabbath/, redirects there once GitHub Pages has the custom domain.
// LIVE: true since https://ssdesk.online/ opens the app; copies that run elsewhere (the companion, localhost) use it.
// The old address is kept here only so copies installed there can move their data (js/move.js).
export const LIVE = true;   // ssdesk.online opens the app (5 Nov 2026)
export const NEW_HOST = 'ssdesk.online';
export const NEW_SITE = 'https://ssdesk.online/';
export const OLD_ORIGIN = 'https://leemcq.github.io';
export const OLD_SITE = OLD_ORIGIN + '/SDA_Sabbath/';
/** The published site, for copies that run from the companion or localhost. */
export const PUBLIC_SITE = LIVE ? NEW_SITE : OLD_SITE;
const host = () => (typeof location !== 'undefined' ? location.hostname : '');
export const onNewSite = () => host() === NEW_HOST || host() === 'www.' + NEW_HOST;
export const onOldSite = () => /(^|\.)github\.io$/.test(host());
/** Running from one of the published addresses (not the companion or a file). */
export const onPublicSite = () => onNewSite() || onOldSite();
