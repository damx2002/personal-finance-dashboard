const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer(async(req,res)=>{const name=req.url.slice(1)||'index.html';if(!['index.html','dashboard.html','style.css','app.js','summary.js'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(path.join(root,name)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 for(const [name,options] of [['desktop',{viewport:{width:1440,height:1000}}],['android-emulated',{...devices['Pixel 7'],colorScheme:'dark'}]]){
  const context=await browser.newContext(options);const requests=[],errors=[];context.on('request',r=>requests.push({url:r.url(),method:r.method()}));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();
  for(const file of ['index.html','dashboard.html']){
   await page.goto(base+file);await page.evaluate(()=>localStorage.clear());await page.reload();assert.equal(await page.locator('#month-comparison').isVisible(),false);
   await page.locator('.inputs summary').click();
   const inputs={cash:120000,home:5000000,regular:800000,leveraged:200000,multiplier:2,mortgage:2000000,loan:400000,investmentDebt:300000,income:1200000,living:20000,mortgagePayment:35000,loanPayment:10000,currentAge:30,targetAge:50,targetAssets:10000000,monthlyInvestment:10000};
   for(const[k,v]of Object.entries(inputs))await page.locator(`[name="${k}"]`).fill(String(v));
   await page.locator('#cashRunway').locator('..').locator('.metric-explanation summary').click();const cash=await page.locator('#cashRunway').locator('..').locator('.metric-explanation p').innerText();assert.ok(cash.includes('還差'));assert.ok(cash.includes('個人參考'));
   const payment=page.locator('#health > div').filter({has:page.getByText('每月債務還款 / 月收入',{exact:true})});await payment.locator('.metric-explanation summary').click();assert.ok((await payment.locator('.metric-explanation p').innerText()).includes('45%'));assert.ok((await payment.locator('.metric-explanation p').innerText()).includes('5 個百分點'));
   await page.reload();assert.equal(await page.locator('[name="cash"]').inputValue(),'120000');
   // Record all canvas text: verifies what actually gets drawn, not hidden DOM.
   await page.evaluate(()=>{window.drawn=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...args){window.drawn.push(t);return original.call(this,t,...args);};});
   const downloadPromise=page.waitForEvent('download');await page.locator('#generate-summary').click();const download=await downloadPromise;const buffer=await fs.readFile(await download.path());
   assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(buffer.readUInt32BE(16),1080);assert.equal(buffer.readUInt32BE(20),1350);assert.match(download.suggestedFilename(),/^財務摘要_\d{4}-\d{2}-\d{2}\.png$/);
   await fs.writeFile(path.join(os.tmpdir(),`summary-${name}-${file}.png`),buffer);
   let texts=await page.evaluate(()=>window.drawn);assert.ok(texts.includes('我的財務摘要'));assert.ok(texts.some(t=>t.includes('NT$')));assert.ok(texts.includes('大盤 −20%'));assert.ok(texts.includes('大盤 −30%'));assert.ok(texts.includes('大盤 −50%'));assert.ok(texts.includes('資料為使用者自行輸入之簡化財務估算，不構成投資建議。'));
   assert.equal(await page.locator('#image-status').innerText(),'圖片已產生，所有資料僅在本機處理。');
   await page.locator('#hide-amounts').check();assert.equal(await page.locator('#image-result').isVisible(),false);await page.evaluate(()=>window.drawn=[]);
   const privatePromise=page.waitForEvent('download');await page.locator('#generate-summary').click();const privateDownload=await privatePromise;const privateBuffer=await fs.readFile(await privateDownload.path());await fs.writeFile(path.join(os.tmpdir(),`summary-private-${name}-${file}.png`),privateBuffer);
   texts=await page.evaluate(()=>window.drawn);assert.ok(texts.includes('淨資產完成率'));assert.ok(texts.includes('財務目標完成率'));assert.ok(texts.every(t=>!t.includes('NT$')&&!t.includes('120,000')&&!t.includes('10,000,000')));assert.ok(!texts.some(t=>t.includes('大盤 −')));
   // Seed existing-format monthly snapshots, preserving the schema exactly.
   await page.evaluate(()=>{const key='personal-finance-dashboard.v2';const s=JSON.parse(localStorage.getItem(key));const d=new Date(),month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;d.setMonth(d.getMonth()-1,1);const previous=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;s.snapshots=[{date:previous+'-01',net:1000000,financial:800000,investment:700000,debt:200000,leverage:1.2},{date:month+'-01',net:1100000,financial:900000,investment:750000,debt:200000,leverage:1.3}];localStorage.setItem(key,JSON.stringify(s));});await page.reload();assert.ok((await page.locator('#month-comparison').innerText()).includes('+NT$ 100,000（+10%）'));
   await page.locator('#history-panel > summary').click();const historicPromise=page.waitForEvent('download');await page.locator('.snapshot-summary').first().click();const historic=await historicPromise;await historic.path();texts=await page.evaluate(()=>summaryModel(state.snapshots[0],false));assert.equal(texts.rows[0][1],'NT$ 1,000,000');assert.equal(texts.goal[1][1],'未記錄');assert.equal(texts.stress[0][1],'未記錄');
   // Zero/negative prior net worth should not produce misleading infinite growth rates.
   const monthEdge=await page.evaluate(()=>{const current=localDate().slice(0,7);state.snapshots=[{date:previousMonth(current)+'-01',net:0,financial:0,investment:0,debt:0,leverage:null}];renderMonthComparison();return document.querySelector('#month-comparison').textContent;});assert.ok(monthEdge.includes('不計百分比'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),`summary-ui-${name}-${file}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(base)||r.url.startsWith('blob:')||r.url.startsWith('data:'))));await context.close();console.log(`PASS ${name}: explanations, 1080×1350 PNG, Chinese drawing, private-mode no amounts, reload, old snapshots, monthly comparison, responsive layout, zero outbound requests.`);
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
