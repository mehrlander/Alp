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

          <!-- Branch source indicator -->
          <div x-show="branchSource" class="flex items-center gap-2 p-1 bg-success/10 rounded text-xs">
            <span class="badge badge-success badge-xs">Source</span>
            <span x-text="branchSource?.repo + '@' + branchSource?.branch"></span>
            <button @click="clearBranchSource()" class="btn btn-xs btn-ghost ml-auto">Clear & Reload</button>
          </div>

          <!-- Tabs -->
          <div class="flex items-center gap-2">
            <div class="tabs tabs-xs tabs-boxed">
              <button class="tab" :class="tab==='files'?'tab-active':''" @click="tab='files'">Files</button>
              <button class="tab" :class="tab==='branches'?'tab-active':''" @click="tab='branches'">Branches</button>
              <button class="tab" :class="tab==='commits'?'tab-active':''" @click="tab='commits'">Commits</button>
              <button class="tab" :class="tab==='info'?'tab-active':''" @click="tab='info'">Info</button>
            </div>
          </div>

          <!-- Loading -->
          <div x-show="loading" class="text-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <!-- Error -->
          <div x-show="error" class="text-error text-xs" x-text="error"></div>

          <!-- Files Tab -->
          <div x-show="tab==='files' && !loading" class="space-y-2">
            <!-- Selection controls -->
            <div class="flex items-center gap-2 text-xs">
              <span x-show="selectedFiles.length" class="text-primary" x-text="selectedFiles.length + ' selected'"></span>
              <button x-show="selectedFiles.length" @click="copySelectedFiles()" class="btn btn-xs btn-primary" :disabled="copying">
                <span x-show="copying" class="loading loading-spinner loading-xs"></span>
                <span x-show="!copying">Copy</span>
              </button>
              <span x-show="copyMsg" x-text="copyMsg" class="text-success text-[10px]"></span>
              <button x-show="selectedFiles.length" @click="selectedFiles = []" class="btn btn-xs btn-ghost">Clear</button>
            </div>
            <!-- File list -->
            <div class="max-h-48 overflow-y-auto">
              <div x-show="!files.length" class="text-xs text-base-content/50 italic">No files loaded</div>
              <template x-for="f in files" :key="f.path">
                <div
                  class="flex items-center gap-1 text-xs py-0.5 border-b border-base-300"
                  :class="f.type==='file' ? 'cursor-pointer hover:bg-base-300' : ''">
                  <template x-if="f.type==='file'">
                    <input type="checkbox" class="checkbox checkbox-xs"
                      :checked="selectedFiles.includes(f.path)"
                      @click="toggleFile(f.path)">
                  </template>
                  <span x-text="f.type==='dir'?'📁':'📄'" class="text-[10px]"></span>
                  <span x-text="f.path" class="truncate flex-1" @click="f.type==='file' && toggleFile(f.path)"></span>
                  <span class="text-base-content/50" x-text="f.size ? formatSize(f.size) : ''"></span>
                </div>
              </template>
            </div>
          </div>

          <!-- Branches Tab -->
          <div x-show="tab==='branches' && !loading" class="max-h-48 overflow-y-auto">
            <div x-show="!branches.length" class="text-xs text-base-content/50 italic">No branches loaded</div>
            <template x-for="b in branches" :key="b">
              <div
                class="flex items-center gap-2 text-xs py-1 px-1 border-b border-base-300 cursor-pointer hover:bg-base-300 rounded"
                :class="selectedBranch === b ? 'bg-primary/10' : ''"
                @click="selectBranch(b)">
                <span x-text="b === info.branch ? '★' : ''" class="text-warning text-[10px] w-3"></span>
                <span x-text="b" class="flex-1 truncate"></span>
                <template x-if="selectedBranch === b && !isActiveBranch(b)">
                  <button @click.stop="activateBranch()" class="btn btn-xs btn-primary">
                    Use as Source
                  </button>
                </template>
                <template x-if="isActiveBranch(b)">
                  <span class="badge badge-success badge-xs">Active Source</span>
                </template>
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
                <div><span class="font-semibold">Default Branch:</span> <span x-text="info.branch"></span></div>
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
      branches: [],
      selectedBranch: '',
      selectedFiles: [],
      copying: false,
      copyMsg: '',
      branchSource: null,

      async nav() {
        const data = await this.load();
        if (data) {
          this.repo = data.repo || '';
          this.token = data.token || '';
        }
        // Load branch source from storage
        this.branchSource = alp.getBranchSource();
        if (this.repo) this.refresh();
      },

      async saveConfig() {
        await this.save({ repo: this.repo, token: this.token });
      },

      async refresh() {
        if (!this.repo) return;
        this.loading = true;
        this.error = '';
        this.selectedFiles = [];

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

      async selectBranch(branch) {
        if (this.selectedBranch === branch) return;
        this.selectedBranch = branch;
        await this.switchBranch();
      },

      async switchBranch() {
        this.loading = true;
        this.error = '';
        this.selectedFiles = [];
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

      toggleFile(path) {
        const idx = this.selectedFiles.indexOf(path);
        if (idx >= 0) {
          this.selectedFiles.splice(idx, 1);
        } else {
          this.selectedFiles.push(path);
        }
      },

      async copySelectedFiles() {
        if (!this.selectedFiles.length) return;

        this.copying = true;
        this.error = '';
        this.copyMsg = '';

        try {
          const branch = this.selectedBranch || this.info.branch || 'main';
          const parts = [];

          for (const path of this.selectedFiles) {
            const content = await this.ghFetch('/repos/' + this.repo + '/contents/' + path + '?ref=' + branch, true);
            const ext = path.split('.').pop() || '';
            parts.push(`## ${path}\n\n\`\`\`${ext}\n${content}\n\`\`\``);
          }

          const markdown = parts.join('\n\n');

          // Use textarea fallback since clipboard API needs immediate user gesture
          const textarea = document.createElement('textarea');
          textarea.value = markdown;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);

          this.copyMsg = 'copied!';
          setTimeout(() => this.copyMsg = '', 2000);
        } catch (e) {
          this.error = 'Failed to copy files: ' + e.message;
          console.error('Copy files error:', e);
        }

        this.copying = false;
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
      },

      isActiveBranch(branch) {
        return this.branchSource?.repo === this.repo && this.branchSource?.branch === branch;
      },

      async activateBranch() {
        if (!this.selectedBranch || !this.repo) return;

        try {
          await alp.setBranchSource(this.repo, this.selectedBranch, this.token);
          this.branchSource = alp.getBranchSource();

          // Prompt user to reload
          if (confirm(`Branch source set to ${this.repo}@${this.selectedBranch}. Reload page to load components from this branch?`)) {
            location.reload();
          }
        } catch (e) {
          this.error = 'Failed to set branch source: ' + e.message;
          console.error('Set branch source error:', e);
        }
      },

      async clearBranchSource() {
        await alp.clearBranchSource();
        this.branchSource = null;
        location.reload();
      }
    }
  );
}
