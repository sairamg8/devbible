---
title: "By default an exception in the method skips the eviction entirely, so the safest write path evicts before the work, again after the commit, and relies on a TTL for the race neither of those closes"
sidebar_label: "7c · Getting the eviction right"
sidebar_position: 26
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching*, *The `@CacheEvict` Annotation*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the `CacheEvict`, `Cache` and `TransactionAwareCacheDecorator` javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/CacheEvict.html))
> and the `TransactionSynchronization` javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Spring Data Redis 4.1, PostgreSQL 18.

**[7](07-invalidation.md) established that the eviction and the commit happen at different
instants. This chunk is about the two levers you have over *when* the eviction fires — the
`beforeInvocation` attribute and a hand-registered after-commit synchronisation — and about the
fact that using both is not paranoia, it is the minimum that closes the two windows each of them
leaves open.**

## `beforeInvocation` — the other half of the trade

> *"You can also indicate whether the eviction should occur after (the default) or before the
> method is invoked by using the `beforeInvocation` attribute. The former provides the same
> semantics as the rest of the annotations: Once the method completes successfully, an action (in
> this case, eviction) on the cache is run. If the method does not run (as it might be cached) or
> an exception is thrown, the eviction does not occur. The latter (`beforeInvocation=true`)
> causes the eviction to always occur before the method is invoked."*

Read the middle sentence carefully: **by default, if the method throws, the eviction does not
happen.** Consider a write that fails halfway — a constraint violation after a partial flush, an
exception from a downstream call after the row was updated in the persistence context. Whether
the database ends up changed depends on your rollback rules
([../04-spring-transactional/13-rollback-rules.md](../04-spring-transactional/13-rollback-rules.md)),
and if it does, the cache was never invalidated.

`beforeInvocation = true` removes that failure mode by evicting unconditionally, up front:

```java
@Transactional
@CacheEvict(cacheNames = "profiles", key = "#profile.id", beforeInvocation = true)
public void rename(Profile profile, String newName) { … }
```

The cost is a wasted eviction whenever the method fails or is a no-op — a cache miss, not a wrong
answer. **That is the correct direction to be wrong in**, and it is why `beforeInvocation = true`
is a reasonable default on write paths.

⚠️ It does not compose with transaction awareness the way you might hope. A before-invocation
eviction on a transaction-aware cache is still a `Cache.evict` call inside the transaction, so it
is *also* deferred to after commit — which puts it back after the method and defeats the point of
asking for it early. The two attributes answer different questions and combining them gives you
the later of the two behaviours.

## Evict twice, and set a TTL

Given that every single mechanism above has a window, the pragmatic pattern for a write path that
must not leave stale data is not one eviction but two, bracketing the commit:

```java
@Service
class ProfileService {

    private final CacheManager cacheManager;
    private final ProfileRepository repository;

    @Transactional
    public void rename(long id, String newName) {
        Cache cache = cacheManager.getCache("profiles");
        cache.evict(id);                                  // before the write

        Profile profile = repository.findById(id).orElseThrow();
        profile.setName(newName);

        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override public void afterCommit() {
                    cache.evict(id);                      // after the commit
                }
            });
    }
}
```

The first eviction removes whatever is there. The second removes anything a concurrent reader
repopulated during the write or the commit. Neither is sufficient alone; together they close all
but a very small race, and the TTL from [5c2](05c2-choosing-and-applying-a-ttl.md) closes that.

🔴 **There is no configuration that makes this exact.** A cache and a database are two stores
without a shared transaction, so "the cache is never wrong" is not a property you can buy — only
a window you can shrink. The engineering decision is how small the window must be, and the
answer for a price is different from the answer for a display name. That is the decision
[1 · Caching is a decision](01-caching-is-a-decision.md) asks you to write down, arriving with
teeth.

## Gotchas

**★ By default an exception in the method skips the eviction entirely.** If the database changed
anyway — partial flush, a rollback rule that does not fire — the cache keeps the old value.

**★ A cached invocation also skips the eviction.** The reference says "if the method does not run
(as it might be cached)… the eviction does not occur", so combining `@Cacheable` and `@CacheEvict`
on the same method produces an eviction that stops happening as soon as the cache starts working.

**★ `beforeInvocation = true` on a transaction-aware cache is still deferred to after commit.**
The two features do not compose the way the names suggest; you get the later behaviour.

**★ Two evictions plus a TTL is a mitigation, not a guarantee.** A cache and a database are two
stores with no shared transaction; you can shrink the window and you cannot remove it.

**★ `afterCommit` runs outside the transaction.** There is no active transaction and no
connection bound when it fires, so anything in there that touches the database opens a new one —
and any exception it throws propagates to the caller of a transaction that has already committed.

**★ Registering a synchronisation requires an active transaction.** Calling
`TransactionSynchronizationManager.registerSynchronization` with none active throws
`IllegalStateException`, so the same helper used from a non-transactional path fails at runtime
rather than degrading to an immediate eviction.

**★ `allEntries = true` combined with `beforeInvocation = true` clears the cache on every call**,
successful or not. On Redis that is also the `KEYS` scan from
[5d](05d-clearing-locking-and-failing.md), so it is an expensive operation performed
unconditionally.

**★ Evicting twice doubles the cost of the write path.** On a shared store that is two extra
network round trips per write, which is a real trade and not an obvious one — it is only worth
paying where staleness matters.

**★ The `key` expression is evaluated at both points, and before invocation it cannot see
`#result`.** A `beforeInvocation` evict whose key depends on the return value cannot work, and the
failure is at evaluation time on the first call.

## Interview questions

**★ What is `beforeInvocation` and when would you use it?**
It moves the eviction to before the method runs rather than after it returns. The default
behaviour is documented as "if the method does not run… or an exception is thrown, the eviction
does not occur", which is the dangerous case: a write that partially applied and then threw
leaves the database changed and the cache untouched. `beforeInvocation = true` evicts
unconditionally, so the worst case becomes a wasted eviction on a method that failed — a cache
miss instead of a wrong answer. I would default to it on write paths. The subtlety is that it
does not stack with transaction awareness: the early eviction is still a `Cache.evict` inside the
transaction, so a transaction-aware cache defers it to after commit anyway.

**★ How would you make a write path leave no stale data?**
I would accept up front that "no stale data" is unavailable and aim for a window measured in
milliseconds with a bounded worst case. Concretely: evict before the write so anything present is
gone; register an `afterCommit` synchronisation that evicts again, to remove whatever a concurrent
reader repopulated during the write and the commit; keep a TTL short enough that a failed eviction
is a temporary problem; and log evict failures at a level someone actually sees. If the value is
one where staleness is genuinely unacceptable — a balance, a permission check, a price at the
point of sale — the right answer is not a better invalidation scheme, it is not caching that
value.

**★ Why is evicting twice better than evicting once, precisely?**
Because the two evictions close different windows. The one before the write removes whatever is
currently cached, so no reader can be served a pre-write value from that point on. The one after
the commit removes whatever a concurrent reader put back during the write or the commit — the
stale-repopulation case, where a reader missed the empty cache, read the old committed row, and
cached it. Neither alone covers both: evicting only before leaves the repopulation window open,
and evicting only after leaves the whole duration of the method serving the old value. What
remains after both is a much smaller race, between the commit and the second eviction, and that
is what the TTL is for.

**★ What are the risks of doing work in an `afterCommit` synchronisation?**
It runs after the transaction has completed, so there is no transaction and no bound connection —
anything database-shaped in there starts a new transaction, and anything that throws propagates
out of a commit that already succeeded and cannot be undone. For a cache eviction those risks are
acceptable and well-matched: the eviction is idempotent, it does not touch the database, and if
it fails you want to know rather than to roll anything back. What is not acceptable is treating
it as durable. If the process dies between the commit and the callback, the eviction simply never
happens, and the only thing that saves you is the TTL.

**★ Would you ever put `@Cacheable` and `@CacheEvict` on the same method?**
No, and there is a specific mechanical reason beyond the reference calling the `@Cacheable` /
`@CachePut` combination "strongly discouraged". `@CacheEvict` by default runs only if the method
actually executed — "if the method does not run (as it might be cached)… the eviction does not
occur". So a method that is both cached and evicting stops evicting exactly when the cache starts
working, which is the least helpful possible schedule. If a method genuinely both reads and
invalidates, that is two responsibilities and it should be two methods.

{/* FOOTER */}
