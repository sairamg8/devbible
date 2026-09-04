---
title: "A `RedisTemplate` has five serializers, defaults all of them to Java native serialization, and the resulting key is not the string you typed — which is why the data is in Redis and your code cannot find it"
sidebar_label: "06b · Serializers and the byte key"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Serializers* and *Working
> with Objects through RedisTemplate*
> ([docs.spring.io/spring-data/redis/reference/redis/template.html](https://docs.spring.io/spring-data/redis/reference/redis/template.html)),
> the `RedisTemplate` javadoc for the serializer setters
> ([docs.spring.io/spring-data/redis/docs/current/api/…/core/RedisTemplate.html](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/core/RedisTemplate.html)),
> and the `org.springframework.data.redis.serializer` package summary in the Spring Data
> Redis 4.1.0 API
> ([…/serializer/package-summary.html](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/serializer/package-summary.html)).
> The Java serialization stream header is from the Java Object Serialization
> Specification. JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Redis 8.

**Redis stores bytes. Your code has objects. Something has to convert, and in Spring Data
Redis that something is configured in five independent places on one object, defaults to
the worst available option, and produces keys that do not resemble the strings you passed
in. Every "the value is definitely in Redis but the application returns null" bug in this
part of the stack is one of those five settings disagreeing with another one.**

## Five serializers, not one

> *"From the framework perspective, the data stored in Redis is only bytes."*

The `RedisTemplate` javadoc names each setter and its default:

| Setter | Used for | Default |
|---|---|---|
| `setKeySerializer` | the key | the default serializer |
| `setValueSerializer` | the value for `opsForValue`, `opsForList`, `opsForSet`, `opsForZSet` | the default serializer |
| `setHashKeySerializer` | *"the hash key (or field)"* — the field names inside a hash | the default serializer |
| `setHashValueSerializer` | the values inside a hash | the default serializer |
| `setStringSerializer` | *"when the arguments or return types are always strings"* | `StringRedisSerializer` |

And the default serializer itself:

> *"Sets the default serializer to use for this template. All serializers (except the
> `setStringSerializer(RedisSerializer)`) are initialized to this value unless explicitly
> set. Defaults to `JdkSerializationRedisSerializer`."*

**`opsForHash` does not use the value serializer.** It uses the two hash-specific ones.
Configuring `setValueSerializer(json)` and forgetting the hash pair is the most common
half-configured template in the wild: your `opsForValue` data is readable JSON and your
`opsForHash` data is a Java serialization blob, in the same application, written by the same
bean.

`setEnableDefaultSerializer(false)` is the opt-out:

> *"If the default serializer is disabled, any serializers that have not been explicitly set
> will remain null, and their corresponding values will neither be serialized nor
> deserialized. Defaults to true."*

That gives you a template that deals in raw `byte[]` — appropriate when you are storing
something that is already bytes, such as a protobuf payload, and a trap when it is set by
accident.

## The default is Java native serialization, and it is two problems

> *"By default, `RedisCache` and `RedisTemplate` are configured to use Java native
> serialization."*

**Problem one is security**, and the reference does not soften it:

> *"Java native serialization is known for allowing the running of remote code caused by
> payloads that exploit vulnerable libraries and classes injecting unverified bytecode."*

> *"Manipulated input could lead to unwanted code being run in the application during the
> deserialization step."*

> *"As a consequence, do not use serialization in untrusted environments."*

> *"In general, we strongly recommend any other message format (such as JSON) instead."*

Redis is frequently reachable from more places than a relational database is — a shared
cluster, a sidecar, a managed service with a permissive security group. Anything that can
write a key can hand your application a deserialization payload.

**Problem two is that the key is not your key.** A Java serialization stream begins with the
magic value `0xACED` followed by the stream version, per the Java Object Serialization
Specification, and a serialized `String` carries a type marker and a length before its
characters. So a `RedisTemplate<Object, Object>` asked to write the key `"user:42"` writes a
key whose bytes *contain* `user:42` surrounded by framing that is invisible in your source
code.

The consequences arrive in this order:

- **In `redis-cli`, `KEYS *` shows escaped binary.** The keys are unreadable and
  unsearchable, and pattern matching against `user:*` does not match them.
- **A `StringRedisTemplate` cannot read them**, because it encodes `"user:42"` as the seven
  characters. Two templates in one application, the same key string in the source, two
  different keys in Redis, and no error from either side — one simply returns `null`.
- **Nothing else can read them either.** A Node service, a Python job, a Lua script, an ops
  engineer: the data is only accessible to a JVM with the exact class on its classpath.

**Set the key serializer to `StringRedisSerializer` on every template you create.** There is
no scenario in which an opaque binary key is worth what it costs.

## The serializers that exist

The 4.1.0 `org.springframework.data.redis.serializer` package:

| Class | What it does |
|---|---|
| `RedisSerializer` | the interface — `serialize` / `deserialize`, both nullable |
| `StringRedisSerializer` | `String` to bytes with a charset; the correct key serializer |
| `JdkSerializationRedisSerializer` | Java native serialization; the default, and the one to replace |
| `GenericToStringSerializer` | any type to `String` via a `ConversionService` |
| `OxmSerializer` | XML, through Spring's OXM `Marshaller` |
| `Jackson2JsonRedisSerializer` | JSON for **one** target type, no type information stored |
| `GenericJackson2JsonRedisSerializer` | JSON with type information embedded — ⚠️ **deprecated and marked for removal in 4.1.0** |
| `JacksonJsonRedisSerializer` | the Jackson 3 replacement for the above pair's typed form |
| `GenericJacksonJsonRedisSerializer` | the Jackson 3 replacement for the generic form |

⚠️ **The Jackson 3 transition is live in this version.** The `…Jackson2…` classes build on
`com.fasterxml.jackson.databind`; the new `…Jackson…` classes build on
`tools.jackson.databind`. `GenericJackson2JsonRedisSerializer` is deprecated *for removal*,
so a codebase written against it has a migration ahead of it, and a tutorial written before
Spring Data Redis 4.1 will name the deprecated class.

### Generic or not is a data-format decision, not a style one

- **`Jackson2JsonRedisSerializer` / `JacksonJsonRedisSerializer`** are constructed with a
  target type. The stored JSON is exactly your object's fields — clean, readable, portable
  to any language. One serializer per type, so one template per type.
- **The `Generic…` forms** embed the fully qualified class name in the JSON so that any type
  can be read back. That buys a single template for everything and costs you the same
  fragility as MongoDB's `_class` in
  [02e · The `_class` discriminator](02e-the-class-discriminator.md): rename or move the
  class and the stored data no longer deserialises. It is also polymorphic deserialization
  driven by a value in the data, which needs the same suspicion as any such mechanism.

For a cache whose entries are one type, the non-generic form is better in every dimension
that matters. For a general-purpose template, the generic form is the price of generality
and its type field is a schema you now have to version.

## A template you would actually declare

```java
@Bean
RedisTemplate<String, Order> orderRedisTemplate(RedisConnectionFactory factory) {
    RedisTemplate<String, Order> template = new RedisTemplate<>();
    template.setConnectionFactory(factory);
    template.setKeySerializer(RedisSerializer.string());
    template.setHashKeySerializer(RedisSerializer.string());
    template.setValueSerializer(new JacksonJsonRedisSerializer<>(Order.class));
    template.setHashValueSerializer(new JacksonJsonRedisSerializer<>(Order.class));
    return template;
}
```

Four of the five set explicitly, string keys, JSON values, one type. Remember from
[06 · RedisTemplate](06-redistemplate.md) that naming this method anything other than
`redisTemplate` leaves Boot's `Object`/`Object` template in the context alongside it.

## Reading data somebody else wrote

Two rules cover every cross-reading question, and they are both consequences of "the data is
only bytes":

1. **The reader's serializer must produce the same bytes the writer's did** — for the key,
   for the value, and for hash fields separately.
2. **The safest interoperable choice is string keys and JSON values**, because that is the
   only combination another runtime, a Lua script or a human at a terminal can also handle.

⚠️ Reading a repository-written hash (the object-to-hash mapping in
[05c · Object-to-hash mapping and updates](05c-object-to-hash-mapping-and-updates.md)) with a
`RedisTemplate` requires the template's key and hash-field encoding to match what the
repository's converter wrote. The reference documents the *hash field names* the repository
produces, but this bible has not verified which serializers `RedisKeyValueAdapter` uses
internally — so verify that against your own configuration before building anything on a
cross-read, rather than assuming a `StringRedisTemplate` will line up.

## Gotchas

**★ The default serializer is Java native serialization on every template you construct
yourself and on the one Boot auto-configures.** It is the default of
`setDefaultSerializer`, and Boot's auto-configuration sets no serializers at all.

**★ Java native serialization is a documented remote-code-execution risk.** The reference
says do not use it in untrusted environments and strongly recommends any other format.
"Untrusted" includes any Redis instance more things can write to than you think.

**★ The key is not the string you typed.** A serialized `String` carries the Java stream
header and framing, so `KEYS user:*` matches nothing and a `StringRedisTemplate` in the same
application cannot find the key.

**★ `opsForHash` uses the hash serializers, not the value serializer.** Setting
`valueSerializer` to JSON and leaving the hash pair alone produces two encodings from one
bean, and only the hash path is broken.

**★ Two templates with different serializers silently share a key namespace.** Neither
errors. One writes, the other returns `null`, and the data is right there in the database.

**★ `GenericJackson2JsonRedisSerializer` is deprecated and marked for removal in 4.1.0.**
Every article and answer older than this release names it. The Jackson 3 classes
(`JacksonJsonRedisSerializer`, `GenericJacksonJsonRedisSerializer`) are the replacements and
they sit on `tools.jackson.databind`.

**★ The generic JSON serializers store the class name in the data.** A refactor breaks
reads of everything already cached, and the type field is polymorphic deserialization
controlled by data.

**★ `setEnableDefaultSerializer(false)` leaves unset serializers null and values
unserialized.** Convenient for raw bytes; baffling if it was set for one of the five and
forgotten for the others.

**★ `RedisSerializer.deserialize` may be handed `null`.** A missing key is a null byte
array, and a serializer that assumes otherwise turns "not found" into a
`NullPointerException` deep in the template.

**★ Changing a serializer is a data migration.** Every existing key was written with the old
encoding. For a cache you can flush; for anything else you need a dual-read or a rewrite,
and there is no schema to tell you which keys are affected.

**★ Spring's cache abstraction has its own serializer configuration.** `RedisCache` defaults
to Java native serialization too, and configuring your `RedisTemplate` does nothing for
`@Cacheable` — see [12 · The cache abstraction](../12-caching/02-the-cache-abstraction.md).

**★ `StringRedisTemplate` is not merely a convenience.** It is the only configuration that
keeps a production Redis debuggable from the command line, which on an incident call is
worth more than any encoding efficiency.

## Interview questions

**★ How many serializers does a `RedisTemplate` have, and why does that matter?**
Five: key, value, hash key, hash value and string. All but the string one default to the
template's default serializer. It matters because configuring one of them — usually the
value — leaves the others at Java native serialization, so one bean produces two encodings.

**★ What is the default serializer, and what is wrong with it?**
`JdkSerializationRedisSerializer`. Two things are wrong: the reference documents Java native
serialization as a remote-code-execution risk and recommends any other format, and the bytes
it produces make keys unreadable and unmatchable by pattern.

**★ Your value is in Redis and the application returns null. What do you check?**
Whether the reader and the writer use the same key serializer. A key written by a
JDK-serializing template and read by a `StringRedisTemplate` is two different keys with
identical-looking source code. Then check the hash serializers separately if it is hash data.

**★ Why does `opsForHash` behave differently from `opsForValue`?**
Because it uses `hashKeySerializer` and `hashValueSerializer`, which are configured
separately from `valueSerializer`. Half-configuring a template is the normal outcome of not
knowing that.

**★ Which JSON serializer would you pick?**
The non-generic one bound to a specific type where possible: the stored JSON is exactly the
object's fields, readable by anything, with no class name embedded. The generic form is for
templates that must carry many types, and it embeds a fully qualified class name that a
refactor will invalidate.

**★ What changed with Jackson in Spring Data Redis 4.1?**
`GenericJackson2JsonRedisSerializer` is deprecated and marked for removal, and the
replacements — `JacksonJsonRedisSerializer` and `GenericJacksonJsonRedisSerializer` — build
on Jackson 3's `tools.jackson.databind` rather than
`com.fasterxml.jackson.databind`.

**★ Can you change a serializer on a running system?**
Not without a plan. Every existing key was written in the old encoding, and there is no
catalogue of which keys those are. A pure cache can be flushed; anything with retained state
needs a dual-read period or an explicit rewrite.

**★ Why are readable keys worth arguing for?**
Because Redis has no query language to fall back on. If you cannot `SCAN` for a pattern or
read a value at a terminal, your only diagnostic tool during an incident is the application
that is currently misbehaving.

{/* FOOTER */}
