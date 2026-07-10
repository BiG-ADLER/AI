# L30 Tools API — Quick Reference

Base URL: `https://l30on.top/api/v2/tools`

Auth: `Authorization: Bearer <keyId>.<secret>`

## Scopes

| Scope | Access |
|-------|--------|
| `keeper:read` / `keeper:write` / `keeper:logs` | Path sinks at `/k/<path>` |
| `subkeeper:read` / `subkeeper:write` | Subdomains at `<sub>.l30on.top` |
| `oast:read` / `oast:write` | OAST sessions, payloads, interactions |
| `downloader:read` / `downloader:write` / `downloader:fetch` | Remote URL fetch + file mgmt |

## Endpoints

| Method | Path | Scope |
|--------|------|-------|
| `GET` | `/keeper/entries` | `keeper:read` |
| `GET` | `/keeper/entries/:id` | `keeper:read` |
| `POST` | `/keeper/entries` | `keeper:write` |
| `PUT` | `/keeper/entries/:id` | `keeper:write` |
| `DELETE` | `/keeper/entries/:id` | `keeper:write` |
| `GET` | `/keeper/logs?q=&limit=` | `keeper:logs` |
| `GET` | `/subkeeper/entries` | `subkeeper:read` |
| `GET` | `/subkeeper/entries/:id` | `subkeeper:read` |
| `POST` | `/subkeeper/entries` | `subkeeper:write` |
| `PUT` | `/subkeeper/entries/:id` | `subkeeper:write` |
| `DELETE` | `/subkeeper/entries/:id` | `subkeeper:write` |
| `POST` | `/oast/sessions` | `oast:write` |
| `GET` | `/oast/sessions` | `oast:read` |
| `DELETE` | `/oast/sessions/:id` | `oast:write` |
| `POST` | `/oast/payloads` | `oast:write` |
| `GET` | `/oast/interactions?session_id=` | `oast:read` |
| `POST` | `/downloader/jobs` | `downloader:fetch` |
| `GET` | `/downloader/files` | `downloader:read` |
| `GET` | `/downloader/storage` | `downloader:read` |
| `DELETE` | `/downloader/files/:filename` | `downloader:write` |

## Public URLs after create

| Service | Pattern |
|---------|---------|
| Keeper | `https://l30on.top/k/<path>` |
| Subkeeper | `https://<subdomain>.l30on.top/` |
| OAST | Value of `payload` from `POST /oast/sessions` |

## Create bodies

**Keeper**
```json
{"path":"probe","content":"hello","content_type":"text/plain","headers":{}}
```

**Subkeeper**
```json
{"subdomain":"cb","content":"<html>...</html>","content_type":"text/html","headers":{}}
```

**OAST session**
```json
{}
```

**Downloader job**
```json
{"url":"https://example.com/file.pdf"}
```

## Browser API vs Tools API

| | Browser APIs | Tools API |
|--|-------------|-----------|
| Auth | Gate cookie + session | API key |
| Keeper | `/keeper-api/*` | `/api/v2/tools/keeper/*` |
| Subkeeper | `/subkeeper-api/*` | `/api/v2/tools/subkeeper/*` |
| OAST | `/oast-api/*` (client crypto) | `/api/v2/tools/oast/*` (server crypto) |

Full docs: [api.md](/home/arman/Ai/api.md)
