'use strict';
const BUILD='2c491b037373e6d6518a';
const ROOT=new URL(self.registration.scope),PREFIX='ai-pm-reader-'+encodeURIComponent(ROOT.pathname)+'-',CACHE=PREFIX+BUILD,MAIN=new URL('index.html',ROOT).href;
const ASSETS=['index.html','manifest.webmanifest','icon.svg'].map(path=>new URL(path,ROOT).href);
async function validatedPage(response){
  if(!response||!response.ok||response.redirected||!response.headers.get('content-type')?.includes('text/html'))throw Error('The reader HTML is unavailable');
  const text=await response.clone().text();
  if(!text.includes('<meta name="ai-pm-reader-build" content="'+BUILD+'">')||!text.includes('<script id="book-data"')||!text.includes('window.AI_PM='))throw Error('Not the complete expected reader; login and error pages are never cached');
  return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
    for(const url of ASSETS){const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));if(url===MAIN)await validatedPage(response);else if(!response.ok||response.redirected)throw Error('Offline asset unavailable');await cache.put(url,response);}
  }catch(error){await caches.delete(CACHE);throw error;}
  // Waiting updates are activated only through the visible save-and-update button.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE'){event.waitUntil(self.skipWaiting());return;}
  if(event.data?.type==='OFFLINE_STATUS')event.waitUntil((async()=>{const cache=await caches.open(CACHE);let ready=true;for(const url of ASSETS)if(!await cache.match(url))ready=false;event.ports[0]?.postMessage({type:'OFFLINE_STATUS',build:BUILD,ready});})());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin||url.search)return;
  const navigation=request.mode==='navigate'&&(url.pathname===ROOT.pathname||url.href===MAIN);
  if(!navigation&&!ASSETS.includes(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),key=navigation?MAIN:url.href,cached=await cache.match(key);
    if(cached)return cached;
    // If iOS evicted cached data, require a fresh valid page. Never replace it with a login or security page.
    const response=await fetch(request);
    if(navigation)await validatedPage(response);
    if(response.ok&&!response.redirected)await cache.put(key,response.clone());
    return response;
  })());
});
