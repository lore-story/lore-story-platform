export const worlds = [
  { id: 'astra', name: 'Astra', label: 'Raumfahrt-Akademie', icon: '◈', colors: ['#35d8f3', '#020914'], description: 'Eine technische Raumfahrtwelt, in der Crews Signale entschlüsseln und gemeinsam neue Missionen beginnen.' },
  { id: 'nebelmark', name: 'Nebelmark', label: 'Mystische Wildnis', icon: '✦', colors: ['#2d7770', '#142b2b'], description: 'Zwischen uralten Baumriesen erwacht ein Geheimnis, das nur kluge Köpfe entschlüsseln können.' },
  { id: 'aether', name: 'Aetherion', label: 'Schwebende Reiche', icon: '◇', colors: ['#8b6fc4', '#302750'], description: 'Über den Wolken verbinden Himmelsbrücken Wissen, Mut und fantastische Entdeckungen.' },
  { id: 'tiefsee', name: 'Pelagia', label: 'Leuchtende Tiefsee', icon: '◉', colors: ['#29789b', '#112d43'], description: 'In den Tiefen warten versunkene Archive und eine Welt voller leuchtender Wunder.' },
]

export const stories = [
  { id: 'notruf-aus-dem-all', title: 'Notruf aus dem All', storyType: 'world_bound', worldId: 'astra', world: 'astra', subject: 'Klassenleitung', age: '9–13', duration: '45 Min.', chapters: 8, description: 'NOVA empfängt ein unbekanntes Signal. Registriert eure Crew und bereitet die Astra auf den Start vor.', skills: ['Gemeinschaft', 'Organisation'], accent: '#ff9d3b' },
  { id: 'moosarchiv', title: 'Das Flüstern des Moosarchivs', storyType: 'world_independent', worldId: null, world: 'nebelmark', variants: { astra: 'Bioarchiv der Astra', nebelmark: 'Moosarchiv', aether: 'Wolkenarchiv', tiefsee: 'Korallenarchiv' }, subject: 'Biologie', age: '10–13', duration: '35 Min.', chapters: 5, description: 'Entschlüssle ein geheimes Ökosystem. Das Lernangebot kann in jeder Welt inszeniert werden.', skills: ['Ökosysteme', 'Transferwissen'], accent: '#7fc69f' },
  { id: 'sternenuhr', storyType: 'world_bound', worldId: 'aether', title: 'Die Kartografin der Sternenuhr', world: 'aether', subject: 'Mathematik', age: '12–15', duration: '45 Min.', chapters: 6, description: 'Berechne die Flugbahnen der Inseln, bevor die große Konjunktion beginnt.', skills: ['Geometrie', 'Problemlösen'], accent: '#ad96e5' },
  { id: 'korallenrat', storyType: 'world_bound', worldId: 'tiefsee', title: 'Der Rat der stillen Korallen', world: 'tiefsee', subject: 'Deutsch', age: '9–12', duration: '30 Min.', chapters: 4, description: 'Finde die richtigen Worte, um die zerstrittenen Riffe wieder zu vereinen.', skills: ['Argumentation', 'Lesen'], accent: '#69b9d8' },
  { id: 'glutpfad', storyType: 'world_bound', worldId: 'nebelmark', title: 'Der Pfad der sieben Funken', world: 'nebelmark', subject: 'Sachkunde', age: '8–11', duration: '25 Min.', chapters: 4, description: 'Folge den Spuren der Elemente durch eine Landschaft im Wandel.', skills: ['Naturphänomene', 'Logik'], accent: '#e8a869' },
]

export const storyCategoryLabel = story => story.storyType === 'world_independent'
  ? 'Weltenunabhängiges Lernangebot · In allen Welten spielbar'
  : `${worlds.find(world => world.id === (story.worldId || story.world))?.name || 'Welt'}-Story · Nur in ${worlds.find(world => world.id === (story.worldId || story.world))?.name || 'dieser Welt'}`

export const isStoryAvailableInWorld = (story, worldId) => story?.storyType === 'world_independent' || (story?.worldId || story?.world) === worldId
