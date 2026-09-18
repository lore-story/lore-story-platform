# Lore-Werkstatt – Stufe 2

Stufe 2 erweitert den bestehenden Entwurfseditor um typgerechte Szenen, responsive Seitenpanels, private Entwurfsmedien und einen rein lokalen Testlauf. Der Testlauf erstellt ausdrücklich keine `mission_session`, veröffentlicht nichts und bindet keine Schülergeräte an.

## Migration manuell anwenden

Die Migration wurde nicht auf ein entferntes Supabase-Projekt angewendet. In einem Zielprojekt werden die vorhandenen Migrationen chronologisch angewendet. Für eine Installation, die Stufe 1 bereits besitzt, folgt unmittelbar danach:

1. `supabase/migrations/202609180002_lore_workshop_stage_2_media.sql`

Sie erstellt den privaten Bucket `mission-draft-media`, die Metadatentabelle `mission_media` und ausschließlich eigentümergebundene RLS- und Storage-Policies. Jede Policy prüft neben `auth.uid()` ausdrücklich das JWT-Feld `is_anonymous`, weil anonyme Supabase-Sitzungen ebenfalls die Rolle `authenticated` verwenden. Der Client speichert den stabilen Objektpfad; zur Anzeige wird eine auf eine Stunde begrenzte Signed URL erzeugt. Vorhandene öffentliche URLs bleiben kompatibel.

Veröffentlichung, Übertragung auf Schülergeräte und echte Missionssitzungen sind nicht Teil dieser Stufe und bleiben Stufe 3 vorbehalten.
