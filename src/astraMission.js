export const ASTRA_SCENES = Object.freeze([
  { id: 'ankunft', label: 'Szene 1 · Ankunft', title: 'Willkommen in der Crew-Akademie', goal: 'Die Crew versteht den Missionsrahmen.', teacherInfo: 'Begrüße die Gruppe und erkläre den gemeinsamen Ablauf.', message: 'Oh! Ihr seid also die neue Crew. Einen Moment … Meine Datenbank kennt euch noch nicht.', action: 'Zur Erinnerungsübertragung', task: 'Hört NOVA zu und macht euch für die Registrierung bereit.', expectedAction: 'Zuhören und Partner finden', completion: 'Die Lehrkraft bestätigt die Einführung.', readinessRequired: false },
  { id: 'erinnerungssignal', label: 'Szene 2 · Erinnerungssignal', title: 'Das Echo der Erinnerungen', message: 'Dieses Signal reagiert auf eure Erlebnisse. Übertragt zu zweit eure Ferienerinnerungen – jedes Fragment hilft mir, das unbekannte Muster zu entschlüsseln.', action: 'Signalfragmente sichern', secondary: 'NOVA-Erinnerungsrad', task: 'Arbeitet zu zweit mit dem Erinnerungsrad.' },
  { id: 'crew-check', label: 'Szene 3 · Crew-Check', title: 'Wer gehört zur Crew?', message: 'Findet passende Crewmitglieder und vervollständigt gemeinsam die Datenbank.', action: 'Crew-Check abschließen', task: 'Findet passende Crewmitglieder.', ready: true, status: 'Crew-Check' },
  { id: 'navigation', label: 'Szene 4 · Navigation', title: 'Der beschädigte Flugplan', message: 'Jede Crew braucht einen verlässlichen Flugplan. Prüft, wann eure zukünftigen Missionen stattfinden.', action: 'Flugplan bestätigen', task: 'Prüft gemeinsam euren Flugplan.', ready: true, status: 'Navigation' },
  { id: 'missionsarchiv', label: 'Szene 5 · Missionsarchiv', title: 'Bisherige Berichte sichern', message: 'Für die Freigabe benötigt die Akademie eure bisherigen Missionsberichte.', action: 'Archiv schließen', task: 'Legt eure bisherigen Berichte bereit.' },
  { id: 'ausruestung', label: 'Szene 6 · Ausrüstung', title: 'Das Wissenslager', message: 'Unbekannte Welten lassen sich nicht ohne Wissen erforschen. Übernehmt eure Wissensmodule.', action: 'Module ausgeben', task: 'Übernehmt die Wissensmodule.', status: 'Ausrüstung' },
  { id: 'sicherheitscheck', label: 'Szene 7 · Sicherheitscheck', title: 'Ist alles vollständig?', message: 'Prüft sorgfältig. Fehlende Gegenstände müssen im Ausrüstungsprotokoll vermerkt werden.', action: 'Ausrüstung bestätigen', task: 'Prüft eure Ausrüstung und meldet euch bereit.', ready: true, status: 'Ausrüstung' },
  { id: 'startfreigabe', label: 'Szene 8 · Startfreigabe', title: 'Die Reise beginnt', message: 'Crew: Registrierung abgeschlossen. Flugplan aktiviert. Ausrüstung bestätigt. Willkommen an Bord der Astra.', action: 'Countdown starten', task: 'Bestätigt eure Startbereitschaft.', ready: true, status: 'Startfreigabe' },
])

// Every scene exposes the same instructional contract, including legacy scene data.
for (const scene of ASTRA_SCENES) {
  scene.goal ||= scene.title
  scene.teacherInfo ||= scene.message
  scene.expectedAction ||= scene.task
  scene.completion ||= scene.ready ? 'Alle aktiven Crewmitglieder melden sich für diese Szene bereit.' : 'Die Lehrkraft bestätigt den Abschluss bewusst.'
  scene.readinessRequired = scene.ready === true
}
export const sceneById = (id, scenes = ASTRA_SCENES) => scenes.find(scene => scene.id === id) || scenes[0]
export const sceneIndex = (id, scenes = ASTRA_SCENES) => Math.max(0, scenes.findIndex(scene => scene.id === id))

export const MEMORY_PROMPTS = Object.freeze([
  ['Crewbericht', 'Berichtet euch gegenseitig von einem besonderen Ferienmoment.'],
  ['Drei-Wörter-Code', 'Beschreibt eine Erinnerung nur mit drei Wörtern.'],
  ['Pantomime', 'Spielt ein Erlebnis ohne Worte vor.'],
  ['Forschungsfrage', 'Welche Frage würdet ihr zu euren Ferien erforschen?'],
])
