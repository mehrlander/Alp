(()=>{ 'use strict';

  // --- tiny loader helpers
  const el=(t,a)=>Object.assign(document.createElement(t),a);
  const css=href=>document.head.appendChild(el('link',{rel:'stylesheet',href}));
  const js =src =>new Promise((ok,err)=>document.head.appendChild(el('script',{src,onload:ok,onerror:err})));

  css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  const init=()=>{
    // --- console capture (ring buffer)
    const consoleLogs=[],MAX=100;
    const orig=Object.fromEntries(['log','warn','error','info'].map(k=>[k,console[k].bind(console)]));
    const fmt=a=>{ try{ return (a && typeof a==='object') ? JSON.stringify(a,null,2) : String(a); }catch{ return String(a); } };
    ['log','warn','error','info'].forEach(k=>{
      console[k]=(...args)=>{
        consoleLogs.push({type:k,time:new Date().toLocaleTimeString(),args:args.map(fmt).join(' ')});
        consoleLogs.length>MAX && consoleLogs.shift();
        orig[k](...args);
      };
    });

    // --- db
    const db=new Dexie('AlpDB'); db.version(1).stores({ alp:'name' });

    // --- instance registry: path -> Set(instances)
    const components=Object.create(null); // exposed as window.alp.components
    const reg=(p,inst)=>((components[p] ||= new Set).add(inst), inst);
    const unreg=(p,inst)=>{
      const s=components[p]; if(!s) return;
      s.delete(inst); if(!s.size) delete components[p];
    };
    const notify=(p, data, del=0)=>{
      const s=components[p]; if(!s) return;
      s.forEach(inst=>{
        if(del) (inst.deletedCallback ? inst.deletedCallback() : inst.nav?.());
        else    (inst.savedCallback   ? inst.savedCallback(data) : inst.nav?.());
      });
    };

    // --- db ops
    const load =()=>db.alp.toArray().then(rs=>rs.reduce((m,{name,data})=>{
      const [store,...rest]=name.split('.');
      (m[store] ||= []).push({ key:name, sig:rest.join('.'), data });
      return m;
    },{}));
    const loadRecord =name=>db.alp.get(name).then(r=>r?.data);
    const saveRecord =(name,data)=>db.alp.put({name,data}).then(()=>{ console.log(`💾 ${name}:`,data); notify(name,data,0); });
    const deleteRecord=name=>db.alp.delete(name).then(()=>{ console.log(`🗑️ ${name}`); notify(name,null,1); });
    const safeStore =(s,map)=>map[s]?s:(Object.keys(map)[0]||'alp');

    // --- UI fills + installers
    const fills={
      pathInput:()=>`
        <input x-model="path"
          @blur="usePath(path)"
          @keydown.enter.prevent="$el.blur()"
          class="input input-xs input-ghost text-xs text-right w-48"
          placeholder="path">`,
      deleteButton:()=>`
        <button @click="del()" class="btn btn-xs btn-error btn-outline">
          <i class="ph ph-trash"></i>
        </button>`,
      saveIndicator:()=>`<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
      toolbar:(...items)=>`<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,
      btn:(label,click,icon='',classes='btn-primary')=>`
        <button @click="${click}" class="btn btn-sm ${classes}">
          ${icon?`<i class="ph ph-${icon}"></i>`:''}<span>${label}</span>
        </button>`
    };

    const installers={
      jse:opts=>import('https://unpkg.com/vanilla-jsoneditor/standalone.js').then(m=>m.createJSONEditor(opts)),
      tt:({target,props})=>new Promise(r=>{ const t=new Tabulator(target,props); t.on('tableBuilt',()=>r(t)); })
    };

    // --- base custom element: render template when Alpine is ready
    class AlpElt extends HTMLElement{
      connectedCallback(){
        const render=()=>{ this.innerHTML=this.tpl(); Alpine.initTree(this); };
        window.Alpine ? render() : addEventListener('alpine:init',render,{once:1});
      }
      tpl(){ return ''; }
      disconnectedCallback(){
        const inst=this.__alpInst;
        if(inst) unreg(inst._path, inst);
      }
    }

    // --- instance factory (per mounted element)
    const mk=(tagEnd, initState={})=>{
      const defaultPath=`alp.${tagEnd}`;
      const inst={
        ...initState,

        tagEnd,
        el:null,
        host:null,

        defaultPath,
        path: defaultPath,   // editable/displayed
        _path: defaultPath,  // actual bound key (registry + db ops)

        find(s){ return this.el?.querySelector(s); },

        // db ops are against bound path
        save(d){ return saveRecord(this._path, d); },
        load(){ return loadRecord(this._path); },
        del(){  return deleteRecord(this._path); },

        // (re)bind to a key + rehydrate
        usePath(p){
          p=(p ?? '').trim() || this.defaultPath;

          // keep visible path sane
          this.path = p;

          if(p===this._path) return this.nav?.();

          unreg(this._path, this);
          this._path = p;
          reg(this._path, this);

          return this.nav?.();
        },

        // called from x-init
        init(el){
          this.el   = el;
          this.host = el.closest(`alp-${tagEnd}`);

          // allow <alp-foo path="some.key">
          const p = this.host?.getAttribute('path');
          if(p) { this.path=p; this._path=p; }

          reg(this._path, this);

          // let host clean up on disconnect
          if(this.host) this.host.__alpInst = this;

          return this.nav?.();
        }
      };

      return inst;
    };

    // --- define(tagEnd, tplFn, initState): wraps tpl in instance x-data
    const define=(tagEnd, tplFn, initState={})=>{
      class C extends AlpElt{
        tpl(){
          // tplFn gets a string expr for where the current path lives: "path"
          return `<div x-data="alp.mk('${tagEnd}')" x-init="init($el)">
            ${tplFn('path')}
          </div>`;
        }
      }

      // stash initState by tagEnd so mk() can clone it per instance
      _defs[tagEnd] = { initState, tplFn };

      customElements.define(`alp-${tagEnd}`, C);
    };

    // defs map to keep initState with functions (no JSON tricks)
    const _defs=Object.create(null);

    // expose alp
    const alp = window.alp = {
      db,
      components,   // path -> Set(instances)
      consoleLogs,

      load,
      loadRecord,
      saveRecord,
      deleteRecord,
      safeStore,

      fill:(k,...a)=>{ const f=fills[k]; if(!f) throw Error(`Unknown fill: ${k}`); return f(...a); },
      install:(k,o)=>{ const f=installers[k]; if(!f) throw Error(`Unknown installer: ${k}`); return f(o); },

      // per-instance factory used by define() wrapper
      mk:(tagEnd)=>mk(tagEnd, _defs[tagEnd]?.initState || {}),

      define
    };

    // --- built-in: inspector (edits any Dexie record by path)
    alp.define("inspector", _pathExpr => `
      <button @click="open()" class="text-primary">
        <i class="ph ph-gear-six text-4xl"></i>
      </button>

      <div x-show="show"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="show=0">
        <div class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col">
          <div name="jse" class="flex-1 overflow-hidden"></div>

          <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 justify-between items-center gap-2">
            <select class="select select-xs w-auto min-w-0"
              @change="goStore($event.target.value)"
              x-model="store">
              <template x-for="s in stores">
                <option :value="s.key" x-text="s.key"></option>
              </template>
            </select>

            <div class="flex-1 overflow-x-auto">
              <div class="flex gap-0.5 whitespace-nowrap">
                <template x-for="it in pages" :key="it.key">
                  <button class="btn btn-xs"
                    @click="goPage(it.key)"
                    :class="page===it.key?'btn-primary':'btn'">
                    <i class="ph ph-database"></i>
                    <span x-text="it.sig"></span>
                  </button>
                </template>
              </div>
            </div>

            <div class="flex gap-1">
              <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
            </div>
          </div>
        </div>
      </div>
    `,{
      show:0,
      store:'alp',
      stores:[],
      storeMap:{},
      page:'',
      pages:[],
      jse:null,

      async refresh(){
        this.storeMap = await alp.load();
        this.stores   = Object.keys(this.storeMap).map(key=>({key}));
        await this.goStore(alp.safeStore(this.store, this.storeMap));
      },

      async goStore(storeName){
        this.store = storeName;
        this.pages = this.storeMap[this.store] || [];
        this.pages.length ? await this.goPage(this.pages[0].key) : this.jse?.set({json:{}});
      },

      async open(){
        this.show = 1;
        await Alpine.nextTick();
        this.jse ||= await alp.install('jse',{
          target:this.find('[name="jse"]'),
          props:{ mode:"tree", content:{json:{}}, onChange:c=>this.handleChange(c) }
        });
        await this.refresh();
      },

      async handleChange({json}){
        // path-keyed save; any mounted instances bound to this.page will get notified + nav()
        await alp.saveRecord(this.page, json);
      },

      async goPage(k){
        this.page = k;
        const data = await alp.loadRecord(k);
        console.log('goPage', k, data);
        await this.jse.set({ json: data || {} });
      },

      async clear(){
        await alp.deleteRecord(this.page);
        await this.refresh();
      }
    });

    console.log('✅ Alp Framework initialized');
  };

  // --- boot: deps first, then init(), then Alpine
  const boot=()=>js('https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables')
    .then(()=>{ console.log('📦 Alp deps loaded'); init(); return js('https://unpkg.com/alpinejs@3'); })
    .then(()=>console.log('🎨 Alpine.js loaded'));

  (document.readyState==='loading'
    ? addEventListener('DOMContentLoaded',boot,{once:1})
    : boot()
  );

})();
