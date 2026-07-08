# robots.txt Disclosure Recon Checklist

## Goal

Find sensitive paths hinted by crawler rules and confirm whether disallowed locations are still publicly reachable.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Read On-Page Hints First

Search the homepage and launch/status content for:

- robots
- crawler
- AI bot
- skip paths
- export cleanup
- legacy backup
- archive drawer
- not linked from public menu

Record:

```text
Hint text:
Likely next artifact:
```

## 3. Fetch robots.txt

```bash
curl -i -sS -L https://[host]/robots.txt
```

Check:

- site-specific `Disallow` rules
- custom rules below managed/provider blocks
- `Allow` overrides
- sitemap references
- comments that mention internal paths

Record:

```text
Custom Disallow paths:
Sitemap URLs:
Notable comments:
```

## 4. Test Every Disallow Path Directly

For each disallowed path:

```bash
curl -i -sS -L https://[host]/backups/
curl -i -sS -L https://[host]/backups/portal-backup.zip
```

Compare against a random nonexistent path to avoid SPA false positives.

Record:

```text
Path:
Status:
Content-Type:
Listing or file:
Auth required: yes/no
```

## 5. Hunt Backup And Export Patterns

If listing is enabled or filenames are guessable, also test:

```text
/backups/
/backup/
/export/
/exports/
/archive/
/old/
/tmp/
/.env
/.env.old
/config.bak
/site.zip
/www.zip
/portal-backup.zip
/db.sql
/dump.sql
```

Record:

```text
Path:
Response:
Filename:
Size:
```

## 6. Inspect Downloaded Archives Safely

Save artifacts outside reusable notes:

```bash
curl -sSO https://[host]/backups/portal-backup.zip
unzip -l portal-backup.zip
unzip -o portal-backup.zip -d /tmp/[host]-backup
```

Search extracted files for:

```text
token
password
secret
admin
handoff
flag
pwnbox
.env
users
internal
```

Record:

```text
Archive file:
Interesting member files:
Sensitive data type:
Redacted summary:
```

## 7. Separate Hint From Root Cause

Do not report `robots.txt` exposure alone as the vulnerability unless the file itself contains secrets.

Example:

```text
robots.txt made /backups/ easier to find.
The confirmed bug is a publicly reachable legacy backup archive.
```

## 8. Confirm Impact

Determine what the leaked artifact enables:

- direct flag/token disclosure
- credential reuse
- user export access
- environment/config disclosure
- evidence of incomplete launch cleanup

Record:

```text
Leaked data type:
Replay needed: yes/no
Impact:
Limitations:
```

## 9. Fix Checklist

- Remove backup/export files from public web roots.
- Disable directory listing.
- Move archives to authenticated private storage.
- Scan releases for common backup paths and filenames.
- Do not rely on `robots.txt` for confidentiality.

## 10. Decision Checklist

- [ ] On-page hint or lab description checked.
- [ ] `robots.txt` fetched and parsed.
- [ ] Every custom `Disallow` path tested manually.
- [ ] Backup/archive filenames enumerated.
- [ ] Downloaded artifacts inspected.
- [ ] Root cause separated from recon convenience.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
