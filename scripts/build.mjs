import { createRequire } from 'node:module';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveAnalysisEndpoint } from './analysis-endpoint.mjs';
const require = createRequire(import.meta.url);
const { build } = require(process.argv[2] ? resolve(process.argv[2]) : 'esbuild');
const endpoint = resolveAnalysisEndpoint(process.env.ANALYSIS_API_URL);
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== packageJson.version) throw new Error('Manifest and package versions differ');
manifest.host_permissions = [endpoint.hostPermission];
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/device-probe.ts'], bundle: true, outfile: 'dist/device-probe.js',
  format: 'iife', platform: 'browser', target: 'chrome120', minify: true });
await build({ entryPoints: ['src/content.ts'], bundle: true, outfile: 'dist/content.js',
  format: 'iife', platform: 'browser', target: 'chrome120', minify: true });
await build({ entryPoints: ['src/background.ts'], bundle: true, outfile: 'dist/background.js',
  format: 'iife', platform: 'browser', target: 'chrome120', minify: true,
  define: { __ANALYSIS_API_URL__: JSON.stringify(endpoint.url) } });
await writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
await build({entryPoints:['src/popup.ts'],bundle:true,outfile:'dist/popup.js',format:'iife',target:'chrome120',minify:true});
await copyFile('popup.html', 'dist/popup.html');
await copyFile('popup.css', 'dist/popup.css');
console.log('Built dist/');
