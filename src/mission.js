export const STORY_SLUG = 'lore-astra-notruf-aus-dem-all'
export const STORY_TITLE = 'Notruf aus dem All'
export const HEARTBEAT_INTERVAL_MS = 25_000
export const PRESENCE_TIMEOUT_MS = 70_000
export function createLiveController(removeChannel, clearTimer) {
  let channel = null
  let timer = null
  return {
    replace(nextChannel, nextTimer) {
      this.stop()
      channel = nextChannel
      timer = nextTimer
    },
    stop() {
      const activeChannel = channel
      const activeTimer = timer
      channel = null
      timer = null
      if (activeTimer !== null) clearTimer(activeTimer)
      if (activeChannel !== null) removeChannel(activeChannel)
    },
  }
}

export const CALLSIGNS = Object.freeze(['Astrofuchs','Blitzbär','Cosmo','Dämmerfalke','Echowolf','Flinkstern','Funkelfisch','Galaxie','Himmelsluchs','Ionenigel','Komet','Lichtlöwe','Meteor','Mondmotte','Nebelpanda','Nova','Orbit','Polarstern','Quasar','Rakete','Saturn','Sirius','Solaris','Sternenhirsch','Sternenkatze','Supernova','Titan','Umlauf','Vega','Weltraumwal'])

export const missionErrorMessage = error => ({
  INVALID_CODE: 'Dieser Sitzungscode ist ungültig oder abgelaufen.',
  JOINING_CLOSED: 'Die Lehrkraft hat den Zugang noch nicht geöffnet.',
  CALLSIGN_TAKEN: 'Dieses Rufzeichen wurde gerade vergeben. Bitte wähle ein anderes.',
  INVALID_CALLSIGN: 'Dieses Rufzeichen kann nicht verwendet werden.',
  PARTICIPANT_REMOVED: 'Du wurdest aus dieser Mission entfernt. Bitte wende dich an die Lehrkraft.',
  MISSION_COMPLETED: 'Diese Mission ist bereits abgeschlossen.',
  ANONYMOUS_AUTH_REQUIRED: 'Der anonyme Zugang konnte nicht hergestellt werden.',
  OPEN_SESSION_EXISTS: 'Für dieses Loreboard ist bereits eine offene Missionssitzung vorhanden.',
}[error?.message] || 'Die Mission konnte wegen eines technischen Fehlers nicht geladen werden. Bitte versuche es erneut oder informiere deine Lehrkraft.')

export function joinBlockedReason(info, chosen = '') {
  if (!info) return 'Die Missionsdaten werden noch geladen.'
  if (info.participant_status === 'removed') return 'Dieses Gerät wurde aus der Mission entfernt.'
  if (info.status === 'completed') return 'Die Mission ist bereits beendet.'
  if (!info.joining_open) return 'Die Lehrkraft hat den Zugang noch nicht geöffnet.'
  if (!['lobby', 'active'].includes(info.status)) return 'Die Mission nimmt momentan keine neuen Crewmitglieder auf.'
  if (!chosen) return 'Bitte wähle zuerst ein freies Rufzeichen.'
  if (info.taken_callsigns?.includes(chosen)) return 'Dieses Rufzeichen ist bereits vergeben.'
  return ''
}

export function logMissionError(operation, error) {
  console.error(`[Mission] ${operation} fehlgeschlagen`, error)
}

const SESSION_COLUMNS = 'id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at'
const PARTICIPANT_COLUMNS = 'id,session_id,callsign,status,ready_scene_id,joined_at,last_seen_at,removed_at'

export function createMissionRepository(client) {
  const rpcOne = async (name, args) => {
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data?.[0]
  }
  return {
    async list() {
      const { data, error } = await client.from('mission_sessions').select(SESSION_COLUMNS).eq('story_slug', STORY_SLUG).order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    create: loreboardId => rpcOne('create_mission_session', { p_loreboard_id: loreboardId || null }),
    update: (id, action) => rpcOne('update_mission_session', { p_session_id: id, p_action: action }),
    setScene: (id, scene) => rpcOne('set_mission_scene', { p_session_id: id, p_scene_id: scene }),
    resetReady: async (id, scene) => { const { error } = await client.rpc('reset_mission_readiness', { p_session_id: id, p_scene_id: scene }); if (error) throw error },
    async participants(id) {
      const { data, error } = await client.from('mission_participants').select(PARTICIPANT_COLUMNS).eq('session_id', id).order('callsign')
      if (error) throw error
      return data || []
    },
    async remove(id) {
      const { error } = await client.rpc('remove_mission_participant', { p_participant_id: id })
      if (error) throw error
    },
    removeDisconnected: sessionId => rpcOne('remove_disconnected_mission_participants', { p_session_id: sessionId }),
    subscribe(id, onChange, onStatus) {
      const channel = client.channel(`mission:${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_sessions', filter: `id=eq.${id}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_participants', filter: `session_id=eq.${id}` }, onChange).subscribe(onStatus)
      return () => client.removeChannel(channel)
    },
  }
}

export const isParticipantConnected = (participant, now = Date.now()) => participant.status === 'connected' && now - new Date(participant.last_seen_at).getTime() <= PRESENCE_TIMEOUT_MS
export const readyCount = (participants, scene) => participants.filter(participant => participant.status !== 'removed' && participant.ready_scene_id === scene).length
export const crewLabel = count => `${count} ${count === 1 ? 'Crewmitglied' : 'Crewmitglieder'}`
export const readinessLabel = (participants, scene) => {
  if (!scene?.readinessRequired) return null
  const active = participants.filter(person => person.status !== 'removed')
  const count = readyCount(active, scene.id)
  if (!active.length) return 'Noch nicht begonnen'
  return count === active.length ? 'Vollständig' : `${count} von ${active.length} bereit`
}
