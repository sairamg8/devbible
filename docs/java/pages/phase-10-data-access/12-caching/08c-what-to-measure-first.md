---
title: "Five numbers decide whether a cache is the right change, none of them is the hit rate, and Spring Boot's automatic cache instrumentation has a limitation that leaves the most dangerous configuration — the default one — reporting no cache metrics at all"
sidebar_label: "8c · What to measure first"
sidebar_position: 32
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Caching* and *Metrics → Supported
> Metrics and Meters*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html),
> [docs.spring.io/spring-boot/reference/actuator/metrics.html](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)),
> the Spring Boot 4.1 actuator *Caches (caches)* endpoint reference
> ([docs.spring.io/spring-boot/api/rest/actuator/caches.html](https://docs.spring.io/spring-boot/api/rest/actuator/caches.html)),
> the Micrometer 1.17 reference *Micrometer Cache Instrumentations*
> ([docs.micrometer.io/micrometer/reference/reference/cache.html](https://docs.micrometer.io/micrometer/reference/reference/cache.html)),
> the Hibernate ORM 7.4 *User Guide* §14.9 *Caching statistics*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the PostgreSQL 18 documentation *F.32 pg_stat_statements* and *14.1 Using EXPLAIN*
> ([postgresql.org/docs/18/pgstatstatements.html](https://www.postgresql.org/docs/18/pgstatstatements.html),
> [postgresql.org/docs/18/using-explain.html](https://www.postgresql.org/docs/18/using-explain.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Micrometer 1.17, PostgreSQL 18.

**[8](08-when-not-to-cache.md) and [8b](08b-when-the-cache-is-the-wrong-risk.md) are reasons to say
no. This is what you need in hand to say yes — five numbers, four of which are cheap to obtain and
none of which is the hit rate, plus the instrumentation Spring Boot gives you for free and the
specific limitation that means the riskiest configuration reports nothing.**

## The five numbers

**1 · The statement, and its plan.** Not "the endpoint is slow" — the actual SQL, and `EXPLAIN` over
it. *"You can use the `EXPLAIN` command to see what query plan the planner creates for any query."*
A sequential scan for a selective predicate, or a sort with no supporting index, means the answer is
a migration and the conversation is over ([8](08-when-not-to-cache.md)). Turning the statements on is
[`../08-the-n-plus-1-problem/05-turning-the-sql-on.md`](../08-the-n-plus-1-problem/05-turning-the-sql-on.md).

**2 · How many statements the request issues.** One slow statement and a hundred fast ones are
different problems with different fixes and the same symptom. Count them; do not read them
([`../08-the-n-plus-1-problem/06-count-do-not-read.md`](../08-the-n-plus-1-problem/06-count-do-not-read.md)).
If the count scales with the number of rows on the page, the fix is a fetch plan and a cache would
only make the fan-out periodic.

**3 · The read-to-write ratio, for that key.** Not for the table — for the key. A table read a
million times a day and written a thousand times has a good ratio in aggregate and a terrible one for
the hundred hot keys everyone actually writes. This is the number that decides whether an entry
survives long enough to be read twice, and it is the one most consistently absent from the pull
request that adds `@Cacheable`.

**4 · The cardinality of the key space, against the size of the cache.** If distinct keys outnumber
what the cache will hold, the cache is an eviction machine ([3d](03d-the-key-that-never-repeats.md)).
The key expression tells you this without measuring anything: a key containing a timestamp, a request
id, a free-text search term or a `Pageable` is unbounded by construction.

**5 · The staleness budget, from whoever owns the consequence.** In time units, agreed by a person
who is not you, before the annotation exists. [1](01-caching-is-a-decision.md) gives the sentence to
fill in. If nobody will own a number, that is itself the answer.

Numbers 1 and 2 come from the application and the database. Number 3 usually comes from
`pg_stat_statements`, which *"provides a means for tracking planning and execution statistics of all
SQL statements executed by a server"* — the call counts per normalised statement are the cheapest
read-to-write estimate available. Number 4 comes from reading the key expression. Number 5 comes from
a conversation.

## What Spring Boot instruments for you

Cache metrics are auto-configured, and the sentence to read carefully is the first one:

> *"Auto-configuration enables the instrumentation of all available `Cache` instances on startup, with
> metrics prefixed with `cache`. Cache instrumentation is standardized for a basic set of metrics.
> Additional, cache-specific metrics are also available. The following cache libraries are supported:
> Cache2k, Caffeine, Hazelcast, Any compliant JCache (JSR-107) implementation, Redis."*

> *"Metrics should be enabled for the auto-configuration to pick them up. Refer to the documentation
> of the cache library you are using for more details. Metrics are tagged by the name of the cache and
> by the name of the `CacheManager`, which is derived from the bean name."*

🔴 **Note which provider is not on that list.** `ConcurrentMapCacheManager` — the `simple` provider,
the one you get by default when no caching library is present — is absent. It exposes no statistics
for anything to bind to, which is consistent with Spring's description of the `ConcurrentMap` store —
it *"does not provide any management, persistence capabilities, or eviction contracts"*. So the
configuration
that most needs watching, because it is unbounded and per-pod ([8b](08b-when-the-cache-is-the-wrong-risk.md)),
is the one that reports nothing.

### The startup-only limitation

The second half of the constraint is the one that catches people who *did* pick a supported provider:

> *"Only caches that are configured on startup are bound to the registry. For caches not defined in
> the cache's configuration, such as caches created on the fly or programmatically after the startup
> phase, an explicit registration is required. A `CacheMetricsRegistrar` bean is made available to
> make that process easier."*

Now compose that with how caches come into existence. Boot's default behaviour is to create them on
demand — *"When a cache is required (such as `piDecimals` in the preceding example), this provider
creates it for you"* — and the property that changes it is:

> *"By default, caches are created as needed, but you can restrict the list of available caches by
> setting the `cache-names` property. … If you do so and your application uses a cache not listed,
> then it fails at runtime when the cache is needed, but not on startup. This is similar to the way
> the 'real' cache providers behave if you use an undeclared cache."*

**So a cache whose name only appears in an annotation, and which is first created when that method is
first called, is not in your metrics.** It exists, it holds data, it goes stale, and the dashboard
shows nothing — not a zero, an absence.

```yaml
spring:
  cache:
    cache-names: products,productsByCategory,permissionsByRole,fxRates
```

Declaring the names does three things at once: the caches exist at startup so the metrics bind, a
typo in a `cacheNames` attribute fails at runtime instead of silently creating a fourth unbounded
cache, and the list becomes the inventory that [7e](07e-the-writes-the-cache-never-sees.md)'s
enumeration exercise starts from. ⚠️ The failure for an undeclared cache is *"at runtime when the
cache is needed, but not on startup"* — so declaring names moves the error to first use, not to boot,
and a rarely-called cached method can still surprise you in production.

For anything genuinely created after startup, `CacheMetricsRegistrar` is the documented escape hatch.

### Which provider you are actually on

The metrics tell you nothing if you are wrong about the store. Boot picks one by detection, not by
default:

> *"If you have not defined a bean of type `CacheManager` or a `CacheResolver` named `cacheResolver`
> (see `CachingConfigurer`), Spring Boot tries to detect the following providers (in the indicated
> order): Generic, JCache (JSR-107) (EhCache 3, Hazelcast, Infinispan, and others), Hazelcast,
> Infinispan, Couchbase, Redis, Caffeine, Cache2k, Simple."*

> *"If none of the other providers can be found, a simple implementation using a `ConcurrentHashMap`
> as the cache store is configured. This is the default if no caching library is present in your
> application."*

Two consequences worth stating plainly. **`Simple` is last, so it is the silent fallback** — a
missing dependency in one deployment profile puts you on a per-pod `ConcurrentHashMap` with no
metrics while you believe you are on Redis. And **`Generic` is first**: *"Generic caching is used if
the context defines at least one `Cache` bean"*, so a stray `Cache` bean anywhere in the context wins
over everything else.

The fix is to stop relying on detection:

```yaml
spring:
  cache:
    type: redis        # "Cache type. By default, auto-detected according to the environment."
```

> *"If the `CacheManager` is auto-configured by Spring Boot, it is possible to force a particular
> cache provider by setting the `spring.cache.type` property."*

Setting it explicitly turns "we think we are on Redis" into a startup failure when you are not, which
is the correct place for that discovery. `spring.cache.type=none` is the documented way to run a
no-op cache in an environment where you do not want one — *"If you need to use a no-op cache rather
than the auto-configured cache manager in a certain environment, set the cache type to `none`"* —
which is how you get a test suite that exercises the uncached path.

And at runtime, the actuator endpoint answers the same question from the other direction: *"The
`caches` endpoint provides access to the application's caches."* It lists what exists and which
`CacheManager` owns it, which is the only way to see caches your grep missed.

Once the cache is live, the meters that tell you whether it is working — and the one meter that does
not exist — are [8d · What to watch once it is live](08d-what-to-watch-once-it-is-live.md).

## Gotchas

**★ The hit rate is not one of the five numbers, because you cannot have it before the cache
exists.** Every decision input is available beforehand; the hit rate is only feedback afterwards.

**★ The read-to-write ratio that matters is per key, not per table.** A table with a great aggregate
ratio can have a terrible one on precisely the hot keys everyone writes.

**★ You can read the key-space cardinality straight off the key expression.** A key containing a
timestamp, a request id, a free-text term or a `Pageable` is unbounded by construction and needs no
measurement at all.

**★ The `simple` provider is not in Boot's list of instrumented cache libraries.** The default,
unbounded, per-pod configuration is also the one with no metrics — an absence, not a zero.

**★ Only caches configured at startup are bound to the registry.** A cache created on first use is
invisible to Micrometer, and Boot creates caches on demand by default, so this is the common case
rather than the exotic one.

**★ `spring.cache.cache-names` is a monitoring fix as much as a safety one.** It makes the caches
exist at startup so their metrics bind, and it turns a typo in a `cacheNames` attribute into a
failure instead of a new unbounded cache.

**★ Declaring cache names moves the error to first use, not to boot.** The documentation says an
undeclared cache *"fails at runtime when the cache is needed, but not on startup"*, so a
rarely-called cached method can still surprise you in production.

**★ `Simple` is last in the detection order, which makes it the silent fallback.** A dependency
missing from one deployment profile puts you on a `ConcurrentHashMap` while you believe you are on
Redis, and nothing logs a complaint.

**★ `Generic` is first, and it triggers on any `Cache` bean in the context.** One stray bean beats
every other provider, including the one you configured a starter for.

**★ Defining your own `CacheManager` bean turns the whole detection off.** The reference conditions
everything on *not* having defined one, so a hand-written manager also silently disables every
`spring.cache.*` property people will later try to tune ([5e](05e-changing-the-defaults-safely.md)).

**★ Setting `spring.cache.type` explicitly converts a silent misconfiguration into a startup
failure.** That is the entire reason to set it even when detection currently picks the right thing.

**★ `spring.cache.type=none` is the documented way to run the uncached path.** A test suite that
never exercises a miss has not tested the code the cache is hiding.

## Interview questions

**★ What do you measure before adding a cache?**
The statement and its plan, because if it is a sequential scan the answer is an index and not a
cache. The number of statements the request issues, because a hundred fast queries and one slow query
present identically and have different fixes. The read-to-write ratio for the specific key, because
that is what decides whether an entry survives long enough to be read twice — and it has to be per
key, since a table with a healthy aggregate ratio can be written constantly on exactly the keys that
are hot. The cardinality of the key space against the size of the cache, which I can usually read
straight off the key expression. And the staleness budget, in time units, agreed with whoever owns the
consequence of a wrong answer. Notice the hit rate is not on that list: it is not available before the
change, and it is feedback rather than a decision input.

**★ What does Spring Boot instrument automatically for caches, and what does it miss?**
Auto-configuration binds all available `Cache` instances on startup, with meters prefixed `cache`,
tagged by cache name and by the `CacheManager` bean name, for Cache2k, Caffeine, Hazelcast, any
compliant JCache implementation, and Redis. Two gaps matter. The `simple` `ConcurrentHashMap`
provider is not on that list, so the default configuration — the unbounded per-pod one — produces no
cache metrics at all. And only caches configured at startup are bound; caches created on the fly or
programmatically afterwards need explicit registration through a `CacheMetricsRegistrar`. Since Boot
creates caches on demand unless `spring.cache.cache-names` is set, the common default is a cache that
exists at runtime and is absent from monitoring — which reads as "no data" rather than as a problem,
and nobody investigates no data.

**★ How do you make sure you are on the cache provider you think you are on?**
Set `spring.cache.type` explicitly, and check the actuator `caches` endpoint at runtime. The property
is documented as auto-detected by default, and the detection order is Generic, JCache, Hazelcast,
Infinispan, Couchbase, Redis, Caffeine, Cache2k, Simple — so `Simple` is the fallback when nothing
else is found, and `Generic` wins the moment any `Cache` bean exists in the context. Both ends of
that list are ways to be silently wrong: a dependency missing from one deployment drops you onto a
per-pod `ConcurrentHashMap`, and a stray `Cache` bean overrides everything. Setting the type turns
either of those into a startup failure, which is where you want to find out. And if someone has
defined their own `CacheManager` bean, none of the detection or the `spring.cache.*` properties apply
at all — that is worth checking before spending an afternoon tuning properties that are inert.

**★ Why is `spring.cache.cache-names` worth setting even when you do not need to restrict anything?**
Because of what it changes about visibility rather than about behaviour. Without it, Boot's providers
create a cache the first time a method asks for one, which means a cache name that exists only inside
an annotation string comes into being after startup — and Boot's metrics bind only caches configured
at startup, so that cache is never in the registry. Declaring the names makes them exist at boot, so
the meters attach; it turns a typo in a `cacheNames` attribute into a failure rather than a silently
created fourth cache; and it gives you a single authoritative list of what the application caches,
which is the inventory the invalidation review starts from. The caveat is that the failure for an
undeclared name happens at first use, not at startup, so it is a safety net rather than a compile-time
check.

{/* FOOTER */}
