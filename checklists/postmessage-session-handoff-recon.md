# postMessage Session Handoff Recon Checklist

## Goal

Determine whether a widget or SDK that hands off sessions via `postMessage` trusts attacker-controlled message fields instead of the real sender origin.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, login flow, widget path, and any report/reviewer feature.
- Do not copy live flags, cookies, tokens, or private URLs into reusable notes.

Record:

```text
Target:
Login endpoint:
Widget endpoint:
Reviewer/report flow:
Date:
```

## 2. Map The Handoff Surface

Identify:

- dashboard or docs references to widget endpoints
- popup/iframe endpoints
- session/token endpoints
- partner origin allowlist hints

Record:

```text
Exposed endpoints:
Claims about trusted partners:
Token/cookie handed off:
```

## 3. Read The postMessage Logic

Look for:

- `window.addEventListener("message", ...)`
- `event.origin` vs `event.data.origin`
- `window.opener` or `window.parent`
- `target.postMessage(..., targetOrigin)`
- regex or string matching on origin values

Record:

```text
Sender identity source:
Allowed origin check:
Reply target window:
Reply target origin source:
```

## 4. Separate Claimed Origin From Real Origin

Ask:

- Is the code trusting browser metadata or attacker-controlled payload data?
- Is the allowlist exact or prefix-based?
- Does it parse the origin or just regex-match a raw string?

Record:

```text
Uses event.origin: yes/no
Uses event.data.origin: yes/no
Exact origin compare: yes/no
```

## 5. Build Minimal Forgery

Test with one forged origin at a time:

```text
https://trusted.example@attacker.tld
https://trusted.example.evil.tld
https://trusted.example:443@attacker.tld
```

Prefer a harmless local callback first.

Record:

```text
Forged origin:
Accepted by validator: yes/no
Reply delivered: yes/no
```

## 6. Check iframe vs Popup Behavior

Test both delivery contexts:

- iframe/embed
- popup/top-level handoff page

Document whether third-party cookie restrictions change the result.

Record:

```text
Iframe result:
Popup result:
Cookie present in iframe: yes/no
```

## 7. Use Victim Delivery If Needed

Look for:

- report URL form
- admin/reviewer queue
- support preview or sandbox review flow

Record:

```text
Review endpoint:
External URL allowed: yes/no
Fresh authenticated session: yes/no
```

## 8. Capture Minimal Proof

Preferred order:

1. benign message echo
2. scoped token leak
3. session cookie leak only if the lab/app actually sends it

Use an external collector outside reusable notes.

## 9. Explain The Failure Clearly

Document:

```text
What the attacker controls:
What the widget should have trusted:
Why the allowlist was bypassed:
What secret was returned:
```

## 10. Fix Checklist

- Trust `event.origin`
- Compare exact parsed origins
- Reject userinfo/parser-confusion forms
- Bind replies to the expected sender window and nonce
- Send scoped signed tokens instead of ambient cookies

## Decision Checklist

- [ ] Widget endpoint identified.
- [ ] postMessage listener reviewed.
- [ ] `event.origin` vs `event.data.origin` distinction captured.
- [ ] One forged origin tested.
- [ ] iframe vs popup behavior compared.
- [ ] Review flow confirmed if needed.
- [ ] Minimal proof captured.
- [ ] Reusable notes exclude live secrets.
