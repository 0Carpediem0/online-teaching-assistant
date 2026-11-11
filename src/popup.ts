import { createView } from './view';
type State = Parameters<ReturnType<typeof createView>['render']>[0];
let tabId:number|undefined;
const app=document.querySelector<HTMLElement>('#app')!;
const status=document.querySelector<HTMLElement>('#connection')!;
async function send(command:string,value?:boolean){
 if(tabId===undefined)return;
 try {
  const state=await chrome.tabs.sendMessage(tabId,{type:'teacher-command',command,value},{frameId:0}) as State;
  view.render(state);app.hidden=false;status.hidden=true;
 } catch {app.hidden=true;status.hidden=false;status.textContent='Откройте вкладку Телемоста. Если расширение обновлено, обновите и страницу встречи.';}
}
const view=createView(app,{toggle:()=>window.close(),start:()=>void send('start'),stop:()=>void send('stop'),history:v=>void send('history',v),pip:v=>void send('pip',v)},true);
void chrome.tabs.query({active:true,currentWindow:true}).then(tabs=>{tabId=tabs[0]?.id; if(tabId!==undefined)void send('state');else status.textContent='Откройте вкладку Телемоста.';});
const timer=window.setInterval(()=>void send('state'),800);
window.addEventListener('pagehide',()=>clearInterval(timer));
