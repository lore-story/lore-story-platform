# Storymodus- und Astra-Reparatur

## Datenbank-Rollout

Die Migration `supabase/migrations/202609160001_remove_disconnected_participants.sql` ist neu, vorwärtsgerichtet und darf erst **nach** den Migrationen `202609150001`, `202609150002` und `202609150003` ausgeführt werden. Sie wird nicht vom Frontend und nicht automatisch gegen ein entferntes Projekt angewendet.

Sichere Reihenfolge:

1. Datenbanksicherung und angewendete Migrationsstände prüfen.
2. Migration mit dem etablierten Supabase-Migrationsprozess der Zielumgebung ausführen.
3. Als Lehrkraft eine Testsitzung erstellen und nur einen seit mehr als 70 Sekunden getrennten Testteilnehmer gesammelt entfernen.
4. Prüfen, dass aktive Teilnehmer bestehen bleiben, der entfernte anonyme Benutzer die Entfernungsansicht erhält und das Rufzeichen für ein anderes Gerät wieder frei ist.

Die neue `security definer`-RPC prüft die Lehrkraft serverseitig, verweigert abgeschlossene Sitzungen, entfernt nur eindeutig abgelaufene Heartbeats und erhält den RPC-only-Schreibzugriff. `anon` und `public` erhalten kein Ausführungsrecht; ein Service-Role-Key wird im Frontend nicht verwendet.

## Weiterhin fehlende Medien

Die acht szenenspezifischen Astra-Loops, das Startvideo und das Poster unter `/media/astra/` sind weiterhin nicht Bestandteil dieses Schritts. Bei fehlenden Dateien zeigt die Mission bewusst eine ruhige Astra-Fläche mit dem dezenten Hinweis „Szenenbild folgt“. Das NOVA-Erinnerungsrad ist funktional erhalten.
