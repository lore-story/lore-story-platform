# Astra-Szenenfunktionen

Die Registry `src/sceneFeatures.js` ist der einzige Vertrag für optionale, interaktive Szenenwerkzeuge. Eine Schaltfläche wird nur gerendert, wenn ihre Funktion dort für die aktuelle Szene registriert und implementiert ist.

## Implementiert

- **Szene `erinnerungssignal` – `memory-wheel`:** Das vorhandene NOVA-Erinnerungsrad mit wechselnden Partnerimpulsen.
- **Szenenbereitschaft:** Teil des allgemeinen Szenenvertrags und weiterhin über `ready`/`readinessRequired` synchronisiert.
- **Startfreigabe:** Synchronisierter Countdown und Abschlussstatus über die Missionssitzung.

## Nächster Entwicklungsschritt

Für Crew-Check, Navigation, Missionsarchiv, Ausrüstung und Sicherheitscheck sind noch keine zusätzlichen Werkzeuge spezifiziert. Deshalb zeigt die Oberfläche dort bewusst keine Platzhalter-Buttons. Neue Werkzeuge müssen zuerst fachlich spezifiziert, dann implementiert und anschließend in der Registry aktiviert werden.
