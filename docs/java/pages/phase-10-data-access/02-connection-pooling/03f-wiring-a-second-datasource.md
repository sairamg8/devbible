---
title: "A second DataSource in Boot 4.1 is declared with defaultCandidate = false, and every tutorial that says @Primary is out of date"
sidebar_label: "3f · Wiring a second DataSource"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 how-to *Data Access → Configure
> Two DataSources*
> ([docs.spring.io/spring-boot/how-to/data-access.html](https://docs.spring.io/spring-boot/how-to/data-access.html)),
> the Spring Boot reference *SQL Databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)),
> the Spring Framework 7.0 reference on autowiring candidates
> ([docs.spring.io/spring-framework/reference/7.0/core/beans/dependencies/factory-autowire.html](https://docs.spring.io/spring-framework/reference/7.0/core/beans/dependencies/factory-autowire.html)),
> and the pgjdbc connection-parameter reference
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, HikariCP 7.0.2, pgjdbc 42.7.13.

**[Chunk 3e](03e-two-pools-not-one-bigger.md) argued for two pools. This chunk is
the mechanics, and it is worth its own page for one reason: the recipe changed,
the change is invisible until runtime, and the failure it produces —
auto-configuration quietly backing off — looks nothing like its cause.**

## The bean declaration

🔴 **The second `DataSource` bean is declared with
`@Bean(defaultCandidate = false)`.** Boot's how-to states why:

> *A key difference is that the `DataSource` `@Bean` must be declared with
> `defaultCandidate=false`. This prevents the auto-configured `DataSource` from
> backing off.*

Boot's auto-configuration is conditional on there being no `DataSource` bean the
container would inject by default. A second one declared the ordinary way
satisfies that condition, so the *first* pool — the one your whole application
uses — silently stops being created. `defaultCandidate = false` marks the bean as
injectable only through an explicit `@Qualifier`, so auto-configuration still
sees "no default candidate" and still runs.

```java
@Configuration(proxyBeanMethods = false)
public class ReportsDataSourceConfiguration {

    @Qualifier("reports")
    @Bean(defaultCandidate = false)
    @ConfigurationProperties("app.datasource")
    public DataSourceProperties reportsDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Qualifier("reports")
    @Bean(defaultCandidate = false)
    @ConfigurationProperties("app.datasource.configuration")
    public HikariDataSource reportsDataSource(
            @Qualifier("reports") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder()
                         .type(HikariDataSource.class)
                         .build();
    }
}
```

Boot's how-to describes this two-bean form as configuring *"the additional data
source with the same logic as Spring Boot would use in auto-configuration"* — the
`DataSourceProperties` bean handles url, username, password and driver detection,
and `initializeDataSourceBuilder()` hands off to the pool implementation.

Inject it with the same qualifier, on the parameter:

```java
@Service
class ReportService {
    private final JdbcClient reports;

    ReportService(@Qualifier("reports") DataSource reportsDataSource) {
        this.reports = JdbcClient.create(reportsDataSource);
    }
}
```

## The two property namespaces

```yaml
spring:
  datasource:                          # auto-configured pool
    url: "jdbc:postgresql://db.internal:5432/shop"
    username: "shop_app"
    password: "${DB_PASSWORD}"
    configuration:                     # ← HikariCP-specific settings
      pool-name: shop-oltp
      maximum-pool-size: 6
      connection-timeout: 2000

app:
  datasource:                          # the additional pool
    url: "jdbc:postgresql://db.internal:5432/shop"
    username: "shop_reports"
    password: "${REPORTS_PASSWORD}"
    configuration:                     # ← same shape, your namespace
      pool-name: shop-reports
      maximum-pool-size: 3
      connection-timeout: 30000
```

⚠️ **`configuration` is the sub-namespace for implementation-specific
properties.** Boot's how-to says *"More advanced, implementation-specific,
configuration of the auto-configured DataSource is available through the
`spring.datasource.configuration.*` properties"* and that the same concept applies
to the additional one. If you have only ever seen `spring.datasource.hikari.*`,
that is the older single-pool form; under this recipe the additional pool has no
`hikari` namespace at all, because the pool type is chosen by `.type(...)` in
Java rather than inferred.

⛔ **A misspelled property under `app.datasource.configuration` is silently
ignored** — it binds to a `HikariDataSource` setter or it does nothing. There is
no error for `maximum-poolsize`. It is worth logging the effective
`maximumPoolSize` at startup, or reading it off the pool's metrics
([chunk 8c](08c-watching-the-pool.md)), rather than trusting the file.

## Transactions do not follow the qualifier

This is the second thing that goes wrong, and it is quieter than the first.

`@Transactional` with no argument uses the container's default
`PlatformTransactionManager`, which is bound to the **auto-configured**
`DataSource`. A method annotated `@Transactional` that then does work on the
reports pool gets:

- an empty transaction opened and committed on the primary connection, and
- the reports work running in **autocommit**, outside any transaction at all.

Rollback does nothing, because there is nothing to roll back. The fix is a second
manager, named:

```java
@Qualifier("reports")
@Bean(defaultCandidate = false)
PlatformTransactionManager reportsTransactionManager(
        @Qualifier("reports") DataSource reportsDataSource) {
    return new DataSourceTransactionManager(reportsDataSource);
}
```

```java
@Transactional("reportsTransactionManager")
public void rebuildDailySummary(LocalDate day) { ... }
```

🔴 **A transaction cannot span the two pools.** They are two independent
connections to the same server, with two independent snapshots, and neither knows
about the other. Making them atomic requires JTA and two-phase commit
([chunk 3b](03b-reducing-cm.md) mentions the cost). If two writes must be atomic,
they belong on one pool.

⚠️ **Give each pool a distinct `pool-name` and a distinct `ApplicationName`**, so
that the metrics and `pg_stat_activity` can tell them apart. Two pools that look
identical from the outside are two pools you cannot budget —
[chunk 8c](08c-watching-the-pool.md) covers both.

## The trade-off

Everything on this page is configuration you now own that Boot used to own for
you: property binding, the pool type, the transaction manager, and the qualifier
on every injection point. Auto-configuration's value was that these were correct
by default, and the moment there are two of something, none of them are. That is
the real cost of splitting a pool — not the extra connections, which are cheap,
but the four separate places a second pool can be wired wrongly and still start.

## Gotchas

**⚠️ Declaring the second bean without `defaultCandidate = false`**
**Symptom:** the *primary* `DataSource` vanishes; Flyway, JPA and every
`JdbcTemplate` fail to find one, or find the wrong one.
**Cause:** the presence of an injectable `DataSource` bean makes Boot's
auto-configuration back off.
**Fix:** `@Bean(defaultCandidate = false)` on the additional bean, plus
`@Qualifier` on both the bean and every injection point. This replaces the older
`@Primary`-on-the-first-one pattern.

**⚠️ Following a pre-Boot-3.5 tutorial**
**Symptom:** a `@Primary` on a `DataSource` bean that is not the one you want to
be primary, and a context that starts but talks to the wrong database.
**Cause:** the recipe changed; the search results did not.
**Fix:** check the how-to for the Boot version you are on. The presence of
`defaultCandidate` is the marker that a sample is current.

**⚠️ Unqualified `@Transactional` around work on the second pool**
**Symptom:** the work is not transactional; a thrown exception leaves partial
rows committed.
**Cause:** the default transaction manager is bound to the auto-configured
`DataSource`, so the reports connection is borrowed outside the transaction and
runs in autocommit.
**Fix:** a second `PlatformTransactionManager`, referenced by name in the
annotation.

**⚠️ Expecting a transaction to span both pools**
**Symptom:** one side commits and the other rolls back.
**Cause:** two connections, two transactions, no coordinator.
**Fix:** put atomic work on one pool, or accept JTA.

**⚠️ Setting `spring.datasource.hikari.*` for the additional pool**
**Symptom:** the property has no effect and there is no warning.
**Cause:** the additional pool binds to *your* namespace —
`app.datasource.configuration.*` in the how-to's example.
**Fix:** put implementation-specific properties under the `configuration`
sub-namespace of whichever prefix that pool uses.

**⚠️ A typo in a pool property**
**Symptom:** the pool runs with defaults and nobody notices for months.
**Cause:** relaxed binding matches setters; an unmatched key is ignored.
**Fix:** verify against the running pool's own metrics or MBean rather than the
file. `hikaricp.connections.max` is the value that is actually in force.

**⚠️ Both pools sharing a `pool-name`**
**Symptom:** the dashboard shows a `connections.active` series that matches
neither pool.
**Cause:** metrics are tagged by pool name, and two pools with one name merge.
**Fix:** distinct, readable `pool-name` values — they are also what appears in
HikariCP's own log lines and in the timeout exception message.

## Interview questions

**★ What is the modern Spring Boot recipe for a second DataSource, and what changed?**
Declare the additional `DataSource` bean with `@Bean(defaultCandidate = false)`
and a `@Qualifier`, bind it with `@ConfigurationProperties` to its own namespace,
and inject it using the same qualifier. What changed is that this replaces the
`@Primary`-on-the-first-one pattern. Boot's how-to says the
`defaultCandidate=false` declaration is what *"prevents the auto-configured
DataSource from backing off"* — that is, it keeps the bean out of default
autowiring so Boot's conditional auto-configuration still fires. Almost every
tutorial written before that shows the `@Primary` form, which now silently
removes the auto-configured pool.

**★ Why does adding a second DataSource break the first one?**
Because Boot's `DataSourceAutoConfiguration` is conditional on the absence of a
`DataSource` bean that the container would inject by default. Adding one is
exactly the signal that says "the application is configuring its own", so Boot
stands down — and then Flyway, JPA, `JdbcTemplate` and everything else that
expected an auto-configured pool either fails or picks up the wrong one. Marking
the new bean as a non-default candidate keeps the condition false, because the
bean can only be reached through an explicit qualifier.

**★ What happens if you put `@Transactional` on a method that uses the second pool?**
Nothing useful, and nothing visible. The unqualified annotation resolves to the
default transaction manager, which is bound to the auto-configured `DataSource`,
so Spring opens and commits an empty transaction on the *primary* connection
while the second pool's connection is borrowed independently and runs in
autocommit. Every statement commits as it executes and a rollback has nothing to
undo. The fix is a second `PlatformTransactionManager` over the second
`DataSource`, named explicitly in the annotation.

**★ Can one transaction span both pools?**
Not without JTA. Two `DataSource` beans mean two physical connections with two
independent transactions and two independent snapshots, even when they point at
the same server — the database has no idea they are related. Making them atomic
needs a JTA transaction manager and two-phase commit, with the transaction log
and recovery story that implies. In practice the answer is to keep work that must
be atomic on one pool, and to treat the split as a boundary in the design rather
than an implementation detail.

**★ How do you confirm the pool is running with the settings you think it is?**
Read them from the pool, not from the file. Relaxed binding means a misspelled
property is simply ignored, with no warning, so `application.yaml` is evidence of
intent rather than of state. `hikaricp.connections.max` and
`hikaricp.connections.min` in the metrics, or the `PoolConfig` MBean when
`registerMbeans` is on, report what is actually in force. From the database side,
grouping `pg_stat_activity` by `application_name` shows the real connection
counts per pool, which is the same check from the other end.

---

← Prev: [3e · Two pools, not one bigger](03e-two-pools-not-one-bigger.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [4 · The six clocks](04-the-six-clocks.md)
