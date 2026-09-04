---
title: "Writing an object to a Redis hash deletes the hash and re-creates it, so every field the mapping does not know about is destroyed by a `save` nobody thought was destructive"
sidebar_label: "05c · Object-to-hash mapping and updates"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Repositories* —
> *Object-to-Hash Mapping*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/mapping.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/mapping.html))
> and *Usage*, for `PartialUpdate` and the note on referenced objects
> ([…/redis-repositories/usage.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/usage.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Spring Data KeyValue 4.1.0, Redis 8.

**A Redis hash is a flat map of string fields to string values. A Java object is a tree.
The mapping between them is a path-flattening scheme, and it is worth learning not because
it is clever but because it decides what your keys look like forever, and because the write
that produces it is a delete followed by a create. The single most damaging sentence in the
Spring Data Redis reference is on this page, and almost nobody has read it.**

## The flattening scheme

Nesting is expressed by encoding the path into the field name:

| Java | Hash field |
|---|---|
| `String firstname` | `firstname` |
| `Address address` with a `city` | `address.city` |
| `List<String> nicknames` | `nicknames.[0]`, `nicknames.[1]`, … |
| `Map<String, String> atts` | `atts.[eye-color]` |
| `List<Address> addresses` | `addresses.[0].city` |
| `Map<String, Address> addresses` | `addresses.[home].city` |

Two structural rules follow, and the reference states both:

> *"Map keys need to be simple types, such as `String` or `Number`."*

> *"The `_class` attribute is included on the root level as well as on any nested interface
> or abstract types."*

A map key becomes part of a hash field name, so it has to have a sane string form — a value
object as a map key has no representation here. And `_class` is the same discriminator
argument as [02e · The `_class` discriminator](02e-the-class-discriminator.md): the stored
data names a Java type, so moving or renaming the class breaks reads of data already
written, with no migration tooling to help.

A third rule catches people who assume a custom converter makes a property "opaque":

> *"Custom conversions have no effect on index resolution. Secondary Indexes are still
> created, even for custom converted types."*

Converting a type does not exempt it from the per-value index sets described in
[05b · What a Redis repository can answer](05b-what-a-redis-repository-can-answer.md). If it
is `@Indexed`, the sets are created regardless of how strange the converted form is.

### Why the index list matters here

A list serialised as `nicknames.[0]`, `nicknames.[1]` means the **position is part of the
field name**. Removing an element does not shift the others down in place; a full rewrite
of the hash is what makes the numbering correct again. That is one of several reasons the
write is a rewrite.

## The sentence that governs every update

> *"Writing objects to a Redis hash deletes the content from the hash and re-creates the
> whole hash, so data that has not been mapped is lost."*

Read it twice. This is stronger than MongoDB's whole-document `save` in
[03 · MongoTemplate](03-mongotemplate.md), because that one *replaces* a document while
this one is documented as a **delete followed by a re-create**. Everything in the hash that
your object does not carry is gone:

- a field written by another component that shares the key;
- a field from a previous version of the class that you have since removed;
- a field added by a newer deployment while an older instance is still running;
- anything a script or an operator set by hand.

A rolling deployment makes the third one concrete: instance A runs the new class with a
`tier` property, instance B runs the old class without it. Every save from B silently
deletes `tier`. Nothing errors, nothing logs, and the field reappears the next time A writes
the entity — so the data flickers rather than breaking, which is much harder to diagnose.

## `PartialUpdate` is a correctness tool first

> *"`PartialUpdate` lets you define `set` and `delete` actions on existing objects while
> taking care of updating potential expiration times of both the entity itself and index
> structures."*

```java
PartialUpdate<Person> update = new PartialUpdate<>(id, Person.class)
        .set("firstname", "mat")
        .del("address");

redisKeyValueTemplate.update(update);
```

Note precisely what it claims to maintain: **the expiration time and the index structures**.
Those are the two things a hand-written `HSET` through a `RedisTemplate` silently corrupts:

- the TTL, because setting a field does not renew an expiry the repository would have
  renewed — and in some arrangements writing the key resets it, which is the opposite
  failure;
- the secondary index, because the set named for the *old* value still contains this id, so
  a finder on the old value keeps returning an entity that no longer has it.

That second one is the strongest argument in this whole topic for staying inside the
repository machinery. An index Spring Data maintains and you update behind its back is worse
than no index, because a wrong answer is worse than a missing feature.

The reference immediately qualifies the performance story:

> *"Updating complex objects as well as map (or other collection) structures requires
> further interaction with Redis to determine existing values, which means that rewriting
> the entire entity might be faster."*

So `PartialUpdate` is not "the fast path". Working out which hash fields to remove for a
changed collection requires reading them first. Use it because it keeps the TTL and the
indexes correct; treat any speed-up as incidental.

## References are pointers and nothing else

> *"Referenced Objects are not persisted when the referencing object is saved. You must
> persist changes on referenced objects separately, since only the reference is stored.
> Indexes set on properties of referenced types are not resolved."*

`@Reference` gives you three absences at once: no cascade on write, no dirty checking on the
far side, and no indexing through the reference. It is a foreign key with none of the
machinery a foreign key implies — there is no constraint, so a reference to a key that has
expired or been deleted is a perfectly valid thing to store, and you will discover it on
read.

This is the point where the JPA reflex is most dangerous. `@Reference` reads like
`@ManyToOne`, and it shares nothing with it except the shape of the field.

## Gotchas

**★ `save` deletes and re-creates the whole hash.** Any field in that hash your current
object does not carry is destroyed — including fields written by a different, newer version
of the same class during a rolling deployment.

**★ The rolling-deployment field flicker is the worst version of that.** Old instances
delete the new field; new instances write it back. The data is intermittently correct, which
reads as a caching bug for as long as it takes someone to find this sentence in the
reference.

**★ Nothing else may share an entity's key.** Because the hash is rewritten wholesale, a
key owned by a repository is owned exclusively. A script that adds a bookkeeping field to
the same hash will see it disappear at an unpredictable time.

**★ `PartialUpdate` is the only update that maintains the TTL and the indexes.** Reaching
for `RedisTemplate` to "just change one field" bypasses both, and the index left pointing at
the old value produces wrong query results rather than missing ones.

**★ `PartialUpdate` on a collection or nested object may be slower than a full save.** The
reference says so: determining existing values takes extra round trips. It is a correctness
tool, not an optimisation.

**★ List positions are part of the field names.** `nicknames.[0]` means removing an element
is a re-numbering, not a deletion — another reason writes are rewrites.

**★ Map keys must be simple types.** A `Map<SomeValueObject, X>` has no representation,
because the key becomes part of a hash field name.

**★ A custom converter does not stop a property being indexed.** The index sets are created
from the converted form whether or not that form makes a sensible key name.

**★ `_class` is stored on the root and on every nested abstract or interface-typed value.**
Renaming or moving the class breaks reads of existing data, exactly as in MongoDB, and here
there is not even an aggregation framework to migrate with.

**★ `@Reference` is not `@ManyToOne`.** No cascade, no dirty checking, no indexing through
it, and no referential integrity. A dangling reference is a normal thing to have stored.

**★ Reading an entity whose reference has expired is a read-time surprise.** Redis expiry
does not consult anything that points at the key, so nothing prevented the dangle.

## Interview questions

**★ What happens to a hash field your entity class does not know about when you save?**
It is deleted. The reference says writing an object deletes the content of the hash and
re-creates it, so unmapped data is lost. This is stronger than a document replace — it is a
documented delete.

**★ How does that interact with a rolling deployment?**
An instance running the older class rewrites the hash without the new field, deleting it;
an instance running the newer class writes it back. The value appears and disappears
depending on which instance served the last write.

**★ When do you have to use `PartialUpdate` rather than `save`?**
Whenever the entity has a TTL or an indexed property and you are changing part of it.
`PartialUpdate` maintains the expiration and the index structures; a manual `HSET` maintains
neither, and a stale index returns wrong answers rather than no answers.

**★ Is `PartialUpdate` faster than a full save?**
Not necessarily. The reference states that updating complex objects, maps and collections
requires extra interaction with Redis to determine existing values, so rewriting the whole
entity may be faster. Choose it for correctness.

**★ How is a nested object stored in a hash?**
By path-flattening the field names: `address.city`, `addresses.[0].city`,
`atts.[eye-color]`. The hash stays flat and the structure lives in the naming, which is why
map keys must be simple types.

**★ Why does a custom converter not remove the indexing cost?**
Because index resolution runs independently of custom conversion — the reference says
secondary indexes are still created, even for custom converted types. Conversion changes the
representation, not whether an index set is written.

**★ What does `@Reference` actually give you?**
A stored pointer. No cascade, no cascade delete, no dirty checking, no index resolution
through it, and no integrity constraint. Anything you expect from a JPA association you must
implement yourself, starting with the possibility that the target no longer exists.

{/* FOOTER */}
