import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['./src/analysis.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'node22' });
const { AnalysisSession } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
const session = new AnalysisSession();
for (const [eventId, text, platformTime] of [
  ['question-1', 'Когда сдавать домашнее задание?', '15:01'],
  ['question-2', 'Какой срок сдачи домашки?', '15:03'],
  ['audio-issue', 'Не слышно преподавателя', '15:07'],
  ['audio-issue-2', 'Очень плохой звук, вас не слышно', '15:08']
]) session.add({ eventId, text, platformTime, observedAt: new Date().toISOString(),
  origin: 'observed', own: false, authorEvidence: 'unknown' });
const request = session.prepareBatch();
assert.ok(request);
const started = Date.now();
const response = await fetch(process.env.ANALYSIS_API_URL ?? 'http://127.0.0.1:8787/v1/analyze', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(request), signal: AbortSignal.timeout(125_000)
});
if (!response.ok) throw new Error(`Analysis API returned ${response.status}: ${await response.text()}`);
session.accept(request, await response.json());
const summary = session.getSummary();
const results = session.getResults()[0];
const grouped = results.compiledQuestions.some(question =>
  question.eventIds.includes('question-1') && question.eventIds.includes('question-2'));
console.log(JSON.stringify({ durationSeconds: Math.round((Date.now() - started) / 1000),
  classifications: results.messageResults.map(({ eventId, kind }) => ({ eventId, kind })),
  compiledQuestions: results.compiledQuestions,
  compiledTechnicalIssues: results.compiledTechnicalIssues,
  questionBuckets: summary.questionBuckets }, null, 2));
assert.equal(results.messageResults.find(result => result.eventId === 'audio-issue')?.kind, 'technical_issue');
assert.ok(grouped, 'Похожие вопросы не объединены');
assert.ok(results.compiledTechnicalIssues.some(issue =>
  issue.eventIds.includes('audio-issue') && issue.eventIds.includes('audio-issue-2')),
  'Похожие технические проблемы не объединены');
const single = new AnalysisSession();
const longQuestion = 'Я никак не могу понять, каким образом надо отправлять готовую лабораторную работу, подскажите пожалуйста';
single.add({ eventId: 'single-question', text: longQuestion, platformTime: '15:12',
  observedAt: new Date().toISOString(), origin: 'observed', own: false, authorEvidence: 'unknown' });
const singleRequest = single.prepareBatch();
assert.ok(singleRequest);
const singleResponse = await fetch(process.env.ANALYSIS_API_URL ?? 'http://127.0.0.1:8787/v1/analyze', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(singleRequest), signal: AbortSignal.timeout(125_000)
});
if (!singleResponse.ok) throw new Error(`Single-question analysis returned ${singleResponse.status}: ${await singleResponse.text()}`);
single.accept(singleRequest, await singleResponse.json());
const shortened = single.getDisplayQuestions()[0]?.text;
assert.ok(shortened && shortened.length < longQuestion.length, 'Одиночный вопрос не сокращён');
console.log(JSON.stringify({ singleQuestionSummary: shortened }, null, 2));
