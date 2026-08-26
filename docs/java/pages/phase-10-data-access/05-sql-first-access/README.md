---
title: "05 · SQL-first access"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**`JdbcTemplate` and `JdbcClient` — when a typed query beats an entity graph, and what Spring's data-access exception hierarchy buys you on top of raw JDBC.**

:::tip Complete — 33 chunks
The topic runs from why SQL-first exists through `JdbcClient`, the exception
hierarchy, writes and batches, mixing SQL with JPA, and closes on testing: the
shape of a SQL-first repository, the `@JdbcTest` slice, a real PostgreSQL under
the test, and what such a test can assert that an entity-based one cannot.
:::

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · Why SQL-first exists](01-why-sql-first-exists.md)** | An entity is a model of your domain; a result set is a model of your question — and a report is a question |
| 2 | **[1b · The three APIs](01b-the-three-apis.md)** | Spring keeps the ceremony and hands you back the two decisions — and since 6.1 there is one fluent API for both parameter styles |
| 3 | **[2 · `JdbcTemplate`](02-jdbctemplate.md)** | `JdbcTemplate` removes thirty lines of ceremony and none of the decisions — and knowing which is which is the whole skill |
| 4 | **[2b · Wiring, settings, logging](02b-settings-and-logging.md)** | Three statement settings default to \"whatever the driver does\", and the one that logs your SQL does not log your parameters |
| 5 | **[3 · `RowMapper` and friends](03-rowmapper.md)** | Three callback interfaces take a `ResultSet` and they are not interchangeable — one maps a row, one consumes the whole cursor, … |
| 6 | **[3b · The fan-out problem](03b-the-fan-out-problem.md)** | A join that fans out returns more rows than objects, so no per-row function can produce the answer |
| 7 | **[3c · Two queries, and `LIMIT`](03c-two-queries-and-limit.md)** | Two queries are usually cheaper than one fan-out join — and `LIMIT` on a fan-out join silently truncates the last object |
| 8 | **[3d · The built-in mappers](03d-automatic-mappers.md)** | Spring ships four row mappers you never write, and `JdbcClient.query(Class)` uses the one nobody can name |
| 9 | **[4 · `JdbcClient`](04-jdbcclient.md)** | `JdbcClient` is one chain — SQL, then parameters, then a result shape — and the chain refuses to run until you say what you exp… |
| 10 | **[4b · The result specs](04b-the-result-specs.md)** | The last call in the chain declares how many rows you expect — and eleven of them are not interchangeable |
| 11 | **[5 · Named parameters](05-named-parameters.md)** | `:name` is not a JDBC feature — Spring parses your SQL and rewrites it into `?` before the driver ever sees it |
| 12 | **[5b · `IN` lists and the cache](05b-in-lists-and-the-statement-cache.md)** | `IN (:ids)` expands into one `?` per element, so the SQL text changes with the list length — and that is what wrecks the statem… |
| 13 | **[6 · The exception hierarchy](06-the-exception-hierarchy.md)** | The exception hierarchy is the real product — one checked, vendor-specific class becomes a tree whose shape is the retry decision |
| 14 | **[6b · The translator chain](06b-the-translator-chain.md)** | Two unrelated mechanisms are both called \"exception translation\", and `@Repository` only turns on the one `JdbcTemplate` neve… |
| 15 | **[6c · On PostgreSQL](06c-what-to-catch-on-postgresql.md)** | On PostgreSQL every translated exception comes from five characters, and three of the errors you meet most often have no mappin… |
| 16 | **[7 · Empty results](07-queryforobject-and-empty.md)** | `queryForObject` throws on zero rows — and the `try`/`catch` everybody writes to fix that also swallows a completely different bug |
| 17 | **[8 · Writes and keys](08-writes-and-generated-keys.md)** | `update()` hands back a row count nobody reads, and the convenient way to get a generated key throws on PostgreSQL |
| 18 | **[8b · Batches and bulk](08b-batches-and-bulk-writes.md)** | `JdbcClient` has no batch method on purpose, so bulk writes drop to `JdbcTemplate` — and the array it returns is not a list of … |
| 19 | **[9 · The connection](09-transactions-and-the-connection.md)** | One helper class is why `JdbcTemplate` joins your transaction, and calling `dataSource.getConnection()` yourself steps outside it |
| 20 | **[10 · When SQL wins](10-when-sql-first-beats-an-entity.md)** | Seven queries where SQL-first is not a preference — the entity route is either impossible or an order of magnitude more work |
| 21 | **[10b · What you give up](10b-what-you-give-up.md)** | Eight things an ORM was doing for you, now done by hand — and five problems that stop existing the moment you stop using one |
| 22 | **[11 · Mixing both](11-mixing-both.md)** | JPA and `JdbcClient` in one transaction share one connection, because the transaction manager hands the JDBC layer the `EntityM… |
| 23 | **[11b · The flush trap](11b-the-flush-ordering-trap.md)** | A `JdbcClient` query inside a JPA transaction does not see unflushed entity changes — because Hibernate has no way to know the … |
| 24 | **[12 · The repository shape](12-testing-and-the-shape-of-a-repository.md)** | A SQL-first repository is a plain class holding a `JdbcClient` — nothing generates it, nothing proxies it, and every statement … |
| 25 | **[12b · Mappers and return types](12b-the-mapper-and-the-return-type.md)** | The mapper belongs next to the query, not in a shared `mappers` package — because a mapper is a function of a select list, not … |
| 26 | **[12c · Where the SQL lives](12c-where-the-sql-lives.md)** | Inline text block, constants class or external `.sql` file — the decision that matters is whether your SQL is reachable as data… |
| 27 | **[12d · The `@JdbcTest` slice](12d-the-jdbctest-slice.md)** | `@JdbcTest` gives you a `JdbcClient`, a transaction and an empty database — in Boot 4.1 it no longer imports Flyway, so nothing… |
| 28 | **[12e · Wiring the test](12e-wiring-the-test.md)** | Your repository is not a bean in a slice, the transaction rolls back, and `Replace.NON_TEST` decides whether the database under… |
| 29 | **[12f · The real database](12f-the-real-database.md)** | H2 in PostgreSQL mode supports `on conflict do nothing` and not `do update` — which is why testing hand-written PostgreSQL SQL … |
| 30 | **[12g · Testcontainers](12g-testcontainers-and-serviceconnection.md)** | `@ServiceConnection` turns a running container into the `DataSource` the test uses, with no property named anywhere — and Boot'… |
| 31 | **[12h · What to assert](12h-what-to-assert.md)** | The two styles do not test better or worse than each other — they test different things, and a codebase with both needs asserti… |
| 32 | **[12i · The parse test](12i-the-parse-test.md)** | `PREPARE` parses, analyzes and rewrites without executing — so preparing every statement against the migrated schema is a renam… |
| 33 | **[12j · The review checklist](12j-the-review-checklist.md)** | Forty-one things to look at in a SQL-first repository, each linked to the chunk that argues it — and the six that are worth blo… |
