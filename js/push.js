/* ===================== Meldungen, Widget und Kurzbefehle =====================
   Gehört zum Thread „Meldungen und Widget“. Wird vor 00-start.js geladen; alles hier läuft erst nach dem Start (Anmeldung, S, store, render).
   - Hintergrund-Helfer (sw.js) anmelden, Meldungen auf diesem Gerät ein-/ausschalten (users/<uid>/push/<gerät>)
   - pageMeldungen(): Einstellungen der Meldungen (settings.push), Probemeldung, Einrichtung von Widget und Kurzbefehlen
   - Briefkasten: Kurzbefehle (über Scriptable) legen Aufträge in kasten/<schlüssel>/m ab (Arbeit starten, Pause, Feierabend, Notiz);
     die App holt sie ab, sobald sie offen ist, und trägt sie mit der richtigen Uhrzeit ein.
   Verschickt wird von push/senden.mjs (Zeitplan bei GitHub). Der öffentliche Schlüssel unten passt zu VAPID_PRIVAT dort. */
const PUSH_VAPID = 'BE3YlWSHEaFu8BiiRoeciWyj8FMlRonGdILlf_flKBv6tze8Fx3r7qyfzfMZODnM45hrFi2O05cQPxBMR-7_urc';
const PUSH_DEF = { morgen: true, morgenZeit: '06:45', morgenWE: '09:00', abend: true, abendZeit: '20:45', woche: true, wocheZeit: '18:45', losfahren: true, losVor: 15, unwetter: true, gewohnheit: true, aufgabe: true };
const pushCfg = () => ({ ...PUSH_DEF, ...((typeof S !== 'undefined' && S.settings && S.settings.push) || {}) });
const pushLs = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
const pushHex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); };
const pushUid = () => (window.jarvisUser && window.jarvisUser.uid) || null;
const pushFs = () => (window.firebase && firebase.apps && firebase.apps.length ? firebase.firestore() : null);
const pushUser = p => { const f = pushFs(), u = pushUid(); return f && u ? f.doc('users/' + u + '/' + p) : null; };

/* ---------- Hintergrund-Helfer ---------- */
if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.protocol + '//' + location.hostname)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  // Antippen einer Meldung, während die App offen ist: passende Seite zeigen
  navigator.serviceWorker.addEventListener('message', e => { const h = e.data && e.data.jarvisSeite; if (h && /^#[\w-]*$/.test(h) && location.hash !== h) location.hash = h; });
}

/* ---------- Meldungen auf diesem Gerät ---------- */
const PUSH_OK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushPerm = () => { try { return Notification.permission; } catch (e) { return 'default'; } };
const pushIsIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pushStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushDev = () => { let s = pushLs.get('jarvis.push.id'); if (!/^[0-9a-f]{20}$/.test(s || '')) { s = pushHex(10); pushLs.set('jarvis.push.id', s); } return s; };
const pushU8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const pushDevName = () => { const u = navigator.userAgent; return /iphone/i.test(u) ? 'iPhone' : /ipad/i.test(u) || pushIsIOS() ? 'iPad' : /android/i.test(u) ? 'Android-Handy' : /mac/i.test(u) ? 'Mac' : /windows/i.test(u) ? 'Windows-PC' : 'Gerät'; };
async function pushSub(ask) {
  if (ask && pushPerm() !== 'granted' && await Notification.requestPermission() !== 'granted') return null;
  if (pushPerm() !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready, old = await reg.pushManager.getSubscription();
  return old || (ask ? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushU8(PUSH_VAPID) }) : null);
}
const pushApi = {
  on: () => pushLs.get('jarvis.push.on') === '1',
  async enable() {
    if (!PUSH_OK()) return 'no';
    const s = await pushSub(true); if (!s) return pushPerm() === 'denied' ? 'denied' : 'no';
    const j = s.toJSON(), ref = pushUser('push/' + pushDev()); if (!ref) return 'no';
    await ref.set({ e: j.endpoint, p: (j.keys || {}).p256dh || '', a: (j.keys || {}).auth || '', at: Date.now(), name: pushDevName() });
    pushLs.set('jarvis.push.on', '1'); return 'ok';
  },
  async disable() {
    pushLs.set('jarvis.push.on', null);
    try { const reg = await navigator.serviceWorker.ready, s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {}
    try { const ref = pushUser('push/' + pushDev()); if (ref) await ref.delete(); } catch (e) {}
  },
  // beim Öffnen: Anmeldung auffrischen (die Adresse des Geräts kann sich ändern)
  async sync() {
    if (!pushApi.on() || !PUSH_OK()) return;
    try { const s = await pushSub(false); if (!s) { pushLs.set('jarvis.push.on', null); return; } const j = s.toJSON(), ref = pushUser('push/' + pushDev());
      if (ref) await ref.set({ e: j.endpoint, p: (j.keys || {}).p256dh || '', a: (j.keys || {}).auth || '', at: Date.now(), name: pushDevName() }); } catch (e) {}
  }
};

/* ---------- Briefkasten für Kurzbefehle ---------- */
let kastenKey = null, kastenStop = null;
async function kastenLaden() {
  const ref = pushUser('meta/kasten'); if (!ref) return null;
  try { const d = await ref.get(); kastenKey = d.exists && /^[0-9a-f]{64}$/.test(d.data().key || '') ? d.data().key : null; } catch (e) {}
  return kastenKey;
}
async function kastenAnlegen() {
  const f = pushFs(), u = pushUid(); if (!f || !u) throw new Error('nicht angemeldet');
  const k = pushHex(32);
  await f.doc('kasten/' + k).set({ uid: u, at: Date.now() });
  await f.doc('users/' + u + '/meta/kasten').set({ key: k, at: Date.now() });
  kastenKey = k; kastenHoeren(); return k;
}
// Ein Auftrag: { art: 'start'|'pause'|'stopp'|'notiz', cat?, text?, at (ms) }
async function kastenAuftrag(a) {
  const at = Math.min(Date.now(), Number(a.at) || Date.now()), F = S.focus, cat = typeof a.cat === 'string' && a.cat ? a.cat : 'arbeit';
  const halt = async f => { if (!f.pausedAt) await setFocus({ ...f, pausedAt: Math.max(f.startedAt, at) }); await stopFocus('kasten'); };
  if (a.art === 'start') {
    if (F && F.mode === 'track' && F.cat === cat) { if (F.pausedAt) { const f = { ...F, pausedMs: (F.pausedMs || 0) + Math.max(0, at - F.pausedAt) }; delete f.pausedAt; await setFocus(f); return catName(cat) + ' läuft weiter'; } return null; }
    if (F) await halt(F);
    await setFocus({ mode: 'track', dur: 0, startedAt: at, ref: null, cat, sub: null, label: catName(cat), plan: null, round: null, done: 0 });
    return catName(cat) + ' läuft seit ' + hmOf(at);
  }
  if (a.art === 'pause') {
    if (!F || F.mode === 'pause') return 'Pause: gerade lief nichts';
    if (F.pausedAt) { const f = { ...F, pausedMs: (F.pausedMs || 0) + Math.max(0, at - F.pausedAt) }; delete f.pausedAt; await setFocus(f); return 'Weiter seit ' + hmOf(at); }
    await setFocus({ ...F, pausedAt: Math.max(F.startedAt, at) }); return 'Pause seit ' + hmOf(at);
  }
  if (a.art === 'stopp') { if (!F) return null; const n = F.mode === 'track' ? catName(F.cat, F.sub) : F.label; await halt(F); return n + ' beendet um ' + hmOf(at); }
  if (a.art === 'notiz') {
    const text = String(a.text || '').trim().slice(0, 500); if (!text) return null;
    const m = text.match(/^(einkauf|einkaufen|kaufen)\s*:\s*(.+)$/i);
    if (m) { const xs = m[2].split(/,|\bund\b/).map(s => s.trim()).filter(Boolean).slice(0, 15);
      for (const x of xs) await store.setItem({ id: uid(), type: 'shopping', title: x.charAt(0).toUpperCase() + x.slice(1), aisle: typeof guessAisle === 'function' ? guessAisle(x) : undefined, done: false, createdAt: new Date(at).toISOString() });
      return xs.length + (xs.length === 1 ? ' Sache' : ' Sachen') + ' auf die Einkaufsliste'; }
    await store.setItem({ id: uid(), type: 'note', title: text, source: 'siri', createdAt: new Date(at).toISOString() });
    return 'Notiz im Eingangskorb';
  }
  return null;
}
let kastenBusy = false;
function kastenHoeren() {
  const f = pushFs(); if (!f || !kastenKey) return;
  if (kastenStop) kastenStop();
  kastenStop = f.collection('kasten/' + kastenKey + '/m').onSnapshot(async snap => {
    if (kastenBusy || snap.empty || typeof S === 'undefined' || !S.loaded) return;
    kastenBusy = true; const done = [];
    try {
      const docs = snap.docs.slice().sort((a, b) => (Number(a.data().at) || 0) - (Number(b.data().at) || 0));
      for (const d of docs) { try { const r = await kastenAuftrag(d.data()); if (r) done.push(r); } catch (e) {} await d.ref.delete().catch(() => {}); }
    } finally { kastenBusy = false; }
    if (done.length && typeof showToast === 'function') showToast('Per Kurzbefehl: ' + done.join(' · ') + '.');
  }, () => {});
}

/* Start: nach der Anmeldung (00-start.js setzt window.jarvisUser) einmal einrichten */
(function pushStart() {
  let tries = 0;
  const go = async () => {
    if (!pushUid() || typeof S === 'undefined' || !S.loaded) { if (tries++ < 240) setTimeout(go, 500); return; }
    pushApi.sync(); if (await kastenLaden()) kastenHoeren();
  };
  setTimeout(go, 500);
})();

/* ---------- Seite „Meldungen“ (Mehr › Einstellungen › Berichte) ---------- */
let pushBusy = false, pushProbeAt = 0, pushShowKey = false;
function pushStatusHtml() {
  if (!PUSH_OK()) return pushIsIOS() && !pushStandalone()
    ? '<p>Meldungen gehen auf dem iPhone nur aus der App auf dem Home-Bildschirm. In Safari unten auf <b>Teilen</b> tippen, dann <b>Zum Home-Bildschirm</b>. Danach Jarvis von dort öffnen und hier einschalten.</p>'
    : '<p>Dieser Browser kann keine Meldungen anzeigen.</p>';
  if (pushPerm() === 'denied') return '<p>Meldungen sind für Jarvis gesperrt. Auf dem iPhone: <b>Einstellungen › Mitteilungen › Jarvis</b> erlauben, dann hier nochmal einschalten.</p>';
  return pushApi.on()
    ? '<p><b>An auf diesem Gerät.</b></p><div class="row"><button class="btn" data-push="probe"' + (pushBusy ? ' disabled' : '') + '>Probemeldung schicken</button><button class="btn ghost" data-push="aus"' + (pushBusy ? ' disabled' : '') + '>Ausschalten</button></div>' +
      (pushProbeAt ? '<p class="sub">Die Probemeldung kommt in den nächsten Minuten.</p>' : '')
    : '<p>Auf diesem Gerät sind Meldungen noch aus.</p><div class="row"><button class="btn primary" data-push="an"' + (pushBusy ? ' disabled' : '') + '>Meldungen einschalten</button></div>';
}
function pageMeldungen() {
  const P = pushCfg(), chk = (k, l) => '<label class="toggle"><input type="checkbox" data-pushset="' + k + '"' + (P[k] ? ' checked' : '') + '> ' + l + '</label>';
  const zeit = (k, l) => '<label class="field"><span>' + l + '</span><input type="time" data-pushset="' + k + '" value="' + esc(P[k]) + '"></label>';
  const code = kastenKey && pushShowKey ? pushEinrichtCode() : '';
  return '<div class="pagehead"><div><h1 class="page">Meldungen</h1></div></div>' +
    '<section class="card"><h2 class="label">Dieses Gerät</h2>' + pushStatusHtml() + '</section>' +
    '<section class="card"><h2 class="label">Berichte</h2>' +
      chk('morgen', 'Morgenbericht') + '<div class="formgrid">' + zeit('morgenZeit', 'Montag bis Freitag') + zeit('morgenWE', 'Samstag und Sonntag') + '</div>' +
      chk('abend', 'Abendrückblick') + '<div class="formgrid">' + zeit('abendZeit', 'Jeden Tag um') + '</div>' +
      chk('woche', 'Wochenplanung am Sonntag') + '<div class="formgrid">' + zeit('wocheZeit', 'Sonntag um') + '</div>' +
      '<p class="sub">Die Berichte kommen pünktlich bis etwa 10 Minuten später. Den Text siehst du danach auch auf der Startseite.</p></section>' +
    '<section class="card"><h2 class="label">Unterwegs und Hinweise</h2>' +
      chk('losfahren', 'Wann ich losfahren muss') + '<div class="formgrid"><label class="field"><span>So viele Minuten vorher</span><input type="number" min="0" max="60" step="5" inputmode="numeric" data-pushset="losVor" value="' + esc(String(P.losVor)) + '"></label></div>' +
      chk('unwetter', 'Amtliche Unwetterwarnungen') + chk('gewohnheit', 'Erinnerungen an Gewohnheiten') + chk('aufgabe', 'Erinnerungen an Aufgaben') +
      '<p class="sub">In der Ruhezeit (Hinweise › Ruhezeit) kommen keine Hinweise, nur starke Unwetterwarnungen. Die Berichte kommen immer zu ihrer Uhrzeit.</p></section>' +
    '<section class="card"><h2 class="label">Widget und Kurzbefehle</h2>' +
      '<p>Mit der kostenlosen App <b>Scriptable</b> bekommst du Jarvis als Widget auf den Home-Bildschirm. Dazu kommen Kurzbefehle für Siri: <b>Arbeit starten</b>, <b>Pause</b>, <b>Feierabend</b>, <b>Jarvis notieren</b> und <b>Claude öffnen</b>.</p>' +
      (kastenKey ? '<div class="row"><button class="btn" data-push="code">' + (pushShowKey ? 'Code verbergen' : 'Einrichtungs-Code zeigen') + '</button></div>' : '<div class="row"><button class="btn primary" data-push="kasten"' + (pushBusy ? ' disabled' : '') + '>Widget einrichten</button></div>') +
      code + '<div class="row"><button class="btn" data-push="skript">Widget-Skript kopieren</button></div><p class="sub">So geht es: Scriptable öffnen, oben auf +, das Skript einfügen und „Jarvis“ nennen. Einmal starten und den Einrichtungs-Code einfügen. Die genauen Schritte stehen in der Anleitung im Ordner „widget“.</p></section>';
}
function pushEinrichtCode() {
  const o = firebase.app().options, c = btoa(JSON.stringify({ p: o.projectId, k: o.apiKey, s: kastenKey }));
  return '<label class="field"><span>Einrichtungs-Code (nicht weitergeben)</span><textarea rows="3" readonly data-pushcode>' + esc(c) + '</textarea></label><div class="row"><button class="btn primary" data-push="copy">Kopieren</button></div>';
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-push]'); if (!b) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  const a = b.dataset.push;
  if (a === 'code') { pushShowKey = !pushShowKey; render(); return; }
  if (a === 'skript') {   // Safari erlaubt Kopieren nur direkt beim Tippen, darum wird der Text als „kommt gleich“ übergeben
    const holen = () => fetch('widget/Jarvis.js', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.text(); });
    try { if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': holen().then(t => new Blob([t], { type: 'text/plain' })) })]); else await navigator.clipboard.writeText(await holen());
      showToast('Skript kopiert. Jetzt in Scriptable einfügen.'); } catch (e) { showToast('Kopieren ging gerade nicht.'); }
    return; }
  if (a === 'copy') { const c = document.querySelector('[data-pushcode]'); try { await navigator.clipboard.writeText(c.value); showToast('Code kopiert. Jetzt in Scriptable einfügen.'); } catch (e) { c.select(); showToast('Bitte den markierten Code kopieren.'); } return; }
  pushBusy = true; render();
  try {
    if (a === 'an') { const r = await pushApi.enable(); showToast(r === 'ok' ? 'Meldungen sind an.' : r === 'denied' ? 'Meldungen wurden nicht erlaubt.' : 'Einschalten ging gerade nicht.'); }
    if (a === 'aus') { await pushApi.disable(); showToast('Meldungen auf diesem Gerät sind aus.'); }
    if (a === 'probe') { pushProbeAt = Date.now(); await pushUser('meta/versand').set({ probe: pushProbeAt }, { merge: true }); }
    if (a === 'kasten') { await kastenAnlegen(); pushShowKey = true; showToast('Fertig. Jetzt den Code in Scriptable einfügen.'); }
  } catch (e) { showToast('Ging gerade nicht. Bitte nochmal versuchen.'); }
  pushBusy = false; render();
}, true);
document.addEventListener('change', async ev => {
  const x = ev.target.closest('[data-pushset]'); if (!x) return;
  const k = x.dataset.pushset, P = pushCfg();
  let v = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Math.max(0, Math.min(60, Math.round(Number(x.value) || 0))) : String(x.value || '');
  if (x.type === 'time' && !/^\d{2}:\d{2}$/.test(v)) { x.value = P[k]; return; }
  S.settings = { ...S.settings, push: { ...(S.settings.push || {}), [k]: v } };
  await store.setSettings(S.settings); showToast('Gespeichert.');
}, true);
