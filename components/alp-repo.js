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
          <!-- Tabs + current file -->
          <div class="flex items-center gap-2">
            <div class="tabs tabs-xs tabs-boxed">
              <button class="tab" :class="tab==='files'?'tab-active':''" @click="tab='files'; currentFile=null">Files</button>
              <button class="tab" :class="tab==='commits'?'tab-active':''" @click="tab='commits'; currentFile=null">Commits</button>
              <button class="tab" :class="tab==='branches'?'tab-active':''" @click="tab='branches'; currentFile=null">Branches</button>
              <button class="tab" :class="tab==='info'?'tab-active':''" @click="tab='info'; currentFile=null">Info</button>
            </div>
            <span x-show="currentFile" class="text-xs text-primary truncate flex-1" x-text="currentFile"></span>
            <button x-show="currentFile" @click="currentFile=null; fileContent=''" class="btn btn-xs btn-ghost">✕</button>
          </div>

          <!-- Loading -->
          <div x-show="loading" class="text-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <!-- Error -->
          <div x-show="error" class="text-error text-xs" x-text="error"></div>

          <!-- File Content View -->
          <div x-show="currentFile && !loading" class="max-h-64 overflow-auto">
            <pre class="text-xs bg-base-300 p-2 rounded overflow-x-auto"><code x-text="fileContent"></code></pre>
          </div>

          <!-- Files Tab -->
          <div x-show="tab==='files' && !currentFile && !loading" class="max-h-48 overflow-y-auto">
            <div x-show="!files.length" class="text-xs text-base-content/50 italic">No files loaded</div>
            <template x-for="f in files" :key="f.path">
              <div
                class="flex items-center gap-1 text-xs py-0.5 border-b border-base-300"
                :class="f.type==='file' ? 'cursor-pointer hover:bg-base-300' : ''"
                @click="f.type==='file' && openFile(f.path)">
                <span x-text="f.type==='dir'?'📁':'📄'" class="text-[10px]"></span>
                <span x-text="f.path" class="truncate"></span>
                <span class="text-base-content/50 ml-auto" x-text="f.size ? formatSize(f.size) : ''"></span>
              </div>
            </template>
          </div>

          <!-- Commits Tab -->
          <div x-show="tab==='commits' && !currentFile && !loading" class="max-h-48 overflow-y-auto space-y-1">
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

          <!-- Branches Tab -->
          <div x-show="tab==='branches' && !currentFile && !loading" class="max-h-48 overflow-y-auto space-y-1">
            <div x-show="!branchDetails.length" class="text-xs text-base-content/50 italic">No branches loaded</div>
            <template x-for="b in branchDetails" :key="b.name">
              <div class="text-xs border-b border-base-300 pb-1 cursor-pointer hover:bg-base-300 px-1 -mx-1 rounded"
                   @click="selectedBranch = b.name; switchBranch()">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-1">
                    <span class="font-semibold" :class="b.name === selectedBranch ? 'text-primary' : ''" x-text="b.name"></span>
                    <span x-show="b.name === info.branch" class="badge badge-xs badge-primary">default</span>
                    <span x-show="b.protected" class="badge badge-xs badge-warning">protected</span>
                  </div>
                  <span class="text-base-content/50" x-text="formatDate(b.updated)"></span>
                </div>
                <div class="flex justify-between text-base-content/50">
                  <span class="font-mono" x-text="b.sha.slice(0,7)"></span>
                  <span x-text="b.author"></span>
                </div>
              </div>
            </template>
          </div>

          <!-- Info Tab -->
          <div x-show="tab==='info' && !currentFile && !loading" class="text-xs space-y-1">
            <div x-show="!info.name" class="text-base-content/50 italic">No repo info loaded</div>
            <template x-if="info.name">
              <div class="space-y-1">
                <div><span class="font-semibold">Name:</span> <span x-text="info.name"></span></div>
                <div><span class="font-semibold">Description:</span> <span x-text="info.description || 'None'"></span></div>
                <div><span class="font-semibold">Stars:</span> <span x-text="info.stars"></span></div>
                <div><span class="font-semibold">Forks:</span> <span x-text="info.forks"></span></div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold">Branch:</span>
                  <select x-model="selectedBranch" @change="switchBranch()" class="select select-xs flex-1">
                    <template x-for="b in branches" :key="b">
                      <option :value="b" x-text="b"></option>
                    </template>
                  </select>
                </div>
                <div><span class="font-semibold">Updated:</span> <span x-text="formatDate(info.updated)"></span></div>
              </div>
            </template>
          </div>
        </div>
        <div class="flex justify-between items-center px-2 py-1 bg-base-300 text-xs gap-2">
          <input x-model="repo" @blur="saveConfig()" @keydown.enter="refresh()"
            class="input input-xs flex-1" placeholder="owner/repo">
          <input x-model="token" @blur="saveConfig()" type="password"
            class="input input-xs w-24" placeholder="token">
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
      branches: [],
      branchDetails: [],
      selectedBranch: '',
      currentFile: null,
      fileContent: '',

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
        this.currentFile = null;
        this.fileContent = '';

        try {
          await this.fetchInfo();
          await this.fetchBranches();
          this.selectedBranch = this.info.branch;
          await Promise.all([
            this.fetchFiles(),
            this.fetchCommits()
          ]);
        } catch (e) {
          this.error = e.message;
          console.error('Repo fetch error:', e);
        }

        this.loading = false;
      },

      async switchBranch() {
        this.loading = true;
        this.error = '';
        this.currentFile = null;
        this.fileContent = '';
        try {
          await Promise.all([
            this.fetchFiles(),
            this.fetchCommits()
          ]);
        } catch (e) {
          this.error = e.message;
          console.error('Branch switch error:', e);
        }
        this.loading = false;
      },

      async ghFetch(endpoint, raw = false) {
        const headers = { 'Accept': raw ? 'application/vnd.github.v3.raw' : 'application/vnd.github.v3+json' };
        if (this.token) headers['Authorization'] = 'token ' + this.token;

        const res = await fetch('https://api.github.com' + endpoint, { headers });
        if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 100));
        return raw ? res.text() : res.json();
      },

      async openFile(path) {
        this.loading = true;
        this.error = '';
        try {
          const branch = this.selectedBranch || this.info.branch || 'main';
          this.fileContent = await this.ghFetch('/repos/' + this.repo + '/contents/' + path + '?ref=' + branch, true);
          this.currentFile = path;
        } catch (e) {
          this.error = 'Failed to load file: ' + e.message;
          console.error('File fetch error:', e);
        }
        this.loading = false;
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

      async fetchBranches() {
        const data = await this.ghFetch('/repos/' + this.repo + '/branches?per_page=100');
        this.branches = data.map(b => b.name);
        this.branchDetails = data.map(b => ({
          name: b.name,
          sha: b.commit.sha,
          protected: b.protected,
          // Commit details need separate fetch, we'll get them lazily
          author: '',
          updated: ''
        }));
        // Fetch commit details for each branch (limit to first 10 for performance)
        await this.fetchBranchCommits();
      },

      async fetchBranchCommits() {
        const toFetch = this.branchDetails.slice(0, 15);
        await Promise.all(toFetch.map(async (b, i) => {
          try {
            const commit = await this.ghFetch('/repos/' + this.repo + '/commits/' + b.sha);
            this.branchDetails[i] = {
              ...this.branchDetails[i],
              author: commit.commit.author.name,
              updated: commit.commit.author.date
            };
          } catch (e) {
            console.warn('Failed to fetch commit for branch', b.name, e);
          }
        }));
      },

      async fetchFiles() {
        const branch = this.selectedBranch || this.info.branch || 'main';
        const data = await this.ghFetch('/repos/' + this.repo + '/git/trees/' + branch + '?recursive=1');
        this.files = (data.tree || []).slice(0, 100).map(f => ({
          path: f.path,
          type: f.type === 'tree' ? 'dir' : 'file',
          size: f.size
        }));
      },

      async fetchCommits() {
        const branch = this.selectedBranch || this.info.branch || 'main';
        const data = await this.ghFetch('/repos/' + this.repo + '/commits?sha=' + branch + '&per_page=20');
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
