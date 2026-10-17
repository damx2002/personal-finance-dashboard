const {harness,devices}=require('./test-utils.cjs'),assert=require('node:assert/strict');
(async()=>{const h=await harness();try{
for(const mode of ['iphone','ipad','standalone','standalone-media','android','desktop']){
 const c=await h.browser.newContext(mode==='desktop'?{}:devices['Pixel 7']);
 await c.addInitScript(mode=>{
  if(mode==='iphone')Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'});
  if(mode==='ipad'){Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});}
  if(mode==='standalone')Object.defineProperty(navigator,'standalone',{get:()=>true});
  if(mode==='standalone-media'){const original=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true,addEventListener(){}}:original(q);}
 },mode);
 const p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 for(const file of ['index.html','dashboard.html']){
  await p.goto(h.base+file);await p.evaluate(()=>{state.data.cashDaily=1000;state.savedAt=new Date().toISOString();paint();});
  await p.locator('#data-tools > summary').click();
  const before=await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  assert.equal(await p.locator('#pwa-install').isVisible(),false);
  if(mode.startsWith('standalone')){
   assert.equal(await p.locator('#install-instructions').isVisible(),false);
   await p.evaluate(()=>{window.promptCount=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>promptCount++;e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
   assert.equal(await p.locator('#pwa-install').isVisible(),false);assert.equal(await p.evaluate(()=>promptCount),0);
   await p.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('已安裝，可離線使用'));
  }else{
   assert.equal(await p.locator('#install-instructions').isVisible(),true);await p.locator('#install-instructions > summary').click();
   const text=await p.locator('#pwa-install-help').innerText();
   if(mode==='iphone'||mode==='ipad'){assert.ok(text.includes('Safari'));assert.ok(text.includes('分享'));assert.ok(text.includes('加入主畫面'));assert.ok(text.includes('不會直接跳出安裝視窗'));}
   else assert.ok(text.includes('Android Chrome')&&text.includes('iPhone／iPad'));
   await p.evaluate(()=>window.dispatchEvent(new Event('online')));assert.equal(await p.locator('#pwa-install-help').innerText(),text);
   if(mode==='android'||mode==='desktop'){
    for(const outcome of ['accepted','dismissed','error']){
     const prevented=await p.evaluate(outcome=>{window.promptCount=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.promptCount++;if(outcome==='error')throw Error('unavailable');};e.userChoice=Promise.resolve({outcome});window.dispatchEvent(e);return e.defaultPrevented;},outcome);
     assert.equal(prevented,true);assert.equal(await p.evaluate(()=>promptCount),0);assert.equal(await p.locator('#pwa-install').isVisible(),true);
     await p.locator('#pwa-install').click();assert.equal(await p.evaluate(()=>promptCount),1);assert.equal(await p.locator('#pwa-install').isVisible(),false);
     assert.ok((await p.locator('#pwa-install-help').innerText()).includes(outcome==='accepted'?'已接受安裝':outcome==='dismissed'?'已取消安裝':'Android Chrome'));
    }
    await p.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert.equal(await p.locator('#pwa-install').isVisible(),false);assert.equal(await p.locator('#install-instructions').isVisible(),false);
    await p.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('已安裝，可離線使用'));
   }
  }
  assert.equal(await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))),before);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(h.base)||u.startsWith('data:')||u.startsWith('blob:')));
 await c.close();console.log(`PASS ${mode}: both HTMLs, install prompt gating/deferred user action, standalone hiding, manual Apple guidance, accepted/dismissed/failure feedback, offline status, unchanged storage and privacy.`);
}
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
