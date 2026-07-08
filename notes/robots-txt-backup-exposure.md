# robots.txt Backup Exposure

## Date

2026-07-08

## Target Type

Web application static content / launch misconfiguration

## Bug Class

Information disclosure, exposed backup archive, directory listing, security-through-obscurity failure

## Initial Signal

A public page mentions:

- AI crawler support
- a new or updated `robots.txt`
- paths robots should skip
- legacy exports or backups under review

That wording often means a disallowed path still exists on the server.

## Working Theory

`robots.txt` `Disallow` entries reveal paths the operator considers sensitive enough to hide from crawlers. Those paths are frequently still directly reachable because robots rules are voluntary for clients and unrelated to server authorization.

## Trust Boundary

Operational exports, backups, admin artifacts, and internal notes must not be served from the public web root. Crawler policy is outside the authorization boundary and must not be treated as protection.

## Minimal Reproduction

1. Fetch `/robots.txt`.
2. Collect all `Disallow` paths, including site-specific rules below managed blocks.
3. Request each path directly with normal HTTP.
4. Check for directory listings, backup filenames, and downloadable archives.
5. Inspect archive contents for credentials, tokens, env files, exports, or notes.

Example:

```bash
curl -sS https://[host]/robots.txt
curl -sS https://[host]/backups/
curl -sSO https://[host]/backups/portal-backup.zip
unzip -l portal-backup.zip
```

## Why Failed Tests May Fail

- Some `Disallow` paths may truly be removed and return `404`.
- A path may exist but deny listing while still exposing guessable filenames.
- Backup content may be encrypted or empty in hardened environments.
- Managed bot blocks at the top of `robots.txt` may distract from a small custom rule at the bottom.

## Why Working Test Works

The operator often uses `Disallow` to keep search engines and AI crawlers away from leftover staging or backup content. If that content was never moved to private storage, a direct GET still succeeds because no server-side access control was applied.

## Common Sensitive Archive Contents

- `.env`, `.env.old`, `.env.bak`
- `config.json`, `settings.yml`
- `users.json`, `accounts.csv`
- `internal-notes.txt`, `README.backup`
- `portal-backup.zip`, `site.zip`, `www.zip`
- SQL dumps and export folders

## Impact

Impact depends on archive contents:

- Retired tokens or admin handoff secrets
- User/account exports
- Old credentials and environment values
- Internal operational notes
- Evidence of incomplete launch cleanup

## Fix

- Remove backup and export files from public web roots.
- Disable directory listing globally or per sensitive path.
- Store archives in private buckets with authentication.
- Add pre-launch scans for common backup paths and filenames.
- Treat `robots.txt` as crawl guidance only.

## Regression Test

- No backup/export paths return `200` from the public internet.
- Directory listing is disabled where not explicitly required.
- Pre-release scanners fail if files like `*.zip`, `*.sql`, `.env*`, or `/backups/` exist in web roots.
- Security review explicitly checks every `Disallow` path in `robots.txt`.

## Future Checklist Item

If the UI, launch notes, or status page mentions robots, crawlers, or skipped paths, fetch `robots.txt` immediately and manually browse every disallowed path.
