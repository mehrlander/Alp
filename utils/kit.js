// utils/kit.js - Third-party library loaders and utilities

const brotli = (() => {
  let mod;
  const load = async () => mod ??= await import('https://unpkg.com/brotli-wasm@3.0.0/index.web.js?module').then(m => m.default);
  const re = /^BR64(?:\("([^"]*)"\))?:/;

  const br = async (text, label) => {
    const m = await load();
    const hdr = label ? `BR64("${label}"):` : 'BR64:';
    return hdr + btoa(String.fromCharCode(...m.compress(new TextEncoder().encode(text))));
  };

  br.compress = br;

  br.decompress = async str => {
    const m = await load();
    return new TextDecoder().decode(m.decompress(new Uint8Array(atob(str.replace(re, '')).split('').map(c => c.charCodeAt(0)))));
  };

  br.detect = str => {
    const m = str.match(re);
    return m ? { alg: 'brotli', label: m[1] ?? null, prefixLen: m[0].length } : null;
  };

  br.findChunks = str => {
    const chunks = [], r = /BR64(?::|\("([^"]*)"\):)([A-Za-z0-9+/=]+)/g;
    let m; while ((m = r.exec(str))) chunks.push({ alg: 'brotli', label: m[1] ?? null, start: m.index, end: m.index + m[0].length, text: m[0] });
    return chunks;
  };

  return br;
})();

const gzip = (() => {
  const re = /^GZ64(?:\("([^"]*)"\))?:/;

  const stream = async (compress, data) => {
    const s = new Blob([data]).stream().pipeThrough(new (compress ? CompressionStream : DecompressionStream)('gzip'));
    const chunks = []; for (const r = s.getReader();;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    const u8 = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let o = 0; for (const c of chunks) { u8.set(c, o); o += c.length; }
    return u8;
  };

  const gz = async (text, label) => {
    const hdr = label ? `GZ64("${label}"):` : 'GZ64:';
    return hdr + btoa(String.fromCharCode(...await stream(true, new TextEncoder().encode(text))));
  };

  gz.compress = gz;

  gz.decompress = async str => new TextDecoder().decode(await stream(false, new Uint8Array(atob(str.replace(re, '')).split('').map(c => c.charCodeAt(0)))));

  gz.detect = str => {
    const m = str.match(re);
    return m ? { alg: 'gzip', label: m[1] ?? null, prefixLen: m[0].length } : null;
  };

  gz.findChunks = str => {
    const chunks = [], r = /GZ64(?::|\("([^"]*)"\):)([A-Za-z0-9+/=]+)/g;
    let m; while ((m = r.exec(str))) chunks.push({ alg: 'gzip', label: m[1] ?? null, start: m.index, end: m.index + m[0].length, text: m[0] });
    return chunks;
  };

  return gz;
})();

const text = (() => {
  const t = {};

  t.detectCompressionType = str => brotli.detect(str) || gzip.detect(str);

  t.findCompressedChunks = str => [...brotli.findChunks(str), ...gzip.findChunks(str)].sort((a, b) => a.start - b.start);

  return t;
})();

const acorn = (() => {
  let mod;
  const load = async () => mod ??= await import('https://unpkg.com/acorn@8.11.3/dist/acorn.mjs');

  load.parse = async (text, opts) => (await load()).parse(text, { ecmaVersion: 2022, ...opts });
  load.isJS = async text => { try { await load.parse(text); return true } catch { return false } };

  return load;
})();

const jse = (() => {
  let mod;
  const load = async () => mod ??= await import('https://unpkg.com/vanilla-jsoneditor/standalone.js');

  return async opts => (await load()).createJSONEditor(opts);
})();

const tt = (() => {
  const create = ({ target, ...props }) => new Promise(r => {
    const t = new Tabulator(target, props);
    t.on('tableBuilt', () => r(t));
  });

  create.buildColumns = fields => fields.map(f => typeof f === 'string' ? { field: f, title: f } : f);

  return create;
})();

export const kit = { brotli, gzip, text, acorn, jse, tt };
