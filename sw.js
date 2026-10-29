/* Hintergrund-Helfer der Jarvis-App: startet die App auch ohne Netz und zeigt die Meldungen an.
   Eigene Dateien: zuerst aus dem Netz (immer der neueste Stand, am Zwischenspeicher des Handys vorbei), ohne Netz der zuletzt gespeicherte.
   Firebase-Bausteine (feste Version bei gstatic): zuerst aus dem Speicher. Alles andere (Firebase, Google, Wetter) nie anfassen.
   V erhöhen, wenn sich an dieser Datei etwas ändert. */
const V = "jarvis-v2", KERN = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/badge-96.png"];
const SDK = "https://www.gstatic.com/firebasejs/";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(KERN.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
const merken = (r, res) => { if (res && (res.ok || res.type === "opaque")) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)).catch(() => {}); } return res; };
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.url.startsWith(SDK)) { e.respondWith(caches.match(r, { ignoreVary: true }).then((m) => m || fetch(r).then((res) => merken(r, res)))); return; }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => merken(r, res)).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
});

/* Meldungen vom Zeitplan bei GitHub (push/senden.mjs): t Titel, b Text, u Seite beim Antippen (z. B. ./#woche), g Gruppe (gleiche Gruppe ersetzt die alte Meldung) */
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { b: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.t || "Jarvis", { body: d.b || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: d.g || undefined, renotify: !!d.g, data: { u: d.u || "./" } }));
});
/* Antippen: offene App nach vorne holen und dort die passende Seite zeigen, sonst die App öffnen */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const u = new URL((e.notification.data && e.notification.data.u) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((L) => {
    const c = L.find((x) => x.url.startsWith(self.registration.scope) && "focus" in x);
    if (!c) return clients.openWindow(u);
    c.postMessage({ jarvisSeite: new URL(u).hash });
    return c.focus();
  }));
});
