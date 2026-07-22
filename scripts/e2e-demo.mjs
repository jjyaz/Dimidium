/* Quick end-to-end smoke test of the demo flow using puppeteer-core. */
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:5173'
const shots = '/tmp/shots'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text())
  })
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

  // 1. Home loads
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  check('home loads', (await page.title()).includes('Dimidium'))

  // 2. Boop the mascot -> speech bubble + washi counter increments
  const washiBefore = await page.$eval('.footer-washi-num', (el) =>
    Number(el.textContent.replace(/,/g, '')),
  )
  await page.click('.mascot-button')
  await page.waitForSelector('.mascot-bubble', { timeout: 3000 })
  const bubbleText = await page.$eval('.mascot-bubble', (el) => el.textContent)
  check('mascot boop shows bubble', !!bubbleText, bubbleText)
  const washiAfter = await page.$eval('.footer-washi-num', (el) =>
    Number(el.textContent.replace(/,/g, '')),
  )
  check(
    'washi counter increments on boop',
    washiAfter === washiBefore + 1,
    `${washiBefore} -> ${washiAfter}`,
  )

  // 2b. Mood ring starts calm (2 seeds incubating, none ready)
  const mood0 = await page.$eval('.nav-brand', (el) => el.dataset.mood)
  check('mood ring starts calm', mood0 === 'calm', mood0)

  // 3. Composer validation error on empty amount
  await page.evaluate(() => {
    document.querySelector('#composer').scrollIntoView()
  })
  await page.click('.lab-submit button[type=submit]')
  await page.waitForSelector('.lab-error', { timeout: 3000 })
  check('composer validates empty amount', true)

  // 4. Fill the composer and submit
  await page.type('#amount', '2.5')
  const chips = await page.$$('.lab-period .chip')
  await chips[0].click() // 15 minutes
  await page.type('#note', 'Testing whether future me still wants this.')
  await page.click('.lab-submit button[type=submit]')
  await page.waitForSelector('.lab-success', { timeout: 5000 })
  check('composer success state', true)
  await page.waitForFunction(
    () => location.pathname.startsWith('/egg/'),
    { timeout: 6000 },
  )
  const eggUrl = page.url()
  check('navigates to incubation detail', true, eggUrl)

  // 4b. Third incubating egg -> Dimidium gets sleepy
  const mood1 = await page.$eval('.nav-brand', (el) => el.dataset.mood)
  check('mood ring goes sleepy with 3 incubating', mood1 === 'sleepy', mood1)

  // 5. Detail page shows countdown + twin paths
  await page.waitForSelector('.countdown-num')
  const countdown = await page.$eval('.countdown-num', (el) => el.textContent)
  const twinCount = (await page.$$('.twin-path')).length
  check('countdown running', /m|s/.test(countdown), countdown)
  check('two twin paths', twinCount === 2)
  await page.screenshot({ path: `${shots}/e2e-detail.png` })

  // 6. Give me more time -> timer extends
  const btns = await page.$$('.detail-actions .btn')
  await btns[2].click() // more time
  await new Promise((r) => setTimeout(r, 1200))
  const flash1 = await page.$eval('.detail-flash', (el) => el.textContent).catch(() => null)
  check('more time flash', !!flash1, flash1 ?? '')

  // 7. Hatch it
  await new Promise((r) => setTimeout(r, 2500))
  const btns2 = await page.$$('.detail-actions .btn')
  await btns2[0].click()
  await page.waitForSelector('.status-hatched', { timeout: 6000 })
  check('hatch resolves decision', true)

  // 8. Nursery shows it, filters work
  await page.goto(`${BASE}/nursery`, { waitUntil: 'networkidle0' })
  const specimens = await page.$$('.specimen')
  check('nursery has eggs', specimens.length >= 5, `${specimens.length} eggs`)
  const filterBtns = await page.$$('.nursery-filters .chip')
  await filterBtns[3].click() // Hatched
  await new Promise((r) => setTimeout(r, 400))
  const hatchedCount = (await page.$$('.specimen')).length
  check('hatched filter works', hatchedCount >= 2, `${hatchedCount} hatched`)
  await filterBtns[2].click() // Ready
  await new Promise((r) => setTimeout(r, 400))
  const readyEmpty = await page.$('.nursery-empty')
  const readyCount = (await page.$$('.specimen')).length
  check('ready filter shows list or empty state', readyEmpty !== null || readyCount > 0)
  await page.screenshot({ path: `${shots}/e2e-nursery.png` })

  // 8b. Regret receipt + Shell yield on a shelled decision
  await page.goto(`${BASE}/egg/seed-63`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.receipt', { timeout: 4000 })
  const receiptCaption = await page.$eval('.receipt-caption', (el) => el.textContent)
  check(
    'regret receipt renders with caption',
    /I almost .+ I didn't\. I (saved|lost) \$/.test(receiptCaption),
    receiptCaption.slice(0, 80),
  )
  const receiptBtns = await page.$$eval('.receipt-actions button', (els) =>
    els.map((e) => e.textContent),
  )
  check(
    'receipt share/copy buttons present',
    receiptBtns.length === 2,
    receiptBtns.join(' | '),
  )
  await page.waitForSelector('.shell-yield', { timeout: 8000 })
  const yieldHeadline = await page.$eval('.shell-yield-headline', (el) => el.textContent)
  check(
    'shell yield card shows Atelier Earn story',
    /could've earned .+% in Atelier Earn/.test(yieldHeadline),
    yieldHeadline.slice(0, 100),
  )
  const yieldSource = await page.$eval('.shell-yield-source', (el) => el.textContent)
  check(
    'shell yield cites Solend source',
    /Solend|Fallback|Cached/.test(yieldSource),
    yieldSource,
  )
  await page.screenshot({ path: `${shots}/e2e-receipt.png` })

  // 9. DNA page renders yolk + fragments
  await page.goto(`${BASE}/dna`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.dna-yolk')
  const frags = await page.$$eval('.fragment.is-earned', (els) => els.length)
  check('dna yolk renders', true)
  check('fragments earned', frags >= 3, `${frags} earned`)
  await page.screenshot({ path: `${shots}/e2e-dna.png` })

  // 10. How it works + agents + 404
  await page.goto(`${BASE}/how-it-works`, { waitUntil: 'networkidle0' })
  check('how it works renders', (await page.$$('.how-step')).length === 5)

  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#try-heading')
  await page.type('#agent-amount', '')
  await page.click('#agent-amount', { clickCount: 3 })
  await page.type('#agent-amount', '1')
  await page.click('.agents-form button[type=submit]')
  await page.waitForSelector('.oracle-card', { timeout: 4000 })
  const opinion = await page.$eval('.oracle-opinion', (el) => el.textContent)
  check('agents try-it returns opinion', !!opinion && opinion.length > 20, opinion.slice(0, 60))
  check(
    'agents page documents MCP endpoint',
    (await page.$eval('.agents-facts', (el) => el.textContent)).includes('askDimidium'),
  )

  await page.goto(`${BASE}/egg/does-not-exist`, { waitUntil: 'networkidle0' })
  const missing = await page.$('.detail-missing')
  check('unknown egg shows empty state', missing !== null)

  // 11. Mobile hero
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const toggleVisible = await page.$eval(
    '.nav-shell-toggle',
    (el) => getComputedStyle(el).display !== 'none',
  )
  check('mobile shell menu visible', toggleVisible)
  await page.click('.nav-shell-toggle')
  await new Promise((r) => setTimeout(r, 400))
  const menuOpen = await page.$eval('.nav-mobile', (el) =>
    el.classList.contains('is-open'),
  )
  check('mobile menu opens', menuOpen)
  await page.screenshot({ path: `${shots}/e2e-mobile-home.png` })
} finally {
  await browser.close()
}

console.log('\n' + results.join('\n'))
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1)
