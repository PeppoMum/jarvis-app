# Jarvis-App – Bauplan für alle Bau-Threads (Stand 28.10.2026, 21:00)

Ziel: Jarvis als eigene App fürs iPhone (zum Home-Bildschirm), ersetzt später Jarvis in Claude. Phil hat entschieden (28.10. 20:55):
alles von Anfang an, nur das futuristische Jarvis-Design „Rüstung“ (6 Farben, hell + dunkel), Daten mitnehmen, GitHub + Firebase,
Meldungen: Morgenbericht Mo–Fr 6:45 und Sa/So 9:00 (Annahme, bei Phil nachgefragt), Abendrückblick 20:45, Wochenplanung So 18:45.
Keine KI in der App (keine Kosten pro Anfrage). Phil ist kein ITler: Antworten auf Deutsch, Alltagssprache.

## Wo
- Code: Phils Mac, Ordner `/Users/philmumbeck/Library/CloudStorage/OneDrive-Persönlich/Claude coden/Jarvis-App`
  (im Linux-Fenster des Macs: `$HOME/mnt/Claude coden/Jarvis-App`). Nichts außerhalb dieses Ordners anlegen.
- Phil lädt selbst zu GitHub (Repo kommt noch) hoch. Firebase-Projekt legt Phil an.
- Alte App zum Abschreiben: `/mnt/project-files/jarvis/handy-app/jarvis-alt-v48.html` (Live-Stand V48). Übersicht: `/mnt/project-files/jarvis/handy-app-plan/bestandsaufnahme.md`,
  Technik der alten App: `/mnt/project-files/jarvis/grundgeruest-technik.md`.
- Vorbild für Aufbau, Anmeldung, Push: Phils Mannschafts-App `github.com/PeppoMum/U13-HUB` (öffentlich, klonbar):
  GitHub Pages + Firebase (compat-SDK 10.14.1 von gstatic) + `sw.js` + Push per GitHub-Actions-Zeitplan (`push/senden.mjs`, web-push, VAPID, Versand-Helfer-Konto).

## Grundidee (schnellster Weg)
Die alte App wird fast unverändert übernommen. Ihr Speicher hat schon dieselbe Form wie Firestore
(`db.collection('items').doc(id).set`, `db.doc('meta/settings').onSnapshot`). Darum:
- `db` = Firestore, beschränkt auf `users/{uid}/…` (gleiche Sammlungen: items, meta, trash, log, matpages …).
- `mcp.callTool(server, tool, args)` = Nachbau in `js/google.js`, der für 'Google Calendar', 'Gmail', 'AccuWeather®'
  GENAU die Antworten liefert, die der alte Code erwartet (der alte Code liest sie aus; dort nachsehen).
- `sample` (KI) = null. Stellen mit KI bekommen eine Fassung ohne KI oder verschwinden (Thread „KI-Teile ersetzen“).
- `assets` (Dateien) und 'Claude Code Remote' (Berichte) gibt es nicht mehr → Berichte werden zu Meldungen.

## Aufbau des Ordners (wer darf was) – steht seit 28.10. 21:10
Die alte App ist 1:1 aufgeteilt (Werkzeug: /mnt/project-files/jarvis/handy-app/werkzeug/aufteilen.py + anpassen.py). Alle Dateien sind klassische Skripte,
alles Gemeinsame ist global (wie vorher in einer Datei). Reihenfolge der Skripte steht in index.html und darf nicht geändert werden.
Getestet: lädt ohne Fehler am Handy und PC (ohne Firebase speichert sie dann nur lokal).

| Datei | Inhalt (alter Abschnitt) | gehört |
|---|---|---|
| `index.html`, `firebase-config.js`, `firestore.rules`, `.gitignore`, `umzug/` | Hülle, Firebase-Zugang, Regeln, Daten-Umzug | Grundgerüst |
| `js/00-start.js` | Firebase, Google-Anmeldung, `jarvisConnect()` → {db, mcp, downloads}, `jarvisSignOut()` | Grundgerüst |
| `js/01-basis.js` | Hilfsfunktionen, Zustand S, Speicher, boot(), Aussehen, Farben (isJarvis() = immer true) | Grundgerüst |
| `js/02-daten.js` | blocksOn, Hinweise (HINT_KINDS, hintsAll) | Grundgerüst |
| `js/google.js` | `window.jarvisMcp` = Nachbau von mcp.callTool (Kalender, Gmail, Wetter) | Thread „Google-Zugang“ |
| `js/push.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `push/`, `.github/`, `widget/`, `kurzbefehle/` | Meldungen, App-Hülle, Widget, Siri | Thread „Meldungen“ |
| `js/04-eingabe.js` (KI-Eingang, Toast, Sicherung), `js/06-uni.js`, `js/07-wetter-mail.js`, `js/08-extras.js` (Suche, Ausgaben, Gedächtnis, Mail aufräumen, Stundenplan-Import, Sprechen, Berichte, Siri, Wiederholungen, Top 3, Zerlegen, Lernplan), `js/10-alltag.js` (Rückblick, Papierkorb, Essen, Geburtstage, Protokoll, Verträge, Haushalt, Hinweise-Seite, Mail-Entwürfe, Uni-Folien) | Stellen mit KI | Thread „KI-Teile ersetzen“ |
| `css/jarvis.css`, `js/03-oberflaeche.js` (Rendern, Startseite), `js/05-seiten-kalender.js` (Seiten, Verschieben, Menü, Google-Kalender-Abruf, Wochenplanung), `js/09-zeiten.js`, `js/11-aufgaben-planung.js`, `js/12-ereignisse.js` (Klicks, Start) | Oberfläche | Thread „Alles am Handy prüfen“ |
| `ANLEITUNG-PHIL.md` | Schritte für Phil | Grundgerüst; andere schicken ihren Teil per Nachricht |

Schnittstellen:
- `window.JARVIS_SCOPES` (Liste) und `window.jarvisOnGoogleToken(accessToken, result)`: setzt google.js; 00-start.js fragt die Rechte bei der Google-Anmeldung mit an und meldet das Zugangs-Token zurück.
- `window.jarvisMcp` muss gesetzt sein, BEVOR `jarvisConnect()` fertig ist (google.js lädt vor 00-start.js).
- `window.jarvisUser` = angemeldete Person (uid, email). Speicherpfad `users/{uid}/…`.
- `sample` (KI) ist immer null. Der alte Code prüft das an den meisten Stellen schon (`if (!sample) …`).

Regeln:
- Nur eigene Dateien ändern. Braucht man etwas in einer fremden Datei: dem Besitzer-Thread schreiben.
- Klassische Skripte, keine Bausteine/Bundler (wie U13-HUB). Alles Gemeinsame liegt global wie in der alten App.
- Neue Gestaltung nur über die Farb-Variablen (--bg --card --soft --ln --tx --mu --ac --onac --acs --onacs --nav --navtx --navon --onnavon, --jstr --onjstr --jglow --jtrk, Ampel --g --y --o --r).
  Schrift nie über Durchsichtigkeit abschwächen; Kontrast 4,5; Handy-Felder 16 px.
- Keine Geheimnisse in Dateien (VAPID privat, iCal-Geheimadresse, Passwörter → GitHub-Geheimnisse, macht Phil).
- Nichts löschen auf dem Mac (geht dort auch nicht ohne Freigabe). Testen im Linux-Fenster des Macs oder in der Cloud mit Playwright.
- Ergebnis jedes Threads: kurze Notiz unten in diesem Bauplan (Abschnitt „Stand“), was fertig ist und was noch fehlt.

## Daten in Firebase
`users/{uid}/items/{id}`, `users/{uid}/meta/{name}`, `users/{uid}/trash/{id}`, `users/{uid}/log/{id}`, `users/{uid}/matpages/{id}`,
`users/{uid}/push/{gerät}` (Push-Anmeldungen). Regeln: nur Phil (uid) liest/schreibt; Versand-Helfer darf lesen (für Meldungen).

## Stand
- 28.10. 21:10 Grundgerüst: Aufteilung + Firebase-Speicher + Anmeldung + nur Rüstung fertig und auf dem Mac. Offen: Daten-Umzug, Anleitung für Phil.
- 28.10. 21:20 Google-Zugang: `js/google.js` fertig (Kalender list/create/update/delete_event, Gmail search_threads/get_thread/trash/untrash/mark_thread_spam/create_draft, Wetter über Open-Meteo, DWD-Warnungen über Bright Sky; Antworten in der alten Form, mit Testseite geprüft). Google-Zugang mit Rückkehr-Schlüssel in `users/{uid}/meta/google` (Client-ID, Clientschlüssel, Schlüssel, E-Mail): einmal auf einem Gerät verbinden, gilt überall, auch in der Home-Bildschirm-App. Offen beim Grundgerüst: Karte `JarvisGoogle.settingsHTML()` in die Einstellungen, auf `jarvis-google` hin `fetchGcal(); render();`, Wetter-Text „AccuWeather“ → „Open-Meteo“.
- 28.10. 22:20 KI-Teile ersetzen: 04, 06, 07, 08, 10 ohne KI fertig und auf dem Mac (in der Cloud mit Playwright getestet, Handy und PC, keine Fehler). Eingabe = „Schnell notieren“ (feste Muster, sonst Notiz), Mails nach Regeln (Absender merken in `settings.mailRules`), Top 3 nach Frist, Zerlegen/Packlisten/Essen aus Vorlagen, Uni: Text speichern + suchen + eigene Lernkarten, Stundenplan nur .ics. Für andere Dateien: `briefLocal()` (04), `projectStepsLocal`, `planWorkLocal`, `planStudyLocal` (08); Berichte-Seite ruft `pageMeldungen()` (push.js). Was ohne KI fehlt: `KI-SPAETER.md`. Aufräumen möglich in 12: Klick-Zeilen für repedit/repdel/repnew/repon/repkind/report (Berichte gibt es nicht mehr).
- 28.10. 22:20 Meldungen: fertig und auf dem Mac. `sw.js` (offline + Meldungen anzeigen, Antippen öffnet die passende Seite), `manifest.webmanifest`, `icons/` (Rüstung Rot-Gold),
  `js/push.js` (Meldungen ein/aus je Gerät unter users/{uid}/push, `pageMeldungen()` für die Seite „Berichte“, Briefkasten für Kurzbefehle unter kasten/{schlüssel}/m),
  `push/` (senden.mjs + jarvis.mjs/meldungen.mjs/kalender.mjs/wetter.mjs, Probe: `node push/test.mjs`), `.github/workflows/meldungen.yml` (alle 5 Min.), `widget/Jarvis.js` (Scriptable) + Anleitung, `kurzbefehle/ANLEITUNG.md`.
  firestore.rules um Versand-Helfer (meldungen@jarvis-app.web.app), kasten/ und widget/ ergänzt. Texte ohne KI landen auch in meta/brief, meta/briefEvening, meta/briefWeekly.
  Offen (braucht Phil): Helfer-Konto in Firebase, GitHub-Geheimnisse HELFER_PASSWORT, VAPID_PRIVAT, JARVIS_UID (Schritte: push/LIESMICH.md). Menüname „Berichte“ → „Meldungen“ liegt beim Oberflächen-Thread.
- 28.10. 22:50 Oberfläche geprüft (css/jarvis.css, js 03/05/09/11/12): fertig und auf dem Mac. Mit allen anderen Teilen zusammen getestet (Mac-Stand 22:16): jeden Knopf auf jeder Seite angeklickt, Handy 390/360 hell+dunkel und PC, 6 Farben, 0 Fehler, Schrift-Kontrast überall ≥ 4,5, nichts steht über den Rand.
  Neu: Claude-Hinweise raus, Eingabe „Schnell notieren“ und die Ohne-KI-Funktionen eingebunden, Menüpunkt „Berichte“ heißt „Meldungen“ (Route bleibt 'berichte'), Karte `JarvisGoogle.settingsHTML()` in den Einstellungen, Wetter-Text „Open-Meteo“,
  Fahrten blass/gestrichelt (wie Artifact V49), Notch/Home-Leiste sauber (Fläche unter Eingabe + Menüleiste bis ganz unten), Eingang-Zahl als Schild, Auffrischen beim Zurückholen der App, Bildschirm bleibt im Fokus-Vollbild an (Wake Lock), alte Berichte-Klicks in 12 entfernt.
  Prüf-Skripte: /mnt/project-files/jarvis/handy-app/pruefen/test/ (klick.js klickt jeden Knopf, kontrast.js, NOTCH=1 simuliert iPhone-Ränder, APP=Ordner). Offen: Tastatur am echten iPhone einmal ausprobieren.
