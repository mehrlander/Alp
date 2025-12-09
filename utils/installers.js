// utils/installers.js - Third-party library installers

export const installers = {
  jse: opts => import('https://unpkg.com/vanilla-jsoneditor/standalone.js')
    .then(m => m.createJSONEditor(opts)),

  tt: ({ target, ...props }) => new Promise(r => {
    const t = new Tabulator(target, props);
    t.on('tableBuilt', () => r(t));
  })
};
