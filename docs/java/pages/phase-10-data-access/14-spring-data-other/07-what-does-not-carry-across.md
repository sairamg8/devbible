---
title: "Every JPA behaviour you never had to think about — dirty checking, the identity map, cascade, lazy loading, flush ordering — is absent here, and each absence turns an invisible convenience into code you must write"
sidebar_label: "07 · What does not carry across"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Template CRUD
> operations* and *Mapping*
> ([docs.spring.io/spring-data/mongodb/reference/](https://docs.spring.io/spring-data/mongodb/reference/index.html)),
> the Spring Data Redis 4.1 reference *Redis Repositories*
> ([docs.spring.io/spring-data/redis/reference/](https://docs.spring.io/spring-data/redis/reference/index.html))
> and the Spring Data Commons 4.1 repository documentation. JDK 25, Spring Boot 4.1.0,
> Spring Data Commons 4.1.0, Spring Data MongoDB 5.1.0, Spring Data Redis 4.1.0.

**A developer moving from Spring Data JPA to Spring Data MongoDB writes correct-looking
code immediately, which is the problem. The interface is the same, so the *habits* come
along — and the habits are built on a persistence context that does not exist here. This
chunk enumerates the absences one at a time, because "there is no persistence context" is
too abstract to change anyone's behaviour, and "your setter call does nothing" is not.**

## The one-line summary

| JPA | MongoDB | Redis |
|---|---|---|
| Persistence context (identity map) | none | none |
| Dirty checking | none | none |
| Managed / detached states | none | none |
| `merge`, `detach`, `refresh`, `clear` | none | none |
| Flush, write-behind, ordering | none | none |
| Lazy loading and proxies | only `DBRef`, and only inside a session | none |
| Cascade, orphan removal | none | none |
| Second-level cache | none | it *is* the cache |
| `@Version` optimistic locking | ✅ supported | not part of the repository model |
| Database-generated ids | client-side `ObjectId` | client-side, generated on save |

Everything with "none" in it is something you now write yourself.

## Dirty checking: the setter that does nothing

```java
// JPA — inside a transaction, this is an UPDATE
Order order = repository.findById(id).orElseThrow();
order.setStatus("SHIPPED");
```

That works because Hibernate keeps a snapshot of every loaded entity and compares it at
flush time ([06 · Dirty checking](../06-jpa-hibernate-model/14-dirty-checking.md)). Nothing
in MongoDB or Redis is watching the object. **The equivalent code is a no-op that reads
like a bug fix** — it compiles, it runs, it changes nothing, and the missing `save` call is
invisible in review because in JPA the `save` call would have been redundant.

Add the write and you get the second problem: `save` is a whole-document (MongoDB) or
whole-hash (Redis) replacement, so it writes back every field including the ones another
request changed since your read. The fix is a partial update —
[03b · Partial updates and find-and-modify](03b-partial-updates.md) for MongoDB,
`PartialUpdate` in [05c · Object-to-hash mapping and updates](05c-object-to-hash-mapping-and-updates.md)
for Redis — which means **"which fields am I actually changing?" becomes a question you
answer explicitly on every write path**. In JPA that question was answered by a snapshot
diff you never saw.

## No identity map, so no guaranteed identity

```java
Order a = repository.findById(id).orElseThrow();
Order b = repository.findById(id).orElseThrow();
// JPA, same transaction: a == b
// MongoDB or Redis: two objects, two round trips, always
```

Three consequences follow:

- **Repeated reads are repeated queries.** JPA's first-level cache made
  `findById` in a loop nearly free within a transaction; here every call goes to the server.
- **`==` is never right.** The equality rules in
  [06 · equals and hashCode](../06-jpa-hibernate-model/10-equals-and-hashcode.md) still
  apply — an id-based `equals` is still the answer — but the case where reference equality
  accidentally worked has vanished, which removes a bug and removes a crutch.
- **Two copies of one document can diverge in one request** and the last one saved wins,
  with no exception.

## No states, so no `merge` and no detached-object bugs

There is no managed state, so nothing can become detached. `save` always writes; it does
not have to decide whether the object came from this context. This is a genuine
simplification — the whole of
[06 · The four states](../06-jpa-hibernate-model/12-the-four-states.md) and
[06 · merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)
evaporates. What replaces it is that **every `save` is a blind overwrite**, so the class of
bug moves from "I forgot to merge" to "I overwrote a concurrent change".

MongoDB gives you a defence, and Redis does not. `@Version` on a MongoDB document
*"provides syntax similar to that of JPA in the context of MongoDB and makes sure updates
are only applied to documents with a matching version"*, raising
`OptimisticLockingFailureException` on a mismatch. Use it on anything a user edits. The
Redis repository model has no equivalent; the closest mechanism is `WATCH` in
[06c · Redis transactions](06c-redis-transactions.md), which is not part of the repository
API at all.

## No flush, so ordering is yours

Hibernate reorders and defers writes, which is why
[06 · What triggers a flush](../06-jpa-hibernate-model/15b-what-triggers-a-flush.md) is a
topic. Here, **a `save` is a command sent when you call it**. That is easier to reason about
and it removes a tool: there is no write-behind, no automatic batching, no reordering to
satisfy constraints. Ten saves are ten round trips unless you use `bulkOps` (MongoDB) or
pipelining (Redis), and you must ask for those by name.

## Lazy loading: nearly absent, and worse where it exists

There are no proxies. An object you load is fully materialised, so
`LazyInitializationException` cannot happen and neither can
[08 · the N+1 problem](../08-the-n-plus-1-problem/01-one-hundred-and-one-queries.md) in its
classic form — nothing navigates and silently queries.

The exception is MongoDB's `DBRef`, which *can* be lazy and which fails if the
`ClientSession` closes before it resolves. That is a smaller surface than JPA's and a
sharper edge: one feature, one failure mode, no `open-session-in-view` to paper over it.

Redis replaces the N+1 with something more predictable and no cheaper: an index query
returns ids, and each id costs an `HGETALL`. **N round trips, by design, visible in the
code.** Pipelining is the mitigation.

## No cascade and no orphan removal

`@OneToMany(cascade = ALL, orphanRemoval = true)` has no counterpart. In MongoDB the usual
answer is that there was no association to cascade — the children are *inside* the document,
so one write saves them all, which is the modelling pressure the store is built around. When
you do use `@DBRef` or `@DocumentReference`, saving the parent does not save the child.

In Redis the reference states it outright: referenced objects are not persisted when the
referencing object is saved, and you must persist them separately. There is no cascade, no
cascade delete, and no referential integrity — so
[07 · Cascade](../07-relationships-fetch/08-cascade.md) and
[07 · Orphan removal](../07-relationships-fetch/09-orphan-removal.md) describe machinery you
must now implement by hand, including the part where you decide what happens to a child
whose parent is gone.

## Identifiers are generated by your process

`@GeneratedValue(strategy = IDENTITY)` asks the database for a value and, as
[06 · IDENTITY kills batching](../06-jpa-hibernate-model/07b-identity-kills-batching.md)
explains, that round trip has consequences. Here there is no sequence and no identity
column: MongoDB's `ObjectId` is generated by the driver, and a Redis repository generates an
id when the field is null. Both are client-side.

That is mostly good — no round trip, no batching penalty, ids known before the write. It
costs you the guarantee that nothing else can mint a colliding id, and it means **the id
format is your application's decision and therefore your application's compatibility
problem** the day a second service writes the same collection.

## No second-level cache, because the question is different

Hibernate's second-level cache is a way to avoid hitting a database that is expensive to
hit. MongoDB is not obviously cheaper to cache in front of, and Redis *is* the cache — so
the mechanism does not exist here and the interesting question moves up a layer, to Spring's
cache abstraction in [12 · Caching](../12-caching/01-caching-is-a-decision.md), which is
about caching *anything* rather than about caching entities.

What does not carry across on the query side — JPQL, criteria, joins, projections, schema
and migrations — is [07b · Queries, schema and the exception you still recognise](07b-queries-schema-and-exceptions.md).

## Gotchas

**★ A setter on a loaded object writes nothing.** No dirty checking, no snapshot, no flush.
The `save` that was redundant in JPA is mandatory here, and forgetting it produces silence,
not an error.

**★ Adding the `save` introduces the lost update.** A whole-document or whole-hash write
puts back every field as you read it, including fields someone else changed. Partial updates
exist for exactly this and are not the default anywhere.

**★ Two `findById` calls give you two objects.** There is no identity map. Code that relied
on reference equality within a transaction — or on the first-level cache making repeat reads
free — behaves differently and costs more.

**★ `@Version` exists in MongoDB and not in the Redis repository model.** Optimistic locking
is available on one of the two stores in this topic, and only if you add the field.

**★ Saves are not batched or reordered.** Ten saves are ten round trips. There is no
write-behind to amortise them and no flush ordering to satisfy constraints, because there
are no constraints.

**★ A lazy `DBRef` outliving its `ClientSession` fails.** It is the only lazy thing in this
topic and it has no equivalent of open-session-in-view to hide it.

**★ Redis turns N+1 into N by design.** An index query yields ids and each id is a separate
`HGETALL`. It is not a bug, it is the data model, and pipelining is the only lever.

**★ Nothing cascades.** Saving a parent does not save a referenced child in either store,
and deleting a parent leaves the child. Referential integrity is application code now.

**★ Client-generated ids mean a duplicate is possible in principle.** `ObjectId` and UUID
collisions are vanishingly unlikely; an application that assigns ids from its own scheme is
where this stops being theoretical.

**★ The absence of a persistence context removes bugs as well as features.** No detached
entities, no `merge` returning a copy, no `LazyInitializationException`. Half of Phase 10's
JPA material is inapplicable, and the half that replaces it is about concurrent writes.

## Interview questions

**★ What is the single most important behavioural difference between Spring Data JPA and
Spring Data MongoDB?**
There is no persistence context, so there is no dirty checking. In JPA, mutating a managed
entity inside a transaction produces an `UPDATE`; here it produces nothing until you call
`save`, and `save` replaces the whole document.

**★ Why is calling `save` not a complete fix?**
Because it writes every field of the object you are holding, including fields another
request modified after your read. The correct fix is a partial update — `updateFirst` with an
`Update` in MongoDB, `PartialUpdate` in Redis — which sends only what changed.

**★ What replaces optimistic locking?**
In MongoDB, `@Version`, which the reference describes as providing syntax similar to JPA's
and which raises `OptimisticLockingFailureException` on a mismatch. In Redis there is no
repository-level equivalent; the nearest mechanism is `WATCH`, which lives on the template.

**★ Does N+1 exist in these stores?**
Not in its JPA form, because nothing is lazy and nothing navigates silently. MongoDB
replaces it with an explicit `$lookup` or an extra query you wrote. Redis replaces it with
one `HGETALL` per matched id, which is N round trips that are visible in the code and
mitigated only by pipelining.

**★ What happens to cascade and orphan removal?**
They are gone. MongoDB's answer is usually that the children are embedded, so one write
covers them; when you use references, nothing cascades. Redis states plainly that referenced
objects are not persisted with the referencing object. Deleting orphans is your code.

**★ How are identifiers generated?**
Client-side in both cases — the driver's `ObjectId` for MongoDB, and a generated value when
the id field is null for Redis. There is no sequence and no identity column, so there is no
round trip to fetch an id and no batching penalty from one.

**★ Which JPA problems simply disappear?**
Detached entities and `merge`, `LazyInitializationException`, flush-ordering surprises,
`getReference` semantics, and the identity-map subtleties around `equals`. The trade is that
every one of them is replaced by a concurrency question you now answer explicitly.

**★ Why is the familiar interface a liability rather than a benefit here?**
Because it transfers habits along with syntax. `findById`, mutate, return — with no `save` —
is correct JPA and a silent no-op in MongoDB. Nothing about the API signals the difference,
which is precisely why it reaches production.

{/* FOOTER */}
