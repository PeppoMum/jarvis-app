'use strict';
/* Jarvis-App – 01-basis.js (aus Jarvis in Claude, Zeilen 860–1188 von V48) */

/* ===================== Hilfsfunktionen ===================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoDate(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const WD = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const WDS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MON = ['Jan','Feb','März','Apr','Mai','Juni','Juli','Aug','Sep','Okt','Nov','Dez'];
const MONL = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const dObj = iso => new Date(iso + 'T12:00:00');
const fmtLong = iso => { const d = dObj(iso); return WD[d.getDay()] + ', ' + d.getDate() + '. ' + MONL[d.getMonth()]; };
const fmtShort = iso => { const d = dObj(iso); return WDS[d.getDay()] + ', ' + d.getDate() + '. ' + MON[d.getMonth()]; };
const relDay = iso => {
  const t = todayISO();
  if (iso === t) return 'heute';
  if (iso === addDays(t, 1)) return 'morgen';
  if (iso === addDays(t, -1)) return 'gestern';
  const diff = Math.round((dObj(iso) - dObj(t)) / 864e5);
  if (diff > 1 && diff < 7) return WD[dObj(iso).getDay()];
  return fmtShort(iso);
};
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const hmToMin = s => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const AREAS = { uni: 'Uni', arbeit: 'Arbeit', team: 'Team', alltag: 'Alltag' };
const TYPES = { task: 'Aufgabe', event: 'Termin', shopping: 'Einkauf', idea: 'Idee', note: 'Notiz', class: 'Vorlesung', work: 'Arbeitsblock', off: 'Urlaub / frei', subject: 'Fach', teamnote: 'Trainingsnotiz', memory: 'Info über mich', habit: 'Gewohnheit', birthday: 'Geburtstag', contract: 'Vertrag', packlist: 'Liste', time: 'Zeit', habitlog: 'Gewohnheit erledigt', waiting: 'Warte auf', project: 'Projekt', expense: 'Ausgabe' };
const CAL_TYPES = ['event', 'class', 'work', 'off', 'task'];
const AISLES = ['Obst & Gemüse','Brot & Backwaren','Kühlregal','Fleisch & Fisch','Tiefkühl','Vorrat','Süßes & Snacks','Getränke','Drogerie','Haushalt','Sonstiges'];
const AISLE_WORDS = {
  'Obst & Gemüse': ['apfel','äpfel','banane','tomate','gurke','salat','zwiebel','kartoffel','paprika','möhre','karotte','zitrone','obst','gemüse','beeren','trauben','avocado','knoblauch','pilze','brokkoli'],
  'Brot & Backwaren': ['brot','brötchen','toast','baguette','croissant'],
  'Kühlregal': ['milch','joghurt','käse','butter','quark','sahne','eier','ei ','skyr','frischkäse','margarine'],
  'Fleisch & Fisch': ['hähnchen','fleisch','hack','wurst','schinken','lachs','fisch','salami'],
  'Tiefkühl': ['tk ','tiefkühl','pizza','eis'],
  'Vorrat': ['nudeln','reis','mehl','zucker','öl','essig','salz','pfeffer','dose','tomatensoße','passata','haferflocken','müsli','linsen','bohnen','gewürz'],
  'Süßes & Snacks': ['schokolade','chips','kekse','gummibärchen','nüsse','riegel'],
  'Getränke': ['wasser','saft','cola','bier','kaffee','tee','limo','sprudel'],
  'Drogerie': ['zahnpasta','shampoo','duschgel','deo','seife','zahnbürste','creme','rasierer'],
  'Haushalt': ['spülmittel','klopapier','toilettenpapier','küchenrolle','müllbeutel','waschmittel','schwamm','alufolie','backpapier']
};
const guessAisle = name => {
  const n = ' ' + name.toLowerCase() + ' ';
  for (const [a, words] of Object.entries(AISLE_WORDS)) if (words.some(w => n.includes(w))) return a;
  return 'Sonstiges';
};

const ICON = {
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
  idea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  uni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>',
  work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4l-1-4z"/><path d="M12 3v4M21 12l-6-3M3 12l6-3M7 19l3-6M17 19l-3-6"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" width="18" height="18"><path d="m9 6 6 6-6 6"/></svg>',
  chevl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" width="18" height="18"><path d="m15 6-6 6 6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
};

/* ===================== Zustand ===================== */
const S = {
  items: [],          // alle Einträge (Aufgaben, Termine, Einkauf, Ideen, Notizen)
  settings: { mode: 'auto', name: '', calSync: true, workHours: 20, workDays: [3, 4, 5], vacationDays: null, vacationCarry: 0, rules: '', wxKey: '174471', wxName: 'Haltern am See', siri: true, siriWord: 'Jarvis', siriTrash: true },
  chat: [],           // Gesprächsverlauf (gekürzt)
  route: 'heute',
  busy: false,
  status: '',
  pending: null,      // Vorschau aus dem Eingangskorb
  editing: null,      // Eintrag im Bearbeiten-Dialog
  toast: null,
  online: false,
  loaded: false,
  week: null,         // Montag der angezeigten Woche
  gcal: [],           // Termine aus Google Kalender (nur lesen)
  gcalState: 'idle',  // idle | loading | ok | error | off
  plan: null,         // Wochenplanung (Schritte)
  uniSub: null,       // geöffnetes Fach
  review: null,       // Lernkarten-Abfrage
  matBusy: '',        // Fortschritt beim Verarbeiten
  ics: null,          // Moodle-Import-Vorschau
  timer: null,        // laufende Lernzeit {subjectId, startedAt}
  weather: null,      // {daily:[], hourly:[], at}
  mail: null,         // {date, items, text}
  mailBusy: false,
  brief: null,        // Morgenbericht {date, text}
  team: null,         // {focus:{weekKey:text}, cockpit:{…}}
  finance: null,      // {months:{…}}
  q: '',              // Suche
  matchInfo: null,    // Spielinfo-Formular
  clean: null,        // Mail-Aufräumen
  ttImport: null,     // Stundenplan-Import
  reports: null,      // geplante Berichte {list, state}
  repEdit: null,      // Bericht im Bearbeiten
  listening: false,
  siriDone: null,     // bereits übernommene Siri-Mails
  focus: null,        // laufender Fokus-/Zeit-Timer {mode, label, ref, cat, startedAt, dur}
  trash: [],          // Papierkorb
  meals: null,        // Essensplan
  focusDur: 25,
  examPlan: null,     // Vorschlag Klausur-Lernplan
  draft: null,        // Antwortentwurf für eine Mail
  log: [],            // Protokoll: was Jarvis gemacht hat
  uniAsk: null,       // Frage an die Unterlagen eines Fachs
  showQuiet: false    // Hinweise trotz Ruhezeit zeigen
};
const CCR = 'Claude Code Remote', FREE_SLOT = 'Jarvis Bericht (frei)';
const WX = 'AccuWeather®', GMAIL = 'Gmail';
const DEFAULT_RULES = 'Ich arbeite 20 Stunden pro Woche in Gleitzeit an 3 Arbeitstagen: Mittwoch, Donnerstag und Freitag. Mittwoch und Donnerstag sind lange Tage, Freitag ist ein kurzer Tag und immer Homeoffice. Zusätzlich ist entweder Mittwoch ODER Donnerstag Homeoffice; am anderen der beiden Tage bin ich im Büro und wechsle meist mittags ins Homeoffice. Arbeitszeit frühestens 7 Uhr, spätestens 19 Uhr. Gesetzliche Pausen beachten (ab 6 Stunden 30 Minuten, ab 9 Stunden 45 Minuten).';
try { const c = JSON.parse(localStorage.getItem('jarvis.look') || 'null'); if (c) Object.assign(S.settings, c); } catch (e) {}
// Letzter Kalender-Stand, damit Termine sofort da sind, auch bevor Google antwortet (höchstens 2 Tage alt)
try { const g = JSON.parse(localStorage.getItem('jarvis.gcal') || 'null'); if (g && Array.isArray(g.list) && Date.now() - g.at < 2 * 864e5) { S.gcal = g.list; S.gcalOld = g.at; } } catch (e) {}

/* ===================== Speicher (Claude-Datenbank, sonst lokal) ===================== */
let db = null, sample = null, downloads = null, mcp = null, assets = null;
const GCAL = 'Google Calendar';
const LOCAL_KEY = 'jarvis.local';
const local = {
  read() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; } },
  write(o) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); } catch (e) {} }
};
const store = {
  async setItem(it) {
    if (db) return db.collection('items').doc(it.id).set(it);
    const o = local.read(); o.items = o.items || {}; o.items[it.id] = it; local.write(o); S.items = Object.values(o.items); render();
  },
  async delItem(id) {
    if (db) return db.collection('items').doc(id).delete();
    const o = local.read(); if (o.items) delete o.items[id]; local.write(o); S.items = Object.values(o.items || {}); render();
  },
  async setSettings(s) {
    try { localStorage.setItem('jarvis.look', JSON.stringify({ mode: s.mode, palette: s.palette, design: s.design, jpal: s.jpal })); } catch (e) {}
    if (db) return db.doc('meta/settings').set(s);
    const o = local.read(); o.settings = s; local.write(o);
  },
  async setTimer(t) {
    if (db) return db.doc('meta/timer').set(t || { subjectId: null });
    S.timer = t; const o = local.read(); o.timer = t; local.write(o); render();
  },
  async setMeta(name, data) {
    if (db) return db.doc('meta/' + name).set(data);
    S[name] = data; const o = local.read(); o[name] = data; local.write(o); render();
  },
  async setTrash(it) {
    if (db) return db.collection('trash').doc(it.id).set({ item: it, deletedAt: new Date().toISOString() });
    const o = local.read(); o.trash = o.trash || {}; o.trash[it.id] = { item: it, deletedAt: new Date().toISOString(), id: it.id }; local.write(o); S.trash = Object.values(o.trash);
  },
  async delTrash(id) {
    if (db) return db.collection('trash').doc(id).delete();
    const o = local.read(); if (o.trash) delete o.trash[id]; local.write(o); S.trash = Object.values(o.trash || {}); render();
  },
  async setChat(c) {
    if (db) return db.doc('meta/chat').set({ log: c });
    const o = local.read(); o.chat = c; local.write(o);
  }
};
const withRetry = async (fn) => { try { return await fn(); } catch (e) { if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); return fn(); } throw e; } };

async function boot() {
  applyLook();
  render();
  // Eigene App: Anmeldung + Firebase (js/00-start.js), Google über js/google.js. Keine KI (sample bleibt leer).
  const c = await jarvisConnect();
  if (c) { db = c.db; mcp = c.mcp; downloads = c.downloads; assets = c.assets || null; }
  if (db) {
    S.online = true;
    db.collection('items').onSnapshot(snap => { S.items = snap.docs.map(d => ({ ...d.data(), id: d.id })); S.loaded = true; render(); }, onDbError);
    db.doc('meta/settings').onSnapshot(snap => {
      if (!S.setSeen) { S.setSeen = true; S.setExists = snap.exists; }
      if (snap.exists) { S.settings = { ...S.settings, ...snap.data() }; try { localStorage.setItem('jarvis.look', JSON.stringify({ mode: S.settings.mode, palette: S.settings.palette, design: S.settings.design, jpal: S.settings.jpal })); } catch (e) {} applyLook(); render(); }
    }, onDbError);
    db.doc('meta/timer').onSnapshot(snap => { S.timer = snap.exists && snap.data().subjectId ? snap.data() : null; render(); }, onDbError);
    db.doc('meta/chat').onSnapshot(snap => { S.chat = snap.exists ? (snap.data().log || []) : []; render(); }, onDbError);
    db.doc('meta/focus').onSnapshot(snap => { S.focus = snap.exists && snap.data().mode ? snap.data() : null; render(); }, onDbError);
    db.doc('meta/meals').onSnapshot(snap => { S.meals = snap.exists ? snap.data() : null; render(); }, onDbError);
    db.collection('trash').onSnapshot(snap => { S.trash = snap.docs.map(d => ({ ...d.data(), id: d.id })); render(); }, onDbError);
    setTimeout(purgeTrash, 5000);
    db.collection('log').onSnapshot(snap => { S.log = snap.docs.map(d => ({ ...d.data(), id: d.id })); render(); }, onDbError);
    setTimeout(purgeLog, 6000);
    db.doc('meta/siri').onSnapshot(snap => { S.siriDone = snap.exists ? (snap.data().done || []) : []; S.siriFix1 = snap.exists && !!snap.data().fix1; }, onDbError);
    db.doc('meta/team').onSnapshot(snap => { S.team = snap.exists ? snap.data() : null; render(); }, onDbError);
    db.doc('meta/finance').onSnapshot(snap => { S.finance = snap.exists ? snap.data() : null; render(); }, onDbError);
    db.doc('meta/mail').onSnapshot(snap => { S.mail = snap.exists ? snap.data() : null; render(); }, onDbError);
    db.doc('meta/brief').onSnapshot(snap => { S.brief = snap.exists ? snap.data() : null; briefLoaded = true; render(); setTimeout(maybeAutoBrief, 4000); }, onDbError);
    ['briefEvening', 'briefWeekly', 'briefCustom'].forEach(k => db.doc('meta/' + k).onSnapshot(snap => { S[k] = snap.exists ? snap.data() : null; render(); }, onDbError));
    if (mcp) { fetchGcal(); fetchWeather(); setTimeout(checkSiriInbox, 2500); setInterval(() => { if (!document.hidden) { fetchGcal(); fetchWeather(); checkSiriInbox(); } }, 10 * 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSiriInbox(); }); }
  } else {
    const o = local.read();
    S.items = Object.values(o.items || {}); S.timer = o.timer || null; S.focus = o.focus || null; S.meals = o.meals || null; S.trash = Object.values(o.trash || {}); S.team = o.team || null; S.finance = o.finance || null; if (o.settings) S.settings = { ...S.settings, ...o.settings }; S.setSeen = true; S.setExists = !!o.settings; S.chat = o.chat || []; S.log = Object.values(o.log || {}); S.loaded = true;
    applyLook(); render();
  }
}
function onDbError(e) { if (e && e.code === 'revoked') { S.online = false; render(); } else { showToast('Verbindung zur Datenbank gestört. Bitte Seite neu laden.'); } }

/* ===================== Aussehen ===================== */
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function resolvedMode() {
  const m = S.settings.mode || 'auto';
  if (m === 'light' || m === 'dark') return m;
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return mq.matches ? 'dark' : 'light';
}
function applyLook() {
  // „Automatisch“: erst Claude (data-theme), dann das Gerät; das Ergebnis steht immer fest in data-mode
  const html = document.documentElement, m = S.settings.mode || 'auto';
  html.dataset.mode = resolvedMode(); html.style.colorScheme = html.dataset.mode;
  if (isJarvis()) { delete html.dataset.palette; html.dataset.design = 'jarvis'; html.dataset.jcol = jpalId(); }
  else { html.dataset.palette = S.settings.palette || 'smaragd'; delete html.dataset.design; delete html.dataset.jcol; }
}
const isJarvis = () => true;   // eigene App: nur das Rüstung-Design
const jpalId = () => JPALETTES.some(p => p.id === S.settings.jpal) ? S.settings.jpal : 'rotgold';
mq.addEventListener && mq.addEventListener('change', () => { applyLook(); });
try { new MutationObserver(() => { if ((S.settings.mode || 'auto') === 'auto' && document.documentElement.dataset.mode !== resolvedMode()) applyLook(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

/* ===================== Farbwahl (9 Farbkombis, je hell + dunkel) ===================== */
// Jede Kombi färbt die ganze App: Hintergrund, Kacheln, Flächen, Linien, Schrift, Menüleiste und Akzente.
// Ampelfarben (--g --y --o --r) bleiben immer gleich. Lime und Butter-Gelb nur als Menü-Markierung bzw. Knopf-Schrift.
const PK = ['bg', 'card', 'soft', 'ln', 'tx', 'mu', 'ac', 'onac', 'acs', 'onacs', 'nav', 'navtx', 'navon', 'onnavon'];
const pv = s => Object.fromEntries(s.split(' ').map((x, i) => [PK[i], x]));
const PALETTES = [
  { id: 'smaragd', name: 'Emerald & Champagne', c: ['#064E3B', '#F8E7C9'],
    l: pv('#F7EEDC #FFFBF3 #EFE3CB #E2D2B4 #062A20 #56625A #064E3B #F8E7C9 #DCEADF #064E3B #064E3B #CFE0D6 #F8E7C9 #064E3B'),
    d: pv('#04140F #0B231C #113127 #1B3D33 #F8EFE0 #A6B8AD #F8E7C9 #063A2D #124234 #F8E7C9 #020D0A #A6B8AD #F8E7C9 #064E3B') },
  { id: 'blau', name: 'Signal Blue & Porcelain', c: ['#0057FF', '#F8F7F4'],
    l: pv('#ECF0F8 #FBFAF7 #E0E7F5 #CFD9EE #0A1633 #4F5B76 #0057FF #FFFFFF #D8E4FF #0039B3 #0A1633 #C3CDE3 #0057FF #FFFFFF'),
    d: pv('#060C1C #0D1731 #14213F #1F2D52 #F8F7F4 #9DA9C5 #6E9DFF #001A4D #122A60 #D3E0FF #030713 #9DA9C5 #0057FF #FFFFFF') },
  { id: 'violett', name: 'Ultra Violet & Soft Apricot', c: ['#6A00F4', '#FFD6A5'],
    l: pv('#FFF1E1 #FFFAF3 #FBE4C9 #EFD2B1 #24004F #68567C #6A00F4 #FFFFFF #ECDFFF #4A00AB #3D0090 #D9C9F2 #FFD6A5 #3D0090'),
    d: pv('#100521 #1B0C35 #251346 #311B59 #FFF1E1 #B5A5CE #FFD6A5 #3D0090 #321566 #FFD6A5 #0A0316 #B5A5CE #FFD6A5 #3D0090') },
  { id: 'pink', name: 'Dragonfruit & Night Violet', c: ['#FF4696', '#1E1033'],
    l: pv('#FCEEF4 #FFF9FB #F7E0EA #EDCCDB #1E1033 #6B5871 #C8156A #FFFFFF #FFDAEA #1E1033 #1E1033 #D8C7E6 #FF4696 #1E1033'),
    d: pv('#130A20 #1E1033 #281744 #382156 #FFF0F6 #BDA7CA #FF4696 #1E1033 #3D1749 #FFC2DC #0C0615 #BDA7CA #FF4696 #1E1033') },
  { id: 'lime', name: 'Lime Spark & Graphite', c: ['#B6FF2E', '#23262F'],
    l: pv('#EDEEF1 #FFFFFF #E3E5EB #D3D6DE #16181E #585D69 #23262F #B6FF2E #E1E4EA #23262F #23262F #C8CCD6 #B6FF2E #23262F'),
    d: pv('#121419 #1C1F26 #252830 #30343F #F2F4F7 #A1A7B4 #E3E5EB #23262F #2C3039 #E3E5EB #0A0B0E #A1A7B4 #B6FF2E #23262F') },
  { id: 'butter', name: 'Butter Yellow & Royal Iris', c: ['#FFF275', '#3A0CA3'],
    l: pv('#FAF7E3 #FFFEF7 #F1ECD0 #E3DDBC #1C0656 #5F5979 #3A0CA3 #FFF275 #E8E1FA #3A0CA3 #3A0CA3 #D9D0F7 #FFF275 #3A0CA3'),
    d: pv('#0D0526 #170B3B #201151 #2C1B64 #FFFBE3 #B1A9D0 #BBA8F7 #1C0656 #2A167C #E4DCFF #08021A #B1A9D0 #FFF275 #3A0CA3') },
  { id: 'petrol', name: 'Deep Teal & Coral', c: ['#0F4C5C', '#FF8A73'],
    l: pv('#EEF4F3 #FBFDFC #E1ECEA #CFDFDC #0A2E37 #4E6469 #0F4C5C #FFFFFF #D7E9EA #0F4C5C #0F4C5C #C5DCDF #FF8A73 #0A2E37'),
    d: pv('#051418 #0B2228 #112E35 #1A3B43 #F1F7F6 #9FB5B8 #FF8A73 #0A2E37 #14424D #FFD2C8 #020B0D #9FB5B8 #FF8A73 #0A2E37') },
  { id: 'navy', name: 'Midnight Navy & Saffron', c: ['#14213D', '#FCA311'],
    l: pv('#F1F2F5 #FFFFFF #E5E8EE #D4D9E3 #14213D #535D72 #14213D #FCA311 #E0E5EF #14213D #14213D #C3CAD9 #FCA311 #14213D'),
    d: pv('#080D19 #101A30 #16223D #212E4C #F5F3EE #A0A9BD #E5E8EE #14213D #1C2B4D #E5E8EE #04070E #A0A9BD #FCA311 #14213D') },
  { id: 'kakao', name: 'Cocoa & Oat', c: ['#4A2C2A', '#EFE6D8'],
    l: pv('#F3EDE3 #FCF9F4 #E9E0D2 #DCD0BE #2B1917 #6B5A54 #4A2C2A #EFE6D8 #E7D8CC #4A2C2A #4A2C2A #E0D2CB #EFE6D8 #4A2C2A'),
    d: pv('#140C0B #211514 #2C1D1B #3A2825 #F5EFE6 #B8A9A2 #EFE6D8 #4A2C2A #3D2826 #EFE6D8 #0C0706 #B8A9A2 #EFE6D8 #4A2C2A') }
];
function paletteCss() {
  const v = o => Object.entries(o).map(([k, x]) => '--' + k + ':' + x).join(';');
  // "html:root" ist stärker als die Grundfarben, damit die Kombi auch im Hellmodus wirklich greift
  return PALETTES.map(p => {
    const r = 'html:root[data-palette="' + p.id + '"]';
    return r + '{' + v(p.l) + '}' +
      '@media (prefers-color-scheme:dark){' + r + ':not([data-theme="light"]):not([data-mode="light"]){' + v(p.d) + '}}' +
      r + '[data-theme="dark"]:not([data-mode="light"]),' + r + '[data-mode="dark"]{' + v(p.d) + '}';
  }).join('\n');
}
(function () { const st = document.createElement('style'); st.id = 'palettes'; st.textContent = paletteCss(); document.head.appendChild(st); document.documentElement.dataset.palette = S.settings.palette || 'smaragd'; })();
/* ===================== Design „Jarvis“ (Rüstung): 6 Farben, je hell + dunkel ===================== */
// Zusätzlich zu den Grundfarben: --jstr (Signalfarbe, z. B. Rot), --onjstr (Schrift darauf), --jglow (Leuchten, als r,g,b), --jtrk (Grund der Tagesleiste)
const JK = ['bg', 'card', 'soft', 'ln', 'tx', 'mu', 'ac', 'onac', 'acs', 'onacs', 'nav', 'navtx', 'navon', 'onnavon', 'jstr', 'onjstr', 'jglow', 'jtrk'];
const jv = s => Object.fromEntries(s.split(' ').map((x, i) => [JK[i], x]));
const JPALETTES = [
  { id: 'rotgold', name: 'Rot-Gold', c: ['#E8B04B', '#C8322B', '#0F0C0B'],
    l: jv('#F4EFE7 #FFFFFF #EBE4D9 #DDD0BC #1E1714 #685847 #8F5F0F #FFFFFF #F3E3C4 #5E3D06 #1E1714 #D8C7A8 #C8322B #FFFFFF #C8322B #FFFFFF 200,50,43 #EDE5D8'),
    d: jv('#0F0C0B #1B1513 #2A211D #47371C #F3E9D8 #BFAE90 #E8B04B #1A120A #3A2621 #E8B04B #16110F #D8C7A8 #C8322B #FFF6EC #C8322B #FFF6EC 210,59,47 #1D1714') },
  { id: 'stealth', name: 'Stealth (Silber-Rot)', c: ['#C8D0D8', '#C8222A', '#0B0C0E'],
    l: jv('#EDEFF2 #FFFFFF #E3E6EA #CDD2D8 #111417 #5B6670 #2B3138 #FFFFFF #E1E4E8 #2B3138 #111417 #C3CBD3 #C8222A #FFFFFF #C8222A #FFFFFF 200,34,42 #E4E7EB'),
    d: jv('#0B0C0E #17191C #24272B #3C3F43 #EEF1F4 #A3ACB5 #C8D0D8 #0B0C0E #2A2E33 #EEF1F4 #121417 #C3CBD3 #C8222A #FFFFFF #C8222A #FFFFFF 215,38,46 #1A1D21') },
  { id: 'warmachine', name: 'War Machine (Stahl-Orange)', c: ['#FF8A2A', '#3F5E7E', '#101215'],
    l: jv('#EEF0F3 #FFFFFF #E3E7EC #CED5DD #14181D #586270 #A04808 #FFFFFF #FBE6D3 #7A3605 #14181D #C9CFD6 #3F5E7E #FFFFFF #3F5E7E #FFFFFF 255,138,42 #E6EAEF'),
    d: jv('#101215 #1C2025 #272C33 #4E311A #EDEFF2 #9AA3AD #FF8A2A #1A0E04 #2E3540 #FFB066 #171A1E #C9CFD6 #3F5E7E #FFFFFF #3F5E7E #FFFFFF 255,138,42 #1F2329') },
  { id: 'bordeaux', name: 'Bordeaux-Gold', c: ['#D9A441', '#8E1B2C', '#120A0C'],
    l: jv('#F6EFEC #FFFFFF #EDE2DE #DCCBC5 #22100F #6E5550 #8E1B2C #FFFFFF #F5E6C8 #6A4A0E #1C0D10 #DCCBBE #D9A441 #1A1004 #8E1B2C #FFFFFF 142,27,44 #EFE5E1'),
    d: jv('#120A0C #201216 #2C1820 #46321A #F5ECE6 #B9A396 #D9A441 #1A1004 #3A1C24 #D9A441 #1A0E11 #DCCBBE #8E1B2C #FFFFFF #8E1B2C #FFFFFF 142,27,44 #22141A') },
  { id: 'smaragd', name: 'Smaragd-Champagner', c: ['#F8E7C9', '#0E7A5C', '#04100C'],
    l: jv('#F1F4EF #FFFFFF #E5ECE6 #CFDCD3 #062A20 #4F6258 #064E3B #F8E7C9 #F8E7C9 #064E3B #04100C #D4DED6 #F8E7C9 #064E3B #0E7A5C #FFFFFF 16,185,129 #E7EEE9'),
    d: jv('#04100C #0B1E17 #12291F #43483D #F1F5F0 #A3B8AB #F8E7C9 #1A1408 #12382B #F8E7C9 #081812 #D4DED6 #0E7A5C #FFFFFF #0E7A5C #FFFFFF 16,185,129 #0E241C') },
  { id: 'carbon', name: 'Carbon-Gelb', c: ['#F5D90A', '#E5E5E5', '#0B0B0B'],
    l: jv('#F2F2F0 #FFFFFF #E6E6E3 #D2D2CE #111111 #5E5E5E #111111 #F5D90A #FFF6B0 #111111 #0B0B0B #D0D0D0 #F5D90A #111111 #111111 #F5D90A 245,217,10 #E9E9E6'),
    d: jv('#0B0B0B #181818 #262626 #48410B #F4F4F4 #A6A6A6 #F5D90A #111111 #2E2E2E #F5D90A #131313 #D0D0D0 #E5E5E5 #111111 #E5E5E5 #111111 245,217,10 #1C1C1C') }
];
(function () {
  const v = o => Object.entries(o).map(([k, x]) => '--' + k + ':' + x).join(';');
  const css = JPALETTES.map(p => {
    const r = 'html:root[data-design="jarvis"][data-jcol="' + p.id + '"]';
    return r + '{' + v(p.l) + '}' +
      '@media (prefers-color-scheme:dark){' + r + ':not([data-theme="light"]):not([data-mode="light"]){' + v(p.d) + ';color-scheme:dark}}' +
      r + '[data-theme="dark"]:not([data-mode="light"]),' + r + '[data-mode="dark"]{' + v(p.d) + ';color-scheme:dark}';
  }).join('\n');
  const st = document.createElement('style'); st.id = 'jpalettes'; st.textContent = css; document.head.appendChild(st); applyLook();
})();
function designSettings() { return '';   // eigene App: nur Rüstung, keine Auswahl
}
function designSettingsAlt() {
  const j = isJarvis();
  return '<section class="card"><h2 class="label">Design</h2><div class="dsgn" role="group" aria-label="Design">' +
    '<button data-look="klassisch" aria-pressed="' + !j + '">Klassisch<small>Ruhig und sauber, runde Ecken</small></button>' +
    '<button data-look="jarvis" aria-pressed="' + j + '">Jarvis<small>Futuristisch wie die Iron-Man-Rüstung</small></button></div></section>';
}
function paletteSettings() {
  if (isJarvis()) {
    const cj = jpalId();
    return '<section class="card"><h2 class="label">Farben</h2><div class="palgrid" role="group" aria-label="Jarvis-Farbe">' +
      JPALETTES.map(p => '<button class="palbtn" data-jc="' + p.id + '" aria-pressed="' + (cj === p.id) + '"><span class="palsw">' + p.c.map(x => '<i style="background:' + x + '"></i>').join('') + '</span><span>' + esc(p.name) + (p.id === 'rotgold' ? ' <small class="sub">Standard</small>' : '') + '</span></button>').join('') +
      '</div></section>';
  }
  const cur = S.settings.palette || 'smaragd';
  return '<section class="card"><h2 class="label">Farben</h2><div class="palgrid" role="group" aria-label="Farbkombi">' +
    PALETTES.map(p => '<button class="palbtn" data-pal="' + p.id + '" aria-pressed="' + (cur === p.id) + '"><span class="palsw"><i style="background:' + p.c[0] + '"></i><i style="background:' + p.c[1] + '"></i></span><span>' + esc(p.name) + (p.id === 'smaragd' ? ' <small class="sub">Standard</small>' : '') + '</span></button>').join('') +
    '</div></section>';
}

