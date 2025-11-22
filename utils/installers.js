// Lazy-loaded library installers
// Usage: alp.install('jse', opts) or alp.install('tt', opts)

export const installers = {
  // JSON Editor - vanilla-jsoneditor
  jse: opts => import('https://unpkg.com/vanilla-jsoneditor/standalone.js')
    .then(({ createJSONEditor }) => createJSONEditor(opts)),

  // Tabulator Tables
  tt: opts => new Promise(resolve => {
    const table = new Tabulator(opts.target, opts.props);
    table.on("tableBuilt", () => resolve(table));
  })

  // Future: codemirror, ace, monaco, etc.
};
