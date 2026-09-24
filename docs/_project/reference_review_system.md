---
name: devbible-review-system
description: How a phase gets reviewed — the reusable prompt, output path convention, the read-only rule, and the Grok/Gemini adjudication that set the calibration bar
metadata:
  type: reference
---

Child of [[devbible-progress]]. **Open only when running or judging a review.**

## The prompt lives in the repo

**`docs/reviews/review-prompt.md`** — reusable for **any** language and phase. Read it
rather than reconstructing it from here; this file records only what the prompt cannot
tell you.

**Rewritten 2026-08-13 (the "final re-review" prompt).** The user deleted every earlier
review under `docs/reviews/` and asked for one prompt covering all three corpora. The new
version keeps the persona, the read-only rule, the no-sub-agents rule and the
"Examples executed" honesty line, and adds what the old one lacked:

- **The depth test is now the main event** — mechanism vs behaviour, with a three-row
  worked contrast table and the deciding question: *could the reader predict the
  behaviour in a case the page does not show?*
- **Question (f): name one thing a staff engineer would expect that is missing** — with
  an explicit instruction not to invent a gap to look thorough.
- **A section on length that forbids using line count as a proxy for depth**, in both
  directions, and requires reporting the clustering tell (files bunched just under the
  cap = written to a budget).
- **Confounded measurements** promoted to a named Major, alongside invented output.
- **Calibration exemplar:** `docs/postgresql/pages/phase-5-joins/`, written to this bar
  on 2026-08-13, including three chunked Master topics.
- Per-page verdicts (`SOLID`/`THIN`/`NEEDS-EXPANSION`/`WRONG`/`STAMP`) and a required
  line-length distribution per phase.
- A closing section on the review's own failure modes: manufacturing findings, and
  passing a page because it is long.

**Revised again the same day**, after the user's objection that a review which only says
"needs improvement" wastes time and usage. The prompt is now specified to produce a
**work order, not an opinion** — executable by a later session without re-reading the
pages it describes:

- **A five-dimension rubric scored 0–10 per topic**, weighted into a composite:
  D1 explanation depth 35%, D2 examples 20%, D3 gotchas 15%, D4 interview Q&A 15%,
  D5 provenance 15%. Verdict bands `SOLID` / `MINOR-GAPS` / `THIN` / `NEEDS-EXPANSION` /
  `REWRITE` / `WRONG` / `STAMP`, with a calibration guard at 70% either way.
- **The evidence rule:** any dimension under 8 must yield entries of exactly four fields —
  **location, quote, gap, add** — where "add" states the line estimate and the source
  (existing sandbox script + section, or "script needed: <what it must measure>").
  Vague verdicts are listed as **banned outputs**.
- **A mandatory "Explanation summary for pick-up"** whenever D1 ≤ 7: one paragraph naming
  the *reframing* that fixes the page, not a list of missing facts. This is the field that
  makes the review resumable.
- **Coverage is now a required section, at two levels** — 6a missing/misplaced topics per
  phase (with tier, rationale, insert point, line estimate) and 6b coverage of the
  *language itself*: whole areas absent from the syllabus, drifted phase scope, tier
  distribution against the 25–30% MASTER target, ordering problems.
- **Q&A checks are specific:** count, star count, the named follow-up the weakest answer
  fails, how many are "what is" questions, and the **exact questions to add** with answer
  sketches.
- **"What's good (do not lose this)"** per topic, so a later rewrite does not destroy the
  working parts.
- **A ranked work-order table** per phase — topic, action, est. lines, needs-a-script,
  blocked-by — plus a per-corpus rollup at `docs/reviews/<corpus>/00-rollup-<date>.md`.
- Unit of work is **one language, one phase, one file**, reading every page in the phase
  rather than sampling.

Reviewer persona is a **staff-level fullstack engineer, 20+ years**. The prompt
restates the brief's own bar — the three required ingredients, the 300-line cap,
tier definitions, Active-LTS targeting, scope boundaries — so a reviewer judges
against the project's rules rather than its own taste.

## Output convention

```
docs/reviews/<language>/<phase-slug>/<YYYY-MM-DD>-<reviewer>.md
```

`<reviewer>` is `claude` | `grok` | `chatgpt` | `gemini` | `human-<name>`. Set by
the user so several reviewers can be compared side by side. Every review opens with
a header table naming reviewer and exact model, date, paths, target runtime,
**"Examples executed: yes / partially N of M / no"**, phase score and verdict.

That execution line is an **honesty forcing function** — a review that did not run
the code must not read like one that did. It is what exposed Gemini below.

## Two hard rules, both set by the user

**The reviewer is not an editor.** The only file it may create is its own review.
No editing or "fixing" any page, syllabus, config or `instructions.md` — even a
one-word fix, even when certain. No deleting, moving or renaming; no scratch files
inside the repo; nothing that mutates. Wanted changes go in as proposed fixes with
exact replacement text, and the author decides what lands. *Why:* a review that
silently edits what it reviews cannot be checked, and a dated record must describe
a state that still exists.

**No sub-agents — one reviewer, one pass.** Fan-out loses the calibration rules and
leaves nobody accountable for the verdict.

## The purpose test is the spine

The bible is a *fullstack developer's reference, not an encyclopedia*, so every
topic is judged on outcome, twice:

- **Work-ready** — after reading only this page, could a fullstack developer use the
  concept at its tier without opening the docs? Needs real fullstack context, the
  libraries it is used with, failure modes as symptom → cause → fix, when *not* to
  use it, and the trade-off. A missing "everyone gets bitten by this once" gotcha is
  a **Major**.
- **Interview-ready** — could they survive a senior interviewer's follow-ups? The
  reviewer must name the follow-up an answer fails.
- **Scope, both directions** — missing-but-needed *and* present-but-not-needed,
  reported as noise with its line count.

Binding consequences: **a topic cannot score 4–5 unless both are yes**; a missing
everyday gotcha caps at 3; a `Master` page the reader still needs the docs for is
marked down; a proposed addition without the task or interview question it blocks is
"not a proposal, a wish".

## The Phase 0 adjudication — why the calibration exists

`docs/reviews/nodejs/phase-0-runtime-model/accepted-review-claude.md`.
**Grok accepted (4.2/5). Gemini rejected (4.9/5).**

Gemini's header claimed *"all 14 snippets executed"*. The first snippet on page 08
disproves that in ten seconds — it prints `[]` where the page's own next sentence
says a flag should appear. Gemini scored that page 5/5. **An execution claim that
does not survive contact with an unexecuted snippet invalidates every other
verification in the review**, which is why it was discarded rather than merged.

Worse, its single finding was misdiagnosed as a labelling nit and **its proposed fix
would have made the page worse** — expanding the six branches prints +41%…+111%
directly beneath a paragraph asserting "About 8%".

Supporting signals of a low-effort review: nine of ten pages at a flat 5, every
"Missing topics" answered "None" with an empty table, and a line count matching no
file in the tree.

**The lesson, now written into the prompt's calibration section** and consistent
with [[devbible-audit-external-reviews]]: reviews have been confidently wrong
before. Verify findings against the brief and by re-running before applying any of
them. One finding that reproduces beats nine that flatter.

**Also rejected — from the accepted review:** Grok's suggestion to soften
`04:20-23`'s "full stop". Correct on OS trivia, wrong for an Understand-tier
teaching sentence about *portable* APIs. Keep the absolute. And Grok's note that
`util.parseArgs()` on `06-globals.md:42` belongs to Phase 5 is **explicitly not a
finding** — carried forward so no later pass "fixes" it.

## `/code-review ultra` — the diff-based review, first run 2026-08-13

**A second, different mechanism from the rubric prompt above.** The rubric review
reads *pages* and tests depth; ultra reads a *diff* and hunts correctness. Both are
needed; neither replaces the other.

**Mechanics that cost a session to learn:**

- It takes a **branch or a PR number** — not a path, not the working tree. The
  no-arg form diffs the current branch against `main` and needs **no remote**
  (devbible has none).
- It is **user-triggered and billed.** Claude cannot launch it.
- **The branch must actually be ahead of `main`.** Session 10 merged everything to
  `main` first and had to split the commit back out — infrastructure commit on
  `main`, content commit on a `pg-phases-9-12` branch — to have anything to diff.
- **Split the commit before reviewing.** Putting the 271 newly-tracked sandbox
  files in a separate commit on `main` kept the review focused on 49 content files
  instead of 320.

**Result of the first run — 3 findings, all valid, all nits:**

| Finding | What it was |
|---|---|
| `progress.js` phase 12 left at `pages: 0` | Real. Phase 9 was bumped in the same commit; the symmetric change was forgotten, so six written topics scored zero on the progress bar. |
| `api_key → apiKey → api_key` given as a **failed** round-trip | Real and sharp. Start and end are identical — that is a *success*. Only the digit case (`oauth2_token → oauth_2_token`) genuinely fails. Wrong in three places. |
| "one statement, so there is no window" then two statements shown | Real. The prose contradicted itself two lines later. |

**The lesson worth keeping: two of the three were prose contradicting the code
block beneath it** — the same failure mode
[[devbible-verify-your-own-measurements]] tracks, and the same one that was caught
six times *during* writing in that session. So the in-session checks catch most of
it and an external diff review still found three more. **Run ultra per phase while
the phase is still its own branch.**

The fix for the third finding was written as a real data-modifying CTE and
**verified against the sandbox before shipping** rather than reasoned about:
correct version → `updated`, stale → `conflict` with the winning version, missing
row → zero rows (the 404).

## Open

`docs/nodejs/reviews/syllabus-review.md` predates this convention and still sits
per-language, so two review homes coexist. **Do not tidy this unilaterally** — the
per-language placement was an explicit user choice one turn earlier.
