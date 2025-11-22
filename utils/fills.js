// Reusable UI template fills
// Usage: alp.fill('pathInput') or alp.fill('toolbar', ['deleteButton'])

export const fills = {
  pathInput: () => `<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()"
    class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`,

  deleteButton: () => `<button @click="del()" class="btn btn-xs btn-error">Delete</button>`,

  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,

  toolbar: (items) => `<div class="flex gap-1">${items.map(i => fills[i]?.() || '').join('')}</div>`,

  // Pages navigation buttons for IndexedDB records
  pagesButtons: () => `
    <div class="flex gap-0.5 overflow-x-auto max-w-48">
      <template x-for="it in pages">
        <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn-ghost'">
          <span x-text="it.sig" class="truncate max-w-16"></span>
        </button>
      </template>
    </div>`,

  // Store selector dropdown
  storeSelector: () => `
    <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
      <template x-for="s in stores">
        <option :value="s.key" x-text="s.key"></option>
      </template>
    </select>`
};
