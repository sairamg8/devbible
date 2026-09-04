---
title: "Using jOOQ for reads and JPA for writes is jOOQ's own documented arrangement, and it needs no plumbing because Spring puts both libraries on the EntityManager's connection inside one transaction"
sidebar_label: "08b · Using both"
sidebar_position: 27
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Different use cases for jOOQ*
> ([getting-started/use-cases](https://www.jooq.org/doc/latest/manual/getting-started/use-cases/)),
> the Spring Boot 4.1.1 sources
> [`JpaBaseConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java),
> [`DataSourceTransactionManagerAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jdbc/src/main/java/org/springframework/boot/jdbc/autoconfigure/DataSourceTransactionManagerAutoConfiguration.java)
> and [`JooqAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jooq/src/main/java/org/springframework/boot/jooq/autoconfigure/JooqAutoConfiguration.java),
> and the
> [`JpaTransactionManager`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/JpaTransactionManager.html)
> and
> [`TransactionAwareDataSourceProxy`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/TransactionAwareDataSourceProxy.html)
> javadocs.
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**The most common way jOOQ enters a codebase is not a migration — it is an addition. JPA keeps the
aggregate it was already writing, and jOOQ takes the four reporting queries that were fighting the
ORM. Mechanically this is not a compromise: both libraries end up executing on the same
`java.sql.Connection` inside the same transaction, and Boot's wiring does it with no configuration
at all. This chunk is the mechanism. The policy that keeps it sane is
[08c](08c-one-owner-per-table.md), and the way it goes wrong is
[08d](08d-the-stale-persistence-context.md).**

## jOOQ's documentation expects you to do this

The manual's *Different use cases for jOOQ* page lists, among the ways the community actually
deploys the library:

> *"Using Hibernate for 70% of the queries (i.e. CRUD) and jOOQ for the remaining 30% where SQL is
> really needed"*

and, on the same page:

> *"Using jOOQ for SQL building and Spring Data for SQL execution"*

**That is unusual and worth noticing.** jOOQ does not position itself as a replacement you must
commit to; it documents the hybrid as a first-class use case, alongside "jOOQ as a SQL builder
without code generation" — the variant
[09b · The people, the licence and the exit](09b-the-people-and-the-exit.md) returns to.

## Why the split falls where it does

The reason people reach for "jOOQ for reads, JPA for writes" — rather than the reverse, or
something down the middle — is that each library's machinery is concentrated at one end.

| | JPA contributes | jOOQ contributes |
|---|---|---|
| **Reading one row by id** | identity map, lazy graph, caching | a typed row |
| **Reading a report** | nothing JPQL can express | window functions, CTEs, `MULTISET`, `jsonb` |
| **Mutating an aggregate** | dirty checking, cascades, orphan removal, `@Version` | one statement per row you remember to write |
| **Set-based write** | a bulk statement that bypasses its own cache | the statement you meant |

**Read the second and third rows together.** On a report JPA's contribution is *zero* — its answer
is native SQL, at which point the ORM is a connection provider. On an aggregate mutation jOOQ's
contribution is *negative* — you are hand-writing what dirty checking would have derived. The
split is not a truce; it is each library doing the half it is good at.

## The wiring is two starters and no configuration

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-jooq</artifactId>
</dependency>
```

Both starters see the same `DataSource`. What matters is what happens to the *transaction*, and
the chain is worth knowing link by link, because every diagnosis of "my two libraries were in
different transactions" is a broken link in it.

**1 · With JPA on the classpath, the transaction manager is `JpaTransactionManager`.**
`JpaBaseConfiguration` declares its `transactionManager` bean
`@ConditionalOnMissingBean(TransactionManager.class)`, and
`DataSourceTransactionManagerAutoConfiguration` — which would otherwise give you a
`JdbcTransactionManager` — carries `@AutoConfigureOrder(Ordered.LOWEST_PRECEDENCE)` and the same
condition. JPA's manager is registered first and wins.

**2 · `JpaTransactionManager` publishes the `EntityManager`'s connection to the JDBC world.**
Its javadoc, quoted in full in
[Topic 05 · 11 · Mixing both](../05-sql-first-access/11-mixing-both.md):

> *"This transaction manager also supports direct `DataSource` access within a transaction (i.e.
> plain JDBC code working with the same `DataSource`). This allows for mixing services which
> access JPA and services which use plain JDBC (without being aware of JPA)!"*

with the condition attached:

> *"Application code needs to stick to the same simple Connection lookup pattern as with
> `DataSourceTransactionManager` (i.e. `DataSourceUtils.getConnection(DataSource)` or going
> through a `TransactionAwareDataSourceProxy`)."*

**3 · jOOQ goes through a `TransactionAwareDataSourceProxy`, which is exactly the second option.**
Boot's `JooqAutoConfiguration` builds jOOQ's `DataSourceConnectionProvider` over that proxy —
[07 · Transactions and Spring](07-transactions-and-spring.md) — and the proxy's javadoc says what
it then does:

> *"Delegates to DataSourceUtils for automatically participating in thread-bound transactions… `getConnection` calls and close calls on returned Connections will behave properly within a transaction, i.e. always operate on the transactional Connection."*

**4 · So the connection jOOQ executes on is the `EntityManager`'s own connection.** Not a second
connection in the same distributed transaction; not two pool checkouts that commit together. One
connection, one `COMMIT`, one snapshot.

## A service that uses both

```java
@Service
class OrderService {

    private final OrderRepository orders;   // JPA
    private final DSLContext dsl;           // jOOQ

    @Transactional
    public void cancel(long orderId, String reason) {
        Order order = orders.findById(orderId).orElseThrow();
        order.cancel(reason);               // domain behaviour; dirty checking writes it
    }

    @Transactional(readOnly = true)
    public List<MonthlyRevenue> revenueByMonth(int year) {
        return dsl.select(
                      trunc(ORDER_LINE.order().PLACED_AT, DatePart.MONTH).as("month"),
                      sum(ORDER_LINE.QUANTITY.mul(ORDER_LINE.UNIT_PRICE)).as("total"))
                  .from(ORDER_LINE)
                  .where(year(ORDER_LINE.order().PLACED_AT).eq(year))
                  .groupBy(field("month"))
                  .fetchInto(MonthlyRevenue.class);
    }
}
```

**Nothing here is a compromise.** `cancel` is an aggregate mutation and JPA is good at it;
`revenueByMonth` is a question and jOOQ is good at that. The two methods never touch the same rows
in the same transaction — which is the whole discipline, and the subject of
[08c](08c-one-owner-per-table.md).

## One connection, two very different execution models

Sharing a connection is not the same as sharing a schedule, and this is the sentence the next two
chunks are built on:

🔴 **A jOOQ statement executes when you call `execute()` or `fetch()`. A JPA change executes when
the persistence context is flushed — which is usually at commit.** Two writes that appear adjacent
in your source can reach the database in the opposite order, and a jOOQ `SELECT` sitting between
an entity mutation and its flush reads a row that has not been updated yet.

That asymmetry is harmless when the two libraries touch disjoint tables and dangerous the moment
they do not. [08d](08d-the-stale-persistence-context.md) works through both directions of it.

## The four things that must be true

1. **One `DataSource`.** Two `DataSource` beans means two pools and two transactions, and it is a
   configuration accident rather than a design.
2. **One transaction manager**, with everything demarcated through it — `@Transactional`, not
   `dsl.transaction(...)` in some places ([07b](07b-jooqs-transaction-api.md)).
3. **The injected `DSLContext`**, never one you built. `DSL.using(dataSource, POSTGRES)` skips the
   transaction-aware proxy and takes its own connection, putting the jOOQ half of your service
   outside the transaction the JPA half is in.
4. **No hand-rolled `org.jooq.Configuration` bean.** Every bean in `JooqAutoConfiguration` is
   `@ConditionalOnMissingBean`, so yours replaces the one that installs the proxy. This is the
   single most consequential silent misconfiguration in the arrangement.

## Two roads to the same exception hierarchy

Both halves end up throwing Spring `DataAccessException`s, but by different routes: jOOQ through
the `ExceptionTranslatorExecuteListener` the auto-configuration installs, JPA through Spring's
persistence-exception translation. **The vocabulary above the data layer is therefore one
vocabulary**, which is a real benefit of the arrangement —
[Topic 05 · The exception hierarchy](../05-sql-first-access/06-the-exception-hierarchy.md)
covers what that hierarchy is worth.

⚠️ **The timing still differs.** A unique-constraint violation caused by a jOOQ `INSERT` is thrown
at the `execute()` call. The same violation caused by an entity write is thrown at flush, which
may be at commit, possibly outside your `try` block and outside the method that caused it.

## Gotchas

**★ Two `DataSource` beans means two transactions, and nothing warns you.** Everything compiles,
everything runs, and the jOOQ half commits independently of the JPA half. Check for a single
`DataSource` before you check anything else.

**★ Building a `DSLContext` by hand puts half your service outside the transaction.**
`DSL.using(dataSource, SQLDialect.POSTGRES)` produces an object identical in type to the injected
one and different in every way that matters. Inject it; never construct it.

**★ Defining your own `org.jooq.Configuration` bean removes `TransactionAwareDataSourceProxy`.**
The auto-configuration's beans are all `@ConditionalOnMissingBean`. Use a
`DefaultConfigurationCustomizer` instead — [07](07-transactions-and-spring.md).

**★ `@Transactional(readOnly = true)` means two different things to the two libraries.** To
Hibernate it can change flush mode and skip dirty checking; to jOOQ it is the JDBC connection's
read-only flag and nothing else. A read-only method that mixes both is doing less than you think
on one side of it.

**★ jOOQ's `dsl.transaction(...)` inside a JPA service is a second demarcation style, not a second
transaction.** It participates through `SpringTransactionProvider`, but its rollback rule differs
on checked exceptions — [07b](07b-jooqs-transaction-api.md). Pick `@Transactional` and stay there.

**★ Constraint violations surface at different moments from the two libraries.** Immediately from
jOOQ, at flush from JPA. A test that asserts "this throws `DuplicateKeyException` here" can pass
for the jOOQ path and fail for the JPA one with the same data.

**★ The connection count is unchanged; the hold time may not be.** One connection per transaction,
as before — but a transaction that now spans an aggregate mutation *and* a long analytical query
holds it for the sum of both, which is a pool-sizing input
([Topic 02 · Connection pooling](../02-connection-pooling/README.md)).

**★ Nothing converts between a `Record` and an entity.** A jOOQ `Record` cannot be attached to a
persistence context and an entity is just an object to jOOQ. Code that tries to bridge them by
hand is the mapping layer the arrangement was supposed to avoid.

**★ With a JTA transaction manager the chain above is not the chain you get.** `JpaBaseConfiguration`
takes a `JtaTransactionManager` when one is available, and I could not confirm from the
documentation how jOOQ's connection provider participates in that setup. On a single-datasource
Boot application the question does not arise; on a JTA one, verify it rather than assuming this
page applies.

**★ A jOOQ statement inside a JPA transaction still needs the transaction to exist.** If the
`@Transactional` annotation was never effective — self-invocation, a non-public method, a
non-proxied call — jOOQ takes its own connection per statement and JPA gets a context per call.
Both halves misbehave, in different ways, from one cause
([Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)).

## Interview questions

**★ Is using jOOQ and JPA together supported, or a hack?** Supported, and documented by jOOQ
itself: its *Different use cases* page lists using *"Hibernate for 70% of the queries (i.e. CRUD)
and jOOQ for the remaining 30% where SQL is really needed"* as a normal deployment. It is not a
workaround; it is the shape most adoptions take.

**★ Why do the two libraries end up in the same transaction with no configuration?** Because
`JpaTransactionManager` exposes the `EntityManager`'s JDBC connection through `DataSourceUtils`,
and Boot wires jOOQ's `DataSourceConnectionProvider` over a `TransactionAwareDataSourceProxy`,
which delegates to `DataSourceUtils`. jOOQ therefore executes on the connection JPA already owns.

**★ Which transaction manager do you get when both are on the classpath?** `JpaTransactionManager`.
`JpaBaseConfiguration` declares it `@ConditionalOnMissingBean(TransactionManager.class)` and
`DataSourceTransactionManagerAutoConfiguration` is ordered at lowest precedence with the same
condition, so JPA's manager is registered first and the JDBC one never appears.

**★ Why is the split "jOOQ for reads, JPA for writes" rather than the other way round?** Because
each library's machinery sits at one end. JPA's value — dirty checking, cascades, `@Version`, the
identity map — is nearly all on the write path of an aggregate. jOOQ's value — window functions,
CTEs, `MULTISET`, PostgreSQL types — is nearly all on the read path of a question.

**★ What are the four preconditions for the wiring to work?** One `DataSource`; one transaction
manager with everything demarcated through it; the injected `DSLContext` rather than a hand-built
one; and no hand-rolled `org.jooq.Configuration` bean replacing the auto-configured chain.

**★ Someone reports that a jOOQ write and a JPA write did not roll back together. Where do you
look?** In order: two `DataSource` beans; a `DSLContext` built with `DSL.using(...)`; a custom
`org.jooq.Configuration` bean that dropped `TransactionAwareDataSourceProxy`; and a
`@Transactional` annotation that was never effective for ordinary Spring proxy reasons.

**★ The two libraries share a connection — does that mean they share an execution order?** No, and
this is the important one. jOOQ statements execute at the call; JPA changes execute at flush,
usually at commit. Adjacent lines of Java can reach the database in the opposite order, which is
where every stale-read and lost-update story in this arrangement begins.

**★ Does sharing a connection change connection-pool sizing?** Not the count — still one connection
per transaction. It can change the duration, because a transaction that now contains both an
aggregate mutation and an analytical query holds its connection for the sum of the two.

**★ Do the two libraries throw the same exceptions?** They reach the same Spring
`DataAccessException` hierarchy, jOOQ through its execute listener and JPA through persistence
exception translation. They do not throw at the same *time*: jOOQ throws at the statement, JPA at
the flush.

**★ Can you hand a jOOQ `Record` to JPA, or an entity to jOOQ?** Not meaningfully. A `Record` has
no persistence identity and cannot be attached to a persistence context; an entity is an ordinary
object to jOOQ. Any bridge you write by hand is the mapping layer you were trying to avoid.

{/* FOOTER */}
