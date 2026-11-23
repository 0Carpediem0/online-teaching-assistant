import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  './devices': 'export const readDevices = () => ({}); export const checkDevices = async () => ({});',
  './adapter': `export class TelemostAdapter { observeChat(_status, onMessage) { globalThis.observeMessage = onMessage; return () => {}; } }`,
  './pip-view': 'export const createChatView = () => ({ render() {} });',
  './analysis': `export class AnalysisSession {
    constructor() { this.sessionId = 'test'; this.events = []; }
    add(message) { this.events.push(message); return true; }
    prepareBatch() { return this.events.length ? { messages: this.events } : null; }
    getEvents() { return this.events; }
    getDisplayQuestions() { return []; }
    getDisplayTechnicalIssues() { return []; }
    getSummary() { return {}; }
    accept() {}
    retry() {}
  }`
};
const output = await build({
  entryPoints: ['src/content.ts'], bundle: true, write: false, format: 'iife', platform: 'browser',
  plugins: [{ name: 'lifecycle-mocks', setup(api) {
    api.onResolve({ filter: /^\.\/(devices|adapter|pip-view|analysis)$/ }, args => ({ path: args.path, namespace: 'mock' }));
    api.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }]
});
const callbacks = new Map();
let nextId = 0, analysisRequests = 0, command, openedWindows = 0, focusedWindows = 0, closeChat;
globalThis.window = {
  setInterval: () => ++nextId, clearInterval() {}, addEventListener() {},
  setTimeout: callback => { const id = ++nextId; callbacks.set(id, callback); return id; },
  clearTimeout: id => callbacks.delete(id),
  documentPictureInPicture: { async requestWindow() {
    openedWindows++;
    return { document: {}, focus() { focusedWindows++; },
      addEventListener(name, callback) { if (name === 'pagehide') closeChat = callback; },
      close() { closeChat?.(); } };
  } }
};
globalThis.location = { origin: 'https://telemost.yandex.ru' };
globalThis.chrome = { runtime: {
  onMessage: { addListener: listener => { command = listener; } },
  sendMessage: async () => { analysisRequests++; return { ok: false, error: 'service_unavailable' }; }
} };
new Function(Buffer.from(output.outputFiles[0].contents).toString())();
const send = name => command({ type: 'teacher-command', command: name }, {}, () => {});
send('start');
observeMessage({ eventId: 'q1', text: 'Когда сдавать работу?', origin: 'observed' });
assert.equal(callbacks.size, 1, 'Новое сообщение должно запланировать анализ');
const pending = [...callbacks.values()][0];
send('stop');
assert.equal(callbacks.size, 0, 'Завершение занятия должно отменить таймер');
pending(); // Даже если callback уже попал в очередь событий, запрос не должен уйти.
send('analyze');
assert.equal(analysisRequests, 0, 'После завершения занятия запросы не отправляются');
console.log('Analysis lifecycle check passed');

const request = (name, value) => new Promise(resolve => command({type:'teacher-command',command:name,value}, {}, resolve));
let state = await request('chat');
assert.equal(state.active, false, 'Открытие чата не начинает новую пару');
assert.equal(state.ended, true);
assert.equal(state.messages.length, 1, 'Собранные сообщения сохраняются');
assert.equal(state.pip, true);
assert.equal(state.pipPreferred, false, 'Разовое открытие сохраняет настройку');
assert.equal(openedWindows, 1);
state = await request('chat');
assert.equal(openedWindows, 1, 'Повторное открытие использует существующее окно');
assert.equal(focusedWindows, 1);
state = await request('history', true);
assert.equal(state.history, true);
assert.equal(state.pip, true, 'История не закрывает чат');
closeChat();
state = await request('state');
assert.equal(state.pip, false);
assert.equal(state.pipPreferred, false);
assert.equal(state.ended, true, 'Закрытие чата не меняет состояние пары');
assert.equal(state.history, true);
console.log('Chat command check passed: retained messages, focus, independent history and close lifecycle.');

await request('pip', true);
await request('start');
closeChat();
state = await request('state');
assert.equal(state.active, true);
assert.equal(state.pipPreferred, true, 'Крестик не меняет настройку запуска');