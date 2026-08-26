---
title: "Nothing in your code asked for that UPDATE — Hibernate kept a private copy of the row when it loaded it, and compares against that copy every time it flushes"
sidebar_label: "14 · Dirty checking"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.2.2 *In-line dirty
> tracking*, §6.10 *Modifying managed/persistent state*, §7 *Flushing* and §7.5 *Flush
> operation order*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.1, §5.3, §5.10 and §6.3
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jakarta Persistence 3.2 specification §3.2 and §7.1
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**There is no `update()` method in JPA, and that is not an oversight. When Hibernate
loads a row it keeps a second, private copy of every mapped value — the *loaded state*,
or snapshot. At flush time it walks every managed entity, compares the object against
its snapshot field by field, and generates an `UPDATE` for each one that differs. You
never call anything. The write is a consequence of the persistence context noticing that
the object stopped matching the row it came from.**

## The method with no write call in it

```java
@Transactional
public void applyDiscount(long orderId, int percent) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.setDiscountPercent(percent);
}
```

There is no `save`, no `update`, no `merge`, no `flush`. The `UPDATE` still happens, at
commit. If you add `orderRepository.save(order)` on the next line it changes nothing at
all — the row was already going to be written, and `save` on an already-managed instance
is a no-op with respect to SQL.

The Hibernate *Introduction* states the rule in one sentence, in its table of `Session`
methods:

> Also notice that there's no `update()` operation for a stateful session. Modifications
> are automatically detected when the session is flushed.

And in its list of reasons persistence contexts exist:

> They enable **automatic dirty checking**: after modifying an entity, we don't need to
> perform any explicit operation to ask Hibernate to propagate that change back to the
> database. Instead, the change will be automatically synchronized with the database when
> the session is flushed.

## The snapshot — the thing that makes it possible

To notice that a field changed, something has to remember what the field was. That
something is the **loaded state**: an array of the entity's mapped values, taken at the
moment the entity became managed, held by the persistence context alongside the entity
itself.

The User Guide describes the mechanism directly, in §6.2.2:

> Historically Hibernate only supported diff-based dirty calculation for determining
> which entities in a persistence context have changed. This essentially means that
> Hibernate would keep track of the last known state of an entity in regards to the
> database (typically the last read or write). Then, as part of flushing the persistence
> context, Hibernate would walk every entity associated with the persistence context and
> check its current state against that "last known database state".

Three things in that passage are worth pulling out, because each one has consequences
later in this topic:

- **"the last known state … in regards to the database"** — the snapshot is not a deep
  clone of your object graph. It is the mapped, converted, column-shaped values.
- **"typically the last read or write"** — the snapshot is refreshed when the entity is
  written, not only when it is read. After a flush, the snapshot is the state that was
  just written, so a second flush with no further edits produces no second `UPDATE`.
- **"walk every entity associated with the persistence context"** — the work is
  proportional to what is *in the context*, not to what you changed. That is the whole
  of [14e · What dirty checking costs](14e-what-dirty-checking-costs.md).

### Where the snapshot lives, and why it doubles your memory

The snapshot is held by the persistence context, which
[11 · The persistence context](11-the-persistence-context.md) established
"holds a hard reference to all its entities". So a managed entity costs you the object
*and* an array of its mapped values, for as long as the context is open. Load fifty
thousand rows into one `EntityManager` and you are holding two representations of fifty
thousand rows.

## What happens at flush

Flush is [15 · Flush](15-flush.md)'s subject; here it matters only as the moment the
comparison runs. The User Guide's §7.5 names the actor:

> The `UPDATE` statement is generated by `EntityUpdateAction` during flushing if the
> managed entity has been marked modified. **The dirty checking mechanism is responsible
> for determining if a managed entity has been modified since it was first loaded.**

So the sequence, for each managed entity, is: read the current mapped values out of the
object; compare them element-by-element against the loaded state; if any element differs,
queue an `EntityUpdateAction`. There is no change log, no interception of your setter, no
proxying of the entity in the default configuration. It is a comparison, done once per
flush, over everything in the context.

That has a consequence people find surprising the first time: **it does not matter how
many times you change a field, or whether you change it back.**

```java
Order order = orderRepository.findById(orderId).orElseThrow();
order.setStatus(Status.CANCELLED);
order.setStatus(Status.OPEN);        // back to what it was
```

If the row's status was already `OPEN`, this emits nothing. The comparison at flush sees
equality and queues no action. A change-log implementation would have recorded two
mutations and written the row; a snapshot comparison sees the net effect and writes
nothing. The same reasoning explains why a setter that assigns the identical value is
free.

## Why this is a correctness feature before it is a convenience

It is tempting to file dirty checking under "saves typing". It is doing something more
load-bearing than that: it makes *the object* the single source of truth for the
duration of the unit of work.

Because the persistence context guarantees one instance per row —
[11 · The persistence context](11-the-persistence-context.md) — and because the write is
derived from that one instance, two pieces of code that both loaded row 42 cannot
generate two conflicting `UPDATE`s. They mutated the same object; one write comes out.
The *Introduction* lists that as the first benefit of a persistence context: it avoids
"data aliasing", so "if we modify an entity in one section of code, then other code
executing within the same persistence context will see our modification."

A codebase with explicit `update()` calls does not have that property. Two services that
each load, modify and save the same row inside one transaction produce two writes, and
the second one wins over the first including the fields it never intended to touch.

## The mental model to carry forward

> **You edit objects. Hibernate decides what SQL that implies, once, at flush.**

Everything else in this part of the topic is a consequence of that sentence:

- *When the snapshot is taken* differs by operation, and one operation does not take one
  at all → [14b · When the snapshot is taken](14b-when-the-snapshot-is-taken.md).
- *What counts as an edit* is not obvious, because "the object differs from the snapshot"
  includes things that never went through a setter →
  [14c · What counts as a change](14c-what-counts-as-a-change.md).
- *What the `UPDATE` looks like* is Hibernate's choice, not yours →
  [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md).
- *Comparing everything, every flush* has a price →
  [14e · What dirty checking costs](14e-what-dirty-checking-costs.md).
- *You can opt out*, and there are several separate ways to do it, meaning different
  things → [14f · Turning it off](14f-turning-dirty-checking-off.md).

## Gotchas

**★ Calling `save()` on a managed entity does not cause the write, and removing it does
not prevent one.** Spring Data's `save` on an instance that is already managed delegates
to `merge`, which finds the instance already in the context and returns it. The write was
already scheduled by dirty checking. This is why deleting a "redundant" `save` call
almost never changes behaviour — and why adding one to "make sure it saves" is cargo cult.

**★ It only applies to MANAGED entities.** A detached instance has no snapshot in any
open context, so mutating it does nothing at all. This is the single most common "my
change did not save" report, and it is nearly always an entity that left its transaction
— see [12 · The four entity states](12-the-four-states.md).

**★ Setting a field back to its original value produces no `UPDATE`, which can break a
"touch the row to bump `updated_at`" idiom.** If your intent is to force a write, assign
a genuinely new value, or use `LockModeType.OPTIMISTIC_FORCE_INCREMENT` — covered in
[16c · Beyond `@Version`](16c-beyond-version.md).

**★ An exception thrown mid-method does not cancel the dirty state — the rollback does.**
The entity is still dirty and the flush would still write it; what stops the write is that
the transaction rolls back. In a method where the exception is caught and swallowed, the
transaction commits and the half-applied changes are written. That is
[**topic 04 · 14 · The caught exception**](../04-spring-transactional/14-the-caught-exception.md)'s
territory, and dirty checking is why it bites so hard: there is no explicit `save` call
sitting after the `try` block that you could have failed to reach.

**★ A read-only-looking method can still write.** Any `@Transactional` method that loads
an entity and mutates it — even in a helper, even in a `@PostLoad` callback that assigns
to a mapped field — produces an `UPDATE` at commit. There is no syntactic marker in the
method to warn you.

**★ `@PostLoad` that writes to a *mapped* field makes every read dirty.** The
*Introduction*'s own example assigns to a `transient` field for exactly this reason. If
the field is mapped, the entity now differs from its snapshot the instant it is loaded,
and every read transaction generates an `UPDATE`.

**★ The snapshot is of mapped state, so an unmapped field is invisible.** Changing a
`@Transient` or plain `transient` field is not a change as far as the comparison is
concerned — it is not in the snapshot and not in the current-state array. That is exactly
what those fields are for, and it is taken apart in
[14c · What counts as a change](14c-what-counts-as-a-change.md).

**★ Outside a transaction, entities come back detached — so nothing is watched.** With a
transaction-scoped persistence context, the specification says the entities resulting from a
`find` performed outside a transaction "will be detached". A `find` in a method with no
`@Transactional` therefore hands you an object that no comparison will ever see.

**★ A projection is not an entity and is never dirty-checked.** A constructor expression or an
interface projection produces a plain object with no identifier in the context, no snapshot
and no relationship to a row. Assigning to it is assigning to a value object.

**★ Two setters in the same transaction produce one `UPDATE`, not two.** The comparison
happens once per flush over the end state, so a field changed in one service and another field
changed in a second service arrive in a single statement — which is a feature, and also why
you cannot infer call order from the SQL.

**★ Dirty checking runs on every flush, and a flush can happen before a query.** So the
`UPDATE` does not necessarily land at commit — an auto-flush triggered by an overlapping
query can emit it in the middle of your method. If you were counting on ordering, see
[15b · What triggers a flush](15b-what-triggers-a-flush.md).

## Interview questions

**★ Why is there no `update()` method in JPA?**
Because a managed entity is already being watched. The persistence context holds the
instance and a snapshot of the state it was loaded with; at flush it compares the two and
writes the difference. An `update()` call would be redundant for a managed instance, and
for a detached one the operation that exists is `merge`, which is a different thing —
it copies state onto a managed instance and returns *that*.

**★ How does Hibernate know an entity changed if it never intercepted the setter?**
By default it does not intercept anything. It keeps the loaded state — an array of the
mapped values as of the last read or write — and does a field-by-field comparison at
flush time. This is called diff-based or snapshot-based dirty calculation. The
alternative, where the entity tracks its own changes, requires bytecode enhancement, and
in Hibernate 7.4 the setting that enabled it is deprecated for removal; see
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md).

**★ Where is the snapshot kept, and what does it cost?**
In the persistence context, next to the entity, for the lifetime of the context. It
roughly doubles the memory a managed entity occupies. It is also why the User Guide warns
that a long-lived session that loads too much "will grow endlessly until you get an
`OutOfMemoryException`".

**★ If I change a field twice and then change it back, how many `UPDATE`s do I get?**
None, assuming the final value equals the loaded value. The mechanism is a comparison of
end states, not a log of mutations.

**★ Two services in the same transaction both load order 42 and modify different fields.
How many `UPDATE`s?**
One. Both `find` calls return the same instance, both mutations land on that instance,
and one comparison at flush produces one statement covering both fields. If those services
instead each loaded, modified and explicitly saved, you would get two writes and the
second could overwrite the first's fields.

**★ I removed a `repository.save(entity)` line and the data still saves. Is that a bug?**
No — that is the design. Inside a transaction, on a managed entity, `save` adds nothing.
The line is worth keeping only when the entity might be new (so `persist` is needed) or
detached (so `merge` is needed), and in those cases the return value matters.

**★ Why is dirty checking described as a correctness feature rather than a convenience?**
Because it, together with the persistence context's one-instance-per-row guarantee, makes
the in-memory object the single source of truth for the unit of work. No two code paths
can produce competing writes for the same row, because there is only one object and one
comparison. Explicit-save designs do not have that property.

**★ Does dirty checking work outside a transaction?**
No, for a transaction-scoped persistence context: the specification says entities obtained
outside a transaction are detached, so there is nothing managed to compare. This is why a
service method that forgot `@Transactional` reads fine and silently writes nothing.

**★ Two different services modify the same entity in one transaction. How many statements?**
One. Both hold the same instance, and the flush compares its end state against one snapshot.
The SQL therefore tells you what the row became, not the order in which it got there.

**★ When exactly does the comparison run?**
At flush. That is at least once per transaction (before commit), possibly earlier if a
query overlaps pending changes, and whenever you call `flush()` yourself. It is not
continuous, and nothing happens at the moment you call the setter.

---

← Prev: [13c · remove, refresh, detach, clear](13c-remove-refresh-detach-clear.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14b · When the snapshot is taken](14b-when-the-snapshot-is-taken.md)
