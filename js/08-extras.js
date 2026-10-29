'use strict';
/* Jarvis-App – 08-extras.js (aus Jarvis in Claude, Zeilen 3516–4146 von V48) */
/* ===================== Stufe 6: Suche, Ausgaben, Gedächtnis ===================== */
function pageSearch() {
  const q = S.q.trim().toLowerCase();
  const hl = (txt) => { const s0 = String(txt || ''); if (!q) return esc(s0); const i = s0.toLowerCase().indexOf(q); if (i < 0) return esc(s0.slice(0, 160)); const a = Math.max(0, i - 50); return (a ? '…' : '') + esc(s0.slice(a, i)) + '<mark>' + esc(s0.slice(i, i + q.length)) + '</mark>' + esc(s0.slice(i + q.length, i + q.length + 100)); };
  let hits = [];
  if (q.length >= 2) {
    S.items.forEach(it => {
      const hay = [it.title, it.note, it.place, it.room, it.eventTitle, ...(it.summary || []), ...((it.cards || []).map(c => c.q + ' ' + c.a))].filter(Boolean).join(' \n ');
      if (hay.toLowerCase().includes(q)) hits.push({ it, text: hay });
    });
    S.chat.forEach((m, i) => { if (String(m.text).toLowerCase().includes(q)) hits.push({ chat: m, text: m.text }); });
    S.gcal.forEach(g => { if (g.title.toLowerCase().includes(q)) hits.push({ g, text: g.title }); });
  }
  return '<div class="listpage"><h1 class="page">Suche</h1><form class="addrow" data-form="search" role="search"><label class="sr" for="q-in">Suchbegriff</label><input id="q-in" name="q" data-keep="q" value="' + esc(S.q) + '" placeholder="z. B. Dülmen, Regression, Mathis" autocomplete="off" autofocus><button class="btn primary" type="submit">Suchen</button></form>' +
    '<section class="card">' + (q.length < 2 ? '<p class="empty">Durchsucht Aufgaben, Termine, Notizen, Ideen, Lernmaterial, Trainingsnotizen, das Gespräch und deinen Kalender.</p>' : hits.length ? '<p class="sub">' + hits.length + ' Treffer</p>' + hits.slice(0, 60).map(h => {
      if (h.it) return '<div class="hit">' + (['material', 'subject'].includes(h.it.type) ? '<a href="#uni" data-subj="' + esc(h.it.subjectId || h.it.id) + '" data-go="uni">' : '<a href="#" data-edit="' + esc(h.it.id) + '">') + esc(TYPES[h.it.type] || h.it.type) + ': ' + esc(h.it.title) + '</a><small>' + hl(h.text) + (h.it.date ? ' · ' + esc(fmtShort(h.it.date)) : '') + '</small></div>';
      if (h.chat) return '<div class="hit">Gespräch<small>' + hl(h.text) + '</small></div>';
      return '<div class="hit">Kalender: ' + esc(h.g.title) + '<small>' + esc(fmtShort(h.g.date)) + (h.g.start ? ', ' + esc(h.g.start) : '') + '</small></div>';
    }).join('') : '<p class="empty">Nichts gefunden.</p>') + '</section></div>';
}
const eur = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
// Ausgaben von Hand (type 'expense': title, amount, cat, date) kommen zu den eingespielten Monatssummen dazu
// Steht eine Ausgabe von Hand auch im Finanzguru-Export (gleicher Betrag, bis 4 Tage Abstand), zählt sie nur einmal
function finExportRows(key) {
  const M = (S.finance && S.finance.months) || {}, out = [], d0 = dObj(key + '-15');
  [-1, 0, 1].forEach(o => { const k = isoDate(new Date(d0.getFullYear(), d0.getMonth() + o, 15, 12)).slice(0, 7); ((M[k] && M[k].rows) || []).forEach(([d, c]) => out.push({ iso: k + '-' + pad(d), c, used: false })); });
  return out;
}
function finMonth(key) {
  const base = (S.finance && S.finance.months || {})[key], man = byType('expense').filter(x => (x.date || '').slice(0, 7) === key).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!base && !man.length) return null;
  const m = { out: base ? base.out : 0, in: base ? base.in : 0, cats: { ...(base ? base.cats : {}) }, man, manSum: 0, imported: !!base, dup: new Set() };
  const rows = finExportRows(key);
  man.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(x => { const c = Math.round((Number(x.amount) || 0) * 100), hit = rows.find(r => !r.used && r.c === c && Math.abs(dObj(r.iso) - dObj(x.date)) <= 4 * 864e5); if (hit) { hit.used = true; m.dup.add(x.id); } });
  man.forEach(x => { const a = Number(x.amount) || 0; m.manSum += a; if (m.dup.has(x.id)) return; m.out += a; m.cats[x.cat || 'Sonstiges'] = (m.cats[x.cat || 'Sonstiges'] || 0) + a; });
  m.out = Math.round(m.out * 100) / 100; return m;
}
function finCatList() {
  const c = new Set(['Essen', 'Einkauf', 'Freizeit', 'Fahrt', 'Uni', 'Fußball', 'Sonstiges']);
  Object.values((S.finance && S.finance.months) || {}).forEach(m => Object.keys(m.cats || {}).forEach(k => c.add(k))); byType('expense').forEach(x => x.cat && c.add(x.cat));
  return '<datalist id="fin-cats">' + Array.from(c).slice(0, 60).map(k => '<option value="' + esc(k) + '">').join('') + '</datalist>';
}
function pageFinance() {
  const f = S.finance || {}, months = Array.from(new Set(Object.keys(f.months || {}).concat(byType('expense').map(x => (x.date || '').slice(0, 7)).filter(Boolean)).concat([todayISO().slice(0, 7)]))).sort().reverse();
  const sel = S.finMonth && months.includes(S.finMonth) ? S.finMonth : months[0];
  const m = sel ? finMonth(sel) : null, budget = Number(S.settings.budget || 0);
  const cats = m ? Object.entries(m.cats || {}).sort((a, b) => b[1] - a[1]) : [];
  const max = cats.length ? cats[0][1] : 1;
  const [y, mo] = sel ? sel.split('-') : [];
  return '<div class="listpage" style="max-width:860px"><div class="pagehead" style="margin:0"><div><h1 class="page">Ausgaben</h1></div>' +
    (months.length ? '<label class="field" style="min-width:180px"><span>Monat</span><select data-finmonth="1">' + months.map(k => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + MONL[Number(k.split('-')[1]) - 1] + ' ' + k.split('-')[0] + '</option>').join('') + '</select></label>' : '') + '</div>' +
    (m ? '<div class="stats"><div class="stat"><small>Ausgaben ' + MONL[Number(mo) - 1] + '</small><b>' + eur(m.out) + '</b></div><div class="stat"><small>Einnahmen</small><b>' + eur(m.in) + '</b></div>' + (budget ? '<div class="stat"><small>Budget</small><b><span class="amp ' + (m.out > budget ? 'r' : m.out > budget * 0.85 ? 'y' : 'g') + '"><i></i>' + Math.round(m.out / budget * 100) + ' %</span></b></div>' : '') + '</div>' +
      '<section class="card"><h2 class="label">Nach Kategorie</h2><div class="bars">' + cats.slice(0, 14).map(([c, v]) => '<div class="barrow"><span>' + esc(c) + '</span><span class="track"><i style="width:' + Math.round(v / max * 100) + '%"></i></span><span class="v">' + eur(v) + '</span></div>').join('') + '</div></section>'
      : '<section class="card"><p class="empty">Noch keine Daten.</p></section>') +
    '<section class="card"><h2 class="label">Ausgabe eintragen</h2><form data-form="expense" style="display:flex;flex-direction:column;gap:10px"><div class="formgrid">' +
      '<label class="field"><span>Betrag in €</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" data-keep="ex-amount" placeholder="z. B. 12,50"></label>' +
      '<label class="field"><span>Wofür?</span><input name="title" maxlength="120" autocomplete="off" data-keep="ex-title" placeholder="z. B. Döner"></label>' +
      '<label class="field"><span>Kategorie</span><input name="cat" list="fin-cats" maxlength="40" autocomplete="off" data-keep="ex-cat" placeholder="z. B. Essen">' + finCatList() + '</label>' +
      '<label class="field"><span>Tag</span><input name="date" type="date" max="' + todayISO() + '" value="' + todayISO() + '" data-keep="ex-date"></label></div>' +
      '<div class="row"><button class="btn primary" type="submit">Eintragen</button></div></form>' +
      '<p class="sub" style="margin-top:8px">Für Bargeld und alles, was nicht im Finanzguru-Export steht. Schneller: Schreib Jarvis „12 € Döner“.</p>' +
      (m && m.man.length ? '<h3 class="label" style="margin-top:14px">Von Hand · ' + esc(MONL[Number(sel.split('-')[1]) - 1]) + ' · ' + eur(m.manSum) + '</h3>' + m.man.map(x => '<div class="listrow"><button class="lt" data-edit="' + esc(x.id) + '">' + esc(x.title) + '<small>' + esc(fmtShort(x.date)) + ' · ' + esc(x.cat || 'Sonstiges') + (m.dup.has(x.id) ? ' · steht auch im Export, zählt nur einmal' : '') + '</small></button><span class="mono">' + eur(Number(x.amount) || 0) + '</span><button class="iconbtn" data-del="' + esc(x.id) + '" aria-label="' + esc(x.title) + ' löschen">' + ICON.x + '</button></div>').join('') : '') + '</section>' +
    '<section class="card"><h2 class="label">Export einspielen</h2><p class="sub">Finanzguru → Umsätze → Export (CSV/Excel als CSV). Jarvis liest die Datei hier im Browser und speichert nur die Monatssummen.</p>' +
      '<div class="row" style="margin-top:10px"><label class="btn primary" for="fin-in">CSV-Datei wählen</label><input id="fin-in" type="file" accept=".csv,text/csv,text/plain" class="sr" data-act-change="finance"></div>' +
      '<form class="addrow" data-form="budget" style="margin-top:12px"><label class="sr" for="budget-in">Monatsbudget in Euro</label><input id="budget-in" name="budget" type="number" min="0" step="10" value="' + esc(S.settings.budget || '') + '" placeholder="Monatsbudget in € (optional)"><button class="btn" type="submit">Speichern</button></form></section></div>';
}
function parseCsv(txt) {
  txt = txt.replace(/^\uFEFF/, '');
  const first = txt.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
async function importFinance(file) {
  try {
    const rows = parseCsv(await file.text()); if (rows.length < 2) throw new Error('leer');
    const head = rows[0].map(h => h.toLowerCase().trim());
    const find = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
    const iDate = find('buchungstag', 'buchungsdatum', 'datum', 'date'), iAmt = find('betrag', 'amount', 'umsatz');
    let iCat = find('analyse-hauptkategorie', 'hauptkategorie', 'kategorie', 'category'); if (iCat < 0) iCat = find('unterkategorie');
    if (iDate < 0 || iAmt < 0) throw new Error('spalten');
    const months = { ...((S.finance && S.finance.months) || {}) }, fresh = {};
    for (const r of rows.slice(1)) {
      const ds = (r[iDate] || '').trim(); let iso = null;
      let m = ds.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/); if (m) iso = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(m[2]) + '-' + pad(m[1]);
      m = ds.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) iso = m[0];
      if (!iso) continue;
      const amt = parseFloat(String(r[iAmt] || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (isNaN(amt)) continue;
      const key = iso.slice(0, 7), cat = (iCat >= 0 && r[iCat] ? r[iCat].trim() : 'Sonstiges') || 'Sonstiges';
      const mm = fresh[key] = fresh[key] || { out: 0, in: 0, cats: {}, n: 0, rows: [] };
      if (amt < 0) { mm.out += -amt; mm.cats[cat] = (mm.cats[cat] || 0) + -amt; if (mm.rows.length < 600) mm.rows.push([Number(iso.slice(8)), Math.round(-amt * 100)]); } else mm.in += amt;   // rows: nur Tag + Betrag, für den Abgleich mit Ausgaben von Hand
      mm.n++;
    }
    const keys = Object.keys(fresh); if (!keys.length) throw new Error('nichts');
    keys.forEach(k => { const v = fresh[k]; Object.keys(v.cats).forEach(c => v.cats[c] = Math.round(v.cats[c] * 100) / 100); v.out = Math.round(v.out * 100) / 100; v.in = Math.round(v.in * 100) / 100; months[k] = v; });
    const doc = { months, updatedAt: new Date().toISOString() };
    await store.setMeta('finance', doc); S.finance = doc; S.finMonth = keys.sort().pop();
    showToast(keys.length + (keys.length === 1 ? ' Monat' : ' Monate') + ' übernommen.'); render();
  } catch (e) { showToast(e && e.message === 'spalten' ? 'Datum- oder Betrag-Spalte nicht gefunden. Ist es der Finanzguru-Export als CSV?' : 'Die Datei konnte nicht gelesen werden.'); }
}
const MEM_SRC = { du: 'von dir eingetippt', 'gespräch': 'aus dem Gespräch', mail: 'aus einer Mail' };
function memRow(m) {
  const src = (MEM_SRC[m.source] || 'Herkunft unbekannt') + (m.createdAt ? ' · ' + fmtShort(isoDate(new Date(m.createdAt))) : '');
  return '<div class="listrow"><button class="lt" data-edit="' + esc(m.id) + '">' + esc(m.title) + '<small>' + esc(src) + (m.confirmed === false ? '' : ' · bestätigt') + '</small></button>' +
    (m.confirmed === false ? '<span class="row"><button class="btn sm" data-memok="' + esc(m.id) + '">Stimmt</button><button class="btn ghost sm danger" data-del="' + esc(m.id) + '">Stimmt nicht</button></span>' : '<button class="iconbtn" data-del="' + esc(m.id) + '" aria-label="Löschen">' + ICON.trash + '</button>') + '</div>';
}
function pageMemory() {
  const s = S.settings, all = byType('memory').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const mem = all.filter(m => m.confirmed !== false), guess = all.filter(m => m.confirmed === false);
  const cls = byType('class').length, subs = byType('subject').length;
  return '<div class="listpage"><div><h1 class="page">Gedächtnis</h1></div>' +
    (guess.length ? '<section class="card"><h2 class="label">Vermutet – stimmt das?</h2><p class="sub" style="margin-bottom:6px">Jarvis nutzt diese Punkte erst, wenn du sie bestätigst.</p>' + guess.map(memRow).join('') + '</section>' : '') +
    '<section class="card"><h2 class="label">Über mich</h2>' + (mem.length ? mem.map(memRow).join('') : '<p class="empty">Noch nichts. Zum Beispiel: „Ich lerne am liebsten morgens“ oder „Training ist immer Mi und Fr“.</p>') +
      '<form class="addrow" data-form="memory" style="margin-top:10px"><label class="sr" for="mem-in">Neue Info über dich</label><input id="mem-in" data-keep="mem-in" placeholder="Neue Info, z. B. Ich lerne am liebsten morgens" autocomplete="off"><button class="btn primary" type="submit">Merken</button></form></section>' +
    '<section class="card"><h2 class="label">Aus deinen Einstellungen</h2>' +
      '<div class="listrow"><span class="lt">Anrede<small>' + esc(s.name || '–') + '</small></span><a class="btn ghost" href="#einstellungen" data-go="einstellungen">Ändern</a></div>' +
      '<div class="listrow"><span class="lt">Arbeit<small>' + esc(fmtH(Number(s.workHours ?? 20))) + ' Std./Woche · ' + esc((s.rules || DEFAULT_RULES).slice(0, 140)) + '…</small></span><a class="btn ghost" href="#einstellungen" data-go="einstellungen">Ändern</a></div>' +
      '<div class="listrow"><span class="lt">Wetterort<small>' + esc(s.wxName || '–') + '</small></span><a class="btn ghost" href="#einstellungen" data-go="einstellungen">Ändern</a></div>' +
      '<div class="listrow"><span class="lt">Uni<small>' + subs + ' Fächer · ' + cls + ' Vorlesungen im Stundenplan</small></span><a class="btn ghost" href="#uni" data-go="uni">Ansehen</a></div>' +
    '</section></div>';
}
async function learnGuess(text) {
  const t = text.slice(0, 300), low = t.toLowerCase();
  if (byType('memory').some(m => String(m.title).toLowerCase() === low)) return;
  try { await store.setItem({ id: uid(), type: 'memory', title: t, source: 'gespräch', confirmed: false, createdAt: new Date().toISOString() }); } catch (e) {}
}


/* ===================== Mail aufräumen ===================== */
const MAILCAT = { spam: 'Spam', werbung: 'Werbung', newsletter: 'Newsletter', benachrichtigung: 'Benachrichtigung', wichtig: 'Wichtig' };
function pageMail() {
  const C = S.clean;
  const head = '<div class="pagehead"><div><h1 class="page">Mails</h1></div>' +
    '<div class="row"><label class="field" style="min-width:150px"><span>Zeitraum</span><select data-cleanrange="1">' + [['7d','7 Tage'],['30d','30 Tage'],['90d','90 Tage']].map(([v, l]) => '<option value="' + v + '"' + ((S.cleanRange || '30d') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<button class="btn primary" data-act="cleanscan"' + (C && C.busy || !mcp ? ' disabled' : '') + '>' + (C && C.busy ? esc(C.busy) : 'Werbung & Spam finden') + '</button></div></div>';
  if (!C || !C.list) return head + '<section class="card"><p class="empty">' + (mcp ? 'Tippe auf „Werbung & Spam finden“. Jarvis sortiert deinen Posteingang nach festen Regeln und schlägt vor, was weg kann. Du entscheidest.' : 'Gmail ist hier nicht verfügbar.') + '</p>' + mailBox() + '</section>';
  const groups = ['spam', 'werbung', 'newsletter', 'benachrichtigung', 'wichtig'];
  const sel = C.list.filter(x => x.on).length;
  return head + '<div class="row" style="margin-bottom:14px"><button class="btn danger" data-act="cleantrash"' + (sel ? '' : ' disabled') + '>' + sel + ' in den Papierkorb</button><button class="btn" data-act="cleanspam"' + (sel ? '' : ' disabled') + '>Als Spam melden</button><button class="btn ghost" data-act="cleanall">Alle Werbung/Spam auswählen</button><button class="btn ghost" data-act="cleannone">Auswahl leeren</button></div><p class="sub" style="margin:-4px 0 14px">Gelöscht wird nur, was du auswählst. Es landet im Gmail-Papierkorb und ist dort 30 Tage wiederherstellbar.</p>' +
    groups.map(g => { const items = C.list.filter(x => x.cat === g); if (!items.length) return ''; return '<section class="card" style="margin-bottom:14px"><h2 class="label">' + MAILCAT[g] + ' (' + items.length + ')</h2>' +
      items.map(x => '<label class="pick"><input type="checkbox" data-cleani="' + C.list.indexOf(x) + '"' + (x.on ? ' checked' : '') + '><span style="min-width:0;overflow-wrap:anywhere">' + esc(x.subject) + '<br><small class="sub">' + esc(x.from) + (x.why ? ' · ' + esc(x.why) : '') + (x.count > 1 ? ' · ' + x.count + ' Mails' : '') + '</small></span></label>').join('') + '</section>'; }).join('');
}
// Ohne KI: feste Regeln (Gmail-Kategorien, Absender, Stichwörter, deine gemerkten Absender). Im Zweifel nicht Werbung/Spam.
const SPAM_RE = /gewonnen|gewinner|gewinnspiel-?sieger|erbschaft|lotterie|millionen? (?:euro|dollar)|bitcoin-?gewinn|krypto-?gewinn|sie wurden ausgewählt|dringende? überweisung/;
function cleanCat(t) {
  const L = t.labels || [], a = mailAddr(t.from), R = mailRules(), text = (t.subject + ' ' + t.snippet).toLowerCase();
  if (mailRuleHit(R.imp, a)) return ['wichtig', 'deine Regel: wichtig'];
  if (L.includes('SPAM') || SPAM_RE.test(text)) return ['spam', L.includes('SPAM') ? 'Gmail: Spam' : 'typische Spam-Wörter'];
  if (mailRuleHit(R.un, a)) return ['werbung', 'deine Regel: unwichtig'];
  const c = mailClassify(t);
  if (c.imp) return ['wichtig', c.why];
  if (L.includes('CATEGORY_PROMOTIONS') || c.kind === 'Werbung') return ['werbung', L.includes('CATEGORY_PROMOTIONS') ? 'Gmail: Werbung' : c.why];
  if (c.kind === 'Newsletter' || L.includes('CATEGORY_FORUMS')) return ['newsletter', c.why];
  return ['benachrichtigung', c.why];
}
async function cleanScan() {
  if (!mcp) return;
  S.clean = { busy: 'Lese Posteingang …', list: null }; render();
  try {
    const range = S.cleanRange || '30d';
    const threads = await gmailThreads('in:inbox newer_than:' + range, 50);
    if (!threads.length) { S.clean = { list: [] }; showToast('Keine Mails im Zeitraum.'); render(); return; }
    S.clean = { list: threads.filter(t => siriSubj(t.subject) == null).map(t => { const [cat, why] = cleanCat(t); return { ...t, cat, why: String(why || '').slice(0, 60), on: cat === 'spam' || cat === 'werbung' }; }) };
  } catch (e) {
    S.clean = null;
    showToast(e && ['not_granted', 'server_not_connected', 'consent_required', 'needs_reauth'].includes(e.code) ? 'Gmail ist nicht verbunden. Bitte neu mit Google anmelden.' : 'Mails konnten gerade nicht gelesen werden.');
  }
  render();
}
async function cleanApply(mode) {
  const C = S.clean; if (!C || !C.list) return;
  const chosen = C.list.filter(x => x.on); if (!chosen.length) return;
  const tool = mode === 'spam' ? 'mark_thread_spam' : 'trash_thread';
  C.busy = (mode === 'spam' ? 'Melde als Spam' : 'Verschiebe in den Papierkorb') + ' …'; render();
  const done = [];
  for (const t of chosen) { try { await mcp.callTool(GMAIL, tool, { threadId: t.id }, { cache: false }); done.push(t); } catch (e) { /* einzelne Fehler überspringen */ } }
  C.list = C.list.filter(x => !done.includes(x)); C.busy = '';
  render();
  if (done.length) logAct(done.length + (done.length === 1 ? ' Mail ' : ' Mails ') + (mode === 'spam' ? 'als Spam gemeldet' : 'in den Gmail-Papierkorb gelegt') + ': ' + done.slice(0, 5).map(t => t.subject).join(', ') + (done.length > 5 ? ' …' : ''), mode === 'spam' ? null : { untrash: done.map(t => t.id) });
  if (mode === 'spam') showToast(done.length + ' als Spam gemeldet.');
  else showToast(done.length + ' in den Papierkorb verschoben.', async () => { for (const t of done) { try { await mcp.callTool(GMAIL, 'untrash_thread', { threadId: t.id }, { cache: false }); } catch (e) {} } C.list = done.concat(C.list); render(); showToast('Wiederhergestellt.'); });
}

/* ===================== Stundenplan-Import (LSF) ===================== */
function parseIcsEvents(txt) {
  const lines = txt.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let cur = null;
  const unesc = v => v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
  const dt = v => { const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null; if (m[4] && m[7]) { const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])); return { date: isoDate(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) }; } return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] ? m[4] + ':' + m[5] : null }; };
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = { exdates: [] };
    else if (l === 'END:VEVENT') { if (cur && cur.summary && cur.start) out.push(cur); cur = null; }
    else if (cur) {
      const i = l.indexOf(':'); if (i < 0) continue; const key = l.slice(0, i).split(';')[0].toUpperCase(), val = l.slice(i + 1);
      if (key === 'SUMMARY') cur.summary = unesc(val).slice(0, 160);
      if (key === 'LOCATION') cur.location = unesc(val).slice(0, 120);
      if (key === 'DTSTART') cur.start = dt(val);
      if (key === 'DTEND') cur.end = dt(val);
      if (key === 'RRULE') { cur.rrule = val; const u = val.match(/UNTIL=(\d{8})/); if (u) cur.until = u[1].slice(0, 4) + '-' + u[1].slice(4, 6) + '-' + u[1].slice(6, 8); }
      if (key === 'EXDATE') val.split(',').forEach(x => { const d = dt(x); if (d) cur.exdates.push(d.date); });
    }
  }
  return out;
}
// Einzeltermine (LSF exportiert oft jeden Termin einzeln) zu wöchentlichen Vorlesungen zusammenfassen
function icsToClasses(evs) {
  const groups = new Map();
  for (const e of evs) {
    if (!e.start || !e.start.time) continue;
    const wd = dow(e.start.date), key = e.summary + '|' + wd + '|' + e.start.time + '|' + (e.end && e.end.time || '');
    const g = groups.get(key) || { title: e.summary, weekday: wd, start: e.start.time, end: e.end && e.end.time || '', room: e.location || '', dates: [], until: null, skip: [] };
    g.dates.push(e.start.date); if (e.until && (!g.until || e.until > g.until)) g.until = e.until; g.skip.push(...e.exdates); if (!g.room && e.location) g.room = e.location;
    groups.set(key, g);
  }
  return Array.from(groups.values()).map(g => {
    g.dates.sort(); const from = g.dates[0]; let until = g.until || g.dates[g.dates.length - 1];
    if (g.dates.length > 1 && !g.until) { let d = from; let n = 0; while (d < until && n++ < 60) { if (!g.dates.includes(d)) g.skip.push(d); d = addDays(d, 7); } }
    return { title: g.title, weekday: g.weekday, start: g.start, end: g.end || addMin(g.start, 90), room: g.room, from, until, skip: Array.from(new Set(g.skip)).sort(), on: true, n: g.dates.length };
  }).filter(c => c.until >= todayISO() || c.n > 1).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}
const addMin = (hm, m) => { const t = hmToMin(hm) + m; return pad(Math.min(23, Math.floor(t / 60))) + ':' + pad(t % 60); };
async function importTimetable(file) {
  try {
    let list = [];
    if (/\.ics$/i.test(file.name) || /calendar/.test(file.type)) list = icsToClasses(parseIcsEvents(await file.text()));
    else { showToast('Ohne KI kann Jarvis nur die iCal-Datei (.ics) aus dem LSF lesen. Im LSF: Stundenplan öffnen, dann „iCalendar-Export“.', 9000); return; }
    const known = new Set(byType('class').map(c => c.title + '|' + c.weekday + '|' + c.start));
    list = list.filter(c => !known.has(c.title + '|' + c.weekday + '|' + c.start));
    S.matBusy = '';
    if (!list.length) { showToast('Keine neuen Veranstaltungen gefunden.'); render(); return; }
    S.ttImport = list; render();
  } catch (e) { S.matBusy = ''; showToast(e && e.code === 'image_rejected' ? 'Das Bild konnte nicht gelesen werden.' : 'Der Stundenplan konnte nicht gelesen werden.'); render(); }
}
function ttSheet() {
  const L = S.ttImport;
  return '<div class="overlay" data-close="ttImport"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="tt-h"><h2 id="tt-h">Stundenplan übernehmen</h2><p class="sub">' + L.length + ' Veranstaltungen erkannt. Haken entfernen, was du nicht besuchst. Sie werden als wöchentliche Termine bis Semesterende auch in deinen Kalender eingetragen.</p><div class="ics-pick">' +
    L.map((c, i) => '<label class="pick"><input type="checkbox" data-tti="' + i + '"' + (c.on ? ' checked' : '') + '><span>' + esc(c.title) + '<br><small class="sub">' + esc(WD[c.weekday % 7]) + ' ' + esc(c.start) + '–' + esc(c.end) + (c.room ? ' · ' + esc(c.room) : '') + (c.until ? ' · bis ' + esc(fmtShort(c.until)) : '') + '</small></span></label>').join('') +
    '</div><label class="field"><span>Semesterende (falls nicht erkannt)</span><input type="date" data-ttuntil="1" value="' + esc(S.ttUntil || '') + '"></label><div class="row actions"><button class="btn ghost" data-act="ttcancel">Abbrechen</button><button class="btn primary" data-act="ttok">' + L.filter(c => c.on).length + ' übernehmen</button></div></div></div>';
}
async function applyTimetable() {
  const ts = new Date().toISOString(); let n = 0;
  for (const c of S.ttImport.filter(x => x.on)) {
    const it = { id: uid(), type: 'class', title: c.title, weekday: c.weekday, start: c.start, end: c.end, createdAt: ts };
    if (c.room) it.room = c.room; if (c.from) it.from = c.from; if (c.until || S.ttUntil) it.until = c.until || S.ttUntil; if (c.skip && c.skip.length) it.skip = c.skip;
    await store.setItem(it); calSync(it); n++;
  }
  S.ttImport = null; render(); showToast(n + ' Veranstaltungen übernommen.');
}


/* ===================== Sprechen ===================== */
let recog = null;
function speak(text) {
  try {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#•]/g, ' ').slice(0, 600));
    u.lang = 'de-DE';
    const v = speechSynthesis.getVoices().find(x => /^de/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* Vorlesen ist optional */ }
}
let micBlocked = false; try { micBlocked = localStorage.getItem('jarvis-mic-blocked') === '1'; } catch (e) {}
function micHint(k) {
  micBlocked = true; try { localStorage.setItem('jarvis-mic-blocked', '1'); } catch (e) {}
  const ua = navigator.userAgent || '', touch = matchMedia('(pointer: coarse)').matches;
  const mac = /Mac/.test(navigator.platform || ua) && !touch, win = /Win/.test(navigator.platform || ua);
  const how = mac ? 'Drücke zweimal kurz die fn-Taste (ganz unten links auf der Tastatur), sprich und tippe dann auf Senden. Passiert nichts: Systemeinstellungen → Tastatur → Diktieren einschalten.'
    : win ? 'Drücke Windows-Taste + H und sprich.'
    : 'Tippe auf das Mikrofon deiner Tastatur und sprich.';
  showToast(touch ? 'Hier geht nur das Diktieren der Tastatur: unten rechts auf 🎤 tippen.' : 'Die Spracheingabe geht in diesem Browser nicht. Der Cursor steht jetzt im Feld: ' + how, touch ? 4000 : 9000);
  const ta = (k && document.getElementById('ask-' + k)) || document.querySelector('.composer textarea:not([disabled])'); if (ta && ta.offsetParent) ta.focus();
}
function toggleMic(k) {
  if (S.listening && recog) { try { recog.stop(); } catch (e) {} return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || micBlocked) { micHint(k); return; }
  const ta = document.getElementById('ask-' + k); if (!ta) return;
  let finalText = '', gotFinal = false;
  try {
    recog = new SR(); recog.lang = 'de-DE'; recog.interimResults = true; recog.continuous = false; recog.maxAlternatives = 1;
    recog.onresult = (e) => { let t = ''; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) gotFinal = true; } finalText = t; const el = document.getElementById('ask-' + k); if (el) { el.value = t; autosize(); } };
    recog.onerror = (e) => { if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) micHint(k); else if (e.error === 'no-speech') showToast('Nichts gehört. Nochmal tippen und sprechen.'); else if (e.error !== 'aborted') micHint(k); };
    recog.onend = () => { S.listening = false; recog = null; render(); if (gotFinal && finalText.trim() && S.settings.voiceAutoSend !== false) ask(finalText, { voice: true }); else if (finalText.trim()) { const el = document.getElementById('ask-' + k); if (el) { el.value = finalText; el.focus(); } } };
    recog.start(); S.listening = true; render();
  } catch (e) { S.listening = false; micHint(k); }
}

/* ===================== Berichte → Meldungen ===================== */
// Die alten Berichte liefen als Claude-Zeitpläne. In der App gibt es dafür Meldungen aufs Handy (js/push.js, Thread „Meldungen“).
function pageReports() {
  if (typeof pageMeldungen === 'function') return pageMeldungen();
  return '<div class="listpage"><div><h1 class="page">Meldungen</h1></div><section class="card"><p class="empty">Hier stellst du bald Morgenbericht, Abendrückblick und Wochenplanung als Meldung aufs Handy ein.</p></section></div>';
}

/* ===================== Siri-Eingang über Gmail ===================== */
let siriBusy = false;
// Betreff „Jarvis“ allein oder „Jarvis | …“, „Jarvis: …“, „Jarvis - …“, „Jarvis …“ → Rest des Betreffs (oder '' bei nur „Jarvis“), sonst null
function siriSubj(subj) {
  const word = String((S.settings && S.settings.siriWord) || 'Jarvis').trim(), s0 = String(subj || '').trim();
  if (!word || s0.slice(0, word.length).toLowerCase() !== word.toLowerCase()) return null;
  const rest = s0.slice(word.length);
  if (!rest.trim()) return '';
  return /^\s*[|:–—-]|^\s/.test(rest) ? rest.replace(/^\s*[|:–—-]?\s*/, '').trim() : null;
}
async function checkSiriInbox(manual) {
  if (!mcp || !db || siriBusy || S.settings.siri === false || S.siriDone === null) { if (manual && S.siriDone === null) showToast('Noch nicht bereit, gleich nochmal.'); return; }
  siriBusy = true;
  try {
    const word = (S.settings.siriWord || 'Jarvis').replace(/"/g, '');
    const r = await mcp.callTool(GMAIL, 'search_threads', { query: 'subject:"' + word + '" newer_than:14d -in:trash -in:spam', pageSize: 20, view: 'THREAD_VIEW_MINIMAL' }, { cache: false });
    const subjOf = t => String(((t.messages || [])[0] || {}).subject || '').trim(), fix = !S.siriFix1;
    // Einmalig: früher übersprungene „Jarvis | …“-Mails nachholen
    const threads = ((r && r.payload && r.payload.threads) || []).filter(t => t.id && (!S.siriDone.includes(t.id) || (fix && siriSubj(subjOf(t)))));
    let n = 0; const done = S.siriDone.slice(), newNotes = [], trashed = [];
    for (const t of threads) {
      const rest = siriSubj(subjOf(t));
      if (rest === null) { if (!done.includes(t.id)) done.push(t.id); continue; }   // Betreff beginnt nicht mit „Jarvis“
      let text = '';
      try {
        const g = await mcp.callTool(GMAIL, 'get_thread', { threadId: t.id, messageFormat: 'PLAIN_TEXT' }, { cache: false });
        const ms = (g && g.payload && g.payload.messages) || [];
        text = ms.map(m => m.plaintextBody || m.plaintext_body || m.snippet || '').join('\n');
      } catch (e) { text = ((t.messages || [])[0] || {}).snippet || ''; }
      text = text.replace(/\r/g, '').split(/\n-- ?\n|\nVon meinem i(Phone|Pad) gesendet|\nGesendet von meinem i(Phone|Pad)|\nSent from my i(Phone|Pad)/)[0].replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
      if (rest && !text.toLowerCase().includes(rest.toLowerCase())) text = (rest + (text ? '\n' + text : '')).slice(0, 2000);
      if (text) { const nid = uid(); await store.setItem({ id: nid, type: 'note', title: text, source: 'siri', createdAt: new Date().toISOString() }); newNotes.push(nid); n++; }
      if (!done.includes(t.id)) done.push(t.id);
      if (S.settings.siriTrash !== false) { try { await mcp.callTool(GMAIL, 'trash_thread', { threadId: t.id }, { cache: false }); trashed.push(t.id); } catch (e) {} }
    }
    if (done.length !== S.siriDone.length || fix) { S.siriDone = done.slice(-300); S.siriFix1 = true; await db.doc('meta/siri').set({ done: S.siriDone, fix1: true }); }
    if (n) logAct((n === 1 ? '1 Siri-Notiz' : n + ' Siri-Notizen') + ' in den Eingangskorb gelegt' + (trashed.length ? ', Mail danach in den Gmail-Papierkorb' : ''), { created: newNotes, untrash: trashed });
    if (n) showToast(n === 1 ? '1 Siri-Notiz übernommen.' : n + ' Siri-Notizen übernommen.');
    else if (manual) showToast('Keine neuen Siri-Notizen.');
  } catch (e) { if (manual) showToast('Gmail gerade nicht erreichbar.'); }
  siriBusy = false;
}


/* ===================== Wiederholungen ===================== */
const REPEATS = [['', 'nie'], ['daily', 'täglich'], ['weekdays', 'werktags (Mo–Fr)'], ['weekly', 'wöchentlich'], ['biweekly', 'alle 2 Wochen'], ['monthly', 'monatlich']];
function nextDate(d, rep) {
  if (rep === 'daily') return addDays(d, 1);
  if (rep === 'weekdays') { let n = addDays(d, 1); while (dow(n) > 5) n = addDays(n, 1); return n; }
  if (rep === 'weekly') return addDays(d, 7);
  if (rep === 'biweekly') return addDays(d, 14);
  if (rep === 'monthly') { const x = dObj(d), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + 1); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return isoDate(x); }
  return null;
}
function nextRepeat(it) {
  if (it.repeatDays) {   // Haushalt: nächster Termin X Tage nach dem Erledigen
    const nx = { id: uid(), type: 'task', title: it.title, date: addDays(todayISO(), Math.max(1, Number(it.repeatDays))), repeatDays: Number(it.repeatDays), done: false, createdAt: new Date().toISOString() };
    if (it.chore) nx.chore = true; if (it.area) nx.area = it.area; if (it.note) nx.note = it.note; return nx;
  }
  const base = it.date || todayISO(); let nd = nextDate(base, it.repeat); if (!nd) return null;
  while (nd < todayISO()) nd = nextDate(nd, it.repeat);   // überfällige Serien nicht nachholen
  const nx = { id: uid(), type: 'task', title: it.title, date: nd, repeat: it.repeat, done: false, createdAt: new Date().toISOString() };
  if (it.area) nx.area = it.area; if (it.note) nx.note = it.note;
  if (it.remindAt) nx.remindAt = nd + it.remindAt.slice(10);
  return nx;
}
const childrenOf = id => byType('task').filter(x => x.parentId === id);

/* ===================== Top 3 ===================== */
function topSection(taskRow) {
  const t = todayISO(), top = openTasks().filter(x => x.topDate === t), doneTop = byType('task').filter(x => x.done && x.topDate === t);
  if (!top.length && !doneTop.length && !openTasks().length) return '';
  return '<section class="card" aria-labelledby="h-top"><div class="row" style="justify-content:space-between"><h2 class="label" id="h-top" style="margin:0">Top 3 für heute</h2>' + (top.length < 3 && openTasks().some(x => x.topDate !== t) ? '<button class="btn ghost" data-act="topauto">Automatisch wählen</button>' : '') + '</div>' +
    (top.length || doneTop.length ? top.concat(doneTop).map(taskRow).join('') : '<p class="empty">Markiere bis zu drei Aufgaben mit ☆ – das sind die, die heute wirklich zählen.</p>') + '</section>';
}
async function toggleTop(id) {
  const it = S.items.find(i => i.id === id); if (!it) return; const t = todayISO();
  if (it.topDate === t) { const c = { ...it }; delete c.topDate; await store.setItem(c); return; }
  if (openTasks().filter(x => x.topDate === t).length >= 3) { showToast('Schon drei Top-Aufgaben. Erst eine entfernen.'); return; }
  await store.setItem({ ...it, topDate: t });
}
// Top 3 ohne KI: Überfälliges, dann heute dran, dann dringend, dann nach Frist. Ohne Frist zuletzt.
function topRank(x, t) {
  const pr = { hoch: 0, normal: 1, niedrig: 2 }[x.prio || 'normal'] ?? 1;
  const r = x.date && x.date < t ? 0 : (x.date === t || (x.doDate && x.doDate <= t)) ? 1 : x.prio === 'hoch' ? 2 : x.date && x.date <= addDays(t, 3) ? 3 : x.date ? 4 : 5;
  return [r, pr, x.date || '9999', x.createdAt || ''];
}
async function topAuto() {
  const t = todayISO(), have = openTasks().filter(x => x.topDate === t), free = 3 - have.length;
  const cand = openTasks().filter(x => x.topDate !== t);
  if (!cand.length || free <= 0) return;
  const cmp = (a, b) => { const A = topRank(a, t), B = topRank(b, t); for (let i = 0; i < A.length; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; };
  const pick = cand.slice().sort(cmp).slice(0, free);
  for (const it of pick) await store.setItem({ ...it, topDate: t });
  if (pick.length) { logAct('Top 3 gewählt: ' + pick.map(x => x.title).join(', '), { restore: pick }); showToast('Gewählt nach Frist und Dringlichkeit. Mit ☆ kannst du tauschen.'); }
  render();
}

/* ===================== Große Aufgaben zerlegen ===================== */
// Ohne KI: passende Vorlage nach Stichwort, Teilfristen gleichmäßig bis zur Frist verteilt. Im Bestätigen-Fenster änderbar.
const STEP_TPL = [
  [/hausarbeit|seminararbeit|bachelorarbeit|masterarbeit|abschlussarbeit|essay|ausarbeitung|projektarbeit|bericht/, [['Thema und Fragestellung festlegen', 45], ['Literatur suchen und sichten', 120], ['Gliederung schreiben', 60], ['Hauptteil schreiben', 240], ['Einleitung und Schluss schreiben', 90], ['Korrektur lesen, Quellen prüfen', 90], ['Abgeben', 15]]],
  [/referat|präsentation|vortrag|folien|pitch/, [['Thema eingrenzen und Material sammeln', 60], ['Gliederung erstellen', 45], ['Folien bauen', 120], ['Vortrag einmal laut üben', 45], ['Letzter Feinschliff', 30]]],
  [/klausur|prüfung|examen|test\b|lernen für/, [['Stoff sammeln und Überblick machen', 60], ['Themen auf Lerntage verteilen', 25], ['Erste Runde: alles durcharbeiten', 180], ['Übungsaufgaben und Altklausuren', 120], ['Schwache Themen wiederholen', 90], ['Letzte Wiederholung', 60]]],
  [/übungsblatt|aufgabenblatt|hausaufgabe|abgabe|übung\b/, [['Aufgaben lesen, Unterlagen raussuchen', 25], ['Erste Hälfte lösen', 60], ['Rest lösen', 60], ['Kontrollieren und abgeben', 25]]],
  [/bewerbung|bewerben/, [['Stellenanzeige genau lesen', 15], ['Lebenslauf aktualisieren', 45], ['Anschreiben schreiben', 60], ['Unterlagen gegenlesen lassen', 15], ['Abschicken', 10]]],
  [/umzug|umziehen/, [['Termin und Helfer klären', 30], ['Kartons und Material besorgen', 45], ['Ummelden, Verträge umstellen', 60], ['Packen', 240], ['Umzugstag', 480], ['Auspacken', 180]]],
  [/steuer/, [['Belege sammeln', 60], ['Daten in ELSTER eintragen', 90], ['Prüfen und abschicken', 30]]],
  [/geburtstag|party|feier|grillen/, [['Gästeliste machen', 15], ['Einladen', 15], ['Essen und Getränke planen', 30], ['Einkaufen', 60], ['Vorbereiten', 90]]],
  [/training|turnier|saison|elternabend/, [['Ziel festlegen', 15], ['Übungen und Inhalte raussuchen', 30], ['Ablauf planen', 30], ['Material vorbereiten', 15]]],
  [/aufräumen|putzen|ausmisten|keller|zimmer/, [['Bereich festlegen', 5], ['Aussortieren', 60], ['Sauber machen', 60], ['Wegbringen, was weg kann', 30]]],
  [/reise|urlaub|ausflug/, [['Ziel und Termin festlegen', 30], ['Anreise und Unterkunft buchen', 60], ['Packliste machen', 15], ['Packen', 45]]]];
const STEP_DEF = [['Überblick verschaffen und anfangen', 30], ['Hauptteil erledigen', 90], ['Prüfen und abschließen', 30]];
function stepTemplate(title, note) { const s = (String(title || '') + ' ' + String(note || '')).toLowerCase(); const hit = STEP_TPL.find(([re]) => re.test(s)); return (hit ? hit[1] : STEP_DEF).map(([title, est]) => ({ title, est })); }
async function splitTask(it) {
  if (!it) return;
  const t = todayISO(), until = it.date && it.date > t ? it.date : addDays(t, 14);
  const tpl = stepTemplate(it.title, it.note), n = tpl.length, span = Math.max(0, Math.round((dObj(until) - dObj(t)) / 864e5));
  const steps = tpl.map((x, k) => { const s = { type: 'task', title: x.title, date: k === n - 1 ? until : addDays(t, Math.round((k + 1) * span / n)), area: it.area || null, parentId: it.id }; const e = ESTS.find(m => m >= x.est); if (e) s.est = String(e); return s; });
  S.editing = null;
  S.pending = { text: 'Zerlegen: ' + it.title, reply: 'Vorschlag nach Vorlage für „' + it.title + '“. Ändere Schritte und Tage, wie es für dich passt:', items: steps, fromNote: null };
  render();
}
// Schritte für ein Projekt (ohne Tage), gleiche Form wie früher die KI-Antwort: [{ title, est }]
function projectStepsLocal(p) {
  const have = new Set(projSteps(p.id).map(x => String(x.title).toLowerCase()));
  return stepTemplate(p.title, p.note).filter(x => !have.has(x.title.toLowerCase()));
}

/* ===================== Woche planen ohne KI (für 05: planWork / planStudy) ===================== */
const WD_NAMES = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
// Freie Zeit eines Tages im Fenster [s, e], ohne die eigenen Arbeitsblöcke (die ersetzt ein neuer Vorschlag) und ohne schon Vergebenes
function workFree(d, win, taken) {
  let slots = [{ s: win.s, e: win.e }];
  if (d === todayISO()) slots[0].s = Math.max(win.s, Math.ceil((hmToMin(nowHM()) + 15) / 15) * 15);
  busyOn(d).filter(x => !(x.b.kind === 'work')).map(x => ({ s: x.s, e: x.e })).concat(taken || []).forEach(x => { slots = slots.flatMap(sl => x.e <= sl.s || x.s >= sl.e ? [sl] : [{ s: sl.s, e: x.s }, { s: x.e, e: sl.e }].filter(z => z.e - z.s >= 15)); });
  return slots.map(z => ({ s: Math.ceil(z.s / 15) * 15, e: Math.floor(z.e / 15) * 15 })).filter(z => z.e - z.s >= 15);
}
function planWorkLocal(mon, target) {
  const rules = String(S.settings.rules || DEFAULT_RULES).toLowerCase(), t = todayISO();
  const hm = re => { const m = rules.match(re); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; };
  const win = { s: hm(/frühestens\s+(?:um\s+|ab\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr/) ?? 420, e: hm(/spätestens\s+(?:um\s+|bis\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr/) ?? 1140 };
  const short = WD_NAMES.filter(n => new RegExp(n + '\\w*\\s+(?:ist\\s+)?(?:ein\\s+|immer\\s+)?kurze[rn]?\\s+tag').test(rules));
  const days = weekDays(mon).filter(d => d >= t && workDays().includes(dow(d)) && !offOn(d) && !holidayOn(d));
  if (!days.length) return { blocks: [], note: 'In dieser Woche ist kein Arbeitstag mehr frei.' };
  const w = d => short.includes(WD_NAMES[dObj(d).getDay()]) ? 0.5 : 1, ws = days.reduce((s, d) => s + w(d), 0);
  let left = Math.round(target * 4) * 15; const blocks = [], taken = {}, done = {};
  const place = (d, need) => {
    let got = 0;
    for (const sl of workFree(d, win, taken[d])) {
      let cur = sl.s;
      while (need - got >= 15 && sl.e - cur >= 45) {
        const len = Math.floor(Math.min(need - got, 300, sl.e - cur, 600 - (done[d] || 0)) / 15) * 15; if (len < 15) break;
        blocks.push({ date: d, start: minToHM(cur), end: minToHM(cur + len), place: 'Homeoffice', on: true });
        (taken[d] = taken[d] || []).push({ s: cur, e: cur + len + 30 });
        done[d] = (done[d] || 0) + len; got += len; cur += len + ((done[d] || 0) >= 480 ? 45 : 30);   // gesetzliche Pause zwischen langen Blöcken
      }
    }
    return got;
  };
  const total = left;
  days.forEach(d => { left -= place(d, Math.round(total * w(d) / ws / 15) * 15); });
  for (const d of days) { if (left < 15) break; left -= place(d, left); }   // Rest dort, wo noch Platz ist
  blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { blocks, note: 'Fester Rechenweg: ' + fmtH(total / 60) + ' Std. auf ' + days.length + (days.length === 1 ? ' Arbeitstag' : ' Arbeitstage') + ' verteilt, zwischen ' + minToHM(win.s) + ' und ' + minToHM(win.e) + ' Uhr, mit Pausen.' + (short.length ? ' ' + cap1(short.join(' und ')) + ' kürzer.' : '') + (left >= 15 ? ' ' + fmtH(left / 60) + ' Std. passen nicht mehr rein.' : '') + ' Ort bitte prüfen.' };
}
function planStudyLocal(cand, from) {
  const blocks = [], extra = {}, per = {};
  cand.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(x => {
    for (let d = from; d <= x.date && d <= addDays(from, 13); d = addDays(d, 1)) {
      if ((per[d] || 0) >= 2) continue;
      const sl = freeSlotsOn(d, { extra }).find(z => z.e - z.s >= 60 && z.s >= 480 && z.s <= 1200);
      if (!sl) continue;
      const len = Math.min(90, Math.floor((Math.min(sl.e, 1260) - sl.s) / 15) * 15); if (len < 60) continue;
      blocks.push({ taskId: x.id, title: 'Block: ' + x.title, date: d, start: minToHM(sl.s), end: minToHM(sl.s + len) });
      (extra[d] = extra[d] || []).push({ s: sl.s - 15, e: sl.s + len + 15 }); per[d] = (per[d] || 0) + 1;
      break;
    }
  });
  return { blocks };
}

/* ===================== Lernplan rückwärts ===================== */
// Rechnet von der Prüfung rückwärts: die Lernzeit wird über die Wochen davor verteilt, zur Prüfung hin dichter,
// die letzten Blöcke sind zum Wiederholen. Fester Rechenweg (keine KI), dieselben freien Lücken wie „Zeit einplanen“.
const examLeadOf = x => (typeof examLead === 'function' ? examLead(x) : x) || x;
const examTitle = x => { const l = examLeadOf(x); return typeof examName === 'function' ? examName(l) : l.title; };
const examKindWord = x => ({ hausarbeit: 'Abgabe', portfolio: 'Abgabe', muendlich: 'Prüfung', referat: 'Präsentation' })[examLeadOf(x).examKind] || 'Klausur';
const studyBlocks = sid => byType('event').filter(e => e.examPlan === sid).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
// Freie Lücken so, als gäbe es die Lernblöcke, die ersetzt werden, schon nicht mehr
function studySlots(d, extra, ign) {
  if (!ign.size) return freeSlotsOn(d, { extra });
  const keep = S.items; S.items = S.items.filter(i => !ign.has(i.id));
  try { return freeSlotsOn(d, { extra }); } finally { S.items = keep; }
}
function openStudyPlan(id) {
  const x = S.items.find(i => i.id === id); if (!x) return;
  const l = examLeadOf(x), t = todayISO();
  if (!l.examDate || l.examDate <= t) { showToast('Trag zuerst einen Prüfungstermin ein.'); return; }
  const fut = studyBlocks(l.id).filter(e => e.date >= t), sp = l.studyPlan || {};
  const left = fut.reduce((s, e) => s + durH(e.start, e.end), 0);
  let from = fut.length ? t : addDays(l.examDate, -28); if (from < t) from = t;
  S.examPlan = { sid: l.id, hours: fut.length ? Math.max(1, Math.round(left * 2) / 2) : Number(sp.hours) || 20, from, replace: fut.map(e => e.id), list: [] };
  runStudyPlan(); render();
}
function runStudyPlan() {
  const P = S.examPlan, l = P && S.items.find(i => i.id === P.sid); if (!l) return;
  const c = planCfg(), t = todayISO(), ign = new Set(P.replace || []);
  const maxB = Math.max(15, Number(c.maxBlock) || 90), minB = Math.min(Number(c.minBlock) || 45, maxB), maxDay = Number(c.maxDay) || 180, buf = Number(c.buffer) || 0;
  const total = Math.max(15, Math.round(P.hours * 4) * 15), end = addDays(l.examDate, -1);
  const days = []; for (let d = P.from < t ? t : P.from, g = 0; d <= end && g < 140; d = addDays(d, 1), g++) days.push(d);
  const n = days.length, used = {}, extra = {}, blocks = [];
  days.forEach(d => { used[d] = byType('event').filter(e => (e.planned || e.examPlan) && !ign.has(e.id) && e.date === d).reduce((s, e) => s + durH(e.start, e.end) * 60, 0); });
  // Gewicht je Tag: letzte Woche doppelt, Woche davor anderthalbfach
  const wt = days.map(d => { const k = daysUntil(l.examDate) - daysUntil(d); return k <= 7 ? 2 : k <= 14 ? 1.5 : 1; });
  const cum = []; wt.reduce((a, w, i) => (cum[i] = a + w), 0); const W = cum[n - 1] || 0;
  const nB = Math.max(1, Math.ceil(total / maxB));
  let left = total;
  for (let k = 0; n && left > 0 && k < nB * 3; k++) {
    // Wunschtag: gleichmäßig über das Gewicht verteilt, dann abwechselnd früher und später suchen
    const target = Math.min(W, (k % nB + 0.5) * W / nB); let ti = cum.findIndex(v => v >= target); if (ti < 0) ti = n - 1;
    let ok = false;
    for (let o = 0; o < n && !ok; o++) for (const di of o ? [ti + o, ti - o] : [ti]) {
      if (ok || di < 0 || di >= n) continue;
      const d = days[di], want = Math.min(maxB, left, maxDay - used[d]);
      if (want < Math.min(minB, left) || want < 15) continue;
      const sl = studySlots(d, extra, ign).find(z => z.e - z.s >= Math.min(minB, want)); if (!sl) continue;
      const len = Math.floor(Math.min(want, sl.e - sl.s) / 15) * 15; if (len < 15) continue;
      blocks.push({ date: d, start: minToHM(sl.s), end: minToHM(sl.s + len), on: true });
      (extra[d] = extra[d] || []).push({ s: sl.s - buf, e: sl.s + len + buf }); used[d] += len; left -= len; ok = true;
    }
    if (!ok) break;
  }
  blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const kind = l.examKind || 'klausur', verb = ['hausarbeit', 'portfolio'].includes(kind) ? 'Schreiben' : kind === 'referat' ? 'Vorbereiten' : 'Lernen';
  const fin = ['klausur', 'muendlich'].includes(kind) ? 'Wiederholen' : 'Feinschliff', name = examTitle(l);
  const rep = blocks.length >= 6 ? 2 : blocks.length >= 3 ? 1 : 0, main = blocks.length - rep;
  blocks.forEach((b, i) => { b.title = (i < main ? verb : fin) + ': ' + name + (i < main && main > 1 ? ' (' + (i + 1) + '/' + main + ')' : ''); });
  Object.assign(P, { list: blocks, total, placed: total - Math.max(0, left), missing: Math.max(0, left) });
}
function examSheet() {
  const P = S.examPlan, l = S.items.find(i => i.id === P.sid); if (!l) return '';
  const t = todayISO(), on = P.list.filter(x => x.on), sum = on.reduce((s, b) => s + durH(b.start, b.end), 0), h = m => fmtH(m / 60);
  const wk = {}; on.forEach(b => { const m = mondayOf(b.date); wk[m] = (wk[m] || 0) + durH(b.start, b.end); });
  const wmax = Math.max(1, ...Object.values(wk)), kw = examKindWord(l);
  const form = '<div class="formgrid"><label class="field"><span>Wie viele Stunden insgesamt?</span><input type="number" min="1" max="200" step="0.5" inputmode="decimal" data-sp="hours" value="' + esc(P.hours) + '"></label>' +
    '<label class="field"><span>Anfangen am</span><input type="date" data-sp="from" min="' + t + '" max="' + esc(addDays(l.examDate, -1)) + '" value="' + esc(P.from) + '"></label></div>' +
    '<div class="row"><button class="btn" data-act="sprun">Neu berechnen</button>' + (P.from > t ? '<button class="btn ghost" data-act="spearlier">1 Woche früher anfangen</button>' : '') + '</div>';
  const box = '<div class="hint ' + (P.missing ? 'warnbox' : 'okbox') + '"><b>' + (P.missing ? (P.placed ? 'Es passen nur ' + h(P.placed) + ' von ' + h(P.total) + ' Std.' : 'Es passt leider nichts.') + ' Es fehlen ' + h(P.missing) + ' Std.' : 'Passt: ' + h(P.placed) + ' Std. in ' + P.list.length + ' Blöcken bis zur ' + kw + ' am ' + fmtShort(l.examDate) + '.') + '</b>' +
    '<span>' + esc(P.missing ? 'Früher anfangen hilft am meisten. ' + whyText({ from: P.from, to: addDays(l.examDate, -1) }) : 'Zur ' + kw + ' hin wird es dichter, die letzten Blöcke sind zum ' + (['klausur', 'muendlich'].includes(l.examKind || 'klausur') ? 'Wiederholen' : 'Feinschliff') + '.') + '</span></div>';
  const weeks = Object.keys(wk).sort().map(m => '<span>ab ' + esc(fmtShort(m)) + '</span><i style="width:' + Math.round(wk[m] / wmax * 100) + '%"></i><span>' + fmtH(wk[m]) + ' Std.</span>').join('');
  return '<div class="overlay" data-close="examPlan"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ex-h"><h2 id="ex-h">Lernplan ' + esc(examTitle(l)) + '</h2>' +
    '<p class="sub">' + esc(kw) + ' am ' + esc(fmtLong(l.examDate)) + ' (in ' + daysUntil(l.examDate) + ' Tagen). Jarvis rechnet rückwärts und legt die Blöcke in freie Lücken.</p>' + form + box +
    (weeks ? '<div class="spw" aria-label="Stunden je Woche">' + weeks + '</div>' : '') +
    (P.replace && P.replace.length ? '<p class="sub">Ersetzt deine ' + P.replace.length + ' noch offenen Lernblöcke für diese ' + esc(kw) + '.</p>' : '') +
    (P.list.length ? '<div class="ics-pick" style="max-height:40vh">' + P.list.map((b, i) => '<div class="pick"><input type="checkbox" aria-label="Übernehmen" data-exi="' + i + '" data-f="on"' + (b.on ? ' checked' : '') + '><div class="pf"><input aria-label="Titel" data-exi="' + i + '" data-f="title" value="' + esc(b.title) + '" style="grid-column:1/-1"><input type="date" aria-label="Datum" data-exi="' + i + '" data-f="date" value="' + esc(b.date) + '"><input type="time" aria-label="Beginn" data-exi="' + i + '" data-f="start" value="' + esc(b.start) + '"><input type="time" aria-label="Ende" data-exi="' + i + '" data-f="end" value="' + esc(b.end) + '"></div></div>').join('') + '</div>' : '') +
    '<div class="row actions"><button class="btn ghost" data-act="excancel">Verwerfen</button><button class="btn primary" data-act="exok"' + (on.length ? '' : ' disabled') + '>' + (on.length ? on.length + ' Blöcke übernehmen (' + fmtH(sum) + ' Std.)' : 'Übernehmen') + '</button></div></div></div>';
}
async function applyExam() {
  const P = S.examPlan, l = S.items.find(i => i.id === P.sid), ts = new Date().toISOString();
  const old = (P.replace || []).map(id => S.items.find(i => i.id === id)).filter(Boolean);
  for (const o of old) await removeItem(o);
  const made = [];
  for (const b of P.list.filter(x => x.on && validBlock(x))) { const it = { id: uid(), type: 'event', title: b.title, date: b.date, start: b.start, end: b.end, area: 'uni', examPlan: P.sid, planned: true, createdAt: ts }; await store.setItem(it); calSync(it); made.push(it.id); }
  if (l) await store.setItem({ ...l, studyPlan: { hours: P.hours, from: P.from, at: ts } });
  logAct('Lernplan ' + (l ? examTitle(l) : '') + ' eingetragen (' + made.length + ' Blöcke' + (old.length ? ', ' + old.length + ' alte ersetzt' : '') + ')', { created: made, restore: old });
  S.examPlan = null; render(); showToast(made.length + ' Lernblöcke eingetragen.');
}
// Karte auf der Fach-Seite: Plan anlegen oder Stand ansehen
function studyPlanCard(x) {
  const l = examLeadOf(x), t = todayISO(); if (!l || !l.examDate || l.examDate <= t || ['keine'].includes(l.examKind)) return '';
  const all = studyBlocks(l.id), kw = examKindWord(l);
  if (!all.length) return '<section class="card"><div class="row" style="justify-content:space-between"><h2 class="label" style="margin:0">Lernplan</h2><button class="btn primary" data-examplan="' + esc(l.id) + '">Lernplan machen</button></div>' +
    '<p class="sub" style="margin-top:6px">Jarvis rechnet von der ' + esc(kw) + ' am ' + esc(fmtShort(l.examDate)) + ' rückwärts und verteilt deine Lernzeit auf freie Lücken, zur ' + esc(kw) + ' hin dichter.</p></section>';
  const now = nowHM(), past = all.filter(e => e.date < t || (e.date === t && (e.end || '') <= now)), nx = all.find(e => !past.includes(e));
  const hAll = all.reduce((s, e) => s + durH(e.start, e.end), 0), hPast = past.reduce((s, e) => s + durH(e.start, e.end), 0);
  return '<section class="card"><div class="row" style="justify-content:space-between"><h2 class="label" style="margin:0">Lernplan</h2><button class="btn" data-examplan="' + esc(l.id) + '">Neu verteilen</button></div>' +
    '<div class="spbar" role="img" aria-label="' + Math.round(hPast / Math.max(hAll, 0.01) * 100) + ' Prozent geschafft"><i style="width:' + Math.round(hPast / Math.max(hAll, 0.01) * 100) + '%"></i></div>' +
    '<p class="sub">' + past.length + ' von ' + all.length + ' Blöcken vorbei (' + fmtH(hPast) + ' von ' + fmtH(hAll) + ' Std.). ' + (nx ? 'Nächster Block: ' + esc(relDay(nx.date)) + ', ' + esc(nx.start) + '–' + esc(nx.end) + '.' : 'Alle Blöcke sind vorbei. Viel Erfolg!') + '</p>' +
    (past.length && nx ? '<p class="sub">Einen Block verpasst? „Neu verteilen“ legt die restliche Zeit neu in freie Lücken.</p>' : '') + '</section>';
}

