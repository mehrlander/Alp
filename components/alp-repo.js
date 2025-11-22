// Repo component - displays GitHub repo info (files, commits)
import { alp } from '../core/alp-core.js';

export function defineRepoComponent() {
  alp.define("repo",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <span class="text-xs font-semibold">Repo</span>
          <div class="flex gap-1">
            <button @click="refresh()" class="btn btn-xs btn-ghost" :disabled="loading">↻</button>
          </div>
        </div>

        <div class="p-2 space-y-2">
          <!-- Config -->
          <div class="flex gap-2">
            <input x-model="repo" @blur="saveConfig()" @keydown.enter="refresh()"
              class="input input-xs flex-1" placeholder="owner/repo">
            <input x-model="token" @blur="saveConfig()" type="password"
              class="input input-xs w-24" placeholder="token">
          </div>

          <!-- Tabs -->
          <div class="tabs tabs-xs tabs-boxed">
            <button class="tab" :class="tab==='files'?'tab-active':''" @click="tab='files'">Files</button>
            <button class="tab" :class="tab==='commits'?'tab-active':''" @click="tab='commits'">Commits</button>
            <button class="tab" :class="tab==='info'?'tab-active':''" @click="tab='info'">Info</button>
          </div>

          <!-- Loading -->
          <div x-show="loading" class="text-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <!-- Error -->
          <div x-show="error" class="text-error text-xs" x-text="error"></div>

          <!-- Files Tab -->
          <div x-show="tab==='files' && !loading" class="max-h-48 overflow-y-auto">
            <div x-show="!files.length" class="text-xs text-base-content/50 italic">No files loaded</div>
            <template x-for="f in files" :key="f.path">
              <div class="flex items-center gap-1 text-xs py-0.5 border-b border-base-300">
                <span x-text="f.type==='dir'?'📁':'📄'" class="text-[10px]"></span>
                <span x-text="f.path" class="truncate"></span>
                <span class="text-base-content/50 ml-auto" x-text="f.size ? formatSize(f.size) : ''"></span>
              </div>
            </template>
          </div>

          <!-- Commits Tab -->
          <div x-show="tab==='commits' && !loading" class="max-h-48 overflow-y-auto space-y-1">
            <div x-show="!commits.length" class="text-xs text-base-content/50 italic">No commits loaded</div>
            <template x-for="c in commits" :key="c.sha">
              <div class="text-xs border-b border-base-300 pb-1">
                <div class="flex justify-between">
                  <span class="font-mono text-primary" x-text="c.sha.slice(0,7)"></span>
                  <span class="text-base-content/50" x-text="formatDate(c.date)"></span>
                </div>
                <div class="truncate" x-text="c.message"></div>
                <div class="text-base-content/50" x-text="c.author"></div>
              </div>
            </template>
          </div>

          <!-- Info Tab -->
          <div x-show="tab==='info' && !loading" class="text-xs space-y-1">
            <div x-show="!info.name" class="text-base-content/50 italic">No repo info loaded</div>
            <template x-if="info.name">
              <div class="space-y-1">
                <div><span class="font-semibold">Name:</span> <span x-text="info.name"></span></div>
                <div><span class="font-semibold">Description:</span> <span x-text="info.description || 'None'"></span></div>
                <div><span class="font-semibold">Stars:</span> <span x-text="info.stars"></span></div>
                <div><span class="font-semibold">Forks:</span> <span x-text="info.forks"></span></div>
                <div><span class="font-semibold">Default branch:</span> <span x-text="info.branch"></span></div>
                <div><span class="font-semibold">Updated:</span> <span x-text="formatDate(info.updated)"></span></div>
              </div>
            </template>
          </div>
        </div>
      </div>
    `,
    {
      repo: '',
      token: '',
      tab: 'files',
      loading: false,
      error: '',
      files: [],
      commits: [],
      info: {},

      async nav() {
        const data = await this.load();
        if (data) {
          this.repo = data.repo || '';
          this.token = data.token || '';
        }
        if (this.repo) this.refresh();
      },

      async saveConfig() {
        await this.save({ repo: this.repo, token: this.token });
      },

      async refresh() {
        if (!this.repo) return;
        this.loading = true;
        this.error = '';

        try {
          await Promise.all([
            this.fetchInfo(),
            this.fetchFiles(),
            this.fetchCommits()
          ]);
        } catch (e) {
          this.error = e.message;
          console.error('Repo fetch error:', e);
        }

        this.loading = false;
      },

      async ghFetch(endpoint) {
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (this.token) headers['Authorization'] = 'token ' + this.token;

        const res = await fetch('https://api.github.com' + endpoint, { headers });
        if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 100));
        return res.json();
      },

      async fetchInfo() {
        const data = await this.ghFetch('/repos/' + this.repo);
        this.info = {
          name: data.full_name,
          description: data.description,
          stars: data.stargazers_count,
          forks: data.forks_count,
          branch: data.default_branch,
          updated: data.updated_at
        };
      },

      async fetchFiles() {
        const data = await this.ghFetch('/repos/' + this.repo + '/git/trees/' + (this.info.branch || 'main') + '?recursive=1');
        this.files = (data.tree || []).slice(0, 100).map(f => ({
          path: f.path,
          type: f.type === 'tree' ? 'dir' : 'file',
          size: f.size
        }));
      },

      async fetchCommits() {
        const data = await this.ghFetch('/repos/' + this.repo + '/commits?per_page=20');
        this.commits = data.map(c => ({
          sha: c.sha,
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date
        }));
      },

      formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
      },

      formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
      }
    }
  );
}
