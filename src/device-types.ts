export interface ProbeTrack {
 dark?: boolean;
 imageKnown?: boolean;
 kind: 'audio' | 'video'; enabled: boolean; live: boolean;
 sending: boolean; frames: boolean; signal: boolean; signalKnown: boolean;
}
export interface DeviceResult { tone: 'ok' | 'warning' | 'unknown' | 'off'; text: string }
export interface DeviceCheck {
 phase: 'idle' | 'running' | 'done'; checkedAt?: number; stale?: boolean; details?: string; level?: number;
 microphone?: DeviceResult; camera?: DeviceResult;
}
export function summarizeDevice(kind: 'audio' | 'video', tracks: ProbeTrack[], off: boolean): DeviceResult {
 const name = kind === 'audio' ? 'Микрофон' : 'Камера';
 if (off) return {tone:'off',text:`${name} выключен${kind === 'video' ? 'а' : ''} в Телемосте`};
 const relevant = tracks.filter(track => track.kind === kind);
 if (!relevant.length) return {tone:'unknown',text:`${name}: поток звонка недоступен для проверки`};
 const ready = relevant.filter(track => track.enabled && track.live);
 if (!ready.length) return {tone:'warning',text:`${name}: нет активного потока. Проверьте устройство в Телемосте`};
 if (kind === 'audio') {
  if (ready.some(track => track.signal && track.sending)) return {tone:'ok',text:'Звук есть и отправляется'};
  if (ready.some(track => track.signalKnown) && !ready.some(track => track.signal))
   return {tone:'warning',text:'Не слышно сигнала. Проверьте mute на гарнитуре'};
  return {tone:'unknown',text:ready.some(track => track.signal) ? 'Звук есть, отправку подтвердить не удалось' : 'Уровень микрофона недоступен для проверки'};
 }
 if (ready.length && ready.every(track => track.dark === true)) return {tone:'warning',text:'Кадр почти чёрный. Проверьте шторку и освещение'};
 if (ready.some(track => track.frames && track.sending && track.imageKnown && !track.dark)) return {tone:'ok',text:'Изображение есть, кадры отправляются'};
 if (ready.some(track => track.frames && track.sending)) return {tone:'unknown',text:'Кадры отправляются; изображение не проверено'};
 return {tone:'unknown',text:'Камера подключена, отправку кадров подтвердить не удалось'};
}
