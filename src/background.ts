import type { AnalysisRequest } from './analysis';

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type !== 'teacher-run-analysis') return;
  const request = message.request as AnalysisRequest;
  void fetch('http://127.0.0.1:8787/v1/analyze', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(125_000)
  }).then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    reply({ ok: true, result: await response.json() });
  }).catch(() => reply({ ok: false, error: 'Локальный анализатор недоступен или вернул ошибку.' }));
  return true;
});
