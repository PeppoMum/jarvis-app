// Prüfungen für den Fokus-Timer. Start im Repo-Ordner: node fokus/test.mjs (braucht playwright mit Chromium).
// Teil 1 prüft den Rechenkern direkt (schnell, jede Regel einzeln).
// Teil 2 bedient die echte Seite in Chromium mit gesteuerter Uhr: 25-Minuten-Runden laufen in Sekunden durch.
// Arbeitet ohne Netz (eigener kleiner Server nur für fokus/). Bei einem Fehler: Ende mit Code 1.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MIN = 60000;
let fails = 0, passed = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(m + ': erwartet ' + B + ', war ' + A); };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('hängt (über ' + ms / 1000 + ' s)')), ms))]);
async function check(name, fn) {
  const t0 = Date.now();
  try { await withTimeout(Promise.resolve().then(fn), 60000); passed++; console.log('  ok     ' + name + (Date.now() - t0 > 5000 ? '  (' + Math.round((Date.now() - t0) / 1000) + ' s)' : '')); }
  catch (e) { fails++; console.log('  FEHLER ' + name + '\n         ' + String(e.message).split('\n')[0]); }
}

/* =================== Teil 1: Rechenkern =================== */
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(DIR, 'engine.js'), 'utf8'), ctx);
const E = ctx.FokusEngine;
const T0 = new Date('2026-11-12T10:00:00').getTime();
const set = o => E.cleanSettings(Object.assign({}, o));
// Lässt die Zeit in kleinen Schritten laufen und sammelt alle Ereignisse
function runFor(r, from, ms, stepMs = 1000) { const ev = []; for (let t = from + stepMs; t <= from + ms; t += stepMs) { const x = E.step(r, t); r = x.run; ev.push(...x.events); } return { r, ev, now: from + ms }; }

console.log('Teil 1: Rechenkern');
await check('Einstellungen: Grenzen und Standardwerte', () => {
  const s = set({ blockMin: 0, rounds: { w: 999, p: -3, l: 'x', n: 20 }, volume: 150, topics: [' Uni ', 'Uni', '', 'Arbeit'], sound: 'trompete', mode: 'quatsch' });
  eq(s.blockMin, 30, 'Block 0 → Standard'); eq(s.rounds.w, 180, 'Fokus höchstens 180'); eq(s.rounds.p, 5, 'Pause negativ → Standard');
  eq(s.rounds.l, 15, 'lange Pause unlesbar → Standard'); eq(s.rounds.n, 8, 'höchstens 8 Runden'); eq(s.volume, 100, 'Lautstärke höchstens 100');
  eq(s.topics, ['Uni', 'Arbeit'], 'Themen ohne Leere und Doppelte'); eq(s.sound, 'gong', 'unbekannter Ton → Gong'); eq(s.mode, 'block', 'unbekannter Modus → Block');
  const d = set(); eq([d.overBlock, d.overRounds, d.autoPause, d.iphoneTimer], [true, true, true, false], 'Standard: Nachspielzeit an, Pausen automatisch, iPhone-Timer aus');
});
await check('Block 30 Min ohne Nachspielzeit: endet genau nach 30 Min und speichert 30 Min', () => {
  const r = E.newRun(set({ overBlock: false }), { mode: 'block' }, T0);
  let x = E.step(r, T0 + 30 * MIN - 1000); eq(x.events, [], 'kurz vorher noch nichts');
  x = E.step(r, T0 + 30 * MIN); eq(x.events, ['focusEnd', 'done'], 'pünktlich zu Ende'); eq(E.sessionOf(x.run).actualMin, 30, 'gespeicherte Zeit');
});
await check('Block mit Nachspielzeit: Signal einmal, Uhr zählt weiter (+03:12), nach 30 Min einmal Erinnerung', () => {
  const r = E.newRun(set(), { mode: 'block', min: 30 }, T0);
  const a = runFor(r, T0, 33 * MIN + 12000);
  eq(a.ev, ['focusEnd'], 'genau ein Signal'); const v = E.view(a.r, a.now);
  eq(E.fmtClock(v.overMs), '03:12', 'Nachspielzeit'); eq(a.r.phase, 'focus', 'läuft weiter');
  const b = runFor(a.r, a.now, 27 * MIN); eq(b.ev, ['overRemind'], 'Erinnerung nach 30 Min Nachspielzeit');
  const c = runFor(b.r, b.now, 20 * MIN); eq(c.ev, [], 'Erinnerung nur einmal');
  const f = E.act(c.r, 'finish', c.now); eq(E.sessionOf(f).actualMin, 80.2, 'Fertig: Zeit inkl. Nachspielzeit');
});
await check('Runden 25/5 × 8: lange Pause nur nach der 4. Runde, Ende nach Runde 8 ohne Pause', () => {
  let r = E.newRun(set({ overRounds: false, rounds: { n: 8 } }), { mode: 'rounds' }, T0), t = T0; const log = [];
  for (let i = 0; i < 400 && r.phase !== 'done'; i++) { t += MIN; const x = E.step(r, t); if (x.events.includes('pauseStart')) log.push(x.run.pMs / MIN); r = x.run; }
  eq(log, [5, 5, 5, 15, 5, 5, 5], 'Pausenlängen'); eq(r.round, 8, 'acht Runden'); eq(E.sessionOf(r).actualMin, 200, '8 × 25 Min Fokus gespeichert');
  eq(r.endAt, T0 + (8 * 25 + 6 * 5 + 15) * MIN, 'Endzeit genau');
});
await check('Handy 47 Min gesperrt (ein einziger Rechenschritt): steht genau richtig in Runde 2', () => {
  const r = E.newRun(set({ overRounds: false }), { mode: 'rounds' }, T0);
  const x = E.step(r, T0 + 47 * MIN);
  eq(x.events, ['focusEnd', 'pauseStart', 'pauseEnd', 'focusStart'], 'verpasste Wechsel nachgeholt');
  const v = E.view(x.run, T0 + 47 * MIN); eq([x.run.round, x.run.phase, E.fmtLeft(v.leftMs)], [2, 'focus', '08:00'], 'Runde 2, noch 8 Min');
});
await check('Runden mit Nachspielzeit: Pause verschiebt sich um die Nachspielzeit', () => {
  let r = E.newRun(set(), { mode: 'rounds' }, T0);
  let x = E.step(r, T0 + 28 * MIN); eq(x.events, ['focusEnd'], 'Signal, aber keine Pause'); eq(x.run.phase, 'focus', 'Uhr läuft weiter');
  r = E.act(x.run, 'takePause', T0 + 28 * MIN);
  eq([r.phase, r.pStart, r.pMs], ['pause', T0 + 28 * MIN, 5 * MIN], 'Pause beginnt erst jetzt'); eq(r.focusMs, 28 * MIN, '28 Min Fokus gezählt');
  x = E.step(r, T0 + 33 * MIN); eq(x.run.phase, 'focus', 'nach der Pause Runde 2'); eq(x.run.pStart, T0 + 33 * MIN, 'Runde 2 ab 10:33');
});
await check('Pausen per Tippen: wartet nach Fokus und nach Pause, bis getippt wird', () => {
  let r = E.newRun(set({ autoPause: false, overRounds: false }), { mode: 'rounds' }, T0);
  let x = E.step(r, T0 + 40 * MIN); eq(x.run.phase, 'wait-pause', 'wartet auf Pause'); eq(x.run.focusMs, 25 * MIN, 'nur 25 Min zählen');
  r = E.act(x.run, 'startPause', T0 + 40 * MIN); x = E.step(r, T0 + 60 * MIN); eq(x.run.phase, 'wait-focus', 'wartet auf Runde 2');
  r = E.act(x.run, 'nextRound', T0 + 61 * MIN); eq([r.phase, r.round, r.pStart], ['focus', 2, T0 + 61 * MIN], 'Runde 2 ab Tippen');
});
await check('Anhalten: Zeit steht, Weiter macht genau dort weiter, Endzeit verschiebt sich', () => {
  let r = E.newRun(set(), { mode: 'block', min: 30 }, T0);
  r = E.act(r, 'hold', T0 + 10 * MIN); eq(E.step(r, T0 + 90 * MIN).events, [], 'angehalten: kein Ende');
  eq(E.fmtLeft(E.view(r, T0 + 90 * MIN).leftMs), '20:00', 'Restzeit bleibt');
  r = E.act(r, 'resume', T0 + 15 * MIN); eq(E.view(r, T0 + 15 * MIN).endsAt, T0 + 35 * MIN, 'neues Ende 10:35');
  r = E.act(r, 'finish', T0 + 20 * MIN); eq(E.sessionOf(r).actualMin, 15, 'angehaltene Zeit zählt nicht als Fokus');
});
await check('Früh beenden ist kein Scheitern: gearbeitete Zeit wird gespeichert', () => {
  const r = E.act(E.newRun(set(), { mode: 'block', min: 60, topic: 'Uni', intent: 'Gliederung' }, T0), 'finish', T0 + 12 * MIN + 30000);
  const s = E.sessionOf(r); eq([s.actualMin, s.planMin, s.topic, s.intent, s.mode], [12.5, 60, 'Uni', 'Gliederung', 'block'], 'Eintrag');
  ok(s.start === new Date(T0).toISOString(), 'Datum im Eintrag');
});
await check('Offen: zählt hoch, endet nie von selbst, Pausenvorschlag ein Fünftel, mindestens 5', () => {
  const r = E.newRun(set(), { mode: 'open' }, T0);
  const a = runFor(r, T0, 3 * 60 * MIN, MIN); eq(a.ev, [], 'kein Ende, kein Signal');
  eq(E.fmtClock(E.view(a.r, a.now).elapsedMs), '3:00:00', 'Uhr zählt hoch');
  eq([E.breakSuggestion(10 * MIN), E.breakSuggestion(50 * MIN), E.breakSuggestion(90 * MIN)], [5, 10, 18], 'Vorschläge');
});
await check('Gedankenparkplatz: Notizen merken, leere ignorieren, löschen', () => {
  let r = E.newRun(set(), {}, T0); r = E.act(r, 'note', T0, ' Mail an Prof '); r = E.act(r, 'note', T0, '   '); r = E.act(r, 'note', T0, 'Bib-Ausweis');
  eq(r.notes, ['Mail an Prof', 'Bib-Ausweis'], 'Notizen'); r = E.act(r, 'dropNote', T0, 0); eq(r.notes, ['Bib-Ausweis'], 'gelöscht');
});
await check('Wochenübersicht: nur Montag bis Sonntag dieser Woche, je Thema', () => {
  const S = [{ start: '2026-11-09T08:00:00', topic: 'Uni', actualMin: 50 }, { start: '2026-11-12T08:00:00', topic: 'Uni', actualMin: 25 }, { start: '2026-11-15T21:00:00', topic: '', actualMin: 10 },
    { start: '2026-11-08T20:00:00', topic: 'Uni', actualMin: 999 }, { start: '2026-11-16T08:00:00', topic: 'Arbeit', actualMin: 999 }];
  const w = E.weekStats(S, T0); eq(w.total, 85, 'Summe'); eq(w.rows.map(r => [r.topic, r.min]), [['Uni', 75], ['Ohne Thema', 10]], 'Zeilen');
});

/* =================== Teil 2: echte Seite =================== */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/jarvis-app\/fokus\/?/, '/');
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, path.normalize(p));
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = 'http://127.0.0.1:' + server.address().port + '/jarvis-app/fokus/';

// Ersatz für Lautsprecher, Mitteilungen, Bildschirm-an, Kurzbefehl und (optional) die Anmeldung
const STUBS = (fake) => {
  window.__osc = []; window.__wake = 0; window.__notes = []; window.__open = []; window.__vis = 'visible'; window.__plays = [];
  class Ctx { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() {}
    createGain() { const p = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return { gain: p, connect() {} }; }
    createOscillator() { const o = { type: '', frequency: { value: 0 }, connect() {}, start() { window.__osc.push(o.frequency.value); }, stop() {} }; return o; } }
  window.AudioContext = window.webkitAudioContext = Ctx;
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake++; return { addEventListener() {}, async release() { window.__wake--; } }; } } });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  class N { constructor(t) { window.__notes.push(t); } static requestPermission() { N.asked = (N.asked || 0) + 1; return Promise.resolve(N.permission); } }
  N.permission = 'granted'; window.Notification = N;
  window.__fokusOpen = u => window.__open.push(u);
  let snd;   // welche Töne die App spielt: FokusSound beim Setzen einwickeln
  Object.defineProperty(window, 'FokusSound', { configurable: true, get: () => snd, set: v => { const play = v.play; snd = Object.assign({}, v, { play: (k, s, vol) => { window.__plays.push(k + ':' + s); return play(k, s, vol); } }); } });
  if (fake) {   // Anmeldung nachgebaut: zeigt, wie die App mit dem zweiten Gerät umgeht
    window.__cloud = { runs: [], sess: [] };
    const fs = { start: cb => { window.__remote = cb; return Promise.resolve({ email: 'test@example.org' }); }, signIn: async () => {}, signOut: async () => {}, user: () => ({ email: 'test@example.org' }),
      saveRun: (r, u) => window.__cloud.runs.push({ r: r && JSON.parse(JSON.stringify(r)), u }), saveSettings: () => {}, saveSession: s => window.__cloud.sess.push(JSON.parse(JSON.stringify(s))) };
    Object.defineProperty(window, 'FokusSync', { configurable: true, get: () => fs, set: () => {} });
  }
};
const browser = await chromium.launch();
async function fresh(o = {}) {
  const c = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, colorScheme: o.scheme || 'light', serviceWorkers: o.sw ? 'allow' : 'block', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await c.route(u => !u.href.startsWith(URL0), r => r.abort());   // ohne Netz
  await c.addInitScript(STUBS, !!o.fake);
  const page = await c.newPage(); page.setDefaultTimeout(5000);
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) page.errors.push(m.text()); });
  if (!o.realClock) await page.clock.install({ time: new Date('2026-11-12T09:59:00') });
  await page.goto(URL0);
  if (!o.realClock) await page.clock.pauseAt(new Date('2026-11-12T10:00:00'));   // Zeit läuft nur, wenn die Prüfung sie vorspult
  page.c = c; return page;
}
const T = (p, s) => p.locator(s).first().innerText();
const big = p => T(p, '[data-big]');
const ph = p => T(p, '[data-ph]');
const btn = (p, name) => p.getByRole('button', { name, exact: true }).click();
const plays = p => p.evaluate(() => { const x = window.__plays; window.__plays = []; return x; });
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('fokus-v2')));
const noErr = p => ok(!p.errors.length, 'Fehler auf der Seite: ' + p.errors.join(' | '));
const endNow = async p => { await btn(p, 'Beenden'); await btn(p, 'Wirklich beenden?'); };
const toggleSetting = async (p, key) => { await p.click('[data-go=settings]'); await p.locator('[data-tog=' + key + ']').click(); await p.click('[data-go=start]'); };

console.log('Teil 2: Seite im Browser');
await check('Vom Öffnen bis zum Start ein Tipp; während der Session nur Uhr und Knöpfe', async () => {
  const p = await fresh();
  eq(await p.locator('[data-mode=block]').getAttribute('aria-pressed'), 'true', 'Block vorgewählt');
  await btn(p, 'Start');
  eq(await ph(p), 'FOKUS', 'läuft'); eq(await big(p), '30:00', '30 Min'); eq(await T(p, '[data-sub]'), 'bis 10:30', 'Endzeit');
  eq(await plays(p), ['start:gong'], 'Ton beim Start (schaltet den Ton auf dem iPhone frei)');
  eq(await p.title(), '30:00 – Fokus', 'Restzeit im Tab-Titel');
  eq(await p.locator('.top, .chips, .intent, .seg').count(), 0, 'nichts außer Uhr und Knöpfen');
  eq(await p.locator('.ctl button').allInnerTexts(), ['Anhalten', 'Beenden', 'Gedankenparkplatz'], 'die drei Knöpfe');
  const r1 = Number(await p.locator('.disc .fill').getAttribute('r')); await p.clock.runFor(15 * MIN);
  const r2 = Number(await p.locator('.disc .fill').getAttribute('r')); ok(r1 > 45 && Math.abs(r2 - 46 * Math.sqrt(.5)) < .1, 'Scheibe schrumpft (halbe Zeit = halbe Fläche): ' + r1 + ' → ' + r2);
  noErr(p); await p.c.close();
});
await check('Block 45 mit Thema und Absicht → Nachspielzeit → Fertig → Rückblick gespeichert', async () => {
  const p = await fresh();
  await p.click('[data-blk="45"]'); await p.click('[data-topic="Uni"]'); await p.fill('[data-intent]', 'Gliederung Hausarbeit'); await btn(p, 'Start');
  eq(await T(p, '.intentv'), 'Gliederung Hausarbeit', 'Absicht klein unter der Uhr');
  await p.clock.runFor(48 * MIN + 12000);
  eq(await big(p), '+03:12', 'Nachspielzeit sichtbar'); eq(await ph(p), 'NACHSPIELZEIT', 'Beschriftung');
  eq(await p.locator('.run.over').count(), 1, 'andere Farbe'); eq(await p.title(), '+03:12 – Nachspielzeit', 'Tab-Titel');
  eq(await p.locator('.ctl button').allInnerTexts(), ['Pause', 'Fertig', 'Gedankenparkplatz'], 'Knöpfe Pause und Fertig');
  await btn(p, 'Fertig');
  eq(await T(p, '.lead'), '48 Min Fokus gespeichert · Uni\nGliederung Hausarbeit', 'Abschluss mit Zeit inkl. Nachspielzeit');
  await p.click('[data-rev=done][data-val=teilweise]'); await p.click('[data-rev=focus][data-val="3"]');
  await p.fill('[data-revnote]', 'Kapitel 2 fehlt'); await p.locator('[data-revnote]').dispatchEvent('change');
  const s = (await store(p)).sessions[0];
  eq([s.topic, s.intent, s.mode, s.planMin, s.actualMin], ['Uni', 'Gliederung Hausarbeit', 'block', 45, 48.2], 'Session');
  eq(s.review, { done: 'teilweise', focus: 3, note: 'Kapitel 2 fehlt' }, 'Rückblick');
  await btn(p, 'Fertig'); eq(await p.locator('[data-act=start]').count(), 1, 'zurück zum Start');
  noErr(p); await p.c.close();
});
await check('Rückblick überspringen: Session ist trotzdem gespeichert (ohne Rückblick)', async () => {
  const p = await fresh(); await btn(p, 'Start'); await p.clock.runFor(30 * MIN + 1000); await btn(p, 'Fertig'); await btn(p, 'Fertig');
  const s = (await store(p)).sessions; eq([s.length, s[0].actualMin, s[0].review], [1, 30, null], 'gespeichert');
  await p.c.close();
});
await check('Signal am Ende von Block: Ton „Zeit um“ genau einmal, nicht jede halbe Sekunde', async () => {
  const p = await fresh(); await btn(p, 'Start'); await plays(p);
  await p.clock.runFor(30 * MIN + 10000);
  eq(await plays(p), ['end:gong'], 'ein Signal'); await p.clock.runFor(5 * MIN); eq(await plays(p), [], 'danach still');
  await p.clock.runFor(25 * MIN); eq(await plays(p), ['remind:gong'], 'nach 30 Min Nachspielzeit eine sanfte Erinnerung');
  await p.c.close();
});
await check('Runden 2 × 25/5 ohne Nachspielzeit: Pause startet von allein, Farbe wechselt, Ende ohne Pause', async () => {
  const p = await fresh(); await toggleSetting(p, 'overRounds');
  await p.click('[data-mode=rounds]'); await p.click('[data-step=roundsN][data-d="-1"]'); await p.click('[data-step=roundsN][data-d="-1"]');
  await btn(p, 'Start'); await plays(p);
  eq(await ph(p), 'RUNDE 1 VON 2 · FOKUS', 'Runde 1'); eq(await p.locator('.dots i').count(), 2, 'zwei Punkte');
  await p.clock.runFor(25 * MIN);
  eq(await ph(p), 'RUNDE 1 VON 2 · PAUSE', 'Pause startet von allein'); eq(await p.locator('.run.pause').count(), 1, 'Pausenfarbe');
  eq(await big(p), '05:00', 'Pausenlänge'); eq(await plays(p), ['end:gong'], 'Signal Fokus-Ende');
  await p.clock.runFor(5 * MIN);
  eq(await ph(p), 'RUNDE 2 VON 2 · FOKUS', 'Runde 2 startet von allein'); eq(await plays(p), ['pauseEnd:gong'], 'Signal Pause-Ende');
  await p.clock.runFor(25 * MIN);
  eq(await T(p, 'h1'), 'Geschafft.', 'Ende nach Runde 2'); eq(await plays(p), ['end:gong'], 'Signal Ende');
  const s = (await store(p)).sessions[0]; eq([s.rounds, s.roundsOf, s.actualMin, s.planMin], [2, 2, 50, 50], 'Session');
  eq(await p.locator('[data-act=startBreak]').count(), 0, 'bei Runden kein Pausenvorschlag am Ende');
  noErr(p); await p.c.close();
});
await check('Runden mit Nachspielzeit: Pause-Knopf startet die Pause erst dann', async () => {
  const p = await fresh(); await p.click('[data-mode=rounds]'); await btn(p, 'Start');
  await p.clock.runFor(27 * MIN); eq(await big(p), '+02:00', 'Nachspielzeit'); await btn(p, 'Pause');
  eq(await ph(p), 'RUNDE 1 VON 4 · PAUSE', 'Pause'); eq(await T(p, '[data-sub]'), 'bis 10:32', 'Pause bis 10:32');
  await p.c.close();
});
await check('Pausen per Tippen: wartet, bis „Pause starten“ und „Runde 2 starten“ getippt werden', async () => {
  const p = await fresh(); await toggleSetting(p, 'overRounds'); await toggleSetting(p, 'autoPause');
  await p.click('[data-mode=rounds]'); await btn(p, 'Start'); await p.clock.runFor(31 * MIN);
  eq(await big(p), 'Zeit für eine Pause', 'wartet'); await btn(p, 'Pause starten'); eq(await big(p), '05:00', 'Pause ab Tippen');
  await p.clock.runFor(9 * MIN); eq(await big(p), 'Runde 2 wartet', 'wartet wieder'); await btn(p, 'Runde 2 starten');
  eq([await ph(p), await big(p)], ['RUNDE 2 VON 4 · FOKUS', '25:00'], 'Runde 2 ab Tippen');
  await p.c.close();
});
await check('Handy 47 Min gesperrt: beim Zurückkommen richtige Stelle und nur EIN Signal', async () => {
  const p = await fresh(); await toggleSetting(p, 'overRounds'); await p.click('[data-mode=rounds]');
  await btn(p, 'Start'); await plays(p);
  await p.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  await p.clock.fastForward(47 * MIN);   // springt ohne Zwischenschritte
  await p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  eq(await ph(p), 'RUNDE 2 VON 4 · FOKUS', 'Runde 2'); eq(await big(p), '08:00', 'Restzeit');
  eq((await plays(p)).length, 1, 'ein Signal, kein Tonfeuerwerk');
  await p.c.close();
});
await check('Mac: Mitteilung, wenn das Fenster im Hintergrund ist (nicht, wenn es vorne ist)', async () => {
  const p = await fresh(); await btn(p, 'Start');
  await p.evaluate(() => { window.__vis = 'hidden'; }); await p.clock.runFor(30 * MIN + 1000);
  eq(await p.evaluate(() => window.__notes), ['Zeit um'], 'Mitteilung im Hintergrund');
  await btn(p, 'Fertig'); await btn(p, 'Fertig'); await p.evaluate(() => { window.__vis = 'visible'; window.__notes = []; });
  await btn(p, 'Start'); await p.clock.runFor(30 * MIN); eq(await p.evaluate(() => window.__notes), [], 'keine Mitteilung, wenn sichtbar');
  await p.c.close();
});
await check('Mac: beim ersten Start einmal um Erlaubnis für Mitteilungen fragen, danach nie wieder', async () => {
  const p = await fresh(); await p.evaluate(() => { Notification.permission = 'default'; });
  await btn(p, 'Start'); await endNow(p); await btn(p, 'Fertig'); await btn(p, 'Start');
  eq(await p.evaluate(() => Notification.asked), 1, 'genau einmal gefragt');
  await p.c.close();
});
await check('Anhalten / Weiter und Beenden mit Rückfrage; früh beenden speichert die Zeit', async () => {
  const p = await fresh(); await btn(p, 'Start'); await p.clock.runFor(5 * MIN);
  await btn(p, 'Anhalten'); await p.clock.runFor(10 * MIN); eq(await big(p), '25:00', 'angehalten'); eq(await T(p, '[data-sub]'), 'angehalten', 'Hinweis');
  await btn(p, 'Weiter'); await p.clock.runFor(MIN); eq(await big(p), '24:00', 'weiter');
  await btn(p, 'Beenden'); eq(await p.locator('.run').count(), 1, 'ein Tipp beendet nicht');
  await p.clock.runFor(3500); eq(await T(p, '[data-act=end]'), 'Beenden', 'Rückfrage verschwindet');
  await endNow(p);
  eq(await T(p, 'h1'), 'Früher beendet – das zählt trotzdem.', 'freundlicher Abschluss'); eq((await store(p)).sessions[0].actualMin, 6.1, '6 Min + 3,5 s gespeichert');
  await p.c.close();
});
await check('Offen: zählt hoch, Beenden → Pausenvorschlag (ein Fünftel) änderbar → Pause läuft → zurück', async () => {
  const p = await fresh(); await p.click('[data-mode=open]'); await btn(p, 'Start');
  await p.clock.runFor(52 * MIN); eq(await big(p), '52:00', 'zählt hoch');
  await endNow(p);
  eq(await T(p, '[data-stepval=suggest]'), '10 Min', 'Vorschlag 52/5 ≈ 10');
  await p.click('[data-step=suggest][data-d="1"]'); eq(await T(p, '[data-stepval=suggest]'), '11 Min', 'änderbar');
  await btn(p, 'Pause starten'); eq(await big(p), '11:00', 'Pause läuft'); eq(await p.locator('.run.pause').count(), 1, 'Pausenfarbe');
  await p.clock.runFor(11 * MIN); eq(await T(p, 'h1'), 'Geschafft.', 'nach der Pause wieder der Rückblick');
  eq((await store(p)).sessions.length, 1, 'Pause ist keine eigene Session');
  noErr(p); await p.c.close();
});
await check('Gedankenparkplatz: Uhr läuft weiter, Notizen erscheinen am Ende, „Alles kopieren“ kopiert', async () => {
  const p = await fresh(); await btn(p, 'Start');
  await btn(p, 'Gedankenparkplatz'); await p.fill('[data-parkin]', 'Mail an Prof'); await p.press('[data-parkin]', 'Enter');
  await p.fill('[data-parkin]', 'Bib-Ausweis verlängern'); await btn(p, 'Merken');
  await p.clock.runFor(2 * MIN); eq(await big(p), '28:00', 'Uhr läuft weiter');
  await btn(p, 'Zurück zur Uhr'); eq(await T(p, '[data-act=park]'), 'Gedankenparkplatz (2)', 'Zähler');
  await endNow(p);
  eq(await p.locator('.card .notes li').allInnerTexts(), ['Mail an Prof', 'Bib-Ausweis verlängern'], 'Notizen am Ende');
  await btn(p, 'Alles kopieren'); eq(await p.evaluate(() => navigator.clipboard.readText()), 'Mail an Prof\nBib-Ausweis verlängern', 'Zwischenablage');
  await p.c.close();
});
await check('iPhone-Timer: Kurzbefehl „Fokus-Timer“ wird mit der Minutenzahl aufgerufen (nur wenn eingeschaltet)', async () => {
  const p = await fresh(); await btn(p, 'Start'); await p.clock.runFor(1000);
  eq(await p.evaluate(() => window.__open), [], 'aus: kein Aufruf'); await endNow(p); await btn(p, 'Fertig');
  await toggleSetting(p, 'iphoneTimer');
  await p.click('[data-blk="45"]'); await btn(p, 'Start'); await p.clock.runFor(1000);
  eq(await p.evaluate(() => window.__open), ['shortcuts://run-shortcut?name=Fokus-Timer&input=text&text=45'], 'Aufruf');
  await p.c.close();
});
await check('Hinweis „Bei gesperrtem Handy kein Ton“ auf dem iPhone, wenn der iPhone-Timer aus ist', async () => {
  const c = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await c.route(u => !u.href.startsWith(URL0), r => r.abort()); const p = await c.newPage(); await p.goto(URL0);
  ok((await T(p, '.hint')).startsWith('Bei gesperrtem Handy kein Ton.'), 'Hinweis fehlt');
  await c.close();
  const m = await fresh(); eq(await m.locator('.hint').count(), 0, 'am Mac kein Hinweis'); await m.c.close();
});
await check('Ton und Lautstärke: Pfiff klingt anders als Gong, Lautstärke 0 ist still', async () => {
  const p = await fresh();
  const sound = (kind, s, v) => p.evaluate(([k, s, v]) => { window.__osc = []; window.FokusSound.play(k, s, v); return window.__osc; }, [kind, s, v]);
  const g = await sound('end', 'gong', 70), f = await sound('end', 'pfiff', 70), z = await sound('end', 'gong', 0), pe = await sound('pauseEnd', 'gong', 70);
  ok(g.length >= 8 && g.every(x => x < 2000), 'Gong: tiefe Töne, zwei Schläge'); ok(f.some(x => x > 2500), 'Pfiff: hoher Ton');
  eq(z.length, 0, 'Lautstärke 0: still'); ok(JSON.stringify(pe) !== JSON.stringify(g), 'Pause-Ende klingt anders als Fokus-Ende');
  await p.click('[data-go=settings]'); await p.click('[data-sound=pfiff]'); await p.click('[data-go=start]'); await btn(p, 'Start'); await plays(p);
  await p.clock.runFor(30 * MIN); eq(await plays(p), ['end:pfiff'], 'gewählter Ton wird benutzt');
  await p.c.close();
});
await check('Einstellungen: Standardzeiten und Themen pflegen – alles bleibt nach dem Schließen', async () => {
  const p = await fresh(); await p.click('[data-go=settings]');
  await p.click('[data-step=rw][data-d="1"]'); await p.click('[data-step=rp][data-d="1"]');
  await p.click('[data-deltopic="3"]'); await p.fill('[data-topicin]', 'Lesen'); await btn(p, 'Hinzufügen');
  await p.locator('[data-tog=autoPause]').click();
  await p.reload(); await p.clock.runFor(100); await p.click('[data-go=settings]');
  eq(await T(p, '[data-stepval=rw]'), '30 Min', 'Fokus je Runde'); eq(await T(p, '[data-stepval=rp]'), '6 Min', 'Pause');
  eq(await p.locator('[data-tog=autoPause]').isChecked(), false, 'Pausen per Tippen');
  await p.click('[data-go=start]'); eq(await p.locator('.topics button').allInnerTexts(), ['Uni', 'Arbeit', 'Team', 'Lesen'], 'Themen');
  await p.click('[data-mode=rounds]'); ok((await T(p, '.pick .sub')).startsWith('30 Min Fokus, 6 Min Pause'), 'Startseite nutzt die neuen Zeiten');
  await p.c.close();
});
await check('Laufender Timer überlebt Schließen und Neuöffnen der App', async () => {
  const p = await fresh(); await p.click('[data-mode=rounds]'); await btn(p, 'Start'); await p.clock.runFor(7 * MIN);
  await p.reload(); await p.clock.runFor(600);
  eq(await ph(p), 'RUNDE 1 VON 4 · FOKUS', 'läuft weiter'); eq(await big(p), '18:00', 'Restzeit');
  await p.c.close();
});
await check('Wochenübersicht mit Balken je Thema und Export als JSON und CSV', async () => {
  const p = await fresh();
  for (const [t, m] of [['Uni', 45], ['Arbeit', 15], ['Uni', 30]]) { await p.click('[data-topic="' + t + '"]'); await p.click('[data-blk="' + m + '"]'); await btn(p, 'Start'); await p.clock.runFor(m * MIN + 1000); await btn(p, 'Fertig'); await btn(p, 'Fertig'); }
  await p.click('[data-go=week]');
  eq(await T(p, '[data-total]'), '1 Std. 30 Min Fokus', 'Summe');
  eq(await p.locator('.bar span').allInnerTexts(), ['Uni', 'Arbeit'], 'Balken je Thema');
  eq(await p.locator('.bar i').evaluateAll(l => l.map(x => x.style.width)), ['100%', '20%'], 'Balkenlänge im Verhältnis');
  const [dj] = await Promise.all([p.waitForEvent('download'), btn(p, 'Als JSON')]);
  const j = JSON.parse(fs.readFileSync(await dj.path(), 'utf8')); eq([j.app, j.sessions.length, j.sessions[0].topic, j.sessions[0].actualMin], ['Fokus', 3, 'Uni', 45], 'JSON');
  const [dc] = await Promise.all([p.waitForEvent('download'), btn(p, 'Als Tabelle (CSV)')]);
  const csv = fs.readFileSync(await dc.path(), 'utf8').replace(/^﻿/, '').split('\n');
  eq(csv.length, 4, 'Kopfzeile + 3 Zeilen'); ok(csv[0].startsWith('Start;Ende;Modus;Thema'), 'Kopfzeile'); ok(csv[1].includes(';Uni;') && csv[1].includes(';45;45;'), 'Zeile: ' + csv[1]);
  noErr(p); await p.c.close();
});
await check('iPhone und Mac: Timer und Sessions gehen hoch, Stand vom anderen Gerät wird übernommen, älterer nicht', async () => {
  const p = await fresh({ fake: true });
  await btn(p, 'Start');
  const up = await p.evaluate(() => window.__cloud.runs.at(-1)); eq([up.r.mode, up.r.pMs], ['block', 30 * MIN], 'laufender Timer hochgeladen');
  await p.clock.runFor(5 * MIN);   // anderes Gerät hat um 10:00 eine Runden-Session gestartet und meldet sich jetzt (10:05)
  await p.evaluate(() => { const E = window.FokusEngine, r = E.newRun(E.cleanSettings({}), { mode: 'rounds', intent: 'vom iPhone' }, Date.now() - 5 * 60000); window.__remote({ run: r, upd: Date.now() }); });
  eq(await ph(p), 'RUNDE 1 VON 4 · FOKUS', 'Session vom anderen Gerät angezeigt'); eq(await big(p), '20:00', 'mit der richtigen Restzeit'); eq(await T(p, '.intentv'), 'vom iPhone', 'Absicht');
  await p.evaluate(() => window.__remote({ run: null, upd: 1 })); eq(await ph(p), 'RUNDE 1 VON 4 · FOKUS', 'veralteter Stand wird ignoriert');
  await p.evaluate(() => window.__remote({ run: null, upd: Date.now() + 1 })); eq(await p.locator('[data-act=start]').count(), 1, 'anderes Gerät hat beendet → hier auch');
  await btn(p, 'Start'); await p.clock.runFor(30 * MIN + 1000); await btn(p, 'Fertig');
  eq(await p.evaluate(() => window.__cloud.sess.map(s => s.actualMin)), [30], 'Session sofort nach dem Ende hochgeladen');
  await p.click('[data-rev=done][data-val=ja]'); eq(await p.evaluate(() => window.__cloud.sess.at(-1).review), { done: 'ja' }, 'Rückblick hochgeladen');
  await p.evaluate(() => { window.__cloud.sess = []; window.__remote({ sessions: [{ id: 'sX', start: new Date().toISOString(), end: new Date().toISOString(), mode: 'block', topic: 'Team', intent: '', planMin: 20, actualMin: 20, notes: [], review: null }] }); });
  const ids = (await store(p)).sessions.map(s => s.id); eq(ids.length, 2, 'beide Sessions da'); ok(ids.includes('sX'), 'Session vom anderen Gerät');
  eq((await p.evaluate(() => window.__cloud.sess.map(s => s.id))).length, 1, 'eigene Session hochgeladen');
  noErr(p); await p.c.close();
});
await check('Bildschirm bleibt an, solange ein Timer läuft, danach wieder frei', async () => {
  const p = await fresh(); eq(await p.evaluate(() => window.__wake), 0, 'vorher aus');
  await btn(p, 'Start'); await p.clock.runFor(1000); eq(await p.evaluate(() => window.__wake), 1, 'an');
  await endNow(p); await p.clock.runFor(1000); eq(await p.evaluate(() => window.__wake), 0, 'frei');
  await p.c.close();
});
for (const scheme of ['light', 'dark']) {
  await check('Lesbarkeit ' + (scheme === 'light' ? 'hell' : 'dunkel') + ': jede Schrift Kontrast ≥ 4,5, nichts durchsichtig (alle Bildschirme)', async () => {
    const p = await fresh({ scheme });
    const probe = () => {
      const rgb = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > .5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
      const bad = [];
      document.querySelectorAll('#app *').forEach(el => {
        const ph = el.tagName === 'INPUT' && el.placeholder && !el.value;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || ph; if (!own) return;
        const cs = getComputedStyle(el, ph ? '::placeholder' : null); let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        const fg = rgb(cs.color), bg = bgOf(el), a = lum(fg), b = lum(bg), k = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (k < 4.5 || op < 1 || fg.a < 1) bad.push((el.textContent.trim() || el.placeholder).slice(0, 24) + ' ' + k.toFixed(2));
      });
      return bad;
    };
    let bad = await p.evaluate(probe);
    await p.click('[data-mode=rounds]'); await p.click('[data-topic=Uni]'); bad = bad.concat(await p.evaluate(probe));
    await btn(p, 'Start'); bad = bad.concat(await p.evaluate(probe));
    await btn(p, 'Gedankenparkplatz'); await p.fill('[data-parkin]', 'x'); await btn(p, 'Merken'); bad = bad.concat(await p.evaluate(probe)); await btn(p, 'Zurück zur Uhr');
    await p.clock.runFor(26 * MIN); bad = bad.concat(await p.evaluate(probe));     // Nachspielzeit
    await btn(p, 'Pause'); bad = bad.concat(await p.evaluate(probe));               // Pause
    await endNow(p); await p.click('[data-rev=done][data-val=ja]'); bad = bad.concat(await p.evaluate(probe));
    await btn(p, 'Fertig'); await p.click('[data-go=week]'); bad = bad.concat(await p.evaluate(probe));
    await p.click('[data-go=start]'); await p.click('[data-go=settings]'); bad = bad.concat(await p.evaluate(probe));
    ok(!bad.length, 'zu schwach: ' + [...new Set(bad)].join(' | '));
    await p.c.close();
  });
}
await check('Kleines Handy (320 px) und Mac-Fenster: nichts ragt heraus, Knöpfe ≥ 44 px, Eingabefelder 16 px', async () => {
  for (const [w, h] of [[320, 568], [1280, 800]]) {
    const p = await fresh({ w, h });
    const m = () => ({ wide: document.documentElement.scrollWidth, small: [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).map(b => b.textContent.trim()), fonts: [...document.querySelectorAll('input:not([type=checkbox]):not([type=range])')].map(i => getComputedStyle(i).fontSize).filter(f => f !== '16px') });
    const all = [];
    all.push(await p.evaluate(m)); await p.click('[data-mode=rounds]'); all.push(await p.evaluate(m));
    await btn(p, 'Start'); all.push(await p.evaluate(m)); await btn(p, 'Gedankenparkplatz'); all.push(await p.evaluate(m)); await btn(p, 'Zurück zur Uhr');
    await endNow(p); all.push(await p.evaluate(m)); await btn(p, 'Fertig');
    await p.click('[data-go=settings]'); all.push(await p.evaluate(m)); await p.click('[data-go=start]'); await p.click('[data-go=week]'); all.push(await p.evaluate(m));
    all.forEach((x, i) => { ok(x.wide <= w, w + ' px, Bildschirm ' + i + ': zu breit (' + x.wide + ')'); ok(!x.small.length, w + ' px, Bildschirm ' + i + ': zu kleine Knöpfe ' + x.small.join(', ')); ok(!x.fonts.length, 'Eingabefelder nicht 16 px: ' + x.fonts); });
    await p.c.close();
  }
});
await check('Home-Bildschirm: Name „Fokus“, eigenes Symbol, eigener Bereich fokus/, startet ohne Netz', async () => {
  const p = await fresh({ sw: true, realClock: true });
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.webmanifest'), 'utf8'));
  eq([man.name, man.scope, man.start_url, man.display], ['Fokus', './', './', 'standalone'], 'Manifest');
  for (const ic of man.icons.concat([{ src: 'icons/icon-180.png', sizes: '180x180' }])) eq(fs.readFileSync(path.join(DIR, ic.src)).readUInt32BE(16), Number(ic.sizes.split('x')[0]), 'Symbolgröße ' + ic.src);
  eq(await p.locator('meta[name=apple-mobile-web-app-title]').getAttribute('content'), 'Fokus', 'Name auf dem iPhone');
  const scope = await p.evaluate(async () => (await navigator.serviceWorker.ready).scope); ok(scope.endsWith('/jarvis-app/fokus/'), 'Helfer nur für fokus/: ' + scope);
  await p.evaluate(() => new Promise(r => setTimeout(r, 800)));
  await p.c.setOffline(true); await p.reload(); eq(await T(p, '[data-act=start]'), 'Start', 'startet ohne Netz');
  await p.c.close();
});
await check('Keine KI, keine fremden Adressen außer Schrift und Google-Anmeldung', () => {
  const src = ['index.html', 'app.js', 'engine.js', 'sound.js', 'sync.js', 'sw.js', 'fokus.css'].map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  for (const bad of ['anthropic', 'openai', 'claude.ai', 'api.claude', 'XMLHttpRequest', 'sendBeacon']) ok(!src.toLowerCase().includes(bad), 'gefunden: ' + bad);
  const ext = [...src.matchAll(/https?:\/\/[^"'\s)`]+/g)].map(m => m[0]).filter(u => !/^https:\/\/(fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com\/firebasejs\/)/.test(u));
  ok(!ext.length, 'fremde Adressen: ' + ext.join(', '));
});

await browser.close(); server.close();
console.log('\n' + passed + ' ok, ' + fails + ' Fehler');
process.exit(fails ? 1 : 0);
