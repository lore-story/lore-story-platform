# Lore Story Platform

## Lokale Einrichtung

1. `npm install`
2. `.env.example` nach `.env.local` kopieren.
3. In `.env.local` die URL und den **Publishable Key** des Supabase-Projekts eintragen:
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. `npm run dev`

Lokale `.env`-Dateien werden ignoriert. Ein `service_role`-Key, Secret-Key oder Datenbankpasswort gehört niemals in diese Frontend-Anwendung.

## Cloudflare Deployment

Nach dem Merge müssen in den Build-Einstellungen von Cloudflare Pages für Production (und bei Bedarf Preview) diese Variablen hinterlegt werden:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Danach ist ein neuer Build nötig, da Vite die öffentlichen Werte zur Build-Zeit einbettet.

## Authentifizierung und Speicherung

Beim Start stellt Supabase Auth die persistierte Sitzung wieder her; bis dahin bleibt die Anwendung geschützt. Registrierung, E-Mail-/Passwort-Anmeldung und Abmeldung laufen ausschließlich über Supabase Auth. Ohne gültige Sitzung wird kein Loreboard angezeigt. Je nach Supabase-Projektkonfiguration muss eine neue Adresse zunächst über die zugesandte E-Mail bestätigt werden.

Nach der Anmeldung lädt die Anwendung das zuletzt aktualisierte eigene Board aus `public.loreboards` (RLS bleibt die verbindliche Zugriffskontrolle). Gibt es noch keines, wird genau ein Standardboard erstellt. Ein vorhandener lokaler Zustand wird nur beim ersten Anlegen migriert; vorhandene Cloud-Daten haben immer Vorrang. Der Browser-Cache bleibt als Offline-Fallback erhalten.

Änderungen werden entprellt, zuerst lokal gesichert und anschließend in einer seriellen Warteschlange in die Cloud geschrieben. Updates filtern sowohl nach `user_id` als auch nach `id` und vergleichen `updated_at`. Öffnen zwei Browser dasselbe Board, gewinnt daher nicht still ein verspätetes altes Update: Nach einer fremden Änderung schlägt der nächste Update-Versuch der älteren Sitzung als Konflikt fehl und der lokale Stand bleibt erhalten. Eine automatische Echtzeit-Zusammenführung ist noch nicht implementiert; zum Übernehmen des Cloud-Stands muss neu geladen werden.

Ein laufender Timer speichert seinen Zielzeitpunkt. Beim Laden wird die tatsächlich vergangene Zeit abgezogen; pausierte und abgelaufene Timer starten nicht erneut.

## Storymodus Stufe 1

Sichere Missionssitzungen, anonymer Beitritt, RLS/RPC, Realtime und die erforderlichen Dashboard-Schritte sind in [`docs/STORY_MODE_STAGE_1.md`](docs/STORY_MODE_STAGE_1.md) dokumentiert. Die SQL-Datei wird bewusst nicht automatisch auf ein entferntes Projekt angewendet.
