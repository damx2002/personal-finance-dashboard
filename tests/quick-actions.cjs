const {harness,devices}=require('./test-utils.cjs'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const h=await harness();try{
for(const [mode,opts]of [['desktop',{viewport:{width:1280,height:960}}],['android-390',{...devices['Pixel 7'],viewport:{width:390,height:844}}]]){
 const c=await h.browser.newContext(opts),p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({method:r.method(),url:r.url()}));
 for(const file of ['index.html','dashboard.html']){
  await p.goto(h.base+file);await p.evaluate(()=>localStorage.clear());await p.reload();
  // Store a browser-provided prompt while first-run UI is active; never invoke it automatically.
  await p.evaluate(()=>{window.promptCalls=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>promptCalls++;e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
  assert.equal(await p.locator('#pwa-install').isVisible(),false);await p.locator('#start-setup').click();await p.locator('[name="cashDaily"]').fill('900000');for(let i=0;i<3;i++)await p.locator('#wizard-next').click();
  assert.equal(await p.locator('#pwa-install').isVisible(),true);assert.equal(await p.evaluate(()=>promptCalls),0);assert.equal(await p.locator('dialog[open]').count(),0);
  await p.evaluate(()=>{state.data={...state.data,income:1800000,living:60000,regular:1200000,leveraged:4600000,targetAssets:10000000,currentAge:39,targetAge:42};paint();});
  const original=await p.evaluate(()=>JSON.stringify({state,storage:Object.fromEntries(Object.entries(localStorage))}));
  const ids=['generate-summary','hide-amounts','image-status','image-result','download-summary','summary-preview','pwa-install','pwa-install-help','pwa-status'];
  for(const id of ids)assert.equal(await p.locator('#'+id).count(),1,id);
  assert.equal(await p.locator('#data-tools #generate-summary,#data-tools #hide-amounts,#data-tools #pwa-install').count(),0);
  assert.equal(await p.locator('#data-tools #pwa-status').count(),1);
  assert.ok(await p.evaluate(()=>{const k=document.querySelector('.kpis'),q=document.querySelector('.quick-actions'),m=document.querySelector('#month-comparison'),g=document.querySelector('.goals');return !!(k.compareDocumentPosition(q)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(q.compareDocumentPosition(m)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(q.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING);}));
  assert.equal(await p.locator('#summary-tools').isVisible(),false);assert.equal(await p.locator('#open-summary-tools').getAttribute('aria-expanded'),'false');
  await p.locator('#open-summary-tools').focus();await p.locator('#open-summary-tools').press('Enter');assert.equal(await p.locator('#summary-tools').isVisible(),true);assert.equal(await p.locator('#mobile-edit').isVisible(),false);assert.equal(await p.locator('#open-summary-tools').getAttribute('aria-expanded'),'true');
  await p.evaluate(()=>{window.generated=0;const original=window.generateSummary;window.generateSummary=function(...args){generated++;return original(...args);};window.drawn=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){drawn.push(String(value));return fill.call(this,value,...args);};});
  for(const theme of ['light','dark'])for(const hide of [false,true]){
   await p.evaluate(t=>setTheme(t),theme);await p.locator('#hide-amounts').setChecked(hide);await p.evaluate(()=>drawn=[]);const before=await p.evaluate(()=>generated),download=p.waitForEvent('download');await p.locator('#generate-summary').click();const file=await download,b=await fs.readFile(await file.path());assert.equal(b.readUInt32BE(16),1080);assert.equal(b.readUInt32BE(20),1350);assert.equal(await p.evaluate(()=>generated),before+1);
   const texts=await p.evaluate(()=>drawn.join('\n'));assert.equal(texts.includes('NT$'),!hide);assert.ok(texts.includes('我的財務摘要'));assert.ok((await p.locator('#image-status').innerText()).includes('所有資料僅在本機處理'));
   assert.equal(await p.locator('#download-summary').isVisible(),true);if(!await p.locator('#image-result details').evaluate(e=>e.open))await p.locator('#image-result summary').click();await p.waitForFunction(()=>document.querySelector('#summary-preview').naturalWidth===1080);assert.equal(await p.locator('#summary-preview').isVisible(),true);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.ok(await p.locator('.quick-actions button').evaluateAll(a=>a.every(e=>e.getBoundingClientRect().height>=44&&!e.classList.contains('primary-button'))));
  if(mode==='android-390'){const boxes=await p.locator('.quick-actions>button').evaluateAll(a=>a.map(e=>e.getBoundingClientRect().top));assert.equal(boxes[0],boxes[1]);}
  await p.locator('#open-summary-tools').click();assert.equal(await p.locator('#summary-tools').isVisible(),false);assert.equal(await p.locator('#open-summary-tools').getAttribute('aria-expanded'),'false');if(mode==='android-390')assert.equal(await p.locator('#mobile-edit').isVisible(),true);
  assert.equal(await p.evaluate(()=>JSON.stringify({state,storage:Object.fromEntries(Object.entries(localStorage))})),original);
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(h.base)||r.url.startsWith('blob:')||r.url.startsWith('data:'))));await c.close();console.log(`PASS ${mode}: discoverable KPI quick actions, single DOM/PNG handler, full/private downloads and preview, Light/Dark, deferred first-run install prompt, 44px mobile wrapping, unchanged storage/no external requests.`);
}
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
