/* Pure local calculations and version migration; no DOM or network dependencies. */
(function(root){
'use strict';
const cashKeys=['cashDaily','cashEmergency','cashInvestmentReserve','cashEarmarked'];
const scalarDefaults={cashDaily:0,cashEmergency:0,cashInvestmentReserve:0,cashEarmarked:0,home:0,other:0,income:0,living:0,monthlyInvestment:0,regular:0,leveraged:0,multiplier:2,currentAge:0,targetAge:0,targetAssets:0,annualReturn:0,minRunway:6,maxPaymentRatio:40,maxLeverage:2,allocationGeneral:null,allocationLeveraged:null,allocationReserve:null};
const clone=x=>JSON.parse(JSON.stringify(x));
function defaults(){return {...scalarDefaults,debts:[],bufferIncludes:{cashDaily:true,cashEmergency:true,cashInvestmentReserve:false,cashEarmarked:false}};}
function validNumber(v,min=0,max=1e15){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
function validateData(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Object.hasOwn(raw,'cashDaily'))throw Error('財務資料格式不正確');
 const d=defaults();
 for(const key of Object.keys(scalarDefaults)){
  const v=raw[key]===undefined?scalarDefaults[key]:raw[key];
  if(key.startsWith('allocation')&&v===null){d[key]=null;continue;}
  const min=key==='annualReturn'?-99:['minRunway','maxPaymentRatio','maxLeverage'].includes(key)?.1:key==='multiplier'?1:0;
  const max=key.endsWith('Age')?120:key==='annualReturn'||key.startsWith('allocation')||['maxPaymentRatio','maxLeverage'].includes(key)?100:key==='minRunway'?120:1e15;
  if(!validNumber(v,min,max)||(key.endsWith('Age')&&!Number.isInteger(v)))throw Error(`「${key}」請輸入有效範圍內的數字`);
  d[key]=v;
 }
 if(!raw.bufferIncludes||cashKeys.some(k=>typeof raw.bufferIncludes[k]!=='boolean'))throw Error('生活緩衝分類設定不正確');
 d.bufferIncludes={...raw.bufferIncludes};
 if(!Array.isArray(raw.debts)||raw.debts.length>100)throw Error('負債明細格式不正確或超過 100 筆');
 const ids=new Set();d.debts=raw.debts.map(item=>{
  if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id))throw Error('負債識別碼不正確或重複');ids.add(item.id);
  if(typeof item.name!=='string'||item.name.length>80||!['mortgage','personalLoan','car','revolving','other'].includes(item.type))throw Error('負債名稱或類型不正確');
  for(const key of ['balance','monthlyPayment','investmentAmount'])if(!validNumber(item[key]))throw Error('負債金額請輸入有效的非負數字');
  if(item.investmentAmount>item.balance)throw Error('投資用途金額不能超過該筆負債餘額');
  if(item.annualRate!==null&&!validNumber(item.annualRate,0,100))throw Error('年利率請填 0 到 100%，或留白');
  if(item.remainingMonths!==null&&(!validNumber(item.remainingMonths,0,1200)||!Number.isInteger(item.remainingMonths)))throw Error('剩餘月數請填 0 到 1200 的整數，或留白');
  return {id:item.id,name:item.name,type:item.type,balance:item.balance,annualRate:item.annualRate,monthlyPayment:item.monthlyPayment,remainingMonths:item.remainingMonths,investmentAmount:item.investmentAmount};
 });
 if(d.targetAssets>0&&d.targetAge<d.currentAge)throw Error('目標年齡不能小於目前年齡');
 return d;
}
function derived(d){
 if(!Object.hasOwn(d,'cashDaily'))return d;
 const cash=cashKeys.reduce((s,k)=>s+d[k],0),cashBuffer=cashKeys.reduce((s,k)=>s+(d.bufferIncludes[k]?d[k]:0),0);
 const mortgage=d.debts.filter(x=>x.type==='mortgage'),other=d.debts.filter(x=>x.type!=='mortgage');
 const sum=(a,k)=>a.reduce((s,x)=>s+x[k],0);
 return {...d,cash,cashBuffer,mortgage:sum(mortgage,'balance'),loan:sum(other,'balance'),mortgagePayment:sum(mortgage,'monthlyPayment'),loanPayment:sum(other,'monthlyPayment'),investmentDebt:sum(d.debts,'investmentAmount')};
}
function debtSummary(d){const total=d.debts.reduce((s,x)=>s+x.balance,0),missing=d.debts.some(x=>x.balance>0&&x.annualRate===null);const interest=missing?null:d.debts.reduce((s,x)=>s+x.balance*(x.annualRate||0)/100,0);return {total,payments:d.debts.reduce((s,x)=>s+x.monthlyPayment,0),investmentDebt:d.debts.reduce((s,x)=>s+x.investmentAmount,0),interest,weightedRate:total>0&&interest!==null?interest/total*100:null};}
function futureValue(principal,monthly,months,annual){const log=Math.log1p(annual)/12,growth=Math.exp(log*months),annuity=log===0?months:Math.expm1(log*months)/Math.expm1(log);return principal*growth+monthly*annuity;}
function requiredReturn(d){
 const p=derived(d).cash+d.regular+d.leveraged,n=(d.targetAge-d.currentAge)*12,t=d.targetAssets,c=d.monthlyInvestment;
 if(t<=0)return {kind:'unset'};if(n<=0)return {kind:'noTime'};
 if(futureValue(p,c,n,0)>=t)return {kind:'zero',rate:0};
 if(p===0&&c===0)return {kind:'noCapital'};
 let low=0,high=1; // Bound at 100% annual; above this is reported without inventing a number.
 if(futureValue(p,c,n,high)<t)return {kind:'aboveRange'};
 for(let i=0;i<100;i++){const mid=(low+high)/2;if(futureValue(p,c,n,mid)<t)low=mid;else high=mid;}
 const rate=high,label=rate<.05?'低於目前保守情境':rate<=.08?'介於保守與基準情境':rate<=.12?'介於基準與積極情境':'高於目前積極情境';return {kind:'rate',rate,label};
}
function allocation(d){
 const current=[d.regular,d.leveraged,d.cashInvestmentReserve],total=current.reduce((a,b)=>a+b,0),weights=[d.allocationGeneral,d.allocationLeveraged,d.allocationReserve];
 const supplied=weights.every(x=>x!==null),valid=supplied&&Math.abs(weights.reduce((a,b)=>a+b,0)-100)<1e-8;
 const result={current,total,ratios:current.map(x=>total>0?x/total:null),weights,valid,supplied};
 if(!valid)return {...result,kind:supplied?'invalid':'unset'};
 const w=weights.map(x=>x/100);
 const impossible=w.some((x,i)=>x===0&&current[i]>0);
 const finalTotal=Math.max(total,...current.map((x,i)=>w[i]>0?x/w[i]:0));
 if(!Number.isFinite(finalTotal))return {...result,kind:'aboveRange'};
 const additions=current.map((x,i)=>Math.max(0,w[i]*finalTotal-x));
 // Current-pool deficits exclude already-overweight classes. At target (or empty), new funds follow target weights.
 const gaps=current.map((x,i)=>Math.max(0,w[i]*total-x)),gapTotal=gaps.reduce((a,b)=>a+b,0);
 const proportions=gapTotal>1e-8?gaps.map(x=>x/gapTotal):w;
 const cents=Math.round(d.monthlyInvestment*100),raw=proportions.map(x=>x*cents),units=raw.map(Math.floor);let remaining=cents-units.reduce((a,b)=>a+b,0);
 const order=raw.map((x,i)=>({i,remainder:x-units[i]})).sort((a,b)=>b.remainder-a.remainder);
 for(let i=0;i<remaining;i++)units[order[i%3].i]++;
 if(impossible)return {...result,kind:'impossible',monthly:units.map(x=>x/100)};
 return {...result,kind:'valid',finalTotal,additions,additionalCapitalRequired:Math.max(0,finalTotal-total),monthly:units.map(x=>x/100)};
}
const aliases={cash:'cashDaily',mortgageBalance:'mortgage',monthlyMortgagePayment:'mortgagePayment',personalLoanBalance:'loan',monthlyLoanPayment:'loanPayment',investmentLoanBalance:'investmentDebt'};
function legacyData(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!['cash','mortgage','mortgageBalance','regular'].some(k=>Object.hasOwn(raw,k)))throw Error('舊版資料格式不正確');
 const old={...raw};for(const[a,b]of Object.entries(aliases))if(old[b]===undefined&&old[a]!==undefined)old[b]=old[a];
 const d=defaults();for(const k of Object.keys(scalarDefaults))if(old[k]!==undefined)d[k]=old[k];d.cashDaily=old.cash??old.cashDaily??0;
 const add=(name,type,balance,payment,investment)=>{if(balance||payment||investment)d.debts.push({id:type==='mortgage'?'legacy-mortgage':'legacy-personal',name,type,balance:balance||0,monthlyPayment:payment||0,investmentAmount:investment||0,annualRate:null,remainingMonths:null});};
 add('房貸','mortgage',old.mortgage,old.mortgagePayment,0);add('信貸','personalLoan',old.loan,old.loanPayment,old.investmentDebt);
 return validateData(d);
}
function emptyEnvelope(){return {dataVersion:3,schemaVersion:3,data:defaults(),snapshots:[],savedAt:null,draft:null,provided:[],wizardStep:0,setupInProgress:false};}
function migrate(raw){
 if(raw?.dataVersion===3)return clone(raw);
 if(raw?.dataVersion!==undefined&&![1,2].includes(raw.dataVersion))throw Error('不支援的資料版本');
 if(raw?.schemaVersion!==undefined&&![1,2].includes(raw.schemaVersion))throw Error('不支援的資料版本');
 const old=([1,2].includes(raw?.schemaVersion)||[1,2].includes(raw?.dataVersion)||(raw?.data&&raw.schemaVersion===undefined))?raw.data:raw;const result={...emptyEnvelope(),data:legacyData(old),snapshots:raw.snapshots||[],savedAt:raw.savedAt||raw.lastSavedAt||null,migratedFrom:raw.dataVersion||raw.schemaVersion||1};
 result.provided=Object.keys(scalarDefaults).filter(k=>Object.hasOwn(old,k)||k==='cashDaily');
 if(raw.draft){
  const values={};for(const[k,v]of Object.entries(raw.draft)){const key=k==='cash'?'cashDaily':k;if(Object.hasOwn(scalarDefaults,key))values[key]=String(v);}
  if(['mortgage','mortgagePayment'].some(k=>raw.draft[k]!==undefined)&&!result.data.debts.some(x=>x.type==='mortgage'))result.data.debts.push({id:'legacy-mortgage',name:'房貸',type:'mortgage',balance:0,monthlyPayment:0,investmentAmount:0,annualRate:null,remainingMonths:null});
  if(['loan','loanPayment','investmentDebt'].some(k=>raw.draft[k]!==undefined)&&!result.data.debts.some(x=>x.type==='personalLoan'))result.data.debts.push({id:'legacy-personal',name:'信貸',type:'personalLoan',balance:0,monthlyPayment:0,investmentAmount:0,annualRate:null,remainingMonths:null});
  const debtDraft=result.data.debts.map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v===null?'':String(v)])));
  for(const item of debtDraft){const mortgage=item.type==='mortgage';for(const[k,source]of Object.entries({balance:mortgage?'mortgage':'loan',monthlyPayment:mortgage?'mortgagePayment':'loanPayment',investmentAmount:mortgage?null:'investmentDebt'}))if(source&&raw.draft[source]!==undefined)item[k]=raw.draft[source];}
  result.draft={fields:values,debts:debtDraft};
 }
 return result;
}
const api={cashKeys,scalarDefaults,defaults,validateData,derived,debtSummary,futureValue,requiredReturn,allocation,migrate,emptyEnvelope,clone};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinanceCore=api;
})(typeof window!=='undefined'?window:globalThis);
