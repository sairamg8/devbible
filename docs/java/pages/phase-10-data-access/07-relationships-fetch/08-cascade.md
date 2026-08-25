---
title: "Cascade propagates an operation, not a value — six types in the specification, and ALL means all six plus everything Hibernate adds"
sidebar_label: "8 · Cascade"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `CascadeType` javadoc
> ([.../cascadetype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/cascadetype)),
> the Hibernate ORM 7.4 *User Guide* §6.15 *Cascading entity state transitions*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §5.5
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Cascade answers one question: when I do something to this entity, should the same
thing happen to the entities it points at? It has nothing to do with foreign keys, with
the owning side, or with what gets written into a column. It is about which objects an
operation reaches. That is why an inverse-side collection — which cannot write a single
column — can still create and delete rows in another table.**

## The six standard types

`CascadeType` in Jakarta Persistence 3.2 has six constants. The Hibernate 7.4 *User
Guide* lists them with the same descriptions:

| Constant | Propagates | What it means for a parent → child association |
|---|---|---|
| `PERSIST` | `EntityManager.persist` | persisting the parent inserts new children |
| `MERGE` | `EntityManager.merge` | merging a detached parent merges its children |
| `REMOVE` | `EntityManager.remove` | deleting the parent deletes its children |
| `REFRESH` | `EntityManager.refresh` | re-reading the parent re-reads its children |
| `DETACH` | `EntityManager.detach` | detaching the parent detaches its children |
| `ALL` | all of the above | see the next section |

**The default is none.** The `@ManyToOne` javadoc says it directly: *"By default no
operations are cascaded."* Nothing propagates unless you ask.

And note what is *not* in the list. There is no cascade for a query, for `find`, for
`flush`, or for `lock` (the standard has `LockModeType` on `find`/`lock` rather than a
cascade type — Hibernate adds its own, below). Cascade covers entity **state
transitions**, which is exactly the guide's phrase for the chapter.

## `ALL` is broader than the six

The `CascadeType` javadoc defines `ALL` as equivalent to
`{PERSIST, MERGE, REMOVE, REFRESH, DETACH}`. Hibernate then extends it:

> Additionally, the `CascadeType.ALL` will propagate any Hibernate-specific operation,
> which is defined by the `org.hibernate.annotations.CascadeType` enum:
> `SAVE_UPDATE` — cascades the entity `saveOrUpdate` operation.
> `REPLICATE` — cascades the entity `replicate` operation.
> `LOCK` — cascades the entity `lock` operation.

So on Hibernate, `cascade = CascadeType.ALL` means "everything the specification defines,
plus everything Hibernate's own session API defines". That is more than most people
believe they are asking for. When you know which operations you want, listing them is
both more precise and self-documenting:

```java
@OneToMany(mappedBy = "order", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
private Set<OrderLine> lines = new HashSet<>();
```

## `PERSIST` — the one you almost always want

```java
@Entity
public class Order {
    @OneToMany(mappedBy = "order", cascade = CascadeType.PERSIST)
    private Set<OrderLine> lines = new HashSet<>();
}
```

Now `em.persist(order)` inserts the order and every line in the collection. Without it,
each line needs its own `persist` call, and forgetting one produces a
`TransientObjectException` at flush — Hibernate refusing to write a reference to an object
it has never seen.

⚠️ **The cascade walks the collection.** If you set `line.setOrder(order)` but never add
the line to `order.getLines()`, the cascade does not reach it. This is the other half of
the argument for the helper method in **[2c](02c-keeping-both-sides-in-step.md)**: the
database side needs the owning field set, and the cascade needs the collection populated.

## `MERGE` — and why it is usually `PERSIST`'s twin

`merge` takes a detached object and copies its state onto a managed one. Cascading it
means the children are merged too. If you build a whole `Order` graph outside a
transaction — from a request body, say — and merge it, `MERGE` is what saves the lines.

`PERSIST` and `MERGE` together cover "save this graph", which is why they are the
conventional pair when you do not want `ALL`.

⚠️ **`merge` returns a different instance.** The object you passed in stays detached; the
managed copy is the return value. Cascade does not change that — the children of the
*returned* graph are managed, the children of the object you handed in are not. Detail on
merge itself belongs to **Topic 06 · JPA and the persistence context** *(not written
yet)*.

## `REFRESH` and `DETACH` — narrow, and occasionally exactly right

`REFRESH` re-reads the parent's row and, with the cascade, the children's rows too.
Useful after a database-side change your session cannot see — a trigger, a stored
procedure, another transaction you deliberately waited for. Expensive, and it discards
unflushed changes, so it is a deliberate tool rather than a default.

`DETACH` evicts the parent from the persistence context and, with the cascade, its
children. Occasionally useful when you are about to hand a graph to something that must
not accidentally trigger lazy loading or dirty checking. Rarely needed in a
request-scoped Spring application, where the whole context is discarded at the end anyway.

Neither belongs in a default mapping. Both belong in `ALL`, which is one more reason to
be deliberate about `ALL`.

## `REMOVE` — the one that needs its own chunk

`cascade = CascadeType.REMOVE` on a parent's collection means `em.remove(order)` deletes
every line. For a genuine whole/part relationship that is correct and desirable.

Everywhere else it ranges from wasteful to catastrophic — and putting it on a
`@ManyToOne` is almost always a bug. That argument, together with the Hibernate-specific
cascade types and how `REMOVE` differs from `orphanRemoval`, is
**[8b · REMOVE and the Hibernate extras](08b-cascade-remove-and-the-hibernate-extras.md)**
and **[9 · Orphan removal](09-orphan-removal.md)**.

## Which side does cascade go on?

The parent's. The 7.4 *User Guide* states the principle:

> The `@OneToMany` association is by definition a parent association, regardless of
> whether it's a unidirectional or a bidirectional one. Only the parent side of an
> association makes sense to cascade its entity state transitions to children.

And the *Introduction* frames it in domain terms: cascading applies to *whole/part-type*
relationships — *"a convenience which allows us to propagate one of the operations […]
from a parent to its children."*

So: cascade on the `@OneToMany`, not on the `@ManyToOne`. On a `@OneToOne`, cascade from
whichever side is the whole to whichever side is the part.

⚠️ **Cascade is orthogonal to ownership.** The parent's collection is the inverse side —
it maps no column — and it is still the correct place for cascade. Ownership decides who
writes the foreign key; cascade decides which objects an operation reaches. Both are true
about the same association at the same time, pointing in opposite directions.

## Gotchas

**Cascade does not set the foreign key.** It propagates operations, not values. A cascaded
`persist` inserts the child row; the value of the child's foreign-key column still comes
from the child's own `@ManyToOne` attribute. This is why a cascaded insert with an unset
owning side produces a `NULL` key or a constraint violation.

**`cascade = ALL` on Hibernate includes three operations the specification never defined.**
`SAVE_UPDATE`, `REPLICATE` and `LOCK` come along. If you meant "save the graph", say
`{PERSIST, MERGE}`.

**A cascade only reaches what is in the collection *at flush time*.** Adding a child after
the parent was persisted is fine — the collection is re-examined at flush — but a child
that never enters the collection is never reached, no matter how correctly its
`@ManyToOne` is set.

**Cascading from both sides of a bidirectional pair is a loop waiting to happen.**
`Order.lines` cascading `REMOVE` to `OrderLine`, and `OrderLine.order` cascading `REMOVE`
back to `Order`, means deleting one line tries to delete the order and then every other
line. Cascade in one direction only: parent to child.

**`CascadeType.PERSIST` does not make a `@ManyToOne` target get saved in a useful order
by accident.** Persisting a `Book` whose `Publisher` is transient requires the publisher
to be persisted too — cascade on the `@ManyToOne` would do it, but it is nearly always
better to persist the publisher explicitly, because a `@ManyToOne` target is usually a
shared entity with its own lifecycle.

**Spring Data's `save()` chooses `persist` or `merge` for you.** Which one it picks
depends on whether the entity looks new. So a mapping with `PERSIST` but not `MERGE` can
work for new graphs and silently fail to save children for existing ones. `{PERSIST,
MERGE}` avoids the class of question entirely.

**Cascade has no effect on JPQL bulk operations.** `DELETE FROM Order o WHERE …` as a
query does not cascade to lines and does not consult the persistence context. That is the
database's job — `ON DELETE CASCADE` — or the query's.

## Interview questions

**★ What does `cascade` actually do?**
It propagates an `EntityManager` operation from one entity to the entities it references.
`persist` on the parent becomes `persist` on each child, `remove` becomes `remove`, and so
on for the six standard types. It says nothing about foreign keys or column values — a
cascaded insert still takes the child's foreign key from the child's own `@ManyToOne`
attribute. That separation is why a `mappedBy` collection, which writes no columns at all,
is nevertheless the correct place to put cascade.

**★ List the `CascadeType` constants and say which you would use by default.**
`PERSIST`, `MERGE`, `REMOVE`, `REFRESH`, `DETACH`, and `ALL` meaning the other five. The
default is none — the javadoc says no operations are cascaded unless specified. For a
parent owning genuinely dependent children I would use `ALL` with `orphanRemoval = true`;
for anything else `{PERSIST, MERGE}`, which covers saving the graph without giving away
deletion.

**★ Does `CascadeType.ALL` mean the same thing on Hibernate as in the specification?**
No, it means more. The specification defines `ALL` as the five standard operations.
Hibernate's user guide adds that `ALL` also propagates its own operations — `SAVE_UPDATE`,
`REPLICATE` and `LOCK` from `org.hibernate.annotations.CascadeType`. That is a good reason
to enumerate what you want rather than reaching for `ALL` reflexively.

**★ Which side of a bidirectional association gets the cascade, and why is that side the
one that maps no column?**
The parent side — the `@OneToMany` — even though it carries `mappedBy` and therefore maps
no column. The two concepts are answering different questions. Ownership answers "which
attribute writes the foreign key", and the answer is always the many side. Cascade answers
"which objects does an operation reach", and an operation on a parent reaches the children
listed in its collection. The Hibernate user guide states that only the parent side of an
association makes sense to cascade state transitions to children.

**★ You cascade `PERSIST` from parent to child, set the child's parent reference, call
`persist(parent)`, and the child is not saved. Why?**
Because the cascade walks the parent's collection, and the child was never added to it.
Setting the child's `@ManyToOne` makes the foreign key correct but does not make the child
reachable from the parent. This is the mirror image of the classic bug where the child is
added to the collection but its owning side is never set — which is why the fix for both is
a single helper method that does both mutations.

**★ Does a JPQL `DELETE` cascade?**
No. Bulk operations are translated to a single SQL statement and executed against the
database directly; they do not load entities, do not consult the persistence context, and
do not apply JPA cascade or orphan removal. If you delete parents in bulk you must handle
the children yourself — either with a preceding bulk delete or with `ON DELETE CASCADE` on
the foreign key in the schema.

---

← Prev: [7b · Model the join table](07b-model-the-join-table.md) · Index: [Relationships and fetch types](README.md) · Next → [8b · REMOVE, and Hibernate's extras](08b-cascade-remove-and-the-hibernate-extras.md)
