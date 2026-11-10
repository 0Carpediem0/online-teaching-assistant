import type { ObservedMessage } from './adapter';

export type MessageKind = 'question' | 'technical_issue' | 'other' | 'uncertain';
export type ProcessingStatus = 'pending' | 'in_flight' | 'analyzed';
export interface ChatEvent {
  schemaVersion: '1.0'; eventId: string; sessionId: string; type: 'chat.message';
  revision: number; text: string; platformTime: { raw: string; minuteOfDay: number | null };
  observedAt: string; processingStatus: ProcessingStatus;
}
export interface AnalysisRequest {
  schemaVersion: '1.0'; analysisId: string;
  session: { sessionId: string; startedAt: string; timeZone: string };
  task: { type: 'classify_and_group_messages'; timeBucketMinutes: 5 };
  messages: { eventId: string; revision: number; text: string; platformTime: string }[];
}
export interface AnalysisResponse {
  schemaVersion: '1.0'; analysisId: string;
  messageResults: { eventId: string; revision: number; kind: MessageKind; topicId: string | null; confidence: number }[];
  compiledQuestions: { questionId: string; text: string; eventIds: string[]; topicId: string | null }[];
  topics: { topicId: string; label: string; kind: 'question' | 'technical_issue'; eventIds: string[] }[];
}
export interface AnalysisClient { analyze(request: AnalysisRequest): Promise<AnalysisResponse> }
export interface QuestionBucket { from: string; to: string; questionCount: number }
export interface AnalysisSummary {
  questionCount: number; technicalIssueCount: number; uncertainCount: number;
  questionBuckets: QuestionBucket[];
  technicalIssues: { eventId: string; text: string; platformTime: string }[];
}

export function parsePlatformTime(raw: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function normalizeMessage(message: ObservedMessage, sessionId: string): ChatEvent | null {
  if (message.origin !== 'observed' || !message.text.trim()) return null;
  const raw = message.platformTime?.trim() ?? '';
  return { schemaVersion: '1.0', eventId: message.eventId, sessionId, type: 'chat.message',
    revision: 1, text: message.text.trim(), platformTime: { raw, minuteOfDay: parsePlatformTime(raw) },
    observedAt: message.observedAt, processingStatus: 'pending' };
}

export class AnalysisSession {
  readonly sessionId = crypto.randomUUID();
  readonly startedAt = new Date().toISOString();
  readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private events = new Map<string, ChatEvent>();
  private results = new Map<string, AnalysisResponse>();

  add(message: ObservedMessage): ChatEvent | null {
    const event = normalizeMessage(message, this.sessionId);
    if (event && !this.events.has(event.eventId)) this.events.set(event.eventId, event);
    return event;
  }
  getEvents(): ChatEvent[] { return [...this.events.values()].map(event => ({ ...event, platformTime: { ...event.platformTime } })); }
  getResults(): AnalysisResponse[] { return [...this.results.values()]; }
  getSummary(): AnalysisSummary {
    const kinds = new Map(this.getResults().flatMap(response => response.messageResults).map(result => [result.eventId, result.kind]));
    const questionBuckets = new Map<number, number>();
    const technicalIssues: AnalysisSummary['technicalIssues'] = [];
    let questionCount = 0, technicalIssueCount = 0, uncertainCount = 0;
    for (const event of this.events.values()) {
      const kind = kinds.get(event.eventId);
      if (kind === 'question') {
        questionCount++;
        const minute = event.platformTime.minuteOfDay;
        if (minute !== null) {
          const from = Math.floor(minute / 5) * 5;
          questionBuckets.set(from, (questionBuckets.get(from) ?? 0) + 1);
        }
      } else if (kind === 'technical_issue') {
        technicalIssueCount++;
        technicalIssues.push({ eventId: event.eventId, text: event.text, platformTime: event.platformTime.raw });
      } else if (kind === 'uncertain') uncertainCount++;
    }
    const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return { questionCount, technicalIssueCount, uncertainCount, technicalIssues,
      questionBuckets: [...questionBuckets].sort(([a], [b]) => a - b).map(([minute, count]) => ({
        from: time(minute), to: time(minute + 5), questionCount: count
      })) };
  }
  prepareBatch(): AnalysisRequest | null {
    const pending: ChatEvent[] = [];
    let characters = 0;
    for (const event of this.events.values()) {
      if (event.processingStatus !== 'pending') continue;
      if (pending.length >= 50 || (pending.length && characters + event.text.length > 12000)) break;
      pending.push(event); characters += event.text.length;
    }
    if (!pending.length) return null;
    for (const event of pending) event.processingStatus = 'in_flight';
    return { schemaVersion: '1.0', analysisId: crypto.randomUUID(),
      session: { sessionId: this.sessionId, startedAt: this.startedAt, timeZone: this.timeZone },
      task: { type: 'classify_and_group_messages', timeBucketMinutes: 5 },
      messages: pending.map(event => ({ eventId: event.eventId, revision: event.revision,
        text: event.text, platformTime: event.platformTime.raw })) };
  }
  accept(request: AnalysisRequest, response: AnalysisResponse): void {
    validateResponse(request, response);
    for (const message of request.messages) this.events.get(message.eventId)!.processingStatus = 'analyzed';
    this.results.set(request.analysisId, response);
  }
  retry(request: AnalysisRequest): void {
    for (const message of request.messages) {
      const event = this.events.get(message.eventId);
      if (event?.processingStatus === 'in_flight') event.processingStatus = 'pending';
    }
  }
}

export function validateResponse(request: AnalysisRequest, value: unknown): asserts value is AnalysisResponse {
  if (!value || typeof value !== 'object') throw new Error('Некорректный ответ анализатора');
  const response = value as AnalysisResponse;
  if (response.schemaVersion !== '1.0' || response.analysisId !== request.analysisId ||
    !Array.isArray(response.messageResults) || !Array.isArray(response.compiledQuestions) || !Array.isArray(response.topics))
    throw new Error('Неверная структура или идентификатор анализа');
  const ids = new Map(request.messages.map(message => [message.eventId, message.revision]));
  const seen = new Set<string>();
  for (const result of response.messageResults) {
    if (!result || ids.get(result.eventId) !== result.revision || seen.has(result.eventId) ||
      !['question', 'technical_issue', 'other', 'uncertain'].includes(result.kind) ||
      typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1 ||
      !(result.topicId === null || typeof result.topicId === 'string')) throw new Error('Некорректная классификация');
    seen.add(result.eventId);
  }
  if (seen.size !== ids.size) throw new Error('Анализатор пропустил сообщения');
  const topics = new Set<string>();
  for (const topic of response.topics) {
    if (!topic || typeof topic.topicId !== 'string' || !topic.topicId || topics.has(topic.topicId) ||
      typeof topic.label !== 'string' || !['question', 'technical_issue'].includes(topic.kind) ||
      !Array.isArray(topic.eventIds) || topic.eventIds.some(id => !ids.has(id))) throw new Error('Некорректная тема');
    topics.add(topic.topicId);
  }
  for (const result of response.messageResults) if (result.topicId !== null && !topics.has(result.topicId)) throw new Error('Неизвестная тема');
  const questions = new Set<string>();
  const grouped = new Set<string>();
  for (const question of response.compiledQuestions) {
    if (!question || typeof question.questionId !== 'string' || !question.questionId || questions.has(question.questionId) ||
      typeof question.text !== 'string' || !question.text.trim() || !Array.isArray(question.eventIds) || !question.eventIds.length ||
      !(question.topicId === null || topics.has(question.topicId))) throw new Error('Некорректный сводный вопрос');
    questions.add(question.questionId);
    for (const id of question.eventIds) {
      if (grouped.has(id) || response.messageResults.find(result => result.eventId === id)?.kind !== 'question')
        throw new Error('Некорректная ссылка на вопрос');
      grouped.add(id);
    }
  }
}
