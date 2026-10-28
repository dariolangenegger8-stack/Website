# SkiDuell – Website

Mobile Website für Ski-Touren, gemeinsame Gesamt-Kilometer-/Max-Speed-Ranglisten, 🍾 Après-Ski-Check-ins mit Beweisfoto und einen Foto-Feed für angemeldete Mitglieder. Vite baut die Website; Supabase übernimmt E-Mail-Anmeldung, PostgreSQL und privaten Bildspeicher. Vercel-Konfiguration für automatische Deployments ist enthalten.

## Lokal starten

Node.js 24 verwenden.

```sh
npm ci
cp .env.example .env
# Öffentliche Supabase-Projekt-URL und Publishable Key in .env eintragen.
npm run dev
```

Ohne Supabase-Konfiguration ist die Oberfläche als Vorschau verfügbar. Anmeldung, Aufzeichnung und Speichern bleiben deaktiviert. Es werden keine Beispieldaten als echte Ranglistendaten ausgegeben. GPS funktioniert nur über HTTPS oder localhost, mit Standortfreigabe und geöffnetem Browser. Bildschirmsperre/Hintergrundbetrieb können die Messung unterbrechen. Keine automatische Trennung von Liftfahrten und Abfahrten. Max-Speed-Werte sind GPS-Näherungswerte. Rohkoordinaten werden nicht an die Datenbank gesendet.

## Online einrichten: Supabase + Vercel

Die Online-Dienste sind noch nicht provisioniert oder verbunden; es wurde kein öffentliches Deployment erstellt. Es liegen hier keine Zugangsdaten für diese Anbieter vor.

1. In Supabase ein neues Projekt erstellen, vorzugsweise in einer passenden europäischen Region. Unter **SQL Editor** die Datei [Migration](supabase/migrations/202610280001_skiduell.sql) einmal vollständig ausführen. Sie erstellt Tabellen, Registrierungstrigger, Ranglistenfunktion, private Storage-Buckets und Zugriffsregeln. Nicht erneut ausführen, wenn sie bereits angewendet wurde; weitere Änderungen als neue Migration ergänzen.
2. Unter **Authentication → Providers → Email** E-Mail-Anmeldung und E-Mail-Bestätigung aktivieren. Unter **URL Configuration** später die HTTPS-Vercel-Adresse als Site URL und erlaubte Redirect URL eintragen. Vorläufig lokal `http://localhost:5173` als zusätzliche Redirect URL verwenden. Für viele Registrierungen einen eigenen SMTP-Versand konfigurieren; der Standardversand ist begrenzt.
3. Aus den Supabase-Projekteinstellungen die **Project URL** und den öffentlichen **Publishable Key** kopieren. Ein alter öffentlicher `anon`-Key wird ebenfalls unterstützt. Niemals `service_role`, `sb_secret_*`, Datenbankpasswort oder persönliche Tokens in `VITE_*` eintragen: Vite veröffentlicht diese Variablen im Browser.
4. Den Website-Code in das GitHub-Repository bringen. In diesem Arbeitsstand wurde noch nichts gepusht. In Vercel **Add New → Project** wählen und `dariolangenegger8-stack/Website` importieren. Projektwurzel ist das Repository; Build-Befehl und Ausgabeordner sind in `vercel.json` festgelegt.
5. Im Vercel-Projekt die Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` für Production setzen. Für Preview-Deployments vorzugsweise ein separates Supabase-Testprojekt verwenden. Vercel lädt diese Variablen beim Build; nach Änderungen erneut deployen. Ohne gültige Konfiguration stoppt `build:deploy` absichtlich.
6. Deployen und die endgültige HTTPS-Adresse in Supabase wie in Schritt 2 eintragen. Danach Registrierung und Bestätigungslink prüfen. Nach der einmaligen GitHub-Verbindung veröffentlicht Vercel Änderungen am ausgewählten Production-Branch automatisch. Das Veröffentlichen dieser Codex-Cloud-Umgebung ersetzt kein Vercel-Deployment.

Für spätere Cloud-Zugriffe zusätzlich den konkreten Supabase-Projekthost und gegebenenfalls die Vercel-API in den Netzwerkeinstellungen freigeben; aktuell wurden keine unbekannten Ziele pauschal freigeschaltet.

Keine Tokens oder Passwörter in Chat oder Repository eintragen. Anbieter-Zugangsdaten nur in den jeweiligen sicheren Einstellungen hinterlegen. Es wurden keine kostenpflichtigen Dienste gebucht; aktuelle Freikontingente und Grenzen bei den Anbietern prüfen.

## Daten und Zugriffe

- `profiles`: Anzeigename; E-Mail bleibt im Auth-System und erscheint nicht in der Rangliste.
- `tours`: nur für den Eigentümer les-/schreibbar, Speicherung von Gesamtwerten ohne Route.
- `leaderboard()`: nur angemeldete Nutzer, Kilometer über alle Touren, höchster Max-Speed-Wert und Anzahl Après-Ski-Besuche aller Mitglieder. Noch keine separaten privaten Freundesgruppen. Einträge aktualisieren über „Aktualisieren“.
- `apres_visits`: private Besuchseinträge. Die Datenbank prüft, dass ein eigenes hochgeladenes Beweisfoto existiert; das Bild wird nicht auf Echtheit geprüft. Gezählt werden Besuche, keine Getränke. Mehrere Besuche am selben Tag sind möglich.
- `posts`: Foto-Metadaten und Bilder für alle angemeldeten Mitglieder sichtbar, kein anonymer öffentlicher Zugriff.
- Beide Bild-Buckets sind privat. Beweisfotos sieht nur der Eigentümer. Bilder werden im Browser als JPEG neu kodiert (max. 1600 px), dadurch werden ursprüngliche EXIF-Metadaten nicht übernommen. Anzeige über kurzlebige signierte URLs; wer eine solche URL erhält, kann sie bis zum Ablauf öffnen.
- Row Level Security begrenzt Tabellen und Storage. Besitzer können Datensätze über die API löschen; Bilder erst nach Löschen des zugehörigen Eintrags. Eigene Fotos, Après-Ski-Einträge und Touren können über einen Bestätigungsdialog gelöscht werden. Account-Löschung ist noch nicht in der Oberfläche vorhanden.
- Messwerte und Check-ins stammen vom Client, kein manipulationssicheres Wettbewerbssystem. Moderation, Meldungen, Einladungen, Kontowiederherstellung und Produktionsbetrieb mit Backups/Quoten sind noch zu ergänzen. Feed lädt die letzten 50 Bilder, eigene Touren/Check-ins ohne Pagination.

Bestehende Daten der früheren lokalen Handy-App werden nicht automatisch ins Online-Konto übertragen.

## Prüfungen

```sh
npm run check
npm run test:web
npm run test:db
# Optional: npx playwright install chromium, danach:
npm run test:browser
npm run build
# Mit gesetzten Vercel-Variablen:
npm run build:deploy
```

`test:web` prüft GPS-Berechnungen und Ausreißer. `test:db` führt die echte SQL-Migration auf lokalem PostgreSQL (PGlite) aus, mit Test-Nachbildungen der Supabase-Auth-/Storage-Basistabellen. Geprüft werden RLS, Pflichtfoto und gemeinsame Aggregate. Dies ersetzt keinen Test des gehosteten Auth-/Storage-Dienstes. Die GitHub-CI führt diese Checks und den Vorschau-Build aus; keine Zugangsdaten nötig.

Vor Freigabe auf dem tatsächlichen Supabase-Projekt mit zwei Konten prüfen: Anmeldung/E-Mail-Bestätigung, eigene Tour speichern und im zweiten Konto nur die Aggregate sehen; Check-in ohne Bild abweisen; private Beweisfotos im zweiten Konto unzugänglich; gemeinsames Foto für beide Konten sichtbar; Abmelden leert persönliche Daten. GPS auf einem echten Handy im Freien prüfen. Die gehosteten Dienste und echte GPS-Hardware sind noch nicht getestet.

## Frühere Handy-App

Die Expo-App bleibt im Repository erhalten (`App.tsx`, `app.json`). Start: `npm start`. Details: [Handy-Dokumentation](docs/MOBILE.md). `npm run dev` / `npm run web` starten jetzt die Website.

Der Browser-Smoke-Test startet selbst einen lokalen Vite-Server auf Port 5189. Er simuliert Supabase-HTTP-Antworten (keine echten Konten) und prüft Anmeldung, GPS, Tourenspeicherung, Rangliste, Foto-Pflicht/Abbruch, Check-ins, Foto-Feed und Abmelden. Ein vorhandenes Chromium lässt sich mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` auswählen.

## 🍺 Bier-Rangliste (neue Migration)

Nach der bestehenden Grundeinrichtung ausschließlich `supabase/migrations/202610280002_beer.sql` im Supabase-SQL-Editor ausführen. Die erste Migration nicht erneut ausführen. Diese additive Migration erhält vorhandene Touren, Bilder und Konten. Sie ergänzt einen eigenen Zähler pro Nutzer und eine Rangliste für Mitglieder. `+ 1 eintragen` erhöht atomar; `− 1 korrigieren` korrigiert bis mindestens null. Nur eigene Zähler können geändert werden. Bieranzahl wird selbst eingetragen, ohne Beweisfoto. Solange die Migration fehlt, zeigt nur der Bier-Bereich eine Einrichtungsmeldung; Ski, Après-Ski und Fotos funktionieren weiter. Kein Administratorzugriff auf Supabase ist hier verbunden, deshalb ist die Online-Migration noch manuell auszuführen.

## 🍹 Mischen

Für die neue eigenständige Rangliste nur `supabase/migrations/202610280003_mischen.sql` im Supabase-SQL-Editor ausführen. Sie benötigt die Grundeinrichtung mit `profiles`, verändert aber keine bestehenden Bier- oder Après-Ski-Einträge. Mischen hat eigene Zähler und RPCs, mit +1 und −1 bis mindestens null. Ohne angewendete Migration bleibt nur diese Rangliste deaktiviert.

## Eigene Einträge löschen

Fotos im Feed, Après-Ski-Einträge und Skitouren haben einen Löschen-Button nur für den Eigentümer. Abbrechen im Dialog erhält den Eintrag. Nach Bestätigung werden Datensatz und zugehörige Bilddatei entfernt; Tour- und Après-Ski-Ranglisten werden neu geladen. Schlägt die Bildbereinigung nach dem Löschen des Eintrags fehl, wird der offene Auftrag lokal nutzerbezogen vorgemerkt und kann mit „Bilddateien erneut löschen“ wiederholt werden. Keine neue SQL-Migration nötig; vorhandene RLS-Regeln erlauben nur eigene Einträge. Bier und Mischen werden weiterhin mit −1 korrigiert.

## Foto-Großansicht

Fotos im Feed sowie Après-Ski-Beweisfotos (auch vor dem Speichern) öffnen per Klick oder Tastatur eine modale Großansicht. Das gesamte Bild wird ohne Beschnitt angezeigt. Schließen per Button, Escape oder Hintergrund; Fokus kehrt zum Foto zurück. Keine zusätzliche Migration notwendig.

## Persönliche Profile

Für Profilbeschreibung, Profilbild und Banner ausschließlich `supabase/migrations/202610280004_profiles.sql` im Supabase-SQL-Editor ausführen. Die Migration erweitert bestehende Profile; vorhandene Konten, Touren und Tabellen bleiben erhalten. Unter „Profil“ kann jeder den eigenen Anzeigenamen (2–32 Zeichen), die Beschreibung (bis 500 Zeichen) und Bilder bearbeiten, Vorschauen sehen, abbrechen oder speichern. Profilbilder und Banner können entfernt werden; ersetzte Bilddateien werden bereinigt. Andere Mitglieder öffnen Profile über die Namen in Ranglisten oder im Fotofeed und können diese nur ansehen. Profile und verknüpfte Bilder sind nur für angemeldete Mitglieder lesbar. Der private Bucket `profile-media` erlaubt eigene Uploads; referenzierte Bilder sind vor Löschung geschützt. Keine Administrator-Schlüssel im Browser. Ohne Migration bleibt die Profilbearbeitung deaktiviert, die bisherigen Funktionen bleiben verfügbar.
