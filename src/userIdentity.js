export function userDisplayName(user) {
  const metadata = user?.user_metadata || {}
  const stored = [metadata.full_name, metadata.display_name, metadata.name]
    .find(value => typeof value === 'string' && value.trim())
  if (stored) return stored.trim()
  const localPart = user?.email?.split('@')[0]?.trim() || ''
  return localPart.replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('de-DE')).trim()
}

export function userInitials(user) {
  const parts = userDisplayName(user).split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || '?').toLocaleUpperCase('de-DE')
}
