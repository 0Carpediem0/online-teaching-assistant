import { TelemostAdapter, type ObservedMessage, type ChatState } from './adapter';
import { createChatView } from './pip-view';
const context = window as Window & { teacherAssistantStarted?: boolean };
if (!context.teacherAssistantStarted) {
 context.teacherAssistantStarted = true;
 let active=false,shown=false,history=false,busy=false,ended=false,error='',pipPreferred=false;
 let chat:ChatState='unavailable', messages:ObservedMessage[]=[],stop:(()=>void)|undefined;
 let pip:Window|undefined,pipView:ReturnType<typeof createChatView>|undefined;
 const api=(window as Window & {documentPictureInPicture?:{requestWindow(o:{width:number;height:number}):Promise<Window>}}).documentPictureInPicture;
 const actions={
  toggle:()=>{shown=!shown;render();},
  start:()=>{if(active)return;messages=[];active=true;ended=false;stop=new TelemostAdapter().observeChat(v=>{chat=v;render();},m=>{messages.push(m);render();});render();},
  stop:()=>{stop?.();stop=undefined;active=false;ended=true;render();},
  history:(v:boolean)=>{history=v;render();},
  pip:async(v:boolean)=>{if(!v){pipPreferred=false;pip?.close();return;}if(busy||pip||!api)return;busy=true;error='';render();try{
   const opened=await api.requestWindow({width:320,height:420});if(!pipPreferred){opened.close();return;}pip=opened;pip.document.title='Чат занятия';pipView=createChatView(pip.document);
   pip.addEventListener('pagehide',()=>{pip=undefined;pipView=undefined;pipPreferred=false;render();},{once:true});
  }catch{pipPreferred=false;error='Не удалось открыть окно. Вернитесь в Телемост и попробуйте ещё раз.';}finally{busy=false;render();}}
 };
 function snapshot(){return {active,ended,shown:true,history,busy,chat,error,pip:Boolean(pip),pipPreferred,supported:Boolean(api),messages};}
 function render(){pipView?.render(snapshot());}
 chrome.runtime.onMessage.addListener((m,_sender,reply)=>{
  if(m.type!=='teacher-command')return;
  if(m.command==='start' && !active){
   // Request before any asynchronous work, in the incoming user-gesture task.
   const opening=pipPreferred?actions.pip(true):Promise.resolve();
   actions.start();void opening.then(()=>reply(snapshot()));return true;
  }
  if(m.command==='stop')actions.stop();
  if(m.command==='history')actions.history(m.value===true);
  if(m.command==='pip'){pipPreferred=m.value===true;if(active){void actions.pip(pipPreferred).then(()=>reply(snapshot()));return true;}}
  reply(snapshot());
 });
 window.addEventListener('pagehide',()=>{actions.stop();pip?.close();});render();
}
