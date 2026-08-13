# Dev Bible — final re-review prompt

**This review produces a work order, not an opinion.** Its output must be specific enough
that a later session can execute every fix **without re-reading the page it describes**.
If a finding cannot be acted on from the review alone, it is not finished.

Run it as: **one language, one phase, one output file.**

---

## 0. Read before starting

1. `instructions.md` (repo root) — tiers, the three required ingredients, granularity,
   the 300-line cap.
2. `~/.claude/CLAUDE.md` — the hard rules. Auto-loaded; re-read the cap rule anyway.
3. **`docs/postgresql/pages/phase-5-joins/`** — the **calibration exemplar**, written to
   this bar. Specifically `01-inner-join/01-matching-pairs.md` and
   `01-inner-join/02-fan-out-and-aggregates.md`. A topic scoring 9–10 looks like those.
   A topic scoring 5 states the same facts in a third of the space.
4. The phase's **syllabus** file (`docs/<corpus>/syllabus/`) — you cannot judge coverage
   without it.

---

## 1. Persona and the three hard rules

**Persona:** staff-level fullstack engineer, 20+ years, has run Node, Express and
PostgreSQL in production and been paged for most of the failure modes in this corpus.
You are reviewing material a colleague will rely on *without* opening the official docs.

**Rule 1 — reviewer, not editor.** The only file you create is your review. Do not edit,
fix, reformat, delete, move or rename any page, script or config — not one word, not even
when certain. Wanted changes go in the review as exact replacement text.

**Rule 2 — one reviewer, one pass. No sub-agents.**

**Rule 3 — every claim carries a location.** No finding may say "the explanation is thin"
without `file:line`, the offending quote, and what specifically to add. See §4.

**Honesty line:** the header must state `Examples executed: yes / partially N of M / no`.

---

## 2. Unit of work

**One phase per run.** Read *every* topic page in the phase — not a sample. A phase is
20–30 pages; that is the right size for one pass and one file.

| Corpus | Path | Pages | Phases |
|---|---|---|---|
| Node | `docs/nodejs/pages/` | 232 | 13 |
| PostgreSQL | `docs/postgresql/pages/` | 235 | 14 |
| Express | `docs/expressjs/pages/` | 78 | 11 |

Chunked topics (`NN-topic/` directories) are **one topic**, scored once, with the chunk
split itself assessed as part of the structure score.

Pages that are still unwritten stamps get verdict `STAMP`, score `0`, and no further
analysis — list them and move on. They are not review findings.

---

## 3. The scoring rubric — every topic gets a score

Score five dimensions **0–10 each**, then a weighted composite. Use whole numbers.

| # | Dimension | Weight | 10 means | 5 means | 0 means |
|---|---|---|---|---|---|
| **D1** | **Explanation depth** | **35%** | Explains the *mechanism* — what the engine/runtime actually does — so the reader can predict unshown cases | States correct behaviour without the why | Wrong, or absent |
| **D2** | **Examples** | 20% | Runnable, complete, realistic names; both SQL and Node where both apply; output shown | Fragmentary or unrealistic; one context only | None, or `...` elisions |
| **D3** | **Gotchas** | 15% | Symptom → Cause → Fix, includes the "everyone gets bitten once" one | Present but generic, or missing the main one | Absent |
| **D4** | **Interview Q&A** | 15% | 3–8, `★` marked, answers survive a follow-up | Answers restate the one-liner | Absent or question-only |
| **D5** | **Provenance & accuracy** | 15% | `Verified:` names a real script; every number traceable; no confounded comparisons | Verified line present, some numbers unsourced | Invented output → **automatic topic verdict `WRONG`** |

**Composite** = D1×0.35 + D2×0.20 + D3×0.15 + D4×0.15 + D5×0.15, to one decimal.

**Verdict from composite:**

| Score | Verdict | Meaning |
|---|---|---|
| 8.5–10 | `SOLID` | Leave it alone. Say so and move on. |
| 7.0–8.4 | `MINOR-GAPS` | Good; specific additions listed |
| 5.0–6.9 | `THIN` | Correct but under-explained — the most common result |
| 3.0–4.9 | `NEEDS-EXPANSION` | Needs enough more that chunking is likely |
| 0.1–2.9 | `REWRITE` | Faster to rewrite than to patch |
| any | `WRONG` | Contains incorrect or fabricated content — overrides the number |
| 0 | `STAMP` | Not yet written |

**Calibration guard:** if more than 70% of a phase scores `SOLID`, you are being
generous — re-check D1 against the exemplar. If more than 70% scores below 5, you are
being harsh, or the phase genuinely predates the rewrite; say which.

---

## 4. The evidence rule — this is what makes the review usable

**Every dimension scored below 8 must produce at least one located, actionable entry.**
Format, without exception:

```
D1 6/10
  - docs/nodejs/pages/phase-2-async/04-event-loop.md:88
    Quote: "The microtask queue is drained before the next macrotask."
    Gap:   States the ordering but never says WHY — that the check happens after each
           macrotask completes, which is what makes a starving promise chain block I/O.
    Add:   ~25 lines: the drain loop, then the measured starvation demo from
           sandbox/node/ex12-loop.mjs (already exists, section 3), then the symptom
           ("server stops responding but CPU is at 100%").
```

Four fields, always: **location**, **quote**, **gap**, **add**.

**Banned outputs** — these waste the read and count as an incomplete review:

- "Could be more detailed", "needs more depth", "consider expanding" with no location.
- Restating what the page says back as if it were a finding.
- Generic advice that would apply to any page ("add more examples").
- Praise without a named strength.
- Recommending content that already exists elsewhere in the corpus without saying it
  should be *linked* rather than duplicated.

**"Add:" must state roughly how many lines and where the material comes from** — an
existing sandbox script and section, or "script needed: <what it must measure>".

---

## 5. Per-topic output block — copy this shape exactly

```markdown
### NN-topic-slug.md — <Title>
`TIER` · `VERDICT` · **7.3/10** · 214 lines · Verified: ex21-types-prepared.mjs ✅

**D1 Explanation 6** · D2 Examples 8 · D3 Gotchas 9 · D4 Q&A 7 · D5 Provenance 10

**What's good (do not lose this):** the `57014` vs client-timeout contrast is the
clearest in the corpus.

**Gaps**
1. `…/08-timeouts.md:112` — Quote: "…" — Gap: … — Add: ~20 lines, source: ex21 §4.
2. `…/08-timeouts.md:150` — Quote: "…" — Gap: … — Add: script needed — must measure …

**Q&A** 4 questions, 2 starred. Q3 fails the follow-up *"what happens to the connection
after the cancel?"* — answer stops at "the query errors". **Add 2:** (a) why
`query_timeout` leaves the statement running server-side; (b) which timeout to reach for
when the goal is protecting the pool.

**Explanation summary for pick-up:** the page teaches the five timeouts as a list. It
should teach them as a decision — *what are you protecting: the client, the server, or
the pool?* — then the list falls out. Restructure around that question; keep all existing
measured output.

**Chunking:** not needed (est. 260 lines after additions).
```

Every field is mandatory. `What's good` prevents a later rewrite destroying the parts that
work.

---

## 6. Coverage — check the phase, and check the language

This is a **required section**, not an optional extra. Scoring existing pages says nothing
about what is absent.

### 6a. Phase coverage

Compare the phase's pages against its syllabus file **and** against what a staff engineer
would expect to be taught in that phase. Report:

```markdown
## Missing topics — phase

| Proposed topic | Tier | Why it belongs here | Insert after | Est. lines |
|---|---|---|---|---|
| Connection lifecycle under PgBouncer | UNDERSTAND | Phase teaches prepared statements but never says they break under transaction pooling — the reader will hit this in any managed PG | 10-prepared.md | ~220 |
```

Also flag the reverse: **topics present that do not belong in this phase** (better placed
elsewhere, or duplicated from another corpus). Name the destination.

### 6b. Language-level coverage

Once per corpus — put it in the **phase 1** review file or a dedicated
`00-coverage.md` — assess whether the *language/technology itself* is fully covered by
the phase structure. Report:

- **Whole areas missing from the syllabus**, not just from a phase. Propose the phase they
  belong in, or a new phase with its topic list.
- **Phases whose scope has drifted** — the phase title no longer describes its contents.
- **Tier distribution**: count `MASTER` as a % of the corpus. The brief says 25–30%.
  Report the actual number and name the mis-tiered topics.
- **Ordering problems** — a topic that depends on one taught later.

Do not skip 6b because it is harder. A corpus that scores 8/10 per page and is missing an
entire area is not an 8/10 corpus.

---

## 7. Interview Q&A — specific checks

For every topic, report:

- **Count** and how many are `★`.
- **The follow-up test**: pick the weakest answer, state the follow-up a senior
  interviewer would ask, and say whether the answer survives. **Name the follow-up.**
- **Question quality**: "why" and "what happens if" beat "what is". Count how many are
  "what is" — more than one is a finding.
- **Whether answers are actually answers** — a question with a one-line restatement of the
  page's bold opener is a fail.
- **Specific additions**: when the count is under 3, or an area of the topic has no
  question, write the **exact questions to add**, with a one-line answer sketch each. Do
  not write "add more questions".

---

## 8. Explanation quality — the depth test (drives D1)

> Does it explain the mechanism, or only state the behaviour?

| Behaviour only (≤6) | Mechanism (9–10) |
|---|---|
| "A `WHERE` on the right table turns a LEFT JOIN into an inner join." | "`ON` is part of the FROM stage, so a failing left row is still NULL-extended. `WHERE` runs after, evaluates `NULL = 'paid'` → NULL, and keeps only `true` — discarding the row the join just manufactured." |
| "`NOT IN` is unsafe with NULLs." | "`x NOT IN (1,2,NULL)` expands to `x<>1 AND x<>2 AND x<>NULL`; the last is NULL for any x, so the chain is never true. `IN` is a chain of ORs where a NULL branch is harmless — which is why the bug survives review by people who checked that `IN` works." |

**The deciding question:** *after reading only this page, could the reader predict the
behaviour in a case the page does not show?* If they could only recall the stated fact,
D1 is ≤6.

Also required for D1, each answerable yes/no with a location:

- Does it show the failure with real output, not just describe it?
- Does it say when **not** to use the thing, and name the cost (`## Trade-off`)?
- Does it connect to the neighbouring topics, or float free?

**When D1 ≤ 7, the "Explanation summary for pick-up" field is mandatory** — one paragraph
naming the *reframing* that would fix it, not a list of missing facts. That paragraph is
what a later session acts on.

---

## 9. Length and chunking

**The 300-line cap is a file-size rule, never a content budget.** A topic may run 1000+
lines in total, split into files of ≤300 under a topic directory.

- **Never score a page higher because it is near 300 lines**, and never penalise a topic
  for needing more than one file.
- **Report the phase's line distribution**: min, median, p90, max, count over 300, chunked
  topics present.
- **State plainly whether the clustering tell is present** — files bunched in a narrow band
  just under the cap is evidence the phase was written to a budget rather than to the
  topic. This has been the single biggest defect in this corpus. Call it out by name.
- For every topic needing expansion past 300 lines, propose the **concept-boundary split**:
  directory name, chunk file names, one line on what goes in each. Never split on line
  count.

---

## 10. Provenance (drives D5)

- Does `> Verified:` name a script that **exists**?
- Does the console output match that script's shape and labels?
- Any numbers or error codes with **no** script behind them?
- **Confounded comparisons** — output that is real but proves nothing because the two
  sides differ in more than the variable: work hidden in one side's driving query, leaked
  session state, cold cache, wrong baseline. A benchmark whose "slow" side does work the
  "fast" side never has to do is measuring nothing. **Major.**

Invented output → topic verdict `WRONG`, regardless of composite.

---

## 11. Output

**One file per phase:**

```
docs/reviews/<corpus>/<phase-slug>/<YYYY-MM-DD>-<reviewer>.md
```

### Required structure

```markdown
# <Corpus> Phase N — <name> · review

| Field | Value |
|---|---|
| Reviewer / exact model | |
| Date | |
| Path | |
| Target runtime | |
| **Examples executed** | **yes / partially N of M / no** |
| Topics reviewed | N of N |
| **Phase score** | **6.4 / 10** |
| Verdict | |

## Verdict in three sentences
<what is good · the single highest-payoff fix · how much work it is>

## Scoreboard
| # | Topic | Tier | Lines | D1 | D2 | D3 | D4 | D5 | Score | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
(every topic, sorted by score ascending — worst first)

## Line distribution
min / median / p90 / max / over-300 / chunked topics / **clustering tell: yes-no**

## Per-topic reviews
(the §5 block for every topic scoring below 8.5; one line each for SOLID ones)

## Missing topics — phase          (§6a)
## Misplaced topics                (§6a)
## Coverage of the language        (§6b — phase 1 file or 00-coverage.md only)

## Work order — ranked by payoff
| # | Topic | Action | Est. lines | Needs a script? | Blocked by |
|---|---|---|---|---|---|
| 1 | 04-event-loop.md | Reframe around the drain loop; add starvation demo | +25 | no — ex12 §3 | — |

## What is already good
(named, so a later rewrite does not destroy it)
```

**The work-order table is the point of the whole document.** It must be executable top to
bottom by someone who has not read the pages.

**Per-corpus rollup:** after finishing a corpus, write
`docs/reviews/<corpus>/00-rollup-<YYYY-MM-DD>.md` — the phase scoreboard, corpus score,
tier distribution vs the 25–30% target, missing areas, and the ranked cross-phase work
order.

---

## 12. Order of work

1. **Express** — known-weakest, documented quality cliff, pages with invented output.
   Expect `WRONG` verdicts.
2. **Node Master-tier phases** — most-read, so depth pays most.
3. **PostgreSQL Phases 12, 13, 6, 9** — stamps and unwritten areas.
4. **PostgreSQL Phases 1–5, 7–11** — recently rewritten and measured. Expect `SOLID`;
   **say so rather than manufacturing findings.**

**After each phase: write the file, report the scoreboard and the top 5 work-order rows,
then stop.** Do not roll into the next phase unprompted.

---

## 13. Two ways this review fails

- **Manufacturing findings.** A padded review buries the real ones. If a page is good,
  score it, name its strength in one line, move on.
- **Vagueness.** Any finding without `file:line` + quote + concrete addition is not a
  finding. A review made of those is worse than no review, because it looks like work.

Do not modify any page. Do not commit. Report and stop.
