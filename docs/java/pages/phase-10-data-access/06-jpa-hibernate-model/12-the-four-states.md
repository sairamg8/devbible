---
title: "An entity instance is always in exactly one of four states relative to a persistence context — and Hibernate has to guess which one, using heuristics you can accidentally defeat"
sidebar_label: "12 · The four entity states"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6 *Persistence Context*
> and §6.12 *Working with detached data*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §5.1 *Persistence contexts* and §5.12 *Transient
> vs detached*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification §3.3 *Controlling Transactions and the
> Entity Lifecycle* and §3.3.7 *Detached Entities*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**"Is this object managed?" is the question that determines whether a setter call writes
to the database or does nothing at all. There are four answers, and the state is not a
property of the object — it is a property of the *relationship* between the object and a
particular persistence context. The same instance can be managed in one context and
detached from another, and the surprises in this topic almost all come from getting the
state wrong.**

## The four states, in the User Guide's words

Hibernate ORM 7.4 User Guide §6 defines them:

> **transient** — the entity has just been instantiated and is not associated with a
> persistence context. It has no persistent representation in the database and typically
> no identifier value has been assigned (unless the assigned generator was used).
>
> **managed or persistent** — the entity has an associated identifier and is associated
> with a persistence context. It may or may not physically exist in the database yet.
>
> **detached** — the entity has an associated identifier but is no longer associated with
> a persistence context (usually because the persistence context was closed or the
> instance was evicted from the context)
>
> **removed** — the entity has an associated identifier and is associated with a
> persistence context, however, it is scheduled for removal from the database.

Two clauses in there repay attention.

"It may or may not physically exist in the database yet" — a managed entity is not
necessarily a row. Under `SEQUENCE` generation, `persist` makes the entity managed and
gives it an id while the INSERT is still queued.

"Usually because the persistence context was closed" — detachment is normally something
that *happens to* your object at the transaction boundary, not something you do.

## The transitions

```
                    new Customer()
                          │
                     [ TRANSIENT ]
                          │  persist()
                          ▼
   clear()/detach()  ┌─────────────┐   remove()
   ◄──────────────── │   MANAGED   │ ─────────────►  [ REMOVED ]
   context closed    └─────────────┘                       │
        │                   ▲                              │ persist()
        ▼                   │  merge() returns a           │ (back to managed)
   [ DETACHED ] ────────────┘  DIFFERENT managed instance  ▼
                                                      row deleted at flush
```

Four things about that diagram matter more than the arrows.

**`merge` does not move your object.** The detached instance stays detached forever;
`merge` returns a *different* instance that is managed. This is the single most
misunderstood operation in JPA and it gets its own chunk —
[13b · merge returns a copy](13b-merge-returns-a-copy.md).

**`remove` does not make the object transient immediately.** The entity stays managed and
scheduled for deletion until flush. The spec adds a detail people miss: "After an entity
has been removed, its state (except for generated state) will be that of the entity at
the point at which the remove operation was called."

**`persist` on a removed entity un-removes it.** The spec §3.3.2: "If X is a removed
entity, it becomes managed." That is a documented undo.

**Nothing transitions on commit except managed → detached.** Commit flushes and then the
context closes, detaching everything it held.

## Which operations are legal in which state

This table is the practical form of specification §3.3, and it is worth internalising
because the exceptions are the bugs.

| | transient | managed | detached | removed |
|---|---|---|---|---|
| `persist` | → managed | ignored (cascades) | `EntityExistsException` (may be deferred to flush) | → managed |
| `merge` | new managed copy | ignored (cascades) | copies state onto a managed instance | `IllegalArgumentException` |
| `remove` | ignored (cascades) | → removed | `IllegalArgumentException` | ignored |
| `refresh` | `IllegalArgumentException` | reloads, overwriting changes | `IllegalArgumentException` | — |
| `detach` | ignored | → detached | ignored | → detached |
| `contains` | `false` | `true` | `false` | `false` |

Two entries are worth quoting exactly. On `persist` of a detached instance, the spec: "the
`EntityExistsException` may be thrown when the persist operation is invoked, or the
`EntityExistsException` or another `PersistenceException` may be thrown at flush or commit
time." So the failure may arrive far from the call.

On `remove` of a detached instance, note a divergence between the two APIs. The User
Guide: "Hibernate itself can handle deleting entities in detached state. Jakarta
Persistence, however, disallows this behavior. The implication here is that the entity
instance passed to the `org.hibernate.Session` delete method can be either in managed or
detached state, while the entity instance passed to `remove` on
`jakarta.persistence.EntityManager` must be in the managed state."

## How an entity becomes detached — five ways

The spec §3.3.7 lists them, and it is a longer list than most people carry:

> A detached entity results from transaction commit if a transaction-scoped persistence
> context is used; from transaction rollback; from detaching the entity from the
> persistence context; from clearing the persistence context; from closing an entity
> manager; or from serializing an entity or otherwise passing an entity by value.

The last one catches people. Serialize an entity — to a cache, to a queue, across a remote
call — and what comes back is detached, while the original stays managed.

The User Guide adds the consequence: "Detached data can still be manipulated, however, the
persistence context will no longer automatically know about these modifications, and the
application will need to intervene to make the changes persistent again."

That is the whole reason `merge` exists.

## Transient versus detached is a *guess*

This is the part that explains a whole family of confusing bugs, and the Introduction is
refreshingly honest about it:

> Sometimes, Hibernate needs to be able to distinguish whether an entity instance is a
> brand-new transient object the client just instantiated using `new`, or a detached
> object, which previously belonged to a persistence context.
>
> This is a bit of a problem, since there's no good and efficient way for Hibernate to
> just tag an entity with a Post-it saying "I've seen you before".
>
> Therefore, Hibernate uses heuristics. The two most useful heuristics are:
>
> - If the entity has a **generated identifier**, the value of the id field is inspected:
>   if the value currently assigned to the id field is the default value for the type of
>   the field, then the object is transient; otherwise, the object is detached.
> - If the entity has a **version**, the value of the version field is inspected: if the
>   value currently assigned to the version field is the default value, or a negative
>   number, then the object is transient; otherwise, the object is detached.
>
> If the entity has neither a generated id, nor a version, Hibernate usually falls back
> to just doing something reasonable. In extreme cases a SELECT query will be issued to
> determine whether a matching row exists in the database.

And the warning that follows:

> These heuristics aren't perfect. It's quite easy to confuse Hibernate by assigning a
> value to the id field or version field, making a new transient instance look like it's
> detached. **We therefore strongly discourage assigning values to fields annotated
> `@GeneratedValue` or `@Version` before passing an entity to Hibernate.**

This is why [6 · The identifier](06-the-identifier.md) argues for `Long` over `long`: with
`long` the default is `0`, which is also a plausible identifier, so the first heuristic is
ambiguous by construction. With `Long` the default is `null`, which no persisted row can
have.

For the cases where the heuristic genuinely cannot cope, the escape hatch is named:
"you may implement your own Post-it tagging via `Interceptor.isTransient()`."

## Gotchas

**Detached is the default state of anything returned from a `@Transactional` method.**
The context closed when the method returned. The object your controller holds is
detached, and calling a setter on it does nothing at all. This is the most common "my
update did not save" report.

**A managed entity is not necessarily a row yet.**
Under `SEQUENCE` generation `persist` assigns an id and returns; the INSERT happens at
flush. Code that reads the entity back with a native SQL query before flush finds
nothing. (Under `IDENTITY` the row does exist immediately — see
[7 · IDENTITY](07-generatedvalue-identity.md) — which is a difference between strategies
that is easy to mistake for a general rule.)

**Setting the id on a `new` entity makes it look detached.**
`merge` on it then triggers a SELECT for a row that does not exist, or an INSERT you did
not intend. This is the heuristic being defeated, and the fix is to not expose a setter
for a generated id.

**`long id` makes the transient/detached heuristic ambiguous.**
`0` is both "unset" and a legal identifier. Use `Long`.

**Rollback detaches everything, and the objects keep their assigned ids.**
So a rolled-back `persist` leaves you holding an object with an id for a row that never
existed. Reusing it — or trusting its id — after a failed transaction is a real bug.

**`contains()` answers a question about the context, never about the database.**
The spec §3.3.8 is precise: it returns `true` for an entity retrieved from the database or
returned by `getReference` and not since removed or detached, and for a new entity that
`persist` has been called on — and `false` once `remove` has been called, even though the
row still exists until flush. It also notes that cascaded `persist`/`merge`/`remove`/
`detach` are "immediately visible to the `contains` method, whereas the actual insertion,
modification, or deletion of the database representation for the entity may be deferred
until the end of the transaction." So `contains` tracks intent, not rows.

**A serialized-and-deserialized entity is detached, but the original is not.**
Both objects now exist and only one of them is managed. Writing through the wrong one is
silent.

**Two contexts, two states, one object graph.**
An object can be detached from the context that loaded it and never associated with the
one you are in now. `contains` is `false` in both. The state genuinely is a relationship,
not a flag on the object.

## Interview questions

**★ Name the four entity states and what distinguishes them.**
Transient: never associated with a persistence context, no row, typically no identifier.
Managed: associated with a context, has an identifier, and may or may not physically exist
in the database yet — under sequence generation `persist` makes an entity managed while
its INSERT is still queued. Detached: has an identifier and previously belonged to a
context, but does not now, so changes to it are not tracked. Removed: still associated
with a context and still has an identifier, but is scheduled for deletion at flush.

**★ Why is the state a property of the relationship rather than of the object?**
Because "managed" means "present in *this* persistence context's identity map". The same
instance is detached from every other context, and after a commit it is detached from the
one that created it, without the object changing at all. That is also why an instance may
be associated with at most one persistence context at a time.

**★ How does Hibernate tell a transient entity from a detached one, and why is that hard?**
It guesses, because there is no marker on the object. If the entity has a generated
identifier, it checks whether the id holds the default value for its type — `null` for a
wrapper, `0` for a primitive — and treats that as transient. If it has a `@Version`, it
checks whether the version is the default or negative. With neither, it falls back to
reasonable behaviour, and in extreme cases issues a SELECT to see whether a matching row
exists. The heuristics are defeatable: assigning a value to a generated id or a version
field on a new object makes it look detached, which is why Hibernate strongly discourages
doing so.

**★ What happens to entities when a transaction commits?**
They are flushed, then detached — the transaction-scoped persistence context closes and
everything it held stops being tracked. The objects are still perfectly usable as data;
they just no longer have a channel back to the database. Any lazy association not yet
initialised will now throw when touched.

**★ What are all the ways an entity becomes detached?**
Transaction commit with a transaction-scoped context; transaction rollback; an explicit
`detach()`; `clear()`ing the context; closing the `EntityManager`; and serializing the
entity or otherwise passing it by value. The serialization case is the one people forget,
and it is asymmetric — the deserialized copy is detached while the original stays managed,
so you end up with two objects for one row and only one of them writes.

**★ What does `remove` do to an entity that is not managed?**
For a transient entity, nothing — it is ignored, though the operation still cascades. For
a removed entity, nothing. For a *detached* entity, JPA specifies `IllegalArgumentException`.
Hibernate's native `Session` API is more permissive here and will delete a detached
instance, so code written against `Session` can behave differently from the same code
written against `EntityManager`.

**★ You call `persist` on a detached entity. What happens?**
Per the specification, `EntityExistsException` — but with an important caveat: it "may be
thrown when the persist operation is invoked, or the `EntityExistsException` or another
`PersistenceException` may be thrown at flush or commit time." So the failure can surface a
long way from the call that caused it, which makes it worth being deliberate about whether
an object is new. If you have a detached instance whose changes you want persisted, the
operation you want is `merge`.

---

← Prev: [11b · The find that issues no SQL](11b-find-that-issues-no-sql.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [13 · persist, find, getReference](13-persist-find-getreference.md)
