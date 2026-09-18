# Gemeinsame Missionsbühne

`MissionStage` ist der einzige Szenenrenderer für Editor und lokalen Testlauf und ist als Einstiegspunkt für den späteren echten Missionsdurchlauf vorgesehen. Die Bühne bleibt immer 16:9; ihr Container skaliert sie per Letterboxing. Welt-Tokens liegen getrennt in `worldTokens.js`, damit weitere Welten ohne Kopie des Renderers ergänzt werden können.

## Medien

Bild: JPEG, PNG, WebP (maximal 10 MB). Video: MP4 oder WebM (maximal 100 MB). Gespeichert werden nur privater Storage-Pfad, Typ und Darstellungsmetadaten (`fit`, Fokus X/Y, Zoom, Autoplay, Schleife, manuelle Wiedergabe, stumm und optionales Poster), niemals eine Signed URL. Ausschnittänderungen verändern das Original nicht. Autoplay ist immer stumm und wird bei `prefers-reduced-motion` unterbunden.

## Datenbank

Die einzige neue additive Migration ist `supabase/migrations/202609180003_lore_workshop_shared_stage_video.sql`. Sie muss nach `202609180002_lore_workshop_stage_2_media.sql` über den üblichen kontrollierten Supabase-Migrationsprozess angewendet werden. Sie wurde nicht gegen Produktion ausgeführt. Bestehende RLS-Richtlinien und der private Bucket bleiben erhalten.

## Bewusste Grenzen

Es gibt weiterhin keine freie Pixelpositionierung, Videotrimmung, Transkodierung oder Poster-Erzeugung. Browser müssen den gewählten MP4/WebM-Codec selbst unterstützen. Lange Inhalte werden in der fertigen Bühne sicher begrenzt; ab 700 Zeichen warnt der Editor und empfiehlt mehrere Szenen.
