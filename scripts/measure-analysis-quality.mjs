import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const cases = [
  ['Когда сдавать домашнее задание?', 'question', 'deadline'],
  ['До какого числа нужно отправить домашку?', 'question', 'deadline'],
  ['Какой крайний срок сдачи задания?', 'question', 'deadline'],
  ['Нужно загрузить отчёт вместе с кодом?', 'question', 'submission'],
  ['Код прикладывать к отчёту?', 'question', 'submission'],
  ['Почему в третьем пункте меняется знак?', 'question', 'sign'],
  ['Откуда взялось значение в последней формуле?', 'question', 'formula'],
  ['Я вас не слышу.', 'technical_issue', 'audio'],
  ['Пропал звук преподавателя.', 'technical_issue', 'audio'],
  ['У меня зависло видео.', 'technical_issue', 'video'],
  ['Ссылка на встречу не открывается.', 'technical_issue', 'connection'],
  ['Не могу подключиться по ссылке.', 'technical_issue', 'connection'],
  ['Спасибо, всё понятно.', 'other', null],
  ['Я сейчас вернусь.', 'other', null],
  ['Хорошо.', 'other', null],
  ['Можно ли сдать лабораторную в PDF?', 'question', 'format']
].map(([text, kind, group], index) => ({ eventId: `sample-${index + 1}`, text, kind, group }));

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()];
  }));
if (!env.ANALYSIS_API_TOKEN || env.ANALYSIS_API_TOKEN === 'CHANGE_ME')
  throw new Error('Заполните ANALYSIS_API_TOKEN в .env');

const request = {
  schemaVersion: '1.0', analysisId: randomUUID(),
  session: { sessionId: randomUUID(), startedAt: new Date().toISOString(), timeZone: 'Asia/Yekaterinburg' },
  task: { type: 'classify_and_group_messages', timeBucketMinutes: 5 },
  messages: cases.map(({ eventId, text }) => ({ eventId, revision: 1, text, platformTime: '10:42' }))
};
const started = performance.now();
const response = await fetch('http://127.0.0.1:8787/v1/analyze', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.ANALYSIS_API_TOKEN}` },
  body: JSON.stringify(request), signal: AbortSignal.timeout(125_000)
});
if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  throw new Error(`API вернул ${response.status}: ${payload.error ?? 'unknown'}`);
}
const result = await response.json();
const predicted = new Map(result.messageResults.map(item => [item.eventId, item.kind]));
const classes = ['question', 'technical_issue', 'other'];
const byClass = Object.fromEntries(classes.map(kind => {
  const tp = cases.filter(item => item.kind === kind && predicted.get(item.eventId) === kind).length;
  const fp = cases.filter(item => item.kind !== kind && predicted.get(item.eventId) === kind).length;
  const fn = cases.filter(item => item.kind === kind && predicted.get(item.eventId) !== kind).length;
  return [kind, { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 0,
    recall: tp + fn ? tp / (tp + fn) : 0, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0 }];
}));
const pair = (a, b) => [a, b].sort().join('|');
const expectedPairs = new Set();
for (const a of cases) for (const b of cases) if (a.eventId < b.eventId && a.group && a.group === b.group)
  expectedPairs.add(pair(a.eventId, b.eventId));
const actualPairs = new Set();
for (const group of [...result.compiledQuestions, ...result.compiledTechnicalIssues])
  for (const a of group.eventIds) for (const b of group.eventIds) if (a < b) actualPairs.add(pair(a, b));
const falseMerges = [...actualPairs].filter(value => !expectedPairs.has(value));
const missedMerges = [...expectedPairs].filter(value => !actualPairs.has(value));
console.log(JSON.stringify({ model: env.ANALYSIS_MODEL, sampleSize: cases.length,
  latencyMs: Math.round(performance.now() - started), byClass,
  uncertain: [...predicted.values()].filter(kind => kind === 'uncertain').length,
  grouping: { expectedPairs: expectedPairs.size, actualPairs: actualPairs.size,
    falseMergePairs: falseMerges, missedMergePairs: missedMerges } }, null, 2));
