---
title: "A pull request that adds `@Cacheable` is three lines long and changes the consistency model of your application, so this is the list a reviewer runs down — the decision, the method, the name, the key and the store — before the annotation is allowed through"
sidebar_label: "9 · The checklist"
sidebar_position: 34
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — this chunk collects rules established and cited in chunks 01–08d of this topic;
> each item links to the chunk carrying the primary source. Spine sources: the Spring Framework 7.0
> reference *Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache.html](https://docs.spring.io/spring-framework/reference/integration/cache.html)),
> the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)),
> the Hibernate ORM 7.4 *User Guide* §14 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and PostgreSQL 18 ([postgresql.org/docs/18](https://www.postgresql.org/docs/18/)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Hibernate ORM 7.4.1, Redis 8, PostgreSQL 18.

**Three lines of annotation add a second copy of your data with a consistency model nobody wrote
down, a memory budget nobody sized, a serialization format nobody chose, and an invalidation
obligation that extends to every future write anywhere in the system. This is the order to review
them in, and the first section is the one that most often ends the review.**

## 1 · Should this exist at all?

**Why is the operation expensive?** Get the statement and its plan. A sequential scan for a
selective predicate is a migration, not an annotation ([8](08-when-not-to-cache.md)). A hundred
statements is a fetch plan
([`../08-the-n-plus-1-problem/14-choosing-a-fix.md`](../08-the-n-plus-1-problem/14-choosing-a-fix.md)).

**Can the sentence be finished?** *"We will serve `<this>` up to `<this long>` out of date, because
it is read `<this often>` per write, and a stale answer costs `<this>`."* If not, the change is not
understood yet ([1](01-caching-is-a-decision.md)).

**Who agreed the staleness budget?** It is a product decision. If the answer is "engineering
decided", it has not been decided ([5c2](05c2-choosing-and-applying-a-ttl.md)).

**Is stale *wrong* rather than *late*?** Permissions, balances, prices, kill switches, rate limits,
idempotency keys, single-use tokens. The answer for these is no
([8b](08b-when-the-cache-is-the-wrong-risk.md)).

**What is the read-to-write ratio for the key — not for the table?** This is the number that decides
whether an entry is ever read twice, and it is almost never in the pull request
([8c](08c-what-to-measure-first.md)).

**Is the key space bounded?** A key containing a timestamp, a request id, a free-text term or a
`Pageable` is unbounded by construction ([3d](03d-the-key-that-never-repeats.md)).

## 2 · The method it is on

**Is it called from inside the same class?** Then it caches nothing — the same proxy rule as
`@Transactional`, with a quieter symptom ([2b](02b-the-proxy-again.md)).

**Is the method `private`, `final`, or the class `final`?** The proxy cannot advise it.

**Does the same input always produce the same output?** The reference's precondition is that the
method is *"guaranteed to return the same output (result) for a given input"*. A method reading the
clock, the current user or another tenant's data does not satisfy it, and nothing checks
([1](01-caching-is-a-decision.md)).

**Does it return `CompletableFuture`, `Mono` or `Flux`?** A `Flux` is buffered into a single cache
entry ([2d](02d-futures-and-reactive-returns.md)).

**Is the returned object mutable, and shared?** With a local cache every caller gets the same
instance. One caller mutating it corrupts the entry for everyone
([2](02-the-cache-abstraction.md)).

**Is `@Cacheable` on the same method as `@CachePut` or `@CacheEvict`?** The reference calls the first
combination *"strongly discouraged"*, and the second stops evicting as soon as the cache starts
working ([7c](07c-getting-the-eviction-right.md)).

## 3 · The cache name

**Is the name declared in `spring.cache.cache-names`?** If not, the cache is created on first use and
Boot's metrics — which bind only caches present at startup — never see it
([8c](08c-what-to-measure-first.md)).

**Is it a distinct name per shape, or a catch-all?** `allEntries = true` clears one named cache, so a
shared `"lookups"` cache makes every wholesale eviction maximally expensive
([7e](07e-the-writes-the-cache-never-sees.md)).

**Does the name appear in more than one place with different value types?** Two methods writing
different shapes under one cache produce a cast or deserialization failure, not a stale value
([7d](07d-the-invalidation-you-forgot.md)).

## 4 · The key

**Is the key the default one?** The default generator hashes the parameters and **not the method**,
so two methods in the same cache with the same arguments collide ([3](03-keys.md)).

**Does the key contain every input the answer depends on?** Tenant, locale, currency, the current
user, the feature-flag state. A missing dimension is not a miss, it is a confident wrong answer
([3c](03c-keys-that-silently-vary.md)).

**Does the SpEL expression survive a rename?** It is an unchecked string in an annotation
([3b](03b-writing-the-key-yourself.md)).

**Does the key rely on `hashCode` of an entity or a `Pageable`?** Entity equality is its own trap
([`../06-jpa-hibernate-model/10-equals-and-hashcode.md`](../06-jpa-hibernate-model/10-equals-and-hashcode.md)).

## 5 · `condition`, `unless`, `null` and `sync`

**Is `condition` being used where `unless` is meant?** `condition` runs before the method and turns
the whole cache off; `unless` runs after and only vetoes the write ([4](04-null-and-sync.md)).

**Does the method return `null` for a missing row?** The `null` is cached, on purpose. Decide whether
that is negative caching you want or a bug you have ([4](04-null-and-sync.md)).

**Does `unless` reference `#result` on a method that can return `null`?** It needs safe navigation.

**Is `sync = true` needed, and is it supported by the store?** It serialises callers within one JVM
only, so it does not prevent a cluster-wide stampede ([4](04-null-and-sync.md),
[5d](05d-clearing-locking-and-failing.md)).

The second half of the review — the store, the wire format, the TTL, the invalidation, the Hibernate
regions and the observability — is
[9b · The checklist: the store and the invalidation](09b-the-store-and-the-invalidation.md).

## Gotchas

**★ The pull request is three lines and the change is architectural.** Nothing about the diff's size
reflects that you have added a second copy of the data with a consistency model nobody wrote down.

**★ Most of this checklist cannot be answered from the diff.** The write paths, the topology, the
provider and the staleness budget are all somewhere else, and a reviewer who stays inside the changed
file will pass every item.

**★ Section 1 ends more reviews than the rest combined**, and it is the one people skip because it
feels like a design conversation rather than a code review.

**★ A cache added to a method is inherited by every future caller of that method.** The next feature
to call it gets a staleness decision that was made for a different use case, silently and with no
diff of its own.

**★ "We already cache elsewhere, this is consistent" is not a reason.** Each cache is its own trade;
consistency of style is not consistency of data.

**★ A method that is *usually* deterministic passes this section and fails in production.** The
reference's precondition is "guaranteed to return the same output for a given input", and the
abstraction checks nothing — a hidden dependency on the clock, the current user or a tenant is a
missing key dimension, not a rare edge case.

**★ The mutability of the cached object is a review item that nobody has on their list.** With a
local store every caller shares one instance, so a single mutation corrupts the entry for everyone
and leaves no trace of where it happened.

**★ An unbounded key space is visible in the annotation itself.** You do not need production data to
see that a key contains a timestamp, a request id or a `Pageable`; you need to read the expression.

## Interview questions

**★ What is the first question you ask about a pull request that adds `@Cacheable`?**
Why the operation is expensive, and I want the statement and its plan rather than a description. If
it is a sequential scan the answer is an index, and the cache would leave the defect in place while
removing the signal that it exists. If it is a hundred statements the answer is a fetch plan. Only
when the work being removed is genuinely irreducible — a downstream call, a real aggregation, an
external API — do I move on to the second question, which is whether the data tolerates being stale
and who agreed the number.

**★ You have five minutes to review a caching change. What do you check?**
Whether the method is self-invoked, because then it does nothing at all and the reviewer's job is
finished. Whether the key contains every input the answer depends on, because a missing dimension is
a confident wrong answer rather than a cache miss. Whether the key space is bounded, which I can
usually read straight off the expression. Whether there is a TTL. And whether the write paths that
invalidate this data exist and evict — starting with the derived entries, the counts and lists and
summaries, because those are the ones nobody writes an evict for.

**★ Which items on the checklist cannot be answered by reading the diff?**
Most of them. The write paths are in other files, often other modules and sometimes other services.
The number of instances is in a deployment manifest. The provider is decided by the classpath and by
whether anyone defined a `CacheManager` bean. The TTL and the error handler are in a configuration
class. The staleness budget is in somebody's head. That is precisely why this class of defect
survives review: every individual diff is locally correct, and the bug is a relationship between two
files that are never open at the same time.

**★ Which one-line changes to a caching setup deserve a second look?**
Adding a parameter to a cached method, because the default key generator includes it and every
existing entry becomes unreachable. Changing a cached method's return type, because the store may
still hold the old shape. Adding a field to a cached class, which under JDK serialization makes
entries written by the old pods unreadable by the new ones. Renaming a property referenced in a SpEL
key, which fails at evaluation time rather than at compile time. And adding `@Cacheable` to a method
that another new feature is about to call for a different purpose, which silently applies one
staleness decision to two use cases.

**★ How would you review the *key* specifically?**
By listing every input the answer depends on and checking each one appears in the key. The arguments
are the easy part; the dangerous ones are the inputs that are not arguments — the tenant, the locale,
the currency, the authenticated user, a feature-flag state read inside the method. Each of those is a
dimension the answer varies along, and a dimension missing from the key does not cause a miss, it
causes one tenant to be served another tenant's answer. Then the opposite check: is anything in the
key that the answer does *not* depend on? A timestamp, a request id or a whole `Pageable` makes the
key never repeat, which turns the cache into a write-only store that grows until something fails.

**★ Someone says the method is deterministic, so it is safe to cache. How do you check?**
By asking what it reads that is not a parameter. The reference's requirement is that the method is
guaranteed to return the same output for a given input, and "input" means the arguments, not
everything the body can reach. So I look for the clock, the security context, a tenant resolved from
a thread-local, a random or a UUID, a call to another service whose answer changes, and any static or
injected mutable state. Every one of those is a hidden input, and the fix is either to make it an
explicit parameter so it lands in the key, or to accept that the method is not cacheable. Nothing in
Spring validates this, so it is entirely a review responsibility.

{/* FOOTER */}
