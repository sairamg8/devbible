---
name: devbible-memory-file-cap
description: Memory files are capped at 300 lines — past that, split into children and index them from the parent with a one-line "open this when" for each
metadata:
  type: feedback
---

Set by the user 2026-08-10, after `progress_site_and_node_syllabus.md` reached
**823 lines / 51.6 KB — 65% of the entire store** and they pointed out what that
costs a cold session.

## The rule

**No memory file exceeds 300 lines.** If the material genuinely needs more room,
it does not grow — it **splits into child files, and the parent indexes them**.
The parent carries a short line per child saying *what is in it and when to open
it*, so a session can decide what to read instead of loading everything.

This is deliberately the same cap `instructions.md` §6 puts on content pages. One
rule for the whole project, applied to its own notes.

## What goes in the parent

The parent is the file opened **every** session, so it holds only what is needed
every session:

- current state — what is done, what is next
- the resume handoff
- outstanding / deliberately-unfixed items
- standing rules and traps that prevent repeating a mistake
- the index of children

Anything opened *occasionally* belongs in a child.

## How to decide what to keep at all — before splitting

Splitting a file that should have been shorter just spreads the problem. Cut
first, using one test:

> **Is this fact already written in the repo?**

If yes, memory is duplicating the artifact and the entry goes. The pages *are*
the record of what was verified. What memory must hold is what the repo cannot
tell you:

- **decisions and their reasons** — including options rejected and why
- **dead ends and traps** — the three failed layout attempts, the stale dev
  server, the `./` link prefix
- **findings that corrected an already-written page** — these justify why a page
  disagrees with common advice, so they earn their space
- **the resume point**

Applying that test to the 823-line file removed ~400 lines of per-phase sandbox
findings that were simply restating the pages.

**Why:** A cold session loads the index plus the progress file before it does any
work. At 823 lines that is a large fixed tax on every session, paid whether or not
the content is relevant — and most of it was recoverable from the repo anyway.

**How to apply:** Check the line count before committing a memory edit. Past 300,
split by *how often the material is needed* — not by date, and not by chunking a
long file into equal pieces, which keeps the same total and adds navigation cost.
Then add the child to the parent's index and to `INDEX.md`.

**Keep `INDEX.md` lean too.** It is loaded every session, so its keyword lines are
a routine cost — a 60-keyword line for one phase is too long. Keywords should be
what someone would actually search on, not an exhaustive dump.

Related: [[devbible-incremental-scope]], [[devbible-progress]].
