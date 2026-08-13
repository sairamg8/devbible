# 06 · Work order — ranked by payoff

Executable top to bottom by someone who has not read the pages. Every row names the file,
the action, and where the material comes from.

**Nothing in this repo was modified by the review.** All of the below is proposed.

---

## Ranked

| # | Target | Action | Est. lines | Needs a script? | Blocked by |
|---|---|---|---|---|---|
| **1** | `phase-4-crud/13-merge.md` | **Correct the `RETURNING` error.** Replace lines 88–92, 107, 148–150, 176–178, 194 with the exact text in [03](03-accuracy-findings.md) finding 1. Add `WHEN NOT MATCHED BY SOURCE` section after line 98 | +40, −15 | **Yes** — extend `sandbox/pg-api/ex14-crud.mjs` §8 to run `merge_action()` and `NOT MATCHED BY SOURCE`. Both transcripts already captured in [03](03-accuracy-findings.md) | — |
| **2** | `phase-0-architecture/04-shared-buffers.md` | **Remove the confounded benchmark** (lines 50–78) and the wrong causal sentence at line 76. Replace with a `read=` → `hit=` measurement on one warm connection | ±0 | **Yes** — must isolate buffer cache from connection setup; spec in [03](03-accuracy-findings.md) finding 3. *If no script, delete lines 50–78 outright* | — |
| **3** | `phase-13-ops/07-…` → `18-…` (12 files) | **Strip the fake Gotchas and Q&A** from the stamps, leave one honest line. They currently pass every structural check while containing nothing | −50 × 12 | No | — |
| **4** | `docs/README.md:40` | Fix the counts: `270 pages` → **269 files / 228 topics**; `13 topics outstanding` → **12** | 1 | No | 3 |
| **5** | `phase-10-indexes/03-explain.md` | **Chunk into `03-explain/`** — 4 chunks, split in [02](02-the-cap-and-depth.md) §5.1. Highest-value depth fix in the corpus: Master tier, 186 lines, and it is the tool behind every performance diagnosis | 186 → ~620 | **Yes** — plans for each node type, `BUFFERS`, `loops=`, `FORMAT JSON` from Node | — |
| **6** | `phase-2-types/09-boolean-dates.md` | **Split** into `09-boolean.md` + `10-date-time-interval.md`, renumber the tail. Restores the 229 topic count and un-merges two unrelated concepts. Add the missing `time` type | 213 → ~400 | Reuse `ex33`/`ex34` | — |
| **7** | `phase-0-architecture/02-client-server-model.md` | **Reframe from "a fact" to "a budget you spend"** — per-backend RSS, `fork()`, SCRAM round trips, so the reader can size a pool. Rewrite the 3 "what is" Q&A. Add the missing `> Verified:` line | +50 | **Yes** — `two-backends.mjs` is referenced at line 87 but **does not exist**; commit it, and add per-backend RSS | — |
| **8** | `phase-11-mvcc/03-read-committed.md` | **Chunk into `03-read-committed/`** — 3 chunks, split in [02](02-the-cap-and-depth.md) §5.2. The database's default isolation level currently gets 170 lines, and its anomalies are described rather than shown failing | 170 → ~480 | **Yes** — each anomaly reproduced with real output | — |
| **9** | All 270 pages | **Re-star the interview questions.** 74% are `★`; cap at one third. Define ★ as "asked verbatim in a real interview more than once" | ±0 | No | — |
| **10** | `phase-2-types/04-timestamptz.md` | **Chunk into `04-timestamptz/`** — 3 chunks, split in [02](02-the-cap-and-depth.md) §5.3. The syllabus calls it the most consequential type choice in a schema and gives it 220 lines | 220 → ~520 | Extend `ex33` | — |
| **11** | `phase-4-crud/06-on-conflict.md` | **Chunk into `06-on-conflict/`** — 3 chunks, split in [02](02-the-cap-and-depth.md) §5.4. Also the place to explain index arbitration, which `13-merge.md` contrasts against but never defines | 234 → ~500 | Extend `ex14` | 1 |
| **12** | `syllabus/04-performance-and-production.md` | **Re-tier**: Recursive CTEs `Know` → `Understand`; RLS `Know` → `Understand` with the context note. Rationale in [01](01-syllabus-review.md) §2 | 2 | No | — |
| **13** | `syllabus/03-node-and-pg.md` or `04-…` | **Add the transactional outbox row** (Phase 12, `Understand`), then the page. Highest-value *new* content available | ~280 | **Yes** — outbox + relay + `SKIP LOCKED`, measured | — |
| **14** | `syllabus/01-foundations.md` | **Add the multi-tenancy row** (Phase 3, `Understand`) — shared table vs schema vs database, and the `SET` vs `SET LOCAL` leak under pooling | ~250 | **Yes** | 13 |
| **15** | `syllabus/04-…` | **Add the audit/history row** (Phase 12, `Understand`) — generic trigger, `to_jsonb`, `current_setting` for the acting user | ~230 | **Yes** | 13 |
| **16** | `phase-2-types/02-numeric-vs-float.md` | **Add money modelling** — `numeric(12,2)` vs `bigint` minor units, rounding, currency as a separate column, and what `pg` returns to JS for each | +120 | Extend `ex33` | 6 |
| **17** | `phase-0-architecture/` (whole phase) | **Rewrite pass** — 12 topics, 116 lines/topic against a corpus median of 226. Also `11-vs-other-databases.md` is the only non-stamp page in the corpus with **no `> Verified:` line** | 1398 → ~2600 | **Yes**, several | 2, 7 |
| **18** | Master pages, corpus-wide | **Add `## Where you will use this`**, 4–6 lines naming the real scenario. Catalogue for tuple comparison, job queue for `SKIP LOCKED`, soft delete for partial unique indexes | +5 × ~60 | No | — |

---

## If you only do five

**1, 2, 3, 5, 7.**

Rows 1–3 are correctness: one page states a falsehood about the target version, one page
proves a claim with a measurement of something else, and twelve pages impersonate finished
work. Those three are cheap and they are the ones that would embarrass the corpus if a
reader trusted it.

Rows 5 and 7 are the depth fix at its two highest-value points — `EXPLAIN`, which every
performance investigation starts from, and Phase 0, which is the first thing a reader of
this corpus sees.

Everything else can wait without the corpus being *wrong*.

---

## What this review deliberately does not recommend

- **Rewriting the Tier-B phases.** Phases 1, 2, 3, 4, 7, 10, 11 are *good* — 9.2 to 9.6 on
  the pages I read in full. They are capped, not broken. Chunk the specific topics named in
  [02](02-the-cap-and-depth.md) §5 and leave the rest alone.
- **Twelve capstone scenario pages.** The scenarios in [05](05-real-world-scenarios.md) are
  an argument for three syllabus rows and a 5-line block on existing pages — not for a new
  section.
- **Touching the tier distribution beyond two rows.** 26.3% Master is well inside the
  25–30% band and the assignments are sound.
- **Changing the example policy, the palette, or the page template.** They work.

---

## Verification for whoever executes this

Per your global rule 4 — a green build proves nothing:

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'
# grep exit 1 = clean
```

And after any chunking (rows 5, 6, 8, 10, 11), re-run the clustering guard from
[02](02-the-cap-and-depth.md) §6 on the affected phase. A phase whose Master topics all
land in one narrow band was budgeted, not written.

Note for rows 5, 6, 8, 10, 11: converting a file to a directory means fixing inbound links
in the phase `README.md` and in the neighbouring pages' `← Prev` / `Next →` footers. Per
your global rule, link the **`.md` file** and keep every numeric prefix —
`../03-explain/README.md`, not `../explain/`. Do not bulk-`sed`; resolve each target
against the filesystem with `shared/scripts/fixlinks.py`.

---

← [05 · Real-world scenarios](05-real-world-scenarios.md) · [Index](README.md)
