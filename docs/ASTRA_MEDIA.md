# Astra-Medienstatus

Die öffentliche Referenzsite war aus der Build-Umgebung am 15.09.2026 nicht abrufbar (HTTP-Tunnel 403). Deshalb wurden **keine fremden Quellen, Hotlinks oder stilabweichend generierten Ersatzbilder** eingecheckt. Die Oberfläche enthält ruhige, rein mit CSS erzeugte Ersatzanzeigen; Bedienung und Szenenwechsel bleiben bei Ladefehlern vollständig verfügbar.

Folgende projektspezifischen Originaldateien können später ohne Codeänderung ergänzt werden:

- `public/media/astra/scene-ankunft.webm`
- `public/media/astra/scene-erinnerungssignal.webm`
- `public/media/astra/scene-crew-check.webm`
- `public/media/astra/scene-navigation.webm`
- `public/media/astra/scene-missionsarchiv.webm`
- `public/media/astra/scene-ausruestung.webm`
- `public/media/astra/scene-sicherheitscheck.webm`
- `public/media/astra/scene-startfreigabe.webm`
- `public/media/astra/launch-final.mp4` (einmalige Wiedergabe, kein Loop)
- `public/media/astra/launch-poster.webp`

Die acht Szenenmedien sollen als nahtlose, stumm abspielbare WebM-Loops exportiert werden. Das finale MP4 darf nicht loopen. Browser laden jeweils das aktuelle Medium; der Posterpfad wird früh beim Aufbau des Videoelements bekannt gemacht.
