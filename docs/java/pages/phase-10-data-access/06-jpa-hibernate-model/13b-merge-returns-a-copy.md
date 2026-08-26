---
title: "merge does not attach your object — it returns a different one, and every bug people have with merge is a consequence of ignoring the return value"
sidebar_label: "13b · merge returns a copy"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §3.3.7.1 *Merging
> Detached Entity State*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *Introduction* §5.9 *Controlling state retrieval during merge*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Hibernate ORM 7.4 *User Guide* §6.12.1 *Merging detached data*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**`merge` is the most misunderstood method in JPA, and the misunderstanding is always the
same one: people believe it re-attaches the object they passed in. It does not. The
detached object stays detached forever. What `merge` returns is a *different* instance,
managed by the current context, holding a copy of your state. Ignore the return value and
your changes go nowhere — silently, with no exception, in code that reads perfectly
naturally.**

## The bug, in four lines

```java
@Transactional
public void save(Customer detached) {
    detached.setEmail("new@example.com");
    entityManager.merge(detached);          // ← return value discarded
    // ... more work on `detached`
    detached.setName("Ada");                // ← this change is LOST
}
```

The email is saved. The name is not.

`merge` copied the state as it stood at the call onto a managed instance. Everything you
do to `detached` afterwards happens to an object nobody is watching. There is no
exception, no log line, and the method looks correct.

```java
@Transactional
public Customer save(Customer detached) {
    Customer managed = entityManager.merge(detached);   // ← keep it
    managed.setName("Ada");                             // ← this is tracked
    return managed;
}
```

## What the spec actually says

Jakarta Persistence 3.2 §3.3.7.1:

> If X is a detached entity, the state of X is copied onto a **pre-existing managed
> entity instance X' of the same identity or a new managed copy X' of X is created**.
>
> If X is a new entity instance, a new managed entity instance X' is created and the
> state of X is copied into the new managed entity instance X'.
>
> If X is a removed entity instance, an `IllegalArgumentException` will be thrown by the
> merge operation (or the transaction commit will fail).
>
> If X is a managed entity, it is ignored by the merge operation, however, the merge
> operation is cascaded to entities referenced by relationships from X […]

The notation is doing real work: **X and X' are different objects.** The Hibernate
Introduction spells out what that means for your code:

> the original entity instance `e` remains detached, but `merge()` returns a **distinct
> instance `f`** representing the same row of the database and associated with the new
> persistence context. That is, `merge()` trades a detached instance for a persistent
> instance representing the same row.

The one case where the returned object *is* the one you passed is when the argument was
already managed — the spec's fourth bullet — which is why the mistake survives testing:
inside one transaction, `merge` looks like it attaches.

## Why it is a copy, and why that is right

The persistence context guarantees one instance per row —
[11 · The persistence context](11-the-persistence-context.md). Suppose row 42 is already
managed and you hand `merge` a detached instance of row 42. Adopting your object would put
two objects for one row in the identity map, breaking the guarantee that everything else
depends on.

So `merge` finds the existing managed instance and copies your state onto it. If none
exists, it loads one — or creates one — and copies onto that. Either way there is exactly
one managed instance for row 42 at the end, which is the invariant preserved.

The User Guide offers a mental model:

```java
public Person merge(Person detached) {
    Person newReference = session.byId(Person.class).load(detached.getId());
    newReference.setName(detached.getName());
    return newReference;
}
```

"Although not exactly per se, the following example is a good visualization of the merge
operation internals." The important part is `load` — **merge usually reads before it
writes.**

## Merge issues a SELECT you did not ask for

The Introduction is explicit about why:

> To determine the nature of the modification held in `e` and to guarantee correct
> semantics with respect to optimistic locking, Hibernate first selects the current
> persistent state of the entity from the database before applying the modification to
> `f`.

So a "save" is a SELECT plus an UPDATE. On a single entity that is one extra query. On a
graph with `cascade = MERGE` it is more — though less than you might fear:

> When `merge()` is used with cascading […] Hibernate issues a single select statement to
> retrieve the current database state of the root entity and all its associated entities.
> This behavior avoids the use of N+1 select statements for state retrieval during cascade
> merge but, in certain circumstances, the query might be suboptimal. On the other hand,
> **this query does not occur if the root entity was already loaded into the persistence
> context before `merge()` is called.**

That last sentence is the tuning lever, and Jakarta Persistence 3.2 gives you control over
it:

```java
var graph = entityManager.createEntityGraph(Book.class);
graph.addSubgraph(Book_.chapters);          // Book.chapters is mapped cascade=MERGE
entityManager.find(graph, book.getIsbn());  // force loading of the book, your way
entityManager.merge(book);                  // no extra select
```

Hibernate's `Session` has a shorthand: `session.merge(book, graph)`, "equivalent to
`find()` then `merge()`". For several roots, `findMultiple()` replaces `find()`.

## When *not* to reach for merge

Two alternatives are usually better, and the Introduction names both.

**Load and modify, instead of building a detached object.** This is the shape most Spring
services should have:

```java
@Transactional
public void updateEmail(Long id, String email) {
    Customer c = entityManager.find(Customer.class, id);
    c.setEmail(email);          // dirty checking does the rest — no merge, no extra select
}
```

Nothing detached ever exists, so `merge` has nothing to do. This also gives you control
over *which* fields change, which a merge of a DTO-shaped entity does not — see the
gotchas.

**`upsert()` on a `StatelessSession`.** The Introduction: "In some cases, `merge()` is
much less efficient than the `upsert()` operation of `StatelessSession`." For bulk work
where you know the rows exist, that avoids the persistence context entirely.

## The entity-copy problem

A real failure mode with a real configuration switch. The User Guide §6.12.1:

> Hibernate throws `IllegalStateException` when merging a parent entity which has
> references to 2 detached child entities `child1` and `child2` (obtained from different
> sessions), and `child1` and `child2` represent the same persistent entity, `Child`.

The setting is `hibernate.event.merge.entity_copy_observer`, with values `disallow` (the
default — throws), `allow` (merges each copy), and `log` (allow plus DEBUG logging, "for
testing only"). The User Guide is blunt about `allow`:

> Because cascade order is undefined, the order in which the entity copies are merged is
> undefined. As a result, if property values in the entity copies are not consistent, the
> resulting entity state will be indeterminate, and data will be lost from all entity
> copies except for the last one merged. Therefore, the **last writer wins**.

It also names a data-loss risk in the same section — "There are known issues when
representations of the same persistent entity have different values for a collection […]
These issues can cause data loss or corruption" — and recommends optimistic locking to
detect the situation, which is [16 · `@Version` and optimistic
locking](16-version-and-optimistic-locking.md).

The default is `disallow` for good reason. Do not turn it off to make an error go away.

## Gotchas

**Ignoring the return value is the bug.**
It compiles, it runs, part of the work is saved and part is silently lost. Treat
`entityManager.merge(x);` as a statement without a return value as a code-review failure.

**`merge` of a detached entity with `null` fields overwrites those columns with `null`.**
Merge copies *all* the state, not the fields you changed. A partially-populated object
built from an HTTP request body — the classic "bind the DTO straight to the entity"
pattern — nulls every column the request omitted. This is by far the most damaging
practical consequence.

**`merge` on a `new` entity inserts.**
Per the spec, a new instance gets a new managed copy created. So `merge` can be an
accidental INSERT when the transient/detached heuristic from
[12 · The four states](12-the-four-states.md) guesses wrong — for example because
someone assigned an id to a brand-new object.

**Spring Data's `save()` is `persist` or `merge` depending on whether the entity looks
new.**
So `save()` on a detached entity is a merge, with all of the above, *including* the extra
SELECT and the null-overwrite behaviour. It also means `save()` may return a different
object than you passed, for exactly the reason on this page — and Spring Data's javadoc
warns to use the returned instance.

**`merge` on a removed entity throws.**
`IllegalArgumentException`, per the spec, "or the transaction commit will fail".

**`merge` does not merge unloaded lazy fields, which is the one thing that saves you.**
The spec: "The persistence provider must not merge fields marked LAZY that have not been
fetched: it must ignore such fields when merging." Without this, merging a detached entity
whose lazy collection was never initialised would wipe the collection.

**Optimistic locking is checked during merge.**
The spec: "Any Version columns used by the entity must be checked by the persistence
runtime implementation during the merge operation and/or at flush or commit time." A stale
detached object fails rather than overwriting. If the entity has no `@Version`, it does
not — "In the absence of Version columns there is no additional version checking done".

## Interview questions

**★ What does `merge` return, and why does it matter?**
A *different* instance from the one you passed: a managed instance representing the same
row, onto which your detached object's state has been copied. The object you passed in
stays detached forever. It matters because any modification you make to the original after
the merge is untracked and silently lost — no exception, no warning — while the same code
written against the returned instance works. The spec's own notation, X and X', is the
clue.

**★ Why does `merge` copy rather than attach the instance you gave it?**
Because the persistence context guarantees exactly one managed instance per row, and the
row you are merging may already be managed. Adopting your object would place a second
instance for the same row in the identity map and break that guarantee, along with dirty
checking and everything that depends on it. Copying onto the existing managed instance —
or onto a freshly loaded one — keeps the invariant.

**★ Why does `merge` issue a SELECT?**
Because it needs a managed instance to copy onto, and because it has to compare against
the current database state to apply optimistic-locking semantics correctly. Hibernate's
documentation says exactly this. The SELECT is avoidable in one situation: if the root
entity is already loaded into the persistence context before `merge` is called, no extra
query occurs — which is why loading with a deliberate `find` and entity graph before
merging a cascaded graph can be a real optimisation.

**★ What happens when you merge a detached entity whose fields are mostly null?**
Every one of those nulls is copied onto the managed instance and written to the database.
Merge copies all the state, not a diff, so the columns your object did not carry are set to
`null`. This is the classic damage done by binding an HTTP request body directly to an
entity and merging it: fields the client omitted are erased. The exception is unfetched
lazy fields, which the spec explicitly requires the provider to ignore.

**★ How does Spring Data's `save()` relate to `persist` and `merge`?**
`save()` inspects whether the entity looks new — typically by checking the identifier, and
by the `@Version` if present — and calls `persist` if so, `merge` if not. So `save()` on a
detached entity is a merge, and carries the extra SELECT and the overwrite-with-nulls
behaviour. It also returns a possibly-different instance, and its documentation tells you
to use the returned one.

**★ When would you avoid `merge` entirely?**
Whenever you can load the entity and modify it instead. A service method that takes an id
and the fields to change, calls `find`, and sets them is simpler, does not need the extra
SELECT, and changes only the fields you named — so it cannot null out columns by omission.
Merge earns its place when an object genuinely detached from another unit of work has to
be reconciled, which is a narrower case than the amount of `merge` in most codebases
suggests.

**★ What is the "entity copy" problem?**
Merging a parent that references two *different* detached objects representing the same
row — typically obtained from two different sessions. By default Hibernate throws
`IllegalStateException`, controlled by `hibernate.event.merge.entity_copy_observer`. The
alternative, `allow`, merges each copy in an undefined order, so the last write wins and
state from every other copy is lost; the documentation also warns of known data-loss and
corruption issues when the copies disagree about a collection. The default is the safe
one, and disabling it to silence the exception converts a loud failure into a quiet data
loss.

---

← Prev: [13 · persist, find, getReference](13-persist-find-getreference.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [13c · remove, refresh, detach, clear](13c-remove-refresh-detach-clear.md)
