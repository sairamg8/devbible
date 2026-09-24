---
name: devbible-postgresql-rewrite-handoff
description: Live resume point for the PostgreSQL page rewrite — exactly which pages are done, what is next, and the house style every page must follow
metadata:
  type: progress
---

# PostgreSQL rewrite — resume here

**Read this first, then open a child only when you need it. Do NOT re-audit the
corpus and do NOT re-run measurements that already exist** — the numbers are on the
pages and the scripts are on disk.

Split into children 2026-08-13 when this file passed the 300-line memory cap
([[devbible-memory-file-cap]]). Split by *how often the material is needed*:

| Child | Open it when |
|---|---|
| [[devbible-postgresql-repo-and-build]] | before you commit, branch, or run a build — remote/Pages, commit policy, the shared checkout, the link rule and every way it has been got wrong |
| [[devbible-postgresql-sandbox]] | **before writing any new script** — 64 `ex*` scripts, most measurements already exist |
| [[devbible-postgresql-session-log]] | history — how phases 1–9 landed, which script fed which page |
| [[devbible-postgresql-pages-validation]] | the original audit that started the rewrite (counts there are historical) |
| `reference_postgresql_phaseN_*.md` | the measured dataset for one phase |

## Where the rewrite stands

Counts re-measured off disk **2026-08-13** and re-verified during the memory review
the same day — they reconcile exactly, phase by phase.

| | |
|---|---|
| Topic pages on disk (chunks counted separately) | **279** |
| **Genuinely written + measured** (`> Verified:` line) | **267** |
| **Stamps remaining** | **12** — all in phase 13 (topics 07–18) |
| Files over 300 lines | **0** (hard cap — chunk, never condense: [[devbible-never-compress-to-fit-cap]]) |
| **Master-tier pages still single files in the 169–269 band** | **20 — a defect, item 14** |

Regenerate the per-phase table any time:

```bash
cd docs/postgresql/pages && for d in phase-*/; do
  t=$(find "$d" -name '*.md' ! -name 'README.md' | wc -l)
  v=$(grep -rl "^> Verified:" --include='*.md' "$d" | grep -v README | wc -l)
  echo "$d $v/$t"; done
```

```
phase-0-architecture     13/13   ✅ COMPLETE (2026-08-13, topic 11 chunked ×2)
phase-1-psql             15/15   ✅   phase-8-schema-from-node 16/16   ✅
phase-2-types            16/16   ✅   phase-9-api-crud         24/24   ✅
phase-3-ddl              19/19   ✅   phase-10-indexes         18/18   ✅
phase-4-crud             22/22   ✅   phase-11-mvcc            16/16   ✅
phase-5-joins            16/16   ✅   phase-12-beyond-tables   21/21   ✅ (+18 outbox, +19 audit)
phase-6-aggregation      40/40   ✅   phase-13-ops             11/23   ← 07–18 are stamps
phase-7-pg-driver        16/16   ✅
```

The 12 phase-13 stamps are byte-identical 66-line placeholders carrying **fake
Gotchas and Q&A sections**, so a structural grep for missing sections returns zero
hits corpus-wide and proves nothing. They do **not** carry a `> Verified:` line —
that is the only reliable tell. `07-pgbouncer` `08-replication` `09-monitoring`
`10-config-keys` `11-logging` `12-zero-downtime-ddl` `13-managed-postgres` `14-rls`
`15-physical-backup` `16-logical-replication` `17-major-upgrades` `18-disaster-drill`.
Phase-0 page 11 (`11-vs-other-databases.md`) is an 83-line stamp.

## ✅ COMPLETE 2026-08-13 (overnight session `052a10c2`) — PostgreSQL is DONE

**Un-parked on the user's instruction and finished.** All 12 phase-13 stamps
replaced, and both remaining missing rows written.

| | |
|---|---|
| Pages on disk (chunks counted separately) | **289** |
| Carrying a `> Verified:` line | **289 — 100%** |
| Stamps remaining | **0** |
| Phase 13 | **18/18** |
| New topics | `phase-2-types/17-modelling-money/` · `phase-3-ddl/20-multi-tenancy/` |

Concepts and cited sources for everything written that night:
**→ [[devbible-postgresql-concepts-phase13]]**

Written under [[devbible-no-new-sandbox-scripts]] — topics 07–18 are
**documentation-validated** with the source URL named in each `> Verified:` line;
existing measured data (`ex51`–`ex54`, `ex33`, `ex52`) was reused and marked
**sandbox-measured**. No fabricated console blocks.

**✅ The split is DONE** (session 2026-08-14, after a power cut ended the overnight
session at 23:07 on the 13th). All 9 files that landed 301–328 lines became chunk
directories on concept boundaries — content moved, nothing trimmed:

```
07-pgbouncer ×4  08-replication ×2  09-monitoring ×5  10-config-keys ×3
11-logging ×2    12-zero-downtime-ddl ×3   13-managed-postgres ×2
14-rls ×3        15-physical-backup ×2
```

Re-audited off disk 2026-08-14: **0 files over 300 lines**, **298/298 pages carry
`> Verified:`**, `fixlinks.py` over all of `docs/` reports **0 unresolved**.

## ⚠️ The trap the power cut exposed: pages shipped, syllabus never updated

The four "missing rows" were written as **pages** but never added as **syllabus
rows**, so the UI topic counts silently drifted — the site under-reported its own
scope for a day. `progress.js` `pages` was correct; `topics` was not.

Fixed 2026-08-14 — the four rows now exist in the syllabus, and every count
derived from them was recomputed *from the files* rather than incremented by hand:

| Where | Was | Now |
|---|---|---|
| `progress.js` phase 2 / phase 3 `topics` | 17 / 19 | **18 / 20** |
| `syllabus/01-foundations.md` header | 63 topics · 19 Master | **65 · 20** |
| `syllabus/04-performance…md` header | 68 topics · 13 Master | **71 · 14** |
| `postgresql/README.md` total + tier table | 229 (61/124/35/9) | **233 (62/127/35/9)** |
| `docs/README.md` index row | 229 topics | **233 topics** |

Two of those were **already wrong before this session**: part 4's header said 13
Master when the file had 14, and the phase-12 syllabus said 17 topics while
`progress.js` said 19 (outbox + audit had been counted in one place only).

**The rule this earns: when a page is added that the syllabus does not list, add
the syllabus row in the same step.** `pages` and `topics` come from different
sources and nothing cross-checks them. Recompute totals by counting rows —
`grep -c 't-master'` per part — never by adding to the old number.

## ⏸ Superseded — the PARKED note below is history

**User instruction, end of session 12:** *"i will pickup this postgresql but let other
existing languages should complete first and then i will try to pick up"*. PostgreSQL
is **paused, not abandoned**. Do not resume it until the other technologies are
further along — that is now the standing priority, and it supersedes the
"finish PG then React" ordering below.

**Two other constraints set in the same session, both still in force:**
- **No new sandbox scripts** — [[devbible-no-new-sandbox-scripts]]. Write from the 66
  existing scripts; a page with nothing behind it gets **no `> Verified:` line** and an
  explicit "not measured" marker instead. Never invent output.
- **Depth follows tier** for phase 13 — [[devbible-postgresql-phase13-ops]].

## 🔻 START HERE (when PostgreSQL is picked back up)

**Standing instruction (session 10): finish the PostgreSQL content before running any
review.** The rubric review and `/code-review ultra` were the previous session's top
two items; the user explicitly deferred both until the corpus is complete.

0. **The four missing rows — 2 of 4 done.** From
   [[devbible-fable-postgresql-review]], each a month-one product pattern:
   - ✅ **Transactional outbox** — `phase-12/18-transactional-outbox.md` (240 lines),
     written from `p7-background-work/ex1-outbox.mjs` + `ex2-skiplocked.mjs`. No new
     script needed.
   - ✅ **Audit / history tables** — `phase-12/19-audit-history-tables.md` (223 lines),
     written from `ex46`'s trigger dataset.
   - ⬜ **Multi-tenancy as a decision** → Phase 3. **The data already exists**: `ex54`
     §3 measured `SET` leaking across a pooled connection and `SET LOCAL` not. Cover
     shared-schema + `tenant_id` vs schema-per-tenant vs db-per-tenant, and RLS.
   - ⬜ **Money modelling** → Phase 2. **The data already exists** in
     [[devbible-postgresql-phase2-types]]: float8 summing 1000×0.01 to
     **9.999999999999831** vs numeric **10.00**; over 300k rows numeric(12,2) **76.8 ms**
     vs float8 27.3 vs bigint cents 27.7 (**2.8× slower, 10 bytes vs 8**); numeric rounds
     half-away-from-zero (`2.5→3`); `numeric` arrives in JS as a **string**.
   Both remaining rows are writable with **no new measurement**.

1. **Phase 13 topics 07–18** — 12 stamps, THE next unit. Topics 01–06 are written
   and measured; the stop-state and the full dataset are in
   [[devbible-postgresql-phase13-ops]]. `ex54-pgbouncer.mjs` is **already measured
   but never written up** — that is topic 07's data, waiting.
   Three scratch containers exist and are **stopped, not removed**:
   `devbible-pg-hba` :55435 · `devbible-pgbouncer` :6432 · `devbible-pg-primary` :55436.
   **Scope lesson from `ex47`:** it was planned as a full script and cut to ~70 lines
   after checking what already existed. Check [[devbible-postgresql-sandbox]] before
   scoping a script — most of a topic is often already measured.
2. ✅ **DONE 2026-08-13 — Phase 0 page 11.** Rewritten from measurements against PG
   18.4 + **MySQL 8.4.11** (`devbible-mysql` :55440, new container) + **SQLite 3.53.3**
   (`node:sqlite`, no container needed). New scripts `ex56-vs-sqlite.mjs`,
   `ex57-vs-mysql.sh`. 316 lines → chunked ×2. **Phase 0 is 13/13.**
   Findings worth keeping: **MySQL cannot roll back DDL but SQLite can** (the usual
   framing is backwards); **MySQL 8 is strict by default** — folklore about truncation,
   `CHECK` and `ONLY_FULL_GROUP_BY` is a version behind, and **SQLite is the loose one**;
   default isolation **read committed vs REPEATABLE-READ**; `pg` returns bigint as a
   *string* while `node:sqlite` **throws** — opposite failure modes; **sequence gaps are
   identical on PG and MySQL**, and the first version of that last measurement was
   **confounded** (several statements in one `psql -c` share an implicit transaction, so
   the embedded ROLLBACK discarded the first insert too and invented a difference).
3. ✅ **DONE 2026-08-13 — the MERGE factual error.** See
   [[devbible-fable-postgresql-review]]. `ex55-merge-returning.mjs`; 199 → 447 lines,
   chunked ×3; phase 4 now 22/22.
4. **STOP. Then move to React**, not to phase 14. Decision session 10: the brief names
   eleven technologies and PostgreSQL alone was 47% of the corpus. Finish the PG core
   because it is nearly done — then go to React.
5. **Phase 14 — real-world scenarios: APPROVED BUT DEFERRED** until after React.
   Syllabus: **→ [[devbible-postgresql-phase14-scenarios]]**. It is ~3 sessions of
   sandbox apps on a technology already at 95%, and several scenarios get better once
   there is a frontend to pair them with.
6. *Then* the deferred review work: the rubric review
   (`docs/reviews/review-prompt.md`, D1–D5, output to `docs/reviews/postgresql/`) —
   **still never run per-phase**, though [[devbible-fable-postgresql-review]] made a
   corpus-wide pass — and `/code-review ultra` per branch. Then **item 14**, the
   re-split ([[devbible-postgresql-review-remediation]]), which is **not**
   PostgreSQL-only: TypeScript, JavaScript and React cluster the same way.

## House style for every page (non-negotiable)

Frontmatter → tier badge `<span className="db-tier t-master|t-understand|t-know|t-when">` →
`> Verified:` line naming versions **and the script** → bold one-liner →
topic-specific `##` sections with **real console output** → `## Trade-off` (always
name the cost) → `## Gotchas` as **Symptom / Cause / Fix** → `## Interview questions`
(3–8, `★` on the frequent ones, **with answers**) → prev/next footer.

**Never invent console output.** Every number and error string on a page must come
from a script in `sandbox/pg-api/`. This corpus is being rewritten precisely because
216 pages had fabricated `Verified:` lines. When a page needs a fact no script
covers, **write the script**.

**Link form:** every link ends in `.md` and keeps every numeric prefix —
`../01-inner-join/README.md` for a chunk index, `../01-inner-join/02-fan-out.md` for
a file inside it. The old directory-slug form broke 188 links; the history and the
four sessions that got it wrong are in [[devbible-postgresql-repo-and-build]].

**Check the neighbouring phase before writing.** Phase 9 owns the *API-shaped*
version of several Phase 4 topics (soft delete, dynamic WHERE, keyset, partial
update). Phase 4 covers the statement, Phase 9 the endpoint — link, do not duplicate.

**⚠️ `★` inflation is at 74%** across interview questions ([[devbible-fable-postgresql-review]]).
Mark only the genuinely frequent ones.

## Sandbox

`podman start devbible-pg` → **PG 18.4 on `127.0.0.1:55432`**, user/db/pass all
`devbible`. Machine `TZ` is **Asia/Calcutta (+5:30)**, server `TimeZone` is **UTC** —
that gap is what makes the `date` trap reproduce.

**64 scripts.** Full inventory: **→ [[devbible-postgresql-sandbox]]**. Check it before
writing a new one.

## Bookkeeping each time a phase lands

1. `src/data/progress.js` — set `pages`, drop `pagesPlanned` when complete.
2. Clean rebuild + grep for `warning|broken` (grep exit 1 = clean). **Coordinate
   first — the checkout is shared** ([[devbible-parallel-sessions]]).
3. Update this file; update the store **after every page**, not just every phase
   ([[devbible-memory-update-cadence]]).
4. Commit **only** in `/mnt/Storage/my-learning/claude/` — devbible itself needs an
   explicit instruction to commit.

Related: [[devbible-postgresql-repo-and-build]] · [[devbible-postgresql-sandbox]] ·
[[devbible-postgresql-session-log]] · [[devbible-postgresql-pages-validation]] ·
[[devbible-progress]] · [[devbible-never-compress-to-fit-cap]] · [[devbible-brief]]
