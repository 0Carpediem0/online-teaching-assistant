import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

const bundle = async path => (await build({entryPoints:[path],bundle:true,write:false,format:'iife',globalName:'tested',platform:'browser'})).outputFiles[0].text;
const summaryContext = {};
runInNewContext(await bundle('src/device-types.ts'), summaryContext);
const summarize = summaryContext.tested.summarizeDevice;
const audio = {kind:'audio',enabled:true,live:true,sending:true,signal:true,signalKnown:true,frames:false};
assert.equal(summarize('audio',[audio],false).tone,'ok');
assert.equal(summarize('audio',[audio],true).tone,'off');
assert.equal(summarize('audio',[{...audio,signal:false}],false).tone,'warning');
assert.equal(summarize('audio',[],false).tone,'unknown');
assert.equal(summarize('video',[{...audio,kind:'video',frames:false}],false).tone,'unknown');
assert.equal(summarize('video',[{...audio,kind:'video',frames:true,imageKnown:true}],false).tone,'ok');
assert.equal(summarize('audio',[{...audio,live:false}],false).tone,'warning');

const listeners = new Map();
let reply;
class Track { clone(){return this;} }
class Sender {replaceTrack(){return Promise.resolve();}}
const win = {addEventListener(type,cb){listeners.set(type,cb);},postMessage(data){reply=data;}};
const mic = {id:'mic',kind:'audio',enabled:true,muted:false,readyState:'live',getSettings:()=>({deviceId:'private-device'})};
const camera = {...mic,id:'cam',kind:'video'};
const screen = {...camera,id:'screen',getSettings:()=>({displaySurface:'monitor'})};
const sender = track => {
 let count=0;
 return {track,async getStats(){count++;return new Map([
  ['source',{id:'source',type:'media-source',trackIdentifier:track.id,audioLevel:track.kind==='audio'?0.2:undefined}],
  ['out',{id:'out',type:'outbound-rtp',mediaSourceId:'source',bytesSent:count*100,framesEncoded:track.kind==='video'?count:undefined}]
 ]);}};
};
class Peer {connectionState='connected';addEventListener(){}getSenders(){return [sender(mic),sender(camera),sender(screen)];}}
win.RTCPeerConnection=Peer;
runInNewContext(await bundle('src/device-probe.ts'),{document:{createElement:()=>({style:{},play:()=>Promise.resolve(),pause(){},remove(){}}),documentElement:{append(){}},querySelectorAll:()=>[]},MediaStream:class {constructor(){}},window:win,MediaStreamTrack:Track,RTCRtpSender:Sender,navigator:{},location:{origin:'https://telemost.yandex.ru'},setTimeout:cb=>setTimeout(cb,0),Reflect,Proxy,Promise,Map,Set,WeakMap,Date});
new win.RTCPeerConnection();
listeners.get('message')({source:win,origin:'https://evil.example',data:{type:'teacher-device-probe',id:'bad'}});
assert.equal(reply,undefined);
const parent={postMessage(data){reply=data;}};win.top=parent;
listeners.get('message')({source:parent,origin:'https://telemost.yandex.ru',data:{type:'teacher-device-probe',id:'test'}});
await new Promise(resolve=>setTimeout(resolve,100));
assert.equal(reply.id,'test');
assert.equal(reply.tracks.length,2,'Screen sharing must not count as camera');
assert.equal(reply.tracks.find(t=>t.kind==='audio').signal,true);
assert.equal(reply.tracks.find(t=>t.kind==='video').frames,true);
assert.ok(reply.tracks.every(t=>t.sending));
assert.ok(!JSON.stringify(reply).includes('private-device'),'Do not export device identifiers');
console.log('Device checks passed: classification, outbound stats, screen exclusion, origin validation, privacy.');

const levelContext = {};
runInNewContext(await bundle('src/audio-level.ts'), levelContext);
const {audioLevel,audibleSamples}=levelContext.tested;
assert.equal(audioLevel({totalAudioEnergy:1.00000001,totalSamplesDuration:11},{totalAudioEnergy:1,totalSamplesDuration:10}) < 0.001,true);
assert.equal(audibleSamples([0,0,0,0]),false);
assert.equal(audibleSamples([0.0001,0.0002,0.0001,0.0002]),false);
assert.equal(audibleSamples([0,0.2,0,0]),false);
assert.equal(audibleSamples([0.03,0.08,0.02,0]),true);
assert.equal(audioLevel({totalAudioEnergy:2},{totalAudioEnergy:1}),undefined);
console.log('Audio gate: silence, hardware-mute-like noise, isolated click, sustained signal and missing duration passed.');

const cameraContext={};runInNewContext(await bundle('src/camera-frame.ts'),cameraContext);
assert.equal(cameraContext.tested.darkFrames([0,0,0]),true);
assert.equal(cameraContext.tested.darkFrames([0,0]),false);
assert.equal(cameraContext.tested.darkFrames([0,0.4,0]),false);
assert.equal(summarize('video',[{...audio,kind:'video',frames:true,dark:true}],false).tone,'warning');
console.log('Dark camera frames and insufficient samples passed.');
