# DSN Connection String Injection Checklist

## Goal

Prove whether user-controlled connection settings can inject driver options into a DSN or native connection string.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the exact endpoint and authorization basis.
- Do not copy live secrets, tokens, cookies, flags, or private target URLs into reusable files.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Identify The Source

Find fields that influence database connection setup:

- `server`
- `host`
- `hostname`
- `port`
- `database`
- `dsn`
- `connectionString`
- `jdbcUrl`
- `dataSource`
- `socket`

Record:

```text
Endpoint:
Parameter:
Expected format:
Driver selected:
Authentication flow:
```

## 3. Find The DSN Builder

Locate the code that turns fields into a driver call:

```text
new PDO(...)
odbc_connect(...)
sqlsrv_connect(...)
DriverManager.getConnection(...)
database/sql Open(...)
```

Record:

```text
Source field:
Constructed string:
Driver/API:
Relevant branch:
Required extension/library:
```

## 4. Compare Parsers

Separate the application's interpretation from the driver's interpretation.

Record:

```text
Input:
Application sees:
Driver sees:
Delimiter:
Injected option:
Expected side effect:
```

Common parser boundaries:

- ODBC semicolon key-value options.
- JDBC URL query parameters.
- PostgreSQL keyword/value connection strings.
- MySQL client option files or local infile toggles.
- MongoDB URI options.

## 5. Test One Option At A Time

Start with a harmless observable signal:

- driver-specific error message
- timeout from a known host
- TLS option behavior
- trace/log path in a local lab
- rejected option name

Avoid jumping straight to code execution. First prove the driver parser consumed the injected option.

## 6. Confirm Side Effect

For file-write primitives, record:

```text
Path:
Writable by:
Content control:
Exact or substring content:
Readback method:
Gate/log evidence:
```

For network primitives, record:

```text
Destination:
DNS behavior:
Socket destination:
Proxy behavior:
Redirect/failover behavior:
```

## 7. Account For Session And Redirects

Connection setup tools often use multi-step login flows.

Check:

- Are credentials stored in a session before redirect?
- Does the redirected request need the same cookie jar?
- Is there a CSRF token on the connection request?
- Is the driver call made on POST or on the redirected GET?

Record:

```text
Initial request:
Redirect:
Cookies required:
Observed driver error:
```

## 8. Confirm Impact Minimally

Use the smallest proof that demonstrates the security boundary break:

```text
write marker to lab-watched path
write trace to controlled temp path
trigger benign outbound connection
toggle a visible connection option
```

Record:

```text
Precondition:
Request:
Response:
Impact:
Limitations:
```

## 9. Fix Checklist

- Treat connection settings as structured data.
- Strictly validate hostnames, IP literals, sockets, and numeric ports.
- Reject driver metacharacters in fields that are not supposed to contain driver syntax.
- Avoid concatenating raw input into DSN strings.
- Prefer structured driver options.
- Validate before native driver construction.
- Add negative tests for each enabled driver's connection-string grammar.

## Decision Checklist

- [ ] Source field is identified.
- [ ] DSN construction code is located.
- [ ] Driver/API branch is confirmed.
- [ ] Application parser and driver parser are separated.
- [ ] Dangerous delimiter is identified.
- [ ] Injected option is driver-documented or empirically confirmed.
- [ ] Side effect is confirmed with evidence.
- [ ] Failed attempts are explained.
- [ ] Fix validates before driver construction.
- [ ] Reusable notes are redacted.
