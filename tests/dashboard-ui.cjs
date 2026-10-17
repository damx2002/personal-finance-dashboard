const {harness,devices}=require('./test-utils.cjs'),assert=require('node:assert/strict');
(async()=>{const h=await harness();try{
 for(const width of [360,390,412,1280,1440,1920]){
  const mobile=width<700,context=await h.browser.newContext({...mobile?devices['Pixel 7']:{},viewport:{width,height:mobile?844:1000},reducedMotion:'reduce'}),p=await context.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({method:r.method(),url:r.url()}));
  for(const file of ['index.html','dashboard.html']){
   await p.goto(h.base+file);await p.evaluate(()=>{state=FinanceCore.emptyEnvelope();state.data={...FinanceCore.defaults(),cashDaily:900000,cashInvestmentReserve:700000,regular:1200000,leveraged:4600000,home:15000000,income:1800000,living:60000,monthlyInvestment:25000,currentAge:39,targetAge:42,targetAssets:10000000,annualReturn:15,allocationGeneral:20,allocationLeveraged:60,allocationReserve:20,debts:[{id:'loan',name:'測試信貸',type:'personalLoan',balance:1100000,investmentAmount:1100000,annualRate:3,monthlyPayment:57500,remainingMonths:60}]};state.savedAt='2026-10-17T12:34:00Z';paint();});
   const model=await p.evaluate(()=>JSON.stringify({state,calculated:calculate(state.data)})),storage=await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
   const order=await p.evaluate(()=>{const selectors=['.kpis','.goals','.financial-review','.allocation-home','#health-panel','#investment-panel','.stress','#lab-entry','#analysis-panel','#completeness-panel','#history-panel','#data-tools'];return selectors.every((s,i)=>i===0||!!(document.querySelector(selectors[i-1]).compareDocumentPosition(document.querySelector(s))&Node.DOCUMENT_POSITION_FOLLOWING));});assert.equal(order,true);
   assert.ok((await p.locator('#saved-at').innerText()).startsWith('最後更新：2026/10/17'));
   assert.equal(await p.locator('#privacy-details').getAttribute('open'),null);assert.equal(await p.locator('#kpi-detail-panel').isVisible(),false);
   assert.equal(await p.locator('#month-comparison').isVisible(),false);assert.equal(await p.locator('.kpi .metric-explanation,.kpi .kpi-composition').count(),0);
   assert.equal(await p.locator('#goal-overview-details').getAttribute('open'),null);assert.equal(await p.locator('#goal-flex').getAttribute('open'),null);assert.equal(await p.locator('#stress-controls').getAttribute('open'),null);
   for(const mode of ['light','dark']){
    await p.evaluate(mode=>setTheme(mode),mode);
    const accessibility=await p.evaluate(()=>{
     const root=getComputedStyle(document.documentElement),probe=document.createElement('span');document.body.append(probe);
     const rgb=value=>{probe.style.color=value;return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0,3).map(Number);};
     const lightness=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
     const contrast=(a,b)=>{const x=lightness(rgb(a)),y=lightness(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
     const ratios=[contrast(root.getPropertyValue('--text'),root.getPropertyValue('--card')),contrast(root.getPropertyValue('--muted'),root.getPropertyValue('--soft')),contrast(root.getPropertyValue('--interactive'),root.getPropertyValue('--soft')),contrast('#ffffff',root.getPropertyValue('--button'))];probe.remove();
     return {ratios,smallButtons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().height<44).map(e=>e.id||e.textContent)};
    });assert.ok(accessibility.ratios.every(x=>x>=4.5));assert.deepEqual(accessibility.smallButtons,[]);
    const cards=await p.locator('.kpi').evaluateAll(a=>a.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
    assert.ok(cards.every(c=>c.height===cards[0].height));assert.equal(cards[0].y,cards[1].y);assert.equal(cards[2].y,mobile?cards[3].y:cards[0].y);if(mobile)assert.ok(cards[2].y>cards[0].y);
    for(const key of ['netWorth','financialAssets','cashRunway','marketLeverage']){
     const trigger=p.locator(`[data-kpi="${key}"]`);await trigger.focus();await trigger.press('Enter');assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.equal(await p.locator('#kpi-detail-panel').isVisible(),true);assert.equal(await p.locator('#detail-'+key).isVisible(),true);
     assert.equal(await p.locator('[data-kpi][aria-expanded="true"]').count(),1);assert.ok((await p.locator('#kpi-detail-title').innerText()).includes(key==='cashRunway'?'現金緩衝':key==='marketLeverage'?'綜合市場槓桿':key==='netWorth'?'淨資產':'金融資產'));
     assert.deepEqual(await p.locator('.kpi').evaluateAll(a=>a.map(e=>e.getBoundingClientRect().height)),cards.map(c=>c.height));
    }
    await p.locator('#close-kpi-detail').click();assert.equal(await p.locator('#kpi-detail-panel').isVisible(),false);assert.equal(await p.locator('[data-kpi="marketLeverage"]').evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('[data-kpi][aria-expanded="true"]').count(),0);
    assert.equal(await p.locator('#goal-headline-progress').innerText(),'58%');assert.equal(await p.locator('#goal-current').innerText(),'NT$ 5,800,000');assert.equal(await p.locator('#goal-target').innerText(),'NT$ 10,000,000');assert.equal(await p.locator('#goal-return-badge').isVisible(),true);assert.equal(await p.locator('#allocation-caution').isVisible(),true);
    assert.ok(await p.locator('.goals').evaluate(e=>e.getBoundingClientRect().height<720));
    if(mobile){assert.equal(await p.locator('#scenarios tr:visible').count(),3);assert.deepEqual(await p.locator('#scenarios tr:visible').evaluateAll(a=>a.map(e=>Number(e.dataset.drop))),[20,30,50]);await p.locator('#more-stress').click();assert.equal(await p.locator('#scenarios tr:visible').count(),5);assert.equal(await p.locator('#more-stress').getAttribute('aria-expanded'),'true');await p.locator('#more-stress').click();}
    else assert.equal(await p.locator('#scenarios tr:visible').count(),5);
    assert.ok(await p.locator('.stress-table-wrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await p.locator('.primary-button').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    if(file==='index.html'&&(width===390||width===1440)){
     await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`/tmp/v5-${width}-${mode}.png`});await p.locator('.goals').screenshot({path:`/tmp/v5-goal-${width}-${mode}.png`});await p.locator('.financial-review').screenshot({path:`/tmp/v5-review-${width}-${mode}.png`});await p.locator('.stress').screenshot({path:`/tmp/v5-stress-${width}-${mode}.png`});
    }
   }
   assert.equal(await p.evaluate(()=>JSON.stringify({state,calculated:calculate(state.data)})),model);assert.equal(await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))),storage);
   const snapshotChecks=await p.evaluate(()=>{const s={date:'2026-08-01',net:1000000,financial:500000,investment:100000,debt:200000,leverage:1};state.snapshots=[s];renderMonthComparison();const one=ui('month-comparison').hidden;state.snapshots.push({...s,date:'2026-10-01',net:1100000,financial:600000,debt:180000});renderMonthComparison();return {one,two:ui('month-comparison').hidden,text:ui('month-comparison').textContent};});assert.equal(snapshotChecks.one,true);assert.equal(snapshotChecks.two,false);assert.ok(snapshotChecks.text.includes('2026/08'));assert.ok(snapshotChecks.text.includes('淨資產 +10%'));assert.ok(snapshotChecks.text.includes('金融資產 +20%'));assert.ok(snapshotChecks.text.includes('總負債 −10%'));
   await p.evaluate(()=>{state.snapshots[0].net=0;renderMonthComparison();});assert.ok((await p.locator('#month-comparison').innerText()).includes('基期為零'));
   await p.locator('#edit-finances').click();assert.equal(await p.locator('#mobile-edit').isVisible(),false);await p.locator('[name="living"]').focus();assert.equal(await p.locator('#wizard').evaluate(e=>e.contains(document.activeElement)),true);await p.keyboard.press('Tab');assert.equal(await p.locator('#wizard').evaluate(e=>e.contains(document.activeElement)),true);assert.ok(await p.locator('.wizard-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.locator('#close-wizard').click();
   await p.locator('#open-lab').click();assert.equal(await p.locator('#mobile-edit').isVisible(),false);await p.locator('#close-lab').click();await p.locator('#generate-ai').click();assert.equal(await p.locator('#mobile-edit').isVisible(),false);assert.ok(await p.locator('#ai-output').evaluate(e=>e.clientWidth>(innerWidth<700?innerWidth*.75:300)));await p.locator('#close-ai').click();
   await p.evaluate(()=>{for(const key of ['cashDaily','regular','leveraged','home'])state.data[key]=999999999999999;paint();});assert.ok(await p.locator('.kpi strong').evaluateAll(a=>a.every(e=>e.scrollWidth<=e.clientWidth+1)));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(h.base)||r.url.startsWith('blob:')||r.url.startsWith('data:'))));await context.close();console.log(`PASS V5 ${width}px: both HTMLs, themes, reading order, stable 4/2 KPI grid/shared details/ARIA/focus, snapshot thresholds/deltas, mobile stress, dialogs/touch/overflow, reduced motion, unchanged data and privacy.`);
 }
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
