# SkiDuell

Erster lokaler Prototyp einer Ski-App für iOS und Android mit Expo SDK 54 / React Native.

## Start

Node.js 20.19+ verwenden (in dieser Umgebung: Node 24).

```sh
npm ci
npm start
```

QR-Code mit einer zu Expo SDK 54 passenden Expo-Go-Version öffnen. Falls die aktuelle Expo-Go-Version das SDK nicht unterstützt, einen Development Build für SDK 54 verwenden. Ein echtes Telefon mit GPS wird benötigt. Cloud-Rechner und Telefon benötigen eine erreichbare Verbindung zum Metro-Server; der lokale Cloud-Port ist nicht automatisch vom Telefon erreichbar.

```sh
npm run check
npx expo export --platform android --output-dir /tmp/skidu-export
```

## Umfang

- GPS-Aufzeichnung im Vordergrund, Strecke, ungefähre Aufstiegshöhenmeter und Dauer
- Touren und Skitage lokal speichern
- Persönliche Bestenliste: Kilometer über alle gespeicherten Touren und höchste gemessene GPS-Geschwindigkeit in km/h
- Lokales Fotoalbum
- Deutsche Oberfläche

Die Distanz umfasst alle Bewegungen, auch Liftfahrten. Keine automatische Erkennung von Abfahrten. Die App muss für GPS-Aufnahmen geöffnet bleiben. Kein Hintergrundtracking.

Noch nicht implementiert: Konten, Freunde, Online-Duelle, öffentliche Ranglisten, Uploads, Moderation und dauerhafte Bildspeicherung. Fotos referenzieren lokale Picker-Dateien und können nach Cache-Bereinigung fehlen. Daten werden nicht mit anderen Geräten synchronisiert.

## Prüfung auf dem Telefon

Standort erlauben und verweigern testen; Tour im Freien starten, eine bekannte Strecke zurücklegen, beenden und App neu öffnen. Distanz und gespeicherte Tour kontrollieren. Foto auswählen und Auswahl abbrechen testen. App in den Hintergrund wechseln und GPS-Verhalten prüfen. Diese Geräteprüfungen können in einer Cloud-Shell nicht ersetzt werden.

Max. Speed wird für neue Touren gespeichert. Ältere Touren enthalten keine Geschwindigkeitsmessung; ohne gültigen Wert zeigt die Liste „–“. GPS-Spitzenwerte sind Näherungswerte und noch nicht auf einem echten Gerät validiert.

## Après-Ski

Unter Duell gibt es eine eigene 🍾 Après-Ski-Tabelle. Ein Besuch zählt erst nach Auswahl eines Beweisfotos und ausdrücklichem Speichern. Auswahl abbrechen zählt keinen Besuch. Jeder bestätigte Check-in ist ein Besuch (keine Tagesbegrenzung). Fotos werden nicht auf Echtheit geprüft. Beweisfotos werden mit expo-file-system im Dokumentenverzeichnis der App gespeichert, die Besuchsdaten in AsyncStorage; keine Online-Übertragung. Vorhandene Touren/Fotos bleiben bei der Datenmigration erhalten. Deinstallation oder Löschen der App-Daten entfernt lokale Einträge und Beweisfotos.

Geräteprüfung: Fotoauswahl abbrechen, Foto auswählen und Check-in bestätigen, App neu starten und Anzahl sowie Beweisfoto kontrollieren. Eine gemeinsame Freundestabelle ist noch nicht angebunden. Die separate HTML-Vorschau hält Check-ins nur bis zum Schließen.
