---
title: "The statement-level dialect — ON CONFLICT, RETURNING, LATERAL, DISTINCT ON and the aggregate names — where the divergence is loud and the damage is done by the repair rather than the failure"
sidebar_label: "01f · Functions and the dialect"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Commands → `SELECT`*, *→ `MERGE
> USING`*, *→ `INSERT`* ([commands.html](https://www.h2database.com/html/commands.html)), *SQL
> Grammar → Data Change Delta Table*
> ([grammar.html](https://www.h2database.com/html/grammar.html)), *Functions*, *Aggregate
> Functions* and *Window Functions*
> ([functions.html](https://www.h2database.com/html/functions.html)) and *Features → PostgreSQL
> Compatibility Mode* ([features.html](https://www.h2database.com/html/features.html)) — checked
> against the **PostgreSQL 18 manual**, *SELECT*
> ([sql-select](https://www.postgresql.org/docs/18/sql-select.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**Almost everything on this page is a *false red* — a statement H2 will not parse, which fails
loudly and gets found in minutes. That makes it the cheapest section of the catalogue and, in
practice, the most expensive. The cost is never the failing test; it is the repair, because the
repair is a rewrite of the production query into something both engines accept, and nobody ever
writes that down as a decision. [01b](01b-where-the-line-is.md) named that trade; this page prices
it, statement by statement. Pattern matching and search — regular expressions, `ILIKE`, full-text —
are [01f2](01f2-pattern-matching-and-search.md).**
## Functions, operators and SQL dialect

### `ON CONFLICT` — H2 has half of it, which is worse than none

The PostgreSQL-mode bullet is precise, and the precision is the point:

> *"`ON CONFLICT DO NOTHING` is supported in `INSERT` statements."*

`DO NOTHING` only. `ON CONFLICT (id) DO UPDATE SET … ` — the upsert, the reason the clause exists
— is not in H2's `INSERT` grammar. H2's equivalent is the standard `MERGE`:

```sql
-- PostgreSQL 18
INSERT INTO inventory (sku, qty) VALUES (?, ?)
ON CONFLICT (sku) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty;

-- H2 2.4.240
MERGE INTO inventory t USING (VALUES (?, ?)) s(sku, qty) ON t.sku = s.sku
WHEN MATCHED THEN UPDATE SET t.qty = t.qty + s.qty
WHEN NOT MATCHED THEN INSERT (sku, qty) VALUES (s.sku, s.qty);
```

This one is a false red, and the damage is entirely in the repair. The repair people actually
reach for is neither statement:

```java
// The "portable" version. It is also a lost-update race.
Optional<Inventory> existing = repo.findBySku(sku);
if (existing.isPresent()) {
    repo.increment(sku, qty);   // two transactions here both read, both increment, one wins
} else {
    repo.insert(sku, qty);      // two transactions here both insert, one gets a 23505
}
```

Three round trips and a concurrency bug, in exchange for a green H2 suite. The single-statement
upsert existed to make that race impossible.

### `RETURNING`

`INSERT … RETURNING id`, `UPDATE … RETURNING *` and `DELETE … RETURNING` are everywhere in
PostgreSQL code. **H2's grammar has no `RETURNING` clause.** Its spelling is the SQL-standard data
change delta table:

```sql
-- PostgreSQL 18
INSERT INTO account (email) VALUES (?) RETURNING id, created_at;

-- H2 2.4.240
SELECT id, created_at FROM FINAL TABLE (INSERT INTO account (email) VALUES (?));
```

Not a keyword difference — a different statement shape, which means a different `JdbcTemplate`
call and a different result handling path.

### Set-returning and aggregate functions

| Job | PostgreSQL 18 | H2 2.4.240 |
|---|---|---|
| Generate a series | `generate_series(1, 10)` | `SYSTEM_RANGE(1, 10)` |
| Concatenate a group | `string_agg(name, ',')` | `LISTAGG(name, ',') WITHIN GROUP (ORDER BY name)` |
| Collect to an array | `array_agg(name)` | `ARRAY_AGG(name)` — same |
| Collect to JSON | `jsonb_agg(row_to_json(t))` | `JSON_ARRAYAGG(...)`, different output type |
| Expand an array | `unnest(tags)` | `UNNEST(tags)` — same |

Two of five transfer. `generate_series` in particular shows up in reporting queries and in test
fixtures, and the H2 name is one nobody guesses.

### `DISTINCT ON` — supported on both, which is the trap

It is worth correcting a common list here, including one on the sibling chunk: **H2 2.4.240 does
support `DISTINCT ON`.** It is in the `SELECT` grammar, and H2's semantics note is nearly a
transcription of PostgreSQL's:

> *"If `DISTINCT ON` is used only the specified expressions are checked for duplicates; `ORDER BY`
> clause, if any, is used to determine preserved rows. First row is each `DISTINCT ON` group is
> preserved. **In absence of `ORDER BY` preserved rows are not determined, database may choose any
> row from each `DISTINCT ON` group.**"*

So the right statement is not "this is not portable". It is: **without an `ORDER BY`, which row
survives is undefined on both engines, and the two will happily make different undefined
choices.** A `SELECT DISTINCT ON (customer_id) * FROM orders` with no ordering is a query whose
answer is an implementation detail, and the H2 test locks in whichever detail H2 picked.

That correction matters more than the fact. Cataloguing a feature as "H2 does not have it" when
H2 does is the sort of error that gets a real divergence dismissed as folklore.

### `LATERAL`

Absent from H2's documented table-expression grammar. `CROSS JOIN LATERAL (SELECT … LIMIT 3) x`
— the top-N-per-group idiom — has no H2 spelling, so it becomes N+1 queries in Java.

### Window functions, and one that runs the other way

Both engines have the full window-function set: `ROW_NUMBER`, `RANK`, `DENSE_RANK`,
`PERCENT_RANK`, `CUME_DIST`, `NTILE`, `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, `NTH_VALUE`,
`PERCENTILE_CONT`, `PERCENTILE_DISC`, named `WINDOW` clauses and frame specifications. This is
genuine common ground.

But H2 also has `QUALIFY`, a post-window filter that PostgreSQL does not have. **Divergences run
in both directions**, and a query developed against the test database can fail on the production
one. That is the same defect as a false green wearing different clothes: the engine that voted
on the SQL was not the engine that has to run it.


## Gotchas

**★ H2 has `ON CONFLICT DO NOTHING` and not `ON CONFLICT DO UPDATE`, and half an upsert is worse than none.**
The compatibility list is precise: *"`ON CONFLICT DO NOTHING` is supported in `INSERT`
statements."* Because `DO NOTHING` parses, a reviewer skimming for portability sees `ON CONFLICT`
in the H2 grammar and concludes the clause is supported. The clause you actually needed — the one
with `DO UPDATE SET … EXCLUDED` — is not there, and its H2 spelling is a completely different
statement (`MERGE … USING … WHEN MATCHED`).

**★ The select-then-insert "portable upsert" is a lost-update race and a duplicate-key race at once.**
Two transactions both read absent, both insert, one gets a `23505`. Two transactions both read
present, both increment from the same starting value, one increment is lost. The single statement
existed to make both impossible. If you must keep a portable path, keep two statements in the
repository — a `MERGE` for H2 and an `ON CONFLICT DO UPDATE` for PostgreSQL — rather than one
statement that is wrong on both.

**★ H2 has no `RETURNING` clause at all.**
The H2 spelling is the SQL-standard data change delta table —
`SELECT id FROM FINAL TABLE (INSERT INTO account (email) VALUES (?))`. This is not a keyword
difference: it is a different statement shape, which means a different `JdbcTemplate` method, a
different result-set handling path and a different place for the row mapper. Code written one way
does not become code written the other way by find-and-replace.

**★ `generate_series` is spelled `SYSTEM_RANGE` on H2, and it usually appears in fixtures.**
So the divergence bites the test data rather than the production code, and the usual repair is to
generate the rows in Java — turning one round trip into ten thousand, in the setup path of every
test that needs bulk data.

**★ `string_agg` is `LISTAGG` on H2, and `LISTAGG` does not exist on PostgreSQL.**
The divergence runs both ways for this one pair, so there is no "just use the H2 name" escape.
Out of the common aggregation set, only `ARRAY_AGG` and `UNNEST` transfer unchanged.

**★ H2 supports `DISTINCT ON`; the problem is that neither engine defines which row you get without an `ORDER BY`.**
H2: *"In absence of `ORDER BY` preserved rows are not determined, database may choose any row from
each `DISTINCT ON` group."* PostgreSQL documents the same. So a `DISTINCT ON` with no ordering is a
query whose answer is an implementation detail, and an H2 test freezes whichever detail H2 chose.
Add the `ORDER BY`: one clause, and it makes the query correct on both engines rather than
portable-and-still-undefined.

**★ `LATERAL` has no H2 spelling, and the workaround is an N+1.**
`CROSS JOIN LATERAL (SELECT … ORDER BY … LIMIT 3) x` is the top-N-per-group idiom. Without it, the
"portable" version is one query for the groups and one query per group — precisely the defect
[topic 08 · The N+1 problem](../../phase-10-data-access/08-the-n-plus-1-problem/README.md) exists
to talk you out of. A test-tool constraint has produced an N+1 in production code, and no report
will ever connect the two.

**★ H2 has `QUALIFY` and PostgreSQL does not, so the divergence can run the other way.**
A query developed and tested against H2 can fail on PostgreSQL. That is the same defect as a false
green wearing different clothes — the engine that got a vote on the SQL was not the engine that has
to run it. Worth stating explicitly, because most portability discussions assume the substitute is
a subset of the real thing, and it is not.

**★ H2's `MERGE USING` does not carry the guarantees you are porting away from.**
H2's own note: *"Different rows from a source table may not match with the same target row (this
is not ensured by H2 if target table is an updatable view). One source row may be matched with
multiple target rows."* If you rewrite an upsert as a `MERGE` for the sake of the test suite, you
have adopted a statement with different documented guarantees, not a synonym for the one you had.

**★ Window functions are genuine common ground, which makes the exceptions easy to miss.**
`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `PERCENT_RANK`, `CUME_DIST`, `NTILE`, `LAG`, `LEAD`,
`FIRST_VALUE`, `LAST_VALUE`, `NTH_VALUE`, `PERCENTILE_CONT`, `PERCENTILE_DISC`, named `WINDOW`
clauses and frame specifications all exist on both. Because so much transfers, the reviewer stops
checking — and then hits `QUALIFY`, or a `FETCH FIRST … WITH TIES` interaction, and has no habit of
looking it up.

## Interview questions

**★ What breaks if you take `ON CONFLICT DO UPDATE` out of a query to keep an H2 test green?**
You lose atomicity. The replacement is a read, a branch, and an insert or an update — three round
trips where there was one, and a lost-update race in the update branch plus a duplicate-key race
in the insert branch. Both races were impossible in the single statement. H2 supports
`ON CONFLICT DO NOTHING` in PostgreSQL mode and nothing more, and its own upsert spelling is a
standard `MERGE … USING … WHEN MATCHED`, which is a different statement rather than a different
keyword. The cost of the rewrite is paid in production, on every request, and it never appears in
any report — which is why the review question *"will H2 accept this?"* is the moment to escalate.

**★ Give an example of a divergence that runs the other way, where H2 is more permissive than PostgreSQL.**
`QUALIFY`. H2's `SELECT` grammar has it as a post-window-function filter and PostgreSQL does not,
so a query written and tested on H2 fails on PostgreSQL. `LISTAGG` is another — H2 has it,
PostgreSQL wants `string_agg`. And `IGNORECASE=TRUE` makes every text column in an H2 database
compare case-insensitively, so a test asserting that lookups ignore case can pass on H2 and fail on
PostgreSQL, where you would have needed `citext` or `ILIKE`. The general point is that a substitute
database is not a subset — it is a different database, and "different" has no direction.

**★ Most of this page is false reds. Why does it get a page at all, if false reds are the cheap kind?**
Because the failure is cheap and the repair is not, and only the failure is visible. A red test
costs an afternoon and announces itself. The repair — rewriting `ON CONFLICT DO UPDATE` into
select-then-insert, replacing `LATERAL` with an N+1, moving JSON filtering into Java, generating a
series in a loop — is a permanent degradation of production code, paid on every request, recorded
nowhere. Over a couple of years a codebase accumulates dozens of them, and the accumulated cost is
never attributed to the test database, because by then nobody remembers that was the reason.

**★ How do you tell whether a query is genuinely "simple enough" for the intersection dialect?**
Look at the clause list rather than at the line count. If it contains only `SELECT`, `FROM`,
`JOIN`, `WHERE`, `GROUP BY`, `HAVING` and `ORDER BY` with an explicit `NULLS` clause, and its
parameters are bound with the right JDBC types, then it is very likely to mean the same thing on
both engines. The moment it contains an upsert, a `RETURNING`, a `LATERAL`, a JSON or array
operator, a regular expression, a locking clause or a set-returning function, it does not. And note
the half people skip: even a query squarely in the intersection can return a different first row,
because the sort and null-ordering defaults differ
([01e](01e-text-numbers-and-ordering.md)).

**★ Someone proposes keeping two copies of each repository query — one for H2, one for PostgreSQL — so the tests can stay fast. What is wrong with that?**
It doubles the surface and tests the wrong copy. The H2 copy is the one under test and the
PostgreSQL copy is the one that ships, so the suite's coverage figure describes code that never
runs in production. It also goes stale in one direction only: a bug fixed in the PostgreSQL query
is not necessarily replicated in the H2 one, and nothing detects that, because the H2 test keeps
passing against the old H2 query. If you genuinely need two statements — and you sometimes do, for
`MERGE` versus `ON CONFLICT` — then both have to be exercised against their own engine, which means
you needed the container anyway.

**★ A team says their SQL is fine because it is all generated by Spring Data derived query methods. Does that close the dialect gap?**
It closes most of it and hides the rest. Derived queries and JPQL go through the Hibernate dialect,
so the generated SQL is correct for whichever engine the connection points at — which is exactly
why the identifier-folding divergence stays invisible. What it does not cover is everything a
derived query cannot express, and that is where the dialect-specific SQL lives: upserts, `RETURNING`,
JSON and array predicates, locking hints beyond `@Lock`, window functions, set-returning functions.
So "it's all derived queries" usually means "the interesting 5% is native, and that 5% is the part
the test database is not qualified to judge".

{/* FOOTER */}
