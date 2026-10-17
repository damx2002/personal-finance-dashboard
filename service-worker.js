'use strict';
// build-single.py updates RELEASE from the static shell content hash.
const RELEASE='v41-d589bee767537efd';
const scope=new URL('./',self.location.href);
const PREFIX='finance-static-'+encodeURIComponent(scope.pathname)+'-';
const VERSION=PREFIX+RELEASE;
const FILES=['./','index.html','dashboard.html','style.css','v3-core.js','stress-core.js','scenario-core.js','health-analysis.js','app.js','summary.js','scenario-ui.js','pwa.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png'];
const allowed=new Set(FILES.map(file=>new URL(file,scope).href));
function canonical(url){const u=new URL(url);u.search='';u.hash='';return u.href;}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);try{await cache.addAll(FILES.map(file=>new Request(new URL(file,scope),{cache:'reload'})));}catch(e){await caches.delete(VERSION);throw e;}})()));
// No automatic skipWaiting: an already-open app stays on its current consistent shell.
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==VERSION)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const key=canonical(event.request.url);
 if(!allowed.has(key))return; // No APIs, backups, blobs, financial payloads or arbitrary URLs enter this cache.
 event.respondWith((async()=>{const cache=await caches.open(VERSION),cached=await cache.match(key);if(cached)return cached;const response=await fetch(event.request);if(response.ok&&response.type==='basic')await cache.put(key,response.clone());return response;})());
});
