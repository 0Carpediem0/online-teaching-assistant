import assert from 'node:assert/strict';
import { DEFAULT_ANALYSIS_API_URL, resolveAnalysisEndpoint } from './analysis-endpoint.mjs';

assert.deepEqual(resolveAnalysisEndpoint(), {
  url: DEFAULT_ANALYSIS_API_URL, hostPermission: 'http://127.0.0.1:8787/*'
});
assert.deepEqual(resolveAnalysisEndpoint('https://analysis.example.org:8443/assistant/v1/analyze'), {
  url: 'https://analysis.example.org:8443/assistant/v1/analyze',
  hostPermission: 'https://analysis.example.org:8443/*'
});
for (const invalid of [
  '', 'analysis.example.org/v1/analyze', 'http://analysis.example.org/v1/analyze',
  'https://user:secret@analysis.example.org/v1/analyze',
  'https://analysis.example.org/v1/analyze?token=secret',
  'https://analysis.example.org/v1/analyze#section',
  'https://analysis.example.org/other', 'file:///v1/analyze'
]) assert.throws(() => resolveAnalysisEndpoint(invalid), `Unsafe URL accepted: ${invalid}`);
console.log('Endpoint configuration check passed');
