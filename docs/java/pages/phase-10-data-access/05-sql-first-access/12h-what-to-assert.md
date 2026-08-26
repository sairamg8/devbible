---
title: "The two styles do not test better or worse than each other — they test different things, and a codebase with both needs assertions from both lists"
sidebar_label: "12h · What to assert"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing → TestContext
> Framework → Transaction management*
> ([docs.spring.io/.../testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `JdbcClient` javadoc
> ([.../jdbc/core/simple/JdbcClient.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.html))
> and the Jakarta Persistence 3.2 specification API
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/apidocs/)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1.

**A test against a real PostgreSQL ([chunk 12g](12g-testcontainers-and-serviceconnection.md))
can now assert something real. The question is what. There is a list of claims only a
SQL-first repository test can make and a list only an entity test can make, and they
barely overlap — which is the clearest evidence that the two styles are for different
jobs rather than in competition.**

## What only a SQL-first repository test can assert

**The exact set of statements a method sends.** Every statement comes from a
`db.sql(...)` call, so a test that counts statements — through a counting
`DataSource` wrapper — is counting something deterministic. With a persistence
context, the statement set at the end of a method depends on what else is loaded and
dirty, which is why an equivalent ORM assertion is about the context rather than about
the method.

**The row count a write actually affected.** `update()` returns it, and a test can
assert it — `assertThat(rows).isEqualTo(1)`. There is no equivalent for a dirty-checked
update, where the statement is issued later by machinery you are not calling.

**Vendor semantics, end to end.** That `on conflict do update … returning` really does
return the accumulated value; that `for update skip locked` really does skip a row
another transaction holds; that `returning` gives back the generated column. These are
claims about the database, and the test is the only place they are ever checked.

**The translated exception, deterministically.** A constraint violation from a
`JdbcClient` write happens at the call, so `assertThatThrownBy` wraps the exact line
that causes it. In an ORM test the same violation surfaces at flush, which may be
somewhere else entirely — the reason Spring's documentation warns about flushing
"within test methods that run that code".

**That the SQL parses at all** — [chunk 12i](12i-the-parse-test.md). There is nothing
to parse in an entity mapping until the provider generates a statement, and it
generates one only for queries the test happens to run.

**That the mapper is bound to the right columns.** Asserting every component by value
is the only check on a relationship that is otherwise two strings hoping to match
([chunk 10b](10b-what-you-give-up.md)).

## What only an entity test can assert

This list matters as much, because the split is not a claim that one style tests
better — it is that they test different things.

- **Dirty checking produced the right `UPDATE`.** Change one field, flush, and assert
  that exactly that column changed. There is no such behaviour to test in SQL-first
  code, and no such bug either.
- **Cascade and orphan removal.** Remove a child from a collection, flush, and assert
  the row is gone.
- **Optimistic locking through `@Version`** — that a stale write is rejected without
  anybody having written the `where version = ?` clause.
- **Fetch plans and N+1 behaviour.** That a query with a fetch join loads the
  collection in one statement rather than one per parent.
- **Flush ordering.** That inserts, updates and deletes reach the database in an order
  the foreign keys accept.

A codebase that mixes both styles ([chunk 11](11-mixing-both.md)) needs tests from
both lists, and the one test it needs most is the one that crosses them — the
flush-ordering trap of [chunk 11b](11b-the-flush-ordering-trap.md), which no test in
either list catches on its own.
## Gotchas

**Asserting `hasSize(3)` and nothing else is barely a test.** It passes for any query
that returns three rows, including one selecting the wrong columns from the wrong
table with the wrong `where` clause. The size assertion is a sanity check on the
fixture; the value assertions are the test.

**The predicate needs data that ought to be excluded.** A test whose fixture is three
rows that all match the `where` clause passes just as happily when the `where` clause
is deleted. Insert a row for a different customer, a row with the wrong status, a row
outside the date range — then a silently removed predicate fails.

**A test that catches the exception instead of asserting on it deletes the
assertion.** `try { … } catch (DataAccessException ignored) { }` around the arrange
step is how a broken constraint becomes invisible. If a statement is expected to fail,
assert that; if it is not, let it propagate.

**Assert the method's contract, not the query's behaviour.** If the signature says
`Optional<T>`, there is a test for the empty case; if it says `List<T>`, there is a
test that the empty answer is an empty list and not null; if it says `T`, there is a
test that absence throws. Those are the promises callers compile against
([chunk 12b](12b-the-mapper-and-the-return-type.md)), and they are the ones a
refactor breaks.

**A test asserting on a generated key must not assume the sequence starts at 1.** With
a shared container and a cached context, the sequence keeps counting across test
classes. Assert that the key is present and that fetching by it returns the row you
inserted — never that it equals a literal ([chunk 8](08-writes-and-generated-keys.md)).

**Ordering assertions need an `order by` in the query, not a stable-looking result.**
Without one, PostgreSQL may return rows in any order, and small test tables usually
return them in insertion order, which makes an unordered query look ordered forever.
If the method's contract includes an order, the SQL must state it and the test must
assert it.

**Counting statements needs a wrapper you actually install.** "The number of
statements is the number of calls" is true of the code, not of a running test — to
assert it you need a counting `DataSource` or driver-level proxy in the test context.
It is worth doing for the one or two methods where the round-trip count is the point,
and it is not worth doing everywhere.

**Comparing whole records with `isEqualTo` is good practice and trips on
`BigDecimal`.** Building the expected record and comparing in one assertion is the
strongest form of a value test, and it fails when a `numeric(10,2)` column produces
`42.50` and your literal was `new BigDecimal("42.5")` — scale is part of
`BigDecimal.equals`. Either construct the expected value with the right scale or
compare the money component separately with `isEqualByComparingTo`.

**Testing the service to cover the repository covers neither properly.** A service
test that happens to exercise a query asserts a business outcome, so a mapping bug
shows up as a wrong total rather than as a mapping bug — and the query paths the
service does not take stay untested. Test the repository directly; test the service
with the repository's behaviour taken as given.

**A test for a bulk write must assert the rows it did *not* touch.** `update … where
status = 'COMPLETED'` is a statement whose interesting property is its `where` clause.
Asserting that three rows changed is half the test; asserting that the fourth row,
which should have been excluded, still holds its old value is the other half.

## Interview questions

**★ What can a SQL-first repository test assert that a JPA one cannot?**
The exact statements the method sends, because the set of statements is the set of
calls rather than the output of a flush. The row count a write affected, which
`update()` returns and dirty checking never exposes. Vendor semantics end to end —
that `on conflict do update` accumulates, that `skip locked` skips. The translated
exception at the exact line that causes it, rather than at flush time. And that every
statement in the layer still resolves against the current schema, which has no
equivalent at all in an entity mapping.

**★ And the other direction — what can only an entity test assert?**
Everything the persistence context does. That dirty checking produced an `UPDATE` for
the field you changed and not for the ones you did not. That removing a child from a
collection with `orphanRemoval` deletes the row. That `@Version` rejects a stale
write without anybody having written the `where version = ?` clause. That a fetch join
loads a collection in one statement rather than one per parent. That flush ordering
sends inserts, updates and deletes in an order the foreign keys accept. Those are real
behaviours with real bugs — and none of them exist in SQL-first code, which is why the
lists barely overlap.

**★ What does a good repository value test look like?**
One fully populated row, every mapped component asserted by value, plus rows in the
fixture that the predicate ought to exclude. The value assertions are what check the
mapper, since the link between `"first_name"` in the mapper and the column is a
runtime string comparison with nothing to check it. The excluded rows are what check
the `where` clause, because a fixture where everything matches passes even if the
predicate is deleted. Then the contract cases the signature promises: empty
`Optional`, empty list, the exception for too many rows.

**★ How do you assert that a method makes one round trip?**
By wrapping the `DataSource` in the test context with something that counts prepared
statements, and asserting the count. The reason this works in SQL-first code and is
awkward in an ORM is that the statement set is deterministic — it is the set of
`db.sql(...)` calls in the method, with nothing added at flush time by machinery you
did not call. I would do it for the one or two methods where the round-trip count is
the actual subject, such as the two-query alternative to a fan-out join, and not
everywhere; a counting assertion on every test becomes a change-detector.

**★ A codebase mixes entities and `JdbcClient`. What is the test nobody writes?**
The one that crosses them. Both lists above are about a transaction in one style, and
the sharp failure in a mixed codebase is the flush-ordering trap: an entity change not
yet flushed is invisible to a `JdbcClient` query in the same transaction, and a bulk
SQL update is invisible to entities already loaded — which then get flushed over the
top of it. That needs a test that does both in one `@Transactional` method and asserts
what the database holds afterwards, and it is the one nobody thinks to write because
each half works perfectly on its own.

---

← Prev: [12g · Testcontainers](12g-testcontainers-and-serviceconnection.md) · Index: [05 · SQL-first access](README.md) · Next → [12i · The parse test](12i-the-parse-test.md)
