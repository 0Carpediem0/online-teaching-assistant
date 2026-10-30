import { createRequire } from 'node:module';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { build } = require(process.argv[2] ? resolve(process.argv[2]) : 'esbuild');
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/content.ts'], bundle: true, outfile: 'dist/content.js',
  format: 'iife', platform: 'browser', target: 'chrome120', minify: true });
await copyFile('manifest.json', 'dist/manifest.json');
await build({entryPoints:['src/popup.ts'],bundle:true,outfile:'dist/popup.js',format:'iife',target:'chrome120',minify:true});
await copyFile('popup.html', 'dist/popup.html');
console.log('Built dist/');
