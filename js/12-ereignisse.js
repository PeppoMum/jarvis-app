'use strict';
/* Jarvis-App – 12-ereignisse.js (aus Jarvis in Claude, Zeilen 6431–6836 von V48) */
/* ===================== Ereignisse ===================== */
function go(route) { if (route === 'fokus') route = 'zeiten'; if (route === 'start' || route === 'uebersicht') route = 'heute'; S.route = ROUTES.some(r => r.id === route) ? route : 'heute'; if (location.hash !== '#' + S.route) history.replaceState(null, '', '#' + S.route); noteRecent(S.route); render(); window.scrollTo(0, 0); }
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== S.route) go(r); });

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-xclose],[data-now],[data-go],[data-act],[data-edit],button[data-mode],button[data-skin],[data-hint],[data-convert],[data-resort],[data-del],[data-pvdel],[data-close],[data-weeknav],[data-new],[data-planmove],[data-subj],[data-timer],[data-grade],[data-reviewsub],[data-rate],[data-top],[data-fdur],[data-tcat],[data-examplan],[data-untrash],[data-purge],[data-mailtodo],[data-maildraft],[data-undo],[data-memok],[data-tilemove],[data-plreset],[data-pldel],[data-plsuggest],[data-matpdf],[data-subjpdf],[data-tview],[data-tnav],[data-tedit],[data-catup],[data-hadd],[data-hpdel],[data-hmini],[data-harch],[data-hunarch],[data-pdlog],[data-pdskip],[data-bmove],[data-tview2],[data-filedel]');
  if (!el || el === document.documentElement) return;
  if ((el.dataset.xclose === 'onb' || (el.dataset.close === 'onb' && ev.target === el)) && !S.settings.onboarded) { S.settings = { ...S.settings, onboarded: true }; store.setSettings(S.settings); }
  if (el.dataset.xclose) { const k = el.dataset.xclose; if (k === 'review') { finishReview(); return; } if (k === 'plan' && S.plan && S.plan.loading) return; S[k] = null; render(); return; }
  if (el.dataset.close && ev.target === el && el.dataset.close === 'review') { finishReview(); return; }
  if (el.dataset.close && ev.target === el) { if (el.dataset.close === 'plan' && S.plan && (S.plan.work || S.plan.study || S.plan.loading)) return; S[el.dataset.close] = null; render(); return; }
  if (el.dataset.close) return;
  if (el.dataset.go && el.dataset.subj) { ev.preventDefault(); S.uniSub = el.dataset.subj; go('uni'); return; }
  if (el.dataset.go) { ev.preventDefault(); go(el.dataset.go); return; }
  if (el.dataset.weeknav != null) { const n = Number(el.dataset.weeknav); S.week = n === 0 ? mondayOf(todayISO()) : addDays(curWeek(), 7 * n); render(); fetchGcal(); return; }
  if (el.dataset.new) { S.editing = newItem(el.dataset.new); render(); setTimeout(() => { const f = $('.sheet input'); f && f.focus(); }, 0); return; }
  if (el.dataset.top) { toggleTop(el.dataset.top); return; }
  if (el.dataset.fdur) { S.focusDur = Number(el.dataset.fdur); render(); return; }
  if (el.dataset.tcat) { S.trackCat = el.dataset.tcat; render(); return; }
  if (el.dataset.tview) { S.tview = el.dataset.tview; render(); return; }
  if (el.dataset.tnav != null) { const n = Number(el.dataset.tnav), b = S.tbase || todayISO(); if (!n) S.tbase = null; else if (S.tview === 'month') { const d = dObj(b.slice(0, 8) + '01'); S.tbase = isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)); } else S.tbase = addDays(b, 7 * n); render(); return; }
  if (el.dataset.tedit) { const e = dayEntries(el.dataset.date).find(x => x.id === el.dataset.tedit); if (e) { S.timeEdit = { ...e }; render(); setTimeout(() => { const f = $('.sheet input'); f && f.focus(); }, 0); } return; }
  if (el.dataset.catup != null) { const f = el.closest('form'), c = readCatForm(f), i = Number(el.dataset.catup); if (i > 0) [c[i - 1], c[i]] = [c[i], c[i - 1]]; S.catDraft = c; render(); return; }
  if (el.dataset.filedel != null && S.editing) { const k = Number(el.dataset.filedel), F = (S.editing.files || []).slice(), [gone] = F.splice(k, 1); S.editing.files = F; render(); if (gone) showToast('„' + gone.name + '“ gelöst. Wird mit „Speichern“ übernommen.'); return; }
  if (el.dataset.bmove) { const [id, to] = el.dataset.bmove.split('|'); await boardMove(id, to); return; }
  if (el.dataset.tview2) { S.settings = { ...S.settings, taskView: el.dataset.tview2 }; render(); store.setSettings(S.settings); return; }
  if (el.dataset.pdskip) { try { localStorage.setItem('jarvis.tskip', JSON.stringify(tskipRead().concat([el.dataset.pdskip.split('|').reverse().join(':')]).slice(-100))); } catch (e) {} render(); return; }
  if (el.dataset.pdlog) { const [id, d] = el.dataset.pdlog.split('|'); await timeFromBlock(id, d); return; }
  if (el.dataset.hmini) { habitMini(el.dataset.hmini); return; }
  if (el.dataset.harch || el.dataset.hunarch) { const id = el.dataset.harch || el.dataset.hunarch, h = S.items.find(i => i.id === id); if (h) { const upd = { ...h }; if (el.dataset.harch) upd.archived = todayISO(); else delete upd.archived; await setHabitLocal(upd); showToast(el.dataset.harch ? 'Archiviert. Unten unter „Archiv“ kannst du sie zurückholen.' : 'Zurückgeholt.', () => setHabitLocal(h)); render(); } return; }
  if (el.dataset.hadd) { const [id, n] = el.dataset.hadd.split(':'); habitAdd(id, Number(n)); return; }
  if (el.dataset.hpdel) { const [id, k] = el.dataset.hpdel.split(':'), h = S.items.find(i => i.id === id); if (h) { const before = h.pauses || []; await setHabitLocal({ ...h, pauses: before.filter((p, j) => j !== Number(k)) }); showToast('Pause beendet.', () => setHabitLocal({ ...(S.items.find(i => i.id === id) || h), pauses: before })); } return; }
  if (el.dataset.examplan) { openStudyPlan(el.dataset.examplan); return; }
  if (el.dataset.untrash) { const x = S.trash.find(t => t.id === el.dataset.untrash); if (x && x.item) { await restoreItem(x.item); showToast('Wiederhergestellt.'); } return; }
  if (el.dataset.purge) { await store.delTrash(el.dataset.purge); return; }
  if (el.dataset.rate) { S.rate = Number(el.dataset.rate); render(); return; }
  if (el.dataset.subj) { S.uniSub = el.dataset.subj; render(); window.scrollTo(0, 0); return; }
  if (el.dataset.timer) { toggleTimer(el.dataset.timer); return; }
  if (el.dataset.grade != null) { grade(el.dataset.grade === '1'); return; }
  if (el.dataset.reviewsub) { startReview(el.dataset.reviewsub); return; }
  if (el.dataset.planmove) { const it = S.items.find(i => i.id === el.dataset.planmove); if (it) await store.setItem({ ...it, date: S.plan ? S.plan.week : todayISO() }); return; }
  if (el.dataset.edit) { const it = S.items.find(i => i.id === el.dataset.edit); if (it) { lastFocus = el.dataset.edit; S.editing = { ...it }; render(); setTimeout(() => { const f = $('.sheet input'); f && f.focus(); }, 0); } return; }
    if (el.dataset.mode) { S.settings = { ...S.settings, mode: el.dataset.mode }; applyLook(); render(); store.setSettings(S.settings, 'mode'); return; }
    if (el.dataset.skin) { S.settings = { ...S.settings, skin: el.dataset.skin }; applyLook(); render(); store.setSettings(S.settings, 'skin'); return; }
  if (el.dataset.pvdel != null && S.pending) { S.pending.items.splice(Number(el.dataset.pvdel), 1); render(); return; }
  if (el.dataset.hint) {
    if (el.dataset.hint === 'moveToday') { const it = S.items.find(i => i.id === el.dataset.id); if (it) await store.setItem({ ...it, date: todayISO() }); }
    if (el.dataset.hint === 'go') go(el.dataset.route);
    if (el.dataset.hint === 'habitdone') await toggleHabit(el.dataset.id, true);
    if (el.dataset.hint === 'review') startReview();
    if (el.dataset.hint === 'plan') openPlan(0);
    if (el.dataset.hint === 'studyplan') openStudyPlan(el.dataset.id);
    if (el.dataset.hint === 'siriSort') { const ns = byType('note').filter(n => n.source === 'siri'); if (ns.length) ask(ns.map(n => n.title).join('\n'), { noteIds: ns.map(n => n.id) }); }
    if (el.dataset.hint === 'subject') { S.uniSub = el.dataset.id; go('uni'); }
    if (el.dataset.hint === 'tlog') await timeFromBlock(el.dataset.id);
    if (el.dataset.hint === 'tskip') { try { localStorage.setItem('jarvis.tskip', JSON.stringify(tskipRead().concat([todayISO() + ':' + el.dataset.id]).slice(-100))); } catch (e) {} render(); }
    if (el.dataset.hint === 'allTomorrow') { const b = taskBuckets(); const moved = [...b.over, ...b.today]; const tm = addDays(todayISO(), 1); for (const x of moved) await store.setItem({ ...x, date: tm }); showToast(moved.length + ' auf morgen verschoben.', async () => { for (const x of moved) await store.setItem(x); }); }
    return;
  }
  if (el.dataset.convert) {
    const n = S.items.find(i => i.id === el.dataset.convert); if (!n) return;
    S.pending = { text: n.title, reply: '', items: [cleanItem({ type: el.dataset.to, title: n.title })], fromNote: n.id }; render(); return;
  }
  if (el.dataset.resort) { const n = S.items.find(i => i.id === el.dataset.resort); if (n) ask(n.title, { noteId: n.id }); return; }
  if (el.dataset.del) { const n = S.items.find(i => i.id === el.dataset.del); if (n) { await removeItem(n); showToast('Gelöscht.', () => restoreItem(n)); } return; }
  if (el.dataset.mailtodo != null) { mailTodo(Number(el.dataset.mailtodo)); return; }
  if (el.dataset.maildraft != null) { openDraft(Number(el.dataset.maildraft)); return; }
  if (el.dataset.undo) { undoLog(el.dataset.undo); return; }
  if (el.dataset.memok) { const m = S.items.find(i => i.id === el.dataset.memok); if (m) await store.setItem({ ...m, confirmed: true }); return; }
  if (el.dataset.now) { await nowSwitch(el.dataset.now); return; }
  if (el.dataset.tilemove) { const [id, d] = el.dataset.tilemove.split(':'); moveTile(id, Number(d)); return; }
  if (el.dataset.plreset) { const l = S.items.find(i => i.id === el.dataset.plreset); if (l) await store.setItem({ ...l, entries: (l.entries || []).map(e => ({ ...e, on: false })) }); return; }
  if (el.dataset.pldel) { const [id, k] = el.dataset.pldel.split(':'); const l = S.items.find(i => i.id === id); if (l) await store.setItem({ ...l, entries: (l.entries || []).filter((e, j) => j !== Number(k)) }); return; }
  if (el.dataset.plsuggest) { plSuggest(el.dataset.plsuggest); return; }
  if (el.dataset.matpdf) { const m = S.items.find(i => i.id === el.dataset.matpdf); if (m) makePdf(S.items.find(i => i.id === m.subjectId), [m]); return; }
  if (el.dataset.subjpdf) { const sub = S.items.find(i => i.id === el.dataset.subjpdf); if (sub) makePdf(sub, materials(sub.id)); return; }
  switch (el.dataset.act) {
    case 'draftsave': saveDraft(); break;
    case 'brief': makeBrief(true); break;
    case 'sfocus': await startFromTile(false); break;
    case 'strack': await startFromTile(true); break;
    case 'quietshow': S.showQuiet = true; render(); break;
    case 'undo': { const u = S.toast && S.toast.undo; S.toast = null; render(); if (u) await u(); break; }
    case 'confirm': await confirmPending(); break;
    case 'cancelpending': if (S.pending && !S.pending.items.length && S.pending.reply) { await pushChat([{ role: 'me', text: S.pending.text }, { role: 'jarvis', text: S.pending.reply }]); clearComposers(); } S.pending = null; render(); break;
    case 'canceledit': S.editing = null; render(); break;
    case 'deledit': { const it = S.items.find(i => i.id === S.editing.id); S.editing = null; render(); if (it) { const ex = it.examEventId && S.items.find(i => i.id === it.examEventId); await removeItem(it); if (ex) await removeItem(ex); if (it.type === 'subject') S.uniSub = null; showToast('Gelöscht.', async () => { await restoreItem(it); if (ex) await restoreItem(ex); }); } break; }
    case 'cleardone': { const done = byType('shopping').filter(i => i.done); for (const i of done) await store.delItem(i.id); showToast(done.length + ' entfernt.', async () => { for (const i of done) await store.setItem(i); }); break; }
    case 'clearchat': { const old = S.chat; await store.setChat([]); S.chat = []; render(); showToast('Verlauf geleert.', () => store.setChat(old)); break; }
    case 'backup': backup(); break;
    case 'icsexport': exportIcs(); break;
    case 'onbstart': S.onb = { step: 0 }; render(); break;
    case 'onbback': S.onb.step = Math.max(0, S.onb.step - 1); render(); break;
    case 'onbdone': S.settings = { ...S.settings, onboarded: true }; await store.setSettings(S.settings); S.onb = null; render(); showToast('Fertig eingerichtet. Notier einfach, was ansteht.'); break;
    case 'plan': openPlan(0); break;
    case 'workplan': workPlanDirect(); break;
    case 'plannext': S.plan.step++; render(); break;
    case 'planback': S.plan.step = Math.max(0, S.plan.step - 1); render(); break;
    case 'planskip': S.plan.step++; render(); break;
    case 'planclose': S.week = S.plan.week; S.plan = null; render(); fetchGcal(); break;
    case 'planwork': planWork(); break;
    case 'planworkreset': S.plan.work = null; render(); break;
    case 'planworkok': await applyWork(); break;
    case 'planstudy': planStudy(); break;
    case 'planstudyreset': S.plan.study = null; render(); break;
    case 'planstudyok': await applyStudy(); break;
    case 'gcalrefresh': fetchGcal(); break;
    case 'review': startReview(); break;
    case 'mail': summarizeMail(); break;
    case 'debriefskip': { const nk = pendingDebrief(); if (nk) await store.setItem({ id: uid(), type: 'teamnote', title: 'Kein Training', eventTitle: nk.title, date: nk.date, note: 'ausgefallen', createdAt: new Date().toISOString() }); break; }
    case 'copywa': { const txt = matchText(S.matchInfo || defaultMatchInfo()); try { await navigator.clipboard.writeText(txt); showToast('Kopiert. Jetzt in WhatsApp einfügen.'); } catch (e) { const r = document.createRange(); const n = document.querySelector('.wa'); if (n) { r.selectNodeContents(n); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } showToast('Text markiert – jetzt kopieren.'); } break; }
    case 'flip': S.review.flipped = true; render(); break;
    case 'reviewclose': await finishReview(); break;
    case 'unback': S.uniSub = null; render(); break;
    case 'icscancel': S.ics = null; render(); break;
    case 'icsok': await applyIcs(); break;
    case 'ttcancel': S.ttImport = null; render(); break;
    case 'ttok': await applyTimetable(); break;
    case 'cleanscan': cleanScan(); break;
    case 'mic': toggleMic(el.dataset.k); break;
    case 'siricheck': checkSiriInbox(true); break;
    case 'vcfall': S.vcf.list.forEach(x => { if (!x.dup) x.on = true; }); render(); break;
    case 'vcfnone': S.vcf.list.forEach(x => { x.on = false; }); render(); break;
    case 'vcfadult': S.vcf.list.forEach(x => { if (!x.dup) x.on = !x.age || x.age >= 18; }); render(); break;
    case 'vcfcancel': S.vcf = null; render(); break;
    case 'vcfok': await applyVcf(); break;
    case 'topauto': topAuto(); break;
    case 'split': splitTask(S.items.find(i => i.id === S.editing.id)); break;
    case 'excancel': S.examPlan = null; render(); break;
    case 'exok': await applyExam(); break;
    case 'sprun': runStudyPlan(); render(); break;
    case 'spearlier': if (S.examPlan) { S.examPlan.from = [todayISO(), addDays(S.examPlan.from, -7)].sort()[1]; runStudyPlan(); render(); } break;
    case 'fquick': await startFocus({ dur: 25 }); break;
    case 'fstart': await startFocusSession({ dur: S.focusDur, ref: S.focusRef || null }); break;
    case 'fstop': await stopFocus('manual'); break;
    case 'fhold': await holdFocus(true); break;
    case 'hsick': { const t = todayISO(), hs = activeHabits(), before = hs.map(h => ({ ...h })); for (const h of hs) await setHabitLocal({ ...h, pauses: (h.pauses || []).concat([{ from: t, until: t, why: 'krank' }]).slice(-20) }); showToast('Gute Besserung. Heute zählt nicht gegen deine Serien.', async () => { for (const h of before) await setHabitLocal(h); }); render(); break; }
    case 'fresume': await holdFocus(false); break;
    case 'fcancel': await setFocus(null); showToast('Abgebrochen, nichts erfasst.'); break;
    case 'fskip': await focusSkip(); break;
    case 'fshide': if (S.focus) fsHideKey = S.focus.startedAt; render(); break;
    case 'fsshow': fsHideKey = 0; fsPoke(); render(); break;
    case 'ftake': await startFocusSession({ dur: S.focusDur }); break;
    case 'fdtaskdone': { const it = S.items.find(i => i.id === S.focusDone.ref); S.focusDone = null; if (it) { const upd = { ...it, done: true, doneAt: new Date().toISOString() }; await store.setItem(upd); if ((it.repeat || it.repeatDays) && !it.nextId) { const nx = nextRepeat(it); if (nx) { await store.setItem(nx); await store.setItem({ ...upd, nextId: nx.id }); } } showToast('Erledigt.'); } render(); break; }
    case 'fdpause': S.focusDone = null; await startFocus({ mode: 'pause', dur: 5, cat: 'privat', label: 'Pause' }); break;
    case 'fdagain': { const F = S.focusDone; S.focusDone = null; await startFocus({ dur: S.focusDur, ref: F.ref, label: F.label }); break; }
    case 'fdclose': S.focusDone = null; render(); break;
    case 'mealsuggest': mealSuggest(); break;
    case 'mealshop': mealShop(); break;
    case 'cleantrash': cleanApply('trash'); break;
    case 'cleanspam': cleanApply('spam'); break;
    case 'cleanall': if (S.clean && S.clean.list) { S.clean.list.forEach(x => x.on = x.cat === 'spam' || x.cat === 'werbung'); render(); } break;
    case 'cleannone': if (S.clean && S.clean.list) { S.clean.list.forEach(x => x.on = false); render(); } break;
    case 'tcancel': S.timeEdit = null; render(); break;
    case 'tdel': { const e = S.timeEdit; if (!e) break; const snap = daySnap(e.date); S.timeEdit = null; await removeTimeEntry(e.id, e.date);
      if (e.calRef) try { localStorage.setItem('jarvis.tskip', JSON.stringify(tskipRead().concat([e.date + ':' + e.calRef]).slice(-100))); } catch (x) {}   // gelöschte Kalender-Zeit kommt nicht wieder
      showToast('Gelöscht.', () => restoreDays([snap])); break; }
    case 'catadd': { const f = el.closest('form'), c = readCatForm(f); c.push({ id: 'c' + uid().slice(-6), name: '', color: 'g', goal: null, subs: [], words: [] }); S.catDraft = c; render(); break; }
    case 'catreset': S.catDraft = null; render(); break;
    case 'texcsv': exportTimes('csv'); break;
    case 'texprint': exportTimes('print'); break;
    case 'calretry': { calWarned.v = false; for (const it of S.items.filter(i => i.calErr)) await calSync(it); showToast('Erneut versucht.'); break; }
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.toggle) {
    const it = S.items.find(i => i.id === el.dataset.toggle); if (!it) return;
    const upd = { ...it, done: el.checked }; if (el.checked) upd.doneAt = new Date().toISOString(); else { delete upd.doneAt; delete upd.nextId; }
    S.items = S.items.map(i => i.id === it.id ? upd : i); render();
    try {
      await withRetry(() => store.setItem(upd));
      if (it.type === 'task' && it.remindAt && it.gcalId && el.checked) calSync(upd, it);
      if (it.type === 'task' && !el.checked && it.done) { const gone = await dropNextRepeat(it); if (gone) showToast('Wieder offen. Die nächste Wiederholung ist wieder weg.', async () => { await store.setItem(it); await restoreItem(gone); }); }
      if (it.type === 'task' && el.checked && (it.repeat || it.repeatDays) && !it.nextId) {      // nächste Wiederholung anlegen
        const nx = nextRepeat(it);
        if (nx) { await store.setItem(nx); await store.setItem({ ...upd, nextId: nx.id }); if (nx.remindAt) calSync(nx); showToast('Erledigt. Nächstes Mal: ' + relDay(nx.date) + '.'); }
      }
    } catch (e) { showToast('Speichern fehlgeschlagen.'); }
    return;
  }
  if (el.dataset.pv != null) { updatePv(el); if (['type', 'kind', 'freq', 'catv', 'date', 'start', 'end', 'hrs', 'pause', 'habitId', 'link', 'examKind'].includes(el.dataset.f)) render(); return; }
  if (el.dataset.tcatsel != null) { S.trackCat = el.value; return; }
  if (el.dataset.sref != null) { S.startRef = el.value; return; }
  if (el.dataset.fcustom != null) { const v = Math.round(Number(el.value)); if (v >= 1 && v <= 240) { S.focusDur = v; document.querySelectorAll('[data-fdur]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.fdur) === v))); const b = document.querySelector('[data-act="sfocus"]'); if (b) b.textContent = v + ' Min. Fokus'; } return; }
  if (el.closest && el.closest('form[data-form="cats"]')) { S.catDraft = readCatForm(el.closest('form')); return; }
  if (el.name === 'catv' && el.closest('form[data-form="timeadd"]')) { S.taCat = el.value; return; }
  if (el.dataset.prop && S.plan) { const list = S.plan[el.dataset.prop]; const b = list && list[Number(el.dataset.i)]; if (b) { b[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; if (el.type === 'checkbox') render(); } return; }
  if (el.dataset.hidearea) { const h = new Set(hiddenAreas()); if (el.checked) h.delete(el.dataset.hidearea); else h.add(el.dataset.hidearea); S.settings = { ...S.settings, hiddenAreas: [...h] }; await store.setSettings(S.settings); render(); return; }
  if (el.dataset.setting) { S.settings = { ...S.settings, [el.dataset.setting]: el.checked }; await store.setSettings(S.settings); render(); return; }
  if (el.dataset.actChange === 'restore' && el.files && el.files[0]) { restore(el.files[0]); el.value = ''; }
  if (el.dataset.actChange === 'vcf' && el.files && el.files[0]) { importVcf(el.files[0]); el.value = ''; return; }
  if (el.dataset.vcfi != null && S.vcf) { const x = S.vcf.list[Number(el.dataset.vcfi)]; if (x) { x.on = el.checked; render(); } return; }
  if (el.dataset.actChange === 'ics' && el.files && el.files[0]) { importIcs(el.files[0]); el.value = ''; }
  if (el.dataset.habit) { toggleHabit(el.dataset.habit, el.checked); return; }
  if (el.dataset.habday) { const tg = el.dataset.hpv === 'e' ? S.editing : S.pending && S.pending.items[Number(el.dataset.hpv)]; if (!tg) return; const d = Number(el.dataset.habday); const set = new Set(tg.days && tg.days.length ? tg.days : [1, 2, 3, 4, 5, 6, 7]); if (el.checked) set.add(d); else set.delete(d); tg.days = Array.from(set).sort((a, b) => a - b); return; }
  if (el.dataset.fref != null) { S.focusRef = el.value; return; }
  if (el.dataset.sp && S.examPlan) { const P = S.examPlan; if (el.dataset.sp === 'hours') P.hours = Math.max(1, Math.min(200, Number(String(el.value).replace(',', '.')) || P.hours)); else if (el.value) P.from = el.value; runStudyPlan(); render(); return; }
  if (el.dataset.exi != null && S.examPlan && S.examPlan.list) { const b = S.examPlan.list[Number(el.dataset.exi)]; if (b) { b[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; if (el.type === 'checkbox') render(); } return; }
  if (el.dataset.actChange === 'timetable' && el.files && el.files[0]) { importTimetable(el.files[0]); el.value = ''; }
  if (el.dataset.tti != null && S.ttImport) { S.ttImport[Number(el.dataset.tti)].on = el.checked; render(); }
  if (el.dataset.ttuntil) { S.ttUntil = el.value; }
  if (el.dataset.cleani != null && S.clean && S.clean.list) { S.clean.list[Number(el.dataset.cleani)].on = el.checked; render(); }
  if (el.dataset.cleanrange) { S.cleanRange = el.value; }
  if (el.dataset.actChange === 'finance' && el.files && el.files[0]) { importFinance(el.files[0]); el.value = ''; }
  if (el.dataset.actChange === 'attach' && el.files && el.files.length) { const fl = Array.from(el.files); el.value = ''; attachFiles(fl); return; }
  if (el.dataset.finmonth) { S.finMonth = el.value; render(); }
  if (el.dataset.mi) { S.matchInfo = { ...(S.matchInfo || defaultMatchInfo()), [el.dataset.mi]: el.value }; const w = document.querySelector('.wa'); if (w) w.textContent = matchText(S.matchInfo); }
  if (el.dataset.icsi != null && S.ics) { S.ics[Number(el.dataset.icsi)].on = el.checked; render(); }
  if (el.dataset.plcheck) { const [id, k] = el.dataset.plcheck.split(':'); const l = S.items.find(i => i.id === id); if (l) await store.setItem({ ...l, entries: (l.entries || []).map((e, j) => j === Number(k) ? { ...e, on: el.checked } : e) }); return; }
  if (el.dataset.tileon) { const h = new Set(S.settings.hiddenTiles || []); if (el.checked) h.delete(el.dataset.tileon); else h.add(el.dataset.tileon); S.settings = { ...S.settings, hiddenTiles: Array.from(h) }; await store.setSettings(S.settings); render(); return; }
  if (el.dataset.hintkind) { const o = new Set(S.settings.hintsOff || []); if (el.checked) o.delete(el.dataset.hintkind); else o.add(el.dataset.hintkind); S.settings = { ...S.settings, hintsOff: Array.from(o) }; await store.setSettings(S.settings); render(); return; }
});
document.addEventListener('input', (ev) => { const el = ev.target; if (el.id === 'q-in') { clearTimeout(window.__qt); window.__qt = setTimeout(() => { S.q = el.value; render(); }, 250); } if (el.dataset.mi) { S.matchInfo = { ...(S.matchInfo || defaultMatchInfo()), [el.dataset.mi]: el.value }; const w = document.querySelector('.wa'); if (w) w.textContent = matchText(S.matchInfo); } if (el.dataset.pv != null) updatePv(el); if (el.closest && el.closest('form[data-form="cats"]')) S.catDraft = readCatForm(el.closest('form')); if (el.dataset.draft && S.draft) S.draft.text = el.value; if (el.tagName === 'TEXTAREA' && el.closest('.composer')) autosize(); });
function updatePv(el) {
  const target = el.dataset.pv === 'e' ? S.editing : (S.pending && S.pending.items[Number(el.dataset.pv)]);
  if (!target) return;
  const f = el.dataset.f;
  if (el.type === 'checkbox') target[f] = el.checked;
  else if (f === 'hrs') { const v = Number(String(el.value).replace(',', '.')); target.min = v > 0 ? Math.round(v * 60) : null; }
  else target[f] = el.value || null;
  if (f === 'pause') target.pauseSet = true;
  if (f === 'type' && target.type === 'shopping' && !target.aisle) target.aisle = guessAisle(target.title || '');
  if (target.type === 'time' && ['start', 'end', 'catv'].includes(f)) fixTime(target);
}

document.addEventListener('submit', async (ev) => {
  const f = ev.target; ev.preventDefault();
  const kind = f.dataset.form;
  if (kind === 'ask') { const ta = f.querySelector('textarea'); const v = ta.value; if (v.trim()) { ta.blur(); ask(v); } return; }
  if (kind === 'shop') {
    const inp = f.querySelector('input'); const parts = inp.value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean); if (!parts.length) return;
    inp.value = ''; const ts = new Date().toISOString();
    for (const p of parts) { const title = p.charAt(0).toUpperCase() + p.slice(1); await withRetry(() => store.setItem({ id: uid(), type: 'shopping', title, aisle: guessAisle(title), done: false, createdAt: ts })); }
    inp.focus(); return;
  }
  if (kind === 'idea') { const inp = f.querySelector('input'); const v = inp.value.trim(); if (!v) return; inp.value = ''; await withRetry(() => store.setItem({ id: uid(), type: 'idea', title: v, createdAt: new Date().toISOString() })); return; }
  if (kind === 'material') { processMaterial(f); return; }
  if (kind === 'chore') { const fd = new FormData(f), title = String(fd.get('title') || '').trim().slice(0, 160), n = Math.max(1, Math.min(365, Number(fd.get('days')) || 7)); if (!title) return; await store.setItem({ id: uid(), type: 'task', title, date: todayISO(), area: 'alltag', chore: true, repeatDays: n, done: false, createdAt: new Date().toISOString() }); f.reset(); showToast('Angelegt. Erstes Mal: heute.'); return; }
  if (kind === 'packlist') { const fd = new FormData(f), title = String(fd.get('title') || '').trim().slice(0, 120); if (!title) return; const entries = String(fd.get('entries') || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 80).map(t => ({ t: t.slice(0, 120), on: false })); await store.setItem({ id: uid(), type: 'packlist', title, entries, createdAt: new Date().toISOString() }); f.reset(); return; }
  if (kind === 'plentry') { const inp = f.querySelector('input'), v = inp.value.trim(); if (!v) return; const l = S.items.find(i => i.id === f.dataset.id); if (!l) return; inp.value = ''; const add = v.split(/[,;]/).map(x => x.trim()).filter(Boolean).map(t => ({ t: t.slice(0, 120), on: false })); await store.setItem({ ...l, entries: (l.entries || []).concat(add).slice(0, 120) }); return; }
  if (kind === 'uniask') { askMaterials(f.dataset.sid, String(new FormData(f).get('q') || '').trim()); return; }
  if (kind === 'quiet') { const fd = new FormData(f), ok = v => /^\d{2}:\d{2}$/.test(v); const a = String(fd.get('from') || ''), z = String(fd.get('to') || ''); S.settings = { ...S.settings, quietFrom: ok(a) ? a : '21:00', quietTo: ok(z) ? z : '07:00', contractLead: Math.max(1, Math.min(120, Number(fd.get('lead')) || 28)) }; await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return; }
  if (kind === 'meals') { saveMeals(f); return; }
  if (kind === 'tsatz') { const inp = f.querySelector('input'), v = inp.value.trim(); if (!v) return; inp.value = ''; inp.blur(); ask(v); return; }
  if (kind === 'track') { if (S.focus) return; const { cat, sub } = splitCat(S.trackCat || (visCats()[0] || {}).id); if (!cat) return; const lb = String(new FormData(f).get('label') || '').trim(); await startFocus({ mode: 'track', cat, sub, label: lb || catName(cat, sub) }); document.querySelectorAll('[data-keep="tr-label"]').forEach(x => x.value = ''); return; }
  if (kind === 'timeadd') {
    const r = readTimeForm(new FormData(f)); if (r.err) { showToast(r.err); return; }
    const key = r.date + JSON.stringify(r.e);
    if (dupEntry(r.date, r.e) && S.dupOk !== key) { S.dupOk = key; showToast('Das steht schon genauso drin. Nochmal auf „Eintragen“ tippen, um es doppelt zu speichern.', 6000); return; }
    S.dupOk = null; const snap = daySnap(r.date);
    await addTimeEntry(r.date, { ...r.e, src: 'manuell', at: new Date().toISOString() });
    f.querySelectorAll('[data-keep]').forEach(x => { if (x.name !== 'catv' && x.name !== 'date') x.value = ''; });
    showToast('Eingetragen: ' + catName(r.e.cat, r.e.sub) + ' ' + fmtMin(r.e.min) + (r.e.pause ? ' (' + r.e.pause + ' Min. Pause abgezogen)' : '') + '.', () => restoreDays([snap]));
    return;
  }
  if (kind === 'timeedit') {
    const e = S.timeEdit; if (!e) return;
    const r = readTimeForm(new FormData(f), true); if (r.err) { showToast(r.err); return; }
    const snaps = [daySnap(e.date)].concat(r.date !== e.date ? [daySnap(r.date)] : []);
    const upd = { ...e, ...r.e, hand: e.calRef ? true : null }; delete upd.date;   // von Hand bearbeitet: folgt nicht mehr dem Kalender
    S.timeEdit = null;
    if (r.date === e.date) await saveDay(e.date, rawEntries(e.date).map(x => x.id === e.id ? upd : x));
    else { await removeTimeEntry(e.id, e.date); await addTimeEntry(r.date, upd); }
    showToast('Gespeichert.', () => restoreDays(snaps));
    return;
  }
  if (kind === 'cats') {
    const c = readCatForm(f);
    if (c.some(x => !x.name)) { showToast('Bitte jedem Bereich einen Namen geben.'); return; }
    if (!c.some(x => !x.hidden)) { showToast('Mindestens ein Bereich muss sichtbar bleiben.'); return; }
    S.settings = { ...S.settings, timeCats: c }; S.catDraft = null; await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return;
  }
  if (kind === 'load') {
    const fd = new FormData(f), num = k => Math.max(0, Math.min(120, Math.round(Number(String(fd.get(k) || '').replace(',', '.')) * 2) / 2 || 0));
    const L = { weekY: num('weekY'), weekR: num('weekR'), dayY: num('dayY'), dayR: num('dayR'), overR: num('overR') };
    if (L.weekR < L.weekY || L.dayR < L.dayY) { showToast('„Überplant“ muss größer sein als „eng“.'); return; }
    S.settings = { ...S.settings, load: L }; await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return;
  }
  if (kind === 'hpause') {
    const fd = new FormData(f), hid = String(fd.get('habit') || ''), from = String(fd.get('from') || ''), until = String(fd.get('until') || '') || null, why = fd.get('why') === 'krank' ? 'krank' : null;
    if (!from) { showToast('Bitte angeben, ab wann.'); return; }
    if (until && until < from) { showToast('„Bis“ liegt vor „Ab“.'); return; }
    const ids = hid ? [hid] : activeHabits().map(h => h.id);
    for (const id of ids) { const h = S.items.find(i => i.id === id); if (h) await setHabitLocal({ ...h, pauses: (h.pauses || []).concat([why ? { from, until, why } : { from, until }]).slice(-20) }); }
    showToast(why ? 'Gute Besserung. Die Tage zählen nicht gegen deine Serien.' : ids.length === 1 ? 'Pausiert.' : ids.length + ' Gewohnheiten pausiert.'); render(); return;
  }
  if (kind === 'search') { S.q = String(new FormData(f).get('q') || ''); if (S.route !== 'suche') go('suche'); else render(); return; }
  if (kind === 'memory') { const inp = f.querySelector('input'); const v = inp.value.trim(); if (!v) return; inp.value = ''; await store.setItem({ id: uid(), type: 'memory', title: v.slice(0, 300), source: 'du', confirmed: true, createdAt: new Date().toISOString() }); return; }
  if (kind === 'onb') { onbSubmit(f); return; }
  if (kind === 'expense') {
    const fd = new FormData(f), a = Math.round(Math.abs(Number(String(fd.get('amount') || '').replace(',', '.'))) * 100) / 100;
    if (!(a > 0)) { showToast('Bitte einen Betrag angeben.'); return; }
    const d = String(fd.get('date') || '') || todayISO(), it = { id: uid(), type: 'expense', title: String(fd.get('title') || '').trim().slice(0, 120) || 'Ausgabe', amount: a, cat: String(fd.get('cat') || '').trim().slice(0, 40) || 'Sonstiges', date: d > todayISO() ? todayISO() : d, createdAt: new Date().toISOString() };
    await withRetry(() => store.setItem(it)); S.finMonth = it.date.slice(0, 7);
    document.querySelectorAll('[data-keep^="ex-"]').forEach(x => { if (x.name !== 'date') x.value = ''; });
    showToast('Eingetragen: ' + eur(a) + ' ' + it.title + '.', () => store.delItem(it.id)); render(); return;
  }
  if (kind === 'budget') { S.settings = { ...S.settings, budget: Math.max(0, Number(new FormData(f).get('budget')) || 0) }; await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return; }
  if (kind === 'focus') { const v = String(new FormData(f).get('focus') || '').trim().slice(0, 200); const team = { ...(S.team || {}), focus: { ...((S.team && S.team.focus) || {}), [weekKey()]: v } }; await store.setMeta('team', team); S.team = team; showToast('Gespeichert.'); render(); return; }
  if (kind === 'debrief') { const note = String(new FormData(f).get('note') || '').trim(); await store.setItem({ id: uid(), type: 'teamnote', title: 'Trainingsnotiz', eventTitle: f.dataset.title, date: f.dataset.date, note: note.slice(0, 2000), rating: S.rate || null, createdAt: new Date().toISOString() }); S.rate = null; document.querySelectorAll('[data-keep="debrief"]').forEach(x => x.value = ''); showToast('Notiz gespeichert.'); return; }
  if (kind === 'wxsearch') { searchWeatherPlace(String(new FormData(f).get('q') || '').trim()); return; }
  if (kind === 'worksettings') {
    const fd = new FormData(f);
    const wd = fd.getAll('wd').map(Number).filter(n => n >= 1 && n <= 7);
    const num = v => { const n = Number(String(v || '').replace(',', '.')); return isNaN(n) ? null : Math.max(0, Math.round(n * 2) / 2); };
    S.settings = { ...S.settings, workDays: wd.length ? wd : [3, 4, 5], workHours: num(fd.get('workHours')) ?? 20, vacationDays: String(fd.get('vacationDays') || '').trim() === '' ? null : num(fd.get('vacationDays')), vacationCarry: num(fd.get('vacationCarry')) || 0, rules: String(fd.get('rules') || '').trim().slice(0, 2000) };
    await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return;
  }
  if (kind === 'name') { const v = f.querySelector('input').value.trim().slice(0, 40); S.settings = { ...S.settings, name: v }; await store.setSettings(S.settings); showToast('Gespeichert.'); render(); return; }
  if (kind === 'edit') {
    const e = { ...S.editing };
    if (!e.title || !String(e.title).trim()) { showToast('Bitte einen Titel eingeben.'); return; }
    const keepF = { task: ['date','area','note','remindAt','repeat','topDate','parentId','nextId','repeatDays','chore'], event: ['date','dateEnd','start','end','place','area','outside'], contract: ['cost','per','until','notice','noticeUnit','renew','note'], shopping: ['aisle'], idea: ['note','area'], note: [],
      class: ['weekday','start','end','room','from','until','skip','subjectId'], work: ['date','start','end','place'], off: ['date','dateEnd','kind','days'], subject: ['examDate','examTime','examPlace','examEventId','time','examKind','examWith'], teamnote: ['date','note','rating','eventTitle'], expense: ['date'], memory: [], habit: ['days','log','kind','target','freq','n','link','pauses','noAutoPause'], waiting: ['note'], project: ['area','note'] }[e.type] || [];
    ['date','start','end','place','area','aisle','note','weekday','room','from','until','skip','dateEnd','kind','days','remindAt','repeat','topDate','parentId','nextId','log','outside','cost','per','notice','noticeUnit','renew','repeatDays','chore'].forEach(k => { if (!keepF.includes(k)) delete e[k]; });
    if (e.type === 'birthday') { const bd = e.bday || ((e.year || '2000') + '-' + (e.md || '')); if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) { showToast('Bitte ein Datum angeben.'); return; } const known = e.yearKnown != null ? e.yearKnown === '1' : !!e.year; e.md = bd.slice(5); e.name = String(e.title).trim(); if (known) e.year = Number(bd.slice(0, 4)); else delete e.year; delete e.bday; delete e.yearKnown; }
    if (e.type === 'shopping' && !e.aisle) e.aisle = guessAisle(e.title);
    if (e.type === 'subject') {
      const k = e.examKind || 'klausur';
      if (k === 'mit' && !e.examWith) { showToast('Bitte wählen, mit welchem Fach die Prüfung zusammen ist.'); return; }
      if (k !== 'mit') e.examWith = null;
      if (k === 'klausur') e.examKind = null;
      if (k === 'mit' || k === 'keine') { e.examDate = null; e.examTime = null; e.examPlace = null; }
    }
    if (e.type !== 'subject') { delete e.examKind; delete e.examWith; }
    if (e.type !== 'class' && e.type !== 'material') delete e.subjectId;
    if (e.type === 'habit') Object.assign(e, normHabit(e));
    if (e.type === 'event' && !e.date) e.date = todayISO();
    if (e.type === 'expense') { const a = Math.round(Math.abs(Number(String(e.amount ?? '').replace(',', '.'))) * 100) / 100; if (!(a > 0)) { showToast('Bitte einen Betrag angeben.'); return; } e.amount = a; if (!e.date) e.date = todayISO(); e.cat = String(e.cat || '').trim().slice(0, 40) || 'Sonstiges'; }
    if ((e.type === 'class' || e.type === 'work') && (!e.start || !e.end)) { showToast('Bitte Beginn und Ende angeben.'); return; }
    if (e.type === 'work' && !e.date) { showToast('Bitte ein Datum angeben.'); return; }
    if (e.type === 'off' && !e.date) { showToast('Bitte ein Datum angeben.'); return; }
    if (e.type === 'task' && e.repeat && !e.date) e.date = todayISO();
    if (e.type === 'task' && e.remindAt && !e.date) e.date = e.remindAt.slice(0, 10);
    if ((e.type === 'off' || e.type === 'event') && e.dateEnd && e.dateEnd < e.date) { showToast('„Bis“ liegt vor „Von“.'); return; }
    if (e.type === 'event' && e.dateEnd === e.date) delete e.dateEnd;
    if (LINK_TYPES.includes(e.type)) { const L = cleanLinks(e.links); if (String(e.links || '').trim() && !Array.isArray(e.links) && L.length < String(e.links).trim().split(/\s+/).length) { showToast('Ein Link beginnt nicht mit https:// und wurde weggelassen.'); } if (L.length) e.links = L; else delete e.links; } else delete e.links;
    if (e.type === 'off' && e.days != null && e.days !== '') e.days = Math.max(0, Math.round(Number(String(e.days).replace(',', '.')) * 2) / 2);
    if (e.end && e.start && e.end <= e.start && !(e.type === 'event' && e.dateEnd)) { showToast('Das Ende muss nach dem Beginn liegen.'); return; }
    Object.keys(e).forEach(k => { if (e[k] === null || e[k] === '') delete e[k]; });
    const isNew = !e.id; if (isNew) { e.id = uid(); e.createdAt = new Date().toISOString(); }
    const before = S.items.find(i => i.id === e.id);
    S.editing = null; render();
    try {
      await withRetry(() => store.setItem(e));
      showToast('Gespeichert.');
      if (e.type === 'subject') { await syncExam(e); for (const id of new Set([e.examWith, before && before.examWith].filter(Boolean))) { const l = S.items.find(i => i.id === id); if (l) await syncExam(l); } }
      if (CAL_TYPES.includes(e.type)) calSync(e, before);
      else if (before && before.gcalId) calDelete(before);
    } catch (er) { showToast('Speichern fehlgeschlagen.'); }
  }
});
document.addEventListener('keydown', (ev) => {
  const el = ev.target;
  if (fsOn()) { fsPoke(); if (ev.key === 'Escape' && !S.focusDone && !S.editing && !S.pending) { fsHideKey = S.focus.startedAt; render(); return; } }
  if (el.tagName === 'TEXTAREA' && el.closest('.composer') && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); el.closest('form').requestSubmit(); }
  if (ev.key === 'Escape' && (S.examPlan || S.focusDone || S.draft || S.timeEdit)) { S.examPlan = null; S.focusDone = null; S.draft = null; S.timeEdit = null; render(); return; }
  if (ev.key === 'Escape' && (S.pending || S.editing || S.plan || S.review || S.ics)) { if (S.review) { finishReview(); return; } S.pending = null; S.editing = null; S.plan = null; S.ics = null; render(); }
  if (S.review && !S.review.flipped && ev.key === ' ' && ev.target === document.body) { ev.preventDefault(); S.review.flipped = true; render(); }
});
// Verschieben: eigene Ereignisse (stehen nicht in der großen Klick-Liste)
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-move],[data-mvq],[data-mvok],[data-mvcancel],[data-mvdrop]');
  if (!el) return;
  if (el.dataset.move) { ev.preventDefault(); openMove(el.dataset.move); return; }
  const M = S.move; if (!M) return;
  if (el.dataset.mvok) { await confirmMove(); return; }
  if (el.dataset.mvcancel) { await cancelMove(); return; }
  if (el.dataset.mvdrop != null) { M.rows.splice(Number(el.dataset.mvdrop), 1); if (!M.rows.length) { await cancelMove(); return; } render(); return; }
  if (el.dataset.mvq) {
    const [i, v] = el.dataset.mvq.split('|'), r = M.rows[Number(i)]; if (!r) return;
    if (v[0] === 'd') mvSet(r, { date: addDays(r.to.date, Number(v.slice(1))) });
    else if (r.to.start) { const m = Number(v), s = hmToMin(r.to.start) + m, e = hmToMin(r.to.end || r.to.start) + m; if (s >= 0 && e <= 1439) r.to = { ...r.to, start: mvHM(s), end: r.to.end ? mvHM(e) : null }; else showToast('Das ginge über Mitternacht. Bitte den Tag ändern.'); }
    else showToast('Ganztägig: bitte eine Uhrzeit eintragen oder den Tag ändern.');
    render(); const b = document.querySelector('[data-mvq="' + el.dataset.mvq + '"]'); b && b.focus();
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!el.dataset || el.dataset.mv == null || !S.move) return;
  const r = S.move.rows[Number(el.dataset.mv)]; if (!r) return;
  const f = el.dataset.f, v = el.value;
  if (f === 'date') { if (v) r.to = { ...r.to, date: v }; }
  else if (f === 'start') { if (v) mvSet(r, { start: v }); else if (r.kind !== 'work') r.to = { ...r.to, start: null, end: null }; }
  else if (f === 'end') { if (v && r.to.start && v > r.to.start) r.to = { ...r.to, end: v }; else if (v) showToast('Das Ende muss nach dem Beginn liegen.'); }
  render(); const n = document.querySelector('[data-mv="' + el.dataset.mv + '"][data-f="' + f + '"]'); n && n.focus();
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.move) { cancelMove(); } });
function autosize() { document.querySelectorAll('.composer textarea').forEach(t => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }); }

// Uhr und „Als Nächstes“ jede Minute aktualisieren (ohne Tippen zu stören)
function tickRender() { const a = document.activeElement; if (!S.pending && !S.editing && !S.plan && !S.timeEdit && !(a && a.closest && a.closest('form:not(.composer)'))) render(); }
setInterval(tickRender, 60000);
// Eigene App: Das Handy schläft die App im Hintergrund ein. Beim Zurückholen sofort Uhr, Tag und „Als Nächstes“ auffrischen.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickRender(); });
window.addEventListener('pageshow', ev => { if (ev.persisted) tickRender(); });

S.route = (location.hash || '#heute').slice(1); if (S.route === 'fokus') S.route = 'zeiten'; if (!ROUTES.some(r => r.id === S.route)) S.route = 'heute';
boot();

// Fokus-Vollbild: Bildschirm bleibt an, solange es offen ist (geht auf dem iPhone in der Home-Bildschirm-App ab iOS 18.4)
let wakeLock = null;
async function syncWakeLock() {
  const want = !!document.querySelector('.fsx') && !document.hidden;
  try {
    if (want && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!want && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) { wakeLock = null; }
}
try { new MutationObserver(syncWakeLock).observe(document.getElementById('app'), { childList: true }); } catch (e) {}
document.addEventListener('visibilitychange', syncWakeLock);
