'use strict';
let stressSettings=StressCore.defaults(),stressSettingsError='';
try{const raw=localStorage.getItem(StressCore.KEY);if(raw)stressSettings=StressCore.settings(JSON.parse(raw));}catch{stressSettingsError='無法讀取壓力模型偏好，暫用每日重置・60 日・平滑；既有紀錄未改動。';}
let goalSettings={basis:'investment'},goalSettingsError='',realGoalSettings=null;
try{const raw=localStorage.getItem(FinanceCore.GOAL_SETTINGS_KEY);if(raw)goalSettings=FinanceCore.validateGoalSettings(JSON.parse(raw));}catch{goalSettingsError='目標基準偏好無法讀取，暫用投資資產；原始紀錄未改動。';}
const STORAGE_KEY = 'personal-finance-dashboard.v1';
const form = document.querySelector('#finance-form');
const goalForm = document.querySelector('#goal-form');
const fields = [...document.querySelectorAll('input[data-field]')];
const defaults = FinanceCore.scalarDefaults;
const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
const money = value => `NT$ ${number.format(value)}`;
const percent = value => value === null ? '—' : `${decimal.format(value * 100)}%`;
const multiple = value => value === null ? '—' : `${decimal.format(value)}x`;
// Amounts display grouping separators; stored data remains numeric.
const amountFields = fields.filter(field => !['multiplier','currentAge','targetAge','annualReturn','minRunway','maxPaymentRatio','maxLeverage','allocationGeneral','allocationLeveraged','allocationReserve'].includes(field.name));
const amountNumber = new Intl.NumberFormat('zh-TW', { maximumFractionDigits:20 });
for (const field of amountFields) {
  field.type='text';field.inputMode='decimal';field.autocomplete='off';field.spellcheck=false;
  const hint=document.createElement('small');hint.id=`amount-hint-${field.name}`;hint.className='amount-hint';
  field.insertAdjacentElement('afterend',hint);
  field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
}
function rawAmount(value) { return value.normalize('NFKC').replace(/,/g,'').trim(); }
function fieldNumber(field) {
  if (!amountFields.includes(field)) return field.valueAsNumber;
  const raw=rawAmount(field.value);
  return /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(raw) ? Number(raw) : NaN;
}
function formatAmountField(field, keepCaret = false) {
  const raw=rawAmount(field.value);
  if(raw==='' || !/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(raw))return;
  const start=field.selectionStart,end=field.selectionEnd;
  const count=index=>field.value.slice(0,index).replace(/,/g,'').length;
  const startCount=count(start),endCount=count(end);
  const [integer,fraction]=raw.split('.');
  field.value=integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
  if(keepCaret && start!==null){
    const position=count=>{let seen=0,i=0;while(i<field.value.length && seen<count){if(field.value[i]!==',')seen++;i++;}return i;};
    field.setSelectionRange(position(startCount),position(endCount));
  }
}
for(const field of amountFields){
  field.addEventListener('input',e=>{if(!e.isComposing)formatAmountField(field,true);});
  field.addEventListener('compositionend',()=>{formatAmountField(field,true);update();});
  // Deleting beside a separator removes the adjacent digit instead of re-inserting the comma.
  field.addEventListener('beforeinput',e=>{
    if(field.selectionStart!==field.selectionEnd)return;
    let at=field.selectionStart;
    if(e.inputType==='deleteContentBackward' && at>1 && field.value[at-1]===','){
      e.preventDefault();field.setRangeText('',at-2,at,'end');formatAmountField(field,true);update();
    } else if(e.inputType==='deleteContentForward' && field.value[at]===',' && at+1<field.value.length){
      e.preventDefault();field.setRangeText('',at,at+2,'end');formatAmountField(field,true);update();
    }
  });
}
function refreshAmountHints() {
  for (const field of amountFields) {
    if(!field.isConnected)continue;
    const hint=document.getElementById(`amount-hint-${field.name}`),value=fieldNumber(field);
    if(field.value===''&&!field.validity.badInput){hint.textContent='NT$ 0（空白視為 0）';continue;}
    if(!Number.isFinite(value)||value<0||value>1e15){hint.textContent='請輸入有效範圍內的非負金額';continue;}
    const units=value>=1e8?` · 約 ${decimal.format(value/1e8)} 億元`:value>=1e4?` · 約 ${decimal.format(value/1e4)} 萬元`:'';
    hint.textContent=`NT$ ${amountNumber.format(value)}${units}`;
  }
}
function calculate(d) {
  d=FinanceCore.derived(d);
  const investment = d.regular + d.leveraged;
  const assets = d.cash + investment + d.home + d.other;
  const debt = d.mortgage + d.loan;
  const exposure = d.regular + d.leveraged * d.multiplier;
  const equity = investment - d.investmentDebt;
  const payments = d.mortgagePayment + d.loanPayment;
  const spending = d.living + payments;
  return { investment, assets, debt, net: assets - debt, financial: d.cash + investment,
    exposure, equity, debtRatio: assets > 0 ? debt / assets : null,
    paymentRatio: d.income > 0 ? payments / (d.income / 12) : null,
    runway: spending > 0 ? (d.cashBuffer ?? d.cash) / spending : null,
    balance: d.income / 12 - spending - d.monthlyInvestment,
    embedded: investment > 0 ? exposure / investment : null,
    investmentDebtRatio: investment > 0 ? d.investmentDebt / investment : null,
    leverage: equity > 0 ? exposure / equity : null,
    scenarios: [10,20,30,40,50].map(drop=>StressCore.stressScenario({data:d,drawdown:drop/100,...stressSettings})) };
}
function calculateGoal(d) {return FinanceCore.goalEstimate(d,goalSettings.basis);}
function breakEven(d) {const result=StressCore.solveBreakEvenDrawdown({data:d,...stressSettings});return result.kind==='found'?result.drawdown:null;}
function renderGoal(d) {
  document.getElementById('return-scenarios').replaceChildren(...[[0, '零報酬'],[5, '保守'], [8, '基準'], [12, '積極'], [d.annualReturn, '自訂']].map(([rate, label]) => {
    const card = document.createElement('div'); card.className = 'scenario-card';
    const title = document.createElement('span'); title.textContent = `${label} ${decimal.format(rate)}%`;
    const value = document.createElement('strong'); const result = calculateGoal({ ...d, annualReturn: rate });
    value.textContent = result && d.targetAge>d.currentAge ? money(result.projected) : '請設定未來目標'; card.append(title, value); return card;
  }));
  const goal = calculateGoal(d), g=HealthAnalysis.goal(d,new Date().getFullYear(),goalSettings.basis);
  ui('goals-title').textContent=goalSettings.basis==='financial'?'金融資產目標':'投資資產目標';
  syncGoalControls();ui('goal-settings-message').textContent=goalSettingsError;ui('wizard-goal-settings-message').textContent=goalSettingsError;
  ui('goal-basis-description').textContent=goalSettings.basis==='investment'?'本目標以一般股票 / ETF 與槓桿 ETF 市值為起點，現金不納入投資報酬試算。':'金融資產包含現金與股票 / ETF；未來預估中，現金暫以0%報酬計算，投資資產依設定報酬率成長。';
  ui('goal-time').textContent=g.label;
  ui('goal-distance').textContent=g.completion===null?'':g.years>0?`距離目標還有 ${g.years} 年（整歲估算）`:'目標年齡須晚於目前年齡，才估算未來結果。';
  const bar=ui('goal-progress');bar.value=Math.min(100,Math.max(0,(g.completion||0)*100));bar.hidden=g.completion===null;
  ui('goal-progress-note').textContent=g.completion===null?'設定目標後即可查看進度。':`目前已達設定目標的 ${percent(g.completion)}`;
  ui('goal-extra').textContent='';
  if (!goal) {renderRows('goal-results', [['目標進度', d.targetAssets <= 0 ? '請先設定目標資產' : '請檢查目標年齡']]);return;}
  const shortfall = goal.projected + 0.000001 < d.targetAssets;
  ui('goal-extra').textContent='依投資組合報酬假設，還需增加的每月投入：'+(goal.extra===null?(shortfall?'已無投入期間，請延後目標年齡':'NT$ 0'):money(goal.extra));
  renderRows('goal-results', [
    [`目前${g.basisLabel}`,money(g.currentGoalAssets)],[`目標${g.basisLabel}`,money(d.targetAssets)],
    [g.surplus>0?`目前${g.basisLabel}已高於設定目標`:'距離設定目標尚差',money(g.surplus>0?g.surplus:g.gap)],
    [g.targetYear?`約 ${g.targetYear} 年預估${g.basisLabel}（組合 ${decimal.format(d.annualReturn)}%）`:`未來預估${g.basisLabel}`,g.projected===null?'目標年齡須晚於目前年齡':money(g.projected)]
  ]);
}

function highRisk(value, warning, danger) {
  return value === null ? '' : value > danger ? 'danger' : value > warning ? 'caution' : '';
}
function statusLabel(status) {
  return status === 'danger' ? '超過警戒' : status === 'caution' ? '接近警戒' : '';
}
function setText(id, text, status = '') {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.remove('danger', 'caution');
  if (status) element.classList.add(status);
  const card = element.closest('.kpi');
  if (card) {
    card.querySelector('.status-badge')?.remove();
    if (status) {
      const badge = document.createElement('span');
      badge.className = `status-badge ${status}`;
      badge.textContent = statusLabel(status);
      card.append(badge);
    }
  }
}
function renderRows(id, rows) {
  const target = document.getElementById(id);
  target.replaceChildren(...rows.map(([label, value, status]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value;
    if (status) {
      detail.className = status;
      const badge = document.createElement('small');
      badge.className = 'row-status'; badge.textContent = statusLabel(status);
      detail.append(badge);
    }
    row.append(term, detail); return row;
  }));
}
function render(d) {
  d=FinanceCore.derived(d);
  const c = calculate(d);
  renderGoal(d);
  const runwayRisk = c.runway === null ? '' : c.runway < d.minRunway ? 'danger' : c.runway <= d.minRunway * 1.2 ? 'caution' : '';
  const leverageRisk = c.equity <= 0 && (c.investment > 0 || d.investmentDebt > 0) ? 'danger' : highRisk(c.leverage, d.maxLeverage * 0.8 - 1e-12, d.maxLeverage);
  const debtRisk = c.assets === 0 && c.debt > 0 ? 'danger' : '';
  const paymentRisk = d.income === 0 && (d.mortgagePayment + d.loanPayment) > 0 ? 'danger' : highRisk(c.paymentRatio, d.maxPaymentRatio / 100 * 0.8 - 1e-12, d.maxPaymentRatio / 100);
  setText('netWorth', money(c.net), c.net < 0 ? 'danger' : '');
  setText('financialAssets', money(c.financial));
  setText('cashRunway', c.runway === null ? '—' : `${decimal.format(c.runway)} 個月`, runwayRisk);
  setText('marketLeverage', multiple(c.leverage), leverageRisk);
  setText('assetInvestment', money(c.investment));
  renderRows('health', [
    ['總資產', money(c.assets)], ['總負債', money(c.debt)],
    ['負債 / 資產比例', percent(c.debtRatio), debtRisk],
    ['債務月付 / 平均月收入', percent(c.paymentRatio), paymentRisk],
    ['固定投資前現金流餘裕',money(c.balance+d.monthlyInvestment),c.balance+d.monthlyInvestment<0?'danger':''],
    ['固定投資後每月結餘', money(c.balance), c.balance < 0 && c.balance+d.monthlyInvestment<0 ? 'danger' : '']
  ]);
  renderRows('investment', [
    ['股票 / ETF 投資資產', money(c.investment)], ['投資用途負債',money(d.investmentDebt)], ['投資等效市場曝險', money(c.exposure)],
    ['投資內含曝險倍數', multiple(c.embedded)], ['投資用途負債 / 投資市值', percent(c.investmentDebtRatio)],
    ['投資淨值', money(c.equity), c.equity < 0 ? 'danger' : '']
  ]);
  renderStress(d,c);
  renderReview(d);
  window.dispatchEvent(new Event('finance-render'));
}
const LOCAL_KEY='personal-finance-dashboard.v3';
const PREVIOUS_KEY='personal-finance-dashboard.v2';
const activeKey=LOCAL_KEY;
let state, demoActive=false, realState=null, dataValid=true, lastSaveFailed=false, readBlocked=false;
const ui=id=>document.getElementById(id);
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function emptyState(){return FinanceCore.emptyEnvelope();}
function validateData(raw){return FinanceCore.validateData(raw);}
function validateEnvelope(input){
 const raw=FinanceCore.migrate(input),data=validateData(raw.data);
 if(!Array.isArray(raw.snapshots)||raw.snapshots.length>600)throw Error('快照格式不正確或超過 600 筆');
 const months=new Set();const snapshots=raw.snapshots.map(s=>{if(!s||!validDate(s.date)||months.has(s.date.slice(0,7)))throw Error('快照日期不正確或月份重複');months.add(s.date.slice(0,7));const item={date:s.date};for(const k of ['net','financial','investment','debt','leverage']){if(k==='leverage'&&s[k]===null){item[k]=null;continue;}if(typeof s[k]!=='number'||!Number.isFinite(s[k])||Math.abs(s[k])>1e32||(k!=='net'&&s[k]<0))throw Error('快照數字不正確');item[k]=s[k];}return item;}).sort((a,b)=>a.date.localeCompare(b.date));
 const savedAt=raw.savedAt||null;if(savedAt!==null&&(typeof savedAt!=='string'||!Number.isFinite(Date.parse(savedAt))))throw Error('儲存時間不正確');
 if(raw.draft!==null&&raw.draft!==undefined){if(!raw.draft||typeof raw.draft.fields!=='object'||!Array.isArray(raw.draft.debts)||raw.draft.debts.length>100)throw Error('草稿格式不正確');for(const v of Object.values(raw.draft.fields))if(typeof v!=='string'||v.length>100)throw Error('草稿欄位不正確');for(const debt of raw.draft.debts)for(const v of Object.values(debt))if(typeof v!=='string'||v.length>100)throw Error('負債草稿不正確');}
 return {...emptyState(),data,snapshots,savedAt,draft:raw.draft||null,provided:Array.isArray(raw.provided)?raw.provided.filter(x=>typeof x==='string'&&x.length<100):[],wizardStep:Number.isInteger(raw.wizardStep)&&raw.wizardStep>=0&&raw.wizardStep<=2?raw.wizardStep:0,setupInProgress:raw.setupInProgress===true,...(raw.migratedFrom?{migratedFrom:raw.migratedFrom}:{})};
}
function readLocal(){
 for(const key of [LOCAL_KEY,PREVIOUS_KEY,STORAGE_KEY]){const raw=localStorage.getItem(key);if(raw!==null)return {value:validateEnvelope(JSON.parse(raw)),needsMigration:key!==LOCAL_KEY};}
 return {value:emptyState(),needsMigration:false};
}
function showSaved(ok=!lastSaveFailed){
 const message=demoActive?'目前為範例資料，不儲存':ok?(state.savedAt?(state.draft?'已儲存草稿：請修正輸入':'✓ 已儲存'):isFirstRun()?'尚未輸入資料':'已載入既有資料（尚無儲存時間）'):'無法儲存，請立即匯出備份';setText('save-status',message);ui('wizard-save-status').textContent=message;
 const saved=!demoActive&&state.savedAt?new Date(state.savedAt):null;const pad=n=>String(n).padStart(2,'0');ui('saved-at').textContent=saved?`最後更新：${saved.getFullYear()}/${pad(saved.getMonth()+1)}/${pad(saved.getDate())} ${pad(saved.getHours())}:${pad(saved.getMinutes())}`:'最後更新：—';
}
function persist(touch=true){
 if(demoActive){showSaved();return true;}
 if(readBlocked){ui('storage-warning').hidden=false;ui('storage-warning').textContent='既有資料讀取失敗，已停止自動覆寫。請先匯出現況或匯入可用備份；原始 localStorage 尚未改動。';showSaved(false);return false;}
 const next={...state,savedAt:touch?new Date().toISOString():state.savedAt};
 try{localStorage.setItem(LOCAL_KEY,JSON.stringify(next));state.savedAt=next.savedAt;lastSaveFailed=false;ui('storage-warning').hidden=true;showSaved();return true;}
 catch{lastSaveFailed=true;ui('storage-warning').hidden=false;ui('storage-warning').textContent='本機儲存失敗：請檢查瀏覽器儲存權限或空間，並立即匯出備份。';showSaved(false);return false;}
}
function isFirstRun(){return !state.savedAt&&!state.snapshots.length&&!state.draft&&['cashDaily','cashEmergency','cashInvestmentReserve','cashEarmarked','home','other','regular','leveraged','income','living','monthlyInvestment','targetAssets'].every(k=>!state.data[k])&&!state.data.debts.some(x=>x.balance||x.monthlyPayment);}
function paint(){
 for(const f of fields){const value=state.draft?.fields?.[f.name];f.value=value!==undefined?value:state.data[f.name]===null?'':state.data[f.name]===0&&!state.provided.includes(f.name)&&!['multiplier','minRunway','maxPaymentRatio','maxLeverage'].includes(f.name)?'':state.data[f.name];f.setAttribute('aria-invalid','false');}
 document.querySelectorAll('[data-buffer]').forEach(el=>el.checked=state.data.bufferIncludes[el.dataset.buffer]);
 renderDebtEditor();for(const f of amountFields)if(f.isConnected)formatAmountField(f);refreshAmountHints();
 dataValid=!state.draft;ui('wizard-error').hidden=!state.draft;if(state.draft)ui('wizard-error').textContent='已恢復尚未完成的輸入；計算保留上一筆有效資料，請修正提示。';
 for(const id of ['validation','goal-validation'])if(ui(id))ui(id).hidden=true;
 render(state.data);renderHistory();renderV3();showSaved();
}
function debtDraftRows(){return [...ui('debt-editor').querySelectorAll('.debt-row')].map(row=>{const item={id:row.dataset.id};row.querySelectorAll('[data-debt-field]').forEach(el=>item[el.dataset.debtField]=el.value);return item;});}
function getDraft(){return {fields:Object.fromEntries(fields.map(f=>[f.name,f.value])),debts:debtDraftRows()};}
function readDebts(){return [...ui('debt-editor').querySelectorAll('.debt-row')].map(row=>{const item={id:row.dataset.id};row.querySelectorAll('[data-debt-field]').forEach(el=>{const k=el.dataset.debtField;if(['name','type'].includes(k))item[k]=el.value;else item[k]=el.value===''?(k==='annualRate'||k==='remainingMonths'?null:0):fieldNumber(el);});return item;});}
function update(event){
 refreshAmountHints();try{
  const input={...state.data};for(const f of fields){const v=f.value===''?(f.dataset.nullable?null:defaults[f.name]):fieldNumber(f);f.setAttribute('aria-invalid',String(v!==null&&(!Number.isFinite(v)||v<Number(f.min)||v>Number(f.max||1e15)||(f.step==='1'&&!Number.isInteger(v)))));input[f.name]=v;}
  input.bufferIncludes=Object.fromEntries([...document.querySelectorAll('[data-buffer]')].map(el=>[el.dataset.buffer,el.checked]));input.debts=readDebts();
  const data=validateData(input);state.data=data;state.draft=null;dataValid=true;ui('wizard-error').hidden=true;
  if(event?.target?.matches('[data-field]')&&!state.provided.includes(event.target.name))state.provided.push(event.target.name);
  if(event?.target?.matches('[data-buffer]')&&!state.provided.includes('bufferIncludes'))state.provided.push('bufferIncludes');
  render(data);persist();renderV3();
 }catch(e){dataValid=false;state.draft=getDraft();ui('wizard-error').hidden=false;ui('wizard-error').textContent=e.message;persist();renderAnalysisStatus();}
}
for(const id of ['finance-form','goal-form','settings-form']){ui(id).addEventListener('input',update);ui(id).addEventListener('change',event=>{if(event.target.matches('select,[data-buffer]'))update(event);});ui(id).addEventListener('submit',e=>e.preventDefault());}
function commit(next){if(demoActive)exitDemo(false);state=validateEnvelope(next);readBlocked=false;paint();persist();}
function clearData(){if(demoActive)return;if(!confirm('清除本機財務資料、目標、警戒線、快照與已儲存情境？建議先匯出備份。')||!confirm('最後確認：清除後無法復原，確定清除本機資料？'))return;state=emptyState();readBlocked=false;paint();if(persist(false)){try{localStorage.removeItem(PREVIOUS_KEY);localStorage.removeItem(STORAGE_KEY);if(window.ScenarioCore)localStorage.removeItem(ScenarioCore.KEY);}catch{ui('storage-warning').hidden=false;ui('storage-warning').textContent='部分舊版或情境資料清除失敗，請檢查瀏覽器權限。';}}window.dispatchEvent(new Event('finance-cleared'));ui('data-message').textContent=lastSaveFailed?'清除未能寫入瀏覽器。':'本機財務資料已清除，不影響其他網站。';}
ui('clear-data').addEventListener('click',clearData);
ui('export-data').addEventListener('click',()=>{if(demoActive)return;try{const payload=window.ScenarioBackup?ScenarioBackup.extend(state):state;const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`財務備份-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ui('data-message').textContent='已匯出完整備份，情境是否包含依勾選設定。';}catch(e){ui('data-message').textContent=`匯出失敗：${e.message}；正式資料未變更。`;}});
ui('import-data').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(demoActive)throw Error('請先離開範例模式');if(file.size>2*1024*1024)throw Error('備份檔不能超過 2 MB');const raw=JSON.parse(await file.text()),next=validateEnvelope(raw);window.ScenarioBackup?.validateImport(raw);if(!confirm(`以備份取代目前所有財務資料、快照${Object.hasOwn(raw,'scenariosV4')?'與已儲存情境':''}${Object.hasOwn(raw,'goalSettings')?'及目標計算基準':''}？`)){ui('data-message').textContent='已取消匯入，原資料未變更。';return;}if(window.ScenarioBackup){state=ScenarioBackup.restore(next,raw);readBlocked=false;lastSaveFailed=false;ui('storage-warning').hidden=true;paint();}else commit(next);ui('data-message').textContent=lastSaveFailed?'備份已載入，但儲存失敗，請保留原檔。':'匯入完成，已儲存到此裝置瀏覽器。';}catch(e){ui('data-message').textContent=`匯入失敗：${e.message}${e.message.includes('回復未能確認')?'。':'；原資料未變更。'}`;}finally{event.target.value='';}});
ui('snapshot-date').value = localDate();
ui('save-snapshot').addEventListener('click', () => {
  if (demoActive) return;
  if (!dataValid) { ui('data-message').textContent = '請先修正輸入後再存快照。'; return; }
  const date = ui('snapshot-date').value;
  if (!validDate(date)) { ui('data-message').textContent = '請選擇有效快照日期。'; return; }
  const existing = state.snapshots.find(s=>s.date.slice(0,7)===date.slice(0,7));
  if (existing && !confirm('這個月份已有快照，確定要取代嗎？')) return;
  if (!existing && state.snapshots.length >= 600) { ui('data-message').textContent = '最多保存 600 筆快照，請先匯出並刪除舊紀錄。'; return; }
  const c = calculate(state.data);
  state.snapshots = state.snapshots.filter(s=>s!==existing).concat({date,net:c.net,financial:c.financial,investment:c.investment,debt:c.debt,leverage:c.leverage}).sort((a,b)=>a.date.localeCompare(b.date));
  persist(); renderHistory();
});
function renderHistory() {
  window.dispatchEvent(new Event('finance-history'));
  ui('snapshot-rows').replaceChildren(...state.snapshots.map(s=>{
    const row = document.createElement('tr');
    for (const text of [s.date,money(s.net),money(s.financial),money(s.investment),money(s.debt),multiple(s.leverage)]) { const td=document.createElement('td');td.textContent=text;row.append(td); }
    const cell=document.createElement('td');const button=document.createElement('button');button.textContent='刪除';button.type='button';
    button.addEventListener('click',()=>{if(confirm(`刪除 ${s.date} 快照？`)){state.snapshots=state.snapshots.filter(x=>x!==s);persist();renderHistory();}});
    const summaryButton=document.createElement('button');summaryButton.type='button';summaryButton.textContent='產出此月摘要圖';summaryButton.className='snapshot-summary';
    summaryButton.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('finance-summary',{detail:s.date})));
    cell.append(summaryButton,button);row.append(cell);return row;
  }));
  const target=ui('history-chart');target.replaceChildren();
  if (!state.snapshots.length) { const p=document.createElement('p');p.className='hint';p.textContent='尚無快照。儲存第一筆後即可查看歷史趨勢。';target.append(p);return; }
  const metric=ui('chart-metric').value, values=state.snapshots.map(s=>s[metric]).filter(v=>v!==null);
  if(!values.length){target.textContent='這些快照的槓桿無有效數值，請選其他指標。';return;}
  const low=Math.min(0,...values), high=Math.max(1,...values), range=high-low;
  const svgNS='http://www.w3.org/2000/svg';const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 800 260');svg.classList.add('history-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${ui('chart-metric').selectedOptions[0].text}歷史趨勢；詳細數字見下方表格`);
  function node(tag,attrs,text){const n=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;}
  const display=v=>metric==='leverage'?multiple(v):money(v);
  for(let i=0;i<3;i++){const y=25+i*90;node('line',{x1:130,y1:y,x2:780,y2:y,class:'axis'});node('text',{x:120,y:y+4,'text-anchor':'end'},display(high-range*i/2));}
  let segment=[];
  const flush=()=>{if(segment.length)node('polyline',{points:segment.join(' '),class:'trend'});segment=[];};
  state.snapshots.forEach((s,i)=>{const x=140+(state.snapshots.length===1?310:i/(state.snapshots.length-1)*620);if(s[metric]===null){flush();return;}const y=25+(high-s[metric])/range*180;segment.push(`${x},${y}`);const dot=node('circle',{cx:x,cy:y,r:4});const title=document.createElementNS(svgNS,'title');title.textContent=`${s.date}：${display(s[metric])}`;dot.append(title);});flush();
  node('text',{x:140,y:245},state.snapshots[0].date);node('text',{x:780,y:245,'text-anchor':'end'},state.snapshots.at(-1).date);target.append(svg);
}
ui('chart-metric').addEventListener('change',renderHistory);
window.addEventListener('storage', e=>{
  if(e.key!==activeKey || !e.newValue)return;
  try{const next=validateEnvelope(JSON.parse(e.newValue));if(next.savedAt!==state.savedAt){if(!dataValid){setText('save-status','另一分頁已修改資料；請匯出備份再重新整理');return;}state=next;paint();}}catch{setText('save-status','另一分頁資料格式異常，請先匯出備份');}
});
function wireDebtAmount(field){
 amountFields.push(field);field.type='text';field.inputMode='decimal';field.autocomplete='off';field.spellcheck=false;
 const hint=document.createElement('small');hint.id=`amount-hint-${field.name}`;hint.className='amount-hint';field.insertAdjacentElement('afterend',hint);field.setAttribute('aria-describedby',hint.id);
 field.addEventListener('input',e=>{if(!e.isComposing)formatAmountField(field,true);});field.addEventListener('compositionend',()=>{formatAmountField(field,true);update();});
 field.addEventListener('beforeinput',e=>{const at=field.selectionStart;if(at!==field.selectionEnd)return;if(e.inputType==='deleteContentBackward'&&at>1&&field.value[at-1]===','){e.preventDefault();field.setRangeText('',at-2,at,'end');formatAmountField(field,true);update();}else if(e.inputType==='deleteContentForward'&&field.value[at]===','){e.preventDefault();field.setRangeText('',at,at+2,'end');formatAmountField(field,true);update();}});
}
function renderDebtEditor(rows=state.draft?.debts||state.data.debts){
 for(let i=amountFields.length-1;i>=0;i--)if(amountFields[i].dataset.debtField)amountFields.splice(i,1);
 ui('debt-editor').replaceChildren();
 rows.forEach((item,index)=>{
  const box=document.createElement('section');box.className='debt-row';box.dataset.id=item.id;
  const header=document.createElement('div');header.className='section-heading';const title=document.createElement('h4');title.textContent=`負債 ${index+1}`;const remove=document.createElement('button');remove.type='button';remove.textContent='移除此筆';remove.addEventListener('click',()=>{if(!confirm('移除此筆負債？'))return;box.remove();for(let i=amountFields.length-1;i>=0;i--)if(!amountFields[i].isConnected)amountFields.splice(i,1);update();});header.append(title,remove);box.append(header);
  const grid=document.createElement('div');grid.className='wizard-grid';
  const definitions=[['name','負債名稱','text','選填','如房貸、將來銀行信貸或車貸。'],['type','負債類型','select','必要','依借款實際類型選擇。'],['balance','目前餘額','amount','必要','尚未償還的本金。'],['annualRate','年利率（%）','number','選填','未知可留白；不會猜測利率。'],['monthlyPayment','每月還款','amount','必要','實際每月固定償還金額。'],['remainingMonths','剩餘月數','number','選填','未知可留白。'],['investmentAmount','其中已投入投資的借款本金','amount','選填','如果一筆信貸只有部分資金實際投入股票 / ETF，只填實際投入的部分。']];
  for(const [key,label,type,level,help]of definitions){const wrapper=document.createElement('label');wrapper.append(document.createTextNode(label+' '));const badge=document.createElement('span');badge.className='field-level';badge.textContent=level;wrapper.append(badge);let el;
   if(type==='select'){el=document.createElement('select');for(const[value,text]of [['mortgage','房貸'],['personalLoan','信貸'],['car','車貸'],['revolving','卡循'],['other','其他']]){const option=document.createElement('option');option.value=value;option.textContent=text;el.append(option);}}
   else{el=document.createElement('input');el.type=type==='amount'?'text':type;el.inputMode=type==='text'?'text':'decimal';el.min='0';el.step=key==='remainingMonths'?'1':'any';if(key==='annualRate')el.max='100';if(key==='remainingMonths')el.max='1200';if(key==='name')el.maxLength=80;}
   el.dataset.debtField=key;el.name=`debt-${item.id}-${key}`;el.value=item[key]===null||item[key]===undefined?'':item[key];wrapper.append(el);grid.append(wrapper);if(type==='amount')wireDebtAmount(el);
   const small=document.createElement('small');small.className='field-helper';small.textContent=help;wrapper.append(small);
  }
  box.append(grid);ui('debt-editor').append(box);
 });for(const field of amountFields)if(field.isConnected)formatAmountField(field);refreshAmountHints();window.dispatchEvent(new Event('finance-debt-editor'));
}
function showWizardStep(step){
 const monthly=fields.find(f=>f.name==='monthlyInvestment').closest('label');if(step===0||step===1){ui(step===0?'basic-monthly-slot':'goal-monthly-slot').append(monthly);monthly.firstChild.textContent=step===0?'每月固定投資金額 ':'每月固定投入 ';}
 state.wizardStep=Math.max(0,Math.min(2,step));document.querySelectorAll('[data-step]').forEach(form=>form.hidden=Number(form.dataset.step)!==state.wizardStep);
 ui('wizard-progress').textContent=`Step ${state.wizardStep+1} / 3`;ui('wizard-title').textContent=['目前財務','投資與目標','進階設定'][state.wizardStep];
 document.querySelectorAll('.stepper span').forEach((el,i)=>el.classList.toggle('active',i===state.wizardStep));ui('wizard-back').disabled=state.wizardStep===0;ui('wizard-next').textContent=state.wizardStep===2?'完成設定':'儲存並繼續';ui('wizard').querySelector('.wizard-body').scrollTop=0;
}
function openWizard(step=0){if(demoActive)exitDemo(false);state.setupInProgress=true;showWizardStep(step);if(!ui('wizard').open)ui('wizard').showModal();persist(false);}
function closeWizard(){state.setupInProgress=false;ui('wizard').close();persist(false);renderV3();}
function exitDemo(open=true){goalSettings=realGoalSettings||goalSettings;realGoalSettings=null;demoActive=false;state=realState||emptyState();realState=null;paint();if(open)openWizard(0);}
function enterDemo(){if(!isFirstRun())return;realGoalSettings={...goalSettings};realState=FinanceCore.clone(state);demoActive=true;state=emptyState();state.data={...FinanceCore.defaults(),cashDaily:200000,cashEmergency:300000,cashInvestmentReserve:150000,home:8000000,income:1500000,living:35000,monthlyInvestment:25000,regular:1200000,leveraged:200000,currentAge:35,targetAge:55,targetAssets:15000000,annualReturn:8,allocationGeneral:70,allocationLeveraged:10,allocationReserve:20,debts:[{id:'demo-mortgage',name:'範例房貸',type:'mortgage',balance:4000000,annualRate:2.2,monthlyPayment:20000,remainingMonths:240,investmentAmount:0},{id:'demo-loan',name:'範例信貸',type:'personalLoan',balance:300000,annualRate:3,monthlyPayment:6000,remainingMonths:60,investmentAmount:100000}]};paint();}
function requiredReturnText(result){return result.kind==='rate'?`${decimal.format(result.rate*100)}%`:result.kind==='zero'?'0%':result.kind==='aboveRange'?'超出估算範圍（>100%）':result.kind==='noTime'?'沒有未來投入期間':result.kind==='noCapital'?'尚無可成長的本金或投入':'尚未設定目標';}
function renderV3(){
 const d=state.data,c=calculate(d),derived=FinanceCore.derived(d),alloc=FinanceCore.allocation(d),debt=FinanceCore.debtSummary(d),first=isFirstRun()&&!demoActive;
 ui('welcome').hidden=!first;ui('dashboard').hidden=first;ui('demo-banner').hidden=!demoActive;ui('mobile-edit').hidden=first||ui('wizard').open;document.body.classList.toggle('demo-mode',demoActive);
 for(const id of ['save-snapshot','export-data','import-data','clear-data'])ui(id).disabled=demoActive;
 const rr=FinanceCore.requiredReturn(d,goalSettings.basis);ui('required-return').textContent=requiredReturnText(rr);ui('required-return-note').textContent=rr.kind==='zero'?'即使不計投資報酬，依目前投入亦可達成目標。':rr.kind==='rate'?rr.label+'。僅為月末投入、月複利的數學情境比較，不保證未來報酬。':rr.kind==='noTime'?'目標年齡須晚於目前年齡，才計算未來報酬。':rr.kind==='aboveRange'?'在 0%～100% 年化估算範圍內無解，可檢視投入或目標期限。':rr.kind==='noCapital'?'只有報酬率無法讓零本金、零投入達標。':'設定目標金額與年齡後即可估算。';
 const labels=['一般投資','槓桿投資','投資預備金'];ui('allocation-current').replaceChildren();const bar=document.createElement('div');bar.className='allocation-bar';
 alloc.ratios.forEach((ratio,i)=>{const part=document.createElement('span');part.className=`asset-${i}`;part.style.width=`${(ratio||0)*100}%`;part.title=`${labels[i]} ${percent(ratio)}`;bar.append(part);});ui('allocation-current').append(bar);
 const legend=document.createElement('p');legend.className='allocation-legend';legend.textContent='現在：'+labels.map((label,i)=>`${label} ${percent(alloc.ratios[i])}`).join(' · ');ui('allocation-current').append(legend);
 ui('allocation-target').textContent=alloc.valid?'目標：'+labels.map((label,i)=>`${label} ${decimal.format(alloc.weights[i])}%`).join(' · '):alloc.kind==='unset'?'尚未設定目標配置；可於進階設定依自己的計畫填寫。':'目標配置合計需為 100%。';
 ui('allocation-validation').hidden=!(alloc.kind==='invalid'||(alloc.kind==='unset'&&alloc.weights.some(x=>x!==null)));
 ui('wizard-cash-total').textContent=`總現金 ${money(derived.cash)} · 生活緩衝使用 ${money(derived.cashBuffer)}`;ui('wizard-monthly-note').textContent=`每月固定投入 ${money(d.monthlyInvestment)}（於第一步設定）`;
 renderRows('cash-analysis',[['日常可動用現金',money(d.cashDaily)],['緊急預備金',money(d.cashEmergency)],['投資預備金',money(d.cashInvestmentReserve)],['指定用途預留',money(d.cashEarmarked)],['總現金',money(derived.cash)],['計入生活緩衝',money(derived.cashBuffer)]]);
 renderRows('debt-analysis',[['總負債',money(debt.total)],['每月總還款',money(debt.payments)],['投資用途負債',money(debt.investmentDebt)],['加權平均利率',debt.total===0?'無負債':debt.weightedRate===null?'填寫貸款利率後即可估算。':`${decimal.format(debt.weightedRate)}%`],['粗估一年利息成本',debt.interest===null?'填寫貸款利率後即可估算。':money(debt.interest)]]);
 ui('rebalance-note').textContent=alloc.kind==='valid'?`如果完全不賣既有部位，約需新增 ${money(alloc.additionalCapitalRequired)} 才能回到目標配置。`:alloc.kind==='impossible'?'此目標無法單靠新增資金完全達成，因為目前仍持有目標配置為 0% 的資產。':alloc.kind==='invalid'?'目標配置合計需為 100%。':alloc.kind==='aboveRange'?'目標比例過小，超出可估算範圍，請檢視目標配置。':'先於進階設定填寫三類目標配置。';
 renderRows('rebalance-additions',alloc.kind==='valid'?labels.map((label,i)=>[`${label}需新增`,money(alloc.additions[i])]):[]);
 renderRows('monthly-allocation',alloc.monthly?labels.map((label,i)=>[label,`NT$ ${decimal.format(alloc.monthly[i])}`]):[]);
 renderAnalysisStatus();
 window.dispatchEvent(new Event('finance-layout'));
}
function renderAnalysisStatus(){
 const result=HealthAnalysis.analysisStatus(state.data,{draft:state.draft,readBlocked,basis:goalSettings.basis}),host=ui('completeness');host.replaceChildren();
 ui('analysis-status-summary').textContent='資料與分析狀態 · '+(result.count?`有 ${result.count} 項可補強`:'主要分析已可使用');
 function list(items){const ul=document.createElement('ul');ul.className='analysis-status-items';for(const item of items){const li=document.createElement('li'),p=document.createElement('p'),b=document.createElement('button');li.dataset.statusId=item.id;p.textContent=item.text;b.type='button';b.textContent='去補資料';b.addEventListener('click',()=>{openWizard(item.step);const target=item.debtId?[...ui('debt-editor').querySelectorAll('.debt-row')].find(row=>row.dataset.id===item.debtId)?.querySelector(`[data-debt-field="${item.focus}"]`):fields.find(field=>field.name===item.focus);if(target){target.scrollIntoView({block:'center'});target.focus({preventScroll:true});}});li.append(p,b);ul.append(li);}return ul;}
 for(const[key,title]of [['core','核心財務分析'],['goal','財務目標']]){const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');section.dataset.analysisGroup=key;h.textContent=(result[key].ready?'✓ ':'△ ')+title;p.textContent=result[key].text;section.append(h,p,list(result[key].issues));host.append(section);}
 const section=document.createElement('section'),h=document.createElement('h3');h.textContent='進階分析 · 可補強';section.append(h);if(result.advanced.length)section.append(list(result.advanced));else{const p=document.createElement('p');p.textContent=result.count?'目前沒有額外的進階分析補強項目。':'目前主要分析所需資料已齊全。';section.append(p);}host.append(section);
}
ui('edit-finances').addEventListener('click',()=>openWizard(0));ui('mobile-edit').addEventListener('click',()=>openWizard(0));ui('start-setup').addEventListener('click',()=>openWizard(0));ui('demo-start').addEventListener('click',enterDemo);ui('demo-exit').addEventListener('click',()=>exitDemo(true));document.querySelectorAll('[data-open-step]').forEach(button=>button.addEventListener('click',()=>openWizard(Number(button.dataset.openStep))));
ui('close-wizard').addEventListener('click',closeWizard);ui('wizard').addEventListener('cancel',e=>{e.preventDefault();closeWizard();});ui('wizard').addEventListener('close',()=>renderV3());
ui('wizard-back').addEventListener('click',()=>{showWizardStep(state.wizardStep-1);persist(false);});
ui('wizard-next').addEventListener('click',()=>{
 if(!dataValid){ui('wizard-error').hidden=false;return;}
 if(state.wizardStep===2){const a=FinanceCore.allocation(state.data);if(a.weights.some(v=>v!==null)&&!a.valid){ui('wizard-error').hidden=false;ui('wizard-error').textContent='目標配置合計需為 100%。';return;}persist();closeWizard();return;}
 showWizardStep(state.wizardStep+1);persist(false);
});
ui('add-debt').addEventListener('click',()=>{const rows=debtDraftRows();if(rows.length>=100){ui('wizard-error').hidden=false;ui('wizard-error').textContent='最多 100 筆負債。';return;}rows.push({id:crypto.randomUUID?crypto.randomUUID():`debt-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:'',type:'personalLoan',balance:0,annualRate:null,monthlyPayment:0,remainingMonths:null,investmentAmount:0});renderDebtEditor(rows);update();});
function renderStress(d,c){
 const solved=StressCore.solveBreakEvenDrawdown({data:d,...stressSettings}),daily=stressSettings.model==='dailyReset';
 ui('stress-model-label').textContent=StressCore.label(stressSettings);ui('scenario-model-label').textContent='壓力模型：'+StressCore.label(stressSettings);
 ui('daily-options').hidden=!daily;ui('volatility-options').hidden=!daily||stressSettings.path!=='volatile';ui('custom-volatility-label').hidden=ui('stress-volatility').value!=='custom';
 ui('stress-model-note').textContent=daily?'每日重置模型將槓桿倍率逐日套用於市場報酬，因此結果不等於整段市場跌幅 × 槓桿倍數。'+(stressSettings.path==='smooth'?'假設市場以相同複利速度逐日走到設定跌幅，用於觀察每日重置效果。':'加入固定波動示意，用於呈現路徑與波動可能如何影響槓桿 ETF 累積結果。此為情境示意，不是市場預測。'):'將槓桿倍率直接套用於整段市場跌幅，適合快速觀察曝險，不代表跨日持有槓桿 ETF 的實際累積報酬。';
 ui('stress-settings-message').textContent=stressSettingsError;
 ui('break-even').textContent=solved.kind==='error'?solved.error:solved.kind==='empty'?'尚無投資資料。':solved.kind==='none'?'在目前模型範圍內未出現投資淨值歸零。':solved.drawdown===0?'在目前模型假設下，投資淨值已為零或負數（約 0% 跌幅）。':daily?`依目前每日重置情境假設，投資淨值歸零約落在大盤 −${decimal.format(solved.drawdown*100)}%。`:`線性曝險模型下，投資淨值歸零約需大盤下跌 ${decimal.format(solved.drawdown*100)}%。`;
 ui('break-even-note').hidden=!daily;
 ui('scenarios').replaceChildren(...c.scenarios.map(r=>{const row=document.createElement('tr');row.dataset.drop=r.drop;if(!r.ok){const cell=document.createElement('td');cell.colSpan=5;cell.textContent=`大盤 −${r.drop}%：${r.error}`;row.append(cell);return row;}const labels=['大盤跌幅','槓桿 ETF 模擬','投資市值','投資淨值','整體淨資產'];[`-${r.drop}%`,percent(r.leveragedReturn),money(r.value),money(r.equity),money(r.net)].forEach((text,i)=>{const cell=document.createElement('td');cell.textContent=text;cell.dataset.label=labels[i];if(i===3&&r.equity<0||i===4&&r.net<0)cell.className='danger';row.append(cell);});return row;}));
}
function renderReview(d){const result=HealthAnalysis.analyze(d,stressSettings,new Date().getFullYear(),goalSettings.basis);for(const key of ['positive','warnings','review']){const host=ui('review-'+key);host.replaceChildren(...result[key].map(item=>{const li=document.createElement('li');li.textContent=item.text;li.dataset.reviewId=item.id;return li;}));if(!result[key].length){const li=document.createElement('li');li.className='hint';li.textContent=key==='warnings'?'目前未觸發上述個人警戒條件。':key==='positive'?'可隨資料與目標設定持續檢視。':'目前沒有額外待補項目。';host.append(li);}}}
function syncStressControls(){ui('stress-model').value=stressSettings.model;ui('stress-path').value=stressSettings.path;ui('stress-days').value=stressSettings.days;ui('stress-volatility').value=[.5,1,2].includes(stressSettings.volatility)?String(stressSettings.volatility):'custom';ui('stress-custom-volatility').value=stressSettings.volatility;}
syncStressControls();
ui('stress-controls').addEventListener('change',()=>{const candidate={model:ui('stress-model').value,path:ui('stress-path').value,days:Number(ui('stress-days').value),volatility:ui('stress-volatility').value==='custom'?(ui('stress-custom-volatility').value.trim()===''?NaN:Number(ui('stress-custom-volatility').value)):Number(ui('stress-volatility').value)};
 ui('custom-volatility-label').hidden=ui('stress-volatility').value!=='custom';try{stressSettings=StressCore.settings(candidate);stressSettingsError='';try{localStorage.setItem(StressCore.KEY,JSON.stringify(stressSettings));}catch{stressSettingsError='模型已切換，但儲存偏好失敗，重新開啟後可能無法保留。';}render(state.data);}catch{ui('stress-settings-message').textContent=StressCore.ERROR+'（自訂波動請填 0～25%。目前結果維持上一組有效設定。）';}});
window.addEventListener('storage',e=>{if(e.key===StressCore.KEY){try{stressSettings=e.newValue?StressCore.settings(JSON.parse(e.newValue)):StressCore.defaults();stressSettingsError='';syncStressControls();render(state.data);}catch{ui('stress-settings-message').textContent='其他分頁的壓力設定無法讀取，目前設定維持不變。';}}});
function syncGoalControls(){document.querySelectorAll('[data-goal-basis]').forEach(el=>el.value=goalSettings.basis);ui('target-assets-label').textContent='目標'+FinanceCore.goalInputs(state?.data||FinanceCore.defaults(),goalSettings.basis).basisLabel;ui('target-assets-helper').textContent=goalSettings.basis==='investment'?'只計一般股票 / ETF 與槓桿 ETF；不含任何現金與投資預備金。':'包含所有現金與股票 / ETF；未來預估中現金暫以 0% 報酬計算。';}
document.querySelectorAll('[data-goal-basis]').forEach(el=>{el.addEventListener('input',e=>e.stopPropagation());el.addEventListener('change',e=>{e.stopPropagation();goalSettings=FinanceCore.validateGoalSettings({basis:el.value});goalSettingsError='';if(!demoActive)try{localStorage.setItem(FinanceCore.GOAL_SETTINGS_KEY,JSON.stringify(goalSettings));}catch{goalSettingsError='目標基準已切換，但偏好儲存失敗；重新開啟後可能無法保留。';}render(state.data);renderV3();});});
window.addEventListener('storage',e=>{if(e.key===FinanceCore.GOAL_SETTINGS_KEY){try{goalSettings=e.newValue?FinanceCore.validateGoalSettings(JSON.parse(e.newValue)):{basis:'investment'};goalSettingsError='';if(demoActive)realGoalSettings={...goalSettings};render(state.data);renderV3();}catch{ui('goal-settings-message').textContent='無法讀取其他分頁的目標基準，目前設定維持不變。';}}});
let aiDirty=false;
function generateAI(){const privacy=ui('ai-mode').value==='privacy';ui('ai-output').value=HealthAnalysis.exportAI(state.data,{privacy,settings:stressSettings,year:new Date().getFullYear(),basis:goalSettings.basis});ui('ai-status').textContent=demoActive?'目前輸出為範例資料，尚未傳送至外部服務。':'已在本機整理，尚未傳送至任何外部服務。'+(!dataValid?' 目前有未完成輸入，採最後有效數值。':'');aiDirty=false;ui('copy-ai').disabled=false;}
ui('generate-ai').addEventListener('click',()=>{generateAI();ui('ai-dialog').showModal();});ui('ai-mode').addEventListener('change',generateAI);ui('close-ai').addEventListener('click',()=>{ui('ai-dialog').close();ui('ai-output').value='';});ui('ai-dialog').addEventListener('close',()=>{ui('ai-output').value='';});
ui('copy-ai').addEventListener('click',async()=>{if(aiDirty)return;try{await navigator.clipboard.writeText(ui('ai-output').value);ui('ai-status').textContent='已複製。財務資料尚未自動傳送至任何外部服務。';}catch{ui('ai-output').focus();ui('ai-output').select();ui('ai-status').textContent='瀏覽器未允許自動複製，請長按文字區或使用 Ctrl+C 手動複製。資料仍未傳送。';}});
window.addEventListener('finance-render',()=>{if(ui('ai-dialog').open){aiDirty=true;ui('copy-ai').disabled=true;ui('ai-output').value='';ui('ai-status').textContent='資料或模型已變更，請切換模式或關閉後重新產生。';}});
try{const loaded=readLocal();state=loaded.value;paint();if(loaded.needsMigration)persist(false);}catch(e){state=emptyState();readBlocked=true;lastSaveFailed=true;paint();ui('storage-warning').hidden=false;ui('storage-warning').textContent=`無法讀取既有資料：${e.message}。原始資料未改動，請檢查儲存權限或匯入備份。`;showSaved(false);}
if(location.protocol==='file:')ui('data-message').textContent='本機檔案模式的保存依瀏覽器而異，建議使用固定網址並定期匯出備份。';
if(state.setupInProgress&&!readBlocked)setTimeout(()=>openWizard(state.wizardStep),0);
