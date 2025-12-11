// utils/fills.js - Template fill helpers for alp components
const mc = (prefix, mods) => mods.map(m => `${prefix}-${m}`).join(' ');
const sz = mods => ['xs', 'sm', 'md', 'lg', 'xl'].find(s => mods.includes(s));
const pos = mods => ['top', 'bottom', 'left', 'right'].find(p => mods.includes(p)) || 'bottom';

export const fills = {
  pathInput: () => `
    <input x-model="path"
      @blur="usePath(path)"
      @keydown.enter.prevent="$el.blur()"
      class="input input-xs input-ghost text-xs text-right w-48"
      placeholder="path">`,
  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
  toolbar: (...items) => `<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,
  btn: (mods, label, click, iconClasses = '', extraClasses = '') => `
    <button @click="${click}" class="btn ${mc('btn', mods)} ${extraClasses}">
      ${iconClasses ? `<i class="ph ${iconClasses} ${sz(mods) ? `text-${sz(mods)}` : ''}"></i>` : ''}
      ${label ? `<span>${label}</span>` : ''}
    </button>`,
  modal: (inner) => `
    <dialog class="modal">
      <div class="modal-box w-full max-w-[95%] h-[80vh] p-0 shadow-lg flex flex-col overflow-hidden rounded-lg">
        ${inner}
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>`,
  tip: (mods, trigger, content) => `
    <div class="tooltip tooltip-${pos(mods)}">
      <div class="tooltip-content bg-base-100 text-base-content border border-base-300 ${sz(mods) ? `text-${sz(mods)}` : 'text-xs'} rounded-box shadow-lg p-3">${content}</div>
      ${trigger}
    </div>`
};
