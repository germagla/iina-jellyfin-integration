import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

await mkdir(path.join(root, 'dist'), { recursive: true });
await cp(path.join(root, 'packages/ui/dist'), path.join(root, 'dist'), {
  recursive: true,
  force: true,
});

await build({
  absWorkingDir: root,
  entryPoints: {
    global: 'packages/plugin/src/global.ts',
    index: 'packages/plugin/src/index.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  // Safari 14.1 is the first JavaScriptCore target esbuild marks as fully
  // compatible with the destructuring used by the runtime and bundled Zod.
  target: ['safari14.1'],
  sourcemap: true,
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
});
