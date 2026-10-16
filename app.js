'use strict';
const STORAGE_KEY = 'personal-finance-dashboard.v1';
const form = document.querySelector('#finance-form');
const fields = [...form.querySelectorAll('input')];
const defaults = Object.fromEntries(fields.map(field => [field.name, field.name === 'multiplier' ? 2 : 0]));
const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
const money = value => `NT$ ${number.format(value)}`;
const percent = value => value === null ? '—' : `${decimal.format(value * 100)}%`;
const multiple = value => value === null ? '—' : `${decimal.format(value)}x`;
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
function setText(id, text, negative = false) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.toggle('negative', negative);
}
function renderRows(id, rows) {
  const target = document.getElementById(id);
  target.replaceChildren(...rows.map(([label, value, negative]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value;
    if (negative) detail.className = 'negative';
    row.append(term, detail); return row;
  }));
}
function render(d) {
  const c = calculate(d);
  setText('netWorth', money(c.net), c.net < 0);
  setText('totalAssets', money(c.assets)); setText('totalDebt', money(c.debt));
  setText('marketLeverage', multiple(c.leverage)); setText('assetInvestment', money(c.investment));
  renderRows('health', [
    ['金融資產', money(c.financial)], ['負債 / 資產比例', percent(c.debtRatio)],
    ['每月債務還款 / 月收入', percent(c.paymentRatio)],
    ['現金可支撐月數', c.runway === null ? '—（無支出）' : `${decimal.format(c.runway)} 個月`],
    ['每月結餘（含固定投資）', money(c.balance), c.balance < 0]
  ]);
  renderRows('investment', [
    ['投資總市值', money(c.investment)], ['投資等效市場曝險', money(c.exposure)],
    ['投資內含曝險倍數', multiple(c.embedded)], ['投資用途負債 / 投資市值', percent(c.investmentDebtRatio)],
    ['扣除投資負債後的淨值', money(c.equity), c.equity < 0], ['綜合市場槓桿', multiple(c.leverage)]
  ]);
  document.getElementById('scenarios').replaceChildren(...c.scenarios.map(scenario => {
    const row = document.createElement('tr');
    [`-${scenario.drop}%`, money(scenario.value), money(scenario.equity), money(scenario.net)].forEach((text, index) => {
      const cell = document.createElement('td'); cell.textContent = text;
      if ((index === 2 && scenario.equity < 0) || (index === 3 && scenario.net < 0)) cell.className = 'negative';
      row.append(cell);
    }); return row;
  }));
}
let initial = { ...defaults };
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved data');
    for (const field of fields) {
      const value = saved[field.name];
      if (typeof value === 'number' && Number.isFinite(value) && value >= Number(field.min) && value <= 1e15) initial[field.name] = value;
    }
  }
} catch {
  setText('save-status', '無法讀取儲存資料；目前計算仍可使用');
}
for (const field of fields) field.value = initial[field.name];
render(initial);
function update() {
  const data = {};
  const errors = [];
  for (const field of fields) {
    const value = field.value === '' && !field.validity.badInput ? (field.name === 'multiplier' ? 2 : 0) : field.valueAsNumber;
    const valid = Number.isFinite(value) && value >= Number(field.min) && value <= 1e15;
    field.setAttribute('aria-invalid', String(!valid));
    if (!valid) errors.push(field.name === 'multiplier' ? 'ETF 倍率請輸入大於或等於 1 的數字。' : '金額請輸入 0 到 1,000,000,000,000,000 之間的有效數字。');
    data[field.name] = value;
  }
  if (data.investmentDebt > data.loan) errors.push('投資用途信貸不能超過信貸餘額。');
  const warning = document.getElementById('validation');
  warning.hidden = errors.length === 0;
  warning.textContent = [...new Set(errors)].join(' ');
  if (errors.length) {
    setText('save-status', '請修正輸入；結果保留上一筆有效資料');
    return;
  }
  render(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setText('save-status', '✓ 已自動儲存在此瀏覽器');
  } catch {
      setText('save-status', '無法儲存：重新整理可能遺失資料');
  }
}
form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
document.getElementById('reset').addEventListener('click', () => {
  if (!window.confirm('確定要清除全部財務資料嗎？此操作無法復原。')) return;
  for (const field of fields) field.value = defaults[field.name];
  update();
});
