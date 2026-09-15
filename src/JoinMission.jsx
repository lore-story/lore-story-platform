import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Radio, Rocket, Wifi, WifiOff } from 'lucide-react'
import { createLiveController, HEARTBEAT_INTERVAL_MS, logMissionError, missionErrorMessage } from './mission'
import { sceneById } from './astraMission'
import { getWorldTheme, themeVariables } from './worldThemes'

const ASTRA = getWorldTheme('astra')

export default function JoinMission({ supabase, code }) {
  const normalized = code.trim().toUpperCase()
  const [screen, setScreen] = useState('loading')
  const [info, setInfo] = useState(null)
  const [chosen, setChosen] = useState('')
  const [message, setMessage] = useState('')
  const [online, setOnline] = useState(window.navigator.onLine)
  const [teacherBrowser, setTeacherBrowser] = useState(false)
  const liveController = useRef(null)
  if (!liveController.current) liveController.current = createLiveController(channel => supabase.removeChannel(channel), timer => window.clearInterval(timer))
  const autoReconnectAttempted = useRef(false)

  const stopLive = useCallback(() => liveController.current.stop(), [])

  const showRemoved = useCallback(() => {
    stopLive()
    setMessage(missionErrorMessage({ message: 'PARTICIPANT_REMOVED' }))
    setScreen('removed')
  }, [stopLive])

  const inspect = useCallback(async ({ preserveMessage = false } = {}) => {
    if (!preserveMessage) setMessage('')
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const result = await supabase.auth.signInAnonymously()
        if (result.error) throw result.error
        session = result.data.session
      } else if (!session.user?.is_anonymous) {
        setTeacherBrowser(true)
        setScreen('teacher')
        return null
      }
      const { data, error } = await supabase.rpc('inspect_mission', { p_code: normalized })
      if (error) throw error
      const inspected = data?.[0]
      setInfo(inspected)
      if (inspected?.participant_status === 'removed') {
        showRemoved()
      } else if (inspected?.participant_id) {
        setChosen(inspected.callsign)
        setScreen('waiting')
      } else {
        setScreen('choose')
      }
      return inspected
    } catch (error) {
      logMissionError('Sitzung prüfen', error)
      setMessage(missionErrorMessage(error))
      setScreen(error?.message === 'PARTICIPANT_REMOVED' ? 'removed' : 'error')
      return null
    }
  }, [normalized, showRemoved, supabase])

  const startLive = useCallback((joined) => {
    stopLive()
    const heartbeat = async connected => {
      const { error } = await supabase.rpc('update_my_mission_presence', { p_session_id: joined.session_id, p_connected: connected, p_ready: null })
      if (error) logMissionError('Anwesenheit aktualisieren', error)
      if (error?.message === 'PARTICIPANT_REMOVED') showRemoved()
      if (error?.message === 'MISSION_COMPLETED') stopLive()
    }
    heartbeat(true)
    const timer = window.setInterval(() => heartbeat(true), HEARTBEAT_INTERVAL_MS)
    const channel = supabase.channel(`student:${joined.session_id}:${joined.participant_id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mission_sessions', filter: `id=eq.${joined.session_id}` }, payload => {
      setInfo(current => ({ ...current, ...payload.new }))
      if (payload.new.status === 'completed') stopLive()
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mission_participants', filter: `id=eq.${joined.participant_id}` }, payload => {
      if (payload.new.status === 'removed') showRemoved()
      else setInfo(current => ({ ...current, ready_scene_id: payload.new.ready_scene_id }))
    }).subscribe(status => setOnline(status === 'SUBSCRIBED'))
    liveController.current.replace(channel, timer)
  }, [showRemoved, stopLive, supabase])

  const join = useCallback(async callsign => {
    if (!callsign) return
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('join_mission', { p_code: normalized, p_callsign: callsign })
      if (error) throw error
      const joined = data?.[0]
      setInfo(joined)
      setChosen(joined.callsign)
      window.localStorage.setItem(`mission-callsign:${normalized}`, joined.callsign)
      setScreen('waiting')
    } catch (error) {
      logMissionError('Mission beitreten', error)
      const errorMessage = missionErrorMessage(error)
      setMessage(errorMessage)
      if (error?.message === 'PARTICIPANT_REMOVED') {
        showRemoved()
        return
      }
      await inspect({ preserveMessage: true })
      setMessage(errorMessage)
    }
  }, [inspect, normalized, showRemoved, supabase])

  useEffect(() => {
    inspect().then(inspected => {
      if (!inspected || inspected.participant_id || autoReconnectAttempted.current) return
      const saved = window.localStorage.getItem(`mission-callsign:${normalized}`)
      if (saved) {
        autoReconnectAttempted.current = true
        setChosen(saved)
        join(saved)
      }
    })
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      stopLive()
    }
  }, [inspect, join, normalized, stopLive])

  useEffect(() => {
    if (screen === 'waiting' && info?.participant_id) startLive(info)
  }, [info?.participant_id, screen, startLive])

  const ready = async readyValue => {
    const { error } = await supabase.rpc('update_my_mission_presence', { p_session_id: info.session_id, p_connected: true, p_ready: readyValue })
    if (error) logMissionError('Bereitschaft aktualisieren', error)
    if (error?.message === 'PARTICIPANT_REMOVED') showRemoved()
    else if (error) setMessage(missionErrorMessage(error))
    else setInfo(current => ({ ...current, ready_scene_id: readyValue ? current.current_scene_id : null }))
  }

  if (teacherBrowser || screen === 'teacher') return <main className="join-page"><div className="join-card"><Rocket/><h1>Schülerzugang</h1><p>Dieser Browser ist als Lehrkraft angemeldet. Öffne den Schülerzugang auf einem Schülergerät oder in einem privaten Browserfenster.</p><a className="join-back" href="/"><ArrowLeft/> Zurück zum Loreboard</a></div></main>
  if (screen === 'loading') return <main className="join-page"><div className="join-card"><Rocket/><h1>Mission wird gesucht …</h1></div></main>
  if (screen === 'error' || screen === 'removed') return <main className="join-page"><div className="join-card"><WifiOff/><h1>Zugang nicht möglich</h1><p role="alert">{message}</p>{screen === 'error' && <button onClick={() => inspect()}>Erneut versuchen</button>}</div></main>
  if (screen === 'choose') return <main className="join-page"><div className="join-card wide"><Rocket/><small>LORE ASTRA</small><h1>{info.title}</h1><p>Wähle dein anonymes Rufzeichen. Es werden keine Namen benötigt.</p>{!info.joining_open && <p role="alert">Der Zugang zu dieser Mission ist gerade geschlossen.</p>}<div className="callsign-grid">{info.callsigns.map(name => <button key={name} disabled={info.taken_callsigns.includes(name)} className={chosen === name ? 'selected' : ''} onClick={() => setChosen(name)}>{name}{info.taken_callsigns.includes(name) && <small>belegt</small>}</button>)}</div>{message && <p role="alert">{message}</p>}<button className="primary" disabled={!chosen || !info.joining_open} onClick={() => join(chosen)}>Mit {chosen || 'Rufzeichen'} beitreten</button></div></main>
  const active = info.status === 'active' || info.status === 'paused'
  const completed = info.status === 'completed'
  const scene = sceneById(info.current_scene_id)
  const paused = info.status === 'paused'
  return <main className="join-page astra-student" style={themeVariables(ASTRA)}><div className="join-card"><div className={`connection ${online ? 'online' : ''}`}>{online ? <Wifi/> : <WifiOff/>}{online ? 'Crew-Netzwerk verbunden' : 'Verbindung unterbrochen'}</div><Rocket/><small>RUFZEICHEN · {chosen}</small><h1>{completed ? 'Mission abgeschlossen' : paused ? 'Übertragung pausiert' : scene.title}</h1><h2>{info.title}</h2>{completed ? <p>Danke für deinen Einsatz. Die Astra-Crew meldet sich wieder.</p> : paused ? <p>NOVA: Bleib an deinem Platz. Die Lehrkraft setzt die Übertragung fort.</p> : active ? <><div className="student-nova"><b>NOVA</b><p>{scene.message}</p></div><section className="student-task"><small>AKTUELLE AUFGABE</small><strong>{scene.task}</strong></section>{scene.ready && <button className="primary" onClick={() => ready(!info.ready_scene_id)}>{info.ready_scene_id === info.current_scene_id ? <><Check/> Bereitschaft gemeldet</> : <><Radio/> Ich bin bereit</>}</button>}{scene.ready && info.ready_scene_id === info.current_scene_id && <p className="student-wait">Signal gesichert. Warte auf deine Crew.</p>}</> : <p>NOVA: Warte bitte, bis die Lehrkraft die Mission startet.</p>}{message && <p role="alert">{message}</p>}</div></main>
}
