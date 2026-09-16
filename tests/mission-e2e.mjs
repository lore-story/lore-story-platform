import assert from 'node:assert/strict'
import chromiumBinary from '@sparticuz/chromium'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'
const backend = { version: 0, runs: [], participants: [], nextRun: 1, nextParticipant: 1, removals: {} }
const codeFor = number => `ASTR${String(number).padStart(3, '0')}`
function rpc(role, userId, name, args) {
  const fail = message => ({ data: null, error: { message } })
  if (name === 'create_mission_session') {
    if (role !== 'teacher') return fail('TEACHER_REQUIRED')
    if (backend.runs.some(run => run.status !== 'completed')) return fail('OPEN_SESSION_EXISTS')
    const now = new Date().toISOString(); const run = { id: `run-${backend.nextRun}`, story_slug: 'lore-astra-notruf-aus-dem-all', title: 'Notruf aus dem All', join_code: codeFor(backend.nextRun++), status: 'lobby', joining_open: true, current_scene_id: 'ankunft', created_at: now, started_at: null, completed_at: null, updated_at: now }
    backend.runs.unshift(run); backend.version++; return { data: [run], error: null }
  }
  const run = backend.runs.find(item => item.id === args.p_session_id || item.join_code === args.p_code)
  if (name === 'inspect_mission') {
    if (!run) return fail('INVALID_CODE')
    const own = backend.participants.find(item => item.session_id === run.id && item.userId === userId)
    if (run.status === 'completed' && !own) return fail('MISSION_COMPLETED')
    return { data: [{ ...run, session_id: run.id, participant_id: own?.id || null, participant_status: own?.status || null, callsign: own?.callsign || null, ready_scene_id: own?.ready_scene_id || null, callsigns: ['Astrofuchs', 'Blitzbär', 'Cosmo'], taken_callsigns: backend.participants.filter(item => item.session_id === run.id && item.status !== 'removed').map(item => item.callsign) }], error: null }
  }
  if (name === 'join_mission') {
    if (!run) return fail('INVALID_CODE')
    const own = backend.participants.find(item => item.session_id === run.id && item.userId === userId)
    if (own?.status === 'removed') return fail('PARTICIPANT_REMOVED')
    if (run.status === 'completed') return fail('MISSION_COMPLETED')
    if (!own && !run.joining_open) return fail('JOINING_CLOSED')
    if (!own && backend.participants.some(item => item.session_id === run.id && item.status !== 'removed' && item.callsign === args.p_callsign)) return fail('CALLSIGN_TAKEN')
    const participant = own || { id: `participant-${backend.nextParticipant++}`, session_id: run.id, userId, callsign: args.p_callsign, status: 'connected', ready_scene_id: null, joined_at: new Date().toISOString(), removed_at: null }
    participant.status = 'connected'; participant.last_seen_at = new Date().toISOString(); if (!own) backend.participants.push(participant); backend.version++
    return { data: [{ ...run, session_id: run.id, participant_id: participant.id, callsign: participant.callsign, ready_scene_id: participant.ready_scene_id }], error: null }
  }
  if (name === 'set_mission_scene') {
    if (!run || role !== 'teacher' || run.status === 'completed') return fail('MISSION_FORBIDDEN')
    run.current_scene_id = args.p_scene_id; run.updated_at = new Date().toISOString(); backend.version++; return { data: [run], error: null }
  }
  if (name === 'reset_mission_readiness') {
    if (!run || role !== 'teacher' || run.status === 'completed') return fail('MISSION_FORBIDDEN')
    backend.participants.filter(item => item.session_id === run.id && item.ready_scene_id === args.p_scene_id).forEach(item => { item.ready_scene_id = null }); backend.version++; return { data: null, error: null }
  }
  if (name === 'update_mission_session') {
    if (!run || role !== 'teacher') return fail('MISSION_FORBIDDEN')
    if (run.status === 'completed') return fail('MISSION_COMPLETED')
    if (args.p_action === 'close_joining') run.joining_open = false
    if (args.p_action === 'open_joining') run.joining_open = true
    if (args.p_action === 'start') { run.status = 'active'; run.joining_open = false; run.started_at = new Date().toISOString() }
    if (args.p_action === 'pause') run.status = 'paused'
    if (args.p_action === 'resume') run.status = 'active'
    if (args.p_action === 'complete') { run.status = 'completed'; run.joining_open = false; run.completed_at = new Date().toISOString() }
    backend.version++; return { data: [run], error: null }
  }
  if (name === 'remove_disconnected_mission_participants') {
    if (!run || role !== 'teacher') return fail('MISSION_FORBIDDEN')
    const cutoff = Date.now() - 70_000; let removed = 0
    backend.participants.filter(item => item.session_id === run.id && item.status !== 'removed' && new Date(item.last_seen_at).getTime() < cutoff).forEach(item => { item.status = 'removed'; item.removed_at = new Date().toISOString(); item.ready_scene_id = null; removed++ })
    backend.version++; return { data: [{ removed_count: removed }], error: null }
  }
  if (name === 'remove_mission_participant') {
    const participant = backend.participants.find(item => item.id === args.p_participant_id)
    if (!participant || role !== 'teacher') return fail('PARTICIPANT_REMOVE_FORBIDDEN')
    participant.status = 'removed'; participant.removed_at = new Date().toISOString(); participant.ready_scene_id = null; backend.version++; return { data: null, error: null }
  }
  if (name === 'update_my_mission_presence') {
    const participant = backend.participants.find(item => item.session_id === args.p_session_id && item.userId === userId)
    if (run?.status === 'completed') return fail('MISSION_COMPLETED')
    if (!participant || participant.status === 'removed') return fail('PARTICIPANT_REMOVED')
    participant.status = args.p_connected ? 'connected' : 'disconnected'; participant.last_seen_at = new Date().toISOString()
    if (args.p_ready !== null) participant.ready_scene_id = args.p_ready ? run.current_scene_id : null
    backend.version++; return { data: null, error: null }
  }
  return fail('UNKNOWN')
}
async function install(context, role, userId) {
  await context.exposeFunction('__missionRpc', (name, args) => rpc(role, userId, name, args))
  await context.exposeFunction('__channelRemoved', () => { backend.removals[userId] = (backend.removals[userId] || 0) + 1 })
  await context.exposeFunction('__missionSnapshot', () => JSON.parse(JSON.stringify(backend)))
  await context.addInitScript(({ role, userId }) => {
    const listeners = new Set(); const teacher = { id: userId, email: 'teacher@example.test', is_anonymous: false, email_confirmed_at: '2026-01-01T00:00:00Z' }; const anonymous = { id: userId, is_anonymous: true }; let session = role === 'teacher' ? { user: teacher } : (localStorage.getItem('anonymous-session') ? { user: anonymous } : null)
    const makeQuery = table => { const filters = {}; let columns = ''; const q = { select(value) { columns = value; return q }, eq(key, value) { filters[key] = value; return q }, order() { return q }, then(resolve) { return window.__missionSnapshot().then(snapshot => { let data = table === 'mission_sessions' ? snapshot.runs : table === 'mission_participants' ? snapshot.participants : [{ id: 'board', state: {}, updated_at: new Date().toISOString() }]; data = data.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)); if (table === 'mission_participants') data = data.map(({ userId: ignored, ...row }) => row); resolve({ data, error: null, columns }) }) } }; return q }
    window.__LORE_SUPABASE__ = { auth: { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } } }, signInAnonymously: async () => { if (role === 'teacher') throw new Error('teacher session replaced'); session = { user: anonymous }; localStorage.setItem('anonymous-session', '1'); listeners.forEach(callback => callback('SIGNED_IN', session)); return { data: { session }, error: null } }, signOut: async () => ({ error: null }) }, rpc: (name, args) => window.__missionRpc(name, args), from: makeQuery, channel() { const handlers = []; let timer; let version = -1; return { on(event, filter, callback) { handlers.push({ filter, callback }); return this }, subscribe(callback) { callback('SUBSCRIBED'); timer = setInterval(async () => { const snapshot = await window.__missionSnapshot(); if (version >= 0 && snapshot.version !== version) handlers.forEach(({ filter, callback: handler }) => { const id = filter.filter?.split('eq.')[1]; const rows = filter.table === 'mission_sessions' ? snapshot.runs : snapshot.participants; const row = rows.find(item => item.id === id); if (row) handler({ new: row }) }); version = snapshot.version }, 100); this.__timer = timer; return this } } }, removeChannel(channel) { clearInterval(channel.__timer); window.__channelRemoved() } }
  }, { role, userId })
}
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const teacherContext = await browser.newContext(); const studentOneContext = await browser.newContext(); const studentTwoContext = await browser.newContext(); const newStudentContext = await browser.newContext()
await install(teacherContext, 'teacher', 'teacher'); await install(studentOneContext, 'student', 'student-1'); await install(studentTwoContext, 'student', 'student-2'); await install(newStudentContext, 'student', 'student-3')
try {
  const teacher = await teacherContext.newPage()
  await teacher.goto(baseUrl)
  await teacher.evaluate(() => { const selected={ view: 'mission', fundus: ['notruf-aus-dem-all'], activeStory: 'notruf-aus-dem-all', activeWorld: 'astra' }; localStorage.setItem('lore-state', JSON.stringify(selected)); localStorage.setItem('loreboard-state-v1', JSON.stringify({ activeStory: selected.activeStory, activeWorld: selected.activeWorld })) })
  await teacher.reload()
  await teacher.getByRole('button', { name: 'Mission vorbereiten' }).click()
  await teacher.getByText('ASTR001', { exact: true }).waitFor()
  await teacher.screenshot({ path: 'artifacts/astra-mission-lobby.png' })
  await teacher.getByRole('button', { name: 'QR-Code groß anzeigen' }).click()
  await teacher.getByRole('dialog', { name: 'QR-Code groß anzeigen' }).screenshot({ path: 'artifacts/astra-qr-large.png' })
  await teacher.getByRole('button', { name: 'QR-Code schließen' }).click()

  const joinUrl = `${baseUrl}/join/ASTR001`
  const studentOne = await studentOneContext.newPage(); await studentOne.goto(joinUrl)
  await studentOne.locator('.astra-student').waitFor()
  assert.equal(await studentOne.getByText('LORE ASTRA').isVisible(), true)
  await studentOne.getByRole('button', { name: 'Astrofuchs', exact: true }).click(); await studentOne.getByRole('button', { name: /Mit Astrofuchs/ }).click()
  await studentOne.getByText('Warte bitte').waitFor()

  teacher.once('dialog', dialog => dialog.accept()); await teacher.getByRole('button', { name: 'Mission starten' }).click()
  await teacher.getByText('Willkommen in der Crew-Akademie').waitFor()
  assert.equal(backend.runs[0].status, 'active')
  await studentOne.getByText('Willkommen in der Crew-Akademie').waitFor()


  // A stale participant remains manageable after mission start. Old-scene readiness must not count.
  backend.participants[0].status = 'disconnected'
  backend.participants[0].last_seen_at = new Date(Date.now() - 86_400_000).toISOString()
  backend.participants[0].ready_scene_id = 'navigation'
  backend.version++
  await teacher.getByText('Crew verwalten').click()
  const crewManager = teacher.locator('.crew-manager')
  await crewManager.getByText('Getrennt', { exact: true }).waitFor()
  assert.equal(await crewManager.getByText('Nicht bereit', { exact: true }).isVisible(), true)
  teacher.once('dialog', dialog => dialog.accept())
  await crewManager.getByRole('button', { name: /Entfernen/, exact: true }).click()
  await studentOne.getByText('Zugang nicht möglich').waitFor()
  await teacher.locator('.astra-story>header').getByText('0 Crewmitglieder', { exact: true }).waitFor()
  await crewManager.locator('summary').click()

  // Access control is independent and allows a fresh anonymous device into the active scene.
  assert.equal(await teacher.getByText('Zugang geschlossen', { exact: true }).isVisible(), true)
  await teacher.getByRole('button', { name: 'Zugang öffnen', exact: true }).click()
  await teacher.getByText('Zugang geöffnet', { exact: true }).waitFor()
  const studentTwo = await newStudentContext.newPage(); await studentTwo.goto(joinUrl)
  assert.equal(await studentTwo.getByRole('button', { name: 'Astrofuchs', exact: true }).isEnabled(), true)
  await studentTwo.getByRole('button', { name: 'Astrofuchs', exact: true }).click()
  assert.equal(await studentTwo.getByRole('button', { name: /Mit Astrofuchs/ }).isEnabled(), true)
  await studentTwo.getByRole('button', { name: /Mit Astrofuchs/ }).click()
  await studentTwo.getByText('Willkommen in der Crew-Akademie').waitFor()
  assert.equal(await studentTwo.getByText('Zugang geöffnet', { exact: true }).isVisible(), true)
  await teacher.locator('.astra-story>header').getByText('1 Crewmitglied', { exact: true }).waitFor()
  await teacher.getByRole('button', { name: /Alle Geräte pausieren/ }).click()
  await studentTwo.getByText('Übertragung pausiert').waitFor()
  assert.equal(backend.runs[0].joining_open, true)
  assert.equal(await teacher.getByText('Zugang geöffnet', { exact: true }).isVisible(), true)
  await teacher.getByRole('button', { name: 'Zugang schließen', exact: true }).click()
  assert.equal(backend.runs[0].status, 'paused')
  assert.equal(backend.runs[0].joining_open, false)
  await teacher.getByRole('button', { name: /Geräte fortsetzen/ }).click()
  await studentTwo.getByText('Willkommen in der Crew-Akademie').waitFor()
  assert.equal(backend.runs[0].joining_open, false)
  await studentTwo.getByText('Zugang geschlossen', { exact: true }).waitFor()

  assert.equal(await teacher.getByText('10:00', { exact: true }).isVisible(), true)
  await teacher.getByRole('button', { name: 'Eine Minute abziehen' }).click(); await teacher.getByText('09:00', { exact: true }).waitFor()
  await teacher.locator('.scene-timer').getByRole('button', { name: 'Start', exact: true }).click(); await teacher.waitForTimeout(2100)
  assert.notEqual(await teacher.locator('.scene-timer strong').textContent(), '09:00')
  await teacher.locator('.scene-timer').getByRole('button', { name: 'Pause', exact: true }).click()
  await teacher.locator('.scene-timer').getByRole('button', { name: 'Fortsetzen', exact: true }).click()
  await teacher.getByRole('button', { name: 'Szenentimer zurücksetzen' }).click(); await teacher.getByText('09:00', { exact: true }).waitFor()

  await teacher.locator('.scene-actions').getByRole('button', { name: /Zur Erinnerungsübertragung/ }).click()
  await teacher.getByRole('heading', { name: 'Das Echo der Erinnerungen', exact: true }).waitFor(); await studentTwo.getByText('Das Echo der Erinnerungen').waitFor()
  await teacher.getByRole('button', { name: 'NOVA-Erinnerungsrad' }).click(); await teacher.getByRole('dialog').waitFor(); await teacher.getByRole('button', { name: 'Erinnerungsrad schließen' }).click()
  await teacher.locator('.scene-actions').getByRole('button', { name: /Signalfragmente sichern/ }).click()
  await studentTwo.getByText('Wer gehört zur Crew?').waitFor(); await studentTwo.getByRole('button', { name: 'Ich bin bereit' }).click(); await teacher.getByText('Vollständig', { exact: true }).waitFor()
  await teacher.getByRole('button', { name: /Bereitschaft zurücksetzen/ }).click(); await studentTwo.getByRole('button', { name: 'Ich bin bereit' }).waitFor()
  await teacher.getByRole('button', { name: /Alle Geräte pausieren/ }).click(); await studentTwo.getByText('Übertragung pausiert').waitFor()
  await teacher.getByRole('button', { name: /Geräte fortsetzen/ }).click(); await studentTwo.getByText('Wer gehört zur Crew?').waitFor()
  await teacher.locator('.scene-actions').getByRole('button', { name: 'Zurück' }).click(); await teacher.getByRole('heading', { name: 'Das Echo der Erinnerungen', exact: true }).waitFor()
  await teacher.locator('.scene-actions').getByRole('button', { name: /Signalfragmente sichern/ }).click()

  for (const actionName of ['Crew-Check abschließen','Flugplan bestätigen','Archiv schließen','Module ausgeben','Ausrüstung bestätigen']) {
    await teacher.locator('.scene-actions').getByRole('button', { name: new RegExp(actionName) }).click()
  }
  await teacher.getByRole('heading', { name: 'Die Reise beginnt', exact: true }).waitFor(); await studentTwo.getByText('Die Reise beginnt').waitFor()
  assert.equal(await teacher.getByText('Crew verwalten').isVisible(), true)
  await teacher.getByText('Crew verwalten').click(); assert.equal(await teacher.locator('.crew-manager').getByText('Astrofuchs', { exact: true }).isVisible(), true)
  for (const viewport of [{width:1920,height:1080},{width:1440,height:1000},{width:1024,height:1366}]) {
    await teacher.setViewportSize(viewport); await teacher.screenshot({ path: `artifacts/astra-runtime-${viewport.width}x${viewport.height}.png` }); assert.equal(await teacher.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true)
  }
  await teacher.locator('.crew-manager summary').click()
  await teacher.screenshot({ path: 'artifacts/astra-mission-nova.png' })
  await teacher.locator('.scene-actions').getByRole('button', { name: /Countdown starten/ }).click()
  await teacher.getByText('10', { exact: true }).waitFor(); await teacher.getByText('0', { exact: true }).waitFor({ timeout: 13000 })
  await teacher.locator('.media-fallback').waitFor({ timeout: 5000 })
  await teacher.getByRole('button', { name: 'Startübertragung abschließen' }).click(); await teacher.locator('.astra-finale').getByText('Fortsetzung folgt').waitFor()

  await teacher.getByRole('button', { name: /Zurück zum Loreboard/ }).click(); await teacher.getByText('LOREBOARD').waitFor(); assert.equal(backend.runs[0].status, 'active')
  await teacher.getByRole('button', { name: 'Mission vorbereiten' }).click(); await teacher.locator('.astra-finale').getByText('Fortsetzung folgt').waitFor()
  await teacher.reload(); await teacher.locator('.astra-finale').getByText('Fortsetzung folgt').waitFor()
  teacher.once('dialog', dialog => dialog.accept()); await teacher.getByRole('button', { name: 'Mission endgültig abschließen' }).click()
  await studentTwo.getByText('Mission abgeschlossen').waitFor(); assert.equal(backend.runs[0].status, 'completed')
  await studentTwo.reload(); await studentTwo.getByText('Mission abgeschlossen').waitFor()
  console.log('Stage 2 mission E2E with isolated teacher/student contexts passed.')
} finally { await teacherContext.close(); await studentOneContext.close(); await studentTwoContext.close(); await newStudentContext.close(); await browser.close() }
