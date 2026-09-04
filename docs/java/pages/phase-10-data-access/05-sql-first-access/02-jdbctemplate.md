---
title: "`JdbcTemplate` removes thirty lines of ceremony and none of the decisions — and knowing which is which is the whole skill"
sidebar_label: "2 · `JdbcTemplate`"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> JDBC Core Classes*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> the `JdbcTemplate` and `JdbcOperations` source and javadoc
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/JdbcTemplate.java)),
> and the Spring Boot 4.1 reference *Data → SQL Databases → Using `JdbcTemplate`*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18.

**`JdbcTemplate` is described by its own javadoc as "the central delegate in the
JDBC core package". Everything else in this topic — `NamedParameterJdbcTemplate`,
`JdbcClient`, `SimpleJdbcInsert` — is a wrapper around one. What it does is run the
JDBC workflow so that your code contains only the two parts that are decisions: the
SQL, and what a row becomes. What it does *not* do is anything about the database,
and every surprise in this topic comes from expecting otherwise.**

## The thing it deletes

Here is a single-row lookup written against raw JDBC, with the resource handling
done correctly — the shape argued for in
**[Resource handling](../01-jdbc/17-resource-handling.md)**:

```java
public Actor findById(long id) {
    String sql = "select id, first_name, last_name from actor where id = ?";
    try (Connection con = dataSource.getConnection();
         PreparedStatement ps = con.prepareStatement(sql)) {
        ps.setLong(1, id);
        try (ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new ActorNotFoundException(id);
            }
            return new Actor(rs.getLong("id"),
                             rs.getString("first_name"),
                             rs.getString("last_name"));
        }
    } catch (SQLException ex) {
        throw new IllegalStateException("could not load actor " + id, ex);
    }
}
```

Twenty lines. Now count how many of them are about *actors*: the SQL, the
`setLong`, and the three `rs.get…` calls. Six. The other fourteen are the same in
every method in the class, and getting one of them subtly wrong — a `ResultSet` not
closed on the exception path, a connection returned to the pool with an open
statement — produces a bug that shows up hours later somewhere else, which is the
argument of **[Ownership and leaks](../01-jdbc/18-ownership-and-leaks.md)**.

The `JdbcTemplate` version keeps the six and deletes the fourteen:

```java
public Actor findById(long id) {
    return jdbcTemplate.queryForObject(
            "select id, first_name, last_name from actor where id = ?",
            (rs, rowNum) -> new Actor(rs.getLong("id"),
                                      rs.getString("first_name"),
                                      rs.getString("last_name")),
            id);
}
```

The lambda is a `RowMapper` — [chunk 3](03-rowmapper.md) covers it properly. The
`id` at the end is bound as the first `?`. There is no `try`, no `close`, no
`catch`, and the method no longer declares or wraps `SQLException`, because
`JdbcTemplate` converts it (that is [chunk 6](06-the-exception-hierarchy.md), and it
is more important than it looks).

## What it takes over, precisely

The reference documentation lists it:

> "It handles the creation and release of resources, which helps you avoid common
> errors, such as forgetting to close the connection. It performs the basic tasks of
> the core JDBC workflow (such as statement creation and execution), leaving
> application code to provide SQL and extract results."

Concretely, four things:

| Taken over | Mechanism |
|---|---|
| Getting and returning the connection | `DataSourceUtils.getConnection(dataSource)` — transaction-aware, see [chunk 9](09-transactions-and-the-connection.md) |
| Creating, configuring and closing the statement | `PreparedStatementCreator` + `applyStatementSettings` |
| Iterating the `ResultSet` and closing it | the callback interfaces of [chunk 3](03-rowmapper.md) |
| Turning `SQLException` into an unchecked exception | `SQLExceptionTranslator`, [chunk 6](06-the-exception-hierarchy.md) |

And four things it explicitly does **not** take over, all of which stay yours:

- **The SQL.** Sent as written. Nothing parses it, rewrites it or validates it.
  (One exception, and it is `NamedParameterJdbcTemplate`, not this class —
  [chunk 5](05-named-parameters.md).)
- **The parameter values and their order.** A `?` in the wrong position is your bug.
- **The row-to-object mapping.** Somebody writes it; the only question is whether
  it is you, a `DataClassRowMapper`, or an ORM.
- **The transaction boundary.** `JdbcTemplate` *joins* a transaction; it never
  starts one. See **[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)**.

## Creating one, and where it lives

The documented pattern is one field, assigned in the constructor:

```java
public class JdbcCorporateEventDao implements CorporateEventDao {

    private final JdbcTemplate jdbcTemplate;

    public JdbcCorporateEventDao(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }
}
```

The javadoc is explicit about the concurrency story, and it is the good one:

> "An instance of this template class is thread-safe once configured."

and the reference adds the nuance that matters:

> "The `JdbcTemplate` is stateful, in that it maintains a reference to a
> `DataSource`, but this state is not conversational state."

Read that as: it holds configuration, not a conversation. There is no per-request
state on it, so one instance serves the whole application. **Do not create a
`JdbcTemplate` per call, per request, or per repository method.** It is not
expensive to construct, but doing so is a signal that somebody thinks it holds a
connection, and that misunderstanding leads to worse ones.

In Spring Boot you do not construct it at all. Boot auto-configures a
`JdbcTemplate`, a `NamedParameterJdbcTemplate` and — since the `NamedParameter`
one is present — a `JdbcClient`, all over the auto-configured `DataSource`. Inject
whichever you want:

```java
@Repository
public class JdbcActorRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcActorRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }
}
```

## The method families

`JdbcOperations` is a large interface, but it has only four families and each has
one job.

| Family | Returns | Use it for |
|---|---|---|
| `query(...)` | whatever the callback returns | any `SELECT` |
| `queryForObject` / `queryForList` / `queryForMap` / `queryForRowSet` | convenience shapes | the common `SELECT` results |
| `update(...)` | `int` — rows affected | `INSERT`, `UPDATE`, `DELETE` |
| `batchUpdate(...)` | `int[]` — rows affected per entry | many statements, one round trip |
| `execute(...)` | whatever the callback returns | DDL, and the escape hatch to raw JDBC |

The convenience shapes, with the documentation's own examples:

```java
int rowCount = jdbcTemplate.queryForObject(
        "select count(*) from t_actor", Integer.class);

String lastName = jdbcTemplate.queryForObject(
        "select last_name from t_actor where id = ?", String.class, 1212L);

List<Actor> actors = jdbcTemplate.query(
        "select first_name, last_name from t_actor", actorRowMapper);

int updated = jdbcTemplate.update(
        "update t_actor set last_name = ? where id = ?", "Banjo", 5276L);
```

🔴 **`queryForObject` throws when there are no rows.** It does not return `null`.
This is the single most common `JdbcTemplate` surprise, it has its own chunk —
[chunk 7](07-queryforobject-and-empty.md) — and you should read that chunk before
you write a `findById`.

`execute(ConnectionCallback)` is the trapdoor. It hands you the `Connection` and
you are back in raw JDBC, with Spring still handling acquisition, release and
exception translation:

```java
jdbcTemplate.execute((Connection con) -> {
    try (var copyIn = new CopyManager((BaseConnection) con)
            .copyIn("copy staging_rows from stdin with (format csv)")) {
        // …stream the CSV
    }
    return null;
});
```

That is how you reach PostgreSQL's `COPY` — the thing
**[COPY instead of batching](../01-jdbc/19h-copy-instead-of-batching.md)** argues
for — without giving up connection management.

## Gotchas

**`queryForObject` on zero rows throws `EmptyResultDataAccessException`.**
Everyone writes `findById` returning `null` on a miss, and everyone is surprised
once. Do not paper over it with a `try`/`catch` that returns `null` — that catch
also swallows the two-row case, which is a completely different bug. The whole
argument is in [chunk 7](07-queryforobject-and-empty.md).

**The `Object[]`-in-the-middle overloads are deprecated, and the varargs ones look
identical.** `queryForObject(String, Object[], Class)`, `query(String, Object[],
RowMapper)` and their siblings carry `@Deprecated(since = "5.3")`. The replacements
put the arguments **last**: `queryForObject(String, Class, Object...)`. Code copied
from an older codebase or an old answer compiles on 7.0 with a deprecation warning
and works — so nothing forces you to notice. Move to the varargs form; the argument
order genuinely differs and mixing the two in one class is how somebody eventually
passes a `Class` as a bind parameter.

**Passing a single `Object[]` to a varargs method spreads it.** This is Java, not
Spring, but it bites here more than anywhere:

```java
Object[] args = { 42L };
jdbcTemplate.queryForObject(sql, Long.class, args);   // one parameter, 42 — fine
Object[] args2 = { 42L, "x" };
jdbcTemplate.queryForObject(sql, Long.class, args2);  // TWO parameters — probably not what you meant
```

If you genuinely want to bind one array-typed parameter — a PostgreSQL `int[]` for
`= ANY(?)` — wrap it: `new Object[] { theArray }`, or use `JdbcClient`'s explicit
`param(...)` calls where the question cannot arise.

**`execute(ConnectionCallback)` gives you the connection, not permission to close
it.** The `Connection` handed to the callback is owned by the template — and, if a
transaction is in progress, by the transaction. Closing it, calling `commit()` on
it, or changing its autocommit flag corrupts the surrounding transaction.
Use it to *do* things, never to *manage* the connection.

## Interview questions

**★ What does `JdbcTemplate` actually do for you?**
Four things, and it is worth being able to list them because the answer "it makes
JDBC easier" is not one. It acquires and releases the connection, going through
`DataSourceUtils` so that it picks up a connection already bound to the thread by a
Spring transaction. It creates, configures and closes the `PreparedStatement`,
applying fetch size, max rows and query timeout. It runs the `ResultSet` loop and
closes the result set, calling back into your `RowMapper` per row. And it catches
`SQLException` and translates it into Spring's unchecked `DataAccessException`
hierarchy, which is what removes the checked exception from your method signatures.
What it does not do is anything about your SQL — it does not parse, rewrite,
validate or generate it.

**★ Is `JdbcTemplate` thread-safe? Should I create one per request?**
It is thread-safe once configured; the javadoc says so in those words. It holds a
`DataSource` reference and a handful of settings — the reference documentation
calls this state "not conversational state" — and it holds nothing per invocation.
So one instance per application is right, and in Boot you do not create one at all,
you inject the auto-configured bean. Creating one per request is not a performance
disaster, but it usually indicates the author thinks the template holds a
connection, and that belief leads to real bugs later, such as expecting two calls on
"the same" template to share a transaction.

**★ Where does `JdbcTemplate` get its `Connection` from, and why does that matter?**
From `DataSourceUtils.getConnection(dataSource)`, not from `dataSource
.getConnection()`. The difference is that `DataSourceUtils` is, in the javadoc's
words, "aware of a corresponding Connection bound to the current thread" — so
inside a `@Transactional` method it returns the transaction's connection rather
than a fresh one from the pool. That is the entire reason `JdbcTemplate` calls
participate in Spring transactions without any transaction code in the repository.
Bypassing it — calling `dataSource.getConnection()` yourself — gets you a second,
independent connection that the surrounding transaction will not commit or roll
back.

**★ What is `execute()` for, when there are already `query` and `update`?**
It is the escape hatch. The `query` and `update` families cover the shapes Spring
can express; `execute` hands you the raw JDBC object — a `Connection`, a
`Statement`, a `PreparedStatement` — inside the template's resource and exception
handling. You use it for anything the API does not model: DDL, driver-specific
extensions such as PostgreSQL's `CopyManager`, or a `PreparedStatement` you need to
configure in an unusual way. The rule inside the callback is that you may use the
object but not manage it: no `close()`, no `commit()`, no changing autocommit.

**★ Why are the `queryForObject(String, Object[], Class)` overloads deprecated?**
Because the `Object[]` sits between the SQL and the type, which forced two
incompatible argument orders across the API and made the type argument easy to
misplace. The replacements are varargs and put the parameters last:
`queryForObject(String, Class, Object...)`. They are deprecated as of 5.3 and are
still present in 7.0, so old code keeps compiling — which is precisely why you
should migrate deliberately rather than assume the compiler will find them all.

---

← Prev: [1b · The three APIs](01b-the-three-apis.md) · Index: [05 · SQL-first access](README.md) · Next → [2b · Wiring, settings, logging](02b-settings-and-logging.md)
