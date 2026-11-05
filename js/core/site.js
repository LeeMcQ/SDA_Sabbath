// Where SDA Sabbath is published. The new address is ssdesk.online ("Sabbath Service Desk"); the old one,
// leemcq.github.io/SDA_Sabbath/, redirects there once GitHub Pages has the custom domain.
// LIVE: set to true (one line) once https://ssdesk.online/ opens the app; until then copies that run elsewhere
// (the companion, localhost) keep using the old address, which keeps working (it redirects after the switch).
export const LIVE = false;
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
