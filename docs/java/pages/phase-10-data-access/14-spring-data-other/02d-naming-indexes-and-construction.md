---
title: "Field names, index creation and object construction are all defaults you can change globally, and each one becomes a data migration the moment there is data"
sidebar_label: "02d · Naming, indexes and construction"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Mapping* — the
> field-naming-strategy, constructor-creation and index-creation sections
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/mapping.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/mapping.html)),
> and the Spring Boot 4.1 application-properties appendix for
> `spring.data.mongodb.field-naming-strategy` and
> `spring.data.mongodb.auto-index-creation`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0.

**Three of the mapping layer's defaults are global switches rather than per-property
annotations: how a Java property name becomes a stored key, whether `@Indexed` actually
creates anything, and how the converter constructs your object on the way back. All
three are cheap to change on an empty collection and expensive to change on a full one,
and only the third produces a loud failure when you get it wrong.**

## Field naming, globally

Individually renaming every property with `@Field` is tedious in a codebase that has
already decided on `snake_case` on the wire. Boot exposes the strategy as a property:

```properties
spring.data.mongodb.field-naming-strategy=org.springframework.data.mapping.model.SnakeCaseFieldNamingStrategy
```

The default is `PropertyNameFieldNamingStrategy` — the stored key is the Java property
name, verbatim. A `@Field("…")` on an individual property overrides the strategy for
that property only, which makes it the compatibility escape hatch: switch the strategy
for new types and pin the old ones with explicit `@Field` names.

⚠️ Changing this on a collection that already has data is a **migration**, not a
setting. Every existing document keeps its old keys, every new one gets the new ones,
and every query matches one set or the other. There is no schema to tell you, and
nothing fails — the reads simply return fewer documents than they should.

This is the first of several places in this topic where the absence of a schema converts
a configuration change into a data problem. Relational storage would have refused the
new key outright, or forced you through a `ALTER TABLE … RENAME COLUMN` that rewrote
everything atomically. [Topic 11 · Flyway migrations](../11-flyway-migrations/README.md) covers what
that discipline buys you; the document store's answer is that you have to build the
equivalent yourself.

## Auto index creation is off, and that is deliberate

```properties
spring.data.mongodb.auto-index-creation=false
```

`false` is the default in current Spring Data MongoDB. `@Indexed` on a property does
**nothing at all** unless you turn this on or create the index yourself. That default is
the right one for production — building an index on application startup against a
large collection is a way to make a rolling deploy an outage — but it catches people who
annotated a field, saw a fast query in a ten-document dev collection, and assumed the
annotation had done something.

The honest pattern is the same one this phase argues for relational schemas: indexes are
part of the schema, the schema is deployed deliberately, and the application does not
create it at boot. An index that appears because a pod started is an index nobody
reviewed.

⚠️ Turning it **on** in a test profile and leaving it off in production is a recipe for
a green test suite and a scanning production query. If you rely on `@Indexed`, either
enable it everywhere or in neither place.

### What the annotation still buys you when it is off

It documents intent next to the property, and it can be read by tooling that generates
the index script. Treating `@Indexed` as the *declaration* and the deployment as the
*application* of that declaration is a workable arrangement — as long as somebody
actually closes the loop, which is exactly the failure mode above.

## Constructors, records, and how the converter builds an object

The converter prefers a constructor whose parameter names match property names, falling
back to field reflection for anything the constructor does not cover. That makes a
**record** a legitimate MongoDB document type in a way it is not a legitimate JPA entity
— JPA needs a no-arg constructor and mutable state, and the reasoning is laid out in
[06 · Why not a record](../06-jpa-hibernate-model/01c-why-not-a-record.md).

```java
@Document("orders")
public record Order(@Id String id, String reference, BigDecimal total, Instant placedAt) { }
```

This works, and it is one of the few genuinely nicer things about the document mapping
layer. It also quietly tells you something important: the reason it works is that
nothing is watching the object after you load it. There is no proxy to subclass, no
snapshot to diff, no lazy field to intercept. That is the subject of
[07 · What does not carry across](07-what-does-not-carry-across.md).

### Where the parameter names come from

Parameter-name matching needs the names to survive compilation. With records they always
do — the canonical constructor's component names are part of the class file. With an
ordinary class, compile with `-parameters` (Spring Boot's Maven and Gradle plugins set
this for you; a hand-rolled build may not) or the converter cannot match them and falls
back to field access. For a class with `final` fields and no no-arg constructor, that
fallback produces an object it cannot populate.

### `@PersistenceCreator` and the coin flip

```java
@Document("orders")
public class Order {

    private final String id;
    private final String reference;
    private final BigDecimal total;

    @PersistenceCreator
    Order(String id, String reference, BigDecimal total) { … }

    // the one application code actually calls
    public Order(String reference, BigDecimal total) {
        this(null, reference, total);
    }
}
```

With one constructor the annotation is optional. With two the converter has to choose,
and choosing the convenience constructor means every document you read back has a `null`
id — no exception, no warning, just an object that fails a later equality check or
overwrites a different document on save.

The rule of thumb: **the moment a document class grows a second constructor, annotate
the persistence one.** It costs one line and removes a class of bug that is very hard to
attribute after the fact.

## Gotchas

**★ Changing `field-naming-strategy` after go-live orphans every existing document.**
Old keys stay, new keys appear, and queries silently match a subset. Treat it as a data
migration with a backfill, or never change it.

**★ `@Field("…")` overrides the strategy per property, which is both the fix and a
hazard.** A codebase half-migrated to snake_case with scattered `@Field` pins is
extremely hard to reason about. Pin deliberately and comment why.

**★ `@Indexed` with `auto-index-creation` at its default does nothing.** The annotation
is documentation until an index actually exists. Nothing warns you, and the dev
collection is too small to notice.

**★ Enabling auto-index-creation in tests only makes the test suite lie.** It proves the
query is fast against an index production does not have.

**★ Auto index creation happens on first use of the entity, not necessarily at
startup.** So the cost lands on whichever request happens to be first, which on a large
collection is a request that times out.

**★ Multiple constructors without `@PersistenceCreator` is a coin flip.** The converter
picks one; if it picks the wrong one your object comes back with default values in the
fields the chosen constructor does not take.

**★ Compiling without `-parameters` breaks constructor binding on ordinary classes.**
Records are safe; hand-written classes with final fields are not, and the failure is an
object full of nulls rather than an exception.

**★ A Lombok `@AllArgsConstructor` plus `@NoArgsConstructor` reintroduces the ambiguity
you thought you had avoided.** Two generated constructors, no `@PersistenceCreator`, and
the generated code is not where anyone looks for the bug.

**★ Adding a property to a record changes its canonical constructor.** Every previously
stored document lacks the new component, and the converter supplies the type's default —
`null` for a reference, `0` for a primitive. A `boolean` that means "verified" silently
reads back as `false` for all historical data.

**★ Constructor binding means validation in the constructor runs on every read.** A
constructor that throws on invalid input turns a single bad historical document into a
failed query, not a skipped row.

## Interview questions

**★ How do you make every stored key snake_case without annotating each property?**
`spring.data.mongodb.field-naming-strategy` pointed at `SnakeCaseFieldNamingStrategy`.
`@Field("…")` still wins per property, which is how you keep older types on their
original keys.

**★ Why is that a dangerous change on a live system?**
There is no schema and no `ALTER`. Existing documents keep their old keys, so after the
change a query for the new key matches only documents written after the deploy. Nothing
errors; the result set is just wrong.

**★ You add `@Indexed` and the query does not get faster. Why?**
`spring.data.mongodb.auto-index-creation` defaults to `false`, so no index was created.
Either create it as part of your deployment, or turn the setting on knowing that index
builds will then happen against production data at first use.

**★ Should an application create its own indexes at startup?**
Generally no, for the same reason it should not run DDL: the build is unbounded work
against live data, it happens on every instance, and nobody reviewed it. Indexes belong
with the rest of the schema change process.

**★ Can a Java `record` be a MongoDB document?**
Yes. The converter binds through the canonical constructor and needs no mutability and
no no-arg constructor. A JPA entity cannot be a record, because JPA needs a proxy-able,
mutable object for dirty checking and lazy loading.

**★ Why is that difference more than a syntactic convenience?**
Because it reveals what the two mapping layers actually do. JPA's constraints exist to
support a persistence context that watches the object; MongoDB's converter hands you a
plain object and forgets about it. Records fit the second model exactly.

**★ Why and when do you need `@PersistenceCreator`?**
When a type has more than one constructor and the converter would otherwise have to
guess. Picking the wrong one does not fail — it produces a partially populated object,
which is worse than an exception because it survives into the rest of the request.

**★ Your service compiles with a custom build that does not pass `-parameters`. What
breaks in the mapping layer?**
Constructor parameter names are gone, so the converter cannot match them to properties.
It falls back to field access; for a class with final fields it cannot write them, and
you get objects full of nulls with no diagnostic.

**★ You add a `boolean verified` component to an existing record. What do old documents
read back as?**
`false`, because the field is absent and the converter supplies the primitive default.
That is indistinguishable from a document that was genuinely written as `false`, which
is a good argument for a boxed `Boolean` or an explicit backfill.

{/* FOOTER */}
