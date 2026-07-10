# Velvet `window.name` Admin Bot Index

## Purpose

Quick index for the solved Velvet lab and the reusable artifacts extracted from it.

## Solved Lab Record

- Raw investigation note: `labs/2026-07-09-velvet-xss-waf-charset-admin-bot.md`

## Clean Writeup

- Final walkthrough: `writeups/velvet-js-string-breakout-window-name-admin-bot.md`

## Reusable Knowledge

- Reusable concept note: `notes/javascript-string-breakout-window-name-bot-exfil.md`
- Reusable payload pattern: `payloads/xss/window-name-admin-bot-exfil.md`
- Updated process checklist: `checklists/admin-bot-xss-recon.md`

## Report Artifact

- Report-style draft: `reports/velvet-reflected-xss-window-name-admin-bot.md`

## Core Pattern

```text
Reflected input in JavaScript string
-> strict WAF blocks normal XSS syntax
-> minimal breakout payload still possible
-> document.cookie copied into window.name
-> top-level cross-origin navigation
-> attacker page reads window.name
-> same-site request log captures secret
```

## Retrieval Hints

Use this index when looking for:

- JavaScript-string breakout under restrictive character filters
- `window.name` as a cross-origin data carrier
- admin bot exfiltration without `+`, `?`, `:`, or `()`
- helper-host logging patterns for bot-driven XSS labs
