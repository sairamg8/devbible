---
title: "jOOQ has its own transaction API that runs a lambda against a derived Configuration, and in a Spring application it delegates to Spring — so the question is not whether it works but which of two mechanisms your codebase should use"
sidebar_label: "07b · jOOQ's transaction API"
sidebar_position: 25
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Transaction management*
> ([sql-execution/transaction-management](https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/))
> and Spring Boot 4.1's `JooqAutoConfiguration`
> ([spring-boot-jooq, v4.1.0 source](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jooq/src/main/java/org/springframework/boot/jooq/autoconfigure/JooqAutoConfiguration.java)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**jOOQ does not require Spring, so it has to be able to demarcate a transaction on its own. Its
API is a lambda: `dsl.transaction(trx -> …)`, committed if the lambda returns and rolled back if it
throws. In a Spring Boot application that API is wired to a `SpringTransactionProvider`, so it is
not a competing transaction manager — it is a second syntax for the same one. Which makes the
choice a codebase-style question rather than a correctness question, with one real gotcha inside
the lambda.**

## The API

```java
dsl.transaction(trx -> {
    trx.dsl().update(ORDER)
             .set(ORDER.STATUS, "CANCELLED")
             .where(ORDER.ID.eq(orderId))
             .execute();

    trx.dsl().insertInto(ORDER_EVENT, ORDER_EVENT.ORDER_ID, ORDER_EVENT.KIND)
             .values(orderId, "CANCELLED")
             .execute();
});
```

`transaction(TransactionalRunnable)` returns nothing; `transactionResult(TransactionalCallable)`
returns a value. **Any uncaught exception — checked or unchecked — rolls the transaction back.**

⚠️ **That last point is a real difference from Spring**, where the default rollback rule covers
`RuntimeException` and `Error` only and a checked exception commits unless you declare
`rollbackFor` — the subject of
**[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)**. Moving a block of
code between the two mechanisms changes its behaviour on checked exceptions, silently.

## 🔴 Use `trx.dsl()`, not the outer `dsl`

The lambda receives a **derived `Configuration`**, and the manual's instruction is explicit: *avoid
using the scope from outside the transaction*, and use `trx.dsl()`.

**This is the mistake that produces a "transaction that did not roll back".** The outer `dsl` is
bound to the outer scope; statements issued through it are not part of the transaction the lambda
opened. The code compiles, reads correctly, and half of it commits independently.

**The defence is mechanical:** never reference the outer `DSLContext` inside the lambda. If a
helper method needs one, pass `trx.dsl()` into it as a parameter.

## Nesting

Nested `transaction(...)` calls use **JDBC savepoints** via `DefaultTransactionProvider`. An inner
transaction that fails rolls back to its savepoint, leaving the outer one alive — the same
mechanism, and the same semantics, as `PROPAGATION_NESTED` in
**[Topic 03 · JDBC transactions](../03-jdbc-transactions/README.md)**.

The manual also documents plugging in a different `TransactionProvider` through the SPI, and shows
a Spring example built on `DataSourceTransactionManager` with `PROPAGATION_NESTED`.

## In a Spring Boot application

Boot's auto-configuration registers a **`SpringTransactionProvider`** whenever a
`PlatformTransactionManager` bean exists. So `dsl.transaction(...)` inside a Spring application
goes through Spring's transaction manager, not through jOOQ's own JDBC handling.

**The practical consequences:**

- **A `dsl.transaction(...)` inside an active `@Transactional` method participates in it**, the way
  any Spring-managed inner scope does.
- **You are not running two transaction systems**, so there is no risk of two independent
  transactions on two connections.
- **The rollback-on-checked-exception difference still stands**, because that rule belongs to
  jOOQ's lambda contract, not to the provider underneath.

## Which one should a Spring codebase use?

**`@Transactional`, as the default.** The reasons are about consistency rather than capability:

- Everything else in a Spring service — Spring Data, `JdbcClient`, messaging — is demarcated that
  way, so one mechanism means one mental model.
- Propagation, isolation, timeout, rollback rules and read-only are all declarative and all in one
  place.
- Testing conventions, `@Transactional` test rollback and observability all assume it.

**`dsl.transaction(...)` earns its place in three cases:**

1. **Code that must run outside Spring** — a migration tool, a CLI, a library.
2. **A transaction narrower than a method.** `@Transactional` is method-scoped; the lambda is
   expression-scoped, so a tight write-and-verify block inside a longer method is expressible
   without extracting a bean.
3. **Nested transactions where a savepoint is genuinely wanted** and the declarative equivalent
   would be more ceremony than clarity.

⚠️ **Mixing them in the same class is the worst option.** A reader then has to check which
mechanism each method uses before reasoning about a rollback.

## Gotchas

**★ Using the outer `dsl` inside the lambda silently escapes the transaction.** The manual says to
use `trx.dsl()`; the compiler does not enforce it, and the symptom is a partial commit that looks
impossible.

**★ Checked exceptions roll back here and commit under `@Transactional`'s default.** Moving code
between the two mechanisms changes its failure behaviour with nothing in the diff to suggest it.

**★ Catching an exception inside the lambda cancels the rollback.** The transaction rolls back
because the exception escapes. Swallowing it means committing whatever was done before the
failure — the same trap `@Transactional` has, in a form that looks more local and is therefore
easier to write.

**★ `transaction(...)` returns nothing.** Reaching for it and then needing a value leads to a
captured mutable variable, which is both ugly and easy to leave in an inconsistent state.
`transactionResult(...)` exists for exactly this.

**★ In a Spring application, the provider is Spring's — so this is not an escape hatch from
Spring.** Expecting `dsl.transaction(...)` to open an independent transaction inside a
`@Transactional` method is wrong; it participates.

**★ Nested transactions rely on savepoints, which is a real database feature with real costs.**
Deep nesting means many savepoints on one connection, and savepoint semantics under concurrency
are not intuitive.

**★ A lambda that spans a network call holds the connection for its duration.** The scope is
whatever the lambda contains, which makes it very easy to include an HTTP call inside a
transaction — the classic long-running-transaction incident, with less visual warning than an
annotated method gives.

**★ Test rollback conventions do not apply to a jOOQ-demarcated transaction.** Spring's test
support rolls back the transaction *it* opened. A `dsl.transaction(...)` inside the test method
commits on its own terms, and the data survives.

**★ Two mechanisms in one class makes rollback behaviour unreadable at a glance.** Pick one per
codebase, and make the exception loud.

**★ `TransactionProvider` is an SPI, so a project can replace it.** Useful and rare — and if
someone has, the semantics of every `dsl.transaction(...)` in the codebase are defined by that
class rather than by the manual.

**★ The lambda's `Configuration` is derived, so anything you customised on the outer one is
inherited, not replaced.** That is usually what you want and worth knowing before debugging a
setting that "did not apply".

**★ Nothing about this API changes connection pooling.** The transaction holds one connection for
its whole duration, exactly as `@Transactional` does — the accounting in
**[Topic 02 · Connection pooling](../02-connection-pooling/README.md)** is unchanged.

## Interview questions

**★ What is jOOQ's own transaction API?** `dsl.transaction(TransactionalRunnable)` and
`dsl.transactionResult(TransactionalCallable)` — a lambda that receives a derived `Configuration`,
commits if it returns and rolls back if it throws.

**★ Why must you use `trx.dsl()` inside the lambda?** Because the lambda receives a derived
`Configuration` scoped to the transaction. Statements issued through the outer `DSLContext` are not
part of it, so they commit independently — a partial write that reads like an impossibility.

**★ How does its rollback rule differ from Spring's default?** jOOQ rolls back on any uncaught
exception, checked or unchecked. Spring's default rolls back on `RuntimeException` and `Error` only
and commits on a checked exception unless `rollbackFor` says otherwise.

**★ How are nested transactions implemented?** With JDBC savepoints, via
`DefaultTransactionProvider`. An inner failure rolls back to its savepoint and the outer
transaction continues.

**★ In a Spring Boot application, what actually runs the transaction?** Spring. The
auto-configuration registers a `SpringTransactionProvider` when a `PlatformTransactionManager`
exists, so `dsl.transaction(...)` delegates to Spring's transaction manager rather than doing its
own JDBC work.

**★ Does `dsl.transaction(...)` inside a `@Transactional` method start an independent
transaction?** No — it participates, because the provider is Spring's. Using it as an escape hatch
from an enclosing transaction does not work.

**★ Which should a Spring codebase use by default, and why?** `@Transactional`. Everything else in
the application is demarcated that way, propagation and rollback rules are declarative and in one
place, and the testing and observability conventions assume it.

**★ When is the jOOQ API the better choice?** Outside Spring entirely; when the transaction should
be narrower than a method; and when a savepoint-based nested transaction is genuinely what you
want and the declarative form would be more ceremony.

**★ What happens if you catch the exception inside the lambda?** The transaction commits. The
rollback is triggered by the exception escaping, so swallowing it commits the partial work — the
same trap as a `catch` inside a `@Transactional` method.

**★ Why is a lambda-scoped transaction easy to make too long?** Because its scope is whatever you
put inside the braces, and an HTTP call or a slow computation looks unremarkable there. An
annotated method at least makes its boundary a declaration you can see at the top.

**★ Do Spring's test-rollback conventions cover a jOOQ-demarcated transaction?** No. Spring rolls
back the transaction it opened; one opened by `dsl.transaction(...)` inside the test method commits
on its own terms and leaves data behind.

**★ Can the transaction behaviour be replaced entirely?** Yes — `TransactionProvider` is an SPI.
Rare, and worth checking for before trusting the manual's semantics on an unfamiliar codebase.

{/* FOOTER */}
