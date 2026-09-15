import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, ChevronDown, Circle, CirclePlay, Clock3, Compass, Feather, Gem, Library, ListChecks, LogOut, Maximize, Menu, PenLine, Pause, Play, Plus, RotateCcw, Save, Search, Settings2, Trash2, ShoppingBag, Sparkles, TimerReset, WandSparkles, X } from 'lucide-react'
import { stories, worlds } from './data'
import { addStoryToFundus, readState, timerRemaining } from './state'
import { createSupabaseLoreboardRepository, DEFAULT_LOREBOARD_STATE, MAX_ASSIGNMENT_LENGTH, MAX_MATERIALS } from './loreboardRepository'
import { authErrorMessage, signIn, signUp } from './auth'
import { getSupabaseClient } from './supabaseClient'
import JoinMission from './JoinMission'
import MissionLobby from './MissionLobby'
import { getWorldTheme, themeVariables } from './worldThemes'

function App() {
  const [initial] = useState(() => readState(localStorage))
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [configError, setConfigError] = useState('')
  const [view, setView] = useState(initial.view)
  const [fundus, setFundus] = useState(initial.fundus)
  const [activeStory, setActiveStory] = useState(initial.activeStory)
  const [activeWorld, setActiveWorld] = useState(initial.activeWorld)
  const [toast, setToast] = useState('')
  const [supabase] = useState(() => { try { return getSupabaseClient() } catch (error) { setConfigError(error.message); return null } })
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => { if (!active) return; if (error) setConfigError(authErrorMessage(error)); setSession(data?.session ?? null); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (active) { setSession(nextSession); setAuthLoading(false) } })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [supabase])
  useEffect(() => localStorage.setItem('lore-state', JSON.stringify({ view, fundus, activeStory, activeWorld })), [view, fundus, activeStory, activeWorld])
  const notify = (text) => { setToast(text); window.setTimeout(() => setToast(''), 2600) }
  const teacherSession = session && !session.user?.is_anonymous && Boolean(session.user?.email_confirmed_at || session.user?.confirmed_at)
  const repository = useMemo(() => teacherSession ? createSupabaseLoreboardRepository(supabase, session.user) : null, [supabase, session, teacherSession])
  const joinMatch = window.location.pathname.match(/^\/join\/([^/]+)\/?$/)
  if (joinMatch) return supabase ? <JoinMission supabase={supabase} code={decodeURIComponent(joinMatch[1])}/> : <main className="join-page"><p>{configError}</p></main>
  if (authLoading) return <main className="session-loading" role="status"><Brand/><p>Sitzung wird geprüft …</p></main>
  if (!session) return <Landing supabase={supabase} configError={configError} />
  if (!teacherSession) return <main className="join-page"><div className="join-card"><Brand light/><h1>Schülerzugang aktiv</h1><p>Dieses Gerät ist anonym für eine Mission angemeldet. Öffne den gültigen Einladungslink oder scanne den QR-Code der Lehrkraft.</p></div></main>
  const logout = async () => { const { error } = await supabase.auth.signOut(); if (error) notify(authErrorMessage(error)) }
  return <Platform {...{ supabase, view, setView, fundus, setFundus, activeStory, setActiveStory, activeWorld, setActiveWorld, notify, repository }} user={session.user} onLogout={logout} toast={toast} />
}
function Brand({ light = false }) { return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Feather size={20} /></span><span>LORE <b>STORY</b></span></div> }

function Landing({ supabase, configError }) {
  const [loginOpen, setLoginOpen] = useState(false)
  return <main className="landing">
    <header className="public-nav"><Brand light /><nav><a href="#welten">Welten</a><a href="#features">So funktioniert’s</a><button className="btn ghost" onClick={() => setLoginOpen(true)}>Einloggen</button><button className="btn gold" onClick={() => setLoginOpen(true)}>Kostenlos starten <ArrowRight size={16} /></button></nav></header>
    <section className="hero">
      <div className="stars" /><div className="hero-orb orb-a"/><div className="hero-orb orb-b"/>
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> Geschichten, die Wissen lebendig machen</div><h1><span>Lernen wird</span><br/>zur <em>Legende.</em></h1><p>Verwandle Lerninhalte in interaktive Abenteuer. Erschaffe Welten, in denen Neugier den Weg weist und jedes Kapitel neues Wissen entfacht.</p><div className="hero-actions"><button className="btn gold large" onClick={() => setLoginOpen(true)}>Dein Abenteuer beginnt <ArrowRight size={18}/></button><a className="text-link" href="#welten"><CirclePlay size={20}/> Welten entdecken</a></div><div className="trust"><span>✦ Für Lehrkräfte</span><span>✦ Für Lernende</span><span>✦ Für kreative Köpfe</span></div></div>
      <div className="hero-scene" aria-label="Illustrative Vorschau einer Lore-Welt"><div className="moon"/><div className="mountain m1"/><div className="mountain m2"/><div className="floating-card"><span>Aktives Abenteuer</span><b>Das Flüstern des<br/>Moosarchivs</b><small>Kapitel 2 von 5</small><i><u style={{width:'38%'}}/></i></div></div>
    </section>
    <section id="welten" className="section worlds-section"><div className="section-heading"><div><span className="kicker">DEINE REISE. DEINE WELT.</span><h2>Wo Wissen Geschichten schreibt</h2></div><p>Jede Welt ist ein Tor zu neuen Perspektiven. Die Lernziele bleiben – das Abenteuer passt sich dir an.</p></div><div className="world-grid">{worlds.map((w,i)=><article className="world-card" key={w.id} style={{'--c1':w.colors[0],'--c2':w.colors[1]}}><div className="world-art"><span className="world-num">0{i+1}</span><i>{w.icon}</i></div><div className="world-copy"><small>{w.label}</small><h3>{w.name}</h3><p>{w.description}</p><button>Welt erkunden <ArrowRight size={16}/></button></div></article>)}</div></section>
    <section id="features" className="section feature-section"><div className="feature-intro"><span className="kicker">EINE IDEE. UNENDLICHE WEGE.</span><h2>Vom Lernziel<br/>zum Abenteuer.</h2><p>Alles, was du brauchst, um Wissen in Geschichten zu verwandeln – intuitiv, flexibel und voller Magie.</p></div><div className="feature-list">{[[WandSparkles,'Geschichten gestalten','Baue verzweigte Lernabenteuer mit Szenen, Aufgaben und Entscheidungen.'],[Library,'Wissen sammeln','Entdecke erprobte Stories im Lore-Market und organisiere sie in deinem Fundus.'],[Compass,'Welten wechseln','Übertrage eine Lernstruktur mit einem Klick in ein völlig neues Universum.']].map(([I,t,d],i)=><div className="feature" key={t}><span>0{i+1}</span><I/><div><h3>{t}</h3><p>{d}</p></div></div>)}</div></section>
    <footer><Brand light/><p>Geschichten öffnen Türen. Wissen zeigt den Weg.</p><small>© 2026 Lore Story · Ein Prototyp für neugierige Menschen</small></footer>
    {loginOpen && <LoginModal onClose={()=>setLoginOpen(false)} supabase={supabase} configError={configError}/>}
  </main>
}

function LoginModal({ onClose, supabase, configError }) {
  const [register,setRegister]=useState(false)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState(configError)
  const [busy,setBusy]=useState(false)
  const submit=async event=>{event.preventDefault();if(!supabase)return;setBusy(true);setMessage('');try{if(register){const result=await signUp(supabase,email,password);if(result.confirmationRequired)setMessage('Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.')}else await signIn(supabase,email,password)}catch(error){setMessage(authErrorMessage(error))}finally{setBusy(false)}}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="login-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X/></button><Brand/><span className="kicker">WILLKOMMEN IN DER WERKSTATT</span><h2>{register?'Deine Geschichte beginnt.':'Schön, dass du wieder da bist.'}</h2><p>{register?'Erschaffe deinen kostenlosen Lore-Zugang.':'Melde dich an und setze dein Abenteuer fort.'}</p><label>E-Mail-Adresse<input aria-label="E-Mail-Adresse" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Passwort<input aria-label="Passwort" type="password" autoComplete={register?'new-password':'current-password'} minLength="6" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<div className="auth-message" role="status">{message}</div>}<button className="btn dark large full" disabled={busy||!supabase}>{busy?'Bitte warten …':register?'Konto erstellen':'In die Lore-Werkstatt'} <ArrowRight size={17}/></button><button type="button" className="switch-auth" onClick={()=>{setRegister(!register);setMessage('')}}>{register?'Bereits dabei? Einloggen':'Noch nicht dabei? Kostenlos registrieren'}</button></form></div>
}

const navItems = [['overview',BookOpen,'Übersicht'],['loreboard',CirclePlay,'Loreboard'],['werkstatt',PenLine,'Werkstatt'],['fundus',Gem,'Fundus'],['market',ShoppingBag,'Lore-Market'],['weltwechsler',Compass,'Weltwechsler']]

function Platform(props) {
  const {view,setView,onLogout,toast,user}=props; const [mobile,setMobile]=useState(false)
  const go=(v)=>{setView(v);setMobile(false)}
  if(view==='loreboard') return <LoreboardMode {...props}/>
  if(view==='mission') return <MissionLobby supabase={props.supabase} user={user} onBack={()=>setView('loreboard')}/>
  return <div className="platform"><aside className={mobile?'open':''}><div className="aside-head"><Brand light/><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="workspace-label">MEINE LORE-WERKSTATT</div><nav>{navItems.map(([id,I,label])=><button className={view===id?'active':''} key={id} onClick={()=>go(id)}><I size={19}/>{label}{label==='Lore-Market'&&<span className="new-pill">NEU</span>}</button>)}</nav><div className="aside-world"><small>AKTIVE WELT</small><div><span>✦</span><b>{worlds.find(w=>w.id===props.activeWorld)?.name}</b></div></div><button className="profile" onClick={onLogout}><span>LS</span><div><b>{user.email}</b><small>Kreativkonto</small></div><LogOut size={17}/></button></aside>
    <main className="app-main"><header className="app-top"><button className="menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div><span className="breadcrumb">LORE STORY /</span> {navItems.find(n=>n[0]===view)?.[2]}</div><div className="top-actions"><button className="icon-btn"><Search size={19}/></button><button className="avatar">LS</button></div></header><div className="view">{view==='overview'&&<Overview {...props}/>} {view==='werkstatt'&&<Workshop {...props}/>} {view==='fundus'&&<Fundus {...props}/>} {view==='market'&&<Market {...props}/>} {view==='weltwechsler'&&<WorldSwitcher {...props}/>}</div></main>{toast&&<div className="toast"><Check size={17}/>{toast}</div>}</div>
}

function PageHead({ kicker,title,copy,action }) { return <div className="page-head"><div><span className="kicker">{kicker}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div> }
function Overview({fundus,activeStory,setActiveStory,setView,activeWorld,notify}) { const available=stories.filter(s=>fundus.includes(s.id)); const story=stories.find(s=>s.id===activeStory)||available[0]; const world=worlds.find(w=>w.id===activeWorld); return <><PageHead kicker="GUTEN MORGEN, LEA" title="Deine Übersicht" copy="Deine persönliche Werkstatt mit Stories, Sammlung und Schnellzugriffen." action={<button className="btn dark" onClick={()=>setView('loreboard')}><CirclePlay size={17}/> Loreboard öffnen</button>}/><div className="active-banner" style={{'--accent':world.colors[0]}}><div className="banner-copy"><span className="status"><i/> AKTIVE STORY</span><small>{world.name} · {story.subject}</small><h2>{story.title}</h2><p>{story.description}</p><div className="progress-row"><span>Dein Fortschritt</span><b>Kapitel 2 / {story.chapters}</b></div><div className="progress"><i style={{width:`${200/story.chapters}%`}}/></div><div className="banner-actions"><button className="btn gold" onClick={()=>setView('loreboard')}><CirclePlay size={18}/> Im Loreboard starten</button><button className="btn glass" onClick={()=>setView('werkstatt')}><PenLine size={17}/> Bearbeiten</button></div></div><div className="banner-symbol">{world.icon}</div></div><section className="dashboard-section"><div className="section-title"><div><h3>Aus deinem Fundus</h3><p>Wähle eine aktive Story für dein Loreboard.</p></div><button onClick={()=>setView('fundus')}>Alle anzeigen <ArrowRight size={16}/></button></div><div className="story-row">{available.map(s=><StoryCard key={s.id} story={s} active={s.id===activeStory} action={()=>{setActiveStory(s.id);notify('Story für das Loreboard aktiviert')}}/>)}</div></section></> }

function EditorDialog({ title, children, onClose }) {
  return <div className="board-dialog-backdrop" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="board-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label={`${title} schließen`} onClick={onClose}><X/></button></header>{children}</section></div>
}

function LoreboardMode({ fundus, activeStory, setActiveStory, activeWorld, setView, repository }) {
  const available = stories.filter(story => fundus.includes(story.id))
  const [board, setBoard] = useState(() => ({ ...DEFAULT_LOREBOARD_STATE, activeStory, activeWorld }))
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [now, setNow] = useState(new Date())
  const [dialog, setDialog] = useState(null)
  const [assignmentDraft, setAssignmentDraft] = useState('')
  const [materialDraft, setMaterialDraft] = useState([])
  const [routeDraft, setRouteDraft] = useState([])
  const [materialLimit, setMaterialLimit] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [minutes, setMinutes] = useState(10)
  const [seconds, setSeconds] = useState(0)
  const [storyNotice, setStoryNotice] = useState(false)
  const skipInitialSave = useRef(true)
  const saveVersion = useRef(0)

  useEffect(() => { let active=true; repository.load().then(saved=>{ if(!active)return; const next={...saved,activeStory:saved.activeStory||activeStory,activeWorld:saved.activeWorld||activeWorld}; setBoard(next); setMinutes(Math.floor(next.timer.duration/60)); setSeconds(next.timer.duration%60); setActiveStory(next.activeStory); setSaveStatus(repository.offline?'Nur auf diesem Gerät gespeichert':''); setLoaded(true) }).catch(()=>{ if(active){setSaveStatus('Speichern fehlgeschlagen');setLoaded(true)} }); return()=>{active=false} }, [repository])
  useEffect(() => {
    if (!loaded) return
    if (skipInitialSave.current) { skipInitialSave.current = false; return }
    const version = ++saveVersion.current
    setSaveStatus('Speichert …')
    repository.save(board)
      .then(() => { if (version === saveVersion.current) setSaveStatus('Online gespeichert') })
      .catch(() => { if (version === saveVersion.current) setSaveStatus('Speichern fehlgeschlagen · Nur auf diesem Gerät gespeichert') })
  }, [board, loaded, repository])
  useEffect(() => { const clock=window.setInterval(()=>setNow(new Date()),1000); return()=>window.clearInterval(clock) }, [])
  useEffect(() => {
    if (board.timer.status !== 'running') return undefined
    const expire = () => setBoard(current => current.timer.status === 'running' && timerRemaining(current.timer) === 0
      ? { ...current, timer: { ...current.timer, remaining: 0, status: 'expired', targetAt: null } }
      : current)
    const timeout = window.setTimeout(expire, Math.max(0, board.timer.targetAt - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [board.timer.status, board.timer.targetAt])

  const update = patch => setBoard(current=>({...current,...patch}))
  const openAssignment=()=>{setAssignmentDraft(board.assignment);setDialog('assignment')}
  const saveAssignment=()=>{const clean=assignmentDraft.trim();if(clean){update({assignment:clean});setDialog(null)}}
  const openMaterials=()=>{setMaterialDraft([...board.materials]);setMaterialLimit(false);setDialog('materials')}
  const addMaterial=()=>{if(materialDraft.length>=MAX_MATERIALS){setMaterialLimit(true);return}setMaterialDraft(current=>[...current,'Neues Material'])}
  const saveMaterials=()=>{update({materials:materialDraft.map(x=>x.trim()).filter(Boolean).slice(0,MAX_MATERIALS)});setDialog(null)}
  const moveMaterial=(index,direction)=>setMaterialDraft(current=>{const target=index+direction;if(target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next})
  const openRoute=()=>{setRouteDraft([...board.phases]);setDialog('route')}
  const saveRoute=()=>{const phases=routeDraft.map(x=>x.trim()).filter(Boolean);if(phases.length){update({phases,activePhase:Math.min(board.activePhase,phases.length-1)});setDialog(null)}}
  const timerValue=()=>Math.max(0,Number(minutes)*60+Number(seconds))
  const resetTimer=()=>{const duration=timerValue();update({timer:{duration,remaining:duration,status:'ready',startedAt:null,targetAt:null}})}
  const startTimer=()=>setBoard(current=>{const remaining=current.timer.remaining<=0?current.timer.duration:current.timer.remaining;if(!remaining)return current;const startedAt=Date.now();return {...current,timer:{...current.timer,remaining,status:'running',startedAt,targetAt:startedAt+remaining*1000}}})
  const toggleTimer=()=>setBoard(current=>{const timer=current.timer;if(timer.status==='running'){const remaining=timerRemaining(timer);return {...current,timer:{...timer,remaining,status:remaining?'paused':'expired',targetAt:null}}}const startedAt=Date.now();return {...current,timer:{...timer,status:'running',startedAt,targetAt:startedAt+timer.remaining*1000}}})
  const selectStory=value=>{setActiveStory(value);update({activeStory:value});setStoryNotice(false)}
  const toggleFullscreen=async()=>{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}
  const story=stories.find(item=>item.id===board.activeStory)||available[0]
  const world=worlds.find(item=>item.id===board.activeWorld)||worlds.find(item=>item.id===activeWorld)
  const visibleRemaining=timerRemaining(board.timer,now.getTime())
  const time=`${String(Math.floor(visibleRemaining/60)).padStart(2,'0')}:${String(visibleRemaining%60).padStart(2,'0')}`
  const timerStatus={ready:'Bereit',running:'Timer läuft',paused:'Pausiert',expired:'Zeit ist um'}[board.timer.status]

  const configuredTheme=getWorldTheme(world.id)
  return <main className={`loreboard-mode ${configuredTheme ? `world-${world.id}` : ''}`} style={{'--lore-accent':world.colors[0],'--lore-deep':world.colors[1],...themeVariables(configuredTheme)}}>
    <div className="lore-ambient"/><header className="loreboard-topbar"><div className="loreboard-brand"><span>{world.icon}</span><div><small>LOREBOARD · {world.name}</small><b>{board.phases[board.activePhase]}</b></div></div><div className="live-clock"><Clock3/><div><strong>{now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</strong><small>{now.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</small></div></div><div className="loreboard-controls"><span className={`save-status ${saveStatus.includes('fehl')?'error':''}`} role="status">{saveStatus}</span><button onClick={toggleFullscreen} aria-label="Vollbild öffnen"><Maximize/> Vollbild</button><button className="exit-board" onClick={()=>setView('overview')}><ArrowLeft/> Zur Übersicht</button></div></header>
    <section className="route-strip" aria-label="Tagesroute"><div className="route-heading"><span>TAGESROUTE</span><button aria-label="Tagesroute bearbeiten" onClick={openRoute}><PenLine/></button></div><div className="route-items">{board.phases.map((item,index)=><button className={index===board.activePhase?'active':''} onClick={()=>update({activePhase:index})} key={`${item}-${index}`} aria-pressed={index===board.activePhase}><i>{index+1}</i>{item}</button>)}</div></section>
    <section className="board-grid">
      <article className="board-widget assignment-widget"><div className="widget-title"><PenLine/><span>AKTUELLER AUFTRAG</span></div><p className="assignment-display">{board.assignment}</p><button onClick={openAssignment}><PenLine/> Auftrag bearbeiten</button></article>
      <article className="board-widget timer-widget"><div className="widget-title"><TimerReset/><span>TIMER</span><small>{timerStatus}</small></div><strong>{time}</strong><div className="timer-actions"><button className="timer-start" onClick={startTimer} disabled={board.timer.status==='running'}><Play/> {board.timer.status==='ready'?'Starten':'Neu starten'}</button><button onClick={toggleTimer} disabled={board.timer.remaining<=0||board.timer.status==='ready'}>{board.timer.status==='running'?<><Pause/> Pausieren</>:<><Play/> Fortsetzen</>}</button><button onClick={resetTimer}><RotateCcw/> Zurücksetzen</button></div><button className="settings-toggle" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(x=>!x)}><Settings2/> Timer-Einstellungen <ChevronDown/></button>{settingsOpen&&<div className="timer-settings"><label>Minuten<input aria-label="Timer Minuten" type="number" min="0" max="180" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><label>Sekunden<input aria-label="Timer Sekunden" type="number" min="0" max="59" value={seconds} onChange={e=>setSeconds(e.target.value)}/></label><button aria-label="Timer übernehmen" onClick={resetTimer}><Check/> Übernehmen</button></div>}</article>
      <article className="board-widget materials-widget"><div className="widget-title"><ListChecks/><span>DAS BRAUCHST DU</span><button className="material-edit" onClick={openMaterials}><PenLine/> Material bearbeiten</button></div><ul className="material-list">{board.materials.map((item,index)=><li key={`${item}-${index}`}><Circle/><span>{item}</span></li>)}</ul></article>
      <article className="board-widget story-launcher"><div className="widget-title"><Sparkles/><span>AKTIVE LORESTORY</span></div><div className="story-select"><span>{world.icon}</span><select aria-label="Aktive Lorestory" value={story.id} onChange={e=>selectStory(e.target.value)}>{available.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}</select></div><p>{story.subject} · {story.age} Jahre · {story.duration}</p><button onClick={()=>setView('mission')}><CirclePlay/> Mission vorbereiten</button><button onClick={()=>setStoryNotice(true)}>Story-Vorschau öffnen</button>{storyNotice&&<div className="story-notice" role="status"><Sparkles/><span><b>Storymodus noch nicht angebunden</b>Die ausgewählte Story ist vorgemerkt. Der interaktive Storymodus folgt.</span></div>}</article>
    </section>
    {dialog==='assignment'&&<EditorDialog title="Aktuellen Auftrag bearbeiten" onClose={()=>setDialog(null)}><label className="dialog-label">Auftrag<textarea autoFocus aria-label="Aktueller Auftrag bearbeiten" maxLength={MAX_ASSIGNMENT_LENGTH} value={assignmentDraft} onChange={e=>setAssignmentDraft(e.target.value)}/><small>Empfehlung: höchstens 160 Zeichen · maximal {MAX_ASSIGNMENT_LENGTH} ({assignmentDraft.length}/{MAX_ASSIGNMENT_LENGTH})</small></label><div className="dialog-actions"><button onClick={()=>setDialog(null)}>Abbrechen</button><button onClick={saveAssignment}><Save/> Auftrag speichern</button></div></EditorDialog>}
    {dialog==='materials'&&<EditorDialog title="Materialliste bearbeiten" onClose={()=>setDialog(null)}><div className="material-editor">{materialDraft.map((item,index)=><div className="material-input" key={index}><input aria-label={`Material ${index+1}`} value={item} onChange={e=>setMaterialDraft(current=>current.map((x,i)=>i===index?e.target.value:x))}/><button aria-label={`${item} nach oben`} disabled={index===0} onClick={()=>moveMaterial(index,-1)}><ArrowUp/></button><button aria-label={`${item} nach unten`} disabled={index===materialDraft.length-1} onClick={()=>moveMaterial(index,1)}><ArrowDown/></button><button aria-label={`${item} löschen`} onClick={()=>setMaterialDraft(current=>current.filter((_,i)=>i!==index))}><Trash2/></button></div>)}<button className="material-add" onClick={addMaterial} disabled={materialDraft.length>=MAX_MATERIALS}><Plus/> Material hinzufügen</button>{(materialLimit||materialDraft.length>=MAX_MATERIALS)&&<p className="limit-note" role="alert">Maximal acht Materialien sind möglich.</p>}<div className="dialog-actions"><button onClick={()=>setDialog(null)}>Abbrechen</button><button onClick={saveMaterials}><Save/> Speichern</button></div></div></EditorDialog>}
    {dialog==='route'&&<EditorDialog title="Tagesroute bearbeiten" onClose={()=>setDialog(null)}><div className="route-editor">{routeDraft.map((item,index)=><div className="route-input" key={index}><i>{index+1}</i><input aria-label={`Routenpunkt ${index+1}`} value={item} onChange={e=>setRouteDraft(current=>current.map((x,i)=>i===index?e.target.value:x))}/><button aria-label={`Routenpunkt ${index+1} löschen`} onClick={()=>setRouteDraft(current=>current.filter((_,i)=>i!==index))} disabled={routeDraft.length===1}><Trash2/></button></div>)}<button className="route-add" onClick={()=>setRouteDraft(current=>[...current,'Neue Etappe'])}><Plus/> Etappe</button><div className="dialog-actions"><button onClick={()=>setDialog(null)}>Abbrechen</button><button onClick={saveRoute}><Save/> Speichern</button></div></div></EditorDialog>}
  </main>
}
function StoryCard({story,action,active,market=false,owned=false}) { const w=worlds.find(x=>x.id===story.world); return <article className="story-card"><div className="story-visual" style={{'--accent':story.accent}}><span>{w.icon}</span><small>{w.name}</small>{active&&<b className="active-tag"><Check size={12}/> AKTIV</b>}</div><div className="story-info"><div className="chips"><span>{story.subject}</span><span>{story.age} Jahre</span></div><h3>{story.title}</h3><p>{story.description}</p><div className="story-meta"><span><BookOpen size={14}/>{story.chapters} Kapitel</span><span>◷ {story.duration}</span></div><button className={active?'selected':''} disabled={owned&&market} onClick={action}>{market?(owned?<><Check/> Im Fundus</>:<><Plus/> Zum Fundus</>):active?'Aktive Story':'Im Loreboard aktivieren'}</button></div></article> }
function Fundus({fundus,activeStory,setActiveStory,setView,notify}) { const list=stories.filter(s=>fundus.includes(s.id)); return <><PageHead kicker="DEINE SAMMLUNG" title="Fundus" copy="Alle Geschichten, die du gesammelt hast – bereit für ihr nächstes Abenteuer." action={<button className="btn dark" onClick={()=>setView('market')}><ShoppingBag size={17}/> Lore-Market öffnen</button>}/><div className="filterbar"><b>{list.length} Geschichten</b><div><button className="filter-active">Alle</button><button>Eigene</button><button>Gesammelt</button></div></div><div className="story-grid">{list.map(s=><StoryCard key={s.id} story={s} active={s.id===activeStory} action={()=>{setActiveStory(s.id);notify('Story aktiviert und ins Loreboard gelegt')}}/>)}</div></> }
function Market({fundus,setFundus,notify}) { const add=id=>{const next=addStoryToFundus(fundus,id);if(next!==fundus){setFundus(next);notify('Story wurde deinem Fundus hinzugefügt')}}; return <><PageHead kicker="GESCHICHTEN, DIE INSPIRIEREN" title="Lore-Market" copy="Entdecke handverlesene Lernabenteuer und mache sie zu deinen eigenen."/><div className="market-hero"><div><span>EMPFEHLUNG DER WOCHE</span><h2>Entdecke das geheime<br/>Netzwerk des Waldes.</h2><p>Ein biologisches Lernabenteuer über Symbiosen, Pilze und die Sprache der Bäume.</p></div><Sparkles/></div><div className="filterbar"><b>Für dich ausgewählt</b><div><button className="filter-active">Alle Fächer</button><button>Mathematik</button><button>Sprachen</button><button>Natur</button></div></div><div className="story-grid">{stories.map(s=><StoryCard key={s.id} story={s} market owned={fundus.includes(s.id)} action={()=>add(s.id)}/>)}</div></> }
function Workshop({activeStory,notify}) { const story=stories.find(s=>s.id===activeStory); const [title,setTitle]=useState(story.title); const [desc,setDesc]=useState(story.description); useEffect(()=>{setTitle(story.title);setDesc(story.description)},[story]); return <><PageHead kicker="GESCHICHTEN SCHREIBEN" title="Werkstatt" copy="Forme deine Lore. Jede Änderung wird Teil deines nächsten Abenteuers." action={<button className="btn dark" onClick={()=>notify('Deine Änderungen wurden lokal gespeichert')}><Check size={17}/> Änderungen speichern</button>}/><div className="editor-layout"><div className="editor-card"><div className="editor-tabs"><button className="active">Grundlagen</button><button>Kapitel & Szenen</button><button>Lernziele</button></div><label>Titel der Story<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Kurzbeschreibung<textarea rows="4" value={desc} onChange={e=>setDesc(e.target.value)}/></label><div className="form-row"><label>Fach<select defaultValue={story.subject}><option>{story.subject}</option><option>Mathematik</option><option>Deutsch</option></select></label><label>Altersgruppe<select defaultValue={story.age}><option>{story.age}</option><option>8–11</option><option>12–15</option></select></label></div></div><aside className="chapter-list"><div><span>STORY-STRUKTUR</span><b>{story.chapters} Kapitel</b></div>{Array.from({length:story.chapters},(_,i)=><button className={i===1?'active':''} key={i}><span>0{i+1}</span><div><b>{['Der Ruf des Waldes','Unter dem Wurzelmeer','Das verborgene Geflecht','Die Prüfung der Hüter','Ein neuer Morgen','Die letzte Karte'][i]}</b><small>{i===1?'In Bearbeitung':'Entwurf'}</small></div><ChevronDown size={15}/></button>)}<button className="add-chapter"><Plus size={16}/> Kapitel hinzufügen</button></aside></div></> }
function WorldSwitcher({activeStory,activeWorld,setActiveWorld,notify,repository}) { const story=stories.find(s=>s.id===activeStory); const chooseWorld=async id=>{setActiveWorld(id);try{const board=await repository.load();await repository.save({...board,activeWorld:id});notify(`${worlds.find(w=>w.id===id).name} als aktive Welt gespeichert`)}catch{notify('Welt lokal gewählt · Cloud-Speicherung fehlgeschlagen')}}; return <><PageHead kicker="GLEICHE STRUKTUR. NEUE MAGIE." title="Weltwechsler" copy="Übertrage deine Geschichte in eine andere Welt. Lernziele und Dramaturgie bleiben erhalten."/><div className="switch-panel"><div className="switch-story"><span>AKTUELLE STORY</span><h3>{story.title}</h3><p>{story.subject} · {story.chapters} Kapitel · {story.age} Jahre</p></div><div className="switch-arrow"><WandSparkles/></div><div><span className="kicker">ZIELWELT WÄHLEN</span><div className="world-options">{worlds.map(w=><button className={activeWorld===w.id?'active':''} onClick={()=>chooseWorld(w.id)} key={w.id} style={{'--world':w.colors[0]}}><i>{w.icon}</i><div><b>{w.name}</b><small>{w.label}</small></div>{activeWorld===w.id&&<Check/>}</button>)}</div></div></div><div className="transfer-preview"><div><span>VORHER</span><h3>{story.title}</h3><p>Ein geheimnisvolles Netzwerk muss verstanden werden, um das Gleichgewicht wiederherzustellen.</p></div><ArrowRight/><div><span>NACHHER · {worlds.find(w=>w.id===activeWorld).name.toUpperCase()}</span><h3>{activeWorld==='aether'?'Das Echo der Himmelsarchive':activeWorld==='tiefsee'?'Das Leuchten der Tiefenchronik':story.title}</h3><p>Die Lernstruktur bleibt identisch – Figuren, Schauplätze und Atmosphäre werden neu inszeniert.</p></div></div><button className="btn gold switch-submit" onClick={()=>notify(`Story erfolgreich nach ${worlds.find(w=>w.id===activeWorld).name} übertragen`)}><Sparkles size={17}/> Weltwechsel anwenden</button></> }

export default App
