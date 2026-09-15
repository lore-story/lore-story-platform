# Storymodus – Stufe 1

## Datenmodell und Sicherheitsgrenzen

Die Migration `supabase/migrations/202609150001_story_mode_stage_1.sql` ergänzt `mission_sessions` (Lehrkraft, optionales Loreboard, Zustand und serverseitiger Code) und `mission_participants` (anonyme Auth-UUID, Rufzeichen, Verbindung und szenengebundene Bereitschaft). Eine Auth-UUID kommt je Sitzung einmal vor; der partielle Unique-Index gibt ein Rufzeichen nach einer Entfernung wieder frei. Ein weiterer partieller Index verhindert mehrere offene Durchläufe derselben Lehrkraft, Story und desselben Loreboards.

RLS ist auf beiden Tabellen aktiv. Nur bestätigte, nicht anonyme Lehrkräfte gelangen in der Anwendung zur Plattform. Zusätzliche restriktive INSERT-/UPDATE-Policies werden per AND mit bestehenden Loreboard-Policies verknüpft, damit anonyme Auth-Benutzer dort auch bei direktem API-Zugriff nicht schreiben können. Schüler dürfen nur ihre eigene Teilnehmerzeile lesen. Diese bleibt nach Entfernung lesbar, damit Realtime und Reload den Status `removed` erkennen; der Zugriff auf die Sitzung selbst und sämtliche Änderungs-RPCs ist dann gesperrt. `auth_user_id` wird dem Frontend nicht per SELECT gewährt.

Alle Änderungen erfolgen über eng begrenzte `SECURITY DEFINER`-RPCs mit leerem `search_path`, vollständig qualifizierten Tabellen, entzogenen PUBLIC-Rechten und minimalen EXECUTE-Grants:

- `create_mission_session` prüft die Lehrerrolle und Loreboard-Zugehörigkeit. Der Client kann keinen Code setzen. Sechs kryptografisch zufällige Bytes werden auf ein 32-Zeichen-Alphabet ohne `I`, `O`, `0` und `1` abgebildet (30 Bit nutzbare Code-Entropie). Bei einer Unique-Kollision versucht die Funktion höchstens acht neue Codes und bricht danach eindeutig ab.
- `inspect_mission` liefert nur die für Auswahl/Wiederaufnahme notwendigen Daten und meldet einem entfernten Gerät seinen eigenen Status.
- `join_mission` sperrt die Sitzung während des Beitritts, verbindet dieselbe anonyme Identität wieder und unterscheidet ungültigen Code, geschlossenen Zugang, abgeschlossen, ungültiges/belegtes Rufzeichen und Entfernung.
- `update_mission_session`, `remove_mission_participant` und `update_my_mission_presence` erlauben nur definierte Aktionen und verändern keine Identitäts- oder Beziehungsfelder. Abgeschlossene Sitzungen sind unveränderlich.

## Installation in Supabase – genaue Reihenfolge

1. Zuerst die bestehende Loreboard-Basismigration anwenden; `public.loreboards` mit `id` und `user_id` muss existieren.
2. Im **Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins** anonyme Anmeldungen aktivieren.
3. Die SQL-Datei zunächst im Staging-Projekt prüfen und dann vollständig als eine Transaktion über den **SQL Editor** ausführen. Nicht aus dem Browser oder mit einem Frontend-Key ausführen.
4. Unter **Database → Replication** kontrollieren, dass `mission_sessions` und `mission_participants` in `supabase_realtime` stehen. Der idempotente Block am Ende ergänzt sie normalerweise automatisch.
5. Nur `VITE_SUPABASE_URL` und den Publishable Key bereitstellen; niemals `service_role`, Secret Key oder Datenbankpasswort in Vite-Variablen aufnehmen.

Die Datei ist die erste noch nicht veröffentlichte Storymodus-Migration und darf vor dem Merge ersetzt werden. Wurde eine frühere PR-Fassung ausnahmsweise bereits in Staging ausgeführt, das Staging-Projekt vor Anwendung dieser Fassung zurücksetzen; die Migration ist nicht als Reparatur einer bereits angewendeten Vorabfassung gedacht.

## Presence, Realtime und lokaler Test

Das Schülergerät sendet alle **25 Sekunden** einen begrenzten Heartbeat. Die Lobby wertet `status = connected` nur zusammen mit einem höchstens **70 Sekunden** alten `last_seen_at` als verbunden und bewertet dies alle zehn Sekunden neu. Heartbeat und Realtime-Kanal werden beim Unmount entfernt und nach Entfernung oder Abschluss gestoppt. Die Lehrer-Speicheranzeige wird dadurch nicht berührt.

Mit `npm run dev` öffnet die Lehrkraft das Loreboard und wählt **Mission vorbereiten**. `/join/CODE` verwendet eine vorhandene anonyme Auth-Sitzung oder `signInAnonymously()`. Eine echte Lehrersitzung wird niemals ersetzt. Automatisierte Browser-Tests verwenden getrennte Lehrkraft-/Schülerkontexte und einen kontrollierten Supabase-Mock.

## Manueller Sicherheits-Test im Staging-Projekt

Die Containerumgebung dieses PRs stellt weder Supabase CLI noch PostgreSQL/Docker bereit. Daher wurden Migration und RLS **nicht praktisch gegen eine Datenbank ausgeführt**; die automatischen SQL-Tests prüfen Struktur und Clientverhalten, ersetzen aber keinen Staging-Test. Vor dem Merge ist im isolierten Supabase-Staging-Projekt folgender Test verpflichtend:

1. Zwei bestätigte Lehrerkonten A/B und zwei Anonymous-Auth-Sitzungen S1/S2 anlegen; Tokens ausschließlich lokal im Testclient halten.
2. Als A eine Sitzung für A-Loreboard erstellen. Prüfen: B kann sie weder lesen/steuern noch Teilnehmer entfernen; A kann kein B-Loreboard referenzieren.
3. Als S1 direkte INSERT/UPDATE/DELETE-Aufrufe auf `loreboards`, beide Missionstabellen und Identitätsspalten versuchen; alle müssen scheitern. Auch Lehrer-A darf `teacher_id`, `session_id` und `auth_user_id` nicht direkt ändern.
4. S1 über `inspect_mission`/`join_mission` beitreten. S2 darf weder Sitzung noch S1-Zeile lesen und dasselbe Rufzeichen nicht übernehmen. Bei geschlossenem Zugang wird S2 abgewiesen, S1 darf wiederverbinden.
5. S1 entfernen. Prüfen: S1 darf nur die eigene Teilnehmerzeile mit `removed` lesen, nicht mehr die Sitzung, `join_mission` oder Presence/Bereitschaft verwenden; Realtime und Reload zeigen die Entfernung.
6. Sitzung abschließen. Prüfen: Steuerung, Entfernung, Join, Wiederverbindung, Heartbeat und Bereitschaft liefern `MISSION_COMPLETED` beziehungsweise bleiben unverändert.
7. Parallel zwei `create_mission_session`-Aufrufe für dasselbe Loreboard senden; genau eine offene Sitzung darf entstehen. Danach abschließen und einen neuen, separaten Durchlauf erstellen.
8. Realtime mit den jeweiligen JWTs abonnieren und verifizieren, dass nur RLS-sichtbare Rows eintreffen. SQL Editor anschließend auf unerwartete Grants mit `information_schema.role_table_grants`, `role_column_grants` und `routine_privileges` prüfen.

## Produktionsschutz und Grenzen

Für den öffentlichen Betrieb sind Supabase Auth Rate Limits und CAPTCHA (Cloudflare Turnstile oder hCaptcha) für Anonymous Sign-Ins sowie Edge-/WAF-Limits für `/join/*` und RPC-Aufrufe erforderlich. Tokens, Sitzungscodes und Gerätefingerprints dürfen nicht protokolliert werden. Es werden keine Namen, Schüler-E-Mails oder dauerhaften Schülerprofile erhoben.

Die eigentliche Geschichte „Notruf aus dem All“ folgt in Stufe 2. Stufe 1 zeigt nach dem manuellen Start eine Zwischenansicht und demonstriert Bereitschaft an `testszene`. Es gibt noch kein fachliches Ergebnis-Dashboard; archivierte Durchläufe bleiben erhalten und ein Neustart erzeugt einen neuen Datensatz.
