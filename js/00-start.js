'use strict';
/* Jarvis-App – Start: Firebase, Anmeldung mit Google, Speicher pro Person, Dateien speichern.
   Liefert jarvisConnect() → { db, mcp, downloads } für boot() in 01-basis.js.
   db sieht aus wie der Speicher von Jarvis in Claude (collection/doc/set/delete/get/onSnapshot), liegt aber unter users/{uid}/…
   mcp kommt aus js/google.js (window.jarvisMcp), sonst null (dann laufen Kalender, Mail und Wetter nicht).
   Für Google-Rechte (Kalender, Gmail) kann js/google.js window.JARVIS_SCOPES setzen und window.jarvisOnGoogleToken(token, result) anbieten. */
let FB = null, AUTH = null, FS = null, ME = null;

function jarvisUserDb(uid) {
  const base = 'users/' + uid + '/';
  return {
    collection: name => FS.collection(base + name),
    doc: path => FS.doc(base + path)
  };
}

const jarvisDownloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'jarvis-datei';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
};

function jarvisLoginScreen(msg) {
  let o = document.getElementById('jlogin');
  if (!o) { o = document.createElement('div'); o.id = 'jlogin'; o.className = 'overlay jlogin'; document.body.appendChild(o); }
  o.innerHTML = '<div class="sheet" role="dialog" aria-labelledby="jlogin-h"><h2 id="jlogin-h">Jarvis</h2>' +
    '<p class="sub">Melde dich einmal mit deinem Google-Konto an. Danach bleibt Jarvis auf diesem Gerät angemeldet.</p>' +
    (msg ? '<p class="sub" style="color:var(--r)">' + esc(msg) + '</p>' : '') +
    '<div class="row actions"><button class="btn primary" id="jlogin-go">Mit Google anmelden</button></div></div>';
  o.querySelector('#jlogin-go').onclick = jarvisSignIn;
}

async function jarvisSignIn() {
  const p = new FB.auth.GoogleAuthProvider();
  (window.JARVIS_SCOPES || []).forEach(s => p.addScope(s));
  p.setCustomParameters({ prompt: 'select_account' });
  try {
    const r = await AUTH.signInWithPopup(p);
    if (r && r.credential && window.jarvisOnGoogleToken) window.jarvisOnGoogleToken(r.credential.accessToken, r);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await AUTH.signInWithRedirect(p); return; }
    if (e && e.code === 'auth/popup-closed-by-user') return;
    jarvisLoginScreen('Anmeldung hat nicht geklappt (' + (e && e.code || 'Fehler') + '). Bitte noch einmal.');
  }
}

async function jarvisConnect() {
  if (!window.firebase || !window.JARVIS_FIREBASE || !window.JARVIS_FIREBASE.apiKey) {
    showToast('Firebase ist noch nicht eingerichtet. Jarvis speichert gerade nur auf diesem Gerät.');
    return window.jarvisMcp ? { db: null, mcp: window.jarvisMcp, downloads: jarvisDownloads } : null;
  }
  FB = window.firebase; FB.initializeApp(window.JARVIS_FIREBASE); AUTH = FB.auth(); FS = FB.firestore();
  try { await FS.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* zweiter Tab oder privater Modus: ohne Offline-Speicher weiter */ }
  try { const r = await AUTH.getRedirectResult(); if (r && r.credential && window.jarvisOnGoogleToken) window.jarvisOnGoogleToken(r.credential.accessToken, r); } catch (e) {}
  ME = await new Promise(res => { const off = AUTH.onAuthStateChanged(u => { if (u) { off(); res(u); } else jarvisLoginScreen(); }); });
  const o = document.getElementById('jlogin'); if (o) o.remove();
  window.jarvisUser = ME;
  return { db: jarvisUserDb(ME.uid), mcp: window.jarvisMcp || null, downloads: jarvisDownloads };
}
function jarvisSignOut() { if (AUTH) AUTH.signOut().then(() => location.reload()); }

// Google neu verbunden oder getrennt (js/google.js): Kalender neu laden
window.addEventListener('jarvis-google', () => { try { if (typeof fetchGcal === 'function') fetchGcal(); render(); } catch (e) {} });
