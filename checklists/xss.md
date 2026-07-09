# XSS Professional Bug Hunter Checklist

## Goal

Find whether attacker-controlled data can reach a browser-executed context without correct encoding, sanitization, or isolation.

Do not start with payloads. Start with data flow.

---

## 1. Scope and target confirmation

- Is the target authorized / lab / in-scope?
- Is the affected page reachable by another user?
- Is authentication required?
- Which role can inject the input?
- Which role can trigger/view the output?
- Is the issue self-XSS, same-user XSS, stored XSS, reflected XSS, DOM XSS, or blind XSS?

Record:

text Target: Endpoint/page: Attacker role: Victim role: XSS type: 

---

## 2. Identify attacker-controlled input sources

Check every place attacker data can enter.

### URL/browser sources

- location.search
- location.hash
- location.pathname
- document.URL
- document.referrer
- window.name
- postMessage
- BroadcastChannel
- history.state

### Storage sources

- localStorage
- sessionStorage
- IndexedDB
- cookies
- cached API responses
- service worker cache

### Server-side sources

- query parameters
- form fields
- JSON body
- uploaded filename
- uploaded file content
- profile fields
- comments/messages
- markdown fields
- search fields
- error messages
- logs/admin panels
- notification text
- webhook data
- OAuth state, redirect_uri, profile fields
- SSO/SAML attributes
- API response fields

Record:

text Input name: Input location: Input method: Stored or reflected: Who controls it: 

---

## 3. Locate output and rendering context

Find exactly where the input appears.

### Context types

- HTML text node
- HTML attribute value
- unquoted HTML attribute
- JavaScript string
- JavaScript template literal
- JavaScript object/JSON inside script
- URL context
- CSS context
- SVG context
- MathML context
- Markdown-rendered HTML
- rich text editor output
- iframe srcdoc
- PDF/HTML export
- email template
- admin dashboard/log viewer

Record:

text Output page: DOM location: Rendering context: Quoted or unquoted: Encoded or raw: 

---

## 4. Trace source to sink

For DOM/client-side XSS, trace the full path.

### Dangerous sinks

- innerHTML
- outerHTML
- insertAdjacentHTML
- document.write
- document.writeln
- Range.createContextualFragment
- DOMParser.parseFromString(..., "text/html")
- iframe.srcdoc
- eval
- Function
- string-based setTimeout
- string-based setInterval
- event handler assignment
- script.src
- location.href
- location.assign
- location.replace
- window.open
- a.href
- form.action
- object.data
- embed.src
- template.innerHTML
- Dedicated Worker `eval` / `Function` on path or `postMessage` data
- Cache API `put` of SW-cached main-thread scripts (`/static/*.js`)

### Safer sinks to prefer

- textContent
- innerText
- setAttribute with safe attributes only
- DOM creation APIs: createElement, appendChild
- strict URL builders
- framework-safe rendering

Record:

text Source: Transformations: Sink: Execution context: 

---

## 5. Check transformations and decoding

Identify every change applied before output.

- URL decoding
- HTML decoding
- JSON parsing/stringifying
- Base64 decoding
- Unicode normalization
- lowercasing/uppercasing
- trimming
- escaping
- template rendering
- markdown conversion
- sanitizer pass
- server-side validation
- client-side validation
- double decoding
- browser auto-correction
- framework rendering

Key question:

text Does validation happen before decoding, after decoding, or both? 

Record:

text Raw input: After server processing: After API response: After client processing: Final DOM: 

---

## 6. Identify security controls

### Encoding

- HTML entity encoding
- attribute encoding
- JavaScript string escaping
- URL encoding
- CSS escaping
- context-specific output encoding

### Sanitization

- DOMPurify
- sanitize-html
- custom sanitizer
- framework sanitizer
- markdown sanitizer
- allowlist/denylist

### Browser/security headers

- CSP
- Trusted Types
- X-Content-Type-Options
- iframe sandbox
- cookie flags
- CORP/COEP/COOP where relevant

### Framework protections

- React escaping
- Vue escaping
- Angular sanitization
- server template autoescaping
- unsafe bypass functions

Record:

text Control: Where applied: Bypass possibility: Misconfiguration: 

---

## 7. Test context breakout

Build tests based on context, not random payloads.

### HTML text context

Check if tags are parsed:

html <b>test</b> 

### HTML attribute context

Check if quotes or spaces break out:

html " test=x ' test=x 

### Unquoted attribute context

Check whitespace, >, /, backtick behavior:

html x autofocus test 

### JavaScript string context

Check quote breakout and escaping:

js ' " \ </script> 

### Template literal context

Check interpolation:

js ${1} 

### URL context

Check scheme and parser behavior:

text javascript: data: https://example.com //example.com 

### SVG/MathML context

Check namespace behavior:

html <svg></svg> <math></math> 

### Markdown context

Check whether HTML is allowed:

md [link](javascript:alert(1)) <img src=x> 

### Uploaded file / object storage context

Check whether uploaded files can be served through an active browser parser:

- Does validation check only extension, multipart MIME, or magic bytes?
- Is the uploaded file re-encoded server-side or stored unchanged?
- Is the object served from the app origin or a separate cookieless origin?
- Does the storage path expose S3/MinIO-style response header overrides?
- Does `response-content-type=text/html` change the returned `Content-Type`?
- Does `response-content-disposition=inline` affect render vs download behavior?
- Are object URLs public unsigned URLs or presigned URLs?
- If presigned, were override parameters included before signing?
- Does `nosniff` exist, and is the server still declaring an active type?

Compare headers:

text curl -I 'https://target/uploads/file.png'
text curl -I 'https://target/uploads/file.png?response-content-type=text/html'

Useful override tests:

text ?response-content-type=text/html
text ?response-content-type=text/html&response-content-disposition=inline
text ?response-content-type=image/svg+xml
text ?response-content-type=application/xhtml+xml
text ?response-content-encoding=gzip

Record:

text Allowed characters: Blocked characters: Escaped characters: Browser-parsed result: 

---

## 8. Check CSP and execution conditions

Do not stop at reflection. Determine execution.

### CSP checks

- Is inline script blocked?
- Are event handlers blocked?
- Are external scripts allowed?
- Is unsafe-inline present?
- Is nonce/hash used?
- Is strict-dynamic used?
- Are JSONP/script gadgets available?
- Is data: allowed?
- Is blob: allowed?
- Is object-src restricted?
- Is base-uri restricted?
- Is frame-ancestors relevant?

### Execution requirements

- user click required?
- hover/focus required?
- image load/error required?
- SVG load behavior?
- DOM mutation required?
- route change required?
- admin bot required?
- stored view required?

Record:

text CSP: Blocked behavior: Allowed behavior: Required trigger: 

---

## 9. Classify the XSS

Classify correctly.

### Reflected XSS

- Input comes from request.
- Output appears immediately in response.
- Victim must open crafted URL/request.

### Stored XSS

- Input is saved server-side.
- Victim triggers later by viewing affected page.

### DOM XSS

- Client-side JavaScript reads attacker input and writes to dangerous sink.

### Blind XSS

- Payload triggers in hidden/admin/backend panel.

### Self-XSS

- Only attacker can trigger against own account without realistic victim path.

Record:

text Type: Victim path: Persistence: Required interaction: 

---

## 10. Confirm realistic impact

XSS impact depends on context and controls.

Check:

- Can attacker perform actions as victim?
- Are cookies HttpOnly?
- Are CSRF protections present?
- Are sensitive API responses accessible?
- Can account settings be changed?
- Can email/password/2FA flows be reached?
- Can OAuth tokens/API keys be accessed?
- Can the payload spread to other users?
- Is the victim an admin/moderator/support user?
- Can internal-only data be read by blind/admin XSS?
- Can CSP be bypassed or does CSP reduce impact?

Record:

text Victim capability reached: Sensitive action/data: Privilege level: Impact limitation: 

---

## 11. Reduce to minimal proof of concept

A professional PoC is minimal.

Include:

- one affected parameter/field
- one clean payload
- exact request or URL
- exact victim action
- exact observed result
- screenshot or response evidence
- browser/role used

Avoid:

- noisy payload chains
- unrelated bypass attempts
- exaggerated impact
- stealing real secrets
- destructive actions

Record:

text Minimal payload: Minimal steps: Observed execution: Evidence: 

---

## 12. Root cause analysis

Identify the actual bug.

Common root causes:

- raw user input inserted into HTML
- wrong output encoding for context
- unsafe DOM sink
- sanitizer misconfiguration
- markdown allows unsafe HTML
- client trusts server data
- server trusts client-side validation
- double decoding after validation
- filter strips dangerous strings but leaves dangerous structure
- HTML allowlist keeps `body`/`html` and misses uncommon `on*` handlers (e.g. `onhashchange`)
- CSP missing or weak
- framework escape bypass used unsafely
- uploaded SVG served as active content

Record:

text Root cause: Vulnerable code: Correct security boundary: 

---

## 13. Fix checklist

Fix based on context.

### HTML output

- Encode by context.
- Use template autoescaping.
- Avoid raw HTML rendering.

### DOM output

- Replace innerHTML with textContent where possible.
- Use safe DOM APIs.
- Avoid string-to-DOM parsing.

### Rich HTML

- Use strict allowlist sanitizer.
- Remove event handlers.
- Remove dangerous URL schemes.
- Restrict SVG/MathML unless needed.
- Disallow `body`/`html`/`head` in user content.
- Fuzz uncommon handlers (`onhashchange`, `onbeforetoggle`, …) — not only `onload`/`onclick`.
- Sanitize after final decoding.

### URLs

- Allow only http: and https: where appropriate.
- Parse with new URL().
- Reject javascript:, data:, unusual schemes.
- Normalize before validation.

### Headers

- Add strong CSP.
- Use Trusted Types for DOM-heavy apps.
- Set cookies HttpOnly, Secure, SameSite.
- Use X-Content-Type-Options: nosniff.

### Uploads

- Do not serve SVG/user HTML from same origin.
- Force download or serve from isolated domain.
- Set safe Content-Type.
- Add Content-Disposition: attachment if needed.
- Fully decode and re-encode accepted images before storage.
- Strip S3/MinIO response header override params before proxying object requests.
- Do not let requester-controlled query params change `Content-Type` or `Content-Disposition`.

Record:

text Recommended fix: Defense-in-depth: Regression test: 

---

## 14. Regression tests

Create tests that prove the fix.

Test cases:

- benign HTML stays safe
- dangerous tags do not execute
- event handlers removed
- dangerous URL schemes rejected
- encoded output remains encoded
- markdown cannot create scriptable HTML
- SVG upload cannot execute
- S3/MinIO `response-content-type=text/html` cannot change uploaded object MIME type
- DOM sink no longer parses HTML
- CSP blocks unexpected execution

Record:

text Test input: Expected output: Expected browser behavior: 

---

## 15. Report-ready summary

Use this structure for final reporting.

text Title: Stored/Reflected/DOM XSS in [feature] via [parameter/field]  Summary: Attacker-controlled input from [source] is rendered into [context] without proper [encoding/sanitization]. This allows JavaScript execution when [victim] views [page/action].  Affected endpoint/page: ...  Steps to reproduce: 1. 2. 3.  Proof of concept: ...  Impact: ...  Root cause: ...  Fix: ...  Regression test: ... 

---

## 16. Decision checklist before calling it valid

Before reporting, confirm:

- [ ] Target is in scope.
- [ ] Input is attacker-controlled.
- [ ] Output is reachable by a victim.
- [ ] Context is identified.
- [ ] Sink is identified.
- [ ] JavaScript execution is confirmed, or limitation is clearly stated.
- [ ] CSP behavior is checked.
- [ ] Cookie/session limitations are checked.
- [ ] If Worker + SW cache: Cache API poison and same-browser-profile delivery were tested (separate bot visits often reset cache).
- [ ] Impact is realistic.
- [ ] Steps are minimal and reproducible.
- [ ] Root cause is explained.
- [ ] Fix is specific.
- [ ] Regression test is included.
