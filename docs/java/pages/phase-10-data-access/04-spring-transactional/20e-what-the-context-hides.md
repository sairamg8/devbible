---
title: "The persistence context answers reads the database never sees — which is why a lifecycle callback can silently never run and a second EntityManager does not help"
sidebar_label: "20e · What the context hides"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*, section *Testing ORM entity
> lifecycle callbacks*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `TestEntityManager` javadoc
> ([.../boot/jpa/test/autoconfigure/TestEntityManager.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jpa/test/autoconfigure/TestEntityManager.html))
> and the Jakarta Persistence 3.2 API for the entity-listener callbacks
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Framework 7.0.9, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**[20d](20d-what-a-test-must-assert.md) gave the rule: flush so the write reaches the
database, clear so the read comes back from it. This chunk is what that rule protects
you from, and it is not only constraint violations. An unflushed unit of work also
means entity lifecycle callbacks that never fire — a green test over an audit column
that production populates and the test leaves null, with no exception anywhere.**

## The callbacks that never fire

There is a second, quieter half of the flush warning, and the reference states it
under its own heading:

> Similar to the note about avoiding false positives when testing ORM code, if your
> application makes use of entity lifecycle callbacks (also known as entity
> listeners), make sure to flush the underlying unit of work within test methods that
> run that code. Failing to flush or clear the underlying unit of work can result in
> certain lifecycle callbacks not being invoked.

and then names them precisely:

> For example, when using JPA, `@PostPersist`, `@PreUpdate`, and `@PostUpdate`
> callbacks will not be called unless `entityManager.flush()` is invoked after an
> entity has been saved or updated. Similarly, if an entity is already attached to the
> current unit of work (associated with the current persistence context), an attempt
> to reload the entity will not result in a `@PostLoad` callback unless
> `entityManager.clear()` is invoked before the attempt to reload the entity.

Keep this separate from the constraint story, because the failure looks completely
different. A missing constraint check produces a green test and a production
exception — loud, eventually. A missing `@PostPersist` produces a green test over an
audit field, a search-index hook or a denormalised counter that simply never ran: no
exception anywhere, just data that is quietly wrong, in production, for months.

And notice the asymmetry the quote spells out. **`flush()` unlocks the write-side
callbacks; `clear()` unlocks `@PostLoad`.** They are not interchangeable, and a test
that only flushes still cannot see a `@PostLoad`. `@PrePersist` is the odd one out in
the other direction — it fires on `persist()` itself, before any flush, which is why
a test can pass on the `@PrePersist` half of an auditing pair and fail to notice the
`@PostPersist` half never happened.

## One persistence context, however many `EntityManager`s you inject

A tempting fix for the read-side problem is to inject a second `EntityManager` and
read through that instead of clearing. It does not work, and understanding why is
worth more than the trick would have been.

What Spring injects at an `@PersistenceContext` or `@Autowired EntityManager` field is
not an `EntityManager` — it is a shared, thread-bound proxy that looks one up per
call. Inside a transaction every such proxy resolves to the **same** underlying
persistence context bound to the thread, which is the mechanism
[7 · Thread binding](07-thread-binding.md) is entirely about. Two injected fields are
two references to one unit of work, and the first-level cache is shared between them.

```java
@Autowired EntityManager em;
@Autowired EntityManager other;   // ⛔ same persistence context, same cache
```

The only ways to genuinely read past the cache are `clear()` (detach everything),
`detach(entity)` (detach one), `refresh(entity)` (re-read that row), a native query
that bypasses the context, or a genuinely separate transaction — which is
[20h](20h-asserting-the-commit.md).

## Exercising both directions, not just the insert

Good flush/clear discipline is usually applied to the insert and stops there, so the
update path stays untested even in a careful suite. That path is different code:
Hibernate's dirty checking decides which columns go into the `UPDATE`, a `@Version`
column participates if there is one, and `@PreUpdate` / `@PostUpdate` fire instead of
the persist callbacks.

The shape that covers both is a double round trip:

```java
@Test
@Transactional
void the_price_column_round_trips_on_update() {
    long id = em.persistAndGetId(new Product("SKU-1", cents(100)), Long.class);
    em.flush();
    em.clear();                                  // ← end of the insert round trip

    Product loaded = em.find(Product.class, id); // a real SELECT
    loaded.reprice(cents(250));
    em.flush();                                  // ← the UPDATE is generated here
    em.clear();

    assertThat(em.find(Product.class, id).getPrice()).isEqualTo(cents(250));
}
```

Every `clear()` in that method is load-bearing. The first makes the load a real load.
The second makes the final assertion a real read rather than a look at the instance
the test just mutated — without it the assertion passes even if the `UPDATE` was never
generated at all, because dirty checking failed or the setter wrote to a transient
field.

`TestEntityManager` has `persistAndGetId(entity, Long.class)` for the first step,
which the javadoc describes as delegating to `EntityManager.persist(Object)` then
`getId(Object, Class)`, itself delegating to
`PersistenceUnitUtil.getIdentifier(Object)`. It is the honest way to get an id without
holding on to the entity reference you are about to want detached.

## `clear()`, `detach()` and `refresh()` are three different tools

They all get you past the first-level cache and they are not interchangeable:

| Call | What it does | Use it when |
|---|---|---|
| `clear()` | "Clear the persistence context, causing all managed entities to become detached." | you want the next read of *anything* to be a real read |
| `detach(entity)` | detaches one instance, leaves the rest managed | a large fixture you do not want to reload |
| `refresh(entity)` | "Refresh the state of the instance from the database, overwriting changes made to the entity, if any." | you want database-generated values on the instance you are holding |

`refresh` is the one people reach for expecting `clear` semantics. It re-reads the row
into the *same* Java object, so a later `find` still returns that object from the
context, and any `@PostLoad` behaviour tied to a fresh instantiation is not what a
production load would do. It is right for picking up a trigger-populated or
`@Generated` column; it is wrong as a general "make this read honest" tool.

⚠️ **`clear()` detaches the reference you were holding.** Any lazy association you
touch on that stale reference afterwards throws `LazyInitializationException`, and
passing it to `persist` throws rather than doing what you meant. Re-read into a new
local variable after every `clear()`, as the example above does, rather than
continuing to use the old one.

## Gotchas

**⚠️ Expecting `@PostPersist` to have run**
**Symptom:** an audit column, counter or index hook populated in production and empty
in the test, with no error anywhere.
**Cause:** the reference: those callbacks "will not be called unless
`entityManager.flush()` is invoked after an entity has been saved or updated".
**Fix:** flush before asserting on anything a lifecycle callback produces.

**⚠️ Expecting `@PostLoad` to have run after a flush**
**Symptom:** the write-side callbacks fire, the load-side one does not.
**Cause:** a different rule — `@PostLoad` needs `clear()` *before* the reload, because
an attached entity is not reloaded at all.
**Fix:** `clear()`, then read.

**⚠️ Injecting a second `EntityManager` to get an independent read**
**Symptom:** the read still comes back from the cache.
**Cause:** the injected object is a thread-bound shared proxy; inside a transaction
every one of them resolves to the same persistence context.
**Fix:** `clear()`, `detach()`, `refresh()`, a native query, or a separate transaction.

**⚠️ A mapping test that only ever inserts**
**Symptom:** `@PreUpdate` / `@PostUpdate` and the update path's column mapping are
untested, even in a suite that flushes correctly.
**Cause:** the flush discipline was applied to the insert and the test never issues an
update, so a dirty-checking or `@Version` problem never appears.
**Fix:** in a mapping test, load after a `clear()`, mutate, flush again, clear again,
and read once more. The second round trip is where the update path lives.

**⚠️ Continuing to use an entity reference after `em.clear()`**
**Symptom:** `LazyInitializationException` in a test, or an assertion that reads stale
values from a detached object.
**Cause:** `clear()` "caus[es] all managed entities to become detached" — every
reference the test is holding is now detached, including the one it is about to
assert on.
**Fix:** re-read into a fresh local after each `clear()`. Never assert on a variable
that was assigned before the clear.

**⚠️ `refresh()` used where `clear()` was meant**
**Symptom:** the test still cannot see a read-side mapping bug.
**Cause:** `refresh` re-reads the row into the same instance and leaves it managed, so
the next `find` is still served from the context.
**Fix:** `refresh` for picking up database-generated values on an instance you hold;
`clear` when the point is that the read must go to the database.

## Interview questions

**★ Your test asserts on an audit timestamp set by `@PostPersist` and it is null. Why?**
Because the callback never ran. The reference states it directly: `@PostPersist`,
`@PreUpdate` and `@PostUpdate` "will not be called unless `entityManager.flush()` is
invoked after an entity has been saved or updated". `persist()` alone only puts the
entity into the unit of work; the callbacks that correspond to actual statements fire
at flush time. Note that `@PrePersist` *does* fire on `persist()`, which is why a
suite can be green on half an auditing pair and blind to the other half.

**★ And the mirror image — why would `@PostLoad` not fire even in a test that flushes?**
Because `@PostLoad` is a read-side callback and flushing is a write-side action. The
reference: "if an entity is already attached to the current unit of work… an attempt
to reload the entity will not result in a `@PostLoad` callback unless
`entityManager.clear()` is invoked before the attempt to reload the entity". A
still-managed entity is not reloaded at all — the provider hands back the instance it
already has — so there is no load for the callback to hang off. `flush()` and
`clear()` are two different tools for two different halves, and knowing which one a
given symptom needs is the whole skill here.

**★ Why can you not just inject a second `EntityManager` and read through it to
bypass the first-level cache?**
Because what gets injected is not an `EntityManager` instance but a shared, thread-bound
proxy that resolves the current one per call. Inside a transaction, every such proxy
resolves to the same persistence context bound to the thread — that binding is the
whole mechanism by which `@Transactional` works at all. So two injected fields are two
references to one unit of work and one first-level cache. The real ways past it are
`clear()`, `detach()`, `refresh()`, a native query, or an actually separate
transaction.

**★ A suite has good flush/clear discipline on inserts and still misses an update bug.
How?**
Because the discipline was applied to one direction only. A test that persists,
flushes, clears and re-reads has proved the insert path; the update path involves
dirty checking, a `@Version` column if there is one, `@PreUpdate` / `@PostUpdate`, and
possibly a different set of columns in the generated `UPDATE`. None of that runs
unless the test loads the entity fresh, mutates it, and flushes again. The shape that
covers both is persist → flush → clear → load → mutate → flush → clear → load, and
the second half is the half people leave out.

**★ What is the difference between `clear()`, `detach()` and `refresh()` in a test?**
All three get you past the first-level cache, and they do different things. `clear()`
detaches everything — "caus[es] all managed entities to become detached" — so the next
read of anything is a real read; it is the blunt, correct default in a test.
`detach(entity)` does the same for one instance, which matters when a large fixture is
expensive to reload. `refresh(entity)` re-reads the row into the *same* Java object,
"overwriting changes made to the entity, if any", and leaves it managed — so it is the
right tool for picking up a database-generated or trigger-populated column on an
instance you are holding, and the wrong tool for proving a read goes to the database,
because a subsequent `find` still comes out of the context.

**★ Why does a `@Version` column change what a mapping test needs to do?**
Because the version is assigned by the provider during flush, not by your code, and it
changes across the update round trip. A test that persists, flushes and asserts sees
the initial version; only a second flush after a mutation shows the increment, and
only a re-read after a `clear()` shows the value the database actually holds. It is
also the thing that makes an insert-only test misleading in a different way: optimistic
locking failures happen on update, so a suite that never updates never exercises the
`@Version` column at all, and the first `OptimisticLockingFailureException` anyone sees
is in production.

**★ Your test calls `em.clear()` and then fails with `LazyInitializationException`.
What happened?**
The reference the test is still holding was detached by the clear — that is exactly
what `clear()` is documented to do — so touching an uninitialised lazy association on
it has no session to load through. It is not a transaction problem and it is not a
fetch-plan problem; it is a stale local variable. The fix is to treat every `clear()`
as invalidating every entity reference in scope and to re-read into a new local
immediately after, which is also what makes the following assertion honest.

---

← Prev: [20d · What a test must assert](20d-what-a-test-must-assert.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20f · Asserting the boundary exists](20f-asserting-the-boundary-exists.md)
