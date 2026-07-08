# Session Token Disclosure

## Date

2026-06-06

## Target Type

Web application API

## Bug Class

Sensitive information disclosure, session management failure, authorization bypass through token reuse

## Initial Signal

An API endpoint returns user records with fields that look like active session identifiers:

```json
{
  "username": "user",
  "role": "customer",
  "token": "usr_[redacted]"
}
```

## Working Theory

If the disclosed token is accepted by the application as a session cookie or bearer token, the endpoint leaks account access, not just metadata.

## Trust Boundary

The session token is a server-side authentication secret. It must never cross into unauthenticated or low-privileged API responses.

## Minimal Reproduction

1. Request the suspected disclosure endpoint.
2. Identify whether returned token-like values are active session credentials.
3. Pick one token belonging to another user.
4. Send it only to a low-risk identity endpoint, such as `/api/profile`.
5. Confirm whether the returned identity changes.

Example:

```bash
curl -i https://[host]/api/users/logs
curl -i -H 'Cookie: token=usr_[redacted]' https://[host]/api/profile
```

## Why Failed Tests May Fail

- Random token tampering may be rejected if tokens are opaque server-side identifiers.
- Changing a token prefix, such as `usr_` to `adm_`, usually does not work unless the token format itself is trusted incorrectly.
- A server may reset invalid cookies to a default guest or customer token.

## Why Working Test Works

The leaked token is already valid. The attacker does not need to forge or decode it. They only need to replay it in the same location the app uses for authentication.

## Impact

Impact depends on whose token is leaked:

- Customer token: account takeover or cross-user data access.
- Admin token: privilege escalation and access to administrative data/actions.
- Many tokens: broad session compromise.

## Fix

- Never return session tokens in user listing, logs, debug, analytics, or support endpoints.
- Require authorization for log and user-management endpoints.
- Store only hashed or redacted token references in logs.
- Rotate exposed tokens immediately.
- Add `HttpOnly`, `Secure`, and suitable `SameSite` cookie flags.
- Add monitoring for token replay and unusual role changes.

## Regression Test

- Unauthenticated requests to sensitive log endpoints return `401` or `403`.
- Customer requests to sensitive log endpoints return `403`.
- Admin responses do not include raw session tokens.
- Replayed old exposed tokens no longer authenticate after rotation.

## Future Checklist Item

When an endpoint returns `token`, `session`, `sid`, `jwt`, `apiKey`, or similar fields, always test whether the value is active by using a safe identity endpoint like `/api/profile`.
