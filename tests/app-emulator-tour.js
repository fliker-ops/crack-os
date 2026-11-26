// Recorrido por la app real (APK) usando DevTools del WebView; cada paso toma una captura del emulador
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const OUT = '/tmp/app-shots';
let n = 3;
const shot = (name) => { execSync(`adb exec-out screencap -p > ${OUT}/${String(n++).padStart(2, '0')}-${name}.png`); console.log('captura', name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = b.contexts()[0].pages()[0];
  page.on('console', m => console.log('WEB', m.type(), m.text()));
  await page.waitForSelector('#pw', { timeout: 30000 });
  await page.fill('#pw', 'crack123');
  await page.click('#go');
  await page.waitForSelector('.hello', { timeout: 20000 });
  await sleep(3000); shot('inicio');
  const go = async (id, wait = 3500) => { await page.evaluate(id => import('/assets/js/main.js').then(m => m.open(id, {}, true)), id); await sleep(wait); shot(id); };
  await page.click('[data-tab=terminal]'); await sleep(2500);
  await page.keyboard.type('whoami; uname -sr; ls\n'); await sleep(2000); shot('terminal');
  await page.click('[data-tab=globe]'); await sleep(7000); shot('mundo');
  await page.evaluate(() => window.__crkGlobe && window.__crkGlobe.zoom(1.6e6)); await sleep(5000); shot('mundo-planetas');
  await page.click('[data-tab=control]'); await sleep(1500); await page.click('#live'); await sleep(3000); shot('touchpad');
  for (const id of ['apps', 'wallpapers', 'editor', 'tasks', 'market', 'stats', 'carnet', 'disks', 'files', 'procs', 'screen', 'system']) await go(id);
  await page.click('[data-tab=more]'); await sleep(1500); shot('modulos');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
