'use strict';
/* Jarvis-App – 10-alltag.js (aus Jarvis in Claude, Zeilen 5136–5561 von V48) */
/* ===================== Rückblick ===================== */
function pageReview() {
  const t = todayISO(), weeks = Array.from({ length: 8 }, (_, i) => addDays(mondayOf(t), -7 * (7 - i)));
  const wk = (mon, fn) => weekDays(mon).reduce((s, d) => s + fn(d), 0);
  const done = weeks.map(m => byType('task').filter(x => x.done && x.doneAt && isoDate(new Date(x.doneAt)) >= m && isoDate(new Date(x.doneAt)) <= addDays(m, 6)).length);
  const learn = weeks.map(m => wk(m, d => byType('subject').reduce((s, x) => s + ((x.time || {})[d] || 0), 0)) / 60);
  const work = weeks.map(m => workWeekH(m));
  const focus = weeks.map(m => wk(m, d => { const x = S.items.find(i => i.id === 'tl-' + d); return (x && x.entries || []).filter(e => e.src === 'focus').reduce((s, e) => s + e.min, 0); }) / 60);
  const chart = (title, vals, unit, dec) => { const mx = Math.max(1, ...vals); return '<section class="card"><h2 class="label">' + title + '</h2><div class="vbars">' + vals.map((v, i) => '<div class="vb"><b>' + (dec ? fmtH(v) : v) + '</b><i style="height:' + Math.round(v / mx * 100) + '%"></i><span>' + dObj(weeks[i]).getDate() + '.' + (dObj(weeks[i]).getMonth() + 1) + '.</span></div>').join('') + '</div><p class="sub">' + unit + ' pro Woche (Wochenbeginn)</p></section>'; };
  const subs = byType('subject').map(x => [x.title, Object.entries(x.time || {}).filter(([d]) => d >= addDays(t, -27)).reduce((s, [, m]) => s + m, 0)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const mx = subs.length ? subs[0][1] : 1;
  const tn = byType('teamnote').filter(n => n.date >= addDays(t, -27) && n.rating);
  const hs = activeHabits(); let due = 0, hit = 0; hs.forEach(h => { const r = habitRate(h); due += r.need; hit += r.hit; });
  return '<div><div class="pagehead"><div><h1 class="page">Rückblick</h1></div></div>' +
    '<div class="stats" style="margin-bottom:20px"><div class="stat"><small>Erledigt (4 Wochen)</small><b>' + done.slice(-4).reduce((a, b) => a + b, 0) + ' Aufgaben</b></div><div class="stat"><small>Gelernt (4 Wochen)</small><b>' + fmtH(learn.slice(-4).reduce((a, b) => a + b, 0)) + ' Std.</b></div><div class="stat"><small>Gewohnheiten</small><b>' + (due ? Math.round(hit / due * 100) + ' %' : '–') + '</b></div><div class="stat"><small>Trainings (Ø Bewertung)</small><b>' + (tn.length ? (tn.reduce((s, n) => s + n.rating, 0) / tn.length).toFixed(1).replace('.', ',') + ' ★' : '–') + '</b></div></div>' +
    '<div class="grid2">' + chart('Erledigte Aufgaben', done, 'Aufgaben', false) + chart('Lernzeit', learn, 'Stunden', true) + chart('Arbeit (geplant)', work, 'Stunden', true) + chart('Fokus-Zeit', focus, 'Stunden', true) +
    '<section class="card"><h2 class="label">Lernzeit je Fach (4 Wochen)</h2>' + (subs.length ? '<div class="bars">' + subs.map(([n, m]) => '<div class="barrow"><span>' + esc(n) + '</span><span class="track"><i style="width:' + Math.round(m / mx * 100) + '%"></i></span><span class="v">' + fmtMin(m) + '</span></div>').join('') + '</div>' : '<p class="empty">Noch keine Lernzeit erfasst.</p>') + '</section></div></div>';
}

/* ===================== Papierkorb ===================== */
function pageTrash() {
  const list = S.trash.slice().sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  return '<div class="listpage"><div><h1 class="page">Papierkorb</h1></div><section class="card">' +
    (list.length ? list.map(x => { const it = x.item || {}; return '<div class="listrow"><span class="lt">' + esc(TYPES[it.type] || it.type || '') + ': ' + esc(it.title || '') + '<small>gelöscht ' + esc(x.deletedAt ? fmtShort(isoDate(new Date(x.deletedAt))) : '') + '</small></span><span class="row"><button class="btn" data-untrash="' + esc(x.id) + '">Wiederherstellen</button><button class="btn ghost danger" data-purge="' + esc(x.id) + '" aria-label="Endgültig löschen">' + ICON.trash + '</button></span></div>'; }).join('') : '<p class="empty">Leer.</p>') + '</section></div>';
}
async function purgeTrash() { const lim = new Date(Date.now() - 30 * 864e5).toISOString(); for (const x of S.trash.filter(x => (x.deletedAt || '') < lim)) { try { await store.delTrash(x.id); } catch (e) {} } }

/* ===================== Essensplan ===================== */
function pageMeals() {
  const mon = curWeek(), plan = (S.meals && S.meals[mon]) || {};
  const dishes = weekDays(mon).map(d => plan[d]).filter(Boolean);
  return '<div class="listpage" style="max-width:900px"><div class="pagehead" style="margin:0"><div><h1 class="page">Essensplan</h1></div>' + weekNav() + '</div>' +
    '<section class="card"><form data-form="meals"><div class="meals">' + weekDays(mon).map(d => '<label>' + esc(fmtShort(d)) + '<input name="' + d + '" value="' + esc(plan[d] || '') + '" placeholder="z. B. Chili" autocomplete="off"></label>').join('') + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" type="submit">Speichern</button>' + '<button class="btn" type="button" data-act="mealsuggest">Ideen vorschlagen</button><button class="btn primary" type="button" data-act="mealshop"' + (dishes.length ? '' : ' disabled') + '>Zutaten auf die Einkaufsliste</button>' + '</div></form></section></div>';
}
async function saveMeals(f) { const fd = new FormData(f), mon = curWeek(), plan = {}; weekDays(mon).forEach(d => { const v = String(fd.get(d) || '').trim().slice(0, 80); if (v) plan[d] = v; }); const m = { ...(S.meals || {}), [mon]: plan }; Object.keys(m).forEach(k => { if (k < addDays(mon, -56)) delete m[k]; }); await store.setMeta('meals', m); S.meals = m; showToast('Gespeichert.'); render(); }
// Ohne KI: Gerichte aus einer festen Liste. s = schnell (unter 20 Min.), z = Zutaten für 1 Person (Grundzutaten wie Salz, Öl weggelassen)
const MEALS = [
  ['Spaghetti Bolognese', 0, ['Spaghetti 250 g', 'Hackfleisch 250 g', 'Passierte Tomaten 500 g', 'Zwiebel', 'Parmesan']],
  ['Chili con Carne', 0, ['Hackfleisch 250 g', 'Kidneybohnen 1 Dose', 'Mais 1 Dose', 'Passierte Tomaten 500 g', 'Zwiebel', 'Reis 250 g']],
  ['Nudeln mit Pesto', 1, ['Nudeln 250 g', 'Pesto 1 Glas', 'Parmesan', 'Cherrytomaten']],
  ['Gemüsepfanne mit Reis', 1, ['Reis 250 g', 'Paprika', 'Zucchini', 'Zwiebel', 'Sojasoße']],
  ['Hähnchen mit Reis und Brokkoli', 0, ['Hähnchenbrust 300 g', 'Reis 250 g', 'Brokkoli']],
  ['Omelett mit Brot', 1, ['Eier 6 Stück', 'Käse', 'Brot', 'Paprika']],
  ['Wraps mit Hähnchen', 1, ['Wraps', 'Hähnchenbrust 200 g', 'Salat', 'Tomaten', 'Joghurt']],
  ['Ofenkartoffeln mit Quark', 0, ['Kartoffeln 1 kg', 'Quark 500 g', 'Schnittlauch']],
  ['Linsensuppe', 0, ['Linsen 250 g', 'Möhren', 'Kartoffeln', 'Zwiebel', 'Würstchen']],
  ['Pfannkuchen', 1, ['Mehl 500 g', 'Eier 6 Stück', 'Milch 1 l', 'Apfelmus']],
  ['Tortellini in Sahnesoße', 1, ['Tortellini 500 g', 'Sahne', 'Schinkenwürfel', 'Erbsen TK']],
  ['Bratkartoffeln mit Spiegelei', 0, ['Kartoffeln 1 kg', 'Eier 6 Stück', 'Zwiebel', 'Speck']],
  ['Couscous-Salat', 1, ['Couscous 500 g', 'Gurke', 'Tomaten', 'Feta', 'Zitrone']],
  ['Curry mit Kichererbsen', 0, ['Kichererbsen 1 Dose', 'Kokosmilch 1 Dose', 'Currypaste', 'Spinat TK', 'Reis 250 g']],
  ['Pizza selbst belegt', 0, ['Pizzateig', 'Tomatensoße', 'Mozzarella', 'Salami', 'Paprika']],
  ['Lachs mit Kartoffeln', 0, ['Lachs TK', 'Kartoffeln 1 kg', 'Zitrone', 'Brokkoli']],
  ['Fischstäbchen mit Kartoffelpüree', 1, ['Fischstäbchen TK', 'Kartoffelpüree', 'Erbsen TK']],
  ['Gnocchi mit Tomatensoße', 1, ['Gnocchi 500 g', 'Passierte Tomaten 500 g', 'Mozzarella']],
  ['Burger', 0, ['Burgerbrötchen', 'Rinderhack 300 g', 'Käsescheiben', 'Salat', 'Tomaten']],
  ['Ofengemüse mit Feta', 0, ['Kartoffeln 1 kg', 'Paprika', 'Zucchini', 'Feta', 'Zwiebel']],
  ['Asia-Nudeln', 1, ['Mie-Nudeln', 'Paprika', 'Möhren', 'Sojasoße', 'Eier 6 Stück']],
  ['Kartoffelsuppe', 0, ['Kartoffeln 1 kg', 'Möhren', 'Lauch', 'Würstchen', 'Gemüsebrühe']],
  ['Reste vom Vortag', 1, []],
  ['Belegte Brote und Salat', 1, ['Brot', 'Aufschnitt', 'Käse', 'Salat', 'Tomaten']],
  ['Quesadillas', 1, ['Wraps', 'Käse gerieben', 'Kidneybohnen 1 Dose', 'Mais 1 Dose']],
  ['Hähnchen-Gemüse-Pfanne', 1, ['Hähnchenbrust 300 g', 'Paprika', 'Zucchini', 'Reis 250 g']],
  ['Lasagne', 0, ['Lasagneplatten', 'Hackfleisch 250 g', 'Passierte Tomaten 500 g', 'Käse gerieben', 'Milch 1 l']],
  ['Milchreis mit Obst', 1, ['Milchreis 250 g', 'Milch 1 l', 'Äpfel']]];
// Gang im Supermarkt, wo die allgemeine Zuordnung danebenliegt
const ING_AISLE = { spaghetti: 'Vorrat', nudeln: 'Vorrat', 'mie-nudeln': 'Vorrat', couscous: 'Vorrat', lasagneplatten: 'Vorrat', reis: 'Vorrat', milchreis: 'Vorrat', 'passierte tomaten': 'Vorrat', tomatensoße: 'Vorrat', pesto: 'Vorrat', sojasoße: 'Vorrat', currypaste: 'Vorrat', gemüsebrühe: 'Vorrat', kokosmilch: 'Vorrat', apfelmus: 'Vorrat', kartoffelpüree: 'Vorrat',
  tortellini: 'Kühlregal', gnocchi: 'Kühlregal', parmesan: 'Kühlregal', mozzarella: 'Kühlregal', feta: 'Kühlregal', pizzateig: 'Kühlregal', würstchen: 'Kühlregal', speck: 'Kühlregal', aufschnitt: 'Kühlregal',
  zucchini: 'Obst & Gemüse', schnittlauch: 'Obst & Gemüse', lauch: 'Obst & Gemüse', wraps: 'Brot & Backwaren', 'lachs tk': 'Tiefkühl', 'fischstäbchen tk': 'Tiefkühl' };
const mealFind = name => { const n = String(name || '').toLowerCase().trim(); return MEALS.find(([t]) => t.toLowerCase() === n) || MEALS.find(([t]) => n.length > 3 && (t.toLowerCase().includes(n) || n.includes(t.toLowerCase().split(' ')[0]))) || null; };
async function mealSuggest() {
  const mon = curWeek(), plan = (S.meals && S.meals[mon]) || {}, free = weekDays(mon).filter(d => !plan[d]);
  if (!free.length) { showToast('Die Woche ist schon voll geplant.'); return; }
  const recent = new Set(Object.entries(S.meals || {}).filter(([k]) => k >= addDays(mon, -14)).flatMap(([, p]) => Object.values(p)).map(x => String(x).toLowerCase()));
  const pool = MEALS.filter(([t]) => t !== 'Reste vom Vortag' && !recent.has(t.toLowerCase())).sort(() => Math.random() - 0.5), used = new Set();
  const m = { ...(S.meals || {}) }; m[mon] = { ...plan };
  free.forEach(d => {
    const busy = blocksOn(d).reduce((s, b) => s + durH(b.start, b.end), 0) >= 7, prev = m[mon][addDays(d, -1)], pm = prev && mealFind(prev);
    if (pm && !pm[1] && busy && !Object.values(m[mon]).includes('Reste vom Vortag')) { m[mon][d] = 'Reste vom Vortag'; return; }   // volles Programm: Reste vom Vortag
    const x = pool.find(([t, s]) => !used.has(t) && (!busy || s)) || pool.find(([t]) => !used.has(t)) || MEALS[0];
    used.add(x[0]); m[mon][d] = x[0];
  });
  await store.setMeta('meals', m); S.meals = m;
  showToast(free.length + (free.length === 1 ? ' Tag' : ' Tage') + ' gefüllt. An vollen Tagen schnelle Gerichte. Einfach überschreiben, was dir nicht passt.');
  render();
}
async function mealShop() {
  const mon = curWeek(), plan = (S.meals && S.meals[mon]) || {}, dishes = Object.values(plan); if (!dishes.length) return;
  const have = new Set(byType('shopping').filter(i => !i.done).map(i => i.title.toLowerCase().replace(/\s+\d.*$/, ''))), unknown = [], seen = new Set(), items = [];
  dishes.forEach(name => { const x = mealFind(name); if (!x) { unknown.push(name); return; } x[2].forEach(z => { const k = z.toLowerCase().replace(/\s+\d.*$/, ''); if (seen.has(k) || have.has(k)) return; seen.add(k); items.push(cleanItem({ type: 'shopping', title: z, aisle: ING_AISLE[k] })); }); });
  if (!items.length) { showToast(unknown.length ? 'Für ' + unknown.join(', ') + ' kenne ich keine Zutaten. Trag sie einfach selbst ein.' : 'Alles schon auf der Einkaufsliste.'); return; }
  S.pending = { text: 'Zutaten für: ' + dishes.join(', '), reply: items.length + ' Zutaten für deinen Essensplan (Mengen grob für 1 Person).' + (unknown.length ? ' Für ' + unknown.join(', ') + ' kenne ich keine Zutaten.' : ''), items, fromNote: null };
  render();
}


/* ===================== Zusatzkalender & Geburtstage ===================== */
const TEAM_CAL = { id: '6bccee518a54346e36d10361e101db6e07df969a5944171e66c8e9ea20758656@group.calendar.google.com', name: 'U13 Trainer-Cockpit', area: 'team' };
const calLabel = b => b.calName === 'U13 Trainer-Cockpit' ? 'Cockpit' : (b.calName || 'Google');
function extraCals() { return Array.isArray(S.settings.extraCals) ? S.settings.extraCals : [TEAM_CAL]; }
// Geburtstag: { type:'birthday', name, md:'MM-DD', year? } – wiederholt sich jedes Jahr, landet nicht im Kalender
function bdaysOn(d) {
  const md = d.slice(5);
  return byType('birthday').filter(b => b.md === md || (b.md === '02-29' && md === '02-28' && !isLeap(Number(d.slice(0, 4)))))
    .map(b => ({ id: b.id, name: b.name || b.title, age: b.year ? Number(d.slice(0, 4)) - Number(b.year) : null, date: d }));
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function nextBdays(n) {
  const t = todayISO(), y = Number(t.slice(0, 4));
  return byType('birthday').map(b => { let d = y + '-' + b.md; if (b.md === '02-29' && !isLeap(y)) d = y + '-02-28'; if (d < t) d = (y + 1) + '-' + (b.md === '02-29' && !isLeap(y + 1) ? '02-28' : b.md); return { id: b.id, name: b.name || b.title, date: d, age: b.year ? Number(d.slice(0, 4)) - Number(b.year) : null }; })
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, n || 999);
}
function pageBdays() {
  const list = nextBdays();
  return '<div class="listpage"><div class="pagehead" style="margin:0"><div><h1 class="page">Geburtstage</h1></div><span class="row"><label class="btn" for="vcf-in">Aus Kontaktdatei übernehmen</label><input id="vcf-in" type="file" accept=".vcf,text/vcard,text/x-vcard" class="sr" data-act-change="vcf"><button class="btn primary" data-new="birthday">+ Geburtstag</button></span></div><section class="card">' +
    (list.length ? list.map(x => '<div class="listrow"><button class="lt" data-edit="' + esc(x.id) + '">' + esc(x.name) + '<small>' + esc(fmtShort(x.date)) + ' · ' + esc(relDay(x.date)) + (x.age ? ' · wird ' + x.age : '') + '</small></button></div>').join('') : '<p class="empty">Noch keine Geburtstage.</p>') + '</section></div>';
}


/* ----- Geburtstage aus Kontaktdatei (.vcf) – wird nur hier im Gerät gelesen, nur Name + Geburtstag bleiben ----- */
function parseVcf(text) {
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let cur = null;
  const unesc = v => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue;
    if (/^BEGIN:VCARD/i.test(l)) { cur = {}; continue; }
    if (/^END:VCARD/i.test(l)) { if (cur && cur.bday && (cur.fn || cur.n)) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = l.indexOf(':'); if (i < 0) continue;
    const head = l.slice(0, i), val = l.slice(i + 1), key = head.split(';')[0].replace(/^item\d+\./i, '').toUpperCase();
    if (key === 'FN') cur.fn = unesc(val);
    else if (key === 'N') { const p = val.split(';').map(unesc); cur.n = [p[1], p[0]].filter(Boolean).join(' '); }
    else if (key === 'BDAY') {
      const v = val.trim(); let m;
      const omit = /X-APPLE-OMIT-YEAR=(\d{4})/i.exec(head);
      if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v))) cur.bday = { year: omit && omit[1] === m[1] || m[1] === '1604' ? null : Number(m[1]), md: m[2] + '-' + m[3] };
      else if ((m = /^--(\d{2})-?(\d{2})/.exec(v))) cur.bday = { year: null, md: m[1] + '-' + m[2] };
    }
  }
  return out.map(c => ({ name: (c.fn || c.n).replace(/\s+/g, ' ').slice(0, 80), md: c.bday.md, year: c.bday.year }))
    .filter(c => c.name && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(c.md));
}
async function importVcf(file) {
  if (file.size > 30 * 1024 * 1024) { showToast('Die Datei ist zu groß.'); return; }
  let list;
  try { list = parseVcf(await file.text()); } catch (e) { showToast('Die Datei konnte nicht gelesen werden.'); return; }
  if (!list.length) { showToast('In der Datei steht bei keinem Kontakt ein Geburtstag.'); return; }
  const have = new Set(byType('birthday').map(b => String(b.name || b.title).toLowerCase())), seen = new Set(), y = Number(todayISO().slice(0, 4));
  const me = String(S.settings.name || '').toLowerCase();
  S.vcf = { list: list.filter(c => { const k = c.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(c => { const dup = have.has(c.name.toLowerCase()); return { ...c, age: c.year ? y - c.year : null, dup, on: !dup && !(me && c.name.toLowerCase().startsWith(me)) }; })
    .sort((a, b) => a.name.localeCompare(b.name, 'de')) };
  render();
}
function vcfSheet() {
  const L = S.vcf.list, n = L.filter(x => x.on).length;
  return '<div class="overlay" data-close="vcf"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="vcf-h"><h2 id="vcf-h">Geburtstage übernehmen</h2><p class="sub">' + L.length + ' Kontakte mit Geburtstag gefunden. Übernommen werden nur Name und Geburtstag – Telefonnummern, Adressen usw. werden nicht gespeichert. Haken entfernen bei allen, die du nicht in Jarvis haben willst.</p>' +
    '<div class="row" style="margin:8px 0"><button class="btn ghost" data-act="vcfall">Alle</button><button class="btn ghost" data-act="vcfadult">Nur Erwachsene / ohne Jahr</button><button class="btn ghost" data-act="vcfnone">Keine</button></div>' +
    '<div class="ics-pick" style="max-height:50vh">' + L.map((x, i) => '<label class="habit"><input type="checkbox" data-vcfi="' + i + '"' + (x.on ? ' checked' : '') + (x.dup ? ' disabled' : '') + '><span>' + esc(x.name) + '<br><small class="sub">' + esc(x.md.slice(3) + '.' + x.md.slice(0, 2) + '.' + (x.year ? x.year : '')) + (x.age ? ' · ' + x.age + ' Jahre' : '') + (x.dup ? ' · schon da' : '') + '</small></span></label>').join('') + '</div>' +
    '<div class="row actions"><button class="btn ghost" data-act="vcfcancel">Abbrechen</button><button class="btn primary" data-act="vcfok"' + (n ? '' : ' disabled') + '>Übernehmen (' + n + ')</button></div></div></div>';
}
async function applyVcf() {
  const pick = S.vcf.list.filter(x => x.on && !x.dup), ts = new Date().toISOString(); S.vcf = null; render();
  let n = 0;
  for (const x of pick) {
    const id = 'bd-' + x.name.toLowerCase().normalize('NFKD').replace(/ß/g, 'ss').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const it = { id, type: 'birthday', title: x.name, name: x.name, md: x.md, source: 'kontakte', createdAt: ts }; if (x.year) it.year = x.year;
    try { await withRetry(() => store.setItem(it)); n++; } catch (e) {}
  }
  showToast(n + (n === 1 ? ' Geburtstag' : ' Geburtstage') + ' übernommen.');
}

/* ===================== Protokoll: was Jarvis gemacht hat ===================== */
// undo = { created: [ids], restore: [Einträge vorher], untrash: [Gmail-Threads] } – genau das macht „Rückgängig“ wieder gut
async function setLog(e) {
  if (db) return db.collection('log').doc(e.id).set(e);
  const o = local.read(); o.log = o.log || {}; o.log[e.id] = e; local.write(o); S.log = Object.values(o.log); render();
}
async function logAct(text, undo) {
  const e = { id: uid(), at: new Date().toISOString(), text: String(text || '').slice(0, 300) };
  if (undo && ((undo.created || []).length || (undo.restore || []).length || (undo.untrash || []).length || (undo.moves || []).length)) e.undo = { created: (undo.created || []).slice(0, 200), restore: (undo.restore || []).slice(0, 60), untrash: (undo.untrash || []).slice(0, 100), ...((undo.moves || []).length ? { moves: undo.moves.slice(0, 20) } : {}) };
  try { await setLog(e); } catch (er) { /* das Protokoll darf nie die eigentliche Aktion stören */ }
}
async function undoLog(id) {
  const e = S.log.find(x => x.id === id); if (!e || !e.undo || e.undone) return;
  const u = e.undo;
  try {
    for (const cid of u.created || []) { const it = S.items.find(i => i.id === cid); if (it) await removeItem(it); }
    for (const it of u.restore || []) { if (S.items.some(i => i.id === it.id)) await store.setItem(it); else await restoreItem(it); }
    for (const t of u.untrash || []) { try { await mcp.callTool(GMAIL, 'untrash_thread', { threadId: t }, { cache: false }); } catch (er) {} }
    if ((u.moves || []).length) await applyMoves(u.moves);
    await setLog({ ...e, undone: new Date().toISOString() });
    showToast('Rückgängig gemacht.');
  } catch (er) { showToast('Rückgängig ging gerade nicht ganz. Bitte nochmal versuchen.'); }
}
async function purgeLog() { const lim = new Date(Date.now() - 30 * 864e5).toISOString(); for (const x of S.log.filter(x => (x.at || '') < lim)) { try { if (db) await db.collection('log').doc(x.id).delete(); } catch (e) {} } }
function pageLog() {
  const list = S.log.slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  let last = '';
  const rows = list.map(e => {
    const d = isoDate(new Date(e.at)), head = d !== last ? '<div class="logday">' + esc(relDay(d) === fmtShort(d) ? fmtShort(d) : relDay(d).charAt(0).toUpperCase() + relDay(d).slice(1) + ', ' + fmtShort(d)) + '</div>' : ''; last = d;
    return head + '<div class="listrow' + (e.undone ? ' undone' : '') + '"><span class="lt">' + esc(e.text) + '<small>' + esc(new Date(e.at).toTimeString().slice(0, 5)) + ' Uhr' + (e.undone ? ' · rückgängig gemacht' : '') + '</small></span>' +
      (e.undo && !e.undone ? '<button class="btn" data-undo="' + esc(e.id) + '">Rückgängig</button>' : '') + '</div>';
  }).join('');
  return '<div class="listpage"><div><h1 class="page">Protokoll</h1></div><section class="card">' + (list.length ? rows : '<p class="empty">Noch nichts. Hier steht alles, was Jarvis für dich einträgt, plant oder in Gmail aufräumt, 30 Tage lang.</p>') + '</section></div>';
}

/* ===================== Wetter zu Terminen draußen ===================== */
const isOutside = b => isTeamBlock(b) || !!(b.src && b.src.outside);
function wxAt(iso, hm) {
  if (!S.weather || !hm) return null;
  const h = Number(String(hm).slice(0, 2));
  const hr = (S.weather.hourly || []).find(x => x.date === iso && x.hour === h);
  if (hr) return { temp: hr.temp, rain: hr.rain, phrase: hr.phrase || '' };
  const d = wxDay(iso); if (!d) return null;
  return { temp: h >= 18 ? d.lo : d.hi, rain: h >= 18 ? d.rainNight : d.rain, phrase: d.phrase || '' };
}
function wxWarn(w) {
  if (!w) return null;
  if (/gewitter/i.test(w.phrase)) return { text: 'Gewitter angesagt', tip: 'Draußen lieber absagen oder verlegen.' };
  if (w.temp >= 30) return { text: w.temp + ' Grad', tip: 'Viel Wasser und Pausen einplanen.' };
  if (w.temp <= 0) return { text: w.temp + ' Grad', tip: 'Warm anziehen, auf Glätte achten.' };
  if (w.rain >= 50) return { text: w.rain + ' % Regenwahrscheinlichkeit', tip: 'Regenjacke und Ersatzplan einplanen.' };
  return null;
}
function wxText(b) {
  if (!b || !b.start || !isOutside(b)) return '';
  const w = wxAt(b.date, b.start); if (!w) return '';
  return w.temp + '°' + (w.rain >= 30 ? ', ' + w.rain + ' % Regen' : '') + (/gewitter/i.test(w.phrase) ? ', Gewitter' : '');
}

/* ===================== Verträge ===================== */
// Vertrag: { type:'contract', title, cost, per:'monat'|'jahr', until, notice, noticeUnit:'monate'|'wochen', renew: Monate (0 = endet) }
function addMonths(iso, n) { const x = dObj(iso), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return isoDate(x); }
function cancelByOf(c, end) { const n = Number(c.notice || 0); return c.noticeUnit === 'wochen' ? addDays(end, -7 * n) : addMonths(end, -n); }
function contractInfo(c) {
  if (!c.until || !/^\d{4}-\d{2}-\d{2}$/.test(c.until)) return null;
  const r = Number(c.renew || 0), t = todayISO(); let end = c.until, g = 0;
  while (r > 0 && cancelByOf(c, end) < t && g++ < 400) end = addMonths(end, r);   // verlängert sich automatisch weiter
  const by = cancelByOf(c, end);
  return { end, by, left: daysUntil(by), over: end < t };
}
const perMonth = c => { const v = Number(String(c.cost ?? '').replace(',', '.')) || 0; return c.per === 'jahr' ? v / 12 : v; };
function pageContracts() {
  const list = byType('contract').map(c => ({ c, i: contractInfo(c) })).sort((a, b) => (a.i ? a.i.by : '9').localeCompare(b.i ? b.i.by : '9'));
  const sum = list.reduce((s, x) => s + perMonth(x.c), 0), lead = Number(S.settings.contractLead || 28);
  const soon = list.filter(x => x.i && x.i.left >= 0 && x.i.left <= lead).length;
  const row = ({ c, i }) => {
    const lvl = !i ? '' : i.over ? '' : i.left < 0 ? 'r' : i.left <= lead ? 'y' : 'g';
    const when = !i ? 'Laufzeit fehlt' : i.over ? 'abgelaufen am ' + fmtShort(i.end) : i.left < 0 ? 'Frist verpasst, endet am ' + fmtShort(i.end) : 'kündigen bis ' + fmtShort(i.by) + ' (' + (i.left === 0 ? 'heute' : 'noch ' + i.left + ' Tage') + ')';
    return '<div class="listrow"><button class="lt" data-edit="' + esc(c.id) + '">' + esc(c.title) + '<small>' + (c.cost ? esc(eur(Number(String(c.cost).replace(',', '.')) || 0)) + (c.per === 'jahr' ? ' im Jahr' : ' im Monat') + ' · ' : '') + (i && !i.over ? 'läuft bis ' + esc(fmtShort(i.end)) + (Number(c.renew || 0) > 0 ? ', verlängert sich sonst' : '') : '') + '</small></button>' +
      (lvl ? '<span class="amp ' + lvl + '"><i></i>' + esc(when) + '</span>' : '<span class="sub">' + esc(when) + '</span>') + '</div>';
  };
  return '<div class="listpage"><div class="pagehead" style="margin:0"><div><h1 class="page">Verträge</h1></div><button class="btn primary" data-new="contract">+ Vertrag</button></div>' +
    (list.length ? '<div class="stats"><div class="stat"><small>Kosten pro Monat</small><b>' + eur(sum) + '</b></div><div class="stat"><small>Pro Jahr</small><b>' + eur(sum * 12) + '</b></div><div class="stat"><small>Frist in den nächsten ' + lead + ' Tagen</small><b>' + soon + '</b></div></div>' : '') +
    '<section class="card">' + (list.length ? list.map(row).join('') : '<p class="empty">Noch keine Verträge. Zum Beispiel Handy, Fitnessstudio, Streaming, Versicherungen. Jarvis erinnert dich rechtzeitig vor der Kündigungsfrist.</p>') + '</section></div>';
}

/* ===================== Haushalt & Listen ===================== */
function pageHousehold() {
  const t = todayISO();
  const chores = openTasks().filter(x => x.chore).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const lastDone = title => { const d = byType('task').filter(x => x.chore && x.done && x.title === title && x.doneAt).map(x => x.doneAt).sort().pop(); return d ? relDay(isoDate(new Date(d))) : null; };
  const lists = byType('packlist').sort((a, b) => String(a.title).localeCompare(String(b.title), 'de'));
  const choreRow = x => '<div class="task"><input type="checkbox" aria-label="Erledigt: ' + esc(x.title) + '" data-toggle="' + esc(x.id) + '"><button class="tx" data-edit="' + esc(x.id) + '">' + esc(x.title) + '<br><small class="sub">alle ' + esc(x.repeatDays) + ' Tage' + (lastDone(x.title) ? ' · zuletzt ' + esc(lastDone(x.title)) : '') + '</small></button><span class="due' + (x.date && x.date < t ? ' over' : '') + '">' + esc(x.date ? relDay(x.date) : '') + '</span></div>';
  const listCard = l => {
    const es = l.entries || [], n = es.filter(e => e.on).length;
    return '<section class="card plist"><div class="row" style="justify-content:space-between"><h2 class="label" style="margin:0">' + esc(l.title) + ' <span class="sub">' + n + ' / ' + es.length + '</span></h2><span class="row">' + (n ? '<button class="btn ghost sm" data-plreset="' + esc(l.id) + '">Haken entfernen</button>' : '') + '<button class="btn ghost sm" data-plsuggest="' + esc(l.id) + '">Vorlage ergänzen</button>' + '<button class="btn ghost sm danger" data-del="' + esc(l.id) + '" aria-label="Liste löschen">' + ICON.trash.replace('<svg', '<svg width="16" height="16"') + '</button></span></div>' +
      es.map((e, k) => '<div class="task' + (e.on ? ' done' : '') + '"><input type="checkbox" aria-label="' + esc(e.t) + '" data-plcheck="' + esc(l.id) + ':' + k + '"' + (e.on ? ' checked' : '') + '><span class="tx">' + esc(e.t) + '</span><button class="star" data-pldel="' + esc(l.id) + ':' + k + '" aria-label="Entfernen: ' + esc(e.t) + '">✕</button></div>').join('') +
      '<form class="addrow" data-form="plentry" data-id="' + esc(l.id) + '" style="margin-top:8px"><label class="sr" for="pl-' + esc(l.id) + '">Neuer Eintrag</label><input id="pl-' + esc(l.id) + '" data-keep="pl-' + esc(l.id) + '" placeholder="Hinzufügen, z. B. Trinkflasche" autocomplete="off"><button class="btn" type="submit">+</button></form></section>';
  };
  return '<div class="listpage"><div><h1 class="page">Haushalt &amp; Listen</h1></div>' +
    '<section class="card"><h2 class="label">Wiederkehrend im Haushalt</h2>' + (chores.length ? chores.map(choreRow).join('') : '<p class="empty">Noch nichts. Zum Beispiel: Bad putzen alle 7 Tage, Bettwäsche alle 14 Tage.</p>') +
      '<form class="addrow" data-form="chore" style="margin-top:10px"><label class="sr" for="ch-in">Was ist zu tun?</label><input id="ch-in" name="title" placeholder="z. B. Bad putzen" autocomplete="off"><label class="sr" for="ch-d">Alle wie viele Tage?</label><input id="ch-d" name="days" type="number" min="1" max="365" value="7" style="max-width:90px" aria-label="Alle wie viele Tage"><button class="btn primary" type="submit">Anlegen</button></form>' +
      '<p class="sub" style="margin-top:8px">Die Zahl ist „alle … Tage“. Wenn du abhakst, kommt die Aufgabe nach so vielen Tagen wieder. Sie steht auch bei deinen Aufgaben auf der Startseite.</p></section>' +
    lists.map(listCard).join('') +
    '<section class="card"><h2 class="label">Neue Liste</h2><form data-form="packlist" style="display:flex;flex-direction:column;gap:10px"><label class="field"><span>Name</span><input name="title" placeholder="z. B. Trainingstasche, Wochenende weg, Klausurtag" autocomplete="off"></label>' +
      '<label class="field"><span>Einträge (mit Komma getrennt, optional)</span><input name="entries" placeholder="z. B. Bälle, Leibchen, Hütchen, Pfeife" autocomplete="off"></label><div class="row"><button class="btn primary" type="submit">Liste anlegen</button></div></form></section></div>';
}
// Ohne KI: Vorlagen nach Stichwort im Listennamen
const PACK_TPL = [
  [/training|trainingstasche|fußball|fussball/, ['Bälle', 'Ballpumpe', 'Leibchen', 'Hütchen', 'Pfeife', 'Stoppuhr', 'Trainingsplan', 'Trinkflasche', 'Erste-Hilfe-Tasche', 'Kühlspray', 'Schlüssel Sportplatz']],
  [/spiel|turnier|auswärts/, ['Spielerpass / Spielberechtigung', 'Trikots', 'Aufstellung', 'Bälle', 'Leibchen', 'Pfeife', 'Erste-Hilfe-Tasche', 'Kühlspray', 'Trinkflaschen', 'Kleingeld', 'Startzeiten / Adresse']],
  [/urlaub|reise|wochenende|kurztrip|städtetrip|ferien/, ['Ausweis', 'Ladekabel', 'Powerbank', 'Zahnbürste', 'Zahnpasta', 'Duschzeug', 'Medikamente', 'Unterwäsche', 'Socken', 'Schlafsachen', 'Regenjacke', 'Tickets / Buchung']],
  [/klausur|prüfung|examen/, ['Studierendenausweis', 'Personalausweis', 'Stifte', 'Ersatzstift', 'Taschenrechner', 'Lineal', 'Erlaubte Hilfsmittel', 'Uhr', 'Wasser', 'Snack']],
  [/uni|vorlesung|campus|bib/, ['Laptop', 'Ladekabel', 'Studierendenausweis', 'Block', 'Stifte', 'Kopfhörer', 'Wasser', 'Snack', 'Mensakarte']],
  [/büro|arbeit|office/, ['Laptop', 'Ladekabel', 'Mitarbeiterausweis', 'Kopfhörer', 'Mittagessen', 'Wasser', 'Schlüssel']],
  [/schwimm|freibad|hallenbad|strand|see\b/, ['Badesachen', 'Handtuch', 'Duschzeug', 'Sonnencreme', 'Badeschlappen', 'Wasser', 'Snack', 'Schloss für den Spind']],
  [/fitness|gym|sport/, ['Sportkleidung', 'Sportschuhe', 'Handtuch', 'Trinkflasche', 'Kopfhörer', 'Schloss', 'Duschzeug']],
  [/camping|zelt|festival/, ['Zelt', 'Schlafsack', 'Isomatte', 'Taschenlampe', 'Powerbank', 'Regenjacke', 'Gummistiefel', 'Sonnencreme', 'Klopapier', 'Müllbeutel', 'Ohrstöpsel']],
  [/ski|winter/, ['Skihose', 'Skijacke', 'Handschuhe', 'Mütze', 'Skibrille', 'Thermounterwäsche', 'Skipass', 'Sonnencreme', 'Lippenpflege']],
  [/grillen|party|feier|geburtstag/, ['Getränke', 'Grillgut', 'Brot', 'Salate', 'Teller und Besteck', 'Servietten', 'Müllbeutel', 'Musikbox', 'Geschenk']],
  [/umzug/, ['Kartons', 'Klebeband', 'Stift', 'Müllbeutel', 'Werkzeug', 'Akkuschrauber', 'Decken zum Polstern', 'Getränke für Helfer']]];
const PACK_DEF = ['Handy', 'Ladekabel', 'Schlüssel', 'Geldbeutel', 'Trinkflasche', 'Taschentücher'];
async function plSuggest(id) {
  const l = S.items.find(i => i.id === id); if (!l) return;
  const have = (l.entries || []).map(e => e.t.toLowerCase()), name = String(l.title || '').toLowerCase();
  const hits = PACK_TPL.filter(([re]) => re.test(name)), src = hits.length ? hits.flatMap(([, xs]) => xs) : PACK_DEF;
  const add = Array.from(new Set(src)).filter(x => !have.includes(x.toLowerCase())).slice(0, 12);
  if (!add.length) { showToast('Keine neuen Ideen aus der Vorlage.'); return; }
  const cur = S.items.find(i => i.id === id) || l;
  await store.setItem({ ...cur, entries: (cur.entries || []).concat(add.map(t => ({ t, on: false }))) });
  logAct('Liste „' + l.title + '“ ergänzt: ' + add.join(', '), { restore: [cur] });
  showToast(add.length + ' Einträge aus der Vorlage ergänzt.' + (hits.length ? '' : ' (Allgemeine Vorlage, weil der Name nichts Bekanntes enthält.)'), () => store.setItem(cur));
  render();
}

/* ===================== Hinweise & Startseite ===================== */
function pageHints() {
  const s = S.settings, off = s.hintsOff || [], now = hintsAll();
  return '<div class="listpage"><div><h1 class="page">Hinweise</h1></div>' +
    '<section class="card"><h2 class="label">Gerade aktuell</h2>' + (now.length ? now.map(h => '<div class="listrow"><span class="lt">' + esc(h.text) + '<small>' + esc(HINT_KINDS[h.kind] || '') + (off.includes(h.kind) ? ' · ausgeschaltet' : '') + '</small></span></div>').join('') : '<p class="empty">Gerade gibt es keine Hinweise.</p>') + '</section>' +
    '<section class="card"><h2 class="label">Welche Hinweise sollen kommen?</h2>' + Object.entries(HINT_KINDS).map(([k, l]) => '<label class="toggle"><input type="checkbox" data-hintkind="' + k + '"' + (off.includes(k) ? '' : ' checked') + '> ' + esc(l) + '</label>').join('') + '</section>' +
    '<section class="card"><h2 class="label">Ruhezeit</h2><label class="toggle"><input type="checkbox" data-setting="quietOn"' + (s.quietOn !== false ? ' checked' : '') + '> In der Ruhezeit keine Hinweise auf der Startseite</label>' +
      '<form data-form="quiet" style="display:flex;flex-direction:column;gap:10px;margin-top:6px"><div class="formgrid"><label class="field"><span>Von</span><input name="from" type="time" value="' + esc(s.quietFrom || '21:00') + '"></label><label class="field"><span>Bis</span><input name="to" type="time" value="' + esc(s.quietTo || '07:00') + '"></label>' +
      '<label class="field"><span>Verträge: Hinweis so viele Tage vor der Frist</span><input name="lead" type="number" min="1" max="120" value="' + esc(s.contractLead || 28) + '"></label></div><div class="row"><button class="btn primary" type="submit">Speichern</button></div></form>' +
      '<p class="sub" style="margin-top:8px">Meldungen aufs Handy kommen später über deine eigene App.</p></section></div>';
}
const TILE_COL = { top: 'oben', main: 'links', side: 'rechts, Jarvis-Spalte' };
function tileOrderAll() {
  const order = tileOrderIds();
  return TODAY_TILES.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
function tileSettings() {
  const hidden = S.settings.hiddenTiles || [], all = tileOrderAll();
  return '<section class="card"><h2 class="label">Startseite</h2>' + all.map(x => {
    const same = all.filter(y => y.col === x.col), k = same.indexOf(x);
    return '<div class="listrow"><label class="toggle" style="flex:1"><input type="checkbox" data-tileon="' + esc(x.id) + '"' + (hidden.includes(x.id) ? '' : ' checked') + '> ' + esc(x.name) + ' <span class="sub">(' + TILE_COL[x.col] + ')</span></label><span class="row">' +
      '<button class="iconbtn" data-tilemove="' + esc(x.id) + ':-1" aria-label="' + esc(x.name) + ' nach oben"' + (k === 0 ? ' disabled' : '') + '>↑</button><button class="iconbtn" data-tilemove="' + esc(x.id) + ':1" aria-label="' + esc(x.name) + ' nach unten"' + (k === same.length - 1 ? ' disabled' : '') + '>↓</button></span></div>';
  }).join('') + '<p class="sub" style="margin-top:8px">Haken weg = Kachel ausgeblendet. Mit den Pfeilen änderst du die Reihenfolge innerhalb einer Spalte. Aufgaben stehen mit in „Dein Tag“, solange beide an sind. Fokus und Meine Zeiten stehen nebeneinander, wenn sie direkt aufeinander folgen. Auf dem Handy stehen alle Kacheln untereinander.</p>' +
    '<label class="toggle" style="margin-top:8px"><input type="checkbox" data-setting="autoBrief"' + (S.settings.autoBrief !== false ? ' checked' : '') + '> Morgenbericht morgens automatisch schreiben</label>' +
    '<label class="toggle"><input type="checkbox" data-setting="smartTiles"' + (smartTiles() ? ' checked' : '') + '> Je nach Tageszeit umstellen (abends Tagesabschluss, sonntags und montags Wochenrückblick vorn, sonst ausgeblendet)</label></section>';
}
async function moveTile(id, d) {
  const all = tileOrderAll(), x = all.find(t => t.id === id); if (!x) return;
  const same = all.filter(y => y.col === x.col), k = same.indexOf(x), other = same[k + d]; if (!other) return;
  const ids = all.map(t => t.id), a = ids.indexOf(x.id), b = ids.indexOf(other.id); ids[a] = other.id; ids[b] = x.id;
  S.settings = { ...S.settings, tileOrder2: ids }; await store.setSettings(S.settings); render();
}

/* ===================== Mails: Aufgaben und Antwortentwürfe ===================== */
function mailTodo(idx) {
  const m = S.mail && S.mail.items && S.mail.items[idx]; if (!m || !m.todo) return;
  const it = cleanItem({ type: 'task', title: m.todo.title, date: m.todo.date });
  it.note = 'Aus der Mail „' + m.subject + '“' + (m.from ? ' von ' + m.from : '');
  S.pending = { text: 'Aus Mail: ' + m.subject, reply: 'Diese Aufgabe steckt in der Mail. Passt das so?', items: [it], fromNote: null, mailIdx: idx }; render();
}
const mailErr = e => e && ['not_granted', 'server_not_connected', 'consent_required', 'not_declared', 'needs_reauth'].includes(e.code) ? 'Gmail ist nicht verbunden. Bitte neu mit Google anmelden.' : 'Das ging gerade nicht. Bitte nochmal versuchen.';
async function openDraft(idx) {
  const m = S.mail && S.mail.items && S.mail.items[idx]; if (!m || !m.threadId || !mcp) return;
  S.draft = { idx, subject: m.subject, from: m.from, busy: 'Jarvis liest die Mail …', text: '' }; render();
  try {
    const g = await mcp.callTool(GMAIL, 'get_thread', { threadId: m.threadId, messageFormat: 'PLAIN_TEXT' }, { cache: false });
    const ms = (g && g.payload && g.payload.messages) || [], last = ms[ms.length - 1] || {};
    const body = String(last.plaintextBody || last.plaintext_body || last.snippet || '');
    const to = (String(last.sender || m.from || '').match(/[^\s<>"',;]+@[^\s<>"',;]+/) || [''])[0];
    if (!S.draft) return;
    // Regel von Phil: keine Entwürfe an Eltern oder Spieler der Mannschaft
    if (/\bu13\b|mannschaft|training|trainer|spieltag|eltern|mein sohn|meine tochter|unser sohn|unsere tochter/i.test(m.subject + ' ' + body.slice(0, 3000))) { S.draft = null; showToast('Bei Mails rund um deine Mannschaft schreibe ich keine Entwürfe.'); render(); return; }
    // Ohne KI: Vorlage mit passender Anrede (du oder Sie), offene Stelle als [ … ]
    const sie = /\b(?:Sie|Ihnen|Ihre[mnrs]?|Ihr)\b|sehr geehrte|mit freundlichen grüßen|freundliche grüße/.test(body.slice(0, 4000));
    const nm = mailFrom(last.sender || m.from || '').replace(/@.*$/, '').trim(), first = nm.split(/\s+/)[0] || '';
    const me = S.settings.name || '[Name]';
    const text = sie ? 'Guten Tag' + (nm && /\s/.test(nm) ? ' ' + nm : '') + ',\n\nvielen Dank für Ihre Nachricht.\n\n[ … ]\n\nMit freundlichen Grüßen\n' + me
      : 'Hallo' + (first ? ' ' + first : '') + ',\n\ndanke für deine Nachricht.\n\n[ … ]\n\nViele Grüße\n' + me;
    S.draft = { ...S.draft, to, replyTo: last.id || null, busy: '', text };
  } catch (e) { S.draft = null; showToast(mailErr(e)); }
  render();
}
function draftSheet() {
  const D = S.draft, subj = /^(re|aw):/i.test(D.subject || '') ? D.subject : 'Re: ' + (D.subject || '');
  return '<div class="overlay" data-close="draft"><div class="sheet draft" role="dialog" aria-modal="true" aria-labelledby="dr-h"><h2 id="dr-h">Antwort entwerfen</h2>' +
    '<p class="sub">An: ' + esc(D.to || D.from || '…') + '<br>Betreff: ' + esc(subj) + '</p>' +
    (D.busy ? '<p class="empty">' + esc(D.busy) + '</p>' : '<label class="field"><span>Dein Entwurf (du kannst alles ändern)</span><textarea data-draft="1" data-keep="draft-text" rows="10">' + esc(D.text) + '</textarea></label>' +
      '<p class="sub">Das ist eine Vorlage: Schreib deinen Text an die Stelle [ … ]. Jarvis schickt nichts ab. Der Entwurf landet in Gmail unter „Entwürfe“, abschicken machst du selbst.</p>') +
    '<div class="row actions"><button class="btn ghost" data-xclose="draft">Verwerfen</button>' + (D.busy ? '' : '<button class="btn primary" data-act="draftsave"' + (D.saving ? ' disabled' : '') + '>' + (D.saving ? 'Speichere …' : 'In Gmail als Entwurf speichern') + '</button>') + '</div></div></div>';
}
async function saveDraft() {
  const D = S.draft; if (!D || D.busy || D.saving || !mcp) return;
  const body = String(D.text || '').trim(); if (!body) { showToast('Der Entwurf ist leer.'); return; }
  const subject = /^(re|aw):/i.test(D.subject || '') ? D.subject : 'Re: ' + (D.subject || '');
  D.saving = true; render();
  try {
    const input = { subject, body }; if (D.to) input.to = [D.to]; if (D.replyTo) input.replyToMessageId = D.replyTo;
    await mcp.callTool(GMAIL, 'create_draft', input, { cache: false });
    S.draft = null; render(); showToast('Entwurf in Gmail gespeichert. Abschicken machst du dort.');
    logAct('Antwortentwurf in Gmail gespeichert: ' + subject, null);
  } catch (e) { D.saving = false; render(); showToast(mailErr(e)); }
}

/* ===================== Uni: Text der Folien, Fragen mit Quelle, Lernzettel als PDF ===================== */
// Text jedes Materials liegt in der Sammlung „matpages“ (ein Dokument je Material, Seiten mit Nummer)
function splitPages(text) {
  const parts = String(text || '').split(/\[Folie (\d+)\]/), out = [];
  if (parts.length > 1) { for (let i = 1; i < parts.length; i += 2) { const t = (parts[i + 1] || '').replace(/\s+/g, ' ').trim(); if (t) out.push({ p: Number(parts[i]), t }); } }
  else { const t = String(text || '').replace(/\s+/g, ' ').trim(); for (let i = 0, n = 1; i < t.length; i += 1500, n++) out.push({ p: n, t: t.slice(i, i + 1500), part: 1 }); }
  return out;
}
async function savePages(m, text, fileName) {
  let pages = splitPages(text); if (!pages.length) return false;
  for (let cap = 2500, tot = 110000; cap >= 300; cap = Math.floor(cap / 2), tot = Math.floor(tot / 2)) {
    let sum = 0; const list = [];
    for (const pg of pages) { const t = pg.t.slice(0, cap); if (sum + t.length > tot) break; sum += t.length; list.push({ ...pg, t }); }
    const doc = { title: m.title, subjectId: m.subjectId, file: String(fileName || '').slice(0, 160), byPart: !!(pages[0] && pages[0].part), pages: list };
    try {
      if (db) await db.collection('matpages').doc(m.id).set(doc);
      else { const o = local.read(); o.matpages = o.matpages || {}; o.matpages[m.id] = doc; local.write(o); }
      return true;
    } catch (e) { if (!(e && e.code === 'invalid_argument')) return false; }
  }
  return false;
}
async function loadPages(mid) {
  try { if (db) { const s = await db.collection('matpages').doc(mid).get(); return s.exists ? s.data() : null; } const o = local.read(); return (o.matpages || {})[mid] || null; } catch (e) { return null; }
}
function uniAskCard(x, mats) {
  const A = S.uniAsk && S.uniAsk.sid === x.id ? S.uniAsk : null, withText = mats.filter(m => m.hasPages).length;
  if (!mats.length) return '';
  return '<section class="card"><h2 class="label">In deinen Unterlagen suchen</h2><form class="addrow" data-form="uniask" data-sid="' + esc(x.id) + '"><label class="sr" for="ua-in">Wonach suchst du?</label><input id="ua-in" name="q" data-keep="ua-in" placeholder="z. B. korrigiertes R²" autocomplete="off"' + (withText ? '' : ' disabled') + '><button class="btn primary" type="submit"' + (withText && !(A && A.busy) ? '' : ' disabled') + '>' + (A && A.busy ? 'Suche …' : 'Suchen') + '</button></form>' +
    (!withText ? '<p class="sub" style="margin-top:8px">Dafür braucht Jarvis den Text der Folien. Der wird ab jetzt beim Hochladen gespeichert. Älteres Material bitte einmal neu hochladen.</p>' : withText < mats.length ? '<p class="sub" style="margin-top:8px">' + withText + ' von ' + mats.length + ' Materialien sind durchsuchbar. Älteres Material bitte einmal neu hochladen.</p>' : '') +
    (A && A.hits ? '<div style="margin-top:12px"><p class="sub" style="margin-bottom:6px">' + (A.hits.length ? 'Die besten Stellen zu „' + esc(A.q) + '“:' : 'Keine passende Stelle zu „' + esc(A.q) + '“ gefunden.') + '</p>' +
      A.hits.map(h => '<div class="ans" style="margin-bottom:8px">' + esc(h.t) + '<div class="srcs">' + esc(h.title) + (h.p ? (h.part ? ', Abschnitt ' : ', Folie ') + h.p : '') + '</div></div>').join('') + '</div>' : '') + '</section>';
}
// Ohne KI: Stichwortsuche über den gespeicherten Folientext, zeigt die passendsten Stellen mit Quelle
async function askMaterials(sid, q) {
  if (!q) return;
  S.uniAsk = { sid, q, busy: true }; render();
  try {
    const mats = materials(sid).filter(m => m.hasPages);
    const docs = (await Promise.all(mats.map(m => loadPages(m.id).then(d => d ? { m, d } : null)))).filter(Boolean);
    if (!docs.length) throw { code: 'empty' };
    const STOP = /^(?:was|wie|wer|wann|warum|wieso|welche[rsnm]?|ist|sind|der|die|das|den|dem|des|ein|eine[rnms]?|und|oder|zwischen|unterschied|bei|von|mit|für|im|in|zu|zum|zur|auf|an|es|man)$/;
    const words = Array.from(new Set(q.toLowerCase().replace(/[^a-zäöüß0-9² ]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.test(w))));
    const cand = [];
    docs.forEach(({ m, d }) => (d.pages || []).forEach(pg => { const low = pg.t.toLowerCase(); const hit = words.filter(w => low.includes(w)); const score = hit.length * 10 + words.reduce((s, w) => s + (low.split(w).length - 1), 0); if (hit.length) cand.push({ title: m.title, p: pg.p, part: d.byPart, t: pg.t, score, w: hit[0] }); }));
    cand.sort((a, b) => b.score - a.score);
    const hits = cand.slice(0, 3).map(c => { const i = Math.max(0, c.t.toLowerCase().indexOf(c.w) - 120); return { title: c.title, p: c.p, part: c.part, t: (i > 0 ? '… ' : '') + c.t.slice(i, i + 360).trim() + (i + 360 < c.t.length ? ' …' : '') }; });
    S.uniAsk = { sid, q, hits };
  } catch (e) { S.uniAsk = null; showToast(e && e.code === 'empty' ? 'Kein Text zum Durchsuchen gefunden.' : 'Die Suche ging gerade nicht.'); }
  render();
}
let jspdfP = null;
function loadJsPdf() {
  if (!jspdfP) jspdfP = new Promise((res, rej) => {
    if (window.jspdf) return res(window.jspdf);
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    sc.onload = () => window.jspdf ? res(window.jspdf) : rej(new Error('jspdf')); sc.onerror = () => rej(new Error('jspdf')); document.head.appendChild(sc);
  }).catch(e => { jspdfP = null; throw e; });
  return jspdfP;
}
async function makePdf(sub, mats) {
  if (!mats || !mats.length) return;
  showToast('Lernzettel wird erstellt …');
  try {
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 180, X = 15;
    let y = 18;
    const clean = t => String(t || '').replace(/[^\u0000-ÿ€–—„“”‘’•…]/g, '');
    const line = (t, size, bold, gap, indent) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); const ls = doc.splitTextToSize(clean(t), W - (indent || 0)); ls.forEach(l => { if (y > 282) { doc.addPage(); y = 18; } doc.text(l, X + (indent || 0), y); y += size * 0.45; }); y += gap || 0; };
    line('Lernzettel ' + (sub ? sub.title : ''), 18, true, 2);
    line((mats.length === 1 ? mats[0].title + ' · ' : mats.length + ' Materialien · ') + 'Stand ' + fmtShort(todayISO()) + (sub && sub.examDate ? ' · Klausur ' + fmtShort(sub.examDate) : ''), 10, false, 6);
    for (const m of mats) {
      if (mats.length > 1) line(m.title, 14, true, 2);
      if ((m.summary || []).length) { line('Kurzfassung', 12, true, 1); (m.summary || []).forEach(s => line('•  ' + s, 10, false, 1, 2)); y += 3; }
      if ((m.cards || []).length) { line('Lernkarten', 12, true, 1); (m.cards || []).forEach((c, i) => { line((i + 1) + '. ' + c.q, 10, true, 0.5, 2); line(c.a + (c.p ? '  (Folie ' + c.p + ')' : ''), 10, false, 2.5, 6); }); }
      y += 5;
    }
    const blob = doc.output('blob'), name = 'Lernzettel ' + ((sub ? sub.title + ' ' : '') + (mats.length === 1 ? mats[0].title : '')).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) + '.pdf';
    if (downloads) { try { await downloads.save({ filename: name, data: blob }); } catch (e) { if (e && e.code !== 'declined') showToast('Herunterladen ist hier nicht möglich.'); } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  } catch (e) { showToast('Der PDF-Baustein konnte nicht geladen werden. Bitte später nochmal.'); }
}


