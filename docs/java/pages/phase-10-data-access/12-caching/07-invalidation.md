---
title: "`@CacheEvict` fires when the method returns and the transaction commits some time afterwards, so between those two instants any concurrent reader repopulates the cache with the value you just deleted — and the fix has a window of its own"
sidebar_label: "7 · Invalidation and the transaction"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching*, *The `@CacheEvict` Annotation*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the `TransactionAwareCacheDecorator`, `AbstractTransactionSupportingCacheManager` and `Cache`
> javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/transaction/AbstractTransactionSupportingCacheManager.html)),
> the `RedisCacheManager.RedisCacheManagerBuilder` javadoc
> ([docs.spring.io/spring-data/redis](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html))
> and Boot 4.1.x `RedisCacheConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/RedisCacheConfiguration.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8, PostgreSQL 18.

**The joke is that there are two hard problems in computer science: cache invalidation, naming
things, and off-by-one errors. This chunk is about why the first one is hard, and the answer is
narrower and more actionable than the joke suggests: an eviction and a commit are two separate
events at two separate instants, and everything that can go wrong happens in the gap between
them.**

## The default ordering, precisely

Take an ordinary write path:

```java
@Service
class ProfileService {

    @Transactional
    @CacheEvict(cacheNames = "profiles", key = "#profile.id")
    public void rename(Profile profile, String newName) {
        profile.setName(newName);
        repository.save(profile);
    }
}
```

The interceptors nest — the transaction advice is outermost by default — so the sequence is:

1. Transaction begins.
2. The method body runs; the `UPDATE` is issued (or queued in the persistence context).
3. The method returns. **`@CacheEvict` fires. The cache entry is deleted.**
4. The transaction commits. Only now is the new value visible to other transactions.

Steps 3 and 4 are not the same instant. Between them the cache is empty and the database still
shows the *old* row to everyone else, because the write is not committed. Any concurrent request
for that profile misses the cache, reads the old row, and **writes the old row back into the
cache**. The cache is now stale, the database is now correct, and nothing will ever reconcile
them except a TTL.

That window is not theoretical and not narrow. A commit involves a network round trip to the
database, a flush of any remaining persistence-context work, `after-completion` synchronisations,
and — under load — waiting behind other work in the connection pool. On a busy endpoint it is
easily long enough for several reads to land in it.

⚠️ **And the reverse ordering is worse.** If the transaction rolls back at step 4, the eviction at
step 3 already happened: you threw away a perfectly good cache entry for a write that did not
occur. That one is only a performance cost, which is why it is the acceptable half of the trade.

## Making the cache transaction-aware

Spring's mechanism is a decorator:

> *"Cache decorator which synchronizes its `put(Object, Object)`, `evict(Object)` and `clear()`
> operations with Spring-managed transactions (through Spring's
> `TransactionSynchronizationManager`), performing the actual cache put/evict/clear operation only
> in the after-commit phase of a successful transaction. If no transaction is active,
> `put(Object, Object)`, `evict(Object)` and `clear()` operations will be performed immediately,
> as usual."*

and the switch on the framework's own managers:

> *"Set whether this `CacheManager` should expose transaction-aware `Cache` objects. Default is
> "false". Set this to "true" to synchronize cache put/evict operations with ongoing
> Spring-managed transactions, performing the actual cache put/evict operation only in the
> after-commit phase of a successful transaction."*

**Default is false**, everywhere. On Redis the same row appears in the manager defaults table as
`Transaction Aware: No`, and Boot's auto-configuration does not call `transactionAware()` — you
can read the whole builder setup in
[5e](05e-changing-the-defaults-safely.md) and the call is not there. Turning it on:

```java
@Bean
RedisCacheManagerBuilderCustomizer transactionAwareCaches() {
    return RedisCacheManagerBuilder::transactionAware;
}
```

> *"Enable `RedisCache`s to synchronize cache put/evict operations with ongoing Spring-managed
> transactions."*

Now the sequence is: method returns → transaction commits → eviction happens. The read that lands
during the commit sees the *old* cached value rather than repopulating a stale one, and once the
commit lands the entry is removed. The stale-repopulation bug is gone.

## The fix has its own window

Be honest about what transaction awareness buys, because it is a smaller guarantee than it looks.

**Between the commit and the after-commit eviction, the cache still serves the old value.** The
database has the new row; the cache has the old one; the eviction has not run yet. That window is
shorter than the previous one, but it is not zero, and it is the reason a read-your-own-writes
requirement is not satisfied by caching plus transaction awareness alone.

**An after-commit eviction can fail, and there is nothing to roll back.** The commit is durable;
the eviction is a network call to Redis that may time out. If your `CacheErrorHandler` swallows
evict errors ([5d2](05d2-when-the-cache-is-down.md)), the stale entry survives silently — and
with `Key Expiration: None`, permanently. This is the same class of problem as an after-commit
event handler, argued at
[../04-spring-transactional/19b-after-commit-is-not-durable.md](../04-spring-transactional/19b-after-commit-is-not-durable.md).

**Immediate operations bypass the deferral entirely**, by design:

> *"**Note:** Use of immediate operations such as `putIfAbsent(Object, Object)` and
> `evictIfPresent(Object)` cannot be deferred to the after-commit phase of a running transaction.
> Use these with care in a transactional environment."*

So hand-written invalidation that reaches for `evictIfPresent` because it "makes sure" the entry
is gone has quietly opted out of the mechanism the decorator provides.

**And `@Cacheable` reads are not deferred at all.** Only put, evict and clear are synchronised. A
`@Cacheable` method inside a transaction reads through to the shared cache immediately, so it can
see entries written by other transactions and can populate the cache with data that is about to
be superseded by your own uncommitted write.

Two further mechanisms — evicting *before* the method rather than after, and evicting twice to
bracket the commit — are [7c · Getting the eviction right](07c-getting-the-eviction-right.md).
And the entries you never thought to evict at all are
[7d · The invalidation you forgot](07d-the-invalidation-you-forgot.md).

## Gotchas

**★ `@CacheEvict` fires when the method returns, not when the transaction commits.** In the gap, a
concurrent reader sees the old committed row and writes it straight back into the cache.

**★ Transaction awareness is off by default in every manager**, including Redis, where the
defaults table says `Transaction Aware: No` and Boot never calls `transactionAware()`.

**★ Transaction awareness does not close the window, it moves it.** Between commit and the
after-commit eviction, the database is new and the cache is old.

**★ An after-commit eviction that fails cannot be rolled back.** The write is durable and the
cache is wrong, and if your error handler swallows evict failures nothing records it.

**★ `@Cacheable` reads are never deferred.** Only put, evict and clear participate, so a read
inside your transaction still populates the shared cache from the pre-write state.

**★ `evictIfPresent` opts out of transaction awareness by design.** The javadoc says immediate
operations "cannot be deferred to the after-commit phase". Hand-written invalidation that reaches
for it has silently changed the semantics.

**★ Ordering depends on interceptor order.** `@Transactional` is outermost by default; if
something has reordered the advisors, the sequence in this chunk no longer describes your
application, and nothing announces that.

**★ A `@CacheEvict` on a method that is called internally does nothing at all.** It is the same
proxy rule as `@Transactional` — [2b · The proxy again](02b-the-proxy-again.md) — and on an
invalidation path the symptom is stale data rather than a missing optimisation.

**★ Nobody notices a missing invalidation until the value matters.** Staleness has no exception,
no metric and no log line — it is a correct-looking answer, which is why invalidation bugs are
found by users rather than by monitoring.

## Interview questions

**★ Why is cache invalidation hard?**
Because a cache and a database are two independent stores with no shared transaction, so every
mechanism you have is "do this, then do that", and something can happen in between. The concrete
version in Spring: `@CacheEvict` runs when the method returns and the transaction commits
afterwards, so during the gap the database still shows the old row to other transactions and a
concurrent read repopulates the cache with it. You can make the cache transaction-aware, which
moves the eviction after the commit, and then the window is between the commit and the eviction
instead. There is no setting that removes it, only settings that shrink it — plus a TTL to bound
what survives when a mechanism fails.

**★ What does making a cache transaction-aware actually do?**
It wraps each `Cache` in a decorator that registers put, evict and clear operations with the
`TransactionSynchronizationManager` and performs them in the after-commit phase of a successful
transaction, falling back to immediate execution when no transaction is active. It is off by
default in every implementation — the framework's own managers expose it as
`setTransactionAware`, defaulting to false, and `RedisCacheManager` lists `Transaction Aware: No`
among its defaults. Two limitations matter: reads are not deferred, so `@Cacheable` still reads
through to the shared cache immediately; and the immediate operations `putIfAbsent` and
`evictIfPresent` explicitly cannot be deferred, so any hand-written invalidation using them
bypasses the whole thing.

**★ Walk me through how a stale entry gets written into the cache by a *reader*.**
Thread A calls a `@Transactional` method annotated `@CacheEvict`. The body issues the update, the
method returns, and the eviction runs — the cache entry is gone. The transaction has not committed
yet, so no other transaction can see the new row. Thread B now calls the `@Cacheable` read method
for that key: it misses, queries the database, gets the *old* committed row, and puts it in the
cache. Thread A's transaction commits. The database is now correct and the cache holds a value
that no longer exists anywhere else, with nothing scheduled to remove it. That is why the answer
is not "evict harder" but "evict after the commit, and evict again, and have a TTL".

**★ Your `@CacheEvict` is on a method called from another method in the same class. What
happens?**
Nothing happens. Cache annotations are proxy-based in the same way `@Transactional` is, so a
self-invocation goes straight to the target instance and never passes through the interceptor —
the reference says self-invocation "does not lead to actual caching at runtime even if the
invoked method is marked with `@Cacheable`", and the same applies to eviction. What makes this
worse on an invalidation path than on a read path is the symptom: a missing `@Cacheable` costs
you performance and shows up in a profile, while a missing `@CacheEvict` costs you correctness
and shows up as a user complaint weeks later.

{/* FOOTER */}
