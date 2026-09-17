import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Expand, Radio, RefreshCw, Rocket, Wifi, WifiOff } from 'lucide-react'
import { createLiveController, HEARTBEAT_INTERVAL_MS, joinBlockedReason, logMissionError, missionErrorMessage, STORY_SLUG } from './mission'
import { getMissionPackage, themeVariables } from './worldThemes'

export default function JoinMission({ supabase, code }) {
  const normalized = code.trim().toUpperCase()
  const missionPackage = getMissionPackage(STORY_SLUG)
  const theme = missionPackage.theme
  const themedPage = 'join-page astra-student'
  const [screen, setScreen] = useState('loading')
  const [info, setInfo] = useState(null)
  const [chosen, setChosen] = useState('')
  const [message, setMessage] = useState('')
  const [online, setOnline] = useState(window.navigator.onLine)
  const [teacherBrowser, setTeacherBrowser] = useState(false)
  const [, setClock] = useState(Date.now())
  const liveController = useRef(null)
  if (!liveController.current) liveController.current = createLiveController(channel => supabase.removeChannel(channel), timer => window.clearInterval(timer))
  const autoReconnectAttempted = useRef(false)

  const stopLive = useCallback(() => liveController.current.stop(), [])

  const showRemoved = useCallback(() => {
    stopLive()
    setMessage(missionErrorMessage({ message: 'PARTICIPANT_REMOVED' }))
    setScreen('removed')
  }, [stopLive])

  const inspect = useCallback(async ({ preserveMessage = false, retryRemoved = false } = {}) => {
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
      let inspected = data?.[0]
      if (inspected?.participant_id) {
        const { data: rows } = await supabase.from('mission_sessions').select('finale_started_at,finale_target_at,finale_status').eq('id', inspected.session_id)
        inspected = { ...inspected, ...(Array.isArray(rows) ? rows[0] : rows) }
      }
      setInfo(inspected)
      if (inspected?.participant_status === 'removed') {
        if (!retryRemoved) showRemoved()
        else if (inspected.status === 'completed') {
          setMessage(missionErrorMessage({ message: 'MISSION_COMPLETED' }))
          setScreen('removed')
        } else if (!inspected.joining_open) {
          setMessage('Der Zugang ist geschlossen. Bitte warte, bis deine Lehrkraft ihn öffnet.')
          setScreen('removed')
        } else {
          window.localStorage.removeItem(`mission-callsign:${normalized}`)
          setChosen('')
          setInfo({ ...inspected, participant_id: null, participant_status: null, callsign: null, ready_scene_id: null })
          setScreen('choose')
        }
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

  useEffect(() => { const timer=window.setInterval(()=>setClock(Date.now()),1000); return()=>window.clearInterval(timer) }, [])

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

  const retryAfterRemoval = () => inspect({ retryRemoved: true })

  if (teacherBrowser || screen === 'teacher') return <main className={themedPage} style={themeVariables(theme)}><div className="join-card"><Rocket/><h1>Schülerzugang</h1><p>Dieser Browser ist als Lehrkraft angemeldet. Öffne den Schülerzugang auf einem Schülergerät oder in einem privaten Browserfenster.</p><a className="join-back" href="/"><ArrowLeft/> Zurück zum Loreboard</a></div></main>
  if (screen === 'loading') return <main className={themedPage} style={themeVariables(theme)}><div className="join-card"><Rocket/><h1>Mission wird gesucht …</h1></div></main>
  if (screen === 'error' || screen === 'removed') return <main className={themedPage} style={themeVariables(theme)}><div className="join-card removed-card"><WifiOff/><h1>{screen === 'removed' ? 'Du wurdest aus der Crew entfernt' : 'Zugang nicht möglich'}</h1><p role="alert">{message}</p>{screen === 'error' ? <button onClick={() => inspect()}>Erneut versuchen</button> : <button className="primary" onClick={retryAfterRemoval}><RefreshCw/> Erneut beitreten</button>}</div></main>
  if (screen === 'choose') { const blocked=joinBlockedReason(info,chosen); return <main className={themedPage} style={themeVariables(theme)}><div className="join-card wide"><Rocket/><small>LORE {theme.name.toUpperCase()}</small><h1>{info.title}</h1><p>Wähle dein anonymes Rufzeichen. Es werden keine Namen benötigt.</p><div className="callsign-grid">{info.callsigns.map(name => <button key={name} disabled={info.taken_callsigns.includes(name)} aria-pressed={chosen === name} aria-label={`${name}${info.taken_callsigns.includes(name) ? ', belegt' : chosen === name ? ', ausgewählt' : ', frei'}`} className={`${chosen === name ? 'selected' : ''} ${info.taken_callsigns.includes(name) ? 'taken' : 'available'}`} onClick={() => setChosen(name)}><span>{name}</span>{chosen === name ? <small className="selection-mark"><Check/> Ausgewählt</small> : info.taken_callsigns.includes(name) ? <small>Belegt</small> : <small>Frei</small>}</button>)}</div>{message && <p role="alert">{message}</p>}{blocked&&<p className="join-block-reason" role="status">{blocked}</p>}<button className="primary" disabled={Boolean(blocked)} title={blocked||undefined} onClick={() => join(chosen)}>Mit {chosen || 'Rufzeichen'} beitreten</button></div></main> }
  const active = info.status === 'active' || info.status === 'paused'
  const completed = info.status === 'completed'
  const scene = missionPackage.scenes.find(item => item.id === info.current_scene_id) || missionPackage.scenes[0]
  const paused = info.status === 'paused'
  const finaleRemaining=info.finale_target_at&&info.finale_status==='countdown'?Math.max(0,Math.ceil((new Date(info.finale_target_at).getTime()-Date.now())/1000)):null
  const finaleStarting=info.finale_status==='countdown'&&finaleRemaining===0
  const finaleFinished=info.finale_status==='finished'
  return <main className={themedPage} style={themeVariables(theme)}><section className="student-runtime"><header className="student-runtime-header"><div className={`connection ${online ? 'online' : ''}`}>{online ? <Wifi/> : <WifiOff/>}{online ? 'Crew-Netzwerk verbunden' : 'Verbindung unterbrochen'}</div><span className="student-access-state">{info.joining_open?'Zugang geöffnet':'Zugang geschlossen'}</span><button aria-label="Vollbild öffnen" onClick={()=>document.documentElement.requestFullscreen?.()}><Expand/></button></header><div><small>RUFZEICHEN · {chosen}</small><h1>{completed ? 'Mission abgeschlossen' : paused ? 'Übertragung pausiert' : finaleFinished?'Fortsetzung folgt':finaleStarting?'Astra startet':scene.title}</h1><h2>{info.title}</h2></div>{finaleRemaining!==null&&finaleRemaining>0?<div className="student-finale-countdown" aria-live="assertive">{finaleRemaining}</div>:finaleStarting?<div className="student-launch-sequence" role="status"><span>ASTRA</span><strong>Startsequenz läuft</strong></div>:finaleFinished?<div className="student-finale" role="status"><strong>Fortsetzung folgt</strong></div>:<div className="student-runtime-content">{completed ? <p>Danke für deinen Einsatz. Die {theme.name}-Crew meldet sich wieder.</p> : paused ? <p>NOVA: Bleib an deinem Platz. Die Lehrkraft setzt die Übertragung fort.</p> : active ? <><div className="student-nova"><b>NOVA</b><p>{scene.message}</p></div><section className="student-task"><small>AKTUELLER AUFTRAG</small><strong>{scene.task}</strong></section></> : <p>NOVA: Warte bitte, bis die Lehrkraft die Mission startet.</p>}</div>}{scene.ready&&active&&finaleRemaining===null&&!finaleFinished&&!finaleStarting&&<button className="primary" onClick={() => ready(!info.ready_scene_id)}>{info.ready_scene_id === info.current_scene_id ? <><Check/> Bereitschaft gemeldet</> : <><Radio/> Ich bin bereit</>}</button>}{message && <p role="alert">{message}</p>}</section></main>
}
