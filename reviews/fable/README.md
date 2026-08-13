# PostgreSQL — review · Fable

| Field | Value |
|---|---|
| Reviewer | Claude Fable 5 (`claude-fable-5`) |
| Date | 2026-08-13 |
| Corpus | `docs/postgresql/` — syllabus (4 parts, 229 topics) + pages (228 topics, 269 files, 55 128 lines) |
| Server used | **PostgreSQL 18.4** live at `127.0.0.1:55432` (`devbible-pg`, `postgres:18-alpine`) |
| **Claims executed** | **yes** — every factual correction in [03-accuracy-findings.md](03-accuracy-findings.md) was run against that server; every line/tier count was computed, not estimated |
| Topics read in full | 10 · partially 2 · structurally measured 228 |
| **Corpus verdict** | **Strong. One factual error, one structural defect, twelve stamps.** |

> **Two formats, same review.** This is the full version, split by concern. There is also a
> condensed two-file version — [simplified/postgresql-review.md](simplified/postgresql-review.md) (findings and
> ratings) and [simplified/postgresql-syllabus-and-plan.md](simplified/postgresql-syllabus-and-plan.md)
> (syllabus, scenarios, work order) — covering the same ground in half the space. Keep
> whichever you prefer; nothing is unique to one.

---

## Verdict in five sentences

The written PostgreSQL corpus is the best material in this repo — the Phase 5, 6, 9, 11
and 12 pages explain *mechanism*, not behaviour, and would survive a senior interviewer's
follow-up. The syllabus is well-tiered (26.3% Master, inside the 25–30% band) and its
fullstack alignment is genuinely high; almost nothing in it is DBA trivia. But **the corpus
is split into two quality strata by a rule you have since corrected**: Master-tier topics
in phases that were chunked run **382–1470 lines**, while Master-tier topics in the eight
phases that were never chunked run **142–292** — `count(*) vs count(col)` gets 821 lines
and `EXPLAIN` gets 186. One page states a fact about PostgreSQL 18 that is **wrong**, and I
proved it wrong on your own server. Twelve Phase 13 pages are identical 66-line templates
that carry Gotchas and Interview headings, so they pass every structural check while
containing nothing.

---

## The five findings, ranked

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | **`EXPLAIN` (Master) is 186 lines; `GROUP BY` (Master) is 1470.** Eight phases were written to the 300-line cap read as a content budget | [02-the-cap-and-depth.md](02-the-cap-and-depth.md) | **Structural — the big one** |
| 2 | **`MERGE … RETURNING` and `merge_action()` work on PG 18.** The page says seven times that they do not, and builds its central recommendation on that error | [03-accuracy-findings.md](03-accuracy-findings.md) | **Wrong** |
| 3 | **Twelve Phase 13 pages are template stamps** with boilerplate that contradicts its own topic | [03-accuracy-findings.md](03-accuracy-findings.md) | High |
| 4 | **Phase 0 averages 116 lines/topic and contains a confounded measurement** presented as evidence for shared buffers | [03-accuracy-findings.md](03-accuracy-findings.md) | High |
| 5 | **Four real-world patterns absent from the syllabus** — transactional outbox, multi-tenancy as a decision, audit/history tables, money modelling | [01-syllabus-review.md](01-syllabus-review.md) | Medium |

---

## Your seven questions, answered

| Ask | Answer | Detail |
|---|---|---|
| **1.** Verify the syllabus | Structurally sound. 229 syllabus topics vs 228 pages — one merge, and it is the wrong merge | [01-syllabus-review.md](01-syllabus-review.md) |
| **2.** Does each part serve the fullstack goal ≥90%? | **Yes — ~93%.** Non-fullstack content is small and already tiered down. The gap is what's *missing*, not what's present | [01-syllabus-review.md](01-syllabus-review.md) |
| **3a.** 100% accurate? | **No.** One page is materially wrong; one measurement is confounded; twelve are empty | [03-accuracy-findings.md](03-accuracy-findings.md) |
| **3b.** Gotchas covered? | **Yes, and they are the corpus's strongest feature.** 100% of pages carry a Gotchas section in symptom→cause→fix form | [04-ratings.md](04-ratings.md) |
| **3c.** Useful interview Q&A, not random? | **Mostly yes.** Phases 2–12 pass the follow-up test. Phase 0 and the stamps fail it — they ask "what is" and answer with the page's own opening line | [04-ratings.md](04-ratings.md) |
| **3d.** Rate the explanations | 10 topics scored in full — 0 (stamp), 3.7 worst written, 9.7 best | [04-ratings.md](04-ratings.md) |
| **3e.** Where is it wrong — explicitly | Four located errors with exact replacement text | [03-accuracy-findings.md](03-accuracy-findings.md) |
| **3f.** Depth vs the 300-line cap | **This is the main defect.** Measured, with the phase-by-phase split | [02-the-cap-and-depth.md](02-the-cap-and-depth.md) |
| **3g.** Real-world scenarios | 12 project scenarios mapped to syllabus phases, with the coverage gaps each exposes | [05-real-world-scenarios.md](05-real-world-scenarios.md) |

**Executable fix list:** [06-work-order.md](06-work-order.md) — ranked by payoff, top to bottom.

---

## What is already good — do not lose this in any rewrite

- **`phase-11-mvcc/06-isolation-levels.md`** is the best page in the repo. It measures
  SERIALIZABLE at 12.4 s against 71 ms for ordered `FOR UPDATE`, then *argues against its
  own benchmark* — naming the backoff as part of the cost and refusing to predict a
  smaller-pool result it did not measure. That intellectual honesty is rare and is
  exactly what your global rule 3 asks for.
- **`phase-10-indexes/05-index-not-used.md`** — five causes, each measured, and it names
  the one where the planner is *right*. The `enable_seqscan = off` framing as a
  diagnostic rather than a fix is the correct senior instinct.
- **`phase-3-ddl/03-foreign-keys.md`** — the `NO ACTION` vs `RESTRICT` distinction shown
  through deferral is a genuine insight most references get wrong by calling them
  synonyms.
- **`phase-2-types/07-uuid.md`** — attributes the v4 cost to B-tree locality rather than
  the 8 extra bytes, and proves it with the v7 number in between.
- **The example policy** (SQL + the `pg` call that issues it) is enforced consistently
  and is what makes this a fullstack reference rather than a database manual.
- **Every page has Gotchas and Interview sections.** 269 of 269. That discipline held.

---

## Scope note

Reviewer, not editor — **no page, script or config was modified.** Every proposed change
appears here as exact replacement text. The only files created are those in this
directory.

The one thing I did do to the system: ran read-only `SELECT`/`MERGE` statements against
temporary tables in the live `devbible` sandbox database to verify the PostgreSQL 18
claims. `CREATE TEMP TABLE` only; nothing persistent was touched.
