---
title: "Four annotations, one SPI and one enabling annotation give you created-by and modified-at columns that maintain themselves — provided the entity listener is actually registered, which is the step the documentation states and every tutorial omits"
sidebar_label: "10 · Auditing"
sidebar_position: 44
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data 4.1 reference — "Auditing"
> ([reference/auditing.html](https://docs.spring.io/spring-data/jpa/reference/auditing.html));
> the 4.1 source of `EnableJpaAuditing` and `AuditingEntityListener`
> ([spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/config/EnableJpaAuditing.java));
> and the `spring-boot-starter-data-jpa` 4.1.0 POM on Maven Central.
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.
> ⚠️ `…/reference/jpa/auditing.html` returns 404 — the live path has no `jpa/` segment.

**`created_at`, `created_by`, `updated_at`, `updated_by` are four columns nearly every
table ends up with, and four fields every service ends up setting by hand and occasionally
forgetting. Spring Data maintains them for you through a JPA entity listener — which means
the mechanism, and its limits, are exactly the mechanism and limits of a JPA lifecycle
callback.**

## The four annotations

> *"We provide `@CreatedBy` and `@LastModifiedBy` to capture the user who created or
> modified the entity as well as `@CreatedDate` and `@LastModifiedDate` to capture when the
> change happened."*

```java
@Entity
@EntityListeners(AuditingEntityListener.class)
class Customer {

  @CreatedBy      private User    createdBy;
  @CreatedDate    private Instant createdDate;
  @LastModifiedBy private User    lastModifiedBy;
  @LastModifiedDate private Instant lastModifiedDate;

  // … further properties omitted
}
```

> *"As you can see, the annotations can be applied selectively, depending on which
> information you want to capture."*

All four are optional and independent. A table that only wants timestamps needs no
`AuditorAware` at all:

> *"Applications that only track creation and modification dates are not required to make
> their entities implement `AuditorAware`."*

### The types allowed for the dates

> *"The annotations, indicating to capture when changes are made, can be used on properties
> of type JDK8 date and time types, `long`, `Long`, and legacy Java `Date` and `Calendar`."*

So `Instant`, `LocalDateTime`, `OffsetDateTime` and friends work, and so does a raw
`long` epoch value. ⚠️ Note what is *not* on that list: `String`. A timestamp field typed as
`String` is silently never populated, because the auditing infrastructure has no conversion
for it.

`Instant` is the type to reach for on PostgreSQL: it maps to `timestamp with time zone` and
has no ambiguity about which clock produced it.

### Auditing metadata in an embeddable

> *"Auditing metadata does not necessarily need to live in the root level entity but can be
> added to an embedded one (depending on the actual store in use)"*

```java
class Customer {
  private AuditMetadata auditingMetadata;
}

class AuditMetadata {
  @CreatedBy   private User    user;
  @CreatedDate private Instant createdDate;
}
```

This is the pattern worth adopting: one `@Embeddable` holding all four fields, reused across
every audited entity, so the columns and their types are declared once.

## Who the current user is: `AuditorAware`

> *"In case you use either `@CreatedBy` or `@LastModifiedBy`, the auditing infrastructure
> somehow needs to become aware of the current principal. To do so, we provide an
> `AuditorAware<T>` SPI interface that you have to implement to tell the infrastructure who
> the current user or system interacting with the application is. The generic type `T`
> defines what type the properties annotated with `@CreatedBy` or `@LastModifiedBy` have to
> be."*

```java
class SpringSecurityAuditorAware implements AuditorAware<User> {

  @Override
  public Optional<User> getCurrentAuditor() {

    return Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getPrincipal)
            .map(User.class::cast);
  }
}
```

The generic parameter is a contract in both directions: `AuditorAware<User>` requires
`@CreatedBy` to be typed `User`, and a mismatch is a runtime failure rather than a compile
error, because the two declarations are in different files with nothing linking them.

Returning `Optional.empty()` is legal and means "no current auditor" — a scheduled job, a
migration, a message consumer. What happens then is not "an exception"; it is
[10b](10b-what-the-handler-does.md)'s subject, and the answer surprises people.

There is a reactive counterpart, `ReactiveAuditorAware<T>`, returning a `Mono<T>` and
reading `ReactiveSecurityContextHolder`.

An interface-based alternative exists and the reference argues against it itself:

> *"There is also a convenience base class, `AbstractAuditable`, which you can extend to
> avoid the need to manually implement the interface methods. Doing so increases the
> coupling of your domain classes to Spring Data, which might be something you want to
> avoid. Usually, the annotation-based way of defining auditing metadata is preferred as it
> is less invasive and more flexible."*

## The three wiring steps

This is where auditing quietly does nothing if you skip a step.

**1 · Register the entity listener.** The reference gives the global form first:

> *"First, you must register the `AuditingEntityListener` to be used for all entities in
> your persistence contexts inside your `orm.xml` file"*

```xml
<persistence-unit-metadata>
  <persistence-unit-defaults>
    <entity-listeners>
      <entity-listener class="….data.jpa.domain.support.AuditingEntityListener" />
    </entity-listeners>
  </persistence-unit-defaults>
</persistence-unit-metadata>
```

and the per-entity form second:

> *"You can also enable the `AuditingEntityListener` on a per-entity basis by using the
> `@EntityListeners` annotation"*

```java
@Entity
@EntityListeners(AuditingEntityListener.class)
public class MyEntity { }
```

🔴 **This is the step that gets missed.** Without it the annotations are inert: the entity
saves cleanly, the audit columns are null, and nothing anywhere reports a problem. If
auditing "does not work", check this first — before the enabling annotation, before the
`AuditorAware` bean.

Prefer `@EntityListeners` on a shared `@MappedSuperclass` or on the audited `@Embeddable`'s
owner: it keeps the registration next to the annotations it activates, and it means an
entity that does not want auditing does not get the listener.

**2 · `spring-aspects` on the classpath.**

> *"The auditing feature requires `spring-aspects.jar` to be on the classpath."*

In a Spring Boot 4.1 application this is already satisfied:
`spring-boot-starter-data-jpa` depends on `spring-boot-data-jpa`, which declares
`org.springframework:spring-aspects` at compile scope. It matters if you assemble the
dependencies by hand or aggressively exclude transitives.

**3 · Enable it.**

```java
@Configuration
@EnableJpaAuditing
class Config {

  @Bean
  public AuditorAware<AuditableUser> auditorProvider() {
    return new AuditorAwareImpl();
  }
}
```

> *"If you expose a bean of type `AuditorAware` to the `ApplicationContext`, the auditing
> infrastructure automatically picks it up and uses it to determine the current user to be
> set on domain types. If you have multiple implementations registered in the
> `ApplicationContext`, you can select the one to be used by explicitly setting the
> `auditorAwareRef` attribute of `@EnableJpaAuditing`."*

⚠️ `@EnableJpaAuditing` is **not** applied by Spring Boot auto-configuration. It is one
annotation on one configuration class, and forgetting it is the second most common reason
audit columns stay null.

The four attributes of `@EnableJpaAuditing` — `auditorAwareRef`, `setDates`,
`modifyOnCreate` and `dateTimeProviderRef` — what the handler does with them, and everywhere
auditing does not fire at all, are [10b](10b-what-the-handler-does.md).

## Gotchas

**★ The listener has to be registered or nothing happens.** `@EntityListeners(AuditingEntityListener.class)`
on the entity, or the `orm.xml` persistence-unit default. Without it the annotations are
decoration and the save succeeds with null audit columns.

**★ `@EnableJpaAuditing` is not auto-configured.** Spring Boot does not add it. One missing
annotation on one configuration class and the whole feature is off.

**★ Both failures are silent.** No exception, no warning, no log line. The only symptom is
null columns, which a `nullable = false` on the audit columns turns into a loud failure —
worth doing deliberately.

**★ `String` is not a supported date type.** JDK 8 date/time types, `long`, `Long`, and
legacy `Date`/`Calendar`. A `String` timestamp field is never populated.

**★ The `AuditorAware<T>` generic must match the `@CreatedBy` field type.** Nothing checks
it at compile time; the two declarations live in different files.

**★ A `User` entity as the `@CreatedBy` type creates an association.** It is a real
`@ManyToOne` with a foreign key, a fetch cost and a cascade question. Storing the user *id*
or login as a `String` or `UUID` is usually the better model, and `AuditorAware<String>`
supports it directly.

**★ `AuditorAware` runs inside the flush, on whatever thread is flushing.** A
`SecurityContextHolder` lookup works on a request thread and returns nothing on a scheduler
thread, an `@Async` thread or a message-listener thread unless the context was propagated.

**★ `AbstractAuditable` couples your domain model to Spring Data.** The reference says so
and recommends the annotations instead.

**★ Auditing metadata in an embeddable is supported but store-dependent.** The reference
qualifies it with *"depending on the actual store in use"*. It works for JPA; do not assume
it transfers to another Spring Data module unchanged.

**★ Put `@EntityListeners` on a `@MappedSuperclass` and every subclass inherits it.** That is
the tidy way to audit twenty entities without twenty annotations — and it also means an entity
that should *not* be audited must not extend that superclass.

**★ Without `spring-aspects` on the classpath the feature does not work.** Boot's starter
brings it transitively; a hand-assembled classpath or an aggressive exclusion does not.

## Interview questions

**★ What do you need to wire up for auditing to work?**
Three things: the `AuditingEntityListener` registered on the entity (or as a persistence-unit
default in `orm.xml`), `spring-aspects` on the classpath, and `@EnableJpaAuditing` on a
configuration class. Plus an `AuditorAware` bean if you use `@CreatedBy` or
`@LastModifiedBy`.

**★ Audit columns are null and nothing threw. Where do you look?**
At the entity listener registration first — that is the step most often missed and it fails
silently — then at whether `@EnableJpaAuditing` is present at all.

**★ Which types can `@CreatedDate` be?**
JDK 8 date and time types, `long`, `Long`, and legacy `Date` and `Calendar`. Not `String`.

**★ How does the infrastructure know who the current user is?**
Through an `AuditorAware<T>` bean returning `Optional<T>`. The generic type must be the type
of the `@CreatedBy` and `@LastModifiedBy` fields. With several such beans registered, name
one through `auditorAwareRef`.

**★ Would you make `@CreatedBy` a `User` entity?**
Usually not. It creates a real association with a foreign key and a fetch cost on every load.
A login or an id as `String` or `UUID`, with `AuditorAware<String>`, records the same fact
without dragging a second aggregate into the row.

**★ `orm.xml` persistence-unit default or `@EntityListeners` per entity — which?**
`@EntityListeners`, usually on a shared `@MappedSuperclass` or the audited base class. It keeps
the registration next to the annotations it activates and lets an entity opt out. The `orm.xml`
form applies the listener to every entity in the persistence unit, which is fine when that is
genuinely what you want.

**★ Can the audit fields live somewhere other than the entity root?**
Yes — the reference documents putting them in an embedded type, qualified with *"depending on
the actual store in use"*. One `@Embeddable` holding all four fields, reused everywhere, is the
pattern worth adopting.

**★ What is `ReactiveAuditorAware` for?**
The same SPI for reactive infrastructure: it returns a `Mono<T>` and typically reads
`ReactiveSecurityContextHolder` rather than the thread-bound `SecurityContextHolder`.

**★ Why does the reference recommend the annotations over `AbstractAuditable`?**
Because extending `AbstractAuditable` increases the coupling of your domain classes to Spring
Data. The annotation-based approach is described as less invasive and more flexible.

**★ Why does auditing fail on a scheduled job?**
Because `AuditorAware` typically reads the `SecurityContextHolder`, which is thread-bound and
empty on a scheduler thread. The auditor is then absent, and what happens next is a
behaviour worth knowing exactly — see [10b](10b-what-the-handler-does.md).

{/* FOOTER */}
