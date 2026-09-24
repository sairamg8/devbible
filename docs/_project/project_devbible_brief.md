---
name: devbible-brief
description: The standing brief for the Dev Bible — scope, priority tiers, granularity rule, 300-line cap
metadata:
  type: project
---

A central fullstack reference covering **MERN and PERN**, at
`/mnt/Storage/Backup/Knowledge/devbible` (outside the `my-learning/` tree). Started
2026-08-09. The authoritative copy of this brief is `instructions.md` in that project
root — keep the two in step.

**Stack in scope:** CSS (flexbox, grid, 2026 features) · JavaScript (custom functions,
Web APIs, DSA) · TypeScript · React (current to Aug 2026) · Node.js · MongoDB ·
PostgreSQL · Express · Docker & Podman · Redis · Nginx.

**Every topic carries one of four priority tiers** — about effort allocation, not
importance:

| Tier | Bar |
|---|---|
| Must Learn & Master | Use confidently with no documentation open |
| Must Understand | Know how it works; looking up signatures is fine |
| Should Know | Know what, why, and when; details on demand |
| Learn When Needed | Don't study upfront |

**Every concept must contain:** runnable code examples · interview questions **with
answers** (3–8, prefer "why"/"what happens if", `★` the common ones) · gotchas and
pitfalls written **symptom → cause → fix**, symptom first.

**Granularity:** one topic per file, where a topic is a *concept*, not a *symbol*.
Group things only meaningful together (arithmetic operators are one page, not one per
operator). Grouping reduces noise, never coverage — every member still gets its own
example and gotcha.

**Hard cap: 300 lines per file.** Beyond that, chunk on concept boundaries into
multiple files with an index and prev/next links; ~1000 lines total per topic is the
ceiling before it becomes its own section.

**Runtime target: the current Active LTS, not the newest release.** Node 24 until
October 2026, then 26. Set by the user 2026-08-09. Notes must not use an API the target
LTS lacks. Facts *about* the newer line (release tables, what is coming) still belong in
the notes — it is the build target that stays on LTS. The same rule extends to the other
ten technologies as they are written.

**Run every example before pasting it.** Timings, error text and command output in the
notes are real, produced on the target runtime — not written from memory. This is
stronger than the brief's "verify version-sensitive facts" line and it repeatedly
changed what got written.

**Why:** The user wants a reference they return to for years, not a tutorial — so
lookup structure, honest tiering, and small files matter more than volume. Stale or
invented output would poison exactly that.

**How to apply:** Write syllabus first, get it approved, then notes. See
[[devbible-progress]] for build state and [[devbible-palette]] for the UI.
