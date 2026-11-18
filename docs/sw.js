/* SJA offline cache — app ek dafa khul jaye to phir baghair internet bhi khule.
   Pehle cache se dikhao, peeche se naya version utha kar cache taaza karo. */
const CACHE = "sja-v1";
const CORE = ["./", "index.html", "css/app.css", "css/fonts.css", "js/app.js", "js/store.js", "js/firebase-config.js",
  "img/sja-logo.svg", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // Firebase waghera ko na chhuo
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch:true });
    const net = fetch(req).then(res => { if(res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || c.match("index.html");
  }));
});
