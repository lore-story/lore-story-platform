export const WORLD_TOKENS = Object.freeze({
  astra: Object.freeze({
    id: 'astra', background: '#071827', surface: 'rgba(9, 35, 53, .84)', surfaceStrong: 'rgba(5, 22, 36, .94)',
    text: '#f4fbff', muted: '#b8cedb', accent: '#35d8f3', border: 'rgba(107, 225, 245, .32)',
    shadow: '0 24px 70px rgba(0, 8, 18, .55)', safe: 'clamp(24px, 4.4cqw, 68px)', gap: 'clamp(14px, 2.2cqw, 34px)', radius: 'clamp(8px, 1.2cqw, 18px)',
  }),
})

export function getWorldTokens(worldId) { return WORLD_TOKENS[worldId] || WORLD_TOKENS.astra }
export function worldTokenStyle(worldId) {
  const token = getWorldTokens(worldId)
  return Object.fromEntries(Object.entries(token).filter(([key])=>key !== 'id').map(([key,value])=>[`--mission-${key.replace(/[A-Z]/g, letter=>`-${letter.toLowerCase()}`)}`,value]))
}
