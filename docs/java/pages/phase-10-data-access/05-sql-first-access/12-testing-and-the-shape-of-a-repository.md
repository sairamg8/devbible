---
title: "A SQL-first repository is a plain class holding a `JdbcClient` — nothing generates it, nothing proxies it, and every statement it sends is one you can read"
sidebar_label: "12 · The repository shape"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access → JDBC
> Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> the `JdbcClient` javadoc
> ([docs.spring.io/.../jdbc/core/simple/JdbcClient.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.html))
> and the Spring Boot 4.1 reference *Data → SQL Databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Twenty-three chunks have argued about statements. This one is about the class they
live in. A SQL-first repository is not an interface Spring implements at startup — it
is a class you write, with a `JdbcClient` field and one method per question. There is
no proxy, no derived query parser, no metamodel and no dialect. That is the whole
trade: you lose everything a framework was inferring for you, and you gain a class
whose behaviour is entirely determined by its own source.**

## The class

```java
@Repository
public class OrderQueries {

    private static final String FIND_BY_ID = """
            select id, customer_id, status, total, placed_at
            from orders
            where id = :id
            """;

    private static final String SUMMARIES_FOR_CUSTOMER = """
            select o.id, o.placed_at, o.total, count(l.id) as line_count
            from orders o
            left join order_line l on l.order_id = o.id
            where o.customer_id = :customer
            group by o.id, o.placed_at, o.total
            order by o.placed_at desc
            limit :limit
            """;

    private final JdbcClient db;

    OrderQueries(JdbcClient db) {
        this.db = db;
    }

    public Optional<OrderRow> findById(long id) {
        return db.sql(FIND_BY_ID)
                 .param("id", id)
                 .query(OrderRow.class)
                 .optional();
    }

    public List<OrderSummary> summariesFor(long customerId, int limit) {
        return db.sql(SUMMARIES_FOR_CUSTOMER)
                 .param("customer", customerId)
                 .param("limit", limit)
                 .query(OrderSummary.class)
                 .list();
    }
}

public record OrderRow(long id, long customerId, String status,
                       BigDecimal total, Instant placedAt) {}

public record OrderSummary(long id, Instant placedAt,
                           BigDecimal total, long lineCount) {}
```

That is the entire pattern. The `JdbcClient` bean is auto-configured by Boot "based
on the presence of a `NamedParameterJdbcTemplate`", it is thread-safe, and it is
injected like anything else. One constructor means no `@Autowired` is needed.

## The five things that are not there

**1 · No interface that Spring implements.** With Spring Data you declare
`interface OrderRepository extends CrudRepository<Order, Long>` and a proxy appears
at startup carrying methods you never wrote. Here the class *is* the implementation.

**2 · No proxy.** Nothing intercepts a call to `findById`. A stack trace runs from
your controller into your method and then into `DefaultJdbcClient`, with no
`$Proxy` or `$$SpringCGLIB$$` frame in between. A breakpoint on line one of the
method is hit on the first call.

**3 · No derived query parsing.** `findByCustomerIdAndStatusOrderByPlacedAtDesc` is
not a thing. A method name is a name; the SQL is the SQL.

**4 · No metamodel and no dialect.** Nothing knows that `orders` has a column called
`total`, and nothing rewrites your SQL for a database vendor. The string you wrote is
the string the driver receives, modulo the named-parameter rewrite of
[chunk 5](05-named-parameters.md).

**5 · No entity lifecycle.** The records that come back are values. Nothing tracks
them, nothing will write them back, and mutating one — if it were mutable — would
change nothing anywhere ([chunk 10b](10b-what-you-give-up.md)).

## What that costs

- **Every query is a query you write, including the boring ones.** `findById`,
  `existsById`, `deleteById`, `count()` — four methods you get free from
  `CrudRepository` and write by hand here.
- **Paging is manual.** No `Pageable`, no `Page<T>` with a total count; `limit` and
  `offset` are parameters, and the total is a second query if you need one.
- **Nothing checks your column names.** `select totl` compiles.
  ([Chunk 10b](10b-what-you-give-up.md) lists the three defences; the one that
  actually works is a test.)
- **Sorting from user input is your problem.** A `Sort` object cannot be bound as a
  parameter — an `order by` clause is SQL text, so a caller-chosen sort column has to
  be validated against an allow-list, never concatenated.
- **Dynamic predicates get ugly fast.** There is no `Specification` to compose, so a
  search screen with eight optional filters is either eight `and` clauses that each
  test `(:param is null or col = :param)`, or a small amount of string assembly from
  literal fragments you control.

## What it buys

- **The class is readable end to end.** Everything it does is in the file.
- **A stack trace points at your code.** No generated frame to decode.
- **Statement count is visible.** The number of round trips a method makes is the
  number of `db.sql(...)` calls in it.
- **Startup does nothing.** No repository scanning, no proxy generation, no metamodel
  build — which matters for a native image or a short-lived process.
- **It is trivially constructible in a test** — one collaborator, taken by the
  constructor, with no context required to instantiate the class itself.

## Should it be an interface?

Usually no, and the reason is specific to this style: an interface exists so that
something else can supply the implementation. With Spring Data that something is the
framework. Here there is nothing to supply — you would be writing
`OrderQueries` **and** `JdbcOrderQueries`, and the interface would have exactly one
implementer for the rest of the project's life.

Three cases where the interface earns its place:

- **Two real implementations**, such as a primary one and a read-replica one whose
  SQL differs.
- **A port in a hexagonal or clean architecture**, where the domain module is not
  allowed to depend on Spring at all. Then the interface lives in the domain and the
  `JdbcClient` class lives in the adapter, and the interface is carrying an
  architectural rule rather than a technical one.
- **A published module boundary**, where callers must not compile against the
  concrete type.

"So it can be mocked" is not one of them. A repository is the one class worth testing
against a real database ([chunk 12f](12f-the-real-database.md)), and a mocked
repository asserts that your SQL returns whatever you told the mock it returns.

## Gotchas

**Removing `@Repository` because it "only does exception translation" removes the
bean.** [Chunk 6b](06b-the-translator-chain.md) is right that a `JdbcClient` class
gains no translation from the annotation — `JdbcTemplate` translates inside itself.
But `@Repository` is a `@Component` stereotype, so component scanning is what finds
the class. Delete it and you get a `NoSuchBeanDefinitionException` at startup, which
reads as unrelated to the change you just made.

**Putting `@Transactional` on the repository class gives you the proxy back.** The
"no proxy" property belongs to the *absence of an aspect*, not to `JdbcClient`.
Annotate the class and Spring creates a CGLIB subclass, and every rule about
self-invocation applies again —
**[The self-invocation trap](../04-spring-transactional/03-the-self-invocation-trap.md)**.
The transaction boundary belongs on the service anyway
([chunk 9](09-transactions-and-the-connection.md)).

**A `StatementSpec` is mutable, so it must never be a field.** `db.sql(...)` returns a
spec whose `param()` methods mutate it and return `this`. Building one in a
constructor and reusing it across calls shares parameter state between threads. Build
it inside the method, every time; the `JdbcClient` itself is the reusable part.

**Building SQL with `String.format` or `+` is an injection, including in the "safe"
cases.** A method that switches its `where` clause on a `boolean` is tempting to write
with concatenation. Write two methods with two constants instead — and if a fragment
genuinely must vary, it can only be chosen from an allow-list of literals in your own
code, never taken from an argument.

**An `order by` cannot be a bind parameter, and people discover this by trying.**
`order by :sort` binds a *string literal* in the sort position, which PostgreSQL
accepts and which sorts every row by the same constant — a query that returns rows in
arbitrary order and looks like it worked. A caller-chosen sort column must be mapped
through a `Map<String, String>` of permitted names to SQL fragments.

**A repository with no `@Transactional` anywhere still runs in transactions — one per
statement.** Without a caller-side boundary each `db.sql(...)` gets a connection,
runs, and returns it, so two reads in one service method are two transactions and two
snapshots ([chunk 9](09-transactions-and-the-connection.md)). That is often fine and
occasionally the source of an inconsistency nobody can reproduce.

**One constructor needs no `@Autowired`, and adding a second one silently breaks
that.** Spring's single-constructor rule is why the example above has no annotation.
Add a convenience constructor for a test and injection fails at startup with an
ambiguity error, at which point the fix is to annotate the real constructor rather
than to delete the new one and forget why.

**A "repository" that also decides things stops being testable as one.** The value of
this shape is that the class contains statements and nothing else. Once
`findById` starts applying a discount rule before returning, the only way to test the
rule is through a database, and the only way to test the SQL is through the rule.
Keep the mapping in the repository and the decisions in the service.

**Package placement matters more than it does with Spring Data.** A generated
repository is found by `@EnableJpaRepositories` wherever you point it; this one is
found by component scanning, which starts at the `@SpringBootApplication` class's
package. A repository in a sibling package that is not underneath it will not be
found, and the failure is again a missing-bean error at startup.

## Interview questions

**★ Why is a `JdbcClient` repository a class rather than an interface?**
Because there is nothing to implement it. An interface is a contract for a supplier —
with Spring Data the supplier is a startup-time proxy that reads the method names, so
the interface is the *only* thing you write. Here the class is the implementation, so
an interface would be a second file with exactly one implementer for the rest of the
project's life. It is worth adding in three cases: two genuinely different
implementations, a domain port in an architecture where the domain module may not
depend on Spring, or a published module boundary. "So we can mock it in service
tests" is not one of them — mocking a repository asserts that the SQL returns whatever
the mock was told, which is the one thing you actually wanted to check.

**★ Does `@Repository` do anything on a `JdbcClient` class?**
Two things, and only one of them is the famous one. It is a `@Component` stereotype,
so component scanning finds the class and creates the bean — remove it without
registering the bean another way and the application will not start. What it does
*not* add is exception translation: that mechanism is the
`PersistenceExceptionTranslationPostProcessor` advising `@Repository` beans, and it
exists for ORM code that throws provider-specific exceptions. `JdbcTemplate`
translates inside itself, before the exception ever leaves the call, so a
`JdbcClient` repository is already throwing `DataAccessException` subclasses whether
or not the annotation is present.

**★ How do you handle sorting and paging without `Pageable`?**
Paging is `limit` and `offset` as ordinary bound parameters, plus a second `count(*)`
query if the caller needs a total — and keyset pagination rather than `offset` once
the offsets get large, since `offset 10000` still makes the server walk ten thousand
rows before discarding them. Sorting is the awkward one, because an `order by` clause
is SQL text and cannot be bound: `order by :sort` binds a string constant and silently
produces an unordered result. So a caller-supplied sort has to go through a map from
permitted names to SQL fragments in your own code, and anything not in the map is
rejected. That allow-list is the injection defence as well as the correctness one.

**★ What do you lose by not having a repository proxy?**
The free methods — `findById`, `save`, `count`, `existsById`, `deleteById` — and
derived queries, `Pageable`/`Page`, and specification-style dynamic predicates. You
write those yourself, and for a table with a handful of queries that is ten minutes.
What you get back is that the class does exactly what it says: no interception, no
generated frame in a stack trace, no startup-time scanning, and a statement count you
can read off the method body. It is the same trade as the rest of this topic —
automation for legibility — and it is a bad trade for a rich write model and a good
one for a read model.

**★ Is a `JdbcClient` repository thread-safe?**
The `JdbcClient` is, so a repository holding one in a `final` field is too, and it
can be a singleton like any other bean. The thing that is not thread-safe is the
`StatementSpec` that `db.sql(...)` returns: its `param` methods mutate the spec and
return `this`, so it is a per-call builder. Keep it as a local, never as a field. The
same caution applies to any `RowCallbackHandler` you write, which is stateful by
design, whereas a `RowMapper` is stateless and safely shared as a constant
([chunk 3](03-rowmapper.md)).

**★ A search screen has eight optional filters. How do you write that without a
`Specification`?**
Two honest options. The first is one static query where every optional predicate is
written `and (:status is null or o.status = :status)`, which keeps the SQL a constant
and therefore keeps the statement cache happy — at the cost of a plan the planner has
to make work for every combination, and PostgreSQL will generally not use an index on
a column guarded that way. The second is to assemble the `where` clause from a fixed
set of literal fragments in your own code, appending only fragments the code owns and
binding every value — which gives each combination its own SQL text and its own plan,
at the cost of more distinct statements in the cache
([chunk 5b](05b-in-lists-and-the-statement-cache.md)). I would start with the first,
measure, and move the one or two hot screens to the second. What I would not do is
interpolate a value into the string, ever.

---

← Prev: [11b · The flush trap](11b-the-flush-ordering-trap.md) · Index: [05 · SQL-first access](README.md) · Next → [12b · Mappers and return types](12b-the-mapper-and-the-return-type.md)
