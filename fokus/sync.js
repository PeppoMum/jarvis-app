/* Fokus-Timer – iPhone und Mac sehen dasselbe (freiwillig).
   Nutzt den Speicher und die Google-Anmeldung, die Jarvis schon hat (Firebase-Projekt der Jarvis-App, kostenlos).
   Liegt unter users/{uid}/fokus/… und users/{uid}/fokusSessions/… – nur die angemeldete Person darf das lesen.
   Ohne Anmeldung läuft alles nur auf dem Gerät. Die Firebase-Bausteine werden erst geladen, wenn man sich anmeldet. */
(function (G) {
  'use strict';
  const FLAG = 'fokus-sync';
  const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
  let FB = null, AUTH = null, FS = null, base = null, user = null, onRemote = null, offs = [];
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Laden fehlgeschlagen: ' + src)); document.head.appendChild(s); });
  const wanted = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };

  async function boot() {
    if (FB) return true;
    await loadScript(V + 'firebase-app-compat.js'); await loadScript(V + 'firebase-auth-compat.js'); await loadScript(V + 'firebase-firestore-compat.js');
    await loadScript('../firebase-config.js');
    FB = G.firebase; if (!FB.apps.length) FB.initializeApp(G.JARVIS_FIREBASE);
    AUTH = FB.auth(); FS = FB.firestore();
    try { await FS.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
    try { await AUTH.getRedirectResult(); } catch (e) {}
    return true;
  }
  function listen() {
    offs.forEach(f => f()); offs = [];
    base = 'users/' + user.uid + '/';
    offs.push(FS.doc(base + 'fokus/lauf').onSnapshot(d => { if (d.exists && onRemote) onRemote({ run: d.data().run || null, upd: d.data().upd || 0 }); }));
    offs.push(FS.doc(base + 'fokus/einstellungen').onSnapshot(d => { if (d.exists && onRemote) onRemote({ settings: d.data().set, setUpd: d.data().upd || 0 }); }));
    offs.push(FS.collection(base + 'fokusSessions').onSnapshot(q => { if (onRemote) onRemote({ sessions: q.docs.map(x => x.data()) }); }));
  }
  async function start(cb) {
    onRemote = cb;
    if (!wanted()) return null;
    try { await boot(); } catch (e) { return null; }   // ohne Netz: läuft auf dem Gerät weiter
    return new Promise(res => { const off = AUTH.onAuthStateChanged(u => { off(); user = u || null; if (user) listen(); res(user); }); });
  }
  async function signIn() {
    try { localStorage.setItem(FLAG, '1'); } catch (e) {}
    await boot();
    const p = new FB.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { const r = await AUTH.signInWithPopup(p); user = r.user; }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await AUTH.signInWithRedirect(p); return null; }
      throw e;
    }
    listen(); return user;
  }
  async function signOut() { try { localStorage.removeItem(FLAG); } catch (e) {} offs.forEach(f => f()); offs = []; if (AUTH) await AUTH.signOut(); user = null; }
  const put = (path, data) => { if (!user) return Promise.resolve(); return FS.doc(base + path).set(data).catch(() => {}); };
  G.FokusSync = {
    start, signIn, signOut,
    user: () => user,
    saveRun: (run, upd) => put('fokus/lauf', { run: run || null, upd }),
    saveSettings: (set, upd) => put('fokus/einstellungen', { set, upd }),
    saveSession: s => put('fokusSessions/' + s.id, s)
  };
})(window);
