---
title: "A transaction test is only worth something if it asserts on state the database actually produced — an assertion answered from the persistence context is an assertion about Java"
sidebar_label: "20d · What a test must assert"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `TestEntityManager` javadoc
> ([.../boot/jpa/test/autoconfigure/TestEntityManager.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jpa/test/autoconfigure/TestEntityManager.html))
> and the Jakarta Persistence 3.2 `FlushModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/.../flushmodetype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/flushmodetype)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Chunks [20b](20b-the-false-positives.md) and [20c](20c-the-other-ways-a-test-lies.md)
are about the ways a transaction test lies. This one and the four after it are about
what it has to say to stop lying. The first claim, and the one every suite gets
wrong at least somewhere, is that the value being asserted on came out of the
database and not out of the object the test itself constructed.**

## The three claims worth making

A test that touches a transaction is trying to prove one of a small number of things,
and each needs a different assertion:

| The claim | What it needs | Where |
|---|---|---|
| "the write reached the database and the database accepted it" | a **flush**, then a read that could not have been answered from memory | this chunk |
| "the persistence context is not answering for the database" | callbacks flushed, the context cleared, both directions exercised | [20e](20e-what-the-context-hides.md) |
| "there was a transaction here at all" | an assertion **inside** the call stack of the method under test | [20f](20f-asserting-the-boundary-exists.md) |
| "and it had the settings I asked for" | the same probe, reading the manager's other accessors | [20g](20g-asserting-the-settings.md) |
| "on failure nothing survived, on success everything did" | an assertion from a **different** transaction than the one under test | [20h](20h-asserting-the-commit.md) |
| "…and the rollback was ever covering that work at all" | the propagation of the boundary under test, and what a commit costs | [20i](20i-committing-and-what-participates.md) |
| "…against the database we actually deploy" | a committed fixture where one is needed, and a real engine | [20j](20j-the-fixture-and-the-real-database.md) |

Most suites attempt only the first, do it badly, and then describe the result as a
transaction test.

## Claim one: assert on the database, not on the persistence context

The mechanical rule from [20b](20b-the-false-positives.md) was *flush, then clear*. It
is worth restating as an assertion rule rather than a call-order rule, because that is
the form you can apply in a code review without running anything:

> **An assertion is about the database only if the value it reads could not have come
> from the object the test itself created.**

```java
// ⛔ asserts that Java assignment works
Product saved = products.create(new NewProduct("SKU-1"));
assertThat(saved.getSku()).isEqualTo("SKU-1");

// ⛔ still memory: findById is answered from the first-level cache
long id = products.create(new NewProduct("SKU-1")).getId();
assertThat(repository.findById(id).orElseThrow().getSku()).isEqualTo("SKU-1");

// ✅ the value has been through a real INSERT and a real SELECT
long id = products.create(new NewProduct("SKU-1")).getId();
em.flush();
em.clear();
assertThat(repository.findById(id).orElseThrow().getSku()).isEqualTo("SKU-1");
```

The middle case is the one that survives review, because it *looks* like a round
trip. It is not. The entity is still managed, so `find` returns the identical Java
object without issuing a `SELECT`, and nothing about the column mapping, the column
length, an `AttributeConverter`, a database default or a generated column has been
exercised.

### `TestEntityManager` makes the discipline one call

Spring Boot ships a test-only wrapper whose whole purpose is to make the correct
sequence short enough that people actually write it. The javadoc describes the class
as an

> Alternative to `EntityManager` for use in JPA tests. Provides a subset of
> `EntityManager` methods that are useful for tests as well as helper methods for
> common testing tasks such as `persist/flush/find`.

and the method that matters is `persistFlushFind`:

> Make an instance managed and persistent, synchronize the persistence context to the
> underlying database and finally find the persisted entity by its ID. Delegates to
> `persistAndFlush(Object)` then `find(Class, Object)` with the entity ID.
>
> Helpful when ensuring that entity data is actually written and read from the
> underlying database correctly.

```java
@DataJpaTest
class ProductMappingTests {

    @Autowired TestEntityManager em;

    @Test
    void the_sku_column_round_trips() {
        Product reloaded = em.persistFlushFind(new Product("SKU-1"));
        assertThat(reloaded.getSku()).isEqualTo("SKU-1");
    }
}
```

⚠️ **`persistFlushFind` does not clear.** Read the delegation chain in the javadoc:
`persistAndFlush` then `find`. There is no `clear()` in it, so if the entity is still
managed the `find` is answered from the persistence context. It guarantees the write
reached the database; it does not on its own guarantee the read came back from one.
Where the *read* path is the thing under test — a converter, a `@Formula`, a generated
column, a database default — `em.clear()` between the two is still yours to write.

In Boot 4.1 the class is
`org.springframework.boot.jpa.test.autoconfigure.TestEntityManager`. The pre-Boot-4
package `org.springframework.boot.test.autoconfigure.orm.jpa` is gone — the same
module reshuffle that moved `@DataJpaTest` to
`org.springframework.boot.data.jpa.test.autoconfigure`, and the same class of change
as `@MockBean` → `@MockitoBean` in [20c](20c-the-other-ways-a-test-lies.md).

## Gotchas

**⚠️ Asserting on the object the test just constructed**
**Symptom:** a green test over a mapping that does not work.
**Cause:** `save` returns the same instance, and `findById` may be answered from the
first-level cache with that same instance. No `SELECT` was issued.
**Fix:** `flush()` then `clear()`, or `persistFlushFind` plus a `clear()` when the read
path is what is under test.

**⚠️ Treating `persistFlushFind` as flush-and-clear**
**Symptom:** a read-side bug — a converter, a generated column, a database default —
that the test cannot see.
**Cause:** the javadoc says it delegates to `persistAndFlush` then `find`. There is no
`clear()` in that chain, so the entity is still managed.
**Fix:** call `em.clear()` yourself where the read matters.

**⚠️ `assertThat(repository.count()).isEqualTo(1)` as the whole assertion**
**Symptom:** the test catches a not-null violation but never catches a wrong column.
**Cause:** `count()` is a query, so `FlushModeType.AUTO` flushes before it and the
statement-time constraints *are* evaluated. But the assertion itself only says a row
exists — it reads none of its contents.
**Fix:** keep the count if you like it, and add a real re-read of the row after a
`clear()`. The flush it triggers is a side effect, not a guarantee to rely on.

## Interview questions

**★ A test does `repository.save(x)` then `repository.findById(id)` and asserts the
fields match. What has it actually proved?**
Very little. `save` leaves the entity managed in the persistence context, and
`findById` for an already-managed instance is answered from the first-level cache
without issuing a `SELECT` — so the assertion compares an object with itself. Nothing
about the column mapping, a length limit, a converter, a database default or a
generated column has been exercised, and because nothing was flushed the database
never evaluated a constraint either. Two calls fix it: `flush()` so the `INSERT` is
actually sent, and `clear()` so the read is a real read.

**★ What is the review rule for spotting that, without running the test?**
Ask whether the value being asserted on could have come from the object the test
itself created. If it could, the assertion is about Java, not about the database. It
is a surprisingly sharp rule: it flags `assertThat(saved.getX())` immediately, it
flags a `findById` with no intervening `clear()`, and it passes a re-read after a
clear, a projection query, or a count. It also explains why the fix is two calls
rather than one — `flush()` addresses the write side, `clear()` the read side.

**★ What does `TestEntityManager.persistFlushFind` guarantee, and what does it not?**
It guarantees the write reached the database: the javadoc says it delegates to
`persistAndFlush` and then `find`, so the `INSERT` is sent and any statement-time
constraint is evaluated. It does not guarantee the *read* came from the database,
because there is no `clear()` in that chain and `find` on a still-managed entity is
served from the persistence context. For a write-side mapping test that is usually
enough. For a converter, a `@Formula`, or a database-generated value, you still need
`em.clear()` between the flush and the read.

**★ Is `assertThat(repository.count()).isEqualTo(1)` a database assertion?**
Partly, and the "partly" is the interesting bit. `count()` executes a query, and
`FlushModeType.AUTO` is defined as "(Default) Flushing to occur at query execution",
so the pending `INSERT` is flushed first and the database really does evaluate the
not-null, unique, foreign-key and check constraints. To that extent it is a genuine
database assertion and better than nothing. But the value it returns is a row count:
it says a row exists and nothing whatsoever about what is in it. And the flush it
caused was incidental — a refactor that replaces it with an in-memory size check
silently removes the constraint coverage too. Flush explicitly and assert on the row.

---

← Prev: [20c · The other ways a test lies](20c-the-other-ways-a-test-lies.md) · Index: [Spring @Transactional](README.md) · Next → [20e · What the context hides](20e-what-the-context-hides.md)
