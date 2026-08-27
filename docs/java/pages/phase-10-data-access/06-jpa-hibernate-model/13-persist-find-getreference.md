---
title: "persist and remove schedule work; find and refresh go to the database now; getReference goes nowhere at all — knowing which is which explains most of the API"
sidebar_label: "13 · persist, find, getReference"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.4 *Operations on the
> persistence context*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §6.3–§6.8
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification §3.2 *EntityManager Interface* and §3.3.2
> *Persisting an Entity Instance*, plus the `EntityManager` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The `EntityManager` API looks like a grab-bag of a dozen methods. It is not — it splits
cleanly into two halves, and the Hibernate Introduction presents it that way in two
tables. Half the methods *schedule* something and touch the database only at flush; the
other half go to the database immediately. `getReference` is the one exception in the
second half, which is exactly why it is useful. Learn the split and the API stops
needing memorisation.**

## The split

**Methods that modify data or manage the context** — these schedule:

| Method | Effect (the Introduction's own wording) |
|---|---|
| `persist(Object)` | "Make a transient object persistent and schedule a SQL insert statement for later execution" |
| `remove(Object)` | "Make a persistent object transient and schedule a SQL delete statement for later execution" |
| `merge(Object)` | "Copy the state of a given detached object to a corresponding managed persistent instance and return the persistent object" |
| `detach(Object)` | "Disassociate a persistent object from a session without affecting the database" |
| `clear()` | "Empty the persistence context and detach all its entities" |
| `flush()` | "Detect changes … and synchronize the database state with the state of the session" |

**Methods that read or lock** — these go to the database now:

| Method | Effect |
|---|---|
| `find(Class, Object)` | Obtain a persistent object given its type and id |
| `find(Class, Object, LockModeType)` | …requesting a lock mode |
| `find(EntityGraph, Object)` | …with an `EntityGraph` specifying what to fetch eagerly |
| `getReference(Class, id)` | Obtain a reference "without actually loading its state from the database" |
| `getReference(Object)` | The same, from a detached instance |
| `refresh(Object)` | Reload persistent state "using a new SQL select" |
| `lock(Object, LockModeType)` | Obtain an optimistic or pessimistic lock |

The Introduction draws the line explicitly: "**except for `getReference()`**, the
following operations all result in immediate access to the database."

And it names two absences that people look for:

> Notice that `persist()` and `remove()` have no immediate effect on the database, and
> instead simply schedule a command for later execution. Also notice that **there's no
> `update()` operation for a stateful session.** Modifications are automatically detected
> when the session is flushed.

The missing `update()` is [14 · Dirty checking](14-dirty-checking.md).

## `persist`

```java
Customer c = new Customer("ada@example.com");
entityManager.persist(c);
// c is now MANAGED. Its id is set. No row exists yet (under SEQUENCE).
```

The spec §3.3.2 gives the semantics per state, and three of the four cases are things
people get wrong:

> If X is a new entity, it becomes managed. The entity X will be entered into the
> database at or before transaction commit or as a result of the flush operation.
>
> If X is a preexisting managed entity, it is **ignored** by the persist operation.
> However, the persist operation is cascaded to entities referenced by X […]
>
> If X is a removed entity, it becomes managed.
>
> If X is a detached object, the `EntityExistsException` may be thrown when the persist
> operation is invoked, or the `EntityExistsException` or another `PersistenceException`
> may be thrown at flush or commit time.

The User Guide adds when the id appears: "Instances of entity types using generated
identifiers will be automatically associated with an identifier value when the save or
persist operation is called. If an entity type does not rely on a generated id, then an
identifier value (usually natural) must be manually assigned to the entity instance
before the save or persist operations can be called."

⚠️ **`persist` needs a transaction.** The spec §3.2: "The `persist`, `merge`, `remove`,
and `refresh` methods must be invoked within a transaction context when an entity manager
with a transaction-scoped persistence context is used. If there is no transaction
context, the `jakarta.persistence.TransactionRequiredException` is thrown."

## `find`

```java
Customer c = entityManager.find(Customer.class, 42L);   // null if no such row
```

Three properties worth stating separately.

**It consults the identity map first**, so it may issue no SQL —
[11b · The find that issues no SQL](11b-find-that-issues-no-sql.md).

**It returns `null` for a missing row**, it does not throw. The User Guide: "In both cases
null is returned if no matching database row was found."

**It does not need a transaction.** The spec §3.2: "The `find` method (provided it is
invoked without a lock or invoked with `LockModeType.NONE`) and the `getReference` method
are not required to be invoked within a transaction. If an entity manager with
transaction-scoped persistence context is in use, the resulting entities will be
detached." That last clause is the trap — calling `find` outside a transaction gives you a
detached object, and setters on it do nothing.

Jakarta Persistence 3.2 also adds an options-based form:

```java
var book = entityManager.find(Book.class, isbn, Timeout.ms(100), CacheStoreMode.BYPASS);
```

`Timeout` is "a `FindOption`, a `RefreshOption`, and a `LockOption`", so the same value
works across the three.

## `getReference`

```java
Book book = new Book();
book.setAuthor(entityManager.getReference(Person.class, personId));
```

That is the User Guide's own example and it is the canonical use: "The most common case
being the need to create an association between an entity and another existing entity."
You need the foreign key, which you already have.

What comes back is a **proxy** — a generated subclass of the entity that holds only the
identifier and loads the rest on first access to any other state. The User Guide notes
the fallback: "Unless the entity class is declared final, the proxy extends the entity
class. If the entity class is final, the proxy will implement an interface instead" — the
`final` consequence from [1b · The rules the spec
imposes](01b-the-rules-the-spec-imposes.md).

Three properties of the proxy that all bite eventually:

**It does not verify the row exists.** The javadoc: "If the requested instance does not
exist in the database, the `EntityNotFoundException` is thrown when the instance state is
first accessed. (The persistence provider runtime is permitted but not required to throw
the `EntityNotFoundException` when `getReference()` is called.)"

**Calling `getId()` on it does not initialise it.** The id is the one thing the proxy
already knows. Every other getter triggers the load.

**Its state may not be available after detachment.** The javadoc again: "The application
should not expect the instance state to be available upon detachment, unless it was
accessed by the application while the entity manager was open." An uninitialised proxy
returned from a `@Transactional` method throws when the caller touches it — that is
[Topic 10 · Lazy-loading pitfalls](../10-lazy-loading/README.md).

Jakarta Persistence 3.2 added an overload taking an entity: `getReference(T entity)`
returns "a reference to an instance of the entity class of the given object, with the
same primary key as the given object". The given object "may be persistent or detached,
but may be neither new nor removed" — a convenient way to re-associate by identity
without loading.

## One exception that voids the whole context

Worth knowing before the individual operations, because it changes what you do when any
of them fails. The Introduction:

> Any of these operations might throw an exception. Now, if an exception occurs while
> interacting with the database, there's no good way to resynchronize the state of the
> current persistence context with the state held in database tables.
>
> Therefore, a session is considered to be unusable after any of its methods throws an
> exception.
>
> The persistence context is fragile. If you receive an exception from Hibernate, you
> should immediately close and discard the current session.

In Spring this is handled for you — the transaction rolls back and the context is
discarded — which is why catching a `PersistenceException` inside a `@Transactional`
method and carrying on is a mistake. That interaction is
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)'s territory,
particularly the rollback-only trap.

## Gotchas

**`persist` on an already-managed entity is silently ignored.**
Not an error, not a no-op you can detect. Calling it "just in case" in a service method
does nothing except cascade, which may itself do something you did not intend.

**`find` outside a transaction returns a detached entity.**
The call succeeds and the object looks normal. Setters on it do nothing, and lazy
associations throw. A repository method called with no `@Transactional` on the caller is
exactly this situation.

**`find` returns `null`; Spring Data's `findById` returns `Optional`.**
Different contracts on top of the same call. Neither throws for a missing row —
`getReferenceById` is the one that gives you a proxy and defers the failure.

**`getReference` for an id that came from a user is a deferred failure.**
The exception arrives at first access, or as a foreign-key violation at flush, or never.
Use `find` and check for `null` when the id is not already trusted.

**`getReference` is useless if you then read the entity.**
The proxy loads on first access, so `getReference(...).getName()` is a `find` with extra
steps and a worse failure mode.

**A `TransactionRequiredException` from `persist` usually means a missing or ineffective
`@Transactional`.**
Ineffective is the interesting case: a self-invocation, a non-public method, or a call
that never went through the proxy. All three are covered in
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md).

**An entity with an assigned (non-generated) id must have it set before `persist`.**
The User Guide says so directly. Persisting a natural-key entity with a null id fails at
flush rather than at the call.

## Interview questions

**★ Which `EntityManager` operations hit the database immediately, and which do not?**
`find`, `refresh` and `lock` go to the database immediately — `find` unless the entity is
already in the identity map. `getReference` never goes to the database at the point of
call; it returns a proxy that loads on first access to non-identifier state. Everything
that modifies data — `persist`, `remove`, and dirty-checked updates — schedules work that
is executed at flush. `merge` is the odd one: it schedules the write, but it usually reads
first in order to have a managed instance to copy onto.

**★ Why is there no `update()` method?**
Because updates are not something you request. Any modification to a managed entity is
detected by comparing it against the snapshot the persistence context holds, and turned
into an UPDATE at flush. Hibernate's documentation makes the absence explicit: "there's
no `update()` operation for a stateful session. Modifications are automatically detected
when the session is flushed."

**★ What does `persist` do to an entity that is already managed?**
Nothing to that entity — the spec says it is ignored. But the operation still cascades to
associated entities mapped `cascade = PERSIST` or `ALL`, so it is not a complete no-op.
On a *removed* entity, `persist` is a documented undo: the entity becomes managed again.
On a *detached* entity it is an error, though the exception may be thrown at the call or
deferred to flush or commit.

**★ When would you use `getReference` instead of `find`?**
When you need the entity only as a target of an association — setting `order.setCustomer(...)`
where you already have the customer's id. `getReference` gives you an object carrying that
identity with no SELECT, so the foreign key can be written without loading a row you will
never read. If you are going to read any of the entity's state, `getReference` is strictly
worse than `find`: it loads anyway, later, with a worse failure mode for a missing row.

**★ `find` returns `null` for a missing row. What does `getReference` do?**
It returns a proxy regardless, and throws `EntityNotFoundException` when the state is
first accessed — the provider is permitted, but not required, to throw at the call itself.
So a bad id becomes a failure at an unpredictable point, or a foreign-key violation at
flush if you only ever stored the reference. That is why `getReference` belongs on ids you
already trust.

**★ Do `find` and `persist` both need a transaction?**
`persist` does — along with `merge`, `remove` and `refresh` — and throws
`TransactionRequiredException` without one when a transaction-scoped context is in use.
`find` does not, provided no lock mode above `NONE` is requested, and neither does
`getReference`. But calling `find` outside a transaction has a consequence worth stating:
the entity you get back is detached, so nothing you do to it is tracked.

**★ What should you do when an `EntityManager` operation throws?**
Discard the persistence context. Hibernate's documentation is unambiguous: after any
exception there is no reliable way to resynchronise the context with the database, so the
session must be considered unusable. In Spring this is what happens automatically — the
transaction is marked rollback-only and the context is thrown away — which is why catching
a persistence exception inside a transactional method and continuing to use the same
`EntityManager` produces confusing downstream failures rather than recovery.

---

← Prev: [12 · The four entity states](12-the-four-states.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [13b · merge returns a copy](13b-merge-returns-a-copy.md)
