import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['./src/analysis.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', target: 'node22' });
const { AnalysisSession, validateResponse } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
const session = new AnalysisSession();
const message = (eventId, text, platformTime, origin = 'observed') => ({
  eventId, text, platformTime, origin, observedAt: new Date().toISOString(), own: false, authorEvidence: 'unknown'
});
assert.equal(session.add(message('history', 'Старое сообщение', '10:39', 'initial')), null);
session.add(message('q1', 'Как сдать работу?', '10:42'));
session.add(message('q2', 'Куда отправлять работу?', '10:44'));
session.add(message('tech', 'Не слышно', '10:47'));
const request = session.prepareBatch();
assert.ok(request);
assert.deepEqual(request.messages.map(item => item.eventId), ['q1', 'q2', 'tech']);
assert.equal(session.prepareBatch(), null);
const response = { schemaVersion: '1.0', analysisId: request.analysisId,
  messageResults: [
    { eventId: 'q1', revision: 1, kind: 'question', topicId: 'homework', confidence: 0.9 },
    { eventId: 'q2', revision: 1, kind: 'question', topicId: 'homework', confidence: 0.9 },
    { eventId: 'tech', revision: 1, kind: 'technical_issue', topicId: 'audio', confidence: 0.9 }
  ],
  compiledQuestions: [{ questionId: 'question-homework', text: 'Как сдать работу?', eventIds: ['q1', 'q2'], topicId: 'homework' }],
  topics: [
    { topicId: 'homework', label: 'Сдача работы', kind: 'question', eventIds: ['q1', 'q2'] },
    { topicId: 'audio', label: 'Звук', kind: 'technical_issue', eventIds: ['tech'] }
  ] };
assert.throws(() => validateResponse(request, { ...response, analysisId: 'wrong' }));
assert.throws(() => validateResponse(request, { ...response, compiledQuestions: [{ ...response.compiledQuestions[0], eventIds: ['unknown'] }] }));
session.accept(request, response);
assert.equal(session.getDisplayQuestions().length, 1);
assert.deepEqual(session.getSummary(), {
  questionCount: 2, technicalIssueCount: 1, uncertainCount: 0,
  questionBuckets: [{ from: '10:40', to: '10:45', questionCount: 2 }],
  technicalIssues: [{ eventId: 'tech', text: 'Не слышно', platformTime: '10:47' }]
});
session.add(message('later', 'Ещё вопрос', '10:51'));
const next = session.prepareBatch();
assert.ok(next);
session.retry(next);
assert.deepEqual(session.prepareBatch().messages.map(item => item.eventId), ['later']);
const fallback = new AnalysisSession();
fallback.add(message('single-question', 'Что делать с заданием?', '10:52'));
const fallbackRequest = fallback.prepareBatch();
assert.ok(fallbackRequest);
fallback.accept(fallbackRequest, { schemaVersion: '1.0', analysisId: fallbackRequest.analysisId,
  messageResults: [{ eventId: 'single-question', revision: 1, kind: 'question', topicId: null, confidence: 0.8 }],
  compiledQuestions: [], topics: [] });
assert.deepEqual(fallback.getDisplayQuestions().map(question => question.text), ['Что делать с заданием?']);
console.log('Offline analysis contract check passed');
