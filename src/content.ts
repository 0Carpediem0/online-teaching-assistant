import { TelemostAdapter, type ObservedMessage, type ChatState } from './adapter';
import { createChatView } from './pip-view';
import { AnalysisSession, type AnalysisResponse } from './analysis';
const context = window as Window & { teacherAssistantStarted?: boolean };
if (!context.teacherAssistantStarted) {
 context.teacherAssistantStarted = true;
 let active=false,shown=false,history=false,busy=false,ended=false,error='',pipPreferred=false;
 let chat:ChatState='unavailable', messages:ObservedMessage[]=[],stop:(()=>void)|undefined;
 let analysisSession:AnalysisSession|undefined;
 let analysisBusy=false, analysisError='';
 let analysisTimer:number|undefined, analysisDueAt:number|undefined;
 let pip:Window|undefined,pipView:ReturnType<typeof createChatView>|undefined;
 const api=(window as Window & {documentPictureInPicture?:{requestWindow(o:{width:number;height:number}):Promise<Window>}}).documentPictureInPicture;
 const actions={
  toggle:()=>{shown=!shown;render();},
  start:()=>{if(active)return;clearAnalysisTimer();messages=[];analysisSession=new AnalysisSession();analysisBusy=false;analysisError='';error='';active=true;ended=false;stop=new TelemostAdapter().observeChat(v=>{chat=v;render();},m=>{messages.push(m);if(analysisSession?.add(m))scheduleAnalysis();render();});render();},
  stop:()=>{stop?.();stop=undefined;active=false;ended=true;render();},
  history:(v:boolean)=>{history=v;render();},
  pip:async(v:boolean)=>{if(!v){pipPreferred=false;error='';pip?.close();render();return;}if(busy||pip||!api)return;busy=true;error='';render();try{
   const opened=await api.requestWindow({width:320,height:420});if(!pipPreferred){opened.close();return;}pip=opened;pip.document.title='Чат занятия';pipView=createChatView(pip.document);
   pip.addEventListener('pagehide',()=>{pip=undefined;pipView=undefined;pipPreferred=false;render();},{once:true});
  }catch{pipPreferred=false;error='Не удалось открыть окно. Вернитесь в Телемост и попробуйте ещё раз.';}finally{busy=false;render();}}
 };
 function clearAnalysisTimer(){if(analysisTimer!==undefined)window.clearTimeout(analysisTimer);analysisTimer=undefined;analysisDueAt=undefined;}
 function scheduleAnalysis(){
  if(analysisTimer!==undefined)return;
  analysisDueAt=Date.now()+300_000;
  analysisTimer=window.setTimeout(()=>{analysisTimer=undefined;analysisDueAt=undefined;void runAnalysis();},300_000);
 }
 function runAnalysis(reply?:(value:unknown)=>void){
  if(analysisBusy||!analysisSession){reply?.(snapshot());return;}
  const session=analysisSession,request=session.prepareBatch();
  if(!request){reply?.(snapshot());return;}
  clearAnalysisTimer();analysisBusy=true;analysisError='';render();
  void chrome.runtime.sendMessage({type:'teacher-run-analysis',request}).then((response:{ok:boolean;result?:AnalysisResponse;error?:string})=>{
   if(!response.ok||!response.result)throw new Error(response.error);
   session.accept(request,response.result);
  }).catch((failure:Error)=>{session.retry(request);if(analysisSession===session){
   const reason=failure.message;
   analysisError=reason==='invalid_request'?'Сервис отклонил пакет сообщений (400).':
     reason==='invalid_model_json'||reason==='invalid_model_response'?'Модель вернула ответ не по схеме. Повторите анализ.':
     reason==='model_timeout'||reason==='request_timeout'?'Модель не ответила за 2 минуты. Повторите анализ меньшим пакетом.':
     reason==='ollama_unavailable'||reason==='ollama_http_error'?'Ollama недоступна или не нашла модель. Проверьте терминал сервиса.':
     'Локальный сервис недоступен или ответ не принят. Проверьте терминал и повторите.';
  }}).finally(()=>{if(analysisSession===session){analysisBusy=false;
   if(!analysisError&&analysisTimer===undefined&&session.getEvents().some(event=>event.processingStatus==='pending'))scheduleAnalysis();
   render();}reply?.(snapshot());});
 }
 function snapshot(){return {active,ended,shown:true,history,busy,chat,error,pip:Boolean(pip),pipPreferred,supported:Boolean(api),messages,
  analysisBusy,analysisError,analysisPending:analysisSession?.getEvents().filter(e=>e.processingStatus==='pending').length??0,
  compiledQuestions:analysisSession?.getDisplayQuestions()??[],
  compiledTechnicalIssues:analysisSession?.getDisplayTechnicalIssues()??[],analysisDueAt,
  analysisSummary:analysisSession?.getSummary()};}
 function render(){pipView?.render(snapshot());}
 chrome.runtime.onMessage.addListener((m,_sender,reply)=>{
  if(m.type==='teacher-analysis-snapshot'){reply({schemaVersion:'1.0',sessionId:analysisSession?.sessionId ?? null,events:analysisSession?.getEvents() ?? []});return;}
  if(m.type!=='teacher-command')return;
  if(m.command==='analyze'){
   runAnalysis(reply);return true;
  }
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
 window.addEventListener('pagehide',()=>{clearAnalysisTimer();actions.stop();pip?.close();});render();
}
