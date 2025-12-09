// components/bill-table.js - WA Legislature Bill Table Component

import { alp } from '../core.js';

// Load required dependencies (Luxon, JSZip)
const loadDeps = (() => {
  let p = null;
  return () => p ||= Promise.all([
    import('https://cdn.jsdelivr.net/npm/luxon/+esm'),
    import('https://cdn.jsdelivr.net/npm/jszip/+esm')
  ]).then(([luxon, jszip]) => ({ DateTime: luxon.DateTime, JSZip: jszip.default }));
})();

alp.define('bill-table', _ => `
  <div class="flex flex-col h-full bg-base-100 p-2 gap-2 text-sm">
    <!-- Filters Row -->
    <div class="flex items-center gap-4 text-xs flex-wrap">
      <span class="font-semibold">Show:</span>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" class="checkbox checkbox-xs" x-model="kindFilters.Bills" @change="applyFilters()">
        <span>Bills</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" class="checkbox checkbox-xs" x-model="kindFilters['Session Laws']" @change="applyFilters()">
        <span>Session Laws</span>
      </label>
      <label class="flex items-center gap-1 ml-auto">
        Size &gt;
        <input type="number" class="input input-xs w-16" placeholder="KB" x-model.number="sizeFilter" @input="applyFilters()">
      </label>
    </div>

    <!-- Table Container -->
    <div name="table" class="flex-1 min-h-0"></div>

    <!-- Footer Controls -->
    <div class="flex justify-between items-center text-xs">
      <div class="flex items-center gap-2">
        <span x-text="rowCount + ' rows'"></span>
        <button class="btn btn-xs btn-error" @click="clearAll()">Clear All</button>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-xs btn-secondary" @click="downloadData()">Download Data</button>
        <button class="btn btn-xs btn-primary" @click="downloadZip()" :disabled="downloading" x-text="downloadText">Download Zip</button>
        <button class="btn btn-xs btn-success" @click="loadSummaries()" :disabled="loadingSummaries" x-text="summariesText">Summaries</button>
      </div>
    </div>
  </div>
`, {
  // State
  table: null,
  deps: null,
  loaded: new Set(),

  kindFilters: { Bills: true, 'Session Laws': true },
  sizeFilter: null,

  rowCount: 0,
  downloading: false,
  downloadText: 'Download Zip',
  loadingSummaries: false,
  summariesText: 'Summaries',

  // Biennium options
  bienniums: ['2025-26', '2023-24', '2021-22', '2019-20', '2017-18', '2015-16', '2013-14', '2011-12', '2009-10', '2007-08', '2005-06', '2003-04'],
  types: ['Bills', 'Session Laws'],

  // Initialize component
  async nav() {
    this.deps ||= await loadDeps();

    // Initialize table if not already done
    if (!this.table) {
      this.table = await alp.install('tt', {
        target: this.find('[name="table"]'),
        props: {
          layout: 'fitData',
          height: '500',
          dataTree: true,
          dataTreeStartExpanded: false,
          columns: [
            { title: 'Id', field: 'id' },
            { title: 'Name', field: 'name' },
            { title: 'File Name', field: 'fileName' },
            { title: 'Date', field: 'date', sorter: 'datetime', sorterParams: { format: 'yyyy-MM-dd' } },
            { title: 'Size', field: 'size' },
            { title: 'Compressed', field: 'compressedSize' },
            { title: 'Chamber', field: 'chamber' },
            { title: 'Biennium', field: 'biennium' },
            { title: 'Kind', field: 'kind' },
            { title: 'Total $', field: 'totalDollarAmount', formatter: 'money', formatterParams: { thousand: ',', precision: 0 } },
            { title: 'Description', field: 'description' }
          ]
        }
      });

      this.table.on('dataFiltered', (filters, rows) => this.rowCount = rows.length);
      this.table.on('dataLoaded', data => this.rowCount = data.length);
    }

    // Load persisted data
    const saved = await this.load();
    if (saved?.tableData) {
      this.table.setData(saved.tableData);
      this.loaded = new Set(saved.loaded || []);
    }
  },

  // Filter logic
  applyFilters() {
    this.table.setFilter(row => {
      // Size filter
      if (this.sizeFilter && row.size <= this.sizeFilter) return false;
      // Kind filter
      if (!this.kindFilters[row.kind]) return false;
      return true;
    });
  },

  // URL builder for WA Legislature
  buildUrl(chamber, format, biennium, type) {
    const base = `https://lawfilesext.leg.wa.gov/Biennium/${biennium}/${format}/Bills/`;
    return type === 'Bills'
      ? `${base}${chamber}%20Bills/`
      : `${base}Session%20Laws/${chamber}/`;
  },

  // Parse directory listing XML
  parseDirectoryListing(html, chamber, biennium, type) {
    const { DateTime } = this.deps;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const pre = doc.querySelector('pre');
    if (!pre) return [];

    const lines = pre.innerHTML.split('<br>').filter(Boolean);
    return lines.map(line => {
      // Create temp element to parse HTML entities and extract text
      const temp = document.createElement('div');
      temp.innerHTML = line;
      const text = temp.textContent;

      // Match pattern: date time size filename
      const match = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}:\d{2}\s+[AP]M\s+(\S+)\s+(.+)/);
      if (!match) return null;

      const fullFileName = match[3].trim();
      const name = fullFileName.split('.')[0];
      const fileName = fullFileName.replace(/\.(xml|htm)$/i, '');

      // Extract URL from anchor tag
      const anchor = temp.querySelector('a');
      const href = anchor?.getAttribute('href') || '';
      const urlXml = new URL(href, 'https://lawfilesext.leg.wa.gov/').href;
      const urlHtm = urlXml.replace(/\/Xml\//g, '/Htm/').replace(/\.xml$/, '.htm');

      return {
        id: `${biennium}_${type}_${name}`,
        date: DateTime.fromFormat(match[1], 'M/d/yyyy').toFormat('yyyy-MM-dd'),
        size: Math.round(parseInt(match[2].replace(/,/g, '')) / 1024) || 0,
        compressedSize: null,
        name,
        fileName,
        urlXml,
        urlHtm,
        chamber,
        billNumber: fullFileName.slice(0, 4),
        biennium,
        kind: type,
        totalDollarAmount: null,
        description: 'Click "Summaries" to load'
      };
    }).filter(Boolean);
  },

  // Build tree structure for bills
  buildTree(data) {
    const map = new Map();
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    data.forEach(item => {
      const id = item.billNumber;
      if (!map.has(id)) {
        map.set(id, { ...item, _children: [] });
      } else {
        map.get(id)._children.push(item);
      }
    });

    return [...map.values()].map(row => {
      if (row._children?.length) {
        row._children.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else {
        delete row._children;
      }
      return row;
    });
  },

  // Fetch bills for a biennium (public method for external use)
  async fetchBiennium(biennium) {
    if (this.loaded.has(biennium)) {
      console.log('Already loaded:', biennium);
      return;
    }
    console.log('Loading all kinds for:', biennium);

    for (const type of this.types) {
      const [houseResponse, senateResponse] = await Promise.all([
        fetch(this.buildUrl('House', 'Xml', biennium, type)).then(r => r.text()),
        fetch(this.buildUrl('Senate', 'Xml', biennium, type)).then(r => r.text())
      ]);

      let data = [
        ...this.parseDirectoryListing(houseResponse, 'House', biennium, type),
        ...this.parseDirectoryListing(senateResponse, 'Senate', biennium, type)
      ];
      console.log(`Parsed ${type}:`, data.length, 'rows');

      if (type === 'Bills') {
        data = this.buildTree(data);
      } else {
        data.sort((a, b) => b.size - a.size);
      }

      this.table.addData(data);
    }

    this.loaded.add(biennium);
    await this.persist();
  },

  // Add data directly (for external use)
  async addData(data, source = 'external') {
    this.table.addData(data);
    this.loaded.add(source);
    await this.persist();
  },

  // Persist current state
  async persist() {
    await this.save({
      tableData: this.table.getData(),
      loaded: [...this.loaded]
    });
  },

  // Clear all data
  async clearAll() {
    this.table.setData([]);
    this.loaded.clear();
    this.sizeFilter = null;
    await this.del();
  },

  // Download data as JSON
  downloadData() {
    const { DateTime } = this.deps;
    const data = this.table.getData();
    const timestamp = DateTime.now().toFormat('yyyyMMdd-HHmmss');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wa-legislature-data-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // Download visible rows as ZIP
  async downloadZip() {
    const { JSZip } = this.deps;
    const rows = this.table.getRows('visible');
    if (!rows.length) {
      alert('No files to download');
      return;
    }

    this.downloading = true;
    this.downloadText = 'Preparing...';

    try {
      const zip = new JSZip();
      for (let i = 0; i < rows.length; i++) {
        const d = rows[i].getData();
        this.downloadText = `Downloading ${i + 1}/${rows.length}`;

        try {
          const [xmlBlob, htmBlob] = await Promise.all([
            fetch(d.urlXml).then(r => r.blob()),
            fetch(d.urlHtm).then(r => r.blob())
          ]);
          zip.file(`${d.biennium}/${d.kind}/${d.chamber}/${d.name}.xml`, xmlBlob);
          zip.file(`${d.biennium}/${d.kind}/${d.chamber}/${d.name}.htm`, htmBlob);
        } catch (e) {
          console.error('Failed:', d.name, e);
        }
      }

      this.downloadText = 'Generating zip...';
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'wa-legislature-files.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      this.downloading = false;
      this.downloadText = 'Download Zip';
    }
  },

  // Compress text with gzip and return size
  async compressGzip(text) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const blob = await new Response(stream).blob();
    return blob.size;
  },

  // Load summaries for visible rows
  async loadSummaries() {
    console.log('Loading summaries - button clicked');
    const rows = this.table.getRows('visible');
    console.log('Processing', rows.length, 'visible rows');

    this.loadingSummaries = true;

    try {
      for (let i = 0; i < rows.length; i++) {
        const d = rows[i].getData();
        if (d.description === 'Click "Summaries" to load') {
          this.summariesText = `Loading ${i + 1}/${rows.length}`;
          rows[i].update({ description: 'Loading...' });

          try {
            const xml = await fetch(d.urlXml).then(r => r.text());
            const doc = new DOMParser().parseFromString(xml, 'application/xml');

            const dollarAmounts = [...doc.querySelectorAll('DollarAmount')].map(el =>
              parseFloat(el.textContent.replace(/[$,]/g, '')) || 0
            );
            const total = dollarAmounts.length ? dollarAmounts.reduce((a, b) => a + b, 0) : null;
            const compressedSize = Math.round(await this.compressGzip(xml) / 1024);

            rows[i].update({
              description: doc.querySelector('BriefDescription')?.textContent || 'No description',
              totalDollarAmount: total,
              compressedSize
            });
            console.log('Loaded', d.name, '- $', total, '- Compressed:', compressedSize, 'KB');
          } catch (e) {
            console.error('Failed to load', d.name, e);
            rows[i].update({ description: 'Error loading' });
          }
        }
      }
      await this.persist();
    } finally {
      this.loadingSummaries = false;
      this.summariesText = 'Summaries';
    }
    console.log('Done loading summaries');
  },

  // Get all data (for external use)
  getData() {
    return this.table?.getData() || [];
  },

  // Get visible data (for external use)
  getVisibleData() {
    return this.table?.getRows('visible').map(r => r.getData()) || [];
  }
});

console.log('📊 Alp Bill Table loaded');
