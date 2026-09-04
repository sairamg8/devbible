---
title: "A passing cache test is not evidence of a working cache, because the entry it observed may have been left in the reused application context by a test class that ran minutes earlier — and a false pass is the one failure mode nobody investigates"
sidebar_label: "09a · The cache that outlives the test"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.9** source of
> [`Cache`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-context/src/main/java/org/springframework/cache/Cache.java)
> at tag `v7.0.8` — the `get(Object)`, `clear()`, `evict(Object)`, `evictIfPresent(Object)`
> and `invalidate()` declarations, and the `get` javadoc quoted below verbatim — and the
> **Spring Framework 7.0.9** reference *Cache Abstraction*
> ([`cache/strategies.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/integration/cache/strategies.adoc)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output or timings.

**[09](09-caching-and-idempotency.md) covered the two arrangements that decide the cache-hit
assertion before you write it — no proxy, or no cache. Both produce failures, which is the
good kind of wrong: somebody investigates. This chunk is the other kind. The `CacheManager`
is a singleton bean inside an `ApplicationContext` that the TestContext framework reuses
across test classes, so the entry your test observes may have been written minutes ago by a
class you have never read. That produces a false *pass*, and nobody investigates a green
test. Then the assertion that distinguishes a genuine cache hit from a method that simply
returned early — which the call count cannot.**

## 🔴 The context is cached, so the cache is warm before your test starts

Two different caches are in play and conflating them is the whole problem.

The Spring TestContext framework **caches `ApplicationContext` instances** across test classes
that request the same configuration — that reuse is why a suite of `@SpringBootTest` classes
finishes in minutes rather than hours, and **topic 05 · The test pyramid** owns it. Your
`CacheManager` is an ordinary **singleton bean inside that reused context**. It has no test
lifecycle. Nothing resets it between methods, and nothing resets it between classes.

- Entries written by test method 1 are visible to test method 2.
- Entries written by `CatalogueCachingTest` are visible to `OrderFlowTest`, if both resolve
  to the same context configuration.
- Execution order therefore decides the outcome, which is why it fails in CI and not locally,
  or on one machine and not another.

The failure is recognisable in two shapes and only one of them gets noticed:

- **A test asserting a *miss* fails.** `verify(products, times(1))` reports zero calls,
  because the entry was already there. Someone investigates.
- **A test asserting a *hit* passes for the wrong reason.** Your first call was itself served
  from a previously warmed entry, so the repository was called once — by a different test
  class, minutes earlier. The assertion is satisfied and your caching could be entirely
  broken. Nobody investigates a green test.

### The fix is two lines and it is not optional

```java
@BeforeEach
void clearEveryCache() {
    caches.getCacheNames().forEach(name -> caches.getCache(name).clear());
}
```

`clear()` is on the `Cache` interface alongside `evict(Object)`, `evictIfPresent(Object)` and
`invalidate()`. Iterating `getCacheNames()` rather than naming one cache is deliberate: the
class under test is rarely the only cacher in a Boot context, and the entry that breaks your
test is usually somebody else's.

⚠️ **`@DirtiesContext` also fixes it and is the wrong tool.** It evicts the whole
`ApplicationContext` from the TestContext cache, so the next class needing that configuration
pays a full context start. You would be trading two lines for minutes of suite time to solve
a problem the two lines solve completely. `@DirtiesContext` is for bean *state* that cannot
be reset any other way; a cache can.

## The assertion that says *why* the call did not happen

A call count of one tells you the repository was not called twice. It does not tell you the
value came from the cache — a guard clause, a null-argument fast path, or a feature flag that
short-circuits the method produce exactly the same count. Assert the contents:

```java
assertThat(caches.getCache("products").get("978-1")).isNotNull();               // present
assertThat(caches.getCache("products").get("978-1").get()).isEqualTo(expected); // and correct
```

`Cache.get(Object)`'s contract is precise and the precision is the point:

> *"Returns `null` if the cache contains no mapping for this key; otherwise, the cached value
> (which may be `null` itself) will be returned in a `ValueWrapper`."*

> *"A straight `null` being returned means that the cache contains no mapping for this key."*

So a `ValueWrapper` means **present**, and it may wrap a cached `null`. Calling `.get()`
before checking for null turns "absent" into a `NullPointerException` in your test rather than
a readable assertion failure. This is also the only assertion available when the cache is
populated by `@CachePut` or by an explicit `cache.put(...)`, where there is no second call to
count.

## Where this connects

- The cache-hit test itself, the proxy requirement, and the two arrangements that make the
  assertion impossible: [09 · Caching, and the cache-hit test](09-caching-and-idempotency.md).
- The correctness traps that also produce a green test — the key the entry landed under, the
  cached `null`, the eviction that addressed a different entry, and `sync`:
  [09a2 · Keys, nulls and eviction](09a2-keys-nulls-and-eviction.md).
- The idempotency problem, which is the same "did this happen twice" question with money
  attached: [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The identical proxy rule for method security:
  [06c · Method security with no request](06c-method-security-with-no-request.md).
- **Topic 05 · The test pyramid** owns the context cache and what evicts it —
  [`../05-the-test-pyramid/05-the-context-cache.md`](../05-the-test-pyramid/05-the-context-cache.md)
  and [`../05-the-test-pyramid/05b-what-evicts-it.md`](../05-the-test-pyramid/05b-what-evicts-it.md).
- **Topic 04 · Mockito** owns `verify` and `times(n)` —
  [`../04-mockito/05-verification.md`](../04-mockito/05-verification.md).

## Gotchas

**★ The `CacheManager` is a singleton in a cached `ApplicationContext`, so cache entries survive across test methods and across test classes.**
The TestContext framework reuses contexts by configuration key, which is the whole reason a Spring suite is fast. Your cache lives in that reused context and has no test lifecycle. A test asserting a miss then sees a hit populated by an earlier class, and the failure is order-dependent — green locally, red in CI, or vice versa.

**★ A test asserting a cache *hit* can pass without your code ever populating the cache.**
This is the false-pass version and it is far harder to spot, because green tests are not investigated. A previous class warmed the entry; your first call was already a hit; `verify(..., times(1))` sees one call because the repository was hit minutes ago in another class. Clearing every cache in `@BeforeEach` makes the first call a guaranteed miss, which is what the assertion silently assumes.

**★ Clearing only the cache you are testing leaves the others warm, and the class under test is rarely the only cacher in the context.**
`caches.getCacheNames().forEach(...)` costs the same as naming one cache and covers the collaborator that also caches, the reference-data cache someone added last month, and the security cache. Naming one is the version that works until it does not.

**★ `@DirtiesContext` fixes the leakage and pays for it in whole-suite runtime.**
It evicts the `ApplicationContext` from the TestContext cache, forcing the next class needing that configuration to start a fresh one. On a suite with many `@SpringBootTest` classes it is the single most expensive annotation available. A `@BeforeEach` that clears the caches solves this specific problem completely and costs microseconds.

**★ A call-count assertion cannot distinguish "served from cache" from "returned early without asking".**
A guard clause, a null-argument fast path, or a feature flag that short-circuits the method all produce zero repository calls and a passing `times(1)`. Asserting that the cache actually contains the entry under the expected key closes the gap, and it is the only assertion available at all when the cache is populated by `@CachePut`.

**★ `Cache.get(key)` returns a `ValueWrapper`, and unwrapping it blindly destroys the distinction that matters.**
The javadoc: *"A straight `null` being returned means that the cache contains no mapping for this key"*, while a returned wrapper *"may also hold a cached `null` value"*. `assertThat(cache.get(k)).isNotNull()` asserts presence; `assertThat(cache.get(k).get()).isNull()` asserts a cached null. Calling `.get()` first turns "absent" into an NPE in your test.

## Interview questions

**★ Why is `@SpringBootTest` a particular hazard for caching tests?**
Because two caches are in play and only one of them is yours. The TestContext framework caches `ApplicationContext` instances so classes with the same configuration reuse one, which is what keeps a Spring suite affordable. Your `CacheManager` is a singleton bean inside that reused context, so its contents outlive the test method and the test class. The practical consequences are a miss test that fails because a previous class warmed the entry, and — much worse — a hit test that passes without your code populating anything, which is a false pass nobody investigates. Both are order-dependent, so they appear in CI and not locally. The fix is a `@BeforeEach` that iterates `getCacheNames()` and clears each one, not `@DirtiesContext`, which solves it by discarding the context and charging the whole suite for it.

{/* FOOTER */}
