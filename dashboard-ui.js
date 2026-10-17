'use strict';
// V5 presentation only: consumes existing FinanceCore results, never reads/writes storage.
(()=>{
 const panel=ui('kpi-detail-panel'),triggers=[...document.querySelectorAll('[data-kpi]')];
 const labels={netWorth:'淨資產',financialAssets:'金融資產',cashRunway:'現金緩衝',marketLeverage:'綜合市場槓桿'};
 let active=null;
 function showDetail(key,scroll=false){
  active=key;panel.hidden=!key;
  for(const button of triggers)button.setAttribute('aria-expanded',String(button.dataset.kpi===key));
  for(const section of panel.querySelectorAll('[data-kpi-detail]')){
   section.hidden=section.dataset.kpiDetail!==key;
   if(!section.hidden){const composition=section.querySelector('.kpi-composition');if(composition)composition.open=true;}
  }
  ui('kpi-detail-title').textContent=key?labels[key]+' · 組成與判讀':'';
  if(scroll&&key)panel.scrollIntoView({block:'nearest'});
 }
 for(const button of triggers)button.addEventListener('click',()=>showDetail(active===button.dataset.kpi?null:button.dataset.kpi,true));
 ui('close-kpi-detail').addEventListener('click',()=>{const prior=active;showDetail(null);triggers.find(button=>button.dataset.kpi===prior)?.focus({preventScroll:true});});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();ui('close-kpi-detail').click();}});
 function fitNumbers(){
  for(const key of Object.keys(labels)){
   const el=ui(key);el.style.fontSize='';if(!el.clientWidth)continue;
   const range=document.createRange();range.selectNodeContents(el);const width=range.getBoundingClientRect().width;
   if(width>el.clientWidth)el.style.fontSize=Math.max(10,Math.floor(parseFloat(getComputedStyle(el).fontSize)*el.clientWidth/width))+'px';
  }
 }
 const reviewTitles={
  'cashflow-positive':'生活與債務支出後仍有餘裕','cashflow-negative':'生活與債務支出高於收入',
  'runway-ok':'現金緩衝高於自訂門檻','runway-low':'現金緩衝低於自訂門檻','runway-near':'現金緩衝接近自訂門檻',
  'payment-high':'債務月付比高於自訂提醒','payment-near':'債務月付比接近自訂提醒','payment-no-income':'目前無法計算債務月付比',
  'leverage-high':'綜合市場槓桿高於自訂提醒','leverage-near':'綜合市場槓桿接近自訂提醒','leverage-no-equity':'投資淨值不大於零',
  'stress-negative':'−30% 情境的投資淨值為負','required-high':'目標所需報酬高於 12% 情境','goal-accessible':'目標所需報酬位於比較情境內','limits-ok':'目前未超過主要自訂提醒'
 };
 function polishReview(c,d,g){
  const brief={
   'cashflow-positive':`固定投資前 ${money(c.balance+d.monthlyInvestment)}；投資後 ${money(c.balance)}。`,
   'cashflow-negative':`固定投資前 ${money(c.balance+d.monthlyInvestment)}；投資後 ${money(c.balance)}。`,
   'runway-ok':`目前 ${decimal.format(c.runway)} 個月；自訂門檻 ${decimal.format(d.minRunway)} 個月。`,
   'runway-low':`目前 ${decimal.format(c.runway)} 個月；自訂門檻 ${decimal.format(d.minRunway)} 個月。`,
   'runway-near':`目前 ${decimal.format(c.runway)} 個月；自訂門檻 ${decimal.format(d.minRunway)} 個月。`,
   'payment-high':`目前 ${percent(c.paymentRatio)}；自訂提醒 ${decimal.format(d.maxPaymentRatio)}%。`,
   'payment-near':`目前 ${percent(c.paymentRatio)}；自訂提醒 ${decimal.format(d.maxPaymentRatio)}%。`,
   'leverage-high':`目前 ${multiple(c.leverage)}；自訂提醒 ${multiple(d.maxLeverage)}。`,
   'leverage-near':`目前 ${multiple(c.leverage)}；自訂提醒 ${multiple(d.maxLeverage)}。`,
   'required-high':`達標所需年化報酬 ${requiredReturnText(g.required)}，僅為數學情境。`,
   'goal-accessible':`達標所需年化報酬 ${requiredReturnText(g.required)}，不保證未來結果。`
  };
  for(const li of document.querySelectorAll('#review-positive [data-review-id],#review-warnings [data-review-id]')){
   if(li.querySelector('strong'))continue;
   const id=li.dataset.reviewId,original=li.textContent,title=document.createElement('strong'),p=document.createElement('p');
   title.textContent=reviewTitles[id]||original.split('。')[0];p.textContent=brief[id]||original;
   li.replaceChildren(title,p);if(brief[id]){const details=document.createElement('details'),summary=document.createElement('summary'),full=document.createElement('p');summary.textContent='完整說明';full.textContent=original;details.append(summary,full);li.append(details);}
   li.classList.add('review-item');if(li.closest('#review-warnings'))li.dataset.tone=id.endsWith('-near')||id==='required-high'?'caution':'danger';
  }
 }
 function render(){
  const d=FinanceCore.derived(state.data),c=calculate(d),g=HealthAnalysis.goal(state.data,new Date().getFullYear(),goalSettings.basis),allocation=FinanceCore.allocation(state.data);
  ui('goal-headline-progress').textContent=percent(g.completion);
  ui('goal-current-label').textContent='目前'+g.basisLabel;ui('goal-target-label').textContent='目標'+g.basisLabel;
  ui('goal-current').textContent=money(g.currentGoalAssets);ui('goal-target').textContent=g.target>0?money(g.target):'尚未設定';
  ui('goal-return-badge').hidden=!(g.required.kind==='aboveRange'||g.required.kind==='rate'&&g.required.rate>.12);
  ui('allocation-caution').hidden=!FinanceCore.allocationConsistency(state.data).conflict;
  const target=ui('allocation-target-bar');target.hidden=!allocation.valid;target.replaceChildren();
  if(allocation.valid)allocation.weights.forEach((weight,i)=>{const part=document.createElement('span');part.className=`asset-${i}`;part.style.width=weight+'%';target.append(part);});
  for(const key of ['netWorth','cashRunway','marketLeverage']){
   const badge=ui(key).closest('.kpi').querySelector('.status-badge');if(!badge)continue;
   badge.textContent=key==='netWorth'?'淨資產為負':key==='cashRunway'?`${badge.classList.contains('danger')?'低於':'接近'} ${decimal.format(d.minRunway)} 個月提醒`:c.leverage===null?'暫無有效倍數':`${badge.classList.contains('danger')?'高於':'接近'} ${d.maxLeverage.toFixed(2)}x 提醒`;
  }
  polishReview(c,d,g);showDetail(active);fitNumbers();
 }
 // Keep all five model rows and their order on desktop. Mobile promotes 20/30/50, with 10/40 on request.
 const stressPanel=document.querySelector('.stress'),toggle=document.createElement('button');toggle.type='button';toggle.id='more-stress';toggle.className='text-button';toggle.textContent='查看更多情境（−10%／−40%）';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','scenarios');
 stressPanel.querySelector('.stress-table-wrap').after(toggle);
 toggle.addEventListener('click',()=>{const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));stressPanel.classList.toggle('show-all-stress',expanded);toggle.textContent=expanded?'收合額外情境':'查看更多情境（−10%／−40%）';});
 document.querySelectorAll('.field-level').forEach(el=>el.dataset.level=el.textContent.trim());
 window.addEventListener('finance-render',render);window.addEventListener('resize',fitNumbers);window.addEventListener('finance-layout',fitNumbers);document.fonts.ready.then(fitNumbers);render();
})();
