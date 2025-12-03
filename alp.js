(()=>{ 'use strict';

  const el=(t,a)=>Object.assign(document.createElement(t),a);
  const css=href=>document.head.appendChild(el('link',{rel:'stylesheet',href}));
  const js =src =>new Promise((ok,err)=>document.head.appendChild(el('script',{src,onload:ok,onerror:err})));

  css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  const init=()=>{
    // console capture (ring buffer)
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

    // db + core
    const db=new Dexie('AlpDB'); db.version(1).stores({alp:'name'});
    const state={},components={};

    class AlpElt extends HTMLElement{
      connectedCallback(){
        const render=()=>{ this.innerHTML=this.tpl(); Alpine.initTree(this); };
        window.Alpine ? render() : addEventListener('alpine:init',render,{once:1});
      }
      tpl(){ return ''; }
    }

    const load       =()=>db.alp.toArray().then(rs=>rs.reduce((m,{name,data})=>{
      const [store,...rest]=name.split('.');
      (m[store] ||= []).push({key:name,sig:rest.join('.'),data});
      return m;
    },{}));
    const loadRecord =name=>db.alp.get(name).then(r=>r?.data);
    const saveRecord =(name,data)=>db.alp.put({name,data}).then(()=>{
      console.log(`💾 ${name}:`,data);
      components[name]?.savedCallback?.(data);
    });
    const deleteRecord=name=>db.alp.delete(name).then(()=>{
      console.log(`🗑️ ${name}`);
      components[name]?.savedCallback?.();
    });
    const safeStore  =(s,map)=>map[s]?s:(Object.keys(map)[0]||'alp');

    addEventListener('alpine:init',()=>Object.entries(state).forEach(([k,v])=>Alpine.store(k,v)),{once:1});

    const fills={
      pathInput:()=>`<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()"
        class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`,
      deleteButton:()=>`<button @click="del()" class="btn btn-xs btn-error btn-outline"><i class="ph ph-trash"></i></button>`,
      saveIndicator:()=>`<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
      toolbar:(...items)=>`<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,
      btn:(label,click,icon='',classes='btn-primary')=>`<button @click="${click}" class="btn btn-sm ${classes}">
        ${icon?`<i class="ph ph-${icon}"></i>`:''}<span>${label}</span></button>`
    };

    const installers={
      jse:opts=>import('https://unpkg.com/vanilla-jsoneditor/standalone.js').then(m=>m.createJSONEditor(opts)),
      tt:({target,props})=>new Promise(r=>{ const t=new Tabulator(target,props); t.on('tableBuilt',()=>r(t)); })
    };

    const alp = window.alp = {
      db, components, consoleLogs,
      load, loadRecord, saveRecord, deleteRecord, safeStore,
      fill:(k,...a)=>{ const f=fills[k]; if(!f) throw Error(`Unknown fill: ${k}`); return f(...a); },
      install:(k,o)=>{ const f=installers[k]; if(!f) throw Error(`Unknown installer: ${k}`); return f(o); },
      define:(tagEnd, tpl, initState={})=>{
        (state.alp ||= {});
        const path=`alp.${tagEnd}`;

        class C extends AlpElt{
          tpl(){ return `<div x-data="$store.${path}" x-init="el=$el;nav()">${tpl(path)}</div>`; }
        }

        state.alp[tagEnd]={
          ...initState,
          el:null, defaultPath:path, path,
          find(s){ return this.el?.querySelector(s); },
          save(d){ return saveRecord(this.path,d); },
          load(){ return loadRecord(this.path); },
          del(){ return deleteRecord(this.path); }
        };

        if (window.Alpine){
          (Alpine.store('alp') || Alpine.store('alp',{}))[tagEnd]=state.alp[tagEnd];
        }

        customElements.define(`alp-${tagEnd}`,C);

        const reg=()=>{ components[path]=Alpine.store('alp')[tagEnd]; };
        window.Alpine ? reg() : addEventListener('alpine:init',reg,{once:1});
      }
    };

    alp.define("inspector", x => `
      <button @click="open()" class="text-primary"><i class="ph ph-gear-six text-4xl"></i></button>
      <div x-show="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="show=0">
        <div class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col">
          <div name="jse" class="flex-1 overflow-hidden"></div>
          <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 justify-between items-center gap-2">
            <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
              <template x-for="s in stores"><option :value="s.key" x-text="s.key"></option></template>
            </select>
            <div class="flex-1 overflow-x-auto">
              <div class="flex gap-0.5 whitespace-nowrap">
                <template x-for="it in pages">
                  <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn'">
                    <i class="ph ph-database"></i><span x-text="it.sig"></span>
                  </button>
                </template>
              </div>
            </div>
            <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
          </div>
        </div>
      </div>
    `,{
      show:0, store:'alp', stores:[], storeMap:{}, page:'', pages:[], jse:null,
      async refresh(){
        this.storeMap=await alp.load();
        this.stores=Object.keys(this.storeMap).map(key=>({key}));
        await this.goStore(alp.safeStore(this.store,this.storeMap));
      },
      async goStore(store){
        this.store=store;
        this.pages=this.storeMap[this.store]||[];
        this.pages.length ? this.goPage(this.pages[0].key) : this.jse?.set({json:{}});
      },
      async open(){
        this.show=1; await Alpine.nextTick();
        this.jse ||= await alp.install('jse',{
          target:this.find('[name="jse"]'),
          props:{mode:"tree",content:{json:{}},onChange:c=>this.handleChange(c)}
        });
        await this.refresh();
      },
      async handleChange({json}){
        await alp.saveRecord(this.page,json);
        const [store,sig]=this.page.split('.');
        Alpine.store(store)?.[sig] && Object.assign(Alpine.store(store)[sig],json);
      },
      async goPage(k){
        this.page=k;
        const data=await alp.loadRecord(k);
        console.log('goPage',k,data);
        await this.jse.set({json:data||{}});
      },
      async clear(){ await alp.deleteRecord(this.page); await this.refresh(); }
    });

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