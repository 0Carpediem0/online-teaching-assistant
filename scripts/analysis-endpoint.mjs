export const DEFAULT_ANALYSIS_API_URL = 'http://127.0.0.1:8787/v1/analyze';

export function resolveAnalysisEndpoint(value = DEFAULT_ANALYSIS_API_URL) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error('ANALYSIS_API_URL must be an absolute URL without surrounding spaces');
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error('ANALYSIS_API_URL must be an absolute URL'); }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('ANALYSIS_API_URL must not contain credentials, query parameters or a fragment');
  }
  if (!url.pathname.endsWith('/v1/analyze')) {
    throw new Error('ANALYSIS_API_URL must end with /v1/analyze');
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('ANALYSIS_API_URL requires HTTPS outside localhost');
  }
  return { url: url.href, hostPermission: `${url.origin}/*` };
}
