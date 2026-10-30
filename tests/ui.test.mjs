import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseHTML } from 'linkedom';

const repo = fileURLToPath(new URL('../', import.meta.url));
// Execute the actual TypeScript modules with a DOM; no bundler or browser globals required.
function source(entry, globals = {}, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const require = path => overrides[path] ?? load(resolve(dirname(filename), path + '.ts'));
    new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, require, ...Object.values(globals));
    return module.exports;
  }
  return load(resolve(repo, 'src', entry + '.ts'));
}
function document() { return parseHTML('<html lang="ru"><body><main></main></body></html>').document; }
function message(id, text, origin = 'observed') {
  return { eventId: id, text, origin, own: false, authorEvidence: 'unknown', observedAt: '2026-10-30T05:00:00Z' };
}
const initial = () => ({ active: false, ended: false, shown: true, history: false, busy: false, chat: 'unavailable', error: '', pip: false, pipPreferred: false, supported: true, messages: [] });
function setup() {
  const doc = document(), root = doc.querySelector('main'), calls = [];
  const actions = { toggle: () => calls.push('toggle'), start: () => calls.push('start'), stop: () => calls.push('stop'), history: v => calls.push(['history', v]), pip: v => calls.push(['pip', v]) };
  const view = source('view').createView(root, actions, true);
  return { doc, root, calls, view, get: id => root.querySelector('#' + id) };
}

test('controls dispatch independent commands and show session lifecycle', () => {
  const { view, get, calls } = setup();
  view.render(initial());
  assert.equal(get('stop').hidden, true);
  get('start').onclick();
  const state = { ...initial(), active: true, chat: 'available' };
  view.render(state);
  assert.equal(get('start').hidden, true);
  get('stop').onclick();
  get('history').checked = true; get('history').onchange({ target: get('history') });
  get('pip').checked = true; get('pip').onchange({ target: get('pip') });
  assert.deepEqual(calls, ['start', 'stop', ['history', true], ['pip', true]]);
  view.render({ ...state, active: false, ended: true });
  assert.match(get('hint').textContent, /очистит/);
  assert.match(get('start').textContent, /новое/);
  view.render({ ...state, supported: false });
  assert.equal(get('pip').disabled, true);
});

test('history never counts as new, messages are safe text, polling keeps DOM', () => {
  const { view, get } = setup();
  const state = { ...initial(), active: true, chat: 'available', messages: [message('old', 'История', 'initial'), message('new', '<img src=x onerror=alert(1)>')] };
  view.render(state);
  assert.equal(get('messages').children.length, 1);
  assert.equal(get('messages').querySelector('img'), null);
  assert.match(get('messages').textContent, /<img/);
  const li = get('messages').firstChild;
  view.render(state);
  assert.equal(get('messages').firstChild, li);
  view.render({ ...state, history: true });
  assert.equal(get('messages').children.length, 2);
  assert.equal(get('history-note').hidden, false);
  assert.equal(get('count').textContent, 'Новых за занятие: 1');
  view.render({ ...state, messages: Array.from({ length: 105 }, (_, i) => message(String(i), 'Message ' + i)) });
  assert.equal(get('messages').children.length, 100);
  assert.equal(get('limit').hidden, false);
});

test('notifications dismiss, stay dismissed across polling and rearm after recovery', () => {
  const { view, get } = setup();
  const state = { ...initial(), active: true, chat: 'available', error: 'PiP failed' };
  view.render(state);
  assert.equal(get('error').hidden, false);
  assert.match(get('error').textContent, /Не получилось открыть окно чата/);
  get('error').querySelector('button').onclick();
  view.render(state);
  assert.equal(get('error').hidden, true);
  view.render({ ...state, error: '' });
  view.render(state);
  assert.equal(get('error').hidden, false);
  view.render({ ...state, error: '', chat: 'unavailable' });
  assert.match(get('error').textContent, /Чат пока недоступен/);
  view.render({ ...state, error: '', chat: 'opening' });
  assert.equal(get('error').hidden, true);
});

test('notification content cannot execute markup', () => {
  const doc = document(), root = doc.querySelector('main');
  const notice = source('notice').createNotice(root);
  notice.render({ key: 'test', title: '<img src=x>', message: '<script>alert(1)</script>', tone: 'danger' });
  assert.equal(root.querySelector('img, script'), null);
  assert.match(root.textContent, /<script>/);
});

test('PiP filters history and updates edited message text without duplicate rows', () => {
  const doc = document(), view = source('pip-view').createChatView(doc);
  const state = { ...initial(), active: true, chat: 'available', messages: [message('old', 'Old', 'initial'), message('new', 'New')] };
  view.render(state);
  assert.equal(doc.querySelectorAll('li').length, 1);
  view.render({ ...state, history: true });
  assert.equal(doc.querySelectorAll('li').length, 2);
  view.render({ ...state, history: true, messages: state.messages.map(m => m.eventId === 'new' ? { ...m, text: 'Edited' } : m) });
  assert.equal(doc.querySelectorAll('li').length, 2);
  assert.match(doc.querySelector('ol').textContent, /Edited/);
});

test('popup connection errors can close and recover using actual Chrome message commands', async () => {
  const doc = parseHTML(readFileSync(resolve(repo, 'popup.html'), 'utf8')).document;
  let poll, fail = true;
  const commands = [];
  const state = { ...initial(), chat: 'available' };
  const chrome = { tabs: {
    query: async () => [{ id: 1 }],
    sendMessage: async (_id, message) => { commands.push(message.command); if (fail) throw Error('disconnected'); return state; }
  } };
  const window = { setInterval: fn => { poll = fn; return 1; }, clearInterval() {}, addEventListener() {}, close() {} };
  source('popup', { document: doc, window, chrome });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await tick();
  const notice = doc.querySelector('#connection-notice');
  assert.equal(notice.hidden, false);
  assert.equal(doc.querySelector('#app').hidden, true);
  notice.querySelector('button').onclick();
  poll(); await tick();
  assert.equal(notice.hidden, true);
  fail = false; poll(); await tick();
  assert.equal(doc.querySelector('#app').hidden, false);
  doc.querySelector('#start').onclick(); await tick();
  assert.ok(commands.includes('start'));
  fail = true; poll(); await tick();
  assert.equal(notice.hidden, false);
});

test('lesson controller recovers from a failed PiP request and keeps commands working', async () => {
  let listener, opens = 0, observerStopped = false;
  const document = parseHTML('<html><body></body></html>').document;
  const window = {
    documentPictureInPicture: { requestWindow: async () => { opens++; throw Error('permission denied'); } },
    addEventListener() {}
  };
  const chrome = { runtime: { onMessage: { addListener: fn => { listener = fn; } } } };
  const adapter = { TelemostAdapter: class {
    observeChat(status, onMessage) { status('available'); onMessage(message('one', 'Вопрос')); return () => { observerStopped = true; }; }
  } };
  source('content', { document, window, chrome }, { './adapter': adapter });
  const send = (command, value) => new Promise(resolve => listener({ type: 'teacher-command', command, value }, {}, resolve));
  assert.equal((await send('state')).active, false);
  await send('pip', true);
  const started = await send('start');
  assert.equal(started.active, true);
  assert.equal(opens, 1);
  assert.equal(started.pipPreferred, false);
  assert.match(started.error, /Не удалось открыть окно/);
  assert.equal(started.messages.length, 1);
  await send('history', true);
  assert.equal((await send('state')).history, true);
  await send('stop');
  assert.equal(observerStopped, true);
  assert.equal((await send('start')).error, '');
});
