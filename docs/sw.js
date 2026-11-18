/* SJA offline cache.
   Internet ho to hamesha naya version (network pehle) — taake purani aur nayi files mix na hon.
   Internet na ho (ya 4 second mein jawab na aaye) to cache se chalao. */
const CACHE = "sja-v10";
const CORE = ["./", "index.html", "css/app.css", "css/fonts.css", "js/app.js", "js/store.js", "js/firebase-config.js",
  "img/sja-logo.svg", "manifest.webmanifest",
  "js/vendor/firebase-app-compat.js", "js/vendor/firebase-auth-compat.js", "js/vendor/firebase-firestore-compat.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache:"reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // Firebase waghera ko na chhuo
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await Promise.race([
        fetch(req, { cache:"no-cache" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000))
      ]);
      if(res.ok) c.put(req, res.clone());
      return res;
    } catch(err){
      return (await c.match(req, { ignoreSearch:true })) || (req.mode === "navigate" ? await c.match("index.html") : Response.error());
    }
  })());
});
