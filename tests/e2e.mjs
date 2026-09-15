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
  await desktop.getByRole('button', { name: /Lernjournal/ }).click()
  assert.match(await desktop.getByRole('button', { name: /Lernjournal/ }).innerText(), /BEREIT/)
  await desktop.getByRole('button', { name: /Entdecken/ }).click()
  assert.match(await desktop.locator('.loreboard-brand').innerText(), /Entdecken/)
  await desktop.getByRole('button', { name: 'Phasen bearbeiten' }).click()
  await desktop.getByLabel('Phase 2', { exact: true }).fill('Erforschen')
  await desktop.getByRole('button', { name: 'Phase hinzufügen' }).click()
  assert.match(await desktop.evaluate(() => localStorage.getItem('lore-phases')), /Erforschen/)
  const assignment = `Erkundungsauftrag ${Date.now()}`
  await desktop.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await desktop.getByLabel('Aktueller Auftrag').fill(assignment)
  await desktop.getByRole('button', { name: 'Auftrag speichern' }).click()
  assert.equal(await desktop.evaluate(() => localStorage.getItem('lore-assignment')), assignment)
  await desktop.getByRole('button', { name: 'Timer einstellen' }).click()
  await desktop.getByLabel('Timer Minuten').fill('0')
  await desktop.getByLabel('Timer Sekunden').fill('5')
  await desktop.getByRole('button', { name: 'Timer übernehmen' }).click()
  await desktop.getByRole('button', { name: 'Timer starten' }).click()
  await desktop.getByText('Start in 2').waitFor()
  await desktop.waitForTimeout(2200)
  await desktop.getByRole('button', { name: 'Pause' }).click()
  await desktop.getByRole('button', { name: 'Fortsetzen' }).click()
  await desktop.getByLabel('Aktive Lorestory').selectOption('moosarchiv')
  assert.equal(await desktop.getByLabel('Aktive Lorestory').inputValue(), 'moosarchiv')
  await desktop.screenshot({ path: 'artifacts/loreboard-desktop.png', fullPage: true })
  await desktop.getByRole('button', { name: 'Story jetzt starten' }).click()
  await desktop.getByText('Storymodus wird im nächsten Entwicklungsschritt angebunden').waitFor()
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

  const presentation = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  presentation.setDefaultTimeout(8_000)
  await presentation.goto(baseUrl, { waitUntil: 'networkidle' })
  await presentation.evaluate(() => localStorage.clear())
  await presentation.reload({ waitUntil: 'networkidle' })
  await login(presentation)
  await presentation.getByRole('button', { name: 'Loreboard öffnen' }).click()
  await presentation.getByText('TAGESROUTE').waitFor()
  await presentation.screenshot({ path: 'artifacts/loreboard-1920x1080.png', fullPage: true })

  console.log('1920 desktop, 1440 desktop, and iPad Loreboard and platform flows passed.')
} finally {
  await browser.close()
}
