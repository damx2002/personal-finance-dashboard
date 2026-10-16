const {chromium,devices}=require('playwright');const assert=require('node:assert/strict');const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
(async()=>{const root=path.resolve(__dirname,'..');const server=http.createServer(async(req,res)=>{const name=req.url.split('?')[0].slice(1)||'index.html';if(!['index.html','dashboard.html','app.js','summary.js','style.css'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(path.join(root,name)));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const [device,options]of [['desktop',{viewport:{width:1440,height:1000}}],['android-emulated',devices['Pixel 7']]]){
 const context=await browser.newContext({...options,colorScheme:'dark'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of ['index.html','dashboard.html']){
 await page.goto(base+file);await page.evaluate(()=>localStorage.clear());await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(244, 247, 245)');
 await page.locator('.inputs > summary').click();await page.locator('[name="living"]').fill('10000');await page.locator('[name="income"]').fill('1200000');await page.locator('[name="regular"]').fill('1000000');
 const card=page.locator('#cashRunway').locator('..'), leverageCard=page.locator('#marketLeverage').locator('..');
 for(const mode of ['light','dark']){
 await page.locator(`[data-theme-choice="${mode}"]`).click();assert.equal(await page.locator('html').getAttribute('data-theme'),mode);assert.equal(await page.locator(`[data-theme-choice="${mode}"]`).getAttribute('aria-pressed'),'true');
 const pngBackground=await page.evaluate(()=>Array.from(drawSummary(summaryModel(null,false)).getContext('2d').getImageData(0,0,1,1).data));assert.deepEqual(pngBackground,mode==='dark'?[16,30,26,255]:[244,247,245,255]);
 for(const [label,cash,repay,leverage]of [['normal',200000,10000,1],['near',297000,35000,1.7],['over',300000,60000,2.2]]){
 await page.locator('[name="mortgagePayment"]').fill(String(repay));await page.locator('[name="cash"]').fill(String(cash));await page.locator('[name="leveraged"]').fill('1000000');await page.locator('[name="multiplier"]').fill(String(leverage*2-1));
 const payment=page.locator('#health > div').filter({has:page.getByText('每月債務還款 / 月收入',{exact:true})});
 if(label==='normal'){
  assert.equal(await card.locator('.status-badge').count(),0);assert.equal(await card.locator('.reason-accordion').getAttribute('open'),null);assert.equal(await leverageCard.locator('.status-badge').count(),0);assert.equal(await payment.locator('.row-status').count(),0);
  await card.locator('.reason-accordion > summary').click();assert.ok(await card.locator('.explanation-brief').isVisible());assert.equal(await card.locator('.full-explanation').getAttribute('open'),null);await card.locator('.reason-accordion > summary').click();
 }else{
  const expected=label==='near'?'接近警戒':'超過警戒';assert.equal(await card.locator('.status-badge').innerText(),expected);assert.equal(await leverageCard.locator('.status-badge').innerText(),expected);assert.equal(await payment.locator('.row-status').innerText(),expected);
  for(const host of [card,leverageCard,payment]){assert.notEqual(await host.locator('.reason-accordion').getAttribute('open'),null);assert.equal(await host.locator('.full-explanation').getAttribute('open'),null);assert.ok(await host.locator('.explanation-brief').isVisible());}
  const brief=await card.locator('.explanation-brief').evaluate(el=>({height:el.getBoundingClientRect().height,line:parseFloat(getComputedStyle(el).lineHeight)}));assert.ok(brief.height<=brief.line*3+1);
  await card.locator('.full-explanation > summary').click();assert.ok(await card.locator('.explanation-detail').isVisible());const height=await card.locator('.explanation-detail').evaluate(el=>el.clientHeight);assert.ok(height<=200);
  assert.ok((await card.locator('.explanation-detail').textContent()).includes('個人參考'));await card.locator('.full-explanation > summary').click();
 }
 assert.equal(await page.locator('.kpi').count(),4);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(device==='android-emulated'){const boxes=await page.locator('.kpi').evaluateAll(cards=>cards.map(c=>({x:c.offsetLeft,y:c.offsetTop})));assert.equal(boxes[0].y,boxes[1].y);assert.ok(boxes[1].x>boxes[0].x);}
 if(file==='index.html')await page.screenshot({path:path.join(os.tmpdir(),`appearance-${device}-${mode}-${label}.png`),fullPage:true});
 }
 }
 const before=await page.evaluate(()=>localStorage.getItem('personal-finance-dashboard.v2'));await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.evaluate(()=>localStorage.getItem('personal-finance-dashboard.v2')),before);await page.locator('[data-theme-choice="light"]').click();await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 }
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${device}: Light default despite dark OS, Light/Dark, three warning states, badges, automatic brief, detail accordion, mobile two columns, bounded heights, theme persistence, financial data unchanged.`);
}
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
