---
title: "orphanRemoval fires when a child leaves the collection; CascadeType.REMOVE fires when the parent is deleted — they are different triggers and you often want both"
sidebar_label: "9 · Orphan removal"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 javadocs for `@OneToMany`
> ([.../onetomany](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetomany))
> and `@OneToOne`
> ([.../onetoone](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetoone)),
> the Hibernate ORM 7.4 *Introduction* §5.5 *Cascade*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Hibernate ORM 7.4 *User Guide* §3.8.2 and §6.12.1 *Merging detached data*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Both settings delete children. They are triggered by different events, and confusing
them produces either children that outlive their parent or children that never die. The
JPA javadoc defines orphan removal as applying the remove operation "to entities that
have been removed from the relationship" — from the relationship, not with the parent.
Hibernate's introduction says the same thing in one sentence: an item "should be
automatically deleted if it is removed from the set of items belonging to its parent".**

## The two triggers, side by side

| Event | `cascade = REMOVE` | `orphanRemoval = true` |
|---|---|---|
| `em.remove(parent)` | deletes the children | also deletes the children |
| `parent.getChildren().remove(child)` | **nothing** | deletes that child's row |
| `child.setParent(null)` on the owning side | **nothing** | deletes that child's row |
| `parent.getChildren().clear()` | **nothing** | deletes every child's row |

The first row is why people think they are the same. The rest is why they are not.

⚠️ Note the second and third rows against **[2b](02b-mappedby-and-the-silent-nothing.md)**:
removing from an inverse collection normally does *nothing at all*. `orphanRemoval` is the
one setting that makes that operation meaningful — and it makes it maximally meaningful, by
deleting the row rather than clearing the key.

## The mapping

```java
@Entity
public class Order {

    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "order",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private Set<OrderLine> lines = new HashSet<>();

    public void removeLine(OrderLine line) {
        lines.remove(line);
        line.setOrder(null);
    }
}
```

`removeLine` now deletes the row. Not "sets `order_id` to null" — deletes it. That is
correct for an order line, which has no existence outside its order, and it is a data-loss
bug for anything that does.

`orphanRemoval` is an element of `@OneToMany` and `@OneToOne` only. It is **not** an
element of `@ManyToMany` — there is no whole/part relationship there to justify it — and
not of `@ManyToOne`, because a child does not own its parent.

## Why you usually want both

They cover different halves of the same intention.

`cascade = REMOVE` alone: the lines die with the order, and removing a line from the order
leaves the row behind — either orphaned with a `NULL` key or, if the key is `NOT NULL`,
failing at flush.

`orphanRemoval = true` alone: removing a line deletes it, and deleting the whole order
does *not* delete the lines. In practice the `NOT NULL` foreign key then blocks the parent
delete, which is at least loud.

> ⚠️ Some sources state that `orphanRemoval = true` implies `CascadeType.REMOVE`. I could
> not confirm that against the Jakarta Persistence 3.2 javadocs or the Hibernate 7.4
> documentation. The `@OneToMany` javadoc describes orphan removal as applying the remove
> operation to entities removed from the relationship *and* cascading remove to those
> entities, which is about the orphans rather than about parent deletion. **Write both.**
> `cascade = CascadeType.ALL, orphanRemoval = true` is unambiguous, costs nothing, and does
> not depend on the answer.

## When you want orphan removal and *not* cascaded remove

Rarer, and worth recognising. A `Document` with a collection of `Draft`s where drafts are
purely internal, but documents are soft-deleted rather than removed. Removing a draft from
the collection should delete it; the document is never `em.remove`d at all, so the cascade
question is moot — and leaving `REMOVE` off documents that intention.

## When you want cascaded remove and *not* orphan removal

Also real. A `Project` with `Task`s, where deleting a project deletes its tasks, but moving
a task to a different project is a normal operation. With `orphanRemoval = true`, the
moment a task leaves `projectA.getTasks()` it is deleted — before it ever reaches
`projectB`. That is a genuine data-loss bug caused by a setting that was correct for the
other half of the requirement.

**The test: can a child ever be reassigned to a different parent?** If yes,
`orphanRemoval` is wrong. Reassignment and orphan removal are mutually exclusive.

## `@OneToOne` orphan removal

Same element, same semantics, single-valued:

```java
@OneToOne(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
private OrderPayment payment;
```

`order.setPayment(null)` now deletes the payment row. Setting it to a *different* payment
deletes the old one. That second behaviour is the one that surprises people — replacing a
one-to-one target is a delete plus an insert, not an update.

## The merge case, straight from the guide

Hibernate's 7.4 *User Guide* documents an edge case in `merge` that is worth knowing
because it looks like orphan removal failing:

> If the association is mapped with `orphanRemoval = true`, the new entity will not be
> deleted because the semantics of `orphanRemoval` do not apply if the entity being
> orphaned is a new entity.

In other words, orphan removal deletes *rows*. An entity that was never persisted has no
row, so orphaning it is not a deletion — it is simply dropped. Sensible, and not obvious.

## Gotchas

**Orphan removal makes reassignment impossible.** Taking a child out of one parent's
collection to put it in another's deletes it on the first flush. If children move between
parents, do not use it — no amount of careful ordering makes it safe, because the flush can
happen between the two operations.

**It fires on `clear()` too.** `order.getLines().clear()` deletes every line. Code that
"resets" a collection before repopulating it deletes and reinserts every row, and with a
`@Version` column or auditing attached that is very visible in the wrong way.

**Replacing the whole collection instance is worse than clearing it.**
`order.setLines(newSet)` discards Hibernate's persistent collection. Depending on the
mapping, the old contents may be deleted and the new ones inserted wholesale. Mutate in
place — see **[2c](02c-keeping-both-sides-in-step.md)**.

**Orphan removal loads the collection.** To know which children are missing, Hibernate must
know what was there. So an operation that looks like a targeted delete initialises the
whole collection first.

**A shared child plus orphan removal is data loss with extra steps.** If an `Address` is
referenced by two `Employee`s and one of them removes it from its collection, the row
disappears from under the other. Orphan removal is only ever correct for exclusively-owned
children.

**`orphanRemoval` is not available on `@ManyToMany`.** It is not an element of the
annotation. If you find yourself wanting it there, the relationship is not really
many-to-many — see **[7b](07b-model-the-join-table.md)**.

**Orphan removal and `ON DELETE CASCADE` are not the same tool and stack badly.** One
deletes children when they leave a collection; the other deletes children when the parent
row goes. Together they can both try to delete the same rows, in different orders. Pick the
mechanism per relationship and write it down.

**A JPQL bulk `DELETE` does not trigger orphan removal.** No entities are loaded, so
nothing is orphaned. Same limitation as cascade.

## Interview questions

**★ What is the difference between `CascadeType.REMOVE` and `orphanRemoval = true`?**
The trigger. Cascaded remove fires when the parent is removed and propagates that removal
to the children. Orphan removal fires when a child is removed *from the relationship* —
taken out of the collection or de-referenced — and deletes that child's row even though the
parent is untouched. The JPA javadoc defines orphan removal as applying the remove operation
to entities that have been removed from the relationship, which is precisely the case
cascade does not cover.

**★ Which one makes `parent.getChildren().remove(child)` do something?**
Orphan removal. Without it, removing from an inverse collection changes nothing in the
database at all — the child keeps its foreign key and reappears on the next load. With it,
the child's row is deleted. That is a very large behavioural difference produced by one
annotation element, which is a good reason to read the mapping before touching a collection.

**★ When is `orphanRemoval` the wrong choice even though the children are dependent?**
When a child can be reassigned from one parent to another. Moving a task from project A to
project B means removing it from A's collection, and orphan removal deletes it at that
moment — potentially before it is ever added to B, since a flush can occur in between. If
reassignment is a supported operation, orphan removal and that operation cannot coexist.

**★ Does `orphanRemoval = true` imply `CascadeType.REMOVE`?**
The two are defined by different triggers and I would not rely on one implying the other —
the Jakarta Persistence javadoc describes orphan removal in terms of entities removed from
the relationship, not in terms of parent deletion. The practical answer is to write both:
`cascade = CascadeType.ALL, orphanRemoval = true` states the intention unambiguously and
does not depend on how a particular provider reads the specification.

**★ What happens if you orphan an entity that was never persisted?**
Nothing is deleted — there is no row to delete. Hibernate's user guide states this
explicitly for the merge case: the semantics of orphan removal do not apply if the entity
being orphaned is a new entity. It is worth knowing because it can look like orphan removal
silently failing, when in fact it is behaving correctly on an entity that has no database
representation.

**★ Why is orphan removal dangerous on a shared child?**
Because it deletes the row, not the reference. If two parents reference the same child and
one of them removes it from its collection, the row is gone and the other parent's reference
now points at nothing. Orphan removal encodes the claim that this parent exclusively owns
this child, and if that claim is false the setting is a data-loss bug rather than a
convenience.

---

← Prev: [8b · REMOVE, and Hibernate's extras](08b-cascade-remove-and-the-hibernate-extras.md) · Index: [Relationships and fetch types](README.md) · Next → [10 · Collection types](10-collection-types.md)
