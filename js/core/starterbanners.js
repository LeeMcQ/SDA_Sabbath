// Starter banners: six groups of three ready-to-use banners, added to Banners & Music → Saved banners on first
// use (and offered again from the Saved banners bar if some were removed). They are ordinary saved banners: the
// church can edit, rename, move or delete them.
//
// {church}, {town}, {service}, {date} and {sunset} fill themselves in from Church details when shown, so the
// same banners fit every church. Verse words are the King James Version (public domain, built in); the editor
// fills them from the church's own Bible when the reference is changed.
//
// Ids are fixed ('grp-start-…', 'b-start-…'): a banner the church deleted is not added back by itself, and a
// banner it edited is never overwritten.

export const STARTER_VERSION = 1;

const W = (id, name, tpl, f, x = {}, s = {}) => ({ id: 'b-start-' + id, name, tpl, f, x, s });

export const STARTER_GROUPS = [
  { id: 'grp-start-welcome', name: 'Welcomes', banners: [
    W('welcome-sabbath', 'Happy Sabbath', 'welcome',
      { kicker: '{church}', title: 'Happy Sabbath', text: 'Welcome to our worship service. We are glad you are here!' },
      { logo: true, date: true }, { pal: 'navy', deco: 'glow', font: 'advent' }),
    W('welcome-visitors', 'Welcome, visitors', 'welcome',
      { kicker: 'Welcome', title: 'You are among friends', text: 'Visiting today? Please stay after the service and say hello.', foot: '{church} · {town}' },
      { logo: true }, { pal: 'forest', deco: 'glow', font: 'advent' }),
    W('welcome-psalm', 'Welcome: Psalm 122:1', 'welcome',
      { kicker: '{church}', title: 'Welcome to the house of the Lord', text: '“I was glad when they said unto me, Let us go into the house of the LORD.”\nPsalm 122:1' },
      { logo: true, date: true }, { pal: 'plum', deco: 'rays', font: 'advent' }),
  ] },
  { id: 'grp-start-prayer', name: 'Prayers', banners: [
    W('prayer-pray', 'Let us pray', 'title', { title: 'Let us pray' }, {}, { pal: 'plum', deco: 'glow', font: 'advent', textBold: true }),
    W('prayer-requests', 'Prayer requests', 'announce',
      { kicker: 'Prayer', title: 'Prayer requests', text: 'Share your requests with the elders, or write them on a card at the door.', foot: '“Pray one for another” · James 5:16' },
      {}, { pal: 'slate', deco: 'waves' }),
    W('prayer-phil', 'Prayer: Philippians 4:6', 'verse',
      { ref: 'Philippians 4:6', refLabel: 'Philippians 4:6', kicker: 'Prayer', title: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
      {}, { pal: 'black', deco: 'none', font: 'serif' }),
  ] },
  { id: 'grp-start-verses', name: 'Verses', banners: [
    W('verse-sabbath', 'Exodus 20:8', 'verse',
      { ref: 'Exodus 20:8', refLabel: 'Exodus 20:8', title: 'Remember the sabbath day, to keep it holy.' }, {}, { pal: 'black', deco: 'none', font: 'serif' }),
    W('verse-saints', 'Revelation 14:12', 'verse',
      { ref: 'Revelation 14:12', refLabel: 'Revelation 14:12', title: 'Here is the patience of the saints: here are they that keep the commandments of God, and the faith of Jesus.' },
      {}, { pal: 'navy', deco: 'none', font: 'serif' }),
    W('verse-coming', 'John 14:3', 'verse',
      { ref: 'John 14:3', refLabel: 'John 14:3', title: 'And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also.' },
      {}, { pal: 'sunset', deco: 'rays', font: 'serif' }),
  ] },
  { id: 'grp-start-songs', name: 'Song service', banners: [
    W('song-service', 'Song service', 'title', { title: 'Song Service' }, {}, { pal: 'navy', deco: 'waves', font: 'advent', textBold: true }),
    W('song-gladness', 'Song service: Psalm 100:2', 'welcome',
      { kicker: 'Song service', title: 'Come before His presence with singing', text: '“Serve the LORD with gladness: come before his presence with singing.”\nPsalm 100:2' },
      {}, { pal: 'forest', deco: 'glow', font: 'advent' }),
    W('song-hymns', 'Song service: Colossians 3:16', 'welcome',
      { kicker: 'Let us sing', title: 'Psalms, hymns and spiritual songs', text: '“Singing with grace in your hearts to the Lord.”\nColossians 3:16' },
      {}, { pal: 'earth', deco: 'glow', font: 'advent' }),
  ] },
  { id: 'grp-start-announce', name: 'Announcements', banners: [
    W('ann-heading', 'Announcements', 'title', { title: 'Announcements' }, {}, { pal: 'slate', deco: 'waves', font: 'advent', textBold: true }),
    W('ann-lunch', 'Fellowship lunch', 'announce',
      { kicker: 'After the service', title: 'Fellowship lunch', text: 'Everyone is welcome to stay and eat with us.', foot: '{church} · Church hall' },
      {}, { pal: 'earth', deco: 'waves' }),
    W('ann-vespers', 'Vespers', 'announce',
      { kicker: 'Friday evening', title: 'Vespers', text: 'Welcome the Sabbath with songs, prayer and the Word.', foot: '{church} · {sunset}' },
      {}, { pal: 'sunset', deco: 'waves' }),
  ] },
  { id: 'grp-start-time', name: 'Time banners', banners: [
    W('time-service', 'Countdown to the service', 'countdown',
      { kicker: 'Our service starts in', at: '', done: 'Welcome', text: 'Please take your seats and silence your phones.', foot: '{church}' },
      {}, { pal: 'navy', deco: 'rays' }),
    W('time-ss', 'Countdown to Sabbath School', 'countdown',
      { kicker: 'Sabbath School starts in', at: '09:30', done: 'Sabbath School', text: 'Find your class, or join us in the sanctuary.', foot: '{church}' },
      {}, { pal: 'forest', deco: 'rays' }),
    W('time-sunset', 'Sabbath sunset', 'sunset',
      { kicker: '{church}', title: 'Welcome the Sabbath', text: 'Come, let us worship together as the sun sets.' },
      { sunset: true }, { pal: 'sunset', deco: 'rays' }),
  ] },
];

/** Every starter banner, with its group id. */
export const STARTER_BANNERS = STARTER_GROUPS.flatMap((g) => g.banners.map((b) => Object.assign({ group: g.id }, b)));
