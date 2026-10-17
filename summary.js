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
  const paymentRow=row('債務月付 / 平均月收入');
  const paymentStatus=paymentRow?.querySelector('dd')?.classList.contains('danger')?'danger':paymentRow?.querySelector('dd')?.classList.contains('caution')?'caution':'';
  addExplanation(paymentRow,payment+` 你的警戒線：${decimal.format(d.maxPaymentRatio)}%。平均月收入以家庭年收入 ÷ 12 計算；若收入波動較大，此比例僅作年度平均參考。固定債務支出占比愈高，每月可調整的現金流空間愈小，可優先檢視還款安排與必要支出。 `+personal,payment+' 可優先檢視固定還款安排。',paymentStatus);
  addExplanation(row('投資用途負債 / 投資市值'),c.investmentDebtRatio===null?'目前沒有投資市值，無法計算借款占比；可先核對投資用途借款。':`投資用途負債僅計實際投入股票 / ETF 的借款部分，不一定是整筆貸款。目前股票 / ETF 投資資產中約 ${percent(c.investmentDebtRatio)} 是由借款支撐。市場下跌時，投資市值會下降，但貸款本金不會同步下降。此項未設定警戒線，可搭配綜合槓桿，優先檢視借款規模與還款來源。`,c.investmentDebtRatio===null?'目前無投資市值，暫不計算借款占比。':`約 ${percent(c.investmentDebtRatio)} 投資由借款支撐，下跌時貸款本金不會同步減少。`);
  renderCompositions(d,c);
  renderMonthComparison();
}
function renderCompositions(d,c){
 const bufferCash=FinanceCore.cashKeys.map((key,i)=>[`${['日常可動用現金','緊急預備金','投資預備金','指定用途預留資金'][i]}（${d.bufferIncludes[key]?'計入':'不計入'}）`,d[key],key]);
 const spending=d.living+d.mortgagePayment+d.loanPayment;
 const sets=[['cashRunway','runway-composition',[...bufferCash,['生活緩衝現金小計',d.cashBuffer,'cashBuffer'],['每月生活支出',d.living,'living'],['每月房貸還款',d.mortgagePayment,'mortgagePayment'],['每月信貸 / 其他還款',d.loanPayment,'loanPayment'],['每月生活與債務支出小計',spending,'spending']],spending>0?`現金緩衝月數 = 生活緩衝現金 ÷ 每月生活與債務支出\n${decimal.format(c.runway)} 個月 = ${money(d.cashBuffer)} ÷ (${money(d.living)} + ${money(d.mortgagePayment+d.loanPayment)})\n現金緩衝假設收入中斷時會暫停固定投資，因此分母只包含生活支出與債務還款。依進階設定勾選現金分類。`:'目前每月生活與債務支出為 NT$ 0，無法計算緩衝月數。現金緩衝假設收入中斷時會暫停固定投資，因此分母只包含生活支出與債務還款。依進階設定勾選現金分類。'],['financialAssets','financial-composition',[
 ['日常可動用現金',d.cashDaily,'cashDaily'],['緊急預備金',d.cashEmergency,'cashEmergency'],['投資預備金',d.cashInvestmentReserve,'cashInvestmentReserve'],['指定用途預留資金',d.cashEarmarked,'cashEarmarked'],['現金小計',d.cash,'cash'],['一般股票 / ETF',d.regular,'regular'],['槓桿 ETF',d.leveraged,'leveraged'],['股票 / ETF 投資資產小計',c.investment,'investment'],['金融資產',c.financial,'financial']
 ],`金融資產 = 現金小計 + 股票 / ETF 投資資產小計\n${money(c.financial)} = ${money(d.cash)} + ${money(c.investment)}`],['netWorth','net-composition',[
 ['現金',d.cash,'cash'],['股票 / ETF 投資資產',c.investment,'investment'],['房屋',d.home,'home'],['其他資產',d.other,'other'],['總資產',c.assets,'assets'],['減：房貸',d.mortgage,'mortgage'],['減：信貸 / 其他負債',d.loan,'loan'],['總負債',c.debt,'debt'],['淨資產',c.net,'net']
 ],`淨資產 = 總資產 − 總負債\n${money(c.net)} = ${money(c.assets)} − ${money(c.debt)}`]];
 for(const[id,detailId,rows,formula]of sets){const host=ui(id).closest('.kpi');let details=ui(detailId);if(!details){details=document.createElement('details');details.id=detailId;details.className='kpi-composition';const summary=document.createElement('summary');summary.textContent='ⓘ 查看組成與算法';details.append(summary,document.createElement('dl'),document.createElement('p'));host.insertBefore(details,host.querySelector('.metric-explanation'));}
 const dl=details.querySelector('dl');dl.replaceChildren(...rows.map(([label,value,part])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');row.dataset.part=part;row.dataset.value=value;dt.textContent=label;dd.textContent=money(value);row.append(dt,dd);return row;}));details.querySelector('p').textContent=formula;}
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
function summaryGoalNote(required) {
  if(required.kind==='zero')return '依目前本金與固定投入，不計投資報酬亦可達成設定目標。';
  if(required.kind!=='rate')return requiredReturnText(required)+'；僅為數學情境估算。';
  const range=required.rate>.12?'高於 12% 情境':required.rate>.08?'介於 8%～12% 情境':required.rate>.05?'介於 5%～8% 情境':'低於 5% 情境';
  return `以目前投入與期限估算，達標所需報酬${range}。`;
}
function summaryModel(snapshot, hide) {
  const d=FinanceCore.derived(state.data),c=calculate(d),s=snapshot,unavailable='未記錄';
  const date=s?s.date:localDate(),financial=s?s.financial:c.financial,net=s?s.net:c.net,debt=s?s.debt:c.debt,assets=s?s.net+s.debt:c.assets;
  const g=s?null:HealthAnalysis.goal(state.data,new Date().getFullYear(),goalSettings.basis),goal=g?.target>0?g.target:null;
  const validTime=!!(goal&&g.targetYear),goalTime=validTime?`約 ${g.targetYear} 年・${g.targetAge} 歲`:s?unavailable:'尚未設定有效目標時間';
  const leverage=s?s.leverage:c.leverage;
  const cashStatus=s||c.runway===null?'':c.runway<d.minRunway?'danger':c.runway<=d.minRunway*1.2?'caution':'';
  const paymentStatus=s?'':highRisk(c.paymentRatio,d.maxPaymentRatio/100*.8-1e-12,d.maxPaymentRatio/100);
  const leverageStatus=s?'':highRisk(c.leverage,d.maxLeverage*.8-1e-12,d.maxLeverage);
  const threshold=(status,normal)=>status==='danger'?'高於':status==='caution'?'接近':normal;
  const progressNote=!goal?s?unavailable:'尚未設定目標':g.completion>=1?hide?'目前已達成設定目標':g.surplus>0?`目前已高於設定目標 ${money(g.surplus)}`:'目前已達成設定目標':hide?`距離目標尚有 ${percent(1-g.completion)}`:`距離目標尚差 ${money(g.gap)}`;
  const rows=[
    ['淨資產',hide?'已隱藏':money(net),'總資產 − 總負債'],
    ['金融資產',hide?'已隱藏':money(financial),'現金 + 股票 / ETF'],
    ['現金緩衝',s?unavailable:c.runway===null?'暫不計算':`${decimal.format(c.runway)} 個月`,s?unavailable:c.runway===null?'目前無生活與債務支出':`${cashStatus==='danger'?'低於':cashStatus==='caution'?'接近':'高於'}自訂 ${decimal.format(d.minRunway)} 個月門檻`,cashStatus],
    ['債務月付比',s?unavailable:percent(c.paymentRatio),'每月債務還款 ÷ 平均月收入',paymentStatus,s?unavailable:c.paymentRatio===null?'目前無平均月收入':`${threshold(paymentStatus,'低於')}自訂 ${decimal.format(d.maxPaymentRatio)}% 提醒線`],
    ['綜合市場槓桿',leverage===null?'無法計算有效倍數':multiple(leverage),'等效曝險 ÷ 投資淨值',leverageStatus,s?unavailable:leverage===null?'投資淨值不大於零或尚無投資':`${threshold(leverageStatus,'低於')}自訂 ${d.maxLeverage.toFixed(2)}x 提醒線`],
    ['目標完成率',goal?percent(g.completion):s?unavailable:'尚未設定',progressNote]
  ];
  // Keep historical figures isolated: snapshots do not contain goal, cash-flow or stress inputs.
  const goalRows=hide?[
    ['完成率',goal?percent(g.completion):s?unavailable:'未設定'],['目標時間',goalTime],['達標所需年化報酬',g?requiredReturnText(g.required):unavailable]
  ]:[
    [s?'目前金融資產':`目前${g.basisLabel}`,s?money(financial):money(g.currentGoalAssets)],
    [s?'目標金融資產':`目標${g.basisLabel}`,goal?money(goal):s?unavailable:'未設定'],
    ['完成率',goal?percent(g.completion):s?unavailable:'未設定'],['目標時間',goalTime],
    ['距離目標尚差',goal?money(g.gap):s?unavailable:'未設定'],['達標所需年化報酬',g?requiredReturnText(g.required):unavailable]
  ];
  const relative=(value,base)=>Number.isFinite(value)&&base!==0?`${value-base<0?'−':value-base>0?'+':''}${percent(Math.abs((value-base)/Math.abs(base)))}`:'基期為零，暫不計算';
  const stress=[20,30,50].map(drop=>{const r=s?null:c.scenarios.find(row=>row.drop===drop);return {label:`大盤 −${drop}%`,value:s?unavailable:!r.ok?'無有效示意路徑':hide?null:money(r.net),net:s?unavailable:!r.ok?'無有效示意路徑':relative(r.net,c.net),equity:s?unavailable:!r.ok?'無有效示意路徑':relative(r.equity,c.equity)};});
  const allocation=s?null:FinanceCore.allocation(state.data);
  return {date,hide,demo:demoActive,snapshot:!!s,headerGoal:validTime?`目標：${goalTime}｜${g.basisLabel}目標`:null,
    meta:s?null:{allocation,required:g.required,goal:g,stressLabel:StressCore.label(stressSettings)},rows,goal:goalRows,stress,
    secondary:hide?[]:[['總資產',money(assets)],['總負債',money(debt)],['股票 / ETF 投資資產',money(s?s.investment:c.investment)]],
    allocationLine:allocation?'投資池｜'+['一般','槓桿','預備金'].map((name,i)=>`${name} ${percent(allocation.ratios[i])}`).join('・'):null,
    reminderLine:s?null:`自訂提醒｜現金 ${decimal.format(d.minRunway)} 個月・月付比 ${decimal.format(d.maxPaymentRatio)}%・槓桿 ${d.maxLeverage.toFixed(2)}x`,
    goalTitle:g?g.basisLabel+'目標':'歷史快照',goalNote:g?summaryGoalNote(g.required):'歷史快照未記錄目標、現金流與壓力情境；未混用目前資料。',
    stressNote:'市場情境僅調整股票 / ETF；現金、房屋與負債維持不變。'};
}
function drawSummary(model) {
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('此瀏覽器無法產生圖片');
  const dark=document.documentElement.dataset.theme==='dark';
  const palette=dark?{bg:'#101e1a',panel:'#1a2b25',text:'#e1ece5',muted:'#adc3b5',line:'#334d40',accent:'#b4d9be',caution:'#d7b56d',danger:'#e4a2a2'}:{bg:'#f4f7f5',panel:'#ffffff',text:'#24332d',muted:'#718078',line:'#d9e4de',accent:'#5e8f7a',caution:'#c58b2a',danger:'#c86464'};
  const text=(value,x,y,size=28,color=palette.text,weight=400,maxWidth=960)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Noto Sans CJK TC", "Noto Sans CJK JP", "Microsoft JhengHei", sans-serif`;let actual=size;while(ctx.measureText(value).width>maxWidth&&actual>12){actual--;ctx.font=`${weight} ${actual}px "Noto Sans CJK TC", "Noto Sans CJK JP", "Microsoft JhengHei", sans-serif`;}ctx.fillText(value,x,y);};
  const box=(x,y,w,h)=>{ctx.fillStyle=palette.panel;ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fill();};
  ctx.fillStyle=palette.bg;ctx.fillRect(0,0,1080,1350);
  text('MY FINANCE',60,58,18,palette.accent,600);text('我的財務摘要',60,120,48,palette.text,700);
  text(model.date.replaceAll('-','/'),60,164,25,palette.muted);text(model.demo?'範例資料 · 非本人財務':model.hide?'分享版 · 金額已隱藏':model.snapshot?'每月快照':'個人財務概覽',650,160,22,palette.muted,400,370);
  if(model.headerGoal)text(model.headerGoal,60,193,21,palette.accent,600);
  model.rows.forEach(([label,value,helper,status,note],i)=>{const x=60+(i%2)*490,y=212+Math.floor(i/2)*132;box(x,y,470,120);text(label,x+20,y+29,22,palette.muted);text(value,x+20,y+65,34,palette[status]||palette.text,650,430);text(helper,x+20,y+91,19,palette.muted,400,430);if(note)text(note,x+20,y+113,18,palette[status]||palette.muted,400,430);});
  model.secondary.forEach(([label,value],i)=>{const x=60+i*325;text(label,x,622,18,palette.muted,400,310);text(value,x,652,25,palette.text,600,310);});
  if(model.allocationLine)text(model.allocationLine,60,687,21,palette.muted);
  if(model.reminderLine)text(model.reminderLine,60,716,20,palette.muted);
  text(model.goalTitle,60,756,27,palette.accent,650);box(60,774,960,218);
  const order=model.hide?model.goal:[model.goal[0],model.goal[1],model.goal[4],model.goal[2],model.goal[3],model.goal[5]];
  order.forEach(([label,value],i)=>{const x=84+(i%2)*480,y=805+Math.floor(i/2)*54;text(label,x,y,18,palette.muted);text(value,x,y+27,24,palette.text,600,430);});
  text(model.goalNote,84,973,20,palette.muted,400,912);
  text('市場壓力摘要',60,1031,27,palette.accent,650);
  text('整體淨資產｜'+(model.meta?model.meta.stressLabel:'歷史快照未記錄模型'),60,1060,20,palette.muted);
  model.stress.forEach((r,i)=>{const x=60+i*325;box(x,1076,310,130);text(r.label,x+18,1105,22,palette.muted);if(r.value!==null)text(r.value,x+18,1141,28,palette.text,650,274);text('整體淨資產 '+r.net,x+18,model.hide?1145:1170,19,palette.muted,400,274);text('投資淨值 '+r.equity,x+18,model.hide?1178:1195,19,palette.muted,400,274);});
  text(model.snapshot?'歷史快照僅呈現當月已記錄資訊。':model.stressNote,60,1236,21,palette.muted);
  ctx.strokeStyle=palette.line;ctx.beginPath();ctx.moveTo(60,1264);ctx.lineTo(1020,1264);ctx.stroke();
  text('資料依使用者輸入進行簡化估算，不構成投資建議。',60,1306,23,palette.muted);
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
