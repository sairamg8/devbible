---
title: "Detachment removes the ability to fetch, not the result of fetches already performed — so a detached entity is an ordinary Java object, and several of the operations you assumed needed a session do not"
sidebar_label: "04b · What still works detached"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.Hibernate` javadoc for `isInitialized` and `isPropertyInitialized`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the `org.hibernate.StatelessSession` javadoc for `fetch`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/StatelessSession.html)),
> `org.hibernate.cfg.JpaComplianceSettings.JPA_PROXY_COMPLIANCE`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/JpaComplianceSettings.html)),
> and the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**"Detached" gets used as a synonym for "broken", and that is wrong in a way that costs
people whole afternoons and a fetch join they did not need. Detaching clears one field on one
object: the initializer's reference to the session. It does not undo a fetch, does not empty
a collection, does not null a field and does not make an entity unusable. So the question is
never "is it detached", it is "does this particular operation need the database" — and for a
surprising number of operations the answer is no.** Continues
**[04 · The detached entity](04-the-detached-entity.md)**.

## The single rule

> Detachment removes the *ability* to fetch. It does not remove the *result* of a fetch that
> already happened.

That is the whole mechanism. `AbstractLazyInitializer.unsetSession()` sets `session = null`
and leaves `initialized` and `target` exactly as they were — so an initialised proxy keeps
delegating to the loaded entity for the rest of its life, detached or not. The internals are
**[01 · What a proxy actually is](01-what-a-proxy-actually-is.md)**.

Everything below follows from applying that one rule honestly to each operation.

## What works, with no session, forever

### 1 · Every already-loaded basic field

`order.getPlacedAt()`, `order.getTotal()`, `order.getStatus()` — these are field reads on a
real object. They were populated by the `select` that loaded the row. Detachment does not
touch them.

### 2 · The identifier of an unfetched proxy

Documented explicitly in the introduction:

> *"It's important to know that some operations which may be performed with an unfetched
> proxy don't require fetching its state from the database. First, we're always allowed to
> obtain its identifier"*

```java
var pubId = entityManager.find(Book.class, bookId).getPublisher().getId(); // does not fetch publisher
```

🔴 **This is the single most useful thing on the page.** A detached `Order` whose `customer`
is an unfetched proxy can still tell you `order.getCustomer().getId()`, because the foreign
key value came back with the order's own row and lives in the initializer. If all your
response needs is `customerId`, you already have it — no join, no graph, no query.

**The exception is `hibernate.jpa.proxy_compliance`.** The specification requires an
`EntityNotFoundException` for a proxy with no backing row, and Hibernate's compliance flag
delivers that by initialising the proxy when its **identifier** is accessed. With it on, the
one reliably free operation on this page becomes a database round trip — and, detached, an
exception. Hibernate documents enabling it as not recommended, precisely because of the
unnecessary round trips it forces.

### 3 · Using a proxy as the target of an association

The introduction's second free operation:

> *"Second, we may create an association to a proxy"*

```java
book.setPublisher(entityManager.getReference(Publisher.class, pubId)); // does not fetch publisher
```

The write only needs the foreign key value, and the proxy has it. This is why
`getReferenceById` exists and why assigning its result is cheap.

### 4 · Anything already initialised

An initialised proxy, an initialised collection, a fully populated subgraph. All of it reads
normally after detachment. This is why a service that fetch-joined everything it needs
returns an object that serialises without incident — and also why an accidental touch inside
the transaction conceals the bug so effectively
(**[03c · Something initialised it first](03c-something-initialised-it-first.md)**).

### 5 · `Hibernate.isInitialized` and `PersistenceUnitUtil.isLoaded`

Both answer "has this been fetched" by inspecting the object, not the database.
`Hibernate.isInitialized` reads the initializer's flag; on something that is neither a proxy
nor a persistent collection it returns `true`. `Hibernate.isPropertyInitialized(entity, name)`
does the same for a bytecode-enhanced lazy attribute — *"If the named property does not exist
or is not persistent, this method always returns true."*

These are the only inspection calls that are safe on a detached object, and they are the
reason a mapper can be written defensively at all. Every *other* way of asking a question
about a proxy is a fetch: **[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**.

### 6 · Equality, if it is implemented correctly

An `equals`/`hashCode` written against a business key or an assigned identifier reads fields
that are already there. One written against `getClass()`, or that dereferences an
association, is a fetch. See
**[Topic 06 · 10b · Fixing entity equality](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)**
and **[Topic 07 · 15 · equals, hashCode, toString](../07-relationships-fetch/15-equals-hashcode-tostring.md)**.

### 7 · Serialisation, if the reachable graph is complete

A detached entity whose every reachable association is either initialised, `null`, or excluded
from serialisation serialises with no session and no error. That is not a contradiction of
this topic — it is the same rule. Serialisation only fails where it reaches something
unfetched.

## The two documented ways to fetch on a detached object

Both exist, both are real, and neither is a substitute for fetching correctly in the first
place.

**`merge`** brings a copy back into a persistence context — and returns *that copy*, not your
object. The distinction is the whole of
**[Topic 06 · 13b · Merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)**,
and it is revisited as a proposed fix in
**[04d · The boundary is not where you think](04d-the-boundary-is-not-where-you-think.md)**.

**`StatelessSession.fetch(Object)`** is the one people have never heard of. A stateless
session, per its javadoc, *"has no persistence context, and always works directly with
detached entity instances"*, and `fetch` is documented as:

> *"Fetch an association or collection that's configured for lazy loading."*

```java
Book book = session.get(Book.class, isbn);  // book is immediately detached
session.fetch(book.getAuthors());           // fetch the associated authors
book.getAuthors().forEach(author -> … );    // iterate the collection
```

with the javadoc's own warning attached:

> *"this operation in a stateless session is quite sensitive to data aliasing effects and
> should be used with great care."*

It is worth knowing this exists, because it is the correct answer to "can you ever fetch on a
detached object" — yes, in a stateless session, which is designed around detached objects. It
is not the answer to "how do I fix my controller".

## The other half of the list

Everything above is an operation that reads memory. The dangerous half is the operations that
*look* like they read memory and reach for the database instead — `size()`, `toString()`,
`unproxy`, `getClass`, and the one type test that does not throw and gives you a wrong answer
instead. Those are **[04c · What looks safe and is not](04c-what-looks-safe-and-is-not.md)**.

## Gotchas

**★ Reading `proxy.getId()` is free, and this is badly under-used.** Half the DTO fields
people think require a fetch join are foreign keys they already have. Before adding a join for
`customerId`, check whether `order.getCustomer().getId()` answers it — it does, detached, with
no query.

**★ …unless `hibernate.jpa.proxy_compliance` is enabled.** Then the identifier read
initialises the proxy, so the one reliably free operation becomes the one that throws. A
codebase with `hibernate.jpa.compliance=true` set globally has this on, and nobody remembers
switching it.

**★ A detached entity is still mutable and its changes go nowhere.** No exception, no warning,
no dirty check, no log line. This is a separate hazard from lazy loading that lives on the
same object and bites in exactly the same code — a service that returns an entity and a caller
that "updates" it.

**★ `StatelessSession.fetch` is real and is not your controller's fix.** It is designed for
batch and bulk code that deliberately works with detached objects. Its own javadoc warns it is
"quite sensitive to data aliasing effects", which is a polite way of saying you can end up
holding two Java objects for one row with no identity map to reconcile them.

**★ Serialisation succeeding on one object proves nothing about the class.** Completeness of
the reachable graph is a property of the instance and the row, not the type — a null foreign
key or an empty collection ends the walk early
(**[03b · It was never a proxy](03b-it-was-never-a-proxy.md)**).

**★ `Hibernate.isInitialized` returns `true` for things that were never lazy.** On a plain
loaded entity, a basic value or a plain `ArrayList` it answers `true`, which is correct and
means the method cannot be used as "is this a proxy". If you want that question, use
`HibernateProxy.extractLazyInitializer(obj) != null`, which returns `null` for a non-proxy.

**★ Being able to read the identifier does not mean the row exists.** A proxy from
`getReference`/`getReferenceById` carries the id you gave it whether or not there is a
matching row; the miss is only discovered on the first state access, and it surfaces as
`EntityNotFoundException`, not `LazyInitializationException`.

## Interview questions

**★ What exactly does detaching an entity change?**
One field, on each proxy and each persistent collection: the reference to the session.
Hibernate's `unsetSession()` nulls it and leaves the `initialized` flag and the `target`
reference alone. Nothing about already-loaded state changes — no field is cleared, no
collection emptied. That is why an entity fetched completely inside the transaction is
perfectly usable afterwards, and why an entity fetched partially is usable exactly as far as
it was fetched.

**★ Name an operation on an uninitialised proxy that does not hit the database.**
Reading its identifier. Hibernate's introduction documents this explicitly — the proxy holds
the id it was created with, so `getPublisher().getId()` returns without a query. The second
documented free operation is using the proxy as the target of an association, because
persisting that association only needs the foreign key value. Both stop being free if
`hibernate.jpa.proxy_compliance` is enabled, which forces initialisation on identifier access.

**★ Why does the specification's proxy-compliance rule cost a query?**
Because the specification insists that accessing an uninitialised proxy with no corresponding
database row must produce `EntityNotFoundException`. The only way to know whether the row
exists is to go and look, so a compliant implementation has to fetch at the first access —
including an access that reads nothing but the identifier it already has in a field. Hibernate
takes the non-compliant, cheaper route by default and offers the flag for applications that
need strict portability.

**★ Is `merge` a way to fetch an association on a detached entity?**
It is a way to obtain a *managed copy* on which you can then fetch. It is not a way to repair
the instance you hold: `merge` returns a distinct object associated with the new persistence
context and leaves the original detached. So `em.merge(order); order.getLines().size();` still
throws, and `order = em.merge(order); order.getLines().size();` works but is now a second
query against a second object, inside a transaction you had to open anyway — at which point
loading it properly in the first place was cheaper.

**★ Is there any supported way to fetch a lazy association on an object that is genuinely
detached?**
Yes, in a stateless session. `StatelessSession` has no persistence context and works with
detached instances by design, and `fetch(Object)` is documented as fetching an association or
collection configured for lazy loading. It is intended for batch-style code, and its javadoc
warns it is sensitive to data aliasing — without an identity map you can easily hold two
objects for one row. It is a legitimate tool in the right place and not a repair for a web
request that returned the wrong type.

**★ Why is knowing this list worth anything if the recommended fix is a DTO?**
Because you have to write the mapper, and the mapper runs against real objects. Knowing that
`getId()` on a proxy is free removes fetch joins you were about to add — a DTO with a
`customerId` field needs no join at all. Knowing which inspection calls are safe is what lets
you assert, in a test, that a mapper touched nothing it should not have.

{/* FOOTER */}
