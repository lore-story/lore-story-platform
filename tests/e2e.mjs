import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import chromiumBinary from '@sparticuz/chromium'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'
const executablePath = await chromiumBinary.executablePath()
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})


async function installSupabaseMock(page) {
  await page.addInitScript(() => {
    const listeners = new Set()
    window.__e2eCloudUpdates = 0
    const user = { id: 'e2e-user', email: 'teacher@example.test' }
    let session = localStorage.getItem('e2e-session') ? { user, access_token: 'mock' } : null
    const notify = event => listeners.forEach(listener => listener(event, session))
    const query = operation => {
      const q = { filters: {}, payload: null, select() { return q }, eq(k,v) { q.filters[k]=v; return q }, order() { return q }, limit() { return q }, insert(v) { q.payload=v; operation='insert'; return q }, update(v) { q.payload=v; operation='update'; return q }, async maybeSingle() { return run() }, async single() { return run() }, then(resolve,reject) { return run().then(resolve,reject) } }
      async function run() {
        let row = JSON.parse(localStorage.getItem('e2e-cloud-row') || 'null')
        if (operation === 'select') return { data: row, error: null }
        if (operation === 'insert') { row={ id:'board-1', state:q.payload.state, updated_at:new Date().toISOString() }; localStorage.setItem('e2e-cloud-row',JSON.stringify(row)); return {data:row,error:null} }
        if (!row || (q.filters.updated_at && q.filters.updated_at !== row.updated_at)) return {data:null,error:null}
        window.__e2eCloudUpdates += 1
        row={...row,state:q.payload.state,updated_at:new Date(Date.now()+1).toISOString()};localStorage.setItem('e2e-cloud-row',JSON.stringify(row));return {data:{updated_at:row.updated_at},error:null}
      }
      return q
    }
    window.__LORE_SUPABASE__ = {
      auth: {
        async getSession() { return { data: { session }, error: null } },
        onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } } },
        async signInWithPassword({email,password}) { if(email!=='teacher@example.test'||password!=='secret12') return {data:{session:null},error:{message:'Invalid login credentials'}};session={user,access_token:'mock'};localStorage.setItem('e2e-session','1');notify('SIGNED_IN');return {data:{session},error:null} },
        async signUp() { return {data:{session:null,user},error:null} },
        async signOut() { session=null;localStorage.removeItem('e2e-session');notify('SIGNED_OUT');return {error:null} },
      },
      from() { return query('select') },
    }
  })
}

async function login(page) {
  await page.getByRole('button', { name: 'Einloggen', exact: true }).click()
  await page.getByLabel('E-Mail-Adresse').fill('teacher@example.test')
  await page.getByLabel('Passwort').fill('secret12')
  await page.locator('.login-modal .btn.dark').click()
  await page.getByRole('heading', { name: 'Deine Übersicht' }).waitFor()
}

await mkdir('artifacts', { recursive: true })

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  desktop.setDefaultTimeout(8_000)
  await installSupabaseMock(desktop)
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
  await desktop.screenshot({ path: 'artifacts/landing-desktop.png', fullPage: true })
  await login(desktop)

  const destinations = [
    ['Werkstatt', 'Werkstatt'],
    ['Fundus', 'Fundus'],
    ['Lore-Market', 'Lore-Market'],
    ['Weltwechsler', 'Weltwechsler'],
    ['Übersicht', 'Deine Übersicht'],
  ]
  for (const [navigation, heading] of destinations) {
    await desktop.locator('.platform > aside nav').getByRole('button').filter({ hasText: navigation }).click()
    await desktop.getByRole('heading', { name: heading, exact: true }).waitFor()
  }

  await desktop.locator('.platform > aside nav').getByRole('button').filter({ hasText: 'Lore-Market' }).click()
  const marketStory = desktop.locator('.story-card').filter({ hasText: 'Die Kartografin der Sternenuhr' })
  await marketStory.getByRole('button', { name: 'Zum Fundus' }).click()
  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Fundus', exact: true }).click()
  const fundusStory = desktop.locator('.story-card').filter({ hasText: 'Die Kartografin der Sternenuhr' })
  await fundusStory.getByRole('button', { name: 'Im Loreboard aktivieren' }).click()
  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Übersicht', exact: true }).click()
  assert.match(await desktop.locator('.active-banner h2').innerText(), /Sternenuhr/)

  await desktop.getByRole('button', { name: 'Loreboard öffnen' }).click()
  await desktop.getByText('TAGESROUTE').waitFor()
  assert.equal(await desktop.locator('.platform > aside').count(), 0)
  assert.equal(await desktop.getByRole('button', { name: /Lernjournal/ }).count(), 0)
  assert.deepEqual(await desktop.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
  await desktop.getByRole('button', { name: 'Entdecken' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.reload({ waitUntil: 'networkidle' })
  assert.match(await desktop.locator('.loreboard-brand b').innerText(), /Entdecken/)
  assert.equal(await desktop.getByRole('button', { name: 'Entdecken' }).getAttribute('aria-pressed'), 'true')

  await desktop.getByRole('button', { name: 'Material bearbeiten' }).click()
  await desktop.getByLabel('Material 1').fill('Notizheft und Bleistift')
  await desktop.getByRole('button', { name: 'Forscherkarten nach unten' }).click()
  await desktop.getByRole('button', { name: 'Material hinzufügen' }).click()
  await desktop.getByLabel('Material 4').fill('Lupe')
  await desktop.getByRole('button', { name: 'Speichern', exact: true }).click()
  assert.deepEqual(await desktop.locator('.material-list li').allTextContents(), ['Notizheft und Bleistift', 'Tablet oder Buch', 'Forscherkarten', 'Lupe'])
  assert.equal(await desktop.locator('.material-input').count(), 0)
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.reload({ waitUntil: 'networkidle' })
  assert.deepEqual(await desktop.locator('.material-list li').allTextContents(), ['Notizheft und Bleistift', 'Tablet oder Buch', 'Forscherkarten', 'Lupe'])
  await desktop.getByRole('button', { name: 'Material bearbeiten' }).click()
  for (let index = 5; index <= 8; index += 1) {
    await desktop.getByRole('button', { name: 'Material hinzufügen' }).click()
    await desktop.getByLabel(`Material ${index}`, { exact: true }).fill(`Material ${index}`)
  }
  assert.equal(await desktop.getByRole('button', { name: 'Material hinzufügen' }).isDisabled(), true)
  await desktop.getByText('Maximal acht Materialien sind möglich.').waitFor()
  await desktop.getByRole('button', { name: 'Speichern', exact: true }).click()
  assert.equal(await desktop.locator('.material-list li').count(), 8)
  assert.equal(await desktop.locator('.material-list button').count(), 0)
  const assignment = `Erkundungsauftrag ${Date.now()}`
  await desktop.getByRole('button', { name: 'Auftrag bearbeiten' }).click()
  await desktop.getByLabel('Aktueller Auftrag bearbeiten').fill(assignment)
  await desktop.getByRole('button', { name: 'Auftrag speichern' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  assert.match(await desktop.evaluate(() => localStorage.getItem('loreboard-state-v1')), new RegExp(assignment))
  await desktop.getByRole('button', { name: 'Tagesroute bearbeiten' }).click()
  await desktop.getByLabel('Routenpunkt 2', { exact: true }).fill('Gemeinsam entdecken')
  await desktop.getByRole('button', { name: 'Speichern', exact: true }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  assert.match(await desktop.evaluate(() => localStorage.getItem('loreboard-state-v1')), /Gemeinsam entdecken/)
  await desktop.getByRole('button', { name: /Timer-Einstellungen/ }).click()
  await desktop.getByLabel('Timer Minuten').fill('0')
  await desktop.getByLabel('Timer Sekunden').fill('5')
  await desktop.getByRole('button', { name: 'Timer übernehmen' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.getByRole('button', { name: 'Starten', exact: true }).click()
  await desktop.getByText('Timer läuft').waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  const updatesAfterStart = await desktop.evaluate(() => window.__e2eCloudUpdates)
  const initialDisplay = await desktop.locator('.timer-widget > strong').innerText()
  await desktop.waitForTimeout(2100)
  assert.notEqual(await desktop.locator('.timer-widget > strong').innerText(), initialDisplay)
  assert.equal(await desktop.evaluate(() => window.__e2eCloudUpdates), updatesAfterStart)
  assert.equal(await desktop.locator('.save-status').innerText(), 'Online gespeichert')
  await desktop.reload({ waitUntil: 'networkidle' })
  await desktop.getByText('Timer läuft').waitFor()
  assert.ok(Number((await desktop.locator('.timer-widget > strong').innerText()).split(':')[1]) <= 4)
  await desktop.getByRole('button', { name: 'Pausieren' }).click()
  const pausedTime = await desktop.locator('.timer-widget > strong').innerText()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.reload({ waitUntil: 'networkidle' })
  await desktop.getByText('Pausiert').waitFor()
  await desktop.waitForTimeout(1100)
  assert.equal(await desktop.locator('.timer-widget > strong').innerText(), pausedTime)
  await desktop.getByRole('button', { name: 'Fortsetzen' }).click()
  await desktop.getByText('Speichert …', { exact: true }).waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  const updatesAfterResume = await desktop.evaluate(() => window.__e2eCloudUpdates)
  await desktop.getByRole('button', { name: 'Zurücksetzen' }).click()
  await desktop.getByText('Speichert …', { exact: true }).waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  assert.equal(await desktop.evaluate(() => window.__e2eCloudUpdates), updatesAfterResume + 1)
  assert.match(await desktop.locator('.timer-widget > strong').innerText(), /00:05/)
  await desktop.getByRole('button', { name: /Timer-Einstellungen/ }).click()
  await desktop.getByLabel('Timer Sekunden').fill('1')
  await desktop.getByRole('button', { name: 'Timer übernehmen' }).click()
  await desktop.getByText('Speichert …', { exact: true }).waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.getByRole('button', { name: 'Starten', exact: true }).click()
  await desktop.getByText('Zeit ist um').waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  const updatesAfterExpiry = await desktop.evaluate(() => window.__e2eCloudUpdates)
  await desktop.waitForTimeout(1200)
  assert.equal(await desktop.evaluate(() => window.__e2eCloudUpdates), updatesAfterExpiry)
  await desktop.getByLabel('Aktive Lorestory').selectOption('moosarchiv')
  assert.equal(await desktop.getByLabel('Aktive Lorestory').inputValue(), 'moosarchiv')
  await desktop.getByRole('button', { name: 'Storymodus öffnen' }).click()
  await desktop.getByText('Storymodus noch nicht angebunden').waitFor()
  await desktop.screenshot({ path: 'artifacts/loreboard-desktop.png', fullPage: true })
  await desktop.getByRole('button', { name: /Zur Übersicht/ }).click()
  await desktop.getByRole('heading', { name: 'Deine Übersicht' }).waitFor()

  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  assert.match(await desktop.locator('.editor-card input').inputValue(), /Moosarchiv/)
  await desktop.getByRole('button', { name: 'Änderungen speichern' }).click()
  await desktop.getByText('Deine Änderungen wurden lokal gespeichert').waitFor()
  await desktop.screenshot({ path: 'artifacts/workshop-desktop.png', fullPage: true })

  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Weltwechsler', exact: true }).click()
  await desktop.getByRole('button', { name: /Aetherion/ }).click()
  await desktop.getByRole('button', { name: 'Weltwechsel anwenden' }).click()
  await desktop.getByText('Story erfolgreich nach Aetherion übertragen').waitFor()
  await desktop.locator('.profile').click()
  await desktop.getByRole('heading', { name: /Lernen wird/ }).waitFor()

  const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  projector.setDefaultTimeout(8_000)
  await installSupabaseMock(projector)
  await projector.goto(baseUrl, { waitUntil: 'networkidle' })
  await projector.evaluate(() => { localStorage.setItem('e2e-session', '1'); localStorage.setItem('lore-state', JSON.stringify({ view: 'loreboard', fundus: ['moosarchiv'], activeStory: 'moosarchiv', activeWorld: 'nebelmark' })) })
  await projector.reload({ waitUntil: 'networkidle' })
  await projector.getByText('TAGESROUTE').waitFor()
  assert.deepEqual(await projector.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
  assert.ok(await projector.locator('.assignment-widget').isVisible())
  assert.ok(await projector.locator('.timer-widget').isVisible())
  assert.ok(await projector.locator('.materials-widget').isVisible())
  await projector.screenshot({ path: 'artifacts/loreboard-projector.png', fullPage: true })

  const ipad = await browser.newPage({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1 })
  ipad.setDefaultTimeout(8_000)
  await installSupabaseMock(ipad)
  await ipad.goto(baseUrl, { waitUntil: 'networkidle' })
  await ipad.evaluate(() => localStorage.clear())
  await ipad.reload({ waitUntil: 'networkidle' })
  await ipad.screenshot({ path: 'artifacts/landing-ipad.png', fullPage: true })
  await login(ipad)
  await ipad.locator('.platform > aside nav').getByRole('button', { name: 'Loreboard', exact: true }).click()
  await ipad.getByText('TAGESROUTE').waitFor()
  assert.deepEqual(await ipad.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
  await ipad.screenshot({ path: 'artifacts/loreboard-ipad.png', fullPage: true })
  await ipad.getByRole('button', { name: /Zur Übersicht/ }).click()
  await ipad.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  await ipad.getByRole('heading', { name: 'Werkstatt', exact: true }).waitFor()
  await ipad.screenshot({ path: 'artifacts/workshop-ipad.png', fullPage: true })

  console.log('Loreboard persistence and layouts at 1920x1080, 1440x1000, and 1024x1366 passed.')
} finally {
  await browser.close()
}
