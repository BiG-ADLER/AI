# Flag File SSRF Local File Read

## What Is Happening

The Flag File lab exposes a staff URL preview feature at `/fetch`. The server retrieves the submitted URL and displays the fetched content to the user.

The page states the flag lives locally at `/flag.txt`, which suggests the fetcher may support filesystem access rather than only remote HTTP.

## Why It Happens

The application passes user-controlled URLs to a server-side fetch routine without restricting allowed schemes. Submitting `file:///flag.txt` causes the server to read a local file and return its contents in the preview panel.

This is SSRF in the broad sense: the attacker steers a server-side fetcher to an unintended resource, here the local filesystem instead of a remote website.

## Exact Test

Baseline remote fetch:

```bash
curl -sS -X POST "https://8b034e625be0.pwnbox-lab.com/fetch" \
  -d "url=https://example.com/"
```

Local file read:

```bash
curl -sS -X POST "https://8b034e625be0.pwnbox-lab.com/fetch" \
  -d "url=file:///flag.txt"
```

## Expected Signal

- External URL returns something like `HTTP 200 OK` and remote HTML.
- `file:///flag.txt` returns a status such as `file read: /flag.txt`.
- The `<pre>` block contains the flag instead of HTML.

## Result Interpretation

Confirmed bug chain:

```text
User-controlled url
-> server-side fetch
-> file:// accepted
-> local /flag.txt read
-> contents reflected to client
```

## Root Cause

Missing scheme allowlist on a server-side URL fetcher.

## Impact

- Read local files accessible to the fetch process.
- In other apps, the same primitive may reach internal HTTP services, metadata endpoints, or admin panels.
- Reflected fetch output makes exploitation direct rather than blind.

## Fix

- Restrict outbound fetchers to `http://` and `https://` only.
- Parse with a strict URL library and reject unsupported schemes before fetch.
- Block private, loopback, link-local, and metadata IP ranges after DNS resolution.
- Avoid returning raw fetched content from sensitive destinations.

## Key Lesson

When a lab mentions a local file path, test `file://` early on URL fetch/preview endpoints before spending time on localhost parser bypasses.

## Flag

`pwnbox{9e1f42c7a8d603b5f4c2e709a1b86d35}`
