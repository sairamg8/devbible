---
title: "CascadeType.REMOVE on a @ManyToOne says 'deleting this line deletes the order' — which nobody means, and which the annotation lets you write anyway"
sidebar_label: "8b · REMOVE, and Hibernate's extras"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.15 *Cascading entity
> state transitions* (including §6.15.3 `CascadeType.REMOVE`, §6.15.5 `CascadeType.LOCK`,
> §6.15.7 `CascadeType.REPLICATE` and §6.15.8 `@OnDelete` cascade)
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Jakarta Persistence 3.2 `CascadeType` javadoc
> ([.../cascadetype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/cascadetype))
> and the PostgreSQL 18 manual *§5.5 Constraints → Foreign Keys*
> ([postgresql.org/docs/18/ddl-constraints.html](https://www.postgresql.org/docs/18/ddl-constraints.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**`REMOVE` is the only cascade type that destroys data, so it is the only one where
getting the direction wrong is unrecoverable. The direction is always parent to part.
Put it on a `@ManyToOne` and you have said "deleting the part deletes the whole", which
reads as absurd out loud and reads as ordinary in an annotation.**

## The bug, written the way it appears in real code

```java
@Entity
public class OrderLine {

    @ManyToOne(cascade = CascadeType.ALL)   // ⛔
    @JoinColumn(name = "order_id")
    private Order order;
}
```

Somebody wanted the lines saved when the order is saved, reached for `ALL` because it is
the shortest thing to type, and put it on the association they were looking at.

What it now means: `em.remove(line)` removes the `Order`. And because the order's own
collection probably cascades `REMOVE` to its lines, removing one line removes the order
and then every *other* line on it. One deletion, an entire aggregate gone.

It also means `em.detach(line)` detaches the order, `em.refresh(line)` refetches the
order, and `merge(line)` merges the order over the top of whatever was there.

**The rule, with no exceptions worth remembering: cascade goes on the collection, never on
the `@ManyToOne`.** The 7.4 *User Guide* frames it as a property of the association type
— *"only the parent side of an association makes sense to cascade its entity state
transitions to children"* — and the `@ManyToOne` side is never the parent.

The one narrow exception is `CascadeType.PERSIST` on a `@ManyToOne` to a target that is
genuinely created with the child and never shared. Even then, persisting the target
explicitly is clearer, and reviewers will not have to work out which case they are looking
at.

## Where `REMOVE` is right

A whole/part relationship where the part has no independent existence:

```java
@Entity
public class Order {
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<OrderLine> lines = new HashSet<>();
}
```

An `OrderLine` outside an `Order` is meaningless. Deleting the order should delete them.
Two tests that this is the right call:

- **Can the child exist without this parent?** If yes, `REMOVE` is wrong.
- **Is the child referenced by anything else?** If yes, `REMOVE` is destructive beyond
  what you can see from here.

`Order` → `OrderLine`, `Invoice` → `InvoiceItem`, `Post` → `PostRevision`: yes.
`Book` → `Publisher`, `Employee` → `Department`, `Order` → `Customer`, or any
`@ManyToMany`: emphatically no.

## What a cascaded remove actually costs

Cascade is an in-memory, entity-level mechanism. To delete a parent's children, Hibernate
must **load them** — it cannot delete objects it does not have. So a cascaded remove over
a collection of 10,000 children loads 10,000 entities into the persistence context and
issues deletes for them.

Two consequences:

- For large collections, this is slow and memory-hungry compared with one SQL statement.
- Cascading deletes several levels deep multiplies it, because each level must be loaded
  before the next can be reached.

The database-level alternative is `ON DELETE CASCADE` on the foreign key:

```sql
ALTER TABLE order_line
    ADD CONSTRAINT order_line_order_fk
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE;
```

Hibernate can generate this for you with its own `@OnDelete` annotation, documented in the
7.4 *User Guide* §6.15.8:

```java
@OneToMany(mappedBy = "order")
@OnDelete(action = OnDeleteAction.CASCADE)
private Set<OrderLine> lines = new HashSet<>();
```

⚠️ **This is a genuinely different mechanism, not a faster version of the same one.** The
database deletes the rows; Hibernate never sees them. So the persistence context still
holds stale child entities, no JPA lifecycle callbacks (`@PreRemove`) fire for them, no
second-level cache entries are evicted for them, and Envers records nothing. It is the
right tool for large, purely-structural child tables and the wrong one where the children
have behaviour attached.

## Hibernate's three extra cascade types

`org.hibernate.annotations.CascadeType` adds operations the specification never had. The
7.4 *User Guide* lists them:

| Constant | Propagates |
|---|---|
| `SAVE_UPDATE` | `saveOrUpdate` — the legacy Hibernate `Session` operation |
| `REPLICATE` | `replicate` — copying detached state in with its existing identifier |
| `LOCK` | `lock` — reattaching a detached instance / taking a lock mode |

Two things to take from this list.

**They are reachable through `CascadeType.ALL`.** The guide states that `ALL` propagates
any Hibernate-specific operation as well as the standard ones. So `ALL` is a broader
grant on Hibernate than the specification describes.

**`SAVE_UPDATE` behaviour is why old advice does not match the specification.** Hibernate's
native `Session` API predates JPA and its `saveOrUpdate` cascade was the historical way
graphs were saved. Advice written against that era says things about cascade behaviour
that `persist`/`merge` do not do. When you read something surprising about cascade,
check whether it is talking about `Session.saveOrUpdate` or about
`EntityManager.persist`.

To apply a Hibernate-specific cascade you use the `@Cascade` annotation rather than the
`cascade` element:

```java
@OneToMany(mappedBy = "order")
@Cascade(org.hibernate.annotations.CascadeType.LOCK)
private Set<OrderLine> lines = new HashSet<>();
```

Rarely needed in a Spring Boot application, which uses the JPA API throughout.

## `REMOVE` versus `orphanRemoval` — the short version

They are not the same and the difference is about *when*, not *what*:

- `CascadeType.REMOVE` fires when the **parent** is removed.
- `orphanRemoval = true` fires when a **child leaves the collection**, whether or not the
  parent is going anywhere.

Full treatment, including the case where you want one and not the other, is
**[9 · Orphan removal](09-orphan-removal.md)**.

## Gotchas

**`CascadeType.ALL` on a `@ManyToOne` is the single most destructive annotation typo in
JPA.** It is short, it looks symmetric with the collection side, and it means "deleting
the part deletes the whole". Grep for `@ManyToOne(cascade` in any codebase you inherit.

**`@ManyToMany` with `cascade = ALL` deletes shared entities.** Removing a `Book` deletes
its `Author`s, who wrote other books. There is no whole/part relationship in a
many-to-many by definition, so `REMOVE` never belongs on one.

**A cascaded remove loads every child.** It is an entity-level operation and cannot delete
what it has not loaded. For very large collections, prefer `ON DELETE CASCADE` in the
schema or an explicit bulk delete, and accept that neither fires JPA callbacks.

**`@OnDelete(action = CASCADE)` leaves the persistence context stale.** The rows are gone
and the entities are still in memory, still cached, still returnable from `find` in the
same transaction. Use it where children are structural, not where they have lifecycle
callbacks or auditing.

**Cascading `REMOVE` across a `@OneToOne` in the wrong direction deletes the wrong row.**
`Person` → `Author` and `Author` → `Person` are both writable mappings, and only one of
them means what you want. Ask which one is the part.

**A `@ManyToOne` with `optional = false` and a cascaded remove from the other side needs a
deletion order.** Hibernate orders deletes by dependency, but if you have also enabled
`ON DELETE CASCADE` in the database you now have two mechanisms deleting the same rows.
Pick one.

**Cascade does not fire for entities Hibernate never loaded.** Deleting a parent by a JPQL
bulk `DELETE` bypasses cascade entirely, leaving orphaned children or a foreign-key
violation.

## Interview questions

**★ Why is `CascadeType.REMOVE` on a `@ManyToOne` almost always a bug?**
Because it reverses the whole/part direction. `@ManyToOne` points from the part to the
whole — a line to its order, a book to its publisher — so cascading remove along it says
"deleting one line deletes the order", and by extension every sibling line if the order
cascades back. Nobody means that. Cascade belongs on the parent's collection, which is
where the whole/part relationship actually points; the Hibernate user guide says only the
parent side of an association makes sense to cascade state transitions to children.

**★ What is the difference between `CascadeType.REMOVE` and `ON DELETE CASCADE`?**
The first is an entity-level operation: Hibernate loads the children into the persistence
context and issues a delete for each, which means lifecycle callbacks fire, the
second-level cache is kept consistent, and auditing sees the deletions — at the cost of
loading every child. The second is a database constraint: the rows vanish server-side,
Hibernate never sees them, no callbacks fire, and the persistence context and caches can be
left holding entities for rows that no longer exist. Choose the first for children with
behaviour, the second for large structural tables.

**★ Does `CascadeType.ALL` mean something different on Hibernate?**
Yes. The specification defines `ALL` as the five standard operations. Hibernate's guide
adds that `ALL` also propagates its own `SAVE_UPDATE`, `REPLICATE` and `LOCK` operations
from `org.hibernate.annotations.CascadeType`. So `ALL` is a wider grant than the javadoc
suggests, which is an argument for listing the operations you actually want.

**★ How do you delete a parent with a hundred thousand children efficiently?**
Not with `CascadeType.REMOVE`, because that loads every child first. Either declare
`ON DELETE CASCADE` on the foreign key so the database does it in one statement, or run an
explicit bulk `DELETE` for the children followed by one for the parent. Both bypass JPA
cascade and callbacks, so you must be sure the children have no lifecycle behaviour that
matters — and if they do, the volume is a design problem, not a cascade problem.

**★ Why can't you use cascade on a `@ManyToMany` for deletion?**
Because many-to-many is by definition a relationship between entities with independent
lifecycles — that is what "many on both sides" means. Deleting a book cannot sensibly
delete its authors, since those authors have other books. `orphanRemoval` is not even an
element of the `@ManyToMany` annotation for the same reason. `PERSIST` and `MERGE` can be
reasonable there; `REMOVE` never is.

**★ You see `@ManyToOne(cascade = CascadeType.PERSIST)` in a code review. Accept or
reject?**
It depends on the target. If the target is a shared entity with its own lifecycle — a
publisher, a customer, a category — reject it: persisting the child should not create a
new shared parent, and the annotation makes an accidental `persist` of a half-built target
possible. If the target is genuinely created together with the child and never shared, it
is defensible, but persisting it explicitly is clearer and avoids the reviewer having to
work out which case this is. What is not defensible under any reading is `ALL` on a
`@ManyToOne`, because it drags `REMOVE` along.

---

← Prev: [8 · Cascade](08-cascade.md) · Index: [Relationships and fetch types](README.md) · Next → [9 · Orphan removal](09-orphan-removal.md)
