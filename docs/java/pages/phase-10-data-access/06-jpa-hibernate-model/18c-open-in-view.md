---
title: "open-in-view is on by default and it changes the one thing this whole topic is about — how long the persistence context lives"
sidebar_label: "18c · open-in-view"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Data → SQL databases → JPA and
> Spring Data JPA*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)),
> Spring Boot's `JpaBaseConfiguration.JpaWebConfiguration` source
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java)),
> the `OpenEntityManagerInViewInterceptor` javadoc and the `HibernateJpaDialect` /
> `JpaTransactionManager` sources in Spring Framework 7.0.x
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/7.0.x/spring-orm/src/main/java/org/springframework/orm/jpa/vendor/HibernateJpaDialect.java)),
> and the Hibernate ORM 7.4 *User Guide* §8.3 *Connection handling modes* and Appendix A.3
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Hibernate ORM 7.4.1.

**Every page in this topic assumed the persistence context lives as long as the transaction.
In a default Spring Boot web application it does not: an `EntityManager` is bound to the
request before your controller runs and stays bound until the response is written. That is
`spring.jpa.open-in-view`, it defaults to `true`, and it changes dirty checking, flushing and
`readOnly = true` — which is why it belongs here and not in a chapter about fetching.**

:::note The other half of this argument
This chunk is about what open-in-view does to the *unit of work* — context lifetime,
dirty checking, flush and `readOnly`. What it does to *query counts* is a separate and
equally consequential story, and it belongs to the topic that owns them:
[Topic 08 · 15 · Open session in view](../08-the-n-plus-1-problem/15-open-in-view.md)
argues that it is not a fix for N+1 but the reason nobody sees one.
:::

## What Boot actually does

The reference documentation:

> If you are running a web application, Spring Boot by default registers
> `OpenEntityManagerInViewInterceptor` to apply the "Open EntityManager in View" pattern, to
> allow for lazy loading in web views. If you do not want this behavior, you should set
> `spring.jpa.open-in-view` to `false` in your `application.properties`.

In the source, the configuration is guarded by
`@ConditionalOnBooleanProperty(name = "spring.jpa.open-in-view", matchIfMissing = true)` —
`matchIfMissing = true` is the "on by default" part — and it logs, verbatim:

> `spring.jpa.open-in-view is enabled by default. Therefore, database queries may be
> performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable
> this warning`

That warning is unusual: Spring Boot rarely warns about its own defaults. The wording is also
precise about what it is warning you about — not lazy loading, but *when* the queries happen.

## The change it makes

Without it, the boundaries are nested and short:

```
request ──┬─ controller
          ├─ @Transactional service ── [ EntityManager opened … closed ]
          └─ view / serialization      ← entities are detached here
```

With it, one persistence context spans the whole request:

```
request ── [ EntityManager opened by the interceptor ────────────────────────── closed ]
          ├─ controller                        ← entities managed
          ├─ @Transactional service            ← reuses the bound EntityManager
          └─ view / serialization              ← still managed, lazy loads still work
```

Every consequence below follows from that one diagram.

## Four consequences, in this topic's terms

**1 · Lazy loading works after the transaction ends.** This is the feature. A `@OneToMany`
touched during JSON serialisation initialises instead of throwing
`LazyInitializationException`. It is also the reason the pattern is contentious — the
exception was telling you something true, and the queries it prevented now happen where you
cannot see them. What those queries cost is
[topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

**2 · The dirty-check walk covers the whole request.** The persistence context accumulates
everything loaded by every service call in the request, not just the current one. So the
flush at each transaction's commit walks all of it —
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md) — and a request that
calls three transactional methods pays a walk over a growing context three times.

**3 · Modifications made outside a transaction can be written by a later one.** An entity
mutated in the controller — after one transaction, before another — is still managed, still
snapshotted, and still dirty. The next transactional call on the same `EntityManager` flushes
at its commit and the change goes to the database. Nothing in the controller asked for a
write. This follows from the entities remaining managed across the request; I have not found
it stated in the Spring reference documentation, so treat it as a consequence of the binding
rather than a documented contract, and either way do not rely on it in either direction.

**4 · 🔴 `@Transactional(readOnly = true)` becomes weaker.** This is the one nobody expects.
`HibernateJpaDialect.beginTransaction` calls `session.setDefaultReadOnly(true)` — the switch
that actually skips the snapshot — only when the transaction definition's `isLocalResource()`
is true, and `JpaTransactionManager` supplies that flag from `isNewEntityManagerHolder()`:
true only when the transaction opened its own `EntityManager`.

With open-in-view, the interceptor already bound one. The transaction reuses it,
`isNewEntityManagerHolder()` is false, and `setDefaultReadOnly(true)` is never called. You
keep `FlushMode.MANUAL` — so writes are still suppressed — and lose the memory and CPU saving
of skipping the snapshot. This is read from the 7.0.x source, not from the reference
documentation. [14f · Turning it off](14f-turning-dirty-checking-off.md) has the rest.

## The connection question

Hibernate's documented default for `RESOURCE_LOCAL` transactions is
`DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION` — "the database connection is acquired
when needed and released after the current running transaction is either committed or rolled
back". So the connection is *not* held for the whole request simply because the
`EntityManager` is.

⚠️ What I could not confirm from the 7.4 documentation is when a connection acquired for a
lazy load **outside** any transaction is released — the documented rule is phrased entirely
in terms of a running transaction. The safe reading is that each such load needs a connection
from the pool, during view rendering, at a point where the pool is also serving new requests.
Do not repeat the common claim that open-in-view holds a connection for the entire request as
though it were documented; measure it against
[topic 02 · Connection pooling](../02-connection-pooling/README.md) if it matters to you.

## Turning it off

```yaml
spring:
  jpa:
    open-in-view: false
```

The warning disappears — and so does the setting's ambiguity, because `false` is an explicit
decision and the warning exists precisely to make you take one. Note that setting it to
`true` also silences the warning, since the message asks you to "explicitly configure" it
either way.

What breaks when you turn it off is any code that touches a lazy association after the
transaction: serialisation of entities, templates walking associations, `toString()` in a log
statement outside a service. Each of those has to be fixed rather than worked around, and the
fixes — fetch what you need, or return a DTO — are topic 08's and topic 07's.

⚠️ **Turn it off early or not at all.** In a codebase that has had it on for years the
dependencies are invisible until they throw, and they throw in view rendering, which is often
outside the transaction's rollback and after the response status has been decided.

## Gotchas

**★ It is on by default, and the warning is the only thing that tells you.** A team that
filters startup logs has no signal at all.

**★ The warning is emitted whether or not the pattern harms you.** It is a "make a decision"
warning, not a diagnosis. Setting the property to `true` explicitly is a valid response.

**★ It weakens `@Transactional(readOnly = true)` at the Hibernate level.** The read-only
session flag is conditional on the transaction having created the `EntityManager`, and with
open-in-view it did not.

**★ It makes the persistence context grow across the whole request.** Every entity loaded by
every service call stays managed and snapshotted, and every subsequent flush walks all of
them.

**★ Entities modified outside a transaction remain managed and dirty.** A later transaction on
the same `EntityManager` can write them. Neither behaviour — writing or not writing — is
something to design around.

**★ It converts `LazyInitializationException` into invisible queries.** The exception was a
design signal. Removing it does not remove the fetching problem, it removes the report.

**★ Queries during view rendering are outside your transaction's error handling.** A failure
there happens after the transaction committed and often after the response has begun, which
makes it hard to turn into a clean error page.

**★ Do not repeat "it holds a connection for the whole request" as fact.** The documented
release mode is per transaction; what happens outside one is not spelled out in the 7.4
documentation.

**★ Disabling it in a mature codebase surfaces every latent dependency at once.** The failures
are real bugs, but they arrive together and in the least convenient layer.

**★ It is a web-application setting.** The interceptor is registered for web applications;
a batch job or a message listener never had it, which is one reason the same service method
behaves differently in the two contexts.

## Interview questions

**★ What does `spring.jpa.open-in-view` do?**
It registers `OpenEntityManagerInViewInterceptor`, which binds an `EntityManager` to the
request before the controller runs and keeps it bound until the response is rendered. The
persistence context therefore outlives the transaction, and lazy associations can still be
initialised during view rendering.

**★ Is it on by default?**
Yes — the auto-configuration is conditional with `matchIfMissing = true`, and Boot logs a
warning saying so and asking you to configure the property explicitly.

**★ Why does it belong in a chapter about the persistence context rather than one about
fetching?**
Because what it changes is the *lifetime* of the persistence context. Lazy loading in the
view is a consequence. So are the larger dirty-check walk, entities staying managed outside
transactions, and the change to `readOnly = true`.

**★ How does it affect `@Transactional(readOnly = true)`?**
It stops the second half of it. Spring's Hibernate dialect only calls
`setDefaultReadOnly(true)` when the transaction opened the `EntityManager` itself; with
open-in-view one is already bound, so only the `MANUAL` flush mode is applied and the
snapshot is still taken.

**★ What is the cost of the longer-lived persistence context?**
More entities in it, so a larger dirty-check walk at every flush, more memory held for
snapshots, and a longer window in which what you hold can be stale relative to the database.

**★ Does it hold a database connection for the whole request?**
Not by the documented rule: Hibernate's default handling mode for resource-local
transactions releases the connection after the transaction ends. What happens for a lazy load
outside a transaction is not spelled out in the 7.4 documentation, so it is worth measuring
rather than asserting.

**★ What breaks when you turn it off?**
Anything that touches a lazy association after the transaction — entity serialisation,
templates, logging that walks an association. Those are real fetching bugs; the fix is to
fetch what the response needs, or to return DTOs.

**★ Why does the warning exist when Spring Boot rarely warns about defaults?**
Because the default has consequences the developer cannot see — queries during view
rendering — and the project wants the choice to be deliberate. The message asks you to
configure the property explicitly, in either direction.

---

← Prev: [18b · The statistics you read](18b-the-statistics-you-actually-read.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [19 · The checklist](19-the-checklist.md)
