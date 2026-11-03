// End-to-end check for dsh-sidebar-shelf against a real DSH web instance.
// usage: node test/e2e.cjs <web-url> [outDir]
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

const url = process.argv[2];
const outDir = process.argv[3] || 'docs';
const CHROME = process.env.DSH_SHOT_BROWSER || 'C:\\Users\\38875\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function dismissDialogs(page) {
  // Onboarding and the sign-in prompt can appear one after the other.
  for (let pass = 0; pass < 3; pass += 1) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '继续');
      if (btn) btn.click();
      document.querySelector('[role="dialog"] button[aria-label="关闭"]')?.click();
    });
    await sleep(600);
  }
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
  await dismissDialogs(page);

  // 1. the shelf owns the native row above the workspace pane
  const base = await page.evaluate(() => {
    const row = document.querySelector('[data-dsh-shelf-row]');
    const nav = row?.parentElement ?? null;
    const siblings = nav ? [...nav.children] : [];
    const region = nav?.nextElementSibling ?? null;
    const newSession = document.querySelector('button[aria-label="新建会话"]');
    return {
      rowFound: Boolean(row),
      rowText: row ? row.textContent.trim() : null,
      rowBox: row ? row.getBoundingClientRect().toJSON() : null,
      navVisible: nav ? getComputedStyle(nav).display : 'missing',
      navChildren: siblings.length,
      visibleRows: siblings.filter((child) => getComputedStyle(child).display !== 'none').length,
      regionTop: region ? region.getBoundingClientRect().top : null,
      newSessionBottom: newSession ? newSession.getBoundingClientRect().bottom : null,
    };
  });
  check('the shelf owns a native panel row', base.rowFound && base.rowText === '面板', base.rowText);
  check('native list stays mounted, only siblings are hidden', base.navVisible !== 'none' && base.visibleRows === 1, `${base.visibleRows}/${base.navChildren} visible`);
  check('row sits below New Session', base.rowBox !== null && base.rowBox.top > base.newSessionBottom, `${base.rowBox?.top} > ${base.newSessionBottom}`);
  check('row sits above the workspace pane', base.rowBox !== null && base.rowBox.bottom <= base.regionTop, `${base.rowBox?.bottom} <= ${base.regionTop}`);
  await page.screenshot({ path: path.join(outDir, '01-placement.png') });

  // 2. open the shelf
  await page.evaluate(() => document.querySelector('[data-dsh-shelf-row]').click());
  await sleep(400);
  const opened = await page.evaluate(() => {
    const row = document.querySelector('[data-dsh-shelf-row]');
    const pop = document.querySelector('.dshs-pop');
    return {
      found: Boolean(pop),
      tileCount: pop ? pop.querySelectorAll('.dshs-tile').length : 0,
      search: Boolean(pop?.querySelector('input')),
      popBox: pop ? pop.getBoundingClientRect().toJSON() : null,
      rowBox: row ? row.getBoundingClientRect().toJSON() : null,
      expanded: row?.getAttribute('aria-expanded'),
    };
  });
  check('shelf opens from the native row', opened.found);
  check('shelf lists every panel', opened.tileCount === 12, `${opened.tileCount} tiles`);
  check('card opens under the row', opened.popBox !== null && opened.popBox.top >= opened.rowBox.bottom);
  check('search appears for many panels', opened.search);
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
  await page.evaluate(() => document.querySelector('[data-dsh-shelf-row]').click());
  await sleep(400);
  const active = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.dshs-tile[data-active="true"]')];
    return { count: tiles.length, title: tiles[0]?.getAttribute('title') };
  });
  check('active panel is marked in the shelf', active.count === 1, String(active.title));

  // 5. Escape closes
  await page.keyboard.press('Escape');
  await sleep(250);
  check('Escape closes the shelf', await page.evaluate(() => document.querySelector('.dshs-pop') === null));

  // 6. rail mode keeps the same native row, as a 36px icon
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '收起侧边栏');
    if (btn) btn.click();
  });
  await sleep(700);
  const rail = await page.evaluate(() => {
    const row = document.querySelector('[data-dsh-shelf-row]');
    const r = row.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), label: row.textContent.trim() };
  });
  check('rail row shrinks to a 36px icon', rail.width === 36 && rail.height === 36, JSON.stringify(rail));
  await page.evaluate(() => document.querySelector('[data-dsh-shelf-row]').click());
  await sleep(400);
  const railPop = await page.evaluate(() => {
    const pop = document.querySelector('.dshs-pop');
    const row = document.querySelector('[data-dsh-shelf-row]');
    return { open: Boolean(pop), left: pop?.getBoundingClientRect().left, rowRight: row?.getBoundingClientRect().right };
  });
  check('rail shelf opens beside the rail', railPop.open && railPop.left >= railPop.rowRight, JSON.stringify(railPop));
  await page.screenshot({ path: path.join(outDir, '05-rail.png') });

  // 7. dark theme in a fresh page that prefers dark
  const dark = await browser.newPage();
  await dark.setViewport({ width: 1440, height: 900 });
  await dark.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await dark.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(3000);
  await dismissDialogs(dark);
  const darkTheme = await dark.evaluate(() => ({
    isDark: document.body.hasAttribute('data-ds-dark-theme'),
    row: Boolean(document.querySelector('[data-dsh-shelf-row]')),
  }));
  check('dark theme renders the shelf row', darkTheme.row, `data-ds-dark-theme=${darkTheme.isDark}`);
  await dark.evaluate(() => document.querySelector('[data-dsh-shelf-row]').click());
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
