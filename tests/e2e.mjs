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

async function login(page) {
  await page.getByRole('button', { name: 'Einloggen', exact: true }).click()
  await page.locator('.login-modal .btn.dark').click()
  await page.getByRole('heading', { name: 'Deine Übersicht' }).waitFor()
}

await mkdir('artifacts', { recursive: true })

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  desktop.setDefaultTimeout(8_000)
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
  await desktop.getByRole('button', { name: 'Entdecken' }).click()
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
  await desktop.reload({ waitUntil: 'networkidle' })
  assert.deepEqual(await desktop.locator('.material-list li').allTextContents(), ['Notizheft und Bleistift', 'Tablet oder Buch', 'Forscherkarten', 'Lupe'])
  const assignment = `Erkundungsauftrag ${Date.now()}`
  await desktop.getByRole('button', { name: 'Auftrag bearbeiten' }).click()
  await desktop.getByLabel('Aktueller Auftrag bearbeiten').fill(assignment)
  await desktop.getByRole('button', { name: 'Auftrag speichern' }).click()
  assert.equal(await desktop.evaluate(() => localStorage.getItem('lore-assignment')), assignment)
  await desktop.getByRole('button', { name: 'Tagesroute bearbeiten' }).click()
  await desktop.getByLabel('Routenpunkt 2', { exact: true }).fill('Gemeinsam entdecken')
  await desktop.getByRole('button', { name: 'Speichern', exact: true }).click()
  assert.match(await desktop.evaluate(() => localStorage.getItem('lore-route')), /Gemeinsam entdecken/)
  await desktop.getByRole('button', { name: /Timer-Einstellungen/ }).click()
  await desktop.getByLabel('Timer Minuten').fill('0')
  await desktop.getByLabel('Timer Sekunden').fill('5')
  await desktop.getByRole('button', { name: 'Timer übernehmen' }).click()
  await desktop.getByRole('button', { name: 'Starten', exact: true }).click()
  await desktop.getByText('Timer läuft').waitFor()
  await desktop.waitForTimeout(1200)
  await desktop.reload({ waitUntil: 'networkidle' })
  await desktop.getByText('Timer läuft').waitFor()
  assert.ok(Number((await desktop.locator('.timer-widget > strong').innerText()).split(':')[1]) <= 4)
  await desktop.getByRole('button', { name: 'Pausieren' }).click()
  const pausedTime = await desktop.locator('.timer-widget > strong').innerText()
  await desktop.reload({ waitUntil: 'networkidle' })
  await desktop.getByText('Pausiert').waitFor()
  await desktop.waitForTimeout(1100)
  assert.equal(await desktop.locator('.timer-widget > strong').innerText(), pausedTime)
  await desktop.getByRole('button', { name: 'Fortsetzen' }).click()
  await desktop.getByRole('button', { name: 'Zurücksetzen' }).click()
  assert.match(await desktop.locator('.timer-widget > strong').innerText(), /00:05/)
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
  await projector.goto(baseUrl, { waitUntil: 'networkidle' })
  await projector.evaluate(() => localStorage.setItem('lore-state', JSON.stringify({ loggedIn: true, view: 'loreboard', fundus: ['moosarchiv'], activeStory: 'moosarchiv', activeWorld: 'nebelmark' })))
  await projector.reload({ waitUntil: 'networkidle' })
  await projector.getByText('TAGESROUTE').waitFor()
  await projector.screenshot({ path: 'artifacts/loreboard-projector.png', fullPage: true })

  const ipad = await browser.newPage({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1 })
  ipad.setDefaultTimeout(8_000)
  await ipad.goto(baseUrl, { waitUntil: 'networkidle' })
  await ipad.evaluate(() => localStorage.clear())
  await ipad.reload({ waitUntil: 'networkidle' })
  await ipad.screenshot({ path: 'artifacts/landing-ipad.png', fullPage: true })
  await login(ipad)
  await ipad.locator('.platform > aside nav').getByRole('button', { name: 'Loreboard', exact: true }).click()
  await ipad.getByText('TAGESROUTE').waitFor()
  await ipad.screenshot({ path: 'artifacts/loreboard-ipad.png', fullPage: true })
  await ipad.getByRole('button', { name: /Zur Übersicht/ }).click()
  await ipad.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  await ipad.getByRole('heading', { name: 'Werkstatt', exact: true }).waitFor()
  await ipad.screenshot({ path: 'artifacts/workshop-ipad.png', fullPage: true })

  console.log('Loreboard persistence and layouts at 1920x1080, 1440x1000, and 1024x1366 passed.')
} finally {
  await browser.close()
}
