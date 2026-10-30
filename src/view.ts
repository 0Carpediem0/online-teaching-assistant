import type {ChatState,ObservedMessage} from './adapter';
import {styles} from './styles';
type Actions={toggle():void;start():void;stop():void;history(v:boolean):void;pip(v:boolean):void};
export function createView(root:ShadowRoot|HTMLElement,a:Actions,detached=false){
 const doc=root.ownerDocument;
 root.innerHTML=`<style>${styles}</style><button id="launcher">Ассистент</button><section id="panel" aria-label="Ассистент преподавателя"><header><strong>Ассистент преподавателя</strong><button id="hide" aria-label="Скрыть панель">×</button></header><p id="lesson" role="status"></p><p id="chat"></p><p id="hint"></p><div class="actions"><button id="start">Начать занятие</button><button id="stop">Завершить занятие</button></div><label><input id="pip" type="checkbox" role="switch"> Окно поверх презентации</label><p id="error" role="status"></p><label><input id="history" type="checkbox" role="switch"> Показать доступную историю</label><p id="count"></p><p id="empty"></p><ul id="messages"></ul><small>Время обнаружения не доказывает время отправки. Данные хранятся до обновления страницы.</small></section>`;
 const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
 get('launcher').onclick=a.toggle;get('hide').onclick=a.toggle;get('start').onclick=a.start;get('stop').onclick=a.stop;
 get<HTMLInputElement>('history').onchange=e=>a.history((e.target as HTMLInputElement).checked);
 get<HTMLInputElement>('pip').onchange=e=>a.pip((e.target as HTMLInputElement).checked);
 const preferenceNote=doc.createElement('small');
 preferenceNote.textContent='До начала пары галочка задаёт предпочтение. Во время пары она открывает и закрывает окно. Сбор сообщений продолжается.';
 get<HTMLInputElement>('pip').parentElement!.after(preferenceNote);
 return {render(s:{active:boolean;ended:boolean;shown:boolean;history:boolean;busy:boolean;chat:ChatState;error:string;pip:boolean;pipPreferred:boolean;supported:boolean;messages:ObservedMessage[]}){
  get('launcher').hidden=detached||s.shown;get('panel').hidden=!s.shown;get('hide').hidden=detached;
  get('launcher').setAttribute('aria-expanded',String(s.shown));
  get('lesson').textContent=s.active?'Занятие начато':s.ended?'Занятие завершено':'Занятие не начато';
  get('chat').textContent=!s.active?'Наблюдение остановлено':s.chat==='available'?'Чат доступен':s.chat==='opening'?'Открываем чат…':'Чат недоступен';
  get('hint').textContent=s.active?s.chat==='available'?'Оставьте чат Телемоста открытым.':'Если чат не открылся, откройте его вручную.':'Начните новую пару, чтобы очистить текущий список.';
  get<HTMLButtonElement>('start').disabled=s.active;get<HTMLButtonElement>('stop').disabled=!s.active;
  get<HTMLInputElement>('pip').checked=s.pipPreferred;get<HTMLInputElement>('pip').disabled=s.busy||!s.supported;
  get<HTMLInputElement>('pip').parentElement!.title='Открыть окно при следующем нажатии «Начать занятие». Закрытие окна не завершает пару.';
  get('error').textContent=!s.supported?'Окно поверх презентации не поддерживается.':s.error;get<HTMLInputElement>('history').checked=s.history;
  get('count').textContent=`Наблюдений текущей пары: ${s.messages.filter(m=>m.origin==='observed').length}`;
  const shown=s.messages.filter(m=>s.history||m.origin==='observed');get('empty').textContent=shown.length?'':'Новых сообщений пока нет.';
  get('messages').replaceChildren(...shown.slice(-100).map(m=>{const li=doc.createElement('li');li.textContent=`${m.origin==='observed'?'Во время наблюдения':'История / принадлежность занятию неизвестна'} · ${m.author??'Автор неизвестен'}${m.platformTime?' · '+m.platformTime:''}: ${m.text}`;return li;}));
 }};
}

