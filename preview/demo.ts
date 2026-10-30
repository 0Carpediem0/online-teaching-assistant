import { createView, type ViewState } from '../src/view';
import { createChatView } from '../src/pip-view';
import type { ObservedMessage } from '../src/adapter';

const message = (text: string, origin: ObservedMessage['origin'] = 'observed', own = false): ObservedMessage => ({ eventId: crypto.randomUUID(), text, platformTime: '10:42', observedAt: new Date().toISOString(), own, authorEvidence: 'unknown', origin });
const samples = () => [message('Материалы к прошлой паре выложены в курсе.', 'initial'), message('Можно ещё раз объяснить разницу между JOIN и UNION?'), message('Пример запроса добавлю после занятия.', 'observed', true), message('Плохо слышно последние несколько минут.')];
let state: ViewState = { active: true, ended: false, shown: true, history: false, busy: false, chat: 'available', error: '', pip: true, pipPreferred: true, supported: true, messages: samples() };
const root = document.querySelector<HTMLElement>('#popup')!.attachShadow({ mode: 'open' });
const frame = document.querySelector<HTMLIFrameElement>('#pip-preview')!;
const pipDoc = frame.contentDocument!;
pipDoc.documentElement.lang = 'ru';
const pipView = createChatView(pipDoc);
const view = createView(root, {
  toggle() {},
  start() { state = { ...state, active: true, ended: false, chat: 'available', messages: [], pip: state.pipPreferred }; render(); },
  stop() { state.active = false; state.ended = true; render(); },
  history(value) { state.history = value; render(); },
  pip(value) { state.pipPreferred = value; state.pip = state.active && value; if (value) state.error = ''; render(); }
}, true);
function render() {
  view.render(state); pipView.render(state);
  frame.hidden = !state.pip;
  document.querySelector<HTMLElement>('#pip-off')!.hidden = state.pip;
  document.querySelector<HTMLButtonElement>('#compose button')!.disabled = !state.active;
  document.querySelector<HTMLInputElement>('#sample-text')!.disabled = !state.active;
  // A manually changed state is no longer necessarily a named scenario.
  document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', 'false'));
}
document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(button => button.onclick = () => {
  const scene = button.dataset.scene;
  state = { ...state, active: scene !== 'ready' && scene !== 'ended', ended: scene === 'ended', messages: scene === 'ready' ? [] : samples(), chat: scene === 'unavailable' ? 'unavailable' : 'available', history: false, error: scene === 'error' ? 'Не удалось открыть окно. Вернитесь в Телемост и попробуйте ещё раз.' : '', supported: scene !== 'unsupported', pip: scene !== 'ready' && scene !== 'unsupported' && scene !== 'error', pipPreferred: scene !== 'ready' && scene !== 'unsupported' && scene !== 'error' };
  render(); button.setAttribute('aria-pressed', 'true');
});
document.querySelector<HTMLFormElement>('#compose')!.onsubmit = event => {
  event.preventDefault(); const input = document.querySelector<HTMLInputElement>('#sample-text')!;
  if (!state.active || !input.value.trim()) return;
  state.messages.push(message(input.value.trim())); input.value = ''; render();
  document.querySelector('#demo-status')!.textContent = 'Тестовое сообщение добавлено в макет';
};
render(); document.querySelector('[data-scene="active"]')!.setAttribute('aria-pressed', 'true');
