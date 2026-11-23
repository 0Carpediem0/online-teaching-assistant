import type { ChatState, ObservedMessage } from './adapter';
import { styles } from './styles';
import { attachSpeakerTest } from './speaker-test';
import { createNotice } from './notice';
import type { AnalysisSummary } from './analysis';
import type { DeviceCheck } from './device-types';

export type ViewState = {
  deviceCheck?: DeviceCheck;
  active: boolean; ended: boolean; shown: boolean; history: boolean; busy: boolean;
  chat: ChatState; error: string; pip: boolean; pipPreferred: boolean;
  supported: boolean; messages: ObservedMessage[];
  analysisBusy?: boolean; analysisError?: string; analysisPending?: number;
  compiledQuestions?: { questionId: string; text: string; eventIds: string[] }[];
  compiledTechnicalIssues?: { issueId: string; text: string; eventIds: string[] }[];
  analysisDueAt?: number;
  analysisSummary?: AnalysisSummary;
};
type Actions = { toggle(): void; start(): void; stop(): void; history(v: boolean): void; pip(v: boolean): void; analyze(): void; checkDevices?(): void; openChat(): void };

export function createView(root: ShadowRoot | HTMLElement, actions: Actions, detached = false) {
  const doc = root.ownerDocument;
  root.innerHTML = `<style>${styles}</style>
    <button id="launcher" aria-controls="panel">Ассистент</button>
    <section id="panel" aria-label="Ассистент преподавателя">
      <button id="hide" aria-label="Скрыть панель">×</button>
      <div id="main-screen" class="panel-body"><div class="col-left"><div class="session"><div class="session-top"><span class="platform">Яндекс Телемост</span><span id="chat" class="badge" role="status"></span></div>
        <h1 id="lesson"></h1><p id="hint"></p>
        <div id="device-check" class="device-check"><div class="device-check-heading"><button id="run-device-check" type="button" class="device-check-button" aria-label="Проверить звук и видео">↻</button><div><strong>Проверить звук</strong><p id="device-status">Проверить перед парой</p></div></div><button id="speaker-test" type="button" class="speaker-test">♫ Динамики</button><small id="speaker-status" role="status"></small><div id="device-results" hidden role="status"><p id="device-mic"></p><p id="device-camera"></p><details><summary>Подробности</summary><small id="device-detail"></small></details></div></div><button id="start" class="primary">Начать занятие ↗</button>
        <button id="stop" class="primary finish">Завершить пару</button>
      </div>
      <div class="toggles" role="group" aria-label="Параметры пары">
        <button id="pip" class="tile" role="switch" aria-checked="false" aria-describedby="pip-note"><span class="tile-icon" aria-hidden="true">▣</span><span class="tile-label">Поверх презентации</span><small id="pip-note"></small></button>
        <button id="history" class="tile" role="switch" aria-checked="false"><span class="tile-icon" aria-hidden="true">↺</span><span class="tile-label">Доступная история</span></button>
      </div>
      <button id="open-diagnostics" class="diagnostics-link" type="button">Проверка связи ↗</button>
      </div><div class="col-right"><div class="analysis-feed" aria-label="Результаты анализа">
      <div class="section-head"><h2>Анализ вопросов</h2></div>
      <button id="analyze" class="primary" type="button">Анализировать сейчас</button>
      <p id="analysis-status" role="status"></p><ul id="questions" aria-label="Вопросы занятия"></ul>
      <h3>Вопросы по времени Телемоста</h3><ul id="question-buckets" aria-label="Вопросы по пятиминутным интервалам"></ul>
      <h3>Технические проблемы</h3><ul id="technical-issues" aria-label="Технические проблемы"></ul>
      </div><button id="open-chat" class="primary open-chat" type="button">Открыть чат</button></div>
      </div><section id="diagnostic-screen" hidden aria-label="Диагностика"><button id="back-diagnostics" type="button">← Назад</button><h1>Проверка связи</h1><p>Произнесите короткую фразу</p><div id="diagnostic-body"></div><label for="mic-level">Уровень микрофона</label><div id="mic-level" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="mic-fill"></span></div><small id="mic-level-label">Нет замера</small></section>
      <section id="chat-screen" hidden aria-label="Сообщения чата"><button id="back-chat" type="button">← К настройкам</button>
      <div class="section-head"><h2>Сообщения чата</h2><span id="count" class="counter"></span></div>
      <p id="empty"></p><ul id="messages" aria-label="Доступные сообщения"></ul>
      <p id="history-note" hidden>История может относиться к прошлым встречам.</p><p id="limit" hidden>Показаны последние 100 сообщений.</p></section>
    </section>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  get('diagnostic-body').append(get('device-check'));
  const micCard=doc.createElement('div');micCard.className='diagnostic-card';
  const micTitle=doc.createElement('h2');micTitle.textContent='Микрофон';micCard.append(micTitle);
  micCard.append(get('mic-level'),get('mic-level-label'));
  get('diagnostic-body').insertBefore(micCard,get('device-check'));
  get('diagnostic-body').prepend(get('device-check').querySelector('.device-check-heading')!);
  const label=root.querySelector('label[for="mic-level"]');label?.remove();
  get('mic-level').setAttribute('aria-label','Уровень микрофона');
  micCard.insertBefore(get('device-mic'),get('mic-level'));
  for(const [id,title] of [['device-camera','Камера']]){
   const card=doc.createElement('div');card.className='diagnostic-card';
   const heading=doc.createElement('h2');heading.textContent=title;card.append(heading,get(id));get('device-results').prepend(card);
  }
  const speakerCard=doc.createElement('div');speakerCard.className='diagnostic-card';speakerCard.append(get('speaker-test'),get('speaker-status'));get('diagnostic-body').append(speakerCard);

  get('open-diagnostics').onclick=()=>{get('main-screen').hidden=true;get('diagnostic-screen').hidden=false;get('back-diagnostics').focus();};
  get('back-diagnostics').onclick=()=>{get('main-screen').hidden=false;get('diagnostic-screen').hidden=true;get('open-diagnostics').focus();};
  const notice = createNotice(root, 'error');
  const setText = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };
  get('launcher').onclick = actions.toggle;
  get('hide').onclick = actions.toggle;
  get('start').onclick = actions.start;
  get('stop').onclick = actions.stop;
  get('analyze').onclick = actions.analyze;
  attachSpeakerTest(get<HTMLButtonElement>('speaker-test'), get('speaker-status'));
  get('run-device-check').onclick = () => actions.checkDevices?.();
  get('history').onclick = () => actions.history(get('history').getAttribute('aria-checked') !== 'true');
  get('pip').onclick = () => actions.pip(get('pip').getAttribute('aria-checked') !== 'true');
  get('open-chat').onclick = () => { if (get('open-chat').dataset.supported === 'true') actions.openChat(); else { get('main-screen').hidden = true; get('chat-screen').hidden = false; get('back-chat').focus(); } };
  get('back-chat').onclick = () => { get('chat-screen').hidden = true; get('main-screen').hidden = false; get('open-chat').focus(); };
  let messageKey = '';

  return { render(state: ViewState) {
    get('device-check').hidden = false;
    const check = state.deviceCheck;
    const checking = check?.phase === 'running';
    const volume=checking && check?.level!==undefined ? Math.min(100,Math.sqrt(check.level)*100) : 0;
    get('mic-fill').style.transform=`scaleX(${volume/100})`;
    get('mic-level').setAttribute('aria-valuenow',String(Math.round(volume)));
    get('device-mic').hidden=false;
    setText('mic-level-label', checking ? check?.level===undefined ? 'Уровень недоступен' : 'Текущий сигнал' : check?.phase==='done' ? 'Замер завершён' : 'Нажмите проверку');
    const checkButton = get<HTMLButtonElement>('run-device-check');
    checkButton.disabled = checking;
    checkButton.classList.toggle('checking', checking);
    checkButton.setAttribute('aria-label', check?.phase === 'done' ? 'Повторить проверку звука и видео' : 'Проверить звук и видео');
    get('device-check').setAttribute('aria-busy', String(checking));
    setText('device-status', checking ? 'Говорите 5 секунд…' : check?.stale ? 'Прошлый замер · ' + new Date(check.checkedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ' · повторите проверку' : check?.phase === 'done' ? 'Проверено в ' + new Date(check.checkedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Проверить перед парой');
    get('device-results').hidden = false;
    for (const [id, result] of [['device-mic',check?.microphone],['device-camera',check?.camera]] as const) {
      setText(id, result ? (result.tone === 'ok' ? '✓ ' : result.tone === 'warning' ? '! ' : '· ') + result.text : checking ? 'Проверяем…' : 'Ещё не проверено');
      get(id).dataset.tone = check?.stale ? 'unknown' : result?.tone ?? 'unknown';
    }
    setText('device-detail', check?.details || 'Проверьте устройства в Телемосте и повторите проверку. Приём у студентов не проверяется.');
    get('launcher').hidden = detached || state.shown;
    get('panel').hidden = !state.shown;
    get('hide').hidden = detached;
    get('launcher').setAttribute('aria-expanded', String(state.shown));
    setText('lesson', state.active ? 'Пара идёт' : state.ended ? 'Пара завершена' : 'Всё важное — рядом');
    setText('chat', !state.active ? 'Наблюдение выключено' : state.chat === 'available' ? 'Чат открыт' : state.chat === 'opening' ? 'Открываем чат…' : 'Чат недоступен');
    get('chat').dataset.tone = !state.active ? 'neutral' : state.chat === 'available' ? 'success' : 'warning';
    setText('hint', state.active ? state.chat === 'available' ? 'Следите за сообщениями, пока ведёте пару. Оставьте чат Телемоста открытым.' : 'Откройте чат Телемоста вручную, чтобы получать сообщения.' : state.ended ? 'Сообщения доступны до обновления вкладки. Новое занятие очистит этот список.' : 'Начните занятие, чтобы собрать сообщения чата в одном месте.');
    get('start').hidden = state.active;
    get('stop').hidden = !state.active;
    setText('start', state.ended ? 'Начать новую пару ↗' : 'Начать пару ↗');
    get('pip').setAttribute('aria-checked', String(state.pipPreferred));
    get<HTMLButtonElement>('pip').disabled = state.busy || !state.supported;
    setText('pip-note', !state.supported ? 'Недоступно в этом браузере' : state.busy ? 'Открываем окно…' : state.active ? state.pip ? 'Окно открыто · можно закрыть переключателем' : 'Открыть отдельное окно чата' : 'Открыть отдельное окно чата при старте');
    notice.render(state.error ? {
      key: `pip:${state.error}`, tone: 'warning', title: 'Не получилось открыть окно чата',
      message: 'Нажмите «Показать чат здесь», чтобы открыть переписку.'
    } : state.active && state.chat === 'unavailable' ? {
      key: 'chat-unavailable', tone: 'info', title: 'Чат пока недоступен',
      message: 'Откройте чат Телемоста вручную, чтобы продолжить получать сообщения.'
    } : undefined);
    get('history').setAttribute('aria-checked', String(state.history));
    get('open-chat').dataset.supported = String(state.supported && !state.error);
    get<HTMLButtonElement>('open-chat').disabled = state.busy;
    setText('open-chat', state.busy ? 'Открываем…' : state.pip ? 'Перейти к чату ↗' : state.supported && !state.error ? 'Открыть чат ↗' : 'Показать чат здесь');
    setText('count', `Новых за занятие: ${state.messages.filter(m => m.origin === 'observed').length}`);
    get<HTMLButtonElement>('analyze').disabled = !state.active || !state.analysisPending || Boolean(state.analysisBusy);
    setText('analyze', state.analysisBusy ? 'Анализируем…' : `Анализировать сейчас (${state.analysisPending ?? 0})`);
    setText('analysis-status', state.analysisError || (state.analysisBusy ? 'Идёт анализ сообщений' : state.analysisDueAt ? 'Автоматический анализ через 5 минут после первого сообщения' : state.compiledQuestions?.length ? `Обобщённых вопросов: ${state.compiledQuestions.length}` : state.compiledTechnicalIssues?.length ? `Технических проблем: ${state.compiledTechnicalIssues.length}` : 'Результатов анализа пока нет'));
    const questions = get('questions');
    const questionKey = JSON.stringify(state.compiledQuestions ?? []);
    if (questions.dataset.key !== questionKey) {
      questions.dataset.key = questionKey;
      questions.replaceChildren(...(state.compiledQuestions ?? []).map(question => {
        const item = doc.createElement('li'); item.textContent = `${question.text} · ${question.eventIds.length}`; return item;
      }));
    }
    const buckets = get('question-buckets');
    const bucketKey = JSON.stringify(state.analysisSummary?.questionBuckets ?? []);
    if (buckets.dataset.key !== bucketKey) {
      buckets.dataset.key = bucketKey;
      buckets.replaceChildren(...(state.analysisSummary?.questionBuckets ?? []).map(bucket => {
        const item = doc.createElement('li'); item.textContent = `${bucket.from}–${bucket.to}: ${bucket.questionCount}`; return item;
      }));
    }
    const issues = get('technical-issues');
    const issueKey = JSON.stringify(state.compiledTechnicalIssues ?? []);
    if (issues.dataset.key !== issueKey) {
      issues.dataset.key = issueKey;
      issues.replaceChildren(...(state.compiledTechnicalIssues ?? []).map(issue => {
        const item = doc.createElement('li'); item.textContent = `${issue.text} · ${issue.eventIds.length}`; return item;
      }));
    }
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
