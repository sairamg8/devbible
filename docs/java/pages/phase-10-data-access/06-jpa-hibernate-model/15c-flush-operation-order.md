---
title: "Hibernate does not execute your statements in the order you wrote them — it drains an action queue in a fixed order, and deletes come last, which is why a delete-then-insert violates a unique constraint"
sidebar_label: "15c · Flush operation order"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §7.5 *Flush operation order*
> and §13.1 *JDBC batching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Jakarta Persistence 3.2 specification §3.2.4
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**The single most confusing exception in this topic is a unique-constraint violation on
code that removes a row and then inserts a replacement. The code is correct. The statements
came out in the opposite order, because a flush drains an `ActionQueue` whose order is
fixed by Hibernate and has nothing to do with the order of your method calls — and
`EntityDeleteAction` is last in it.**

## The rule

The User Guide states it and then gives the list:

> Hibernate does **not** execute the SQL statements in the order of their associated entity
> state operations. […] The order in which SQL statements are executed is given by the
> `ActionQueue` and not by the order in which entity state operations have been previously
> defined.

> The `ActionQueue` executes all operations in the following order:
>
> 1. `OrphanRemovalAction`
> 2. `EntityInsertAction` or `EntityIdentityInsertAction`
> 3. `EntityUpdateAction`
> 4. `QueuedOperationCollectionAction`
> 5. `CollectionRemoveAction`
> 6. `CollectionUpdateAction`
> 7. `CollectionRecreateAction`
> 8. `EntityDeleteAction`

Read it as four groups: orphan removals first, then entity inserts, then entity updates,
then everything about collections, and **entity deletes last**.

The guide's own demonstration is two lines long:

```java
Person person = entityManager.find(Person.class, 1L);
entityManager.remove(person);

Person newPerson = new Person();
newPerson.setId(2L);
newPerson.setName("John Doe");
entityManager.persist(newPerson);
```

and its verdict: "Even if we removed the first entity and then persist a new one, Hibernate
is going to execute the `DELETE` statement after the `INSERT`."

## Why it is ordered that way at all

Not arbitrarily. A fixed order is what makes the queue *batchable* — statements of the same
kind against the same table end up adjacent, so they can share a `PreparedStatement`. The
`INSERT`-before-`DELETE` arrangement also satisfies the ordinary foreign-key case: children
are inserted after their parents and deleted before them.

The trade is that it cannot satisfy every case, and the one it fails on is the one below.

## The bug this produces

The shape is "replace the set of rows for a key":

```java
@Transactional
public void replaceTags(long postId, List<String> tags) {
    tagRepository.deleteByPostId(postId);          // queued: deletes
    tags.forEach(t -> tagRepository.save(new Tag(postId, t)));   // queued: inserts
}
```

With a unique constraint on `(post_id, name)` this fails, and the failure is a
`DataIntegrityViolationException` wrapping a unique-violation from the database. The
inserts ran first, against rows that were still there.

Nothing about the Java is wrong. The statements simply came out in the queue's order.

### The fix: a flush between them

```java
@Transactional
public void replaceTags(long postId, List<String> tags) {
    tagRepository.deleteByPostId(postId);
    tagRepository.flush();                          // ← the deletes go now
    tags.forEach(t -> tagRepository.save(new Tag(postId, t)));
}
```

A flush drains the queue. Everything queued before it is executed before it returns, so the
inserts queued afterwards are in a second, later flush. Two flushes, correct order.

This is one of the few genuinely necessary uses of an explicit `flush()`. It is not
defensive; it is ordering.

### Two other honest fixes

- **Do not delete what you are about to re-create.** Compute the difference: delete only
  the tags that are going away, insert only the new ones, leave the rest alone. Fewer
  statements and no ordering problem.
- **Make the constraint deferrable.** On PostgreSQL a
  `UNIQUE … DEFERRABLE INITIALLY DEFERRED` constraint is checked at commit rather than per
  statement, which makes the order irrelevant. It is a real option and it has real costs —
  the violation now surfaces at commit, outside your method, and deferred checking cannot
  use the constraint's index for the same optimisations.

## Where the collection actions bite

Positions 4 to 7 explain a behaviour people meet with `@ElementCollection` and with
`@OneToMany` collections: the wholesale delete-and-reinsert. When Hibernate cannot identify
which element of a collection changed, it removes the collection's rows and recreates them
— `CollectionRemoveAction` then `CollectionRecreateAction`, in that order, which is why it
works even though the entity-level equivalent does not.

Which collections behave that way, and why a `List` behaves differently from a `Set`, is
[topic 07 · 10b · What a `List` costs](../07-relationships-fetch/10b-what-a-list-costs.md).

## Ordering within a group

The queue's order is by *kind*. Within a kind, two settings change the order further, and
both exist for batching:

> `hibernate.order_updates` — Forces Hibernate to order SQL updates by the entity type and
> the primary key value of the items being updated. This allows for more batching to be
> used. It will also result in fewer transaction deadlocks in highly concurrent systems.
> **Comes with a performance hit, so benchmark before and after** to see if this actually
> helps or hurts your application.

> `hibernate.order_inserts` — Forces Hibernate to order inserts to allow for more batching
> to be used. **Comes with a performance hit, so benchmark before and after** […]

The deadlock note on `order_updates` is the more interesting half: if every transaction
updates rows in primary-key order, two concurrent transactions touching an overlapping set
cannot acquire them in opposite orders, which is the classic deadlock. It is a correctness
benefit obtained through a batching setting.

⚠️ Neither is on by default, and both documentation entries say the same thing about
measuring first.

## Gotchas

**★ `deleteBy…` followed by `save` in one transaction violates unique constraints.** This
is the canonical case. The inserts execute before the deletes because the queue says so.

**★ Spring Data's `deleteBy…` derived query is not necessarily a bulk `DELETE`.** A derived
delete loads the entities and removes them one by one, which queues `EntityDeleteAction`s —
the case this page is about. A `@Modifying @Query("delete from …")` is a bulk statement that
executes when the query runs, which bypasses the queue and has different problems, covered
in [15d · Reading your own writes](15d-reading-your-own-writes.md).

**★ `saveAndFlush` is not a targeted fix.** It flushes the whole context. In the
replace-tags case that is exactly what you want, but be clear that it is not writing only
the entity you passed.

**★ Orphan removal runs *first*, before inserts.** So `orphanRemoval = true` on the
collection can make the replace-tags pattern work where an explicit `remove` does not, for
reasons that have nothing to do with your code. Do not read that as an endorsement — relying
on it is relying on queue positions.

**★ Deletes last means a `DELETE` can fail on a foreign key that your later code would have
cleared.** The failure order is the queue's, not the method's.

**★ Adding a `flush()` changes where exceptions appear.** After the fix above, the unique
violation — if there still is one — is thrown at the `flush()` line rather than after the
method returns. That is an improvement, but it will look like a new exception in a new
place.

**★ `order_inserts` and `order_updates` both carry a documented performance hit.** They are
not free wins; the documentation says to benchmark both directions.

**★ Enabling `order_updates` can fix an intermittent deadlock, and the connection is not
obvious.** If two transactions deadlock updating overlapping row sets, consistent
primary-key ordering removes the cycle.

**★ The queue order is per flush, not per transaction.** Two flushes give you two ordered
groups, which is precisely why the fix works.

## Interview questions

**★ In what order does Hibernate execute the statements produced by a flush?**
Orphan removals, entity inserts, entity updates, then the collection actions — queued
operations, removes, updates, recreates — and finally entity deletes. The order is the
`ActionQueue`'s and is unrelated to the order of the calls that queued the work.

**★ Why does removing a row and inserting a replacement in the same transaction violate a
unique constraint?**
Because `EntityDeleteAction` is last in the queue and `EntityInsertAction` is near the
front. The `INSERT` reaches the database while the old row is still present.

**★ How do you fix it?**
Flush between the two operations, so the deletes are drained before the inserts are queued.
Alternatively, avoid the delete-and-recreate entirely by diffing the sets, or make the
constraint deferrable so it is checked at commit.

**★ Why is the queue ordered at all — why not just replay the calls?**
So that statements of the same kind against the same table end up adjacent and can be
batched, and so that the ordinary parent-child foreign-key case works without the
application thinking about it. The cost is that the delete-then-insert case cannot also be
satisfied.

**★ What do `hibernate.order_inserts` and `hibernate.order_updates` do?**
They sort within a kind — by entity type, and for updates by primary key — so that more
statements can share a batch. `order_updates` additionally reduces deadlocks in concurrent
systems by making every transaction acquire rows in the same order. Both are documented as
carrying a performance hit and needing measurement.

**★ Does an explicit `flush()` reorder anything?**
No. It drains the queue in the queue's order. What it changes is *which statements are in
which queue* — everything before the call is in the earlier flush, everything after is in
the next one.

**★ Why does replacing an element collection sometimes emit a delete of every row followed
by an insert of every row?**
Because `CollectionRemoveAction` and `CollectionRecreateAction` are separate positions in
the queue and Hibernate uses them when it cannot identify individual changed elements. The
ordering that fails for entities works here, because the removal is queued ahead of the
recreation.

**★ Does the ordering guarantee hold across transactions?**
It is per flush. A transaction with several flushes produces several independently ordered
groups, in the order the flushes happened.

---

← Prev: [15b · What triggers a flush](15b-what-triggers-a-flush.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [15d · Reading your own writes](15d-reading-your-own-writes.md)
