'use strict';
/* Jarvis-App – 04-eingabe.js (aus Jarvis in Claude, Zeilen 2223–2417 von V48) */
/* ===================== Eingangskorb ===================== */
function weekLoadLine() {
  const ws = weekStats(mondayOf(todayISO()));
  return 'Wochenauslastung: diese Woche ' + fmtH(ws.total) + ' Std. verplant, Ampel „' + ws.label + '“. Die Ampel zählt ALLES zusammen (Arbeit, Uni, Ehrenamt, Privat), nur Fahrten (Zug, Bus, Auto) nicht: eng ab ' + fmtH(ws.limY) + ' Std., überplant ab ' + fmtH(ws.limR) + ' Std. Das Arbeitsziel (' + fmtH(Number(S.settings.workHours ?? 20)) + ' Std.) gilt nur für die Arbeit und ist keine Wochengrenze. Nenne die Woche nur „eng“ oder „überplant“, wenn die Ampel das sagt.';
}
/* ===================== Schnell notieren (ohne KI) ===================== */
// Die App hat keine KI. Das Eingabefeld erkennt feste Satzmuster und fragt vor dem Speichern nach.
// Was es nicht erkennt, landet als Notiz im Eingangskorb.
const cap1 = s => { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
const qnClean = s => String(s || '').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
const QN_EXP_CAT = [['Essen', /döner|pizza|essen|mensa|restaurant|burger|kaffee|café|cafe|bäcker|imbiss|sushi|lieferando|kebab|pommes|frühstück|mittag|abendessen/],
  ['Einkauf', /rewe|aldi|lidl|edeka|netto|penny|kaufland|einkauf|supermarkt|lebensmittel|dm\b|rossmann/],
  ['Fahrt', /tank|sprit|benzin|diesel|zug|bahn|ticket|bus|parken|parkhaus|taxi|uber|deutschlandticket/],
  ['Freizeit', /kino|bar|party|konzert|fitness|gym|eintritt|bowling|spiel|netflix|spotify|ausflug/],
  ['Uni', /buch|bücher|skript|kopie|druck|uni|semester|mensa-karte/],
  ['Kleidung', /schuh|jacke|hose|shirt|pulli|kleidung|klamotten|trikot/],
  ['Geschenk', /geschenk|geburtstag/],
  ['Haushalt', /haushalt|putz|möbel|ikea|baumarkt|deko/]];
// Nächster Tag mit diesem Wochentag (1 = Montag … 7 = Sonntag), heute zählt mit
const qnNextDow = wd => addDays(todayISO(), (wd - dow(todayISO()) + 7) % 7);
const QN_REP = [[/\b(?:jeden|jede[ns]?)\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s?\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s\b/, 'weekly'],
  [/\balle\s+(?:2|zwei)\s+wochen\b|\bjede zweite woche\b|\b14-?tägig\b/, 'biweekly'],
  [/\b(?:jeden|jede[ns]?)\s+werktag\b|\bwerktags\b|\bmontags? bis freitags?\b/, 'weekdays'],
  [/\b(?:jeden|jede[ns]?)\s+(?:tag|morgen|abend)\b|\btäglich\b/, 'daily'],
  [/\b(?:jede|jeden)\s+woche\b|\bwöchentlich\b|\beinmal (?:die|pro) woche\b/, 'weekly'],
  [/\b(?:jeden|jede[ns]?)\s+monat\b|\bmonatlich\b|\beinmal im monat\b|\bjeden (\d{1,2})\.\b/, 'monthly']];

// Ein Satz → { items } oder { act: Funktion } oder null
function qnOne(raw) {
  raw = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const t = raw.toLowerCase();
  let m;
  // Merken: „Merk dir, dass ich morgens lerne“
  if ((m = raw.match(/^(?:jarvis,?\s+)?(?:merk(?:e)?\s+dir|merken|notier dir über mich)\s*[:,]?\s*(dass\s+)?(.+)$/i))) {
    let x = qnClean(m[2]); const w = x.split(' ');
    if (m[1] && w.length > 2) { const v = w.pop(); w.splice(1, 0, v); x = w.join(' '); }   // „dass ich morgens lerne“ → „Ich lerne morgens“
    return { items: [{ type: 'memory', title: cap1(x).slice(0, 300) }] };
  }
  // Warte auf: „Warte auf Rückmeldung von Herrn Meier“
  if ((m = raw.match(/^(?:ich\s+)?(?:warte|warten)\s+(?:noch\s+)?(?:auf|:)\s*(.+)$/i))) {
    let rest = m[1], who = null, fu = null;
    const dd = qpDate(rest.toLowerCase()); if (dd) { fu = dd.date; rest = rest.replace(new RegExp(dd.cut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' '); }
    const w = rest.match(/^(.*?)\s+von\s+(.+)$/i); if (w) { rest = w[1]; who = qnClean(w[2]).slice(0, 80); }
    const it = { type: 'waiting', title: cap1(qnClean(rest)).slice(0, 200), since: todayISO(), followUp: fu && fu >= todayISO() ? fu : addDays(todayISO(), 5) };
    if (who) it.who = who;
    return it.title.length > 1 ? { items: [it] } : null;
  }
  // Erinnerung: „Erinner mich morgen um 9 an den Müll“
  if ((m = raw.match(/^(?:bitte\s+)?erinner(?:e|t)?\s+mich\s+(.+)$/i))) {
    let rest = ' ' + m[1] + ' ';
    const low = () => rest.toLowerCase();
    const dd = qpDate(low()); if (dd) rest = rest.slice(0, low().indexOf(dd.cut)) + ' ' + rest.slice(low().indexOf(dd.cut) + dd.cut.length);
    const tm = qpTime(low()); if (tm) rest = rest.slice(0, low().indexOf(tm.cut)) + ' ' + rest.slice(low().indexOf(tm.cut) + tm.cut.length);
    const title = cap1(qnClean(rest.replace(/^\s*(?:bitte\s+)?(?:daran,?\s*(?:dass)?|an|dass|zu|ans)\s+/i, ' ').replace(/^\s*(?:den|die|das|dem|der|meine[nmr]?|mein)\s+/i, ' ').replace(/\s+zu erinnern\s*$/i, ''))
      .replace(/\b(ab|an|auf|aus|ein|mit|nach|vor|zurück|weg|um|durch|her|hin|los|fest|vorbei|bereit)zu([a-zäöüß]{3,}en)$/i, '$1$2').replace(/\bzu\s+([a-zäöüß]+en)$/i, '$1'));
    if (title.length < 2) return null;
    const start = tm ? tm.start : '09:00';
    let date = dd ? dd.date : todayISO();
    if (!dd && start <= nowHM()) date = addDays(date, 1);
    return { items: [{ type: 'task', title, date, remindAt: date + 'T' + start, start: null, end: null, place: null, area: null }] };
  }
  // Wiederholung: „Jeden Montag Müll rausbringen“, „täglich Vokabeln“
  const rep = QN_REP.find(([re]) => re.test(t));
  if (rep) {
    const mm = t.match(rep[0]); let date = todayISO();
    const wdName = mm && (mm[1] || mm[2]); if (rep[1] === 'weekly' && wdName && QP_WD[wdName]) date = qnNextDow(QP_WD[wdName]);
    if (rep[1] === 'monthly' && mm && /^\d+$/.test(mm[1] || '')) { const d = Math.min(28, Number(mm[1])); date = todayISO().slice(0, 8) + pad(d); if (date < todayISO()) date = addMonths(date, 1); }
    if (rep[1] === 'weekdays' && dow(date) > 5) date = qnNextDow(1);
    let title = raw.slice(0, mm.index) + ' ' + raw.slice(mm.index + mm[0].length);
    const tm = qpTime(title.toLowerCase()); if (tm) { const i = title.toLowerCase().indexOf(tm.cut); title = title.slice(0, i) + ' ' + title.slice(i + tm.cut.length); }
    title = cap1(qnClean(title.replace(/^\s*(?:ich\s+)?(?:muss|will|soll)\s+/i, ' ').replace(/\b(?:um|am)\s*$/i, '')));
    if (title.length < 2) return null;
    const it = { type: 'task', title, date, repeat: rep[1], start: null, end: null, place: null, area: null };
    if (tm) it.remindAt = date + 'T' + tm.start;
    return { items: [it] };
  }
  // Ausgabe: „12 € Döner“, „Döner 8,50 €“, „30 Euro fürs Tanken ausgegeben“
  if ((m = t.match(/(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)(?![a-zäöü])/)) && !/\b(?:kaufen|einkaufen|überweisen|zahlen bis|bezahlen bis|bis|rechnung|mahnung|abgabe|zurück(?:zahlen|geben)|schuldet|leihen)\b/.test(t)) {
    const amount = Math.round(Number(m[1].replace(',', '.')) * 100) / 100;
    let date = todayISO(); if (/\bgestern\b/.test(t)) date = addDays(date, -1); else if (/\bvorgestern\b/.test(t)) date = addDays(date, -2);
    let title = raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length);
    title = qnClean(title.replace(/\b(?:heute|gestern|vorgestern|ausgegeben|bezahlt|gezahlt|gekostet|für|fürs|beim|bei|im|in der|ich habe|ich hab|hab|habe)\b/gi, ' '));
    const cat = (QN_EXP_CAT.find(([, re]) => re.test(t)) || ['Sonstiges'])[0];
    if (amount > 0 && amount < 100000) return { items: [{ type: 'expense', title: cap1(title || cat).slice(0, 120), amount, cat, date }] };
  }
  // Einkauf ohne Vorsilbe: „Milch und Eier kaufen“, „Brauche noch Zahnpasta“ (mit Tag oder Frist → Aufgabe, das macht quickParse)
  if (!qpDate(t) && !/\bbis\b/.test(t) && ((m = raw.match(/^(?:ich\s+)?(?:muss\s+)?(?:noch\s+)?(.+?)\s+(?:kaufen|einkaufen|besorgen|mitbringen)$/i)) || (m = raw.match(/^(?:ich\s+|wir\s+)?brauche?n?\s+(?:noch\s+|mal\s+|neue[nrs]?\s+)?(.+)$/i)) || (m = raw.match(/^(?:auf die einkaufsliste|einkaufsliste|kaufliste)\s*:?\s*(.+)$/i)))) {
    const xs = m[1].split(/,|\bund\b|\bsowie\b|\+/i).map(s => qnClean(s.replace(/^(?:noch|neue[nrs]?|etwas|ein(?:e[nm]?)?)\s+/i, ''))).filter(s => s.length > 1).slice(0, 15);
    if (xs.length && xs.every(x => x.split(' ').length <= 4) && !/\b(?:hilfe|zeit|pause|urlaub|ruhe|schlaf|termin|mehr|dich|dir|mich|ihn|sie|jemanden|bescheid)\b/i.test(m[1])) return { items: xs.map(x => ({ type: 'shopping', title: cap1(x), aisle: guessAisle(x) })) };
  }
  // Idee: „Idee Trainingsform mit zwei Toren“, „Vielleicht mal Kletterhalle“
  if ((m = raw.match(/^(?:idee|gedanke|vielleicht mal|irgendwann mal|später mal)\s*[:,-]?\s+(.+)$/i))) return { items: [{ type: 'idea', title: cap1(m[1]).slice(0, 200) }] };
  return null;
}
// Kurze Fragen, die ohne KI aus den eigenen Daten gehen. Sonst null.
function qnAnswer(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!/\?$/.test(t) && !QP_ASK.test(t)) return null;
  const li = (xs, f) => xs.map(x => '• ' + f(x)).join('\n');
  const dd = qpDate(t), day = dd ? dd.date : todayISO(), dn = relDay(day);
  if (/wetter|regen|regnet|warm|kalt|grad/.test(t)) { const w = wxDay(day); return w ? 'Wetter ' + dn + ': ' + w.hi + '° / ' + w.lo + '°, ' + w.phrase + ', Regen ' + w.rain + ' %.' : 'Für ' + dn + ' habe ich noch kein Wetter.'; }
  if (/einkauf|einkaufen|einkaufsliste/.test(t)) { const xs = byType('shopping').filter(i => !i.done); return xs.length ? 'Auf der Einkaufsliste:\n' + li(xs.slice(0, 20), x => x.title) : 'Die Einkaufsliste ist leer.'; }
  if (/woche/.test(t) && /voll|viel|verplant|ampel|stunden|eng/.test(t)) { const ws = weekStats(mondayOf(day)); return 'Die Woche ist „' + ws.label + '“: ' + fmtH(ws.total) + ' Std. verplant.'; }
  if (/fällig|offen|aufgaben|erledigen|frist/.test(t) && !dd) { const b = taskBuckets(), xs = [...b.over, ...b.today, ...b.soon]; return xs.length ? 'Fällig:\n' + li(xs.slice(0, 10), x => x.title + (x.date ? ' (' + relDay(x.date) + ')' : '')) : 'Gerade ist nichts fällig.'; }
  if (/termin|steht|vorlesung|training|arbeit|habe ich|hab ich|was ist|los|plan|frei/.test(t)) {
    const bl = blocksOn(day), tk = byType('task').filter(x => !x.done && x.date === day);
    if (!bl.length && !tk.length) return dn.charAt(0).toUpperCase() + dn.slice(1) + ' ist nichts eingetragen.';
    return cap1(dn) + ':\n' + li(bl, b => (b.start ? b.start + (b.end ? '–' + b.end : '') + ' ' : 'ganztägig ') + b.title) + (tk.length ? (bl.length ? '\n' : '') + 'Fällig:\n' + li(tk, x => x.title) : '');
  }
  return null;
}
// Feste Befehle: Mails aufräumen, Zeit einplanen, Tag neu planen
function qnAction(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\b(?:mails?|posteingang|e-mails?)\b.*\b(?:aufräumen|ausmisten|entrümpeln)\b|\bräum\w*\s+(?:meine\s+)?(?:mails?|posteingang)\b|\bwerbung\s+(?:und|&)\s+spam\b/.test(t)) return { kind: 'mailclean' };
  if (/^(?:ich\s+)?(?:bin|fühl\w*\s+mich)\s+(?:total\s+|voll\s+|echt\s+|so\s+)?(?:platt|kaputt|erschöpft|krank|k\.?o\.?)\b|\b(?:tag|rest des tages|heute)\s+neu\s+planen\b|^neu\s+planen\b|\bplan\w*\s+(?:den|meinen)\s+(?:tag|rest)\s+neu\b/.test(t)) return { kind: 'replan' };
  const h = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:std\.?|stunden|h)\b/);
  if (h && /\b(?:plan\w*|einplanen|reservier\w*|block\w*)\b/.test(t) && !/\b(?:gearbeitet|gelernt|gemacht|war)\b/.test(t)) {
    const after = t.slice(h.index + h[0].length).replace(/\b(?:diese|nächste|kommende)\s+woche\b|\bein(?:planen)?\b|\bbitte\b|\bfür\b|\bzum\b|\bzur\b|\bmir\b/g, ' ');
    const title = cap1(qnClean(after) || 'Lernen');
    return { kind: 'plan', plan: { title: title.slice(0, 80), hours: Number(h[1].replace(',', '.')), week: /\b(?:nächste|kommende)\s+woche\b/.test(t) ? 'next' : 'this', area: null } };
  }
  return null;
}
// Ganzer Text (auch mehrere Zeilen, z. B. von Siri) → { items, rest }
function quickNote(text) {
  const lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const items = [], rest = [];
  const FULL = { mo: 'montag', di: 'dienstag', mi: 'mittwoch', do: 'donnerstag', fr: 'freitag', sa: 'samstag', so: 'sonntag' };
  for (let line of lines) {
    line = line.replace(/\b(bis|am|ab)\s+(mo|di|mi|do|fr|sa|so)\.?(?=[\s,]|$)/gi, (x, a, d) => a + ' ' + FULL[d.toLowerCase()]);   // „bis Fr“ → „bis Freitag“
    const loc = lines.length === 1 ? null : parseTimeLocal(line);
    const r = (loc && loc.ok ? loc : null) || qnOne(line) || quickParse(line);
    if (r && r.items && r.items.length) r.items.forEach(x => items.push(x)); else rest.push(line);
  }
  return { items, rest };
}
// Kurzfassung für den Morgenbericht ohne KI: gespeicherter Text der Meldung von heute, sonst ein Satz aus den Daten
function briefLocal() {
  const t = todayISO();
  if (S.brief && S.brief.date === t && S.brief.text) return S.brief;
  const bl = blocksOn(t).filter(b => b.kind !== 'holiday'), bk = taskBuckets(), due = bk.over.length + bk.today.length;
  const timed = bl.filter(b => b.start), h = dayHours(bl), off = bl.some(b => b.kind === 'off');
  let kurz;
  if (off && !timed.length) kurz = 'Heute ist frei.';
  else if (!timed.length) kurz = 'Heute stehen keine festen Termine an.';
  else kurz = (h >= 8 ? 'Voller Tag' : h >= 5 ? 'Gut gefüllter Tag' : 'Entspannter Tag') + ' mit ' + timed.length + (timed.length === 1 ? ' Termin' : ' Terminen') + ', los geht es um ' + timed[0].start + ' Uhr.';
  if (bk.over.length) kurz += ' ' + bk.over.length + (bk.over.length === 1 ? ' Aufgabe ist' : ' Aufgaben sind') + ' überfällig.';
  else if (due) kurz += ' ' + due + (due === 1 ? ' Aufgabe ist' : ' Aufgaben sind') + ' heute dran.';
  return { date: t, kurz, at: null, local: true };
}
function cleanItem(x) {
  if (x && ['time', 'habit', 'habitlog'].includes(x.type)) return cleanSpecial(x);
  const type = ['task', 'event', 'shopping', 'idea', 'memory', 'waiting', 'expense'].includes(x && x.type) ? x.type : 'task';
  if (type === 'expense') { const a = Math.round(Math.abs(Number(String(x.amount ?? '').replace(',', '.'))) * 100) / 100; const dd = typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= todayISO() ? x.date : todayISO(); return { type, title: String(x.title || '').trim().slice(0, 120) || 'Ausgabe', amount: a > 0 && a < 100000 ? a : null, cat: String(x.cat || '').trim().slice(0, 40) || 'Sonstiges', date: dd }; }
  const d = typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null;
  const hm = v => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : null;
  const it = { type, title: String(x.title || '').trim().slice(0, 200) || 'Ohne Titel', date: type === 'task' || type === 'event' ? d : null,
    start: type === 'event' ? hm(x.start) : null, end: type === 'event' ? hm(x.end) : null, place: type === 'event' && x.place ? String(x.place).slice(0, 120) : null,
    area: AREAS[x.area] ? x.area : null };
  if (type === 'event' && !it.date) it.date = todayISO();
  if (type === 'event' && typeof x.dateEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.dateEnd) && x.dateEnd > it.date) it.dateEnd = x.dateEnd;
  if (type === 'shopping') it.aisle = AISLES.includes(x.aisle) ? x.aisle : guessAisle(it.title);
  if (type === 'waiting') { it.since = todayISO(); it.followUp = typeof x.followUp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.followUp) && x.followUp >= todayISO() ? x.followUp : addDays(todayISO(), 5); if (x.who) it.who = String(x.who).slice(0, 80); }
  if (type === 'event' && (x.outside === true || x.outside === 'true' || x.outside === '1')) it.outside = '1';
  if (type === 'event' && x.remind != null && x.remind !== '' && /^\d{1,4}$/.test(String(x.remind)) && Number(x.remind) <= 10080) it.remind = String(Number(x.remind));
  if (type === 'task' && typeof x.remind === 'string' && /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(x.remind)) { it.remindAt = x.remind.slice(0, 11) + x.remind.slice(11).padStart(5, '0').slice(0, 5); if (!it.date) it.date = it.remindAt.slice(0, 10); }
  if (type === 'task' && REPEATS.some(([v]) => v && v === x.repeat)) { it.repeat = x.repeat; if (!it.date) it.date = todayISO(); }
  return it;
}
async function ask(text, opts = {}) {
  text = text.trim();
  if (!text || S.busy) return;
  const qm = text.match(/was (?:schaffe|kann|mache) ich in (\d{1,3}) ?min/i);
  if (qm) { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Hier sind Sachen, die in ' + qm[1] + ' Minuten passen.' }]); clearComposers(); S.replan = null; S.quick = { min: Math.max(5, Math.min(240, Number(qm[1]))), ctx: S.quickCtx || '' }; render(); return; }
  const nm = /\b(?:gerade|jetzt|ab jetzt)\b/i.test(text) && /^(?:ich\s+)?(?:bin|mache|arbeite|lerne|starte|fange)\b|^(?:jetzt|gerade)\b/i.test(text) && text.length < 80 && !/\d{1,2}[:.]\d{2}|\d+\s*(?:std|stunden|min)/i.test(text) ? guessCat(text) : null;
  if (nm) { const cat = nm.cat, sub = nm.sub; await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Okay, die Uhr für ' + catName(cat, sub) + ' läuft. Tipp oben auf Stopp, wenn du fertig bist.' }]); clearComposers(); await nowSwitch(cat, sub); return; }
  if (/^(?:ich\s+)?(?:bin\s+)?(?:fertig|feierabend|schluss)\b/i.test(text) && S.focus && S.focus.mode === 'track') { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Gestoppt und gespeichert.' }]); clearComposers(); await stopFocus('manual'); return; }
  const fromNote = opts.noteIds || opts.noteId || null;
  const confirm = (items, reply) => {
    S.pending = { text, reply: reply || '', items, fromNote }; render();
    if (opts.voice || S.settings.speak) speak((reply ? reply + ' ' : '') + 'Bitte kurz bestätigen.');
    setTimeout(() => { const f = document.querySelector('.sheet input, .sheet select'); f && f.focus(); }, 0);
  };
  // Feste Befehle
  const act = text.length < 160 ? qnAction(text) : null;
  if (act && act.kind === 'mailclean' && !mcp) { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Gmail ist noch nicht verbunden.' }]); clearComposers(); return; }
  if (act && act.kind === 'mailclean') { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Ich suche Werbung und Spam heraus. Du entscheidest, was gelöscht wird.' }]); clearComposers(); go('mail'); cleanScan(); return; }
  if (act && act.kind === 'plan') { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Ich rechne nach, wo das reinpasst.' }]); clearComposers(); openPPlan(act.plan); return; }
  if (act && act.kind === 'replan') { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: 'Okay, wir planen den Rest neu.' }]); clearComposers(); openReplan(); return; }
  // Zeiten per Satz („heute 4 Std. gearbeitet“)
  const loc = parseTimeLocal(text);
  if (loc) { confirm(loc.items); return; }
  // Aufgaben, Termine, Einkauf, Ideen, Warte auf, Ausgaben, Erinnerungen, Wiederholungen
  const qn = quickNote(text);
  if (qn.items.length) {
    qn.rest.forEach(l => qn.items.push(l.split(' ').length <= 3 && guessAisle(l) !== 'Sonstiges' ? { type: 'shopping', title: cap1(l).slice(0, 120), aisle: guessAisle(l) } : { type: 'task', title: cap1(l).slice(0, 200), date: null, start: null, end: null, place: null, area: null }));
    confirm(qn.items, qn.rest.length ? 'Nicht sicher erkannt: „' + qn.rest.join('“, „').slice(0, 200) + '“. Bitte prüf die Art, bevor du übernimmst.' : '');
    return;
  }
  // Kurze Fragen zu Terminen, Aufgaben, Wetter, Einkauf und Woche
  const ans = !fromNote && qnAnswer(text);
  if (ans) { await pushChat([{ role: 'me', text }, { role: 'jarvis', text: ans }]); clearComposers(); if (opts.voice || S.settings.speak) speak(ans); return; }
  await saveAsNote(text, fromNote, fromNote ? 'Das konnte ich nicht zuordnen. Es bleibt im Eingangskorb. Tipp darauf, um es selbst einzusortieren.' : null);
}
async function saveAsNote(text, existingId, msg) {
  if (!existingId || Array.isArray(existingId)) { if (!existingId) await withRetry(() => store.setItem({ id: uid(), type: 'note', title: text, createdAt: new Date().toISOString() })); }
  await pushChat([{ role: 'me', text }, { role: 'jarvis', text: msg || 'Als Notiz im Eingangskorb gespeichert.' }]);
  clearComposers();
  showToast(msg ? 'Als Notiz gespeichert.' : 'Im Eingangskorb gespeichert.');
}
async function pushChat(msgs) {
  const log = [...S.chat, ...msgs.map(m => ({ ...m, at: new Date().toISOString() }))].slice(-40);
  S.chat = log; render();
  try { await withRetry(() => store.setChat(log)); } catch (e) {}
}
function clearComposers() { document.querySelectorAll('[data-keep^="ask-"]').forEach(el => { el.value = ''; }); }

async function confirmPending() {
  const p = S.pending; if (!p) return;
  const created = [];
  const noteSnap = [].concat(p.fromNote || []).map(id => S.items.find(i => i.id === id)).filter(Boolean);
  const ts = new Date().toISOString();
  let sp = { lines: [], restore: [], created: [] };
  const SPECIAL = ['time', 'habit', 'habitlog'];
  try {
    if (p.items.some(i => SPECIAL.includes(i.type))) sp = await saveSpecial(p.items.filter(i => SPECIAL.includes(i.type)));
    for (const raw of p.items.filter(i => !SPECIAL.includes(i.type))) {
      delete raw.key; delete raw.partOf;
      const it = { ...raw, id: uid(), createdAt: ts, done: false };
      if (it.type === 'event' && it.area === 'arbeit' && it.start && it.end && /arbeit|homeoffice|home-office|büro/i.test(it.title + ' ' + (it.place || ''))) { it.type = 'work'; it.place = String(it.place || (/büro/i.test(it.title) ? 'Büro' : 'Homeoffice')).replace(/Home-Office/gi, 'Homeoffice'); }   // Arbeitszeit zählt als Arbeitsblock
      if (it.type === 'memory') { it.source = it.source || 'gespräch'; it.confirmed = true; }
      Object.keys(it).forEach(k => { if (it[k] === null || it[k] === '') delete it[k]; });
      await withRetry(() => store.setItem(it));
      created.push(it);
      if (CAL_TYPES.includes(it.type)) calSync(it);
    }
    for (const nid of [].concat(p.fromNote || [])) await withRetry(() => store.delItem(nid));
  } catch (e) {
    showToast(e && e.code === 'quota_exceeded' ? 'Speicher voll: Bitte alte Einträge löschen.' : 'Speichern fehlgeschlagen. Bitte nochmal versuchen.');
    return;
  }
  const n = created.length + sp.lines.length;
  if (!n) { showToast('Nichts gespeichert: Bitte Bereich und Dauer angeben.'); return; }
  const summ = created.map(i => '• ' + i.title + (i.date ? ' (' + relDay(i.date) + (i.start ? ' ' + i.start : '') + ')' : '')).concat(sp.lines).join('\n');
  await pushChat([{ role: 'me', text: p.text }, { role: 'jarvis', text: 'Eingetragen:\n' + summ }]);
  logAct('Eingetragen: ' + created.map(i => i.title).concat(sp.lines.map(l => l.slice(2))).join(', '), { created: created.map(i => i.id).concat(sp.created), restore: noteSnap.concat(sp.restore) });
  if (p.mailIdx != null && S.mail && S.mail.items && S.mail.items[p.mailIdx]) { const m = { ...S.mail, items: S.mail.items.map((x, i) => i === p.mailIdx ? { ...x, todoDone: true } : x) }; S.mail = m; try { await store.setMeta('mail', m); } catch (e) {} }
  const restoreNotes = [].concat(p.fromNote || []).map(id => S.items.find(i => i.id === id)).filter(Boolean);
  S.pending = null; clearComposers();
  showToast(n === 1 ? '1 Eintrag gespeichert.' : n + ' Einträge gespeichert.', async () => {
    for (const it of created) await removeItem(S.items.find(x => x.id === it.id) || it);
    for (const id of sp.created) { const it = S.items.find(x => x.id === id); if (it) await removeItem(it); }
    await restoreDays(sp.restore);
    for (const n of restoreNotes) await store.setItem(n);
    pushChat([{ role: 'jarvis', text: 'Rückgängig gemacht.' }]);
  });
}

/* ===================== Toast ===================== */
let toastTimer = null;
function showToast(text, undo) {
  let ms = null; if (typeof undo === 'number') { ms = undo; undo = null; }
  clearTimeout(toastTimer);
  S.toast = { text, undo: undo || null }; render();
  toastTimer = setTimeout(() => { S.toast = null; render(); }, ms || (undo ? 9000 : 3500));
}

/* ===================== Sicherung ===================== */
async function backup() {
  const data = JSON.stringify({ app: 'Jarvis', version: 2, exportedAt: new Date().toISOString(), settings: S.settings, items: S.items, chat: S.chat, team: S.team, finance: S.finance }, null, 2);
  const name = 'jarvis-sicherung-' + todayISO() + '.json';
  if (downloads) {
    try { await downloads.save({ filename: name, data }); showToast('Sicherung gespeichert.'); }
    catch (e) { if (e && e.code !== 'declined') showToast('Herunterladen ist hier nicht möglich.'); }
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
  }
}
async function restore(file) {
  try {
    const o = JSON.parse(await file.text());
    if (!o || o.app !== 'Jarvis' || !Array.isArray(o.items)) throw new Error('format');
    const existing = new Set(S.items.map(i => i.id));
    const fresh = o.items.filter(i => i && i.id && !existing.has(i.id));
    // Nur fehlende Einträge ergänzen – vorhandene bleiben unverändert, nichts wird gelöscht
    for (const it of fresh) await withRetry(() => store.setItem(it));
    if (o.team && !S.team) await store.setMeta('team', o.team);
    if (o.finance && !S.finance) await store.setMeta('finance', o.finance);
    showToast(fresh.length ? fresh.length + ' fehlende Einträge wiederhergestellt.' : 'Alles schon vorhanden, nichts geändert.');
  } catch (e) { showToast('Diese Datei ist keine gültige Jarvis-Sicherung.'); }
}


