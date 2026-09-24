---
name: devbible-depth-audit-prompt
description: The reusable prompt for auditing whether existing pages were sized to the 300-line cap instead of written to full depth, and chunking the ones that were
metadata:
  type: reference
---

# Depth audit — the prompt

Written 2026-08-13 after PostgreSQL Phase 5 was found to have been written as 13 flat
files of 171–210 lines: sized to the budget rather than written out and chunked. The same
suspicion applies to the Node, Express and earlier PostgreSQL corpora.

**This is an audit prompt, not a quality-review prompt.** For quality, use
`docs/reviews/review-prompt.md` and [[devbible-review-system]]. This one asks a single
narrower question: *was this topic explained as fully as it deserves, and if not, is the
cap the reason?*

Sibling of [[devbible-never-compress-to-fit-cap]], which carries the rule itself.

## Why an audit step, not a rewrite

The Node corpus was measured on 2026-08-12 and found **not** systematically compressed —
median 205 lines, p90 262, one file over cap out of 245. That is a similar band to the
Phase 5 files that *were* too thin, which proves the point below: **line count alone
cannot decide this.** A 205-line page may be complete or may be half a topic. Only the
content test separates them, so the audit must read pages, not just count them.

Rewriting three corpora blind would be enormous and mostly wasted. Audit, report, get the
list approved, then rewrite phase by phase — [[devbible-incremental-scope]].

## The prompt

```text
Audit the devbible corpora for topics that were written to fit the 300-line file cap
instead of being written to full depth and chunked.

CONTEXT YOU ALREADY HAVE: the root MEMORY.md "Non-negotiables" section states the rule.
Re-read it, plus devbible/feedback_never_compress_to_fit_cap.md, before starting.
The short version: the cap is per FILE, never a content budget. A topic may run 1000+
lines in total, split across files of <=300 under a topic directory. Never trim to fit.

SCOPE: docs/nodejs/pages/, docs/express/, docs/postgresql/pages/.

STEP 1 — MEASURE (cheap, do it first)
For every phase in all three corpora, report: file count, median lines, p90, min, max,
count over 300, and the number of topic directories (chunked topics) already present.
Flag any phase whose files cluster in a narrow band under the cap — that pattern is
evidence of budgeting, not of natural topic length.

STEP 2 — CONTENT TEST (this is the real test; line count only ranks what to read first)
Sample at least 5 pages per phase, weighted toward Master and Understand tiers and toward
the phases flagged in step 1. For each, answer:
  a) Does it explain the MECHANISM, or only state the behaviour? ("X happens" vs "X
     happens because the executor does Y before Z")
  b) Are the gotchas symptom/cause/fix, and is the "everyone gets bitten once" one there?
  c) Do the interview answers survive one follow-up, or do they restate the one-liner?
  d) Is there measured console output for every claim, from a named sandbox script?
  e) Name at least one thing a staff engineer would expect that is MISSING.
If (e) is empty for a page, that page is fine regardless of its length.

STEP 3 — REPORT, THEN STOP
Produce a single table: phase | files | median | verdict (OK / THIN / CHUNK-NEEDED) |
what is missing | estimated target line count | proposed chunk split on concept
boundaries. Rank by payoff: Master-tier topics in high-traffic phases first.

DO NOT rewrite anything in step 1-3. This step is read-only apart from your report.
Write the report to docs/reviews/depth-audit/<YYYY-MM-DD>-claude.md and report back with
the summary table and your top 10 recommendations. I will approve which phases to expand.

STEP 4 — ONLY AFTER I APPROVE, per phase, one phase at a time:
  - Write each topic to the depth it deserves. Do not target a line count.
  - Split anything over 300 on a concept boundary into NN-topic/ with _category_.json,
    a README.md index (tier badge, Verified line, one-liner, chunk table, phase gate,
    "Where this connects"), and NN-chunk.md parts. Every chunk repeats the tier badge and
    Verified line and carries its own Gotchas and Interview questions.
  - LINK FORMS, both required and easy to get wrong:
      directory index -> drop the numeric prefix, end with /   e.g. ../inner-join/
      file inside it  -> keep BOTH prefixes, end with .md      e.g. ../01-inner-join/02-fan-out.md
    Mnemonic: drop the prefix only when the link ends in "/". Never bulk-sed these.
    Fix inbound links in the phase README and in neighbouring footers when converting.
  - Never invent console output. Every number and error string comes from a script in the
    sandbox. If no script covers a claim, write the script and run it. A written script is
    not a verified one - run it.
  - Verify any measurement that could be confounded before it ships (shared session, work
    hidden in the driving query, wrong baseline).
  - Update src/data/progress.js, then clean rebuild and grep:
      rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'
    grep exit 1 = clean. A green [SUCCESS] proves NOTHING.
  - Then stop and report before starting the next phase.

Commit only in /mnt/Storage/my-learning/claude/. devbible itself needs an explicit
instruction naming the change.
```

## Notes for whoever runs it

- **Expect step 1 to be misleading on its own.** Node's median of 205 was previously read
  as "fine" and Phase 5's 171–210 as "too thin". Same band, different verdicts. Step 2
  decides.
- **Master-tier topics are where the payoff is.** Phase 5's three Master topics went from
  ~180 lines each to ~500 across 3 files; the Understand-tier pages needed far less.
- **Express is the known-weakest corpus** — see [[devbible-express-verification]] for the
  quality cliff and the four pages with invented console output. A depth audit there will
  overlap with work already scoped; read that file before auditing Express.
- Budget: the audit is cheap, the rewrite is not. Phase 5 alone was 3874 lines.

Related: [[devbible-never-compress-to-fit-cap]] · [[devbible-review-system]] ·
[[devbible-incremental-scope]] · [[devbible-postgresql-rewrite-handoff]] ·
[[devbible-express-verification]]
