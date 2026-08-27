---
title: "Giving a Redis entity a TTL writes a second copy of it, needs a Pub/Sub listener that is disabled by default, and leaves your secondary indexes pointing at objects that no longer exist"
sidebar_label: "05d · Expiry and the phantom copy"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Repositories ·
> Time To Live*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/expirations.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/expirations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data Redis 4.1.0, Spring Data KeyValue 4.1.0, Redis 8.

**Expiry is the reason most people choose Redis, and `@RedisHash(timeToLive = 3600)` looks
like the easiest annotation in this topic. It is not. Underneath it sits a chain of
machinery — a duplicate copy of every expiring entity, a keyspace-notification listener
that does not start by default, a Pub/Sub channel with no durability, and a set-based index
whose members Redis cannot expire individually. Every link in that chain has a failure mode,
and the ones at the end are silent.**

## Two ways to set a TTL

> *"The expiration time in seconds can be set with `@RedisHash(timeToLive=…)` as well as by
> using `KeyspaceConfiguration.KeyspaceSettings`"*

> *"More flexible expiration times can be set by using the `@TimeToLive` annotation on
> either a numeric property or a method. However, do not apply `@TimeToLive` on both a
> method and a property within the same class."*

```java
@RedisHash(value = "sessions", timeToLive = 1800)
public class UserSession {
    @Id String id;
    @Indexed String userId;
}
```

```java
@RedisHash("sessions")
public class UserSession {
    @Id String id;
    @TimeToLive(unit = TimeUnit.MINUTES) Long ttl;   // per instance
}
```

The per-property form has a second behaviour that is easy to miss:

> *"Annotating a property explicitly with `@TimeToLive` reads back the actual `TTL` or
> `PTTL` value from Redis. `-1` indicates that the object has no associated expiration."*

So on the way out, that field is not the value you stored — it is a **live query against the
server**. An entity loaded twice, a second apart, holds two different TTL values, and code
that round-trips an entity through `findById` and `save` is writing back a remaining
lifetime rather than the original one. That is how a session that should last thirty minutes
ends up lasting twenty-nine, then twenty-eight.

## The phantom copy

> *"When the expiration is set to a positive value, the corresponding `EXPIRE` command is
> run. In addition to persisting the original, a phantom copy is persisted in Redis and set
> to expire five minutes after the original one. This is done to enable the Repository
> support to publish `RedisKeyExpiredEvent`"*

Redis's expiry notification tells you a **key** expired. It cannot tell you what was in it,
because the value is gone. Spring Data solves this by keeping a second copy that outlives
the original by five minutes, so that when the notification arrives there is still something
to read and put in the event.

The consequences are worth stating plainly:

- **Every expiring entity is stored twice.** In a store whose defining constraint is that
  everything is in RAM, an annotation doubles the memory for that keyspace.
- **The copy lingers five minutes past the logical lifetime.** For a "delete after N
  seconds" requirement driven by policy rather than performance, the data is still resident
  after N seconds.
- Turning it off is one attribute, and it costs you the event's payload:

> *"`@EnableKeyspaceEvents(shadowCopy = OFF)` disable storage of phantom copies and reduces
> data size within Redis. `RedisKeyExpiredEvent` will only contain the `id` of the expired
> key."*

If your expiry handler only needs the id — to remove something from another system, to
increment a counter — `shadowCopy = OFF` is free. If it needs the object, you are paying
double memory for the privilege.

## The listener does not start by itself

> *"By default, the key expiry listener is disabled when initializing the application. The
> startup mode can be adjusted in `@EnableRedisRepositories` or `RedisKeyValueAdapter` to
> start the listener with the application or upon the first insert of an entity with a
> TTL."*

```java
@EnableRedisRepositories(
        enableKeyspaceEvents = RedisKeyValueAdapter.EnableKeyspaceEvents.ON_STARTUP)
```

Three states, three different behaviours:

| Mode | What you get |
|---|---|
| disabled (default) | keys expire; **no `RedisKeyExpiredEvent` is ever published**, and no index cleanup happens from expiry |
| on startup | the listener runs for the whole life of the application |
| on first insert of a TTL entity | the listener starts late, and anything that expired before it started was not observed |

The default is the trap. An application that relies on `RedisKeyExpiredEvent` and never
configures this receives nothing, forever, with no error — the same "annotation that does
nothing" shape as a missing transaction manager in
[04b · Wiring a Mongo transaction](04b-wiring-a-mongo-transaction.md).

Enabling the listener also touches server configuration, and one managed platform makes
that fail:

> *"Note that `CONFIG` is disabled on AWS ElastiCache, and enabling the listener leads to an
> error. To work around this behavior, set the `keyspaceNotificationsConfigParameter`
> parameter to an empty string. This prevents `CONFIG` command usage."*

That is a real production incident in one sentence: code that works against a local Redis
container fails on startup against ElastiCache because Spring Data tries to set
`notify-keyspace-events` and the platform forbids `CONFIG`. Setting the parameter to an
empty string means **you** must have configured the notification flags on the server
yourself — Spring Data will no longer do it, and it will not tell you that the flags are
missing.

## The failure nobody designs for: indexes that outlive their entities

Two sentences, and together they are the most important thing on this page:

> *"Redis does not allow for expiration of individual entries of a set that is used as
> secondary index."*

> *"Redis repositories rely on Pub/Sub messages for residual index cleanup. Redis Pub/Sub
> messages are not persistent. If a key expires while the application is down, the expiry
> event is not processed, which may lead to secondary indexes containing references to the
> expired object."*

Follow the mechanism. The entity hash carries a TTL and Redis removes it on schedule. The
index set `sessions:userId:u-42` is a *different key*, holding many members, and Redis has
no way to expire one member of a set. So the id can only be removed by the application, in
response to the expiry event — which arrives over Pub/Sub, which is fire-and-forget.

**Anything that stops your application from receiving that message leaves a permanent lie in
the index**: a deployment, a restart, a crash, a network partition, a listener that was
never enabled, a message dropped under load. Afterwards, `findByUserId("u-42")` returns an
id whose hash no longer exists.

There is no repair job, no consistency checker and no documented reconciliation. Design
around it:

- **Treat a query result as a set of candidates, not a set of facts.** Every finder result
  on an expiring keyspace must tolerate a null or empty load for an id it just received.
- **Prefer lookup by id over lookup by index for expiring data.** `findById` reads the hash
  directly and gets the truth; the index is the only part that can be stale.
- **Keep expiring entities' indexed properties few and low-cardinality**, because each one
  accumulates its own residue.
- **Consider not indexing an expiring entity at all.** If the access path is
  "session by id" and "sessions by user", the second one may be better served by a set you
  own and prune deliberately — see
  [05e · A data-structure server behind a repository](05e-a-data-structure-server-behind-a-repository.md).

## Gotchas

**★ The keyspace-event listener is disabled by default.** No configuration means no
`RedisKeyExpiredEvent`, ever, and no index cleanup on expiry. Nothing warns you; the events
simply never arrive.

**★ `shadowCopy` on means every expiring entity is stored twice.** In a memory-resident
store, an expiry annotation is also a memory-doubling annotation for that keyspace.

**★ The phantom copy outlives the original by five minutes.** "Gone after N seconds" is not
what the store does if the requirement is a deletion policy rather than a cache eviction.

**★ Secondary indexes are not cleaned up when a key expires while the application is
down.** The expiry event is a Pub/Sub message and Pub/Sub is not durable. The stale id stays
in the set indefinitely.

**★ Redis cannot expire one member of a set, which is why the whole mechanism exists.**
There is no server-side fix available to Spring Data, and therefore none available to you
either.

**★ A `@TimeToLive` property reads the remaining TTL on load, not the value you set.** A
load-modify-save round trip writes back the *remaining* lifetime, shrinking the TTL a little
on every save.

**★ `@TimeToLive` on both a property and a method in one class is documented as something
not to do.** The reference says so directly and does not define the outcome.

**★ Enabling the listener issues `CONFIG`, which AWS ElastiCache forbids.** The workaround
is `keyspaceNotificationsConfigParameter` set to an empty string — which then requires you
to have set `notify-keyspace-events` on the server yourself, silently.

**★ Expiry-driven index residue makes `count()` and `findAll()` wrong too.** They read the
keyspace set, which is maintained the same way. An entity that expired unobserved is still
counted.

**★ TTL and `save` interact.** A full `save` rewrites the hash; `PartialUpdate` is the
operation documented as taking care of updating expiration times. Changing a field with a
raw `RedisTemplate` command is where a TTL quietly becomes `-1`.

**★ `-1` means "no expiration", not "expired".** Code that treats a negative TTL as "about
to go" inverts the meaning of a value it reads straight from the server.

## Interview questions

**★ Why does Spring Data write a phantom copy of an expiring entity?**
Because Redis's expiry notification names a key that no longer has a value. To publish a
`RedisKeyExpiredEvent` carrying the expired object, a second copy is persisted and set to
expire five minutes after the original, so there is still something to read when the
notification arrives.

**★ What does `shadowCopy = OFF` cost you?**
The event payload. It stops the duplicate being written — halving the memory for that
keyspace — and `RedisKeyExpiredEvent` then contains only the id of the expired key.

**★ You are not receiving expiry events. What is the first thing to check?**
Whether the listener is enabled at all. It is disabled when the application initialises by
default; the startup mode has to be set explicitly, either to start with the application or
on the first insert of an entity with a TTL.

**★ Why can a secondary index end up pointing at an entity that no longer exists?**
Because Redis cannot expire an individual member of a set, so index cleanup is done by the
application in response to a Pub/Sub expiry message — and Pub/Sub is not persistent. A key
that expires while the application is down leaves its id in the index forever.

**★ How do you write code that survives that?**
Treat index-based query results as candidate ids and tolerate a missing hash for any of
them. Prefer `findById` for anything that must be accurate, keep the number of indexed
properties on expiring entities small, and accept that `count()` over such a keyspace is an
estimate.

**★ Why does an application that works locally fail to start against AWS ElastiCache?**
Because enabling the keyspace listener uses the `CONFIG` command to set
`notify-keyspace-events`, and ElastiCache disables `CONFIG`. Setting
`keyspaceNotificationsConfigParameter` to an empty string stops Spring Data issuing it — and
moves the responsibility for those server flags onto you.

**★ What does reading a `@TimeToLive` property give you?**
The live `TTL` or `PTTL` from Redis, with `-1` meaning no expiration. It is a server value
read at load time, not the value you assigned — which is why a load-modify-save loop erodes
the TTL.

**★ Is a TTL a good reason to choose the repository abstraction?**
It is a good reason to think hard. The annotation is one line and the machinery behind it —
duplicate storage, a listener you must enable, non-durable events, uncleanable index members
— is the most complicated thing in this topic. For a pure cache, `RedisTemplate` with an
explicit `EXPIRE` has none of it.

{/* FOOTER */}
