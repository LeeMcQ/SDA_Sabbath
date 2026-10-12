// Minimal IndexedDB wrapper. Stores:
//   kv        misc key/values (file handles, plans index, ...)
//   files     user media: {id, name, type, size, kind, blob?, handle?, added, meta}
//   renders   pre-rendered slide images: key `${deckId}/${page}` -> {full: Blob, thumb: Blob}
//   bibles    imported Bibles: `info:${id}` -> info, `${id}/${book}` -> chapters
//   hymnbooks imported / edited hymnbooks: id -> {id, name, lang, hymns}
//   plans     service plans: id -> {id, name, items, updated}

const NAME = 'selah'; // storage name kept from the app's first name, so existing plans and hymnbooks stay
const VERSION = 1;
const STORES = ['kv', 'files', 'renders', 'bibles', 'hymnbooks', 'plans'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked — close other SDA Sabbath tabs.'));
  });
  return dbp;
}

function wrap(req) {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

async function tx(store, mode, fn) {
  const d = await open();
  const t = d.transaction(store, mode);
  const s = t.objectStore(store);
  const r = fn(s);
  const res = r && typeof r.onsuccess !== 'undefined' ? wrap(r) : Promise.resolve(r);
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
  return res;
}

export const db = {
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  put: (store, key, val) => tx(store, 'readwrite', (s) => s.put(val, key)),
  del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  keys: (store) => tx(store, 'readonly', (s) => s.getAllKeys()),
  all: (store) => tx(store, 'readonly', (s) => s.getAll()),
  /** Delete every key starting with prefix (e.g. all renders of a deck). */
  delPrefix: async (store, prefix) => {
    const range = IDBKeyRange.bound(prefix, prefix + '￿');
    return tx(store, 'readwrite', (s) => s.delete(range));
  },
  /** Many puts in one transaction (much faster on low-end storage). */
  putMany: (store, entries) => tx(store, 'readwrite', (s) => { entries.forEach(([k, v]) => s.put(v, k)); }),
};

/** Ask the browser not to evict our data (Bibles, slides) when storage is low. */
export async function persistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* ignore */ }
  return false;
}
