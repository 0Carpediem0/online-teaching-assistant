import type { ChatState, ObservedMessage } from './adapter';
import { pipStyles } from './pip-styles';

export function createChatView(doc: Document) {
  doc.body.innerHTML = `<style>${pipStyles}</style><header><strong>Чат занятия</strong><span id="status" role="status"></span></header><main id="feed"><p id="empty">Новых сообщений пока нет</p><ol id="chat-messages" aria-label="Сообщения чата"></ol></main><footer>История может быть неполной · данные в этой вкладке</footer>`;
  const feed=doc.querySelector<HTMLElement>('#feed')!;
  const list=doc.querySelector<HTMLOListElement>('#chat-messages')!;
  let ids:string[]=[];
  let messageKey='';
  return { render(s:{active:boolean;history:boolean;chat:ChatState;messages:ObservedMessage[]}) {
    const status=doc.querySelector('#status')!;
    const statusText=!s.active?'Занятие завершено':s.chat==='available'?'Чат открыт':s.chat==='opening'?'Открываем чат':'Чат недоступен';
    if(status.textContent!==statusText)status.textContent=statusText;
    const messages=s.messages.filter(m=>s.history||m.origin==='observed');
    doc.querySelector<HTMLElement>('#empty')!.hidden=messages.length>0;
    const key=JSON.stringify(messages);
    if(key===messageKey)return;
    const previousKey=messageKey;messageKey=key;
    const atBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<32;
    const append=ids.length<=messages.length&&ids.every((id,i)=>id===messages[i].eventId)&&previousKey===JSON.stringify(messages.slice(0,ids.length));
    if(!append)list.replaceChildren();
    for(const m of messages.slice(append?ids.length:0)){
      const li=doc.createElement('li'),text=doc.createElement('p');text.textContent=m.text;li.append(text);if(m.origin!=='observed'){const label=doc.createElement('small');label.textContent='Доступная история';li.prepend(label);}
      if(m.platformTime){const time=doc.createElement('span');time.className='time';time.textContent=m.platformTime;li.append(time);}
      list.append(li);
    }
    ids=messages.map(m=>m.eventId);
    if(atBottom)feed.scrollTop=feed.scrollHeight;
  }};
}

