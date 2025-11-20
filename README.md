This is a start.  We want to build from this:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alpine store idb components</title>
  <script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables"></script>
  <link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css" rel="stylesheet" />
</head>
<body class="min-h-dvh">

  <div class="max-w mx-auto p-2">
    <alp-text class="m-2"></alp-text>
    <alp-rows class="m-2"></alp-rows>
  </div> 

<alp-inspector class="fixed bottom-4 right-4"></alp-inspector>

  <script>
    window.alp = (() => {
      const db = new Dexie('AlpDB');
      db.version(1).stores({ alp: 'name' });
      
      const installer = {
        jse: opts => import('https://unpkg.com/vanilla-jsoneditor/standalone.js')
          .then(({createJSONEditor}) => createJSONEditor(opts)),
        tt: opts => new Promise(resolve => {
          const table = new Tabulator(opts.target, opts.props);
          table.on("tableBuilt", () => resolve(table));
        })
      };

      const std = {
        pathInput: () => `<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()" class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`
      };

      const state = {};
      const components = {};

      addEventListener("alpine:init", () => {
        Object.entries(state).forEach(([storeName, storeState]) => {
          Alpine.store(storeName, storeState);
        });
      }, { once: 1 });
 
      class Alp extends HTMLElement {
        connectedCallback() {
          addEventListener("alpine:init", () => {
            const html = this.tpl();
            this.innerHTML = html;
            Alpine.initTree(this);
          }, { once: 1 });
        }
        
        tpl() { return "" }
      }

      const load = async () => 
        (await db.alp.toArray())
          .reduce((m, {name, data}) => (([s, ...p] = name.split('.')), (m[s] ||= []).push({ key: name, sig: p.join('.'), data }), m), {});
      const loadRecord = async name => (await db.alp.get(name))?.data;
      const saveRecord = async (name, data) => {
        await db.alp.put({ name, data });
        console.log(`💾 ${name}:`, data);
        components[name]?.savedCallback?.(data);
      };
      const deleteRecord = async name => {
        await db.alp.delete(name);
        console.log(`🗑️ ${name}`);
        components[name]?.savedCallback?.();
      };
 
      return {
        db,
        installer,
        std,
        components,
        load,
        safeStore: (store, storeMap) => storeMap[store] ? store : Object.keys(storeMap)[0] || 'alp',
        loadRecord,
        saveRecord,
        deleteRecord,
        define(tagEnd, tpl, initialState = {}) {
          if (!state.alp) state.alp = {};
          
          const path = `alp.${tagEnd}`;
          const def = class extends Alp { 
            tpl() { 
              return `<div x-data="$store.${path}" x-init="el = $el; nav()">${tpl(path)}</div>`; 
            } 
          };
          
          Object.assign(def.prototype, { tagEnd, path });
          state.alp[tagEnd] = {...initialState,
            el: null,
            defaultPath: path,                   
            path: path,
            find(s) { return this.el?.querySelector(s); },
            async save(data) { await saveRecord(this.path, data); },
            async load() { return await loadRecord(this.path); },
            async del() { await deleteRecord(this.path); }
          };
          
          customElements.define('alp-' + tagEnd, def);
           
          addEventListener("alpine:init", () => {
            components[path] = Alpine.store('alp')[tagEnd];
          }, { once: 1 });
        }
      };
    })();
 
    alp.define("text", 
      x => `<div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold">text</div>
        ${alp.std.pathInput()}
      </div>
      <textarea 
        x-model="text" 
        @blur="save({text})"
        class="textarea textarea-bordered w-full h-24" 
        placeholder="text..."></textarea>`,
      { 
        text: '',
        async nav() {
          const data = await this.load();
          if (data && !data.hasOwnProperty('text')) {
            alert('Path contains incompatible data (expected text property)');
            this.path = this.defaultPath;
            return;
          }
          this.text = data?.text || '';
        }
      }
    );

    alp.define("rows",
      x => `<div class="flex justify-between items-center mb-3">
        <button @click="addRow()" class="btn btn-primary btn-sm">Add Row</button>
        ${alp.std.pathInput()}
      </div>
      <div name="rows-table"></div>`,
      {
        tt: null,
        async nav() {
          const data = await this.load();
          if (data && !data.hasOwnProperty('rows')) {
            alert('Path contains incompatible data (expected rows property)');
            this.path = this.defaultPath;
            return;
          }
          await this.loadTable();
        },
        async loadTable() {
          const loaded = await this.load();
          const data = loaded?.rows || [];

          const cols = (f => (f.length ? f : ['key','value'])
            .map(k => ({ title: k, field: k, editor: "input" })))
            ([...new Set(data.flatMap(Object.keys))]);

          if (this.tt) {
            this.tt.setColumns(cols);
            this.tt.setData(data);
          } else {
            this.tt = await alp.installer.tt({
              target: this.find('[name="rows-table"]'),
              props: {
                data,
                layout: "fitColumns", 
                addRowPos: "bottom",
                columns: cols
              }
            });
            ["cellEdited", "rowAdded", "rowDeleted"].forEach(e => this.tt.on(e, () => this.save({rows: this.tt.getData()})));
          }
        },
        savedCallback(data) {
          this.loadTable();
        },
        addRow() { this.tt?.addRow({}); }
      }
    );

    alp.define("inspector", 
      x => `<button @click="open()" class="text-primary"><i class="ph ph-gear-six text-4xl"></i></button>
      <div x-show="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="show=0">
        <div class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col">
          <div name="jse" class="flex-1 overflow-hidden"></div>
          <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 justify-between items-center gap-2">
            <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
              <template x-for="s in stores"><option :value="s.key" x-text="s.key"></option></template>
            </select>
            <div class="flex-1 overflow-x-auto">
              <div class="flex gap-0.5 whitespace-nowrap">
                <template x-for="it in pages"><button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn'"><i class="ph ph-database"></i><span x-text="it.sig"></span></button></template>
              </div>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
            </div>
          </div>
        </div>
      </div>`,
      {
        show: 0,
        store: 'alp',
        stores: [],
        storeMap: {},
        page: '',
        pages: [],
        jse: null,
        async refresh() {
          this.storeMap = await alp.load();
          this.stores = Object.keys(this.storeMap).map(k => ({ key: k }));
          this.goStore(alp.safeStore(this.store, this.storeMap));
        },
        goStore(storeName) {
          this.store = storeName;
          this.pages = this.storeMap[this.store] || [];
          this.pages.length ? this.goPage(this.pages[0].key) : this.jse?.set({ json: {} });
        },
        async open() {
          this.show = 1;
          await Alpine.nextTick();
          this.jse ||= await alp.installer.jse({
            target: this.find('[name="jse"]'),
            props: { 
              mode: "tree", 
              content: { json: {} },
              onChange: (content) => this.handleChange(content)
            }
          });
          await this.refresh();
        },
        async handleChange(content) {
          await alp.saveRecord(this.page, content.json);
          const [storeName, sig] = this.page.split('.');
          if (storeName && sig && Alpine.store(storeName)?.[sig]) {
            Object.assign(Alpine.store(storeName)[sig], content.json);
          }
        },
        async goPage(k) {
          this.page = k;
          const data = await alp.loadRecord(k);
          this.jse.set({ json: data || {} });
        },
        async clear() {
          console.log(this.page);
          await alp.deleteRecord(this.page);
          await this.refresh()
        } 
      } 
    );
  </script>

  <script defer src="https://unpkg.com/alpinejs"></script>

</body>
</html>
