# WarenPilot – Version 1.0

Eine kostenlose, selbst anpassbare Warenwirtschaft als PWA. HTML, CSS und JavaScript ohne Build-System oder kommerzielle Bibliotheken.

## Schnellstart (lokal)
1. ZIP-Datei entpacken.
2. Terminal im Ordner `warenpilot` öffnen.
3. `python3 -m http.server 8000` ausführen.
4. `http://localhost:8000` im Browser öffnen.
5. Artikel und Lagerorte anlegen. Wareneingänge/-ausgänge buchen. Daten unter **Auswertungen** exportieren.

`localhost` ist für die Entwicklung gedacht. Für die Installation auf Telefonen die Dateien über HTTPS auf einer statischen Hosting-Plattform bereitstellen (z. B. GitHub Pages). Bei einem privaten GitHub-Repository ist zu prüfen, ob Pages auf dem gewählten Tarif unterstützt wird. Der Quellcode ist bei öffentlichen Pages-Repositories öffentlich sichtbar; **keine Passwörter oder geheimen Schlüssel eintragen**.

## Auf dem Handy installieren
- Android/Chrome: Seite über HTTPS öffnen → Browsermenü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.
- iPhone/Safari: HTTPS-Seite öffnen → Teilen → „Zum Home-Bildschirm“.
- Die genauen Menünamen unterscheiden sich nach Browser und Version.

## Cloud-Synchronisierung einrichten (optional)
1. Kostenloses eigenes Projekt auf https://supabase.com erstellen. Kostenloser Tarif unterliegt Limits und kann geändert werden.
2. Im **SQL Editor** den Inhalt von `supabase.sql` ausführen. Damit wird eine nutzerbezogene Tabelle mit Row Level Security erstellt.
3. Unter Supabase **Project Settings / API** die **Project URL** und den **publishable key** (oder älteren `anon` key) kopieren. **Niemals `service_role` oder secret key verwenden!**
4. In WarenPilot unter **Einstellungen** diese zwei Werte speichern.
5. Unter **Anmelden / Konto erstellen** ein Konto anlegen. E-Mail-Bestätigung kann erforderlich sein.
6. Auf dem ersten Gerät **Lokale Daten hochladen** wählen.
7. Auf dem zweiten Gerät dieselbe HTTPS-App öffnen, dieselbe Supabase-Verbindung konfigurieren, mit demselben Konto anmelden und **Cloud-Daten laden** wählen.
8. Änderungen müssen derzeit **manuell** hoch- und heruntergeladen werden. Es gibt **keine Echtzeit-Synchronisierung** und **keine Konfliktauflösung**. Vor einem Wechsel immer auf dem aktuellen Gerät hochladen und auf dem anderen laden. Gleichzeitige Bearbeitung kann Daten überschreiben.

## Daten und Grenzen
- Offline-Speicherung über `localStorage` des Browsers. Das ist für einen Prototyp praktikabel, aber keine robuste Datenbank für große Datenmengen. Browserdaten können gelöscht werden: **regelmäßig JSON exportieren**.
- Buchungen sind im UI nicht editierbar. Negative Bestände sind möglich. Gelöschte Artikel bleiben als IDs in Buchungen erhalten.
- QR-/Barcode-Kamera nutzt die Browser-API `BarcodeDetector`, die nicht auf jedem Browser verfügbar ist. Manuelle Eingabe funktioniert immer. Kamera braucht HTTPS oder localhost.
- Eigene Tabellenansichten zeigen konfigurierbare Standardspalten. Eigene Felder erscheinen im Artikel-Formular, nicht automatisch in allen Tabellen. Arbeitsabläufe sind einfache Buchungsvorlagen, keine vollwertige Workflow-Engine.
- Preise in EUR; keine Steuer-, Rechnungs-, Bestell- oder Benutzerrollenverwaltung. Ein Benutzerkonto = ein eigener Datenbestand. Keine Mehrbenutzer-Firmenbearbeitung.
- Nicht produktionsreif für sensible oder geschäftskritische Bestände. Vor echtem Betrieb sind Tests, Berechtigungen, automatische Synchronisierung, Backup-Konzept und eine robuste Datenbank sinnvoll.

## Datenschutz und Kosten
Quellcode und lokale Nutzung kosten nichts. HTTPS-Hosting kann kostenlos möglich sein. Supabase-Free-Plan kann Limits und Pausierung haben; ein dauerhaft kostenfreier Betrieb lässt sich nicht garantieren. Bei Cloud-Nutzung werden die Daten beim gewählten Anbieter gespeichert. Vermeide echte personenbezogene Kundendaten, bis Datenschutz, Verträge und Sicherheit geklärt sind.
