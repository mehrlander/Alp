// Rows component - dynamic table editor using Tabulator
import { alp } from '../core/alp-core.js';

export function defineRowsComponent() {
  alp.define("rows",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <div class="flex items-center gap-1">
            <span class="text-xs font-semibold">Rows</span>
            ${alp.fill('codeModal', 'rows')}
          </div>
          <div class="flex gap-1 items-center">
            <button @click="addRow()" class="btn btn-xs btn-ghost">+ add</button>
          </div>
        </div>
        <div name="rows-table"></div>
        <div class="flex justify-between items-center px-2 py-1 bg-base-300 text-xs gap-2">
          <div class="flex-1"></div>
          ${alp.fill('pathInput')}
        </div>
      </div>
    `,
    {
      tt: null,

      async nav() {
        const data = await this.load();
        if (data && !data.hasOwnProperty('rows')) {
          alert('Path contains incompatible data (expected rows property)');
          this.path = this.defaultPath;
          return;
        }
        await this.loadTable();
      },

      async loadTable() {
        const loaded = await this.load();
        const data = loaded?.rows || [];

        const cols = (f => (f.length ? f : ['key', 'value'])
          .map(k => ({ title: k, field: k, editor: "input" })))
          ([...new Set(data.flatMap(Object.keys))]);

        if (this.tt) {
          this.tt.setColumns(cols);
          this.tt.setData(data);
        } else {
          this.tt = await alp.install('tt', {
            target: this.find('[name="rows-table"]'),
            props: {
              data,
              layout: "fitColumns",
              addRowPos: "bottom",
              columns: cols
            }
          });
          ["cellEdited", "rowAdded", "rowDeleted"].forEach(e =>
            this.tt.on(e, () => this.save({ rows: this.tt.getData() }))
          );
        }
      },

      savedCallback(data) {
        this.loadTable();
      },

      addRow() {
        this.tt?.addRow({});
      }
    }
  );
}
