// utils/fills.js - Template fill helpers for alp components
export const fills = {
  pathInput: () => `
    <input x-model="path"
      @blur="usePath(path)"
      @keydown.enter.prevent="$el.blur()"
      class="input input-xs input-ghost text-xs text-right w-48"
      placeholder="path">`,
  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
  toolbar: (...items) => `<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,
  btn: (label, click, iconClasses = '', btnClasses = 'btn-primary') => {
    const sz = btnClasses.match(/btn-(xs|sm|md|lg|xl)/)?.[1];
    const iconSz = sz ? `text-${sz}` : '';
    return `
      <button @click="${click}" class="btn ${btnClasses}">
        ${iconClasses ? `<i class="ph ${iconClasses} ${iconSz}"></i>` : ''}
        ${label ? `<span>${label}</span>` : ''}
      </button>`;
  },
  modal: inner => `
    <dialog class="modal">
      <div class="modal-box w-full max-w-[95%] h-[80vh] p-0 shadow-lg flex flex-col overflow-hidden rounded-lg">
        ${inner}
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>`
};
