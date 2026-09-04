---
title: "flushAutomatically and clearAutomatically both default to false — so by default a modifying query is executed against whatever the database already knows and leaves every managed entity holding the state it had before"
sidebar_label: "04b · Flush, clear and the stale context"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Modifying Queries"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> both attribute defaults read from the annotation source
> ([`Modifying.java`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/Modifying.java));
> Jakarta Persistence 3.2 §3.10 (`FlushModeType`) and §4.11
> ([spec](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**`@Modifying` has exactly two attributes and both are `false` by default. That is
worth stating flatly because the folklore usually gets one of them wrong: the
annotation's own source declares `flushAutomatically() default false` and
`clearAutomatically() default false`. So out of the box, a modifying query neither
pushes your pending changes to the database before it runs nor discards the stale
copies it leaves behind. Both attributes exist because the specification says the
persistence context is not synchronised with a bulk statement, and both are
decisions you should make on purpose.**

## The two attributes, and the order they act in

```java
@Modifying(flushAutomatically = true, clearAutomatically = true)
@Query("update User u set u.active = false where u.lastLogin < ?1")
int deactivateIdleSince(Instant cutoff);
```

The javadoc is precise about the timing, and the timing is the whole point:

- **`flushAutomatically`** — *"whether we should flush the underlying persistence
  context **before** executing the modifying query"*.
- **`clearAutomatically`** — *"whether we should clear the underlying persistence
  context **after** executing the modifying query"*.

One acts on what the statement can see; the other acts on what your code can see
afterwards. They solve different halves of the same problem and neither implies
the other.

⚠️ **The annotation's javadoc also widens the scope beyond what people expect:**
*"Queries that require a `@Modifying` annotation include `INSERT`, `UPDATE`,
`DELETE`, and DDL statements."* Provider-specific `insert … select` and DDL go
through the same switch.

## Flush before: what the statement can see

Your pending changes live in the persistence context until something writes them.
A bulk `update` is evaluated by the *database*, so any change that has not been
flushed is invisible to its `where` clause. Set the status of an entity in
memory, then run a bulk statement selecting on status, and the row is not
matched — not because JPA is confused, but because that value has not been sent
anywhere yet.

The specification's default flush mode covers a lot of this. Under
`FlushModeType.AUTO`:

> "the persistence provider is responsible for ensuring that all updates to the
> state of all entities in the persistence context which could potentially affect
> the result of the query are visible to the processing of the query. The
> persistence provider implementation may achieve this by flushing those entities
> to the database or by some other means."

Two reasons `flushAutomatically = true` still earns its place:

- **It does not depend on the provider's judgement** about which entities
  *"could potentially affect the result"*. That determination is heuristic and
  provider-specific; an explicit flush is not.
- 🔴 **It is the only thing that works when the flush mode is not `AUTO`.**
  `@Transactional(readOnly = true)` sets Hibernate's flush mode to `MANUAL`, and
  the specification is explicit that with `COMMIT` *"the effect of updates made to
  entities in the persistence context upon queries is unspecified"*. A modifying
  query inside a read-only boundary is a mistake in its own right, but it is the
  case where an implicit flush is guaranteed not to save you —
  [06 · flush](../06-jpa-hibernate-model/15-flush.md) and
  [topic 04 · read-only](../04-spring-transactional/15-read-only.md).

⚠️ **Flushing is not free and it is not local.** A flush writes *every* pending
change in the context, not just the ones relevant to your statement. On a method
that has been modifying entities for a while, `flushAutomatically = true` moves a
lot of work to a point you chose for a different reason.

## Clear after: what your code can see

This is the half the reference talks about, and its explanation of the default is
the argument for thinking rather than copying:

> "As the `EntityManager` might contain outdated entities after the execution of
> the modifying query, we do not automatically clear it … since this effectively
> drops all non-flushed changes still pending in the `EntityManager`."

So the default is `false` **to protect your unflushed work**, not because stale
entities are fine. `clear()` is not "refresh"; it detaches everything, and
anything not yet flushed is gone.

That gives a rule with two branches:

- **`clearAutomatically = true`** when the method continues to work with entities
  the statement touched. You will re-read them, which costs queries — and you must
  be sure nothing pending is being discarded.
- **`clearAutomatically = false`** (the default) when the bulk statement is the
  last thing the transaction does with those rows, or when it runs early enough
  that nothing has been loaded yet. This is the specification's own advice:
  *"before fetching or accessing entities whose state might be affected by such
  operations."*

🔴 **Clearing has a consequence nobody mentions until it bites: every managed
entity in that context becomes detached.** Lazy associations on those objects can
no longer be initialised, so code that worked fine before the bulk statement
starts failing after it — and it fails at a template or a mapper, far from the
repository method that caused it. That failure is
[10 · lazy-loading pitfalls](../10-lazy-loading/01-what-a-proxy-actually-is.md);
the entity-state half is
[06 · the four states](../06-jpa-hibernate-model/12-the-four-states.md).

## The safe shapes

Three arrangements that work, in order of preference:

1. **Run the bulk statement first, before anything is loaded.** No flush needed,
   nothing stale to clear, and the transaction reads the post-update state
   naturally.
2. **Give it its own transaction** — a separate service method with
   `REQUIRES_NEW`, or a dedicated job. A new persistence context is what the
   specification recommends, and it makes the blast radius explicit.
3. **`flushAutomatically = true, clearAutomatically = true`** when the statement
   has to sit in the middle of other work. Understand that you are paying a flush
   of everything and a detach of everything, and that anything you still need
   must be re-read afterwards.

⚠️ **What does not work is the arrangement people reach for first:** a bulk
statement in the middle of a long service method, defaults untouched, followed by
code that reads the same entities. The reads come from the persistence context,
so they return the pre-statement values, and if the method then modifies one of
those entities the dirty check writes the *old* value back over your bulk update.

## Gotchas

**⚠️ Believing `flushAutomatically` defaults to `true`.**
It does not — the annotation declares both attributes as `default false`. This
particular piece of folklore is common enough to be worth checking in the source
rather than trusting a blog, or a memory of one.

**⚠️ Assuming `clearAutomatically = true` refreshes your entities.**
It detaches them. Nothing is reloaded; the next access either re-reads from the
database (if you go back through a repository) or fails (if it was a lazy
association on an object you are still holding).

**⚠️ Turning on `clearAutomatically` in a method with unflushed changes.**
The reference is explicit that clearing *"effectively drops all non-flushed
changes still pending"*. Those changes are gone silently — no exception, no log,
just an update that never happens.

**⚠️ Combining `clearAutomatically = true` with a method that returns an
entity.**
The entity you are about to return has just been detached. Everything lazy on it
is now a landmine for the caller, and the caller has no way to know.

**⚠️ Running a modifying query inside a read-only transaction.**
The flush mode is `MANUAL`, so nothing implicit will save you, and the
transaction is declaring an intent it is not honouring. Either the boundary is
wrong or the query is in the wrong place.

**⚠️ Setting a field in memory and then filtering on it in a bulk statement.**
The database evaluates the `where` clause and has not seen your change unless
something flushed it. Under `AUTO` the provider decides whether the change
"could affect" the query; making that decision yours is exactly what
`flushAutomatically` is for.

**⚠️ Paying for a full flush you did not need.**
A flush writes every pending change in the context. On a method that has already
modified a hundred entities, turning on `flushAutomatically` for one bulk
statement moves a hundred inserts and updates to that line.

**⚠️ Reading the count and assuming the context agrees with it.**
`executeUpdate()` returns the number of rows the database changed. The objects in
your persistence context are unchanged, so a count of 500 and a managed entity
still showing the old value are both correct at the same time.

**⚠️ Putting the bulk statement between a load and a save.**
The dirty check at flush writes the entity's snapshot-derived state, which is the
pre-statement state. The bulk update is silently undone for exactly the rows you
also had loaded — the hardest version of this bug to reproduce, because it depends
on what happened to be in the context.

**⚠️ Using `clearAutomatically` as a substitute for a transaction boundary.**
Clearing empties the context; it does not commit anything, does not release locks,
and does not isolate the statement from the rest of the transaction. If the real
requirement is "this runs separately", that is a propagation decision.

**⚠️ Forgetting that the flush order still applies.**
`flushAutomatically` triggers a flush; it does not choose what order the provider
writes in. If the bulk statement depends on an insert that the provider orders
later, flushing does not fix it —
[06 · flush operation order](../06-jpa-hibernate-model/15c-flush-operation-order.md).

**⚠️ Copying both attributes onto every modifying method "to be safe".**
It is not safe, it is expensive and occasionally destructive: a full flush and a
full detach on every call, including the calls where neither was needed. These
are per-method decisions.

## Interview questions

**★ What are the defaults for `flushAutomatically` and `clearAutomatically`?**
Both `false`. The annotation source declares them that way, and it is worth
knowing precisely because the opposite is widely repeated. So by default a
modifying query neither flushes before nor clears after.

**★ What does each of them actually do?**
`flushAutomatically` flushes the persistence context *before* the query executes,
so pending changes are visible to the statement's `where` clause.
`clearAutomatically` clears it *after*, so the stale managed copies the statement
invalidated are detached rather than reused.

**★ Why is clearing not the default?**
Because clearing discards everything not yet flushed. The reference says so
directly: it *"effectively drops all non-flushed changes still pending in the
`EntityManager`"*. Making that the default would lose data for anyone who did not
expect it.

**★ Is `clearAutomatically = true` the same as refreshing?**
No. It detaches every entity in the context; nothing is reloaded. Code that
continues to use those objects is now working with detached instances, and any
lazy association on them will fail on first access.

**★ Under `FlushModeType.AUTO`, do you still need `flushAutomatically`?**
Often not, because the provider is required to make pending updates that could
affect the query visible to it. You need it when the flush mode is not `AUTO` —
notably inside a read-only transaction, where Hibernate's flush mode is `MANUAL`
— and when you would rather not depend on the provider's heuristic about which
entities matter.

**★ What is the specification's advice on where to run a bulk statement?**
In a transaction with a new persistence context, or before fetching or accessing
any entity whose state it might affect. Both amount to the same practical rule:
run it before you load things, or run it somewhere else.

**★ Describe the bug where a bulk update appears to be undone.**
The entity was already managed when the statement ran, so the context still holds
the old values. Later code touches that entity, the dirty check compares against
the pre-statement snapshot, and flush writes the old value back. The count from
`executeUpdate` was right; the row ended up wrong.

**★ What does a full flush cost?**
It writes every pending change in the context, not the ones related to your
statement. On a method that has been accumulating modifications, that is a large
amount of work relocated to the line where the bulk query happens to be.

**★ How do you decide these two flags for a given method?**
By asking what the method does next. Nothing with those rows → both `false` and
run it early. Continues to work with them → clear, and re-read what you need.
Has modified entities whose state the statement's predicate depends on → flush,
and consider whether the statement belongs in this method at all.

**★ A method sets `clearAutomatically = true` and returns an entity. What is
wrong?**
The returned entity is detached, so the caller gets an object whose lazy
associations cannot be initialised, with no signal that anything is different.
Either re-read what you return after the clear, or do not clear in a method that
hands entities out.

**★ Would you ever put both flags on every modifying method as a policy?**
No. It is a full flush and a full detach per call, applied to methods that need
neither, and it turns a correctness decision into an unexamined default. The
better policy is that every `@Modifying` method states its position in the
transaction — and most of them should be running first, where neither flag is
needed.

{/* FOOTER */}
