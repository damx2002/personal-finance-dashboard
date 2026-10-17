'use strict';
(()=>{
 let installEvent=null,registration=null,requestedUpdate=false;
 const status=document.getElementById('pwa-status');
 const installButton=document.getElementById('pwa-install'),installHelp=document.getElementById('pwa-install-help'),instructions=document.getElementById('install-instructions');
 const displayMode=window.matchMedia('(display-mode: standalone)');let installed=false,offlineReady=false,statusMessage='';
 const standalone=()=>installed||navigator.standalone===true||displayMode.matches;
 const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const manualHelp=appleMobile?'iPhone／iPad：請用 Safari 開啟此網站 → 點「分享」（方框向上箭頭）→「加入主畫面」→「新增」。若有「作為網頁 App 開啟」，請保持開啟。iPhone 需要從分享選單手動新增，網站不會直接跳出安裝視窗。':'Android Chrome：右上角 ⋮ →「新增到主畫面」或「安裝應用程式」。iPhone／iPad：Safari →「分享」→「加入主畫面」。電腦可查看網址列的安裝圖示或瀏覽器選單。請使用 HTTPS 網址，並先讓離線資源準備完成。';
 const setStatus=text=>{statusMessage=text;status.textContent=(standalone()?(offlineReady?'已安裝，可離線使用。':'已從主畫面開啟。'):'')+text;};
 const showInstallHelp=text=>{installHelp.textContent=text;installHelp.hidden=false;};
 const syncInstallUI=()=>{installButton.hidden=standalone()||!installEvent;instructions.hidden=standalone()||!!installEvent;if(!installHelp.textContent)showInstallHelp(manualHelp);setStatus(statusMessage);};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;syncInstallUI();});
 window.addEventListener('appinstalled',()=>{installed=true;installEvent=null;syncInstallUI();});
 displayMode.addEventListener?.('change',syncInstallUI);
 installButton.addEventListener('click',async()=>{
  if(standalone()||!installEvent){syncInstallUI();return;}
  const pending=installEvent;installEvent=null;syncInstallUI();
  try{await pending.prompt();const result=await pending.userChoice;showInstallHelp(result.outcome==='accepted'?'已接受安裝；安裝狀態以瀏覽器顯示為準。':'已取消安裝，可稍後再試。'+manualHelp);}
  catch{showInstallHelp(manualHelp);}
  if(!standalone())instructions.open=true;
 });
 syncInstallUI();
 if(!('serviceWorker'in navigator)||!['https:','http:'].includes(location.protocol)||!window.isSecureContext){setStatus('PWA 安裝與離線功能需要固定 HTTPS 網址；目前本機財務功能仍可使用。');return;}
 const showUpdate=()=>{if(registration?.waiting&&navigator.serviceWorker.controller)document.getElementById('pwa-update').hidden=false;};
 document.getElementById('pwa-reload').addEventListener('click',()=>{if(!registration?.waiting)return;if(window.hasUnsavedScenario?.()&&!confirm('尚有未儲存的情境變動。更新會重新載入頁面，確定繼續？'))return;requestedUpdate=true;registration.waiting.postMessage({type:'SKIP_WAITING'});});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate)location.reload();});
 navigator.serviceWorker.register(new URL('service-worker.js',location.href),{updateViaCache:'none'}).then(async reg=>{registration=reg;showUpdate();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)showUpdate();else {offlineReady=true;setStatus('離線資源已準備完成；財務資料仍只由瀏覽器 localStorage 管理。');};}});});await navigator.serviceWorker.ready;offlineReady=true;if(!reg.waiting)setStatus('離線資源已準備完成；財務資料仍只由瀏覽器 localStorage 管理。');}).catch(()=>{setStatus('離線資源暫時未能準備完成；線上與本機儲存仍可使用，可稍後重新開啟。');});
 const check=()=>{if(registration)registration.update().catch(()=>{});};
 window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
})();
