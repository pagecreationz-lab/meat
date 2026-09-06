const CACHE='meatflow-shell-v1';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
// Transactions and authenticated data always require the live server.
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>MeatFlow offline</title><body style="font:16px system-ui;background:#f6f8f7;color:#215442;padding:40px"><h1>You are offline</h1><p>Reconnect to record deliveries, payments and GPS locations.</p><button onclick="location.reload()">Try again</button></body>',{headers:{'Content-Type':'text/html'}})));
});
