import {createRequire} from 'node:module';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bundle=(await build({entryPoints:['src/view.ts'],bundle:true,write:false,format:'iife',globalName:'viewModule'})).outputFiles[0].text;
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();await page.setContent('<div id="app"></div>');await page.addScriptTag({content:bundle});
 await page.evaluate(()=>{
  window.testView=window.viewModule.createView(document.querySelector('#app'),{toggle(){},start(){},stop(){},history(){},pip(){},analyze(){}},true);
  window.testState={active:false,ended:false,shown:true,history:false,busy:false,chat:'unavailable',error:'',pip:false,pipPreferred:false,supported:true,messages:[]};
  window.testView.render(window.testState);
 });
 await page.locator('#open-diagnostics').click();
 for(const phase of ['idle','running','done','stale']){
  await page.evaluate(phase=>{
   const check=phase==='idle'?{phase:'idle'}:phase==='running'?{phase:'running'}:{phase:'done',checkedAt:Date.now(),stale:phase==='stale',microphone:{tone:'ok',text:'Звук проверен'},camera:{tone:'ok',text:'Камера проверена'}};
   window.testView.render({...window.testState,deviceCheck:check});
  },phase);
  assert.equal(await page.locator('#device-camera').isVisible(),true,phase+' camera');
  assert.equal(await page.locator('#device-mic').isVisible(),true,phase+' microphone');
  if(phase==='stale'){
   assert.match(await page.locator('#device-camera').innerText(),/Камера проверена/);
   assert.match(await page.locator('#device-status').innerText(),/Прошлый замер/);
   assert.equal(await page.locator('#device-camera').getAttribute('data-tone'),'unknown');
  }
 }
 console.log('Diagnostic cards visible: idle, running, done, stale; stale results retained and labelled.');
}finally{await browser.close();}
