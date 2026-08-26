---
title: "A proxy is a generated subclass whose real payload is a live reference to the session that created it, and LazyInitializationException is what happens to code that outlives that reference"
sidebar_label: "01 · What a proxy actually is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.proxy.HibernateProxy` and `org.hibernate.LazyInitializationException`
> javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/proxy/HibernateProxy.html)),
> and the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The thing in a lazy field is not one object, it is two. There is a generated subclass of
your entity — that is the part everyone knows — and behind it there is a `LazyInitializer`
that holds the identifier, a flag saying whether the data has arrived, and a **live
reference to the `Session` that created the proxy**. That session reference is the whole
story of this topic. It is what makes a lazy field work, it is set to `null` the moment the
entity is detached, and every `LazyInitializationException` you will ever see is a method
call that found it gone. Lazy loading is not a property of the field. It is a property of
the field's relationship to a session that is still open.**

:::note What this topic owns, and what it does not
**[Topic 07 · 14 · What a lazy association is](../07-relationships-fetch/14-what-a-lazy-association-is.md)**
names the object and works through what it does to `getClass()`, `instanceof` and `equals`.
It ends by handing this topic the question of what happens once the session is gone, and
that is what this chunk starts from. The *performance* consequences of lazy loading —
query counts, N+1, and every fix for them — belong to
**[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)**. This topic is about
a program that produces the wrong answer or no answer at all, not one that is slow.
:::

## Three layers, not one

When Hibernate reads a `Book` row with a lazy `@ManyToOne Publisher publisher`, the field
does not hold a `Publisher`. It holds something with three layers stacked on top of each
other:

```java
@Entity
class Book {
    @Id @GeneratedValue Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    Publisher publisher;      // ← what is in here?
    // …
}
```

**Layer one — your class.** The object is assignable to `Publisher`, because the class
Hibernate generated at runtime is a *subclass* of `Publisher`. Every method you declared is
overridden.

**Layer two — the `HibernateProxy` interface.** The generated class also implements
`org.hibernate.proxy.HibernateProxy`, whose javadoc describes it in one line: *"Interface
implemented directly by entity proxies, exposing access to the associated
`LazyInitializer`."* It exists so that framework code can recognise a proxy and get at
layer three. It declares a static helper for exactly that: `extractLazyInitializer(Object)`,
which *"Extract[s] the `LazyInitializer` from the given object, if and only if the object is
actually a proxy. Otherwise, return[s] a null value."*

**Layer three — the `LazyInitializer`.** This is the object that does the work, and the one
worth knowing. Every overridden method on the generated subclass is a call into it.

## What the initializer is holding

`AbstractLazyInitializer` in the 7.4 source declares, among others, these fields:

| Field | What it is for |
|---|---|
| `entityName` | which entity this stands in for |
| `id` | the identifier — already known, because it came from the foreign key |
| `transient SharedSessionContractImplementor session` | 🔴 **the session that can still fetch the data** |
| `boolean initialized` | whether the fetch has already happened |
| `Object target` | the real, fully-loaded entity, once it has |
| `boolean readOnly` | whether changes to it will be written back |
| `String sessionFactoryUuid` | which factory it came from, kept for serialisation |
| `boolean allowLoadOutsideTransaction` | whether the unsafe escape hatch is enabled |

Read that list as a design and the failure mode falls out of it. **`id` is data the proxy
carries. `session` is a capability the proxy borrows.** Data survives anything you do to the
object. A borrowed capability does not.

That asymmetry is the reason the two documented free operations on a proxy are free. The 7.4
*Introduction* shows both:

```java
var pubId = entityManager.find(Book.class, bookId)
                         .getPublisher().getId();          // does not fetch publisher
book.setPublisher(entityManager.getReference(Publisher.class, pubId)); // does not fetch
```

Reading the identifier needs only the `id` field. Everything else needs `session`.

## The one line that creates the exception

`unsetSession()` in `AbstractLazyInitializer` is four statements long, and the second is the
one this whole topic is about:

```java
public final void unsetSession() {
    prepareForPossibleLoadingOutsideTransaction();
    session = null;                       // ← here
    readOnly = false;
    readOnlyBeforeAttachedToSession = null;
}
```

Hibernate calls it when the entity is detached — when the persistence context is cleared,
when the entity is evicted, when the session closes and releases everything it was holding.
Nothing about your object changed. Its class is the same, its fields are the same, the `id`
is still there. The one thing that went away is the thing the object needed in order to
answer any question about itself.

Then `initialize()` runs on the next method call and takes one of four branches:

```java
if (allowLoadOutsideTransaction) { permissiveInitialization(); }
else if (session == null)                            { throw new LazyInitializationException(…); }
else if (!session.isOpenOrWaitingForAutoClose())     { throw new LazyInitializationException(…); }
else if (!session.isConnected())                     { throw new LazyInitializationException(…); }
else { target = immediateLoad(session); initialized = true; … }
```

Three of the five outcomes are exceptions, and they are three genuinely different
situations, which is why the message text differs between them — the subject of
**[02 · The exception](02-the-exception.md)**.

## Why this is a correctness failure, not a performance one

The javadoc for `LazyInitializationException` says it *"Indicates an attempt to access
unfetched data outside the context of an open stateful `Session`"*, and the class extends
`HibernateException`, which extends `RuntimeException`. Nothing declares it. Nothing forces
you to handle it. The compiler cannot see it.

That matters more than it sounds. A method with this signature:

```java
public Order findOrder(Long id) { … }
```

makes a promise that its return value is an `Order`. What it actually returns, if the
implementation is `@Transactional` and returns a managed entity, is an object graph in which
**some subset of the fields — a subset determined at runtime by what the query happened to
fetch, and not visible in any type** — will throw if you touch them. The type system says
`Order`. The runtime says "`Order`, but only the parts I felt like loading, and only until
this stack frame returns".

There is no version of this that is a performance problem. It is a method whose contract is
not expressible in its signature, and every strategy in this topic is a way of making the
signature true again.

## The proxy is not the only shape

Two things in this topic can throw `LazyInitializationException`, and they are implemented
by different classes with different messages.

**A singular association** — `@ManyToOne`, `@OneToOne` — gets a proxy, handled by
`AbstractLazyInitializer` as above.

**A collection** — `@OneToMany`, `@ManyToMany`, `@ElementCollection` — gets a *persistent
collection*, a Hibernate implementation of `Set`, `List` or `Map`, handled by
`AbstractPersistentCollection`. It is not a subclass of your entity and there is no
`LazyInitializer` involved; it has its own session reference and its own failure path.

**A lazy basic attribute** — `@Basic(fetch = LAZY)` on a big `String` or `byte[]` — gets
neither, and behaves differently again. That is
**[08 · Lazy basic attributes](08-lazy-basic-attributes.md)**.

Treating these as one thing is the first mistake, because the fix for one is not the fix for
another. The distinction runs through the rest of this topic.

## Gotchas

**★ The `id` is free to read, unless someone turned on JPA proxy compliance.** The 7.4
source guards identifier access with `isInitializeProxyWhenAccessingIdentifier()`, which is
true when `hibernate.jpa.proxy_compliance` is enabled. Under that setting Hibernate
initialises the proxy when you read its identifier — which the `JpaComplianceSettings`
javadoc describes as not recommended, because it costs unnecessary round trips. So the
"reading the id costs nothing" rule that everything above depends on is a *default*, not a
guarantee, and a compliance-mode application behaves differently.

**★ A proxy carries its session even after the transaction has committed.** Detachment and
commit are different events. With open-session-in-view on, the transaction ends and the
session stays open, so the proxy keeps working — see
**[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**. That single fact is
why most teams have never seen this exception in an environment they control.

**★ A proxy that never had a session throws immediately.** `AbstractLazyInitializer`'s
constructor calls `unsetSession()` when it is handed a `null` session. There is no state in
which a proxy is "waiting for a session to arrive".

**★ Associating one proxy with two open sessions is a different exception.** `setSession`
throws `HibernateException` with `"Illegally attempted to associate proxy [Entity#id] with
two open sessions"` — not a `LazyInitializationException`. If you are passing detached
entities between threads or caching them, this is the failure you get instead, and it is
telling you something about the caching, not about fetching.

**★ `initialized` and `target` mean the exception can never happen twice on the same
field.** Once the fetch has succeeded, `target` is populated and `session` is irrelevant. So
an object that worked in one request and fails in the next is not flaky — the two requests
initialised different amounts of the graph.

**★ The generated subclass is created per entity class, not per instance.** It is not a
per-object wrapper you can strip; it is the runtime type of that reference. Anything
persisting or caching that object — a serialiser, a `HttpSession`, a distributed cache —
is persisting an instance of a class your build never produced.

**★ `session` is declared `transient`.** Serialise a proxy — into an HTTP session, into a
cache, into a message — and the session reference is deliberately not carried across. What
comes back on the other side cannot fetch anything, whatever the original could do.

**★ "It is not null, so the data is there" is never a valid inference.** A non-null lazy
field tells you Hibernate put a shell in it. Whether the shell can answer is a question
about the session, not about the field.

## Interview questions

**★ What is physically in a lazy `@ManyToOne` field before you touch it?**
An instance of a class Hibernate generated at runtime that extends the target entity and
implements `org.hibernate.proxy.HibernateProxy`. Behind it is a `LazyInitializer` holding
the entity name, the identifier — which Hibernate already had, because it read the foreign
key with the owning row — an `initialized` flag, a `target` slot for the real object once it
arrives, and a reference to the session that created it. Everything the proxy can do without
a query is done from the identifier; everything else goes through the session reference.

**★ What exactly happens at the moment an entity is detached?**
`unsetSession()` runs on each proxy, and its second statement is `session = null`. The
object's class, fields and identifier are untouched — only the reference to the session is
cleared. That is why detachment is invisible to inspection: nothing about the object looks
different afterwards, but every method that would have triggered a fetch now takes the
`session == null` branch of `initialize()` and throws.

**★ Why is `LazyInitializationException` unchecked, and does it matter?**
It extends `HibernateException` and therefore `RuntimeException`, so no signature declares
it and the compiler cannot warn about it. It matters a great deal, because the failure it
represents is a broken method contract: a method that returns a managed entity is promising
an object whose accessible fields depend on what the query happened to fetch and on how long
the session stays open, and none of that is expressible in the return type. A checked
exception would at least make the caller acknowledge the gap. As it is, the gap is invisible
until a runtime path touches the wrong field.

**★ Why can you read a proxy's identifier without a query, but not its name?**
Because the identifier is data the proxy holds and the name is data it does not. Hibernate
built the proxy out of a foreign-key value it had already read, so `id` is a field on the
`LazyInitializer`; anything else requires `immediateLoad(session)`. The Hibernate
documentation lists this as one of the two operations that do not fetch, the other being
using the proxy as the target of an association via `getReference`. With
`hibernate.jpa.proxy_compliance` enabled the identifier read initialises too, so the rule is
a default rather than a guarantee.

**★ Is a lazy field that is not `null` guaranteed to be usable?**
No, and the two questions are unrelated. A non-null lazy field means Hibernate installed a
stand-in — that happens whether or not the data can still be fetched. Whether it is usable
depends on whether the `LazyInitializer` still has an open, connected session, which is a
property of where you are in the request rather than of the object. The only way to ask the
real question without triggering a fetch is `Hibernate.isInitialized(…)`, covered in
**[Topic 07 · 14b · Inspecting initialization](../07-relationships-fetch/14b-inspecting-initialization.md)**.

**★ A colleague says "the entity is fine, we just need to keep the session open longer".
What is wrong with that framing?**
It treats the session's lifetime as the variable and the entity's contract as fixed, when it
is the other way round. Keeping the session open makes the exception stop happening in the
paths you extended it over — but the entity is still an object whose usable surface is
decided at runtime, and the next caller who is outside that window, or on a different thread,
or reading it out of a cache, gets the same failure. The lifetime is a workaround with a
scope; the contract is the thing that is wrong.

**★ Why do a lazy singular association and a lazy collection fail with different messages?**
Because they are different mechanisms. A singular association gets a generated subclass with
a `LazyInitializer` behind it, handled by `AbstractLazyInitializer`. A collection gets a
Hibernate implementation of `Set`, `List` or `Map` — a *persistent collection*, not a
subclass of anything of yours — handled by `AbstractPersistentCollection`, which has its own
session reference and builds its own message including the mapped role and the owner's key.
Knowing which class produced the message tells you which of the two you are looking at
before you have read anything else.

**★ What does it mean that the `session` field is `transient`?**
That serialising a proxy deliberately drops the ability to fetch. A proxy written into an
HTTP session, a distributed cache or a message and read back is an object with an
identifier, no data, and no way to get any. It is the strongest argument in the topic against
putting entities anywhere that outlives a request: the mechanism does not merely happen to
break, it is designed not to travel.

<!--FOOTER-->
