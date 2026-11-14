import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

function buildInfo() {
  return {
    name: 'build-info',
    generateBundle() {
      const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim());
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
