/* Local rule-based interpretation and explicitly selected export fields only. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,C=node?require('./v3-core.js'):root.FinanceCore,S=node?require('./scenario-core.js'):root.ScenarioCore,T=node?require('./stress-core.js'):root.StressCore;
const num=x=>Number.isFinite(x)?new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(x):'未能計算',pct=x=>Number.isFinite(x)?`${num(x*100)}%`:'未能計算',money=x=>Number.isFinite(x)?`NT$ ${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(x)}`:'未能計算';
function goal(data,year,basis='investment'){const d=C.derived(data),inputs=C.goalInputs(data,basis),years=d.targetAge-d.currentAge,valid=d.targetAssets>0,hasTime=valid&&years>0,targetYear=hasTime&&Number.isInteger(year)?year+years:null;return {...inputs,years,targetYear,targetAge:d.targetAge,label:targetYear?`目標：約 ${targetYear} 年・${d.targetAge} 歲`:valid?`目標年齡：${d.targetAge} 歲（無未來估算期間）`:'尚未設定財務目標',target:d.targetAssets,completion:valid?inputs.currentGoalAssets/d.targetAssets:null,gap:valid?Math.max(0,d.targetAssets-inputs.currentGoalAssets):null,surplus:valid?Math.max(0,inputs.currentGoalAssets-d.targetAssets):null,projected:hasTime?C.goalFutureValue(data,d.annualReturn/100,basis):null,required:C.requiredReturn(data,basis)};}
function analyze(data,config=T.defaults(),year,basis='investment'){const d=C.derived(data),m=S.metrics(data,config,undefined,basis),g=goal(data,year,basis),allocation=C.allocation(data),positive=[],warnings=[],review=[],item=(id,text)=>({id,title:text,text});
 if(m.balance<0)warnings.push(item('cashflow-negative',`平均每月結餘（扣固定投資後）為 ${money(m.balance)}，目前每月支出與投入高於收入。`));else if(m.balance>0)positive.push(item('cashflow-positive',`平均每月結餘（扣固定投資後）約 ${money(m.balance)}。`));
 if(m.runway!==null){const text=`目前現金可支撐約 ${num(m.runway)} 個月，${m.runway<d.minRunway?'低於':'高於或等於'}你設定的 ${num(d.minRunway)} 個月最低門檻，差約 ${num(Math.abs(m.runway-d.minRunway))} 個月。`;if(m.runway<d.minRunway)warnings.push(item('runway-low',text));else if(m.runway<=d.minRunway*1.2){}else positive.push(item('runway-ok',text));}
 if(m.paymentRatio!==null&&m.paymentRatio>d.maxPaymentRatio/100)warnings.push(item('payment-high',paymentText(m,d)));
 else if(m.paymentRatio===null&&m.payments>0)warnings.push(item('payment-no-income',`每月債務還款 ${money(m.payments)}，目前年收入為零，無法計算月付比。`));
 if(m.leverage!==null&&m.leverage>d.maxLeverage)warnings.push(item('leverage-high',leverageText(m,d)));
 else if(m.leverage===null&&(m.investment>0||m.investmentDebt>0)&&m.investment-m.investmentDebt<=0)warnings.push(item('leverage-no-equity',`投資市值扣除投資用途負債為 ${money(m.investment-m.investmentDebt)}，無法計算有效的綜合市場槓桿。`));
 const stress=m.stress.find(x=>x.drop===30);if(stress.ok&&stress.equity<0)warnings.push(item('stress-negative',`目前選擇的${T.label(config)} −30% 情境下，投資淨值約為 ${money(stress.equity)}。`));
 if(g.required.kind==='aboveRange'||g.required.kind==='rate'&&g.required.rate>.12)warnings.push(item('required-high',`${g.label}（${g.basisLabel}目標），達標所需年化報酬${g.required.kind==='aboveRange'?'超過估算上限 100%':`約 ${pct(g.required.rate)}`}，高於積極 12% 情境。這只是數學假設。`));
 if(m.runway!==null&&m.runway>=d.minRunway&&m.runway<=d.minRunway*1.2)warnings.push(item('runway-near',`現金緩衝 ${num(m.runway)} 個月，接近你設定的 ${num(d.minRunway)} 個月最低門檻，尚有 ${num(m.runway-d.minRunway)} 個月空間。`));
 if(m.paymentRatio!==null&&m.paymentRatio>=d.maxPaymentRatio/100*.8&&m.paymentRatio<=d.maxPaymentRatio/100)warnings.push(item('payment-near',paymentText(m,d)));
 if(m.leverage!==null&&m.leverage>=d.maxLeverage*.8&&m.leverage<=d.maxLeverage)warnings.push(item('leverage-near',leverageText(m,d)));
 if(g.required.kind==='rate'&&g.required.rate<=.08||g.required.kind==='zero')positive.push(item('goal-accessible',`${g.label}（${g.basisLabel}目標），依目前${g.basisLabel}與投入${g.required.kind==='zero'?'即使不計投資報酬亦可達設定目標':`約需 ${pct(g.required.rate)} 年化報酬，處於保守／基準情境範圍`}。不保證未來結果。`));
 if(m.runway!==null&&m.runway>=d.minRunway&&m.paymentRatio!==null&&m.paymentRatio<=d.maxPaymentRatio/100&&(m.leverage!==null&&m.leverage<=d.maxLeverage||m.investment===0&&m.investmentDebt===0))positive.push(item('limits-ok',`現金緩衝 ${num(m.runway)} 月、月付比 ${pct(m.paymentRatio)}、綜合槓桿 ${m.leverage===null?'無投資':num(m.leverage)+'x'}，目前未超過個人警戒線。`));
 const missing=d.debts.filter(x=>x.balance>0&&x.annualRate===null).length;if(missing)review.push(item('rates-missing',`有 ${missing} 筆負債尚未填寫利率，補齊後即可估算利息成本。`));
 if(allocation.valid&&allocation.ratios.some((x,i)=>x!==null&&Math.abs(x-allocation.weights[i]/100)>1e-6))review.push(item('allocation-gap',`目前一般／槓桿／預備金為 ${allocation.ratios.map(pct).join('／')}，目標為 ${allocation.weights.map(x=>num(x)+'%').join('／')}，可查看新增資金再平衡。`));
 if(m.debt>0||m.investment>0)review.push(item('scenario-review',`目前總負債 ${money(m.debt)}、投資市值 ${money(m.investment)}，可用財務決策實驗室比較不同借款、還款與配置情境。`));
 if(!stress.ok)review.unshift(item('stress-invalid',T.ERROR));
 return {positive:positive.slice(0,3),warnings:warnings.slice(0,3),review:review.slice(0,3),goal:g};}
function paymentText(m,d){return `目前每月債務還款約占家庭平均月收入 ${pct(m.paymentRatio)}，${m.paymentRatio>d.maxPaymentRatio/100?'超過':'距離'}你設定的 ${num(d.maxPaymentRatio)}% 警戒線約 ${num(Math.abs(m.paymentRatio*100-d.maxPaymentRatio))} 個百分點。`;}
function leverageText(m,d){return `目前綜合市場槓桿 ${num(m.leverage)}x，${m.leverage>d.maxLeverage?'超過':'接近'}你設定的 ${num(d.maxLeverage)}x 警戒線，差約 ${num(Math.abs(m.leverage-d.maxLeverage))}x。`;}
// Analysis capabilities depend on valid values, never on the provided/touched-field history.
function analysisStatus(data,{draft=null,readBlocked=false,basis='investment'}={}){
 const issue=(id,text,step,focus,debtId)=>({id,text,step,focus,debtId}),coreIssues=[],goalIssues=[],advanced=[];
 const parse=(value,nullable=false)=>value===undefined||value===null?(nullable?null:0):String(value).trim()===''?(nullable?null:0):Number(String(value).normalize('NFKC').replace(/,/g,''));
 let coreValid=true;
 const debtRows=draft?.debts||data.debts;
 try{const core={...data,currentAge:0,targetAge:0,targetAssets:0,annualReturn:0,minRunway:6,maxPaymentRatio:40,maxLeverage:2,allocationGeneral:null,allocationLeveraged:null,allocationReserve:null};
  for(const key of [...C.cashKeys,'home','other','income','living','monthlyInvestment','regular','leveraged','multiplier'])if(draft?.fields&&Object.hasOwn(draft.fields,key))core[key]=parse(draft.fields[key]);
  if(Array.isArray(debtRows))core.debts=debtRows.map(row=>({...row,balance:parse(row.balance),monthlyPayment:parse(row.monthlyPayment),investmentAmount:parse(row.investmentAmount),annualRate:null,remainingMonths:null}));
  C.validateData(core);if(readBlocked)throw Error('既有資料讀取失敗');
 }catch(e){coreValid=false;coreIssues.push(issue('core-invalid',`目前有無法用於核心計算的資料：${e.message}。畫面保留最後有效數值，請先修正輸入。`,0,'cashDaily'));}
 const goalData={...data};for(const key of ['currentAge','targetAge','targetAssets','annualReturn'])if(draft?.fields&&Object.hasOwn(draft.fields,key))goalData[key]=parse(draft.fields[key]);
 if(!Number.isInteger(goalData.currentAge)||goalData.currentAge<=0||goalData.currentAge>120)goalIssues.push(issue('current-age',goalData.currentAge===0?'尚未設定目前年齡。':'請填寫有效的目前年齡。',1,'currentAge'));
 if(!Number.isInteger(goalData.targetAge)||goalData.targetAge<=goalData.currentAge||goalData.targetAge>120)goalIssues.push(issue('target-age',goalData.targetAge===0?'尚未設定目標年齡。':'目標年齡須晚於目前年齡，才可計算未來情境。',1,'targetAge'));
 if(!Number.isFinite(goalData.targetAssets)||goalData.targetAssets<=0)goalIssues.push(issue('target-assets',`尚未設定目標${basis==='financial'?'金融':'投資'}資產，請填寫大於 0 的目標金額。`,1,'targetAssets'));
 if(!Number.isFinite(goalData.annualReturn)||goalData.annualReturn< -99||goalData.annualReturn>100)goalIssues.push(issue('goal-return','請修正投資組合預期年化報酬率，才可計算自訂情境。',1,'annualReturn'));
 if(!coreValid)goalIssues.push(issue('goal-core','請先修正核心財務輸入，目標分析暫採最後有效數值。',0,'cashDaily'));
 const types={mortgage:'房貸',personalLoan:'信貸',car:'車貸',revolving:'卡循',other:'其他負債'},counts={};
 for(const debt of (Array.isArray(debtRows)?debtRows:[])){
  if(!Number.isFinite(parse(debt.balance))||parse(debt.balance)<=0)continue;
  const type=types[debt.type]||'負債';counts[type]=(counts[type]||0)+1;const name=typeof debt.name==='string'&&debt.name.trim()?debt.name.trim():`${type} ${counts[type]}`,rate=parse(debt.annualRate,true),months=parse(debt.remainingMonths,true);
  if(rate===null)advanced.push(issue('rate-'+debt.id,`${name} 尚未填寫年利率；補利率後可估算加權平均利率與一年利息成本。`,0,'annualRate',debt.id));
  else if(!Number.isFinite(rate)||rate<0||rate>100)advanced.push(issue('rate-'+debt.id,`${name} 年利率請填 0～100% 或留白；目前利息分析採最後有效數值。`,0,'annualRate',debt.id));
  if(months===null)advanced.push(issue('months-'+debt.id,`${name} 尚未填寫剩餘期數；部分貸款時間分析會較有限，不影響目前財務體質計算。`,0,'remainingMonths',debt.id));
  else if(!Number.isInteger(months)||months<0||months>1200)advanced.push(issue('months-'+debt.id,`${name} 剩餘期數請填 0～1200 的整數或留白，不影響目前財務體質計算。`,0,'remainingMonths',debt.id));
 }
 for(const[key,min,max]of [['minRunway',.1,120],['maxPaymentRatio',.1,100],['maxLeverage',.1,100]]){const value=draft?.fields&&Object.hasOwn(draft.fields,key)?parse(draft.fields[key]):data[key];if(!Number.isFinite(value)||value<min||value>max)advanced.push(issue('setting-'+key,'個人警戒設定有尚未完成的輸入，目前沿用最後有效設定。',2,key));}
 const allocationData={...data};for(const key of ['allocationGeneral','allocationLeveraged','allocationReserve'])if(draft?.fields&&Object.hasOwn(draft.fields,key))allocationData[key]=parse(draft.fields[key],true);
 const alloc=C.allocation(allocationData);if(!alloc.valid||alloc.weights.some(x=>x!==null&&(!Number.isFinite(x)||x<0||x>100)))advanced.push(issue('target-allocation',alloc.kind==='unset'?'尚未設定目標投資配置；設定後可以使用投資池的新增資金再平衡分析。':'目標投資配置合計需為 100%，各比例需介於 0%～100%；僅影響再平衡分析。',2,'allocationGeneral'));
 const count=coreIssues.length+goalIssues.length+advanced.length;
 return {core:{ready:coreValid,text:coreValid?'資產、負債、收入與支出資料已足以計算目前財務體質。合法的 0 或空白視為沒有該項目，不需補填。':'核心財務分析暫採最後有效數值。',issues:coreIssues},goal:{ready:goalIssues.length===0,text:goalIssues.length?'補充下列設定後，即可使用對應目標分析。':'已可計算目標進度、未來情境與達標所需報酬率。',issues:goalIssues},advanced,count};
}
const PROMPT=`請以家庭財務規劃與風險管理角度分析以下資料。

請：
1. 先摘要目前財務體質。
2. 分別分析：流動性、負債壓力、每月現金流、投資槓桿、財務目標。
3. 找出最值得優先檢視的 3 項事情。
4. 判斷目前財務目標是否依賴偏高的投資報酬假設。
5. 解讀市場壓力測試。
6. 若資料不足，請指出缺少哪些資料，不要自行猜測。
7. 不推薦特定股票、ETF 或金融商品。
8. 將內容分成：「目前較有餘裕」「需留意」「可以模擬看看」。
9. 如果提出改善方向，請提供可比較的情境，而不是直接叫我採取某一項投資行動。

以下為財務資料：`;
function exportAI(data,{privacy=true,settings=T.defaults(),year,basis='investment'}={}){const d=C.derived(data),m=S.metrics(data,settings,undefined,basis),g=goal(data,year,basis),a=C.allocation(data),rr=g.required,lines=[PROMPT,'',privacy?'【隱私模式：僅比例與分類】':'【完整模式：負債名稱已匿名化】',`目前年齡：${d.currentAge} 歲`,`目標年齡：${d.targetAge} 歲`,g.label,`目標類型：${g.basisLabel}目標`,`目標計算基準：${g.basisLabel}`,basis==='financial'?'現金以 0% 成長；只有投資資產與每月投入依投資組合報酬假設成長。':'現金不納入目標與投資報酬試算；只有投資資產與每月投入參與。',`距離目標：${g.years>0?g.years+' 年':'無未來期間'}`,`財務目標完成率：${pct(g.completion)}`,`達標所需年化報酬率：${rr.kind==='rate'?pct(rr.rate):rr.kind==='zero'?'不計報酬亦可達標':rr.kind==='aboveRange'?'超過 100% 估算範圍':'資料不足或無未來期間'}`,`現金緩衝：${m.runway===null?'無支出，未計算':num(m.runway)+' 個月'}`,`負債／資產：${pct(m.assets>0?m.debt/m.assets:null)}`,`債務月付 / 平均月收入：${pct(m.paymentRatio)}`,`平均每月結餘（扣固定投資後）：${m.balance>0?'正':m.balance<0?'負':'接近損益兩平'}`,`投資用途負債／投資市值：${pct(m.investment>0?m.investmentDebt/m.investment:null)}`,`投資內含曝險倍數：${num(m.embedded)}x`,`綜合市場槓桿：${num(m.leverage)}x`,`投資池目前配置（一般／槓桿／預備金）：${a.ratios.map(pct).join('／')}`,`投資池目標配置（一般／槓桿／預備金）：${a.valid?a.weights.map(x=>num(x)+'%').join('／'):'未設定有效的 100% 配置'}`,`自訂警戒線：最低緩衝 ${num(d.minRunway)} 月／最高月付比 ${num(d.maxPaymentRatio)}%／最高槓桿 ${num(d.maxLeverage)}x`,`壓力模型：${T.label(settings)}`];
 if(!privacy){for(const[label,value]of [['家庭年收入',d.income],['每月生活支出',d.living],['每月固定投資',d.monthlyInvestment],['現金總額',d.cash],['生活緩衝現金',d.cashBuffer],['金融資產',m.financial],['股票 / ETF 投資資產',m.investment],['一般投資',d.regular],['槓桿投資',d.leveraged],['投資預備金',d.cashInvestmentReserve],['房屋',d.home],['其他資產',d.other],['總資產',m.assets],['總負債',m.debt],['淨資產',m.net],['每月債務還款',m.payments],['投資用途負債',m.investmentDebt],[`目前目標基準資產（${g.basisLabel}）`,g.currentGoalAssets],[`目標${g.basisLabel}`,d.targetAssets],['距離目標尚差',g.gap],[`目標年份預估${g.basisLabel}`,g.projected]])lines.push(`${label}：${money(value)}`);
 lines.push(`投資組合預期年化報酬率：${num(d.annualReturn)}%`);const counts={},types={mortgage:'房貸',personalLoan:'信貸',car:'車貸',revolving:'卡循',other:'其他負債'};for(const debt of d.debts){const type=types[debt.type];counts[type]=(counts[type]||0)+1;lines.push(`${type} ${counts[type]}：餘額 ${money(debt.balance)}；年利率 ${debt.annualRate===null?'未填':num(debt.annualRate)+'%'}；月付 ${money(debt.monthlyPayment)}；剩餘 ${debt.remainingMonths===null?'未填':debt.remainingMonths+' 月'}；投資用途 ${money(debt.investmentAmount)}`);}}
 for(const drop of [20,30,50]){const r=m.stress.find(x=>x.drop===drop);lines.push(`大盤 −${drop}%：${!r.ok?T.ERROR:privacy?`投資淨值${r.equity>0?'仍為正':r.equity<0?'為負':'為零'}；整體淨資產變化 ${m.net!==0?pct((r.net-m.net)/Math.abs(m.net)):'基期為零，無法計算比例'}`:`槓桿 ETF 模擬 ${pct(r.leveragedReturn)}；投資市值 ${money(r.value)}；投資淨值 ${money(r.equity)}；整體淨資產 ${money(r.net)}`}`);}
 lines.push('平均月收入以家庭年收入 ÷ 12 計算；若收入波動較大，債務月付比僅作年度平均參考。平均每月結餘扣除生活支出、債務還款與固定投資。','投資池 = 股票 / ETF 投資資產 + 投資預備金；投資預備金仍屬現金，不重複計入總資產。','模型為簡化數學情境，未含實際市場路徑、追蹤誤差、稅費、融資成本及產品機制；不是預測或投資建議。','未提供生日、收入穩定度、保險及完整稅費；缺少資料請勿推測。');return lines.join('\n');}
const api={goal,analyze,exportAI,analysisStatus,PROMPT};if(node)module.exports=api;else root.HealthAnalysis=api;
})(typeof window!=='undefined'?window:globalThis);
