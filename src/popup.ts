import { createView } from './view';
import { createNotice } from './notice';
type State = Parameters<ReturnType<typeof createView>['render']>[0];
let tabId:number|undefined;
const app=document.querySelector<HTMLElement>('#app')!;
const status=document.querySelector<HTMLElement>('#connection')!;
const statusText=document.querySelector<HTMLElement>('#connection-text')!;
const connectionNotice=createNotice(document.body, 'connection-notice');
function disconnected(message:string){
 app.hidden=true;status.hidden=false;
 if(statusText.textContent!==message)statusText.textContent=message;
 connectionNotice.render({key:'connection',tone:'danger',title:'Не удалось подключиться к встрече',message});
}
async function send(command:string,value?:boolean){
 if(tabId===undefined)return;
 try {
  const state=await chrome.tabs.sendMessage(tabId,{type:'teacher-command',command,value},{frameId:0}) as State;
  connectionNotice.render();view.render(state);app.hidden=false;status.hidden=true;
 } catch {disconnected('Откройте вкладку Телемоста. Если расширение обновлено, обновите страницу встречи.');}
}
const view=createView(app,{toggle:()=>window.close(),start:()=>void send('start'),stop:()=>void send('stop'),history:v=>void send('history',v),pip:v=>void send('pip',v)},true);
void chrome.tabs.query({active:true,currentWindow:true}).then(tabs=>{tabId=tabs[0]?.id; if(tabId!==undefined)void send('state');else disconnected('Откройте вкладку Телемоста.');}).catch(()=>{disconnected('Не удалось подключиться. Откройте расширение заново.');});
const timer=window.setInterval(()=>void send('state'),800);
window.addEventListener('pagehide',()=>clearInterval(timer));
