# Jarvis-App: Was ohne KI nicht (gut) geht

Stand 28.10.2026. Die eigene Jarvis-App hat keine KI, damit keine Kosten pro Anfrage entstehen.
Hier steht, was dadurch wegfällt oder einfacher geworden ist. Gedacht für das spätere Planungs-Projekt in Claude,
das diese Dinge übernehmen kann (dort läuft die KI über das Claude-Abo).

## Ganz weggefallen (ausgeblendet)

| Was | Wo es war | Was die App jetzt macht |
|---|---|---|
| Lernkarten und Kurzfassung aus Folien | Uni › Fach › Material | Speichert den Text durchsuchbar, macht eine Gliederung (erste Zeile jeder Folie). Lernkarten trägt Phil selbst ein („Frage \| Antwort“). |
| Fotos von Tafel oder Skript lesen | Uni › Material | Geht nicht mehr. Nur PDF, Word, PowerPoint, Text. |
| Folien, die nur aus Bildern bestehen | Uni › Material | Geht nicht mehr (kein Text im PDF). |
| Fragen an die Unterlagen mit Antwort in eigenen Worten | Uni › Fach | Jetzt „In deinen Unterlagen suchen“: zeigt die 3 passendsten Stellen mit Folie. Keine ausformulierte Antwort. |
| Stundenplan aus PDF oder Screenshot lesen | Uni › Stundenplan | Nur noch die iCal-Datei (.ics) aus dem LSF. |
| Freie Fragen an Jarvis („Was soll ich heute zuerst machen?“) | Eingabefeld | Nur feste Fragen: Termine heute/morgen/an einem Tag, was fällig ist, Wetter, Einkaufsliste, wie voll die Woche ist. Sonst wird es eine Notiz. |
| Jarvis lernt nebenbei etwas über Phil („Vermutet – stimmt das?“) | Gedächtnis | Fällt weg. Nur noch „Merk dir …“ von Hand. |
| Termine per Satz verschieben („Leg den Zahnarzt auf Freitag“) | Eingabefeld | Fällt weg. Verschieben im Tagesplan per Tipp auf den Termin. |
| Tipp für den Tag im Morgenbericht | Startseite | Fällt weg. Der Bericht kommt in Zeilen (Termine, Fristen, Wetter, Woche, Mails) mit einem kurzen Satz aus den Daten. |
| Abendtext von Jarvis | Tagesabschluss | Fällt weg, die Zahlen und Listen bleiben. |

## Einfacher geworden (feste Regeln statt KI)

| Was | Wie es jetzt geht | Grenze |
|---|---|---|
| Eingabefeld „Schnell notieren“ | Erkennt feste Muster: Termin mit Tag/Uhrzeit, Aufgabe mit Frist („bis Fr“), Einkauf („Milch und Eier kaufen“, „Einkauf: …“), Ausgabe („12 € Döner“), Erinnerung („Erinner mich morgen um 9 an …“), Wiederholung („Jeden Montag Müll“), Warte auf, Idee, „Merk dir …“, Zeiten per Satz, „Plan mir 4 Std. Lernen ein“, „Ich bin platt“, „Mails aufräumen“. Vor dem Speichern immer Nachfrage. | Freie Sätze ohne Tag oder Muster landen als Notiz im Eingangskorb. Mehrere Dinge in einem Satz erkennt es nur zeilenweise. |
| Siri-Notizen einsortieren | Gleiche Regeln, Zeile für Zeile. | Unklare Zeilen werden als Aufgabe vorgeschlagen, Phil prüft. |
| Mails wichtig / unwichtig | Regeln: Uni-Adresse, Personen, Stichwörter (Klausur, Frist, Rechnung, Dienstplan, Sicherheitswarnung …), Gmail-Kategorien, noreply-Absender. Phil kann bei jeder Mail „Ist wichtig“ / „Ist unwichtig“ tippen, dann merkt sich die App den Absender. | Keine Kurzfassung der Mail. Aufgaben aus Mails nur bei klarer Frist („bis 15.11.“, „bis Freitag“) oder Rechnung. |
| Werbung & Spam aufräumen | Gleiche Regeln plus typische Spam-Wörter. Vorausgewählt nur Werbung und Spam. | Phishing ohne typische Wörter erkennt es nicht. |
| Antwort auf eine Mail | Vorlage mit passender Anrede (du oder Sie) und Lücke [ … ]. | Den eigentlichen Text schreibt Phil. Bei Mails rund um die Mannschaft keine Vorlage. |
| Top 3 für heute | Überfälliges, dann heute dran, dann dringend, dann nach Frist. | Weiß nicht, wie anstrengend eine Aufgabe ist. |
| Große Aufgabe / Projekt zerlegen | Vorlagen nach Stichwort (Hausarbeit, Referat, Klausur, Übungsblatt, Bewerbung, Umzug, Steuer, Party, Training, Aufräumen, Reise), Teilfristen gleichmäßig verteilt. | Passt nicht auf jede Aufgabe, im Bestätigen-Fenster änderbar. |
| Arbeitszeit der Woche vorschlagen | Fester Rechenweg: Ziel-Stunden auf die Arbeitstage verteilt (kurzer Tag halb), Fenster und Pausen aus den Regeln. | Büro oder Homeoffice muss Phil selbst wählen. Freitext-Regeln versteht es nur teilweise (frühestens/spätestens, „kurzer Tag“). |
| Lernblöcke für Fristen | Je Aufgabe ein Block (60–90 Min.) im ersten freien Platz vor der Frist, höchstens 2 pro Tag. | Kein Abwägen, welche Aufgabe mehr Zeit braucht. |
| Essensplan | Feste Liste mit 28 einfachen Gerichten, an vollen Tagen schnelle, keine Wiederholung aus den letzten 2 Wochen, ab und zu „Reste vom Vortag“. | Nur diese Gerichte haben Zutaten. Eigene Gerichte kennt die Einkaufsliste nicht. |
| Packlisten | Vorlagen nach Listenname (Training, Spiel, Urlaub, Klausur, Uni, Büro, Schwimmbad, Fitness, Camping, Ski, Party, Umzug), sonst eine allgemeine Liste. | Keine Ideen über die Vorlage hinaus. |

## Ideen für das Planungs-Projekt in Claude

- Wochenplanung am Sonntag mit KI: die App-Daten lesen, Tipps und Abwägungen geben, Lernkarten aus neuen Folien machen.
- Mails einmal am Tag mit KI zusammenfassen und Antwortentwürfe schreiben (in Claude, auf das Abo).
- Freie Fragen und „Verschieb mir …“ dort stellen.
