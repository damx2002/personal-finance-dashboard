'use strict';
// Explanations and image rendering use only existing local data; no network calls.
const THEME_KEY='personal-finance-dashboard.theme';
function setTheme(theme, save=false) {
  document.documentElement.dataset.theme=theme==='dark'?'dark':'light';
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===document.documentElement.dataset.theme)));
  if(save)try{localStorage.setItem(THEME_KEY,document.documentElement.dataset.theme);ui('theme-status').hidden=true;}catch{ui('theme-status').hidden=false;ui('theme-status').textContent='外觀已切換，但瀏覽器無法保存偏好。';}
}
try{setTheme(localStorage.getItem(THEME_KEY)||'light');}catch{setTheme('light');}
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.themeChoice,true)));
window.addEventListener('storage',event=>{if(event.key===THEME_KEY)setTheme(event.newValue||'light');});
function addExplanation(host, text, brief, status='') {
  if (!host) return;
  const old=host.querySelector('.metric-explanation');
  const sameStatus=old?.dataset.status===status;
  const wasOpen=old?.querySelector('.reason-accordion')?.open;
  const fullOpen=old?.querySelector('.full-explanation')?.open;
  old?.remove();
  const wrapper=document.createElement('div');wrapper.className='metric-explanation';wrapper.dataset.status=status;
  const details=document.createElement('details');details.className='reason-accordion';details.open=sameStatus?wasOpen:!!status;
  const control=document.createElement('summary');control.textContent='ⓘ 查看原因與建議';
  const short=document.createElement('p');short.className='explanation-brief';short.textContent=brief;
  const full=document.createElement('details');full.className='full-explanation';full.open=!!fullOpen;
  const summary=document.createElement('summary');summary.textContent='查看完整說明';
  const p=document.createElement('p');p.className='explanation-detail';p.textContent=text;
  full.append(summary,p);details.append(control,short,full);wrapper.append(details);host.append(wrapper);
}
function explainMetrics() {
  const d=FinanceCore.derived(state.data),c=calculate(d), personal='警戒線是你自行設定的個人參考，並非通用安全值。';
  let cash=c.runway===null?'目前沒有生活與債務支出，無法估算現金緩衝月數。':`目前現金可支撐 ${decimal.format(c.runway)} 個月生活費與債務還款。你的最低門檻為 ${decimal.format(d.minRunway)} 個月，${c.runway<d.minRunway?`還差 ${decimal.format(d.minRunway-c.runway)} 個月。生活緩衝僅採勾選的現金分類。若收入中斷，流動性可能較不足，可優先累積現金或檢視固定支出。`:`高於或等於門檻 ${decimal.format(c.runway-d.minRunway)} 個月。${c.runway<=d.minRunway*1.2?'目前仍符合最低門檻，但緩衝不算寬裕，可優先維持現金部位。':'可依收入穩定度與家庭支出，定期檢視現金需求。'}`}`;
  const cashStatus=ui('cashRunway').classList.contains('danger')?'danger':ui('cashRunway').classList.contains('caution')?'caution':'';
  const cashBrief=c.runway===null?'目前無支出，暫不計算緩衝月數。':`現金可支撐 ${decimal.format(c.runway)} 個月，${c.runway<d.minRunway?`比 ${decimal.format(d.minRunway)} 個月門檻還差 ${decimal.format(d.minRunway-c.runway)} 個月，可優先補足現金。`:`高於最低 ${decimal.format(d.minRunway)} 個月門檻 ${decimal.format(c.runway-d.minRunway)} 個月，可優先維持現金部位。`}`;
  addExplanation(ui('cashRunway').closest('.kpi'),cash+' '+personal,cashBrief,cashStatus);
  let leverage='此數值同時考慮槓桿 ETF 與投資用途借款。數值愈高，市場漲跌對投資淨值的影響愈大。';
  leverage+=c.leverage===null?' 目前投資淨值不大於零或尚無投資，無法計算有效倍數；可先檢視借款與投資淨值。':` 目前為 ${multiple(c.leverage)}，你的警戒線為 ${multiple(d.maxLeverage)}，${c.leverage>d.maxLeverage?`高出 ${multiple(c.leverage-d.maxLeverage)}。目前槓桿已高於自訂警戒線，市場大幅下跌時投資淨值波動會被進一步放大，可優先檢視借款或槓桿 ETF 比重；借款仍需按期還款，也要預留現金流。`:`距離上限還有 ${multiple(d.maxLeverage-c.leverage)}。${c.leverage>=d.maxLeverage*.8?'目前接近自訂警戒線，可優先保留調整曝險的空間。':'可定期檢視曝險與可承受波動。'}`}`;
  const leverageStatus=ui('marketLeverage').classList.contains('danger')?'danger':ui('marketLeverage').classList.contains('caution')?'caution':'';
  const leverageBrief=c.leverage===null?'投資淨值不大於零或尚無投資，暫不計算有效倍數，可先核對借款。':`目前 ${multiple(c.leverage)}，${c.leverage>d.maxLeverage?`高於 ${multiple(d.maxLeverage)} 上限 ${multiple(c.leverage-d.maxLeverage)}，可優先檢視借款與曝險。`:`距 ${multiple(d.maxLeverage)} 警戒線還有 ${multiple(d.maxLeverage-c.leverage)}，可保留調整空間。`}`;
  addExplanation(ui('marketLeverage').closest('.kpi'),leverage+' '+personal,leverageBrief,leverageStatus);
  function row(label){return [...ui('health').children,...ui('investment').children].find(r=>r.querySelector('dt')?.textContent===label);}
  const debt=c.debtRatio===null?'目前總資產為零，無法計算負債 / 資產比例。':`目前總負債約占總資產 ${percent(c.debtRatio)}。`;
  addExplanation(row('負債 / 資產比例'),debt+'此指標需搭配房貸、收入穩定度與資產流動性一起判斷，不應單獨視為好或壞。目前未設定此項警戒線；固定還款會影響每月現金流，可先區分負債用途及可變現資產。',debt+'可搭配收入與資產流動性一起判斷。');
  const payment=c.paymentRatio===null?'目前月收入為零，無法計算比例；如仍有還款，可優先盤點現金來源。':`目前每月約有 ${percent(c.paymentRatio)} 的收入用於償還房貸與信貸。${c.paymentRatio>d.maxPaymentRatio/100?'高於':'距離'}你的警戒線 ${decimal.format(Math.abs(c.paymentRatio*100-d.maxPaymentRatio))} 個百分點。`;
  const paymentRow=row('每月債務還款 / 月收入');
  const paymentStatus=paymentRow?.querySelector('dd')?.classList.contains('danger')?'danger':paymentRow?.querySelector('dd')?.classList.contains('caution')?'caution':'';
  addExplanation(paymentRow,payment+` 你的警戒線：${decimal.format(d.maxPaymentRatio)}%。固定債務支出占比愈高，每月可調整的現金流空間愈小，可優先檢視還款安排與必要支出。 `+personal,payment+' 可優先檢視固定還款安排。',paymentStatus);
  addExplanation(row('投資用途負債 / 投資市值'),c.investmentDebtRatio===null?'目前沒有投資市值，無法計算借款占比；可先核對投資用途借款。':`目前投資資產中約 ${percent(c.investmentDebtRatio)} 是由借款支撐。市場下跌時，投資市值會下降，但貸款本金不會同步下降。此項未設定警戒線，可搭配綜合槓桿，優先檢視借款規模與還款來源。`,c.investmentDebtRatio===null?'目前無投資市值，暫不計算借款占比。':`約 ${percent(c.investmentDebtRatio)} 投資由借款支撐，下跌時貸款本金不會同步減少。`);
  renderMonthComparison();
}
function previousMonth(month) {
  const [year,m]=month.split('-').map(Number);return `${m===1?year-1:year}-${String(m===1?12:m-1).padStart(2,'0')}`;
}
function renderMonthComparison() {
  const month=localDate().slice(0,7), previous=state.snapshots.find(s=>s.date.slice(0,7)===previousMonth(month));
  const current=state.snapshots.find(s=>s.date.slice(0,7)===month);
  const target=ui('month-comparison');target.hidden=!previous;
  if(!previous)return;
  const net=current?current.net:calculate(state.data).net,diff=net-previous.net;
  const rate=previous.net>0?`${diff>=0?'+':''}${percent(diff/previous.net)}`:'上月淨資產不大於零，不計百分比';
  target.textContent=`本月相較上月：淨資產 ${diff>=0?'+':''}${money(diff)}（${rate}） · ${current?'比較本月與上月快照':'以目前數值與上月快照比較'}`;
}
let summaryURL=null;
let summaryBusy=false;
function summaryModel(snapshot, hide) {
  const d=FinanceCore.derived(state.data),c=calculate(d), s=snapshot;
  const date=s?s.date:localDate();
  const financial=s?s.financial:c.financial,net=s?s.net:c.net,debt=s?s.debt:c.debt,assets=s?s.net+s.debt:c.assets;
  const goal=s?null:(d.targetAssets>0?d.targetAssets:null);
  const unavailable='未記錄';
  const rows=hide?[
    ['淨資產完成率',goal?percent(net/goal):s?unavailable:'未設定目標'],
    ['負債 / 資產',percent(assets>0?debt/assets:null)],
    ['債務還款 / 月收入',s?unavailable:percent(c.paymentRatio)],
    ['現金緩衝月數',s?unavailable:c.runway===null?'—':`${decimal.format(c.runway)} 個月`],
    ['綜合市場槓桿',multiple(s?s.leverage:c.leverage)],
    ['財務目標完成率',goal?percent(financial/goal):s?unavailable:'未設定目標']
  ]:[
    ['淨資產',money(net)],['金融資產',money(financial)],['總資產',money(assets)],['總負債',money(debt)],
    ['現金緩衝月數',s?unavailable:c.runway===null?'—':`${decimal.format(c.runway)} 個月`],
    ['每月債務還款 / 月收入',s?unavailable:percent(c.paymentRatio)],
    ['投資總市值',money(s?s.investment:c.investment)],['綜合市場槓桿',multiple(s?s.leverage:c.leverage)]
  ];
  return {date,hide,demo:demoActive,snapshot:!!s,meta:s?null:{allocation:FinanceCore.allocation(state.data),required:FinanceCore.requiredReturn(state.data),goal:HealthAnalysis.goal(state.data,new Date().getFullYear()),stressLabel:StressCore.label(stressSettings)},rows,goal:hide?[]:[['目前金融資產',money(financial)],['目標金融資產',goal?money(goal):s?unavailable:'未設定'],['完成率',goal?percent(financial/goal):s?unavailable:'—'],['目標年齡',s?unavailable:goal?`${d.targetAge} 歲`:'未設定']],stress:hide?[]:[20,30,50].map(drop=>[`大盤 −${drop}%`,s?unavailable:c.scenarios.find(r=>r.drop===drop).ok?money(c.scenarios.find(r=>r.drop===drop).net):'無有效示意路徑']),notes:s?['歷史快照未記錄現金流、目標與壓力情境，缺項標示未記錄。','總資產以快照淨資產加總負債還原，未混用目前資料。']:hide?['淨資產完成率 = 淨資產 ÷ 目標金融資產（參考同一目標）。','財務目標完成率 = 金融資產 ÷ 目標金融資產。']:['現金、目標與市場情境均依目前有效輸入估算。']};
}
function drawSummary(model) {
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('此瀏覽器無法產生圖片');
  const dark=document.documentElement.dataset.theme==='dark';
  const palette=dark?{bg:'#101e1a',panel:'#1a2b25',text:'#e1ece5',muted:'#adc3b5',line:'#334d40',accent:'#b4d9be'}:{bg:'#f4f7f5',panel:'#ffffff',text:'#24332d',muted:'#718078',line:'#d9e4de',accent:'#5e8f7a'};
  const text=(value,x,y,size=28,color=palette.text,weight=400,maxWidth)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Noto Sans CJK TC", "Noto Sans CJK JP", "Microsoft JhengHei", sans-serif`;let actual=size;if(maxWidth){while(ctx.measureText(value).width>maxWidth&&actual>12){actual--;ctx.font=`${weight} ${actual}px "Noto Sans CJK TC", "Noto Sans CJK JP", "Microsoft JhengHei", sans-serif`;}}ctx.fillText(value,x,y);};
  const box=(x,y,w,h)=>{ctx.fillStyle=palette.panel;ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fill();};
  ctx.fillStyle=palette.bg;ctx.fillRect(0,0,1080,1350);
  text('MY FINANCE',60,58,18,palette.accent,600);text('我的財務摘要',60,120,48,palette.text,700);
  text(model.date.replaceAll('-','/'),60,164,25,palette.muted);text(model.demo?'範例資料 · 非本人財務':model.hide?'分享版 · 金額已隱藏':model.snapshot?'每月快照':'個人財務概覽',650,160,24,palette.muted,400,370);
  if(model.meta)text(model.meta.goal.label,60,190,20,palette.accent,600,960);
  const cols=2,w=470,gap=20, start=205,h=model.hide?175:112;
  model.rows.forEach(([label,value],i)=>{const x=60+(i%cols)*(w+gap),y=start+Math.floor(i/cols)*(h+14);box(x,y,w,h);text(label,x+22,y+36,23,palette.muted);text(value,x+22,y+(model.hide?106:83),model.hide?44:34,palette.text,650,w-44);});
  let y=model.hide?835:760;
  if(!model.hide){
    text('財務目標',60,y,27,palette.accent,650);y+=24;box(60,y,960,154);
    model.goal.forEach(([label,value],i)=>{const x=85+(i%2)*480,cy=y+36+Math.floor(i/2)*65;text(label,x,cy,21,palette.muted);text(value,x+225,cy,24,palette.text,600,220);});
    y+=200;text('市場壓力摘要 · 整體淨資產'+(model.meta?' · '+model.meta.stressLabel:''),60,y,23,palette.accent,650,960);y+=20;
    model.stress.forEach(([label,value],i)=>{box(60+i*325,y,310,100);text(label,80+i*325,y+32,22,palette.muted);text(value,80+i*325,y+76,28,palette.text,650,270);});
    y+=140;
  }
  model.notes.forEach((note,i)=>text(note,60,y+i*30,21,palette.muted,400,960));
  if(model.hide&&model.meta)text('市場壓力模型：'+model.meta.stressLabel,60,1135,20,palette.muted,400,960);
  if(model.meta){const allocation=model.meta.allocation;const line='投資池配置：'+['一般','槓桿','預備金'].map((name,i)=>`${name} ${percent(allocation.ratios[i])}`).join(' ／ ');text(line,60,1190,20,palette.muted,400,960);text(`達標所需年化報酬率：${requiredReturnText(model.meta.required)}`,60,1220,20,palette.muted,400,960);}
  ctx.strokeStyle=palette.line;ctx.beginPath();ctx.moveTo(60,1250);ctx.lineTo(1020,1250);ctx.stroke();
  text('資料為使用者自行輸入之簡化財務估算，不構成投資建議。',60,1293,23,palette.muted,400,960);
  return canvas;
}
async function generateSummary(snapshot=null) {
  const status=ui('image-status');
  if(summaryBusy)return;
  if(!snapshot&&!dataValid){status.textContent='請先修正輸入，再產出摘要圖；目前保留上一筆有效資料。';return;}
  try {
    status.textContent='正在本機產生圖片…';summaryBusy=true;ui('generate-summary').disabled=true;ui('hide-amounts').disabled=true;
    const model=summaryModel(snapshot,ui('hide-amounts').checked);
    await document.fonts.ready;
    const canvas=drawSummary(model);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('圖片轉換失敗')),'image/png'));
    if(summaryURL)URL.revokeObjectURL(summaryURL);summaryURL=URL.createObjectURL(blob);
    const a=ui('download-summary');a.href=summaryURL;a.download=`財務摘要_${model.date}.png`;a.textContent=`下載 PNG 圖片（${model.date}）`;
    ui('summary-preview').src=summaryURL;ui('image-result').hidden=false;a.click();
    status.textContent='圖片已產生，所有資料僅在本機處理。';
  } catch(e){status.textContent=`產圖失敗：${e.message}。可稍後再試。`;}
  finally{summaryBusy=false;ui('generate-summary').disabled=false;ui('hide-amounts').disabled=false;}
}
ui('generate-summary').addEventListener('click',()=>generateSummary());
ui('hide-amounts').addEventListener('change',()=>{if(summaryURL){URL.revokeObjectURL(summaryURL);summaryURL=null;}ui('summary-preview').removeAttribute('src');ui('download-summary').removeAttribute('href');ui('image-result').hidden=true;ui('image-status').textContent='分享設定已變更，請重新產生圖片。';});
window.addEventListener('finance-summary',e=>{const snapshot=state.snapshots.find(s=>s.date===e.detail);if(snapshot)generateSummary(snapshot);});
window.addEventListener('finance-render',()=>{explainMetrics();if(summaryURL){URL.revokeObjectURL(summaryURL);summaryURL=null;ui('summary-preview').removeAttribute('src');ui('download-summary').removeAttribute('href');ui('image-result').hidden=true;ui('image-status').textContent='資料已更新，請重新產生摘要圖。';}});
window.addEventListener('finance-history',renderMonthComparison);
explainMetrics();
