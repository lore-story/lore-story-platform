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

async function assertAstraTypography(page, rootSelector, headingSelector) {
  const typography = await page.evaluate(({ rootSelector, headingSelector }) => {
    const root = document.querySelector(rootSelector)
    const heading = document.querySelector(headingSelector)
    const forbidden = [...root.querySelectorAll('*')].filter(element => /Playfair Display|Georgia/i.test(getComputedStyle(element).fontFamily))
    return { rootFamily: getComputedStyle(root).fontFamily, headingWeight: Number(getComputedStyle(heading).fontWeight), forbiddenCount: forbidden.length, interLoaded: document.fonts.check('500 16px Inter') && document.fonts.check('900 16px Inter') }
  }, { rootSelector, headingSelector })
  assert.match(typography.rootFamily, /Inter/i)
  assert.ok(typography.headingWeight >= 800)
  assert.equal(typography.forbiddenCount, 0)
  assert.equal(typography.interLoaded, true)
}


async function installSupabaseMock(page) {
  await page.addInitScript(() => {
    const listeners = new Set()
    window.__e2eCloudUpdates = 0
    const user = { id: 'e2e-user', email: 'teacher@example.test', is_anonymous: false, email_confirmed_at: '2026-01-01T00:00:00Z' }
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
  assert.equal(await desktop.locator('.profile>span').innerText(), 'TE')
  assert.equal(await desktop.locator('.avatar').count(), 0)
  await desktop.screenshot({ path: 'artifacts/overview-desktop.png', fullPage: true })

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
  assert.equal(await fundusStory.getByRole('button', { name: 'Im Loreboard aktivieren' }).isEnabled(), true)
  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Übersicht', exact: true }).click()
  assert.match(await desktop.locator('.active-banner h2').innerText(), /Moosarchiv/)

  await desktop.getByRole('button', { name: 'Loreboard öffnen' }).click()
  await desktop.getByText('TAGESROUTE').waitFor()
  assert.equal(await desktop.getByTestId('astra-hamster-assignment-media').count(), 0)
  assert.equal(await desktop.locator('.platform > aside').count(), 0)
  assert.equal(await desktop.getByRole('button', { name: /Lernjournal/ }).count(), 0)
  assert.deepEqual(await desktop.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
  await desktop.getByRole('button', { name: 'Entdecken' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.reload({ waitUntil: 'networkidle' })
  assert.equal(await desktop.locator('.loreboard-brand b').innerText(), 'Nebelmark')
  assert.equal(await desktop.locator('.loreboard-brand').getByText('Entdecken', { exact: true }).count(), 0)
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
  const assignment = `Erkundungsauftrag ${Date.now()}\nBeobachtet die Spuren.\n\nHaltet eure Ergebnisse fest.`
  await desktop.getByRole('button', { name: 'Auftrag bearbeiten' }).click()
  await desktop.getByLabel('Aktueller Auftrag bearbeiten').fill(assignment)
  await desktop.getByRole('button', { name: 'Auftrag speichern' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  assert.equal(await desktop.evaluate(() => JSON.parse(localStorage.getItem('loreboard-state-v1')).assignment), assignment)
  await desktop.reload({ waitUntil: 'networkidle' })
  assert.equal(await desktop.locator('.assignment-display').innerText(), assignment)
  await desktop.getByRole('button', { name: 'Auftrag bearbeiten' }).click()
  await desktop.getByLabel('Aktueller Auftrag bearbeiten').fill(Array.from({ length: 9 }, (_, index) => `Zeile ${index + 1}`).join('\n'))
  await desktop.getByText(/Der Auftrag ist zu lang für die Präsentationskarte/).waitFor()
  assert.equal(await desktop.getByRole('button', { name: 'Auftrag speichern' }).isDisabled(), true)
  await desktop.getByRole('button', { name: 'Abbrechen' }).click()
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
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  const updatesAfterResume = await desktop.evaluate(() => window.__e2eCloudUpdates)
  await desktop.getByRole('button', { name: 'Zurücksetzen' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  assert.equal(await desktop.evaluate(() => window.__e2eCloudUpdates), updatesAfterResume + 1)
  assert.match(await desktop.locator('.timer-widget > strong').innerText(), /00:05/)
  await desktop.getByRole('button', { name: /Timer-Einstellungen/ }).click()
  await desktop.getByLabel('Timer Sekunden').fill('1')
  await desktop.getByRole('button', { name: 'Timer übernehmen' }).click()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  await desktop.getByRole('button', { name: 'Starten', exact: true }).click()
  await desktop.getByText('Zeit ist um').waitFor()
  await desktop.getByText('Online gespeichert', { exact: true }).waitFor()
  const updatesAfterExpiry = await desktop.evaluate(() => window.__e2eCloudUpdates)
  await desktop.waitForTimeout(1200)
  assert.equal(await desktop.evaluate(() => window.__e2eCloudUpdates), updatesAfterExpiry)
  assert.equal(await desktop.getByLabel('Aktive Lorestory').count(), 0)
  await desktop.getByRole('button', { name: 'Andere Mission auswählen' }).click()
  await desktop.getByRole('dialog', { name: 'Mission auswählen' }).getByText('Das Flüstern des Moosarchivs').click()
  assert.equal(await desktop.getByRole('button', { name: 'Story-Vorschau öffnen' }).count(), 0)
  assert.equal(await desktop.getByText('Storymodus noch nicht angebunden').count(), 0)
  await desktop.screenshot({ path: 'artifacts/loreboard-desktop.png', fullPage: true })
  await desktop.getByRole('button', { name: /Zur Übersicht/ }).click()
  await desktop.getByRole('heading', { name: 'Deine Übersicht' }).waitFor()

  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  assert.match(await desktop.locator('.editor-card input').inputValue(), /Moosarchiv/)
  await desktop.getByRole('button', { name: 'Änderungen speichern' }).click()
  await desktop.getByText('Deine Änderungen wurden lokal gespeichert').waitFor()
  await desktop.screenshot({ path: 'artifacts/workshop-desktop.png', fullPage: true })

  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Weltwechsler', exact: true }).click()
  await desktop.getByRole('button', { name: /Astra/ }).click()
  assert.equal(await desktop.evaluate(() => JSON.parse(localStorage.getItem('e2e-cloud-row')).state.activeWorld), 'nebelmark')
  await desktop.getByRole('button', { name: 'Weltwechsel anwenden' }).click()
  const astraAccountRow = await desktop.evaluate(() => localStorage.getItem('e2e-cloud-row'))
  await desktop.getByText('Astra als aktive Welt gespeichert').waitFor()
  assert.equal(JSON.parse(astraAccountRow).state.activeWorld, 'astra')
  const switchedState = await desktop.evaluate(() => JSON.parse(localStorage.getItem('e2e-cloud-row')).state)
  assert.equal(switchedState.activeStory, 'moosarchiv')
  assert.equal(switchedState.presentationWorldId, 'astra')
  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Übersicht', exact: true }).click()
  await desktop.screenshot({ path: 'artifacts/overview-world-astra.png', fullPage: true })
  for (const [id, name] of [['nebelmark','Nebelmark'],['aether','Aetherion'],['tiefsee','Pelagia']]) {
    await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Weltwechsler', exact: true }).click()
    await desktop.getByRole('button', { name: new RegExp(name) }).click()
    await desktop.getByRole('button', { name: 'Weltwechsel anwenden' }).click()
    await desktop.getByText(`${name} als aktive Welt gespeichert`).waitFor()
    await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Übersicht', exact: true }).click()
    assert.equal(await desktop.locator(`.platform.world-${id}`).count(), 1)
    await desktop.screenshot({ path: `artifacts/overview-world-${id}.png`, fullPage: true })
    await desktop.reload({ waitUntil: 'networkidle' })
    assert.equal(await desktop.locator(`.platform.world-${id}`).count(), 1)
  }
  await desktop.locator('.profile').click()
  assert.equal(await desktop.getByRole('menuitem', { name: 'Abmelden' }).isVisible(), true)
  await desktop.getByRole('menuitem', { name: 'Abmelden' }).click()
  await desktop.getByRole('heading', { name: /Lernen wird/ }).waitFor()

  const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  projector.setDefaultTimeout(8_000)
  await projector.route('**/astronaut-hamster-airlock.webp', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#17617b"/><circle cx="600" cy="360" r="230" fill="#7cecff"/></svg>' }))
  await installSupabaseMock(projector)
  await projector.goto(baseUrl, { waitUntil: 'networkidle' })
  await projector.evaluate(row => { localStorage.setItem('e2e-cloud-row',row); localStorage.setItem('e2e-session','1'); localStorage.setItem('lore-state',JSON.stringify({view:'loreboard',fundus:['moosarchiv'],activeStory:'moosarchiv',activeWorld:'nebelmark'})) }, astraAccountRow)
  await projector.reload({ waitUntil: 'networkidle' })
  await projector.getByText('TAGESROUTE').waitFor()
  assert.equal(await projector.locator('.loreboard-mode.world-astra').count(), 1)
  assert.match(await projector.locator('.loreboard-brand').innerText(), /Astra/i)
  assert.equal(await projector.getByText(/Freie Mission · Biologie/, { exact: true }).count(), 1)
  assert.equal(await projector.getByText('Aktuell in Astra inszeniert', { exact: true }).count(), 0)
  assert.equal(await projector.getByText('Astra-Mission', { exact: true }).count(), 0)
  await assertAstraTypography(projector, '.loreboard-mode.world-astra', '.route-heading h2')
  assert.equal(await projector.getByText('Mission in dieser Welt noch nicht umgesetzt', { exact: true }).count(), 0)
  assert.deepEqual(await projector.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
  assert.ok(await projector.locator('.assignment-widget').isVisible())
  const hamsterMedia = projector.getByTestId('astra-hamster-assignment-media')
  assert.equal(await hamsterMedia.isVisible(), true)
  const hamsterState = await hamsterMedia.evaluate(async element => {
    const backgroundImage = getComputedStyle(element).backgroundImage
    const url = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
    const image = new Image()
    image.src = url
    await image.decode()
    return { backgroundImage, width: image.naturalWidth, height: image.naturalHeight, elementWidth: element.getBoundingClientRect().width, elementHeight: element.getBoundingClientRect().height }
  })
  assert.match(hamsterState.backgroundImage, /astronaut-hamster-airlock\.webp/)
  assert.ok(hamsterState.width > 0 && hamsterState.height > 0 && hamsterState.elementWidth > 0 && hamsterState.elementHeight > 0)
  assert.ok(await projector.locator('.timer-widget').isVisible())
  assert.ok(await projector.locator('.materials-widget').isVisible())
  const presentationAssignment = Array.from({ length: 8 }, (_, index) => `${index + 1}. Prüft die Hinweise.`).join('\n')
  await projector.getByRole('button', { name: 'Auftrag bearbeiten' }).click()
  await projector.getByLabel('Aktueller Auftrag bearbeiten').fill(presentationAssignment)
  await projector.getByRole('button', { name: 'Auftrag speichern' }).click()
  await projector.getByText('Online gespeichert', { exact: true }).waitFor()
  await projector.reload({ waitUntil: 'networkidle' })
  assert.equal(await projector.locator('.assignment-display').innerText(), presentationAssignment)
  for (const viewport of [{width:1920,height:1080},{width:1440,height:1000},{width:1024,height:1366},{width:1366,height:768},{width:1180,height:820}]) {
    await projector.setViewportSize(viewport)
    assert.deepEqual(await projector.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight })), { x: true, y: true })
    const layout = await projector.evaluate(() => {
      const card = document.querySelector('.assignment-card')
      const stage = document.querySelector('.astra-assignment-stage')
      const assignment = document.querySelector('.assignment-display')
      const assignmentLabel = document.querySelector('.assignment-card .widget-title span')
      const materialLabel = document.querySelector('.materials-widget .widget-title span')
      const materialEntry = document.querySelector('.material-list li')
      const media = document.querySelector('.assignment-media')
      return {
        cardRatio: card.getBoundingClientRect().height / stage.getBoundingClientRect().height,
        assignmentFontSize: parseFloat(getComputedStyle(assignment).fontSize),
        assignmentOverflow: assignment.scrollHeight > assignment.clientHeight || assignment.scrollWidth > assignment.clientWidth,
        cardOverflow: card.scrollHeight > card.clientHeight || card.scrollWidth > card.clientWidth,
        assignmentLabelSize: parseFloat(getComputedStyle(assignmentLabel).fontSize),
        materialLabelSize: parseFloat(getComputedStyle(materialLabel).fontSize),
        materialEntrySize: parseFloat(getComputedStyle(materialEntry).fontSize),
        assignmentOverflowY: getComputedStyle(assignment).overflowY,
        mediaBackgroundSize: getComputedStyle(media).backgroundSize,
      }
    })
    assert.ok(layout.assignmentLabelSize >= 14 && layout.materialLabelSize >= 14)
    assert.ok(layout.materialEntrySize >= 14)
    assert.ok(layout.assignmentFontSize <= 24)
    assert.equal(layout.assignmentOverflow, false)
    assert.equal(layout.cardOverflow, false)
    assert.notEqual(layout.assignmentOverflowY, 'auto')
    assert.notEqual(layout.assignmentOverflowY, 'scroll')
    assert.equal(layout.mediaBackgroundSize, 'contain')
    assert.ok(layout.cardRatio <= 0.51)
    await projector.screenshot({ path: `artifacts/loreboard-${viewport.width}x${viewport.height}.png` })
  }

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
