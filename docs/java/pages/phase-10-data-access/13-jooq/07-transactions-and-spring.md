---
title: "Spring Boot auto-configures a DSLContext over your DataSource and wraps it in a transaction-aware proxy, which is why @Transactional works over jOOQ with nothing else configured"
sidebar_label: "07 · Transactions and Spring"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against Spring Boot 4.1's `JooqAutoConfiguration`
> ([spring-boot-jooq, v4.1.0 source](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jooq/src/main/java/org/springframework/boot/jooq/autoconfigure/JooqAutoConfiguration.java)),
> the Boot reference *Working with SQL databases*
> ([reference/data/sql](https://docs.spring.io/spring-boot/reference/data/sql.html)) and the jOOQ
> 3.21 manual — *Transaction management*
> ([sql-execution/transaction-management](https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**The good news first: `@Transactional` works over jOOQ, and it works because Boot's
auto-configuration wires jOOQ's connection provider to a `TransactionAwareDataSourceProxy` rather
than to the raw `DataSource`. So jOOQ asks for a connection, the proxy hands back the one Spring
already bound to the current transaction, and everything Topic 04 taught about propagation,
rollback rules and boundaries applies unchanged. Knowing *which bean* does that is what lets you
diagnose the day it does not.**

## What the starter gives you

`spring-boot-starter-jooq` still exists in Boot 4.1. What changed in Boot 4's module
restructuring is where the auto-configuration lives: module **`spring-boot-jooq`**, package
**`org.springframework.boot.jooq.autoconfigure`**.

The auto-configuration is declared
`@AutoConfiguration(after = {DataSourceAutoConfiguration.class, TransactionAutoConfiguration.class})`,
conditional on `DSLContext` being on the classpath and a `DataSource` bean existing. Every bean it
defines is `@ConditionalOnMissingBean`, so defining your own replaces it.

| Bean | What it is for |
|---|---|
| `DataSourceConnectionProvider` | 🔴 wraps your `DataSource` in a **`TransactionAwareDataSourceProxy`** |
| `SpringTransactionProvider` | jOOQ's own transaction API delegates to Spring's — needs a `PlatformTransactionManager` |
| `DefaultExecuteListenerProvider` (`@Order(0)`) | installs the exception translator |
| `ExceptionTranslatorExecuteListener` | maps jOOQ exceptions into Spring's `DataAccessException` hierarchy |
| `DefaultConfiguration` | the `Configuration` from [03 · The DSL](03-the-dsl.md) |
| `DefaultDSLContext` | the `DSLContext` you inject |
| `Settings` | only when `spring.jooq.config` is set |

🔴 **`TransactionAwareDataSourceProxy` is the single most important line in that list.** It is what
makes `getConnection()` return the transaction's connection instead of a fresh one from the pool.
Without it, jOOQ would take its own connection and your `@Transactional` boundary would enclose
nothing.

The jOOQ manual agrees, from its side: *"When using Spring Boot, its jOOQ starter already
pre-configures the correct Spring transaction aware data source, so Spring JDBC transactions will
work out of the box with jOOQ."*

## So `@Transactional` just works

```java
@Service
class OrderService {

    private final DSLContext dsl;

    @Transactional
    public void cancel(long orderId) {
        int updated = dsl.update(ORDER)
                         .set(ORDER.STATUS, "CANCELLED")
                         .where(ORDER.ID.eq(orderId))
                         .and(ORDER.STATUS.eq("PENDING"))
                         .execute();

        if (updated == 0) throw new IllegalStateException("not cancellable");

        dsl.insertInto(ORDER_EVENT, ORDER_EVENT.ORDER_ID, ORDER_EVENT.KIND)
           .values(orderId, "CANCELLED")
           .execute();
    }
}
```

Both statements run on the same connection, in one transaction, and the exception rolls it back —
by Spring's ordinary rules, all of which are
**[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)**'s subject. jOOQ
contributes nothing to that behaviour and does not need to.

⚠️ **Everything Topic 04 says about self-invocation, proxying, checked exceptions and propagation
applies here identically.** jOOQ does not change the proxy model, so it does not change any of the
traps.

## Exception translation

The auto-configuration installs an `ExceptionTranslatorExecuteListener`, which maps jOOQ's
exceptions into Spring's `DataAccessException` hierarchy. That is the same hierarchy
`JdbcTemplate` and Spring Data produce — see
**[Topic 05 · SQL-first access](../05-sql-first-access/README.md)** — so a service catching
`DuplicateKeyException` behaves the same whichever of the three issued the statement.

**That is a bigger deal than it looks** on a codebase mixing access technologies: one exception
vocabulary above the data layer, rather than one per library.

## The dialect

`spring.jooq.sql-dialect` sets it; otherwise Boot detects it from the `DataSource`, falling back
to `DEFAULT`.

🔴 **Boot's own documentation carries a limitation worth knowing before you plan:** *"Spring Boot
can only auto-configure dialects supported by the open source version of jOOQ."* On PostgreSQL
that is fine — it is an open-source-edition dialect, per
**[01b · The licence question](01b-the-licence-question.md)**. On Oracle or SQL Server with a paid
edition, the dialect is yours to set explicitly.

⚠️ **A `DEFAULT` dialect renders generic SQL**, so a PostgreSQL-specific expression degrades or
fails. It is the first thing to check when a query that should work does not — the same advice
[03 · The DSL](03-the-dsl.md) gives, arriving here as a configuration question.

## Customising without replacing

Two hooks, in increasing order of weight:

- **A `DefaultConfigurationCustomizer` bean** — adjust the auto-configured `Configuration`.
- **Your own `org.jooq.Configuration` `@Bean`** — every downstream bean is
  `@ConditionalOnMissingBean`, so yours wins and you own the whole thing, including the
  transaction-aware wiring.

**Prefer the customizer.** Defining a bare `Configuration` bean is how a project silently loses
`TransactionAwareDataSourceProxy` and discovers, weeks later, that its transactions never enclosed
anything.

## Testing

Boot provides a `@JooqTest` slice at `org.springframework.boot.jooq.test.autoconfigure.JooqTest`.

⚠️ **Read Topic 04's findings about Boot 4 test slices before assuming what a slice includes** —
the `@JdbcTest` slice changed in Boot 4 and imports neither Flyway nor Liquibase nor SQL
initialisation, so nothing in it builds a schema. Verify what `@JooqTest` imports on your version
rather than inheriting an assumption from a 3.x example.

## Gotchas

**★ Defining your own `org.jooq.Configuration` bean disables the transaction-aware wiring.** Every
auto-configured bean is `@ConditionalOnMissingBean`, so your bean replaces the one that wraps the
`DataSource` in `TransactionAwareDataSourceProxy`. Transactions then silently do not span
statements. Use a `DefaultConfigurationCustomizer` instead.

**★ Building a `DSLContext` with `DSL.using(dataSource, POSTGRES)` bypasses Spring entirely.** It
looks identical to the injected one and takes its own connections. Anything it runs is outside
whatever transaction is open.

**★ A `DEFAULT` dialect is the quiet failure mode of a misconfigured `DataSource`.** Boot detects
the dialect from the `DataSource`; if detection fails you get generic SQL and errors that look like
jOOQ bugs.

**★ Boot only auto-configures open-source-edition dialects.** On a commercial edition and a
commercial database, set `spring.jooq.sql-dialect` explicitly and do not wait to discover it.

**★ jOOQ's own `dsl.transaction(...)` is a second transaction mechanism in the same application.**
It works, and mixing it with `@Transactional` needs care — that is
**[07b · jOOQ's own transaction API](07b-jooqs-transaction-api.md)**.

**★ Exception translation only happens through the auto-configured listener.** A hand-built
`Configuration` without it throws jOOQ's own `DataAccessException`, and every `catch` block written
against Spring's hierarchy stops matching.

**★ `@Transactional(readOnly = true)` does not make jOOQ skip anything.** There is no persistence
context to put in read-only mode; it sets the JDBC connection read-only flag and no more. The
Hibernate-specific behaviour discussed in Topic 06 has no jOOQ counterpart.

**★ A `DSLContext` used outside any transaction takes and returns a connection per statement.**
Three statements is three checkouts and three implicit transactions, seeing three snapshots. Fine
for one read, wrong for a consistent set of them.

**★ Self-invocation defeats `@Transactional` here exactly as it does anywhere.** The proxy model is
Spring's; jOOQ changes nothing about it, and a private method calling another method in the same
bean gets no transaction.

**★ `spring.jooq.config` is the only path to `Settings` through properties.** Anything else —
`executeWithOptimisticLocking`, rendering options — goes through the customizer or the settings
file that property names.

**★ The auto-configuration runs after `DataSourceAutoConfiguration` and
`TransactionAutoConfiguration`.** A `DataSource` defined in a way that makes it available later
than expected produces a missing-bean condition and no `DSLContext`, with no error explaining why.

**★ Two `DataSource` beans without a `@Primary` leaves jOOQ's condition ambiguous.** Multi-datasource
setups need the jOOQ `Configuration` wired explicitly — and then you own the transaction-aware
wrapping, deliberately this time.

## Interview questions

**★ Why does `@Transactional` work over jOOQ with no extra configuration?** Because Boot's
auto-configuration builds jOOQ's `DataSourceConnectionProvider` over a
`TransactionAwareDataSourceProxy`. jOOQ asks for a connection and gets the one Spring bound to the
current transaction.

**★ Which module and package does the jOOQ auto-configuration live in on Boot 4.1?** Module
`spring-boot-jooq`, package `org.springframework.boot.jooq.autoconfigure`. The starter is still
`spring-boot-starter-jooq`.

**★ What happens if you define your own `org.jooq.Configuration` bean?** Yours wins — every
auto-configured bean is `@ConditionalOnMissingBean` — and you lose the transaction-aware
`DataSource` wrapping and the exception translator unless you reproduce them. It is the most
consequential silent misconfiguration on this page.

**★ What does the exception translator do?** Maps jOOQ's exceptions into Spring's
`DataAccessException` hierarchy, so a service catches the same exception types whether the
statement came from jOOQ, `JdbcTemplate` or Spring Data.

**★ How is the SQL dialect determined?** From `spring.jooq.sql-dialect` if set, otherwise detected
from the `DataSource`, falling back to `DEFAULT`. Boot only auto-configures dialects the open
source edition supports.

**★ What goes wrong with a `DEFAULT` dialect?** Generic SQL is rendered, so PostgreSQL-specific
expressions degrade or fail. It is the first thing to check when a query fails in a way that looks
like a jOOQ defect.

**★ How do you customise the auto-configured `Configuration` safely?** A
`DefaultConfigurationCustomizer` bean. It adjusts what Boot built rather than replacing it, so the
transaction-aware provider and the exception translator survive.

**★ Does `@Transactional(readOnly = true)` do anything for jOOQ?** It sets the connection's
read-only flag. There is no persistence context, so none of the Hibernate-specific effects apply —
no flush mode to change, no snapshot to skip.

**★ What happens when you use a `DSLContext` outside a transaction?** Each statement takes a
connection from the pool and returns it, running in its own implicit transaction. Several reads
then see several snapshots.

**★ Does jOOQ change any of Spring's transaction traps?** No. Self-invocation, proxying,
propagation, rollback rules and the checked-exception default are all Spring's, and they behave
identically over jOOQ.

**★ What is the `@JooqTest` slice, and what should you check about it?** Boot's test slice for jOOQ,
at `org.springframework.boot.jooq.test.autoconfigure.JooqTest`. Check what it actually imports on
your Boot version — Boot 4 changed what the sibling `@JdbcTest` slice brings in, and inherited
assumptions from 3.x examples are unreliable.

**★ Your transactions do not seem to span two statements. What are the two first suspects?** A
hand-defined `Configuration` bean that lost `TransactionAwareDataSourceProxy`, and a `DSLContext`
built by hand with `DSL.using(dataSource, …)` instead of the injected one.

{/* FOOTER */}
