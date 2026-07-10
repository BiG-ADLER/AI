# DOM Clobbering Sanitizer Review Checklist

## Goal

Determine whether a client-side HTML sanitizer can be bypassed through DOM clobbering, especially when untrusted markup is inserted into the live DOM before the sanitizer walks and cleans it.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, page, sanitizer entry point, and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Preview/render page:
Sanitizer function:
Date:
```

## 2. Determine Parse Context

Identify whether the app sanitizes:

```text
detached tree first
live DOM first
server-side first
```

Look for patterns such as:

```javascript
target.innerHTML = raw
sanitize(target)
```

or:

```javascript
tpl.innerHTML = raw
sanitize(tpl.content)
target.replaceChildren(tpl.content)
```

Record:

```text
Insertion sink:
Sanitize timing:
Detached or live:
```

## 3. Map Security-Sensitive DOM Reads

List every property or method the sanitizer reads after attacker markup exists:

```text
document.createTreeWalker
NodeFilter.SHOW_ELEMENT
element.attributes
element.removeAttribute
element.remove
element.tagName
document.body
document.forms
window.NodeFilter
```

Record:

```text
Live instance lookups:
Prototype-cached lookups:
Potential clobber targets:
```

## 4. Test Plain Baseline Payloads

Use a control to confirm normal sanitizer behavior:

```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)></svg>
```

Record:

```text
Plain onerror stripped: yes/no
Plain onload stripped: yes/no
Baseline dangerous node removed: yes/no
```

## 5. Probe Named-Property Clobbering

Test one target at a time:

```html
<img name="createTreeWalker">
<form><input id="remove"></form>
<input name="attributes">
<input name="removeAttribute">
```

For each probe, answer:

```text
What object is clobbered:
What later sanitizer read uses it:
Does the browser expose the named property:
Observed failure mode:
```

## 6. Pair Clobbering With A Fast Sink

Combine the clobber primitive with a quickly firing sink:

```html
<img name="createTreeWalker"><img src=x onerror=...>
```

Prefer:

```text
img onerror
load/error paths
same-turn DOM side effects
```

Avoid starting with slow or interaction-dependent sinks unless needed.

Record:

```text
Chosen fast sink:
Should it fire before cleanup:
Observed timing:
```

## 7. Separate Failure From Execution

Do not treat a thrown sanitizer exception as proof of XSS.

Check:

```text
Did the event handler actually run:
Did a collector receive a request:
Did DOM state change:
Did the page clear the node only after execution:
```

Use a harmless proof first if needed:

```html
<img name="createTreeWalker"><img src=x onerror="document.body.setAttribute('data-pwned','1')">
```

## 8. Confirm Secret Readability

If the exploit goal is cookie theft, verify:

```text
document.cookie non-empty:
HttpOnly barrier present: yes/no
Need encodeURIComponent: yes/no
```

If cookie readability is unknown, first exfil a harmless marker:

```text
m=hit
```

Then escalate to the real secret read.

## 9. Root Cause Checklist

Separate:

```text
Live-DOM insertion before sanitization:
Clobbered property or method:
Sanitizer failure point:
Why dangerous attribute/node survived long enough:
Browser behavior required:
```

## 10. Fix Checklist

- Sanitize in a detached tree before mounting.
- Cache DOM methods from prototypes.
- Use prototype-safe calls instead of live instance methods.
- Fail closed on sanitizer exceptions.
- Add real-browser tests for DOM clobbering, not only jsdom/unit tests.

## Decision Checklist

- [ ] Parse context identified as detached or live DOM.
- [ ] Security-sensitive DOM reads mapped.
- [ ] Plain dangerous baseline tested.
- [ ] At least one named-property clobber primitive tested.
- [ ] Fast sink paired with clobber primitive.
- [ ] Execution distinguished from mere sanitizer failure.
- [ ] Secret readability confirmed or ruled out.
- [ ] Root cause documented as DOM clobbering against sanitizer internals.
- [ ] Reusable notes exclude live secrets.
