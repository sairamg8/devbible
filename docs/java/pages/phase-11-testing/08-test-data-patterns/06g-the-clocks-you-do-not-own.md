---
title: "Your Clock bean governs the timestamps your Java code writes and nothing else — the scheduler, Spring Data auditing, Hibernate and the database each read a different clock, and each has its own documented seam or none at all"
sidebar_label: "06g · The clocks you do not own"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Spring Data JPA reference *Auditing*
> ([docs.spring.io](https://docs.spring.io/spring-data/jpa/reference/auditing.html)), the
> Spring Data Commons javadoc for `DateTimeProvider`
> ([docs.spring.io](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/auditing/DateTimeProvider.html)),
> the Spring Framework 7.0.x reference *Task Execution and Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)),
> the Hibernate ORM 7.0 javadoc for `@CreationTimestamp`
> ([docs.hibernate.org](https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/annotations/CreationTimestamp.html)),
> and the PostgreSQL 18 manual *Date/Time Functions and Operators*
> ([postgresql.org](https://www.postgresql.org/docs/18/functions-datetime.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, AssertJ 3.27.7, Testcontainers 2.0.5.
> **No sandbox and no Docker** — Java source, SQL and documented behaviour only, never a run.

**Injecting a `Clock` fixes the timestamps your own code writes. It does not fix the ones
something else writes on your behalf, and in a Spring Data JPA application there are at least
four of those: the task scheduler's clock, Spring Data's auditing clock, Hibernate's
`@CreationTimestamp`, and the database's own `now()`. A test that fixes the `Clock` bean and
then asserts on `createdAt` is asserting on a value the fixed clock never touched. Two of these
have a documented seam, one has an annotation attribute, and one has nothing — and knowing which
is which is the difference between a deterministic test and a tolerance that grows every
quarter.**

## 1 · The scheduler's clock

Your `Clock` bean does **not** drive `@Scheduled`. Spring's scheduling infrastructure carries its
own: the reference shows `TaskScheduler` exposing `Clock getClock()`, and `TriggerContext`
exposing `Clock getClock()` alongside `lastScheduledExecution()`, `lastActualExecution()` and
`lastCompletion()`. A custom `Trigger` should compute its next execution from
`triggerContext.getClock()` rather than from `Instant.now()` — that is what makes a custom
trigger unit-testable at all.

⚠️ I could not find, in the Framework 7.0.x reference, documented guidance on supplying a custom
`Clock` to `ThreadPoolTaskScheduler` or `SimpleAsyncTaskScheduler` for test purposes, so no recipe
for that is claimed here. What *is* claimable, and matters more: **do not test business logic by
waiting for a scheduled method to fire.** Extract the body into a service that takes the clock,
unit-test that directly, and leave one thin scheduled method whose only untested content is the
cron expression.

```java
@Component
class NightlyExpiryJob {

    private final ExpiryService expiry;                    // takes the Clock; fully unit-tested

    @Scheduled(cron = "0 0 2 * * *", zone = "UTC")
    void run() { expiry.expireOverdue(); }                 // one line, nothing to assert
}
```

## 2 · Spring Data auditing — `DateTimeProvider` is the seam

`@CreatedDate` and `@LastModifiedDate` populate themselves, and the reference names the component
responsible in one sentence:

> *"The time giving instance is provided by a `org.springframework.data.auditing.DateTimeProvider`.
> By default this is a `CurrentDateTimeProvider`. This can be changed via the
> `dateTimeProviderRef` attribute when enabling auditing, or a dedicated `AuditingHandler` or
> `DateTimeProvider` bean being present in the `ApplicationContext`."*

The interface is one method — *"SPI to calculate the current time to be used when auditing"* —
with the signature `Optional<TemporalAccessor> getNow()`. So the seam exists, it is documented,
and wiring your `Clock` into it is five lines:

```java
@Component("auditingDateTimeProvider")
class ClockDateTimeProvider implements DateTimeProvider {

    private final Clock clock;

    ClockDateTimeProvider(Clock clock) { this.clock = clock; }

    @Override
    public Optional<TemporalAccessor> getNow() {
        return Optional.of(clock.instant());
    }
}
```

```java
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
class AuditingConfiguration { }
```

Now a test that fixes the `Clock` bean also fixes `createdDate`, and `assertThat(saved.createdDate()).isEqualTo(FIXED)`
is a legitimate assertion rather than a tolerance. This is the single highest-value item on this
page, because auditing timestamps are the ones most often asserted on.

⚠️ `getNow()` returns `Optional<TemporalAccessor>`, not `Instant`. Spring Data converts it to the
field's declared type, and the reference notes that the annotations *"can be used on properties of
type JDK8 date and time types, `long`, `Long`, and legacy Java `Date` and `Calendar`"*. Returning
an `Instant` from a `Clock` is the safe choice; returning a `LocalDateTime` reintroduces a zone
decision inside the provider.

## 3 · Hibernate's `@CreationTimestamp` — no seam, but an attribute

`@CreationTimestamp` is Hibernate's, not Spring's, and it does not consult a `Clock` bean:

> *"Specifies that the annotated field of property is a generated creation timestamp. The
> timestamp is generated just once, when an entity instance is inserted in the database."*

> *"A field annotated `@CreationTimestamp` may not be directly set by the application program."*

It has a `source` attribute, documented as:

> *"Specifies how the timestamp is generated. By default, it is generated in memory, which might
> save a round trip to the database, depending on the capabilities of the database and JDBC
> driver."*

The default is **`SourceType.VM`** — generated in the JVM — and the alternative is
`SourceType.DB`. The javadoc also records that the annotation is *"a synonym for
`@CurrentTimestamp(timing=INSERT,source=VM)`"*.

Neither value helps a test: `VM` reads the JVM's clock directly, `DB` reads the database's. **There
is no `Clock` to inject.** So the choice is between two options and both are real:

- **Prefer Spring Data's `@CreatedDate`/`@LastModifiedDate`** over Hibernate's annotations
  wherever you also use Spring Data, precisely because they have a `DateTimeProvider` and
  Hibernate's do not. This is the recommendation.
- **If you must keep `@CreationTimestamp`**, stop asserting equality on the value. Assert that it
  is within a window you captured, or assert only that it is non-null and let a different test —
  one about your own code — carry the timestamp assertion.

⚠️ Mixing them is worse than either: an entity with both `@CreatedDate` and `@CreationTimestamp`
on different fields has two timestamps from two clocks that can differ, and a fixed test clock
moves one and not the other.

## 4 · The database's clock, which is not even one clock

A `DEFAULT now()` column, a trigger, or an `INSERT … VALUES (now())` reads the engine's clock, and
your `Clock` bean is not involved at any point. On PostgreSQL there is a further subtlety that
catches people writing tests:

> *"Since these functions return the start time of the current transaction, their values do not
> change during the transaction. This is considered a feature: the intent is to allow a single
> transaction to have a consistent notion of the 'current' time, so that multiple modifications
> within the same transaction bear the same time stamp."*

> *"`clock_timestamp()` returns the actual current time, and therefore its value changes even
> within a single SQL statement."*

So `now()`, `CURRENT_TIMESTAMP` and `transaction_timestamp()` are all **transaction start time**.
Two rows inserted in one transaction get identical timestamps; a test that inserts two rows and
expects the second to be later fails, and it fails deterministically, which at least is honest.
`statement_timestamp()` is the statement's start; `clock_timestamp()` is the only one that moves
within a statement.

The consequence for test data: if the fixture is a `@Sql` script using `now()`, every row it
inserts shares one timestamp, and any test that relies on ordering those rows by that column is
ordering by a tie ([04 · Fixtures in the database](04-fixtures-in-the-database.md)). Write literal
timestamps in the fixture — `'2026-01-31T09:00:00Z'` — and the ordering becomes a property of the
data rather than of the transaction.

## Where this connects

- Declaring the bean these components ignore: [06e · The clock bean](06e-the-clock-bean.md).
- Overriding it for one test: [06f · Overriding the clock in a slice](06f-overriding-the-clock-in-a-slice.md).
- `Clock.tick` and the precision argument: [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Fixtures that insert timestamps: [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- Asserting on a timestamp none of these seams let you fix:
  [06h · Asserting on a timestamp you did not choose](06h-asserting-on-a-timestamp-you-did-not-choose.md).
- Temporal assertions in full: [02 · AssertJ · 08b · Dates and times](../02-assertj/08b-dates-and-times.md).
- Auditing as a persistence feature:
  [Phase 10 · Auditing and lifecycle](../../phase-10-data-access/09-spring-data-jpa/10-auditing-and-lifecycle.md).
- Why the engine has to be the real one for any of this to mean anything:
  [07 · Testcontainers](../07-testcontainers/README.md).

## Gotchas

**★ Fixing the `Clock` bean and then asserting on `createdDate`.**
Spring Data auditing does not read your `Clock`; it reads a `DateTimeProvider`, whose default is
`CurrentDateTimeProvider`. The test's fixed instant and the audited value are two different
clocks, so an equality assertion fails and gets replaced by a tolerance — when the real fix is a
five-line `DateTimeProvider` backed by the same `Clock`.

**★ Registering a `DateTimeProvider` bean but not pointing auditing at it.**
The reference gives two routes: the `dateTimeProviderRef` attribute, or *"a dedicated
`AuditingHandler` or `DateTimeProvider` bean being present in the `ApplicationContext`"*. Naming
the bean and referencing it explicitly is the version that cannot be silently defeated by another
candidate appearing later.

**★ Returning a `LocalDateTime` from `getNow()`.**
The signature is `Optional<TemporalAccessor>`, so it compiles. But converting the clock's instant
to a local date-time inside the provider reintroduces a zone decision in a place nobody will look
for it. Return `clock.instant()` and let the field's type drive the conversion.

**★ `@CreationTimestamp` has no `Clock` seam at all.**
Its `source` attribute chooses between the JVM (`SourceType.VM`, the default) and the database
(`SourceType.DB`) — two clocks, neither of them yours. If you use Spring Data, prefer
`@CreatedDate` with a `DateTimeProvider`; if you keep the Hibernate annotation, stop asserting
equality on the value.

**★ An entity carrying both `@CreatedDate` and `@CreationTimestamp`.**
Two fields, two clocks, two values that can disagree — and a fixed test clock moves exactly one
of them. Whichever mechanism you choose, choose one per project and enforce it in review.

**★ Trying to assign a `@CreationTimestamp` field in a test builder.**
The javadoc forbids it: *"A field annotated `@CreationTimestamp` may not be directly set by the
application program."* A builder that sets it is either ignored or fights Hibernate, and either
way the test data does not say what it appears to say.

**★ `now()` in a `@Sql` fixture gives every row the same timestamp.**
PostgreSQL's `now()` is transaction start time — *"their values do not change during the
transaction"* — so a script inserting ten rows inserts ten identical timestamps. Any test that
orders by that column is ordering by a tie, and the order it gets is whatever the plan produced.
Write literal timestamps in fixtures.

**★ Reaching for `clock_timestamp()` to fix that, in production code.**
It does move within a statement, so it breaks the tie — and it also throws away the guarantee that
all modifications in one transaction share a consistent notion of "now", which the manual calls a
feature. Use it knowingly, in a fixture, not as a reflex in application SQL.

## Interview questions

**★ You fixed the `Clock` bean but `createdDate` still moves. What happened?**
Spring Data auditing does not use your `Clock`. It obtains the time from a `DateTimeProvider`,
which the reference describes as the "SPI to calculate the current time to be used when auditing",
and whose default implementation is `CurrentDateTimeProvider` reading the system clock. The fix is
to implement `DateTimeProvider` with `getNow()` returning `Optional.of(clock.instant())`, register
it as a bean, and point `@EnableJpaAuditing(dateTimeProviderRef = "…")` at it. After that the
audited timestamp and the test's fixed instant are the same value, and you can assert equality
instead of a tolerance.

**★ How do you make Hibernate's `@CreationTimestamp` deterministic in a test?**
You largely cannot, and that is the honest answer. It has a `source` attribute that chooses
between the JVM (`SourceType.VM`, the default) and the database (`SourceType.DB`), but no clock to
inject; the javadoc also forbids the application from setting the field directly. So either move
to Spring Data's `@CreatedDate`, which does have the `DateTimeProvider` seam, or accept that the
value is not assertable by equality and assert a captured window instead. What you must not do is
have both annotations in one entity, because then a fixed clock moves one timestamp and not the
other.

**★ A test inserts two rows through a `@Sql` fixture using `now()` and then asserts on their order. Why is it flaky?**
Because on PostgreSQL `now()` is the transaction's start time, not the current time — the manual
states that these functions "return the start time of the current transaction, their values do not
change during the transaction", and calls it a feature so that all modifications in one transaction
share a consistent timestamp. Both rows therefore carry the same value, the `ORDER BY` has a tie,
and the returned order is whatever the plan produced, which can change with statistics or with an
index. Write literal, distinct timestamps in the fixture, or order by something that is genuinely
ordered.

**★ How should a `@Scheduled` job be tested?**
Not through the scheduler. Reduce the annotated method to a single delegating call and put the
behaviour in a service that takes the `Clock`; the logic is then an ordinary unit test with a fixed
clock, and the only untested thing left is the cron expression, which is configuration. If a custom
`Trigger` is involved, it should compute the next execution from `TriggerContext.getClock()` rather
than `Instant.now()` — the reference exposes `getClock()` on both `TaskScheduler` and
`TriggerContext` so that a trigger can be driven by something other than the wall clock. Your
application's `Clock` bean does not change when the scheduler fires, so any test that waits for a
scheduled method is a test about a thread pool.

{/* FOOTER */}
