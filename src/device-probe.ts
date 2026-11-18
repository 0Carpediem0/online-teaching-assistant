// Runs before Telemost in MAIN world. Observes existing senders only; never
// requests devices, changes tracks, or exports audio/video, SDP or addresses.
import type { ProbeTrack } from './device-types';
import { audioLevel, audibleSamples } from './audio-level';
import { cameraBrightness, darkFrames, openCameraPreview } from './camera-frame';

const peers = new Set<RTCPeerConnection>();
const microphoneInputs = new Set<MediaStreamTrack>();
const sources = new WeakMap<MediaStreamTrack, 'audio' | 'video' | 'display'>();
const NativePeer = window.RTCPeerConnection;
const changed = () => window.top?.postMessage({type:'teacher-device-changed'}, location.origin);
const nativeReplace = RTCRtpSender.prototype.replaceTrack;
RTCRtpSender.prototype.replaceTrack = function (...args) {
 const result = Reflect.apply(nativeReplace, this, args);
 void result.then(changed, () => {});
 return result;
};
navigator.mediaDevices?.addEventListener('devicechange', changed);
if (NativePeer) {
 window.RTCPeerConnection = new Proxy(NativePeer, {
  construct(target, args, newTarget) {
   const peer = Reflect.construct(target, args, newTarget) as RTCPeerConnection;
   peers.add(peer);
   peer.addEventListener('connectionstatechange', () => {
    if (peer.connectionState === 'closed') peers.delete(peer);
   });
   return peer;
  }
 });
}
const media = navigator.mediaDevices;
if (media) {
 const original = media.getUserMedia;
 media.getUserMedia = function (...args) {
  return Reflect.apply(original, this, args).then((stream: MediaStream) => {
   stream.getTracks().forEach(track => {
    sources.set(track, track.kind as 'audio' | 'video');
    if(track.kind==='audio'){microphoneInputs.add(track);track.addEventListener('ended',()=>microphoneInputs.delete(track),{once:true});}
   });
   return stream;
  });
 };
 if (media.getDisplayMedia) {
  const display = media.getDisplayMedia;
  media.getDisplayMedia = function (...args) {
   return Reflect.apply(display, this, args).then((stream: MediaStream) => {
    stream.getTracks().forEach(track => sources.set(track, 'display'));
    return stream;
   });
  };
 }
}

// Preserve source provenance for cloned capture tracks. Unknown processed audio stays unknown.
const nativeClone = MediaStreamTrack.prototype.clone;
MediaStreamTrack.prototype.clone = function () {
 const cloned = Reflect.apply(nativeClone, this, []);
 const source = sources.get(this); if (source) sources.set(cloned, source);
 return cloned;
};

type Stat = { id: string; type: string; mediaSourceId?: string; trackIdentifier?: string;
 bytesSent?: number; framesEncoded?: number; totalAudioEnergy?: number; totalSamplesDuration?: number; audioLevel?: number };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function stats(sender: RTCRtpSender): Promise<Map<string, Stat>> {
 return Promise.race([sender.getStats().then(report => {
  const map = new Map<string, Stat>(); report.forEach(stat => map.set(stat.id, stat)); return map;
 }), pause(900).then(() => new Map<string, Stat>())]).catch(() => new Map<string, Stat>());
}
async function inspect(sender: RTCRtpSender, track: MediaStreamTrack, progress: (level:number)=>void): Promise<ProbeTrack> {
 const cleanup=track.kind==='video' ? await openCameraPreview(track) : ()=>{};
 try {
 let previous = await stats(sender);
 let sending = false, frames = false, signal = false, signalKnown = false;
 const levels: number[] = [];
 const brightness: number[] = [];
 for (let sample = 0; sample < 4; sample++) {
  await pause(650);
  const current = await stats(sender);
  if (track.kind === 'video' && sender.track === track) {
   const level = cameraBrightness(track); if (level !== undefined) brightness.push(level);
  }
  for (const stat of current.values()) {
   const before = previous.get(stat.id);
   if (stat.type !== 'outbound-rtp') continue;
   // Source identity must match this sender; a report can contain other streams.
   const source = stat.mediaSourceId ? current.get(stat.mediaSourceId) : undefined;
   if (source?.trackIdentifier !== track.id) continue;
   if (before && (stat.bytesSent ?? 0) > (before.bytesSent ?? 0)) sending = true;
   if (before && (stat.framesEncoded ?? 0) > (before.framesEncoded ?? 0)) frames = true;
   const priorSource = source ? previous.get(source.id) : undefined;
   const level = source && audioLevel(source, priorSource);
   if (level !== undefined) { signalKnown = true; levels.push(level); progress(level); }
  }
  previous = current;
 }
 signal = audibleSamples(levels);
 return { kind: track.kind as 'audio' | 'video', enabled: track.enabled, imageKnown:brightness.length>=3, dark:darkFrames(brightness),
  live: sender.track === track && track.readyState === 'live' && !track.muted, sending, frames, signal, signalKnown };
 } finally {cleanup();}
}
let running = false, lastRun = 0;
async function localMicrophone(destination: Window,id:string) {
 const inputs=[...microphoneInputs].filter(t=>t.readyState==='live');
 // Multiple input devices are ambiguous: never meter an arbitrary microphone.
 if(inputs.length!==1)return undefined;
 const copy=inputs[0].clone();copy.enabled=true;
 const context=new AudioContext();
 try {
  await Promise.race([context.resume(),pause(700)]);
  if(context.state!=='running')return undefined;
  const source=context.createMediaStreamSource(new MediaStream([copy]));
  const analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
  const samples=new Float32Array(analyser.fftSize),levels:number[]=[];
  for(let i=0;i<50;i++){
   await pause(100);analyser.getFloatTimeDomainData(samples);
   const level=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
   levels.push(level);destination.postMessage({type:'teacher-device-level',id,level},location.origin);
  }
  source.disconnect();analyser.disconnect();
  return {signal:audibleSamples(levels)};
 } finally {copy.stop();await context.close();}
}
window.addEventListener('message', event => {
 if (!event.source || (event.source !== window && event.source !== window.top) || event.origin !== location.origin ||
  event.data?.type !== 'teacher-device-probe' || typeof event.data.id !== 'string' ||
  event.data.id.length > 80 || running || Date.now() - lastRun < 1000) return;
 const id = event.data.id;
 const destination = event.source as Window;
 running = true; lastRun = Date.now();
 const candidates: { sender: RTCRtpSender; track: MediaStreamTrack }[] = [];
 for (const peer of peers) {
  if (peer.connectionState === 'closed') { peers.delete(peer); continue; }
  for (const sender of peer.getSenders()) {
   const track = sender.track;
   if (!track) continue;
   const settings = track.getSettings();
   if (sources.get(track) === 'display' || 'displaySurface' in settings) continue;
   // Unknown processed/screen tracks must not become microphone/camera success.
   if (!sources.has(track) && !settings.deviceId) continue;
   candidates.push({ sender, track });
  }
 }
 const local=localMicrophone(destination,id).catch(()=>undefined);
 void Promise.allSettled(candidates.slice(0, 12).map(({sender, track}) => inspect(sender, track, level => {
  if(track.kind==='audio')destination.postMessage({type:'teacher-device-level',id,level},location.origin);
 })))
  .then(async results => destination.postMessage({type:'teacher-device-result', id,localMicrophone:await local,
   tracks:results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])}, location.origin))
  .finally(() => { running = false; });
});
