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
  gz.sizeOf = async text => (await stream(true, new TextEncoder().encode(text))).length;
  return gz;
})();

const text = (() => {
  const t = {};

  // Detection
  t.detectCompressionType = str => brotli.detect(str) || gzip.detect(str);
  t.findCompressedChunks = str => [...brotli.findChunks(str), ...gzip.findChunks(str)].sort((a, b) => a.start - b.start);

  // Decompression templates for bookmarklet bootstrapping
  t.templates = {
    brotliDecomp: n => `const m=await(await import('https://unpkg.com/brotli-wasm@3.0.0/index.web.js?module')).default;const b=atob(s.slice(${n}));const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);const d=new TextDecoder().decode(m.decompress(a));`,
    gzipDecomp: n => `const d=new TextDecoder().decode(new Uint8Array(await new Response(new Blob([Uint8Array.from(atob(s.slice(${n})),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));`,
    jsExec: () => 'eval(d)',
    htmlExec: popup => `const w=window.open('','_blank'${popup ? ",'width=800,height=600'" : ""});w.document.write(d);w.document.close()`,
  };

  // Analyze input without transforming
  t.assess = async input => {
    const det = t.detectCompressionType(input);
    const raw = det?.alg === 'brotli' ? await brotli.decompress(input)
              : det?.alg === 'gzip' ? await gzip.decompress(input)
              : input;
    const isJavaScript = await acorn.isJS(raw);
    const br = await brotli(raw), gz = await gzip(raw);
    return {
      raw,
      isCompressed: !!det,
      compAlg: det?.alg ?? null,
      isJavaScript,
      sizes: { raw: raw.length, brotli: br.length, gzip: gz.length }
    };
  };

  // Wrap content in bookmarklet format
  t.pack = (content, { isJavaScript = false, popup = false } = {}) => {
    const det = t.detectCompressionType(content);
    const mkResult = packingSegments => ({
      packingSegments,
      output: packingSegments.map(s => s.v).join('')
    });

    if (det) {
      const decomp = det.alg === 'brotli' ? t.templates.brotliDecomp(det.prefixLen) : t.templates.gzipDecomp(det.prefixLen);
      const exec = isJavaScript ? t.templates.jsExec() : t.templates.htmlExec(popup);
      return mkResult([
        { t: 'packing', v: `javascript:(async function(){const s='` },
        { t: 'payload', v: content },
        { t: 'packing', v: `';try{${decomp}console.log('Decompressed content:\\n',d);${exec}}catch(e){console.error(e)}})();` }
      ]);
    }

    if (isJavaScript) {
      return mkResult([
        { t: 'packing', v: 'javascript:(()=>{' },
        { t: 'payload', v: content },
        { t: 'packing', v: '})()' }
      ]);
    }

    const winOpts = popup ? ",'width=600,height=400'" : '';
    return mkResult([
      { t: 'packing', v: `javascript:(()=>{const w=window.open('','_blank'${winOpts});w.document.write(` },
      { t: 'payload', v: JSON.stringify(content) },
      { t: 'packing', v: ');w.document.close()})()' }
    ]);
  };

  // Full processing: takes UI state, returns everything the page needs
  t.process = async (input, { compressed = true, packed = true, alg = 'brotli', popup = false, label = '' } = {}) => {
    const info = await t.assess(input);
    
    // Determine working content based on compression toggle
    let work;
    if (info.isCompressed) {
      work = compressed ? input : info.raw;
    } else {
      work = compressed ? (alg === 'gzip' ? await gzip(info.raw, label) : await brotli(info.raw, label)) : info.raw;
    }

    // Build result
    const base = { ...info, outAlg: alg };
    
    if (!packed) {
      const packingSegments = [{ t: 'payload', v: work }];
      return { ...base, packingSegments, output: work, outSize: work.length };
    }

    const parcel = t.pack(work, { isJavaScript: info.isJavaScript, popup });
    return { ...base, ...parcel, outSize: parcel.output.length };
  };

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

const jszip = (() => {
  let mod;
  return async () => mod ??= await import('https://cdn.jsdelivr.net/npm/jszip/+esm').then(m => m.default);
})();

const tt = (() => {
  const create = ({ target, ...props }) => new Promise(r => {
    const t = new Tabulator(target, props);
    t.on('tableBuilt', () => r(t));
  });
  create.buildColumns = fields => fields.map(f => typeof f === 'string' ? { field: f, title: f } : f);

  // Download table data as JSON
  // options: { filename, timestamp (bool or format string), space (JSON indent) }
  create.downloadJson = (table, { filename = 'data', timestamp = true, space = 2 } = {}) => {
    const data = table.getData();
    const ts = timestamp ? '-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) : '';
    const blob = new Blob([JSON.stringify(data, null, space)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}${ts}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Download files as ZIP with progress tracking
  // options: { filename, fileMapper(rowData) => [{ path, url }], onProgress(current, total, rowData) }
  create.downloadZip = async (table, { filename = 'download.zip', fileMapper, onProgress, selector = 'visible' } = {}) => {
    const JSZip = await jszip();
    const rows = table.getRows(selector);
    if (!rows.length) return { success: false, error: 'No rows to download' };

    const zip = new JSZip();
    let completed = 0;

    for (const row of rows) {
      const data = row.getData();
      const files = fileMapper ? fileMapper(data) : [];

      onProgress?.(completed, rows.length, data);

      for (const { path, url } of files) {
        try {
          const blob = await fetch(url).then(r => r.blob());
          zip.file(path, blob);
        } catch (e) {
          console.error('Failed to fetch:', url, e);
        }
      }
      completed++;
    }

    onProgress?.(completed, rows.length, null);

    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return { success: true, count: rows.length };
  };

  // Get compressed size of text using gzip
  create.getCompressedSize = text => gzip.sizeOf(text);

  return create;
})();

export const kit = { brotli, gzip, text, acorn, jse, tt };
