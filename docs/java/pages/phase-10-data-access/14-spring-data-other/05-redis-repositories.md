---
title: "One `save` on a Redis repository is four commands, not one, and three of them exist to fake a feature Redis does not have"
sidebar_label: "05 · Redis repositories"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Repositories* —
> *Usage*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/usage.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/usage.html)),
> *Object Mapping Fundamentals / Object-to-Hash Mapping*
> ([…/redis-repositories/mapping.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/mapping.html)),
> *Keyspaces*
> ([…/redis-repositories/keyspaces.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/keyspaces.html))
> and *Persisting References / anatomy of a save*
> ([…/redis-repositories/anatomy.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/anatomy.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Spring Data KeyValue 4.1.0,
> Lettuce 7.5.2, Redis 8.

**A Redis repository stores each entity as a Redis hash under a key built from a keyspace
and an id, and that part is exactly as simple as it sounds. What is not simple is
everything the repository has to write *alongside* the hash so that the rest of the
`CrudRepository` contract can be honoured. `findAll` needs a list of ids Redis will not
give you. `findByFirstname` needs an index Redis does not have. So Spring Data maintains
both, by hand, as extra sets, on every write. The reference documents one `save` as four
commands, and knowing which three are bookkeeping is the difference between using this
abstraction and being surprised by it.**

## The entity and the two annotations that build the key

```java
@RedisHash("people")
public class Person {

  @Id String id;
  String firstname;
  String lastname;
  Address address;
}
```

> *"Note that it has a `@RedisHash` annotation on its type and a property named `id` that is
> annotated with `org.springframework.data.annotation.Id`. Those two items are responsible
> for creating the actual key used to persist the hash."*

The repository is a plain `CrudRepository` — there is no `RedisRepository` type to extend,
which is itself a signal about how much of the store this abstraction covers:

```java
public interface PersonRepository extends CrudRepository<Person, String> {}
```

⚠️ **`@Id` here is `org.springframework.data.annotation.Id`, not `jakarta.persistence.Id`.**
In an application that also uses JPA, both are on the classpath and the IDE will offer you
the wrong one. The symptom is an entity with no usable identifier rather than a compile
error.

Repository support is on by default in Boot (`spring.data.redis.repositories.enabled`
defaults to `true`); `@EnableRedisRepositories` is how you turn it on, or configure it, in a
non-Boot arrangement.

### The keyspace

> *"By default, the prefix is set to `getClass().getName()`."*

> *"You can alter this default by setting `@RedisHash` on the aggregate root level or by
> setting up a programmatic configuration. However, the annotated keyspace supersedes any
> other configuration."*

So without `@RedisHash("people")` your keys are prefixed with the **fully qualified class
name**, and every key in Redis contains your package structure. Renaming or moving the
class then changes the keyspace and orphans every key written under the old one. That is
the argument for always naming the keyspace explicitly, and for treating that name as a
published contract rather than a detail.

The programmatic route, for entities you do not own or cannot annotate:

```java
@Configuration
@EnableRedisRepositories(keyspaceConfiguration = MyKeyspaceConfiguration.class)
public class ApplicationConfig {

  public static class MyKeyspaceConfiguration extends KeyspaceConfiguration {

    @Override
    protected Iterable<KeyspaceSettings> initialConfiguration() {
      return Collections.singleton(new KeyspaceSettings(Person.class, "people"));
    }
  }
}
```

## What the four CRUD methods do

> **`repo.save(rand)`** — *"Generates a new `id` if the current value is `null` or reuses an
> already set `id` value and stores properties of type `Person` inside the Redis Hash with a
> key that has a pattern of `keyspace:id`"*

> **`repo.findOne(id)`** — *"Uses the provided `id` to retrieve the object stored at
> `keyspace:id`."*

> **`repo.count()`** — *"Counts the total number of entities available within the keyspace,
> `people`, defined by `@RedisHash` on `Person`."*

> **`repo.delete(rand)`** — *"Removes the key for the given object from Redis."*

`findOne` is the honest one: a single `HGETALL` against a key you could have computed
yourself. `count` is the one to look at twice — Redis has no way to count "all keys with
this prefix" without scanning the keyspace, so the count is served from a set that Spring
Data maintains. Which brings us to the write.

## The anatomy of one `save`

The reference lists the commands a single `save` produces. These are **the commands
documented on the reference page**, not the output of a session — there is no Redis server
behind this bible:

```
HMSET "people:19315449-…" "_class" "Person" "id" "19315449-…" "firstname" "rand" "lastname" "al'thor"
SADD  "people" "19315449-…"
SADD  "people:firstname:rand" "19315449-…"
SADD  "people:19315449-…:idx" "people:firstname:rand"
```

Four writes for one entity, and only the first stores your data:

1. **`HMSET people:<id>`** — the entity itself, flattened into hash fields.
2. **`SADD people <id>`** — the **keyspace set**: every id that exists in this keyspace.
   This is what `findAll`, `count` and `deleteAll` iterate. Redis will not enumerate keys by
   prefix cheaply, so Spring Data keeps its own list.
3. **`SADD people:firstname:rand <id>`** — the **secondary index set** for one `@Indexed`
   property, one set per distinct value.
4. **`SADD people:<id>:idx <path>`** — the **back-reference**, recording which index sets
   this entity appears in, so that deleting or updating it can find them again. Redis has no
   query to ask "which sets contain this member".

Each additional `@Indexed` property adds another `SADD` in group 3 and another member in
group 4. **An entity with five indexed properties writes seven keys per save.** That is the
cost the repository abstraction is hiding, and it is why
[05b · What a Redis repository can answer](05b-what-a-redis-repository-can-answer.md)
treats indexes as the main subject rather than a footnote.

How the object is flattened into that hash, and what happens to it on the next write, is
[05c · Object-to-hash mapping and updates](05c-object-to-hash-mapping-and-updates.md).

## Gotchas

**★ One `save` is four commands, and three of them are bookkeeping.** The hash, the
keyspace set, one set per indexed value, and a back-reference set. Write amplification is
proportional to the number of indexed properties, not to the size of the entity.

**★ Without `@RedisHash("name")` your keys contain the fully qualified class name.** Every
key in the database then encodes your package structure, and a refactor that moves the
class orphans all existing data under the old prefix.

**★ The wrong `@Id` compiles.** `org.springframework.data.annotation.Id` is the one; in a
project that also uses JPA, `jakarta.persistence.Id` is one import away and produces an
entity with no identifier rather than an error.

**★ `count()` and `findAll()` read a set Spring Data maintains, not Redis itself.** If that
set and the actual keys ever diverge — a key deleted directly, a key that expired while the
application was down — the repository's view of the world is wrong and nothing reconciles
it.

**★ Nothing about a `save` is atomic.** Four commands are sent for one entity; a failure
between them leaves the hash written and the index not, or the reverse. The repository does
not wrap them in `MULTI`.

**★ `deleteAll()` on a large keyspace iterates the keyspace set and deletes one entity at a
time.** It is not `FLUSHDB` and it is not free. On a keyspace with a million ids it is a
million-key traversal issued from your application.

**★ The id is generated client-side when it is null.** That is convenient and it means the
key format is decided by your code, not by Redis — two applications writing the same
keyspace with different id strategies will not collide, they will simply never find each
other's data.

**★ Every one of these keys lives in the same flat Redis keyspace as everything else.** A
cache, a session store and a repository keyspace share one namespace, one `FLUSHDB`, one
memory limit and one eviction policy. Nothing isolates them.

## Interview questions

**★ What does a Redis repository actually write when you save one entity?**
An `HMSET` for the entity hash under `keyspace:id`, an `SADD` into the keyspace set holding
every id, an `SADD` into one index set per indexed property value, and an `SADD` into a
per-entity `:idx` set recording which index sets it joined. Four commands minimum, more for
each additional index.

**★ Why does the keyspace set exist at all?**
Because Redis cannot cheaply enumerate keys matching a prefix — `KEYS` is a full scan and
`SCAN` is incremental and unordered. `findAll`, `count` and `deleteAll` are
`CrudRepository` obligations, so Spring Data maintains its own membership set to satisfy
them.

**★ And the per-entity `:idx` set?**
Because Redis has no reverse lookup from a member to the sets containing it. When an entity
is updated or deleted, the index sets it appears in have to be cleaned up, and the only way
to know which they are is to have written them down at save time.

**★ What is the default keyspace, and why is it a bad one?**
`getClass().getName()`, the fully qualified class name. It embeds package structure in
every key, and refactoring the class silently changes where the data lives with no
migration path.

**★ Is a `save` atomic?**
No. It is several commands issued in sequence with no `MULTI` around them. A failure
part-way through leaves the entity and its indexes disagreeing, and nothing detects that
afterwards.

**★ How would you decide whether this abstraction is worth its write amplification?**
Count the indexed properties and multiply. If the entity has one or two and reads are
mostly by id, the overhead is small and the convenience is real. If it has five and is
written on every request, you are paying seven writes to store one object in a store people
chose for its write cost.

{/* FOOTER */}
