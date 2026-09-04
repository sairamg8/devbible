---
title: "H2's CREATE INDEX has no USING, no expression, no WHERE and no CONCURRENTLY — so a partial unique index is a constraint your test schema cannot express, and no green test on any engine says anything about a plan"
sidebar_label: "01i · The planner and indexes"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Commands → `CREATE INDEX`*,
> *→ `ANALYZE`*, *→ `EXPLAIN`*
> ([commands.html](https://www.h2database.com/html/commands.html)) — and the **PostgreSQL 18
> manual**: *CREATE INDEX*
> ([sql-createindex](https://www.postgresql.org/docs/18/sql-createindex.html)) and *Statistics Used
> by the Planner* ([planner-stats](https://www.postgresql.org/docs/18/planner-stats.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing, an `EXPLAIN` output or a test run.

**This page closes the catalogue with the entry people expect to be about performance and which
turns out to be about correctness. The two `CREATE INDEX` grammars are not the same size, and one
of the clauses H2 lacks — `WHERE` — is how PostgreSQL expresses a whole class of *constraint*. The
page ends with the one limit that survives moving onto a container: a green test never says
anything about a query plan, on any engine, and a container does not change that.**
## The planner, and what a green test does not say about it

### The index vocabularies are not the same size

PostgreSQL 18's `CREATE INDEX`:

```
CREATE [ UNIQUE ] INDEX [ CONCURRENTLY ] [ [ IF NOT EXISTS ] name ] ON [ ONLY ] table_name [ USING method ]
    ( { column_name | ( expression ) } [ COLLATE collation ] [ opclass [ ( opclass_parameter = value [, ... ] ) ] ]
      [ ASC | DESC ] [ NULLS { FIRST | LAST } ] [, ...] )
    [ INCLUDE ( column_name [, ...] ) ]
    [ NULLS [ NOT ] DISTINCT ]
    [ WITH ( storage_parameter [= value] [, ... ] ) ]
    [ TABLESPACE tablespace_name ]
    [ WHERE predicate ]
```

H2 2.4.240's:

```
CREATE [ UNIQUE [ nullsDistinct ] | SPATIAL ] INDEX
[ [ IF NOT EXISTS ] [schemaName.]indexName ]
ON [schemaName.]tableName ( indexColumn [,...] )
[ INCLUDE ( indexColumn [,...] ) ]
```

No `USING method`, so no GIN, GiST, BRIN, hash or SP-GiST — H2's only alternative is `SPATIAL`,
and *"Spatial indexes are supported only on `GEOMETRY` columns."* No `( expression )`, so no
expression indexes. No `WHERE predicate`, so **no partial indexes**. No `CONCURRENTLY`, no
`COLLATE`, no operator classes. `INCLUDE` exists but *"may only be specified for `UNIQUE`
indexes"*.

The partial-index gap is the one with teeth, because a partial unique index is a **constraint**,
not an optimisation:

```sql
-- Enforces "one active subscription per customer". PostgreSQL only.
CREATE UNIQUE INDEX one_active_sub ON subscription (customer_id) WHERE cancelled_at IS NULL;
```

On H2 that statement does not parse, so either the migration never ran (and the constraint is
absent from the test schema entirely) or somebody maintains an H2-flavoured copy without it. Then
the divergence runs in both directions from the same missing object: a test asserting "the second
active subscription is rejected" fails on H2 with no constraint to reject it — a false red that
usually ends with the test being deleted — and a test asserting "two subscriptions can coexist"
passes on H2 and is wrong in production.

### The planners are not comparable

PostgreSQL's planner is driven by a statistics catalog:

> *"The planner thus needs to make an estimate of the selectivity of `WHERE` clauses… The
> information used for this task is stored in the `pg_statistic` system catalog."*

with most-common-value lists, histograms, n-distinct estimates, a default statistics target of
100 entries per column, and optional extended statistics objects created with `CREATE STATISTICS`.

H2's planner is driven by a single number per column:

> *"Updates the selectivity statistics of tables… The selectivity is used by the cost based
> optimizer to select the best index for a given query. If no sample size is set, up to 10000 rows
> per table are read."*

These are not the same machine. An index chosen on one engine will not necessarily be chosen on
the other, and the `EXPLAIN` output formats have nothing in common, so any test that inspects a
plan is a test of one specific engine by construction.

The honest boundary — and it is a limit on containers too, not just on H2: **a passing test proves
the query returns the right rows, never that it returns them by the plan you intended.** A plan
over a twelve-row fixture is a sequential scan on any engine, because a sequential scan over
twelve rows is correct. Moving the test onto a container makes plan assertions *possible*; it does
not make them *representative*. Plan regressions are found with production-shaped data, and that is
a different activity from testing.


## Gotchas

**★ A partial unique index is a constraint, and H2 cannot express it.**
H2's `CREATE INDEX` has no `WHERE` clause. `CREATE UNIQUE INDEX … WHERE cancelled_at IS NULL` is not
an optimisation you can skip in the test schema — it is the rule that "one active subscription per
customer" is enforced by. Without it the test schema permits states production forbids, and the
divergence runs both ways from one missing object: a test asserting the second active subscription
is rejected fails on H2, and a test asserting two can coexist passes on H2 and is wrong in
production.

**★ Deleting the failing test is the usual response, and it removes the only guard you had.**
When a partial-unique-index test goes red on H2 for a reason nobody can act on, the pressure is to
delete it or annotate it `@Disabled`. That deletes the only thing that would have caught a
regression in the migration that creates the index. This is the concrete mechanism by which a false
red turns into a permanent loss of coverage.

**★ No `USING method` means no GIN, GiST, BRIN, hash or SP-GiST index in the H2 schema.**
H2's only alternative index kind is `SPATIAL`, and *"Spatial indexes are supported only on
`GEOMETRY` columns."* So every `jsonb` containment index, every `pg_trgm` index behind a fuzzy
search, every `tsvector` full-text index and every range-overlap GiST index is simply absent from
the test schema. In several of those cases the *operator* the index serves does not exist either,
so the query cannot be written at all.

**★ No expression indexes, so `lower(email)` uniqueness has no H2 spelling.**
`CREATE UNIQUE INDEX ON account (lower(email))` is the standard way to make an email column
case-insensitively unique on PostgreSQL. H2's `CREATE INDEX` takes columns, not expressions. The
H2-flavoured workaround is a `VARCHAR_IGNORECASE` column or `IGNORECASE=TRUE`, which is a
*different rule* applied at a *different scope* — and now the two schemas enforce different things
while both tests pass.

**★ H2's `INCLUDE` is restricted to `UNIQUE` indexes and PostgreSQL's is not.**
*"`INCLUDE` clause may only be specified for `UNIQUE` indexes."* A covering index on a non-unique
key — the usual reason to use `INCLUDE` — has no H2 spelling. That is a pure performance
divergence, which is to say: it is invisible to every test, on either engine.

**★ `NULLS NOT DISTINCT` exists on both but with different defaults in some modes.**
H2: *"If nulls distinct clause is not specified, the default is `NULLS DISTINCT`, excluding some
compatibility modes."* PostgreSQL's `CREATE INDEX` also takes `NULLS [ NOT ] DISTINCT`, and its
default is distinct. The words "excluding some compatibility modes" are the whole problem — a
unique index over a nullable column can permit multiple `NULL`s on one engine and not the other,
depending on a URL parameter. If uniqueness over a nullable column matters, say
`NULLS NOT DISTINCT` explicitly.

**★ The planners are not comparable machines, so an index chosen on one is not evidence about the other.**
PostgreSQL: *"The information used for this task is stored in the `pg_statistic` system catalog"* —
most-common-value lists, histograms, n-distinct, a default statistics target of 100 entries per
column, and optional extended statistics from `CREATE STATISTICS`. H2: *"The selectivity is used by
the cost based optimizer to select the best index for a given query. If no sample size is set, up to
10000 rows per table are read"* — one number per column.

**★ `EXPLAIN` output has nothing in common, so any plan assertion is a single-engine test by construction.**
Both engines have `EXPLAIN` and `EXPLAIN ANALYZE` and the formats are unrelated. A test that greps a
plan is a PostgreSQL test, which is fine as long as it is honest about that — it belongs on a
container and it must never be written to also "work" on H2.

**★ A green test never says anything about the query plan, on any engine — including on a container.**
A plan over a twelve-row fixture is a sequential scan, correctly, because a sequential scan over
twelve rows is the right plan. Moving the test onto a container makes plan *inspection* possible; it
does not make it representative. Plan regressions are found with production-shaped data, and that is
a different activity from testing. Do not let a container promise you otherwise, and do not let
anyone use "we run on real PostgreSQL now" as an argument that performance is covered.

**★ `ANALYZE` in a test helper commits the transaction on H2.**
H2 documents *"This command commits an open transaction in this connection"* under `ANALYZE`. So
the one thing you would reach for to make an H2 plan comparison meaningful also silently ends your
test's rollback ([01g](01g-transactional-ddl-and-which-schema.md)). The two defects compound: the
comparison was not going to be meaningful anyway.

## Interview questions

**★ Give a case where a missing *index* changes correctness rather than performance.**
A partial unique index. `CREATE UNIQUE INDEX one_active_sub ON subscription (customer_id) WHERE
cancelled_at IS NULL` is how PostgreSQL expresses "at most one active subscription per customer",
and H2's `CREATE INDEX` grammar has no `WHERE` clause, so the statement does not exist there. If the
test schema came from `ddl-auto` it has no such object at all, and the test database permits a state
production forbids. A test asserting the second active subscription is rejected fails on H2 for a
reason unrelated to your code — and the usual response, deleting the test, removes the only thing
that would have caught a regression in the migration.

**★ Can you test a query plan?**
Not usefully in a test suite, and moving to a container does not change that. The planners are
different machines: PostgreSQL uses `pg_statistic` with most-common-value lists, histograms and a
default statistics target of 100, while H2's cost-based optimizer works from a single per-column
selectivity figure sampled from up to 10,000 rows. The `EXPLAIN` output formats have nothing in
common, so a plan assertion is engine-specific by construction. And even against the real engine, a
plan over a twelve-row fixture is a sequential scan, correctly. A container makes plan inspection
possible; production-shaped data is what makes it meaningful, and that is a separate activity from
testing.

**★ If plans cannot be tested, what *can* a test say about query performance?**
The number of statements, not their cost. Asserting "this endpoint issued three queries, not
three hundred" is stable across engines, meaningful on tiny fixtures, and catches the single most
common real-world performance defect — see
[topic 08 · The N+1 problem](../../phase-10-data-access/08-the-n-plus-1-problem/README.md), which
is built on exactly that assertion. Statement counting works because it measures the code's
behaviour rather than the database's; plan assertions do not, because they measure the database's
behaviour on data you invented.

**★ How would you make case-insensitive uniqueness work identically in tests and production?**
Pick a mechanism that both can express, or accept the container. On PostgreSQL the idiomatic answer
is a unique expression index on `lower(email)`; H2 has no expression indexes, so the H2-shaped
alternatives are `VARCHAR_IGNORECASE` or the database-wide `IGNORECASE=TRUE`, both of which change
the rule and its scope rather than reproducing it. The portable-by-construction option is to store a
normalised column — `email_normalised` populated by the application — and put an ordinary unique
index on it. That works on both engines and is also better design, because the normalisation rule
becomes explicit and testable in plain Java.

**★ Why does this page belong in a catalogue about correctness rather than in a performance chapter?**
Because two of PostgreSQL's index features are constraint mechanisms wearing an index's clothes: a
partial unique index enforces a conditional uniqueness rule, and an exclusion constraint enforces
non-overlap. Neither has an H2 spelling, so both are missing from the test schema, and a missing
constraint changes which states the database allows. The performance half of the page — GIN, BRIN,
covering indexes, statistics — really is a performance topic, and its honest conclusion is that no
test suite covers it on any engine.

{/* FOOTER */}
