---
title: "There are five ways to stop paying for dirty checking, they are not interchangeable, and the one everyone reaches for does something different from what they think"
sidebar_label: "14f · Turning it off"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.15.2 *Entity
> immutability*, §13.2.3 *StatelessSession* and §16.3.7 *Querying for read-only entities*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §1.5 *Stateful and stateless sessions* and §5.10
> *Flushing the session*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> and the Spring Framework 7.0 `HibernateJpaDialect` and `JpaTransactionManager` sources
> ([github.com/spring-projects/spring-framework, branch 7.0.x](https://github.com/spring-projects/spring-framework/blob/7.0.x/spring-orm/src/main/java/org/springframework/orm/jpa/vendor/HibernateJpaDialect.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1.

**Read-only, immutable, `FlushMode.MANUAL` and `StatelessSession` all reduce the cost of
dirty checking, and each one reduces a different part of it. Read-only skips the snapshot.
`@Immutable` skips the entity permanently. Manual flush skips the *timing*, not the work.
A stateless session has no persistence context to check. And `@Transactional(readOnly =
true)` does one of these things — or two, depending on a condition most people do not know
exists.**

## 1 · Do not load an entity

The cheapest managed entity is the one that was never created. A query that selects a
record, a tuple or a DTO produces no managed instances, so it puts nothing in the
persistence context and adds nothing to any later flush.

This is the right answer far more often than the others on this page, and because it is
also the answer to several other problems in this phase, it is argued in full in
[topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

## 2 · Load entities read-only

Hibernate can load a perfectly ordinary mutable entity and simply not keep a snapshot for
it. The User Guide's §16.3.7:

> Fortunately, even mutable entities may be fetched in read-only mode, with the benefit of
> reduced memory footprint and of a faster flushing process. **Read-only entities are
> skipped by the dirty checking mechanism.**

There are four switches, at three different scopes. The *Introduction* lists the first
three:

> - `Session.setDefaultReadOnly(true)` specifies that all entities loaded by a given
>   session should be loaded in read-only mode by default,
> - `SelectionQuery.setReadOnly(true)` specifies that every entity returned by a given
>   query should be loaded in read-only mode, and
> - `Session.setReadOnly(Object, true)` specifies that a given entity already loaded by the
>   session should be switched to read-only mode.

and adds a fourth, per-`find`, using Hibernate's `FindOption` mechanism:

```java
var book = entityManager.find(Book.class, isbn, ReadOnlyMode.READ_ONLY);
```

From the JPA side the same thing is a query hint, `org.hibernate.readOnly`:

```java
List<Call> calls = entityManager
        .createQuery("select c from Call c where c.phone.number = :n", Call.class)
        .setParameter("n", phoneNumber)
        .setHint("org.hibernate.readOnly", true)
        .getResultList();

calls.forEach(c -> c.setDuration(0));   // no UPDATE — the entities are read-only
```

The *Introduction*'s closing line on all of this is the whole point: "It's not necessary
to dirty-check an entity instance in read-only mode."

⚠️ **Read-only means "changes are not written", not "changes are refused".** The setters
still work, the objects still change in memory, and nothing throws. If you were expecting
enforcement, you will not get it here.

## 3 · Declare the entity `@Immutable`

If a mapping can *never* be updated — a reference table, an append-only event row — say so
once on the class instead of at every call site. The User Guide names both savings:

> - reducing memory footprint since there is no need to retain the loaded state for the
>   dirty checking mechanism
> - speeding-up the Persistence Context flushing phase since immutable entities can skip
>   the dirty checking process

```java
@Entity
@Immutable
class AuditEvent {
    @Id Long id;
    Instant occurredAt;
    String message;
}
```

Changes are discarded silently — the User Guide's example modifies the message and no
`UPDATE` is generated. The entity can still be inserted and, unless the mapping says
otherwise, deleted; `@Immutable` is about *updateability*, not about the row's existence.

The placement rules matter and are in
[14c · What counts as a change](14c-what-counts-as-a-change.md): on a collection,
`@Immutable` **throws** instead of discarding, and `@Mutability` is not allowed on an
entity at all.

## 4 · `@Transactional(readOnly = true)` — what it actually does

This is the switch nearly every Spring application uses, and it is worth being precise,
because it is not one mechanism.

The four-layer story — Spring's flag, the transaction manager, the JDBC `Connection`, the
database — is
[topic 04 · 15 · Read-only](../04-spring-transactional/15-read-only.md) and
[15b · Where read-only pays](../04-spring-transactional/15b-where-read-only-pays.md).
What belongs *here* is the ORM layer, and there are two separate effects.

**Always: the flush mode becomes `MANUAL`.** `HibernateJpaDialect.prepareFlushMode` sets
`FlushMode.MANUAL` for a read-only transaction, with the comment "We should suppress
flushing for a read-only transaction." No automatic flush means no `UPDATE` is emitted —
**but the snapshot was still taken and the entities are still in the context**. You have
suppressed the write, not the work.

**Sometimes: the session also becomes read-only by default.** `beginTransaction` calls
`session.setDefaultReadOnly(true)` — the real snapshot-skipping switch from §2 above — but
only when the transaction definition is a `ResourceTransactionDefinition` whose
`isLocalResource()` is true. `JpaTransactionManager` supplies that flag from
`isNewEntityManagerHolder()`: it is true when the transaction opened a fresh
`EntityManager` for itself, and false when one was already bound to the thread.

🔴 **So `spring.jpa.open-in-view=true` weakens `readOnly = true`.** With open-in-view on,
an `EntityManager` is bound to the request before your service method runs, the
transaction reuses it, `isNewEntityManagerHolder()` is false, and `setDefaultReadOnly(true)`
is never called. You keep the manual flush mode and lose the snapshot saving. This follows
directly from the two sources above; I have not found it stated in the Spring reference
documentation, so treat it as read from the 7.0.x source rather than as a documented
contract. [18c · `open-in-view`](18c-open-in-view.md) is the rest of that argument.

## 5 · Use a stateless session

The most complete answer, because it removes the persistence context rather than
configuring it. The User Guide's §13.2.3:

> `StatelessSession` […] provides a command-oriented API with no associated persistence
> context. […] there's no first-level cache, and **there's no transactional write-behind or
> automatic dirty checking.** Instead, persistence operations occur synchronously when a
> method of `StatelessSession` is invoked, and entities returned by a stateless session are
> always detached.

It is a real trade, and the User Guide lists what you give up: operations "never cascade to
associated instances", lazy loading "is not transparent, and is only available via an
explicit operation named `fetch()`", operations "bypass Hibernate's event model and action
queue", and without a first-level cache stateless sessions "are vulnerable to data
aliasing effects".

What changed in Hibernate 7 is how seriously the project treats it. The *Introduction* is
unusually candid:

> Among our biggest regrets is that we didn't give enough love to `StatelessSession` twenty
> years ago. […] In Hibernate 7, we've fixed this mistake. A `StatelessSession` now offers
> essentially all the functionality of Hibernate except, naturally, the first-level cache.
> […] we messed up here. […] **You don't have to use stateful sessions, and you're not
> doing anything wrong if you decide to use stateless sessions instead.**

And, on this page's subject specifically: "`StatelessSession` even guards against
accidental updates, since `update()` is always an explicit operation."

## What `FlushMode.COMMIT` and `MANUAL` are *not*

Changing the flush mode moves *when* the comparison happens. It does not remove it. With
`COMMIT`, the walk still occurs — once, at commit — over every entity in the context, and
the *Introduction* warns that in the meantime "queries might return stale data". That is
[15 · Flush](15-flush.md), not a dirty-checking optimisation.

## Choosing

| You want | Use |
|---|---|
| never to load the entity | a projection query |
| this query's results not written | `setReadOnly(true)` / the `org.hibernate.readOnly` hint |
| this whole unit of work not written | `Session.setDefaultReadOnly(true)`, or `@Transactional(readOnly = true)` with a fresh `EntityManager` |
| this row never updatable, anywhere | `@Immutable` on the entity |
| this one column never updatable | `@Column(updatable = false)` |
| no persistence context at all | `StatelessSession` |

## Gotchas

**★ Read-only does not prevent writes, it prevents the write being detected.** Setters
work, the object changes, nothing throws, and the change is silently lost at the end of
the unit of work. Code that "worked in tests" because the assertion read the in-memory
object will fail against the database.

**★ `@Transactional(readOnly = true)` suppresses the flush before it skips the snapshot,
and only sometimes does the second.** With an `EntityManager` already bound to the thread —
which is what open-in-view does — you get `FlushMode.MANUAL` only.

**★ `readOnly = true` is a hint at every layer above Hibernate.** The `@Transactional`
javadoc: "This just serves as a hint for the actual transaction subsystem; it will *not
necessarily* cause failure of write access attempts."

**★ An entity switched to read-only after it was already dirty does not un-dirty.**
`Session.setReadOnly(Object, true)` changes how the instance is treated from that point;
it is not a way to cancel changes already made. Use `refresh` for that, and read
[13c](13c-remove-refresh-detach-clear.md) first.

**★ `@Immutable` discards updates silently on an entity but throws on a collection.** Same
annotation, two failure modes, decided by placement.

**★ `@Immutable` does not make the entity read-only for *inserts*.** New instances are
still persisted. If your intent is "this table is never written by the application", that
is a database grant, not a mapping annotation.

**★ A `StatelessSession` gives up cascading silently.** Persisting a parent does not
persist its children; there is no exception, just missing rows. The same is true of
`remove`.

**★ Without a first-level cache, a stateless session can hand you two different objects for
the same row.** The User Guide calls this being "vulnerable to data aliasing effects", and
it is the precise property that
[11 · The persistence context](11-the-persistence-context.md) exists to provide.

**★ `FlushMode.MANUAL` plus an entity you did intend to save is a silent data-loss bug.**
Under a read-only transaction the write simply never happens. This is why "make everything
read-only by default and override where needed" is safe only if the override is actually
applied — and the failure is silent when it is not.

**★ Spring Data's `@Transactional(readOnly = true)` on repository read methods means you
are already using this.** `SimpleJpaRepository` is annotated read-only at the class level
with the write methods overriding it, so every derived finder already runs this way.

## Interview questions

**★ What does "read-only mode" mean for a Hibernate entity?**
That the persistence context does not retain a loaded state for it, so it is skipped by
dirty checking and produces no `UPDATE`. The object is still fully mutable in Java; the
change is simply never detected.

**★ Name the ways to load an entity read-only.**
`Session.setDefaultReadOnly(true)` for a whole session; `SelectionQuery.setReadOnly(true)`
or the JPA hint `org.hibernate.readOnly` for one query; `Session.setReadOnly(Object, true)`
for one already-loaded instance; and `ReadOnlyMode.READ_ONLY` as a `FindOption` on `find`.

**★ What does `@Transactional(readOnly = true)` do at the Hibernate level?**
It sets the Hibernate flush mode to `MANUAL`, which suppresses the automatic flush and
therefore the writes. Additionally — when the transaction opened its own `EntityManager` —
it calls `Session.setDefaultReadOnly(true)`, which is what actually skips the snapshot.

**★ Why might `readOnly = true` fail to skip the snapshot?**
Because the second effect is conditional on the transaction being the one that created the
`EntityManager`. If an `EntityManager` was already bound to the thread — the open-in-view
case — the dialect takes the other branch and only the flush mode changes.

**★ Is `readOnly = true` enforcement?**
No. The `@Transactional` javadoc calls it a hint that "will not necessarily cause failure
of write access attempts", and says a transaction manager that cannot interpret it will
"silently ignore" it. What enforcement exists comes from lower layers — the JDBC
connection and the database — not from JPA.

**★ How is `@Immutable` on an entity different from loading it read-only?**
Scope and permanence. `@Immutable` is a mapping decision that applies everywhere and
always, and lets Hibernate skip retaining the loaded state for that entity at all.
Read-only is a per-session, per-query or per-instance decision made at runtime.

**★ When would you use a `StatelessSession` instead?**
When you do not want a persistence context — bulk processing, streaming, ETL, or simply a
programming model with explicit writes. Hibernate 7 brought it to near feature parity with
`Session` and the documentation explicitly says choosing it is not doing anything wrong.
The costs are no cascading, explicit `fetch()` for associations, and no identity map.

**★ Does setting `FlushMode.COMMIT` reduce dirty checking?**
No. It reduces how often the comparison runs — once at commit rather than before
overlapping queries too — but the walk over the whole context still happens, and queries in
the meantime can see stale data.

**★ Your service is annotated `readOnly = true` and a change silently did not save. Where
do you look first?**
At the annotation. Under a read-only transaction the flush mode is `MANUAL`, so nothing is
written and nothing complains. It is the same failure shape as modifying a detached
entity, and it produces the same "the code ran and the database did not change" report.

---

← Prev: [14e · What dirty checking costs](14e-what-dirty-checking-costs.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [15 · Flush](15-flush.md)
