export const WORLD_THEMES = Object.freeze({
  astra: Object.freeze({
    id: 'astra', name: 'Astra', typography: { display: '"Arial Narrow", Inter, sans-serif', body: 'Inter, sans-serif' },
    colors: { void: '#020914', panel: '#071827e8', panelSolid: '#091b2b', cyan: '#35d8f3', orange: '#ff9d3b', text: '#f2f8fc', muted: '#8ca9b9', danger: '#ff6b62' },
    surfaces: { border: '1px solid #35d8f355', radius: '4px', shadow: '0 18px 70px #000b' },
    symbols: { logo: 'ASTRA', assistant: 'NOVA', world: '◈' },
    media: { scenePattern: '/media/astra/scene-{scene}.webm', launch: '/media/astra/launch-final.mp4', poster: '/media/astra/launch-poster.webp' },
    terms: { participants: 'Crew', participant: 'Crewmitglied', callsign: 'Rufzeichen', network: 'Crew-Netzwerk', progress: 'Missionsfortschritt' },
    layouts: { loreboard: 'astra-command', lobby: 'astra-dock', story: 'astra-flightdeck', student: 'astra-terminal' },
  }),
})

export const getWorldTheme = id => WORLD_THEMES[id] || null
export const themeVariables = theme => theme ? {
  '--world-void': theme.colors.void, '--world-panel': theme.colors.panel, '--world-panel-solid': theme.colors.panelSolid,
  '--world-cyan': theme.colors.cyan, '--world-orange': theme.colors.orange, '--world-text': theme.colors.text,
  '--world-muted': theme.colors.muted, '--world-shadow': theme.surfaces.shadow, '--world-display': theme.typography.display,
} : {}
