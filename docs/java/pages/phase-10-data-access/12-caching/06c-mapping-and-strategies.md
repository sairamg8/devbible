---
title: "Marking an entity cacheable takes two annotations from two packages, and the second one asks you to pick a concurrency strategy where the cheap-looking option relaxes correctness rather than speed"
sidebar_label: "6c · Mapping and strategies"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14.2 *Configuring second-level
> cache mappings* and §14.3 *Entity inheritance and second-level cache mapping*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the chapter source on the `7.4` branch
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/documentation/src/main/asciidoc/userguide/chapters/caching/Caching.adoc)),
> `org.hibernate.cfg.CacheSettings`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/CacheSettings.html))
> and Jakarta Persistence 3.2 §11.1.7 `Cacheable`
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**Opting an entity into the second-level cache is two annotations and one real decision. The
annotations are `jakarta.persistence.@Cacheable` and `org.hibernate.annotations.@Cache`, they come
from different specifications, and you generally need both. The decision is the concurrency
strategy, which is where the guide's own wording is worth reading closely — one of the four
options trades away consistency, not latency, and it is the one that sounds harmless.**

## Opt in: the shared-cache mode decides what "cacheable" means

The default shared-cache mode is selective:

> `ENABLE_SELECTIVE` *(Default and recommended value)*: *"Entities are not cached unless
> explicitly marked as cacheable (with the `@Cacheable` annotation)."*

with the other three being `DISABLE_SELECTIVE` (*"Entities are cached unless explicitly marked as
non-cacheable"*), `ALL` (*"Entities are always cached even if marked as non-cacheable"*) and
`NONE` (*"No entity is cached even if marked as cacheable. This option can make sense to disable
second-level cache altogether."*).

## Choose a concurrency strategy, per entity

The guide is explicit that this should not be global:

> *"Rather than using a global setting, it is recommended to define the cache concurrency strategy
> on a per entity basis. Use the `@org.hibernate.annotations.Cache` annotation for this purpose."*

```java
@Entity
@Cacheable                                                   // jakarta.persistence
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)          // org.hibernate.annotations
public class Country {

    @Id private String iso;
    private String name;

    @OneToMany(mappedBy = "country")
    @Cache(usage = CacheConcurrencyStrategy.READ_WRITE)      // the collection needs its own
    private List<Region> regions = new ArrayList<>();
}
```

Both annotations. Two different packages, similar names, and only one of them is the one people
remember.

## The four concurrency strategies, verbatim

> **read-only** — *"If your application needs to read, but not modify, instances of a persistent
> class, a read-only cache is the best choice. Application can still delete entities and these
> changes should be reflected in second-level cache so that the cache does not provide stale
> entities. Implementations may use performance optimizations based on the immutability of
> entities."*

> **read-write** — *"If the application needs to update data, a read-write cache might be
> appropriate. This strategy provides consistent access to single entity, but not a serializable
> transaction isolation level; e.g. when TX1 reads looks up an entity and does not find it, TX2
> inserts the entity into cache and TX1 looks it up again, the new entity can be read in TX1."*

> **nonstrict-read-write** — *"Similar to read-write strategy but there might be occasional stale
> reads upon concurrent access to an entity. The choice of this strategy might be appropriate if
> the application rarely updates the same data simultaneously and strict transaction isolation is
> not required. Implementations may use performance optimizations that make use of the relaxed
> consistency guarantee."*

> **transactional** — *"Provides serializable transaction isolation level."*

**`read-write` is the default choice for mutable data and `read-only` for immutable data.** The
one to be careful with is `nonstrict-read-write`: it is the cheap-looking option, and the
guarantee it relaxes is correctness rather than latency. `transactional` requires a JTA
transaction manager and a provider that supports it, which in a Spring Boot application on a
single `DataSource` you almost certainly do not have.

⚠️ **The strategy is fixed at the root of an inheritance hierarchy.** Jakarta Persistence allows
the marker to vary — *"The value of the `Cacheable` annotation is inherited by subclasses; it can
be overridden by specifying `Cacheable` on a subclass."* — and Hibernate honours that since 5.3,
but adds: *"the Hibernate cache concurrency strategy (e.g. read-only, nonstrict-read-write,
read-write, transactional) is still defined at the root entity level and cannot be overridden."*
So one subclass being immutable does not let you give it `read-only`.

## `include = "non-lazy"`

`@Cache` has three attributes, and the third is the one nobody reads:

> **usage** — *"Defines the `CacheConcurrencyStrategy`"* · **region** — *"Defines a cache region
> where entries will be stored"* · **include** — *"If lazy properties should be included in the
> second level cache. The default value is `all` so lazy properties are cacheable. The other
> possible value is `non-lazy` so lazy properties are not cacheable."*

If you made a column lazy because it is large — a document body, a serialized blob — the default
puts a copy of it in every cache node anyway, defeating the reason it was made lazy. `include =
"non-lazy"` is a one-word change with a large effect on memory, and it is easy to miss because
lazy columns and caching are documented in different chapters and decided by different people at
different times.

## Gotchas

**★ `@Cacheable` and `@Cache` are two different annotations from two different packages** and you
generally need both — `@Cacheable` to opt in under `ENABLE_SELECTIVE`, `@Cache` to choose the
concurrency strategy.

**★ Importing the wrong `@Cache` is easy and quiet.** Spring, Hibernate and several cache
libraries all ship an annotation by that name; the one that governs the second-level cache is
`org.hibernate.annotations.Cache` and it takes a `usage` attribute.

**★ `nonstrict-read-write` relaxes correctness, not performance.** "Occasional stale reads upon
concurrent access" is the documented behaviour, and it is the strategy people pick because it
sounds like a minor optimisation.

**★ `read-write` is explicitly not serializable isolation**, and the guide gives the concrete
counter-example: a lookup that misses, a concurrent insert into the cache, and a second lookup in
the same transaction that now finds it.

**★ `transactional` needs JTA.** On a single-`DataSource` Boot application it is not an option,
whatever the annotation lets you write.

**★ The concurrency strategy cannot be overridden per subclass**, even though `@Cacheable` can be.
An immutable subclass in a mutable hierarchy still gets the root's strategy.

**★ `include` defaults to `all`, so lazy columns are cached.** The reason you made the column lazy
is undone by the cache unless you set `include = "non-lazy"`.

**★ `DISABLE_SELECTIVE` and `ALL` invert the default in a way that scales badly.** Every entity
added later is cached without anyone deciding to cache it, including the write-heavy ones.

**★ `hibernate.cache.default_cache_concurrency_strategy` exists and the guide advises against
relying on it.** It says the per-entity annotation is recommended, and adds that the setting "is
very rarely required as the pluggable providers do specify the default strategy to use".

**★ A `region` name is more than a label.** It is the granularity at which the provider's own
expiry and size limits apply, so entities sharing a region share an eviction policy whether or not
that suits them.

## Interview questions

**★ Which concurrency strategy would you choose, and why not `nonstrict-read-write`?**
`read-only` for data that genuinely never changes — reference tables, a currency list — because
implementations can optimise on immutability. `read-write` for everything else that is mutable,
accepting that the guide is explicit it is not serializable isolation and gives a concrete
example of a phantom read across transactions. `transactional` gives serializable isolation and
needs JTA, which most Boot applications do not have. `nonstrict-read-write` is the one to be
suspicious of: what it relaxes is not speed but consistency, and the guide's wording is
"occasional stale reads upon concurrent access". It is appropriate when the same data is rarely
updated simultaneously and you have decided you can live with the window — which is a decision,
not a default.

**★ What does `@Cache(include = "non-lazy")` do and when do you want it?**
It excludes lazy properties from the cache entry. The default is `all`, which means lazy
properties *are* cached — so if you made a column lazy because it is a large document you did not
want moved around, the second-level cache puts a copy of it in every node anyway. `non-lazy`
restores the intent. It is a small setting with a disproportionate memory effect, and it is easy
to miss because laziness and caching are decided in different places for different reasons and
nothing connects them.

**★ Why are there two annotations, and what happens if you use only one?**
`jakarta.persistence.@Cacheable` is the specification's opt-in marker and is meaningful because
the default shared-cache mode is `ENABLE_SELECTIVE` — without it, under the default mode, the
entity is not cached at all. `org.hibernate.annotations.@Cache` is Hibernate's own annotation and
carries the things the specification does not model: the concurrency strategy, the region name,
and whether lazy properties are included. Using only `@Cacheable` leaves the strategy to a global
setting the guide says you should rarely rely on; using only `@Cache` works in practice on
Hibernate because the annotation implies cacheability, but it ties the mapping to Hibernate and
loses the portable marker. I write both.

**★ Would you ever set `jakarta.persistence.sharedCache.mode` to `ALL`?**
Almost never, and the reason is about how it ages rather than how it behaves today. `ALL` caches
every entity "even if marked as non-cacheable", so from that point on any entity anyone adds is
cached by default — including a write-heavy audit table whose cache will be invalidated faster
than it is populated, at full memory cost. `ENABLE_SELECTIVE` is the documented default and the
documented recommendation precisely because it forces each decision to be made once, by someone
who looked at the read-to-write ratio. `NONE` is genuinely useful, though: it disables the
second-level cache wholesale without touching any mapping, which makes it a good switch for a
test profile.

**★ Why can `@Cacheable` be overridden on a subclass but the concurrency strategy cannot?**
Because they answer different questions. Jakarta Persistence defines `Cacheable` as inherited and
overridable per subclass, and Hibernate has honoured that since 5.3 — whether a particular
subclass is worth caching is a local judgement. The concurrency strategy is a property of the
cache region and the invalidation protocol for the hierarchy as a whole, so Hibernate keeps it at
the root and says it "cannot be overridden". The guide also gives its reasons for wanting the
whole hierarchy to share caching semantics anyway: per-type checks slow bootstrap, and different
semantics per subtype would violate the Liskov substitution principle — a subclass would behave
observably differently from its parent for reasons that have nothing to do with the domain.

{/* FOOTER */}
