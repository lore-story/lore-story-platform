# Astra-Medienstatus

## Loreboard-Hintergrund

Das Astra-Loreboard lädt seine Medien ausschließlich aus dem öffentlichen Supabase-Bucket:

- `https://yoxpqqxhpkikkkotlrrk.supabase.co/storage/v1/object/public/lore-story-media/astra/loreboard/astra-loreboard-loop.mp4`
- `https://yoxpqqxhpkikkkotlrrk.supabase.co/storage/v1/object/public/lore-story-media/astra/loreboard/astra-loreboard-poster.webp`
- `https://yoxpqqxhpkikkkotlrrk.supabase.co/storage/v1/object/public/lore-story-media/astra/loreboard/nova-crew-academy.webp`

Der einmalige Download von `scene-09-loop-hq.mp4` wurde am 17.09.2026 in der
Build-Umgebung durch den ausgehenden HTTP-Tunnel mit Status 403 blockiert. Die Medien
liegen deshalb im öffentlichen Supabase Storage; dieser Branch enthält bewusst keine
Binärdateien.

Die Hintergrundkomponente zeigt das bereitgestellte Poster während des Ladens und nach einem
Videofehler. Bei `prefers-reduced-motion: reduce` bleibt das Video ausgeblendet, sodass
nur das ruhige Poster beziehungsweise die dunkelblaue CSS-Grundfläche sichtbar ist.

## Bestehende Szenenmedien

Folgende projektspezifischen Originaldateien können weiterhin ohne Codeänderung ergänzt
werden:

- `public/media/astra/scene-ankunft.webm`
- `public/media/astra/scene-erinnerungssignal.webm`
- `public/media/astra/scene-crew-check.webm`
- `public/media/astra/scene-navigation.webm`
- `public/media/astra/scene-missionsarchiv.webm`
- `public/media/astra/scene-ausruestung.webm`
- `public/media/astra/scene-sicherheitscheck.webm`
- `public/media/astra/scene-startfreigabe.webm`
- `public/media/astra/launch-final.mp4`
- `public/media/astra/launch-poster.webp`
