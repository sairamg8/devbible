---
title: "A hand-written INSERT has to satisfy the schema rather than the entity, so it must fill every column auditing and optimistic locking normally fill — and if it names its own primary keys it silently leaves the sequence behind, which is why the first insert the application performs collides with fixture data"
sidebar_label: "04d2 · The columns SQL has to fill"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the Spring Boot 4.1.0 javadoc for
> [`DataJpaTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html).
> The sequence and identity-generator behaviour described here is JPA/Hibernate and
> PostgreSQL semantics, not a Spring feature; the one claim I could not settle from the
> documentation is flagged inline.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — SQL and Java source only, never the
> output of a run.

**[04d](04d-sql-versus-repository-fixtures.md) argued when a fixture should be SQL. This
chunk is the bill. The moment you write the `INSERT` yourself you take on every column the
application used to fill for you — audit stamps, version numbers, discriminators — and you
take on the primary key, which is where the expensive mistake lives: naming your own ids
does not advance the sequence the entity's generator reads from, so the first row the
application inserts collides with a row your fixture wrote.**

## The sequence problem, which bites everyone once

A SQL fixture that writes explicit primary keys does not advance the sequence the entity's
identity generator reads from. Insert `id = 1, 2, 3` by hand, then let the application
insert a row, and the generator hands out `1` — a duplicate key violation on a row the
application produced entirely correctly. The error names your production code and the cause
is in a `.sql` file.

Three ways out, in order of preference:

```sql
-- 1. Do not supply the id at all; let the column default fill it.
INSERT INTO account (iban, balance_minor) VALUES ('GB00…', 1000);
```

```sql
-- 2. Take the id from the sequence, so the sequence advances.
INSERT INTO account (id, iban) VALUES (nextval('account_seq'), 'GB00…');
```

```sql
-- 3. If you must use literal ids, resynchronise afterwards.
INSERT INTO account (id, iban) VALUES (1, 'GB00…');
SELECT setval('account_seq', (SELECT max(id) FROM account));
```

Option 1 is the right default and has a second benefit: **a test that cannot name the id
cannot assert on it**, which deletes a whole family of brittle assertions —
`assertThat(saved.getId()).isEqualTo(1L)` is a test of the sequence, not of your code.

Option 2 keeps the ids generated while letting the script reference them, if you capture
them with `currval` or a `RETURNING` clause — though at that point the script is doing
enough work that a builder would read better.

Option 3 is what you need when the fixture's ids are referenced by foreign keys inside the
same script and you want them legible: `account 1` owning `posting 10, 11, 12` is genuinely
easier to read than three `nextval` calls. Pay for the legibility with the `setval` line and
put it in the same file so it cannot be forgotten.

⚠️ **This interacts with the allocation size, and the interaction is not fully rescued by
`setval`.** A `SEQUENCE` generator with an allocation size greater than one reserves a block
of values in memory when it first fetches from the sequence. If a persistence context has
already reserved a block, resynchronising the underlying sequence afterwards does not
retract that reservation. I could not find documentation that pins down the ordering
guarantees here for every generator and pooling strategy, so treat it as: **run the
`setval` in the same script as the inserts, before the application has done anything**, and
do not rely on fixing it mid-test.

A related consequence that surprises people: **a rolled-back test still consumed the
sequence values it took.** Sequences are non-transactional by design — that is what makes
them usable concurrently — so nothing about rollback puts the numbers back. This is why
`assertThat(id).isEqualTo(1L)` passes on the first run and fails on the second, and it is
covered from the cleanup side in [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).

## Auditing, versions and not-null columns

A hand-written `INSERT` has to satisfy the **schema**, not the entity. So every column the
schema declares `NOT NULL` must appear, including the ones the application fills
automatically and which are therefore invisible when you read the entity class:

- **`created_at` / `created_by` / `last_modified_at`**, normally set by Spring Data auditing
  on persist. The entity shows `@CreatedDate`; the schema shows `NOT NULL`; the script shows
  nothing, and the insert fails.
- **`version`**, normally managed by JPA optimistic locking. This one does not fail loudly:
  a `NULL` version column is generally treated by Hibernate as meaning the row is not yet
  persistent, which surfaces later as a confusing failure on the first update rather than as
  a constraint violation on the insert. Write `0`.
- **discriminator columns** in a `SINGLE_TABLE` inheritance hierarchy. Omit it and the row
  loads as the wrong type or not at all.
- **columns with a database default the entity never writes**, which are fine to omit — as
  long as you know which ones those are, which means reading the migration.

```sql
-- The honest version of a "simple" fixture row
INSERT INTO account
    (id, iban, balance_minor, currency, status, version, created_at, created_by)
VALUES
    (nextval('account_seq'), 'GB00…', 1000, 'GBP', 'SETTLED', 0, now(), 'fixture');
```

Six of those nine columns are there to satisfy the schema and have nothing to do with the
test. That is the real cost of a SQL fixture, and it is why [04d](04d-sql-versus-repository-fixtures.md)
argues for builder-and-repository setup as the default: `anAccount().withStatus(SETTLED)`
says the same thing and lets the machinery fill the rest.

The values now live in the script **and** in the mapping, and nothing keeps them in step.
Add an audit column in a migration and every fixture script in the suite needs editing,
with no compiler to find them for you. A project-wide `grep` for `INSERT INTO account` is
the only tool you have.

## Making the duplication survivable

Three things reduce the cost without giving up SQL fixtures:

1. **Never name a column you do not have to.** Every column in the script is a maintenance
   obligation. If the schema has a default, use it.
2. **Give the audit columns database defaults in the test schema, or make them nullable.**
   This is only defensible when the migrations are the source of the schema and you are not
   weakening production — a `DEFAULT now()` on `created_at` in the real migration is often
   correct anyway and removes the column from every fixture at once.
3. **Keep one canonical row per table in one script and vary it with `UPDATE`.** A
   `@Sql(statements = "UPDATE account SET status = 'PENDING' WHERE id = 1")` on the test
   that cares puts the interesting value in the test and the boilerplate in one file. That
   is the SQL-side version of the builder argument from
   [01](01-the-forty-line-setup.md): *every value visible in a test should be a value that
   test's outcome depends on*.

## Where this connects

- When to write a SQL fixture at all:
  [04d · SQL versus repository fixtures](04d-sql-versus-repository-fixtures.md).
- Sequences and rollback, and why ids climb across a suite:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- `TRUNCATE … RESTART IDENTITY`, the blunt instrument for the same problem:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Asserting on a generated id as an order-dependence bug:
  [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).
- Identity generation, auditing and optimistic locking themselves:
  [Phase 10 · Data access](../../phase-10-data-access/README.md).

## Gotchas

**★ A SQL fixture with literal primary keys leaves the sequence behind.**
The next insert the application performs collides with a row the fixture wrote, and the
error names a duplicate key on data the application generated correctly — so the
investigation starts in the wrong place. Omit the id and let the default fill it, use
`nextval(…)` in the script, or `setval(…)` at the end of it.

**★ `setval` does not retract a block a persistence context has already reserved.**
With an allocation size above one, Hibernate takes a range of values in memory. Fixing the
sequence afterwards does not un-take them. Run the `setval` in the same script as the
inserts, before anything else has touched the table, rather than as a mid-test repair.

**★ A rolled-back test still consumed its sequence values.**
Sequences are deliberately non-transactional, so a rollback returns nothing. Any assertion
of the form `assertThat(saved.getId()).isEqualTo(1L)` passes exactly once per fresh
database and fails on every subsequent run — a bug that reproduces in CI and not locally
purely because CI starts clean.

**★ A hand-written `INSERT` must satisfy every `NOT NULL` column, including the ones
auditing normally fills.**
`created_at`, `created_by`, `version` and discriminator columns are invisible in the entity
class and mandatory in the schema, so the failure is a constraint violation naming a column
the test author never thought about.

**★ A `NULL` version column does not fail at insert time — it fails later, on the update.**
Hibernate generally reads a null version as "not yet persistent", so the row inserts
cleanly and the confusing failure arrives when something updates it. Write `0` explicitly
in every fixture row for a versioned entity.

**★ Omitting the discriminator column in a `SINGLE_TABLE` hierarchy produces a row that
loads as the wrong type or not at all.**
The query returns fewer rows than the table contains and the test fails on a count, which
sends you looking at the predicate rather than at the fixture.

**★ Adding a column to a migration silently invalidates every fixture script in the suite.**
There is no compiler and no reference from the migration to the scripts. If the column is
`NOT NULL` without a default, every script that inserts into that table breaks at once,
which is at least loud; if it is nullable, the fixtures quietly stop describing the rows
production actually has.

**★ Every column named in a fixture is a maintenance obligation, including the ones you
added "for completeness".**
A script that spells out nine columns has nine chances to drift from the schema. Name the
ones the test depends on and the ones the schema forces; let defaults do the rest.

## Interview questions

**★ You wrote a `@Sql` fixture with `id = 1, 2, 3` and the first application insert fails with a duplicate key. Why?**
Because inserting a literal id does not advance the sequence the identity generator draws
from, so the generator's next value collides with a row the fixture wrote. The clean fix is
to stop supplying ids — let the column default fill them, which also stops the test
asserting on ids it should not know about. If the ids have to be literal because foreign
keys in the same script reference them, resynchronise at the end of the script with
`setval('account_seq', (SELECT max(id) FROM account))`. Be aware that a `SEQUENCE`
generator with an allocation size above one may already have reserved a block in memory, so
resynchronising is something to do in the fixture script rather than as a repair mid-test.

**★ A test asserts the generated id is 1. It passes locally and fails in CI, or passes on the first run and fails on the second. What is going on?**
Sequences are non-transactional, so the values a test consumes are not returned when its
transaction rolls back, and they are not reset by deleting rows either. On a fresh database
the first id is 1; on the second run through the same database it is not. The assertion is
really about how many rows the suite has ever inserted, which is not a property of the code
under test. The fix is to never assert on a generated id — assert on the value you supplied,
or fetch by the id the save returned. If you genuinely need deterministic ids, that is a
`TRUNCATE … RESTART IDENTITY` between tests, with all the cost that implies.

**★ What has to be in a hand-written fixture row that is not in the entity?**
Everything the framework normally fills: audit columns from Spring Data auditing, the
optimistic-locking `version`, the discriminator in a single-table hierarchy, and any
`NOT NULL` column whose value comes from a listener or a database default the entity never
writes. The entity class is not a description of the row — it is a description of the part
of the row the application manages — so writing fixtures in SQL means reading the migration,
not the entity. That duplication, with nothing keeping the two in step, is the strongest
practical argument for building fixtures through the repository whenever the mapping is not
the subject of the test.

**★ How do you keep a suite of SQL fixtures maintainable as the schema grows?**
Name as few columns as possible, so each script has as few obligations as possible; put
sensible defaults in the migrations themselves where they are correct for production too,
which removes a column from every fixture at once; keep one canonical row per table in one
script and vary it per test with a one-line `UPDATE` in `@Sql(statements = …)`, so the
interesting value is in the test and the boilerplate is in one place. And accept that when
a `NOT NULL` column is added you will be editing every script that inserts into that table,
because nothing will find them for you.

{/* FOOTER */}
