---
title: "There are three ways to see the SQL Hibernate emits, they are not interchangeable, and the one everybody uses is the one that writes to System.out"
sidebar_label: "5 · Turning the SQL on"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §31.2 *Logging*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.cfg.JdbcSettings` javadoc in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/cfg/JdbcSettings.java)),
> and Spring Boot 4.1's `JpaProperties` and `HibernateJpaVendorAdapter`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaProperties.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1.

**[Chunk 2](02-why-nobody-sees-it.md) argued that the emitted SQL is the only
place N+1 is visible. This chunk is how to make it visible — and the first thing
to establish is that `spring.jpa.show-sql=true`, which is what everyone reaches
for, is not a logging setting at all.**

## The three switches, and what each one actually is

### `spring.jpa.show-sql` — a `System.out` print

Boot's property maps straight onto Hibernate's, with no logging framework in
between. `JpaProperties` holds a `boolean showSql`, and Spring's
`HibernateJpaVendorAdapter` translates it:

```java
if (isShowSql()) {
    jpaProperties.put(AvailableSettings.SHOW_SQL, "true");
}
```

`AvailableSettings.SHOW_SQL` is `hibernate.show_sql`, and its javadoc in the
Hibernate 7.4 source states what it does in one line:

> *"Enables logging of generated SQL **to the console**."* — `@settingDefault false`

**To the console.** Not to a logger. That single word is the whole objection, and
[chunk 5b](05b-show-sql-is-not-the-answer.md) is the consequences.

Its two companions are the same kind of setting:

| Property | Documented effect | Default |
|---|---|---|
| `hibernate.show_sql` | "Enables logging of generated SQL to the console" | `false` |
| `hibernate.format_sql` | "Enables formatting of SQL logged to the console" | `false` |
| `hibernate.highlight_sql` | "Enables highlighting of SQL logged to the console using ANSI escape codes" | `false` |

ANSI escape codes are a strong hint about the intended audience: a developer
watching a terminal.

### `org.hibernate.SQL` at `DEBUG` — the real logger

This is the same SQL, emitted through the logging framework, and it is what the
Hibernate user guide names when it tells you to log statements:

```properties
### log just the SQL
log4j.logger.org.hibernate.SQL = debug
```

In a Spring Boot application, in `application.yaml`:

```yaml
logging:
  level:
    org.hibernate.SQL: DEBUG
```

Because it is a logger, everything that is true of your other logs is true of
this one: it goes wherever your appenders send it, it can be structured as JSON,
it carries the MDC — so a request id, a trace id and a tenant travel with each
statement — and it can be turned on for one class, one package, or at runtime
through the Actuator's loggers endpoint without a redeploy.

**That last property is what makes it usable in production**, and it is the
single practical reason to prefer it.

### `org.hibernate.orm.jdbc.bind` at `TRACE` — the parameters

`org.hibernate.SQL` logs the statement with `?` placeholders, because that is
what Hibernate prepared. The values bound into those placeholders are logged by a
different category:

```properties
### log JDBC bind parameters and extracted values
log4j.logger.org.hibernate.orm.jdbc.bind = trace
log4j.logger.org.hibernate.orm.jdbc.extract = trace
```

```yaml
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE      # values going in
    org.hibernate.orm.jdbc.extract: TRACE   # values coming out
```

⚠️ **`org.hibernate.type` is the old name and is what most of the internet still
tells you to set.** The 7.4 user guide's own snippet shows it commented out above
the current categories. If you set `org.hibernate.type` on Hibernate 6 or 7 and
see nothing, that is why.

### Which one for which job

| You want to… | Use |
|---|---|
| glance at what a test just did | `show-sql` |
| investigate anything in a running service | `org.hibernate.SQL` at `DEBUG` |
| know *which* order the extra query was for | add `org.hibernate.orm.jdbc.bind` at `TRACE` |
| know how many statements ran | none of these — see [chunk 6](06-count-do-not-read.md) |

That last row is the important one, and it is why this chapter has six chunks
rather than one.

## The other two switches worth knowing

Two settings sit next to these in `JdbcSettings` and are directly useful here.

**`hibernate.log_slow_query`** takes a duration in milliseconds and logs any
statement that exceeds it. Its javadoc: *"Specifies a duration in milliseconds
defining the minimum query execution time that characterizes a 'slow' query. Any
SQL query which takes longer than this amount of time to execute will be logged.
A value of 0, the default, disables logging of 'slow' queries."*

**It will not find your N+1**, for the reason [chunk 2](02-why-nobody-sees-it.md)
gave — every one of the N statements is fast. It is listed here precisely so you
know not to reach for it, and because knowing that this switch cannot see the bug
is a good way to remember why the database's own slow-query log cannot either.

**`hibernate.session_factory.statement_inspector`** is more interesting. Its
javadoc says it *"Specifies a `StatementInspector` implementation associated with
the `SessionFactory`"*, supplied as an instance, a `Class`, or a class name. A
`StatementInspector` is called with every SQL string before it is executed, which
makes it a place you can *count* rather than merely print — the hook that
[chunk 6c](06d-proxies-and-agents.md) compares against the JDBC-proxy approach.

## What you will and will not learn from the log

Turning the log on gives you real information, and it is worth being precise
about its limits before [chunk 6](06-count-do-not-read.md) argues for something
better.

**You will see** each statement's text, and therefore the shape: a hundred
identical `select … from order_line where order_id = ?` lines is the signature of
a collection N+1, and a hundred `select … from customer where id = ?` is the
to-one version.

**You will not see** the count without counting by hand, you will not see which
Java line triggered each statement, and you will not see it at all in a test that
asserts on values rather than on behaviour. Those three gaps are what the rest of
this chapter fills.

⛔ There is no PostgreSQL and no running application on the machine this page was
written on, so this page shows you the switches and describes what they produce —
it does not print a log. Turn them on against your own service and read the real
thing.

## Gotchas

**⚠️ Setting `org.hibernate.type` to see bind parameters.**
That was the Hibernate 5 category. On 6 and 7 the parameters come from
`org.hibernate.orm.jdbc.bind` and the extracted values from
`org.hibernate.orm.jdbc.extract`. The old setting produces silence, which reads
like "no parameters were bound" rather than "wrong category".

**⚠️ Setting `show-sql` and a `DEBUG` logger at the same time.**
You get every statement twice, once on stdout and once through the logger, and if
your container captures stdout into the same log stream they interleave. Pick one.

**⚠️ Turning bind-parameter logging on in production and leaving it there.**
Bind parameters are your data. Personal details, tokens and payment references
all go through them, so `TRACE` on those categories writes them to wherever your
logs are shipped and retained. Enable it deliberately, for as long as you need,
and turn it back off.

**⚠️ Reading `format_sql` output as what the database received.**
It is pretty-printing applied on the way to the console. Harmless, but do not
paste the formatted version into a bug report as "the query that ran" — the
statement is the single-line one.

**⚠️ Expecting `log_slow_query` to catch this bug.**
It catches individually slow statements, and every statement here is fast. Same
blind spot as the database's slow query log, for the same reason: the problem is
the count, not any statement.

**⚠️ Assuming the log shows every statement your request issued.**
It shows every statement *Hibernate* issued. Anything going through a
`JdbcClient`, a second datasource, a Flyway migration or a native driver call is
invisible to `org.hibernate.SQL`. If the counts do not add up, that is usually
why — and it is an argument for counting at the JDBC layer instead
([chunk 6c](06d-proxies-and-agents.md)).

**⚠️ Enabling `DEBUG` on `org.hibernate` rather than `org.hibernate.SQL`.**
The parent category is enormously chatty and will bury the statements you wanted
in bootstrap and cache logging. Name the exact category.

## Interview questions

**★ What is the difference between `spring.jpa.show-sql` and setting
`org.hibernate.SQL` to `DEBUG`?**
They print the same statements by completely different routes.
`spring.jpa.show-sql` is a boolean on Boot's `JpaProperties` that
`HibernateJpaVendorAdapter` translates into Hibernate's `hibernate.show_sql`,
whose javadoc describes it as enabling logging of generated SQL *to the console*
— it writes to standard output with no logging framework involved.
`org.hibernate.SQL` at DEBUG emits the same text through SLF4J, so it goes where
your appenders send it, can be formatted as JSON, carries the MDC — request id,
trace id, tenant — and can be switched on and off at runtime through the
Actuator's loggers endpoint. For a five-second look at a test, `show-sql` is
fine. For anything you intend to correlate, filter, ship or enable in a running
service, it is the wrong mechanism.

**★ You have the SQL logged but every statement shows `?` instead of values. How
do you see the values?**
Set `org.hibernate.orm.jdbc.bind` to TRACE, which logs the parameters bound into
each prepared statement; `org.hibernate.orm.jdbc.extract` at TRACE does the same
for values read back out of result sets. Both are named in the Hibernate user
guide's logging section. The trap is that most material on the internet still
tells you to set `org.hibernate.type`, which was the Hibernate 5 category and
produces nothing on 6 or 7 — and produces nothing *silently*, so it reads like an
absence of parameters rather than a wrong setting. The other thing worth saying
is that bind parameters are real data, so turning this on in production writes
customer values into your log pipeline; it is a deliberate, temporary switch, not
a default.

**★ Would Hibernate's slow-query logging help you find an N+1?**
No, and understanding why is a good test of whether you have the model right.
`hibernate.log_slow_query` takes a threshold in milliseconds and logs statements
that exceed it — the default of 0 disables it. Every statement in an N+1 is a
primary-key or indexed-foreign-key lookup returning a handful of rows, which is
among the fastest things the database will do, so none of them will ever cross a
sensible threshold. It is the same blind spot the database's own slow query log
has: the database is not slow, it is being asked a fast question N times. The
diagnostic that works has to be about the *count* of statements, not the duration
of any one of them.

**★ What is a `StatementInspector` and why might you want one here?**
It is a Hibernate SPI, configured through
`hibernate.session_factory.statement_inspector` as an instance, a class or a
class name, that is handed every SQL string before it is executed and may inspect
or alter it. That makes it a hook where you can do something the log cannot:
count. A trivial inspector that increments a counter per statement gives you the
number that actually defines N+1, in-process, with no external tooling — and
because it sits inside Hibernate it sees exactly the statements Hibernate issues.
Its limitation is the mirror of that: it does not see anything issued outside
Hibernate, so a service that also uses `JdbcClient` needs counting one layer
lower, at the datasource.

**★ Why is `show-sql` still so widely used if it is the weaker option?**
Because it is one property and it works immediately, and for its actual purpose —
a developer glancing at a terminal while running a test — it is genuinely
adequate. The problem is that it is reached for reflexively in situations it was
never meant for, and the failure is quiet: it does not error in production, it
just writes to stdout, bypassing every log level, filter, format and correlation
id you have configured, and cannot be turned off without a restart. The honest
framing is that it is a development convenience that people mistake for a logging
configuration, and the cost of the mistake only shows up when you need the output
to be more than something to look at.

---

← Prev: [4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md) · Index: [The N+1 problem](README.md) · Next → [5b · Why show-sql is not it](05b-show-sql-is-not-the-answer.md)
