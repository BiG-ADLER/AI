# Open Redirect Recon Checklist

## Goal

Determine whether a redirect parameter can send users or bots to an attacker-controlled host, and capture any sensitive data added during privileged redirects.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Allowed host hint (if any):
```

## 2. Map Redirect Surface

Find:

- `/go`, `/redirect`, `/out`, `/login/next`
- client-side `window.location.href = ...`
- "dispatch admin", "report URL", "share with moderator"

Record:

```text
Redirect endpoint:
Parameter:
Client-side or server-side:
Allowed host hint:
Admin/report feature:
```

## 3. Confirm Baseline Behavior

Test:

```text
https://example.com
https://trusted-host.example
/
```

Record:

```text
Blocked pattern:
Allowed pattern:
Status/Location:
Error text:
```

## 4. Test Allowlist Bypasses

If the app mentions an allowed host, test:

```text
https://allowed.host@collaborator
https://allowed.host.collaborator
https://collaborator/allowed.host
https://allowed.host%40collaborator
https://allowed.host%2f@collaborator
//allowed.host@collaborator
```

Record:

```text
Working bypass:
Location host:
Why validator failed:
```

## 5. Validate Real Browser Destination

Do not trust the Location header alone when userinfo is present.

Confirm:

```text
Validator-visible host:
Browser/navigator host:
Match: yes/no
```

## 6. Test Admin/report Workflow

If a bot only visits same-origin URLs, wrap the redirect:

```text
https://[host]/go?to=https://allowed.host@collaborator
```

Submit through report/admin API or form.

Record:

```text
Report endpoint:
Accepted wrapper URL:
Bot visited: yes/no
```

## 7. Capture Outbound Leakage

Inspect collaborator/webhook requests for:

- `flag`
- `token`
- `session`
- `code`
- `state`
- `auth`
- Referer headers

Record:

```text
Leak location:
Sensitive parameter:
Redacted summary:
```

## 8. Confirm Root Cause

Document separately:

```text
Substring or parser-confused allowlist enabled open redirect.
Privileged redirect path appended sensitive query data.
```

## 9. Fix Checklist

- Parse and normalize URLs before allowlist checks.
- Reject userinfo and dangerous encodings.
- Do not append secrets to redirect targets.
- Restrict admin bot destinations.

## 10. Decision Checklist

- [ ] Redirect parameter identified.
- [ ] Blocked and allowed destinations tested.
- [ ] Allowlist bypass confirmed.
- [ ] Real external navigation confirmed.
- [ ] Admin/report chain tested if available.
- [ ] Sensitive redirect leakage captured.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
