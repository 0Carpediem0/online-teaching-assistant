import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
await build({ entryPoints: ['./server/index.ts'], outfile: 'dist-server/index.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22' });
console.log('Built dist-server/');
