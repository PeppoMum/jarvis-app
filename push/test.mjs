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
assert.match(mb.b, /09:30 Seminar Deutsch/); assert.match(mb.b, /Losfahren: spätestens 07:50/); assert.match(mb.b, /🎂 Max \(12\)/); assert.match(mb.b, /Klausur Mathe/);
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
/* Aufgaben-Erinnerung 14:00 */
r = await lauf("2026-11-03T14:03:00"); assert.ok(r.keys.includes("auf:t4:2026-11-03T14:00"));
/* Abendrückblick 20:45 */
r = await lauf("2026-11-03T20:47:00");
const ab = r.dran.find((d) => d.key.startsWith("abend")); assert.ok(ab); console.log(ab.msg.t + "\n" + ab.msg.b + "\n");
assert.match(ab.msg.b, /Erfasst: 5 Std 30 Min/); assert.match(ab.msg.b, /Morgen: 08:00 Arbeit · Büro/);
/* Gewohnheit 21:30 liegt in der Ruhezeit (21–7) → keine Meldung */
r = await lauf("2026-11-03T21:35:00"); assert.ok(!r.keys.some((k) => k.startsWith("hab")));
/* Samstag: Morgenbericht erst 9:00 */
r = await lauf("2026-11-07T06:50:00"); assert.ok(!r.keys.some((k) => k.startsWith("morgen")));
r = await lauf("2026-11-07T09:02:00"); assert.ok(r.keys.includes("morgen:2026-11-07"));
/* Sonntag 18:45: Wochenplanung */
r = await lauf("2026-11-08T18:50:00");
const wp = r.dran.find((d) => d.key.startsWith("woche")); assert.ok(wp); console.log(wp.msg.t + "\n" + wp.msg.b + "\n");
assert.match(wp.msg.b, /Hausarbeit Gliederung \(Do\)/); assert.match(wp.msg.b, /Sehr voll: Di 12 Std\./);

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
