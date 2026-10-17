const {harness,devices}=require('./test-utils.cjs'),assert=require('node:assert/strict');
(async()=>{const h=await harness();try{
for(const mode of ['iphone','ipad','standalone','android','desktop']){
 const c=await h.browser.newContext(mode==='desktop'?{}:devices['Pixel 7']);
 await c.addInitScript(mode=>{
  if(mode==='iphone')Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'});
  if(mode==='ipad'){Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});}
  if(mode==='standalone')Object.defineProperty(navigator,'standalone',{get:()=>true});
 },mode);
 const p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 for(const file of ['index.html','dashboard.html']){
  await p.goto(h.base+file);await p.evaluate(()=>{state.data.cashDaily=1000;state.savedAt=new Date().toISOString();paint();});
  await p.locator('#data-tools > summary').click();
  const before=await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  assert.equal(await p.locator('#pwa-install-help').isVisible(),false);
  await p.locator('#pwa-install').click();
  assert.equal(await p.locator('#pwa-install-help').isVisible(),true);
  const text=await p.locator('#pwa-install-help').innerText();
  if(mode==='iphone'||mode==='ipad'){assert.ok(text.includes('Safari'));assert.ok(text.includes('分享'));assert.ok(text.includes('加入主畫面'));assert.ok(text.includes('不會直接跳出安裝視窗'));}
  else if(mode==='standalone')assert.ok(text.includes('無需再次新增'));
  else assert.ok(text.includes('Android Chrome')&&text.includes('iPhone／iPad'));
  await p.evaluate(()=>window.dispatchEvent(new Event('online')));
  assert.equal(await p.locator('#pwa-install-help').innerText(),text);
  assert.equal(await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))),before);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(mode==='android'){
   for(const outcome of ['accepted','dismissed']){
    await p.evaluate(outcome=>{window.promptCount=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.promptCount++;};e.userChoice=Promise.resolve({outcome});window.dispatchEvent(e);},outcome);
    await p.locator('#pwa-install').click();assert.equal(await p.evaluate(()=>promptCount),1);
    assert.ok((await p.locator('#pwa-install-help').innerText()).includes(outcome==='accepted'?'已接受安裝':'已取消安裝'));
   }
  }
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(h.base)||u.startsWith('data:')||u.startsWith('blob:')));
 await c.close();console.log(`PASS ${mode}: install instructions both HTMLs, visible durable feedback, unchanged storage, no overflow/external requests.`);
}
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
