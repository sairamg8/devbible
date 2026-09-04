---
title: "The cache abstraction is advice on your methods, so a bulk `UPDATE`, a migration or another program changes the rows with nothing to annotate — and for those writes the TTL is not a backstop, it is the whole mechanism"
sidebar_label: "7e · The writes the cache never sees"
sidebar_position: 28
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching*, *The `@CacheEvict` Annotation*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the Jakarta Persistence 3.2 specification §4.11 *Bulk Update and Delete Operations*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Spring Boot 4.1 actuator *Caches (caches)* endpoint reference
> ([docs.spring.io/spring-boot/api/rest/actuator/caches.html](https://docs.spring.io/spring-boot/api/rest/actuator/caches.html))
> and the `RedisCacheManager.RedisCacheManagerBuilder` javadoc
> ([docs.spring.io/spring-data/redis](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8, PostgreSQL 18.

**[7d](07d-the-invalidation-you-forgot.md) is about entries whose keys nobody connected to a write
you *did* intercept. This chunk is about the writes there is nothing to intercept: a bulk statement,
a `JdbcTemplate` call, a Flyway data migration, another service, a person with `psql`. For those
there is no method to annotate and therefore no eviction to write, which is why a TTL is not a
tuning knob but the only bound that exists.**

## Five routes around the proxy, all of them ordinary code

The cache abstraction is proxy-based advice on beans in your context
([2b](02b-the-proxy-again.md)). Anything that changes a row without invoking an advised method is
invisible to it, and a normal Spring service has at least five such routes:

| Route | Why the cache does not see it | Where it is argued |
|---|---|---|
| `@Modifying` bulk JPQL or criteria update/delete | one SQL statement; no cached bean invoked | [`../09-spring-data-jpa/04-modifying-queries.md`](../09-spring-data-jpa/04-modifying-queries.md) |
| `deleteAllInBatch`, bulk deletes | one statement, no lifecycle callbacks | [`../09-spring-data-jpa/04c-derived-delete-versus-bulk-delete.md`](../09-spring-data-jpa/04c-derived-delete-versus-bulk-delete.md) |
| `JdbcTemplate` / `JdbcClient` | outside Hibernate and outside the abstraction entirely | [`../05-sql-first-access/README.md`](../05-sql-first-access/README.md) |
| A Flyway data migration or backfill job | rewrites rows while the application holds cached copies | [`../11-flyway-migrations/10-data-migrations.md`](../11-flyway-migrations/10-data-migrations.md) |
| Another service, another application, an operator | your process never observes it | — |

The specification already warns about the in-process half of the first row, and the reasoning
transfers directly to any cache — which has even less connection to the statement than the
persistence context does:

> *"The persistence context is not synchronized with the result of the bulk update or delete.
> Caution should be used when executing bulk update or delete operations because they may result in
> inconsistencies between the database and the entities in the active persistence context."*

🔴 **The last two rows are the ones no code change of yours can fix.** Either the writer publishes an
invalidation event and your application subscribes to it — which makes the cache a distributed
system with its own delivery guarantees and its own failure modes — or the only bound on staleness
is the TTL from [5c2](05c2-choosing-and-applying-a-ttl.md). That is the strongest argument in this
topic for never running a cache with no expiry, and it is why Boot's Redis default of
`Key Expiration: None` ([5c](05c-expiry-and-eviction.md)) is the wrong default for almost everyone.
Hibernate's own version of this problem, and the two remedies its documentation offers, are
[7f](07f-what-hibernate-never-sees.md).

## The key that lives in another table

This family produces security incidents rather than cosmetic bugs, because the key and the changed
row are not even in the same table.

```java
@Cacheable(cacheNames = "permissions", key = "#userId")
public Set<Permission> permissionsOf(long userId) { … }
```

A user's permissions are a join over `user_role` and `role_permission`. **Removing a permission from
a role is a write to `role_permission`, and the cache key is a user id** — a value that write path
does not have and cannot cheaply compute, because the set of affected users is itself a query whose
cost is the thing the cache existed to avoid. The same shape recurs for tenant configuration keyed
by tenant while the write is on a config row, for feature flags keyed by flag name while the write
is on a rollout rule, and for prices keyed by SKU while the write is on a discount schedule.

There are three honest options, and "add an evict" is not one of them.

**1 · Do not cache it.** For authorisation this is usually correct, and the argument is in
[8 · When not to cache](08-when-not-to-cache.md): staleness here is not slower truth, it is a
revoked user who still has access.

**2 · Key the cache on what actually changes.** Cache the *role's* permission set, not the user's,
and compose at read time. Now the write and the key are in the same table, the eviction is
expressible, and the per-user join is cheap because its inputs are cached.

**3 · Clear the whole cache on any write to any contributing table**, and pay for it. That is the
next section.

## The blunt instrument, and what it costs

```java
@CacheEvict(cacheNames = "permissions", allEntries = true)
public void updateRolePermissions(long roleId, Set<Permission> permissions) { … }
```

> *"…features an extra parameter (`allEntries`) that indicates whether a cache-wide eviction needs to
> be performed rather than just an entry eviction (based on the key). … This option comes in handy
> when an entire cache region needs to be cleared out. Rather than evicting each entry (which would
> take a long time, since it is inefficient), all the entries are removed in one operation… Note
> that the framework ignores any key specified in this scenario as it does not apply."*

It is correct, it is the right answer more often than its reputation suggests, and it has three
costs to name before reaching for it:

- **Every entry in that cache goes cold at once**, so the next burst of traffic runs entirely on
  misses. If the underlying query is expensive this is a self-inflicted thundering herd, and
  `sync = true` only serialises callers within one JVM ([4](04-null-and-sync.md)).
- **On Redis, `clear()` is not one operation.** `RedisCacheManager`'s default is a
  `KEYS`-pattern-based clear, which is a server-wide scan rather than a cheap key delete
  ([5d](05d-clearing-locking-and-failing.md)).
- **Combined with `beforeInvocation = true` it runs on every call**, successful or not
  ([7c](07c-getting-the-eviction-right.md)).

⚠️ **The lever that makes `allEntries` cheap is cache *naming*.** It clears one named cache, so the
blast radius is whatever you put in that cache. A single `"lookups"` cache holding permissions,
tenant config, currency rates and the product catalogue makes every wholesale eviction maximally
expensive. One named cache per derived shape — `permissionsByRole`, `tenantConfig`, `fxRates` —
turns `allEntries` from a last resort into a precise instrument. That is a design decision made at
the moment you type the cache name, months before anyone needs to evict it.

## How you actually find these: enumerate the writes

The reason this class of bug survives review is that a review reads the diff, and the diff contains
the `@Cacheable`. The exercise that works is the opposite one, and it is mechanical enough to do in
an hour.

**Step 1 — list every cache.** Grep for `@Cacheable`, `@CachePut` and `cacheNames`, and record for
each: the cache name, the key expression, the value type, and **which tables the method reads**. The
actuator endpoint gives you the runtime half of this — *"The `caches` endpoint provides access to the
application's caches"* — which is how you catch names built from constants and caches created by
code you did not grep.

**Step 2 — list every write to those tables.** Not every write in the application: every write to the
tables from step 1. That means `@Transactional` service methods, `@Modifying` queries, `JdbcTemplate`
calls, repository `save` and `delete`, the cascades reachable from those entities, and the migration
directory. Cascades and `ON DELETE CASCADE` are the two people forget, because they are declared in
the mapping and the DDL rather than at any call site.

**Step 3 — cross the two lists.** Every (write, cache) pair where the write touches a table the
cached method reads is one of three things: an eviction you have, an eviction you are missing, or a
deliberate decision to tolerate staleness bounded by the TTL. Write down which, next to the cache
name, and keep the note.

**Step 4 — write the writers you do not control at the bottom.** Other services, migrations,
operators. For every cache reachable from those, the TTL *is* the design, and it has to be short
enough that the worst case is acceptable to whoever owns the consequence.

The output of that exercise is [9 · The checklist](09-the-checklist.md) specialised to your
application, and it is the only artefact I know of that makes this class of defect visible before a
user finds it.

## Gotchas

**★ A `@Modifying` bulk statement evicts nothing.** It never invokes the cached bean, so no
interceptor runs, and the specification already warns that even the persistence context is not
synchronised with its result.

**★ `JdbcTemplate`, a migration, a DBA and any other application are unreachable by design.** There
is no method to annotate, so the TTL is not a backstop for these — it is the entire mechanism.

**★ Boot's Redis cache ships with no expiry, which makes the unreachable writes permanent.** A missed
invalidation with a TTL is a temporary defect; the same miss with `Key Expiration: None` lasts until
someone restarts something.

**★ The permission cache is the dangerous one.** Its key is a user and its data lives in a join
table, so the write that revokes access cannot name the entries it invalidated, and the failure mode
is a revoked user who still has access.

**★ Publishing invalidation events does not remove the problem, it relocates it.** Now you have
message ordering, at-least-once delivery, consumers that were down during the write, and a cache that
is wrong in exactly the window your broker was retrying.

**★ `allEntries = true` clears one *named* cache, so the blast radius is a naming decision.** A
catch-all `"lookups"` cache makes every wholesale eviction as expensive as it can possibly be; one
cache per derived shape makes the same annotation precise.

**★ On Redis, `clear()` is a `KEYS` scan by default.** A wholesale eviction is a server-wide
operation affecting every client of that instance, not a cheap delete.

**★ A wholesale eviction is a self-inflicted cold start.** Every entry goes at once, so the next
burst of traffic runs entirely on misses, and `sync = true` serialises only within one JVM — with
several pods you get several simultaneous herds ([7b](07b-caching-in-a-cluster.md)).

**★ A grep for `@Cacheable` does not find every cache.** Names assembled from constants, caches
created on the fly by the simple provider, and library code all show up at runtime and not in the
source; the actuator `caches` endpoint is how you see them.

**★ Reviews find none of this, because reviews read the diff.** The `@Cacheable` is in the diff; the
write in another module that invalidates it is not, and never will be.

## Interview questions

**★ What does a `@Modifying` bulk update do to your Spring caches?**
Nothing, which is the problem. It is a single SQL statement issued through the `EntityManager`; it
does not invoke the cached bean, so no `@CacheEvict` interceptor runs. The specification already
warns that even the persistence context — which is far closer to the statement than a cache is — is
not synchronised with its result. Practically, a bulk statement is exactly the case where clearing
the affected caches wholesale is right: it has already touched an unknown number of rows, so a
per-key eviction is not available anyway. What Hibernate's second-level cache does in the same
situation is a separate and less settled question, and it is [7f](07f-what-hibernate-never-sees.md).

**★ Which changes to the database can your application never invalidate?**
Every one that does not go through it: another service writing the same tables, a Flyway data
migration, a backfill job, an operator running an `UPDATE` by hand. There is no method to annotate,
so there is no eviction to write. That leaves two mechanisms — the writer publishing an invalidation
message that your application subscribes to, which makes the cache a distributed system with its own
delivery guarantees, or a TTL that bounds how long the wrong answer survives. This is the strongest
argument for never running a cache with no expiry.

**★ How would you invalidate a permissions cache keyed by user when the write is on a role?**
Usually by not building it that way. The key and the changed row are in different tables, so the
write path cannot enumerate the affected keys without running a query — and if it runs that query on
every role change, it has reintroduced the work the cache was avoiding. The two workable designs are
to key the cache on what actually changes, caching the role's permission set and composing the user's
set at read time so the write and the key live in the same table, or to clear the whole permission
cache on any change to any contributing table and accept the miss storm. And because a stale
authorisation decision is a security defect rather than a cosmetic one, the option I would argue for
first is not caching it at all.

**★ When is `@CacheEvict(allEntries = true)` the right answer rather than a cop-out?**
When the write cannot enumerate the affected keys — a bulk statement, a change to a table that
contributes to derived entries, a configuration reload — and when the named cache is scoped tightly
enough that clearing it is proportionate. That second condition is the one people skip. `allEntries`
clears one named cache, so if `"lookups"` holds four unrelated things, a change to one of them throws
away all four. If each derived shape has its own cache name, the same annotation becomes precise. The
costs to state out loud are the cold start on the next burst of traffic and, on Redis, that the
default `clear()` is a `KEYS`-pattern scan across the whole server.

**★ How do you find missing invalidations in a codebase you did not write?**
By enumerating the writes rather than the reads. List every cache — grep for `@Cacheable` and check
the actuator `caches` endpoint for the ones created at runtime — and record the tables each cached
method reads. Then list every write to those tables: services, `@Modifying` queries, `JdbcTemplate`,
repository deletes, cascades declared in the mappings, `ON DELETE CASCADE` in the DDL, and the
migration folder. Cross the two lists; each pair is an eviction you have, one you are missing, or a
staleness you have decided to tolerate. Finally, write down the writers you do not control at all,
because for those the TTL is not a backstop, it is the whole design.

**★ Why does code review not catch this class of bug?**
Because a review reads a diff and this bug is a relationship between two files that are never in the
same diff. The pull request that adds `@Cacheable` is obviously correct in isolation; the pull
request six months later that adds a bulk `UPDATE` to another module is also obviously correct in
isolation. Nothing in the language, the type system or the build connects a cached read to the writes
that invalidate it, and the runtime symptom is a successful response containing an old value — no
exception, no metric, no log line. That is why the mechanism has to be an explicit periodic exercise
rather than a hope that someone notices.

**★ Someone proposes publishing invalidation events so every service can evict. What do you ask?**
What happens when a message is lost, delayed, delivered twice, or delivered to a consumer that was
restarting. Event-driven invalidation is a reasonable design, but it converts "the cache might be
stale" into "the cache is a distributed system", and every delivery guarantee you do not have becomes
a staleness window you cannot bound. I would want the TTL kept as a floor underneath it regardless,
because the TTL is the only mechanism that still works when the messaging does not — and I would want
to know whether the ordering of two events for the same key is guaranteed, because an out-of-order
invalidate-then-populate leaves exactly the stale entry the whole scheme was built to prevent.

{/* FOOTER */}
