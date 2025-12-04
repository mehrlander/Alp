(()=>{ 'use strict';

  const el=(t,a)=>Object.assign(document.createElement(t),a);
  const css=href=>document.head.appendChild(el('link',{rel:'stylesheet',href}));
  const js =src =>new Promise((ok,err)=>document.head.appendChild(el('script',{src,onload:ok,onerror:err})));

  css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  window.alp = new Proxy(()=>{},(()=>{
    let t,ready=0,q=[];
    const go=()=>{ if(!(ready&3)||!t) return; for(;q.length;){ const [k,a]=q.shift(); (k?t[k]:t)(...a); } };
    document.addEventListener('alpine:init',()=>{ ready|=2; go(); },{once:1});
    return {
      get:(_,k)=>k==='__q'?1
        : k==='bind'?o=>(t=o,ready|=1,go(),o)
        : (ready&3)&&t&&(k in t)&&typeof t[k]!=='function'?t[k]
        : (...a)=>(ready&3)&&t?t[k](...a):q.push([k,a]),
      apply:(_,__,a)=>(ready&3)&&t?t(...a):q.push([null,a])
    };
  })());

  const init=()=>{
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

    const db=new Dexie('AlpDB'); db.version(1).stores({ alp:'name' });

    const pathRegistry=Object.create(null);
    const reg=(p,x)=>((pathRegistry[p] ||= new Set).add(x), x);
    const unreg=(p,x)=>{ const s=pathRegistry[p]; if(!s) return; s.delete(x); if(!s.size) delete pathRegistry[p]; };
    const notify=(p, data, del=0)=>{
      const s=pathRegistry[p]; if(!s) return;
      s.forEach(x=> del ? (x.deletedCallback ? x.deletedCallback() : x.nav?.()) : (x.savedCallback ? x.savedCallback(data) : x.nav?.()));
    };

    const load=()=>db.alp.toArray().then(rs=>rs.reduce((m,{name,data})=>{
      const [store,...rest]=name.split('.');
      (m[store] ||= []).push({ key:name, sig:rest.join('.'), data });
      return m;
    },{}));
    const loadRecord=name=>db.alp.get(name).then(r=>r?.data);
    const saveRecord=(name,data)=>db.alp.put({name,data}).then(()=>{ console.log(`💾 ${name}:`,data); notify(name,data,0); });
    const deleteRecord=name=>db.alp.delete(name).then(()=>{ console.log(`🗑️ ${name}`); notify(name,null,1); });
    const safeStore=(s,map)=>map[s]?s:(Object.keys(map)[0]||'alp');

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

    class Alp extends HTMLElement{
      connectedCallback(){
        const render=()=>{ this.innerHTML=this.tpl(); Alpine.initTree(this); };
        window.Alpine ? render() : document.addEventListener('alpine:init',render,{once:1});
      }
      tpl(){ return ''; }
      disconnectedCallback(){
        const d=this.data;
        d && unreg(d._path, d);
        this.data = null;
      }
    }

    const defs=Object.create(null);

    const mk=(tagEnd, initState={})=>{
      const defaultPath=`alp.${tagEnd}`;
      return {
        ...initState,
        tagEnd,
        el:null,
        host:null,
        defaultPath,
        path: defaultPath,
        _path: defaultPath,
        find(s){ return this.el?.querySelector(s); },
        save(d){ return saveRecord(this._path, d); },
        load(){ return loadRecord(this._path); },
        del(){ return deleteRecord(this._path); },
        usePath(p){
          p=(p ?? '').trim() || this.defaultPath;
          this.path = p;
          if(p===this._path) return this.nav?.();
          unreg(this._path, this);
          this._path = p;
          reg(this._path, this);
          return this.nav?.();
        },
        mount(el){
          this.el = el;
          this.host = el.closest(`alp-${tagEnd}`);
          const p = this.host?.getAttribute('path');
          if(p){ this.path=p; this._path=p; }
          reg(this._path, this);
          this.host && (this.host.data = this);
          return this.nav?.();
        }
      };
    };

    const define=(tagEnd, tplFn, initState={})=>{
      defs[tagEnd] = { initState, tplFn };
      class C extends Alp{
        tpl(){ return `<div x-data="alp.mk('${tagEnd}')" x-init="mount($el)">${tplFn('path')}</div>`; }
      }
      customElements.define(`alp-${tagEnd}`, C);
    };

    const core={db,pathRegistry,consoleLogs,load,loadRecord,saveRecord,deleteRecord,safeStore,define};
    const api={
      ...core,
      fill:(k,...a)=>{ const f=fills[k]; if(!f) throw Error(`Unknown fill: ${k}`); return f(...a); },
      install:(k,o)=>{ const f=installers[k]; if(!f) throw Error(`Unknown installer: ${k}`); return f(o); },
      mk:(tagEnd)=>mk(tagEnd, defs[tagEnd]?.initState || {})
    };

    window.alp.bind(api);
    const alp=window.alp;

    alp.define("inspector", _ => `
      <button @click="open()" class="text-primary">
        <i class="ph ph-gear-six text-4xl"></i>
      </button>

      <div x-show="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close()" @keydown.escape.window="close()">
        <div class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col relative overflow-hidden">
          <div x-show="drawer" class="absolute inset-0 bg-black/30 z-20" @click="drawer=0"></div>

          <div class="flex-1 overflow-hidden relative z-10">
            <div name="jse" class="absolute inset-0"></div>
          </div>

          <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 items-center gap-2 relative z-10">
            <div class="flex items-center gap-2 flex-1 min-w-0" x-show="mode==='alp'">
              <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
                <template x-for="s in stores"><option :value="s.key" x-text="s.key"></option></template>
              </select>

              <div class="flex-1 overflow-x-auto min-w-0">
                <div class="flex gap-0.5 whitespace-nowrap">
                  <template x-for="it in pages" :key="it.key">
                    <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn'">
                      <i class="ph ph-database"></i>
                      <span x-text="it.sig"></span>
                    </button>
                  </template>
                </div>
              </div>

              <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
            </div>

            <div class="flex-1" x-show="mode!=='alp'"></div>

            <button class="btn btn-xs btn-ghost btn-circle" @click="drawer=!drawer">
              <i class="ph ph-list"></i>
            </button>
          </div>

          <aside :class="drawer ? 'translate-x-0' : 'translate-x-full'"
                 class="absolute inset-y-0 right-0 w-72 bg-base-100 border-l border-base-300 z-30 flex flex-col transition-transform duration-200">
            <div class="p-3 border-b border-base-300 flex items-center gap-2">
              <span class="font-semibold text-primary/80 flex-1">View</span>
              <button class="btn btn-sm btn-ghost btn-circle" @click="drawer=0"><i class="ph ph-x"></i></button>
            </div>

            <ul class="menu p-2 flex-1 overflow-y-auto">
              <li><a @click="setMode('alp')" :class="mode==='alp'&&'active'">Alp</a></li>
              <li><a @click="setMode('logs')" :class="mode==='logs'&&'active'">Console Logs</a></li>
            </ul>
          </aside>
        </div>
      </div>
    `,{
      show:0, drawer:0, mode:'alp', store:'alp', stores:[], storeMap:{}, page:'', pages:[], jse:null,

      close(){ this.show=0; this.drawer=0; },

      async refresh(){
        this.storeMap = await alp.load();
        this.stores = Object.keys(this.storeMap).map(key=>({key}));
        await this.goStore(alp.safeStore(this.store, this.storeMap));
      },

      async goStore(storeName){
        this.store = storeName;
        this.pages = this.storeMap[this.store] || [];
        this.pages.length ? await this.goPage(this.pages[0].key) : this.jse?.set({json:{}});
      },

      async open(){
        this.show = 1; this.drawer = 0;
        await Alpine.nextTick();
        this.jse ||= await alp.install('jse',{
          target:this.find('[name="jse"]'),
          props:{ mode:"tree", content:{json:{}}, onChange:c=>this.handleChange(c) }
        });
        await this.refresh();
        await this.setMode(this.mode);
      },

      async setMode(m){
        this.mode=m; this.drawer=0;
        await Alpine.nextTick();
        if(m==='logs') return this.jse?.set({json: alp.consoleLogs});
        if(m==='alp'){
          if(!this.page){
            const first=this.storeMap?.[alp.safeStore(this.store,this.storeMap)]?.[0]?.key;
            this.page=first||'';
          }
          return this.page ? this.goPage(this.page) : this.jse?.set({json:{}});
        }
      },

      async handleChange({json}){ if(this.mode==='alp') await alp.saveRecord(this.page, json); },

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

    document.body.appendChild(el('alp-inspector',{className:'fixed bottom-4 right-4 z-50'}));

    console.log('✅ Alp Framework initialized');
  };

  const boot=()=>js('https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables')
    .then(()=>{ console.log('📦 Alp deps loaded'); init(); return js('https://unpkg.com/alpinejs@3'); })
    .then(()=>console.log('🎨 Alpine.js loaded'));

  (document.readyState==='loading'
    ? addEventListener('DOMContentLoaded',boot,{once:1})
    : boot()
  );

})();
