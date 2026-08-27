---
title: "The other half of reviewing repositories is diagnosis rather than inspection — a symptom in production maps to a small number of causes in this topic, and a handful of patterns are worth grepping the whole codebase for before anyone reports anything"
sidebar_label: "12b · Red flags and diagnosis"
sidebar_position: 48
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — this chunk collects rules established and cited in chunks 01–12 of
> this topic; each item links to the chunk carrying the primary source. Spine sources:
> the Spring Data JPA 4.1 reference
> ([docs.spring.io/spring-data/jpa/reference](https://docs.spring.io/spring-data/jpa/reference/))
> and PostgreSQL 18 ([postgresql.org/docs/18](https://www.postgresql.org/docs/18/)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[12](12-the-checklist.md) is what you do before a merge. This is what you do at two in the
morning, or on the first day in an unfamiliar codebase: start from the symptom, or from a
grep, and let the topic tell you the short list of things it can be.**

## From symptom to cause

| Symptom | Look at, in this order |
|---|---|
| An endpoint that was fine is now slow, and the data grew | Deep `OFFSET` ([05b](05b-offset-pagination-at-depth.md)); an `ORDER BY` with no matching index ([05c2](05c2-what-the-order-by-costs.md)); the `COUNT` behind `Page` ([05](05-pageable-and-sort.md)) |
| Latency scales with the size of the *result*, not the table | N+1 — [08 · 1](../08-the-n-plus-1-problem/01-one-hundred-and-one-queries.md). Count the statements, do not read the log ([08 · 6](../08-the-n-plus-1-problem/06-count-do-not-read.md)) |
| Works from the service, `LazyInitializationException` from the controller | No transaction on the declared query method ([09](09-transactions-on-repositories.md)); no unit-of-work boundary ([09c](09c-the-service-boundary.md)) |
| A field is changed and the row does not update, with no error | `readOnly = true` somewhere on the call path ([09b](09b-what-readonly-actually-does.md)) |
| A read straight after a bulk update returns the old values | A `@Modifying` query without `clearAutomatically` ([04b](04b-flush-clear-and-the-stale-context.md)) |
| `updated_at` is older than the data suggests | The write was a bulk statement; no lifecycle callback fired ([10b](10b-what-the-handler-does.md)) |
| Audit columns are entirely null everywhere | The entity listener was never registered, or `@EnableJpaAuditing` is missing ([10](10-auditing-and-lifecycle.md)) |
| `created_by` is null but `created_date` is set | `AuditorAware` returned `Optional.empty()` on that thread ([10b](10b-what-the-handler-does.md)) |
| Pagination repeats or skips rows between pages | No unique tiebreaker in the sort ([05c2](05c2-what-the-order-by-costs.md)) |
| A specification works unpaged and throws when paged | A `root.fetch(…)` reaching the `COUNT` query ([07d](07d-what-the-base-repository-does.md)) |
| A projection endpoint selects the whole entity | An `@Value` demoted it to an open projection ([06](06-projections.md)), or the type is inside the entity's hierarchy |
| Half an operation committed and half did not | Two repository calls, no service boundary, two transactions ([09c](09c-the-service-boundary.md)) |
| An optimistic-lock check never fires on some updates | Bulk update bypasses version checking ([04](04-modifying-queries.md), [07d](07d-what-the-base-repository-does.md)) |
| `save()` returns an object whose changes do not stick | `merge` returned a copy; you kept the argument ([06 · 13b](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)) |
| A query fails only in production, never at startup | It is a native query — no bootstrap validation ([03f](03f-what-is-checked-and-when.md)) |
| The application fails to start naming a property | A derived-query property path no longer resolves ([02d](02d-property-paths-and-ambiguity.md)) |
| The application fails to start naming a fragment | `FragmentNotImplementedException` — the `…Impl` class is missing or misplaced ([08b](08b-finding-the-implementation.md)) |

## Things worth grepping for

None of these are automatically wrong. All of them are worth one look.

**`findAll()` with no argument, called from application code.** An unbounded read of a table
that only grows. It is correct on the day it is written and it is a heap dump later.

**`.stream()` or `.forEach` over a repository result followed by a filter.** Filtering in Java
that the database could have done — usually because the derived-query name got too hard, which
is the boundary [02f](02f-where-derived-queries-stop.md) describes and the case a
`Specification` exists for.

**`save(` inside a `for`.** Fine inside one transaction with dirty checking. A `merge` per
iteration if the entities are detached ([09c](09c-the-service-boundary.md)), and a statement
per iteration either way unless JDBC batching is configured.

**`Sort.by(` with a string that came from a request.** A property path is a column name, not a
bound parameter. `JpaSort.unsafe` from user input is worse ([05c](05c-sort-is-not-free.md)).

**`@Transactional` on a controller.** The transaction now spans serialisation and the client's
network ([08 · 15](../08-the-n-plus-1-problem/15-open-in-view.md)).

**`readOnly = true` on a method whose name is a verb.** `deactivate`, `archive`, `close`,
`process` — check whether it writes ([09b](09b-what-readonly-actually-does.md)).

**`nativeQuery = true` on a method returning `Page`.** Needs an explicit `countQuery` unless
JSqlParser is on the classpath ([03g2](03g2-native-pagination-and-results.md)).

**`deleteAll()` or `deleteAllInBatch()` in production code.** The first loads every row; the
second skips cascades and lifecycle events ([04c](04c-derived-delete-versus-bulk-delete.md)).

**A projection interface with `@Value` on it.** One occurrence disables the narrowing for the
whole interface ([06](06-projections.md)).

**A class named `…RepositoryImpl` next to its repository.** The deprecated single-implementation
pattern, and a class that is picked up whether or not you meant it to be
([08](08-custom-implementations.md)).

**`spring.jpa.open-in-view` unset.** It defaults to on, and Boot logs a warning about it for a
reason ([08 · 15](../08-the-n-plus-1-problem/15-open-in-view.md)).

## The three things worth making permanent

Everything above is a one-off exercise. These three keep the answers true.

**1 · A statement-count assertion wherever N is unbounded.** Not on every test — on the list
endpoints and the batch jobs, where a regression multiplies
([08 · 6b](../08-the-n-plus-1-problem/06b-asserting-the-count-in-a-test.md)).

**2 · A test that asserts persisted state from a *separate* transaction.** It is the only test
that catches a write silently discarded by `readOnly`, and the only one that proves a boundary
exists ([04 · 20d](../04-spring-transactional/20d-what-a-test-must-assert.md)).

**3 · `NOT NULL` on the audit columns.** It converts the entire silent-auditing failure class
into a startup or insert failure ([10b](10b-what-the-handler-does.md)).

## The order to read an unfamiliar repository layer in

1. **The entities** — what is `EAGER`, what is a collection, what `@Version` exists.
2. **The repository interfaces** — [12](12-the-checklist.md)'s list, fast.
3. **One caller of each interesting method** — that is where the transaction boundary is, or
   is not.
4. **The SQL log for one representative request** — which answers more than steps 1 to 3
   together.
5. **`EXPLAIN` on the two or three statements that matter.**

Steps 4 and 5 are the ones people skip, and they are the ones that produce facts rather than
suspicions.

## Gotchas

**★ A symptom usually has two causes here, not one.** Slow pagination is often a deep offset
*and* a missing index; a stale read is often a bulk update *and* a long transaction. Fixing one
and re-measuring is the only way to tell.

**★ Grep results are leads, not defects.** Every pattern above is legitimate somewhere. The
value is in looking, not in a blanket ban.

**★ The startup failures are the good ones.** `PropertyReferenceException`,
`QueryCreationException` and `FragmentNotImplementedException` all happen before traffic. The
dangerous failures on this page never throw at all.

**★ The absence of an exception is not evidence of success.** Silent write loss, stale audit
columns, non-deterministic pagination and open projections all complete normally.

**★ You cannot diagnose fetching from the Java side.** Statement counts and `EXPLAIN` output
answer questions that no amount of reading the interface can.

**★ `spring.jpa.open-in-view` hides the boundary problems on this page.** Turning it off makes
several of these symptoms appear at once — which is the point, and why it is done deliberately
rather than during an incident.

**★ Reproducing at test-data volume proves nothing.** Every scaling symptom in the table is
invisible at ten rows.

## Interview questions

**★ An endpoint got slower as the table grew but every query is indexed. What do you check?**
Offset depth first — the skipped rows are still computed — then whether the `ORDER BY` matches
an index including direction, then whether a `Page` return type is paying for a `COUNT` on every
request.

**★ Latency grows with the number of rows returned rather than with the table size. What is
that?**
N+1. Count the statements for one request rather than reading the log; the count names the bug
immediately.

**★ A field change is not persisted and nothing throws. What is your first hypothesis?**
`readOnly = true` somewhere on the call path, which sets Hibernate's flush mode to `MANUAL` and
skips dirty checking. The second hypothesis is that the change was made on a detached entity.

**★ `updated_at` on a row is older than you know the data to be. Why?**
The write went through a bulk statement — a `@Modifying` query, an `UpdateSpecification` or a
batch delete — and no JPA lifecycle callback fired, so auditing did not run.

**★ Which failures in this topic happen at startup, and why does that matter?**
Unresolvable derived-query properties, invalid JPQL, and a fragment with no implementation. They
matter because everything else on this page fails silently or only under load.

**★ What three things would you add to a project to stop these regressions returning?**
Statement-count assertions on unbounded endpoints, tests that assert persisted state from a
separate transaction, and `NOT NULL` constraints on the audit columns.

**★ How do you read an unfamiliar repository layer?**
Entities first, then the interfaces, then one caller of each interesting method to find the
transaction boundary — and then the SQL log for a real request, which tells you more than all
three.

{/* FOOTER */}
