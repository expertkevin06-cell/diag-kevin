/* Diag Kevin — Service Worker : cache offline + rafraîchissement hebdomadaire */
const CACHE_NAME="diag-kevin-v1";
const WEEK_MS=7*24*60*60*1000;
const CORE_ASSETS=["./","./index.html","./manifest.json","./icon-512.svg"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE_ASSETS).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

async function cacheIsStale(){
  const c=await caches.open(CACHE_NAME);const m=await c.match("__sync__");
  if(!m)return true;return Date.now()-Number(await m.text())>WEEK_MS}
async function touch(){const c=await caches.open(CACHE_NAME);
  await c.put("__sync__",new Response(String(Date.now())))}

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.url.includes("generativelanguage.googleapis.com"))return;
  if(req.mode==="navigate"||req.destination==="document"){
    e.respondWith((async()=>{
      try{const fresh=await fetch(req);
        const c=await caches.open(CACHE_NAME);c.put("./index.html",fresh.clone());await touch();return fresh}
      catch{const c=await caches.match(req,{ignoreSearch:true})||await caches.match("./index.html");
        return c||new Response("Hors ligne",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}})}})());
    return}
  e.respondWith((async()=>{
    const cached=await caches.match(req);
    const net=fetch(req).then(r=>{if(r&&r.status===200&&r.type==="basic")
      caches.open(CACHE_NAME).then(c=>c.put(req,r.clone()));return r}).catch(()=>null);
    return cached||await net||new Response("",{status:404})})())});

async function weeklyRefresh(){
  if(await cacheIsStale()){
    const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));
    const c=await caches.open(CACHE_NAME);
    await c.addAll(CORE_ASSETS).catch(()=>{});await touch();
    const cs=await self.clients.matchAll();
    cs.forEach(cl=>cl.postMessage({type:"REFRESHED",at:Date.now()}))}}
self.addEventListener("message",e=>{if(e.data==="CHECK_WEEKLY")weeklyRefresh()});
self.addEventListener("activate",()=>weeklyRefresh());
