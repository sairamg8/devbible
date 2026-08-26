---
title: "A lazy collection is not a proxy: it is a different class, with a different session check, a different failure message, and one condition a proxy does not have"
sidebar_label: "01c · A collection is not a proxy"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `7.4` source of
> `org.hibernate.collection.spi.AbstractPersistentCollection`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/collection/spi/AbstractPersistentCollection.java))
> and `org.hibernate.proxy.AbstractLazyInitializer`, the Hibernate ORM 7.4 *Introduction*
> §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the `org.hibernate.Hibernate` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**People say "proxy" for both halves of lazy loading, and the two halves do not share a line
of code. A lazy `@ManyToOne` gets a generated subclass with a `LazyInitializer` behind it. A
lazy `@OneToMany` gets a `PersistentSet`, `PersistentBag` or `PersistentMap` — a Hibernate
implementation of the interface you declared, which is not a subclass of anything of yours,
carries the mapped role and the owner's key instead of an entity name and an id, and decides
whether it can still fetch using a **three-part** test rather than the proxy's one-part test.
The extra part is why a collection can fail while the session is still open, which no proxy
can do.**

## What the collection object holds

`AbstractPersistentCollection` declares, among others:

| Field | What it is for |
|---|---|
| `transient SharedSessionContractImplementor session` | the session that can still fetch |
| `boolean initialized` / `transient boolean initializing` | whether the rows have arrived |
| `@Nullable String role` | the mapped attribute, e.g. `com.acme.Order.lines` |
| `@Nullable Object key` | the owning row's identifier |
| `@Nullable Object owner` | the entity instance that holds it |
| `int cachedSize` | `-1` until a size is known |
| `transient List<DelayedOperation<E>> operationQueue` | writes recorded without loading |
| `boolean dirty`, `@Nullable Serializable storedSnapshot` | change tracking |
| `boolean allowLoadOutsideTransaction`, `sessionFactoryUuid` | the unsafe escape hatch |

Compare that with the proxy's `entityName` + `id`. A proxy stands in for **one row you can
name**; a collection stands in for **a query nobody has run**, so what it has to remember is
the query — which association, on which owner.

That difference explains the message. A proxy failure names an entity and an id. A collection
failure names a *role* and a *key*, because those are what it has.

## The three-part connection test

This is the part with no counterpart on the proxy side. `isConnectedToSession()`:

```java
protected boolean isConnectedToSession() {
    return session != null
        && session.isOpen()
        && session.getPersistenceContextInternal().containsCollection( this );
}
```

Three conditions, and the third is the interesting one. **It is not enough for the session to
exist and be open — the persistence context must still be tracking this particular collection
instance.** That is false in several ordinary situations:

- someone called `entityManager.clear()`, so the context was emptied while the session lives
  on;
- someone called `detach(order)` on the owner;
- the collection was loaded in one session and the owner has since been `merge`d into another
  — the copy is tracked, the original is not (see
  **[Topic 06 · 13b · merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)**);
- the field was reassigned — `order.setLines(new ArrayList<>())` — so the instance Hibernate
  installed is no longer the one on the object.

When that third condition alone is false, the message you get is not "no session". It is
`collection not associated with session`, which reads like nonsense the first time you see it
in an application whose session is demonstrably open. It means precisely: *this session is
alive and it has never heard of this collection.*

## Writes that do not read

`isOperationQueueEnabled()` is the reason a lazy collection sometimes accepts an `add` with
no query at all:

```java
protected boolean isOperationQueueEnabled() {
    return !initialized
        && isConnectedToSession()
        && isInverseCollection();
}
```

For an **inverse** collection — the `mappedBy` side, where the foreign key lives on the other
table — Hibernate can record the addition in `operationQueue` without loading the existing
rows, because the collection is not the thing that writes the foreign key anyway. There is a
narrower variant, `isPutQueueEnabled()`, which additionally requires
`isInverseOneToManyOrNoOrphanDelete()`, because orphan removal needs to know what was there.

Two consequences worth carrying:

- **`add` on an uninitialised inverse collection is cheap and does not throw** *while
  connected*. `isConnectedToSession()` is still in the condition, so on a detached collection
  the queue is not available and the write goes down the read path instead.
- **`add` on the owning side of a `@ManyToMany`, or on a collection with orphan removal, does
  load.** `write()` is `initialize(true); dirty();`. Same method call, entirely different
  cost, decided by the mapping.

## `size()` is not metadata

`readSize()` returns early only when `cachedSize != -1 && !hasQueuedOperations()`. Otherwise
it goes through `withTemporarySessionIfNeeded(...)` and calls `read()`, which is the full
load. `cachedSize` starts at `-1`.

So `order.getLines().size()` on a freshly loaded owner is a full fetch of every line row. So
is `isEmpty()`. So is `contains`, `iterator`, `stream`, `forEach`, `toString` and enhanced
`for`. The methods that *look* like they ask about the collection rather than its contents
are the ones that catch people, and there is a real alternative:
`Hibernate.size(collection)` and friends, covered in
**[Topic 07 · 14b · Inspecting initialization](../07-relationships-fetch/14b-inspecting-initialization.md)**.

## Why replacing the field breaks everything at once

Hibernate installs its own instance into the field. Assign over it:

```java
order.setLines(new ArrayList<>(newLines));   // ⛔
```

…and three things happen together. The tracked instance — with its `role`, `key`, `snapshot`
and `dirty` flag — is thrown away; the persistence context is now tracking an object nothing
references; and the new `ArrayList` is a plain collection with no association to any session,
so nothing about it can be lazy and nothing about it will be written by dirty checking in the
way you expect. This is the same rule
**[Topic 07 · 05 · One-to-many bidirectional](../07-relationships-fetch/05-one-to-many-bidirectional.md)**
gives for a different reason, and it is why the field must be declared as the interface type
and mutated in place — `clear()` then `addAll()`.

## Gotchas

**★ A collection can throw while the session is open.** The proxy's check is "do I have a
session that is open and connected". The collection's adds "and does that session's
persistence context still contain me". An `entityManager.clear()` or a `detach` satisfies
the first and fails the second, and the message says `collection not associated with
session`.

**★ An uninitialised collection is never `null` and never equal to an empty one.** The field
holds a real object with contents nobody has asked for. `== null` is not a test for
"unloaded", and `isEmpty()` is the load.

**★ `size()` is a full fetch of the rows, not a `count`.** `cachedSize` starts at `-1`, and
the only paths that populate it without a full read were tied to extra-lazy collections,
which 7.x has dropped. If you want a number, write a query that returns a number.

**★ Adding to a collection is cheap or expensive depending on which side owns it.** Inverse
collections can queue the operation without loading; owning-side and orphan-removal
collections cannot. The call site looks identical either way, which is why a `add` that was
free in one entity is a full load in another.

**★ Serialising a persistent collection serialises a Hibernate class.** Both `session` and
`operationQueue` are `transient`, so what survives is a collection that can neither fetch nor
replay pending writes. Jackson's Hibernate module has a whole feature for replacing these
with plain JDK types on the way out — see
**[06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md)**.

**★ `Hibernate.initialize(collection)` loads the collection and nothing inside it.** Its
javadoc restricts it to the collection itself. A list of orders whose customers are proxies
is still a list of proxies afterwards.

**★ Reassigning the field silently disables change tracking.** Not an exception — a
regression. The update you expected at flush time does not happen, or happens as a
delete-all-and-reinsert, and nothing in the code reads as wrong.

**★ Removing an entity makes its collections unusable in a distinct way.**
`checkPersister` throws `Cannot lazily initialize collection (collection is being removed)`
when the collection is uninitialised and its persister has gone. Touching a lazy collection
on an entity you have just `remove`d is its own failure, not the ordinary detached one.

**★ `role` and `key` can both be `null` in the message.** The message builder appends
`of role '…'` and `with key '…'` only when they are set, so an unreferenced collection
produces the bare `Cannot lazily initialize collection (…)` with nothing to identify it. If
you get that shorter form, the collection was never associated with a mapping — usually
because the field was replaced.

## Interview questions

**★ What is the difference between a lazy `@ManyToOne` and a lazy `@OneToMany` at runtime?**
Almost everything except the intent. The `@ManyToOne` field holds a generated subclass of the
target entity implementing `HibernateProxy`, backed by a `LazyInitializer` that knows the
entity name and the identifier. The `@OneToMany` field holds a Hibernate implementation of
`Set`, `List` or `Map` — not a subclass of anything you wrote — backed by
`AbstractPersistentCollection`, which knows the mapped role and the owner's key. They have
separate session references, separate initialisation paths and separate exception messages.
Calling both "the proxy" hides the fact that the fixes differ.

**★ How can a collection fail to initialise when the session is still open?**
Because its connection test has three parts, not one: a non-null session, an open session,
*and* the session's persistence context still containing that collection instance. Clearing
the persistence context, detaching the owner, merging the owner into a copy or reassigning
the field all leave an open session that is no longer tracking this collection, and the
message reflects it — `collection not associated with session` rather than `no session`.

**★ Why does `orders.size()` issue a query when a `count` would do?**
Because `size()` is a question about the contents, and the persistent collection has no
contents until it reads them. `readSize()` short-circuits only if a size was already cached
and there are no queued operations; otherwise it performs the full load. Hibernate's dropping
of extra-lazy collections in 7.x removed the mode where a `count` could back a `size()` call.
If a count is what you need, ask the database for a count in a query rather than asking a
collection how big it is.

**★ Why is `add` to a lazy collection sometimes free?**
Because for an inverse collection Hibernate can record the operation in a delayed-operation
queue without loading the existing rows — the foreign key that makes the association real
lives on the other side, so the collection does not need to know what is already in it. The
guard is `!initialized && isConnectedToSession() && isInverseCollection()`, with a stricter
variant when orphan removal is mapped. The consequences are that the same `add` call is free
on the `mappedBy` side and a full load on the owning side, and that the optimisation is
unavailable once the collection is detached.

**★ Why must you never assign a new collection over a mapped field?**
Because Hibernate installed its own instance and tracks changes through that instance. Replacing
it discards the role, the key, the loaded snapshot and the dirty flag, leaves the persistence
context holding a collection nothing points at, and puts a plain JDK collection in a field the
mapping expects to be a persistent one. The visible symptom is usually not an exception but a
wrong update at flush time, which is far harder to trace. Mutate in place — `clear()` then
`addAll()`.

**★ You see `Cannot lazily initialize collection (collection is being removed)`. What
happened?**
Something touched an uninitialised collection on an entity that has been scheduled for
removal, so its collection persister is gone. It is thrown from `checkPersister` and it is a
different situation from the ordinary detached failure: the session is fine, the collection is
fine, but the mapping behind it has been torn down. In practice it means a `remove` and a read
of the same aggregate are interleaved — often a lifecycle callback, an event listener or a
`toString` running after the delete was scheduled.

**★ What survives serialisation of a persistent collection?**
The elements, if it was initialised, and nothing operational. `session` and `operationQueue`
are both `transient`, so a deserialised collection can neither fetch nor replay pending writes,
and its class is still a Hibernate type rather than the JDK one the receiving code probably
expects. That combination — a Hibernate class with no ability to act like one — is why
serialising entities is treated in this topic as the root mistake rather than as a thing to
configure around.

<!--FOOTER-->
