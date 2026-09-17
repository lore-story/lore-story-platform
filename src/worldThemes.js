import { ASTRA_SCENES, MEMORY_PROMPTS } from './astraMission.js'

export const WORLD_THEMES = Object.freeze({
  astra: Object.freeze({
    id: 'astra', name: 'Astra', typography: { display: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    colors: { void: '#020914', panel: '#071827e8', panelSolid: '#091b2b', cyan: '#35d8f3', orange: '#ff9d3b', text: '#f2f8fc', muted: '#8ca9b9', danger: '#ff6b62' },
    surfaces: { border: '1px solid #35d8f355', radius: '4px', shadow: '0 18px 70px #000b' },
    symbols: { logo: 'ASTRA', assistant: 'NOVA', world: '◈' },
    media: { scenePattern: '/media/astra/scene-{scene}.webm', launch: '/media/astra/launch-final.mp4', poster: '/media/astra/launch-poster.webp' },
    terms: { participants: 'Crew', participant: 'Crewmitglied', callsign: 'Rufzeichen', network: 'Crew-Netzwerk', progress: 'Missionsfortschritt' },
    layouts: { loreboard: 'astra-command', lobby: 'astra-dock', story: 'astra-flightdeck', student: 'astra-terminal' },
    mission: Object.freeze({
      storySlug: 'lore-astra-notruf-aus-dem-all', storyId: 'notruf-aus-dem-all', title: 'Notruf aus dem All',
      scenes: ASTRA_SCENES, memoryPrompts: MEMORY_PROMPTS,
      labels: { assistant: 'NOVA', lobby: 'MISSIONSBEREITSCHAFT · DOCK 07', start: 'Mission starten', feedback: 'Feedback-Archiv' },
    }),
  }),
  nebelmark: Object.freeze({
    id: 'nebelmark', name: 'Nebelmark', typography: { display: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    colors: { void: '#07130e', panel: '#10271de8', panelSolid: '#142d21', cyan: '#91d36b', orange: '#f2bf72', text: '#f4f7e9', muted: '#adc0a7', danger: '#ff8173' },
    surfaces: { border: '1px solid #91d36b66', radius: '14px', shadow: '0 18px 70px #020905cc' },
    symbols: { logo: 'NEBELMARK', assistant: 'MOIRA', world: '✶' },
  }),
  aether: Object.freeze({
    id: 'aether', name: 'Aetherion', typography: { display: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    colors: { void: '#100b29', panel: '#22194be8', panelSolid: '#291f59', cyan: '#78cfff', orange: '#ffe8a3', text: '#fbf9ff', muted: '#c4bce5', danger: '#ff809f' },
    surfaces: { border: '1px solid #78cfff66', radius: '18px', shadow: '0 20px 75px #08031dcc' },
    symbols: { logo: 'AETHERION', assistant: 'LYRA', world: '◇' },
  }),
  tiefsee: Object.freeze({
    id: 'tiefsee', name: 'Pelagia', typography: { display: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    colors: { void: '#021521', panel: '#062b3ae8', panelSolid: '#073747', cyan: '#35f0d0', orange: '#8cecff', text: '#efffff', muted: '#9fc9cf', danger: '#ff7889' },
    surfaces: { border: '1px solid #35f0d066', radius: '20px', shadow: '0 22px 80px #001018dd' },
    symbols: { logo: 'PELAGIA', assistant: 'LUMA', world: '◉' },
  }),
})

export const getWorldTheme = id => WORLD_THEMES[id] || null
export const getMissionPackage = storySlug => { const theme = Object.values(WORLD_THEMES).find(item => item.mission?.storySlug === storySlug); return theme ? { ...theme.mission, worldId: theme.id, theme } : null }
export const themeVariables = theme => theme ? {
  '--world-void': theme.colors.void, '--world-panel': theme.colors.panel, '--world-panel-solid': theme.colors.panelSolid,
  '--world-cyan': theme.colors.cyan, '--world-orange': theme.colors.orange, '--world-text': theme.colors.text,
  '--world-muted': theme.colors.muted, '--world-danger': theme.colors.danger, '--world-border': theme.surfaces.border,
  '--world-radius': theme.surfaces.radius, '--world-shadow': theme.surfaces.shadow, '--world-display': theme.typography.display,
} : {}
