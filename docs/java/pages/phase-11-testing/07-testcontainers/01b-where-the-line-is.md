---
title: "The conclusion is not that every test needs a container — it is that a test whose assertion depends on what the SQL returned must run on the engine you deploy, and that every other test should not be touching a database at all"
sidebar_label: "01b · Where the line is"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Testcontainers 2.0.5 *Database containers* module
> documentation
> ([java.testcontainers.org/modules/databases](https://java.testcontainers.org/modules/databases/))
> and the H2 2.x documentation *Features → Compatibility*
> ([h2database.com/html/features.html](https://www.h2database.com/html/features.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, **Testcontainers 2.0.5**, **H2 2.4.240**, PostgreSQL JDBC
> 42.7.11, JUnit Jupiter 6.0.3. **There is no Docker and no sandbox on this machine** —
> this page carries Java source and documented configuration, never a container log, a
> startup timing or a test run.

**[Chunk 01](01-passed-on-h2-proves-nothing.md) argued that a test which ran on H2 is
evidence about H2, and that Spring Boot performs the substitution without asking. Taken
alone that argument overshoots: it reads as "every test needs a container", which is
false, expensive, and not what Testcontainers' own documentation recommends. This chunk
draws the line. There are jobs H2 does well and a container would be waste; there is one
job H2 cannot do at all; and there is a single question you can ask of any data-layer
test that tells you which side of the line it is on.**

## What H2 is genuinely still good for

Refusing to be an argument-shaped page: there are jobs H2 does well, and reaching for a
container for them is waste.

- **A schema-less scratch store for code whose subject is not SQL.** If a test needs *a*
  `DataSource` to exist so a component graph will wire up, and asserts nothing about the
  SQL, H2 is fine and faster.
- **Demo and sample applications**, where the point is that `git clone && ./mvnw spring-boot:run`
  works on a laptop with nothing installed and no daemon running.
- **A parse/compile check on a very plain query**, where the assertion is "this string is
  syntactically valid SQL" and the dialect really is the intersection. This is a narrow
  win and it is easy to fool yourself about how narrow — see the gotcha below on what a
  parse check actually proves.

What H2 is not good for is **anything you would call a repository test**: a test whose
purpose is to answer "does this SQL, against this schema, produce these rows". That
question has a different answer on each engine, and the only engine whose answer you care
about is the one in production.

## The one question that decides it

Ask of any data-layer test:

> *If this test were green and the production query were broken, would this test have
> caught it?*

If the query uses anything past the intersection dialect — `jsonb`, arrays,
`ON CONFLICT DO UPDATE`, `generate_series`, a `citext` column, a partial index, a check
constraint with a regular expression — then on H2 the answer is no, and the test is
decoration. It will go green whether the production query works or not, which is the
definition of a test that is not testing.

⚠️ **Two constructs that belong on a different list, because "H2 will not parse it" is the
weaker failure.** H2 2.4.240 *does* accept `SELECT DISTINCT ON (...)` and
`FOR UPDATE [ NOWAIT | WAIT n | SKIP LOCKED ]` — the grammar is there. What differs is the
**semantics**, which is worse, because a parse error is a failure you cannot ignore and a
semantic divergence is a green test. H2 states plainly that *"locking behavior for rows that
were excluded from result using `OFFSET` / `FETCH` / `LIMIT` / `TOP` or `QUALIFY` is
undefined"* — and `FOR UPDATE SKIP LOCKED` with a `LIMIT` is precisely the work-queue idiom.
[01f](01f-functions-and-the-dialect.md) and [01h](01h-isolation-and-locking.md) have both in
full. **Syntax accepted is not behaviour reproduced**, and this pair is the clearest example
in the topic.

Notice what the question does *not* ask. It does not ask whether the query is complicated,
or whether the team is disciplined, or whether anyone has been bitten yet. It asks about a
counterfactual, and a counterfactual is the only honest way to value a test — because the
test's entire purpose is to behave differently in a world where the code is broken, and
you cannot judge that from the world where it is not.

## The corollary nobody quotes

Testcontainers' own *Database containers* page carries a caveat immediately after the
paragraph everybody screenshots:

> *"Of course, it's still important to have as few tests that hit the database as
> possible, and make good use of mocks for components higher up the stack."*

That is the library's maintainers telling you not to put everything on a container. Both
halves of this topic's argument have to be held at once:

1. A test **about** the database belongs on the database you deploy.
2. Most tests should not be about the database.

Point 2 is where the runtime budget comes from. If pricing rules, validation, state
machines and money arithmetic are tested as plain objects with no Spring context and no
`DataSource` at all, then the number of tests that need a container is small enough that
the container's cost stops being an argument. Teams that end up with a slow suite usually
did not choose containers over H2 — they chose to write every test as an integration test,
and the database was incidental.

## The trap in the middle: the "portable SQL" compromise

There is a third option people reach for and it is worse than either endpoint: keep H2,
and constrain the production SQL to what H2 will also accept.

This looks like a compromise and is actually a transfer of cost from the test suite to
production. `ON CONFLICT DO UPDATE` becomes a `SELECT` and a branch; a `jsonb` column becomes
a `varchar` the application parses; a window frame becomes a second query. One `ON CONFLICT DO UPDATE` round trip becomes a
`SELECT`, a branch, and an `INSERT` or `UPDATE` — which is also a lost-update race unless
someone remembers to take a lock. A `jsonb` column becomes a `varchar` that the
application parses.

None of these show up in a report. Nobody files a ticket saying "we degraded this query to
keep the test green". The tell is a code review in which somebody asks *"will H2 accept
this?"* — at that moment the test tool has started making production architecture
decisions, and the only correct response is to fix the test tool.

## Where this connects

- The mechanism by which Boot substitutes H2 without being asked, and the two directions
  in which an impostor database misleads you, are in
  [01 · Passed on H2 proves nothing](01-passed-on-h2-proves-nothing.md).
- The itemised divergences between H2 2.4.240 and PostgreSQL 18 — identifier folding,
  transactional DDL, what `REPEATABLE READ` prevents, the type system, sequence gaps — are
  **01c · What H2 gets wrong** *(not written yet)*.
- The honest accounting of what a container costs in CI, and the cases where a slice
  genuinely is enough, is **09 · The cost** *(not written yet)*.

## Gotchas

**★ Rewriting a production query so that it also runs on H2 is a real cost that never appears in a report.**
The pressure is invisible: nobody files a ticket saying "we degraded this query to keep
the test green". It shows up as a `LEFT JOIN` plus application-side grouping where
`DISTINCT ON` would have done, or three round trips where one `ON CONFLICT DO UPDATE`
would have done. If you ever find yourself asking "will H2 accept this", the test tool has
started making production decisions, and the fix is to change the test tool rather than
the query.

**★ ⚠️ "H2 will not parse it" is the *weaker* half of this argument, and the half people quote.**
H2 2.4.240 accepts `DISTINCT ON` and `FOR UPDATE … SKIP LOCKED`; what it does not reproduce is
their behaviour under concurrency, and it says so itself about rows excluded by a `LIMIT`. A
construct H2 rejects costs you a red build you cannot ignore. A construct H2 *accepts and
approximates* costs you a green one. Prefer the first list when arguing, and reach for
[01h](01h-isolation-and-locking.md) when someone answers "but H2 supports that".

**★ A green H2 suite is evidence, just not about the thing you think.**
It is genuine evidence that your Java compiles, that your `RowMapper` field names line up
with the aliases you wrote, and that your transaction boundaries are where you meant them.
Do not throw it away — but do not let it stand in for the question "is this SQL correct
against PostgreSQL 18", because it never addressed that question at all.

**★ The counter-argument "a container is slow" is a claim about the suite, not about the technique.**
Testcontainers' documentation concedes the performance point in plain words —
*"Testcontainers is not as performant as H2"* — so there is nothing to deny. What the
claim usually hides is a suite in which every test is an integration test. A container's
cost is paid per *suite*, not per test, once you stop using a naive per-test `@Container`;
and if only a dozen tests need a database at all, the per-suite cost is amortised over a
build that was going to compile and start a Spring context anyway.

**★ "It's only a parse check" proves less than it sounds, because both engines will parse queries they then answer differently.**
A query that is syntactically valid in both dialects can still return different rows —
different `NULL` ordering, different case folding on an unquoted identifier, a different
answer from `REPEATABLE READ`. A parse check on H2 tells you the string is well-formed
SQL for H2. It does not tell you it means the same thing, and "it compiles" has never been
a strong claim about a query.

**★ Adding a container to a test that was not about the database makes the suite slower and no more truthful.**
The failure mode in the other direction is real. A test for a pricing rule that starts a
PostgreSQL container so that a `@SpringBootTest` will boot has not become a better test —
it has become a slower one with more ways to fail for reasons unrelated to pricing. If
removing the database from a test would not change what it can catch, remove the database.

**★ The "few tests that hit the database" advice only works if the domain logic is extractable.**
Testcontainers' caveat assumes you *can* test the components above the data layer without
one. In a codebase where business rules live inside repository methods and entity
lifecycle callbacks, there is nothing above the data layer to test in isolation, so every
test is a database test and the container cost is unavoidable. That is a design problem
wearing a testing costume, and no test tool fixes it.

## Interview questions

**★ Where is the line? Which tests are legitimately allowed to run on H2?**
Tests whose subject is not the database. If the assertion is about a component graph
wiring up, or about Java-side logic that happens to need *a* `DataSource` to exist, H2 is
cheaper and equally valid. The line is crossed the moment the test's assertion depends on
what the SQL returned — at that point you are asserting about an engine, and it had better
be the engine you deploy. Testcontainers' own documentation makes the same point from the
other side, reminding you to have "as few tests that hit the database as possible" and to
mock components higher up the stack.

**★ A colleague argues that using a container is over-engineering because "the SQL is simple". How do you respond?**
By asking for the query. If it genuinely is `SELECT * FROM orders WHERE id = ?` then they
are right and the test is close to worthless either way. In practice "simple" is
self-reported and drifts: someone adds `ON CONFLICT DO UPDATE` for an upsert, or a `jsonb`
column for an audit payload, or `FOR UPDATE SKIP LOCKED` for a work queue, and the H2 test
either starts failing for a reason nobody can act on, or — worse — keeps passing on an
approximation. The work-queue case is the second kind: H2 parses `SKIP LOCKED` happily and
leaves the locking of `LIMIT`-excluded rows undefined, so the test passes and the queue
double-delivers in production. The question is not "is this query simple today", it is "will anyone
re-evaluate the test strategy on the day it stops being simple", and the answer is no.

**★ Someone proposes writing all production SQL in "portable" form so it runs on both H2 and PostgreSQL. What is wrong with that?**
It moves cost from the test suite, where it would be visible and paid once, into
production, where it is invisible and paid on every request. Portable SQL means giving up
`ON CONFLICT DO UPDATE`, `jsonb` operators, arrays and window frames — which usually means
extra round trips, application-side grouping, and concurrency bugs that the discarded
constructs existed to prevent. And it does not actually deliver equivalence, which is the
part that sinks the idea: two engines can **parse the same statement and still behave
differently**. H2 accepts `DISTINCT ON` and `SKIP LOCKED` and diverges on what they do; both
engines accept an unquoted identifier and fold it in opposite directions; both accept
`ORDER BY` and default to opposite `NULL` placement; both accept `REPEATABLE READ` and mean
different things by it. You end up with worse
production code *and* a test that still cannot vouch for it.

**★ How would you decide, for an existing suite, which tests should move onto a container?**
Apply the counterfactual to each data-layer test: if the production query were broken,
would this test have gone red? The tests that answer "yes" for the wrong reason —
because H2 happens to agree with PostgreSQL on that query today — are the ones that will
rot silently, so treat "yes, but only by coincidence" as a "no". In practice the sort is
quick: anything asserting on rows returned by non-trivial SQL moves, anything asserting on
Java behaviour that merely needed a `DataSource` stays, and a surprising number of tests
in the middle turn out to be testing nothing and should be deleted rather than migrated.

**★ Your suite got slower after adopting Testcontainers. What do you look at first — and what would make you conclude the tool was the wrong choice?**
First, whether the containers are per-test or per-suite: a naive `@Container` on an
instance field restarts the container for every test method, which is the single largest
avoidable cost. Second, how many distinct Spring application contexts the suite builds,
since a container tied to a context that is evicted and rebuilt pays its cost repeatedly.
Third, how many tests genuinely need a database at all. You would conclude the tool was
wrong only if, after all three, the number of tests that must touch a real engine is still
large — and that finding is not really about Testcontainers, it is a signal that the
domain logic is not separable from the data layer.

{/* FOOTER */}
