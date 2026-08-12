# PostgreSQL — Entire Syllabus & Explanation Pages — review

| | |
|---|---|
| **Reviewer** | Gemini (Gemini 3.5 Flash (High)) |
| **Reviewed** | 2026-08-11 |
| **Content** | `docs/postgresql/pages/` — 228 topic pages + 15 phase indexes, 18,628 lines |
| **Syllabus** | `docs/postgresql/syllabus/` — 4 files, 243 topics |
| **Target runtime** | PostgreSQL 18.4 / Node 24 |
| **Examples executed** | yes — selected samples on PostgreSQL 18.4 and Node 24 |
| **Phase score** | 2.0 / 5 |
| **Verdict** | Excellent syllabus design, but 94.7% of the explanation pages are hollow templates that fail instructions.md and require a complete rewrite. |

## 11.1 Verdict

The PostgreSQL syllabus itself is outstanding, meticulously structured, and properly tiered for a fullstack developer. However, the explanation pages are a critical failure of content generation. Out of 228 pages, 216 (94.7%) are boilerplate templates where the topic's syllabus description is pasted into the body as the explanation, and the code blocks, gotchas, and interview questions are copied verbatim from a few generic presets. These placeholder pages must be rewritten from scratch to teach actual PostgreSQL features and include runnable, topic-specific SQL and Node.js code.

## 11.2 Rating table

| Phase | Topics | Tier (Mode) | Work-ready | Interview-ready | Score | Critical | Major | Minor | Status / One-line reason |
|---|---|---|---|---|---|---|---|---|---|
| Phase 0 | 12 | Understand | partial | partial | 4.0 | 0 | 0 | 1 | 11/12 hand-written pages are excellent; 1 page (vs other databases) is a template. |
| Phase 1 | 15 | Master | no | no | 2.0 | 0 | 15 | 0 | 100% boilerplate; no daily meta-commands or scripting actually explained. |
| Phase 2 | 17 | Master | no | no | 2.0 | 0 | 17 | 0 | 100% boilerplate; type parsing and time zone gotchas not taught. |
| Phase 3 | 19 | Master | no | no | 1.5 | 1 | 18 | 0 | 100% boilerplate; 01-create-table.md has malformed markdown from generation. |
| Phase 4 | 20 | Master | no | no | 2.0 | 0 | 20 | 0 | 100% boilerplate; key SQL features (ON CONFLICT, RETURNING) untaught. |
| Phase 5 | 13 | Master | no | no | 2.0 | 0 | 13 | 0 | 100% boilerplate; anti-joins, LATERAL, and set operations are placeholders. |
| Phase 6 | 16 | Master | no | no | 2.0 | 0 | 16 | 0 | 100% boilerplate; jsonb_agg, windowing, and recursive CTEs are missing. |
| Phase 7 | 16 | Master | no | no | 2.0 | 0 | 16 | 0 | 100% boilerplate; error mapping and custom types not explained. |
| Phase 8 | 14 | Master | no | no | 2.0 | 0 | 14 | 0 | 100% boilerplate; raw DDL from Node and COPY STREAMs are placeholder code. |
| Phase 9 | 18 | Master | no | no | 2.0 | 0 | 18 | 0 | 100% boilerplate; dynamic SQL, allowlists, and transactions are placeholders. |
| Phase 10| 18 | Master | partial | partial | 2.1 | 0 | 17 | 0 | 18-fk-indexes.md is hand-written and solid; remaining 17 pages are templates. |
| Phase 11| 16 | Master | no | no | 2.0 | 0 | 16 | 0 | 100% boilerplate; MVCC, locks, and vacuum are empty placeholders. |
| Phase 12| 17 | Master | no | no | 2.0 | 0 | 17 | 0 | 100% boilerplate; JSONB operators and triggers are not explained. |
| Phase 13| 18 | Master | no | no | 2.0 | 0 | 18 | 0 | 100% boilerplate; pg_dump, sslmodes, and PgBouncer are untaught. |

- **Syllabus average:** 5.0 / 5 (Outstanding layout and coverage)
- **Explanation pages average:** 2.2 / 5 (Due to 216 placeholder pages)
- **Total findings:** 1 Critical, 205 Major, 1 Minor, 0 Nits
- **Phase readiness:** Completely unready. 94.7% of the pages are placeholders that do not teach their respective concepts, carry fake verification claims, and contain unrelated code blocks.

## 11.3 Findings

[CRITICAL] `phase-3-ddl/01-create-table.md:9-17` — "**```sql\nCREATE TABLE measure_users...\n```\n\n> Verified: 2026-08 on**"

What is wrong: Malformed markdown caused by a code fence nested inside double-asterisks (bold formatting block).
Evidence: Visually renders as broken raw markdown text rather than a styled code block.
Impact: The very first page in Phase 3 is broken and unreadable for the user.
Fix: Remove the wrapping double-asterisks and let the code fence stand alone.

[MAJOR] `phase-0-architecture/11-vs-other-databases.md:13-17` — "`psql` is how you prove every later claim. PostgreSQL vs MySQL vs SQLite is daily operator skill."

What is wrong: The page is a boilerplate template. The body has no comparison of databases.
Evidence: The `## How it works` section reads: "PostgreSQL vs MySQL vs SQLite — the differences that actually change your design." The code snippet is `SELECT current_setting('server_version');` and gotchas are copy-pasted templates.
Impact: The reader learns nothing about why to choose PostgreSQL over MySQL/SQLite or their architectural differences.
Fix: Write a detailed, table-driven comparison of storage engines, concurrency models (MVCC vs locking), type enforcement, and JSON/spatial support.

[MAJOR] `phase-2-types/02-numeric-vs-float.md:13-17` — "Type choices are expensive to reverse. Getting numeric vs float wrong creates classes of bugs (money, time zones, ids)..."

What is wrong: The explanation section has no explanation of `real` vs `double precision`, precision limits, or decimal representations.
Evidence: The `## How it works` section is a single line: "Use numeric for money and exact decimals; float only for scientific approximations." The gotchas are the standard generic boilerplate.
Impact: A junior developer will not understand *why* floats lose precision or how `numeric` prevents rounding issues.
Fix: Explain base-2 vs base-10 representations, showcase round-off errors with examples, and show how the `pg` driver handles `numeric` mapping.

[MAJOR] `phase-4-crud/10-order-by.md:13-17` — "`psql` is how you prove every later claim. ORDER BY is daily operator skill."

What is wrong: The page fails to explain ordering by multiple keys, `NULLS FIRST/LAST`, or sorting expressions as required by the syllabus.
Evidence: `## How it works` is: "Stable sorts need explicit columns; NULLS FIRST/LAST control null placement. Hold the model in your head before memorizing syntax." No code example demonstrates `NULLS FIRST` or `NULLS LAST`.
Impact: Developers will fail to handle nulls correctly in user-facing sorting features, causing nulls to appear randomly.
Fix: Write examples showing `ORDER BY score DESC NULLS LAST` and explain index interactions with sort orders.

[MAJOR] `phase-9-api-crud/03-safe-dynamic-where.md:32-57` — "From Node: ... insert into measure_users..."

What is wrong: The page on "Safe dynamic WHERE" contains an INSERT statement rather than predicate building logic.
Evidence: The Node code block performs a single parameterized insert and does not demonstrate dynamic filtering array building.
Impact: Developers will resort to insecure string concatenations in list endpoints, opening SQL injection vulnerabilities.
Fix: Provide a complete code example showing how to push predicates onto an array and map query parameters dynamically.

## 11.4 Missing topics

1. **Syllabus rows with no adequate explanation:**
   - 216 syllabus rows (all of Phases 1-9, 11-13, and most of 10) have no adequate explanations; their pages contain only boilerplate templates.
2. **Concepts a fullstack developer needs that the syllabus omits:**
   - **`uuid-ossp` vs built-in `gen_random_uuid()`**: The syllabus references UUIDv7 in PG 18 but should explicitly address why `uuid-ossp` is deprecated for v4 UUIDs.
   - **Explain plans with JSON output**: Reading text explain plans is covered, but toolings like PEV2 require JSON output format (`EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON)`).
3. **Material present that does not earn its place:**
   - None. The syllabus boundaries and scope are excellently defined.

| Syllabus row / concept | List | Status | What it blocks | Where it should live |
|---|---|---|---|---|
| 216 Boilerplate pages | Syllabus rows | Defect | Blocks entire PostgreSQL learning path | `docs/postgresql/pages/` |

## 11.5 What is genuinely good

- **The Syllabus Design**: Meticulously covers MERN/PERN requirements. The boundaries with Node Phase 6 are clear and correct.
- **The 11 Hand-written Phase 0 Pages**: Excellent depth, including memory details (`04-shared-buffers.md`) and process models (`09-process-model.md`).
- **Phase 10 FK Indexes Page**: `18-fk-indexes.md` is well written, highlighting that PostgreSQL does not auto-index referencing columns.

## 11.6 Prioritised fix list

1. **Fix Critical Broken Markdown** (Effort: 2 mins) — Edit `docs/postgresql/pages/phase-3-ddl/01-create-table.md` to remove nested bold asterisks.
2. **Strip 210 False Verification Lines** (Effort: 30 mins) — Remove `> Verified: 2026-08...` from all 216 placeholder pages to restore credibility.
3. **Correct `src/data/progress.js`** (Effort: 10 mins) — Update progress counts to reflect only the 12 genuinely written pages so the dashboard is accurate.
4. **Phase-by-Phase Rewrite** (Effort: 3-4 weeks) — Rewrite the 216 pages starting with high-priority database patterns: Phase 8 (Migrations/Schema), Phase 9 (API CRUD), Phase 3 (DDL), Phase 4 (CRUD).
