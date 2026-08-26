---
title: "Every operation that makes an instance managed takes a snapshot, except the one that never reads the row — and the differences between them explain most of the surprises"
sidebar_label: "14b · When the snapshot is taken"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.2.2, §3.7.10
> *IDENTITY generation* and §7.1.1 *AUTO flush on commit*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.4 and §5.9
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> the Jakarta Persistence 3.2 specification §3.3.7.1 *Merging Detached Entity State* and
> the `EntityManager#getReference` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**A snapshot is taken when an instance becomes managed with state that came from a row.
That qualifier matters: `getReference` makes an instance managed *without* reading a row,
so it has nothing to snapshot until something forces the read. And `merge` snapshots the
instance it returns, never the one you handed it. Both facts produce bugs that look like
dirty checking not working.**

## The table

| Operation | Snapshot | Of what |
|---|---|---|
| `find` | at load | the values read from the row |
| a JPQL / HQL / criteria query returning entities | at load | the values read from the row |
| `refresh` | replaced | the values just re-read from the row |
| `persist` | at insert | the state written by the `INSERT` |
| `merge` | for the **returned** instance | the row's current state, with your changes applied |
| `getReference` | **none yet** | nothing, until the proxy initialises |
| `lock` on a detached instance | see below | — |

## `find` and queries — the ordinary case

The values are read out of the `ResultSet`, converted through whatever
`AttributeConverter`, `@Enumerated` or `JdbcType` the mapping specifies, used to build the
entity, and kept a second time as the loaded state. Both copies are of the *converted*
values, which is why a converter that is not stable — one whose `convertToDatabaseColumn`
is not a pure function — produces phantom updates. That is in
[14c · What counts as a change](14c-what-counts-as-a-change.md).

The snapshot is per persistence context, not per instance. Load row 42 in one
`EntityManager`, close it, load row 42 in another: two contexts, two instances, two
snapshots, and no relationship between them.

## `refresh` — the snapshot is replaced, and so is your work

`refresh` re-reads the row and overwrites both the entity's state and the snapshot with
what the database currently holds. The specification's wording is blunt about the first
half — it re-reads "overwriting changes made to the entity, if any". The second half is
the part people forget: because the snapshot is replaced too, the changes you had made
are not merely overwritten in the object, they become *undetectable*. There is nothing
left that differs from anything.

This is the correct behaviour and it is what `refresh` is for. It is only a trap when
`refresh` is used defensively — "reload it to be safe" — inside a method that had already
modified the entity. See [13c · `remove`, `refresh`, `detach`, `clear`](13c-remove-refresh-detach-clear.md).

## `persist` — an `INSERT`, and then possibly an `UPDATE`

A new instance has no row, so there is nothing to snapshot at the moment of the call; the
snapshot that matters is the one taken when the `INSERT` executes. Where the `INSERT`
executes depends entirely on the identifier generator, and the User Guide is explicit
about the split in §7.1.1:

> This is valid for the `SEQUENCE` and `TABLE` identifier generators. The `IDENTITY`
> generator must execute the insert right after calling `persist()`.

So the two shapes are genuinely different:

```java
// SEQUENCE: the INSERT is queued, not executed
Order order = new Order(customer);
entityManager.persist(order);
order.setNote("gift wrap");        // still before the INSERT runs
// → one INSERT at flush, carrying the note
```

```java
// IDENTITY: the INSERT ran at persist()
Order order = new Order(customer);
entityManager.persist(order);      // ← INSERT executes here
order.setNote("gift wrap");
// → the INSERT already happened without the note; an UPDATE follows at flush
```

That extra `UPDATE` is a real, observable cost of `IDENTITY` that sits alongside the
better-known one —
[7b · `IDENTITY` kills batching](07b-identity-kills-batching.md) — and it comes from the
same root cause: the row must physically exist before the identifier is known.

## `merge` — the snapshot belongs to the copy

[13b · merge returns a copy](13b-merge-returns-a-copy.md) argues this at length. In
snapshot terms: `merge` loads (or finds) the managed instance for that identifier, takes
its snapshot from the row, then copies your detached instance's state onto it. The
detached instance you passed in is *not* managed afterwards and has no snapshot anywhere,
so mutating it after the call does nothing.

```java
Order detached = readFromCache(id);
detached.setStatus(Status.SHIPPED);

Order managed = entityManager.merge(detached);   // managed != detached
detached.setNote("ignored");                     // no snapshot, no write
managed.setNote("written");                      // compared at flush, written
```

The *Introduction* also notes the optimisation that makes this cheap for graphs: a
cascading merge "uses one select, avoiding N+1", and "this query does not occur if the
root entity was already loaded" — because in that case the snapshot is already in the
context.

## `getReference` — managed, but with nothing to compare

`getReference` returns an uninitialised proxy and touches no database. The *Introduction*
draws the line explicitly: "except for `getReference()`, the following operations all
result in immediate access to the database." No read means no loaded state.

The snapshot appears at the instant the proxy initialises, which is the first call to any
accessor other than the identifier getter. That includes setters:

```java
Order order = entityManager.getReference(Order.class, 42L);
order.setStatus(Status.CANCELLED);
```

This is *not* a write without a read. Calling the setter initialises the proxy — a
`SELECT` runs, the row's values populate the instance, the snapshot is taken from them —
and only then does your assignment land on top. The comparison at flush then finds one
differing field and emits an `UPDATE`. The proxy deferred the read; it did not avoid it.

The cases where a proxy genuinely avoids a read are the ones where nothing is ever
touched: assigning it as the target of an association, or passing it to `remove` on a row
you already know exists. The `getReference` javadoc's warning applies to both — the
provider is "permitted but not required" to throw at call time, so an
`EntityNotFoundException` for a missing row may surface much later, "when the instance
state is first accessed".

## Re-snapshotting after a flush

The User Guide's phrase is "the last read **or write**". After a flush writes an entity,
its snapshot becomes the state that was just written. So:

```java
order.setStatus(Status.CANCELLED);
entityManager.flush();          // UPDATE … status = 'CANCELLED'
entityManager.flush();          // nothing — the object now matches its snapshot
order.setNote("late note");
entityManager.flush();          // UPDATE … the note
```

Three flushes, two statements. This is also why a batching loop that flushes and clears
periodically — the pattern the User Guide's batching chapter recommends — does not
re-write everything it has already written.

## Gotchas

**★ `merge`'s return value is the only managed instance, and ignoring it is the most
common dirty-checking bug there is.** `entityManager.merge(order);` as a bare statement
compiles, runs, and silently discards the one object that would have been watched.

**★ `persist` on an `IDENTITY` entity followed by a setter costs an extra `UPDATE`.** The
row was already inserted. With `SEQUENCE` the same code emits a single `INSERT`. If you
are diffing two entities' generated SQL and one has a stray `UPDATE`, check the generator
before anything else.

**★ `refresh` destroys unflushed changes *and* the evidence of them.** After a refresh
there is no way to recover what you had modified — the object and its snapshot both hold
the database's values.

**★ A proxy's setter still reads.** Reaching for `getReference` to "update without
selecting" does not work through the entity API. If you genuinely need a write with no
read, that is a bulk JPQL `update` statement, which bypasses the persistence context
entirely — and leaves it stale, which is
[15d · Reading your own writes](15d-reading-your-own-writes.md).

**★ Two persistence contexts have two independent snapshots.** An entity loaded in
context A and an entity loaded in context B for the same row are different objects with
different loaded states. Neither knows about the other's pending changes; the only thing
that arbitrates between them is optimistic locking —
[16 · `@Version` and optimistic locking](16-version-and-optimistic-locking.md).

**★ `clear()` throws away every snapshot in the context, not just the entities.** After
`clear()`, previously managed instances are detached and unwatched. Changes made to them
before the `clear()` that had not yet been flushed are lost.

**★ An entity loaded, then detached, then merged back is snapshotted twice — and the
second snapshot comes from a fresh read.** That read is where a concurrent modification
becomes visible, and it is why the specification says version columns are checked during
merge.

**★ A `@PostLoad` callback runs after the entity is populated.** Whether its assignments
land inside or outside the snapshot is exactly the question of whether the field is
mapped — see [14c · What counts as a change](14c-what-counts-as-a-change.md). I could not
confirm from the 7.4 documentation the precise ordering of `@PostLoad` relative to the
snapshot being taken, so treat "assign only to `@Transient` fields in `@PostLoad`" as the
rule rather than reasoning about the ordering.

## Interview questions

**★ Does `getReference` participate in dirty checking?**
Only once the proxy is initialised, because until then no row has been read and there is
no loaded state to compare against. Any accessor call, including a setter, triggers the
initialising `SELECT` first.

**★ Can you update a row without selecting it first, using the entity API?**
No. Every path that produces a managed entity with a snapshot has read the row, and a
proxy initialises on first access. Writing without reading means leaving the entity API:
a bulk JPQL `update`, or plain SQL.

**★ Why does `persist` followed by a setter sometimes produce two statements and
sometimes one?**
Because of the identifier generator. `IDENTITY` forces the `INSERT` at `persist()` time,
so anything you change afterwards needs a separate `UPDATE`. `SEQUENCE` and `TABLE` queue
the `INSERT` until flush, so later changes are folded into it.

**★ You call `merge` and then keep using the variable you passed in. What happens?**
Nothing is written for it. That instance is still detached and has no snapshot; only the
returned instance is managed. The fix is `order = entityManager.merge(order);`.

**★ After `flush()`, is the entity still dirty?**
No. The snapshot is updated to what was written, so an immediate second flush emits
nothing. It becomes dirty again the next time it diverges.

**★ Why does `refresh` inside a method that has already made changes lose them silently?**
Because it replaces both halves of the comparison. The entity gets the database's values
and so does the snapshot, so at flush there is no difference to detect. Nothing throws;
the changes simply never existed as far as the flush is concerned.

**★ Is the snapshot shared between two `EntityManager`s?**
No. Snapshots belong to a persistence context. Two contexts holding the same row hold two
instances and two snapshots, and they can produce conflicting writes — which is the
problem optimistic locking exists to detect.

---

← Prev: [14 · Dirty checking](14-dirty-checking.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14c · What counts as a change](14c-what-counts-as-a-change.md)
