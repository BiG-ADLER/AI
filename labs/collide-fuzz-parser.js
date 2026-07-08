const { chromium } = require('/Users/mbz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const sanitizerSource = require('fs')
  .readFileSync(__dirname + '/collide-sanitizer-test.js', 'utf8')
  .match(/const sanitizerSource = String\.raw`([\s\S]*?)`;/)[1];

const event = '<img src=x onerror=hit("FIRED")>';
const wrappers = [
  ['plain', 'X'],
  ['svg', '<svg>X</svg>'],
  ['svg-title', '<svg><title>X</title></svg>'],
  ['svg-desc', '<svg><desc>X</desc></svg>'],
  ['svg-style', '<svg><style>X</style></svg>'],
  ['svg-text', '<svg><text>X</text></svg>'],
  ['svg-p', '<svg><p>X</p></svg>'],
  ['svg-table', '<svg><table>X</table></svg>'],
  ['math', '<math>X</math>'],
  ['math-mtext', '<math><mtext>X</mtext></math>'],
  ['math-table', '<math><mtext><table>X</table></mtext></math>'],
  ['math-mglyph-style', '<math><mtext><table><mglyph><style><!--</style>X--></mglyph></table></mtext></math>'],
  ['table', '<table>X</table>'],
  ['table-svg', '<table><svg>X</svg></table>'],
  ['template', '<template>X</template>'],
  ['noscript', '<noscript>X</noscript>'],
  ['select', '<select><option>X</option></select>'],
  ['textarea', '<textarea>X</textarea>'],
  ['plaintext', '<plaintext>X'],
  ['xmp', '<xmp>X</xmp>'],
  ['iframe-srcdoc', '<iframe srcdoc="X"></iframe>'],
  ['object', '<object>X</object>'],
  ['html-head', '<html><head>X</head><body>body</body></html>'],
  ['head', '<head>X</head>'],
  ['body', '<body>X</body>'],
  ['frameset', '<frameset>X</frameset>'],
];

const variants = [
  ['raw', event],
  ['close-style', '</style>' + event],
  ['close-title', '</title>' + event],
  ['close-desc', '</desc>' + event],
  ['close-svg', '</svg>' + event],
  ['close-math', '</math>' + event],
  ['comment-close', '-->' + event],
  ['cdata-close', ']]>' + event],
  ['attr-title', '<img title="-->' + event.replaceAll('"', '&quot;') + '">'],
  ['attr-svg-title', '<svg><title><img title="</title>' + event.replaceAll('"', '&quot;') + '"></title></svg>'],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset=utf-8><div id=preview></div><script>${sanitizerSource}</script>`);
  const hits = [];
  const inspected = [];

  for (const [wname, wrapper] of wrappers) {
    for (const [vname, variant] of variants) {
      const payload = wrapper.replace('X', variant);
      const row = await page.evaluate(async (payload) => {
        window.fired = false;
        window.hit = value => { window.fired = value || true; };
        const preview = document.getElementById('preview');
        preview.replaceChildren();
        try { window.setHTML(preview, payload); }
        catch (e) { return { fired: 'ERROR:' + e.message, html: preview.innerHTML }; }
        await new Promise(resolve => setTimeout(resolve, 80));
        return { fired: window.fired, html: preview.innerHTML };
      }, payload);
      if (row.fired) hits.push({ wname, vname, payload, ...row });
      if (row.html.includes('onerror') || row.html.includes('FIRED')) {
        inspected.push({ wname, vname, fired: row.fired, html: row.html, payload });
      }
    }
  }

  console.log(JSON.stringify({ hits, inspected }, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
