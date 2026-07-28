# Terraria chain notes (from Final Level N5Ud7mGgfq)

Date: 2026-07-18
Target type: CTF/lab

## Solved path so far

| Level | Path | Trick | Next |
|------:|------|-------|------|
| Final | `/N5Ud7mGgfq` | Open dirlist `/statics/images/next.txt` | `/EG0BUmDRTa` |
| 04 | `/EG0BUmDRTa` | Cookie `next-level` base64 | `/dG340U4a55` |
| 05 | `/dG340U4a55` | Response header `next-level` | `/2vhb8P9Z46` |
| 06 | `/2vhb8P9Z46` | Cookie `next-level=true` → redirect | `/8z1kI5f01e` |
| 07 | `/8z1kI5f01e` | JS index scramble `c[(d*b)%len]=a[d]` | `/hsrfAW4vcI` |
| 08 | `/hsrfAW4vcI` | MD5 `8f30e815…` = `iydot06Uaq` (rockyou) | `/iydot06Uaq` |
| 09 | `/iydot06Uaq` | AES-256-CBC with on-page key/IV | `/Ggjc1WJNJc` |
| 10 | `/Ggjc1WJNJc` | Extra `/statics/styles/level.css` comment | `/lrUXbanK3Y` |

## In progress

`/lrUXbanK3Y` and onward.
