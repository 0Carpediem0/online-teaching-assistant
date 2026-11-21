// Labels observed in the saved Telemost DOM capture (2026-10-28).
// Read only: a button describes the action, hence «Включить» means currently off.
import { summarizeDevice, type DeviceCheck, type ProbeTrack } from './device-types';

function documents() {
 const docs: Document[] = [];
 const visit = (doc: Document, depth: number) => {
  docs.push(doc);
  if (depth >= 8) return;
  for (const frame of doc.querySelectorAll('iframe')) {
   if (!frame.getBoundingClientRect().width) continue;
   try { if (frame.contentDocument) visit(frame.contentDocument, depth + 1); } catch { /* inaccessible frame */ }
  }
 };
 visit(document, 0);
 return docs;
}
export function readDevices() {
 const docs = documents();
 const read = (device: string): 'on' | 'off' | 'unknown' => {
  const values = new Set<string>();
  for (const doc of docs) for (const button of doc.querySelectorAll('button')) {
   const rect = button.getBoundingClientRect();
   if (!rect.width || !rect.height || button.closest('[role="dialog"]')) continue;
   const style = doc.defaultView?.getComputedStyle(button);
   if (style?.visibility === 'hidden' || style?.display === 'none') continue;
   const label = button.getAttribute('aria-label') || button.title;
   if (label === `Включить ${device}`) values.add('off');
   if (label === `Выключить ${device}`) values.add('on');
  }
  return values.size === 1 ? [...values][0] as 'on' | 'off' : 'unknown';
 };
 return { microphone: read('микрофон'), camera: read('камеру') };
}

async function mutedCheck(progress: (level:number)=>void): Promise<DeviceCheck> {
 const id = crypto.randomUUID();
 const targets: Window[] = documents().flatMap(doc => doc.defaultView ? [doc.defaultView] : []);
 const tracks: ProbeTrack[] = [];
 const localSignals:boolean[]=[];
 await new Promise<void>(resolve => {
  const pending = new Set(targets);
  const finish = () => { clearTimeout(timer); window.removeEventListener('message', receive); resolve(); };
  const receive = (event: MessageEvent) => {
   if(event.origin===location.origin && pending.has(event.source as Window) && event.data?.id===id && event.data?.type==='teacher-device-level') {
    const level=event.data.level;if(typeof level==='number' && Number.isFinite(level) && level>=0 && level<=1)progress(level);return;
   }
   if (event.origin !== location.origin || !pending.has(event.source as Window) ||
    event.data?.type !== 'teacher-device-result' || event.data.id !== id || !Array.isArray(event.data.tracks)) return;
   pending.delete(event.source as Window);
   if(typeof event.data.localMicrophone?.signal==='boolean')localSignals.push(event.data.localMicrophone.signal);
   for (const track of event.data.tracks.slice(0,12)) {
    if (!track || !['audio','video'].includes(track.kind) ||
     !['enabled','live','sending','frames','signal','signalKnown'].every(key => typeof track[key] === 'boolean')) continue;
    tracks.push(track);
   }
   if (!pending.size) finish();
  };
  const timer = window.setTimeout(finish, 8500);
  window.addEventListener('message', receive);
  for (const target of targets) {
   try { target.postMessage({type:'teacher-device-probe',id},location.origin); } catch { pending.delete(target); }
  }
  if (!pending.size) finish();
 });
 const current = readDevices();
 return {phase:'done',checkedAt:Date.now(),details: tracks.length ? 'Проверена локальная исходящая статистика. Получение у студентов не проверено. Неизвестное происхождение обработанного аудио не засчитывается как микрофон.' : 'Не получены подходящие исходящие потоки. После обновления расширения обновите страницу встречи. Обработанные источники без подтверждённого происхождения исключены; это не означает поломку.',
  microphone:localSignals.length===1 ? localSignals[0] ? {tone:'ok',text:'Микрофон улавливает звук'} : {tone:'warning',text:'Тихо. Скажите фразу и проверьте mute гарнитуры'} : {tone:'unknown',text:'Локальный сигнал недоступен'},
  camera:summarizeDevice('video', tracks, current.camera === 'off')};
}

// Use only exact labels already observed in Telemost, never a guessed toggle.
function micButton(label:string): HTMLButtonElement | undefined {
 // The observed call UI is in a child frame; the parent also has a duplicate
 // call widget. Prefer the deepest accessible document, never click both.
 for(const doc of documents().reverse()) {
 const matches=[...doc.querySelectorAll<HTMLButtonElement>('button')].filter(b=>{
  const rect=b.getBoundingClientRect();
  return !b.disabled && !b.closest('[role="dialog"]') && rect.width>0 && rect.height>0 &&
   b.ownerDocument.defaultView?.getComputedStyle(b).visibility!=='hidden' && (b.getAttribute('aria-label')||b.title)===label;
 });
 if(matches.length)return matches.length===1 ? matches[0] : undefined;
 }
 return undefined;
}
export async function checkDevices(progress: (level:number)=>void = ()=>{}): Promise<DeviceCheck> {
 const initial=readDevices().microphone;
 let changed=false;
 const docs=documents();let manual=false;
 const touched=(e:Event)=>{if(e.isTrusted)manual=true;};
 const unavailable=(text:string):DeviceCheck=>({phase:'done',checkedAt:Date.now(),microphone:{tone:'unknown',text},camera:{tone:'unknown',text:'Проверка не запущена'}});
 if(initial==='unknown')return unavailable('Не удалось определить mute в Телемосте');
 if(initial==='on'){
  const button=micButton('Выключить микрофон');
  if(!button)return unavailable('Выключите микрофон в Телемосте перед проверкой');
  button.click();changed=true;
 }
 docs.forEach(d=>{d.addEventListener('click',touched,true);d.addEventListener('keydown',touched,true);});
 try {
  for(let i=0;i<10&&readDevices().microphone!=='off';i++)await new Promise(r=>setTimeout(r,100));
  if(readDevices().microphone!=='off')return unavailable('Mute не подтверждён. Проверка отменена');
  const result=await mutedCheck(progress);
  result.details='Голос измеряется локально, без отправки во встречу. Это не проверка того, слышат ли студенты. После теста восстанавливаем микрофон, только если сами выключили его и вы не взаимодействовали со страницей.';
  return result;
 } finally {
  docs.forEach(d=>{d.removeEventListener('click',touched,true);d.removeEventListener('keydown',touched,true);});
  if(changed&&!manual&&readDevices().microphone==='off'){
   micButton('Включить микрофон')?.click();
   // Keep the check running until the UI reflects our own restoration.
   for(let i=0;i<15&&readDevices().microphone!=='on';i++)await new Promise(r=>setTimeout(r,100));
  }
 }
}
