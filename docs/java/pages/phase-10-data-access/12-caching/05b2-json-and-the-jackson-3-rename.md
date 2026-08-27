---
title: "Moving the cache to JSON removes the field-shape incident and keeps the class-name one, and on Spring Boot 4 the serializer you reach for was renamed and had two of its defaults inverted"
sidebar_label: "5b2 · JSON, and the Jackson 3 rename"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against `GenericJacksonJsonRedisSerializer`,
> `GenericJackson2JsonRedisSerializer` and `JacksonJsonRedisSerializer` on the Spring Data Redis
> `4.1.x` branch
> ([github.com/spring-projects/spring-data-redis](https://github.com/spring-projects/spring-data-redis/blob/4.1.x/src/main/java/org/springframework/data/redis/serializer/GenericJacksonJsonRedisSerializer.java)),
> the Spring Data Redis 4.1 reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> and Jackson 3's `tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator`
> ([github.com/FasterXML/jackson-databind](https://github.com/FasterXML/jackson-databind/blob/3.x/src/main/java/tools/jackson/databind/jsontype/BasicPolymorphicTypeValidator.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data Redis 4.1, Redis 8.

**JSON is the right default for a Redis cache, and getting to it on Boot 4 is not a
find-and-replace. Spring Data Redis 4.0 renamed both JSON serializers for Jackson 3, dropped the
no-arg constructor, and turned off two behaviours the Jackson 2 class had on — so the obvious
migration compiles, deploys, and returns a `LinkedHashMap` from every cached read.**

## The class names changed in 4.0

Spring Boot 4 ships Jackson 3, which lives in `tools.jackson` rather than
`com.fasterxml.jackson`, and Spring Data Redis 4.0 renamed the serializers to match. The class
javadoc:

> *"Generic Jackson 3-based `RedisSerializer` that maps objects to and from JSON."* …
> *`@since 4.0`*

for `GenericJacksonJsonRedisSerializer`, while the Jackson 2 pair carries:

```java
@Deprecated(since = "4.0", forRemoval = true)
public class GenericJackson2JsonRedisSerializer implements RedisSerializer<Object> {
```

with `@deprecated since 4.0 in favor of GenericJacksonJsonRedisSerializer`.

| Spring Data Redis 3.x (Jackson 2) | Spring Data Redis 4.x (Jackson 3) |
|---|---|
| `GenericJackson2JsonRedisSerializer` | `GenericJacksonJsonRedisSerializer` |
| `Jackson2JsonRedisSerializer` | `JacksonJsonRedisSerializer` |

🔴 There is **no** `GenericJackson3JsonRedisSerializer` in the shipped 4.1 package — that name
existed only in early 4.0 milestones and is the single most common wrong import in code written
against a half-migrated example. The Jackson 2 classes are still present, still work, and are
`forRemoval = true`.

## Three things that changed with the rename, not just the name

Swapping `GenericJackson2JsonRedisSerializer` for `GenericJacksonJsonRedisSerializer` is not a
find-and-replace, because the new class has different defaults. All three are visible in the
4.1 source.

**There is no no-arg constructor.** The Jackson 2 class had `public GenericJackson2JsonRedisSerializer()`.
The Jackson 3 class has exactly one public constructor, `GenericJacksonJsonRedisSerializer(ObjectMapper mapper)`,
so `new GenericJacksonJsonRedisSerializer()` does not compile. Use the builder.

**Default typing is off.** The builder's field declarations:

```java
private boolean cacheNullValueSupportEnabled = false;
private boolean defaultTyping = false;
```

The Jackson 2 class described itself as *"Generic Jackson 2-based `RedisSerializer` that maps
objects to and from JSON **using dynamic typing**"* and wrote a `@class` property into every
document. The Jackson 3 replacement writes no type information unless you ask for it. Without
it, a value declared as `Object` — which is what a cache holds — comes back as a
`LinkedHashMap`, and the `ClassCastException` surfaces at the call site of the cached method
rather than anywhere near the cache. **A straight class swap during a Boot 3 → Boot 4 upgrade
compiles, deploys, and breaks every read of a cached entry that was not a `String`.**

**`NullValue` support is off.** Spring caches `null` as a `NullValue` sentinel by default
([4 · Condition, unless and null](04-null-and-sync.md)), and `NullValue` is not an ordinary bean.
The builder exposes `enableSpringCacheNullValueSupport()`, and the javadoc ties it to the
previous point: *"Registers a `StdSerializer` capable of serializing Spring Cache `NullValue`
using the mappers default type property. Please make sure to active default typing
accordingly."* If you cache nulls — and you do, by default — you need both switches.

Put together, the working configuration is:

```java
@Bean
RedisCacheManagerBuilderCustomizer jsonValues() {
    PolymorphicTypeValidator validator = BasicPolymorphicTypeValidator.builder()
            .allowIfSubType("com.example.cache.")     // your DTO package only
            .build();

    RedisSerializer<Object> json = GenericJacksonJsonRedisSerializer.builder()
            .enableDefaultTyping(validator)
            .enableSpringCacheNullValueSupport()
            .build();

    RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
            .serializeValuesWith(SerializationPair.fromSerializer(json))
            .entryTtl(Duration.ofMinutes(10))
            .computePrefixWith(cacheName -> "app:v4:" + cacheName + "::");

    return builder -> builder.cacheDefaults(base);
}
```

Note the extension point: a `RedisCacheManagerBuilderCustomizer`, not a
`RedisCacheConfiguration` bean, for the reason in
[5e](05e-changing-the-defaults-safely.md).

## The validator is not optional

The builder also offers `enableUnsafeDefaultTyping()`, whose javadoc says what it says:

> *"**WARNING**: without restrictions of the `PolymorphicTypeValidator` deserialization is
> vulnerable to arbitrary code execution when reading from untrusted sources."*

with a link to OWASP's deserialization-of-untrusted-data page. The convenient method and the
safe method differ by one argument, and the convenient one is the one that appears in most
example snippets. Pass a `PolymorphicTypeValidator` scoped to the packages you actually cache.

## JSON does not remove the problem, it changes its shape

Be honest about what you have bought. With default typing enabled, the document contains the
fully-qualified class name under `@class`:

- **Renaming or moving a cached class** now breaks deserialization exactly the way a
  `serialVersionUID` change did. The exception is different; the incident is identical.
- **Adding a field** is fine — Jackson fills it with the default and, when default typing is on,
  the builder also sets `FAIL_ON_UNKNOWN_PROPERTIES` to `false`, so *removing* a field is fine
  too. That is a genuine improvement over JDK serialization's all-or-nothing, and it is also
  precisely the silent-default-value behaviour that a pinned `serialVersionUID` gives you. **A
  tolerant format means a stale entry with a missing field looks like a valid answer.**
- **The payload is bigger** than the JDK form for most objects, because every field name is
  repeated in every entry.
- **It is readable**, which is worth more in an incident than the extra bytes cost.

So the ranking is not "JSON good, JDK bad". It is:

1. **Cache a small, stable DTO you own**, not an entity and not a framework type. This is the
   decision that makes every other one easy.
2. **Version the key prefix** so a shape change abandons the old generation instead of colliding
   with it.
3. **Set a TTL**, so any mistake in (1) or (2) is bounded in time.
4. Then pick a format, and pick JSON, because you will need to read it at 2am.

## Gotchas

**★ `GenericJackson3JsonRedisSerializer` does not exist in Spring Data Redis 4.1.** The Jackson 3
class is `GenericJacksonJsonRedisSerializer`; the Jackson 2 one is deprecated for removal since
4.0. The `3` name existed only in early 4.0 milestones and is the most common wrong import in
code written against half-migrated examples.

**★ `new GenericJacksonJsonRedisSerializer()` does not compile.** The only public constructor
takes an `ObjectMapper`; everything else goes through `builder()`.

**★ Default typing is off in the Jackson 3 serializer and was on in the Jackson 2 one.** A
class-name swap during a Boot upgrade compiles and then returns `LinkedHashMap` instances from
every cached read, with the `ClassCastException` landing at the caller rather than at the cache.

**★ `enableSpringCacheNullValueSupport()` is off by default while Spring's null caching is on by
default.** The two defaults disagree and you have to reconcile them by hand — see
[4 · Condition, unless and null](04-null-and-sync.md) for why nulls are in the cache at all.

**★ `enableUnsafeDefaultTyping()` is one word away from the safe method** and its own javadoc
warns about arbitrary code execution. Always pass a `PolymorphicTypeValidator` scoped to your
own packages.

**★ JSON with `@class` still pins the fully-qualified class name.** Refactoring a package name
breaks a JSON cache as thoroughly as adding a field breaks a JDK-serialized one — and it is
easier to do by accident, because an IDE rename does not know about the bytes in Redis.

**★ JSON's tolerance for missing fields is a double edge.** It survives the deploy, and it means
a stale entry with a field you added last week is indistinguishable from a fresh one. You have
traded an exception for a wrong value again, just at a different granularity.

**★ Changing the serializer is itself a format change.** Every entry written by the old
serializer is unreadable by the new one, so the migration to JSON needs the same prefix bump and
the same TTL backstop as the field addition it is meant to prevent.

**★ Turning on default typing changes the payload of every entry.** If anything other than your
application reads those keys, `@class` appears in documents that did not have it, and a
non-Java consumer now has to ignore a property it does not understand.

## Interview questions

**★ How would you migrate a Redis cache to JSON on Spring Boot 4?**
Carefully, because the class names changed with Jackson 3. `GenericJackson2JsonRedisSerializer`
is deprecated for removal since Spring Data Redis 4.0 in favour of
`GenericJacksonJsonRedisSerializer`, and the replacement is not a drop-in: it has no no-arg
constructor, its builder has default typing switched off where the old class had dynamic typing
on, and `NullValue` support is a separate opt-in even though Spring caches nulls by default. So
I would build it through `GenericJacksonJsonRedisSerializer.builder()` with
`enableDefaultTyping(validator)` and `enableSpringCacheNullValueSupport()`, wire it through a
`RedisCacheManagerBuilderCustomizer`, and bump the key prefix version in the same deploy —
because the format change makes every existing entry unreadable, which is the exact problem the
migration is supposed to prevent.

**★ Is JSON strictly better than JDK serialization for a cache?**
Better, not strictly. JSON is readable, consumable by other services, and tolerant of added and
removed fields, which removes the most common incident. But with default typing enabled it
writes the fully-qualified class name into every document, so renaming or moving the class
breaks it just as thoroughly; the payload is larger because field names repeat; and its
tolerance means a stale entry missing a field you added looks exactly like a valid one rather
than announcing itself. The decision that actually matters is upstream of the format: cache a
small DTO you own, version the key prefix, and set a TTL. Given those, JSON wins on
debuggability.

**★ What is the security consideration when choosing a cache serializer?**
Both formats build object graphs from bytes, so both assume the store is trusted. On the JSON
side the risk arrives as polymorphic type handling: the serializer's own javadoc warns that
enabling default typing without a `PolymorphicTypeValidator` leaves deserialization "vulnerable
to arbitrary code execution when reading from untrusted sources", and the unsafe convenience
method sits one word away from the safe one in the same builder. Scope the validator to the
packages you actually cache — `allowIfSubType("com.example.cache.")` and nothing broader. On the
JDK side the equivalent mitigation is serialization filtering, via `jdk.serialFilter` or a
programmatic `ObjectInputFilter`; see [5b](05b-serialization-is-the-hard-part.md).

**★ Why does a JSON cache need `@class` in the payload at all?**
Because a cache is typed as `Object`. The serializer is handed a value with no static type
information and has to write bytes that can be read back without any either — `Cache.get` does
not know what it is fetching until it has fetched it. Default typing solves that by recording
the concrete class in the document, which is why the Jackson 2 serializer described itself as
using "dynamic typing" and why turning it off produces `LinkedHashMap`. The alternative is a
per-cache serializer bound to a single type, `JacksonJsonRedisSerializer`, which avoids the type
property entirely at the cost of one serializer per cached class and no polymorphism at all —
reasonable when a cache holds exactly one shape, which many do.

{/* FOOTER */}
