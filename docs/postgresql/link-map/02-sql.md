---
title: "Link map · PostgreSQL · Part 2 (phases 4–6)"
sidebar_label: "02 · PostgreSQL · SQL"
sidebar_position: 3
---

# Link map · PostgreSQL · Part 2 (phases 4–6)

Covers all 49 topic rows of `docs/postgresql/syllabus/02-sql.md`: T04-01 to T04-20 phase 4 (CRUD and DML), T05-01 to T05-13 phase 5 (joins and set operations), T06-01 to T06-16 phase 6 (aggregation, windows, CTEs). All 49 have a page of ours (✅, path checked on disk).
*read* = passage read; *headings only* = fetched, headings/size checked. Third-party links carry their date; `#anchors` are given only where the id was found in the page HTML.

🔴 **Version note.** Our syllabus targets PostgreSQL **18.4**. `/docs/current/` serves major **18**; the pages' title tags on 2026-10-12 read "18.6 Documentation" (PostgreSQL 19 is in beta and not current). Every `/docs/current/` URL below returned 200 and a "Documentation: 18" title. A manual page carries no per-page date in its text, so only the fetch date is given.

---

## Phase 4 — CRUD and DML

### T04-01 · The `SELECT` shape — Master · ✅ written `docs/postgresql/pages/phase-4-crud/01-select-shape.md`
- **Read this:** [2.5. Querying a Table](https://www.postgresql.org/docs/current/tutorial-select.html) · postgresql.org · tutorial split into select list, table list, qualification; short and runnable; includes `ORDER BY` and `DISTINCT` examples (*read*) · covers our angle: **partial** — no `LIMIT` here · fetched 2026-10-12
- **Also good:** [7.1. Overview](https://www.postgresql.org/docs/current/queries-overview.html) · postgresql.org · general syntax `WITH ... SELECT ... FROM ... sort` (*read* the opening)

### T04-02 · `WHERE` predicates — Master · ✅ written `docs/postgresql/pages/phase-4-crud/02-where-predicates.md`
- **Read this:** [9.7. Pattern Matching](https://www.postgresql.org/docs/current/functions-matching.html) · postgresql.org · `LIKE`/`ILIKE` (noted as PostgreSQL-specific operators), `SIMILAR TO`, POSIX `~` regex (*read* the `ILIKE` passage; the regex part *headings only*) · covers our angle: **partial** — `BETWEEN` and `IN` live elsewhere · fetched 2026-10-12
- **Also good:** [9.2. Comparison Functions and Operators](https://www.postgresql.org/docs/current/functions-comparison.html) · postgresql.org · `IS [NOT] DISTINCT FROM` returns true/false where `=` returns NULL (*read*) · [Don't Do This: BETWEEN](https://wiki.postgresql.org/wiki/Don't_Do_This) · wiki.postgresql.org · closed interval trap with timestamps; page last edited 21 Nov 2024 (*read*)
- **Beyond the docs:** [The Three-Valued Logic of SQL](https://modern-sql.com/concept/three-valued-logic) · modern-sql.com / Markus Winand · undated page; states that WHERE keeps only rows whose condition is true, so an unknown result is rejected, which is the mechanism behind the NULL traps the manual only lists · fetched 2026-10-13 (*read*)
- **Our delta:** the three-valued-logic story (`NULL` never equals) tying `IS DISTINCT FROM` to `WHERE`.

### T04-03 · `LIMIT`/`OFFSET` — Master · ✅ written `docs/postgresql/pages/phase-4-crud/03-limit-offset.md`
- **Read this:** [We need tool support for keyset pagination (no offset)](https://use-the-index-luke.com/no-offset) · use-the-index-luke.com · Markus Winand; explains drifting results and the seek method, called "even faster than offset" (*read*; undated page) · covers our angle: full for the *why it degrades* argument · fetched 2026-10-12
- **Also good:** [7.6. LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html) · postgresql.org · skipped rows are still computed server-side, so a large `OFFSET` can be inefficient; `LIMIT` without `ORDER BY` gives an unpredictable subset (*read*)
- **Our delta:** PostgreSQL syntax and the `(a, b) < ($1, $2)` form (T04-20); the Winand page is database-neutral.

### T04-04 · `INSERT` — Master · ✅ written `docs/postgresql/pages/phase-4-crud/04-insert.md`
- **Read this:** [6.1. Inserting Data](https://www.postgresql.org/docs/current/dml-insert.html) · postgresql.org · whole rows only, multi-row `VALUES`, `INSERT ... SELECT` (*read* the opening) · covers our angle: full · fetched 2026-10-12
- **Also good:** [INSERT (reference)](https://www.postgresql.org/docs/current/sql-insert.html) · postgresql.org · the full grammar, incl. `OVERRIDING` and the PG 18 `RETURNING WITH (OLD | NEW ...)` form (*read* the synopsis)

### T04-05 · `RETURNING` — Master · ✅ written `docs/postgresql/pages/phase-4-crud/05-returning.md`
- **Read this:** [6.4. Returning Data from Modified Rows](https://www.postgresql.org/docs/current/dml-returning.html) · postgresql.org · `INSERT`, `UPDATE`, `DELETE`, `MERGE` all take `RETURNING` (*read* the opening) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the same page documents `old.col` / `new.col` in `RETURNING` for `INSERT`, `UPDATE`, `DELETE` and `MERGE`. The release notes page for major 18 (`/docs/current/release-18.html`) lists "OLD and NEW support for RETURNING clauses", so it is a 18.0 feature and in 18.4 (*read*).

### T04-06 · `INSERT ... ON CONFLICT` — Master · ✅ written `docs/postgresql/pages/phase-4-crud/06-on-conflict.md`
- **Read this:** [INSERT → ON CONFLICT Clause](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT) · postgresql.org · `DO NOTHING` may omit the conflict target; `DO UPDATE` must give one; arbiter indexes by inference (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the reference page names the special `excluded` table and says `DO UPDATE` will not affect a row more than once (cardinality violation error) (*read*); the worked `EXCLUDED` walk-through and the Node-side error handling are ours.

### T04-07 · `UPDATE` — Master · ✅ written `docs/postgresql/pages/phase-4-crud/07-update.md`
- **Read this:** [UPDATE (reference)](https://www.postgresql.org/docs/current/sql-update.html) · postgresql.org · carries the `FROM from_item` join-update form and `RETURNING` (*read* the synopsis) · covers our angle: full · fetched 2026-10-12
- **Also good:** [6.2. Updating Data](https://www.postgresql.org/docs/current/dml-update.html) · postgresql.org · the gentle version (*read* the opening)

### T04-08 · Parameterized queries — Master · ✅ written `docs/postgresql/pages/phase-4-crud/08-parameters.md`
- **Read this:** [node-postgres: Queries](https://node-postgres.com/features/queries) · node-postgres.com · do not concatenate parameters; the server substitutes `$1`; identifiers cannot be parameters, use `pg-format` (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the safety rationale in SQL terms (parse and bind are separate); driver mechanics belong to Phase 7.

### T04-09 · The logical query processing order — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/09-logical-order.md`
- **Read this:** [SELECT → Description](https://www.postgresql.org/docs/current/sql-select.html) · postgresql.org · lists the steps in order: `FROM` computed, `WHERE` filters, then grouping; its "SELECT List" passage says an output name works in `ORDER BY` and `GROUP BY` but not in `WHERE` or `HAVING` (*read* both passages) · covers our angle: full · fetched 2026-10-12
- **Also good:** [SQL Execution Order Explained](https://www.stratascratch.com/blog/sql-execution-order-explained) · stratascratch.com · updated 2026-07-13; walks `FROM` to `LIMIT` and why a `SELECT` alias fails in `WHERE` (*read* the intro and a few steps; examples run on PostgreSQL per the page)
- **Our delta:** the StrataScratch page says no earlier clause, `GROUP BY` included, can see an alias; the PostgreSQL manual says `GROUP BY` can, so our page must keep the PostgreSQL rule.

### T04-10 · `ORDER BY` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/10-order-by.md`
- **Read this:** [7.5. Sorting Rows (ORDER BY)](https://www.postgresql.org/docs/current/queries-order.html) · postgresql.org · `NULLS FIRST` is default for `DESC`, `NULLS LAST` otherwise; per-column options; sort by output label (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [NULL: Purpose, Comparisons, Expressions, and Mapping](https://modern-sql.com/concept/null) · modern-sql.com / Markus Winand · undated page; has a section on NULL in ORDER BY and notes the standard leaves NULL placement to vendors, which explains why PostgreSQL's default is a vendor choice · fetched 2026-10-13 (*read*)

### T04-11 · `DELETE` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/11-delete.md`
- **Read this:** [DELETE (reference)](https://www.postgresql.org/docs/current/sql-delete.html) · postgresql.org · `USING` for join-deletes, `RETURNING` (*read* the synopsis) · covers our angle: **partial** — nothing on soft delete as a design choice · fetched 2026-10-12
- **Also good:** [6.3. Deleting Data](https://www.postgresql.org/docs/current/dml-delete.html) · postgresql.org (*read* the opening)
- **Beyond the docs:** [Soft deletion with PostgreSQL: but with logic on the database!](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) · evilmartians.com / Andrew Kozin and Travis Turner · 2022-05-16; the design side the DELETE reference lacks: soft deletion done in the database with views and rules, and its debuggability and schema-management costs · fetched 2026-10-13 (*read*)
- *Checked, not chosen:* soft-delete articles — none opened; our page owns that argument.

### T04-12 · `DISTINCT` and `DISTINCT ON` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/12-distinct-on.md`
- **Read this:** [SELECT → DISTINCT Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-DISTINCT) · postgresql.org · "first row" of each group is unpredictable unless `ORDER BY` fixes it; `DISTINCT ON` follows `ORDER BY` rules (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [7.3. Select Lists](https://www.postgresql.org/docs/current/queries-select-lists.html) · postgresql.org · section 7.3.3 `DISTINCT` (*headings only*)

### T04-13 · `MERGE` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/13-merge/README.md`
- **Read this:** [MERGE (reference)](https://www.postgresql.org/docs/current/sql-merge.html) · postgresql.org · `WHEN [NOT] MATCHED`, `WHEN NOT MATCHED BY SOURCE` (PG 17+), `merge_action()` in `RETURNING`; points to `INSERT ... ON CONFLICT` for concurrent inserts (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Postgres INSERT ON CONFLICT and how it compares to MERGE](https://pganalyze.com/blog/5mins-postgres-15-merge-vs-insert-on-conflict) · pganalyze.com · 2022-03-31, written for PG 15; says concurrent inserts can make `MERGE` hit a unique violation (*read*; a spoken-style transcript, so a claim about the reasons is secondhand)
- **Our delta:** pganalyze predates PG 17/18 features (`BY SOURCE`, `RETURNING merge_action()`); our page covers them.

### T04-14 · `TRUNCATE` vs `DELETE` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/14-truncate.md`
- **Read this:** [TRUNCATE (reference)](https://www.postgresql.org/docs/current/sql-truncate.html) · postgresql.org · faster because it does not scan; `RESTART IDENTITY`; not MVCC-safe for old snapshots; transaction-safe for the data (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [The Mystery of The Zombie Postgres Row](https://www.endpointdev.com/blog/2012/03/postgres-mvcc-mystery-truncate-delete/) · endpointdev.com / Greg Sabino Mullane · 2012-03-14; a concrete incident showing why TRUNCATE is not MVCC safe, where the reference only states it; older, so check version details against the manual · fetched 2026-10-13 (*read*)

### T04-15 · Expressions and operators — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/15-expressions.md`
- **Read this:** [9.18. Conditional Expressions](https://www.postgresql.org/docs/current/functions-conditional.html) · postgresql.org · `CASE`, `COALESCE`, `NULLIF`, `GREATEST`/`LEAST` (*read* `COALESCE`; ids `FUNCTIONS-CASE`, `FUNCTIONS-COALESCE-NVL-IFNULL`, `FUNCTIONS-GREATEST-LEAST` exist) · covers our angle: **partial** — arithmetic and `||` are on other pages · fetched 2026-10-12
- **Also good:** [9.3. Mathematical Functions and Operators](https://www.postgresql.org/docs/current/functions-math.html) · postgresql.org (*headings only*)
- **Beyond the docs:** [NULL: Purpose, Comparisons, Expressions, and Mapping](https://modern-sql.com/concept/null) · modern-sql.com / Markus Winand · undated page (the NULL concept page, same site); covers COALESCE and NULLIF as mapping to and from NULL, with propagation rules the function reference does not draw together · fetched 2026-10-13 (*read*)

### T04-16 · String functions — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/16-string-functions.md`
- **Read this:** [9.4. String Functions and Operators](https://www.postgresql.org/docs/current/functions-string.html) · postgresql.org · `concat_ws`, `format` (printf-like), `split_part` (*read* examples) · covers our angle: full · fetched 2026-10-12

### T04-17 · Date/time functions — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/17-datetime-functions.md`
- **Read this:** [9.9. Date/Time Functions and Operators](https://www.postgresql.org/docs/current/functions-datetime.html) · postgresql.org · `date_trunc`, `age`, `extract`, current-time functions; `transaction_timestamp()` is the start of the current transaction (*read*) · covers our angle: **partial** — `to_char` is documented on the formatting page · fetched 2026-10-12
- **Also good:** [9.8. Data Type Formatting Functions](https://www.postgresql.org/docs/current/functions-formatting.html) · postgresql.org (*headings only*) · [Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This) · wiki.postgresql.org · timestamp-without-time-zone and `CURRENT_TIME` entries; edited 21 Nov 2024 (*read*)

### T04-18 · `generate_series` and numeric functions — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/18-generate-series.md`
- **Read this:** [9.26. Set Returning Functions](https://www.postgresql.org/docs/current/functions-srf.html) · postgresql.org · `generate_series` for integer, bigint, numeric (*read*); `step` defaults to 1 · covers our angle: full for series · fetched 2026-10-12
- **Also good:** [9.3 → Random Functions](https://www.postgresql.org/docs/current/functions-math.html) · postgresql.org · `random()` returns a value from 0.0 up to, not including, 1.0; this release also has `random(min, max)` (*read*)

### T04-19 · `VALUES` and `unnest` — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/19-values-unnest.md`
- **Read this (1/2):** [7.7. VALUES Lists](https://www.postgresql.org/docs/current/queries-values.html) · postgresql.org · a "constant table" with no on-disk table (*read* the opening) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [9.19. Array Functions → unnest](https://www.postgresql.org/docs/current/functions-array.html) · postgresql.org · multi-array `unnest(a, b, ...)` expands several arrays into columns (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Boosting Postgres INSERT Performance by 2x With UNNEST](https://www.tigerdata.com/blog/boosting-postgres-insert-performance) · tigerdata.com / James Blackwood-Sewell · 2024-11-15; measures unnest arrays against multi-row VALUES inserts and attributes the gain to planning time, not execution · fetched 2026-10-13 (*read*)
- **Our delta:** the `INSERT ... SELECT * FROM unnest($1::int[], $2::text[])` pattern from Node.

### T04-20 · Row constructors and tuple comparison — Understand · ✅ written `docs/postgresql/pages/phase-4-crud/20-tuple-comparison.md`
- **Read this:** [9.25. Row and Array Comparisons → Row Constructor Comparison](https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON) · postgresql.org · pairwise comparison with an operator; composite comparison is row-wise (*read*) · covers our angle: **partial** — nothing on keyset pagination · fetched 2026-10-12
- **Also good:** [use-the-index-luke: no offset](https://use-the-index-luke.com/no-offset) · use-the-index-luke.com · the keyset recipe (*read*; undated)
- **Our delta:** `(created_at, id) < ($1, $2)` as the paging cursor, and the index it needs (Phase 10).

---

## Phase 5 — Joins and set operations

### T05-01 · `INNER JOIN` — Master · ✅ written `docs/postgresql/pages/phase-5-joins/01-inner-join/README.md`
- **Read this:** [2.6. Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html) · postgresql.org · tutorial from a first join to `LEFT OUTER JOIN` and a self join (*read* the self-join passage) · covers our angle: **partial** — "what a join actually produces" is better argued in 7.2 · fetched 2026-10-12
- **Also good:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · `INNER` is the default; defines each join type by its rows (*read*)
- **Beyond the docs:** [A Visual Explanation of SQL Joins](https://blog.codinghorror.com/a-visual-explanation-of-sql-joins/) · blog.codinghorror.com / Jeff Atwood · 11 Oct 2007; works inner, outer and cross joins on two four-row tables with the result rows shown, and notes where the Venn-diagram picture breaks (a cross join, 4 x 4 = 16 rows, cannot be drawn as one) · fetched 2026-10-13 (*read*)

### T05-02 · `LEFT JOIN` and the `WHERE` bug — Master · ✅ written `docs/postgresql/pages/phase-5-joins/02-left-join/README.md`
- **Read this:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · defines the outer join, then shows a `LEFT JOIN` with the restriction in `ON` versus in `WHERE` and says the `ON` one is processed before the join, the `WHERE` one after, which "matters a lot with outer joins" (*read*) · covers our angle: full for the mechanism · fetched 2026-10-12
- *Not opened:* a Pluralsight post on `ON` versus `WHERE` in PostgreSQL joins (search result only).
- **Our delta:** the manual shows the two results but does not call it a bug or say the join "turns back into an inner join"; that framing is ours.

### T05-03 · Semi and anti joins; `NOT IN` NULL trap — Master · ✅ written `docs/postgresql/pages/phase-5-joins/03-semi-anti/README.md`
- **Read this (1/2):** [9.24. Subquery Expressions](https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-EXISTS) · postgresql.org · `EXISTS`, `IN`, `NOT IN` sections; `IN` yields null, not false, when a null is in play (*read*) · covers our angle: **partial** — no planner (semi/anti join) talk · fetched 2026-10-12
- **Read this (2/2):** [Don't Do This → Don't use NOT IN](https://wiki.postgresql.org/wiki/Don't_Do_This) · wiki.postgresql.org · `NOT IN (1,null)` always returns 0 rows; rewrite as `NOT EXISTS`; edited 21 Nov 2024 (*read*) · fetched 2026-10-12
- **Beyond the docs:** [NOT IN vs. NOT EXISTS vs. LEFT JOIN / IS NULL: PostgreSQL](https://explainextended.com/2009/09/16/not-in-vs-not-exists-vs-left-join-is-null-postgresql/) · explainextended.com / Quassnoi · 2009-09-16; compares the three anti-join forms with plans: NOT EXISTS and LEFT JOIN / IS NULL both get a hash anti join, NOT IN uses a hashed subplan and was slightly slower (1.34 s against about 1.1 s in its test); written for PostgreSQL 8.4, so treat timings as dated · fetched 2026-10-13 (*read*)

### T05-04 · Multi-table joins and readable layout — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/04-multi-join.md`
- **Read this:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · without parentheses `JOIN`s nest left to right; parentheses control order (*read*) · covers our angle: **partial** — nothing on formatting style · fetched 2026-10-12
- **Our delta:** formatting is our own convention; no source found.

### T05-05 · Reading an N-N relationship through its join table — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/05-nn-join-table.md`
- **Read this:** none found — tried: "PostgreSQL many-to-many join table query" and "many-to-many relationship junction table SQL join three tables PostgreSQL tutorial" (results were generic SQL tutorials, small blogs and mailing-list threads, none opened, so none can be Read-this); the manual has no page on it. Fall back to [2.6. Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html) for the mechanics.
- **Our delta:** the whole topic — two joins through the link table, fan-out in counts, and the reverse-lookup index.

### T05-06 · `RIGHT` and `FULL OUTER JOIN` — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/06-outer-joins.md`
- **Read this:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · `LEFT`, `RIGHT`, `FULL` all imply `OUTER` (*read*) · covers our angle: full for definitions · fetched 2026-10-12

### T05-07 · `CROSS JOIN` and cartesian products — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/07-cross-join.md`
- **Read this:** [7.2.1.1 Joined Tables → Cross join](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · N rows by M rows gives N*M rows (*read*) · covers our angle: **partial** — "accidental" cartesian products are not discussed · fetched 2026-10-12

### T05-08 · `ON` vs `USING` vs `NATURAL JOIN` — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/08-on-using-natural.md`
- **Read this:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · the three forms side by side (*read* the syntax block) · covers our angle: **partial** — no "never use NATURAL" argument · fetched 2026-10-12
- **Beyond the docs:** [Why JOIN USING Can Lead to Errors in SQL](https://blog.jooq.org/why-join-using-can-lead-to-errors-in-sql/) · blog.jooq.org / Lukas Eder · 2026-05-04; shows NATURAL JOIN joining on every shared column name, so a new same-named column changes the join, and JOIN USING failing with an ambiguity error (PostgreSQL: common column name appears more than once) after an ALTER TABLE, where ON survives · fetched 2026-10-13 (*read*)
- **Our delta:** why `NATURAL` breaks when a column is added — **not confirmed** on a page I read.

### T05-09 · Self joins — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/09-self-join.md`
- **Read this:** [2.6. Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html) · postgresql.org · defines "self join" with the `weather` example comparing a row to others (*read*) · covers our angle: **partial** — no hierarchy example (see recursive CTE, T06-15) · fetched 2026-10-12

### T05-10 · `LATERAL` — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/10-lateral.md`
- **Read this:** [What is Postgres LATERAL JOIN?](https://www.bytebase.com/blog/postgres-lateral-join/) · bytebase.com · 2025-10-15; top-N per group with `LEFT JOIN LATERAL ... ON true`, `LIMIT` runs per outer row, index advice (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [7.2.1.5 LATERAL Subqueries](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-LATERAL) · postgresql.org · a lateral subquery may refer to earlier `FROM` items (*read*)

### T05-11 · `UNION` / `INTERSECT` / `EXCEPT` — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/11-set-ops.md`
- **Read this:** [7.4. Combining Queries](https://www.postgresql.org/docs/current/queries-union.html) · postgresql.org · `UNION` removes duplicates like `DISTINCT` unless `ALL`; same for `INTERSECT`/`EXCEPT` (*read*) · covers our angle: **partial** — dedup *cost* is not discussed · fetched 2026-10-12

### T05-12 · Alias discipline — Understand · ✅ written `docs/postgresql/pages/phase-5-joins/12-alias-discipline.md`
- **Read this:** [7.2.1.2 Table and Column Aliases](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-TABLE-ALIASES) · postgresql.org · short aliases for long names, required for self-joins, original name unusable once aliased (*read*) · covers our angle: **partial** — nothing on "qualify every column" · fetched 2026-10-12
- **Our delta:** the "qualify every column" rule is house style.

### T05-13 · Joining on expressions and ranges — Know · ✅ written `docs/postgresql/pages/phase-5-joins/13-join-expressions.md`
- **Read this:** [7.2.1.1 Joined Tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · postgresql.org · `ON` takes any boolean expression (*read* the `ON` definition) · covers our angle: **partial** — no range operators here; see the range-operators section of the manual (**not opened**) · fetched 2026-10-12

---

## Phase 6 — Aggregation, windows and CTEs

### T06-01 · `GROUP BY` and aggregates — Master · ✅ written `docs/postgresql/pages/phase-6-aggregation/01-group-by/README.md`
- **Read this:** [2.7. Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html) · postgresql.org · one output row per `GROUP BY` group; `HAVING`, `FILTER` examples (*read*) · covers our angle: full for basics · fetched 2026-10-12
- **Also good:** [7.2.3 GROUP BY and HAVING](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUP) · postgresql.org (*headings only*)

### T06-02 · `count(*)` vs `count(col)` vs `count(DISTINCT col)` — Master · ✅ written `docs/postgresql/pages/phase-6-aggregation/02-count-variants/README.md`
- **Read this:** [9.21. Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html) · postgresql.org · `count(*)` counts input rows; `count(any)` counts rows where the value is not null (*read* the table) · covers our angle: **partial** — `DISTINCT` form is in 4.2.7, not here · fetched 2026-10-12
- **Also good:** [4.2.7 Aggregate Expressions](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES) · postgresql.org · the `aggregate_name (DISTINCT expression)` and `FILTER` syntax (*read* the syntax)
- **Beyond the docs:** [What's Faster? COUNT(*) or COUNT(1)?](https://blog.jooq.org/whats-faster-count-or-count1/) · blog.jooq.org / Lukas Eder · 2019-09-19, updated 2022-03-23; benchmarks count(*) against count(1) on PostgreSQL (about 10 percent faster for count(*)) and explains the per-row NULL check · fetched 2026-10-13 (*read*)

### T06-03 · `HAVING` vs `WHERE` — Master · ✅ written `docs/postgresql/pages/phase-6-aggregation/03-having/README.md`
- **Read this:** [2.7. Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html) · postgresql.org · `HAVING` filters grouped rows, `WHERE` filters before grouping (*read*) · covers our angle: full · fetched 2026-10-12

### T06-04 · `FILTER (WHERE ...)` — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/04-filter-clause/README.md`
- **Read this:** [2.7. Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html) · postgresql.org · `count(*) FILTER (WHERE temp_lo < 45)` per-aggregate filter next to `HAVING` (*read*) · covers our angle: **partial** — no `CASE` comparison · fetched 2026-10-12
- **Also good:** [The FILTER clause](https://modern-sql.com/feature/filter) · modern-sql.com · standard feature; `CASE` emulation; PostgreSQL allows subqueries inside; page lists PostgreSQL 18 (*read*; undated)

### T06-05 · `string_agg`, `array_agg`, `jsonb_agg`, `jsonb_object_agg` — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/05-json-agg/README.md`
- **Read this:** [9.21. Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html) · postgresql.org · `jsonb_agg` includes nulls, `_strict` skips them; `jsonb_object_agg` keys cannot be null; `ORDER BY` inside the call (*read*) · covers our angle: **partial** — no API-shaping recipe · fetched 2026-10-12
- **Our delta:** the page says that except for `count`, aggregates return null when no rows are selected, and names `array_agg` as returning null rather than an empty array (*read*). It does not name `jsonb_agg` itself, so `jsonb_agg` over zero rows being NULL rests on the general rule: **not confirmed** by name; our page should show it with a run.

### T06-06 · Window functions: `OVER`, `PARTITION BY` — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/06-windows-intro/README.md`
- **Read this:** [3.5. Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html) · postgresql.org · `avg(salary) OVER (PARTITION BY depname)` keeps every row, unlike `GROUP BY` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [7.2.5 Window Function Processing](https://www.postgresql.org/docs/current/queries-table-expressions.html) · postgresql.org · where windows run (*headings only*)

### T06-07 · `row_number`, `rank`, `dense_rank`, `ntile` — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/07-ranking/README.md`
- **Read this:** [9.22. Window Functions](https://www.postgresql.org/docs/current/functions-window.html) · postgresql.org · reference table; `ntile` splits a partition into as-equal-as-possible buckets (*read*) · covers our angle: **partial** — no top-N-per-group recipe (see T05-10) · fetched 2026-10-12

### T06-08 · `lag`, `lead`, `first_value`, `last_value` — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/08-lag-lead/README.md`
- **Read this:** [9.22. Window Functions](https://www.postgresql.org/docs/current/functions-window.html) · postgresql.org · `lag` with offset and default; `first_value`/`last_value` act on the window frame; `IGNORE NULLS` not implemented (*read*) · covers our angle: full · fetched 2026-10-12

### T06-09 · CTEs and the `MATERIALIZED` rule — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/09-ctes/README.md`
- **Read this:** [7.8.3 CTE Materialization](https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION) · postgresql.org · merged into the parent when referenced once, not more; `MATERIALIZED`/`NOT MATERIALIZED` override (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Waiting for PostgreSQL 12 - Allow user control of CTE materialization, and change the default behavior](https://www.depesz.com/2019/02/19/waiting-for-postgresql-12-allow-user-control-of-cte-materialization-and-change-the-default-behavior/) · depesz.com / depesz · 2019-02-19, updated 2019-05-15; quotes the commit and shows what changed from the old always-materialize fence to inlining a CTE referenced once · fetched 2026-10-13 (*read*)

### T06-10 · Data-modifying CTEs — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/10-modifying-ctes/README.md`
- **Read this:** [7.8.4 Data-Modifying Statements in WITH](https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-MODIFYING) · postgresql.org · all statements share one snapshot and cannot see each other's effects; `RETURNING` is the only way to pass data (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Tuple shuffling: Postgres CTEs for Moving and Deleting Table Data](https://www.crunchydata.com/blog/tuple-shuffling-postgres-ctes-for-update-and-delete-table-data) · crunchydata.com / David Christensen · 2023-11-02; a worked archive pattern, DELETE with RETURNING feeding an INSERT in one statement and so one transaction · fetched 2026-10-13 (*read*)

### T06-11 · Scalar, row and correlated subqueries — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/11-subqueries/README.md`
- **Read this:** [9.24. Subquery Expressions](https://www.postgresql.org/docs/current/functions-subquery.html) · postgresql.org · `EXISTS`, `IN`, `ANY`, single-row comparison (*read* the opening) · covers our angle: **partial** — correlated-subquery cost (the N+1) is not discussed; scalar subqueries are in 4.2.11 (**not opened**) · fetched 2026-10-12
- **Beyond the docs:** [Optimizing Correlated Subqueries with Semi Joins in PostgreSQL and YugabyteDB](https://www.yugabyte.com/blog/correlated-subqueries-with-semi-joins/) · yugabyte.com / Mark Peacock · 2025-03-20; shows a correlated EXISTS running as a per-row SubPlan versus being decorrelated into a semi join, the cost angle the manual page omits (the worked case is YugabyteDB, which is PostgreSQL-compatible; the site returns 403 to curl but loads in a fetch tool) · fetched 2026-10-13 (*read*)

### T06-12 · Counting for pagination — Understand · ✅ written `docs/postgresql/pages/phase-6-aggregation/12-pagination-counts/README.md`
- **Read this:** [PostgreSQL count(*) made fast](https://www.cybertec-postgresql.com/en/postgresql-count-made-fast/) · cybertec-postgresql.com · 2019-04-03, modified 2024-03-05; why it is slow, index-only scan, aggregate table, and an `EXPLAIN`-based estimate function (*read* the estimate section) · covers our angle: **partial** — no `limit + 1` "has more" trick · fetched 2026-10-12
- **Also good:** [Count estimate](https://wiki.postgresql.org/wiki/Count_estimate) · wiki.postgresql.org · `pg_class.reltuples` estimate; edited 17 Nov 2024 (*read*) · [Slow Counting](https://wiki.postgresql.org/wiki/Slow_Counting) · wiki.postgresql.org · edited 10 Apr 2021 (*read*)
- **Our delta:** `limit + 1` — no source found.

### T06-13 · `bool_and`, `percentile_cont`, ordered-set aggregates — Know · ✅ written `docs/postgresql/pages/phase-6-aggregation/13-ordered-set/README.md`
- **Read this:** [9.21 → Ordered-Set Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html#FUNCTIONS-ORDEREDSET-TABLE) · postgresql.org · `percentile_cont(fraction) WITHIN GROUP (ORDER BY ...)` (*read*) · covers our angle: full · fetched 2026-10-12

### T06-14 · Frame clauses — Know · ✅ written `docs/postgresql/pages/phase-6-aggregation/14-frames/README.md`
- **Read this:** [4.2.8 Window Function Calls](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS) · postgresql.org · frame clause syntax covering `ROWS`, `RANGE`, `GROUPS`, `EXCLUDE` (*read* the syntax) · covers our angle: **partial** — no running-total example on this page · fetched 2026-10-12
- **Also good:** [3.5. Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html) · postgresql.org · `sum(salary) OVER (ORDER BY salary)` gives running sums, and the default frame is explained (*read*) · [9.22 Window Functions](https://www.postgresql.org/docs/current/functions-window.html) · postgresql.org · says which functions depend on the frame (*read*)
- **Beyond the docs:** [PostgreSQL 11's Support for SQL Standard GROUPS and EXCLUDE Window Function Clauses](https://blog.jooq.org/postgresql-11s-support-for-sql-standard-groups-and-exclude-window-function-clauses/) · blog.jooq.org / Lukas Eder · 2018-07-05, updated 2018-10-02; one-line contrast of ROWS counting rows, RANGE using value offsets and GROUPS counting tied groups · fetched 2026-10-13 (*read*)

### T06-15 · Recursive CTEs — Know · ✅ written `docs/postgresql/pages/phase-6-aggregation/15-recursive-cte/README.md`
- **Read this:** [7.8.2 Recursive Queries](https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-RECURSIVE) · postgresql.org · includes Cycle Detection (7.8.2.2): path arrays, `UNION` vs `UNION ALL`, the `CYCLE` clause (*read*) · covers our angle: full · fetched 2026-10-12

### T06-16 · `GROUPING SETS`, `ROLLUP`, `CUBE` — When Needed · ✅ written `docs/postgresql/pages/phase-6-aggregation/16-grouping-sets/README.md`
- **Read this:** [7.2.4 GROUPING SETS, CUBE, and ROLLUP](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUPING-SETS) · postgresql.org · `GROUPING SETS`, `ROLLUP` and `CUBE` each shown with the equivalent expansion (*read*) · covers our angle: full · fetched 2026-10-12
