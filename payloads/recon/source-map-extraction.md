# Source Map Extraction

## Context

Use this when a JavaScript-heavy app serves built assets and may expose production source maps.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Find JavaScript Assets

```bash
curl -i -sS -L https://[host]/
```

Look for:

```html
<script type="module" src="/assets/index-[hash].js"></script>
```

## Check Matching Source Map

```bash
curl -i -sS -L https://[host]/assets/index-[hash].js.map
```

Expected useful signal:

```json
{
  "version": 3,
  "sources": ["../../src/api/endpoints.ts"],
  "sourcesContent": ["export const ..."]
}
```

## Extract App Source With Node

Save the map outside reusable notes:

```bash
curl -sS -L -o /tmp/app.js.map https://[host]/assets/index-[hash].js.map
```

Extract source entries:

```bash
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('/tmp/app.js.map','utf8')); m.sources.forEach((s,i)=>{ if(s.includes('/src/')) console.log('\\n===== '+s+' =====\\n'+(m.sourcesContent?.[i]||'')); })"
```

## Search Terms

Search extracted source for:

```text
/api/
admin
debug
logs
users
profile
token
session
role
flag
internal
TODO
```

## Validate Endpoint Is Real

Avoid false positives from SPA fallback:

```bash
curl -i -sS -L https://[host]/api/suspected/path
curl -i -sS -L https://[host]/definitely-not-a-real-route
```

Compare:

- status code
- `Content-Type`
- response body
- API JSON error vs app shell HTML

## Minimal Auth Test Pattern

Use safe read-only endpoints first:

```bash
curl -i -sS -L https://[host]/api/suspected/path
curl -i -sS -L -H 'Cookie: token=invalid' https://[host]/api/suspected/path
curl -i -sS -L -H 'Cookie: token=[redacted-valid-token]' https://[host]/api/profile
```

## Why This Works

The production JavaScript may not contain unused constants because bundlers remove unused code. The source map may still include original `sourcesContent`, which can reveal unused endpoint constants or comments.

## Common Mistake

Trying to open paths from `sources` directly:

```text
../../src/main.tsx
```

Those are build-time labels, not public web paths. Read the code from `sourcesContent` instead.
