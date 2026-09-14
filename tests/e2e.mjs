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
  await page.getByRole('heading', { name: 'Dein Loreboard' }).waitFor()
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
    ['Loreboard', 'Dein Loreboard'],
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
  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Loreboard', exact: true }).click()
  assert.match(await desktop.locator('.active-banner h2').innerText(), /Sternenuhr/)
  await desktop.getByRole('button', { name: 'Abenteuer fortsetzen' }).click()
  await desktop.getByText('Abenteuer gestartet – Kapitel 2 wird geladen').waitFor()

  await desktop.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  assert.match(await desktop.locator('.editor-card input').inputValue(), /Sternenuhr/)
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
  await ipad.locator('.platform > aside nav').getByRole('button', { name: 'Werkstatt', exact: true }).click()
  await ipad.getByRole('heading', { name: 'Werkstatt', exact: true }).waitFor()
  await ipad.screenshot({ path: 'artifacts/workshop-ipad.png', fullPage: true })

  console.log('Desktop and iPad navigation, market, fundus, loreboard, and workshop flows passed.')
} finally {
  await browser.close()
}
