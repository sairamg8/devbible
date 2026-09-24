---
name: devbible-fable-postgresql-review
description: The Fable rubric review of the whole PostgreSQL corpus (2026-08-13) — the measured proof for item 14's re-split, one new factual error verified on the server (MERGE RETURNING works on PG18), the ★ inflation, and where the review files live
metadata:
  type: reference
---

# Fable's PostgreSQL corpus review — 2026-08-13

The **first rubric-style pass across all 14 PostgreSQL phases**, filling the gap
[[devbible-postgresql-review-remediation]] names: *"the per-phase rubric review has not
been run for any phase; phases 12, 13, 6 and 9 were not read at all."*

Open this when picking up item 14, when touching `phase-4-crud/13-merge.md` or Phase 0, or
before running another review so you do not re-derive the corpus-wide numbers.

**Where it lives:** `reviews/fable/` in the devbible repo root — *not* under `docs/`, so it
is outside the Docusaurus build. Two formats of the same review:
`README.md` + `01`–`06` (long, split by concern) and `simplified/` (two files). Both
within the 300-line cap, links verified.

## What is new versus everything already reviewed

### 1 · `MERGE … RETURNING` works on PostgreSQL 18 — ✅ **FIXED 2026-08-13**

**Re-verified independently before the fix** with a new script,
`sandbox/pg-api/ex55-merge-returning.mjs`, on `devbible-pg` (`server_version_num =
180004`). The review was right and the page was wrong. Beyond what the review found:

- `select merge_action()` outside a MERGE → **`42601 MERGE_ACTION() can only be used in
  the RETURNING list of a MERGE command`** — it is legal in exactly one position
- **PG18 `old.` / `new.` aliases work in a MERGE RETURNING.** `old.qty` is `null` on the
  INSERT row — a *weaker* branch signal than `merge_action()`, because a genuine
  pre-existing NULL is indistinguishable from "there was no old row"
- **`RETURNING` on the DELETE branch yields the PRE-state** (measured `qty: 20`), since a
  deleted row has no post-state
- `rowCount` is 3 with no split, and the `MERGE` **command tag carries no split either** —
  `merge_action()` is the only source of the breakdown

**The fix was a rewrite, not a find/replace** — the page's recommendation was *built on*
the false claim. At 310 lines it went over the cap and became a chunked directory:
`13-merge/` = `01-three-actions` (154) · `02-returning-and-merge-action` (156) ·
`03-vs-on-conflict` (137) + README (45). **199 → 447 lines.** Six inbound links repointed
to `13-merge/README.md`. Phase 4 is now **22/22**. ★ went from 6-of-6 to 3-of-9.

The original finding, for the record:

`docs/postgresql/pages/phase-4-crud/13-merge.md` claimed **seven times** (lines 41, 88, 90,
107, 125, 148–150, 177, 194) that `MERGE` has no `RETURNING` in PG18, and builds its
central "`ON CONFLICT` in request handlers, `MERGE` in batch jobs" recommendation on it.

**Verified false on `devbible-pg` (18.4).** `RETURNING` + `merge_action()` landed in
**PostgreSQL 17**:

```
MERGE … RETURNING merge_action(), t.id, t.v;
 merge_action | id |  v
 UPDATE       |  1 | new
 INSERT       |  3 | add
```

`merge_action()` also gives the per-row insert-vs-update breakdown the page says at :41 is
impossible — better than the `ON CONFLICT … RETURNING (xmax = 0)` trick it recommends at
:88. **PG17 also added `WHEN NOT MATCHED BY SOURCE`** (verified: returns
`UPDATE`/`INSERT`/`DELETE`), which the page never mentions despite :95–98 describing the
exact reconciliation case that needs it — its proxy `WHEN MATCHED AND s.v IS NULL THEN
DELETE` only fires for rows that *are* in the source.

**The core argument survives and should be kept:** `MERGE` is not index-arbitrated and
`ON CONFLICT` is, so `MERGE` is still wrong for concurrent upsert. Only the `RETURNING`
claim needs surgery. Exact replacement text is in the review, §2 / finding 1.

This is the **only** version error in the corpus. I swept every `PostgreSQL 1[0-9]` claim;
PG18 skip scan, `uuidv7()`, the generic-plan switch on the 6th execution and the two
distinct `40001` messages are all correct.

### 2 · Item 14 now has its measurement

The re-split was known-outstanding but never quantified. It is not a judgement call:

| Master topics where the phase chunks | Master topics where it does not |
|---|---|
| `phase-6/01-group-by/` **1470** | `phase-10/03-explain.md` **186** |
| `phase-6/02-count-variants/` **821** | `phase-10/01-what-index.md` **169** |
| `phase-9/01-repository/` **758** | `phase-11/03-read-committed.md` **170** |
| `phase-5/01-inner-join/` **563** | `phase-2/04-timestamptz.md` **220** |

**Median Master topic: 530 lines chunked, 220 unchunked.** `count(*)` vs `count(col)` gets
821 lines; `EXPLAIN` gets 186. Across 269 files: min 66, median 226, p90 273, **max 299,
zero over 300**. Eight phases (0, 1, 2, 3, 4, 7, 10, 11 — 132 topics, 58% of the corpus)
contain **not one** chunked topic; Phase 6 chunked 16 of 16.

**The nuance that matters and that a rewrite would destroy:** the capped pages are *good*.
`03-foreign-keys.md` (226) and `05-index-not-used.md` (260) scored 9.2 and 9.4. They are as
good as 220 lines allows. Do **not** rewrite those phases — chunk only the named topics.

Priority splits, concept boundaries: `03-explain.md` (→ ~620), `03-read-committed.md`
(→ ~480), `04-timestamptz.md` (→ ~520), `06-on-conflict.md` (→ ~500).

### 3 · The ★ marker has inflated to uselessness

Corpus-wide: **1452 interview questions, 5.3/page, zero pages under 3, 14.2% "what is"
openers — and 1077 starred, 74%.** The brief says mark the *frequently-asked* ones. At 74%
the star identifies "questions", not a subset. Same failure the tier rule names
(*"if everything is MASTER, the labels carry no information"*) — and the tiers are
disciplined at 26.3%, so the line is held everywhere except here. Cap ★ at one third.

### 4 · Phase 0 was never reviewed, and one page is wrong

**12 topics, 1398 lines, 116/topic** — half the corpus median of 226, and it holds two
Master topics. `04-shared-buffers.md:50–78` presents `first 44.52 ms / second 2.64 ms` as
evidence for the buffer cache, but `once('first')` runs on a `Pool` that has never
connected — the gap is TCP + SCRAM + fork + session startup, and :76 states that wrong
cause in prose. Trips [[devbible-verify-your-own-measurements]] on the one page whose job
is explaining shared buffers. `02-client-server-model.md` cites `two-backends.mjs`, which
**does not exist** in `sandbox/pg-api/`. `11-vs-other-databases.md` is the only non-stamp
page in the corpus with no `> Verified:` line.

### 5 · A granularity merge that cost a concept

Phase 2's syllabus lists 17 rows; the folder has 16 pages. *boolean and three-valued logic*
and *date, time, interval* were merged into `09-boolean-dates.md`. `## boolean` gets **36
lines**, and the `time` type has **no section at all**. This is the 229-vs-228 discrepancy.

## Corpus-wide numbers (computed, reusable)

269 content files · 228 topics · 55 128 lines · Master **26.3%** (60/228, inside the
25–30% band) · Understand 124 · Know 35 · When Needed 9 · **1519 gotchas, 5.6/page, every
page has a section** · 1452 Q&A · **12 stamps** (phase-13 rows 07–18, 66 lines each).

⚠️ `docs/README.md:40` says *"270 pages … 13 topics outstanding"* — actual is **269 files /
228 topics / 12 stamps**. The handoff's "257 written vs 13 stamps" is off by one the same
way: phase-0 page 11 is short and unverified but it is *written*, not a stamp.

**The stamps pass every structural check.** Each carries a tier badge, a Gotchas section
with two entries and four Q&A — so a grep for "pages missing Gotchas" returns **zero hits
corpus-wide**. Do not trust that grep as a completeness signal.

## Assessments worth not re-deriving

- **Fullstack fit ≈ 93%** — went row by row through all 229. Only **6 rows** are genuine
  DBA territory (`pg_upgrade`, PITR, logical replication, XID wraparound, FDW/`dblink`) and
  **all six are already `Know`/`When Needed`**. The tiering is doing its job; the syllabus
  passes the user's 90% bar. The gap is what is missing, not what is present.
- **Four missing rows**, each a month-one product pattern: **transactional outbox**
  (Phase 12 — the highest-value addition; every ingredient is already taught and never
  assembled), **multi-tenancy as a decision** (Phase 3 — including `SET` vs `SET LOCAL`
  leaking across a pooled connection), **audit/history tables** (Phase 12), **money
  modelling** (Phase 2 — `numeric(12,2)` vs `bigint` minor units).
- **Two re-tiers up:** recursive CTEs `Know` → `Understand`; RLS `Know` → `Understand`
  with a context note.
- **Best page in the repo:** `phase-11-mvcc/06-isolation-levels.md` — measures SERIALIZABLE
  at 12.4 s vs 71 ms for ordered `FOR UPDATE`, then argues against its own benchmark and
  refuses to predict a smaller-pool result it did not measure.

Related: [[devbible-postgresql-review-remediation]] · [[devbible-postgresql-rewrite-handoff]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-review-system]] · [[devbible-postgresql-syllabus]] ·
[[devbible-postgresql-phase14-scenarios]]
