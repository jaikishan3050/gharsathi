import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

function buildInfo() {
  return {
    name: 'build-info',
    generateBundle() {
      let commit = process.env.BUILD_COMMIT || process.env.GITHUB_SHA || '';
      let dirty = true;
      const gitOptions = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
      try {
        commit ||= execFileSync('git', ['rev-parse', 'HEAD'], gitOptions).trim();
        dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], gitOptions).trim());
      } catch {
        // Container build contexts omit .git. Only a supplied full revision can
        // identify that artifact; unknown builds remain explicitly unverified.
        dirty = !/^[a-f0-9]{40}$/.test(commit);
      }
      commit ||= 'unknown';
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({
        commit, dirty, built_at: new Date().toISOString(),
      }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), buildInfo()],
  server: { host: '0.0.0.0' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    sequence: { concurrent: false },
  },
});
