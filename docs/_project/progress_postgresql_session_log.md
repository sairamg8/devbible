---
name: devbible-postgresql-session-log
description: How each earlier PostgreSQL phase landed (phases 1,2,4,5,7,11) — the scripts, the counts and the lesson each session produced. History only; the live resume point is the handoff
metadata:
  type: progress
---

# PostgreSQL rewrite — earlier session log

History. The live resume point is [[devbible-postgresql-rewrite-handoff]]; open this only
when you need to know how an already-complete phase was built or which script covers it.

### Phase 2 (types) landed in session 5 — all 16 pages

Scripts `ex33-types-core.mjs` (01-08) and `ex34-types-more.mjs` (09-16).
**16 pages cover 17 syllabus rows** — `09-boolean-dates.md` deliberately covers both the
`boolean` row and the `date/time/interval` row, so `progress.js` reads
`topics: 17, pages: 16` with **no `pagesPlanned`** (same pattern as phase 0). Do not
"fix" that to 17.
Findings: **→ [[devbible-postgresql-phase2-types]]** — uuid v4 vs v7 index cost, jsonb
measured BIGGER than json, `= ANY` not using GIN, the 241x cast, and the enum/CHECK/lookup
change costs.

### Phase 5 (joins) landed in session 6 — and taught the cap lesson again

Script `ex35-joins.mjs` (written at the end of session 5, **never run** — it had two SQL
`--` comments in JS code and died with `SyntaxError` on first execution; that was the
cut-off point). Fixed, run, and extended twice during this session.

**13 topics, 3874 lines, 16 content files + 3 chunk indexes.** The three Master topics are
chunked directories:

```
phase-5-joins/01-inner-join/   README + 01-matching-pairs + 02-fan-out-and-aggregates
phase-5-joins/02-left-join/    README + 01-null-extension + 02-on-vs-where
phase-5-joins/03-semi-anti/    README + 01-semi-joins    + 02-anti-joins
```

**The mistake worth not repeating:** the phase was first written as 13 flat files of
171–210 lines. Nothing was over the cap, so nothing *looked* wrong — but the pages had been
sized to the budget rather than written out and chunked, and the user caught it
immediately. See [[devbible-never-compress-to-fit-cap]], which now records the recurrence.
**The root cause was loading, not knowing:** that feedback file does not auto-load. Fixed by
promoting the six hard rules into the root `MEMORY.md` "Non-negotiables" section, which
devbible's `CLAUDE.md` imports by absolute path. Rewriting to full depth took the phase
from 2511 to 3874 lines.

**Link forms, re-confirmed the hard way (one build, five broken links):** a link to a
**file inside** a chunk directory keeps **both** prefixes —
`../01-inner-join/02-fan-out-and-aggregates.md`. Only a link to the **directory index**
drops the prefix — `../inner-join/`. Dropping the directory prefix while keeping the file
name is the combination that breaks.

Findings: **→ [[devbible-postgresql-phase5-joins]]**.

## ⚠️ Outstanding — the review remediation (session 7)

A cross-phase correctness review of the five written phases (1, 2, 5, 10, 11) produced 14
findings. **Items 1–13 are fixed; item 14 — the re-split of 20 Master-tier pages still
sized to the cap band — is not started**, and the per-phase rubric review has not been run
for any of those phases. Two of the review's own claims failed verification.
**→ [[devbible-postgresql-review-remediation]]** for all of it, including the fixture change
(`j_orders` now has `created_at`) that affects any future phase-5 work.

## ✅ Nothing outstanding *from sessions 1–6*

Session 4's two leftovers were cleared at the start of session 5: `progress.js` line 69
set to `pages: 18` with `pagesPlanned` dropped, and the clean rebuild run —
**zero `warning|broken`, 605 HTML pages**, which confirmed the three hand-fixed
cross-links. `progress.js` is now current for phases 4, 7, 10 **and 11**.

### Phase 11 landed in session 5 — all 16 pages, all from stamps

Four new scripts (`ex27`–`ex30`), 170–224 lines per page, all under the cap, clean
rebuild after. Findings moved to a child file:
**→ [[devbible-postgresql-phase11-mvcc]]** — the VACUUM-horizon result that contradicts
the usual "idle in transaction blocks vacuum" advice, the HOT/fillfactor numbers, the
four lost-update fixes compared, SERIALIZABLE at 175× the cost of ordered row locks, and
the row-lock and DDL-lock reference tables.

**One trap from that session is worth carrying into every future script:** `pg` does
**not** reset session state on `release()`, so a `SET statement_timeout` in one section
leaks into every later one via the pool. It silently poisoned four sections (the deadlock
demo died to `57014` before the 1s detector fired). Use a checkout helper that runs
`RESET ALL`.

### Phase 1 (psql) landed in session 5 too — all 15 pages

**The first shell scripts in the sandbox**: `ex31-psql-basics.sh` (pages 01–08) and
`ex32-psql-io.sh` (09–15). Host `psql` is 18.4, matching the server, so the pages show the
realistic host-client setup rather than `podman exec`.
Findings: **→ [[devbible-postgresql-phase1-psql]]** — the `-c` does-not-interpolate trap,
`\i` vs `\ir`, exit code 3 only with `ON_ERROR_STOP`, the psql↔`pg` error-field mapping,
and the pipeline exit-code trap.

### Phase 7 landed the session before — all 16 pages written

Six of the sixteen are deliberately **"short recap plus a link"**, per the boundary
exception in [[devbible-postgresql-syllabus]]: Node Phase 6 already owns pooling,
placeholders, lifecycle and cursors. Those six are 02, 04, 07, 13, 15 (and 01 partly).
They still carry measured output and full Gotchas/Interview sections — they just defer
the runtime argument rather than repeat it. **Check the Node page before writing any
Part 3 page**; `docs/nodejs/pages/phase-6-data-access/` is the overlap zone.

New scripts: `ex20-driver.mjs`, `ex21-types-prepared.mjs`, `ex22-notify-cursor-pgjs.mjs`.
Sandbox now also has `pg-cursor` 2.22.0 and `postgres` 3.4.9 installed.

### Phase 4 landed earlier — all 12 remaining stamps written

01-select-shape · 03-limit-offset · 04-insert · 05-returning · 07-update ·
08-parameters · 11-delete · 15-expressions · 16-string-functions ·
18-generate-series · 19-values-unnest (14-truncate had already landed).
`progress.js` is set to `pages: 20`, `pagesPlanned` dropped.

**The previous handoff's claim that all 12 were already measured in `ex14` was
optimistic** — ex14 covered 6 of them. The rest needed new scripts (below). Expect the
same when starting any phase: check coverage before assuming.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] ·
[[devbible-postgresql-phase2-types]] · [[devbible-postgresql-phase5-joins]] ·
[[devbible-postgresql-phase11-mvcc]] · [[devbible-postgresql-phase1-psql]] ·
[[devbible-postgresql-phase7-driver]]

## Phase 4 findings (all measured, all on pages now)

Moved here from [[devbible-postgresql-rewrite-handoff]] on 2026-08-13 (session 10) when that
file passed the 300-line cap ([[devbible-memory-file-cap]]).


- **Deep OFFSET**: 1.22 ms at 0 → **105.85 ms at 499 980** (500k rows, LIMIT 20). Plan
  shows `rows=500000` feeding a `Limit` of 20. Keyset at same depth **0.93 ms**,
  buffers 5045 → 4.
- **Lost update**: 20 concurrent SELECT-then-UPDATE → **final value 2**. Same 20 as
  `SET qty = qty + 1` → **20**. No errors either way.
- **`UPDATE … FROM` with duplicate source**: silently picks one, `rowCount: 1`. Same
  input via `MERGE` → **`21000` MERGE command cannot affect row a second time**.
- **FK delete actions**: `RESTRICT` → **`23001`**, `NO ACTION` → **`23503`** (different
  SQLSTATEs; only NO ACTION is deferrable). CASCADE empties child, SET NULL nulls it.
- **`DELETE` has no `LIMIT`** (`42601`). Batch via `WHERE ctid IN (SELECT ctid … LIMIT n)`.
  Batched 100k = 484 ms vs single 115 ms — **4.2× slower and still correct practice**.
- **DELETE half a 47 MB table**: 47 MB after, 47 MB after `VACUUM`, 24 MB only after
  `VACUUM FULL`. Delete *all* rows + `VACUUM` → **24 kB** (trailing pages truncate).
- **PG 18 `RETURNING old./new.`** works: `{ was: 5, now: 15, delta: 10 }`.
- **`ON CONFLICT DO NOTHING … RETURNING`** gives `rowCount: 0` on the conflict path —
  fix with `DO UPDATE SET col = EXCLUDED.col`, `(xmax = 0)` tells insert from update.
- **`date` → JS**: `date '2026-01-01'` arrives as **`2025-12-31T18:30:00.000Z`**. Fixes:
  `to_char(d,'YYYY-MM-DD')` or `pg.types.setTypeParser(1082, v => v)`.
- **`generate_series` endpoints are inclusive** — hourly over one day = **25 rows**.
  `generate_series(5,1)` returns **no rows** (needs negative step). Step 0 → `22023`.
- **Gap fill needs `count(e.id)`**, not `count(*)` — the latter reports 1 for empty days.
- **`unnest` bulk bridge**: 5000 rows through **3 parameters**; VALUES equivalent needs
  15000 and caps at 21845 rows. unnest 81 ms vs VALUES 148 ms vs COPY 243 ms at 10k.
- **`unnest` mismatched array lengths pad with NULL** — no error.
- **Ties without a unique tiebreaker**: paging 100 rows by 5 → 54 distinct, 46 repeats.
  With `, id` → 100/0.
- **`LIMIT` without `ORDER BY`**: one `UPDATE` changed which rows came back (`1,2,3,4,5`
  → `2,3,4,5,6`).


## Phase 9 (API CRUD) — COMPLETE, 18 topics / 24 pages (session 10)

Moved here from the handoff 2026-08-13 when it passed the 300-line cap.

14 topics written on branch `pg-phase9-api-crud`; 02, 03/, 04/ and 09 already existed.
**Topics 01, 05 and 10 became chunked directories**, joining 03/ and 04/. Six new
scripts, `ex38`–`ex43`. Full measured dataset: **→ [[devbible-postgresql-phase9-api-crud]]**.

```
01-repository/ 3 · 05-transactions-request/ 2 · 10-keyset/ 2   (new dirs, session 10)
06 07 08 11 12 13 14 15 16 17 18                               (single files)
```

**Four measurements were corrected before they shipped** — a narration that contradicted
its own output, an interval read via `.milliseconds` instead of `extract(epoch …)`, a
stats read that needed `pg_stat_force_next_flush()` on a dedicated client, and a test
assertion too weak to detect the interference it claimed. The pattern is
[[devbible-verify-your-own-measurements]] again.

**The result most worth remembering:** shaping a nested response with `jsonb_agg` was
**3× slower** than grouping flat rows in JS (284.8 vs 90.7 ms); the isolation work
(`json_agg` 131.2 ms, server-side EXPLAIN 232 vs 36 ms, payload 2.0 vs 1.2 MB) shows the
cost is jsonb's binary parse on the server. The common advice is wrong here.

## Phase 6 (aggregation) — COMPLETE, 16 topics / 40 pages (sessions 8–9)

Every one of the 16 topics is a directory. Findings, including **the generated-fixture
bug where two columns shared a factor and confounded every two-column query**, and the
six `ex37b`–`ex37g` scripts added because `ex37`'s own demos did not establish the
claims attached to them: **→ [[devbible-postgresql-phase6-aggregation]]**.

## How the earlier phases landed

Phases 1, 2, 4, 5, 7 and 11 are complete. The per-session detail — which script covers
which pages, the boundary-exception recaps in phase 7, the phase-5 cap lesson, the
`release()` session-state leak — is above. The session-9 sidebar/collapse UI work is
recorded there too.
