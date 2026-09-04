---
title: "`RedisTemplate` is the whole Redis API with connection management and serialization bolted on, and the bean Boot hands you is typed `Object, Object` for a reason you will discover by injection failure"
sidebar_label: "06 · RedisTemplate"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Working with Objects
> through RedisTemplate*
> ([docs.spring.io/spring-data/redis/reference/redis/template.html](https://docs.spring.io/spring-data/redis/reference/redis/template.html)),
> the Spring Boot 4.1 *Working with NoSQL Technologies* chapter
> ([docs.spring.io/spring-boot/reference/data/nosql.html](https://docs.spring.io/spring-boot/reference/data/nosql.html)),
> and the source of `DataRedisAutoConfiguration` at tag `v4.1.0`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-data-redis/src/main/java/org/springframework/boot/data/redis/autoconfigure/DataRedisAutoConfiguration.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Lettuce 7.5.2, Jedis 7.4.1, Redis 8.

**Everything the repository could not reach in the previous five chunks is reachable here.
`RedisTemplate` is not a fallback or an advanced tool — for most applications it is the
primary one, and the repository is the special case. What it adds over the raw driver is
exactly two things: it manages connections, and it turns your objects into bytes and back.
Both of those are worth having. The second one is also where every confusing bug in this
part of the topic comes from, because the template's idea of what a key looks like is not
Redis's.**

## What the template is

> *"The template is, in fact, the central class of the Redis module, due to its rich feature
> set."*

> *"While (Reactive)`RedisConnection` offers low-level methods that accept and return binary
> values (byte arrays), the template takes care of serialization and connection management,
> freeing the user from dealing with such details."*

> *"Once configured, the template is thread-safe and can be reused across multiple
> instances."*

Thread-safe **once configured** is the operative phrase: set the serializers at
configuration time and never mutate the template afterwards, exactly as with
`MongoTemplate`'s session synchronization in
[04b · Wiring a Mongo transaction](04b-wiring-a-mongo-transaction.md). One template bean per
key/value type combination you need, defined once, injected everywhere.

And the sentence that explains everything in the next chunk:

> *"From the framework perspective, the data stored in Redis is only bytes."*

## What Boot actually gives you

`DataRedisAutoConfiguration` (Boot 4 moved it to
`org.springframework.boot.data.redis.autoconfigure`) declares exactly two template beans:

```java
@Bean
@ConditionalOnMissingBean(name = "redisTemplate")
@ConditionalOnSingleCandidate(RedisConnectionFactory.class)
RedisTemplate<Object, Object> redisTemplate(RedisConnectionFactory redisConnectionFactory) {
    RedisTemplate<Object, Object> template = new RedisTemplate<>();
    template.setConnectionFactory(redisConnectionFactory);
    return template;
}

@Bean
@ConditionalOnMissingBean
@ConditionalOnSingleCandidate(RedisConnectionFactory.class)
StringRedisTemplate stringRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
    return new StringRedisTemplate(redisConnectionFactory);
}
```

Four facts are visible in those eleven lines, and all four matter:

1. **The vanilla template is `RedisTemplate<Object, Object>`.** Spring's injection is
   generics-aware, so a field declared `RedisTemplate<String, Order>` is **not** satisfied by
   this bean. The failure is a startup `NoSuchBeanDefinitionException` naming a type you can
   see in the reference documentation, which is a genuinely disorienting first encounter.
2. **The condition is on the bean *name*, not the type.** Define
   `@Bean RedisTemplate<String, Order> orderRedisTemplate(…)` and the auto-configured
   `redisTemplate` is still created, because no bean named `redisTemplate` exists. You now
   have two, and by-type injection has to be disambiguated. Naming your own bean method
   `redisTemplate` replaces it; naming it anything else adds to it.
3. **The auto-configured template sets only the connection factory.** No serializers are
   configured, so it uses `RedisTemplate`'s own defaults — which are Java native
   serialization, the subject of
   [06b · Serializers and the byte key](06b-serializers-and-the-byte-key.md).
4. **`@ConditionalOnSingleCandidate`** means that in an application with two Redis
   connection factories, *neither* template bean is created. Nothing is misconfigured and
   nothing is there.

The connection factory itself comes from `LettuceConnectionConfiguration` or
`JedisConnectionConfiguration`, imported in that order — *"By default, it uses Lettuce"* —
and configured with `spring.data.redis.*`, which unlike MongoDB's properties did **not**
move out of `spring.data` in Boot 4. *"By default, the instance tries to connect to a Redis
server at `localhost:6379`."*

## The operations views

The template does not put two hundred methods on one class. It exposes one view per Redis
type:

| View | Structure | Typical commands |
|---|---|---|
| `opsForValue()` | strings | `GET` `SET` `INCR` `SETEX` `SETNX` |
| `opsForList()` | lists | `LPUSH` `RPOP` `LRANGE` `BRPOP` |
| `opsForSet()` | sets | `SADD` `SREM` `SISMEMBER` `SINTER` |
| `opsForZSet()` | sorted sets | `ZADD` `ZRANGE` `ZRANGEBYSCORE` `ZINCRBY` |
| `opsForHash()` | hashes | `HSET` `HGET` `HGETALL` `HINCRBY` |
| `opsForStream()` | streams | `XADD` `XREAD` `XACK` |
| `opsForGeo()` | geospatial | `GEOADD` `GEOSEARCH` |
| `opsForHyperLogLog()` | HyperLogLog | `PFADD` `PFCOUNT` |

```java
redisTemplate.opsForZSet().incrementScore("leaderboard", playerId, points);
Set<String> topTen = redisTemplate.opsForZSet().reverseRange("leaderboard", 0, 9);

Long count = redisTemplate.opsForValue().increment("rate:" + userId + ":" + minute);
if (count == 1) {
    redisTemplate.expire("rate:" + userId + ":" + minute, Duration.ofMinutes(1));
}
```

That second snippet is the rate limiter the repository could not express: the increment and
its returned value are one atomic command, and the `EXPIRE` is issued only by whoever
created the key.

**The `Bound*Operations` variants** — `boundValueOps(key)`, `boundZSetOps(key)`,
`boundHashOps(key)` — bind a key once and drop it from every subsequent call. For a sequence
of operations on one key, they remove the most common typo surface in Redis code, which is
a key string repeated six times.

You can also skip `opsFor` entirely:

> *"For cases where you need a certain template view, declare the view as a dependency and
> inject the template. The container automatically performs the conversion, eliminating the
> `opsFor[X]` calls"*

```java
@Service
class Leaderboard {
    private final ZSetOperations<String, String> zset;
    Leaderboard(ZSetOperations<String, String> zset) { this.zset = zset; }
}
```

That is a genuinely good idea for a class that only ever touches one structure: the
dependency now states which part of Redis this component uses.

## `StringRedisTemplate`

> *"Since it is quite common for the keys and values stored in Redis to be
> `java.lang.String`, the Redis modules provides two extensions to `RedisConnection` and
> `RedisTemplate`, respectively the `StringRedisConnection` (and its
> `DefaultStringRedisConnection` implementation) and `StringRedisTemplate` as a convenient
> one-stop solution for intensive String operations."*

> *"In addition to being bound to String keys, the template and the connection use the
> `StringRedisSerializer` underneath, which means the stored keys and values are
> human-readable (assuming the same encoding is used both in Redis and your code)."*

Human-readable keys are not a cosmetic preference. They are the difference between being
able to debug a production Redis with `redis-cli` and not. **`StringRedisTemplate` is the
right default for almost everything**, with JSON in the values when you need structure.

## Dropping to the connection

```java
List<Object> results = redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
    for (String id : ids) {
        connection.hashCommands().hGetAll(("people:" + id).getBytes(StandardCharsets.UTF_8));
    }
    return null;
});
```

`execute(RedisCallback)` gives you a `RedisConnection` — raw bytes, every command the driver
supports, one connection for the whole callback. `executePipelined` does the same and sends
the commands without waiting for each reply, which is the Redis analogue of JDBC batching in
[01 · Batch updates](../01-jdbc/19-batch-updates.md): it removes round trips, not server
work.

Two things about the callback form. Its return values inside the callback are always `null`
— you read the results from the list `executePipelined` returns — and everything you touch
is `byte[]`, because that is what a connection deals in. Which is the whole subject of the
next chunk.

## Gotchas

**★ Injecting `RedisTemplate<String, String>` fails at startup.** The auto-configured bean
is `RedisTemplate<Object, Object>` and Spring's injection is generics-aware. Either inject
`StringRedisTemplate`, or declare your own typed bean.

**★ Your own `RedisTemplate` bean does not replace the auto-configured one unless it is
*named* `redisTemplate`.** The condition is `@ConditionalOnMissingBean(name =
"redisTemplate")`. Any other method name leaves both beans in the context.

**★ Two `RedisConnectionFactory` beans mean no auto-configured templates at all.**
`@ConditionalOnSingleCandidate` silently withdraws both. In a multi-Redis application you
declare everything yourself, and the first symptom is a missing bean rather than a wrong one.

**★ The auto-configured template has no serializers configured.** Boot sets only the
connection factory, so the defaults apply — and the defaults are Java native serialization,
which produces unreadable keys and is a security hazard.

**★ `RedisTemplate` is thread-safe only once configured.** Mutating serializers or
transaction support after startup is a visibility bug, not a configuration change.

**★ `opsForValue().increment(...)` is `INCR`, not a read-modify-write.** This is the point
of using the template — but only if you use the operation rather than getting, adding and
setting.

**★ A `RedisCallback` deals in `byte[]` and bypasses your serializers entirely.** Keys you
build inside a callback must be encoded the same way the template encodes them, or you will
be writing to a key that looks identical in the source and is different in Redis.

**★ `executePipelined` returns the results; the callback must return `null`.** Returning a
value from the callback is an error, and the shape surprises everyone the first time.

**★ Pipelining is not a transaction.** Commands are sent without waiting for replies; other
clients' commands can interleave. It buys latency, not atomicity.

**★ `KEYS` is available through the template and is a full keyspace scan that blocks the
server.** So is `FLUSHDB`. The template offers Redis's whole command surface including the
commands you must not run in production; nothing marks them.

**★ `spring.data.redis.*` did not move in Boot 4, but `spring.data.mongodb.*` partly did.**
MongoDB's connection properties are now `spring.mongodb.*`. Assuming symmetry between the
two modules is wrong in both directions.

**★ One template bean per key/value type combination is the intended design.** Trying to
serve every type from one `RedisTemplate<Object, Object>` is how a keyspace ends up with
three different encodings of the same value type.

## Interview questions

**★ What does `RedisTemplate` add over the driver?**
Connection management and serialization. The reference says the connection API offers
low-level methods that accept and return byte arrays, and that the template takes care of
serialization and connection management. Everything else it exposes is Redis's own command
set, organised by structure.

**★ Why does injecting `RedisTemplate<String, String>` fail in a Boot application?**
Because the auto-configured bean is declared `RedisTemplate<Object, Object>`, and Spring
resolves dependencies with generics. Inject `StringRedisTemplate`, or define your own
correctly typed bean.

**★ You defined a custom `RedisTemplate` bean and now there are two. Why?**
The auto-configuration is conditional on there being no bean *named* `redisTemplate`, not on
the absence of a `RedisTemplate` type. A differently named bean method adds a second one.

**★ When would you use `StringRedisTemplate` over the vanilla template?**
Almost always. It serialises keys and values as strings, so what you see in `redis-cli` is
what your code wrote — which is the difference between a debuggable production incident and
a hex dump.

**★ What are the operations views for?**
One per Redis structure: `opsForValue`, `opsForList`, `opsForSet`, `opsForZSet`,
`opsForHash`, `opsForStream`, `opsForGeo`, `opsForHyperLogLog`. You can inject the view
itself instead of the template, which documents in the constructor which part of Redis a
class touches.

**★ What is `executePipelined` for, and what is it not?**
It sends a batch of commands without waiting for each reply, removing round trips. It is not
a transaction — other clients can interleave, and there is no atomicity and no rollback.

**★ How do you implement a rate limiter with the template?**
`opsForValue().increment(key)` on a per-window key, and `expire(key, …)` when the returned
count is 1. The atomicity comes from `INCR` being a single command that returns the new
value; nothing in the Java code needs to be synchronised.

**★ Why is `RedisCallback` a place to be careful?**
Because it hands you the connection, which speaks bytes. Your serializers are not applied,
so any key you construct there must be encoded exactly as the template would have encoded
it — and a mismatch produces two keys that look the same in your source code.

{/* FOOTER */}
