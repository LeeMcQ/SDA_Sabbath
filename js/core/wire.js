// Wire format for byte-stream links (Cast/Presentation API and the LAN companion).
// Text frames carry JSON; Blobs travel first as binary frames:
//   [uint32 header length][header JSON {id,type}][bytes]
// and are referenced from JSON as {"$blob": id}. Sends are queued so order is kept.
import { isBlob, uid } from './util.js';

export function createEncoder(sendText, sendBinary) {
  const sent = new WeakMap();
  let q = Promise.resolve();
  function collect(v, out, seen) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (isBlob(v)) { out.push(v); return; }
    if (Array.isArray(v)) v.forEach((x) => collect(x, out, seen));
    else for (const k in v) collect(v[k], out, seen);
  }
  async function doSend(msg) {
    const blobs = [];
    collect(msg, blobs, new Set());
    for (const b of blobs) {
      if (sent.has(b)) continue;
      const id = uid();
      const head = new TextEncoder().encode(JSON.stringify({ id, type: b.type || 'application/octet-stream' }));
      const body = new Uint8Array(await b.arrayBuffer());
      const buf = new Uint8Array(4 + head.length + body.length);
      new DataView(buf.buffer).setUint32(0, head.length);
      buf.set(head, 4); buf.set(body, 4 + head.length);
      sendBinary(buf.buffer);
      sent.set(b, id);
    }
    sendText(JSON.stringify(msg, (k, v) => (isBlob(v) ? { $blob: sent.get(v) } : v)));
  }
  return (msg) => { q = q.then(() => doSend(msg)).catch((e) => console.warn('wire send', e)); return q; };
}

export function createDecoder(onMessage) {
  const store = new Map();
  return {
    text(str) {
      let msg;
      try { msg = JSON.parse(str, (k, v) => (v && typeof v === 'object' && v.$blob ? store.get(v.$blob) || null : v)); }
      catch (e) { return; }
      onMessage(msg);
    },
    binary(ab) {
      const dv = new DataView(ab);
      const n = dv.getUint32(0);
      const head = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, n)));
      store.set(head.id, new Blob([new Uint8Array(ab, 4 + n)], { type: head.type }));
      if (store.size > 400) store.delete(store.keys().next().value);
    },
  };
}
