---
name: use-api
description: Calls the L30 Tools API on l30on.top for Keeper, Subkeeper, OAST, and Downloader automation. Use when the user invokes /use-api, mentions l30 Tools API, l30on.top API keys, needs to host payloads, poll OAST interactions, read keeper/subkeeper logs, or automate security-lab infrastructure without browser cookies.
---

# Use API

Use the **L30 Tools API** for automation against `l30on.top`. Do not use browser gate cookies (`oh-shit`) or legacy `/keeper-api/*` session routes when this skill applies.

## Before any API call

1. Read [api.md](/home/arman/Ai/api.md) when endpoint details, scopes, or error handling are unclear.
2. Load secrets from the workspace `.env` at `/home/arman/Ai/.env`.
3. Never print, commit, or copy secrets into notes, writeups, payloads, or chat output.

## Credentials

Load from `.env`:

| Variable | Purpose |
|----------|---------|
| `L30_TOOLS_API_TOKEN` | Preferred. Full bearer token: `<keyId>.<secret>` |
| `L30_API_KEY_ID` | Alternative split auth: public key ID |
| `L30_API_SECRET` | Alternative split auth: secret |
| `L30_TOOLS_API_BASE` | Optional override. Default: `https://l30on.top/api/v2/tools` |

Auth header (preferred):

```http
Authorization: Bearer <keyId>.<secret>
```

Alternative:

```http
X-API-Key-Id: <keyId>
X-API-Secret: <secret>
```

## Tool picker

| Need | API | Scope |
|------|-----|-------|
| Path-based sink `https://l30on.top/k/<path>` | Keeper | `keeper:write` / `keeper:read` |
| Subdomain host `https://<sub>.l30on.top/` | Subkeeper | `subkeeper:write` / `subkeeper:read` |
| Out-of-band callbacks (SSRF, blind XSS, etc.) | OAST | `oast:write` / `oast:read` |
| Fetch remote file to server disk | Downloader | `downloader:fetch` / `downloader:read` |
| HTTP hits on keeper sinks | Keeper logs | `keeper:logs` |

## Default workflow

```text
1. Load .env credentials
2. Pick service (keeper / subkeeper / oast / downloader)
3. Create resource (entry, session, job)
4. Use public URL or payload in exploit
5. Poll logs or OAST interactions for proof
6. Report result with redacted evidence
```

## Quick examples

### Subkeeper exploit host

```bash
source /home/arman/Ai/.env 2>/dev/null || true
curl -sS -X POST "${L30_TOOLS_API_BASE:-https://l30on.top/api/v2/tools}/subkeeper/entries" \
  -H "Authorization: Bearer ${L30_TOOLS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"subdomain":"labx","content":"<!doctype html>...","content_type":"text/html"}'
```

Live URL: `https://labx.l30on.top/`

### OAST session + poll

```bash
SESSION=$(curl -sS -X POST "$BASE/oast/sessions" \
  -H "Authorization: Bearer $L30_TOOLS_API_TOKEN" \
  -H "Content-Type: application/json" -d '{}')
SESSION_ID=$(echo "$SESSION" | jq -r .id)
PAYLOAD=$(echo "$SESSION" | jq -r .payload)

curl -sS -H "Authorization: Bearer $L30_TOOLS_API_TOKEN" \
  "$BASE/oast/interactions?session_id=$SESSION_ID"
```

Poll every 1–5s until `new_interactions` is non-empty.

### Keeper logs

```bash
curl -sS -H "Authorization: Bearer $L30_TOOLS_API_TOKEN" \
  "${L30_TOOLS_API_BASE}/keeper/logs?q=<needle>&limit=50"
```

## Python pattern

```python
import os
from pathlib import Path
import requests

def load_dotenv(path="/home/arman/Ai/.env"):
    if not Path(path).exists():
        return
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"\''))

load_dotenv()
BASE = os.getenv("L30_TOOLS_API_BASE", "https://l30on.top/api/v2/tools")
TOKEN = os.getenv("L30_TOOLS_API_TOKEN")
if not TOKEN:
    kid, sec = os.getenv("L30_API_KEY_ID"), os.getenv("L30_API_SECRET")
    TOKEN = f"{kid}.{sec}" if kid and sec else None
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

r = requests.post(f"{BASE}/subkeeper/entries", headers=HEADERS, json={
    "subdomain": "labx",
    "content": "<!doctype html><script>...</script>",
    "content_type": "text/html",
}, timeout=20)
r.raise_for_status()
```

Or run the helper:

```bash
python /home/arman/Ai/.cursor/skills/use-api/scripts/api_request.py POST /subkeeper/entries \
  --json '{"subdomain":"labx","content":"test","content_type":"text/html"}'
```

## Error handling

| Code | Action |
|------|--------|
| `401` | Check `.env` token format (`keyId.secret`) |
| `403` | Missing scope or IP not on identity allowlist |
| `429` | Back off and retry |
| `502` | Upstream timeout; retry once |

Include `X-Request-Id` from responses when debugging.

## Rules

- Prefer **Tools API** over browser UI automation for hosting, logging, and OAST.
- Use **Keeper** for path sinks (`/k/...`), **Subkeeper** for subdomains.
- Use **OAST** when the target cannot call your hosted page directly.
- Do not store live flags, cookies, or tokens in reusable KB files.
- For full endpoint reference, scopes, and workflows: [api.md](/home/arman/Ai/api.md)
- For condensed tables: [reference.md](reference.md)

## Additional resources

- Full API reference: [api.md](/home/arman/Ai/api.md)
- Quick endpoint table: [reference.md](reference.md)
- Request helper: [scripts/api_request.py](scripts/api_request.py)
