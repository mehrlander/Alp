// utils/fills.js - Template fill helpers for alp components
export const fills = {
  pathInput: () => `
    <input x-model="path"
      @blur="usePath(path)"
      @keydown.enter.prevent="$el.blur()"
      class="input input-xs input-ghost text-xs text-right w-48"
      placeholder="path">`,
  deleteButton: () => `
    <button @click="del()" class="btn btn-xs btn-error btn-outline">
      <i class="ph ph-trash"></i>
    </button>`,
  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
  toolbar: (...items) => `<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,
  btn: (label, click, icon = '', classes = 'btn-primary') => `
    <button @click="${click}" class="btn btn-sm ${classes}">
      ${icon ? `<i class="ph ph-${icon}"></i>` : ''}<span>${label}</span>
    </button>`,
  modal: inner => `
    <dialog class="modal">
      <div class="modal-box w-full max-w-[95%] h-[80vh] p-0 shadow-lg flex flex-col overflow-hidden rounded-lg">
        ${inner}
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>`
};
