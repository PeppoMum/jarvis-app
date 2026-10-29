'use strict';
/* Jarvis-App – 07-wetter-mail.js (aus Jarvis in Claude, Zeilen 3289–3515 von V48) */
/* ===================== Stufe 4: Wetter & Mail ===================== */
function wxDay(iso) { return S.weather && (S.weather.daily || []).find(w => w.date === iso) || null; }
function rainAt(iso, hm) {
  if (!S.weather) return null;
  const h = Number(String(hm).slice(0, 2));
  const hr = (S.weather.hourly || []).find(x => x.date === iso && x.hour === h);
  if (hr) return hr.rain;
  const d = wxDay(iso); if (!d) return null;
  return h >= 18 ? d.rainNight : d.rain;
}
const wxNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
async function fetchWeather() {
  if (!mcp || !S.settings.wxKey) return;
  const q = { queryParams: { locationKey: String(S.settings.wxKey), unit: 'metric', lang: 'de' } };
  try {
    const [d, h] = await Promise.all([
      mcp.callTool(WX, 'widgets-daily-claude', q, { cache: { gcTime: 1800000, staleTime: 1800000 } }),
      mcp.callTool(WX, 'widgets-hourly-claude', q, { cache: { gcTime: 1800000, staleTime: 1800000 } })
    ]);
    const dp = d && d.payload, hp = h && h.payload;
    const daily = ((dp && dp.dailyForecast) || []).map(x => {
      const pd = parseGTime(x.date); if (!pd) return null;
      return { date: pd.date, hi: Math.round(wxNum(x.day && x.day.temperature) ?? 0), lo: Math.round(wxNum(x.night && x.night.temperature) ?? 0), phrase: String((x.day && (x.day.iconPhrase || x.day.phrase)) || '').slice(0, 60), rain: Math.round(wxNum(x.day && x.day.rainProbabilityValue) ?? wxNum(x.day && x.day.precip) ?? 0), rainNight: Math.round(wxNum(x.night && x.night.rainProbabilityValue) ?? 0) };
    }).filter(Boolean);
    const hourly = ((hp && hp.hourlyForecast) || []).map(x => { const pd = parseGTime(x.date); return pd ? { date: pd.date, hour: Number(pd.time.slice(0, 2)), temp: Math.round(wxNum(x.temperatureValue) ?? 0), rain: Math.round(wxNum(x.extended && x.extended.rainProbability) ?? wxNum(x.precip) ?? 0), phrase: String(x.phrase || '') } : null; }).filter(Boolean);
    if (daily.length || hourly.length) { S.weather = { daily, hourly, at: Date.now() }; render(); }
  } catch (e) { /* Wetter ist optional */ }
  fetchAlerts();
}
// Amtliche Unwetterwarnungen (DWD über AccuWeather). Felder der Warnungen sind nicht fest dokumentiert, darum vorsichtig lesen.
const alStr = v => typeof v === 'string' ? v.trim() : v && typeof v === 'object' ? alStr(v.localized || v.text || v.english || v.value || v.name || '') : '';
function alertInfo(a) {
  if (!a || typeof a !== 'object') return null;
  const area = Array.isArray(a.area) ? a.area[0] || {} : a.area || {};
  const title = ['headline', 'title', 'description', 'name', 'category', 'type', 'event', 'text'].map(k => alStr(a[k])).find(Boolean) || alStr(area.summary) || alStr(area.text);
  if (!title) return { title: 'Amtliche Wetterwarnung (Details in deiner Wetter-App)', sev: '', until: '' };   // Feldnamen unbekannt: lieber allgemein warnen als gar nicht
  const sev = ['severity', 'level', 'priority', 'class', 'color'].map(k => alStr(String(a[k] ?? ''))).find(Boolean) || '';
  const endRaw = alStr(a.endTime || a.end || a.expires || a.validUntil || area.endTime || area.end || '');
  const ed = endRaw && !isNaN(Date.parse(endRaw)) ? new Date(endRaw) : null;
  return { title: title.replace(/\s+/g, ' ').slice(0, 160), sev: sev.slice(0, 30), until: ed ? (isoDate(ed) === todayISO() ? '' : fmtShort(isoDate(ed)) + ' ') + pad(ed.getHours()) + ':' + pad(ed.getMinutes()) : '' };
}
async function fetchAlerts() {
  if (!mcp || !S.settings.wxKey) return;
  try {
    const r = await mcp.callTool(WX, 'widgets-gov-alert-map-claude', { queryParams: { LocationKey: String(S.settings.wxKey), lang: 'de' } }, { cache: { gcTime: 1800000, staleTime: 1800000 } });
    const raw = (r && r.payload && (r.payload.alerts || r.payload.Alerts)) || [];
    const list = (Array.isArray(raw) ? raw : []).map(alertInfo).filter(Boolean);
    if (list.length && (!S.wxAlertSeen || S.wxAlertSeen !== todayISO())) { S.wxAlertSeen = todayISO(); try { store.setMeta('wxalert', { at: new Date().toISOString(), raw: JSON.stringify(raw).slice(0, 4000) }); } catch (e) {} }   // einmal am Tag merken, wie eine echte Warnung aussieht
    const seen = new Set(), real = list.filter(x => x.sev || x.until || !/^Amtliche Wetterwarnung \(/.test(x.title)); S.wxAlerts = (real.length ? real : list.slice(0, 1)).filter(x => !seen.has(x.title) && seen.add(x.title)).slice(0, 4); render();
  } catch (e) { S.wxAlerts = null; /* optional: ohne Freigabe einfach keine Warnungen */ }
}
async function searchWeatherPlace(q) {
  if (!mcp || !q) return;
  try {
    const r = await mcp.callTool(WX, 'widgets-search-claude', { queryParams: { query: q } }, { cache: false });
    const res = (r && r.payload && r.payload.results) || [];
    if (!res.length) { showToast('Ort nicht gefunden.'); return; }
    const best = res[0];
    S.settings = { ...S.settings, wxKey: String(best.locationKey), wxName: String(best.name || q).replace(/, .*$/, '') };
    await store.setSettings(S.settings); S.weather = null; fetchWeather(); showToast('Wetter für ' + S.settings.wxName + '.'); render();
  } catch (e) { showToast('Wetter-Suche gerade nicht möglich.'); }
}
async function gmailThreads(query, size) {
  const r = await mcp.callTool(GMAIL, 'search_threads', { query, pageSize: Math.min(50, size || 30), view: 'THREAD_VIEW_MINIMAL' }, { cache: false });
  const pl = r && r.payload, arr = (pl && pl.threads) || [];
  return arr.map(t => {
    const ms = t.messages || [], m = ms[ms.length - 1] || {}, f = ms[0] || m;
    const labels = Array.from(new Set(ms.flatMap(x => x.labelIds || [])));
    return { id: t.id, from: String(f.sender || m.sender || '').slice(0, 100), subject: String(f.subject || m.subject || '(ohne Betreff)').slice(0, 160), snippet: String(m.snippet || f.snippet || '').replace(/\s+/g, ' ').slice(0, 200), date: m.date || f.date || '', count: t.messageCount || ms.length, labels, url: t.viewUrl || '' };
  }).filter(t => t.id);
}
// Wichtig / unwichtig: alte Zusammenfassungen (ohne v:2) kannten nur wichtige Mails
const mailImp = x => x.imp !== false;
const mailOpen = m => (m && m.items || []).map((x, i) => [x, i]).filter(([x]) => !x.hidden);
function mailFrom(f) { f = String(f || '').trim(); const n = f.match(/^"?([^"<]+?)"?\s*<[^>]+>$/); return n ? n[1].trim() : f; }
function mailLine(m) {
  if (!m) return '';
  const o = mailOpen(m), a = o.filter(([x]) => mailImp(x)).length, b = o.length - a;
  if (!m.v) return a ? a + ' wichtige' + (a === 1 ? ' Mail' : ' Mails') : (m.text || 'Keine wichtigen Mails');
  if (!o.length) return 'Alles erledigt';
  return (a ? a + ' wichtige' : 'Keine wichtigen') + ', ' + (b ? b + ' unwichtige' : 'keine unwichtigen');
}
function mailRow(x, i) {
  return '<div class="mailitem' + (mailImp(x) ? '' : ' mun') + '"><button class="mx" data-mailhide="' + i + '" aria-label="Aus der Ansicht entfernen" title="Aus der Ansicht entfernen">✕</button>' + esc(x.subject) + '<small>' + esc(x.from || '') + (x.kind && !mailImp(x) ? ' · ' + esc(x.kind) : '') + (x.why ? ' · ' + esc(x.why) : '') + '</small>' +
    (S.mailDel === i ? '<div class="mailacts mdelq"><span>In den Gmail-Papierkorb legen?</span><button class="btn sm primary" data-maildelok="' + i + '">Ja, löschen</button><button class="btn ghost sm" data-maildelno="1">Nein</button></div>' :
    (x.todo && !x.todoDone) || x.reply || x.url || x.threadId ? '<div class="mailacts">' + (x.todo && !x.todoDone ? '<button class="btn sm" data-mailtodo="' + i + '">Als Aufgabe' + (x.todo.date ? ' (bis ' + esc(relDay(x.todo.date)) + ')' : '') + '</button>' : '') + (x.todo && x.todoDone ? '<span class="tag">Aufgabe eingetragen</span>' : '') + (x.reply && mcp ? '<button class="btn sm" data-maildraft="' + i + '">Antwort entwerfen</button>' : '') + (x.threadId ? '<button class="btn ghost sm" data-mailflip="' + i + '" title="Jarvis merkt sich den Absender">' + (mailImp(x) ? 'Ist unwichtig' : 'Ist wichtig') + '</button>' : '') + (x.url ? '<a class="btn ghost sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">Öffnen</a>' : '') + (x.threadId ? '<button class="btn ghost sm mdel" data-maildel="' + i + '">Löschen</button>' : '') + '</div>' : '') + '</div>';
}
/* ----- Mails nach festen Regeln sortieren (ohne KI) ----- */
// Reihenfolge: deine eigenen Regeln („Absender immer wichtig/unwichtig“) → Gmail-Kategorien → Absender → Stichwörter.
const MAIL_KW = [
  ['Uni', 8, /uni-due|uni duisburg|universität|moodle|\blsf\b|klausur|prüfung|seminar|vorlesung|hausarbeit|modul|semester|immatrikul|rückmeldung zum|studierendensekretariat|prüfungsamt|dozent|lehrstuhl|übungsblatt|tutorium|\bnote\b|noten|bafög/],
  ['Arbeit', 8, /dienstplan|schicht|gehalt|lohnabrechnung|arbeitsvertrag|personalabteilung|zeiterfassung|stundenzettel|urlaubsantrag|krankmeldung|vorgesetzt|team-?meeting|besprechung/],
  ['Rechnung', 7, /rechnung|mahnung|zahlungserinnerung|lastschrift|zahlung fehlgeschlagen|offener betrag|beitrag|rundfunkbeitrag|steuer|finanzamt/],
  ['Frist', 7, /\bfrist\b|deadline|bis spätestens|letzte erinnerung|abgabe|einreichen|rückmeldung bis|bitte bis|fällig/],
  ['Vertrag', 6, /vertrag|kündigung|vertragsänderung|preiserhöhung|versicherung|krankenkasse|vermieter|nebenkosten|miete/],
  ['Sicherheit', 8, /sicherheitswarnung|neue anmeldung|passwort (?:wurde )?geändert|verdächtige|bestätigungscode|zwei-faktor|2fa|konto gesperrt/],
  ['Termin', 5, /termin|einladung|treffen|verschoben|abgesagt|absage|terminbestätigung/]];
const MAIL_UNKW = [
  ['Werbung', /angebot|rabatt|\d+\s?%|sale\b|gutschein|deal|nur heute|black friday|cyber monday|jetzt kaufen|gratis|kostenlos testen|exklusiv für dich|sonderaktion|aktion\b/],
  ['Newsletter', /newsletter|abbestellen|unsubscribe|wöchentliche|monatliche|digest|neuigkeiten|news\b/],
  ['Hinweis', /versandbestätigung|wurde versandt|ist unterwegs|zugestellt|bestellbestätigung|deine bestellung|ihre bestellung|lieferung|paket|quittung|beleg|kontoauszug ist da|ihr konto|dein konto|willkommen bei|bestätige deine|verify|benachrichtigung|erinnerung an deinen|bewertung|wie war|umfrage/]];
const MAIL_BOT = /(?:^|[<\s"])(?:no-?reply|do-?not-?reply|donotreply|noreply|newsletter|news|info|marketing|mailer|notification|notifications|benachrichtigung|service|kundenservice|support|hello|hallo|team|shop|mailing|updates?|alert)[._-]?[a-z0-9]*@/i;
const MAIL_FREE = /@(?:gmail|googlemail|web|gmx|icloud|me|mac|outlook|hotmail|live|t-online|yahoo|aol|posteo|freenet|mailbox)\.[a-z.]+/i;
const mailAddr = f => (String(f || '').match(/[^\s<>"',;]+@[^\s<>"',;]+/) || [''])[0].toLowerCase();
const mailDom = a => a.split('@')[1] || '';
function mailRules() { const r = S.settings.mailRules || {}; return { imp: Array.isArray(r.imp) ? r.imp : [], un: Array.isArray(r.un) ? r.un : [] }; }
const mailRuleHit = (list, a) => list.some(x => x && (a === x || (x.startsWith('@') ? a.endsWith(x) : false)));
function mailTodoFrom(th, text) {
  // Aufgabe nur bei klarer Frist im Betreff oder in der Vorschau („bis 15.11.“, „bis Freitag“, „fällig am …“)
  const m = text.match(/\b(?:bis(?:\s+(?:zum|spätestens|einschließlich))?|fällig\s+(?:am|bis)|frist[:\s]+(?:ist\s+)?(?:der\s+)?|abgabe(?:\s+am|\s+bis)?|deadline[:\s]+)\s*((?:(?:mo|di|mi|do|fr|sa|so)\w*,?\s*(?:den\s+)?)?\d{1,2}\.\d{1,2}\.(?:\d{2,4})?|morgen|übermorgen|heute|(?:nächsten\s+|kommenden\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|ende der woche|ende des monats)/i);
  const bill = /rechnung|mahnung|zahlungserinnerung|offener betrag/i.test(text);
  if (!m && !bill) return null;
  let date = null;
  if (m) { const w = m[1].toLowerCase(); if (w === 'ende der woche') date = addDays(mondayOf(todayISO()), 4); else if (w === 'ende des monats') { const d = dObj(todayISO()); date = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); } else { const q = qpDate(w.replace(/^(?:mo|di|mi|do|fr|sa|so)\w*,?\s*(?:den\s+)?(?=\d)/, '')); date = q ? q.date : null; } }
  const subj = String(th.subject || '').replace(/^(?:re|aw|wg|fwd?):\s*/i, '').slice(0, 120);
  return { title: (bill && !m ? 'Rechnung prüfen und bezahlen: ' : '') + subj, date };
}
function mailClassify(th) {
  const a = mailAddr(th.from), dom = mailDom(a), L = th.labels || [], R = mailRules();
  const text = (th.subject + ' ' + th.snippet).toLowerCase(), name = mailFrom(th.from);
  const out = (imp, kind, why) => ({ imp, kind, why });
  let res;
  if (mailRuleHit(R.imp, a)) res = out(true, 'Deine Regel', 'Absender ist bei dir als wichtig gemerkt');
  else if (mailRuleHit(R.un, a)) res = out(false, 'Deine Regel', 'Absender ist bei dir als unwichtig gemerkt');
  else if (L.includes('SPAM')) res = out(false, 'Spam', 'von Gmail als Spam erkannt');
  else {
    const hit = MAIL_KW.filter(([, , re]) => re.test(text)), un = MAIL_UNKW.find(([, re]) => re.test(text));
    const bot = MAIL_BOT.test('<' + a), person = !bot && MAIL_FREE.test(a) && /\s/.test(name), uni = /uni-due\.de$|uni-duisburg-essen\.de$/.test(dom);
    let score = hit.reduce((s, [, n]) => s + n, 0) + (uni ? 8 : 0) + (person ? 6 : 0) + (L.includes('STARRED') ? 6 : 0) + (L.includes('IMPORTANT') ? 2 : 0);
    if (L.includes('CATEGORY_PROMOTIONS')) score -= 9; if (L.includes('CATEGORY_SOCIAL')) score -= 6; if (L.includes('CATEGORY_FORUMS')) score -= 4; if (L.includes('CATEGORY_UPDATES')) score -= 3;
    if (bot) score -= 3; if (un) score -= un[0] === 'Hinweis' ? 3 : 6;
    if (hit.some(([k]) => k === 'Sicherheit') && bot) score += 6;   // Sicherheitswarnungen kommen fast immer von noreply-Adressen
    const kind = score >= 5 ? (uni ? 'Uni' : hit.length ? hit[0][0] : person ? 'Persönlich' : 'Wichtig') : un ? un[0] : L.includes('CATEGORY_PROMOTIONS') ? 'Werbung' : L.includes('CATEGORY_SOCIAL') ? 'Soziale Netze' : bot ? 'Hinweis' : 'Sonstiges';
    const why = score >= 5 ? (uni ? 'von der Uni' : hit.length ? 'Stichwort ' + (text.match(hit[0][2]) || [''])[0] : person ? 'von einer Person' : 'von Gmail markiert') : un ? 'Stichwort ' + (text.match(un[1]) || [''])[0] : bot ? 'automatische Mail' : 'nichts Wichtiges erkannt';
    res = out(score >= 5, kind, why);
  }
  if (res.imp) {
    const td = mailTodoFrom(th, th.subject + ' ' + th.snippet); if (td) res.todo = td;
    if (!MAIL_BOT.test('<' + a) && /\?|rückmeldung|bescheid|antwort|antworte|melde dich|meld dich|bitte um|kannst du|könntest du|können sie|könnten sie|würden sie/i.test(th.subject + ' ' + th.snippet)) res.reply = true;
  }
  return res;
}
// Absender als immer wichtig / unwichtig merken und die Mail sofort umsortieren
async function mailFlip(i) {
  const m = S.mail; if (!m || !m.items || !m.items[i]) return;
  const x = m.items[i], a = x.addr || '', imp = !mailImp(x);
  if (a) { const R = mailRules(), drop = l => l.filter(y => y !== a); S.settings = { ...S.settings, mailRules: imp ? { imp: drop(R.imp).concat(a).slice(-200), un: drop(R.un) } : { imp: drop(R.imp), un: drop(R.un).concat(a).slice(-200) } }; try { await store.setSettings(S.settings); } catch (e) {} }
  const items = m.items.map((y, k) => k === i || (a && y.addr === a) ? { ...y, imp, kind: 'Deine Regel', why: imp ? 'Absender ist bei dir als wichtig gemerkt' : 'Absender ist bei dir als unwichtig gemerkt' } : y);
  S.mail = { ...m, items }; S.mail.text = mailLine(S.mail);
  try { await store.setMeta('mail', S.mail); } catch (e) {}
  render(); showToast(a ? 'Gemerkt: Mails von ' + a + ' sind ab jetzt ' + (imp ? 'wichtig.' : 'unwichtig.') : 'Umsortiert.');
}
function mailBox() {
  if (!mcp) return '';
  const t = todayISO(), m = S.mail && S.mail.date === t ? S.mail : null;
  const o = mailOpen(m), imp = o.filter(([x]) => mailImp(x)), un = o.filter(([x]) => !mailImp(x)), canDel = un.filter(([x]) => x.threadId).length;
  const grp = (cls, name, list, extra, ask) => '<div class="mgrp ' + cls + '"><div class="mgh"><h4>' + name + ' <span>' + list.length + '</span></h4>' + (extra || '') + '</div>' + (ask || '') + list.map(([x, i]) => mailRow(x, i)).join('') + '</div>';
  return '<div class="mbox" style="border-top:1px solid var(--ln);padding-top:12px"><div class="row" style="justify-content:space-between"><h3 class="label" style="margin:0">Mails</h3><button class="btn ghost" data-act="mail"' + (S.mailBusy ? ' disabled' : '') + '>' + (S.mailBusy ? 'Lese Mails …' : (m ? 'Aktualisieren' : 'Sortieren')) + '</button></div>' +
    (m ? '<p class="sub mline" style="margin:6px 0">' + esc(mailLine(m)) + '</p>' +
      (!m.v && !o.length && /unwichtig/.test(m.text || '') ? '<p class="sub">Tippe auf „Aktualisieren“, dann siehst du auch die unwichtigen Mails einzeln.</p>' : '') +
      (o.length ? '' : '<p class="empty">Alles erledigt. Keine Mails mehr offen.</p>') +
      (imp.length || un.length ? grp('mimp', 'Wichtig', imp) : '') +
      (un.length ? grp('mun', 'Unwichtig', un, canDel ? (S.mailBulk ? '' : '<button class="btn ghost sm danger" data-mailbulk="1">Alle ' + canDel + ' löschen</button>') : '',
        S.mailBulk && canDel ? '<div class="mailacts mdelq mbulkq"><span>Diese ' + canDel + ' unwichtigen Mails in den Gmail-Papierkorb legen? Dort bleiben sie 30 Tage.</span><button class="btn sm primary" data-mailbulkok="1">Ja, alle löschen</button><button class="btn ghost sm" data-mailbulkno="1">Nein</button></div>' : '') : '')
      : '<p class="sub mdesc" style="margin:6px 0">Privat-Mail und (per Weiterleitung) Uni-Mail der letzten 24 Stunden, nach festen Regeln in wichtig und unwichtig sortiert. Liegt eine Mail falsch, tipp auf „Ist wichtig“ oder „Ist unwichtig“. Dann merkt sich Jarvis den Absender.</p>') + '<a href="#mail" data-go="mail" class="sub mspam">Werbung &amp; Spam aufräumen →</a></div>';
}

// Mails aus der Ansicht nehmen (sofort) oder in den Gmail-Papierkorb legen (erst nach „Ja, löschen“, mit Rückgängig)
async function mailSetHidden(i, on) {
  const m = S.mail; if (!m || !m.items || !m.items[i]) return;
  const x = m.items[i], hid = (m.hid || []).filter(id => id !== x.threadId);
  if (on && x.threadId) hid.push(x.threadId);
  S.mail = { ...m, hid, items: m.items.map((y, k) => k === i ? { ...y, hidden: on } : y) };
  try { await store.setMeta('mail', S.mail); } catch (e) {}
  render();
}
async function mailSetHiddenMany(idx, on) {
  const m = S.mail; if (!m || !m.items) return;
  const ids = idx.map(i => m.items[i] && m.items[i].threadId).filter(Boolean);
  const hid = (m.hid || []).filter(id => !ids.includes(id)).concat(on ? ids : []);
  S.mail = { ...m, hid, items: m.items.map((y, k) => idx.includes(k) ? { ...y, hidden: on } : y) };
  try { await store.setMeta('mail', S.mail); } catch (e) {}
  render();
}
async function mailTrashUnimportant() {
  S.mailBulk = false;
  const m = S.mail; if (!m || !m.items || !mcp) { render(); return; }
  const list = m.items.map((x, i) => [x, i]).filter(([x]) => !x.hidden && !mailImp(x) && x.threadId && siriSubj(x.subject) == null);
  if (!list.length) { render(); return; }
  showToast('Lege ' + list.length + ' Mails in den Papierkorb …');
  const done = [];
  for (const [x, i] of list) { try { await mcp.callTool(GMAIL, 'trash_thread', { threadId: x.threadId }, { cache: false }); done.push([x, i]); } catch (e) {} }
  if (!done.length) { render(); showToast('Löschen ging gerade nicht. Gmail ist nicht erreichbar.'); return; }
  await mailSetHiddenMany(done.map(d => d[1]), true);
  logAct(done.length + (done.length === 1 ? ' unwichtige Mail' : ' unwichtige Mails') + ' in den Gmail-Papierkorb gelegt: ' + done.slice(0, 5).map(d => d[0].subject).join(', ') + (done.length > 5 ? ' …' : ''), { untrash: done.map(d => d[0].threadId) });
  showToast(done.length + (done.length === 1 ? ' Mail liegt' : ' Mails liegen') + ' im Gmail-Papierkorb.' + (done.length < list.length ? ' ' + (list.length - done.length) + ' gingen nicht.' : ''), async () => { for (const [x] of done) { try { await mcp.callTool(GMAIL, 'untrash_thread', { threadId: x.threadId }, { cache: false }); } catch (e) {} } await mailSetHiddenMany(done.map(d => d[1]), false); showToast('Wiederhergestellt.'); });
}
async function mailTrash(i) {
  const x = S.mail && S.mail.items && S.mail.items[i]; S.mailDel = null;
  if (!x || !x.threadId || !mcp) { render(); return; }
  try { await mcp.callTool(GMAIL, 'trash_thread', { threadId: x.threadId }, { cache: false }); }
  catch (e) { render(); showToast('Löschen ging gerade nicht. Gmail ist nicht erreichbar.'); return; }
  await mailSetHidden(i, true);
  showToast('Mail liegt im Gmail-Papierkorb.', async () => { try { await mcp.callTool(GMAIL, 'untrash_thread', { threadId: x.threadId }, { cache: false }); } catch (e) {} await mailSetHidden(i, false); showToast('Wiederhergestellt.'); });
}
document.addEventListener('click', async (ev) => {
  const a = ev.target.closest('[data-mailflip],[data-mailhide],[data-maildel],[data-maildelok],[data-maildelno],[data-mailbulk],[data-mailbulkok],[data-mailbulkno]'); if (!a) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (a.dataset.mailflip) return mailFlip(Number(a.dataset.mailflip));
  if (a.dataset.mailhide) { const i = Number(a.dataset.mailhide); if (S.mailDel === i) S.mailDel = null; await mailSetHidden(i, true); showToast('Aus der Ansicht entfernt.', () => mailSetHidden(i, false)); return; }
  if (a.dataset.maildel) { S.mailDel = Number(a.dataset.maildel); render(); return; }
  if (a.dataset.maildelno) { S.mailDel = null; render(); return; }
  if (a.dataset.maildelok) return mailTrash(Number(a.dataset.maildelok));
  if (a.dataset.mailbulk) { S.mailBulk = true; S.mailDel = null; render(); return; }
  if (a.dataset.mailbulkno) { S.mailBulk = false; render(); return; }
  if (a.dataset.mailbulkok) return mailTrashUnimportant();
}, true);
async function summarizeMail() {
  if (!mcp || S.mailBusy) return;
  S.mailBusy = true; render();
  try {
    const hid = S.mail && S.mail.date === todayISO() ? S.mail.hid || [] : [];
    const threads = (await gmailThreads('newer_than:1d -category:promotions -category:social -in:spam', 40)).filter(t => !hid.includes(t.id) && siriSubj(t.subject) == null);
    const items = threads.map(th => {
      const c = mailClassify(th);
      const o = { from: mailFrom(th.from).slice(0, 80), addr: mailAddr(th.from), subject: String(th.subject || '').slice(0, 160), why: c.why.slice(0, 80), kind: c.kind.slice(0, 30), imp: c.imp, threadId: th.id };
      if (th.url) o.url = th.url; if (c.todo) o.todo = c.todo; if (c.reply) o.reply = true; return o;
    });
    items.sort((a, b) => (b.imp ? 1 : 0) - (a.imp ? 1 : 0));
    const doc = { date: todayISO(), at: new Date().toISOString(), hid, v: 2, items }; doc.text = mailLine(doc);
    S.mail = doc;
    if (db) await db.doc('meta/mail').set(doc);
  } catch (e) {
    showToast(e && ['not_granted', 'server_not_connected', 'consent_required', 'not_declared', 'needs_reauth'].includes(e.code) ? 'Gmail ist nicht verbunden. Bitte neu mit Google anmelden.' : 'Mails konnten gerade nicht gelesen werden.');
  }
  S.mailBusy = false; render();
}


/* ===================== Stufe 5: Team ===================== */
const isTeamBlock = b => b.area === 'team' || /training|spiel|turnier|twingame/i.test(b.title || '');
function pendingDebrief() {
  const t = todayISO(), now = hmToMin(nowHM());
  const noted = new Set(byType('teamnote').map(n => n.date + '|' + (n.eventTitle || '')));
  for (const d of [t, addDays(t, -1)]) {
    const evs = blocksOn(d).filter(b => isTeamBlock(b) && b.start && (d < t || (hmToMin(b.end || b.start) ?? 0) + 15 <= now));
    for (const b of evs) if (!noted.has(d + '|' + b.title)) return b;
  }
  return null;
}
function weekKey(iso) { return mondayOf(iso || todayISO()); }
function pageTeam() {
  const t = todayISO(), wk = weekKey(t), team = S.team || {};
  const focus = (team.focus || {})[wk] || '';
  const upcoming = []; for (let i = 0; i < 14; i++) { const d = addDays(t, i); blocksOn(d).filter(isTeamBlock).forEach(b => upcoming.push(b)); }
  const nk = pendingDebrief();
  const notes = byType('teamnote').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
  const mi = S.matchInfo || defaultMatchInfo(upcoming.find(b => /spiel|turnier|twin/i.test(b.title)));
  return '<div class="pagehead"><div><h1 class="page">Team</h1></div><a class="btn" href="https://mannschaftscockpit.de" target="_blank" rel="noopener">Cockpit öffnen</a></div>' +
    '<div class="grid2">' +
    '<div class="col">' +
      (nk ? '<section class="card"><h2 class="label">Nachklapp</h2><form data-form="debrief" data-date="' + esc(nk.date) + '" data-title="' + esc(nk.title) + '" style="display:flex;flex-direction:column;gap:10px"><p style="margin:0">Wie lief <b>' + esc(nk.title) + '</b> (' + esc(relDay(nk.date)) + ', ' + esc(nk.start) + ')?</p>' +
        '<div class="rating" role="group" aria-label="Bewertung">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-rate="' + n + '" aria-pressed="' + (S.rate === n) + '">' + n + '</button>').join('') + '</div>' +
        '<label class="field"><span>Was lief gut, was mitnehmen? (Stichworte reichen)</span><textarea name="note" data-keep="debrief" rows="3"></textarea></label><div class="row"><button class="btn primary" type="submit">Speichern</button><button class="btn ghost" type="button" data-act="debriefskip">Kein Training</button></div></form></section>' : '') +
      '<section class="card"><h2 class="label">Wochenschwerpunkt</h2><form class="addrow" data-form="focus"><label class="sr" for="focus-in">Schwerpunkt dieser Woche</label><input id="focus-in" name="focus" value="' + esc(focus) + '" placeholder="z. B. Pressing nach Ballverlust" autocomplete="off"><button class="btn primary" type="submit">Speichern</button></form><p class="sub" style="margin-top:6px">Aus deinem Zyklusplan im Cockpit. Er erscheint im Tagesablauf beim Training.</p></section>' +
      '<section class="card"><h2 class="label">Nächste 14 Tage</h2>' + (upcoming.length ? upcoming.map(b => '<div class="listrow"><span class="lt">' + esc(b.title) + '<small>' + esc(fmtShort(b.date)) + (b.start ? ', ' + esc(b.start) : '') + (b.place ? ' · ' + esc(b.place) : '') + (rainAt(b.date, b.start || '12:00') >= 50 ? ' · Regen ' + rainAt(b.date, b.start || '12:00') + ' %' : '') + '</small></span></div>').join('') : '<p class="empty">Keine Trainings oder Spiele eingetragen. Schreib Jarvis z. B. „Training Mi 17:30 bis 19 Uhr“.</p>') + '</section>' +
      '<section class="card"><h2 class="label">Trainingsnotizen</h2>' + (notes.length ? notes.map(n => '<div class="listrow"><button class="lt" data-edit="' + esc(n.id) + '">' + esc(n.eventTitle || 'Training') + (n.rating ? ' · ' + '★'.repeat(n.rating) : '') + '<small>' + esc(fmtShort(n.date)) + (n.note ? ' · ' + esc(String(n.note).slice(0, 120)) : '') + '</small></button></div>').join('') : '<p class="empty">Noch keine Notizen.</p>') + '</section>' +
    '</div><div class="col">' +
      '<section class="card"><h2 class="label">Spielinfo für WhatsApp</h2><form data-form="matchinfo" style="display:flex;flex-direction:column;gap:10px"><div class="formgrid">' +
        mf('date', 'Datum', mi.date, 'date') + mf('kind', 'Spielart', mi.kind) + mf('venue', 'Heim/Auswärts', mi.venue, 'select', ['Heim', 'Auswärts']) + mf('opp', 'Gegner', mi.opp) +
        mf('meetTime', 'Treffen um', mi.meetTime, 'time') + mf('meetPlace', 'Treffpunkt', mi.meetPlace) + mf('kickoff', 'Anstoß', mi.kickoff, 'time') + mf('fruit', 'Obst & Gemüse', mi.fruit) + mf('kit', 'Trikots', mi.kit) +
        '</div><div class="wa" aria-label="Vorschau">' + esc(matchText(mi)) + '</div><div class="row"><button class="btn primary" type="button" data-act="copywa">Text kopieren</button><span class="sub">*fett* und _kursiv_ zeigt WhatsApp formatiert an.</span></div></form></section>' +
    '</div></div>';
}
function mf(name, label, val, type, opts) {
  const id = 'mi-' + name;
  if (type === 'select') return '<label class="field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" data-mi="' + name + '">' + opts.map(o => '<option' + (o === val ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>';
  return '<label class="field" for="' + id + '"><span>' + label + '</span><input id="' + id + '" data-mi="' + name + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '"></label>';
}
function defaultMatchInfo(b) {
  return { date: b ? b.date : '', kind: b ? (/turnier/i.test(b.title) ? 'Turnier' : /twin/i.test(b.title) ? 'TwinGame' : 'Meisterschaftsspiel') : 'Meisterschaftsspiel', venue: 'Heim', opp: '', meetTime: '', meetPlace: 'Stauseekampfbahn', kickoff: b && b.start ? b.start : '', fruit: '', kit: '' };
}
function matchText(m) {
  const d = m.date ? WD[dObj(m.date).getDay()] + ', ' + dObj(m.date).getDate() + '. ' + MONL[dObj(m.date).getMonth()] : '[Datum]';
  const vs = m.venue === 'Auswärts' ? (m.opp || '[Gegner]') + ' – TuS Haltern U13' : 'TuS Haltern U13 – ' + (m.opp || '[Gegner]');
  return '⚽ ' + d + '\n' + (m.kind || 'Spiel') + (m.venue ? ' (' + m.venue + ')' : '') + ': ' + vs + '\n\n' +
    '📍 Treffen: ' + (m.meetTime ? m.meetTime + ' Uhr' : '[Uhrzeit]') + ', ' + (m.meetPlace || '[Treffpunkt]') + '\n' +
    '⏱ Anstoß: ' + (m.kickoff ? m.kickoff + ' Uhr' : '[Uhrzeit]') + '\n\n' +
    '*Obst & Gemüse: ' + (m.fruit || '[Familie]') + '*\n' + (m.kit ? '_Trikots: ' + m.kit + '_' : '_Trikots: [folgt]_');
}
