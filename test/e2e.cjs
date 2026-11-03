// End-to-end check for dsh-sidebar-shelf against a real DSH web instance.
// usage: node test/e2e.cjs <web-url> [outDir]
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

const url = process.argv[2];
const outDir = process.argv[3] || 'docs';
const CHROME = 'C:\\Users\\38875\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '继续');
    if (btn) btn.click();
  });
  await sleep(700);
  // A fresh profile also shows the "get started" dialog; close it so the
  // screenshots show the real sidebar instead of a dimmed backdrop.
  await page.evaluate(() => {
    document.querySelector('[role="dialog"] button[aria-label="关闭"]')?.click();
  });
  await sleep(500);

  // 1. native panel list hidden, shelf trigger present
  const base = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const trigger = document.querySelector('.dshs-trigger');
    return {
      navDisplay: nav ? getComputedStyle(nav).display : 'missing',
      marker: Boolean(document.querySelector('[data-dsh-shelf]')),
      trigger: Boolean(trigger),
      triggerText: trigger?.textContent ?? '',
    };
  });
  check('native panel list is collapsed', base.navDisplay === 'none', `display=${base.navDisplay}`);
  check('sidebar root is marked', base.marker);
  check('shelf trigger exists', base.trigger, base.triggerText);
  await page.screenshot({ path: path.join(outDir, '01-collapsed.png') });

  // 2. open the shelf
  await page.evaluate(() => document.querySelector('.dshs-trigger').click());
  await sleep(400);
  const opened = await page.evaluate(() => {
    const pop = document.querySelector('.dshs-pop');
    return {
      found: Boolean(pop),
      tiles: pop ? [...pop.querySelectorAll('.dshs-tile')].map((t) => t.getAttribute('title')) : [],
      search: Boolean(pop?.querySelector('input')),
      activeElement: document.activeElement?.className,
    };
  });
  check('shelf opens', opened.found);
  check('shelf lists every panel', opened.tiles.length >= 3, `${opened.tiles.length} tiles`);
  check('search appears for many panels', opened.search);
  check('no tile pre-highlighted', await page.evaluate(() => document.querySelector('.dshs-tile[data-focus="true"]') === null));
  await page.screenshot({ path: path.join(outDir, '02-shelf-open.png') });

  // 3. search + keyboard + open a panel
  await page.keyboard.type('技能');
  await sleep(350);
  const filtered = await page.evaluate(() => [...document.querySelectorAll('.dshs-tile')].map((t) => t.getAttribute('title')));
  check('search filters panels', filtered.length === 1 && filtered[0].includes('技能'), JSON.stringify(filtered));

  await page.keyboard.press('ArrowDown');
  await sleep(150);
  const highlighted = await page.evaluate(() => document.querySelector('.dshs-tile[data-focus="true"]')?.getAttribute('title'));
  check('arrow key highlights a tile', Boolean(highlighted), String(highlighted));
  await page.keyboard.press('Enter');
  await sleep(600);
  const afterOpen = await page.evaluate(() => ({
    pop: Boolean(document.querySelector('.dshs-pop')),
    mainText: document.body.innerText.slice(0, 2000),
  }));
  check('choosing a panel closes the shelf', afterOpen.pop === false);
  check('chosen panel becomes the main view', afterOpen.mainText.includes('Demo panel registered'));
  await page.screenshot({ path: path.join(outDir, '03-panel-opened.png') });

  // 4. reopened shelf marks the active panel
  await page.evaluate(() => document.querySelector('.dshs-trigger').click());
  await sleep(400);
  const active = await page.evaluate(() => {
    const tile = document.querySelector('.dshs-tile[data-active="true"]');
    return { title: tile?.getAttribute('title'), count: document.querySelectorAll('.dshs-tile[data-active="true"]').length };
  });
  check('active panel is marked in the shelf', active.count === 1, String(active.title));
  await page.screenshot({ path: path.join(outDir, '04-active.png') });

  // 5. Escape closes
  await page.keyboard.press('Escape');
  await sleep(250);
  check('Escape closes the shelf', await page.evaluate(() => document.querySelector('.dshs-pop') === null));

  // 6. rail mode
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '收起侧边栏');
    if (btn) btn.click();
  });
  await sleep(700);
  const rail = await page.evaluate(() => {
    const t = document.querySelector('.dshs-trigger');
    const r = t.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), labelVisible: Boolean(document.querySelector('.dshs-trigger-label')) };
  });
  check('rail trigger shrinks to an icon', rail.width === 36 && rail.height === 36, JSON.stringify(rail));
  await page.evaluate(() => document.querySelector('.dshs-trigger').click());
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, '05-rail.png') });
  check('shelf opens in rail mode', await page.evaluate(() => Boolean(document.querySelector('.dshs-pop'))));

  // 7. dark theme in a fresh page that prefers dark
  const dark = await browser.newPage();
  await dark.setViewport({ width: 1440, height: 900 });
  await dark.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await dark.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3000);
  await dark.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '继续');
    if (btn) btn.click();
    document.querySelector('[role="dialog"] button[aria-label="关闭"]')?.click();
  });
  await sleep(600);
  const darkTheme = await dark.evaluate(() => ({
    isDark: document.body.hasAttribute('data-ds-dark-theme'),
    trigger: Boolean(document.querySelector('.dshs-trigger')),
  }));
  check('dark theme renders the shelf', darkTheme.trigger, `data-ds-dark-theme=${darkTheme.isDark}`);
  await dark.evaluate(() => document.querySelector('.dshs-trigger').click());
  await sleep(400);
  await dark.screenshot({ path: path.join(outDir, '06-dark.png') });

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
