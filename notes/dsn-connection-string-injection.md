# DSN Connection String Injection

## Date

2026-06-10

## Target Type

Database admin tools, connection setup pages, importers, data connectors, SaaS integrations, and internal tooling that accepts user-controlled database connection settings

## Bug Class

Connection-string injection caused by passing user-controlled input into DSN or native driver grammar

## Initial Signal

A user-controlled field influences a database connection string:

```text
server
host
hostname
data source
dsn
connection string
database URL
socket
port
```

The application appears to ask for a hostname, but later concatenates it into a richer driver-specific grammar.

## Pattern

The bug exists when the application and the downstream driver disagree about what the input means.

```text
HTTP parameter
-> application parser / validator
-> DSN builder
-> native driver connection-string parser
-> filesystem / network / authentication side effect
```

In the Adminer MSSQL case:

```text
Application assumption: 127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1 is a server string.
ODBC interpretation: server 127.0.0.1 plus TraceFile and TraceOn options.
```

## Common Dangerous Delimiters

Check the target driver grammar before testing. Common metacharacters include:

```text
;
{}
=
newline
carriage return
@
:
,
?
&
```

For SQL Server ODBC-style strings, semicolon is the key option delimiter:

```text
Server=host;Option=value;Option2=value
```

## Investigation Workflow

1. Identify the user-controlled connection fields.
2. Find the exact code that builds the DSN or connection string.
3. Determine whether the field is parsed as a host, URL, DSN, JDBC string, ODBC string, or key-value connection string.
4. Compare the application parser with the driver parser.
5. Identify options with security-relevant side effects, such as tracing, local file paths, loading plugins, authentication mode changes, TLS toggles, or redirect/failover behavior.
6. Test one option at a time.
7. Use a harmless observable side effect first, such as a connection error that names the driver.
8. Confirm file write or network behavior only in authorized targets.
9. Reduce to the smallest reproducible proof.
10. Write a regression test that verifies validation happens before driver construction.

## Evidence To Record

```text
Input field:
Input value:
Application parser:
Constructed DSN:
Driver/parser:
Option injected:
Side effect:
Error message:
File/network evidence:
Required extensions:
Required filesystem permissions:
```

## Why Payloads Fail

Common failure reasons:

- The application validates a strict host and numeric port.
- The application rejects semicolons or driver metacharacters.
- The vulnerable driver extension is not loaded.
- A safer non-PDO/native branch is used instead of the vulnerable DSN path.
- The driver rejects the injected option.
- The target path is not writable.
- The side effect happens in a different process context than expected.
- The request never reaches the driver because login/session state is missing.

## Safe Fix

- Treat host and port as structured data, not connection-string fragments.
- Reject driver metacharacters in fields that are supposed to be hostnames.
- Build DSNs with known-safe templates and strict allowlists.
- Prefer APIs that keep options separate from host strings.
- Validate before calling native driver constructors.
- Add negative tests for injected options relevant to every enabled driver.

## Future Checklist Item

For any database connection form, draw this path before payload testing:

```text
source field -> local parsing -> DSN construction -> driver parser -> side effect
```

Then test whether a delimiter changes the driver's interpretation.
