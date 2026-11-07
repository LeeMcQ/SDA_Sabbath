// The default logo mark: a neutral open Bible with a cross, drawn for Sabbath Service Desk (no third-party trademark).
// The Seventh-day Adventist® Church symbol is a registered trademark of the General Conference and is not shipped:
// a church that may use it (or any church with its own logo) uploads its logo in Settings → Screen → Logo picture.
// SYMBOL_ROUND is the version used when the mark stands on its own (logo slide, banners, translator view).
const MARK = '<path d="M46 10h8v13h13v8H54v27h-8V31H33v-8h13z"/>' +
  '<path d="M8 60c14-6 28-5 39 3v29c-11-7-25-8-39-3z"/><path d="M92 60c-14-6-28-5-39 3v29c11-7 25-8 39-3z"/>';
export const SYMBOL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">' + MARK + '</svg>';
export const SYMBOL_ROUND = SYMBOL;
