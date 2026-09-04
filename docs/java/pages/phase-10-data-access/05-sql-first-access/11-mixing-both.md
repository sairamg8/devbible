---
title: "JPA and `JdbcClient` in one transaction share one connection, because the transaction manager hands the JDBC layer the `EntityManager`'s own"
sidebar_label: "11 · Mixing both"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JpaTransactionManager` javadoc
> ([docs.spring.io/.../orm/jpa/JpaTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/JpaTransactionManager.html)),
> the `DataSourceUtils` javadoc
> ([.../jdbc/datasource/DataSourceUtils.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceUtils.html))
> and the Spring Framework 7.0 reference *Data Access → Transaction Management*
> ([docs.spring.io/spring-framework/reference/data-access/transaction.html](https://docs.spring.io/spring-framework/reference/data-access/transaction.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Hibernate ORM 7.4.1.

**Most services that adopt SQL-first access do not abandon JPA — they add
`JdbcClient` next to it. That works, and the reason it works is worth reading
literally: `JpaTransactionManager` registers the `EntityManager`'s own JDBC
connection with `DataSourceUtils`, so a `JdbcClient` call inside a JPA transaction
runs on the same connection, in the same transaction, under the same snapshot.
There is exactly one trap in the arrangement and it is sharp enough to get its own
chunk — [11b](11b-the-flush-ordering-trap.md).**

## The mechanism, in Spring's own words

`JpaTransactionManager`'s javadoc is unusually direct, exclamation mark included:

> "This transaction manager also supports direct `DataSource` access within a
> transaction (i.e. plain JDBC code working with the same `DataSource`). This allows
> for mixing services which access JPA and services which use plain JDBC (without
> being aware of JPA)!"

with the condition attached:

> "Application code needs to stick to the same simple Connection lookup pattern as
> with `DataSourceTransactionManager` (i.e. `DataSourceUtils.getConnection(DataSource)`
> or going through a `TransactionAwareDataSourceProxy`)."

That condition is satisfied automatically, because
`DataSourceUtils.getConnection` is exactly what `JdbcTemplate` uses
([chunk 9](09-transactions-and-the-connection.md)). And `setDataSource`'s javadoc
says where the connection comes from:

> "A transactional JDBC `Connection` for this `DataSource` will be provided to
> application code accessing this `DataSource` directly via `DataSourceUtils` or
> `JdbcTemplate`. **The Connection will be taken from the JPA `EntityManager`.**"

So it is not "two connections that happen to be in the same transaction". It is one
connection, borrowed from the `EntityManager`, handed to the JDBC layer.

Two conditions, both normally met by Boot:

- **The same `DataSource`.** The javadoc: "The given `DataSource` should obviously
  match the one used by the given `EntityManagerFactory`." It is autodetected — "you
  usually don't need to explicitly specify the 'dataSource' property".
- **A `JpaDialect`.** "Note that you need to use a JPA dialect for a specific JPA
  implementation to allow for exposing JPA transactions as JDBC transactions."
  Hibernate's is configured for you by Boot.

**[Which manager you have](../04-spring-transactional/06b-which-manager-you-have.md)**
covers the manager side; this chunk assumes it.

## What sharing a connection actually buys

| | Consequence |
|---|---|
| One transaction | one `COMMIT`; a rollback undoes both the entity writes and the SQL writes |
| One session | the JDBC statements see the entity writes **that have been flushed** — see [11b](11b-the-flush-ordering-trap.md) |
| One snapshot | at `REPEATABLE READ` or `SERIALIZABLE`, both see the same view of the database |
| One set of locks | a row locked by an entity write is already yours when the SQL touches it |
| One pooled connection | mixing does **not** double your pool usage |

That last row is worth stating explicitly, because the alternative — injecting a
second `DataSource` or building a `JdbcTemplate` over one — *would* double it, and
would give up the other four rows as well.

## The shape that works

```java
@Service
public class OrderService {

    private final OrderRepository orders;      // Spring Data JPA — the write model
    private final OrderQueries queries;        // JdbcClient — the read model

    @Transactional
    public void place(NewOrder request) {
        Order order = Order.from(request);     // an aggregate with invariants
        orders.save(order);                    // dirty checking, cascade to lines
    }

    @Transactional(readOnly = true)
    public List<OrderSummary> dashboard(long customerId) {
        return queries.summariesFor(customerId);   // one SQL statement, one record
    }
}
```

Two methods, two transactions, and neither mixes. **That separation is the
recommendation**, and it is not fussiness — it is what makes 11b's trap impossible
by construction. When a single transaction genuinely must do both, read 11b first.

`readOnly = true` on the query method is worth having: it lets Hibernate skip dirty
checking and the flush for that transaction —
**[Where read-only pays](../04-spring-transactional/15b-where-read-only-pays.md)**.

## Where each one belongs

| | Entities / Spring Data JPA | `JdbcClient` |
|---|---|---|
| Loading an aggregate to change it | ✔ | |
| Enforcing invariants across a graph | ✔ | |
| Cascading writes to children | ✔ | |
| List screens and search results | | ✔ |
| Reports and aggregates | | ✔ |
| Bulk `UPDATE` / `DELETE` | | ✔ |
| Anything using `ON CONFLICT`, `RETURNING`, `SKIP LOCKED` | | ✔ |

The split is by **use case, not by module**. Both can — and usually should — sit in
the same package, operating on the same tables.

## Gotchas

**A second `DataSource` for the SQL side undoes everything.** Injecting a separate
`DataSource` "so the reports do not interfere" gives you a second connection, a
second transaction, no shared snapshot, and double the pool draw per request. If the
goal is genuinely to isolate reporting load, that is a read replica and a deliberate
architectural decision, not an extra bean.

**`@Transactional(readOnly = true)` does not make a JDBC write fail.** The flag is a
hint that passes through several layers, each free to ignore it —
**[Read-only](../04-spring-transactional/15-read-only.md)**. Hibernate honours it by
skipping dirty checking; a `JdbcClient` `update()` inside such a method will
generally still execute. Do not treat it as a guard.

**Two transaction managers in one application is where this silently breaks.** If
something has defined a `DataSourceTransactionManager` alongside the
`JpaTransactionManager` and a method picks up the wrong one, the JDBC work runs in a
transaction the JPA work is not in. Everything still succeeds; only a rollback
reveals it —
**[What Boot picked for you](../04-spring-transactional/06c-what-boot-picked-for-you.md)**.

**`NESTED` propagation behaves differently for the two.** `JpaTransactionManager`'s
javadoc: nested transactions "will just apply to the JDBC Connection, not to the JPA
`EntityManager` and its cached entity objects", and `nestedTransactionAllowed`
defaults to `false`. So a savepoint rolls back your SQL writes and leaves the
persistence context believing its entities are still valid —
**[`NESTED` and savepoints](../04-spring-transactional/11-nested-and-savepoints.md)**.

**Exception translation is uniform, which is a genuine benefit and easy to
overlook.** A `DuplicateKeyException` from a `JdbcClient` insert and one arising
from a Hibernate flush are the same class, so one `@ControllerAdvice` handles both
([chunk 6](06-the-exception-hierarchy.md)). That is one of the strongest practical
arguments for staying inside the Spring hierarchy on both sides.

**Mixing inside one transaction is a design decision, not a convenience.** It works,
and every time you do it you have taken on the flush-ordering reasoning of
[11b](11b-the-flush-ordering-trap.md). The default should be one style per
transaction; reach for both only when the operation genuinely requires it.

## Interview questions

**★ Can you use `JdbcTemplate` and JPA in the same transaction?**
Yes, and it is fully supported rather than a workaround.
`JpaTransactionManager`'s javadoc says it "supports direct `DataSource` access
within a transaction… This allows for mixing services which access JPA and services
which use plain JDBC". The mechanism is that the manager takes the JDBC connection
from the `EntityManager` and binds it to the thread, and `JdbcTemplate` obtains
connections through `DataSourceUtils`, which finds thread-bound connections. So both
run on one connection, in one transaction, committing and rolling back together. The
two prerequisites — the same `DataSource` and a vendor `JpaDialect` — are both
handled by Spring Boot's autoconfiguration.

**★ Does mixing them use two connections from the pool?**
No, and that is one of the main reasons to do it this way. The connection is
literally the `EntityManager`'s — the javadoc says "The Connection will be taken from
the JPA `EntityManager`" — so one request holds one connection regardless of how many
of each kind of call it makes. Injecting a second `DataSource` for the SQL side is
what would double the draw, and it would also cost you the shared snapshot, the
shared locks and the single commit.

**★ Where would you draw the line between the two in a real service?**
By use case, per repository method, not by module. Entities for anything you load in
order to change: an aggregate with invariants, a graph of children saved together,
anywhere dirty checking and cascade are doing real work. `JdbcClient` for list
screens, search results, reports and aggregates, bulk updates, and anything using a
PostgreSQL clause an ORM cannot express — `ON CONFLICT`, `RETURNING`, `FOR UPDATE
SKIP LOCKED`. Both live in the same package and touch the same tables; what differs
is what the operation is trying to do.

**★ What is the one thing you must be careful about when mixing?**
Flush ordering. JPA buffers changes in the persistence context and writes them at
flush time, and a `JdbcClient` query is not something the persistence provider knows
about — so it does not trigger an auto-flush, and it therefore does not see entity
changes made earlier in the same transaction. The reverse is also true: a bulk SQL
update does not reach loaded entities, which remain stale and may be flushed over
the top of it. The fixes are to flush explicitly before a JDBC read, to clear the
context after a bulk SQL write, or — best — not to mix within one transaction.

**★ Does `@Transactional(readOnly = true)` stop a `JdbcClient` write?**
Not reliably. It is a hint that passes through the transaction manager, the JPA
provider, the JDBC driver and possibly the database, and each layer decides what to
do with it. Hibernate uses it to skip dirty checking and the flush, which is a real
saving on a read-heavy transaction. But a `JdbcClient` `update()` inside such a
method will generally execute. If you need writes to be impossible, that is a
database-level concern — a read-only transaction on the server, or a role without
write permission — not an annotation attribute.

**★ How does `NESTED` propagation behave when both are in play?**
Asymmetrically, and the javadoc warns about it. `JpaTransactionManager` supports
nested transactions through JDBC savepoints, but says they "will just apply to the
JDBC `Connection`, not to the JPA `EntityManager` and its cached entity objects and
related context", and it defaults `nestedTransactionAllowed` to `false` for that
reason. So rolling back to a savepoint undoes the SQL statements and leaves the
persistence context with entities reflecting changes that no longer exist in the
database. If you need a partial rollback in a mixed transaction, that is a strong
signal to split the operation into two transactions instead.

---

← Prev: [10b · What you give up](10b-what-you-give-up.md) · Index: [05 · SQL-first access](README.md) · Next → [11b · The flush trap](11b-the-flush-ordering-trap.md)
