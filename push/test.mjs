/* Probelauf mit ausgedachten Daten, ohne Netz und ohne Versand:  node push/test.mjs
   Prüft, dass zur richtigen Uhrzeit die richtige Meldung kommt und keine doppelt. */
process.env.TZ = "Europe/Berlin";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { run, zuFs, vapidSchluessel } from "./senden.mjs";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Phil
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20261103T093000
DTEND;TZID=Europe/Berlin:20261103T110000
RRULE:FREQ=WEEKLY;BYDAY=TU
UID:sem1@google.com
SUMMARY:Seminar Deutsch
LOCATION:Uni Münster
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T163000Z
DTEND:20261103T180000Z
UID:tr1@google.com
SUMMARY:Training U13
LOCATION:Stausee
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20261110T080000
DTEND;TZID=Europe/Berlin:20261110T200000
UID:voll@google.com
SUMMARY:Blockseminar
END:VEVENT
END:VCALENDAR`;

const items = [
  { id: "t1", type: "task", title: "Praktikums-Bewerbung abschicken", date: "2026-11-03" },
  { id: "t2", type: "task", title: "Wäsche", date: "2026-11-01" },
  { id: "t3", type: "task", title: "Hausarbeit Gliederung", date: "2026-11-12" },
  { id: "t4", type: "task", title: "Zahnarzt anrufen", remindAt: "2026-11-03T14:00" },
  { id: "t5", type: "task", title: "Mail an Prof", done: true, doneAt: "2026-11-03T10:15:00.000Z" },
  { id: "w1", type: "work", date: "2026-11-04", start: "08:00", end: "12:00", place: "Büro" },
  { id: "h1", type: "habit", title: "Lesen", remind: "21:30", mini: "5 Seiten", log: {} },
  { id: "b1", type: "birthday", name: "Max", md: "11-03", year: "2014" },
  { id: "s1", type: "subject", title: "Mathe", examDate: "2026-11-12" },
  { id: "tl-2026-11-03", type: "timeday", entries: [{ cat: "uni", min: 90 }, { cat: "arbeit", min: 240 }] }
];
const settings = { name: "Phil", jpal: "rotgold" };
const doc = (name, o) => ({ name: "projects/p/databases/(default)/documents/" + name, fields: zuFs(o).mapValue.fields });

function fakeFetch(state) {
  return async (url, o = {}) => {
    const j = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => (typeof x === "string" ? x : JSON.stringify(x)) });
    if (url.startsWith("https://ical")) return j(ICS);
    if (url.includes("open-meteo")) return j({ daily: { time: ["2026-11-03", "2026-11-04"], weather_code: [61, 3], temperature_2m_max: [12, 10], temperature_2m_min: [6, 4], precipitation_probability_max: [70, 20] },
      hourly: { time: ["2026-11-03T17:00"], precipitation_probability: [80], temperature_2m: [9], weather_code: [61], wind_gusts_10m: [30] } });
    if (url.includes("brightsky")) return j({ alerts: [] });
    const m = url.match(/documents\/users\/phil\/(meta\/\w+|items|push)/);
    if (m && (o.method || "GET") === "PATCH") { state.writes.push([m[1], JSON.parse(o.body)]); return j({}); }
    if (m && m[1] === "items") return j({ documents: items.map((x) => doc("users/phil/items/" + x.id, x)) });
    if (m && m[1] === "push") return j({ documents: [] });
    if (m && m[1] === "meta/settings") return j(doc("users/phil/meta/settings", settings));
    if (m && m[1] === "meta/versand" && state.versand) return j(doc("users/phil/meta/versand", state.versand));
    return j({}, 404);
  };
}
const lauf = async (zeit, state = { writes: [] }) => {
  const logs = [];
  const r = await run({ fetch: fakeFetch(state), env: { KALENDER_ICAL: "https://ical.example/x.ics" }, jetzt: new Date(zeit), cfg: { projectId: "p", apiKey: "k", uid: "phil" }, probe: true, log: (x) => logs.push(x) });
  return { keys: r.dran.map((d) => d.key), dran: r.dran, logs, J: r.J };
};

/* Dienstag 3.11.: Morgenbericht 6:45 */
let r = await lauf("2026-11-03T06:50:00");
assert.ok(r.keys.includes("morgen:2026-11-03"), "Morgenbericht fehlt: " + r.keys);
const mb = r.dran.find((d) => d.key.startsWith("morgen")).msg;
console.log(mb.t + "\n" + mb.b + "\n");
assert.match(mb.b, /09:30 Seminar Deutsch/); assert.match(mb.b, /Losfahren: spätestens 07:50/); assert.match(mb.b, /🎂 Max \(12\)/);
assert.match(mb.b, /Wetter: 12° \/ 6°/);
/* längste freie Zeit: Seminar ab 8:00 belegt (90 Min. Fahrt) bis 11:00, Training ab 17:20 (10 Min. Fahrt) → 11 bis 17:20 */
assert.match(mb.b, /^Frei von 11 bis 17:20 Uhr\.$/m);
/* Arbeit: Mittwoch 8–12 Uhr = 4 Std. von 20 → 16 fehlen */
assert.match(mb.b, /^Diese Woche fehlen noch 16 Std\. Arbeit\.$/m);
/* Bereiche, die es nicht mehr gibt, stehen nicht mehr drin */
for (const weg of [/Top 3/, /Aufgabe/, /Heute dran/, /[Üü]berfällig/, /Klausur/, /Lernkarte/, /Vertrag/, /Gewohnheit/, /Bewerbung/, /Wäsche/, /Mail/])
  assert.doesNotMatch(mb.b, weg, "Morgenbericht enthält noch " + weg);
/* schon gesendet → nicht nochmal */
r = await lauf("2026-11-03T07:05:00", { writes: [], versand: { keys: ["morgen:2026-11-03"] } });
assert.ok(!r.keys.includes("morgen:2026-11-03"));
/* zu spät (über 2 Std. nach der Zeit) → nicht mehr */
r = await lauf("2026-11-03T09:00:00");
assert.ok(!r.keys.some((k) => k.startsWith("morgen")));
/* Losfahren: 15 Min. vorher */
r = await lauf("2026-11-03T07:37:00");
assert.ok(r.keys.some((k) => k.startsWith("los:2026-11-03")), "Losfahren fehlt: " + r.keys);
console.log(r.dran.find((d) => d.key.startsWith("los")).msg, "\n");
/* Aufgaben-Erinnerungen gibt es nicht mehr (t4 hätte um 14:00 erinnert) */
r = await lauf("2026-11-03T14:03:00"); assert.ok(!r.keys.some((k) => k.startsWith("auf")), "Aufgaben-Erinnerung kam noch: " + r.keys);
/* Abends 20:45: nur noch „Das steht morgen an“ */
r = await lauf("2026-11-03T20:47:00");
const ab = r.dran.find((d) => d.key.startsWith("abend")); assert.ok(ab); console.log(ab.msg.t + "\n" + ab.msg.b + "\n");
assert.equal(ab.msg.t, "Das steht morgen an");
assert.match(ab.msg.b, /Termine: 08:00 Arbeit · Büro/); assert.match(ab.msg.b, /Losfahren: spätestens 06:20 zu „Arbeit · Büro“/); assert.match(ab.msg.b, /Wetter: 10° \/ 4°/);
for (const weg of [/Erledigt/, /Erfasst/, /Gewohnheit/, /fällig/, /Aufgabe/]) assert.doesNotMatch(ab.msg.b, weg, "Abendtext enthält noch " + weg);
/* Gewohnheiten-Erinnerungen gibt es nicht mehr, auch nicht außerhalb der Ruhezeit */
items.find((x) => x.id === "h1").remind = "19:00";
r = await lauf("2026-11-03T19:02:00"); assert.ok(!r.keys.some((k) => k.startsWith("hab")), "Gewohnheits-Erinnerung kam noch");
/* Samstag: Morgenbericht erst 9:00 */
r = await lauf("2026-11-07T06:50:00"); assert.ok(!r.keys.some((k) => k.startsWith("morgen")));
r = await lauf("2026-11-07T09:02:00"); assert.ok(r.keys.includes("morgen:2026-11-07"));
/* Sonntag 18:45: Wochenvorschau ohne Fristen, Klausuren, Aufgaben */
r = await lauf("2026-11-08T18:50:00");
const wp = r.dran.find((d) => d.key.startsWith("woche")); assert.ok(wp); console.log(wp.msg.t + "\n" + wp.msg.b + "\n");
assert.match(wp.msg.b, /Sehr voll: Di 12 Std\./); assert.match(wp.msg.b, /Arbeit geplant: 0 von 20 Std\./);
for (const weg of [/Fristen/, /Hausarbeit/, /Klausur/, /Aufgabe/, /erledigt/]) assert.doesNotMatch(wp.msg.b, weg, "Wochenvorschau enthält noch " + weg);
/* Widget: keine Aufgaben mehr, aber das Feld bleibt leer da (ältere Widget-Skripte stürzen sonst ab) */
r = await lauf("2026-11-03T10:00:00");
{ const { widgetDaten } = await import("./meldungen.mjs"); const wd = widgetDaten(r.J, null);
  assert.deepEqual(wd.auf, { heute: 0, ueber: 0, top: [] }); assert.ok(!("gew" in wd)); assert.equal(wd.termine[0].ti, "Seminar Deutsch"); assert.equal(wd.termine[1].ti, "Training U13"); }

/* ---------- Warnung bei Überschneidungen ---------- */
{
  const { jarvis } = await import("./jarvis.mjs");
  const { jetztDran } = await import("./meldungen.mjs");
  const g = (id, date, start, end, title, extra = {}) => ({ gid: id, date, start, end, title, place: "", calName: "Google", ...extra });
  const J = (gcal, zeit, its = [], settings = {}) => jarvis({ items: its, settings, gcal, jetzt: new Date(zeit) });
  const ueb = (j, versand) => jetztDran(j, versand).filter((d) => d.key.startsWith("ueb:"));
  /* Donnerstag 5.11., 10 Uhr */
  const zwei = [g("a", "2026-11-05", "14:00", "16:00", "Zahnarzt"), g("b", "2026-11-05", "15:30", "17:00", "Elterngespräch")];
  let w = ueb(J(zwei, "2026-11-05T10:00:00"));
  assert.equal(w.length, 1, "Überschneidung heute nicht erkannt");
  assert.match(w[0].msg.t, /Heute/); assert.match(w[0].msg.b, /„Zahnarzt“ \(14:00–16:00\) und „Elterngespräch“ \(15:30–17:00\)/);
  console.log(w[0].msg.t + "\n" + w[0].msg.b + "\n");
  /* nur einmal: gemerkt → keine zweite Meldung */
  assert.equal(ueb(J(zwei, "2026-11-05T10:05:00"), [w[0].key]).length, 0, "Warnung kam doppelt");
  /* wird ein Termin verschoben und überschneidet sich immer noch, kommt eine neue Warnung */
  const verschoben = [zwei[0], g("b", "2026-11-05", "15:00", "17:00", "Elterngespräch")];
  assert.equal(ueb(J(verschoben, "2026-11-05T10:05:00"), [w[0].key]).length, 1, "verschobene Überschneidung nicht neu gemeldet");
  /* morgen auch, übermorgen nicht */
  const morgen = zwei.map((x) => ({ ...x, date: "2026-11-06" }));
  w = ueb(J(morgen, "2026-11-05T10:00:00")); assert.equal(w.length, 1); assert.match(w[0].msg.t, /Morgen/);
  assert.equal(ueb(J(zwei.map((x) => ({ ...x, date: "2026-11-07" })), "2026-11-05T10:00:00")).length, 0, "übermorgen darf noch nicht warnen");
  /* direkt hintereinander (16:00 Ende, 16:00 Beginn) ist keine Überschneidung */
  assert.equal(ueb(J([g("a", "2026-11-05", "14:00", "16:00", "Zahnarzt"), g("b", "2026-11-05", "16:00", "17:00", "Kaffee")], "2026-11-05T10:00:00")).length, 0);
  /* ganztägige Termine zählen nicht */
  assert.equal(ueb(J([g("a", "2026-11-05", null, null, "Urlaub"), zwei[0]], "2026-11-05T10:00:00")).length, 0);
  /* derselbe Termin in zwei Kalendern zählt nicht */
  assert.equal(ueb(J([zwei[0], { ...zwei[0], gid: "a2", calName: "U13 Trainer-Cockpit" }], "2026-11-05T10:00:00")).length, 0, "doppelter Termin als Überschneidung gemeldet");
  /* Fahrt zum eigenen Termin ist keine Überschneidung */
  const fahrt = [g("f", "2026-11-05", "13:00", "14:15", "Fahrt zum Zahnarzt"), g("z", "2026-11-05", "14:00", "15:00", "Zahnarzt")];
  assert.equal(ueb(J(fahrt, "2026-11-05T10:00:00")).length, 0, "Fahrt als Überschneidung gemeldet");
  /* in der Ruhezeit (21–7 Uhr) still, danach kommt sie */
  assert.equal(ueb(J(morgen, "2026-11-05T22:00:00")).length, 0, "Warnung in der Ruhezeit");
  assert.equal(ueb(J(zwei, "2026-11-05T07:05:00")).length, 1);
  /* abschaltbar in den Einstellungen */
  assert.equal(ueb(J(zwei, "2026-11-05T10:00:00", [], { push: { konflikt: false } })).length, 0, "Schalter wirkt nicht");
  /* heute schon vorbei → keine Warnung mehr */
  assert.equal(ueb(J(zwei, "2026-11-05T16:30:00")).length, 0, "Warnung für Vergangenes");

  /* Abfahrt liegt vor dem Ende des Termins davor: Homeoffice bis 12, Seminar an der Uni um 13 (90 Min. Fahrt → los 11:20) */
  const knapp = [g("h", "2026-11-05", "08:00", "12:00", "Arbeit Homeoffice"), g("s", "2026-11-05", "13:00", "14:30", "Seminar", { place: "Uni Münster" })];
  w = ueb(J(knapp, "2026-11-05T07:30:00"));
  assert.equal(w.length, 1, "knappe Abfahrt nicht erkannt"); assert.match(w[0].msg.t, /knapp/);
  assert.match(w[0].msg.b, /um 11:20 los/); assert.match(w[0].msg.b, /„Arbeit Homeoffice“ \(08:00–12:00\) ist erst um 12:00 zu Ende/);
  console.log(w[0].msg.t + "\n" + w[0].msg.b + "\n");
  /* genug Zeit dazwischen → nichts */
  assert.equal(ueb(J([{ ...knapp[0], end: "11:00" }, knapp[1]], "2026-11-05T07:30:00")).length, 0, "Warnung trotz genug Zeit");
  /* schon am selben Ort: zwei Vorlesungen hintereinander an der Uni → nichts */
  assert.equal(ueb(J([g("v1", "2026-11-05", "09:00", "10:30", "Vorlesung Mathe", { place: "Uni Münster" }), g("v2", "2026-11-05", "10:45", "12:15", "Seminar", { place: "Uni Münster" })], "2026-11-05T07:30:00")).length, 0, "Uni-Vorlesungen hintereinander gemeldet");
  /* eingetragene Fahrt: Arbeit bis 16:30, Fahrt zum Training ab 16:15 → knapp */
  const mitFahrt = [g("h", "2026-11-05", "13:00", "16:30", "Arbeit Homeoffice"), g("f", "2026-11-05", "16:15", "16:45", "Fahrt zum Training"), g("t", "2026-11-05", "16:45", "18:00", "Training U13", { place: "Stausee" })];
  w = ueb(J(mitFahrt, "2026-11-05T10:00:00"));
  assert.equal(w.length, 1, "Fahrt vor Ende der Arbeit nicht erkannt: " + JSON.stringify(w.map((x) => x.msg.b))); assert.match(w[0].msg.b, /um 16:15 los/);
  /* Widget (Plakat): Fahrten sind markiert, damit sie blass in der Liste stehen und nie groß als „Als Nächstes“ */
  { const { widgetDaten } = await import("./meldungen.mjs"); const wd = widgetDaten(J(mitFahrt, "2026-11-05T10:00:00"), null);
    assert.deepEqual(wd.termine.map((x) => [x.ti, x.f]), [["Arbeit Homeoffice", 0], ["Fahrt zum Training", 1], ["Training U13", 0]], "Fahrt im Widget nicht markiert"); }
  /* Widget unten (Phil 12.11.): noch verplante Stunden dieser Woche, ab jetzt, nur Arbeit, Uni (auch Lernen), Ehrenamt.
     Do 05.11. 10:00: Arbeit läuft noch 1 Std, Lernsession 2 Std, Training Fr 1,5 Std = 4,5. Nicht dabei: Mittwoch (vorbei), Zug, Kochen,
     „Kennenlernen“ (kein Lernen), nächster Montag. */
  { const { widgetDaten } = await import("./meldungen.mjs");
    const woche = [g("a1", "2026-11-04", "09:00", "12:00", "Arbeit Büro"), g("a2", "2026-11-05", "08:00", "11:00", "Arbeit Homeoffice"), g("z", "2026-11-05", "13:00", "14:00", "Zug nach Essen"),
      g("l", "2026-11-05", "14:00", "16:00", "Lernsession"), g("k", "2026-11-05", "18:00", "19:00", "Kochen"), g("t", "2026-11-06", "17:00", "18:30", "Training U13"),
      g("kl", "2026-11-07", "10:00", "11:00", "Kennenlernen Nachbarn"), g("n", "2026-11-09", "09:00", "13:00", "Arbeit Büro")];
    const wd = widgetDaten(J(woche, "2026-11-05T10:00:00"), null);
    assert.equal(wd.woche.rest, 4.5, "Widget: noch verplante Stunden falsch: " + wd.woche.rest);
    assert.equal(widgetDaten(J(woche, "2026-11-06T18:00:00"), null).woche.rest, 0.5, "Widget: am Freitag 18 Uhr zählt nur noch die halbe Stunde Training"); }
  /* Fußball-App: Abfahrt aus der Beschreibung (13:25) vor Ende der Arbeit (13:30) */
  const cockpit = [g("h", "2026-11-07", "09:00", "13:30", "Arbeit Homeoffice"), g("sp", "2026-11-07", "14:00", "16:00", "Spiel U13", { calName: "U13 Trainer-Cockpit", cockpit: true, abf: "13:25", abfMin: 10 })];
  w = ueb(J(cockpit, "2026-11-07T10:00:00")); assert.equal(w.length, 1); assert.match(w[0].msg.b, /um 13:25 los/);
  /* Training aus der Fußball-App ohne „Abfahrt:“: keine Losfahr-Warnung */
  assert.equal(ueb(J([cockpit[0], { ...cockpit[1], title: "Training U13", abf: null, abfMin: null }], "2026-11-07T10:00:00")).length, 0);

  /* Arbeitsstunden: Pause wird wie in der App abgezogen (7–16 Uhr am Stück = 9 Std. − 30 Min.), Uni zählt nicht als Arbeit */
  const jw = J([g("x", "2026-11-04", "07:00", "16:00", "Arbeit Büro"), g("y", "2026-11-05", "09:00", "11:00", "Vorlesung Mathe", { area: "uni" }), g("y2", "2026-11-03", "09:00", "10:00", "Arbeitsgruppe Didaktik", { area: "uni" }), g("y3", "2026-11-03", "17:00", "18:00", "Arbeitseinsatz Verein", { area: "team" })], "2026-11-05T06:50:00",
    [{ id: "w9", type: "work", date: "2026-11-06", start: "08:00", end: "10:00", place: "Homeoffice" }], { workHours: 15 });
  assert.equal(jw.arbeitWoche("2026-11-02"), 10.5);
  const mb2 = jetztDran(jw, []).find((d) => d.key.startsWith("morgen")).msg.b;
  assert.match(mb2, /^Diese Woche fehlen noch 4,5 Std\. Arbeit\.$/m);
  /* Soll erreicht → keine Zeile */
  assert.doesNotMatch(jetztDran(J([], "2026-11-05T06:50:00", [], { workHours: 0 }), []).find((d) => d.key.startsWith("morgen")).msg.b, /fehlen/);
  /* freie Zeit unter 1 Std. → keine Zeile */
  const voll = [g("1", "2026-11-05", "08:00", "11:30", "A"), g("2", "2026-11-05", "12:00", "15:00", "B"), g("3", "2026-11-05", "15:45", "20:00", "C")];
  assert.doesNotMatch(jetztDran(J(voll, "2026-11-05T06:50:00"), []).find((d) => d.key.startsWith("morgen")).msg.b, /Frei von/);
  /* ganzer Tag frei */
  assert.match(jetztDran(J([], "2026-11-05T06:50:00"), []).find((d) => d.key.startsWith("morgen")).msg.b, /^Frei von 8 bis 20 Uhr\.$/m);
  console.log("Überschneidungen, freie Zeit und Arbeitsstunden: alle Proben bestanden.\n");
}

/* Geheimnis VAPID_PRIVAT: kleine Tippfehler beim Eintragen werden verziehen, ein falscher Schlüssel stoppt den Rest nicht */
const e = crypto.createECDH("prime256v1"); e.generateKeys();
const priv = e.getPrivateKey().toString("base64url"), pub = e.getPublicKey().toString("base64url"), std = e.getPrivateKey().toString("base64");
for (const v of [priv, " " + priv + "\n", std, std + "=", '"' + priv + '"', "VAPID_PRIVAT = " + priv, JSON.stringify({ publicKey: pub, privateKey: priv })])
  assert.equal(vapidSchluessel(v, pub), priv, "Schlüssel nicht erkannt: " + v);
assert.equal(vapidSchluessel("abc", pub), null); assert.equal(vapidSchluessel(undefined, pub), null);
const echt = async (VAPID_PRIVAT) => {
  const state = { writes: [] }, ff = fakeFetch(state), gesendet = [];
  const fetch = (url, o) => url.includes("identitytoolkit") ? Promise.resolve({ ok: true, status: 200, json: async () => ({ idToken: "x" }) })
    : url.endsWith("/push?pageSize=300") ? Promise.resolve({ ok: true, status: 200, json: async () => ({ documents: [doc("users/phil/push/g1", { e: "https://push.example/1", p: "p", a: "a" })] }) }) : ff(url, o);
  const webpush = { setVapidDetails: (s, p, k) => { if (!/^[A-Za-z0-9_-]{43}$/.test(k)) throw new Error("Vapid private key must be a URL safe Base 64 (without \"=\")"); }, sendNotification: async () => { gesendet.push(1); } };
  let fehler = null;
  try { await run({ fetch, webpush, env: { HELFER_PASSWORT: "x", VAPID_PRIVAT, KALENDER_ICAL: "https://ical.example/x.ics" }, jetzt: new Date("2026-11-03T06:50:00"), cfg: { projectId: "p", apiKey: "k", uid: "phil" }, vapidPub: pub, log: () => { } }); } catch (x) { fehler = x.message; }
  return { fehler, gesendet: gesendet.length, versand: state.writes.some((w) => w[0] === "meta/versand"), brief: state.writes.some((w) => w[0] === "meta/brief") };
};
let x = await echt(std + "=\n");
assert.equal(x.fehler, null); assert.ok(x.gesendet > 0 && x.versand);
x = await echt("kaputt");
assert.match(x.fehler, /VAPID_PRIVAT/); assert.equal(x.gesendet, 0); assert.ok(!x.versand, "darf nicht als gesendet gelten"); assert.ok(x.brief, "Morgenbericht-Text für die App fehlt");
/* Fußball-App („U13 Trainer-Cockpit“): Losfahren nur aus der Zeile „Abfahrt:“, Trainings ohne diese Zeile gar nicht */
{
  const { abfahrtAus, termineAusIcs } = await import("./kalender.mjs");
  const { jarvis } = await import("./jarvis.mjs");
  assert.deepEqual(abfahrtAus("Spiel gegen SV Musterstadt\nAbfahrt: 13:25 Uhr (Fahrzeit ca. 10 Min., berechnet)"), { abf: "13:25", abfMin: 10 });
  assert.deepEqual(abfahrtAus("Treffpunkt Platz<br>Abfahrt: 9.05 Uhr"), { abf: "09:05", abfMin: null });
  assert.deepEqual(abfahrtAus("Training: 17:00 – 18:30 Uhr"), { abf: null, abfMin: null });
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20261107T140000\nDTEND;TZID=Europe/Berlin:20261107T160000\nUID:sp1@google.com\nSUMMARY:Spiel U13\nLOCATION:Sportplatz Nord\nDESCRIPTION:Anstoß 14:00\\nAbfahrt: 13:25 Uhr (Fahrzeit ca. 10 Min.\\, berechnet)\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20261107T163000\nDTEND;TZID=Europe/Berlin:20261107T183000\nUID:tr2@google.com\nSUMMARY:Training U13\nDESCRIPTION:Training: 17:00 – 18:30 Uhr\nEND:VEVENT\nEND:VCALENDAR`;
  const tc = termineAusIcs(ics, "2026-11-07", "2026-11-07", "U13 Trainer-Cockpit");
  assert.equal(tc.find((g) => g.title === "Spiel U13").abf, "13:25");
  const anders = { gid: "x1", date: "2026-11-07", start: "21:00", end: "22:00", title: "Training Kumpel", place: "Sportplatz", calName: "Google" };
  const J = jarvis({ items: [], settings: {}, gcal: tc.concat(anders), jetzt: new Date("2026-11-07T08:00:00") });
  const dep = J.departures("2026-11-07");
  assert.deepEqual(dep.map((x) => [x.b.title, x.at]), [["Spiel U13", "13:25"], ["Training Kumpel", "20:40"]], JSON.stringify(dep.map((x) => [x.b.title, x.at])));
  console.log("Fußball-App: Spiel 13:25 aus der Beschreibung, Training ohne Losfahren, andere Kalender wie bisher.\n");
}
/* Woche im Widget: Termine von Montag/Dienstag zählen auch am Donnerstag noch mit */
{
  const r = await lauf("2026-11-05T10:00:00");
  const ws = r.J.weekStats("2026-11-02");
  assert.ok(ws.days.find((d) => d.date === "2026-11-03").h >= 3, "Dienstag fehlt in der Woche: " + JSON.stringify(ws.days));
}
console.log("Alle Proben bestanden.");
