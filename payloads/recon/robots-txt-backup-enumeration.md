# robots.txt Backup Enumeration

## Context

Use this when a target mentions robots/crawler rules, export cleanup, legacy backups, or archive drawers that should not be public.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Fetch robots.txt

```bash
curl -i -sS -L https://[host]/robots.txt
```

Look for site-specific rules, especially near the bottom:

```text
User-agent: *
Disallow: /backups/
```

## Request Disallowed Paths Directly

```bash
curl -i -sS -L https://[host]/backups/
curl -i -sS -L https://[host]/backups/portal-backup.zip
```

Useful signals:

- HTML directory listing
- downloadable zip/tar/sql files
- `200` on paths meant to be hidden from crawlers

## Compare Against SPA Fallback

```bash
curl -i -sS -L https://[host]/definitely-not-a-real-route
```

Confirm the sensitive path is not just generic app-shell HTML.

## Inspect Archive Contents

Save outside reusable notes:

```bash
curl -sSO https://[host]/backups/portal-backup.zip
unzip -l portal-backup.zip
unzip -o portal-backup.zip -d /tmp/[host]-backup
rg -i 'token|password|secret|admin|handoff|flag|pwnbox|internal' /tmp/[host]-backup
```

Common filenames:

```text
.env.old
internal-notes.txt
exports/users.json
config.bak
dump.sql
```

## Common Backup Path Wordlist

```text
/backups/
/backup/
/export/
/exports/
/archive/
/old/
/legacy/
/tmp/
/private/
/internal/
/admin-backup/
/portal-backup.zip
/site.zip
/www.zip
/backup.zip
/db.sql
/dump.sql
/.env.old
```

## Why This Works

Operators often add `Disallow` rules to keep crawlers away from leftover staging or backup content. That does not remove the files from the web root or enforce authentication.

## Common Mistake

Assuming `Disallow` means the path is inaccessible. Robots rules are crawl hints, not server-side access controls.

## Minimal Impact Validation

If an archive contains a token labeled retired/admin/handoff:

1. Record the finding.
2. Treat it as disclosure unless the lab explicitly requires replay against an auth endpoint.
3. Redact the value in reusable notes.
