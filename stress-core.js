/* Deterministic stress models: pure functions, no storage, DOM or network. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./v3-core.js'):root.FinanceCore;
const KEY='personal-finance-dashboard.stress-settings',ERROR='此波動與跌幅設定無法產生有效示意路徑。';
const defaults=()=>({model:'dailyReset',path:'smooth',days:60,volatility:1});
function settings(raw=defaults()){if(!raw||!['dailyReset','linear'].includes(raw.model)||!['smooth','volatile'].includes(raw.path)||![20,60,120].includes(raw.days)||!Number.isFinite(raw.volatility)||raw.volatility<0||raw.volatility>25)throw Error(ERROR);return {model:raw.model,path:raw.path,days:raw.days,volatility:raw.volatility};}
function check(drawdown,days){if(!Number.isFinite(drawdown)||drawdown<0||drawdown>=1||!Number.isInteger(days)||days<1||days>1200)throw Error(ERROR);}
function buildSmoothPath({drawdown,days}){check(drawdown,days);return Array(days).fill(Math.expm1(Math.log1p(-drawdown)/days));}
function buildVolatilePath({drawdown,days,volatility}){check(drawdown,days);if(!Number.isFinite(volatility)||volatility<0||volatility>25)throw Error(ERROR);const v=volatility/100,osc=Array.from({length:days},(_,i)=>i%2?-v:v),target=Math.log1p(-drawdown);let low=-1+v+1e-12,high=1+v;
 const logAt=d=>osc.reduce((s,x)=>s+Math.log1p(d+x),0);
 if(logAt(low)>target||logAt(high)<target)throw Error(ERROR);
 for(let i=0;i<120;i++){const mid=(low+high)/2;if(logAt(mid)<target)low=mid;else high=mid;}
 const result=osc.map(x=>(low+high)/2+x);if(result.some(x=>!Number.isFinite(x)||x<=-1)||Math.abs(logAt((low+high)/2)-target)>1e-8)throw Error(ERROR);return result;
}
function simulateLeveragedPath({dailyReturns,multiplier}){if(!Array.isArray(dailyReturns)||!dailyReturns.length||!Number.isFinite(multiplier)||multiplier<0||multiplier>1000)throw Error(ERROR);let growth=1;for(const r of dailyReturns){if(!Number.isFinite(r)||r<=-1)throw Error(ERROR);growth*=Math.max(0,1+multiplier*r);if(!Number.isFinite(growth))throw Error(ERROR);}return {growth,return:growth-1};}
function buildPath(drawdown,config){const s=settings(config);return s.path==='smooth'?buildSmoothPath({drawdown,days:s.days}):buildVolatilePath({drawdown,days:s.days,volatility:s.volatility});}
function stressScenario({data,drawdown,...raw},dailyReturns){try{const s=settings(Object.keys(raw).length?raw:defaults());if(!Number.isFinite(drawdown)||drawdown<0||drawdown>1)throw Error(ERROR);const d=C.derived(data),investment=d.regular+d.leveraged,assets=d.cash+investment+d.home+d.other,debt=d.mortgage+d.loan;
 for(const n of [d.regular,d.leveraged,d.multiplier,d.investmentDebt,assets,debt])if(!Number.isFinite(n)||n<0)throw Error(ERROR);
 const path=s.model==='linear'?null:(dailyReturns||buildPath(drawdown,s));
 const growth=s.model==='linear'?Math.max(0,1-d.multiplier*drawdown):simulateLeveragedPath({dailyReturns:path,multiplier:d.multiplier}).growth;
 const indexGrowth=path?path.reduce((v,r)=>v*(1+r),1):1-drawdown;
 if(!Number.isFinite(indexGrowth)||Math.abs(indexGrowth-(1-drawdown))>1e-8)throw Error(ERROR);
 const value=Math.max(0,d.regular*indexGrowth+d.leveraged*growth),net=assets-debt-investment+value;
 if(![value,net,growth].every(Number.isFinite))throw Error(ERROR);
 return {ok:true,drop:drawdown*100,value,equity:value-d.investmentDebt,net,leveragedReturn:growth-1,indexGrowth,dailyReturns:path};
 }catch{return {ok:false,error:ERROR,drop:Number.isFinite(drawdown*100)?drawdown*100:null,value:null,equity:null,net:null,leveragedReturn:null};}}
function linearStress(data,drawdown){return stressScenario({data,drawdown,...defaults(),model:'linear'});}
function dailyResetSmoothStress(data,drawdown,days=60){return stressScenario({data,drawdown,...defaults(),days});}
function dailyResetVolatileStress(data,drawdown,days=60,volatility=1){return stressScenario({data,drawdown,...defaults(),path:'volatile',days,volatility});}
function solveBreakEvenDrawdown({data,...raw}){try{const s=settings(Object.keys(raw).length?raw:defaults()),d=C.derived(data);if(d.regular+d.leveraged===0&&d.investmentDebt===0)return {kind:'empty'};const at=x=>stressScenario({data,drawdown:x,...s});const start=at(0);if(!start.ok)return {kind:'error',error:ERROR};if(start.equity<=0)return {kind:'found',drawdown:0};let low=0,high=s.model==='linear'?1:.99;const end=at(high);if(!end.ok)return {kind:'error',error:ERROR};if(end.equity>0)return {kind:'none'};for(let i=0;i<80;i++){const mid=(low+high)/2,r=at(mid);if(!r.ok)return {kind:'error',error:ERROR};if(r.equity>0)low=mid;else high=mid;}return {kind:'found',drawdown:high};}catch{return {kind:'error',error:ERROR};}}
function label(raw){const s=settings(raw);return s.model==='linear'?'線性曝險模型':`每日重置・${s.days} 日・${s.path==='smooth'?'平滑':`波動 ${s.volatility}%`}`;}
const api={KEY,ERROR,defaults,settings,buildSmoothPath,buildVolatilePath,buildPath,simulateLeveragedPath,stressScenario,linearStress,dailyResetSmoothStress,dailyResetVolatileStress,solveBreakEvenDrawdown,label};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StressCore=api;
})(typeof window!=='undefined'?window:globalThis);
