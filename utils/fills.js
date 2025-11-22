// Reusable UI template fills
// Usage: alp.fill('pathInput') or alp.fill('toolbar', ['deleteButton'])

export const fills = {
  pathInput: () => `<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()"
    class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`,

  deleteButton: () => `<button @click="del()" class="btn btn-xs btn-error">Delete</button>`,

  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,

  toolbar: (items) => `<div class="flex gap-1">${items.map(i => fills[i]?.() || '').join('')}</div>`
};
