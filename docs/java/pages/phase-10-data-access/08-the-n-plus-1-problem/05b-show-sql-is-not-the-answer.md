---
title: "show-sql writes past your logging configuration to standard output, and that single fact disqualifies it from every job except looking at a test"
sidebar_label: "5b · Why show-sql is not it"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `org.hibernate.cfg.JdbcSettings` javadoc in the
> Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/cfg/JdbcSettings.java)),
> the Hibernate ORM 7.4 user guide §31.2 *Logging*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Spring Boot 4.1 reference *Logging* and *Actuator → Loggers*
> ([docs.spring.io/spring-boot/reference/](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Two properties print the same SQL. One of them goes through your logging
framework and one of them does not, and everything else follows from that. This
chunk is the list of consequences, because "use the logger instead" is advice
people ignore until they can name what it costs them.**

## What "to the console" costs you

Hibernate's own javadoc for `hibernate.show_sql` is *"Enables logging of
generated SQL to the console"*. Take that literally, because it is literal.

### No log level

The statements are not emitted at `DEBUG`, or at any level — they are printed.
So they cannot be raised, lowered, or filtered by level, and the pattern every
team relies on (`INFO` in production, `DEBUG` when investigating) does not apply.
The switch has exactly two positions and both of them require a restart.

### No appender

They do not go to your file appender, your rolling policy, your syslog appender
or your log shipper. They go to standard output. If your platform happens to
capture stdout — most container platforms do — they arrive in the log stream
*unstructured*, interleaved with properly formatted lines, breaking any parser
expecting one event per line.

### No format

Your logging pattern is not applied. There is no timestamp, no level, no thread
name, no logger name. If you emit JSON logs, these lines are not JSON, and a
strict ingester will either drop them or file them as parse failures.

### No MDC, so no correlation

This is the one that actually matters for diagnosis. Your logs carry a request
id, a trace id, and probably a tenant or user id, because that is how you connect
a symptom to a request. `show-sql` output carries none of it. **Under any
concurrency at all, the statements from different requests are interleaved on
stdout with nothing to tell them apart** — which makes counting the statements
for one request impossible, and counting is the entire point.

### No runtime control

A Boot application exposes its loggers through the Actuator, so
`org.hibernate.SQL` can be set to `DEBUG` on a running instance and back to
`INFO` a minute later, with no restart and no redeploy. `show-sql` is fixed at
startup. In a production incident that difference decides whether you can
investigate at all.

### It writes to stdout on a thread that is serving requests

`System.out` is synchronised. Printing hundreds of lines per request from many
threads puts contention on a single stream in the middle of your request path,
which is exactly the wrong place for it. Logging frameworks have asynchronous
appenders for this reason; `show-sql` has none.

## The one job it is right for

It is not useless. For a developer running a single test in an IDE and wanting to
see what happened, it is one property, needs no logging configuration, and puts
the output where they are already looking. That is a real use and it is why the
property exists.

**The rule: `show-sql` is for a human watching a terminal. Anything else — a
running service, a CI job, a shared environment, anything you will need to grep,
correlate or count — is `org.hibernate.SQL`.**

## What to configure instead

A profile-scoped configuration gives you the development convenience without the
production liability:

```yaml
# application.yaml — nothing SQL-related on by default
spring:
  jpa:
    show-sql: false
---
spring:
  config:
    activate:
      on-profile: local
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE
```

In production, leave `org.hibernate.SQL` at its default and raise it through the
Actuator when you need it:

```java
// what the Actuator's loggers endpoint does for you, in one call
loggingSystem.setLogLevel("org.hibernate.SQL", LogLevel.DEBUG);
```

Expose the endpoint deliberately and protect it — it can change the log level of
any logger in the application, which is powerful in both directions.

## But none of this finds the bug

Everything above is about making the log *usable*. It does not make the log the
right tool, and it is worth being blunt about that before spending an afternoon
on logging configuration.

A hundred identical statements in a log look like an application doing work. The
eye normalises repetition, especially when each line is correct. To find N+1 in a
log you must count lines that differ only in a bind parameter, group them by
request, and compare the total against what you expected — and you must do that
by hand, for one request, from a stream that also contains everybody else's
statements.

**That is a job for a counter, not for a reader.** [Chunk 6](06-count-do-not-read.md)
is the counter.

The log's real role is the step *after* the count: once a counter tells you an
endpoint issued 340 statements when it should have issued 3, the log tells you
*which* statements they were, and therefore which association was not fetched.
Count to detect, read to diagnose — in that order.

## Gotchas

**⚠️ Leaving `show-sql: true` in a committed `application.yaml`.**
It ships to production, where it prints every statement to stdout on every
request, with contention on a synchronised stream and no way to switch it off
without a restart. It is one of the most common performance regressions
introduced by a debugging session.

**⚠️ Believing that because your platform captures stdout, it is "in the logs".**
It is in the log *stream*, unformatted and uncorrelated. A JSON ingester will
treat each line as a parse failure or drop it. Being present is not the same as
being queryable.

**⚠️ Using `show-sql` output to count statements for a request.**
Under any concurrency the lines from different requests are interleaved with
nothing to distinguish them, because there is no MDC. The count you compute is
the count for every in-flight request combined.

**⚠️ Turning on `org.hibernate.SQL` at DEBUG globally in production and leaving
it.**
It is the right mechanism used wrongly. Every statement your service issues, all
day, is a large volume of logs, a real cost in your log pipeline, and enough I/O
to change the behaviour you are measuring. Raise it, look, lower it.

**⚠️ Exposing the Actuator loggers endpoint without authentication.**
It writes as well as reads. Anyone who can reach it can turn on `TRACE` for
`org.hibernate.orm.jdbc.bind` and start writing your customers' data into your
logs.

**⚠️ Concluding from a clean log that the endpoint is fine.**
You looked at a log from an environment with a small dataset, so N was small. The
log tells you the shape of what ran, not whether the count scales — that requires
data with realistic fan-out, which is the argument in
[chunk 6b](06b-asserting-the-count-in-a-test.md) for controlling the fixture.

## Interview questions

**★ Why should `show-sql` never be enabled in production?**
Because it is not a logging setting — Hibernate's javadoc describes
`hibernate.show_sql` as enabling logging of generated SQL *to the console*, and
it means that literally. The statements bypass your logging framework entirely,
so they have no level and cannot be filtered, no appender so they do not reach
your files or shipper in a structured form, no pattern so they carry no
timestamp, thread or logger name, and no MDC so they carry no request or trace
id. That last one is fatal for diagnosis: under concurrency the statements from
different requests are interleaved on stdout with nothing to separate them. On
top of that it writes to a synchronised stream from request-serving threads,
adding contention in the request path, and it can only be changed by restarting.
`org.hibernate.SQL` at DEBUG gives the same text with none of those problems and
can be toggled at runtime through the Actuator.

**★ You are on a production incident and want to see the SQL for one endpoint.
What do you do?**
Raise `org.hibernate.SQL` to DEBUG through the Actuator's loggers endpoint on one
instance, not across the fleet — that requires no restart and takes effect
immediately. Correlate by request id from the MDC to pull out the statements for
the requests you care about, since everything else is running concurrently. If
you need to know *which* row each statement was for, add
`org.hibernate.orm.jdbc.bind` at TRACE, but treat that as a deliberate, brief
exposure because bind parameters are customer data going into your log pipeline.
Then lower both again. The thing not to do is redeploy with `show-sql` enabled,
which is slower to get, gives worse output, and cannot be undone without another
restart.

**★ If you have the SQL log working perfectly, why is it still not the right tool
for finding N+1?**
Because the log is optimised for reading individual statements and the bug is a
property of their count. A hundred identical, correct, fast statements look like
a healthy application under load — the eye normalises repetition, and nothing in
the log flags "this is more than it should be", because the log has no idea what
you expected. To detect the bug from a log you have to group lines by request,
count the ones that differ only in a bind parameter, and compare against a number
you carry in your head. That is a counting job done by a human on a stream that
also contains everyone else's traffic. The right division of labour is to count
mechanically to *detect* and read the log to *diagnose* — the log tells you which
association was not fetched, once something else has told you to look.

**★ How would you configure logging so developers get the convenience without the
production risk?**
Keep everything SQL-related off in the default profile and enable it only in a
local or test profile — `org.hibernate.SQL` at DEBUG and, if wanted,
`org.hibernate.orm.jdbc.bind` at TRACE, both under a profile-activated document
in `application.yaml`. Never commit `show-sql: true` at the top level, since that
is the setting that ships. In production leave the categories at their defaults
and rely on the Actuator's loggers endpoint to raise them temporarily during an
investigation, with the endpoint properly authenticated — it can write log
levels, so anyone who can reach it can turn on bind-parameter logging and start
capturing customer data. That arrangement gives one-keystroke visibility where
you want it and no standing cost or exposure where you do not.

---

← Prev: [5 · Turning the SQL on](05-turning-the-sql-on.md) · Index: [08 · The N+1 problem](README.md) · Next → [6 · Count, do not read](06-count-do-not-read.md)
