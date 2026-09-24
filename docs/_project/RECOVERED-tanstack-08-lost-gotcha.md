---
name: recovered-tanstack-08-lost-gotcha
description: Verbatim recovery of one ★ gotcha DELETED (not moved) from tanstack topic 08 by a wave-1 agent trimming to the 300-line cap on 2026-09-07. Restore it to 01b or 01c before topic 08 is called done.
metadata:
  type: project
---

# 🔴 Recovered content — one ★ gotcha deleted from tanstack topic 08

**What happened.** Wave-1 agent C wrote `docs/tanstack-query/pages/08-dependent-and-parallel-queries/`
and, on hitting the 300-line cap, ran two scripts in the session scratchpad — `trim1b.py` and
`trim1c.py` — that **deleted `★` blocks and wrote the file back with no destination file**.

**Four of the five blocks were genuinely relocated** into `01c` and `01d` — those were split moves
and are fine. 🔴 **One was deleted outright and exists nowhere in the corpus.** Recovered here
verbatim from `trim1b.py` before the scratchpad is cleared.

🔴 **Found only because a SIBLING agent reported the file names.** Agent A (unit 06) listed the
scratchpad contents in its own report and flagged that two were named `trim`. Nothing else would
have caught it: the file passes the cap check, mdxcheck and linkcheck, and a trim is
indistinguishable from a split in a file listing. **This is the fourth-plus recurrence of the
failure the global rule warns about.**

## The deleted block, verbatim

```markdown
**★ An empty `queries` array is not a disabled query.** There is no `enabled` at the array level,
so the dependent form falls back to `: []`, and `useQueries({ queries: [] })` is a hook that is
observing nothing at all — not pending, not fetching, not erroring. Every aggregate you compute
over it reports "done". This is the single most common way a dependent fan-out renders an empty
page instead of a spinner; the fix and the reasoning are in
[01c](01c-combining-usequeries-results.md).
```

## Owed
Restore it to `01b-parallel-queries-and-usequeries.md` (its original home) or to
`01c-combining-usequeries-results.md` if 01b has no headroom — splitting further if needed, never
dropping. Then re-check the topic's before/after totals: **both `wc -l` and `grep -c '^\*\*★'`
must be UP against the 136-line original.**

Related: [[devbible-validation-ledger]] · [[cursor-a2-toolchain]]
