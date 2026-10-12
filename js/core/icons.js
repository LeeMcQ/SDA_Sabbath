// Inline stroke icons (24×24). Kept as path data so no icon font or sprite request is needed.
const P = {
  bible: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5"/><path d="M12 6v8M9 9h6"/>',
  hymn: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  slides: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M12 17v4M8 21h8M7 9h7M7 12h10"/>',
  video: '<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="m16.5 10 5-3v10l-5-3z"/>',
  web: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3.2 3 15.8 0 19M12 2.5c-3 3.2-3 15.8 0 19"/>',
  pc: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 16.5V21"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  present: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/><path d="m10 7.5 4.5 2.5-4.5 2.5z"/><path d="M8 21h8M12 16.5V21"/>',
  prev: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
  first: '<path d="m17 18-6-6 6-6M7 6v12"/>', last: '<path d="m7 18 6-6-6-6M17 6v12"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M7 4.5v15M17 4.5v15"/>', stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="1"/>',
  back10: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">10</text>',
  fwd10: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">10</text>',
  vol: '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  loop: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  black: '<rect x="3" y="4" width="18" height="14" rx="1.5" fill="currentColor"/>',
  clear: '<rect x="3" y="4" width="18" height="14" rx="1.5"/><path d="m9 8 6 6M15 8l-6 6"/>',
  logo: '<rect x="3" y="4" width="18" height="14" rx="1.5"/><circle cx="12" cy="11" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  cast: '<path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6M2 12a9 9 0 0 1 8 8M2 16a5 5 0 0 1 4 4M2 20h.01"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18h2"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18"/>',
  tab: '<path d="M3 20V8a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9z"/>',
  freeze: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  pip: '<rect x="2.5" y="4" width="19" height="15" rx="1.5"/><rect x="12" y="11" width="7" height="5.5" rx="1" fill="currentColor"/>',
  kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  reload: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  fullscreen: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
  snapshot: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  translate: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 8-7 9"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  fade: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  ab: '<text x="12" y="16" font-size="11" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-weight="700">A-B</text>',
  subtitle: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 14h4M12 14h6M6 10h8M16 10h2"/>',
};

export function icon(name, cls) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[name] || P.info;
  return s;
}
