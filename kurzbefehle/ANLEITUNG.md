# Kurzbefehle und Siri für Jarvis

Voraussetzung: Das Widget-Skript ist eingerichtet (siehe Ordner „widget“, Schritte 1 bis 3).
Die Kurzbefehle schicken einen Auftrag an Jarvis. Jarvis trägt ihn mit der richtigen Uhrzeit ein, sobald die App das nächste Mal offen ist.

## Arbeit starten
1. App **Kurzbefehle** öffnen, oben rechts **+**.
2. **Aktion hinzufügen**, „Scriptable“ suchen, **Run Script** wählen.
3. Bei Script **Jarvis** wählen. Auf den Pfeil tippen und bei **Parameter** eintragen: `start`
4. „Show When Run“ ausschalten.
5. Oben den Namen **Arbeit starten** eintragen. Fertig.

## Pause und Feierabend
Genauso wie oben, nur mit anderem Namen und Parameter:

| Name | Parameter | Was passiert |
|---|---|---|
| Pause | `pause` | Hält die laufende Zeit an. Nochmal ausführen: läuft weiter. |
| Feierabend | `stopp` | Beendet die Zeit und trägt sie ein. |
| Uni starten | `start:uni` | Wie Arbeit starten, nur für die Uni. |

## Jarvis notieren (mit Siri)
1. Neuer Kurzbefehl, Aktion **Text diktieren**.
2. Aktion **Text** hinzufügen und hineinschreiben: `notiz:` und direkt dahinter die blaue Variable **Diktierter Text**.
3. Aktion **Run Script** (Scriptable), Script **Jarvis**, Parameter: die blaue Variable **Text**.
4. Name: **Jarvis notieren**.

Die Notiz landet im Eingangskorb. Fängt sie mit „Einkauf:“ an (zum Beispiel „Einkauf: Milch, Brot“), kommt alles direkt auf die Einkaufsliste.

Deinen bisherigen Kurzbefehl „Jarvis“ (der eine Mail schickt) kannst du genauso umbauen: Statt „E-Mail senden“ die Schritte 2 und 3 von hier nehmen. Dann braucht es keine Mail mehr.

## Mit Siri sprechen
Siri kennt jeden Kurzbefehl beim Namen: „Hey Siri, **Arbeit starten**“, „Hey Siri, **Pause**“, „Hey Siri, **Feierabend**“, „Hey Siri, **Jarvis notieren**“.
Siri sagt danach kurz, was passiert ist.

## Noch schneller
- Kurzbefehle lassen sich ins Kontrollzentrum oder auf die Aktionstaste legen (Einstellungen › Aktionstaste › Kurzbefehl).
- Das Widget „Kurzbefehle“ auf dem Home-Bildschirm zeigt deine Jarvis-Kurzbefehle als Knöpfe.
