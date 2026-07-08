# Northstar Portal robots.txt Backup Leak

## What Is Happening

The Northstar Portal lab presents a harmless public support board, but the launch bulletin explicitly mentions AI crawler support and asks reviewers to inspect paths robots are told to skip.

Following that hint leads from `robots.txt` to an exposed backup directory and a downloadable legacy export containing an internal admin handoff token.

## Why It Happens

The operator added crawler rules for AI bots but also left a custom rule:

```text
User-agent: *
Disallow: /backups/
```

That path was never removed before launch. `robots.txt` discourages crawling; it does not block direct HTTP access. The `/backups/` directory also had listing enabled, making `portal-backup.zip` trivial to discover once the disallow path is tested.

## Exact Test

Fetch crawler rules:

```bash
curl -sS https://02818c1928a8.pwnbox-lab.com/robots.txt
```

Request the disallowed path:

```bash
curl -sS https://02818c1928a8.pwnbox-lab.com/backups/
```

Download and inspect the archive:

```bash
curl -sSO https://02818c1928a8.pwnbox-lab.com/backups/portal-backup.zip
unzip -l portal-backup.zip
unzip -o portal-backup.zip
cat internal-notes.txt exports/users.json .env.old
```

## Expected Signal

- `robots.txt` contains `Disallow: /backups/`.
- `/backups/` returns HTML directory listing, not SPA fallback.
- `portal-backup.zip` downloads without authentication.
- `internal-notes.txt` contains a `pwnbox{...}` token labeled as a retired admin handoff token.

## Result Interpretation

Confirmed bug chain:

```text
On-page hint about robots.txt
-> Disallow path discovery
-> open backup directory
-> legacy export download
-> sensitive internal token disclosure
```

## Root Cause

Information disclosure through an exposed legacy backup archive under the public web root. The security failure is leaving operational exports web-accessible, not merely listing them in `robots.txt`.

## Impact

- Disclosure of retired admin handoff token / flag material.
- Exposure of user export metadata.
- Exposure of old environment configuration.
- Confirms pre-launch cleanup was incomplete.

## Fix

- Remove all backup and export artifacts from public web roots before launch.
- Disable directory listing on any remaining static paths.
- Move archives to authenticated private storage.
- Scan staging and production for common backup names and paths.
- Do not treat `robots.txt` as an access-control mechanism.

## Key Lesson

When a target mentions robots, crawlers, or skipped paths, read `robots.txt` and manually request every disallowed path. Crawler exclusion is a hint for recon, not a protection layer.

## Flag

`pwnbox{191279a6d61d758cb988de4e5772d71a}`
