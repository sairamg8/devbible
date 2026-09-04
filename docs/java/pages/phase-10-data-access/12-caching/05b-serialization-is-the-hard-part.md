---
title: "The moment a cached object leaves the heap it acquires a wire format, and the shipped default is JDK serialization — which means the next time you add a field to that class, the cache written by the old pods is unreadable by the new ones"
sidebar_label: "5b · Serialization is the hard part"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> `GenericJacksonJsonRedisSerializer`, `GenericJackson2JsonRedisSerializer` and
> `JacksonJsonRedisSerializer` on the Spring Data Redis `4.1.x` branch
> ([github.com/spring-projects/spring-data-redis](https://github.com/spring-projects/spring-data-redis/blob/4.1.x/src/main/java/org/springframework/data/redis/serializer/GenericJacksonJsonRedisSerializer.java)),
> Boot 4.1.x `RedisCacheConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/RedisCacheConfiguration.java)),
> and the `java.io.Serializable` javadoc
> ([docs.oracle.com/en/java/javase/25/docs/api](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/Serializable.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1, Redis 8.

**A local cache stores object references. A remote cache stores bytes, and bytes need a schema.
Spring Boot picks one for you — `JdkSerializationRedisSerializer` — and that choice is the
single most common way a Redis cache turns a routine deploy into an incident, because JDK
serialization ties the readability of every entry already in Redis to the exact shape of the
class that wrote it.**

## The default is not accidental, it is explicit

Boot's auto-configuration sets it by hand:

```java
config = config
    .serializeValuesWith(SerializationPair.fromSerializer(new JdkSerializationRedisSerializer(classLoader)));
```

So the value serializer is `JdkSerializationRedisSerializer` whether or not you have Jackson on
the classpath and whether or not the rest of your application speaks JSON. The key serializer
stays `StringRedisSerializer`, which is why `profiles::42` is human-readable in `redis-cli`
while the value beside it is not.

Three consequences arrive with that line, in increasing order of how much they will cost you.

## 1 · Everything cached must be `Serializable`, transitively

`java.io.Serializable` is a marker, and the requirement runs through the whole object graph:

```java
public record ProfileView(Long id, String name, Instant updated) implements Serializable { }
```

Miss it anywhere in the graph — a field whose type is a third-party class, a `ZoneId`
implementation, a lambda captured in a field — and the put fails with
`java.io.NotSerializableException` naming the offending class. That failure is at least loud.
It is also the *good* outcome of this section, because it happens on the first write in every
environment, including your laptop.

⚠️ **Do not solve it by making your JPA entity `Serializable`.** An entity that Hibernate
returned may carry uninitialized proxies, a `PersistentBag` for every `@OneToMany`, and a
back-reference to the session. What lands in Redis is then either an exception, or a graph far
larger than the thing you meant to cache, or a structure that deserializes into something no
longer attached to anything. Cache a DTO or a record you own. This is the same argument as
[../08-the-n-plus-1-problem/12d-the-entity-was-never-the-model.md](../08-the-n-plus-1-problem/12d-the-entity-was-never-the-model.md),
arriving from a different direction.

## 2 · The class that changed shape

This is the one that produces the incident, and it has two failure modes depending on a single
field you probably did not declare.

**Without an explicit `serialVersionUID`**, the JVM computes one from the class's declared
fields, methods and interfaces. Add a field, remove a field, change a field's type, add an
interface — the computed value changes. Old entries in Redis were written under the old value;
the new pod reads them and throws `java.io.InvalidClassException`, complaining that the local
class is incompatible with the stream. The `Serializable` javadoc is direct about this:

> *"If a serializable class does not explicitly declare a serialVersionUID, then the
> serialization runtime will calculate a default serialVersionUID value for that class based on
> various aspects of the class, as described in the Java Object Serialization Specification.
> […] However, it is strongly recommended that all serializable classes other than enum types
> explicitly declare serialVersionUID values, since the default serialVersionUID computation is
> highly sensitive to class details that may vary depending on compiler implementations, and can
> thus result in unexpected InvalidClassExceptions during deserialization."*

Now put that inside a rolling deploy. For the duration of the rollout, old pods and new pods are
both live and both using the same Redis. Old pods write v1 bytes, new pods write v2 bytes, and
every read has a chance of hitting the other generation. **Both halves of the fleet throw on
reads they did not write** — and because the default `CacheErrorHandler` rethrows
([5d](05d-clearing-locking-and-failing.md)), those throws are request failures, not cache
misses. With `Key Expiration: None` (the default, see
[5c](05c-expiry-and-eviction.md)) the bad entries never age out on their own.

**With an explicit `serialVersionUID`** you get the other failure, and it is quieter. Deserialization
now succeeds across the shape change: fields present in the stream but absent from the class are
discarded, and fields present in the class but absent from the stream are left at their default
— `null` for references, `0` for numerics, `false` for booleans. So a new `boolean verified`
field reads back as `false` for every entry written before the deploy, indefinitely, and nothing
anywhere throws. **A pinned `serialVersionUID` converts a loud failure into a silent wrong
answer**, which is why "just add `serialVersionUID`" is not the fix it is usually presented as.

**The fix that actually works is to make the old entries unreachable**, and the cheapest form of
that is a version segment in the key prefix, from
[5 · Redis as the store](05-redis-as-the-store.md):

```java
RedisCacheConfiguration.defaultCacheConfig()
        .computePrefixWith(cacheName -> "app:v4:" + cacheName + "::");
```

Bump `v4` in the same commit that changes the cached class. The old generation stops being
addressed, no pod reads bytes it cannot understand, and the abandoned keys expire under the TTL
you set in [5c](05c-expiry-and-eviction.md). A short TTL is the backstop: it bounds how long a
shape mismatch can hurt you even when someone forgets.

## Records and enums are not ordinary serializable objects

Two special cases from the `ObjectInputStream` javadoc, both of which change what "the class
changed shape" means:

> *"all enum types have a fixed serialVersionUID of 0L. Records are serialized differently than
> ordinary serializable or externalizable objects. During deserialization the record's canonical
> constructor is invoked to construct the record object. Certain serialization-related methods,
> such as `readObject` and `writeObject`, are ignored for serializable records."*

**Enums** are therefore immune to the `serialVersionUID` failure — adding a constant to a cached
enum does not invalidate anything. What does break is *renaming* a constant, because enum
constants are written and matched by name; the old entries then fail to resolve. Add freely,
rename never, and treat a rename as a prefix bump.

**Records** are the better thing to cache, and they behave differently in one way that matters:
because deserialization goes through the canonical constructor, **any validation in a compact
constructor runs again on every read from the cache**.

```java
public record Money(String currency, BigDecimal amount) implements Serializable {
    public Money {
        if (amount.signum() < 0) throw new IllegalArgumentException("negative");
    }
}
```

That is mostly a feature — the invariant is genuinely enforced on the way out, unlike a normal
class where deserialization bypasses constructors entirely. It becomes a problem when you
tighten the rule: a validation added this deploy will reject entries that were legal when they
were written, and the exception surfaces from a cache read.

⚠️ `transient` cuts the other way. A `transient` field is not written, so it reads back as
`null` or `0` on every cache hit while being correctly populated on every cache miss. The result
is a value that is right when the cache is cold and wrong when it is warm, which is the hardest
possible schedule on which to notice a bug.

## 3 · Deserializing bytes you did not write

JDK deserialization constructs arbitrary object graphs from a byte stream, and the set of
gadget chains reachable from a typical Spring classpath is not small. Redis is normally inside
your trust boundary, so this is not the first risk on your list — but "the cache store is
compromised, or reachable from something that is" turns a cache read into arbitrary code
execution in the application, which is a much larger blast radius than "the attacker can read
cached profiles."

If you keep JDK serialization, the JDK's own serialization filtering is the mitigation:
`jdk.serialFilter` as a system property, or a programmatic `ObjectInputFilter` installed on the
stream. Either way it is an allow-list of classes, which means you have to maintain it, which
means in practice it is maintained only where someone made it someone's job.

If you move to JSON, the equivalent risk moves with you and takes the form of polymorphic type
handling — that, the renamed serializer classes, and the two defaults that were inverted in
Spring Data Redis 4.0 are
[5b2 · JSON, and the Jackson 3 rename](05b2-json-and-the-jackson-3-rename.md).

And there is a plain operational cost with no security dimension at all: **a JDK-serialized
value is opaque.** You cannot read it in `redis-cli`, you cannot inspect it from a dashboard,
and no non-Java service can consume it. Debugging a cache you cannot look inside is materially
harder than debugging one you can.


## Gotchas

**★ Boot sets `JdkSerializationRedisSerializer` explicitly**, not by omission. Having Jackson on
the classpath changes nothing; you must configure the serializer yourself.

**★ Adding a field to a cached class without an explicit `serialVersionUID` makes every existing
entry unreadable**, and during a rolling deploy both halves of the fleet fail on entries the
other half wrote.

**★ Adding an explicit `serialVersionUID` does not fix that — it hides it.** Deserialization
then succeeds and the new field is `null`/`0`/`false` on every pre-deploy entry, forever. Loud
failure became silent wrong answer.

**★ With `Key Expiration: None`, a poisoned generation of entries never ages out.** The TTL is
what turns "permanent incident" into "ten-minute incident".

**★ A rethrowing `CacheErrorHandler` turns a deserialization failure into a request failure**,
not a cache miss. The two decisions compound; see [5d](05d-clearing-locking-and-failing.md).

**★ Making a JPA entity `Serializable` to get it into Redis is the wrong fix.** Proxies,
`PersistentBag` collections and session back-references either fail, or serialize far more than
you intended, or produce a detached graph that behaves differently from the one you cached.

**★ A `transient` field is populated on a miss and `null` on a hit.** The value is correct when
the cache is cold and wrong when it is warm — the worst possible schedule for noticing.

**★ Adding a validation rule to a cached record rejects entries that were legal when written.**
Record deserialization runs the canonical constructor, so the new invariant is applied to old
bytes, and the exception comes out of a cache read.

**★ Renaming an enum constant invalidates every entry that contains it**, even though enums are
otherwise immune to `serialVersionUID` drift because their UID is fixed at `0L`.

**★ Boot passes a `ClassLoader` into `JdkSerializationRedisSerializer` for a reason.** Class
resolution during deserialization is class-loader-sensitive, which is why a hand-rolled
`new JdkSerializationRedisSerializer()` can resolve classes differently from the
auto-configured one under a non-system class loader.

**★ A JDK-serialized value cannot be inspected from `redis-cli` or consumed by any non-Java
service.** That is an operational cost that only shows up when you are already having a bad day.

## Interview questions

**★ What is the default value serializer for Spring's Redis cache, and why is that a problem?**
`JdkSerializationRedisSerializer`, set explicitly by Boot's auto-configuration. The problem is
that JDK serialization couples the readability of every entry already in Redis to the exact
declared shape of the class that wrote it. Add a field to a cached DTO and, unless you pinned
`serialVersionUID`, every existing entry throws `InvalidClassException` — and during a rolling
deploy both the old and new pods are reading entries the other wrote, so both fail. The value is
also opaque to every tool and every non-Java consumer, which makes the resulting incident harder
to diagnose than it needs to be.

**★ Does declaring `serialVersionUID` fix the shape-change problem?**
It stops the exception, which is not the same thing. With a pinned UID, deserialization succeeds
across the change: extra fields in the stream are dropped and missing fields take their type
defaults, so a `boolean` added in this deploy reads back as `false` on every entry written
before it, silently and for as long as those entries live. That is often worse than the
exception, because an exception gets noticed. The real fix is to make the old entries
unreachable — a version segment in the key prefix bumped in the same commit — with a TTL as the
backstop.

**★ Is a record a good thing to put in a cache?**
Yes, and better than a class for this purpose, but with one property worth knowing. Records are
serialized specially: the javadoc says the canonical constructor is invoked during
deserialization, and `readObject`/`writeObject` are ignored. That means the record's invariants
are actually enforced on the way out of the cache, which is more than you get from an ordinary
class — normal deserialization bypasses constructors entirely, so a class can come back in a
state its constructor would have rejected. The flip side is that tightening a validation rule
retroactively invalidates entries that were legal when they were written, and the failure
appears as an exception thrown from a cache read rather than from anything the request did.

**★ How does JDK deserialization actually behave when a class has changed?**
It depends entirely on `serialVersionUID`. If the class does not declare one, the runtime
computes it from the class's structure, so any structural change produces a different value and
the read fails with `InvalidClassException`. If the class does declare one, the stream and the
class are considered compatible and the fields are matched by name and type: names present only
in the stream are discarded, names present only in the class take their default values. Enums
sidestep the whole question because their `serialVersionUID` is fixed at `0L` and their
constants are matched by name, so adding a constant is safe and renaming one is not. Records
sidestep it a third way, by running the canonical constructor.

**★ Why not just make the entity `Serializable` and cache it?**
Because a managed entity is not a value. It can carry uninitialized proxies, Hibernate's own
collection implementations, and a reference back to the session, so serializing it either
throws, or drags in far more of the graph than you meant, or produces something that
deserializes into a detached object whose lazy associations now fail. Beyond the mechanics, the
entity's shape is driven by the mapping and changes whenever the schema does, which is exactly
the wrong stability profile for something whose serialized form is sitting in a shared store
across deploys. A record built for the cache changes when the cache's contract changes and not
otherwise.

{/* FOOTER */}
