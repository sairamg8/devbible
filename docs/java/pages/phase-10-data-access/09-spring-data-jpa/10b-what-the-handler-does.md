---
title: "Auditing is a JPA PrePersist and PreUpdate callback, so its four configuration switches are small and its blind spots are exactly the blind spots of a lifecycle callback — which means every bulk statement you write leaves the audit columns lying"
sidebar_label: "10b · What the handler does"
sidebar_position: 45
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data 4.1 reference — "Auditing"
> ([reference/auditing.html](https://docs.spring.io/spring-data/jpa/reference/auditing.html));
> the 4.1 source of `EnableJpaAuditing` and `AuditingEntityListener`
> ([spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/domain/support/AuditingEntityListener.java))
> and `AuditingHandlerSupport`
> ([spring-data-commons](https://github.com/spring-projects/spring-data-commons/blob/main/src/main/java/org/springframework/data/auditing/AuditingHandlerSupport.java));
> and Jakarta Persistence 3.2 §4.11 on bulk operations
> ([jakarta.ee](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[10](10-auditing-and-lifecycle.md) wired it up. This chunk is what actually runs — forty
lines of source that explain the four configuration switches, the behaviour when there is
no current user, and the four situations where your audit columns quietly stop being true.**

## It is two lifecycle callbacks and nothing else

```java
@Configurable
public class AuditingEntityListener {

    private @Nullable ObjectFactory<AuditingHandler> handler;

    @PrePersist
    public void touchForCreate(Object target) {
        // … handler.getObject().markCreated(target)
    }

    @PreUpdate
    public void touchForUpdate(Object target) {
        // … handler.getObject().markModified(target)
    }
}
```

That is the entire listener. `@PrePersist` and `@PreUpdate` are ordinary Jakarta
Persistence callbacks, which fixes the feature's boundaries before you write a line of
configuration: **auditing happens exactly when, and only when, Hibernate is about to issue
an `INSERT` or an `UPDATE` for a managed entity.**

## What `markCreated` and `markModified` do

Both delegate to one private method with a boolean:

```java
private <T> T touch(Auditor<?> auditor, T target, boolean isNew) {
    // touchAuditor(auditor, wrapper, isNew);
    // Optional<TemporalAccessor> now = dateTimeForNow ? touchDate(wrapper, isNew) : Optional.empty();
}

private void touchAuditor(Auditor<?> auditor, AuditableBeanWrapper<?> wrapper, boolean isNew) {

    if (!auditor.isPresent()) {
        return;                                        // ← nothing is set at all
    }

    if (isNew) {
        wrapper.setCreatedBy(auditor.getValue());
    }
    if (!isNew || modifyOnCreation) {
        wrapper.setLastModifiedBy(auditor.getValue());
    }
}

private Optional<TemporalAccessor> touchDate(AuditableBeanWrapper<?> wrapper, boolean isNew) {

    Optional<TemporalAccessor> now = dateTimeProvider.getNow();

    now.filter(__ -> isNew).ifPresent(wrapper::setCreatedDate);
    now.filter(__ -> !isNew || modifyOnCreation).ifPresent(wrapper::setLastModifiedDate);

    return now;
}
```

Four behaviours are settled by those lines.

**1 · `createdBy`/`createdDate` are set only when `isNew`.** They are never overwritten by
an update, which is the point.

**2 · `modifyOnCreate` decides whether a new row also gets modification metadata.** With the
default `true`, an insert sets all four columns, so `lastModifiedDate` is never null. Set it
`false` and a row that has never been updated has a null `lastModifiedDate` — which is
arguably more honest and is certainly more annoying to query. Pick one and make the column
nullability match.

**3 · `setDates = false` disables the timestamps entirely**, not just their source. The
`dateTimeForNow` flag short-circuits `touchDate`, and the reference's own comment on the
setter explains why you would: *"One might set this to `false` to use database features to
set entity time."*

**4 · 🔴 An absent auditor sets nothing — silently.** `if (!auditor.isPresent()) return;`
There is no exception, no fallback to "system", no log at warning level. An `AuditorAware`
returning `Optional.empty()` on a scheduler thread produces rows with null `created_by` and
a perfectly good `created_date`, and the mismatch between the two columns is the only clue.

If you want a fallback, put it in your `AuditorAware`:

```java
@Override
public Optional<String> getCurrentAuditor() {
    return Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName)
            .or(() -> Optional.of("system"));       // ← the decision is yours to make
}
```

Note also that the dates come from `dateTimeProvider.getNow()`, which returns an
`Optional<TemporalAccessor>` — a provider returning empty sets no dates either, by the same
silent path.

## The four `@EnableJpaAuditing` attributes

| Attribute | Default | What it does |
|---|---|---|
| `auditorAwareRef` | `""` | Bean name of the `AuditorAware` to use — needed only when several are registered |
| `setDates` | `true` | *"Configures whether the creation and modification dates are set."* |
| `modifyOnCreate` | `true` | *"Configures whether the entity shall be marked as modified on creation."* |
| `dateTimeProviderRef` | `""` | *"Configures a `DateTimeProvider` bean name that allows customizing the `TemporalAccessor` to be used for setting creation and modification dates."* |

> *"The time giving instance is provided by a
> `org.springframework.data.auditing.DateTimeProvider`. By default this is a
> `CurrentDateTimeProvider`. This can be changed via the `dateTimeProviderRef` attribute
> when enabling auditing, or a dedicated `AuditingHandler` or `DateTimeProvider` bean being
> present in the `ApplicationContext`."*

🔴 **`dateTimeProviderRef` is what makes auditing testable.** A fixed-clock `DateTimeProvider`
bean in the test context turns "the timestamp is roughly now" into an exact assertion. It is
a two-line bean, and it is the difference between a flaky test and a real one.

## Where auditing does not fire

This is the section to remember, and every entry follows from `@PrePersist`/`@PreUpdate`.

**Bulk `@Modifying` statements.** A `@Query("update User u set u.active = false …")` with
`@Modifying` is a database statement; no entity is loaded and no callback runs
([04](04-modifying-queries.md)). `last_modified_date` is left at whatever it was, and the
audit trail now says the row has not changed since last year.

**`UpdateSpecification` and `DeleteSpecification`.** Same reason — Criteria API bulk
operations, mapping directly to database statements
([07d](07d-what-the-base-repository-does.md)).

**`deleteAllInBatch` and `deleteAllByIdInBatch`.** The `JpaRepository` javadoc says it
outright: these *"will also NOT honor cascade semantics of JPA, nor will it emit JPA
lifecycle events"*. Relevant if you audit deletions through a soft-delete flag.

**Native queries, `JdbcTemplate`, Flyway, psql.** Anything that bypasses the persistence
context bypasses the callback, by construction.

**An update that Hibernate decides not to issue.** `@PreUpdate` fires when an `UPDATE`
statement is about to be executed. If dirty checking finds no change
([06 · 14c · what counts as a change](../06-jpa-hibernate-model/14c-what-counts-as-a-change.md)),
there is no statement and no callback — so `save()`-ing an unchanged entity does *not* bump
`lastModifiedDate`. That is correct behaviour and it regularly reads as a bug.

**A read-only transaction.** No flush, no `UPDATE`, no callback — and no change either
([09b](09b-what-readonly-actually-does.md)).

⚠️ **What `@PreUpdate` does for a changed *collection* is not something I could settle from
the specification for every case.** Whether modifying only the contents of a collection
counts as an update to the owning entity is provider-dependent territory; if your audit
columns must move when a child is added, assert it against your provider rather than
assuming.

The general rule is one sentence: **auditing is only as complete as your writes are
entity-based.** A codebase that mixes entity writes with bulk statements has audit columns
that are true for some rows and stale for others, and nothing distinguishes them.

## Gotchas

**★ An absent auditor sets nothing and says nothing.** `Optional.empty()` from
`AuditorAware` means `createdBy` and `lastModifiedBy` are simply not touched. Decide on a
fallback inside your `AuditorAware` if null is not acceptable.

**★ A `DateTimeProvider` returning empty also sets nothing.** Same silent path as the absent
auditor.

**★ Bulk statements do not audit.** `@Modifying` queries, `UpdateSpecification`,
`DeleteSpecification`, `deleteAllInBatch` and anything native leave the audit columns
untouched. That is the single largest source of misleading audit data.

**★ A `save()` with no actual change does not bump `lastModifiedDate`.** No dirty state
means no `UPDATE` and therefore no `@PreUpdate`.

**★ `modifyOnCreate = true` means a fresh row already has modification metadata.** If your
reports treat a non-null `lastModifiedDate` as "has been edited", they are wrong by default.

**★ `setDates = false` turns the timestamps off entirely.** It does not switch to a database
clock by itself — you have to supply the column default or trigger.

**★ `@PreUpdate` runs at flush, not at `save()`.** The value recorded is the time of the
flush, and the auditor is whoever the `AuditorAware` names *at that moment* — which in a long
transaction is not necessarily who it was when the change was made.

**★ The listener is `@Configurable`.** It is instantiated by the persistence provider, not by
Spring, and gets its `AuditingHandler` injected through Spring Data's own wiring. That is why
`spring-aspects` is on the requirement list.

**★ Auditing a collection change is provider territory.** Do not assume adding a child bumps
the parent's `lastModifiedDate`; verify it if it matters.

**★ Making the audit columns `NOT NULL` converts every silent failure into a loud one.** It
is the cheapest possible guard against the whole class of problems on this page.

## Interview questions

**★ What mechanism implements Spring Data auditing?**
A JPA entity listener, `AuditingEntityListener`, with a `@PrePersist` method calling
`markCreated` and a `@PreUpdate` method calling `markModified` on an `AuditingHandler`.
Everything else follows from that.

**★ What happens if `AuditorAware` returns `Optional.empty()`?**
Nothing is set. The handler returns early when the auditor is absent, so `createdBy` and
`lastModifiedBy` stay null with no exception and no warning. Any fallback has to be in your
own implementation.

**★ Does a bulk `@Modifying` update refresh `lastModifiedDate`?**
No. Bulk statements go straight to the database without loading entities, so no lifecycle
callback fires. The same is true of `UpdateSpecification`, `deleteAllInBatch` and native
queries.

**★ You call `save()` on an entity you did not change. Does `lastModifiedDate` move?**
No. `@PreUpdate` fires only when Hibernate is about to issue an `UPDATE`, and dirty checking
found nothing to update.

**★ What is `modifyOnCreate` for?**
It decides whether an insert also populates the modification metadata. Left at the default
`true`, a brand-new row has a `lastModifiedDate` equal to its `createdDate`; set to `false`,
that column stays null until the first real update.

**★ How do you make auditing testable?**
Register a `DateTimeProvider` returning a fixed instant and point
`@EnableJpaAuditing(dateTimeProviderRef = …)` at it, so timestamps become exactly assertable.

**★ What does `setDates = false` mean?**
The infrastructure stops populating the creation and modification dates entirely, leaving
them to a database column default or trigger. It is the switch for making the database the
single source of time.

**★ How would you make sure audit data cannot silently go missing?**
Declare the audit columns `NOT NULL`, so any path that skips the listener fails loudly, and
keep writes entity-based on audited tables — or accept and document that a given bulk job
does not audit.

{/* FOOTER */}
