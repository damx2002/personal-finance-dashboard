'use strict';
const STORAGE_KEY = 'personal-finance-dashboard.v1';
const form = document.querySelector('#finance-form');
const goalForm = document.querySelector('#goal-form');
const fields = [...document.querySelectorAll('#finance-form input, #goal-form input, #settings-form input')];
const defaults = Object.fromEntries(fields.map(field => [field.name, field.name === 'multiplier' ? 2 : field.name === 'minRunway' ? 6 : field.name === 'maxPaymentRatio' ? 40 : field.name === 'maxLeverage' ? 2 : 0]));
const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
const money = value => `NT$ ${number.format(value)}`;
const percent = value => value === null ? '—' : `${decimal.format(value * 100)}%`;
const multiple = value => value === null ? '—' : `${decimal.format(value)}x`;
// Amounts display grouping separators; stored data remains numeric.
const amountFields = fields.filter(field => !['multiplier','currentAge','targetAge','annualReturn','minRunway','maxPaymentRatio','maxLeverage'].includes(field.name));
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
    const hint=document.getElementById(`amount-hint-${field.name}`),value=fieldNumber(field);
    if(field.value===''&&!field.validity.badInput){hint.textContent='NT$ 0（空白視為 0）';continue;}
    if(!Number.isFinite(value)||value<0||value>1e15){hint.textContent='請輸入有效範圍內的非負金額';continue;}
    const units=value>=1e8?` · 約 ${decimal.format(value/1e8)} 億元`:value>=1e4?` · 約 ${decimal.format(value/1e4)} 萬元`:'';
    hint.textContent=`NT$ ${amountNumber.format(value)}${units}`;
  }
}
function calculate(d) {
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
    runway: spending > 0 ? d.cash / spending : null,
    balance: d.income / 12 - spending - d.monthlyInvestment,
    embedded: investment > 0 ? exposure / investment : null,
    investmentDebtRatio: investment > 0 ? d.investmentDebt / investment : null,
    leverage: equity > 0 ? exposure / equity : null,
    scenarios: [10,20,30,40,50].map(drop => {
      const value = d.regular * (1 - drop / 100) + d.leveraged * Math.max(0, 1 - d.multiplier * drop / 100);
      return { drop, value, equity: value - d.investmentDebt, net: assets - debt - investment + value };
    }) };
}
function calculateGoal(d, financial) {
  const years = d.targetAge - d.currentAge;
  if (d.targetAssets <= 0 || years < 0) return null;
  const months = years * 12;
  const monthlyLog = Math.log1p(d.annualReturn / 100) / 12;
  const growth = Math.exp(monthlyLog * months);
  const annuity = monthlyLog === 0 ? months : Math.expm1(monthlyLog * months) / Math.expm1(monthlyLog);
  const projected = financial * growth + d.monthlyInvestment * annuity;
  const required = annuity > 0 ? Math.max(0, (d.targetAssets - financial * growth) / annuity) : null;
  return { years, completion: financial / d.targetAssets, projected,
    extra: required === null ? null : Math.max(0, Math.ceil(required - d.monthlyInvestment - 1e-9)) };
}
function breakEven(d) {
  const initial = d.regular + d.leveraged;
  if (initial === 0 && d.investmentDebt === 0) return null;
  if (initial <= d.investmentDebt) return 0;
  const equityAt = drop => d.regular * (1 - drop) + d.leveraged * Math.max(0, 1 - d.multiplier * drop) - d.investmentDebt;
  let low = 0, high = 1;
  for (let i = 0; i < 80; i++) { const mid = (low + high) / 2; if (equityAt(mid) > 0) low = mid; else high = mid; }
  return high;
}
function renderGoal(d, financial) {
  document.getElementById('return-scenarios').replaceChildren(...[[5, '保守'], [8, '基準'], [12, '積極'], [d.annualReturn, '自訂']].map(([rate, label]) => {
    const card = document.createElement('div'); card.className = 'scenario-card';
    const title = document.createElement('span'); title.textContent = `${label} ${decimal.format(rate)}%`;
    const value = document.createElement('strong'); const result = calculateGoal({ ...d, annualReturn: rate }, financial);
    value.textContent = result ? money(result.projected) : '請先設定目標'; card.append(title, value); return card;
  }));
  const goal = calculateGoal(d, financial);
  if (!goal) {
    renderRows('goal-results', [['目標進度', d.targetAssets <= 0 ? '請先設定目標金融資產' : '請檢查目標年齡']]);
    return;
  }
  const shortfall = goal.projected + 0.000001 < d.targetAssets;
  renderRows('goal-results', [
    ['距離目標', `${goal.years} 年`],
    ['目前完成率', percent(goal.completion)],
    ['目標年齡預估金融資產', money(goal.projected)],
    ['還需增加的每月投入', goal.extra === null ? (shortfall ? '已無投入期間，請延後目標年齡' : 'NT$ 0') : money(goal.extra), '']
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
  const c = calculate(d);
  renderGoal(d, c.financial);
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
    ['每月債務還款 / 月收入', percent(c.paymentRatio), paymentRisk],
    ['每月結餘（含固定投資）', money(c.balance), c.balance < 0 ? 'danger' : '']
  ]);
  renderRows('investment', [
    ['投資總市值', money(c.investment)], ['投資等效市場曝險', money(c.exposure)],
    ['投資內含曝險倍數', multiple(c.embedded)], ['投資用途負債 / 投資市值', percent(c.investmentDebtRatio)],
    ['扣除投資負債後的淨值', money(c.equity), c.equity < 0 ? 'danger' : '']
  ]);
  const zero = breakEven(d);
  setText('break-even', zero === null ? '投資淨值歸零跌幅：尚無投資資料' : zero === 0 ? '投資淨值已為零或負數（約 0% 跌幅）' : `投資淨值歸零的約略市場跌幅：−${decimal.format(zero * 100)}%（同下方簡化線性模型）`);
  document.getElementById('scenarios').replaceChildren(...c.scenarios.map(scenario => {
    const row = document.createElement('tr');
    [`-${scenario.drop}%`, money(scenario.value), money(scenario.equity), money(scenario.net)].forEach((text, index) => {
      const cell = document.createElement('td'); cell.textContent = text;
      if ((index === 2 && scenario.equity < 0) || (index === 3 && scenario.net < 0)) cell.className = 'danger';
      row.append(cell);
    }); return row;
  }));
  window.dispatchEvent(new Event('finance-render'));
}
// A versioned envelope keeps values, snapshots and save metadata together.
const LOCAL_KEY = 'personal-finance-dashboard.v2';
const activeKey = LOCAL_KEY;
let state;
let dataValid = true;
let lastSaveFailed = false;
const ui = id => document.getElementById(id);
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function validateData(source, allowMissing = false) {
  if (!source || typeof source !== 'object' || Array.isArray(source) || !Object.hasOwn(source, 'cash')) throw new Error('資料欄位格式不正確');
  const data = {};
  for (const field of fields) {
    const v = source[field.name] === undefined && allowMissing ? defaults[field.name] : source[field.name];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < Number(field.min) || v > Number(field.max || 1e15) || (field.step === '1' && !Number.isInteger(v))) throw new Error(`「${field.closest('label')?.childNodes[0].textContent || field.name}」數值不正確`);
    data[field.name] = v;
  }
  if (data.investmentDebt > data.loan) throw new Error('投資用途信貸不能超過信貸餘額');
  if (data.targetAssets > 0 && data.targetAge < data.currentAge) throw new Error('目標年齡不能小於目前年齡');
  return data;
}
function emptyState() { return { schemaVersion:2, data:{...defaults}, snapshots:[], savedAt:null, draft:null }; }
function validateEnvelope(raw) {
  if (!raw || raw.schemaVersion !== 2) throw new Error('不支援的備份版本');
  const data = validateData(raw.data, true);
  if (!Array.isArray(raw.snapshots) || raw.snapshots.length > 600) throw new Error('快照格式不正確或超過 600 筆');
  const months = new Set();
  const snapshots = raw.snapshots.map(s => {
    if (!s || !validDate(s.date) || months.has(s.date.slice(0,7))) throw new Error('快照日期不正確或月份重複');
    months.add(s.date.slice(0,7));
    const item = {date:s.date};
    for (const key of ['net','financial','investment','debt','leverage']) {
      const v = s[key];
      if (key === 'leverage' && v === null) { item[key] = null; continue; }
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e32 || (key !== 'net' && v < 0)) throw new Error('快照數值不正確');
      item[key] = v;
    }
    return item;
  }).sort((a,b)=>a.date.localeCompare(b.date));
  if (raw.savedAt !== null && (typeof raw.savedAt !== 'string' || !Number.isFinite(Date.parse(raw.savedAt)))) throw new Error('儲存時間格式不正確');
  let draft = null;
  if (raw.draft !== undefined && raw.draft !== null) {
    if (typeof raw.draft !== 'object' || Array.isArray(raw.draft)) throw new Error('未完成輸入格式不正確');
    draft = {};
    for (const field of fields) {
      const value = raw.draft[field.name];
      if (typeof value !== 'string' || value.length > 100) throw new Error('未完成輸入格式不正確');
      draft[field.name] = value;
    }
  }
  return {schemaVersion:2, data, snapshots, savedAt:raw.savedAt, draft};
}
function readLocal(key) {
  const raw = localStorage.getItem(key);
  if (raw) return validateEnvelope(JSON.parse(raw));
  if (key === LOCAL_KEY) {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) return {...emptyState(), data:validateData(JSON.parse(legacy), true)};
  }
  return emptyState();
}
function showSaved(ok = !lastSaveFailed) {
  setText('save-status', ok ? (state.savedAt ? (state.draft ? '已儲存草稿：請修正輸入' : '✓ 資料已儲存於此瀏覽器') : '尚未輸入資料') : '無法儲存，請立即匯出備份');
  ui('saved-at').textContent = `最後儲存：${state.savedAt ? new Date(state.savedAt).toLocaleString('zh-TW', {hour12:false}) : '—'}`;
}
function persist(touch = true) {
  const next = {...state, savedAt:touch ? new Date().toISOString() : state.savedAt};
  try {
    localStorage.setItem(activeKey, JSON.stringify(next));
    state.savedAt = next.savedAt; lastSaveFailed = false; ui('storage-warning').hidden = true; showSaved(true); return true;
  } catch {
    lastSaveFailed = true; ui('storage-warning').hidden = false;
    ui('storage-warning').textContent = '本機儲存失敗：瀏覽器可能禁止儲存或空間不足。目前資料僅在畫面中，關閉後可能遺失；請立即匯出備份。';
    showSaved(false); return false;
  }
}
function paint() {
  for (const field of fields) { field.value = state.draft ? state.draft[field.name] : state.data[field.name]; field.setAttribute('aria-invalid','false'); }
  for (const id of ['validation','goal-validation']) ui(id).hidden = true;
  for(const field of amountFields)formatAmountField(field);
  refreshAmountHints();
  dataValid = !state.draft; render(state.data); renderHistory(); showSaved();
  if (state.draft) {
    for (const id of ['validation','goal-validation']) { ui(id).hidden=false;ui(id).textContent='已恢復尚未完成的輸入；結果顯示上一筆有效資料，請修正輸入。'; }
  }
}
function update() {
  refreshAmountHints();
  try {
    const input = {};
    for (const field of fields) {
      const value = field.value === '' && !field.validity.badInput ? defaults[field.name] : fieldNumber(field);
      field.setAttribute('aria-invalid', String(!Number.isFinite(value) || value < Number(field.min) || value > Number(field.max || 1e15) || (field.step === '1' && !Number.isInteger(value))));
      input[field.name] = value;
    }
    const data = validateData(input);
    state.data = data; state.draft = null; dataValid = true;
    for (const id of ['validation','goal-validation']) ui(id).hidden = true;
    render(data); persist();
  } catch (e) {
    dataValid = false;
    for (const id of ['validation','goal-validation']) { ui(id).hidden = false; ui(id).textContent = e.message; }
    state.draft = Object.fromEntries(fields.map(field=>[field.name,field.value]));
    persist();
  }
}
for (const id of ['finance-form','goal-form','settings-form']) {
  ui(id).addEventListener('input', update);
  ui(id).addEventListener('submit', e=>e.preventDefault());
}
function commit(next) {
  state = validateEnvelope(next);
  paint(); persist();
}
function clearData() {
  if (!confirm('要清除本機全部財務資料、目標、警戒線與快照嗎？建議先匯出備份。')) return;
  if (!confirm('最後確認：清除後無法復原。確定清除本機資料？')) return;
  state=emptyState();paint();persist();
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { ui('storage-warning').hidden=false;ui('storage-warning').textContent='舊版資料清除失敗，請檢查瀏覽器儲存權限。'; }
  ui('data-message').textContent=lastSaveFailed ? '清除未能寫入瀏覽器；重新開啟仍可能恢復舊資料。' : '本機資料已重設；不影響其他網站的資料。';
}
ui('clear-data').addEventListener('click', clearData);
ui('export-data').addEventListener('click', () => {
  const payload = {...state};
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `財務備份-${localDate()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  ui('data-message').textContent = '已匯出完整備份，包含有效資料、未完成輸入、目標、警戒線與所有快照。';
});
ui('import-data').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 2*1024*1024) throw new Error('備份檔不能超過 2 MB');
    const raw = JSON.parse(await file.text());
    const next = raw.schemaVersion === undefined ? {...emptyState(), data:validateData(raw,true)} : validateEnvelope(raw);
    if (!confirm('以備份取代本機全部資料、目標、警戒線及快照？此操作會覆蓋目前紀錄。')) { ui('data-message').textContent='已取消匯入，原資料未變更。'; return; }
    commit(next); ui('data-message').textContent = lastSaveFailed ? '備份已載入畫面，但儲存失敗，請保留原備份檔。' : '匯入完成，已儲存到此裝置瀏覽器。';
  } catch (e) { ui('data-message').textContent = `匯入失敗：${e.message}；原資料未變更。`; }
  finally { e.target.value = ''; }
});
ui('snapshot-date').value = localDate();
ui('save-snapshot').addEventListener('click', () => {
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
try { state = readLocal(LOCAL_KEY); paint(); if (!localStorage.getItem(LOCAL_KEY) && localStorage.getItem(STORAGE_KEY)) persist(false); }
catch { state=emptyState();paint();lastSaveFailed=true;showSaved(false);ui('storage-warning').hidden=false;ui('storage-warning').textContent='無法讀取舊資料：儲存權限不足或資料格式損壞。原紀錄尚未改動，請先檢查權限或匯入備份。'; }
if(location.protocol==='file:')ui('data-message').textContent='目前為本機檔案模式；瀏覽器可能不保證關閉後保存。建議改用固定網址並匯出備份，原檔資料不會自動搬至新網址。';
