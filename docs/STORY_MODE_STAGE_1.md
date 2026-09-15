# Storymodus – Stufe 1

## Datenmodell und Sicherheit

Die Migration `supabase/migrations/202609150001_story_mode_stage_1.sql` ergänzt `mission_sessions` (Eigentümer ist die Lehrkraft, optionales Loreboard, Ablaufzustand und serverseitig erzeugter sechsstelliger Code) und `mission_participants` (anonyme Auth-UUID, Rufzeichen, Verbindung und szenengebundene Bereitschaft). Ein Teilnehmer gehört zu genau einer Sitzung; ein aktives Rufzeichen ist durch einen partiellen Unique-Index nur einmal vergeben. Beim Entfernen bleiben Audit- und Ergebnisdaten erhalten, das Rufzeichen wird aber frei.

RLS ist auf beiden Tabellen aktiv. Lehrkräfte werden über `teacher_id = auth.uid()` beziehungsweise die geschützte Hilfsfunktion `is_mission_teacher` auf eigene Sitzungen begrenzt. Schülerzeilen sind an `auth.uid()` gebunden; entfernte Teilnehmer verlieren den Lesezugriff. Sensible Sitzungsspalten (`teacher_id`, `loreboard_id`) besitzen für die gemeinsame `authenticated`-Rolle kein SELECT-Recht. Schüler schreiben nicht direkt: `join_mission` und `update_my_mission_presence` sind eng begrenzte `SECURITY DEFINER`-RPCs mit leerem `search_path`, fest qualifizierten Objekten und expliziten Grants. Die Funktionen geben weder Lehrkraft-ID noch Loreboard-Inhalt zurück.

`inspect_mission` validiert Code und anonyme Auth-Sitzung und liefert ausschließlich Titel, Zustand sowie freie/belegte Rufzeichen. `join_mission` sperrt die Sitzung während der Prüfung, unterscheidet `INVALID_CODE`, `JOINING_CLOSED`, `CALLSIGN_TAKEN`, `INVALID_CALLSIGN` und `PARTICIPANT_REMOVED`, und verbindet dieselbe anonyme Identität auch bei geschlossenem Neuzugang wieder. Der Code entsteht serverseitig mit `gen_random_bytes` und einem Alphabet ohne leicht verwechselbare Zeichen; die Unique-Constraint ist die endgültige Kollisionssicherung.

## Installation in Supabase (genaue Reihenfolge)

1. Zuerst die bereits zum Projekt gehörende Loreboard-Migration anwenden; `public.loreboards` muss existieren.
2. Im **Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins** anonyme Anmeldungen aktivieren.
3. Den Inhalt von `supabase/migrations/202609150001_story_mode_stage_1.sql` in einem Staging-Projekt prüfen und dann als eine Migration im **SQL Editor** ausführen. Nicht mit Frontend-Schlüsseln und nicht aus dem Browser ausführen.
4. Unter **Database → Replication** kontrollieren, dass `mission_sessions` und `mission_participants` in `supabase_realtime` stehen. Der idempotente `DO`-Block am Ende fügt sie normalerweise selbst hinzu. Realtime-Subscriptions unterliegen den RLS-/Spaltenrechten.
5. Nur `VITE_SUPABASE_URL` und den Publishable Key bereitstellen; niemals `service_role`, Secret Key oder Datenbankpasswort in Vite-Variablen aufnehmen.

## Betrieb und lokaler Test

Mit `npm run dev` öffnet die Lehrkraft das Loreboard und wählt **Mission vorbereiten**. Die öffentliche URL `/join/CODE` meldet ein Schülergerät unsichtbar über `signInAnonymously()` an. Auth speichert diese Sitzung im Browser und die Teilnahme wird beim Reload über dieselbe Auth-UUID wiederhergestellt. Zwei Tabs teilen sich diese Identität; Datenbank-Constraints machen wiederholte Klicks idempotent. Realtime-Channels werden beim Ansichtswechsel/Unmount entfernt.

Für automatisierte Tests kann der bestehende Browser-Mock um `rpc`, `channel` und die beiden Missionstabellen erweitert werden. Vor einem Release ausführen: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` und `git diff --check`.

## Dashboard- und Produktionsschutz

Anonymous Sign-Ins müssen ausdrücklich aktiviert sein. Für einen öffentlichen Betrieb sind außerdem Supabase Auth Rate Limits passend niedrig zu konfigurieren und CAPTCHA (Cloudflare Turnstile oder hCaptcha) für anonyme Anmeldungen zu aktivieren. Ergänzend sollten WAF-/Edge-Rate-Limits für `/join/*` und RPC-Aufrufe eingesetzt und ungewöhnlich viele Beitrittsversuche überwacht werden, ohne Tokens, Sitzungscodes oder Gerätefingerprints zu protokollieren. Es werden keine echten Namen, E-Mail-Adressen, Passwörter oder dauerhaften Schülerprofile erfasst.

## Grenzen von Stufe 1

Die eigentliche Geschichte „Notruf aus dem All“ und komplexe Szenensteuerung folgen in Stufe 2. Stufe 1 zeigt nach manuellem Start eine eindeutig bezeichnete Zwischenansicht und demonstriert Bereitschaft an `testszene`. Bereitschaft erzwingt keinen Start oder Szenenwechsel. Es gibt noch kein fachliches Ergebnis-Dashboard; abgeschlossene Sitzungen bleiben unveränderlich gespeichert und ein Neustart legt stets einen neuen Datensatz an. Presence basiert in diesem Prototyp auf Status-/Heartbeat-RPC und Realtime, nicht auf einer dauerhaften Erhebung von Gerätedaten.
