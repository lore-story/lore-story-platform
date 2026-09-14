export const worlds = [
  { id: 'nebelmark', name: 'Nebelmark', label: 'Mystische Wildnis', icon: '✦', colors: ['#2d7770', '#142b2b'], description: 'Zwischen uralten Baumriesen erwacht ein Geheimnis, das nur kluge Köpfe entschlüsseln können.' },
  { id: 'aether', name: 'Aetherion', label: 'Schwebende Reiche', icon: '◇', colors: ['#8b6fc4', '#302750'], description: 'Über den Wolken verbinden Himmelsbrücken Wissen, Mut und fantastische Entdeckungen.' },
  { id: 'tiefsee', name: 'Pelagia', label: 'Leuchtende Tiefsee', icon: '◉', colors: ['#29789b', '#112d43'], description: 'In den Tiefen warten versunkene Archive und eine Welt voller leuchtender Wunder.' },
]

export const stories = [
  { id: 'moosarchiv', title: 'Das Flüstern des Moosarchivs', world: 'nebelmark', subject: 'Biologie', age: '10–13', duration: '35 Min.', chapters: 5, description: 'Entschlüssle das geheime Netzwerk des Waldes und rette den uralten Wissensbaum.', skills: ['Ökosysteme', 'Transferwissen'], accent: '#7fc69f' },
  { id: 'sternenuhr', title: 'Die Kartografin der Sternenuhr', world: 'aether', subject: 'Mathematik', age: '12–15', duration: '45 Min.', chapters: 6, description: 'Berechne die Flugbahnen der Inseln, bevor die große Konjunktion beginnt.', skills: ['Geometrie', 'Problemlösen'], accent: '#ad96e5' },
  { id: 'korallenrat', title: 'Der Rat der stillen Korallen', world: 'tiefsee', subject: 'Deutsch', age: '9–12', duration: '30 Min.', chapters: 4, description: 'Finde die richtigen Worte, um die zerstrittenen Riffe wieder zu vereinen.', skills: ['Argumentation', 'Lesen'], accent: '#69b9d8' },
  { id: 'glutpfad', title: 'Der Pfad der sieben Funken', world: 'nebelmark', subject: 'Sachkunde', age: '8–11', duration: '25 Min.', chapters: 4, description: 'Folge den Spuren der Elemente durch eine Landschaft im Wandel.', skills: ['Naturphänomene', 'Logik'], accent: '#e8a869' },
]
