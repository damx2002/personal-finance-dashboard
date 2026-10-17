/* V4.1.2 UI guidance and ephemeral calculator. Financial data is never written here. */
(()=>{'use strict';
const C=FinanceCore;
const guide={
 cashDaily:['一般活存、薪轉帳戶與近期可自由使用的現金。','填現在可自由動用、沒有特定用途的現金。若某筆錢已預留給投資、學費、旅遊、稅金或其他用途，請放到對應的現金分類，不要重複計算。'],
 cashEmergency:['專門保留給收入中斷、醫療或突發事件的現金。','這筆錢預設計入生活現金緩衝。如果實際上不希望動用，可在進階設定取消勾選。'],
 cashInvestmentReserve:['等待投資機會使用的現金；預設不計入生活緩衝。','這筆錢仍屬於現金與金融資產，但用途是未來投資，因此預設不拿來計算失業時可以支撐多久。它會納入「投資池」做資產配置分析，但不會重複加入總資產。'],
 cashEarmarked:['已預計要花掉的現金，例如學費、旅遊、稅金、裝修或未來貸款還款。','若一筆現金已經有明確用途，可放在這裡。它仍屬於你的資產，但預設不計入生活緩衝，以免高估真正可以拿來應急的現金。'],
 income:['填全年家庭收入。稅前或稅後皆可，但之後請維持相同口徑。','系統會用家庭年收入 ÷ 12 作為「平均月收入」。如果包含年終、獎金、佣金或其他波動收入，債務月付比只代表全年平均，不代表每個月真的有相同收入。請避免同一筆獎金重複計入其他收入。'],
 living:['請填家庭平均每月生活成本；年度支出請先換算成每月平均。不要包含貸款還款與投資。','除了每月支出，也可將預期持續發生的年度支出攤入：保險費、學費、牌照稅／燃料費、汽車保養、房屋固定支出、固定旅遊預算、年度訂閱、固定醫療、家電／修繕預留等。\n計算：年度支出總額 ÷ 12，再加到每月生活支出。\n例如保險 120,000 + 學費 60,000 + 其他年度支出 60,000 = 240,000；÷ 12 = 每月增加 20,000。\n只有預期持續發生的家庭支出需要攤提；偶發且無法預期的重大事件，不需硬塞進生活費。'],
 monthlyInvestment:['每月主動投入投資的金額；它屬於可調整的資產累積，不是剛性生活支出。','用於財務目標未來值估算，也會從「固定投資後每月結餘」扣除。不放進現金緩衝的支出分母，因模型假設收入中斷時固定投資可以暫停或調整。'],
 home:['填目前合理可接受的房屋估值，不必追求非常精準。','用於總資產、淨資產及房屋淨值估算。可使用相對保守且可持續更新的估值口徑。市場壓力測試目前不會讓房價跟著股票市場下跌。'],
 other:['未列入現金、股票 / ETF 或房屋的其他資產；沒有可以留空。','只填你認為需要納入家庭淨資產的項目。不要將已經計入其他欄位的資產再次填入。'],
 regular:['填目前市值，不是投入成本；不要包含下方另列的槓桿 ETF。','一般股票與非槓桿 ETF 的目前市值合計；槓桿 ETF 另外填寫。'],
 leveraged:['填目前槓桿 ETF 的市值；沒有持有可留空或填 0。','目前使用一個市值總額與代表倍率進行簡化試算，不需要拆分不同檔商品。'],
 multiplier:['填產品的每日目標倍率，例如正2填 2。','這不是指長期報酬一定是指數的 2 倍。每日重置壓力模型會另外處理跨日複利與路徑效果。'],
 currentAge:['以整歲填寫；系統不需要生日。','年齡僅用於估算規劃期間與約略年份，不需要提供生日。'],
 targetAge:['你希望檢視財務目標的時間點。這是規劃用期限，不代表一定要在該年齡完成。','首頁提供延後 1～3 歲的比較，其他條件維持相同，不會替你選擇目標年齡。'],
 targetAssets:[null,'投資資產目標只計一般股票 / ETF 與槓桿 ETF，不含任何現金；金融資產目標包含所有現金，但現金在未來預估中暫以 0% 成長。'],
 annualReturn:['這是情境假設，不是預測或保證報酬。','用來回答「如果未來平均年化報酬約為 X%，目標年齡時可能有多少資產？」\n網站提供 0%、5%、8%、12% 與自訂比較；既有保守／基準／積極名稱僅供情境比較，不代表通用投資標準或適用所有人的安全報酬。'],
 minRunway:['當生活緩衝低於你設定的月數時提醒。','生活緩衝採計現金 ÷（每月生活支出 + 每月債務還款）。固定投資不在分母，因收入中斷時可先暫停。\n怎麼想這個數字？如果收入突然中斷，希望不賣投資、不新增借款，能撐多久？\n收入較穩定、雙薪或固定支出較低，可能接受較短緩衝；收入波動較大、單一收入、有小孩或固定債務較高，可能希望更長緩衝。這只是思考參考，不是通用安全標準。'],
 maxPaymentRatio:['當每月債務還款占家庭平均月收入超過此比例時提醒。','所有貸款每月還款 ÷（家庭年收入 ÷ 12）。這是新增固定負債的煞車指標，不是通用安全標準。\n怎麼想這個數字？支付生活費、貸款與必要家庭支出後，希望保留多少現金流彈性？含大量獎金或浮動收入時，平均月收入可能高於一般月份實際現金流。'],
 maxLeverage:['同時考慮槓桿 ETF 與已投入市場的借款。','綜合市場槓桿 = 等效市場曝險 ÷ 投資淨值。\n曝險 = 一般股票 / ETF + 槓桿 ETF × 倍率；投資淨值 = 股票 / ETF 投資資產 − 投資用途負債。\n怎麼想這個數字？2x 代表每 1 元投資淨值約承擔 2 元等效曝險；數字越高，市場波動的放大效果通常越明顯。可搭配 −20%／−30%／−50% 壓力測試一起設定，不只靠固定倍數判斷。'],
 allocationGeneral:['三類目標比例合計需為 100%；這是你的策略目標。','投資池包含一般股票 / ETF、槓桿 ETF 與投資預備金。比例由你自行設定，不是系統推薦配置。'],
 allocationLeveraged:['可設定 0%；不代表必須持有槓桿 ETF。','若目前仍持有目標為 0% 的部位，無法完全只靠新增資金把該類降到 0%。'],
 allocationReserve:['投資預備金仍屬現金，不會重複計入總資產。','此比例僅用於投資池的資產配置與再平衡，不會將預備金當成已投入市場的投資資產。']
};
const debtGuide={
 name:['如房貸、信貸或車貸；可用自己容易辨認的名稱。','AI 匯出會將名稱匿名化，不會輸出銀行名稱。'],
 type:['依借款實際類型選擇。','房貸與其他負債會分別加總，但均包含在總負債與每月還款。'],
 balance:['填目前尚未償還的本金餘額，不是原始借款金額。','例如原本借 150 萬，現在剩 115 萬，請填 1,150,000。'],
 annualRate:['填目前實際適用的年利率；不知道可留白。','主要用於估算目前利息成本。若有分段、機動或優惠利率，可填目前最具代表性的利率。不知道不要猜，留白不影響主要資產負債分析。'],
 monthlyPayment:['填目前實際每月固定需支付的貸款金額。','填真正會從家庭現金流扣掉的月付款。所有負債月付合計，用於計算「債務月付 / 平均月收入」。'],
 remainingMonths:['預估還要繳幾個月；不知道可以留白。','留白不會阻止核心財務分析，只會限制部分貸款時間比較。'],
 investmentAmount:['如果這筆貸款只有部分資金實際投入股票 / ETF，只填實際投入的部分。','例如信貸 150 萬，其中 100 萬投入股票、50 萬保留現金：負債餘額依實際剩餘本金填寫，已投入投資的借款本金填 1,000,000。不要自動將整筆信貸視為投資借款；此金額必須介於 0 與該筆餘額之間。']
};
function detail(label,text){const box=document.createElement('details');box.className='inline-info field-guidance';box.setAttribute('name','wizard-field-guidance');const s=document.createElement('summary'),p=document.createElement('p');s.textContent='ⓘ 怎麼填？';p.textContent=text;box.append(s,p);box.addEventListener('toggle',()=>{if(box.open)document.querySelectorAll('#wizard .field-guidance[open]').forEach(other=>{if(other!==box)other.open=false;});});label.append(box);return box;}
function wire(el,entry){if(!entry)return;const label=el.closest('label');if(entry[0])label.querySelector('.field-helper').textContent=entry[0];if(!label.querySelector('.field-guidance'))return detail(label,entry[1]);return label.querySelector('.field-guidance');}
for(const field of fields)wire(field,guide[field.name]);
function wireDebts(){document.querySelectorAll('[data-debt-field]').forEach(el=>wire(el,debtGuide[el.dataset.debtField]));}
wireDebts();window.addEventListener('finance-debt-editor',wireDebts);
const livingDetails=fields.find(f=>f.name==='living').closest('label').querySelector('.field-guidance');
const calculator=document.createElement('details');calculator.className='inline-info annual-tool';const title=document.createElement('summary');title.textContent='年度支出換算';const label=document.createElement('div');label.textContent='年度非每月支出總額（NT$）';const input=document.createElement('input');input.id='annual-expense-input';input.setAttribute('aria-label','年度非每月支出總額（NT$）');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.value='';label.append(input);const output=document.createElement('p');output.id='annual-expense-result';output.setAttribute('role','status');const note=document.createElement('p');note.textContent='確認沒有重複計算後，可將此金額納入每月生活支出。此工具不儲存、不自動修改生活支出。';calculator.append(title,label,output,note);livingDetails.append(calculator);
function calc(){const raw=input.value.normalize('NFKC').replace(/,/g,'').trim();if(raw===''){output.textContent='輸入年度總額，即時計算平均每月應攤提。';return;}try{if(!/^\d+(?:\.\d*)?$/.test(raw))throw Error();const value=Number(raw),monthly=C.annualExpenseCalculator(value);input.value=raw.split('.')[0].replace(/\B(?=(\d{3})+(?!\d))/g,',')+(raw.includes('.')?'.'+raw.split('.')[1]:'');output.textContent=`平均每月應攤提：NT$ ${decimal.format(monthly)}`;}catch{output.textContent='請輸入有效的非負年度支出。';}}
input.addEventListener('input',e=>{e.stopPropagation();calc();});input.addEventListener('change',e=>e.stopPropagation());calculator.addEventListener('submit',e=>e.preventDefault());ui('wizard').addEventListener('close',()=>{input.value='';calculator.open=false;document.querySelectorAll('#wizard .field-guidance[open]').forEach(el=>el.open=false);calc();});calc();
function textBox(id,text,caution=false){const box=ui(id);box.textContent=text;box.classList.toggle('decision-caution',caution);}
function renderConsistency(hostId,data){const host=ui(hostId);host.replaceChildren();const r=C.allocationConsistency(data),labels=['一般投資','槓桿投資','投資預備金'],p=document.createElement('p');
 if(r.kind==='valid'){p.textContent=`若目前投資池總額與投資借款不變，達成此目標配置後，估算綜合市場槓桿約為 ${decimal.format(r.leverage)}x。`;
 const note=document.createElement('p');note.className=r.conflict?'decision-caution':'hint';note.textContent=r.conflict?`目前的「目標配置」與「最高綜合市場槓桿」並不完全一致。即使達成目標配置，在目前投資借款不變的假設下，綜合市場槓桿仍約為 ${decimal.format(r.leverage)}x，高於你設定的 ${decimal.format(data.maxLeverage)}x 提醒線。若最高槓桿是希望遵守的界線，可使用財務決策實驗室比較降低槓桿部位、增加自有資金或降低投資用途負債對結果的影響。`:'依目前投資借款與投資池規模估算，此目標配置與你的綜合槓桿上限沒有明顯衝突。';host.append(p,note);
 }else{p.textContent=r.kind==='empty'?'目前投資池為 0，暫無可估算的目標配置槓桿。':r.kind==='nonPositiveEquity'?'此目標配置下投資淨值不大於 0，無法計算有效槓桿；可用財務決策實驗室比較不同配置與借款。':'設定合計 100% 的有效目標配置後，即可檢查與槓桿提醒線的一致性。';host.append(p);}
 const assumption=document.createElement('p');assumption.className='hint';assumption.textContent='這是靜態配置估算，不代表未來市場變動後的槓桿。';host.append(assumption);
 if(r.deviations.length){const h=document.createElement('h4');h.textContent='偏離目標較多的項目';host.append(h);for(const dev of r.deviations){const p=document.createElement('p');p.className='hint';p.dataset.deviationIndex=dev.index;p.textContent=`${labels[dev.index]}：目前 ${percent(dev.current)}，目標 ${percent(dev.target)}，${dev.difference>0?'+':''}${decimal.format(dev.difference*100)} 個百分點`;host.append(p);}}
 else if(r.kind==='valid'){const p=document.createElement('p');p.className='hint';p.textContent='目前配置與目標配置相同。';host.append(p);}
}
function render(){const d=state.data,r=C.decisionReferences(d),draft=dataValid?'':'（目前有未完成輸入，以下採最後有效數值。）';
 textBox('runway-reference',`${draft}以目前支出計算：${decimal.format(d.minRunway)} 個月緩衝 ≈ ${money(r.requiredBuffer)}。目前採計生活緩衝現金 ${money(r.cashBuffer)}。${r.bufferDifference>=0?'目前高於設定門檻約':'距離設定門檻尚差約'} ${money(Math.abs(r.bufferDifference))}。`);
 textBox('payment-reference',r.monthlyIncome>0?`${draft}${decimal.format(d.maxPaymentRatio)}% 約等於每月債務還款 ${money(r.paymentLimit)}；目前月付 ${money(r.payments)}。目前${r.paymentDifference>=0?'距離自行設定的月付上限約':'高於自行設定的月付上限約'} ${money(Math.abs(r.paymentDifference))}。`:'目前沒有正數年收入，無法將比例換算成平均月收入的還款提醒金額。');
 textBox('leverage-reference',`${draft}目前：${multiple(r.currentLeverage)}；自行設定上限：${multiple(d.maxLeverage)}。${r.currentLeverage===null?'目前投資淨值不大於 0 或尚無投資，暫不計算有效倍數。':r.currentLeverage>d.maxLeverage?`高出 ${multiple(r.currentLeverage-d.maxLeverage)}，目前高於自行設定的提醒線。`:`距離提醒線尚有 ${multiple(d.maxLeverage-r.currentLeverage)}。`}`);
 renderConsistency('allocation-consistency',d);renderConsistency('allocation-review',d);
 const rows=C.goalTimeFlex(d,goalSettings.basis);ui('goal-flex-results').replaceChildren(...rows.map(row=>{const p=document.createElement('p');p.textContent=`${row.age} 歲：${row.required.kind==='zero'?'不計投資報酬亦可達標':requiredReturnText(row.required)}`;return p;}));if(!rows.length)ui('goal-flex-results').textContent='設定有效的未來目標年齡與目標金額後即可比較。';
}
window.addEventListener('finance-render',render);window.addEventListener('finance-cleared',()=>{input.value='';calc();});render();
})();
