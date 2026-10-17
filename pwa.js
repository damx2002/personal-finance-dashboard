'use strict';
(()=>{
 let installEvent=null,registration=null,requestedUpdate=false;
 const status=document.getElementById('pwa-status');
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
 document.getElementById('pwa-install').addEventListener('click',async()=>{if(installEvent){const pending=installEvent;installEvent=null;await pending.prompt();const result=await pending.userChoice;status.textContent=result.outcome==='accepted'?'已接受安裝；安裝狀態以瀏覽器顯示為準。':'已取消安裝，可稍後再試。';}else status.textContent='Android Chrome 可從右上角 ⋮ 選「新增到主畫面」或「安裝應用程式」。請使用 HTTPS 網址，並先讓離線資源準備完成。';});
 if(!('serviceWorker'in navigator)||!['https:','http:'].includes(location.protocol)||!window.isSecureContext){status.textContent='PWA 安裝與離線功能需要固定 HTTPS 網址；目前本機財務功能仍可使用。';return;}
 const showUpdate=()=>{if(registration?.waiting&&navigator.serviceWorker.controller)document.getElementById('pwa-update').hidden=false;};
 document.getElementById('pwa-reload').addEventListener('click',()=>{if(!registration?.waiting)return;if(window.hasUnsavedScenario?.()&&!confirm('尚有未儲存的情境變動。更新會重新載入頁面，確定繼續？'))return;requestedUpdate=true;registration.waiting.postMessage({type:'SKIP_WAITING'});});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate)location.reload();});
 navigator.serviceWorker.register(new URL('service-worker.js',location.href),{updateViaCache:'none'}).then(async reg=>{registration=reg;showUpdate();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)showUpdate();else status.textContent='離線資源已準備完成；財務資料仍只由瀏覽器 localStorage 管理。';}});});await navigator.serviceWorker.ready;if(!reg.waiting)status.textContent='離線資源已準備完成；財務資料仍只由瀏覽器 localStorage 管理。';}).catch(()=>{status.textContent='離線資源暫時未能準備完成；線上與本機儲存仍可使用，可稍後重新開啟。';});
 const check=()=>{if(registration)registration.update().catch(()=>{});};
 window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
})();
