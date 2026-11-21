import type { AnalysisRequest } from './analysis';

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type !== 'teacher-run-analysis') return;
  const request = message.request as AnalysisRequest;
  void fetch(__ANALYSIS_API_URL__, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(125_000),
    credentials: 'omit', redirect: 'error'
  }).then(async response => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      reply({ ok: false, error: payload.error ?? `http_${response.status}` });
      return;
    }
    reply({ ok: true, result: await response.json() });
  }).catch(error => reply({ ok: false, error: error?.name === 'TimeoutError' ? 'request_timeout' : 'service_unavailable' }));
  return true;
});
