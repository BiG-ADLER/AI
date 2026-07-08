const { chromium } = require('/Users/mbz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sanitizerSource = require('fs')
  .readFileSync(__dirname + '/collide-sanitizer-test.js', 'utf8')
  .match(/const sanitizerSource = String\.raw`([\s\S]*?)`;/)[1];

const attrs = [
  'onerror', 'OnError', 'ONERROR',
  ' onerror', '/onerror', '"onerror', "'onerror",
  'onerror/', 'onerror!', 'onerror\x00', 'onerror\x0b', 'onerror\x0c',
  'o\\nerror', 'o\\terror', 'o\\rerror', 'o\\ferror',
  'o&#110;error', 'on&#101;rror', 'onerror&#x00;',
  'xmlns:onerror', 'x:onerror', 'xml:onerror',
  'onload', 'onLoad', 'onauxclick', 'onanimationstart',
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset=utf-8><div id=preview></div><script>${sanitizerSource}</script>`);
  const hits = [];
  const survives = [];
  for (const attr of attrs) {
    const payload = `<img src=x ${attr}="hit(${JSON.stringify(attr)})">`;
    const row = await page.evaluate(async (payload) => {
      window.fired = false;
      window.hit = value => { window.fired = value || true; };
      const preview = document.getElementById('preview');
      preview.replaceChildren();
      window.setHTML(preview, payload);
      await new Promise(resolve => setTimeout(resolve, 80));
      return { fired: window.fired, html: preview.innerHTML };
    }, payload);
    if (row.fired) hits.push({ attr, payload, ...row });
    if (row.html.includes('hit(') || row.html.toLowerCase().includes('onerror')) survives.push({ attr, payload, ...row });
  }
  console.log(JSON.stringify({ hits, survives }, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
