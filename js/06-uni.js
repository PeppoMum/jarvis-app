'use strict';
/* Jarvis-App – 06-uni.js (aus Jarvis in Claude, Zeilen 2965–3288 von V48) */
/* ===================== Stufe 3: Uni ===================== */
const LEITNER = [1, 2, 4, 8, 16, 32];
const daysUntil = iso => Math.round((dObj(iso) - dObj(todayISO())) / 864e5);
const materials = sid => byType('material').filter(m => !sid || m.subjectId === sid).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
function dueCardList() {
  const t = todayISO(), out = [];
  materials().forEach(m => (m.cards || []).forEach((c, idx) => { if (!c.due || c.due <= t) out.push({ matId: m.id, idx }); }));
  return out;
}
function subjectProgress(sid) {
  let n = 0, k = 0; materials(sid).forEach(m => (m.cards || []).forEach(c => { n++; if ((c.box || 0) >= 3) k++; }));
  return { n, k, pct: n ? Math.round(k / n * 100) : 0 };
}
function weekMinutes(subj) { const mon = mondayOf(todayISO()); return Object.entries(subj.time || {}).filter(([d]) => d >= mon).reduce((s, [, m]) => s + m, 0); }
const EXAM_KINDS = [['klausur', 'Klausur'], ['hausarbeit', 'Hausarbeit'], ['muendlich', 'Mündliche Prüfung'], ['referat', 'Referat'], ['portfolio', 'Portfolio'], ['andere', 'Andere Prüfung'], ['mit', 'Zusammen mit einem anderen Fach'], ['keine', 'Keine Prüfung']];
const examKindOf = x => (x && x.examKind) || 'klausur';
const examWord = x => ({ klausur: 'Klausur', hausarbeit: 'Abgabe Hausarbeit', muendlich: 'Mündliche Prüfung', referat: 'Referat', portfolio: 'Abgabe Portfolio' })[examKindOf(x)] || 'Prüfung';
// Fach, das den Prüfungstermin trägt: das Fach selbst oder bei „zusammen mit“ das andere Fach (null bei „keine“ oder wenn das andere Fach fehlt)
function examLead(x) {
  const k = examKindOf(x); if (k === 'keine') return null;
  if (k !== 'mit') return x;
  return S.items.find(i => i.id === x.examWith && i.type === 'subject' && examKindOf(i) !== 'mit') || null;
}
const examPartners = lead => byType('subject').filter(s => s.id !== lead.id && examKindOf(s) === 'mit' && s.examWith === lead.id);
const examGroup = lead => [lead, ...examPartners(lead)];
const examName = lead => examGroup(lead).map(s => s.title).join(' + ');
const subjClasses = sid => byType('class').filter(c => c.subjectId === sid);
function examLine(x) {   // Zeile unter dem Fach: Prüfung, Termin, mit wem zusammen
  const k = examKindOf(x), L = examLead(x);
  if (k === 'keine') return 'Keine Prüfung';
  if (!L) return 'Gemeinsame Prüfung: anderes Fach fehlt';
  const when = L.examDate ? ' ' + fmtShort(L.examDate) + (L.examTime ? ', ' + L.examTime : '') : ': noch kein Termin';
  const others = examGroup(L).filter(s => s.id !== x.id).map(s => s.title);
  return examWord(L) + when + (others.length ? ' · zusammen mit ' + others.join(', ') : '');
}
function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + ' Std' + (m % 60 ? ' ' + (m % 60) + ' Min' : '') : m + ' Min'; }
function pageUni() {
  if (S.uniSub) { const sub = S.items.find(i => i.id === S.uniSub); if (sub) return pageSubject(sub); S.uniSub = null; }
  const exD = x => { const L = examLead(x); return (L && L.examDate) || '9'; };
  const subs = byType('subject').sort((a, b) => exD(a).localeCompare(exD(b)) || (a.title || '').localeCompare(b.title || ''));
  const due = dueCardList().length, t = todayISO();
  const uniTasks = openTasks().filter(x => x.area === 'uni' || x.moodleUid).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const cls = byType('class').sort((a, b) => (a.weekday - b.weekday) || (a.start || '').localeCompare(b.start || ''));
  const card = x => {
    const pr = subjectProgress(x.id), L = examLead(x), dleft = L && L.examDate ? daysUntil(L.examDate) : null, running = S.timer && S.timer.subjectId === x.id, sc = subjClasses(x.id);
    return '<article class="subj"><div class="row" style="justify-content:space-between"><h3>' + esc(x.title) + '</h3>' + (dleft != null && dleft >= 0 ? '<span class="countdown' + (dleft <= 14 ? ' soon' : '') + '">' + (dleft === 0 ? 'heute' : 'in ' + dleft + ' T.') + '</span>' : '') + '</div>' +
      '<div class="meta">' + esc(examLine(x)) + ' · ' + materials(x.id).length + ' Material · ' + pr.n + ' Karten</div>' +
      (sc.length ? '<p class="scls">' + sc.map(c => esc(c.title) + ' (' + esc(WD[Number(c.weekday) % 7]) + ')').join(', ') + '</p>' : '') +
      '<div class="prog" role="img" aria-label="Lernfortschritt ' + pr.pct + ' Prozent"><i style="width:' + pr.pct + '%"></i></div>' +
      '<div class="meta">' + pr.pct + ' % sicher · diese Woche ' + fmtMin(weekMinutes(x)) + ' gelernt</div>' +
      '<div class="row"><button class="btn primary" data-subj="' + esc(x.id) + '">Öffnen</button><button class="btn timerbtn' + (running ? ' on' : '') + '" data-timer="' + esc(x.id) + '">' + (running ? 'Stopp · ' + fmtMin(Math.max(0, Math.round((Date.now() - S.timer.startedAt) / 60000))) : 'Lernzeit starten') + '</button></div></article>';
  };
  return '<div class="pagehead"><div><h1 class="page">Uni</h1></div><div class="row"><button class="btn primary" data-act="review"' + (due ? '' : ' disabled') + '>' + (due ? 'Heute abfragen (' + due + ')' : 'Keine Karten fällig') + '</button></div></div>' +
    '<section style="margin-bottom:22px"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 class="label" style="margin:0">Fächer</h2><button class="btn" data-new="subject">+ Fach</button></div>' +
      (subs.length ? '<div class="subjects">' + subs.filter(x => !(examKindOf(x) === 'mit' && examLead(x))).map(x => { const ps = examPartners(x); if (!ps.length) return card(x); const dl = x.examDate ? daysUntil(x.examDate) : null; return '<div class="sgroup"><div class="sgh">' + esc(examKindOf(x) === 'keine' ? 'Gemeinsam' : examWord(x) + ' für ' + (ps.length + 1) + ' Fächer') + '<small>' + esc(examName(x)) + (x.examDate ? ' · ' + esc(fmtShort(x.examDate)) + (dl >= 0 ? ' · noch ' + dl + ' Tage' : '') : ' · noch kein Termin') + '</small></div><div class="subjects">' + [x, ...ps].map(card).join('') + '</div></div>'; }).join('') + '</div>' : '<p class="empty">Lege deine Fächer an, z. B. „Statistik II“. Eine Klausur kannst du dazuschreiben, musst du aber nicht. Gehören zwei Veranstaltungen zu einer Prüfung, verbindest du sie beim Fach unter „Bearbeiten“ › „Prüfung“.</p>') + '</section>' +
    '<div class="today" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">' +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="label" style="margin:0">Fristen &amp; Abgaben</h2><button class="btn" data-new="task">+ Frist</button></div>' +
      (uniTasks.length ? uniTasks.map(x => '<div class="task"><input type="checkbox" aria-label="Erledigt: ' + esc(x.title) + '" data-toggle="' + esc(x.id) + '"><button class="tx" data-edit="' + esc(x.id) + '">' + esc(x.title) + '</button>' + (x.date ? '<span class="due' + (x.date < t ? ' over' : '') + '">' + esc(relDay(x.date)) + '</span>' : '') + '</div>').join('') : '<p class="empty">Keine offenen Uni-Fristen.</p>') +
      '<p class="sub" style="margin-top:8px">Tipp: Notier einfach „Übungsblatt 4 Statistik bis 20.10.“.</p></section>' +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="label" style="margin:0">Stundenplan</h2><span class="row"><label class="btn" for="tt-in">' + (S.matBusy ? esc(S.matBusy) : 'Aus LSF importieren') + '</label><input id="tt-in" type="file" accept=".ics,text/calendar" class="sr" data-act-change="timetable"><button class="btn" data-new="class">+ Vorlesung</button></span></div>' +
      '<p class="sub" style="margin-bottom:8px">Im LSF (campus.uni-due.de) deinen Stundenplan öffnen, als iCalendar-Datei (.ics) herunterladen und hier hochladen.</p>' +
      (cls.length ? cls.map(c => { const cs = c.subjectId && S.items.find(i => i.id === c.subjectId); return '<div class="listrow"><button class="lt" data-edit="' + esc(c.id) + '">' + esc(c.title) + '<small>' + esc(WD[Number(c.weekday) % 7]) + ' · ' + esc(c.start) + '–' + esc(c.end) + (c.room ? ' · ' + esc(c.room) : '') + (c.until ? ' · bis ' + esc(fmtShort(c.until)) : '') + (cs ? ' · Fach ' + esc(cs.title) : '') + '</small></button>' + calBadge({ cal: c.gcalId ? 'ok' : (c.calErr ? 'err' : '') }) + '</div>'; }).join('') : '<p class="empty">Noch keine Vorlesungen eingetragen.</p>') + '</section>' +
    '</div>';
}
function pageSubject(x) {
  const mats = materials(x.id), pr = subjectProgress(x.id);
  const dueHere = dueCardList().filter(d => mats.some(m => m.id === d.matId)).length;
  return '<div class="listpage" style="max-width:900px"><div><button class="btn ghost" data-act="unback">' + ICON.chevl + ' Alle Fächer</button></div>' +
    '<div class="pagehead" style="margin:0"><div><h1 class="page">' + esc(x.title) + '</h1><p class="sub">' + (() => { const L = examLead(x); if (!L || !L.examDate) return esc(examLine(x)); const o = examGroup(L).filter(s => s.id !== x.id).map(s => s.title); return esc(examWord(L)) + ' ' + esc(fmtLong(L.examDate)) + (L.examTime ? ', ' + esc(L.examTime) : '') + (L.examPlace ? ' · ' + esc(L.examPlace) : '') + ' · noch ' + daysUntil(L.examDate) + ' Tage' + (o.length ? ' · zusammen mit ' + esc(o.join(', ')) : ''); })() + ' · ' + pr.n + ' Karten, ' + pr.pct + ' % sicher' + (subjClasses(x.id).length ? '<br>Veranstaltungen: ' + subjClasses(x.id).map(c => esc(c.title) + ' (' + esc(WD[Number(c.weekday) % 7]) + ' ' + esc(c.start || '') + ')').join(', ') : '') + '</p></div>' +
      '<div class="row">' + (mats.length ? '<button class="btn" data-subjpdf="' + esc(x.id) + '">Lernzettel (PDF)</button>' : '') + '<button class="btn" data-edit="' + esc(x.id) + '">Bearbeiten</button><button class="btn primary" data-reviewsub="' + esc(x.id) + '"' + (dueHere ? '' : ' disabled') + '>' + (dueHere ? 'Abfragen (' + dueHere + ')' : 'Nichts fällig') + '</button></div></div>' +
    studyPlanCard(x) +
    uniAskCard(x, mats) +
    '<section class="card"><h2 class="label">Material hinzufügen</h2><form class="drop" data-form="material" data-sid="' + esc(x.id) + '">' +
      '<label class="field"><span>Titel (z. B. „Vorlesung 3 – Regression“)</span><input name="title" data-keep="mat-title" autocomplete="off"></label>' +
      '<label class="field"><span>Datei: Folien (PDF, PowerPoint), Word-Datei, Mitschrift (TXT, MD)</span><input name="file" type="file" accept="application/pdf,.pdf,.docx,.pptx,.doc,.ppt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,.txt,.md,.markdown,text/plain,text/markdown" style="height:auto;padding:10px"></label>' +
      '<label class="field"><span>… oder Text einfügen (z. B. Transkript einer Aufnahme)</span><textarea name="text" data-keep="mat-text" placeholder="Text hier einfügen"></textarea></label>' +
      '<label class="field"><span>Eigene Lernkarten (optional, eine pro Zeile: Frage | Antwort)</span><textarea name="cards" data-keep="mat-cards" rows="3" placeholder="Was ist R²? | Anteil der erklärten Streuung"></textarea></label>' +
      '<div class="row"><button class="btn primary" type="submit"' + (S.matBusy ? ' disabled' : '') + '>' + (S.matBusy ? esc(S.matBusy) : 'Material speichern') + '</button></div>' +
      '<p class="sub">Die Datei selbst wird nicht gespeichert, nur der Text (zum Durchsuchen), eine Gliederung und deine Lernkarten. Fotos und Folien, die nur aus Bildern bestehen, kann Jarvis ohne KI nicht lesen.</p></form></section>' +
    '<section class="card"><h2 class="label">Material (' + mats.length + ')</h2>' + (mats.length ? mats.map(m => '<details class="mat"><summary><span>' + esc(m.title) + '<br><small class="sub">' + esc(fmtShort(isoDate(new Date(m.createdAt)))) + ' · ' + (m.cards || []).length + ' Karten · ' + esc(m.kind || 'Text') + '</small></span>' + ICON.chev + '</summary>' +
      ((m.summary || []).length ? '<ul>' + m.summary.map(li => '<li>' + esc(li) + '</li>').join('') + '</ul>' : '') +
      '<details><summary class="sub">Alle Karten anzeigen</summary><ol>' + (m.cards || []).map(c => '<li><b>' + esc(c.q) + '</b><br>' + esc(c.a) + (c.p ? ' <span class="src">(Folie ' + c.p + ')</span>' : '') + '</li>').join('') + '</ol></details>' +
      '<form class="addrow" data-form="matcard" data-id="' + esc(m.id) + '" style="margin-top:8px"><label class="sr" for="mq-' + esc(m.id) + '">Frage</label><input id="mq-' + esc(m.id) + '" name="q" placeholder="Neue Karte: Frage" autocomplete="off"><label class="sr" for="ma-' + esc(m.id) + '">Antwort</label><input id="ma-' + esc(m.id) + '" name="a" placeholder="Antwort" autocomplete="off"><button class="btn" type="submit">+</button></form>' +
      '<div class="row" style="margin-top:8px"><button class="btn" data-matpdf="' + esc(m.id) + '">Lernzettel als PDF</button><button class="btn ghost danger" data-del="' + esc(m.id) + '">Material löschen</button></div></details>').join('') : '<p class="empty">Noch kein Material.</p>') + '</section>' +
  '</div>';
}

/* ----- Material verarbeiten ----- */
const PDFJS_VER = '4.10.38';
let pdfjsP = null;
function loadPdfJs() {
  if (!pdfjsP) pdfjsP = (async () => {
    const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VER + '/build/';
    globalThis.pdfjsWorker = await import(base + 'pdf.worker.min.mjs');   // läuft im Hauptfenster (keine fremden Worker nötig)
    const lib = await import(base + 'pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    return lib;
  })().catch(e => { pdfjsP = null; throw e; });
  return pdfjsP;
}
async function pdfToText(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    S.matBusy = 'Lese Seite ' + i + ' von ' + doc.numPages + ' …'; render();
    const pg = await doc.getPage(i); const tc = await pg.getTextContent();
    text += '\n[Folie ' + i + ']\n' + tc.items.map(t => t.str).join(' ');
  }
  return { text, doc };
}
const isImageFile = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
let heicP = null;
function loadHeic() {   // nur bei Bedarf: Umwandler für iPhone-Fotos (HEIC → JPG)
  if (window.heic2any) return Promise.resolve();
  return heicP || (heicP = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'; sc.onload = ok; sc.onerror = () => { heicP = null; no(new Error('heic')); }; document.head.appendChild(sc); }));
}
async function shrinkImage(file, maxSide = 1600) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) {
    if (!/\.(heic|heif)$/i.test(file.name) && !/heic|heif/i.test(file.type)) throw { code: 'image_format' };
    try { await loadHeic(); const jpg = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }); bmp = await createImageBitmap(Array.isArray(jpg) ? jpg[0] : jpg); } catch (e2) { throw { code: 'image_format' }; }
  }
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}
// Word (.docx) und PowerPoint (.pptx) sind ZIP-Dateien mit XML drin: ohne Zusatz-Bibliothek auspacken (DecompressionStream)
async function unzipEntries(file, re) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer), dec = new TextDecoder(), out = [];
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw { code: 'zip' };
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const meth = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!re.test(name)) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = buf.subarray(start, start + csize);
    if (meth === 0) out.push({ name, xml: dec.decode(data) });
    else if (meth === 8) out.push({ name, xml: await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() });
  }
  return out;
}
function xmlText(xml) {
  return xml.replace(/<(w|a):tab\/>/g, '\t').replace(/<(w|a):br\/>/g, '\n').replace(/<\/(w|a):p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
async function officeText(file, ppt) {
  if (!('DecompressionStream' in window)) throw { code: 'zip' };
  const es = await unzipEntries(file, ppt ? /^ppt\/slides\/slide\d+\.xml$/ : /^word\/(document|footnotes)\.xml$/);
  if (!es.length) throw { code: 'zip' };
  if (!ppt) return es.sort((a, b) => a.name.localeCompare(b.name)).map(x => xmlText(x.xml)).join('\n');
  return es.map(x => ({ n: Number(x.name.match(/(\d+)\.xml$/)[1]), t: xmlText(x.xml) })).sort((a, b) => a.n - b.n).map(x => '[Folie ' + x.n + ']\n' + x.t.trim()).join('\n\n');
}
async function pdfPagesAsImages(doc, max) {
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, max); i++) {
    const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1.4 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)));
  }
  return out;
}
// Ohne KI: Text aus der Datei holen und durchsuchbar speichern, dazu eine Gliederung (erste Zeile jeder Folie) und deine eigenen Lernkarten.
function cardsFromText(txt) {
  return String(txt || '').split(/\n+/).map(l => l.split(/\s*(?:\||::|\t)\s*/)).filter(p => p.length >= 2 && p[0].trim() && p.slice(1).join(' ').trim())
    .slice(0, 120).map(p => ({ q: p[0].trim().slice(0, 500), a: p.slice(1).join(' ').trim().slice(0, 1200), box: 0, due: todayISO() }));
}
function outlineOf(text) {
  return splitPages(text).filter(pg => !pg.part).map(pg => { const w = pg.t.split(' ').slice(0, 9).join(' '); return 'Folie ' + pg.p + ': ' + (w.length < pg.t.length ? w + ' …' : w); }).slice(0, 30);
}
async function processMaterial(form) {
  const sid = form.dataset.sid, sub = S.items.find(i => i.id === sid); if (!sub) return;
  const fd = new FormData(form), files = fd.getAll('file').filter(f => f && f.size), file = files[0], pasted = String(fd.get('text') || '').trim(), own = cardsFromText(fd.get('cards'));
  let title = String(fd.get('title') || '').trim();
  if (!file && !pasted && !own.length) { showToast('Bitte eine Datei wählen, Text einfügen oder Lernkarten eintragen.'); return; }
  let text = pasted, kind = own.length && !file && !pasted ? 'Lernkarten' : 'Text';
  try {
    if (file && files.every(isImageFile)) { showToast('Fotos kann Jarvis ohne KI nicht lesen. Bitte PDF, Word, PowerPoint oder Text nehmen.'); return; }
    if (file) {
      if (!title) title = file.name.replace(/\.[^.]+$/, '');
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        kind = 'Folien (PDF)'; S.matBusy = 'Öffne PDF …'; render();
        const r = await pdfToText(file); text = r.text;
        if (text.replace(/\[Folie \d+\]|\s/g, '').length < 100) throw { code: 'pdf_images' };
      } else if (/\.(docx|pptx)$/i.test(file.name)) {
        const ppt = /\.pptx$/i.test(file.name); kind = ppt ? 'Folien (PowerPoint)' : 'Word-Datei'; S.matBusy = 'Öffne ' + (ppt ? 'PowerPoint' : 'Word-Datei') + ' …'; render();
        text = await officeText(file, ppt);
        if (text.replace(/\[Folie \d+\]|\s/g, '').length < 20) throw { code: 'empty_office' };
      } else if (/\.(doc|ppt)$/i.test(file.name)) { showToast('Das alte Word-/PowerPoint-Format geht nicht. Bitte in Word als .docx (bzw. .pptx) oder PDF speichern.'); S.matBusy = ''; render(); return; }
      else if (/\.(txt|md|markdown)$/i.test(file.name) || /^text\//.test(file.type)) { kind = /\.md|markdown/i.test(file.name) ? 'Markdown' : 'Text'; text = await file.text(); }
      else { showToast('Dieses Dateiformat geht nicht. Bitte PDF, Word, PowerPoint, TXT oder MD.'); S.matBusy = ''; render(); return; }
    }
    if (!title) title = 'Material ' + fmtShort(todayISO());
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const m = { id: uid(), type: 'material', subjectId: sid, title: title.slice(0, 160), kind, summary: text ? outlineOf(text) : [], cards: own, chars: text.length, createdAt: new Date().toISOString() };
    if (text && await savePages(m, text, file ? file.name : '')) m.hasPages = true;
    await withRetry(() => store.setItem(m));
    form.reset(); document.querySelectorAll('[data-keep^="mat-"]').forEach(el => { el.value = ''; });
    showToast('Gespeichert' + (m.hasPages ? ', durchsuchbar' : '') + (own.length ? ', ' + own.length + ' Lernkarten' : '') + '.');
  } catch (e) {
    const c = e && e.code;
    showToast(c === 'pdf_images' ? 'In diesem PDF steht kein lesbarer Text, nur Bilder. Das kann Jarvis ohne KI nicht lesen.' : c === 'empty_office' ? 'In der Datei steht kein lesbarer Text.' : c === 'zip' ? 'Die Datei scheint beschädigt zu sein.' : (e instanceof TypeError || (e && /import|fetch|module/i.test(String(e.message)))) ? 'PDF-Leser konnte nicht geladen werden. Alternativ Text einfügen.' : 'Speichern ging gerade nicht. Bitte nochmal versuchen.');
  }
  S.matBusy = ''; render();
}
// Eigene Lernkarte an ein Material hängen
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form="matcard"]'); if (!f) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  const m = S.items.find(i => i.id === f.dataset.id); if (!m) return;
  const fd = new FormData(f), q = String(fd.get('q') || '').trim(), a = String(fd.get('a') || '').trim();
  if (!q || !a) { showToast('Bitte Frage und Antwort eintragen.'); return; }
  await withRetry(() => store.setItem({ ...m, cards: (m.cards || []).concat({ q: q.slice(0, 500), a: a.slice(0, 1200), box: 0, due: todayISO() }).slice(0, 300) }));
  f.reset(); showToast('Lernkarte gespeichert.'); render();
}, true);

/* ----- Abfrage ----- */
function startReview(sid) {
  let q = dueCardList(); if (sid) q = q.filter(d => { const m = S.items.find(i => i.id === d.matId); return m && m.subjectId === sid; });
  q = q.sort(() => Math.random() - 0.5).slice(0, 20);
  if (!q.length) { showToast('Keine Karten fällig.'); return; }
  S.review = { queue: q, pos: 0, flipped: false, right: 0, wrong: 0, started: Date.now() }; render();
}
function reviewSheet() {
  const R = S.review;
  if (R.pos >= R.queue.length) return '<div class="overlay" data-close="review"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rv-h"><h2 id="rv-h">Geschafft</h2><p>' + R.right + ' gewusst, ' + R.wrong + ' noch üben. Die Karten kommen in passenden Abständen wieder.</p><div class="row actions"><button class="btn primary" data-act="reviewclose">Fertig</button></div></div></div>';
  const it = R.queue[R.pos], m = S.items.find(i => i.id === it.matId), c = m && m.cards && m.cards[it.idx];
  if (!c) { R.pos++; return reviewSheet(); }
  const sub = S.items.find(i => i.id === m.subjectId);
  return '<div class="overlay" data-close="review"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rv-h"><div class="row" style="justify-content:space-between"><h2 id="rv-h">' + esc(sub ? sub.title : 'Lernkarten') + '</h2><span class="sub">' + (R.pos + 1) + ' / ' + R.queue.length + '</span></div>' +
    '<div class="flash" aria-live="polite"><div class="q">' + esc(c.q) + '</div>' + (R.flipped ? '<div class="a">' + esc(c.a) + '</div>' : '') + '</div>' +
    '<div class="row actions">' + (R.flipped ? '<button class="btn" data-grade="0">Noch nicht</button><button class="btn primary" data-grade="1">Gewusst</button>' : '<button class="btn ghost" data-act="reviewclose">Beenden</button><button class="btn primary" data-act="flip">Antwort zeigen</button>') + '</div></div></div>';
}
async function grade(ok) {
  const R = S.review, it = R.queue[R.pos], m = S.items.find(i => i.id === it.matId); if (!m) return;
  const cards = m.cards.map(x => ({ ...x })), c = cards[it.idx];
  c.box = ok ? Math.min(5, (c.box || 0) + 1) : 0; c.due = addDays(todayISO(), ok ? LEITNER[c.box] : 1); c.last = todayISO();
  if (ok) R.right++; else R.wrong++;
  R.pos++; R.flipped = false; render();
  try { await withRetry(() => store.setItem({ ...m, cards })); } catch (e) { showToast('Speichern fehlgeschlagen.'); }
}
async function finishReview() {
  const R = S.review; S.review = null; render();
  if (!R) return;
  const min = Math.round((Date.now() - R.started) / 60000);
  const first = R.queue[0] && S.items.find(i => i.id === R.queue[0].matId);
  if (min >= 1 && first) { const sub = S.items.find(i => i.id === first.subjectId); if (sub) await addMinutes(sub, min); }
}

/* ----- Lernzeit ----- */
async function addMinutes(sub, min) { const t = todayISO(); const time = { ...(sub.time || {}) }; time[t] = (time[t] || 0) + min; await store.setItem({ ...sub, time }); }
async function toggleTimer(sid) {
  if (S.timer && S.timer.subjectId) {
    const sub = S.items.find(i => i.id === S.timer.subjectId), min = Math.max(1, Math.round((Date.now() - S.timer.startedAt) / 60000));
    const same = S.timer.subjectId === sid;
    await store.setTimer(null); S.timer = null;
    if (sub) { await addMinutes(sub, Math.min(min, 600)); await logTime('uni', sub.title, Math.min(min, 600), 'lernzeit', S.timer ? S.timer.startedAt : Date.now() - min * 60000); showToast(fmtMin(Math.min(min, 600)) + ' für ' + sub.title + ' gespeichert.'); }
    if (same) { render(); return; }
  }
  const t = { subjectId: sid, startedAt: Date.now() }; S.timer = t; await store.setTimer(t); render();
}
setInterval(() => { if (S.timer && S.route === 'uni' && !S.pending && !S.editing) render(); }, 30000);

/* ----- Klausur in den Kalender ----- */
async function syncExam(sub) {
  const cur = () => S.items.find(i => i.id === sub.id) || sub;
  const evId = cur().examEventId, ev = evId && S.items.find(i => i.id === evId);
  if (!sub.examDate) { if (ev) await removeItem(ev); if (evId) { const c = { ...cur() }; delete c.examEventId; await store.setItem(c); } return; }
  const data = { type: 'event', title: examWord(sub) + ': ' + examName(sub), date: sub.examDate, area: 'uni' };
  if (sub.examTime) { data.start = sub.examTime; const m = hmToMin(sub.examTime) + 120; data.end = pad(Math.min(23, Math.floor(m / 60))) + ':' + pad(m % 60); }
  if (sub.examPlace) data.place = sub.examPlace;
  if (ev) { const upd = { ...ev, ...data }; if (!sub.examTime) { delete upd.start; delete upd.end; } await store.setItem(upd); calSync(upd, ev); }
  else { const it = { id: uid(), createdAt: new Date().toISOString(), ...data }; await store.setItem(it); calSync(it); await store.setItem({ ...cur(), examEventId: it.id }); }
}

/* ----- Moodle-Kalender (.ics) ----- */
function parseIcs(txt) {
  const lines = txt.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let cur = null;
  const unesc = v => v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  const dt = v => { const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null; if (m[4] && m[7]) { const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])); return { date: isoDate(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) }; } return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] ? m[4] + ':' + m[5] : null }; };
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') { if (cur && cur.summary && cur.when) out.push(cur); cur = null; }
    else if (cur) {
      const i = l.indexOf(':'); if (i < 0) continue; const key = l.slice(0, i).split(';')[0].toUpperCase(), val = l.slice(i + 1);
      if (key === 'SUMMARY') cur.summary = unesc(val).slice(0, 200);
      if (key === 'UID') cur.uid = val.slice(0, 200);
      if (key === 'CATEGORIES') cur.course = unesc(val).slice(0, 120);
      if (key === 'DTSTART' || key === 'DUE') cur.when = dt(val) || cur.when;
    }
  }
  return out;
}
async function importIcs(file) {
  try {
    const evs = parseIcs(await file.text()); const t = todayISO();
    const known = new Set(S.items.filter(i => i.moodleUid).map(i => i.moodleUid));
    const list = evs.filter(e => e.when.date >= t && !(e.uid && known.has(e.uid))).sort((a, b) => a.when.date.localeCompare(b.when.date)).slice(0, 100)
      .map(e => ({ title: e.summary.replace(/ (ist|is) fällig$| due$/i, '') + (e.course ? ' (' + e.course + ')' : ''), date: e.when.date, time: e.when.time, uid: e.uid || e.summary + e.when.date, on: true }));
    if (!list.length) { showToast('Keine neuen Fristen in der Datei gefunden.'); return; }
    S.ics = list; render();
  } catch (e) { showToast('Die Datei konnte nicht gelesen werden.'); }
}
function icsSheet() {
  return '<div class="overlay" data-close="ics"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ics-h"><h2 id="ics-h">Fristen aus Moodle</h2><p class="sub">' + S.ics.length + ' neue Termine gefunden. Sie werden als Uni-Aufgaben mit Frist angelegt.</p><div class="ics-pick">' +
    S.ics.map((e, i) => '<label class="pick"><input type="checkbox" data-icsi="' + i + '"' + (e.on ? ' checked' : '') + '><span>' + esc(e.title) + '<br><small class="sub">' + esc(fmtShort(e.date)) + (e.time ? ', ' + esc(e.time) : '') + '</small></span></label>').join('') +
    '</div><div class="row actions"><button class="btn ghost" data-act="icscancel">Abbrechen</button><button class="btn primary" data-act="icsok">' + S.ics.filter(e => e.on).length + ' übernehmen</button></div></div></div>';
}
async function applyIcs() {
  const ts = new Date().toISOString(); let n = 0;
  for (const e of S.ics.filter(x => x.on)) { await store.setItem({ id: uid(), type: 'task', title: e.title + (e.time && e.time !== '00:00' ? ' (bis ' + e.time + ')' : ''), date: e.date, area: 'uni', moodleUid: e.uid, done: false, createdAt: ts }); n++; }
  S.ics = null; render(); showToast(n + ' Fristen übernommen.');
}


