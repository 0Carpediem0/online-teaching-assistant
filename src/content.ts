import { TelemostAdapter, type ChatState, type ObservedMessage } from './adapter';

if (!document.getElementById('teacher-assistant-root')) {
  const host = document.createElement('div');
  host.id = 'teacher-assistant-root';
  host.style.cssText = 'position:fixed;left:16px;top:16px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { font:14px/1.5 system-ui,sans-serif; color:#17243a; }
    section { width:280px; max-width:calc(100vw - 64px); padding:16px; background:#fff;
      border:1px solid #cbd5e1; border-radius:12px; box-shadow:0 6px 24px #0002; }
    h2 { font-size:16px; margin:0 0 12px; } p { margin:8px 0; }
    button { font:inherit; padding:8px 12px; border-radius:7px; border:1px solid #aab6c8; cursor:pointer; }
    button:first-child { background:#224bc0; color:white; }
    button:disabled { opacity:.45; cursor:default; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; } small { display:block; color:#59677b; margin-top:12px; }
  </style><section aria-label="Ассистент преподавателя">
    <h2>Ассистент преподавателя</h2>
    <div role="status" aria-live="polite"><p id="lesson"></p><p id="chat"></p><p id="hint"></p></div>
    <div class="actions"><button id="start">Начать занятие</button><button id="stop" disabled>Завершить занятие</button></div>
    <p id="count"></p><ul id="messages" style="max-height:200px;overflow:auto;padding-left:20px;overflow-wrap:anywhere"></ul>
    <small>Только локальные наблюдения. История и повторы определяются приблизительно. Обновление страницы сбросит данные.</small>
  </section>`;
  document.documentElement.append(host);
  const start = root.querySelector<HTMLButtonElement>('#start')!;
  const stop = root.querySelector<HTMLButtonElement>('#stop')!;
  let lesson: 'idle' | 'active' | 'ended' = 'idle';
  let chat: ChatState = 'unavailable';
  let unsubscribe: (() => void) | undefined;
  let total = 0;
  let messages: ObservedMessage[] = [];
  const render = () => {
    root.querySelector('#lesson')!.textContent = lesson === 'active' ? 'Занятие начато' : lesson === 'ended' ? 'Занятие завершено' : 'Занятие не начато';
    root.querySelector('#chat')!.textContent = lesson !== 'active' ? 'Чат: проверка после запуска' : chat === 'available' ? 'Чат доступен' : chat === 'opening' ? 'Открываем чат…' : 'Чат недоступен';
    root.querySelector('#hint')!.textContent = lesson !== 'active' ? 'Начните занятие во встрече Телемоста.' : chat === 'available' ? 'Оставьте чат открытым до конца занятия.' : chat === 'opening' ? 'Ожидаем появления панели чата.' : 'Откройте чат встречи и не закрывайте его во время занятия.';
    start.disabled = lesson === 'active';
    stop.disabled = lesson !== 'active';
    root.querySelector('#count')!.textContent = `Наблюдений сообщений: ${total}`;
    const list = root.querySelector('#messages')!;
    list.replaceChildren(...messages.map(message => {
      const item = document.createElement('li');
      const origin = { initial: 'при открытии', recovered: 'восстановлено', observed: 'во время наблюдения' }[message.origin];
      item.textContent = `${message.author ?? 'Автор неизвестен'}${message.platformTime ? ' · ' + message.platformTime : ''} (${origin}): ${message.text}`;
      return item;
    }));
  };
  start.addEventListener('click', () => {
    if (lesson === 'active') return;
    lesson = 'active';
    total = 0; messages = [];
    unsubscribe = new TelemostAdapter().observeChat(state => { chat = state; render(); }, message => {
      total++; messages = [...messages.slice(-4), message]; render();
    });
    render();
  });
  stop.addEventListener('click', () => {
    unsubscribe?.(); unsubscribe = undefined; lesson = 'ended'; render();
  });
  window.addEventListener('pagehide', () => { unsubscribe?.(); unsubscribe = undefined; lesson = 'ended'; render(); });
  render();
}
