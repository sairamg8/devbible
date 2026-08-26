---
title: "Forty-one things to look at in a SQL-first repository, each linked to the chunk that argues it — and the six that are worth blocking a review over"
sidebar_label: "12j · The review checklist"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — this chunk asserts nothing new. Every item links to the chunk of
> this topic that argues it and carries that chunk's `> Verified:` line.
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Twenty-five chunks of argument compress into a list you can read against a diff. It
is deliberately long, because the whole trade of SQL-first access is that decisions a
framework was making are now yours — a checklist is what "yours" costs. Six items are
worth blocking a review over; the rest are worth a comment.**

## How to use it

Not as a gate to tick through. Read the diff once for what it is trying to do, then
use the list to notice what is *absent* — the missing `order by`, the unbound
identifier, the swallowed exception. Absence is what review catches and what a test
does not.

The service-level counterpart is
**[The checklist](../04-spring-transactional/22-the-checklist.md)** and
**[Reviewing a service](../04-spring-transactional/22b-reviewing-a-service.md)**; this
one stops at the repository.

## The class

- [ ] It is a **class, not an interface**, unless there are two implementations or a
      domain port — [12](12-testing-and-the-shape-of-a-repository.md).
- [ ] `@Repository` is present, and the reviewer knows it is there for **component
      scanning**, not for exception translation —
      [6b](06b-the-translator-chain.md), [12](12-testing-and-the-shape-of-a-repository.md).
- [ ] The `JdbcClient` is a **`final` constructor-injected field**; there is exactly
      one constructor — [12](12-testing-and-the-shape-of-a-repository.md).
- [ ] No `StatementSpec` is held as a field — it is mutable and per-call
      — [12](12-testing-and-the-shape-of-a-repository.md).
- [ ] No `@Transactional` on the repository, unless the proxy is wanted deliberately
      — [12](12-testing-and-the-shape-of-a-repository.md), [9](09-transactions-and-the-connection.md).
- [ ] The class contains **statements and no decisions** — no discounting rule, no
      authorisation check — [12](12-testing-and-the-shape-of-a-repository.md).

## The SQL

- [ ] Every query is a **text block or a constant**, never assembled with `+` or
      `String.format` — [12c](12c-where-the-sql-lives.md).
- [ ] Long or hand-tuned queries live in `.sql` files, and those files are **not** in
      the migration directory — [12c](12c-where-the-sql-lives.md).
- [ ] One statement per constant and per file — [12c](12c-where-the-sql-lives.md).
- [ ] Any query whose plan is the point carries a **comment saying which index it
      expects** — [10](10-when-sql-first-beats-an-entity.md).
- [ ] The select list names its columns; no `select *` in a query with a mapper
      — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] A query whose contract includes an order has an **`order by`**
      — [12h](12h-what-to-assert.md).
- [ ] Pagination uses bound `limit` / `offset`, and large offsets have been
      considered — [12](12-testing-and-the-shape-of-a-repository.md).
- [ ] A caller-supplied sort column goes through an **allow-list**, never into the SQL
      — [12](12-testing-and-the-shape-of-a-repository.md).

## Parameters

- [ ] **Every value is bound.** No exceptions, including for admin-only and
      "internal" queries — [5](05-named-parameters.md), [10](10-when-sql-first-beats-an-entity.md).
- [ ] Named and indexed parameter styles are not mixed in one statement
      — [4](04-jdbcclient.md).
- [ ] An `IN (:ids)` list is **never empty** at the call site, and the effect on the
      statement cache is understood — [5b](05b-in-lists-and-the-statement-cache.md).
- [ ] A `::` cast or a `--` comment near a `:` has been checked against the
      named-parameter parser — [5](05-named-parameters.md).
- [ ] No dollar-quoted body (`$$ … $$`) is passed through `JdbcClient`
      — [12c](12c-where-the-sql-lives.md).

## Mapping and return types

- [ ] The mapper lives **next to the query**, not in a shared `mapper` package
      — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] Result types are **records named after the question**, not after the table
      — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] An explicit `RowMapper` is `private static final`; a `RowCallbackHandler` is not
      shared — [3](03-rowmapper.md), [12b](12b-the-mapper-and-the-return-type.md).
- [ ] Nothing returns `null`, `Optional<List<T>>`, or `List<Map<String, Object>>`
      — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] A `Stream<T>` that escapes the class is deliberate and documented as needing to
      be closed — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] Outer-joined columns map to **boxed types or a `coalesce`**, not to primitives
      — [12b](12b-the-mapper-and-the-return-type.md).
- [ ] Money is `BigDecimal`, and the column's scale is known
      — [12b](12b-the-mapper-and-the-return-type.md), [12e](12e-wiring-the-test.md).
- [ ] A fan-out join uses a `ResultSetExtractor` or two queries, and `limit` is not
      applied to a fan-out result — [3b](03b-the-fan-out-problem.md),
      [3c](03c-two-queries-and-limit.md).
- [ ] `single()` versus `optional()` matches what absence means
      — [4b](04b-the-result-specs.md), [7](07-queryforobject-and-empty.md).

## Writes

- [ ] The **row count from `update()` is checked** wherever zero would be a bug
      — [8](08-writes-and-generated-keys.md).
- [ ] Generated keys use `KeyHolder` with the key columns named, not
      `RETURN_GENERATED_KEYS` — [8](08-writes-and-generated-keys.md).
- [ ] Bulk writes are batched deliberately, and the returned array is read as the
      driver defines it — [8b](08b-batches-and-bulk-writes.md).
- [ ] A hand-rolled optimistic-locking check throws
      `OptimisticLockingFailureException` when the count is zero
      — [10b](10b-what-you-give-up.md).
- [ ] `on conflict` is used where a check-then-insert would race
      — [10](10-when-sql-first-beats-an-entity.md).

## Transactions and the connection

- [ ] The transaction boundary is on the **service**, not here
      — [9](09-transactions-and-the-connection.md).
- [ ] Nothing calls `dataSource.getConnection()` directly
      — [9](09-transactions-and-the-connection.md).
- [ ] Multi-statement methods that must be atomic are called inside one boundary
      — [9](09-transactions-and-the-connection.md).
- [ ] In a mixed codebase, no method both changes entities and queries with
      `JdbcClient` in one transaction — [11](11-mixing-both.md),
      [11b](11b-the-flush-ordering-trap.md).
- [ ] A `for update skip locked` claim commits before the work starts
      — [10](10-when-sql-first-beats-an-entity.md).

## Errors

- [ ] Nothing catches `DataAccessException` broadly to "make it robust"
      — [6](06-the-exception-hierarchy.md), [7](07-queryforobject-and-empty.md).
- [ ] A `catch` on a specific type has been checked against what PostgreSQL actually
      produces — [6c](06c-what-to-catch-on-postgresql.md).
- [ ] Retries key on the **transient branch** and restart the transaction, not the
      statement — [6](06-the-exception-hierarchy.md), [6c](06c-what-to-catch-on-postgresql.md).
- [ ] Nothing parses an exception message to identify a constraint
      — [6c](06c-what-to-catch-on-postgresql.md).

## Tests

- [ ] The test runs against **PostgreSQL**, not an embedded engine
      — [12f](12f-the-real-database.md), [12g](12g-testcontainers-and-serviceconnection.md).
- [ ] The schema comes from the **migrations** — [12d](12d-the-jdbctest-slice.md).
- [ ] Fixtures are arranged with `@Sql` or the raw `JdbcClient`, not through the
      repository under test — [12e](12e-wiring-the-test.md).
- [ ] At least one row has **every mapped component asserted by value**
      — [12h](12h-what-to-assert.md).
- [ ] The fixture contains rows the predicate should exclude
      — [12h](12h-what-to-assert.md).
- [ ] The parse test exists and its case count is asserted
      — [12i](12i-the-parse-test.md).
- [ ] Each constraint the code catches by type has a test asserting that type
      — [12i](12i-the-parse-test.md).

## The six worth blocking over

Everything above is worth a comment. These six are worth "not until this changes",
because each one is either a security hole, a silent data loss, or a claim the code
makes and cannot keep:

1. **An unbound value in SQL text.** Concatenation or interpolation of anything that
   came from outside the class. There is no argument that makes this acceptable, and
   "only admins can reach it" is the sentence that precedes most of these.
2. **An unchecked row count on a write whose zero case matters.** A hand-rolled
   optimistic-locking update, a "mark as processed", a conditional delete: if zero
   rows means somebody else won, ignoring the count is a lost update with no error.
3. **A caught `DataAccessException` that does nothing.** It converts a database
   failure into a wrong answer, and the next person to debug it has nothing to go on.
4. **Mixing entity writes and `JdbcClient` in one transaction with no flush
   handling.** The flush-ordering trap silently overwrites a bulk update
   ([11b](11b-the-flush-ordering-trap.md)) and the symptom appears far away.
5. **A test suite for PostgreSQL-specific SQL that runs on an embedded engine.** It is
   green, it is trusted, and it has never executed the clause the query exists for
   ([12f](12f-the-real-database.md)).
6. **A repository method whose return type lies.** `T` where absence is normal, or a
   `null` return: both push a failure into a caller that has no reason to expect it.

## Gotchas

**A checklist used as a gate produces ticks rather than reading.** The failure mode is
a reviewer who confirms each line against the diff and never asks what the change is
for. Read the change first, then use the list to look for absences.

**Most items on this list are about something not being there**, which is why a linter
cannot replace it. No tool notices a missing `order by` on a query whose contract
implies one, or a fixture with no excluded rows.

**A repository that passes every item can still be the wrong repository.** None of
this asks whether the query should exist, whether the screen needs those columns, or
whether the operation belongs in one statement. Those are the questions the diff is
actually for.

**The list grows with the codebase, and that is correct.** A team that hits the empty
`IN (:ids)` failure twice should add a line about it; a team that never uses `jsonb`
can drop those items. A checklist copied unmodified from a reference page is somebody
else's experience.

**Items with no test behind them decay.** Every line here that a test could enforce —
bound parameters, the parse test, the return-type contracts — should eventually become
one, because review catches a thing once and a test catches it every time.

## Interview questions

**★ What do you look for when reviewing a `JdbcClient` repository?**
First, that every value is bound and nothing is concatenated — that is the one item I
will not negotiate. Then the return types, because they are the promises callers
compile against: `Optional` where absence is normal, no `null`, no
`Optional<List<T>>`. Then the write paths: is the row count from `update()` checked
where zero would mean somebody else got there first? Then error handling — no broad
`catch (DataAccessException)`, and any specific catch checked against what PostgreSQL
actually raises. And finally the tests: real engine, schema from the migrations,
fixtures arranged some way other than through the code under test, and at least one
row asserted component by component.

**★ Which review findings would you actually block on?**
Six. An unbound value in SQL text, because it is an injection regardless of who can
reach the endpoint. An unchecked row count where zero means a lost update. A caught
`DataAccessException` that does nothing, because it turns a failure into a wrong
answer. Mixing entity writes and `JdbcClient` in one transaction with no flush
handling, because that silently overwrites data and the symptom surfaces elsewhere. A
suite testing PostgreSQL-specific SQL against an embedded engine, because it is green
and trusted and has never run the clause in question. And a return type that lies.
Everything else I would comment on and merge.

**★ Is a checklist this long actually usable?**
Yes, but not as a gate. Reading a diff line by line against forty items produces ticks
and no understanding. What it is good for is the second pass — you have understood
what the change does, and now you are looking for what is missing, which is the thing
review catches and testing does not. Most items on the list are absences: a missing
`order by`, an unchecked count, a fixture with no excluded rows. And the list should
shrink over time, because every item a test can enforce should become a test.

**★ Why does this list exist for SQL-first and not for Spring Data JPA?**
Because it is the bill for the trade. The whole argument of this topic is that a
framework was making decisions — statement generation, parameter binding, mapping,
paging, batching — and SQL-first takes those decisions back. Decisions you have taken
back are decisions somebody has to check, and in a codebase that is review plus tests.
An entity-based repository has its own list, and it is a different one: fetch plans,
cascade settings, `@Version`, flush ordering, the N+1s. Neither style is free; they
just charge in different places.

---

← Prev: [12i · The parse test](12i-the-parse-test.md) · Index: [05 · SQL-first access](README.md)
