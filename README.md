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

## Administration

Zuerst `supabase/migrations/202610280005_admin.sql` einmal im Supabase-SQL-Editor ausführen. Admin-Rechte werden separat und ausschließlich im SQL-Editor/mit Datenbank-Administratorrechten vergeben:

```sql
insert into public.app_admins(user_id)
select id from auth.users where lower(email)=lower('DEINE_KONTO_EMAIL')
on conflict(user_id) do nothing;
```

Die E-Mail muss zu einem bereits vorhandenen SkiDuell-Konto gehören. Keine privaten E-Mail-Adressen sind im Website-Code oder in der Migration hinterlegt. Nach Aktualisieren/erneutem Anmelden erscheint „Admin“. Der Bereich zeigt Fotos, Après-Ski-Einträge und Skitouren aller Mitglieder, jeweils 25 pro Seite. Löschen erfordert eine Bestätigung und entfernt Datensatz sowie Bilddatei; fehlgeschlagene Bildbereinigung kann erneut versucht werden. Eigene Saisonwerte bleiben auf das eigene Konto begrenzt.

Admin-Rollen sind in `app_admins` gespeichert, ohne direkte Lese-/Schreibrechte für Nutzer. `is_admin()` und RLS prüfen sie serverseitig. Ein Browser-Flag oder Anzeigename verleiht keine Rechte. Admins können zur Moderation private Après-Ski-Beweisfotos ansehen, aber keine fremden Profile bearbeiten oder Admin-Rollen vergeben. Die Migration entfernt keine Daten. Rollenentzug erfolgt im SQL-Editor über `delete from public.app_admins where user_id = ...`; API-Zugriffe werden sofort blockiert, die Oberfläche aktualisiert sich beim nächsten Laden. Account-Löschung gehört nicht zu diesem Admin-Bereich. Mit der zusätzlichen Migration `202610280006_admin_counters.sql` lassen sich im Admin-Bereich auch die Gesamtzähler für Bier und Mischen anderer Nutzer auf null zurücksetzen. Einzelne Getränke werden nicht separat gespeichert; deshalb wird jeweils der gesamte Zähler des ausgewählten Kontos entfernt. Bei der nächsten Eingabe beginnt er wieder bei null. Die Admin-Aktivierung aus Migration 005 muss vorher erfolgt sein.

## Admin: einzelne Mengen korrigieren

Zusätzlich `202610280007_admin_reduce.sql` nach den vorhandenen Admin-Migrationen ausführen. Unter Admin → Bier/Mischen kann eine positive ganze Menge eingegeben und nach Bestätigung abgezogen werden. Vorgabe ist 1. Die Reduktion geschieht atomar in der Datenbank, mindestens bis null. Statt des bisherigen vollständigen Zurücksetzens zeigt die Oberfläche nun die Mengenkorrektur. `admin_reduce_counter` prüft die Admin-Rolle serverseitig; normale Nutzer können damit auch bei manipulierten Browser-Anfragen keine fremden Zähler ändern.

## 💬 Gemeinsamer Chat

`supabase/migrations/202610280008_chat.sql` einmal im Supabase-SQL-Editor ausführen (die bestehende Admin-Migration mit `is_admin()` muss vorhanden sein). Der neue Tab „Chat“ ist für angemeldete Mitglieder nutzbar. Textnachrichten bis 1000 Zeichen werden gespeichert; angezeigt werden die 100 neuesten Nachrichten mit Namen und Schweizer Datum/Uhrzeit. Bei geöffnetem Chat wird alle fünf Sekunden nachgeladen, solange der Browser sichtbar ist. Keine Supabase-Realtime-Konfiguration nötig. Entwürfe bleiben bei Aktualisierungen und Tab-Wechseln erhalten, werden beim Abmelden entfernt und nicht dauerhaft gespeichert. Fehlgeschlagenes Senden behält den Text und verwendet bei Wiederholung dieselbe Nachrichten-ID gegen Duplikate.

RLS erlaubt nur angemeldeten Mitgliedern das Lesen, nur Nachrichten unter der eigenen Nutzer-ID das Einfügen und nur Eigentümer/Admins das Löschen. Zeitstempel kommen vom Server; Änderungen bestehender Nachrichten sind nicht erlaubt. Texte und Anzeigenamen werden als Text ausgegeben, nicht als HTML. Eigene Nachrichten und fremde Nachrichten als Admin können nach Bestätigung direkt im Chat gelöscht werden. Nachrichten enthalten keine Anhänge; vor der SQL-Einrichtung bleibt nur der Chat gesperrt, andere Website-Funktionen laufen weiter. Die Datenbank-Tests prüfen Zugriffsrechte; der Browser-Smoke-Test prüft zusätzlich Senden, Fehler/Wiederholung, automatisches Aktualisieren bei erhaltenem Entwurf, sichere Textanzeige und Moderation gegen simulierte Supabase-Antworten.

## ❤️ Likes und Kommentare

Die neue Migration `supabase/migrations/202610280009_photo_reactions.sql` einmal im Supabase-SQL-Editor ausführen. Sie benötigt die vorhandenen Fotos, Profile und die Admin-Funktion `is_admin()`. Unter Fotos kann jedes angemeldete Mitglied pro Foto ein Like setzen und wieder zurücknehmen. Ein zusammengesetzter Primärschlüssel verhindert doppelte Likes. Eine Datenbankfunktion liefert Like-/Kommentaranzahlen und den eigenen Like-Status für die sichtbaren Fotos.

Kommentare haben maximal 500 Zeichen, erscheinen mit Namen und Datum/Uhrzeit und sind nur für angemeldete Mitglieder lesbar. Der Verfasser sowie Admins können Kommentare nach Bestätigung löschen. Fremde Identitäten, manipulierte Zeitstempel und Änderungen bestehender Kommentare sind gesperrt. Beim Löschen eines Fotos werden Likes und Kommentare automatisch mitgelöscht. Die Oberfläche zeigt die 50 neuesten Kommentare pro geöffnetem Foto. Neue Reaktionen anderer Mitglieder erscheinen beim Aktualisieren oder erneuten Öffnen der Kommentare; sie werden nicht live abonniert. Entwürfe bleiben bei normalen Aktualisierungen erhalten und werden beim Abmelden geleert. Ohne Migration bleiben nur die neuen Reaktionsfunktionen deaktiviert, Fotos und andere Funktionen bleiben nutzbar.

## 🔒 Private Nachrichten

`supabase/migrations/202610280010_direct_messages.sql` einmal im Supabase-SQL-Editor ausführen. Über ein fremdes Profil → „Nachricht schreiben“ oder unter Chat → Person suchen lässt sich ein Einzelgespräch öffnen. Die Gesprächsliste zeigt die letzte Nachricht und Uhrzeit. Offene Gespräche und die Gesprächsliste werden bei sichtbarer Seite alle fünf Sekunden aktualisiert; öffentliche und private Chats verwenden getrennte Daten und Entwürfe.

Datenbank-RLS erlaubt nur Absender und Empfänger das Lesen der Nachrichten. Es gibt keine Admin-Ausnahme: Auch App-Admins können Gespräche anderer Personen weder lesen noch löschen. Nur der Absender kann eigene Nachrichten für beide Beteiligten entfernen. Beim Senden sind eigene Identität, existierender Empfänger, unterschiedliche Teilnehmer, maximal 1000 Zeichen und serverseitiger Zeitstempel vorgeschrieben. Die Website zeigt je Gespräch die 100 neuesten Nachrichten und die 100 zuletzt aktiven Gespräche. Die Personensuche liefert bis zu 30 Treffer. Entwürfe sind pro Empfänger nur im Arbeitsspeicher vorhanden und werden beim Abmelden verworfen. Es gibt keine Push-/E-Mail-Benachrichtigungen oder Ende-zu-Ende-Verschlüsselung; Datenbank-/Projektadministratoren haben weiterhin administrativen Zugriff. Ohne angewendete Migration bleiben nur private Nachrichten deaktiviert.

## Nachrichtenübersicht mit Profilbildern

„Chat“ öffnet eine gemeinsame Übersicht mit dem bisherigen allgemeinen Chat oben und privaten Gesprächen darunter. Private Gesprächszeilen zeigen Profilbild, Name, letzte Nachricht und Datum/Uhrzeit. Auch neben Nachrichtennamen werden Profilbilder gezeigt; ohne Bild erscheinen Initialen. Profilbilder werden mit den bestehenden, privaten Storage-Regeln geladen und kurzzeitig im Arbeitsspeicher zwischengespeichert. Beim Abmelden wird der Cache geleert. Der allgemeine Chat und vorhandene Nachrichten bleiben unverändert gespeichert. Die Navigation nutzt ein einfarbiges SVG-Chat-Icon. Keine neue SQL-Migration erforderlich.
