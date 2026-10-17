const {harness,devices}=require('./test-utils.cjs');
const assert=require('node:assert/strict');
(async()=>{const h=await harness();try{
 for(const [device,options] of [['desktop',{}],['android-emulated',devices['Pixel 7']]]){
  const context=await h.browser.newContext(options),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  for(const file of ['index.html','dashboard.html']){
   await page.goto(h.base+file);
   const original=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
   await page.evaluate(()=>{window.guideWrites=[];window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){guideWrites.push(k);return originalSet.call(this,k,v);};});
   for(const theme of ['light','dark']){
    // Theme selection happens before observing guide-only writes.
    await page.evaluate(t=>{setTheme(t);guideWrites.length=0;},theme);
    const saved=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    await page.locator('#open-filling-guide').click();
    assert.equal(await page.locator('#filling-guide').evaluate(e=>e.open),true);
    assert.equal(await page.locator('#filling-guide').evaluate(e=>e.scrollTop),0);
    assert.deepEqual(await page.locator('#filling-guide h3').allTextContents(),['收入','生活支出','資產與負債','現金分類','個人警戒線','多久更新一次']);
    assert.ok((await page.locator('#filling-guide').innerText()).includes('不是通用安全標準'));
    assert.ok(await page.locator('#filling-guide').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#close-filling-guide').click();
    assert.equal(await page.locator('#filling-guide').evaluate(e=>e.open),false);
    assert.deepEqual(await page.evaluate(()=>guideWrites),[]);
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))),saved);
   }
   await page.locator('#open-filling-guide').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#filling-guide').evaluate(e=>e.open),false);
   await page.locator('#open-filling-guide').click();await page.locator('#start-from-guide').click();
   assert.equal(await page.locator('#filling-guide').evaluate(e=>e.open),false);
   assert.equal(await page.locator('#wizard').evaluate(e=>e.open),true);
   assert.ok((await page.locator('#wizard-title').innerText()).includes('目前財務'));
   const income=page.locator('[name="income"]').locator('..');
   assert.equal(await income.locator('.field-helper').innerText(),'優先填家庭全年實際可支配／實領收入。');
   await income.locator('.field-guidance > summary').click();
   const detail=await income.locator('.field-guidance').innerText();
   for(const phrase of ['直接與生活支出、貸款還款及固定投資比較','所得稅、勞健保','不代表每個月實際都有相同收入'])assert.ok(detail.includes(phrase));
   await page.locator('#close-wizard').click();
   assert.equal(await page.locator('.stress-scope-note').count(),2);
   for(const note of await page.locator('.stress-scope-note').allTextContents())assert.ok(note.includes('債券、貨幣型、原物料'));
   await page.evaluate(()=>Storage.prototype.setItem=originalSet);
   // Only the existing wizard/theme operations may change storage; no guide key exists.
   const added=await page.evaluate(before=>Object.keys(localStorage).filter(k=>!(k in JSON.parse(before))),original);
   assert.ok(added.every(k=>['personal-finance-dashboard.v3','personal-finance-dashboard.theme'].includes(k)));
  }
  assert.deepEqual(errors,[]);assert.ok(requests.every(url=>url.startsWith(h.base)||url.startsWith('data:')||url.startsWith('blob:')));
  await context.close();console.log(`PASS ${device}: guide both HTMLs, Light/Dark, six principles, no storage writes, Escape/close, Step 1 entry, corrected income, stress scope, no overflow or external requests.`);
 }
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
