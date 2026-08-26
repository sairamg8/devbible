---
title: "Load the same row twice and you get the same object — not two equal objects, the identical reference. That one guarantee is what a persistence context is"
sidebar_label: "11 · The persistence context"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.1 *Persistence
> contexts*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §6 *Persistence Context* and §3.4.7
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification §7.1 *Persistence Contexts*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Almost everything people find mysterious about JPA — the UPDATE nobody wrote, the
`find` that runs no SQL, why `merge` hands back a different object, why a
`LazyInitializationException` happens *after* the service method returns — is one mechanism seen
from different angles. That mechanism is small enough to describe in a sentence: while a
transaction is running, Hibernate keeps a map from identifier to object, and it will not
put two objects for the same row in it. Everything else follows.**

## See it before naming it

```java
@Transactional
public void demonstrate() {
    Customer a = entityManager.find(Customer.class, 42L);
    Customer b = entityManager.find(Customer.class, 42L);

    assert a == b;                 // the SAME reference, not just equal
}
```

Two `find` calls, one SQL SELECT. The second call does not go to the database at all: it
finds `42` already in the map and returns what is there.

This is not an optimisation Hibernate added. It is a *guarantee* it makes. The User Guide
states it as one: "Hibernate guarantees equivalence of persistent identity (database row)
and Java identity inside a particular session scope."

Now the consequence that gives the topic its name:

```java
@Transactional
public void alsoDemonstrate() {
    Customer a = entityManager.find(Customer.class, 42L);
    a.setEmail("new@example.com");

    Customer b = entityManager.find(Customer.class, 42L);
    assert b.getEmail().equals("new@example.com");   // b IS a
}
```

You did not save anything. You did not re-read anything. `b` shows the new email because
`b` and `a` are one object. And when the transaction commits, an UPDATE is issued that
nobody wrote — [14 · Dirty checking](14-dirty-checking.md).

## Now the name

The Jakarta Persistence specification §7.1 defines it in one sentence:

> A persistence context is a set of managed entity instances in which for any persistent
> entity identity there is a unique entity instance.

The Hibernate Introduction says the same thing with the mechanism visible:

> A persistence context is a sort of cache; we sometimes call it the "first-level cache",
> to distinguish it from the second-level cache. For every entity instance read from the
> database within the scope of a persistence context, and for every new entity made
> persistent within the scope of the persistence context, the context holds a unique
> mapping from the identifier of the entity instance to the instance itself.

"A unique mapping from the identifier to the instance" is the whole thing. Computer
science calls this an **identity map**. Two properties follow immediately: at most one
instance per row, and — as the spec puts it — "at any given moment, an instance may be
associated with at most one persistence context."

## Where it comes from and how long it lives

You do not create a persistence context. In a Spring application you get one because a
transaction started.

```java
@Service
public class CustomerService {

    @PersistenceContext                 // NOT a plain EntityManager instance
    private EntityManager entityManager;

    @Transactional
    public void rename(Long id, String name) {
        Customer c = entityManager.find(Customer.class, id);
        c.setName(name);
    }                                   // context flushes and closes here
}
```

The `EntityManager` injected by `@PersistenceContext` is a **proxy**. It is a singleton
field on a singleton bean, and it must be, because Spring beans are shared while a
persistence context absolutely is not. Every call on it is routed to the context bound
to the *current thread's* transaction — the same thread-binding mechanism described in
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md).

The Introduction on lifetime: "The lifetime of a persistence context usually corresponds
to the lifetime of a transaction, though it's possible to have a persistence context that
spans several database-level transactions that form a single logical unit of work."

## The rule that has no exceptions

The Introduction states it about as forcefully as documentation ever does:

> A persistence context—that is, a `Session` or `EntityManager`—absolutely positively
> must not be shared between multiple threads or between concurrent transactions.
>
> If you accidentally leak a session across threads, you will suffer.
>
> […] If you don't completely understand the previous passage, go back and re-read it
> until you do. A great deal of human suffering has resulted from users mismanaging the
> lifecycle of the Hibernate `Session` or JPA `EntityManager`.

The reasons are named: "persistence contexts aren't threadsafe, and can't be shared
across threads," and "a persistence context can't be reused across unrelated
transactions, since that would break the isolation and atomicity of the transactions."

Practically: never store an `EntityManager` in a field of an object you hand around,
never pass one to an `@Async` method or a `CompletableFuture`, and never keep one alive
across requests. The `@PersistenceContext` proxy exists precisely so you do not have to.

## What you get, in the documentation's own list

The Introduction gives five reasons persistence contexts exist. All five are worth
naming, because each one is a separate piece of behaviour you will meet later.

**They avoid data aliasing.** "if we modify an entity in one section of code, then other
code executing within the same persistence context will see our modification." Two
service methods in one transaction cannot end up with two divergent copies of a row.

**They enable automatic dirty checking.** "after modifying an entity, we don't need to
perform any explicit operation to ask Hibernate to propagate that change back to the
database." → [14 · Dirty checking](14-dirty-checking.md).

**They can avoid database round trips.** "by avoiding a trip to the database when a given
entity instance is requested repeatedly in a given unit of work." → [11b · The find that
issues no SQL](11b-find-that-issues-no-sql.md).

**They make batching possible.** "They make it possible to transparently batch together
multiple database operations." Because writes are queued rather than executed, they can
be grouped — [15 · Flush](15-flush.md), and the exception in
[7b · IDENTITY kills batching](07b-identity-kills-batching.md).

**They let Hibernate detect circularity.** "A persistence context also allows us to detect
circularities when performing operations on graphs of entities." Cascading through a
cyclic object graph terminates because the context knows what it has already visited.

## What it costs

The same passage is honest about the other side:

> a persistence context holds a hard reference to all its entities, preventing them from
> being garbage collected. Thus, the session must be discarded once a unit of work is
> complete.

And the conclusion: "whether a persistence context helps or harms the performance of a
given unit of work depends greatly on the nature of the unit of work. For this reason
Hibernate provides both stateful and stateless sessions."

That is the seed of two later chunks. The memory and CPU cost of holding entities *and
their snapshots* is [14e · What dirty checking costs](14e-what-dirty-checking-costs.md).
The escape hatch — a `StatelessSession`, which has no persistence context at all, and
therefore no identity map, no snapshots, and no dirty checking — is the right tool for
bulk work.

## Gotchas

**No transaction usually means no persistence context worth having.**
Calling a repository method outside a transaction gets you a short-lived context that
closes when the call returns, so the entity comes back detached. Two such calls return
two different objects for the same row. This is one of the most common causes of "my
changes are not saved".

**Every Spring Data repository method is transactional; that is not the same as your
service being transactional.**
Two repository calls with no `@Transactional` on the caller are two transactions and two
persistence contexts. Nothing is shared between them. Put `@Transactional` on the service
method that is the actual unit of work.

**The identity map is keyed by entity type *and* identifier.**
`find(Customer.class, 1L)` and `find(Order.class, 1L)` are different keys. This matters
when debugging: "one instance per row" means per *row*, not per id value.

**A query does not bypass the identity map.**
If a JPQL query returns row 42 and 42 is already managed, you get the existing managed
instance back — with its in-memory modifications intact — not a fresh object built from
the result set. This is correct and it surprises people who expected the query to
"refresh" the object. `refresh()` is the operation that does that.

**A large persistence context is a memory leak with a timer on it.**
Because it holds hard references, a loop that loads a million entities in one transaction
holds a million objects plus a million snapshots. `flush()` then `clear()` periodically
is the documented mitigation for the pattern.

**Never inject a plain `EntityManager` as a constructor argument into a singleton
without understanding what you got.**
Spring can inject a shared proxy, which is safe; obtaining a real `EntityManager` from an
`EntityManagerFactory` and holding it in a field is not, and the failure is
intermittent and concurrency-dependent, which is the worst kind.

**"First-level cache" is a misleading name.**
It is not a cache in the sense of "makes repeated reads faster across requests" — it dies
with the transaction. Its job is *identity*, and the performance benefit is a side
effect. The thing that survives a transaction is the second-level cache, which is a
different feature with different correctness implications.

## Interview questions

**★ What is a persistence context?**
A set of managed entity instances in which, for any persistent identity, there is exactly
one instance — an identity map from identifier to object, scoped to a unit of work. In
Spring it is created when a transaction begins and closed when it ends, and the
`EntityManager` you inject is a proxy that routes to whichever context is bound to the
current thread. Hibernate calls it the first-level cache, but its primary job is identity,
not caching.

**★ Why does `find` twice for the same id return the same object reference?**
Because the first call put the instance in the identity map under its identifier, and the
second call finds it there. This is a guarantee rather than an optimisation: the User
Guide says Hibernate "guarantees equivalence of persistent identity (database row) and
Java identity inside a particular session scope". Without it, two parts of the same
transaction could hold divergent copies of one row and the last flush would silently
discard one set of changes.

**★ Why is a persistence context not thread-safe, and why does that matter more than for most objects?**
It holds mutable state — the identity map, the entity snapshots used for dirty checking,
and the queue of pending actions — with no synchronisation, and it is bound to one
database connection and one transaction. Sharing it across threads corrupts that state and
breaks the isolation and atomicity of the transactions involved, because two threads would
be writing through one transactional context. Hibernate's documentation is unusually blunt
about this: "if you accidentally leak a session across threads, you will suffer."

**★ How can a singleton Spring bean hold an `EntityManager` field safely?**
Because it is not a real `EntityManager`. `@PersistenceContext` injects a proxy that
delegates each call to the context bound to the current thread's transaction. The
singleton holds one proxy; every request gets its own context behind it. This is the same
thread-binding used by Spring's transaction infrastructure generally.

**★ What is the relationship between a persistence context and a transaction?**
In the usual Spring arrangement they are one-to-one: the context is created when the
transaction starts and destroyed when it ends, and every entity it managed becomes
detached at that moment. They are not the *same* thing — an extended context can span
several database transactions as one logical unit of work — but the transaction-scoped
case is the one you should assume unless something has been deliberately configured
otherwise.

**★ Why is calling it a "cache" misleading?**
Because it does not outlive the unit of work, so it never serves a later request. Its
purpose is to guarantee one instance per row; the fact that a repeated `find` avoids a
query is a consequence of that guarantee rather than its point. The feature that actually
caches across transactions is the second-level cache, which is opt-in and brings its own
invalidation problems.

**★ What are the costs of a persistence context?**
It holds a hard reference to every entity it manages, plus a snapshot of each one's loaded
state for dirty checking, so memory grows with the number of entities touched and flushing
costs time in proportion to that number. It also constrains you: not thread-safe, not
reusable across unrelated transactions, and unusable after any of its methods throws. For
work where none of the benefits apply — a bulk import, a large read-only scan — Hibernate
offers `StatelessSession`, which has no persistence context and therefore none of these
costs or guarantees.

---

← Prev: [10b · Fixing entity equality](10b-fixing-entity-equality.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [11b · The find that issues no SQL](11b-find-that-issues-no-sql.md)
