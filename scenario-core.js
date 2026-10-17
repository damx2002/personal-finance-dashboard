/* V4 pure scenario engine. Never reads/writes storage and never mutates the baseline. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./v3-core.js'):root.FinanceCore;
const T=typeof module!=='undefined'&&module.exports?require('./stress-core.js'):root.StressCore;
const KEY='personal-finance-dashboard.scenarios.v4';
const cashKeys=C.cashKeys, types=['borrow','repay','expense','income','annualIncome','living','monthlyInvestment','trade'];
const copy=C.clone;
function number(v,label,min=0,max=1e15){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}請輸入 ${min} 到 ${max} 之間的有效數字`);return v;}
function text(v,label,max=80){if(typeof v!=='string'||v.length>max)throw Error(`${label}格式不正確`);return v;}
function choice(v,values,label){if(!values.includes(v))throw Error(`${label}格式不正確`);return v;}
function payment(principal,annualRate,months){number(principal,'本金',0);number(annualRate,'貸款年利率',0,100);number(months,'期限',1,1200);if(!Number.isInteger(months))throw Error('期限請填整數月數');const r=annualRate/1200;return r===0?principal/months:principal*r/(-Math.expm1(-months*Math.log1p(r)));}
function validateAction(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('變動格式不正確');const a={id:text(raw.id,'變動識別碼',100),type:choice(raw.type,types,'變動類型')};if(!a.id)throw Error('變動識別碼不可空白');
 const num=(k,label,min=0,max=1e15)=>a[k]=number(raw[k],label,min,max);
 if(a.type==='borrow'){
  a.name=text(raw.name,'借款名稱');num('principal','借款本金',.01);num('annualRate','年利率',0,100);num('months','期限',1,1200);if(!Number.isInteger(a.months))throw Error('期限請填整數月數');num('fee','一次性費用');if(a.fee>a.principal)throw Error('費用不能超過借款本金');a.purpose=choice(raw.purpose,['investment','cash','expense','mixed'],'借款用途');if(typeof raw.manualPayment!=='boolean')throw Error('月付金計算方式不正確');a.manualPayment=raw.manualPayment;if(a.manualPayment)num('monthlyPayment','自行輸入月付金');else a.monthlyPayment=payment(a.principal,a.annualRate,a.months);
  for(const k of ['general','leveraged','reserve']){if(['investment','mixed'].includes(a.purpose))num(k,'借款用途金額');else a[k]=0;}
  a.spending=a.purpose==='mixed'?number(raw.spending,'借款支出'):a.purpose==='expense'?a.principal-a.fee:0;
  if(a.general+a.leveraged+a.reserve+a.spending>a.principal-a.fee+1e-7)throw Error('用途金額加總不能超過扣除費用後可用本金');
 }else if(a.type==='repay'){a.debtId=text(raw.debtId,'負債識別碼',120);num('amount','提前還本金');a.source=choice(raw.source,[...cashKeys,'other'],'資金來源');}
 else if(a.type==='expense'){a.name=text(raw.name,'支出名稱');num('amount','支出金額');a.source=choice(raw.source,cashKeys,'支出來源');}
 else if(a.type==='income'){num('amount','一次性收入');a.destination=choice(raw.destination,cashKeys,'存放分類');a.origin=choice(raw.origin||'new',['new','home','other','regular','leveraged'],'收入來源');}
 else if(a.type==='annualIncome'){a.mode=choice(raw.mode,['amount','percent'],'收入調整方式');num('change','收入變化',a.mode==='percent'?-100:-1e15,a.mode==='percent'?1000:1e15);}
 else if(a.type==='living')num('change','每月支出變化',-1e15);
 else if(a.type==='monthlyInvestment')num('amount','每月固定投入');
 else{for(const k of ['general','leveraged','reserve'])num(k,'部位增減',-1e15);if(Math.abs(a.general+a.leveraged+a.reserve)>.000001)throw Error('部位增減加總必須為 0，不能憑空增加資產');}
 return a;
}
function validateActions(actions){if(!Array.isArray(actions)||actions.length>50)throw Error('每個情境最多 50 個變動');const ids=new Set();return actions.map(a=>{const item=validateAction(a);if(ids.has(item.id))throw Error('變動識別碼重複');ids.add(item.id);return item;});}
function apply(baseline,actions){
 const d=C.validateData(copy(baseline)),list=validateActions(actions),notes=[];
 for(let i=0;i<list.length;i++){const a=list[i];try{
  if(a.type==='borrow'){
   const free=a.principal-a.fee-a.general-a.leveraged-a.reserve-a.spending;d.regular+=a.general;d.leveraged+=a.leveraged;d.cashInvestmentReserve+=a.reserve;d.cashDaily+=Math.max(0,free);
   const id=`scenario-${a.id}`;if(d.debts.some(x=>x.id===id))throw Error('借款識別碼與目前負債重複');
   d.debts.push({id,name:a.name||'模擬新增借款',type:'personalLoan',balance:a.principal,annualRate:a.annualRate,monthlyPayment:a.monthlyPayment,remainingMonths:a.months,investmentAmount:a.general+a.leveraged});
   notes.push('借款費用自本金扣除；未分配餘額放入日常現金。借款保留為預備金尚未投入市場，不列入投資用途負債。');
  }else if(a.type==='repay'){
   const debt=d.debts.find(x=>x.id===a.debtId);if(!debt)throw Error('找不到該筆負債，正式資料可能已更新');if(a.amount>debt.balance)throw Error('提前還本金不能超過目前餘額');if(a.amount>d[a.source])throw Error('資金來源餘額不足');
   const ratio=debt.balance===0?0:(debt.balance-a.amount)/debt.balance;d[a.source]-=a.amount;debt.balance-=a.amount;debt.investmentAmount*=ratio;if(debt.balance===0){debt.monthlyPayment=0;debt.remainingMonths=0;}
   notes.push('部分提前還款預設月付不變，僅完全清償才歸零；投資用途負債按本金同比例下降。其他來源視為同步減少其他資產，未計提前清償費。');
  }else if(a.type==='expense'){if(a.amount>d[a.source])throw Error('支出來源餘額不足，現金不能為負');d[a.source]-=a.amount;}
  else if(a.type==='income'){if(a.origin!=='new'){if(a.amount>d[a.origin])throw Error('出售金額超過該類目前資產');d[a.origin]-=a.amount;}d[a.destination]+=a.amount;}
  else if(a.type==='annualIncome')d.income=a.mode==='percent'?d.income*(1+a.change/100):d.income+a.change;
  else if(a.type==='living')d.living+=a.change;
  else if(a.type==='monthlyInvestment')d.monthlyInvestment=a.amount;
  else{d.regular+=a.general;d.leveraged+=a.leveraged;d.cashInvestmentReserve+=a.reserve;}
  C.validateData(d);
 }catch(e){throw Error(`變動 ${i+1}：${e.message}`);}}
 return {data:C.validateData(d),notes:[...new Set(notes)]};
}
function metrics(data,config=T.defaults(),paths,basis='investment'){const d=C.derived(data),investment=d.regular+d.leveraged,assets=d.cash+d.home+d.other+investment,debt=d.mortgage+d.loan,payments=d.mortgagePayment+d.loanPayment,spending=d.living+payments,exposure=d.regular+d.leveraged*d.multiplier,equity=investment-d.investmentDebt;
 return {assets,debt,net:assets-debt,financial:d.cash+investment,runway:spending>0?d.cashBuffer/spending:null,paymentRatio:d.income>0?payments/(d.income/12):null,balance:d.income/12-spending-d.monthlyInvestment,payments,investmentDebt:d.investmentDebt,investment,embedded:investment>0?exposure/investment:null,leverage:equity>0?exposure/equity:null,required:C.requiredReturn(data,basis),stress:[10,20,30,40,50].map((drop,i)=>T.stressScenario({data,drawdown:drop/100,...config},paths?.[i]))};}
function compare(baseline,actions,config=T.defaults(),basis='investment'){const baselineCopy=copy(baseline),result=apply(baselineCopy,actions),s=T.settings(config),paths=s.model==='linear'?null:[10,20,30,40,50].map(drop=>T.buildPath(drop/100,s));return {baseline:metrics(baselineCopy,s,paths,basis),scenario:metrics(result.data,s,paths,basis),notes:result.notes};}
function validateStore(raw){if(!Array.isArray(raw)||raw.length>20)throw Error('最多保存 20 個情境');const ids=new Set();return raw.map(s=>{if(!s||typeof s!=='object'||Array.isArray(s))throw Error('情境格式不正確');const id=text(s.id,'情境識別碼',100);if(!id||ids.has(id))throw Error('情境識別碼空白或重複');ids.add(id);const name=text(s.name,'情境名稱');if(!name.trim())throw Error('請輸入情境名稱');for(const k of ['createdAt','updatedAt'])if(typeof s[k]!=='string'||!Number.isFinite(Date.parse(s[k])))throw Error('情境日期不正確');return {id,name,createdAt:s.createdAt,updatedAt:s.updatedAt,actions:validateActions(s.actions)};});}
function upsert(store,item){const list=validateStore(store),found=list.findIndex(x=>x.id===item.id);if(found<0&&list.length>=20)throw Error('最多保存 20 個情境');if(found>=0)list[found]=item;else list.push(item);return validateStore(list);}
function loanComparison(raw,annualReturn=raw.investmentReturn,firstYearReturn=null){
 const p=number(raw.principal,'借款本金',.01),apr=number(raw.annualRate,'貸款年利率',0,100),months=number(raw.months,'期限',1,1200),fee=number(raw.fee,'費用');if(!Number.isInteger(months))throw Error('期限請填整數月數');if(fee>p)throw Error('費用不能超過本金');number(annualReturn,'投資年化報酬',-99,100);if(firstYearReturn!==null)number(firstYearReturn,'初年報酬',-99,100);
 const pay=payment(p,apr,months),loanRate=apr/1200,series=[];let balance=p,accountA=p,accountB=0;
 for(let m=1;m<=120;m++){const yearRate=m<=12&&firstYearReturn!==null?firstYearReturn:annualReturn,r=Math.expm1(Math.log1p(yearRate/100)/12);accountA*=1+r;accountB*=1+r;
  let actual=0;if(m<=months){const interest=balance*loanRate;actual=Math.min(pay,balance+interest);balance=Math.max(0,balance+interest-actual);}accountA+=Math.max(0,pay-actual);accountB+=pay;
  const a=accountA-balance-fee,b=accountB;series.push({month:m,a,b,difference:a-b,accountA,accountB,remainingBalance:balance});}
 return {payment:pay,totalInterest:Math.max(0,pay*months-p),fee,financingCost:Math.max(0,pay*months-p)+fee,series,checkpoints:[12,36,60,120].map(m=>series[m-1])};
}
const api={KEY,types,validateAction,validateActions,validateStore,upsert,payment,apply,metrics,compare,loanComparison};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScenarioCore=api;
})(typeof window!=='undefined'?window:globalThis);
