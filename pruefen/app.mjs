/* Prüfung der Jarvis-App (schlanke Fassung seit 11.11.2026).
   Startet die App in einem echten Browser (Chromium über Playwright), ohne Internet, mit festen Beispieldaten
   und einer festen Uhrzeit (Mittwoch, 11.11.2026, 09:00 Uhr in Berlin). Prüft, was Phil sieht und antippt:
   Menü, Heute, Losfahr-Zeilen, Woche, Notizen, Schnell notieren, Einstellungen, ausgeblendete Bereiche,
   Lesbarkeit (Kontrast) und dass nichts über den Rand ragt. Endet mit Code 1, sobald etwas nicht stimmt.
   Aufruf: node pruefen/app.mjs   (braucht das npm-Paket „playwright“ und Chromium) */
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(process.env.PW_PFAD || 'playwright'); }
const { chromium } = pw;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JETZT = '2026-11-11T09:00:00+01:00';   // Mittwoch
const HEUTE = '2026-11-11', MORGEN = '2026-11-12';

/* ---------- kleiner Server für den App-Ordner ---------- */
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((q, s) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
  if (f.endsWith(path.sep) || f.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': (TYP[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' }); s.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = 'http://127.0.0.1:' + server.address().port + '/';

/* ---------- Ergebnisse sammeln ---------- */
const fehler = [];
let anzahl = 0;
function pruefe(ok, was, extra) { anzahl++; if (!ok) { fehler.push(was + (extra !== undefined ? ' → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); console.log('  ✗ ' + was + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const gleich = (ist, soll, was) => pruefe(JSON.stringify(ist) === JSON.stringify(soll), was, { ist, soll });
const abschnitt = t => console.log('• ' + t);

/* ---------- Beispieldaten: so sieht ein Mittwoch von Phil aus ---------- */
function beispiel() {
  const iso = new Date().toISOString();
  S.items = [
    // in Jarvis angelegt
    { id: 'e-sem', type: 'event', title: 'Seminar Deutsch', date: '2026-11-11', start: '10:15', end: '11:45', place: 'S 2.04', area: 'uni', createdAt: iso },
    { id: 'w-do', type: 'work', title: 'Arbeit', date: '2026-11-12', start: '09:00', end: '13:00', place: 'Büro', createdAt: iso },
    { id: 'b-mama', type: 'birthday', title: 'Mama', md: '11-11', createdAt: iso },
    // Notizen: Eingangskorb und Idee
    { id: 'n-1', type: 'note', title: 'Trikots waschen', createdAt: '2026-11-10T18:00:00.000Z' },
    { id: 'i-1', type: 'idea', title: 'Neue Übung mit Hütchen', createdAt: '2026-11-11T07:00:00.000Z' },
    // Bereiche, die ausgeblendet sind: die Daten müssen bleiben, dürfen aber nirgends auftauchen
    { id: 't-1', type: 'task', title: 'GEHEIM-AUFGABE Hausarbeit', date: '2026-11-11', done: false, createdAt: iso },
    { id: 's-1', type: 'shopping', title: 'GEHEIM-EINKAUF Milch', done: false, createdAt: iso },
    { id: 'h-1', type: 'habit', title: 'GEHEIM-GEWOHNHEIT Laufen', kind: 'check', freq: 'daily', days: [1, 2, 3, 4, 5, 6, 7], log: {}, createdAt: iso },
    { id: 'k-1', type: 'contract', title: 'GEHEIM-VERTRAG Handy', cost: 20, per: 'monat', createdAt: iso },
    { id: 'x-1', type: 'expense', title: 'GEHEIM-AUSGABE Döner', amount: 7, date: '2026-11-10', createdAt: iso }
  ];
  // aus Google und dem Trainer-Cockpit
  const G = (gid, title, date, start, end, o) => Object.assign({ gid, title, date, start, end, area: null, place: null, calName: null }, o || {});
  S.gcal = [
    G('g-zug', 'Zug nach Essen', '2026-11-11', '12:30', '13:45', { area: 'uni' }),
    G('g-vl', 'Vorlesung Stochastik', '2026-11-11', '14:00', '15:45', { area: 'uni', place: 'Hörsaal 1' }),
    G('g-spiel', 'Spiel U13 gegen Dorsten', '2026-11-11', '17:30', '19:00', { area: 'team', calName: 'U13 Trainer-Cockpit', cockpit: true, abf: '16:45', abfMin: 45 }),
    G('g-zahn', 'Zahnarzt', '2026-11-13', '09:00', '09:30')
  ];
  S.gcalState = 'ok';
  S.weather = { daily: [{ date: '2026-11-11', hi: 12, lo: 5, phrase: 'bewölkt', rain: 60 }, { date: '2026-11-12', hi: 10, lo: 3, phrase: 'sonnig', rain: 0 }] };
  S.settings = { ...S.settings, name: 'Phil', onboarded: true, workHours: 20, plan: { from: '09:30', travel: [{ name: 'Uni', words: 'uni, seminar, vorlesung', min: 90 }] } };
  S.onb = null; S.focus = null;
  // wie echte gespeicherte Daten ablegen (ohne Firebase speichert die App auf dem Gerät)
  const o = local.read(); o.items = Object.fromEntries(S.items.map(i => [i.id, i])); o.settings = S.settings; local.write(o);
  render();
}

async function oeffne(browser, { breite = 390, hoehe = 844, dunkel = false, handy = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, colorScheme: dark(dunkel), isMobile: handy, hasTouch: handy, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  await ctx.route(u => !String(u).startsWith(URL0), r => r.abort());   // kein Internet: Firebase, Google, Wetter, Schriften bleiben draußen
  const p = await ctx.newPage(); p.fehler = [];
  p.on('pageerror', e => p.fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load|ERR_/.test(m.text())) p.fehler.push(m.text()); });
  await p.clock.setFixedTime(new Date(JETZT));
  await p.goto(URL0 + '#heute');
  await p.waitForFunction(() => typeof S !== 'undefined' && S.loaded, null, { timeout: 15000 });
  await p.evaluate(() => { window.showToastEcht = showToast; });
  await p.evaluate(beispiel);
  await p.evaluate(() => { S.toast = null; render(); });
  return p;
}
const dark = d => d ? 'dark' : 'light';
const zu = async (p, r) => { await p.evaluate(x => go(x), r); await p.waitForTimeout(80); };
const text = (p, sel = '#main') => p.$eval(sel, el => el.innerText.replace(/\s+/g, ' '));
const gibt = (p, sel) => p.$$eval(sel, xs => xs.filter(x => x.getClientRects().length).length);

const browser = await chromium.launch();
try {
  /* ===== 1. Menü und ausgeblendete Bereiche ===== */
  abschnitt('Menü: nur Heute, Woche, Notizen');
  let p = await oeffne(browser);
  gleich(await p.$$eval('.bottomnav a', xs => xs.map(x => x.querySelector('span:last-child').textContent.trim())), ['Heute', 'Woche', 'Notizen'], 'Menü unten am Handy');
  gleich(await p.$$eval('header .nav a', xs => xs.map(x => x.firstChild.textContent.trim())), ['Heute', 'Woche', 'Notizen'], 'Menü oben (PC)');
  pruefe(await p.$eval('.bottomnav a[data-go="eingang"]', a => /\b2\b/.test(a.innerText)), 'Zahl am Menüpunkt Notizen = 2 (Notiz + Idee)');
  pruefe(!(await gibt(p, '[data-go="mehr"],[data-go="mail"],[data-go="suche"],[data-go="zeiten"],[data-go="aufgaben"],[data-go="einkauf"]')), 'Keine Wege mehr zu Mehr, Mails, Suche, Zeiten, Aufgaben, Einkauf');
  for (const alt of ['mail', 'aufgaben', 'zeiten', 'uni', 'arbeit', 'einkauf', 'essen', 'haushalt', 'ausgaben', 'vertraege', 'gewohnheiten', 'rueckblick', 'gedaechtnis', 'protokoll', 'hinweise', 'suche', 'mehr', 'ideen', 'fokus', 'quatsch']) {
    await p.evaluate(h => { location.hash = '#' + h; }, alt); await p.waitForTimeout(60);
    gleich(await p.evaluate(() => S.route), 'heute', 'Alte Adresse #' + alt + ' landet auf Heute');
  }
  for (const r of ['woche', 'eingang', 'einstellungen', 'berichte', 'papierkorb']) { await zu(p, r); gleich(await p.evaluate(() => S.route), r, 'Seite ' + r + ' geht auf'); }

  /* ===== 2. Heute ===== */
  abschnitt('Heute: nächster Termin, Losfahren, Tagesplan, Notizen, nichts zum Abhaken');
  await zu(p, 'heute');
  let t = await text(p);
  pruefe((await p.$eval('.jhead .greet', e => e.textContent)).includes('Guten Morgen, Phil.'), 'Begrüßung mit Namen (bei Smaragd und Nur das Jetzt zu sehen)');
  gleich(await p.evaluate(() => [...document.querySelectorAll('.pclock,.ptop span,.jhead .greet')].map(e => [e.textContent, !!e.getClientRects().length])), [['MI 11.11.', true], ['KW 46', true], ['09:00', true], ['Guten Morgen, Phil.', false]], 'Plakat: Datum kurz, KW 46, Uhrzeit riesig, keine Begrüßung (wie im Entwurf)');
  gleich(await p.$eval('.pclock', e => parseFloat(getComputedStyle(e).fontSize) >= 100), true, 'Plakat: Uhrzeit mindestens 100 px groß');
  pruefe(t.includes('Wetter: 12° / 5°, bewölkt, Regen 60 %'), 'Eine Zeile Wetter mit Regen');
  pruefe(t.includes('Geburtstag: Mama'), 'Geburtstag als Zeile');
  const nx = await text(p, '.jnext-ph');
  pruefe(nx.includes('Seminar Deutsch') && nx.includes('10:15–11:45') && nx.includes('S 2.04'), 'Als Nächstes: Seminar Deutsch 10:15–11:45 in S 2.04', nx);
  pruefe(nx.includes('in 1 Std 15 Min'), 'Countdown stimmt (09:00 → 10:15)', nx);
  pruefe(nx.includes('Spätestens 08:35 Uhr losfahren'), 'Losfahren: 90 Min. Fahrt + 10 Min. Reserve vor 10:15 = 08:35', nx);
  for (const weg of ['Was machst du gerade', 'Tagesabschluss', 'Mails', 'Gespräch', 'Fokus', 'Stoppuhr', 'Gewohnheiten', 'Top 3', 'GEHEIM']) pruefe(!t.includes(weg), 'Heute zeigt nichts von „' + weg + '“');
  gleich(await gibt(p, '#main input[type=checkbox]'), 0, 'Heute: keine Haken zum Abhaken');
  gleich(await gibt(p, '#main [data-now],#main [data-act="mail"],#main .nums,#main [data-dpgap],#main [data-jt],#main [data-top],#main [data-hint]'), 0, 'Heute: keine Stoppuhr, Mails, Zahlenleiste, Lücken-Füllen, Planen-Knöpfe, Hinweise');
  const plan = await text(p, '.jplan');
  for (const x of ['Seminar Deutsch', 'Zug nach Essen', 'Vorlesung Stochastik', 'Spiel U13 gegen Dorsten']) pruefe(plan.includes(x), 'Tagesplan enthält ' + x);
  pruefe(await p.$eval('.tli.trip', el => el.innerText.includes('Zug nach Essen')), 'Fahrt ist als Fahrt (blass) markiert');
  pruefe((await p.$eval('#h-nv', x => x.textContent)).includes('Nicht vergessen'), 'Karte „Nicht vergessen“ da');
  gleich(await p.$$eval('.jtoday .slimnote .lt', xs => xs.map(x => x.firstChild.textContent)), ['Neue Übung mit Hütchen', 'Trikots waschen'], 'Notizen auf Heute, neueste zuerst (Idee und Notiz zusammen)');
  const hoehe = await p.evaluate(() => document.documentElement.scrollHeight);
  pruefe(hoehe < 2300, 'Heute am Handy deutlich kürzer als früher (vorher ~4.450 px)', hoehe);

  abschnitt('Heute: Losfahren nach dem Zug und beim Cockpit');
  await p.clock.setFixedTime(new Date('2026-11-11T12:00:00+01:00')); await p.evaluate(() => render());
  let nx2 = await text(p, '.jnext-ph');
  pruefe(nx2.includes('Vorlesung Stochastik'), 'Um 12 Uhr ist die Vorlesung dran, nicht der Zug', nx2);
  pruefe(nx2.includes('Davor: Zug nach Essen um 12:30 Uhr'), 'Bei Zug direkt davor: Hinweis auf den Zug statt Losfahr-Zeit', nx2);
  await p.clock.setFixedTime(new Date('2026-11-11T16:00:00+01:00')); await p.evaluate(() => render());
  nx2 = await text(p, '.jnext-ph');
  pruefe(nx2.includes('Spiel U13 gegen Dorsten') && nx2.includes('Spätestens 16:45 Uhr losfahren'), 'Cockpit: Losfahren genau aus der Zeile „Abfahrt:“ (16:45)', nx2);
  await p.clock.setFixedTime(new Date('2026-11-11T20:00:00+01:00')); await p.evaluate(() => render());
  nx2 = await text(p, '.jnext-ph');
  pruefe(nx2.includes('Arbeit · Büro') && nx2.includes('morgen'), 'Abends zeigt „Als Nächstes“ den ersten Termin von morgen', nx2);
  await p.clock.setFixedTime(new Date(JETZT)); await p.evaluate(() => render());

  abschnitt('Heute: Morgen ansehen');
  await p.click('[data-dayview="morgen"]'); await p.waitForTimeout(60);
  const pm = await text(p, '.jplan');
  pruefe(/dein tag morgen/i.test(pm) && pm.includes('Arbeit · Büro') && !pm.includes('Seminar Deutsch'), 'Umschalter zeigt den Tag morgen', pm.slice(0, 160));
  pruefe(pm.includes('Frei bis 22:00'), 'Freie Zeit nach der Arbeit wird gezeigt', pm);
  gleich(await p.$$eval('.jplan .free', xs => xs.filter(x => x.getClientRects().length).map(x => x.tagName)), ['DIV'], 'Freie Zeit ist nur zum Ansehen (kein Knopf zum Füllen)');
  await p.click('[data-dayview="heute"]');

  /* ===== 2b. Neu im Plan und „In Claude umplanen“ ===== */
  abschnitt('Neu im Plan: neue, verschobene, weggefallene Google-Termine seit dem letzten Blick');
  {
    const q = await oeffne(browser);
    await q.waitForTimeout(150);
    const blick = () => q.evaluate(() => S.planseen && { from: S.planseen.from, to: S.planseen.to, keys: Object.keys(S.planseen.ev).sort(), zahn: S.planseen.ev['g-zahn'] });
    gleich(await blick(), { from: HEUTE, to: '2026-11-24', keys: ['g-spiel', 'g-vl', 'g-zahn'], zahn: ['2026-11-13', '09:00', '09:30', 'Zahnarzt'] }, 'Erster Blick wird still gemerkt (14 Tage, ohne Fahrten)');
    gleich(await q.evaluate(() => Object.keys(local.read().planseen.ev).sort()), ['g-spiel', 'g-vl', 'g-zahn'], 'Der Blick ist wirklich gespeichert');
    gleich(await gibt(q, '.slimneu'), 0, 'Ohne Änderung keine Karte „Neu im Plan“');
    // So sieht es aus, wenn Claude im Planungs-Projekt umgeplant hat
    const G = (gid, title, date, start, end) => ({ gid, title, date, start, end, area: null, place: null, calName: null });
    await q.evaluate(([a, b, c, d]) => {
      S.gcal = S.gcal.filter(g => g.gid !== 'g-vl').map(g => g.gid === 'g-zahn' ? { ...g, date: '2026-11-16', start: '10:00', end: '10:30' } : g).concat([a, b, c, d]); render();
    }, [G('g-neu', 'Training Torwart', '2026-11-12', '18:00', '19:30'), G('g-bus', 'Bus nach Hause', '2026-11-12', '19:40', '20:10'), G('g-weit', 'Weihnachtsfeier', '2026-11-30', '19:00', '23:00'), G('g-ganz', 'Turnier', '2026-11-14', null, null)]);
    await q.waitForTimeout(150);   // die Karte muss stehen bleiben, bis Phil „Gesehen“ tippt
    gleich(await q.$$eval('.slimneu .slimchg', xs => xs.map(x => x.textContent.trim())), [
      'Fällt weg: Vorlesung Stochastik · Mi, 11. Nov, 14:00–15:45',
      'Neu: Training Torwart · Do, 12. Nov, 18:00–19:30',
      'Neu: Turnier · Sa, 14. Nov, ganztägig',
      'Verschoben: Zahnarzt · Fr, 13. Nov, 09:00–09:30 → Mo, 16. Nov, 10:00–10:30'
    ], 'Karte zeigt genau: weggefallen, neu (auch ganztägig), verschoben; keine Fahrt, nichts nach den 14 Tagen');
    pruefe(await q.$eval('.slimneu', el => el.compareDocumentPosition(document.querySelector('.jplan')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Karte steht über dem Tagesplan');
    gleich(await q.$eval('.slimneu a.umplanen', a => [a.getAttribute('href'), a.target, a.textContent]), ['https://claude.ai/projects', '_blank', 'In Claude umplanen'], 'Ohne eigenen Link öffnet „In Claude umplanen“ die Projekt-Übersicht');
    // Kalender nicht vollständig geladen: keine falschen „Fällt weg“, und der gemerkte Blick bleibt
    for (const [was, set] of [['Kalender-Fehler', 'S.gcalState = "error"'], ['ein Kalender fehlt', 'S.gcalPartial = "U13 Trainer-Cockpit"'], ['Blick noch nicht geladen', 'S.planseenLoaded = false']]) {
      await q.evaluate(c => { const old = { st: S.gcalState, pa: S.gcalPartial, ld: S.planseenLoaded }; new Function(c)(); render(); window.__alt = old; }, set);
      await q.waitForTimeout(60);
      gleich(await gibt(q, '.slimneu'), 0, 'Bei „' + was + '“ keine Karte');
      gleich((await blick()).keys, ['g-spiel', 'g-vl', 'g-zahn'], 'Bei „' + was + '“ bleibt der gemerkte Blick unverändert');
      await q.evaluate(() => { S.gcalState = window.__alt.st; S.gcalPartial = window.__alt.pa; S.planseenLoaded = window.__alt.ld; render(); });
    }
    // Phil schaut erst am nächsten Tag: die Änderungen dürfen nicht still verschwinden
    await q.clock.setFixedTime(new Date('2026-11-12T08:00:00+01:00'));
    for (let i = 0; i < 3; i++) { await q.evaluate(() => render()); await q.waitForTimeout(60); }
    pruefe((await q.evaluate(() => document.querySelector('.slimneu')?.innerText || '')).includes('Neu: Training Torwart'), 'Am nächsten Tag steht die Änderung noch da, bis „Gesehen“ getippt wird');
    gleich((await blick()).keys, ['g-spiel', 'g-vl', 'g-zahn'], 'Ohne „Gesehen“ wird nichts still überschrieben');
    await q.clock.setFixedTime(new Date(JETZT)); await q.evaluate(() => render());
    if (await gibt(q, '.slimneu')) await q.click('.slimneu [data-act="planseen"]'); else await q.evaluate(() => planSeen());
    await q.waitForTimeout(150);
    gleich(await gibt(q, '.slimneu'), 0, '„Gesehen“ blendet die Karte aus');
    gleich(await q.evaluate(() => { const e = local.read().planseen.ev; return [Object.keys(e).sort(), e['g-zahn']]; }), [['g-ganz', 'g-neu', 'g-spiel', 'g-zahn'], ['2026-11-16', '10:00', '10:30', 'Zahnarzt']], '„Gesehen“ merkt den neuen Stand (gespeichert)');
    // Termin aus den 14 Tagen herausgeschoben: verschoben, nicht weggefallen
    await q.evaluate(() => { S.gcal = S.gcal.map(g => g.gid === 'g-spiel' ? { ...g, date: '2026-12-01' } : g); render(); });
    await q.waitForTimeout(150);
    gleich(await q.$$eval('.slimneu .slimchg', xs => xs.map(x => x.textContent.trim())), ['Verschoben: Spiel U13 gegen Dorsten · Mi, 11. Nov, 17:30–19:00 → Di, 1. Dez, 17:30–19:00'], 'Weit nach hinten geschoben zählt als verschoben');
    await q.click('.slimneu [data-act="planseen"]'); await q.waitForTimeout(150);
    // Nichts geändert: kein ständiges Speichern, am nächsten Tag rutschen die 14 Tage einmal mit
    await q.evaluate(() => { window.__n = 0; const o = store.setMeta.bind(store); store.setMeta = (a, b) => { if (a === 'planseen') window.__n++; return o(a, b); }; });
    for (let i = 0; i < 5; i++) { await q.evaluate(() => render()); await q.waitForTimeout(20); }
    gleich(await q.evaluate(() => window.__n), 0, 'Ohne Änderung wird nicht bei jedem Anzeigen gespeichert');
    await q.clock.setFixedTime(new Date('2026-11-12T09:00:00+01:00'));
    for (let i = 0; i < 3; i++) { await q.evaluate(() => render()); await q.waitForTimeout(60); }
    gleich([await q.evaluate(() => window.__n), (await blick()).from, (await blick()).to], [1, MORGEN, '2026-11-25'], 'Am nächsten Tag einmal still mitgezogen (12.11. bis 25.11.)');
    await q.evaluate(() => { S.gcal = S.gcal.concat([{ gid: 'g-spaet', title: 'Elterngespräch', date: '2026-11-25', start: '17:00', end: '17:30', area: null, place: null, calName: null }]); render(); });
    gleich(await q.$$eval('.slimneu .slimchg', xs => xs.map(x => x.textContent.trim())), ['Neu: Elterngespräch · Mi, 25. Nov, 17:00–17:30'], 'Neuer Termin am neuen letzten Tag wird erkannt');

    abschnitt('In Claude umplanen: Link in den Einstellungen');
    await q.clock.setFixedTime(new Date(JETZT));
    await zu(q, 'einstellungen');
    await q.fill('form[data-form="slimme"] input[name="planUrl"]', 'https://boese-seite.de/claude.ai/x');
    await q.click('form[data-form="slimme"] button[type="submit"]'); await q.waitForTimeout(150);
    gleich(await q.evaluate(() => S.settings.planUrl || ''), '', 'Fremder Link wird nicht gespeichert');
    pruefe(/claude\.ai/.test(await q.evaluate(() => (S.toast && S.toast.msg) || document.querySelector('.toast')?.textContent || '')), 'Hinweis bei fremdem Link');
    const LINK = 'https://claude.ai/project/0199abcd-plan';
    await q.fill('form[data-form="slimme"] input[name="planUrl"]', LINK);
    await q.click('form[data-form="slimme"] button[type="submit"]'); await q.waitForTimeout(150);
    gleich(await q.evaluate(() => [S.settings.planUrl, local.read().settings.planUrl, S.settings.name, S.settings.workHours]), [LINK, LINK, 'Phil', 20], 'Link gespeichert, Name und Stunden bleiben');
    await zu(q, 'heute');
    gleich(await q.$$eval('.jplan a.umplanen', xs => xs.map(a => [a.getAttribute('href'), a.target])), [[LINK, '_blank']], 'Heute: „In Claude umplanen“ im Tagesplan führt zum Planungs-Projekt');
    await zu(q, 'woche');
    gleich(await q.$$eval('#main a.umplanen', xs => xs.map(a => [a.getAttribute('href'), a.target])), [[LINK, '_blank']], 'Woche: Knopf „In Claude umplanen“ führt zum Planungs-Projekt');
    gleich(q.fehler, [], 'Keine Programmfehler bei Neu im Plan');
    await q.context().close();
  }

  /* ===== 3. Woche ===== */
  abschnitt('Woche: eine Zeile statt Kacheln, keine Aufgaben');
  await zu(p, 'woche');
  const wz = await text(p, '.pagehead');
  // zählt nur Arbeit, Uni, Ehrenamt: Seminar 1,5 + Vorlesung 1,75 + Spiel 1,5 + Arbeit 4 = 8,75 → 8,8; der Zug zählt nicht
  pruefe(wz.includes('machbar') && wz.includes('8,8 Std. verplant'), 'Ampel und verplante Stunden ohne Fahrten', wz);
  pruefe(wz.includes('Arbeit 4 von 20 Std. geplant'), 'Zeile „Arbeit 4 von 20 Std. geplant“', wz);
  // Phil 12.11.: Lernen zählt als Uni (auch ohne Bereich im Kalender), „Kennenlernen“ aber nicht
  gleich(await p.evaluate(() => [['Lernsession', '2026-11-12'], ['Lernen Praxissemester', '2026-11-12'], ['Kennenlernen Nachbarn', '2026-11-12']].map(([title, date]) => { const b = { kind: 'google', title, date, start: '14:00', end: '16:00', place: '' }; return [countsForLoad(b), (blockCat(b) || {}).cat || null]; })),
    [[true, 'uni'], [true, 'uni'], [false, null]], 'Lernsession zählt als Uni und zur Woche, Kennenlernen nicht');
  gleich(await gibt(p, '.wcats,.stat,[data-act="plan"],[data-jt="pplan"]'), 0, 'Woche: keine Zahlen-Kacheln, kein „Woche planen“, kein „Zeit einplanen“');
  t = await text(p);
  pruefe(!t.includes('GEHEIM') && !t.includes('☐'), 'Woche zeigt keine Aufgaben');
  pruefe(t.includes('Zahnarzt') && t.includes('Mama'), 'Woche zeigt Google-Termin und Geburtstag');
  await p.click('[data-jt="calview"][data-v="monat"]'); await p.waitForTimeout(60);
  t = await text(p);
  pruefe(t.includes('November 2026') && !t.includes('☐') && !(await gibt(p, '[data-jt="pplan"]')), 'Monat geht auf, ohne Aufgaben und ohne „Zeit einplanen“');
  await p.click('[data-jt="calview"][data-v="woche"]');

  /* ===== 4. Schnell notieren ===== */
  abschnitt('Schnell notieren: Termin oder Notiz');
  await zu(p, 'eingang');
  // am Handy gibt es auf Notizen nur noch das Feld unten (kein zweites in der Karte)
  gleich([await gibt(p, '#ask-i'), await gibt(p, '#ask-p')], [0, 1], 'Notizen am Handy: genau ein Feld „Schnell notieren“ (unten)');
  const notiere = async v => { await p.fill('#ask-p', v); await p.click('.phonecomposer form[data-form="ask"] button.send'); await p.waitForTimeout(150); };
  await notiere('Fr 10 Uhr Zahnreinigung');
  pruefe(await gibt(p, '.sheet [data-act="confirm"]') === 1, 'Termin-Satz öffnet das Bestätigen-Fenster');
  gleich(await p.$$eval('.sheet [data-f="type"] option', xs => xs.map(x => x.value)), ['event'], 'Im Fenster gibt es nur noch „Termin“ als Art');
  gleich(await p.$eval('.sheet [data-f="date"]', x => x.value), '2026-11-13', 'Datum: der kommende Freitag');
  gleich(await p.$eval('.sheet [data-f="start"]', x => x.value), '10:00', 'Uhrzeit 10:00');
  await p.click('.sheet [data-act="confirm"]'); await p.waitForTimeout(150);
  const ev1 = await p.evaluate(() => S.items.filter(i => i.type === 'event' && /Zahnreinigung/.test(i.title)).map(i => [i.date, i.start]));
  gleich(ev1, [['2026-11-13', '10:00']], 'Termin wurde gespeichert');
  await notiere('Schienbeinschoner bestellen');
  gleich(await gibt(p, '.sheet'), 0, 'Ohne Tag und Uhrzeit kommt kein Fenster');
  pruefe(await p.evaluate(() => S.items.some(i => i.type === 'note' && i.title === 'Schienbeinschoner bestellen')), 'Satz ohne Termin wird eine Notiz');
  pruefe(await p.evaluate(() => !S.items.some(i => ['task', 'shopping'].includes(i.type) && /Schienbein/.test(i.title))), 'Keine Aufgabe oder Einkauf mehr daraus');
  await notiere('Milch kaufen');
  pruefe(await p.evaluate(() => S.items.some(i => i.type === 'note' && i.title === 'Milch kaufen')), '„Milch kaufen“ wird Notiz statt Einkauf');
  await notiere('Mo 18 Uhr Elternabend\nBälle aufpumpen');
  pruefe(await gibt(p, '.sheet [data-act="confirm"]') === 1, 'Zwei Zeilen: Termin-Zeile öffnet das Fenster');
  pruefe(await p.evaluate(() => S.items.some(i => i.type === 'note' && i.title === 'Bälle aufpumpen')), 'Zwei Zeilen: die andere Zeile ist schon Notiz');
  await p.click('.sheet [data-act="confirm"]'); await p.waitForTimeout(150);
  pruefe(await p.evaluate(() => S.items.some(i => i.type === 'event' && /Elternabend/.test(i.title) && i.date === '2026-11-16' && i.start === '18:00')), 'Elternabend am Montag 16.11. um 18 Uhr gespeichert');

  /* ===== 5. Notizen ===== */
  abschnitt('Notizen: eine Liste, Erledigt mit Rückgängig, Termin daraus');
  await zu(p, 'eingang');
  t = await text(p);
  pruefe(t.includes('Neue Übung mit Hütchen') && t.includes('Trikots waschen'), 'Idee und Eingangskorb in einer Liste');
  const vorher = await p.evaluate(() => S.items.length);
  await p.click('.slimnote [data-del="n-1"]'); await p.waitForTimeout(150);
  pruefe(await p.evaluate(() => !S.items.some(i => i.id === 'n-1')), '„Erledigt“ nimmt die Notiz weg');
  pruefe(await gibt(p, '.toast [data-act="undo"]') === 1, 'Rückgängig-Knopf erscheint');
  await p.click('.toast [data-act="undo"]'); await p.waitForTimeout(200);
  pruefe(await p.evaluate(() => S.items.some(i => i.id === 'n-1' && i.title === 'Trikots waschen')), 'Rückgängig holt die Notiz zurück');
  gleich(await p.evaluate(() => S.items.length), vorher, 'Nach Rückgängig ist alles wieder da');
  await p.click('.slimnote [data-convert="i-1"]'); await p.waitForTimeout(100);
  gleich(await p.$eval('.sheet [data-f="type"]', x => x.value), 'event', '„Termin daraus“ öffnet ein Termin-Fenster');
  await p.fill('.sheet [data-f="date"]', '2026-11-14'); await p.dispatchEvent('.sheet [data-f="date"]', 'change');
  await p.fill('.sheet [data-f="start"]', '11:00'); await p.dispatchEvent('.sheet [data-f="start"]', 'change');
  await p.click('.sheet [data-act="confirm"]'); await p.waitForTimeout(150);
  pruefe(await p.evaluate(() => !S.items.some(i => i.id === 'i-1') && S.items.some(i => i.type === 'event' && i.title === 'Neue Übung mit Hütchen' && i.date === '2026-11-14' && i.start === '11:00')), 'Aus der Idee wurde ein Termin, die Idee ist weg');

  /* ===== 6. Einstellungen ===== */
  abschnitt('Einstellungen: kurz, und Speichern ändert nur das Richtige');
  await zu(p, 'einstellungen');
  gleich(await p.$$eval('#main h2.label', xs => xs.map(x => x.innerText.trim().toUpperCase())), ['DESIGN', 'HELL / DUNKEL', 'ÜBER DICH', 'GOOGLE KALENDER', 'KALENDER', 'FAHRZEITEN', 'WETTER', 'MELDUNGEN', 'SICHERUNG'], 'Nur noch diese Abschnitte');
  gleich(await p.$$eval('.gtabs button', xs => xs.map(x => x.innerText.trim())), ['Einstellungen', 'Meldungen', 'Papierkorb'], 'Reiter oben: Einstellungen, Meldungen, Papierkorb');
  await p.fill('form[data-form="jtravel"] input[name="tm0"]', '60');
  await p.click('form[data-form="jtravel"] button[type="submit"]'); await p.waitForTimeout(150);
  const plan2 = await p.evaluate(() => S.settings.plan);
  gleich(plan2.travel, [{ name: 'Uni', words: 'uni, seminar, vorlesung', min: 60 }], 'Fahrzeit gespeichert');
  gleich(plan2.from, '09:30', 'Andere Planungs-Werte bleiben unverändert');
  await p.fill('form[data-form="slimme"] input[name="workHours"]', '15');
  await p.fill('form[data-form="slimme"] input[name="name"]', 'Philipp');
  await p.click('form[data-form="slimme"] button[type="submit"]'); await p.waitForTimeout(150);
  gleich(await p.evaluate(() => [S.settings.name, S.settings.workHours]), ['Philipp', 15], 'Name und Wochenstunden gespeichert');
  await zu(p, 'heute');
  nx2 = await text(p, '.jnext-ph');
  pruefe(nx2.includes('Spätestens 09:05 Uhr losfahren'), 'Neue Fahrzeit wirkt sofort (10:15 − 60 − 10 = 09:05)', nx2);
  pruefe((await p.$eval('.jhead .greet', e => e.textContent)).includes('Guten Morgen, Philipp.'), 'Neuer Name in der Begrüßung');
  await zu(p, 'woche');
  pruefe((await text(p, '.pagehead')).includes('Arbeit 4 von 15 Std. geplant'), 'Woche rechnet mit den neuen 15 Std.');

  /* ===== 7. Daten der ausgeblendeten Bereiche ===== */
  abschnitt('Ausgeblendet heißt nicht gelöscht');
  gleich(await p.evaluate(() => ['t-1', 's-1', 'h-1', 'k-1', 'x-1'].filter(id => S.items.some(i => i.id === id))), ['t-1', 's-1', 'h-1', 'k-1', 'x-1'], 'Aufgaben, Einkauf, Gewohnheiten, Verträge, Ausgaben sind noch gespeichert');
  for (const r of ['heute', 'woche', 'eingang', 'einstellungen']) { await zu(p, r); pruefe(!(await text(p, 'body')).includes('GEHEIM'), 'Seite ' + r + ' zeigt nichts aus ausgeblendeten Bereichen'); }
  gleich(p.fehler, [], 'Keine Programmfehler im Ablauf');
  await p.context().close();

  /* ===== 7b. Design und Hell/Dunkel (12.11.2026) ===== */
  abschnitt('Design: Plakat ist Standard, Glas/Polar weg, Hell/Dunkel gilt nur für dieses Gerät');
  p = await oeffne(browser);
  const blick = () => p.evaluate(() => [document.documentElement.dataset.skin, document.documentElement.dataset.mode, getComputedStyle(document.body).backgroundColor]);
  gleich(await blick(), ['plakat', 'light', 'rgb(255, 255, 255)'], 'Neu eingerichtet: Plakat, hell, weißer Hintergrund');
  await zu(p, 'einstellungen');
  gleich(await p.$$eval('button[data-skin]', xs => xs.map(x => x.innerText.split('\n')[0].replace(/\s+/g, ' ').trim())), ['Plakat Riesige Schrift, Schwarz, Weiß und Rot', 'Smaragd Ruhig Weich und rund, viel Luft', 'Nur das Jetzt Ruhig, Sand und Smaragd, große runde Karten'], 'Einstellungen › Design: genau Plakat, Smaragd Ruhig, Nur das Jetzt');
  pruefe((await text(p)).includes('Gilt nur für dieses Gerät'), 'Hell/Dunkel sagt, dass es nur für dieses Gerät gilt');
  await p.click('button[data-mode="dark"]');
  gleich(await blick(), ['plakat', 'dark', 'rgb(0, 0, 0)'], 'Dunkel gewählt: Plakat dunkel (schwarz, wie in Phils Style-Guide)');
  gleich(await p.evaluate(() => localStorage.getItem('jarvis.mode')), 'dark', 'Dunkel steht auf dem Gerät');
  await p.click('button[data-skin="ruhe"]');
  gleich(await blick(), ['ruhe', 'dark', 'rgb(27, 25, 24)'], 'Nur das Jetzt dunkel');
  // Konto (Firebase) nachgestellt: Hell/Dunkel darf nie ins Konto, das Design schon
  const insKonto = await p.evaluate(async () => {
    const calls = []; const alt = db;
    db = { doc: (pfad) => ({ set: async (o, opt) => { calls.push([pfad, JSON.parse(JSON.stringify(o)), !!(opt && opt.merge)]); } }) };
    S.cloudLook = { skin: 'ruhe' };
    try { await store.setSettings({ ...S.settings, mode: 'light' }, 'mode'); await store.setSettings({ ...S.settings, skin: 'smaragd' }, 'skin'); await store.setSettings({ ...S.settings, mode: 'dark', name: 'Phil' }); } finally { db = alt; }
    return calls.map(([pfad, o, m]) => [pfad, Object.keys(o).includes('mode'), o.skin, m]);
  });
  gleich(insKonto, [['meta/settings', false, 'smaragd', true], ['meta/settings', false, 'smaragd', false]], 'Ins Konto: nur Design (smaragd), nie Hell/Dunkel; Knopf Hell schreibt gar nichts ins Konto');
  gleich(await p.evaluate(() => localStorage.getItem('jarvis.mode')), 'light', 'Hell nur auf dem Gerät gemerkt');
  // Neustart: altes Glas wird einmalig Plakat; Hell/Dunkel kommt vom Gerät, nicht aus gespeicherten Einstellungen
  await p.evaluate(() => { const o = local.read(); o.settings = { ...o.settings, skin: 'glas', mode: 'dark' }; delete o.settings.lookV; local.write(o); localStorage.setItem('jarvis.mode', 'light'); });
  await p.reload(); await p.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  gleich(await blick(), ['plakat', 'light', 'rgb(255, 255, 255)'], 'Nach Neustart: Glas → Plakat, Hell vom Gerät');
  gleich(await p.evaluate(() => [local.read().settings.skin, local.read().settings.lookV]), ['plakat', 2], 'Umstellung auf Plakat ist gespeichert (nur einmal)');
  await p.evaluate(() => { const o = local.read(); o.settings = { ...o.settings, skin: 'smaragd', lookV: 2 }; local.write(o); });
  await p.reload(); await p.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  gleich(await blick(), ['smaragd', 'light', 'rgb(243, 242, 236)'], 'Wer danach Smaragd wählt, behält Smaragd');
  gleich(p.fehler, [], 'Keine Programmfehler beim Design-Wechsel');
  await p.context().close();

  /* ===== 7c. App-Symbol G (12.11.2026): weiß, schwarzer offener Ring, schwarzes J ===== */
  abschnitt('App-Symbol: G – weiß mit schwarzem Ring und J, in allen Größen');
  p = await oeffne(browser);
  const sym = await p.evaluate(async () => {
    const man = await (await fetch('manifest.webmanifest')).json();
    const liste = man.icons.map(i => [i.src, Number(i.sizes.split('x')[0])]).concat([[document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'), 180]]);
    const out = {};
    for (const [src, n] of liste) {
      const img = new Image(); img.src = src + '?' + Date.now(); await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const f = (a, b) => { const d = x.getImageData(Math.round(a * n / 512), Math.round(b * n / 512), 1, 1).data; return d[0] + d[1] + d[2] < 120 ? 'schwarz' : d[0] + d[1] + d[2] > 720 ? 'weiß' : 'anders'; };
      out[src] = [img.naturalWidth, f(12, 12), f(256, 406), f(300, 200), f(256, 256), f(106, 256)];
    }
    return out;
  });
  for (const [src, v] of Object.entries(sym)) gleich(v.slice(1), ['weiß', 'schwarz', 'schwarz', 'weiß', 'schwarz'], src + ': Grund weiß, Ring unten und links schwarz, J-Strich schwarz, Mitte frei');
  for (const [src, v] of Object.entries(sym)) pruefe(v[0] === Number((src.match(/(\d+)\.png$/) || [])[1]), src + ': Bildgröße stimmt (' + v[0] + ' px)');
  await p.context().close();

  /* ===== 7d. Stunden je Woche (12.11.2026): geplant gegen gemacht, Verlauf ab 26.10. ===== */
  abschnitt('Stunden: Arbeit, Uni, Ehrenamt, Sonstiges, zwei Summen, Verlauf ab 26.10.');
  p = await oeffne(browser);
  await p.evaluate(() => {
    const G = (gid, title, date, start, end, o) => Object.assign({ gid, title, date, start, end, area: null, place: null, calName: null }, o || {});
    const C = { calName: 'U13 Trainer-Cockpit', cockpit: true, area: 'team' };
    S.gcal = S.gcal.concat([
      // Woche ab 26.10. (so wie in Phils Kalender)
      G('a1', 'Vorlesung Stochastik 2', '2026-10-26', '14:00', '16:00'),
      G('a2', 'Übung Stochastik 2', '2026-10-27', '10:00', '12:00'), G('a3', 'Forschungswerkstatt Bi-Wi I: Unterrichtsforschung', '2026-10-27', '12:00', '14:00'), G('a4', 'Einführung in die Grundschulpädagogik', '2026-10-27', '17:30', '19:30'),
      G('a5', 'Zug nach Essen', '2026-10-28', '06:00', '06:50'), G('a6', 'Arbeit', '2026-10-28', '07:00', '15:30'), G('a7', 'Trainingsplanung', '2026-10-28', '15:45', '16:15'), G('a8', 'Training U13', '2026-10-28', '17:00', '18:30', C), G('a9', 'Kochen', '2026-10-28', '19:00', '19:30'), G('a10', 'Haushalt', '2026-10-28', '19:30', '20:00'),
      G('a11', 'Arbeit · Essen', '2026-10-29', '09:05', '13:45'), G('a12', 'N2 Vorbereitung Praxissemester', '2026-10-29', '12:00', '14:00'), G('a13', 'Arbeit · Homeoffice', '2026-10-29', '15:15', '16:20'),
      G('a14', 'Arbeit', '2026-10-30', '07:00', '11:15'), G('a15', 'Classroom Management?! - oder wie wir Schule als emotional sicheren Ort gestalten', '2026-10-30', '12:00', '14:00'), G('a16', 'Trainingsplanung', '2026-10-30', '14:00', '14:30'), G('a17', 'Blocker', '2026-10-30', '19:00', '22:00'), G('a18', 'App-Design', '2026-10-30', '22:00', '23:00'),
      G('a19', 'Lernzeit', '2026-10-31', '11:00', '12:30'), G('a20', 'App-Design', '2026-10-31', '14:00', '16:30'), G('a21', 'Haushalt', '2026-10-31', '16:45', '17:45'),
      G('a22', 'Spiel U13 gegen Marl', '2026-11-01', '09:00', '10:30', C), G('a23', 'Lernzeit', '2026-11-01', '11:00', '12:30'), G('a24', 'App-Design', '2026-11-01', '14:00', '16:30'),
      // Woche ab 2.11.
      G('b1', 'Arbeit', '2026-11-02', '08:00', '12:00'), G('b2', 'Vorlesung Stochastik 2', '2026-11-02', '14:00', '16:00'), G('b3', 'Fitness', '2026-11-02', '18:00', '19:00'), G('b4', 'Rückfahrt (Auto)', '2026-11-02', '12:00', '12:40'),
      // laufende Woche ab 9.11. (heute ist Mi 11.11., 9 Uhr)
      G('c1', 'Arbeit', '2026-11-09', '07:00', '15:30'), G('c2', 'Lernsession', '2026-11-10', '16:00', '18:00'), G('c3', 'Arbeit', '2026-11-11', '07:00', '10:00')
    ]);
    // Fahrt nur in Jarvis (nie in Google), darf nirgends zählen
    S.items.push({ id: 'f-1', type: 'event', title: 'Fahrt nach Essen (Auto)', date: '2026-11-09', start: '06:15', end: '07:00', area: 'arbeit', createdAt: new Date().toISOString() });
    const o = local.read(); o.items = Object.fromEntries(S.items.map(i => [i.id, i]));
    o.wochenplan = { weeks: { '2026-11-02': { h: { arbeit: 6, uni: 2, ehrenamt: 1.5, sonst: 1, pflicht: 9.5, alles: 10.5 }, date: '2026-11-02', at: '2026-11-02T08:00:00.000Z' } } };
    local.write(o); S._wpWatch = false; stdWatch(); render();
  });
  const wochen = await p.evaluate(() => stdData().map(x => [x.mon, x.kw, x.done, x.plan, x.gemerkt]));
  const r2 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  gleich(wochen.map(w => [w[0], w[1]]), [['2026-10-26', 44], ['2026-11-02', 45], ['2026-11-09', 46]], 'Drei Wochen ab 26.10. (KW 44, 45, 46)');
  gleich(r2(wochen[0][2]), { arbeit: 18, uni: 15, ehrenamt: 4, sonst: 8, pflicht: 35.25, alles: 43.25 }, 'Woche 26.10.: Arbeit 18 (8,5 Std. am Stück − 30 Min. Pause), Uni 15 mit Lernzeit, Ehrenamt 4, Sonstiges 8; Zug und Blocker zählen nicht; Überschneidung Do zählt einmal');
  gleich(r2(wochen[0][3]), r2(wochen[0][2]), 'Woche 26.10.: ohne gemerkten Plan zeigt „geplant“ den Kalender-Stand');
  gleich(wochen[0][4], null, 'Woche 26.10.: als „nicht gemerkt“ markiert');
  gleich(r2(wochen[1][2]), { arbeit: 4, uni: 2, ehrenamt: 0, sonst: 1, pflicht: 6, alles: 7 }, 'Woche 2.11.: gemacht (Rückfahrt zählt nicht, Fitness = Sonstiges)');
  gleich(wochen[1][3], { arbeit: 6, uni: 2, ehrenamt: 1.5, sonst: 1, pflicht: 9.5, alles: 10.5 }, 'Woche 2.11.: geplant kommt aus dem gemerkten Montags-Plan');
  gleich(r2(wochen[2][2]), { arbeit: 10, uni: 2, ehrenamt: 0, sonst: 0, pflicht: 12, alles: 12 }, 'Laufende Woche: gemacht bis jetzt (Mo 8 Std. Arbeit, Di Lernsession, heute 7–9 Uhr), Jarvis-Fahrt zählt nicht');
  gleich(r2(wochen[2][3]), { arbeit: 15, uni: 5.25, ehrenamt: 1.5, sonst: 0.5, pflicht: 21.75, alles: 22.25 }, 'Laufende Woche: geplant = ganze Woche im Kalender (Zug zählt nicht)');
  // Seite
  await p.evaluate(() => { S.calView = 'stunden'; go('woche'); }); await p.waitForTimeout(100);
  gleich(await p.$$eval('.seg button', xs => xs.map(x => x.textContent + ':' + x.getAttribute('aria-pressed'))), ['Woche:false', 'Monat:false', 'Stunden:true'], 'Woche-Seite hat den Schalter „Stunden“');
  let st = await text(p);
  gleich(await p.$eval('#h-stdnow', e => e.textContent), 'Diese Woche · KW 46', 'Karte „Diese Woche“ mit Kalenderwoche');
  gleich(await p.$$eval('.stdnow .stdbig', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['Arbeit + Uni + Ehrenamt 12 von 21,8 Std. geplant', 'Alles mit Sonstigem 12 von 22,3 Std. geplant'], 'Die zwei Summen groß: gemacht von geplant');
  gleich(await p.$$eval('.stdnow .stdrow', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['Arbeit 10 / 15 Std.', 'Uni 2 / 5,3 Std.', 'Ehrenamt 0 / 1,5 Std.', 'Sonstiges 0 / 0,5 Std.'], 'Bereiche dieser Woche: gemacht / geplant');
  gleich(await p.$$eval('.stdlist .stdwh', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['KW 46 · 9. Nov – 15. Nov · läuft 12 / 12 Std.', 'KW 45 · 2. Nov – 8. Nov 6 / 7 Std.', 'KW 44 · 26. Okt – 1. Nov 35,3 / 43,3 Std.'], 'Verlauf: alle Wochen bis 26.10., neueste oben');
  const kw44 = await p.$$eval('.stdlist .stdwk', xs => xs[2].innerText.replace(/\s+/g, ' '));
  pruefe(kw44.includes('Arbeit 18 von 18 · Uni 15 von 15 · Ehrenamt 4 von 4 · Sonstiges 8 von 8') && kw44.includes('Plan von damals nicht gemerkt'), 'KW 44: jeder Bereich und ehrlicher Hinweis', kw44);
  const kw45 = await p.$$eval('.stdlist .stdwk', xs => xs[1].innerText.replace(/\s+/g, ' '));
  pruefe(kw45.includes('Arbeit 4 von 6') && kw45.includes('Ehrenamt 0 von 1,5') && kw45.includes('Arbeit + Uni + Ehrenamt 6 von 9,5 · Alles 7 von 10,5') && !kw45.includes('nicht gemerkt'), 'KW 45: geplant aus dem Montags-Plan', kw45);
  gleich(await p.$$eval('.stdvgl .stdrow', xs => xs.slice(0, 3).map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['Arbeit + Uni + Ehrenamt Vorwoche 6 Schnitt 20,6', 'Alles mit Sonstigem Vorwoche 7 Schnitt 25,1', 'Arbeit Vorwoche 4 Schnitt 11'], 'Vergleich: Vorwoche und Schnitt der fertigen Wochen');
  // Plan der Woche merken (sonst macht das die App im Hintergrund, sobald der Kalender geladen ist)
  await p.evaluate(async () => { S.stdHist = { from: STD_START, to: '2026-11-16', list: S.gcal.slice(), at: Date.now() }; S.gcalPartial = ''; await stdRemember(); });
  gleich(await p.evaluate(() => { const w = local.read().wochenplan.weeks; return [Object.keys(w).sort(), w['2026-11-09'].h.pflicht, w['2026-11-09'].date]; }), [['2026-11-02', '2026-11-09'], 21.75, '2026-11-11'], 'Plan dieser Woche ist gespeichert (21,75 Std.), Montags-Plan der Vorwoche bleibt');
  await p.evaluate(async () => { S.gcal = S.gcal.filter(g => g.gid !== 'g-spiel'); S.stdHist.list = S.gcal.slice(); await stdRemember(); render(); });
  gleich(await p.evaluate(() => [stdData()[2].plan.ehrenamt, local.read().wochenplan.weeks['2026-11-09'].h.ehrenamt, stdData()[2].kal.ehrenamt]), [1.5, 1.5, 0], 'Spiel abgesagt: geplant bleibt 1,5 Std. Ehrenamt (nach Montag wird der Plan nicht mehr überschrieben), im Kalender jetzt 0');
  st = await text(p, '.stdnow');
  pruefe(st.includes('Plan gemerkt am Mi, 11. Nov') && st.includes('jetzt im Kalender: 20,8 Std.'), 'Hinweis: wann der Plan gemerkt wurde und was jetzt im Kalender steht', st);
  // Am Montag zieht der Plan noch mit
  await p.evaluate(async () => { const w = local.read(); w.wochenplan.weeks['2026-11-09'].date = '2026-11-09'; local.write(w); S.wochenplan = w.wochenplan; });
  await p.clock.setFixedTime(new Date('2026-11-09T07:30:00+01:00'));
  gleich(await p.evaluate(async () => { await stdRemember(); return local.read().wochenplan.weeks['2026-11-09'].h.ehrenamt; }), 0, 'Am Montag selbst wird der Plan noch nachgezogen');
  await p.clock.setFixedTime(new Date(JETZT));
  // Lernzeit zählt jetzt auch auf der normalen Woche-Seite als Uni
  gleich(await p.evaluate(() => [blockCat({ kind: 'google', title: 'Lernsession', start: '10:00', end: '11:00' }).cat, countsForLoad({ kind: 'google', title: 'Lernzeit', start: '10:00', end: '11:00' })]), ['uni', true], 'Lernzeit/Lernsession = Uni, zählt auch für die Wochen-Ampel');
  gleich(p.fehler, [], 'Keine Programmfehler in der Stunden-Übersicht');
  await p.context().close();

  /* ===== 8. Aussehen: alle Looks, hell und dunkel, Handy und PC ===== */
  abschnitt('Lesbarkeit und Rand: 3 Looks (Plakat, Smaragd, Nur das Jetzt) × hell/dunkel × Handy/PC');
  for (const [breite, hoehe2, handy, name] of [[360, 760, true, 'Handy'], [390, 844, true, 'iPhone'], [1280, 900, false, 'PC']]) for (const dunkel of [false, true]) {
    const q = await oeffne(browser, { breite, hoehe: hoehe2, dunkel, handy });
    await q.evaluate(() => { window.showToast = () => {}; S.toast = null; });
    await q.waitForTimeout(100);   // erster Blick ist gemerkt; dann so tun, als wäre seitdem umgeplant worden, damit „Neu im Plan“ mitgeprüft wird
    await q.evaluate(() => { S.gcal = S.gcal.filter(g => g.gid !== 'g-zahn').concat([{ gid: 'g-neu', title: 'Training Torwart', date: '2026-11-12', start: '18:00', end: '19:30', area: null, place: null, calName: null }]); render(); });
    pruefe(await gibt(q, '.slimneu .slimchg') === 2, name + (dunkel ? ' dunkel' : ' hell') + ': Karte „Neu im Plan“ ist für die Lesbarkeits-Prüfung da');
    for (const skin of ['plakat', 'smaragd', 'ruhe']) {
      await q.evaluate(k => { S.settings = { ...S.settings, skin: k }; applyLook(); render(); }, skin);
      for (const r of ['heute', 'woche', 'stunden', 'eingang', 'einstellungen']) {
        await q.evaluate(v => { S.calView = v; }, r === 'stunden' ? 'stunden' : 'woche');
        await zu(q, r === 'stunden' ? 'woche' : r); await q.evaluate(() => window.scrollTo(0, 0));
        if (r === 'stunden') pruefe(await gibt(q, '.stdnow .stdbig') === 2 && await gibt(q, '.stdlist .stdwk') === 3, name + ' ' + (dunkel ? 'dunkel' : 'hell') + ' ' + skin + ': Stunden-Seite ist da (2 Summen, 3 Wochen)');
        const wo = name + ' ' + (dunkel ? 'dunkel' : 'hell') + ' ' + skin + ' ' + r;
        const breit = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        pruefe(breit <= 0, wo + ': nichts ragt seitlich über den Rand', breit);
        const kaesten = await q.evaluate(kaestenFunde, 'body');
        pruefe(!kaesten.length, wo + ': nichts ragt über seinen Kasten, nichts überlappt, keine Ovale', kaesten.slice(0, 3));
        const schlecht = await q.evaluate(kontrastFunde);
        pruefe(!schlecht.length, wo + ': alle Schrift gut lesbar (Kontrast ≥ 4,5)', schlecht.slice(0, 3));
        if (skin === 'plakat' && r === 'heute') {
          // wie im Entwurf (Design-Board „4b Plakat rund“ / „4 Plakat Computer“)
          const L = await q.evaluate(() => { const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } : null; };
            const nav = document.querySelector('.bottomnav'), nb = nav.getBoundingClientRect();
            return { uhr: box('.pclock'), plan: box('.jplan'), liste: box('.jplan .tl'), leiste: box('.jplan .jtrack'), next: box('.jnext-ph .next'), kleineUhr: box('.top .clock'),
              nxRot: !!document.querySelector('.jplan .tli.nx .tm') && getComputedStyle(document.querySelector('.jplan .tli.nx .tm')).color === getComputedStyle(document.documentElement).getPropertyValue('--ac').trim().replace(/^#(..)(..)(..)$/, (_, a, b, c) => 'rgb(' + [a, b, c].map(h => parseInt(h, 16)).join(', ') + ')'),
              nextRahmen: getComputedStyle(document.querySelector('.jnext-ph .next')).borderTopWidth, navAbstand: Math.round(innerHeight - nb.bottom), navSichtbar: !!nb.height }; });
          pruefe(L.uhr && L.next && L.liste && !L.leiste, wo + ': riesige Uhr, „Als Nächstes“ und Tagesliste sichtbar, keine Zeitleiste', L);
          pruefe(!L.kleineUhr, wo + ': kleine Uhr oben ausgeblendet (sie steht ja riesig da)', L.kleineUhr);
          pruefe(L.nxRot, wo + ': Uhrzeit des nächsten Termins in der Liste rot');
          gleich(L.nextRahmen, '0px', wo + ': „Als Nächstes“ ohne Kasten');
          if (name === 'PC') pruefe(!!(L.uhr && L.plan && L.next) && L.uhr.r <= L.plan.x && L.next.r <= L.plan.x && L.plan.y <= L.uhr.b, wo + ': Uhr und „Als Nächstes“ links, Tagesliste rechts daneben', L);
          else pruefe(L.navSichtbar && L.navAbstand >= 6 && L.navAbstand <= 10, wo + ': Menüleiste unten nur 8 px vom Rand', L.navAbstand);
        }
      }
    }
    // Fenster: Termin verschieben (Tag, Beginn, Ende nebeneinander), Termin bearbeiten, Arbeitsblock bearbeiten
    for (const skin of ['plakat', 'smaragd', 'ruhe']) {
      await q.evaluate(k => { S.settings = { ...S.settings, skin: k }; applyLook(); S.calView = 'woche'; render(); }, skin);
      for (const [fenster, auf] of [['Termin verschieben', () => openMove('g:g-vl')], ['Termin bearbeiten', () => document.querySelector('[data-edit="e-sem"]').click()], ['Arbeit bearbeiten', () => document.querySelector('[data-edit="w-do"]').click()]]) {
        await zu(q, fenster === 'Termin verschieben' ? 'heute' : 'woche');
        await q.evaluate(auf); await q.waitForTimeout(60);
        const wo = name + ' ' + (dunkel ? 'dunkel' : 'hell') + ' ' + skin + ' Fenster „' + fenster + '“';
        pruefe(await gibt(q, '.sheet') === 1, wo + ': geht auf');
        const kaesten = await q.evaluate(kaestenFunde, '.sheet');
        pruefe(!kaesten.length, wo + ': nichts ragt über seinen Kasten, nichts überlappt, keine Ovale', kaesten.slice(0, 3));
        const schlecht = await q.evaluate(kontrastFunde);
        pruefe(!schlecht.length, wo + ': alle Schrift gut lesbar (Kontrast ≥ 4,5)', schlecht.slice(0, 3));
        // Datum/Uhrzeit: am iPhone bekommen diese Felder sonst eine feste Mindestbreite und ragen aus der Karte (Phils Foto vom 12.11.)
        const felder = await q.evaluate(() => [...document.querySelectorAll('.sheet input[type=date],.sheet input[type=time]')].map(i => { const cs = getComputedStyle(i), f = i.closest('.field').getBoundingClientRect(), r = i.getBoundingClientRect(); return { app: cs.appearance, minW: cs.minWidth, passt: r.left >= f.left - 0.5 && r.right <= f.right + 0.5 }; }));
        pruefe(felder.length >= 2 && felder.every(x => x.app === 'none' && x.minW === '0px' && x.passt), wo + ': Datum- und Uhrzeit-Felder ohne Mindestbreite, bleiben in ihrer Spalte', felder);
        if (fenster === 'Termin verschieben') {
          const R = await q.evaluate(() => ['date', 'start', 'end'].map(f => { const b = document.querySelector('.sheet [data-f="' + f + '"]').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.top)]; }).concat([(() => { const b = document.querySelector('.sheet .mvrow').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; })()]));
          const [tag, beg, ende, karte] = R;
          pruefe(tag[1] <= karte[1] && beg[1] <= karte[1] && ende[1] <= karte[1], wo + ': Tag, Beginn und Ende enden innerhalb der Karte', R);
          pruefe(beg[2] !== ende[2] || beg[1] <= ende[0], wo + ': Beginn und Ende liegen nebeneinander, ohne sich zu überdecken', R);
        }
        await q.evaluate(() => { S.move = null; S.editing = null; render(); });
      }
      // Zahnrad oben auf der Seite Einstellungen: Zeichen muss sich vom Knopf abheben
      await zu(q, 'einstellungen');
      const zr = await q.$eval('.top .iconbtn[aria-current="page"]', b => { const cs = getComputedStyle(b); return [cs.color, cs.backgroundColor, cs.borderTopColor]; });
      pruefe(zr[0] !== zr[1] || zr[1] === 'rgba(0, 0, 0, 0)', name + ' ' + (dunkel ? 'dunkel' : 'hell') + ' ' + skin + ': Zahnrad auf der Seite Einstellungen ist zu sehen', zr);
    }
    gleich(q.fehler, [], name + ' ' + (dunkel ? 'dunkel' : 'hell') + ': keine Programmfehler');
    await q.context().close();
  }
} finally {
  await browser.close(); server.close();
}

console.log('\n' + (anzahl - fehler.length) + ' von ' + anzahl + ' Prüfungen bestanden.');
if (fehler.length) { console.log('\nNicht bestanden:\n- ' + fehler.join('\n- ')); process.exit(1); }

/* Kontrast jeder sichtbaren Schrift gegen ihren tatsächlichen Hintergrund (WCAG: 4,5, große Schrift 3) */
function kontrastFunde() {
  const P = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const mix = (top, bot) => [0, 1, 2].map(i => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
  const bgOf = el => { const st = []; let q = el; while (q) { const cs = getComputedStyle(q); if (cs.backgroundImage && /gradient|url/.test(cs.backgroundImage) && q !== document.body && q !== document.documentElement) return null; const c = P(cs.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } q = q.parentElement; } let r = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) r = mix(st[i], r); return r; };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|svg|path|OPTION)$/i.test(el.tagName)) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.value);
    if (!own) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height || rc.bottom < 0 || rc.top > innerHeight * 4) continue;
    if (el.closest('button:disabled,[disabled],[aria-disabled="true"],.offline')) continue;
    let op = 1, q = el; while (q) { op *= Number(getComputedStyle(q).opacity); q = q.parentElement; }
    const bg = bgOf(el); if (!bg) continue; const fg = P(cs.color); if (!fg) continue;
    const f = mix([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const a = L(f), z = L(bg), cr = (Math.max(a, z) + .05) / (Math.min(a, z) + .05);
    const fs = parseFloat(cs.fontSize), gross = fs >= 24 || (fs >= 18.6 && Number(cs.fontWeight) >= 600);
    if (cr < (gross ? 3 : 4.5)) out.push(cr.toFixed(2) + ' „' + (el.value || el.textContent).trim().slice(0, 30).replace(/\s+/g, ' ') + '“ (' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ')');
  }
  return [...new Set(out)];
}

/* Kästen: ragt etwas über seinen Rahmen (oder den Bildschirm), überlappt sich etwas, ist Schrift abgeschnitten, wird ein Kasten zum Oval? */
function kaestenFunde(rootSel) {
  const root = document.querySelector(rootSel) || document.body;
  const vis = el => { const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0) return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const name = el => el.tagName.toLowerCase() + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\s+/).join('.') : '') + (el.textContent? ' „'+el.textContent.trim().replace(/\s+/g,' ').slice(0,28)+'“':'');
  const isBox = el => { const cs = getComputedStyle(el); return parseFloat(cs.borderLeftWidth)>0 || parseFloat(cs.borderRightWidth)>0 || (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.overflowX!=='visible'; };
  const out = new Set();
  const all = [...root.querySelectorAll('*')].filter(el => !el.closest('.sr') && !/^(svg|path|circle|line|rect|g|polyline|polygon|SCRIPT|STYLE|OPTION|BR)$/i.test(el.tagName) && vis(el));
  for (const el of all) {
    if (getComputedStyle(el).position==='fixed') continue;
    const r = el.getBoundingClientRect();
    // nächster Kasten (Rahmen/Hintergrund) darüber
    let a = el.parentElement;
    while (a && a!==document.body && !isBox(a)) a = a.parentElement;
    if (!a || a===document.body || a===document.documentElement) { if (r.right > innerWidth+1 || r.left < -1) out.add('ÜBER BILDSCHIRMRAND: '+name(el)+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']'); continue; }
    const cs = getComputedStyle(a); if (cs.overflowX!=='visible' && el.closest('[class]')!==a && a.contains(el) && (cs.overflowX==='auto'||cs.overflowX==='scroll')) continue;
    const b = a.getBoundingClientRect();
    const bl = parseFloat(cs.borderLeftWidth)||0, br = parseFloat(cs.borderRightWidth)||0;
    const dx = Math.max(r.right - (b.right - br), (b.left + bl) - r.left);
    if (dx > 1.5 && getComputedStyle(el).position!=='absolute') out.add('RAGT ÜBER KASTEN ('+Math.round(dx)+'px): '+name(el)+' in '+name(a).slice(0,60));
  }
  // Überlappung: Geschwister, die beide sichtbar sind und sich schneiden
  for (const el of all) {
    const kids = [...el.children].filter(k => vis(k) && !['absolute','fixed','sticky'].includes(getComputedStyle(k).position) && !/^(svg|i)$/i.test(k.tagName));
    for (let i=0;i<kids.length;i++) for (let j=i+1;j<kids.length;j++) {
      let ox=0, oy=0; for (const A of kids[i].getClientRects()) for (const B of kids[j].getClientRects()) { const x = Math.min(A.right,B.right)-Math.max(A.left,B.left), y = Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top); if (x>2 && y>2) { ox=x; oy=y; } }
      if (ox>2 && oy>2) out.add('ÜBERLAPPT ('+Math.round(ox)+'×'+Math.round(oy)+'): '+name(kids[i]).slice(0,50)+' ⟷ '+name(kids[j]).slice(0,50));
    }
  }
  // abgeschnittene Schrift (ohne „…“)
  for (const el of all) {
    const cs = getComputedStyle(el);
    if ((cs.overflow==='hidden'||cs.overflowX==='hidden') && cs.textOverflow!=='ellipsis' && el.scrollWidth > el.clientWidth+2 && el.textContent.trim()) out.add('ABGESCHNITTEN: '+name(el));
  }
  // Kästen, die durch „ganz rund“ zu Ovalen werden (Ecken schneiden den Inhalt)
  for (const el of all) {
    const r = el.getBoundingClientRect(), rad = parseFloat(getComputedStyle(el).borderTopLeftRadius)||0;
    if (r.height > 60 && Math.abs(r.width - r.height) > 4 && rad > Math.min(r.width, r.height) / 2 - 1 && rad > 30) out.add('OVAL: '+name(el).slice(0,60)+' ('+Math.round(r.width)+'×'+Math.round(r.height)+')');
  }
  return [...out];
}
