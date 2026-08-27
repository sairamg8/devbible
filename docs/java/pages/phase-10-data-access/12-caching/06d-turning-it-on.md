---
title: "In Hibernate 6 and 7 the second-level cache is enabled by configuring a region factory rather than by setting a boolean, the JCache property prefix is still `hibernate.javax.cache` despite the Jakarta migration, and the default missing-cache strategy creates regions the documentation calls unsuitable for production"
sidebar_label: "6d · Turning it on"
sidebar_position: 23
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14.1 *Configuring second-level
> caching*, the caching configuration properties list, §14.8 *Caching statistics* and §14.9
> *JCache* ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the chapter source, `hibernate-jcache`'s `ConfigSettings`, `MissingCacheStrategy` and
> `JCacheRegionFactory` on the `7.4` branch
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-jcache/src/main/java/org/hibernate/cache/jcache/MissingCacheStrategy.java)),
> and `org.hibernate.cfg.CacheSettings`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/CacheSettings.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Most second-level cache configuration you will find online is for Hibernate 5, and three
specific things changed or are surprising enough that copying it produces an application which
looks configured and either caches nothing or caches into regions with no size limit. This chunk
is the wiring, and every claim in it is checked against the 7.4 source rather than the folklore.**

## Enablement is derived from the region factory

> *"`org.hibernate.cache.spi.RegionFactory` defines the integration between Hibernate and a
> pluggable caching provider. `hibernate.cache.region.factory_class` is used to declare the
> provider to use. Hibernate comes with built-in support for the Java caching standard JCache and
> also the popular caching library: Infinispan."*

and the setting people reach for first:

> `hibernate.cache.use_second_level_cache` — *"Enable or disable second level caching overall. By
> default, if the currently configured `RegionFactory` is not the `NoCachingRegionFactory`, then
> the second-level cache is going to be enabled. Otherwise, the second-level cache is disabled."*

🔴 **So the boolean is not the switch; the region factory is.** Setting
`use_second_level_cache=true` with no provider leaves `NoCachingRegionFactory` in place and
changes nothing. Configuring a provider enables the cache whether or not you set the boolean.
Hibernate 5 tutorials that lead with the flag are describing an older contract, and the
application they produce passes review and caches nothing.

The other surprise is the value:

```xml
<property name="hibernate.cache.region.factory_class" value="jcache"/>
```

**A short strategy name, not a fully-qualified class name.** `jcache` and `infinispan` are
registered strategy names; the FQCN still works, which is why the Hibernate 5 form survives in so
many configurations, but the short name is what the 7.4 guide uses and it does not break when a
class moves.

## JCache: two artifacts and a property prefix that lies

> *"To use the built-in integration for JCache, you need the `hibernate-jcache` module jar (and
> all of its dependencies) to be on the classpath. In addition, a JCache implementation needs to
> be added as well."*

Two dependencies, then — `org.hibernate.orm:hibernate-jcache` plus an actual JSR-107
implementation such as Ehcache or Caffeine's JCache module. Neither implies the other, and having
only the first produces a startup failure rather than a silent no-op, which is the one part of
this that fails loudly.

🔴 **The configuration prefix is still `hibernate.javax.cache.`, in Hibernate 7, after the whole
Jakarta migration.** The guide's example:

```xml
<property name="hibernate.javax.cache.provider" value="org.ehcache.jsr107.EhcacheCachingProvider"/>
<property name="hibernate.javax.cache.uri"      value="file:/path/to/ehcache.xml"/>
```

and the constant in `hibernate-jcache`'s `ConfigSettings` confirms it:

```java
String SIMPLE_FACTORY_NAME = "jcache";
String PROP_PREFIX = "hibernate.javax.cache.";
```

It survives because JSR-107's own API package is `javax.cache` and always will be — the JCache
specification was never migrated to Jakarta. Anyone doing a mechanical `javax.` → `jakarta.`
rename across a properties file will break the second-level cache, and the symptom is that the
properties are ignored rather than rejected.

Two more from the same class:

- `hibernate.javax.cache.uri` — *"Only by specifying the second property
  `hibernate.javax.cache.uri` will you be able to have a `CacheManager` per `SessionFactory`."*
  Without it you share the provider's default `CacheManager`, and *"JCache mandates that
  `CacheManager`s sharing the same URI and class loader be unique in JVM"* — which is exactly the
  kind of constraint that bites when a test suite builds several `SessionFactory` instances.
- `hibernate.javax.cache.cache_manager` — accepts an object, a `Class`, or a fully-qualified class
  name, and in the last two cases *"you must make sure that the `CacheManager` implementation
  class provides a default no-arg constructor"*.

## The missing-cache strategy, and a documentation contradiction

> *"By default, the JCache region factory will log a warning when asked to create a cache that is
> not explicitly configured and pre-started in the underlying cache manager. Thus if you configure
> an entity type or a collection as cached, but do not configure the corresponding cache
> explicitly, one warning will be logged for each cache that was not configured explicitly."*

| Value | Description |
|---|---|
| `fail` | *"Fail with an exception on missing caches."* |
| `create-warn` | ***"Default value"***. *"Create a new cache when a cache is not found (see `create` below), and also log a warning about the missing cache."* |
| `create` | *"Create a new cache when a cache is not found, without logging any warning about the missing cache."* |

and the warning attached to it:

> *"Note that caches created this way may not be suitable for production usage (unlimited size and
> no eviction in particular) unless the cache provider explicitly provides a specific
> configuration for default caches."*

**So the shipped behaviour is: any entity you annotate but do not configure a region for gets an
auto-created, unbounded, never-evicting cache, and one WARN line at startup.** That is a heap leak
with a log entry in front of it, and the log entry is one line among thousands during boot.

⚠️ **A documentation contradiction worth knowing about.** The javadoc on
`ConfigSettings.MISSING_CACHE_STRATEGY` says *"Default value is `MissingCacheStrategy#FAIL`."* The
user guide's table says `create-warn`, and the code agrees with the guide —
`MissingCacheStrategy.interpretSetting` returns `CREATE_WARN` for an absent or empty value. **The
javadoc is wrong; the behaviour is `create-warn`.** If you want the safe behaviour you must ask
for it:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        cache:
          region.factory_class: jcache
        javax.cache:
          provider: org.ehcache.jsr107.EhcacheCachingProvider
          uri: classpath:ehcache.xml
          missing_cache_strategy: fail
```

`fail` converts "you forgot to configure a region for this entity" from a warning plus an
unbounded cache into a startup failure, which is what you want in every environment.

The guide also flags a provider-specific version of the same problem: *"Recent versions of Ehcache
enable disk persistence (`persistence strategy="localTempSwap"`) for the default cache causing
performance degradation, it is highly recommended to define the caches explicitly."*

## The settings you will actually touch

From the configuration properties list, the ones with real consequences:

- **`hibernate.cache.use_query_cache`** — *"Enable or disable second level caching of query
  results. The default is false."* See [6b](06b-the-query-cache.md).
- **`hibernate.cache.region_prefix`** — *"Defines a name to be used as a prefix to all second-level
  cache region names."* The same generational trick as
  [5 · Redis as the store](05-redis-as-the-store.md), and equally useful when a cached entity
  changes shape.
- **`hibernate.cache.auto_evict_collection_cache`** — *"Enables or disables the automatic eviction
  of a bidirectional association's collection cache entry when the association is changed just
  from the owning side. This is disabled by default, as it has a performance impact to track this
  state. However, if your application does not manage both sides of bidirectional association
  where the collection side is cached, the alternative is to have stale data in that collection
  cache."* 🔴 **Off by default, and the alternative is documented staleness.** Keeping both sides
  of an association in step stops being hygiene and becomes a correctness requirement the moment
  you cache a collection — see
  [../07-relationships-fetch/02c-keeping-both-sides-in-step.md](../07-relationships-fetch/02c-keeping-both-sides-in-step.md).
- **`hibernate.cache.use_minimal_puts`** — *"Optimizes second-level cache operations to minimize
  writes, at the cost of more frequent reads. Providers typically set this appropriately."* Leave
  it alone.
- **`hibernate.cache.use_structured_entries`** — *"If `true`, forces Hibernate to store data in the
  second-level cache in a more human-friendly format. Can be useful if you'd like to be able to
  'browse' the data directly in your cache, but does have a performance impact."* A debugging
  switch, not a production one.
- **`hibernate.cache.use_reference_entries`** — *"Enable direct storage of entity references into
  the second level cache for read-only or immutable entities."*
- **`hibernate.cache.keys_factory`** — wraps identifiers in an
  `<entity type, tenant, identifier>` tuple by default; `simple` omits the wrapping *"When the
  second-level cache implementation (incl. its configuration) guarantees that different entity
  types are stored separately and multi-tenancy is not used"*. ⚠️ *"Currently, this property is
  only supported when Infinispan is configured as the second-level cache implementation."*

## Proving it is doing anything

> *"If you enable the `hibernate.generate_statistics` configuration property, Hibernate will
> expose a number of metrics via `SessionFactory.getStatistics()`. Hibernate can even be
> configured to expose these statistics via JMX."*

That is the only honest way to answer "is the second-level cache helping?", and it is off by
default. `Statistics` carries second-level hit, miss and put counts per region, which is what
distinguishes the three states people confuse: not enabled, enabled but never consulted (the
entity is not annotated), and consulted but always missing (the region is being invalidated as
fast as it fills).

⚠️ `generate_statistics` has a cost and is not a production default in most deployments. Turn it
on in a performance environment, look at the per-region numbers, and decide there.

## Gotchas

**★ `hibernate.cache.use_second_level_cache=true` on its own does nothing in Hibernate 6/7.** The
setting is derived from whether a real `RegionFactory` is configured. Copying a Hibernate 5
configuration produces an application that looks configured and caches nothing.

**★ `hibernate.cache.region.factory_class` takes a short strategy name.** `jcache` and
`infinispan` are the built-in ones; the FQCN form in older documentation still works and is one
class move away from not working.

**★ The JCache prefix is `hibernate.javax.cache.`, in Hibernate 7.** The JSR-107 API is still
`javax.cache` and always will be. A blanket `javax.` → `jakarta.` rename silently disables the
provider configuration.

**★ `hibernate-jcache` is not a JCache implementation.** You need a second dependency, and which
one determines the region defaults you inherit.

**★ The default missing-cache strategy creates unbounded, never-evicting caches** and logs one
WARN per region. Set `missing_cache_strategy: fail` and configure the regions explicitly.

**★ The `ConfigSettings.MISSING_CACHE_STRATEGY` javadoc says the default is `FAIL` and it is
wrong.** The guide and `MissingCacheStrategy.interpretSetting` both say `create-warn`. Do not
trust the javadoc on this one.

**★ Ehcache's JCache default cache may enable disk persistence.** The guide calls this out by name
as a cause of performance degradation and recommends defining caches explicitly.

**★ Without `hibernate.javax.cache.uri` you share the provider's default `CacheManager`**, and
JCache requires uniqueness per URI and class loader in a JVM — which surfaces first in a test
suite that builds more than one `SessionFactory`.

**★ `auto_evict_collection_cache` is off by default and its absence means stale reads.** If your
code sets only the owning side of a bidirectional association and the inverse side is cached, the
cached collection is wrong and nothing tells you.

**★ `keys_factory: simple` only works on Infinispan.** Setting it on a JCache provider is not an
error you will see; it is a setting that does nothing.

**★ `generate_statistics` is off by default**, so by default you have no way of knowing whether
the cache is working. It is also not free, so it is a deliberate, temporary measurement rather
than a standing configuration.

**★ `use_structured_entries` is a debugging aid with a stated performance impact.** It makes the
cache browsable, which is genuinely useful once and expensive forever after.

## Interview questions

**★ How do you enable Hibernate's second-level cache in Hibernate 7?**
By configuring a region factory, not by setting a flag. The documentation for
`hibernate.cache.use_second_level_cache` says the cache is enabled if the configured
`RegionFactory` is not `NoCachingRegionFactory` — so the boolean is derived. In practice that
means adding `hibernate-jcache` plus a JSR-107 implementation, setting
`hibernate.cache.region.factory_class` to the short name `jcache`, and pointing
`hibernate.javax.cache.uri` at a configuration file that defines a region per cached entity. The
trap for anyone working from older material is that Hibernate 5 documentation leads with the
boolean, and setting the boolean alone leaves you with a configuration that reads as enabled and
caches nothing.

**★ Why is the JCache property prefix still `hibernate.javax.cache` after the Jakarta migration?**
Because it refers to JSR-107, whose API package is `javax.cache` and was never migrated to
Jakarta EE — the specification is separate from the Java EE / Jakarta EE lineage. So Hibernate's
integration properties keep the name of the thing they configure. It matters practically because
Jakarta migrations are usually done with a search-and-replace across the whole project, and this
is one of the few `javax.` strings that must not change. The failure mode is silent: the renamed
properties are simply not recognised, so the provider falls back to defaults and you get
auto-created regions instead of the ones you configured.

**★ What happens if you mark an entity cacheable but do not configure a cache region for it?**
By default, Hibernate's JCache region factory creates one for you and logs a warning — the
`create-warn` strategy. The guide is explicit that caches created this way "may not be suitable
for production usage (unlimited size and no eviction in particular)", so you end up with an
unbounded region growing in the heap, announced by one WARN line during startup that nobody
reads. I set `hibernate.javax.cache.missing_cache_strategy` to `fail` so that a missing region is
a startup failure. Worth knowing: the javadoc on that setting claims `FAIL` is already the
default, and it is wrong — the code and the user guide both say `create-warn`.

**★ How do you know whether the second-level cache is actually helping?**
`hibernate.generate_statistics`, which is off by default, and then the per-region second-level
hit, miss and put counts from `SessionFactory.getStatistics()`. Those three numbers separate the
states people conflate: a region with no activity at all means the entity is not annotated or the
cache is not enabled; high misses with high puts means entries are being invalidated as fast as
they are written, which is the signature of caching something write-heavy; and a healthy hit
ratio means it is working. I would enable it in a performance environment rather than production,
because it is not free, and I would make the decision on the numbers rather than on the presence
of the annotation.

**★ What is `auto_evict_collection_cache` and why is it off?**
It makes Hibernate evict a bidirectional association's cached collection when the association is
changed only from the owning side. It is off because tracking that costs something on every
change, and the guide says so. The consequence is stated equally plainly: if your application
does not manage both sides of a bidirectional association and the collection side is cached, the
alternative is stale data in the collection cache. That turns the "always update both sides"
convention from a piece of hygiene into a correctness requirement, and it is the sort of coupling
between two apparently unrelated decisions — how you write your setters, and whether you enabled a
cache — that makes second-level caching more expensive to own than it first appears.

{/* FOOTER */}
