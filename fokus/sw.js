/* Hintergrund-Helfer nur für die Fokus-Mini-App: startet sie auch ohne Netz. Zuerst aus dem Netz, ohne Netz der gespeicherte Stand.
   V erhöhen, wenn sich an dieser Datei etwas ändert. */
const V = "fokus-v2", KERN = ["./", "./index.html", "./fokus.css", "./engine.js", "./sound.js", "./sync.js", "./app.js", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(KERN.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith("fokus-") && x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin && !u.hostname.endsWith("gstatic.com") && !u.hostname.endsWith("googleapis.com")) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => { if (res && (res.ok || res.type === "opaque")) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)).catch(() => {}); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
});
