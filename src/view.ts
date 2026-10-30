import type { ChatState, ObservedMessage } from './adapter';
import { styles } from './styles';
import { createNotice } from './notice';

export type ViewState = {
  active: boolean; ended: boolean; shown: boolean; history: boolean; busy: boolean;
  chat: ChatState; error: string; pip: boolean; pipPreferred: boolean;
  supported: boolean; messages: ObservedMessage[];
};
type Actions = { toggle(): void; start(): void; stop(): void; history(v: boolean): void; pip(v: boolean): void };

export function createView(root: ShadowRoot | HTMLElement, actions: Actions, detached = false) {
  const doc = root.ownerDocument;
  root.innerHTML = `<style>${styles}</style>
    <button id="launcher" aria-controls="panel">Ассистент</button>
    <section id="panel" aria-label="Ассистент преподавателя">
      <header><div class="brand"><span class="brand-mark" aria-hidden="true">а</span><div><strong>Ассистент</strong><span class="eyebrow">ПРЕПОДАВАТЕЛЯ</span></div></div><button id="hide" aria-label="Скрыть панель">×</button></header>
      <div class="session"><div class="session-top"><span class="platform">Яндекс Телемост</span><span id="chat" class="badge" role="status"></span></div>
        <h1 id="lesson"></h1><p id="hint"></p>
        <button id="start" class="primary">Начать занятие ↗</button>
        <button id="stop" class="primary finish">Завершить занятие</button>
      </div>
      <div class="options">
        <label class="option"><span class="option-copy"><strong>Поверх презентации</strong><small id="pip-note">Открыть отдельное окно чата при старте</small></span><input id="pip" class="switch" type="checkbox" role="switch" aria-describedby="pip-note"></label>
        <label class="option"><span class="option-copy"><strong>Доступная история</strong><small>Показать ранее загруженные сообщения</small></span><input id="history" class="switch" type="checkbox" role="switch"></label>
      </div>
      <div class="section-head"><h2>Сообщения чата</h2><span id="count" class="counter"></span></div>
      <p id="empty"></p><ul id="messages" aria-label="Доступные сообщения"></ul>
      <p id="history-note" hidden>История может относиться к прошлым встречам.</p><p id="limit" hidden>Показаны последние 100 сообщений.</p>
      <footer><details><summary>О данных занятия</summary><p>Сообщения хранятся в этой вкладке до её обновления или закрытия. Время обнаружения не равно времени отправки; история может быть неполной. AI-анализ и отчёт пока не подключены.</p></details></footer>
    </section>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const notice = createNotice(root, 'error');
  const setText = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };
  get('launcher').onclick = actions.toggle;
  get('hide').onclick = actions.toggle;
  get('start').onclick = actions.start;
  get('stop').onclick = actions.stop;
  get<HTMLInputElement>('history').onchange = e => actions.history((e.target as HTMLInputElement).checked);
  get<HTMLInputElement>('pip').onchange = e => actions.pip((e.target as HTMLInputElement).checked);
  let messageKey = '';

  return { render(state: ViewState) {
    get('launcher').hidden = detached || state.shown;
    get('panel').hidden = !state.shown;
    get('hide').hidden = detached;
    get('launcher').setAttribute('aria-expanded', String(state.shown));
    setText('lesson', state.active ? 'Занятие идёт' : state.ended ? 'Занятие завершено' : 'Всё важное — рядом');
    setText('chat', !state.active ? 'Наблюдение выключено' : state.chat === 'available' ? 'Чат открыт' : state.chat === 'opening' ? 'Открываем чат…' : 'Чат недоступен');
    get('chat').dataset.tone = !state.active ? 'neutral' : state.chat === 'available' ? 'success' : 'warning';
    setText('hint', state.active ? state.chat === 'available' ? 'Следите за сообщениями, пока ведёте пару. Оставьте чат Телемоста открытым.' : 'Откройте чат Телемоста вручную, чтобы получать сообщения.' : state.ended ? 'Сообщения доступны до обновления вкладки. Новое занятие очистит этот список.' : 'Начните занятие, чтобы собрать сообщения чата в одном месте.');
    get('start').hidden = state.active;
    get('stop').hidden = !state.active;
    setText('start', state.ended ? 'Начать новое занятие ↗' : 'Начать занятие ↗');
    get<HTMLInputElement>('pip').checked = state.pipPreferred;
    get<HTMLInputElement>('pip').disabled = state.busy || !state.supported;
    setText('pip-note', !state.supported ? 'Недоступно в этом браузере' : state.busy ? 'Открываем окно…' : state.active ? state.pip ? 'Окно открыто · можно закрыть переключателем' : 'Открыть отдельное окно чата' : 'Открыть отдельное окно чата при старте');
    notice.render(state.error ? {
      key: `pip:${state.error}`, tone: 'warning', title: 'Не получилось открыть окно чата',
      message: 'Вернитесь в Телемост и включите окно поверх презентации ещё раз.'
    } : state.active && state.chat === 'unavailable' ? {
      key: 'chat-unavailable', tone: 'info', title: 'Чат пока недоступен',
      message: 'Откройте чат Телемоста вручную, чтобы продолжить получать сообщения.'
    } : undefined);
    get<HTMLInputElement>('history').checked = state.history;
    setText('count', `Новых за занятие: ${state.messages.filter(m => m.origin === 'observed').length}`);
    const visible = state.messages.filter(m => state.history || m.origin === 'observed');
    setText('empty', visible.length ? '' : state.active ? 'Новых сообщений пока нет' : state.ended ? 'Во время занятия новых сообщений не обнаружено' : 'Здесь появятся сообщения занятия');
    get('empty').hidden = visible.length > 0;
    get('history-note').hidden = !state.history || !visible.some(m => m.origin !== 'observed');
    get('limit').hidden = visible.length <= 100;
    // Polling preserves the reader's scroll position and existing DOM.
    const tail = visible.slice(-100), key = JSON.stringify(tail);
    if (key === messageKey) return;
    messageKey = key;
    const list = get('messages');
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 32, scrollTop = list.scrollTop;
    list.replaceChildren(...tail.map(message => {
      const li = doc.createElement('li'), meta = doc.createElement('div'); meta.className = 'message-meta';
      const origin = doc.createElement('span');
      origin.textContent = message.origin !== 'observed' ? 'Доступная история' : message.own ? 'Ваше сообщение' : 'Новое сообщение';
      origin.className = message.origin !== 'observed' ? 'origin' : message.own ? 'own' : '';
      const time = doc.createElement('span'); time.textContent = message.platformTime ?? 'Время не указано';
      meta.append(origin, time);
      const text = doc.createElement('p'); text.className = 'message-text'; text.textContent = message.text;
      li.append(meta, text); return li;
    }));
    list.scrollTop = atBottom ? list.scrollHeight : scrollTop;
  } };
}
