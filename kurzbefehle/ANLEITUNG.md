# Kurzbefehle und Siri für Jarvis

Voraussetzung: Das Widget-Skript ist eingerichtet (siehe Ordner „widget“, Schritte 1 bis 3).
Die Kurzbefehle schicken einen Auftrag an Jarvis. Jarvis trägt ihn mit der richtigen Uhrzeit ein, sobald die App das nächste Mal offen ist.

Tipp: Das Wort (zum Beispiel `start`) nicht direkt in „Skript ausführen“ eintippen, das klappt dort oft nicht. Es kommt vorher in eine eigene Aktion **Text**.

## Arbeit starten
1. App **Kurzbefehle** öffnen, oben rechts **+**.
2. **Aktion hinzufügen**, „Text“ suchen, **Text** wählen. Ins Feld schreiben: `start`
3. Darunter: **Aktion hinzufügen**, „Scriptable“ suchen, **Run Script** (Skript ausführen) wählen.
4. Bei Script **Jarvis** wählen. Auf den Pfeil tippen, bei **Parameter** tippen und die blaue Variable **Text** wählen.
5. „Show When Run“ ausschalten.
6. Oben den Namen **Arbeit starten** eintragen. Fertig.

## Pause, Feierabend, Uni
Genauso wie oben, nur mit anderem Namen und anderem Wort in der Aktion Text:

| Name | Wort in „Text“ | Was passiert |
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

## Claude öffnen
Öffnet direkt dein Planungs-Projekt in Claude.
1. Neuer Kurzbefehl, Aktion **URL** wählen und den Link zu deinem Planungs-Projekt einfügen.
2. Aktion **URLs öffnen** dazunehmen.
3. Name: **Claude öffnen**.

Im Widget-Menü gibt es denselben Punkt. Beim ersten Mal fragt es nach dem Link: einfügen, Speichern. Ändern geht im Menü über „Claude-Link ändern“.

## Mit Siri sprechen
Siri kennt jeden Kurzbefehl beim Namen: „Hey Siri, **Arbeit starten**“, „Hey Siri, **Pause**“, „Hey Siri, **Feierabend**“, „Hey Siri, **Jarvis notieren**“, „Hey Siri, **Claude öffnen**“.
Siri sagt danach kurz, was passiert ist.

## Noch schneller
- Kurzbefehle lassen sich ins Kontrollzentrum oder auf die Aktionstaste legen (Einstellungen › Aktionstaste › Kurzbefehl).
- Das Widget „Kurzbefehle“ auf dem Home-Bildschirm zeigt deine Jarvis-Kurzbefehle als Knöpfe.
