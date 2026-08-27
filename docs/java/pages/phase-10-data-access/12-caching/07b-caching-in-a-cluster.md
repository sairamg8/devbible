---
title: "With a local cache and three pods you have three caches, and an eviction on the pod that handled the write is invisible to the other two — so the staleness window is not your TTL, it is the lifetime of the process"
sidebar_label: "7b · Caching in a cluster"
sidebar_position: 25
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)),
> the Spring Framework 7.0 reference *Configuring the Cache Storage* and *Understanding the Cache
> Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html](https://docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html)),
> the Hibernate ORM 7.4 *User Guide* §14 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the Redis *Client-side caching introduction*
> ([redis.io/docs](https://redis.io/docs/latest/develop/clients/client-side-caching/)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Hibernate ORM 7.4.1, Redis 8.

**Every mechanism in [7 · Invalidation](07-invalidation.md) assumed the eviction reached the
cache. Run more than one instance with a local cache and it reaches *a* cache — the one in the
JVM that happened to handle the write. The other instances keep serving the old value, and
nothing in the framework will ever tell them. This is the single most common way a caching bug
survives a code review: the code is correct, and the deployment is not the one the code assumes.**

## Where the cache actually lives

| Cache | Scope | Shared across pods? |
|---|---|---|
| Persistence context (first level) | one `EntityManager` | no, and it does not need to be |
| Spring `simple` / `ConcurrentMapCacheManager` | the JVM | **no** |
| Caffeine, Cache2k, Ehcache heap tiers | the JVM | **no** |
| Hibernate second-level cache, JCache over a local provider | the `SessionFactory`, i.e. the JVM | **no** |
| Hibernate second-level cache over Infinispan in distributed mode | the cluster | yes |
| Hazelcast, Infinispan as a Spring `CacheManager` | the cluster | yes |
| Spring `RedisCacheManager` | the Redis instance | yes |

The framework's own description of the `ConcurrentMap` store makes the position clear — it *"does
not provide any management, persistence capabilities, or eviction contracts"* — and Boot's
fallback provider description says it is *"not really recommended for production usage"*. Neither
sentence mentions clustering, because clustering is not something a `ConcurrentHashMap` could
have an opinion about.

**The uncomfortable part is that nothing about the code changes between the rows of that table.**
The annotations are identical, the tests pass identically, and the difference is a dependency and
a property.

## Two pods, two caches, one stale answer

Concretely, with a local cache and two instances behind a load balancer:

1. A request to update profile 42 is routed to **pod A**. `@CacheEvict` removes `profiles::42`
   from pod A's map.
2. The transaction commits. The database is correct.
3. A read for profile 42 is routed to **pod B**. Pod B's map still contains the pre-update entry,
   which it happily serves.
4. Every subsequent read routed to pod B returns the old value, for as long as that entry lives.

Step 4 is the one people underestimate. **With a `ConcurrentHashMap` cache there is no expiry
contract at all**, so "as long as that entry lives" means "until the pod restarts". The staleness
window is not a TTL you chose; it is the deployment interval.

Three consequences follow, and each is worse than the last:

- **The bug is intermittent by construction.** It appears or does not depending on which pod the
  load balancer picked, so it reproduces roughly `(n-1)/n` of the time on `n` pods and never on a
  developer's single instance.
- **Refreshing "fixes" it.** A second request may land on the pod that did the eviction and show
  the correct value, so the user's own experience is that the system is flaky rather than wrong,
  and the ticket says "sometimes shows old data".
- **It gets worse as you scale out.** Adding pods to handle load increases both the number of
  stale copies and the probability of hitting one.

## The three honest options

**One — make the cache shared.** Redis, Hazelcast, or Infinispan in distributed mode. One store,
so one eviction. This is the option that actually solves the problem, and everything in
[5 · Redis as the store](05-redis-as-the-store.md) through
[5e](05e-changing-the-defaults-safely.md) is the bill for it: a network hop per hit, a
serialization format, a new failure domain, and a shared blast radius when a wrong value is
written.

**Two — keep the cache local and make the TTL the contract.** A local cache with a short,
explicit TTL has a *bounded* staleness window that does not depend on invalidation reaching
anything. This is a perfectly respectable design for reference data, and it is much cheaper than
a distributed cache — but it only works if you stop pretending the eviction does anything and
size the TTL as though there were none.

⚠️ The default `simple` provider cannot do this: it has no eviction contract. Choosing this
option means choosing Caffeine or Cache2k, where `expireAfterWrite` exists, and configuring it.

**Three — broadcast the invalidation.** Publish an event when a write happens and have every
instance evict its local copy. Redis pub/sub, a Kafka topic, or any message broker you already
run:

```java
@Component
class CacheInvalidationListener {

    private final CacheManager cacheManager;

    @EventListener                        // fired by your own publisher on every write
    public void onProfileChanged(ProfileChanged event) {
        Cache cache = cacheManager.getCache("profiles");
        if (cache != null) {
            cache.evict(event.id());
        }
    }
}
```

🔴 **This is the option that looks cheapest and is not.** You have built a distributed system
with at-most-once delivery: the broadcast can be lost, the subscriber can be down during a
deploy, a pod that joins after the message was sent never receives it, and there is no
acknowledgement anywhere. Every one of those leaves one instance permanently stale. It is a
reasonable *optimisation* on top of option two — it shortens the average staleness window below
the TTL — and it is not a substitute for the TTL, because it has no lower bound on correctness.

## What Redis does about the same problem, one level down

Redis's own client-side caching is worth reading precisely because it is the same problem solved
properly, and the machinery required is the point:

> *"When client-side caching is enabled, the Redis server remembers or *tracks* the set of keys
> that each client connection has previously read… When any client writes new data to a tracked
> key, the server sends an invalidation message to all clients that have accessed that key
> previously. This message warns the clients that their cached copies of the data are no longer
> valid and the clients will evict the stale data in response."*

and the failure handling:

> *"If any connection from a client gets disconnected (including one from a connection pool), then
> the client will flush all keys from the client-side cache. Caching then resumes for subsequent
> reads from the connections that are still active."*

**Note what that costs to be correct:** the server keeps per-connection read sets, pushes
invalidations, and any client that loses its connection throws its entire local cache away
because it cannot know what it missed. That last rule is the honest response to "the broadcast
might not have arrived", and it is what a hand-rolled pub/sub invalidation scheme almost never
does.

The reference also warns about the cost profile: *"Cache misses, tracking, and invalidation
messages always add a slight performance penalty"*, and recommends *"Use a separate connection for
data that is not cache-friendly… you may also have data, such as counters and scoreboards, that
receives frequent updates. In cases like this, the performance overhead of the invalidation
messages can be greater than the savings made by caching."*

⚠️ Support is per-client-library: the documentation lists Jedis from v5.2.0 among the clients that
support it, and cautions that *"some other clients support the `CLIENT TRACKING` command to
configure CSC on the server, but this does not mean they support the features required for CSC
themselves."* **I could not confirm whether Spring Data Redis 4.1's cache abstraction integrates
with Redis client-side caching**, and I have not claimed it does — treat this section as an
argument about what correct broadcast invalidation requires, not as a feature you can switch on
from `application.yaml`.

## Hibernate's second-level cache has exactly the same shape

The second-level cache is bound to the `SessionFactory`, which is per-JVM. Whether it is shared
depends entirely on the region factory: a JCache provider over an in-process store gives each pod
its own, and Infinispan in distributed mode does not. The guide notes the consequence for
strategy selection — with Infinispan distributed caching, only `READ_WRITE` and
`NONSTRICT_READ_WRITE` are available for read-write caches — so **the deployment topology
constrains which consistency guarantees you can even ask for.**

And the staleness rule from [6](06-hibernate-second-level.md) compounds here: Hibernate caches
*"are not aware of changes made to the persistent store by other applications"*, and in a
multi-pod deployment with per-pod caches, **the other pods are other applications** as far as any
one cache is concerned. The mitigation the guide offers is the same one: a TTL on the region.

## Gotchas

**★ A local cache in a multi-instance deployment has a staleness window equal to the process
lifetime**, not to any TTL — because the default `simple` provider has no eviction contract at
all.

**★ The bug reproduces on `(n-1)/n` of requests and never on one instance.** It cannot be found on
a developer machine, and it presents to users as flakiness rather than as wrong data.

**★ Scaling out makes it worse.** More pods means more stale copies and a higher chance of hitting
one, so the system degrades exactly when you respond to load.

**★ Nothing in the code distinguishes a local cache from a shared one.** The annotations are
identical; the difference is a dependency and a property, and a review of the service class cannot
catch it.

**★ Boot's silent fallback to `simple` can turn a shared cache into a local one at deploy time.**
Everything in [5](05-redis-as-the-store.md) about `spring.cache.type=redis` is a cluster-safety
measure, not just a configuration hygiene one.

**★ Broadcast invalidation is at-most-once.** A lost message, a pod restarting, or an instance
that joined after the broadcast leaves that instance permanently stale, with no acknowledgement
and no retry.

**★ A pod that reconnects after losing its connection to the broadcast channel must flush its
whole cache.** Redis's own client-side caching does exactly that; hand-rolled schemes almost
never do, and that omission is where the permanent staleness comes from.

**★ Broadcast invalidation on write-heavy data can cost more than the cache saves.** The Redis
documentation says so directly about its own equivalent mechanism, and recommends not caching
that data at all.

**★ Hibernate's second-level cache is per-`SessionFactory`, so per-JVM by default.** Sharing it
requires a distributed region factory, and that choice restricts which concurrency strategies are
available.

**★ In a multi-pod deployment, the other pods are "other applications" to Hibernate's cache.**
The guide's warning about changes it cannot see applies to your own fleet.

**★ Sticky sessions do not fix this.** They make the *user* see a consistent wrong answer, which
turns an intermittent bug into a persistent one for whoever is pinned to the stale pod, and they
do nothing for background jobs, webhooks or any other pod-agnostic traffic.

## Interview questions

**★ You have a `@Cacheable` service and three pods. What breaks?**
Invalidation, and only invalidation — reads work fine. With a local cache each pod holds its own
copy, so a `@CacheEvict` triggered by a write removes the entry from exactly one of the three. The
other two keep serving the old value, and with the default `ConcurrentHashMap` provider there is
no expiry contract, so they keep serving it until they restart. The bug's shape is what makes it
expensive: it reproduces on two requests out of three, never on a single-instance developer setup,
and gets worse as you scale out. The genuine fixes are a shared cache or a short TTL that you
treat as the actual correctness contract.

**★ How would you invalidate a local cache across a cluster?**
By publishing an event on every write and having each instance evict its own copy — and by being
clear that this is a best-effort optimisation rather than a guarantee. The delivery is
at-most-once: the message can be lost, a pod can be restarting, and an instance that joins later
never sees it. Redis's own client-side caching shows what "correct" costs: the server tracks which
keys each connection read, pushes invalidation messages, and any client that loses its connection
flushes its entire cache because it cannot know what it missed. A hand-rolled scheme almost never
implements that last rule, which is precisely where permanent staleness comes from. So I would
broadcast *and* keep a TTL, and size the TTL as if the broadcast did not exist.

**★ Is Hibernate's second-level cache shared across instances?**
Only if the region factory is. The cache is bound to the `SessionFactory`, which is per-JVM, so a
JCache provider backed by an in-process store gives every pod its own second-level cache with its
own staleness. Infinispan in distributed mode does share it, and brings a constraint worth
knowing: only `READ_WRITE` and `NONSTRICT_READ_WRITE` are available for read-write caches in that
mode, so the deployment topology limits which consistency guarantees you can ask for. The failure
mode when it is not shared is exactly the Spring one — Hibernate invalidates its own cache on its
own writes, and in a multi-pod deployment the other pods are, from its point of view, other
applications.

**★ Would sticky sessions solve the stale-cache problem?**
No, and they make it worse in one respect. Pinning a user to a pod means that user consistently
sees whatever that pod has, so an intermittent wrong answer becomes a persistent one for everyone
routed there — harder to dismiss but also harder to notice, because the affected users are a
stable subset rather than a random sample. And they do nothing for the traffic that has no
session: scheduled jobs, webhook receivers, internal service calls, admin tooling. Stickiness is a
routing property and the problem is a data property.

**★ When is a local cache the right choice despite all of this?**
When the TTL is the contract rather than a backstop. Reference data with a five-minute tolerance —
feature flags, country lists, exchange-rate bands, configuration — is a good fit: a local cache is
faster than Redis, has no serialization, no network hop and no failure domain, and if every
instance independently refreshes every five minutes then the worst case is bounded and
understood. The mistake is using a local cache while writing `@CacheEvict` annotations and
believing them, because that is the configuration where the design says "invalidated on write"
and the behaviour says "invalidated on restart".

**★ A user reports that a change they made sometimes does not appear. Where do you look?**
First at whether the cache is local or shared, because "sometimes" plus "after a write" is almost
diagnostic. If it is a per-JVM cache and there is more than one instance, the eviction reached one
of them and the report is exactly what that produces — including the detail that refreshing
occasionally shows the right value. If the cache is shared, the next candidate is the transaction
window from [7](07-invalidation.md): the eviction ran before the commit and a concurrent read
repopulated the old row, which produces the same user-visible symptom for a completely different
reason. Both are invisible in logs, so I would reach for the cache statistics and, failing that,
inspect the entry directly.

{/* FOOTER */}
