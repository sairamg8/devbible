---
title: "Three statement settings default to \"whatever the driver does\", and the one that logs your SQL does not log your parameters"
sidebar_label: "2b · Wiring, settings, logging"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> JDBC Core Classes*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> the `JdbcTemplate` and `JdbcOperations` source and javadoc
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/JdbcTemplate.java)),
> and the Spring Boot 4.1 reference *Data → SQL Databases → Using `JdbcTemplate`*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**`JdbcTemplate` pushes three settings onto every statement it creates — fetch size,
max rows and query timeout — and all three default to `-1`, meaning "do not tell the
driver anything". Two of those defaults are fine and one of them is the reason your
streaming query loaded the whole table into the heap. The fourth thing worth
configuring is logging, which is split across two categories at two different levels,
and almost everybody only finds the first.**

## Statement settings, and where they come from

Three properties on the template are pushed onto every `Statement` it creates.
Their javadoc gives the same default for all three:

| Property | Default | Meaning of the default |
|---|---|---|
| `fetchSize` | `-1` | "use the JDBC driver's default configuration" |
| `maxRows` | `-1` | same — do not pass a setting to the driver |
| `queryTimeout` | `-1` | same |

`fetchSize` is the one worth understanding, because the driver default is the
problem it fixes: pgJDBC materialises the whole result set before you see row one
unless you both set a fetch size and are inside a transaction. That is
**[Fetch size and streaming](../01-jdbc/15-fetch-size-and-streaming.md)**, and
nothing about `JdbcTemplate` changes it — it only gives you a tidier place to set
the value.

In Boot, all three are properties, and they apply to `JdbcClient` too because it is
built on the same templates:

```properties
spring.jdbc.template.fetch-size=500
spring.jdbc.template.max-rows=10000
spring.jdbc.template.query-timeout=5s
```

`queryTimeout` interacts with transactions: `DataSourceUtils.applyTimeout` applies
the template's timeout *"overridden by the current transaction timeout, if any"*.
So a `@Transactional(timeout = 2)` wins over `spring.jdbc.template.query-timeout`,
which is the behaviour argued in
**[Transaction timeouts](../04-spring-transactional/17-timeouts.md)**.

## Logging

Every statement the template runs is logged, and the category is worth knowing:

> "All SQL issued by this class is logged at the `DEBUG` level under the category
> corresponding to the fully qualified class name of the template instance
> (typically `JdbcTemplate`, but it may be different if you use a custom subclass
> of the `JdbcTemplate` class)."

So:

```properties
logging.level.org.springframework.jdbc.core.JdbcTemplate=DEBUG
```

⚠️ **That logs the SQL, not the bound parameter values.** Parameters are logged
separately by `StatementCreatorUtils` at `TRACE`. If you have ever turned on JDBC
logging, seen `?` where you wanted a value, and concluded the framework was hiding
something — that is the reason, and the fix is the `TRACE` level on that other
class, not a different template.

## Gotchas

**A `JdbcTemplate` per repository is fine; a `JdbcTemplate` per method call is a
misunderstanding.** It costs almost nothing to construct, so the harm is not
performance — it is that the code now reads as though the template holds something
per-invocation. It does not. Inject the auto-configured one.

**Two `DataSource`s mean two templates, and nothing warns you.** If your
application has a second data source, `new JdbcTemplate(dataSource)` picks up
whichever bean got injected. With `@Primary` on one of them, an unqualified
injection silently uses it — including in a repository intended for the other
database. Qualify both explicitly the moment a second `DataSource` appears, for
the same reason
**[which transaction manager you have](../04-spring-transactional/06c-what-boot-picked-for-you.md)**
matters at that point.

**`maxRows` set globally silently truncates.** `spring.jdbc.template.max-rows=500`
is often added as a safety net. It is not an error when a query exceeds it; the
result is simply shorter. A report that quietly stops at 500 rows and a report that
is correct look identical in the response body. If you want a limit, put `limit` in
the SQL where the reader can see it.

## Interview questions

**★ How do you see the SQL a `JdbcTemplate` is running?**
Set `org.springframework.jdbc.core.JdbcTemplate` to `DEBUG` — the documentation
specifies that all SQL is logged at `DEBUG` under the fully qualified class name of
the template instance. That gives you the statement text with `?` placeholders. The
bound values are logged separately, at `TRACE`, by `StatementCreatorUtils`. People
regularly conclude the parameters are unavailable because they only raised the
first category.

**★ If `maxRows` is set, how do you know a query hit the limit?**
You do not, and that is the objection to using it as a safety net. `maxRows` is
passed to the JDBC `Statement`; exceeding it is not an error, the result is just
truncated. A truncated report and a complete report are indistinguishable from the
data. If a limit is part of the requirement, write it as `limit` in the SQL where a
reader — and a code reviewer — can see it. Keep `maxRows` for what it is good at:
a blunt guard against an accidental unbounded query exhausting the heap.

<!--FOOTER-->

---

← Prev: [2 · `JdbcTemplate`](02-jdbctemplate.md) · Index: [SQL-first access](README.md) · Next → [3 · `RowMapper` and friends](03-rowmapper.md)
