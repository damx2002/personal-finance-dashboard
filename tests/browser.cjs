// Run: node tests/browser.cjs (requires Playwright and Chromium in the test environment).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const key = 'personal-finance-dashboard.v2';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const launch = { executablePath, headless:true, args:['--no-sandbox'] };
const format = value => 'NT$ '+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(value);
async function main() {
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    requests.push({method:req.method,url:req.url});
    const name=req.url.split('?')[0].replace(/^\/personal-finance-dashboard\//,'') || 'index.html';
    if(!['index.html','dashboard.html','style.css','app.js','summary.js'].includes(name)){res.writeHead(404);res.end();return;}
    try { const content=await fs.readFile(path.join(root,name));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(content); }
    catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/personal-finance-dashboard/`;
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'finance-persistence-'));
  let context;
  const failures=[]; const allNetwork=[];
  const instrument=c=>{c.on('page',p=>p.on('pageerror',e=>failures.push(e.message)));c.on('request',r=>allNetwork.push({url:r.url(),method:r.method()}));return c;};
  try {
    for(const file of ['index.html','dashboard.html']) {
      context=instrument(await chromium.launchPersistentContext(path.join(profile,file),launch));
      let page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
      const network=[];page.on('request',r=>network.push({url:r.url(),method:r.method()}));
      await page.goto(base+file);
      await page.evaluate(()=>localStorage.clear());await page.reload();
      assert.deepEqual(await page.locator('.kpi > span:first-child').allTextContents(),['淨資產','金融資產','現金緩衝月數','綜合市場槓桿']);
      assert.equal(await page.locator('#auth-form').count(),0);
      assert.ok((await page.locator('.privacy-note').innerText()).includes('所有財務資料僅儲存在此裝置瀏覽器，不會上傳至伺服器。'));
      await page.locator('.inputs summary').click();
      const fill=async(n,v)=>page.locator(`[name="${n}"]`).fill(String(v));
      const data={cash:600000,home:10000000,other:100000,mortgage:6000000,loan:500000,investmentDebt:300000,income:1200000,living:20000,mortgagePayment:25000,loanPayment:5000,monthlyInvestment:10000,regular:800000,leveraged:200000,multiplier:2,currentAge:30,targetAge:50,targetAssets:10000000,annualReturn:7};
      for(const[k,v]of Object.entries(data))await fill(k,v);
      const settings=page.locator('details').filter({has:page.locator('#settings-form')});await settings.locator('summary').click();
      await fill('minRunway',8);await fill('maxPaymentRatio',45);await fill('maxLeverage',2.5);
      assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      assert.equal(await page.locator('#financialAssets').innerText(),'NT$ 1,600,000');
      assert.equal(await page.locator('#cashRunway').innerText(),'12 個月');
      assert.equal(await page.locator('#marketLeverage').innerText(),'1.71x');
      assert.ok((await page.locator('#save-status').innerText()).includes('資料已儲存'));
      assert.notEqual(await page.locator('#saved-at').innerText(),'最後儲存：—');
      await page.locator('details').filter({has:page.locator('#return-scenarios')}).locator('summary').click();
      const scenarioValues=await page.locator('#return-scenarios strong').allTextContents();
      for(const [i,rate]of [5,8,12,7].entries()) {
        const r=(1+rate/100)**(1/12)-1;let v=1600000;for(let m=0;m<240;m++)v=v*(1+r)+10000;
        assert.equal(scenarioValues[i],format(v));
      }
      assert.ok((await page.locator('#break-even').innerText()).includes('62.5%'));
      assert.deepEqual(await page.locator('#scenarios tr').last().locator('td').allTextContents(),['-50%','NT$ 400,000','NT$ 100,000','NT$ 4,600,000']);
      await page.locator('#history-panel > summary').click();
      await page.locator('#snapshot-date').fill('2026-09-01');await page.locator('#save-snapshot').click();
      await page.locator('#snapshot-date').fill('2026-10-01');await page.locator('#save-snapshot').click();
      assert.equal(await page.locator('#snapshot-rows tr').count(),2);assert.equal(await page.locator('.history-svg circle').count(),2);
      page.once('dialog',d=>d.dismiss());await page.locator('#save-snapshot').click();assert.equal(await page.locator('#snapshot-rows tr').count(),2);
      const original=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
      await page.reload();assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      await page.close();page=await context.newPage();await page.goto(base+file);assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      await context.close();context=instrument(await chromium.launchPersistentContext(path.join(profile,file),launch));page=await context.newPage();await page.goto(base+file);
      assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');assert.equal(await page.locator('[name="minRunway"]').inputValue(),'8');assert.equal(await page.locator('#snapshot-rows tr').count(),2);
      const utilities=page.locator('details').filter({has:page.locator('#settings-form')});await utilities.locator('summary').click();
      const downloaded=page.waitForEvent('download');await page.locator('#export-data').click();const download=await downloaded;const filePath=await download.path();const backup=JSON.parse(await fs.readFile(filePath,'utf8'));
      assert.deepEqual(backup,original);
      // Cancel the first and second clear confirmation independently.
      page.once('dialog',d=>d.dismiss());await page.locator('#clear-data').click();assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      let dialogCount=0;const cancelSecond=d=>{dialogCount++;dialogCount===1?d.accept():d.dismiss();};page.on('dialog',cancelSecond);await page.locator('#clear-data').click();page.off('dialog',cancelSecond);assert.equal(dialogCount,2);assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      const accept=d=>d.accept();page.on('dialog',accept);await page.locator('#clear-data').click();page.off('dialog',accept);assert.equal(await page.locator('#netWorth').innerText(),'NT$ 0');assert.equal(await page.locator('#snapshot-rows tr').count(),0);
      // Invalid JSON and a cancelled import must never overwrite existing state.
      await page.locator('#import-data').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});await page.waitForFunction(()=>document.querySelector('#data-message').textContent.includes('匯入失敗'));
      page.once('dialog',d=>d.dismiss());await page.locator('#import-data').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.querySelector('#data-message').textContent.includes('已取消匯入'));assert.equal(await page.locator('#netWorth').innerText(),'NT$ 0');
      page.once('dialog',d=>d.accept());await page.locator('#import-data').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.querySelector('#data-message').textContent.includes('匯入完成'));
      const restored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.deepEqual(restored.data,original.data);assert.deepEqual(restored.snapshots,original.snapshots);assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');
      // Draft edits survive reload, while calculations keep the last valid state.
      await page.locator('.inputs summary').click();await fill('investmentDebt',600000);assert.ok((await page.locator('#save-status').innerText()).includes('草稿'));await page.reload();assert.equal(await page.locator('[name="investmentDebt"]').inputValue(),'600000');assert.equal(await page.locator('#netWorth').innerText(),'NT$ 5,200,000');await page.locator('.inputs summary').click();await fill('investmentDebt',300000);
      // Custom warnings turn off again when the value returns to the configured range.
      const settings2=page.locator('details').filter({has:page.locator('#settings-form')});await settings2.locator('summary').click();await fill('minRunway',15);assert.ok((await page.locator('#cashRunway').getAttribute('class')).includes('danger'));await fill('minRunway',10);assert.ok((await page.locator('#cashRunway').getAttribute('class')).includes('caution'));await fill('minRunway',8);assert.equal(await page.locator('#cashRunway').getAttribute('class'),'');
      // A quota/security error leaves last successful save time unchanged and warns visibly.
      const lastTime=await page.locator('#saved-at').innerText();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});await fill('cash',700000);assert.ok(await page.locator('#storage-warning').isVisible());assert.equal(await page.locator('#saved-at').innerText(),lastTime);
      await page.reload();assert.equal(await page.locator('[name="cash"]').inputValue(),'600000');
      await page.setViewportSize({width:390,height:844});await page.locator('#history-panel > summary').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(os.tmpdir(),`finance-${file}-mobile.png`),fullPage:true});
      for(const r of network){assert.equal(r.method,'GET');assert.ok(r.url.startsWith(base)||r.url.startsWith('data:'));}
      // Upgrade the old flat v1 format without losing any existing financial values.
      await page.evaluate(()=>{localStorage.removeItem('personal-finance-dashboard.v2');localStorage.setItem('personal-finance-dashboard.v1',JSON.stringify({cash:123456,multiplier:2,monthlyInvestment:2000}));});
      await page.reload();assert.equal(await page.locator('#financialAssets').innerText(),'NT$ 123,456');assert.equal(await page.locator('[name="monthlyInvestment"]').inputValue(),'2000');assert.equal(await page.locator('[name="minRunway"]').inputValue(),'6');
      assert.ok(await page.evaluate(()=>localStorage.getItem('personal-finance-dashboard.v1')!==null));
      // Read permission failures and corrupt data must not be silently reported as saved.
      await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError');};});await page.reload();assert.ok(await page.locator('#storage-warning').isVisible());
      await context.close();context=null;
      console.log(`PASS ${file}: input → refresh → close tab → restart browser → export → double-confirm clear → import → full recovery; drafts, scenarios, snapshots, warnings, quota failure, mobile.`);
    }
    assert.deepEqual(failures,[]);
    assert.ok(allNetwork.every(r=>r.method==='GET' && (r.url.startsWith(base)||r.url.startsWith('data:'))));
    assert.ok(requests.every(r=>r.method==='GET'&&!r.url.includes('600000')));
    console.log('PASS: all network requests are static GET resources; no finance data uploads.');
  } finally {if(context)await context.close();await new Promise(r=>server.close(r));await fs.rm(profile,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
