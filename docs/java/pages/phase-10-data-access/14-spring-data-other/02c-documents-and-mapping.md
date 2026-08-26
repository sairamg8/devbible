---
title: "A MongoDB document is mapped by four annotations, and the identifier rules are the only place where writing the same field two ways gives you two different documents"
sidebar_label: "02c · Documents and identifiers"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Mapping* — the
> mapping-annotation overview, the identifier-handling section and its rules table
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/mapping.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/mapping.html)),
> and the *Template CRUD* chapter for `@Version` semantics
> ([…/mongodb/template-crud-operations.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**A JPA entity needs `@Entity` and a persistence unit; a MongoDB document needs almost
nothing. A plain class with a field called `id` is already mappable, because the
converter works from reflection and treats annotations as overrides rather than as
requirements. That convenience is exactly why the mapping layer is worth reading
carefully: the defaults are doing real work, and the identifier defaults in particular
convert your `String` into an `ObjectId` behind your back — sometimes.**

## The annotations, and how few of them you need

```java
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    @Field("ref")
    private String reference;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal total;

    private Instant placedAt;

    @Transient
    private Duration age;

    @Version
    private Long version;

    @PersistenceCreator
    public Order(String id, String reference, BigDecimal total) { … }
}
```

- **`@Document`** marks the class as a top-level document and optionally names the
  collection. Without it the collection name is the uncapitalised simple class name —
  `Order` becomes `order`. The annotation is not required for a class to be *mappable*,
  only for it to be discovered as a document type by repository detection and by the
  initial entity set.
- **`@Id`** — `org.springframework.data.annotation.Id`, never `jakarta.persistence.Id`.
  See [01 · One idiom, many stores](01-one-idiom-many-stores.md) for why that import is
  the single most common first mistake.
- **`@MongoId`** is the identifier annotation with an explicit `FieldType`, for when you
  want to control the conversion rather than accept the default. More on that below,
  because it is the whole point of the page.
- **`@Field`** renames the stored key and can force a target BSON type. `targetType`
  is how a `BigDecimal` becomes a `Decimal128` rather than whatever the default
  representation happens to be, and how a `String` foreign key can be stored as an
  `ObjectId` so it matches the other collection's `_id`.
- **`@Transient`** — again the Spring Data Commons one — excludes a property from both
  reading and writing.
- **`@PersistenceCreator`** names the constructor or factory method the converter should
  use when there is more than one candidate. See
  [02d · Naming, indexes and construction](02d-naming-indexes-and-construction.md).
- **`@Version`** enables optimistic locking. Spring Data's own wording is that it
  "provides syntax similar to that of JPA in the context of MongoDB and makes sure
  updates are only applied to documents with a matching version" — a mismatch raises
  `OptimisticLockingFailureException`, the same commons exception JPA raises.
- **`@Indexed`**, **`@DBRef`** and **`@DocumentReference`** exist too; indexing and
  references are the MongoDB section's territory, not this phase's.

## The identifier rules, which are stranger than they look

MongoDB always stores the identifier under `_id`. What Spring Data does *on the way
there* depends on the property's name, its declared type, and which annotations are on
it. The reference states three rules:

1. A field named `id` declared as `String` or `BigInteger` is **converted to an
   `ObjectId` if possible**, and stored under `_id`.
2. `@MongoId` stores the value in its actual type with **no further conversion**, unless
   a `FieldType` is declared on the annotation.
3. Anything else — an identifier the converter cannot turn into an `ObjectId`, or one
   whose type you chose deliberately — **must be assigned by the application** before
   the first save.

Rule 1 is the one that surprises people. `private String id;` does not necessarily
store a string. If the value looks like a 24-character hex `ObjectId`, it is stored as a
BSON `ObjectId`; if it does not, it is stored as a string. **The same Java field can
produce two different BSON types in the same collection depending on what you put in
it**, and a query written against one of them will not match the other.

### The exact field-name outcomes

The reference gives a table of what lands where. It is worth internalising because the
interaction between `@Id` and `@Field` is not what you would guess:

| Declaration | Stored key |
|---|---|
| `String id` | `_id` |
| `@Field String id` | `_id` |
| `@Field("x") String id` | `x` |
| `@Id String x` | `_id` |
| `@Field("x") @Id String y` | `_id` — the `@Field` name is **ignored** |

Two things fall out of that. A property *named* `id` is treated as the identifier even
with no annotation at all — which is why an entity that accidentally imported
`jakarta.persistence.Id` still appears to work, right up until it does not. And
`@Field("x")` on a property named `id` **moves it out of `_id`** and turns it into an
ordinary field, at which point the document has no identifier mapping and Mongo
generates its own `_id` that your object never sees.

## `@MongoId` and taking control of the conversion

```java
public class Order {

    @MongoId                                  // stored as whatever the Java type is
    private String reference;

    // or:
    @MongoId(FieldType.OBJECT_ID)             // forced to ObjectId
    private String id;

    // or:
    @MongoId(FieldType.STRING)                // forced to String, never an ObjectId
    private String slug;
}
```

The `FieldType` values that matter here are `OBJECT_ID`, `STRING`, `INT64`, `BINARY`
and `DECIMAL128`. `@MongoId(FieldType.STRING)` is the annotation you want the moment
your identifier is a business key — an order reference, a slug, a tenant-scoped code —
because it removes the "converted if possible" ambiguity entirely and guarantees one
BSON type for every document in the collection.

The equivalent for non-identifier properties is `@Field(targetType = …)`, which does the
same job for a foreign key you store as a `String` but need to match against an
`ObjectId` in another collection.

## Why none of this looks like JPA's identifier story

A JPA entity's identifier is generated by a documented strategy — `IDENTITY`, `SEQUENCE`,
`TABLE`, `AUTO`, `UUID` — and the choice has performance consequences the phase has
already argued at length in
[06 · `@GeneratedValue` and IDENTITY](../06-jpa-hibernate-model/07-generatedvalue-identity.md)
and [06 · Sequence and allocationSize](../06-jpa-hibernate-model/08-sequence-and-allocationsize.md).

MongoDB has none of that machinery, because there is nothing to coordinate. If `_id` is
absent on insert, the **driver** generates an `ObjectId` client-side before the document
leaves the JVM. There is no round trip to fetch a value, no sequence to allocate from,
no `IDENTITY`-shaped barrier that stops writes being batched. That is a genuine
simplification, and it is the first of several places in this topic where the document
store is easier because it is doing less.

The cost is on the other side: an `ObjectId` carries no meaning, so the moment you want
a natural key you are back to assigning it yourself and living with rule 3.

## Gotchas

**★ `private String id;` may be stored as an `ObjectId` or as a `String` depending on
the value.** "Converted to an `ObjectId` if possible" means the BSON type of `_id` is
data-dependent. A collection populated by two code paths can end up with both, and no
single query matches all of it.

**★ `@Field("x")` on a property named `id` silently un-maps your identifier.** The
property moves to `x`, MongoDB generates its own `_id`, and your object's id field is
whatever you set it to and has no relationship to the document's actual key.

**★ `@Field(name)` is ignored when `@Id` is also present.** It is not an error and there
is no warning. If you wanted a differently named identifier key, MongoDB does not offer
one — `_id` is fixed by the server.

**★ Importing `jakarta.persistence.Id` still appears to work if the property is named
`id`.** The converter falls back to the property *name*, so the wrong import is masked
until someone renames the field, at which point identity breaks with no obvious cause.

**★ `@Transient` from `jakarta.persistence` is the wrong one, exactly as `@Id` is.**
Same package trap, same silent outcome — the property gets persisted anyway.

**★ A missing `@Document` does not stop mapping; it stops discovery.** The class still
maps fine when you hand it to a template. What it loses is the initial entity set, which
is what `@TypeAlias` needs and what repository detection scans for.

**★ `@Version` on a MongoDB document is a full round trip's worth of semantics, not a
column.** The update carries a version predicate, and a mismatch throws
`OptimisticLockingFailureException`. If you also write to the same document through
`MongoTemplate.updateFirst`, that path does not participate — see
[03 · Where the repository stops and the template starts](03-mongotemplate.md).

**★ Assigning your own `String` id and then querying by `ObjectId` in a raw
`@Query`.** The document holds a string, the query holds an `ObjectId`, and BSON does
not consider those equal. The mapped path converts for you; a hand-written query
document does not.

**★ Two documents in one collection with different shapes is legal.** There is no schema
rejecting a document your mapping cannot read. You find out on the read, one document at
a time, in production.

## Interview questions

**★ Which annotations does a MongoDB document actually require?**
None, strictly. A class with a property named `id` maps. `@Document` is what makes it
discoverable — it names the collection and puts the type in the initial entity set.
`@Id`, `@Field`, `@Transient` and `@Version` are overrides on top of reflective
defaults.

**★ Where does the identifier go, and can you change its key?**
Always `_id`. You cannot rename it — `_id` is the server's, not Spring Data's. A
`@Field("x")` alongside `@Id` is ignored for exactly that reason.

**★ What does Spring Data do with `private String id;` when you save?**
It converts the value to an `ObjectId` **if possible**, and stores it as a string
otherwise. That makes the stored BSON type value-dependent, which is why `@MongoId` with
an explicit `FieldType` is the right annotation for a business-key identifier.

**★ You want your order reference to be the document id and to stay a string. How?**
`@MongoId(FieldType.STRING)`, or `@Field(targetType = FieldType.STRING)` alongside
`@Id`. Either removes the conditional conversion and guarantees a single BSON type
across the collection.

**★ What is the MongoDB equivalent of `@GeneratedValue`?**
There isn't one, and there does not need to be. A missing `_id` is filled in by the
driver client-side with an `ObjectId` before the write is sent. No sequence, no
round trip, and none of the batching penalty an `IDENTITY` column imposes.

**★ What is the equivalent of `@Column(name=…)` and why is the analogy imperfect?**
`@Field("…")`. The analogy breaks because `@Column` describes a column that must exist
in a schema the database enforces, while `@Field` names a key that may or may not be
present in any given document — and "absent" is a state relational storage does not
have.

**★ How does `@Version` here differ from JPA's `@Version`?**
The check itself is the same idea and raises the same commons exception. The difference
is what enforces it: JPA increments the version as part of the flush the persistence
context manages, whereas here the version predicate rides on the specific write you
issue — and a write that bypasses the mapped path bypasses the check with it.

**★ A colleague renames a property from `customerId` to `customerRef` on a live
collection. What breaks?**
Every existing document still has `customerId`, so every derived query against the new
property matches nothing for old data and everything for new. There is no schema and no
migration unless you write one. `@Field("customerId")` on the renamed property is the
compatible move.

{/* FOOTER */}
