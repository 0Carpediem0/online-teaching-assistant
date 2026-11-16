import type { ChatState, ObservedMessage } from './adapter';
import { styles } from './styles';

export type ViewState = {
  active: boolean; ended: boolean; shown: boolean; history: boolean; busy: boolean;
  chat: ChatState; error: string; pip: boolean; pipPreferred: boolean;
  supported: boolean; messages: ObservedMessage[];
};
type Actions = {
  toggle(): void; start(): void; stop(): void;
  history(v: boolean): void; pip(v: boolean): void; openChat(): void;
};

type FeedItem = { key: string; tone: 'warning' | 'danger' | 'info'; title: string; message: string };

export function createView(root: ShadowRoot | HTMLElement, actions: Actions, detached = false) {
  const doc = root.ownerDocument;
  root.innerHTML = `<style>${styles}</style>
    <button id="launcher" aria-controls="panel">Ассистент</button>
    <section id="panel" aria-label="Ассистент преподавателя">
      <div class="panel-body">
        <div class="col-left">
          <div class="session">
            <div class="session-top"><span class="platform">Яндекс Телемост</span><span id="chat" class="badge" role="status"></span></div>
            <h1 id="lesson"></h1><p id="hint"></p>
            <button id="start" class="primary">Начать занятие ↗</button>
            <button id="stop" class="primary finish">Завершить занятие</button>
          </div>
          <div class="toggles" role="group" aria-label="Параметры занятия">
            <button id="pip-toggle" class="tile" role="switch" aria-pressed="false" aria-describedby="pip-note">
              <span class="tile-icon" aria-hidden="true">▣</span>
              <span class="tile-label">Поверх презентации</span>
              <span id="pip-note" class="tile-note" hidden></span>
            </button>
            <button id="history-toggle" class="tile" role="switch" aria-pressed="false">
              <span class="tile-icon" aria-hidden="true">↺</span>
              <span class="tile-label">Доступная история</span>
            </button>
          </div>
        </div>
        <div class="col-right">
          <div id="ai-feed" class="ai-feed" role="log" aria-live="polite" aria-label="Уведомления ассистента"></div>
          <button id="open-chat" class="open-chat" type="button">Открыть чат</button>
        </div>
      </div>
    </section>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const setText = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };

  get('launcher').onclick = actions.toggle;
  get('start').onclick = actions.start;
  get('stop').onclick = actions.stop;
  get('open-chat').onclick = actions.openChat;
  get('pip-toggle').onclick = () => actions.pip(get('pip-toggle').getAttribute('aria-pressed') !== 'true');
  get('history-toggle').onclick = () => actions.history(get('history-toggle').getAttribute('aria-pressed') !== 'true');
  let feedKey = '';

  return { render(state: ViewState) {
    get('launcher').hidden = detached || state.shown;
    get('panel').hidden = !state.shown;
    get('launcher').setAttribute('aria-expanded', String(state.shown));
    setText('lesson', state.active ? 'Занятие идёт' : state.ended ? 'Занятие завершено' : 'Всё важное — рядом');
    setText('chat', !state.active ? 'Наблюдение выключено' : state.chat === 'available' ? 'Чат открыт' : state.chat === 'opening' ? 'Открываем чат…' : 'Чат недоступен');
    get('chat').dataset.tone = !state.active ? 'neutral' : state.chat === 'available' ? 'success' : 'warning';
    setText('hint', state.active ? state.chat === 'available' ? 'Следите за сообщениями, пока ведёте пару. Оставьте чат Телемоста открытым.' : 'Откройте чат Телемоста вручную, чтобы получать сообщения.' : state.ended ? 'Сообщения доступны до обновления вкладки. Новое занятие очистит этот список.' : 'Начните занятие, чтобы собрать сообщения чата в одном месте.');
    get('start').hidden = state.active;
    get('stop').hidden = !state.active;
    setText('start', state.ended ? 'Начать новое занятие ↗' : 'Начать занятие ↗');

    const pip = get('pip-toggle');
    pip.setAttribute('aria-pressed', String(state.pipPreferred));
    (pip as HTMLButtonElement).disabled = state.busy || !state.supported;
    pip.setAttribute('aria-disabled', String(state.busy || !state.supported));
    const note = get('pip-note');
    const noteText = !state.supported ? 'Недоступно в этом браузере' : state.busy ? 'Открываем окно…' : state.pip ? 'Окно открыто' : 'Окно чата при старте';
    note.hidden = noteText === '';
    if (note.textContent !== noteText) note.textContent = noteText;

    const hist = get('history-toggle');
    hist.setAttribute('aria-pressed', String(state.history));

    const items: FeedItem[] = [];
    if (state.error) items.push({ key: `pip:${state.error}`, tone: 'warning', title: 'Не получилось открыть окно чата', message: 'Вернитесь в Телемост и попробуйте ещё раз.' });
    if (state.active && state.chat === 'unavailable') items.push({ key: 'chat-unavailable', tone: 'info', title: 'Чат пока недоступен', message: 'Откройте чат Телемоста вручную, чтобы продолжить получать сообщения.' });
    if (!state.active && !state.ended) items.push({ key: 'idle', tone: 'info', title: 'Ассистент ждёт старта', message: 'Начните занятие — здесь появятся уведомления и сообщения от ассистента.' });
    if (state.active && !items.length) items.push({ key: 'active-ok', tone: 'info', title: 'Всё под контролем', message: 'Ассистент следит за занятием. Уведомления появятся здесь.' });

    const key = JSON.stringify(items);
    if (key !== feedKey) {
      feedKey = key;
      const feed = get('ai-feed');
      feed.replaceChildren(...items.map(item => {
        const el = doc.createElement('article');
        el.className = 'feed-item';
        el.dataset.tone = item.tone;
        el.dataset.key = item.key;
        const head = doc.createElement('div'); head.className = 'feed-head';
        const icon = doc.createElement('span'); icon.className = 'feed-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '!';
        const title = doc.createElement('p'); title.className = 'feed-title'; title.textContent = item.title;
        head.append(icon, title);
        const msg = doc.createElement('p'); msg.className = 'feed-message'; msg.textContent = item.message;
        el.append(head, msg);
        return el;
      }));
    }
  } };
}