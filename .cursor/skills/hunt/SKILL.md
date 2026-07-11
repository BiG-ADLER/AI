---
name: hunt
description: Reads workspace Cursor rules and AGENTS.md before any action, change, or workflow step. Use at the start of every task, prompt, or follow-up in this workspace, and whenever the user invokes /hunt or asks to follow AGENTS.md or project rules.
---

# Read Rules and AGENTS.md

Before doing any changes, or any step, read the rules and along side read the @AGENTS.md AGENTS.md file

## Required order

On every prompt — before tools, edits, commands, or answers:

1. Read all applicable rules in `.cursor/rules/` (use the Read tool if not already in context this turn).
2. Read [AGENTS.md](/home/arman/Ai/AGENTS.md) (use the Read tool if not already in context this turn).
3. Then proceed with the user's request.

Re-read both when the task shifts (new bug class, new target, file edits in reusable dirs, or authorization is unclear).

## From AGENTS.md — apply immediately

- **Workflow:** observation → hypothesis → evidence → test → result → conclusion → next step
- **Wording:** confirmed / likely / possible / unknown — never mix assumption with proven behavior
- **Directories:** `labs/` = active work; `writeups/`, `notes/`, `payloads/`, `checklists/`, `reports/` = reusable — do not edit without explicit user approval
- **Authorization:** require CTF/lab/owned/in-scope bounty context before live-target exploitation guidance; if unclear, notify the user first, then continue with safe analysis only

## When in doubt

Re-read `.cursor/rules/` and AGENTS.md before analysis, findings, or file changes.
