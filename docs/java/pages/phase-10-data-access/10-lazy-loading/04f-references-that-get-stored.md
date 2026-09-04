---
title: "The quieter half of the lifetime problem stores the reference instead of moving it — an HTTP session, a cache entry, an event payload, a message and a static field each keep an entity alive long after the unit of work that gave it meaning"
sidebar_label: "04f · References that get stored"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.springframework.transaction.support.TransactionSynchronization`
> javadoc for `afterCommit()` and `afterCompletion(int)`
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html)),
> the Hibernate ORM 7.4 *Introduction* §5.1 on persistence-context lifetime and the hard
> references a context holds to its entities
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Spring Framework 7.0 reference on `@TransactionalEventListener` phases
> ([docs.spring.io/spring-framework/reference/data-access/transaction/event.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**A future or a stream at least looks like it is going somewhere. This half of the family does
not move the reference at all — it puts it down and walks away. An entity in an HTTP session,
in a `@Cacheable` result, in a domain event, on a Kafka message, or in a field of a singleton
bean has exactly the same defect and none of the visual cues: the code that stores it and the
code that later reads it are in different files, written by different people, months apart.
One of these cases is worse than failing, because it usually succeeds.** Continues
**[04e · References that outlive](04e-references-that-outlive-the-method.md)**.

## 1 · The HTTP session, and any conversational state

```java
session.setAttribute("draftOrder", order);   // detached the moment the request ends
```

This is the longest-lived version of the bug. The object survives the request, may be
serialised into a session store, may be replicated to another node, and produces the exception
minutes or hours later inside an unrelated request. If the store serialises it, the thing being
serialised is a Hibernate-instrumented class holding `PersistentSet` and proxy instances —
which is a second, independent problem.

**Keep the identifier. Reload or re-project on the next request.** A wizard or multi-step form
holds a DTO, never an entity.

## 2 · Caches

A `@Cacheable` service method that returns an entity puts that entity into the cache. What
happens next depends on the cache:

- **An in-memory cache storing references** (Caffeine, `ConcurrentMapCache`) hands the *same
  detached object* to every subsequent caller, forever, across threads. Whatever was
  uninitialised when it was cached stays uninitialised, and every reader throws.
- **A serialising cache** (Redis, Hazelcast with serialisation) walks the graph to write it —
  inside the transaction, which initialises everything it reaches and hides the problem while
  adding an unbounded fetch. That is the case in
  **[03c · Something initialised it first](03c-something-initialised-it-first.md)**.

Both are wrong for the same reason: **a cache is a place where objects live longer than the
scope that made them.** Cache values, not entities. The performance side of caching entities is
**[Topic 08 · 17b · The second-level cache](../08-the-n-plus-1-problem/17b-the-second-level-cache.md)**.

## 3 · Event payloads, and the one place the answer is subtle

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
void onOrderPlaced(OrderPlacedEvent event) {
    log.info("placed {}", event.order().getLines().size());   // ?
}
```

`AFTER_COMMIT` listeners run from a transaction synchronisation callback, and the javadoc for
that callback is precise about the state of the world:

> *"NOTE: The transaction will have been committed already, but the transactional resources
> might still be active and accessible. As a consequence, any data access code triggered at
> this point will still 'participate' in the original transaction, allowing to perform some
> cleanup (with no commit following anymore!), unless it explicitly declares that it needs to
> run in a separate transaction. Hence: Use `PROPAGATION_REQUIRES_NEW` for any transactional
> operation that is called from here."*

So a lazy access in an `AFTER_COMMIT` listener may well **succeed** — the resources are still
around — and it issues a query in a transaction that has already committed and will never
commit again. That is worse than failing, because it works in every test you write and its
cost and its consistency are both undefined.

**Put values in the event, not entities.** An event carrying an order id and a total is
serialisable, loggable, testable and forwardable to a message broker; an event carrying an
`Order` is a reference into a persistence context that the listener has no contract with.

## 4 · Message payloads and outbound integration

Publishing an entity to Kafka, JMS or an outbox row means serialising it, which means walking
the graph. If the publish happens inside the transaction it hides the boundary problem and
adds a fetch; if it happens after, it throws. Either way the wire format of your integration
is now your ORM mapping, which is a coupling nobody chose. The same argument, made about
serialisation generally, is
**[06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md)**.

## 5 · A field on a bean, or anything static

An entity assigned to an instance field of a singleton bean, a `static` field, a
`ThreadLocal`, a metrics gauge closure, or a `@Value`-style lazily evaluated holder. Each of
these outlives every unit of work by construction. They also pin the object in memory — and,
if a persistence context is still reachable through it, the context and every entity in it as
well.

## What the whole 04 series adds up to

Six chunks, one sentence: **an entity is a reference into a unit of work, and a reference
that outlives its unit of work is not a value.** Every failure mode in this series — the
signature that cannot state what is loaded, the operations that reach for the database,
propagation, self-invocation, futures, caches, sessions, events — is the same mistake in a
different costume.

The fix is to stop moving that kind of reference across the boundary:
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

## Gotchas

**★ Storing an entity in an HTTP session is the longest-lived version of this.** It survives
the request that created it, gets serialised by the session store, and produces the exception
minutes or hours later in an unrelated request, with a stack trace that points at
deserialisation.

**★ A reference-storing cache hands the same detached object to every future caller.** Not a
copy, not a fresh load — the identical object, with whatever was uninitialised still
uninitialised, shared across threads. The failure is permanent for as long as the entry lives,
and evicting the entry "fixes" it, which sends people chasing cache configuration.

**★ An `AFTER_COMMIT` listener that lazily loads probably works, and that is the problem.**
The transactional resources may still be bound, so the query succeeds — outside any
transaction that will ever commit. Spring's own javadoc tells you to use `REQUIRES_NEW` for
transactional work here, which is a direct statement that the surrounding transaction is over.

**★ Putting an entity in an event couples the listener to the publisher's fetch plan.** The
listener cannot state what it needs, the publisher cannot know what listeners exist, and
adding a listener that reads one more association breaks a path that has nothing to do with it.

**★ Serialising an entity to a message broker makes your ORM mapping the wire contract.**
Renaming a column, adding an association or changing a fetch type becomes a breaking change
for a downstream consumer who has never heard of your entity.

**★ An entity in a static or singleton field pins the persistence context too.** The entity
holds references to proxies, proxies hold a session reference until unset, and the context
holds hard references to every entity it loaded. A single leaked entity can keep an entire
unit of work's object graph alive.

## Interview questions

**★ You find an entity stored in the HTTP session. What do you say in review?**
That it is three bugs. It is a detached entity, so any unfetched association throws whenever
someone touches it, possibly hours later in an unrelated request. It is stale, because nothing
refreshes it and nothing writes changes back. And if the session is serialised to a store or
replicated across nodes, the object being serialised is a Hibernate-instrumented class whose
proxies and persistent collections are not what the store expects. Keep the identifier; reload
or re-project when you need the data.

**★ Is it safe to read a lazy association inside an `@TransactionalEventListener(AFTER_COMMIT)`
handler?**
It will often work, which is why it is dangerous. Spring's `TransactionSynchronization`
javadoc says the transaction has already committed but the transactional resources may still
be active and accessible, and that any data access triggered there participates in the
original transaction with no commit to follow — which is why it tells you to use
`REQUIRES_NEW` for transactional operations in that phase. So the lazy load may succeed and
issue a query outside any transaction that will complete. The right answer is that the event
should have carried the data, not the entity.

**★ Why is caching entities a bad idea even when it appears to work?**
Because a cache is defined by outliving the scope that produced its contents. A
reference-storing cache shares one detached object across every future caller and every
thread; a serialising cache walks the whole graph at write time, which initialises everything
it reaches — hiding the boundary bug behind an unbounded fetch. Cache the values you would
have returned anyway; they are immutable, small, serialisable and have no relationship with a
session.

**★ What single sentence covers this whole family of bugs?**
An entity is a reference into a unit of work, not a value. Anything that stores it, schedules
it, caches it, publishes it or hands it to another thread has extended its lifetime past the
scope that made it meaningful. The exception is just the moment the extension is discovered.

{/* FOOTER */}
