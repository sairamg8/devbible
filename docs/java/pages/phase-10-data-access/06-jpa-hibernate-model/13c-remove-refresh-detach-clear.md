---
title: "remove, refresh, detach, clear, contains and lock — the operations you reach for when the default behaviour is not what you want, each with a documented sharp edge"
sidebar_label: "13c · remove, refresh, detach, clear"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §3.3.3 *Removal*,
> §3.3.5 *Refreshing an Entity Instance*, §3.3.6 *Evicting an Entity Instance* and
> §3.3.8 *Managed Instances*, plus the `EntityManager` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *User Guide* §6.4, §6.11, §6.13 and §6.14
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *Introduction* §5.4
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**These six are the operations you use when the persistence context's default behaviour is
wrong for what you are doing. That framing is worth keeping, because the Hibernate
Introduction says something unusually candid about them: "When you call `detach()`,
`clear()`, `flush()`, or `refresh()`, you've already strayed from the narrow path." Not
forbidden — but each one is you overriding a default, and each has a documented edge.**

## `remove` — schedules a DELETE, and does not free the object

```java
Customer c = entityManager.find(Customer.class, 42L);
entityManager.remove(c);        // c is now REMOVED, still managed, row still there
```

The spec §3.3.3 per state:

> If X is a new entity, it is **ignored** by the remove operation. However, the remove
> operation is cascaded […]
>
> If X is a managed entity, the remove operation causes it to become removed.
>
> If X is a detached entity, an `IllegalArgumentException` will be thrown by the remove
> operation (or the transaction commit will fail).
>
> If X is a removed entity, it is ignored.

And afterwards: "A removed entity X will be removed from the database at or before
transaction commit or as a result of the flush operation. After an entity has been removed,
its state (except for generated state) will be that of the entity at the point at which
the remove operation was called."

⚠️ **Hibernate's native API is more permissive than JPA here.** The User Guide: "Hibernate
itself can handle deleting entities in detached state. Jakarta Persistence, however,
disallows this behavior. The implication here is that the entity instance passed to the
`org.hibernate.Session` delete method can be either in managed or detached state, while
the entity instance passed to `remove` on `jakarta.persistence.EntityManager` must be in
the managed state." So the same logic behaves differently depending on which API the code
is written against.

To delete without loading, use `getReference` — but only when you are sure the row exists
and no lifecycle callbacks or cascades need the loaded state.

## `refresh` — reloads, and throws your changes away

```java
entityManager.refresh(customer);
```

The spec §3.3.5 is one sentence and every clause matters:

> If X is a managed entity, the state of X is refreshed from the database, **overwriting
> changes made to the entity, if any**. The refresh operation is cascaded to entities
> referenced by X if the relationship […] is annotated with the `cascade=REFRESH` or
> `cascade=ALL` annotation element value.
>
> If X is a new, detached, or removed entity, the `IllegalArgumentException` is thrown.

Two legitimate uses, from the User Guide: "when it is known that the database state has
changed since the data was read", and "when database triggers are used to initialize some
of the properties of the entity."

🔴 **Hibernate 7 changed this.** "Traditionally, Hibernate allowed detached entities to be
refreshed. However, Jakarta Persistence prohibits this practice and specifies that an
`IllegalArgumentException` should be thrown instead. This is the default behaviour from
version 7.0 onwards." Code carried over from Hibernate 5 breaks on upgrade.

⚠️ **Cascading `refresh` to a transient child throws.** The User Guide §6.11.1's own
example adds a new `Book` to a managed `Person`, then refreshes the person; because the
book is still transient, "Hibernate will not be able to locate the `Book` entity in the
database" and an `EntityNotFoundException` is thrown. Its comment: "Beware when cascading
the refresh associations to transient entities!"

## `detach` and `clear` — evicting from the context

```java
entityManager.detach(customer);   // one entity out
entityManager.clear();            // everything out
```

The spec §3.3.6: "Changes made to the entity, if any (including removal of the entity),
**will not be synchronized to the database** after such eviction has taken place." And a
portability requirement people skip:

> Applications must use the flush method prior to the detach method to ensure portable
> semantics if changes have been made to the entity […] Because the persistence provider
> may write to the database at times other than the explicit invocation of the flush
> method, portable applications must not assume that changes have not been written to the
> database if the flush method has not been called prior to detach.

Read that twice. `detach` is **not** an undo. Whether your changes were already written is
unspecified.

The main legitimate use is memory. The User Guide §6.14: "if you do not want this
synchronization to occur, or if you are processing a huge number of objects and need to
manage memory efficiently, the `evict()` method can be used to remove the object and its
collections from the first-level cache."

```java
for (Person person : entityManager.createQuery("select p from Person p", Person.class)
                                  .getResultList()) {
    dtos.add(toDTO(person));
    entityManager.detach(person);      // release as we go
}
```

That is the User Guide's own example. Note what it does not fix: the query already loaded
every row into memory. For a genuinely large scan you want a projection, a scroll, or a
`StatelessSession`.

## `contains` — a question about the context, not the database

The spec §3.3.8 is unusually precise, and the answers are not the intuitive ones:

> The `contains` method returns **true**: if the entity has been retrieved from the
> database or has been returned by `getReference`, and has not been removed or detached;
> if the entity instance is new, and the `persist` method has been called on the entity or
> the persist operation has been cascaded to it.
>
> The `contains` method returns **false**: if the instance is detached; if the `remove`
> method has been called on the entity, or the remove operation has been cascaded to it;
> if the instance is new, and the `persist` method has not been called […]

So a removed entity is `false` even though its row still exists. And:

> the effect of the cascading of persist, merge, remove, or detach is **immediately
> visible** to the contains method, whereas the actual insertion, modification, or
> deletion of the database representation for the entity may be deferred until the end of
> the transaction.

`contains` tracks *intent*, not rows. Never use it to ask whether something exists.

For the related question "has this lazy thing been loaded?", the tool is different —
`PersistenceUnitUtil.isLoaded(...)`, or Hibernate's `Hibernate.isInitialized(...)` and
`Hibernate.isPropertyInitialized(...)`. The User Guide recommends the JPA
`PersistenceUtil` form "wherever possible".

## `lock` — asking for a lock on something already managed

```java
entityManager.lock(customer, LockModeType.PESSIMISTIC_WRITE);
```

`lock` acquires an optimistic or pessimistic lock on an already-managed entity. It requires
a transaction — the spec §3.2: "Methods that specify a lock mode other than
`LockModeType.NONE` must be invoked within a transaction. If there is no transaction or if
the entity manager has not been joined to the transaction, the
`jakarta.persistence.TransactionRequiredException` is thrown."

Jakarta Persistence 3.2 also gives `find`, `refresh` and `lock` an options form, so the
same `Timeout` value can be passed to any of them:

```java
entityManager.find(Book.class, isbn, Timeout.ms(100), CacheStoreMode.BYPASS);
```

The optimistic side of locking is **16 · `@Version` and optimistic
locking** *(not written yet)*; pessimistic locking is a transaction-level
concern and belongs with
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md).

## Gotchas

**`remove` does not free anything until flush.**
The entity stays managed and in the identity map until then, and it keeps its state. Code
that reads a removed entity's fields after `remove` gets the values as of the call, which
the spec guarantees.

**`remove` on a detached entity throws under JPA and works under `Session`.**
Same intent, different API, different outcome. A codebase that mixes the two APIs has an
inconsistency waiting to be discovered.

**`refresh` is not "reload to be safe".**
It is specified to overwrite unsaved changes. Calling it after modifying an entity throws
the modification away, silently.

**`refresh` on a detached entity now throws in Hibernate 7.**
An upgrade-time break, and it will surface in whatever code path was quietly relying on
the old permissiveness.

**`detach` is not a rollback.**
It stops *future* synchronisation. Whether your change was already written is unspecified
unless you flushed. To undo, roll the transaction back.

**Detaching inside an iteration does not undo the query's memory cost.**
`getResultList()` has already materialised every row. Detaching afterwards helps the
context, not the heap peak. Use a projection or a `StatelessSession` for a large scan.

**`clear()` orphans every reference you are holding.**
Everything becomes detached at once, including entities other parts of the method are
still using. In a long import loop that is exactly what you want after a `flush()`; in a
service method it is usually a mistake.

**`contains` on a removed entity is `false`, and on an unflushed persist is `true`.**
Both are counter-intuitive if you think of it as "is this in the database". It is not that
question.

**`lock` outside a transaction throws.**
As do `persist`, `merge`, `remove` and `refresh`. Only `find` without a lock, and
`getReference`, are exempt.

## Interview questions

**★ What does `remove` actually do, and when does the row disappear?**
It transitions a managed entity to the removed state and schedules a DELETE; the row is
deleted at flush or at commit, whichever comes first. Until then the entity remains
associated with the persistence context and keeps its state — the spec guarantees that
after removal the entity's state, apart from generated state, is what it was at the point
`remove` was called. `remove` on a new or already-removed entity is ignored, and on a
detached entity JPA specifies `IllegalArgumentException`.

**★ Why does Hibernate's `Session.remove` accept a detached entity when `EntityManager.remove` does not?**
Because JPA deliberately narrowed the contract. The User Guide states the divergence
directly: Hibernate can handle deleting detached entities, Jakarta Persistence disallows
it. It matters in practice because a codebase that unwraps to `Session` in some places and
uses `EntityManager` in others will behave differently for the same logical operation, and
the difference only appears once something is detached.

**★ What is the difference between `detach` and rolling back?**
`detach` stops the context from tracking the entity from that point on; it does not undo
anything already written. The spec is explicit that a portable application must not assume
changes have *not* reached the database just because `flush` was never called, since the
provider may flush at other times. A rollback undoes the transaction. If your intent is
"discard these changes", the operation is a rollback.

**★ When is `refresh` the right tool?**
When you know the database row has changed since you read it and you want the current
values, or when a trigger or database default has computed columns you now need to see.
Both are cases where overwriting your in-memory state is exactly what you want — which is
the point, because that is what `refresh` does. It is not a defensive "reload to be safe"
call; the spec says it overwrites changes made to the entity.

**★ What changed about `refresh` in Hibernate 7?**
Refreshing a detached entity throws `IllegalArgumentException`, aligning with the
specification. Hibernate historically allowed it, so this is an upgrade-time break for any
code that refreshed a detached instance — and such code was usually relying on the
permissiveness without knowing it.

**★ Does `contains` tell you whether a row exists?**
No. It tells you whether the object is currently a managed entity in this persistence
context. A removed entity returns `false` even though its row is still in the database
until flush; a persisted-but-unflushed new entity returns `true` even though no row exists
yet. The spec also notes that cascaded persist/merge/remove/detach are immediately visible
to `contains` while the corresponding database changes may be deferred to the end of the
transaction. It is a question about intent, not about data.

**★ How do you check whether a lazy association has been initialised?**
Not with `contains`. Use `PersistenceUnitUtil.isLoaded(entity)` or
`isLoaded(entity, "attributeName")`, or the static `PersistenceUtil` form that the User
Guide recommends where possible. Hibernate's equivalents are
`Hibernate.isInitialized(...)` and `Hibernate.isPropertyInitialized(...)`. This matters
mostly when deciding whether it is safe to touch an association on an entity that has
left its transaction.

**★ Why does the Hibernate documentation describe these operations as "straying from the narrow path"?**
Because each one exists to override a default that is usually correct. Dirty checking
means you should not need `flush`; the identity map means you should not need `refresh`;
transaction-scoped contexts mean you should not need `detach` or `clear`. Reaching for one
is a signal that the shape of the unit of work does not match what you are doing — and the
documentation's own follow-up is worth taking seriously: "If you start to feel that this
terrain is bogging you down, consider using a stateless session."

---

← Prev: [13b · merge returns a copy](13b-merge-returns-a-copy.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14 · Dirty checking](14-dirty-checking.md)
