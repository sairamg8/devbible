---
title: "The cache-hit test proves reads, and every stale-data incident is a write — so the tests that matter most are the ones about the key the entry landed under, the null that got cached, and the eviction that addressed a different entry"
sidebar_label: "09a2 · Keys, nulls and eviction"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.8** reference *Cache Abstraction*,
> read from the `v7.0.8` sources —
> [`cache/annotations.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/integration/cache/annotations.adoc)
> for default key generation, custom keys, `condition`/`unless`, `Optional` handling,
> `@CacheEvict` on `void` methods and `allEntries`, and synchronized caching; and
> [`cache/strategies.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/integration/cache/strategies.adoc)
> for the concurrency statement — every quoted sentence is from one of those two. Plus the
> `v7.0.8` source of
> [`ConcurrentMapCacheManager`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-context/src/main/java/org/springframework/cache/concurrent/ConcurrentMapCacheManager.java)
> for the `allowNullValues` default.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output or timings.

**[09](09-caching-and-idempotency.md) made the cache-hit assertion possible and
[09a](09a-the-cache-that-outlives-the-test.md) stopped a previous test class from answering
it for you. Both are about the read path, and the read path is not where caching goes wrong
in production. This chunk is the other three questions, each of which produces a green
cache-hit test and a real incident: did the entry land under a key that is actually yours,
did the cache store a `null` it will now serve forever, and does the write that changed the
data address the same entry the read created.**

## 🔴 The key, and the collision the default generator makes easy

The default `KeyGenerator`'s algorithm is documented exactly:

> *"If no parameters are given, return `SimpleKey.EMPTY`."*
> *"If only one parameter is given, return that instance."*
> *"If more than one parameter is given, return a `SimpleKey` that contains all parameters."*

Read the middle line again. **With a single argument, the key *is* the argument** — no method
name, no class name, nothing that distinguishes one method from another. So:

```java
@Cacheable("books") Book findByIsbn(String isbn);
@Cacheable("books") Book findByTitle(String title);   // 🔴 same cache, same key space
```

`findByTitle("978-1")` returns whatever `findByIsbn("978-1")` cached. The cache name is the
namespace, and two methods sharing a cache name with same-typed single arguments share a key
space. This is not a bug in Spring — the algorithm is documented and reasonable — it is a
consequence people do not notice until a lookup returns an object of the right type and the
wrong identity.

The test that catches it is a *cross-method* test, and almost nobody writes one:

```java
@Test
void twoLookupMethodsDoNotShareCacheEntries() {
    given(books.findByIsbn("x")).willReturn(new Book("isbn-result"));
    given(books.findByTitle("x")).willReturn(new Book("title-result"));

    assertThat(catalogue.byIsbn("x").id()).isEqualTo("isbn-result");
    assertThat(catalogue.byTitle("x").id()).isEqualTo("title-result");   // fails if they collide
}
```

The fixes are a separate cache name per method, or an explicit `key` — the reference's own
examples use SpEL: `@Cacheable(cacheNames="books", key="#isbn")` and
`key="T(someType).hash(#isbn)"`. The reference also notes the default strategy
*"works well for most use-cases, as long as parameters have natural keys and implement valid
`hashCode()` and `equals()` methods"* — which is the second half of the same trap, because a
key object without `equals` gives you a cache that never hits and a `verify(times(2))` you
will misread as a disabled cache.

## Cached nulls, which turn a missing row into a permanent one

`ConcurrentMapCacheManager`'s own javadoc on `setAllowNullValues`:

> *"Specify whether to accept and convert `null` values for all caches in this cache manager.
> Default is `"true"`, despite `ConcurrentHashMap` itself not supporting `null` values. An
> internal holder object will be used to store user-level `null`s."*

**Nulls are cached by default.** A lookup for an entity that does not exist yet caches the
absence, and every later lookup — including the one after the entity is created — is served
from the cache. The behaviour is right for a read-mostly reference table and catastrophic for
a "poll until it appears" flow.

`Optional` has the same shape, stated in the reference:

> *"The cache abstraction supports `java.util.Optional` return types. If an `Optional` value
> is present, it will be stored in the associated cache. If an `Optional` value is not
> present, `null` will be stored in the associated cache."*

The control is `unless`, which the reference distinguishes from `condition` by *when* it runs:
*"Unlike `condition`, `unless` expressions are evaluated after the method has been invoked."*
So `unless = "#result == null"` is the switch, and for `Optional` the reference's own example
uses the safe-navigation form, noting *"`#result` still refers to `Book` and not
`Optional<Book>`"*.

The test is two calls with a `given` that changes in between:

```java
@Test
void doesNotCacheAMissingProduct() {
    given(products.findByIsbn("978-9")).willReturn(null);
    assertThat(catalogue.byIsbn("978-9")).isNull();

    given(products.findByIsbn("978-9")).willReturn(new Product("978-9", "Later"));
    assertThat(catalogue.byIsbn("978-9")).isNotNull();     // fails if the null was cached

    verify(products, times(2)).findByIsbn("978-9");
}
```

## Eviction, which is the half that has a bug

A cache-hit test proves reads. The bug in production is almost always a **write that did not
invalidate**, and it needs its own test in the opposite shape — assert the call *does* happen:

```java
@Test
void updatingAProductEvictsIt() {
    given(products.findByIsbn("978-1")).willReturn(new Product("978-1", "Old"));
    catalogue.byIsbn("978-1");                                   // populate

    catalogue.rename("978-1", "New");                            // @CacheEvict

    given(products.findByIsbn("978-1")).willReturn(new Product("978-1", "New"));
    assertThat(catalogue.byIsbn("978-1").title()).isEqualTo("New");
    verify(products, times(2)).findByIsbn("978-1");               // the second call happened
}
```

Two documented details that decide whether this passes for the right reason. `@CacheEvict`
works on `void` methods — *"`void` methods can be used with `@CacheEvict` — as the methods act
as a trigger"* — and when `allEntries` is used, *"the framework ignores any key specified in
this scenario as it does not apply"*. And 🔴 **the eviction must use the same key the read
used**, which is where the single-argument key rule above stops being trivia: a read keyed on
an `isbn` string and an evict keyed on a `Product` object do not touch the same entry, and
both annotations look correct.

## `sync`, and what a test can honestly claim about it

The reference is blunt about the default:

> *"In a multi-threaded environment, certain operations might be concurrently invoked for the
> same argument (typically on startup). By default, the cache abstraction does not lock
> anything, and the same value may be computed several times, defeating the purpose of
> caching."*

> *"No locks are applied, and several threads may try to load the same item concurrently. The
> same applies to eviction."*

`sync = true` instructs the provider to lock the entry while the value is computed, and the
reference adds the caveat: *"This is an optional feature, and your favorite cache library may
not support it. All `CacheManager` implementations provided by the core framework support
it."*

⚠️ **I would not write a test that asserts `sync = true` prevents a duplicate computation.**
A test that launches N threads and asserts exactly one invocation is asserting a timing
property; without the lock it is *likely* to see more than one call and not guaranteed to, so
the test is flaky in the direction that matters — it can pass on a build where the annotation
was deleted. What is worth asserting is the cheap, deterministic part: that concurrent callers
all receive an equal value and that no exception escaped. Treat `sync` as a configuration
review item rather than a test target, and if the stampede is genuinely load-bearing, the
honest instrument is a load test, not a unit test.

## Where this connects

- The cache-hit test, the proxy requirement, and the two arrangements that make the assertion
  impossible: [09 · Caching, and the cache-hit test](09-caching-and-idempotency.md).
- Test isolation — the context cache, clearing, `@DirtiesContext`, and asserting cache
  contents rather than call counts:
  [09a · The cache that outlives the test](09a-the-cache-that-outlives-the-test.md).
- The same "did this happen twice" question with money attached:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The proxy rule that also decides whether a `@CacheEvict` on a self-invoked method runs at
  all: [06c · Method security with no request](06c-method-security-with-no-request.md).
- **Topic 04 · Mockito** owns `verify` and `times(n)` —
  [`../04-mockito/05-verification.md`](../04-mockito/05-verification.md).

## Gotchas

**★ With one argument the default key *is* the argument, so two methods sharing a cache name share a key space.**
The documented algorithm says *"If only one parameter is given, return that instance."* — no method name, no class. `findByIsbn(String)` and `findByTitle(String)` on `@Cacheable("books")` will serve each other's entries, returning an object of the right type and the wrong identity. Separate cache names, or an explicit `key`, and a cross-method test that would have caught it.

**★ A key object without a correct `equals`/`hashCode` gives you a cache that never hits, and the symptom reads as a disabled cache.**
The reference's caveat is *"as long as parameters have natural keys and implement valid `hashCode()` and `equals()` methods"*. A record is fine; a class that inherits identity equality is not. The test failure is `verify(times(2))` when you expected one, which is the exact same symptom as a `NoOpCacheManager` — so people check the configuration, find it correct, and stall.

**★ `null` results are cached by default, so a lookup for something that does not exist yet is answered from the cache forever.**
`ConcurrentMapCacheManager` documents its `allowNullValues` default as `"true"`, using *"an internal holder object"* to store user-level nulls. In a "create it, then poll for it" flow that means the poll never sees the created entity. `unless = "#result == null"` is the switch, and the test is two calls with the stub changed in between.

**★ An empty `Optional` is stored as a `null`, so `Optional` does not opt you out of the previous gotcha.**
The reference: *"If an `Optional` value is not present, `null` will be stored in the associated cache."* And `#result` in `condition`/`unless` refers to the unwrapped value, not the `Optional` — the documented form uses safe navigation, `unless="#result?.hardback"`. Writing `unless="#result.isEmpty()"` against an `Optional` return type is testing the wrong object.

**★ `condition` runs before the invocation and `unless` runs after, and swapping them produces an expression that cannot work.**
The reference states it: *"Unlike `condition`, `unless` expressions are evaluated after the method has been invoked."* So `#result` is only available in `unless`, and an argument-based guard belongs in `condition` where it can skip the lookup entirely. A `condition` referencing `#result` is not a subtle bug, but an `unless` doing argument checks silently costs you a cache lookup on every call.

**★ The eviction has to use the same key the read used, and two correct-looking annotations can address different entries.**
A `@Cacheable` keyed on an `isbn` string and a `@CacheEvict` keyed on the `Product` object are operating on different keys in the same cache. Both compile, both are annotated, neither is wrong in isolation, and the stale entry survives every write. The write-path test — populate, mutate, read again, assert the second repository call happened — is the only thing that catches it.

**★ `@CacheEvict` on a `void` method is deliberate, and `allEntries` makes the key irrelevant.**
The reference notes that *"`void` methods can be used with `@CacheEvict` — as the methods act as a trigger"*, and that with `allEntries` *"the framework ignores any key specified in this scenario as it does not apply"*. A key left on an `allEntries = true` eviction reads as a targeted invalidation and is not one, which matters when somebody later removes `allEntries` believing the key was doing something.

**★ Asserting that `sync = true` prevents duplicate computation produces a flaky test that can pass with the annotation deleted.**
Without the lock, concurrent callers are *likely* to compute more than once and not guaranteed to. A test asserting exactly one invocation under N threads is asserting a scheduling outcome. The deterministic part — every caller gets an equal value, nothing threw — is worth asserting; the stampede itself belongs to configuration review or a load test.

## Interview questions

**★ Two `@Cacheable` methods on the same service both take a `String` and use the same cache name. What is wrong?**
They share a key space, so one will serve the other's entries. The default `SimpleKeyGenerator` is documented as returning the parameter itself when there is exactly one — nothing about the method or the class is in the key — and the cache name is the only namespace. So `findByTitle("978-1")` gets whatever `findByIsbn("978-1")` cached, and the result is an object of the correct type with the wrong identity, which is about as hard to debug as it gets. The fixes are separate cache names or an explicit SpEL `key`, and the test is a cross-method one: stub both repository calls to return distinguishable objects, call both through the cached entry points with the same argument, and assert each got its own. Almost nobody writes that test, which is why this survives review.

**★ Your service caches a lookup for an entity that a background job creates a few seconds later. What breaks?**
The absence gets cached. Spring's default for the framework's own map-based manager is `allowNullValues = true` — the javadoc says the default is `"true"` and that an internal holder object stores user-level nulls — so the first lookup, which found nothing, is a cache entry, and every subsequent lookup is served from it including the ones after the entity exists. It looks like the background job never ran. The fix is `unless = "#result == null"`, and if the method returns an `Optional` the same applies, because the reference says an absent `Optional` is stored as a `null` and `#result` refers to the unwrapped value. The test is two calls with the repository stub changed between them, asserting the second call reaches the repository.

**★ You have a green cache-hit test and a stale-data incident in production. Where do you look?**
At the write path, because the read test proves reads and stale data is a write problem. Three specific things, in order. First, whether the mutating method evicts at all — a `@CacheEvict` that was never added, which no read test can detect. Second, whether the eviction uses the *same key* as the read; a `@Cacheable` keyed on an id and a `@CacheEvict` keyed on the entity object address different entries and both look correct in review. Third, whether the mutation goes through the proxy — a write performed by a method calling another method of the same object is not intercepted, exactly as for `@Cacheable`, so the eviction annotation is inert. The test that would have caught all three is the opposite shape from the hit test: populate, mutate, read again, and assert that the repository *was* called a second time.

{/* FOOTER */}
