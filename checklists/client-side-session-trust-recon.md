# Client-Side Session Trust Recon Checklist

## Goal

Determine whether an application stores authorization claims in the browser and later trusts them for privileged server-side decisions.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, endpoints, and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Login endpoint:
Privileged endpoint:
Date:
```

## 2. Map The Login Flow

Identify:

- where credentials are submitted
- what the success response contains
- whether the browser stores the whole response
- whether cookies, `localStorage`, or `sessionStorage` are used
- whether a **remember-me** checkbox triggers client-side cookie construction

Record:

```text
Login method:
Login body shape:
Response JSON:
Browser storage key:
Remember-me present: yes/no
Remember-me built in JS: yes/no
Server-side session cookie present: yes/no
```

## 2b. Remember-Me / MD5 Cookie Construction (when present)

If login HTML or JS references `md5`, `calcMD5`, `rc`, or hidden key fields:

- [ ] Extract any key/expiry/username from hidden inputs or `localStorage`
- [ ] Reconstruct `rc` / remember cookie formula against your own account
- [ ] Check whether the key is shared across users
- [ ] Enumerate other user ids/usernames (IDOR on profile/info APIs)
- [ ] Forge victim `userid` + `username` + MAC cookie and hit `/login` or auto-restore

See: `notes/remember-me-client-md5-cookie-forge.md`, `payloads/auth/remember-me-md5-rc-cookie-forge.md`

## 3. Map The Privileged Request Path

Find:

- dashboard/staff/admin pages
- API requests made after login
- custom headers such as `X-Session`, `X-User`, `X-Role`

Record:

```text
Protected page:
Protected API:
Header/body carrying session:
Exact client-side source:
```

## 4. Confirm Baseline Low Privilege

Use the normal low-privilege session and request the protected endpoint.

Record:

```text
Control session:
Response status:
Denied message:
```

## 5. Mutate Claims One Field At A Time

Change only one property per test:

```text
role: guest -> staff
role: guest -> admin
user: guest -> admin
isAdmin: false -> true
permissions: ["read"] -> ["admin"]
```

Record:

```text
Mutated field:
Payload:
Response status:
Protected content revealed:
```

## 6. Separate Storage From Trust

Document clearly:

```text
Client stores role:
Client replays role:
Server verifies integrity: yes/no
Accepted privileged value:
```

## 7. Minimal Proof

Prefer one read-only privileged endpoint proving the bypass.

Examples:

- staff profile
- admin status
- feature flag list
- lab flag endpoint

## 8. Fix Checklist

- Move authorization state server-side.
- Use signed, verified tokens if client-carried state is necessary.
- Ignore mutable client role fields for authorization decisions.
- Use HttpOnly, Secure cookies for session identifiers.

## Decision Checklist

- [ ] Login flow mapped.
- [ ] Browser storage location identified.
- [ ] Remember-me / client MAC cookie checked if present.
- [ ] Protected request path identified.
- [ ] Low-privilege control confirmed.
- [ ] One-field mutation tested.
- [ ] Privileged access confirmed or ruled out.
- [ ] Root cause documented as client-side trust.
- [ ] Reusable notes exclude live secrets.
