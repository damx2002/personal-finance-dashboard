const {harness,devices}=require('./test-utils.cjs'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const h=await harness();try{for(const[device,options]of [['desktop',{}],['android-emulated',devices['Pixel 7']]]){
 const context=await h.browser.newContext(options),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 for(const file of ['index.html','dashboard.html']){
  await page.goto(h.base+file);await page.evaluate(()=>{state=FinanceCore.emptyEnvelope();state.data={...FinanceCore.defaults(),cashDaily:900000,cashEmergency:0,cashInvestmentReserve:700000,cashEarmarked:0,regular:1200000,leveraged:4600000,home:16500000,income:1800000,living:60000,monthlyInvestment:25000,currentAge:39,targetAge:42,targetAssets:10000000,annualReturn:15,allocationGeneral:20,allocationLeveraged:60,allocationReserve:20,debts:[{id:'test',name:'PRIVATE-BANK',type:'personalLoan',balance:12850000,investmentAmount:1100000,annualRate:3,monthlyPayment:57500,remainingMonths:60}]};state.savedAt=new Date().toISOString();paint();});
  const original=await page.evaluate(()=>JSON.stringify(state));
  for(const basis of ['investment','financial']){await page.evaluate(b=>{goalSettings.basis=b;paint();},basis);
   const result=await page.evaluate(()=>({m:summaryModel(null,false),c:calculate(state.data),g:HealthAnalysis.goal(state.data,new Date().getFullYear(),goalSettings.basis)}));
   assert.equal(Object.hasOwn(result.m,'headerGoal'),false);
   assert.equal(result.m.rows[5][1],basis==='investment'?'58%':'74%');
   assert.equal(result.m.goal[0][1],basis==='investment'?'NT$ 5,800,000':'NT$ 7,400,000');
   assert.deepEqual(result.m.rows.map(r=>r[0]),['淨資產','金融資產','現金緩衝','債務月付比','綜合市場槓桿','目標完成率']);
   assert.equal(result.m.rows[2][2],'高於自訂 6 個月門檻');assert.equal(result.m.rows[3][4],'接近自訂 40% 提醒線');assert.equal(result.m.rows[4][4],'高於自訂 2.00x 提醒線');
   assert.equal(result.m.secondary[2][0],'股票 / ETF 投資資產');
   for(let i=0;i<3;i++){const row=result.c.scenarios.find(r=>r.drop===[20,30,50][i]);assert.equal(result.m.stress[i].value,await page.evaluate(n=>money(n),row.net));assert.equal(result.m.stress[i].net,await page.evaluate(({value,base})=>'−'+percent(Math.abs((value-base)/Math.abs(base))),{value:row.net,base:result.c.net}));}
   for(const hide of [false,true])for(const theme of ['light','dark']){
    await page.evaluate(({hide,theme})=>{ui('hide-amounts').checked=hide;setTheme(theme);window.drawn=[];window.bounds=[];if(!window.originalFill){window.originalFill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){drawn.push(String(value));bounds.push({value:String(value),x,y,right:x+this.measureText(value).width,font:this.font});return originalFill.call(this,value,x,y,...rest);};}},{hide,theme});
    const download=page.waitForEvent('download');await page.locator('#generate-summary').click();const event=await download,bytes=await fs.readFile(await event.path());assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);
    const texts=await page.evaluate(()=>drawn),joined=texts.join('\n');
    for(const label of ['我的財務摘要','MY FINANCE','目標完成率','達標所需年化報酬','市場壓力摘要','投資池｜','自訂提醒｜'])assert.ok(joined.includes(label));
    for(const bad of ['目標基準：','警戒線：','投資池配置','現金緩衝月數','達標所需年化報酬率','財務分數','較目前變化','NT$ —','Infinity','NaN','個人財務概覽','目標：約'])assert.ok(!joined.includes(bad),bad);
    assert.equal(texts.filter(x=>x==='達標所需年化報酬').length,1);assert.equal(texts.filter(x=>x.startsWith('投資池｜')).length,1);
    assert.ok(texts.includes('資料依使用者輸入進行簡化估算，不構成投資建議。'));
    if(hide){assert.ok(!joined.includes('NT$'));for(const amount of ['5,800,000','7,400,000','12,850,000','4,200,000'])assert.ok(!joined.includes(amount));assert.ok(!texts.includes('已隱藏'));assert.ok(texts.includes('負債 / 資產'));assert.ok(texts.includes('固定投資前餘裕'));assert.ok(texts.includes('21.67%'));assert.ok(texts.includes('生活與債務支出後'));assert.ok(texts.includes('分享版・金額已隱藏'));assert.ok(texts.some(t=>t.startsWith('整體淨資產 −')));}
    else {assert.ok(joined.includes('NT$ 5,800,000'));assert.equal(texts.filter(t=>t.startsWith('淨資產 NT$')).length,3);assert.equal(texts.filter(t=>t.startsWith('整體 −')).length,3);}
    const overflow=await page.evaluate(()=>bounds.filter(r=>r.x<0||r.right>1021||r.y>1320));assert.deepEqual(overflow,[]);
    if(file==='index.html'&&basis==='investment'&&theme==='light')await fs.writeFile(`/tmp/summary-copy-${device}-${hide}.png`,bytes);
   }
  }
  const checks=await page.evaluate(()=>{
   const saved=structuredClone(state.data),out={};
   state.data.investmentDebt=0; // actual derived debt below remains authoritative
   state.data.debts[0].investmentAmount=state.data.regular+state.data.leveraged;out.invalid=summaryModel(null,false).rows[4];
   state.data=structuredClone(saved);state.data.minRunway=8;out.cashLow=summaryModel(null,false).rows[2][2];state.data.minRunway=7;out.cashNear=summaryModel(null,false).rows[2][2];
   state.data=structuredClone(saved);state.data.maxPaymentRatio=20;out.paymentHigh=summaryModel(null,false).rows[3][4];state.data.maxPaymentRatio=80;out.paymentLow=summaryModel(null,false).rows[3][4];state.data.maxLeverage=4;out.leverageLow=summaryModel(null,false).rows[4][4];state.data.maxLeverage=2.5;out.leverageNear=summaryModel(null,false).rows[4][4];
   state.data=structuredClone(saved);state.data.targetAssets=0;out.noGoal=summaryModel(null,false).goal[1][1];state.data.targetAge=state.data.currentAge;out.noTime=summaryModel(null,false).goal[3][1];
   state.data=structuredClone(saved);state.data.targetAssets=100;out.reached=summaryModel(null,true).rows[5][2];out.surplus=summaryModel(null,false).rows[5][2];
   state.data=structuredClone(saved);out.shareRows=summaryModel(null,true).rows;state.data.income=0;out.zeroIncome=summaryModel(null,true).rows[1][1];state.data.income=-100;out.negativeIncome=summaryModel(null,true).rows[1][1];state.data=structuredClone(saved);state.data.living=200000;out.negativeMargin=summaryModel(null,true).rows[1][1];state.data=structuredClone(saved);
   out.notes=[{kind:'zero'},{kind:'rate',rate:.15},{kind:'rate',rate:.1},{kind:'rate',rate:.07},{kind:'rate',rate:.04}].map(summaryGoalNote);
   const snap={date:'2025-03-01',net:1,financial:2,debt:3,investment:1,leverage:null};out.snapshot=summaryModel(snap,false);state.data=saved;return out;
  });
  assert.deepEqual(checks.shareRows.map(r=>r[0]),['負債 / 資產','固定投資前餘裕','現金緩衝','債務月付比','綜合市場槓桿','目標完成率']);assert.equal(checks.shareRows[0][1],'53.77%');assert.equal(checks.shareRows[1][1],'21.67%');assert.equal(checks.zeroIncome,'—');assert.equal(checks.negativeIncome,'—');assert.equal(checks.negativeMargin,'-71.67%');
  assert.equal(checks.invalid[1],'無法計算有效倍數');assert.equal(checks.cashLow,'低於自訂 8 個月門檻');assert.equal(checks.cashNear,'接近自訂 7 個月門檻');assert.equal(checks.paymentHigh,'高於自訂 20% 提醒線');assert.equal(checks.paymentLow,'低於自訂 80% 提醒線');assert.equal(checks.leverageLow,'低於自訂 4.00x 提醒線');assert.equal(checks.leverageNear,'接近自訂 2.50x 提醒線');assert.equal(checks.noGoal,'未設定');assert.equal(checks.noTime,'尚未設定有效目標時間');assert.equal(checks.reached,'目前已達成設定目標');assert.ok(checks.surplus.startsWith('目前已高於設定目標 NT$'));
  for(const [i,word]of ['不計投資報酬','高於 12%','8%～12%','5%～8%','低於 5%'].entries())assert.ok(checks.notes[i].includes(word));
  assert.equal(checks.snapshot.meta,null);assert.equal(Object.hasOwn(checks.snapshot,'headerGoal'),false);assert.ok(checks.snapshot.stress.every(r=>r.value==='未記錄'));
  await page.evaluate(()=>{const saved=structuredClone(state.data);for(const key of ['cashDaily','cashEmergency','cashInvestmentReserve','cashEarmarked','regular','leveraged','home','other','targetAssets'])state.data[key]=999999999999999;drawn=[];bounds=[];drawSummary(summaryModel(null,false));state.data=saved;});
  assert.deepEqual(await page.evaluate(()=>bounds.filter(r=>r.right>1021||r.y>1320)),[]);
  assert.ok(!(await page.evaluate(()=>drawn.join('\n'))).includes('Infinity'));
  await page.evaluate(()=>{goalSettings.basis='investment';});assert.equal(await page.evaluate(()=>JSON.stringify(state)),original);
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(h.base)||u.startsWith('blob:')||u.startsWith('data:')));await context.close();console.log(`PASS ${device}: PNG copy/layout both HTMLs/themes/bases, full/private no amounts, three reminder states, actual stress deltas, no goals, historic isolation, text bounds, unchanged finance/no outbound requests.`);
}}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
