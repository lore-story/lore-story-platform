import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Play, Radio, RefreshCw, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import { createMissionRepository, isParticipantConnected, readyCount, STORY_TITLE } from './mission'

const OPEN_SESSION_KEY = 'lore-open-mission-id'

export default function MissionLobby({ supabase, onBack }) {
  const repo = useMemo(() => createMissionRepository(supabase), [supabase])
  const selectedId = useRef(window.sessionStorage.getItem(OPEN_SESSION_KEY))
  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)
  const [qr, setQr] = useState('')
  const [, tick] = useState(0)

  const loadSession = useCallback(async id => {
    const rows = await repo.list()
    setSessions(rows)
    const pinned = rows.find(item => item.id === (id || selectedId.current))
    const current = pinned || rows.find(item => item.status !== 'completed') || rows[0] || null
    selectedId.current = current?.id || null
    if (current) window.sessionStorage.setItem(OPEN_SESSION_KEY, current.id)
    setSession(current)
    setParticipants(current ? await repo.participants(current.id) : [])
  }, [repo])

  const refresh = useCallback(async () => {
    try {
      await loadSession(selectedId.current)
      setError('')
    } catch {
      setError('Die Missionsdaten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [loadSession])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => session ? repo.subscribe(session.id, refresh, status => setOnline(status === 'SUBSCRIBED')) : undefined, [refresh, repo, session?.id])
  useEffect(() => {
    if (!session) return undefined
    QRCode.toDataURL(`${window.location.origin}/join/${session.join_code}`, { width: 320, margin: 1, color: { dark: '#10243d', light: '#ffffff' } }).then(setQr)
    return undefined
  }, [session])
  useEffect(() => {
    const timer = window.setInterval(() => tick(value => value + 1), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const create = async () => {
    setLoading(true)
    try {
      const created = await repo.create(null)
      selectedId.current = created.id
      window.sessionStorage.setItem(OPEN_SESSION_KEY, created.id)
      await loadSession(created.id)
      setError('')
    } catch (caught) {
      setError(caught?.message === 'OPEN_SESSION_EXISTS' ? 'Es gibt bereits eine offene Sitzung. Öffne oder beende sie zuerst.' : 'Die Mission konnte nicht vorbereitet werden.')
    } finally {
      setLoading(false)
    }
  }
  const action = async name => {
    try { setSession(await repo.update(session.id, name)); setError('') } catch { setError('Die Änderung konnte nicht gespeichert werden.') }
  }
  const selectArchived = async id => {
    selectedId.current = id
    window.sessionStorage.setItem(OPEN_SESSION_KEY, id)
    setLoading(true)
    try { await loadSession(id) } finally { setLoading(false) }
  }
  const begin = () => window.confirm('Mission jetzt manuell beginnen?') && action('start')
  const finish = () => window.confirm('Mission wirklich abschließen? Danach kann sie nicht mehr verändert werden.') && action('complete')

  if (loading) return <main className="mission-lobby"><p>Mission wird geladen …</p></main>
  if (!session) return <main className="mission-lobby"><button className="back" onClick={onBack}><ArrowLeft/> Zum Loreboard</button><section className="empty-mission"><small>LORE ASTRA</small><h1>{STORY_TITLE}</h1><p>Bereite eine sichere Sitzung mit anonymen Rufzeichen vor.</p>{error && <p role="alert">{error}</p>}<button className="primary" onClick={create}>Mission vorbereiten</button></section></main>

  const activeParticipants = participants.filter(participant => participant.status !== 'removed')
  const ready = readyCount(activeParticipants, session.current_scene_id)
  const missing = activeParticipants.filter(participant => participant.ready_scene_id !== session.current_scene_id)
  return <main className="mission-lobby"><header><button className="back" onClick={onBack}><ArrowLeft/> Zum Loreboard</button><label className="mission-archive">Sitzung<select aria-label="Missionsarchiv" value={session.id} onChange={event => selectArchived(event.target.value)}>{sessions.map(item => <option value={item.id} key={item.id}>{item.status === 'completed' ? 'Archiv' : 'Offen'} · {new Date(item.created_at).toLocaleDateString('de-DE')}</option>)}</select></label><div className={`connection ${online ? 'online' : ''}`}>{online ? <Wifi/> : <WifiOff/>}{online ? 'Realtime verbunden' : 'Verbindung unterbrochen'}</div></header><section className="mission-title"><small>LORE ASTRA · {session.status === 'lobby' ? 'MISSIONSLOBBY' : session.status === 'completed' ? 'ARCHIV' : 'AKTIVE MISSION'}</small><h1>{session.title}</h1></section><div className="mission-layout"><article className="join-panel">{qr && <img src={qr} alt={`QR-Code für Sitzung ${session.join_code}`}/>}<span>SITZUNGSCODE</span><strong>{session.join_code}</strong><p>{window.location.origin}/join/{session.join_code}</p><button onClick={() => action(session.joining_open ? 'close_joining' : 'open_joining')} disabled={session.status === 'completed'}>{session.joining_open ? <><X/> Zugang schließen</> : <><RefreshCw/> Zugang öffnen</>}</button></article><article className="crew-panel"><div><span>CREW</span><strong>{activeParticipants.length} Teilnehmende</strong></div><div className="crew-grid">{activeParticipants.map(participant => { const connected = isParticipantConnected(participant); return <div key={participant.id} className={connected ? 'connected' : 'disconnected'}><i/><b>{participant.callsign}</b><small>{connected ? 'verbunden' : 'getrennt'}</small><button aria-label={`${participant.callsign} entfernen`} onClick={() => window.confirm(`${participant.callsign} entfernen?`) && repo.remove(participant.id)}><Trash2/></button></div> })}</div>{!activeParticipants.length && <p>Noch ist niemand beigetreten.</p>}<div className="ready"><Radio/><strong>{ready} von {activeParticipants.length} bereit</strong><details><summary>Fehlende Rufzeichen</summary>{missing.map(participant => <span key={participant.id}>{participant.callsign}</span>)}</details></div></article></div>{session.status === 'lobby' && <button className="mission-action" onClick={begin}><Play/> Mission beginnen</button>}{session.status === 'active' && <section className="active-placeholder"><Check/><p>Die Missionssitzung ist aktiv. Die Storyoberfläche wird im nächsten Entwicklungsschritt angebunden.</p><button onClick={finish}>Mission abschließen</button></section>}{session.status === 'completed' && <div className="archive-actions"><p>Diese Sitzung ist abgeschlossen und bleibt als Ergebnis erhalten.</p><button onClick={create}>Mission erneut starten</button></div>}{error && <p className="mission-error" role="alert">{error}</p>}</main>
}
