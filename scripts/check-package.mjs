import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolveAnalysisEndpoint } from './analysis-endpoint.mjs';

const endpoint = resolveAnalysisEndpoint(process.env.ANALYSIS_API_URL);
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.version, packageJson.version, 'Build version differs from package version');
assert.deepEqual(manifest.host_permissions, [endpoint.hostPermission], 'Build permission differs from configured backend');
for (const file of ['background.js', 'content.js', 'device-probe.js', 'popup.js', 'popup.html', 'popup.css']) {
  assert.ok((await stat(`dist/${file}`)).size > 0, `Missing or empty build file: ${file}`);
}
const background = await readFile('dist/background.js', 'utf8');
assert.ok(background.includes(endpoint.url), 'Background script does not contain the configured backend URL');
console.log(`Package check passed: version ${manifest.version}, backend ${endpoint.hostPermission}`);
