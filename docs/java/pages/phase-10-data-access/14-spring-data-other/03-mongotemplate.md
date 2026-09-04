---
title: "`save` on a MongoDB repository replaces the whole document, which makes a lost update the default behaviour rather than an edge case"
sidebar_label: "03 · MongoTemplate"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Template CRUD
> operations* — the insert/save distinction and the optimistic-locking section
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html))
> and the *Template API* overview
> ([…/mongodb/template-api.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-api.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**A JPA repository's `save` on a managed entity is a no-op that lets dirty checking
compute an `UPDATE` containing only the columns that changed. A MongoDB repository's
`save` is a whole-document replace: it serialises the object you hand it and writes that
document over whatever was there. Nothing computes a delta, because nothing was watching
the object. That single difference is why `MongoTemplate` is not an advanced tool you
graduate to — it is the tool you need the first time two requests write different fields
of the same document.**

## What the template is

`MongoTemplate` implements `MongoOperations`, and it is the store-specific counterpart to
`JdbcTemplate` in [05 · SQL-first access](../05-sql-first-access/02-jdbctemplate.md). Boot
auto-configures one; you inject it.

```java
@Service
class OrderService {

    private final MongoTemplate mongo;

    OrderService(MongoTemplate mongo) { this.mongo = mongo; }
}
```

Everything a repository does, the template does — the repository is implemented on top of
it. What the template adds is everything a derived method name and a static `@Query`
document cannot express: queries whose *structure* varies, partial updates, atomic
find-and-modify, bulk writes, aggregation pipelines built in Java, and collection
management. Those are the subject of
[03b · Partial updates and find-and-modify](03b-partial-updates.md) and
[03d · Aggregation from Java](03d-aggregation-from-java.md).

Inject `MongoOperations` rather than the class if you want a seam for testing;
`ReactiveMongoTemplate`/`ReactiveMongoOperations` are the reactive equivalents.

## `insert` and `save` are not synonyms

The reference draws the line in one sentence:

> The difference between insert and save operations is that a save operation performs an
> insert if the object is not already present.

and then specifies each:

> **insert** — If there is an existing document with the same `id`, an error is
> generated.

> **save** — Saves the object, overwriting any object that might have the same `id`.

```java
mongo.insert(order);        // DuplicateKeyException if _id already exists
mongo.save(order);          // upsert: replaces the existing document wholesale
```

`insert` is the honest one for a create. If your code path means "this is new", `insert`
turns a duplicate into a `DuplicateKeyException` you can handle, where `save` silently
destroys the existing document. The distinction is invisible in every test that uses a
fresh id, which is every test.

## The lost update, which is the reason this page exists

Two requests load the same order. One sets `status`, the other appends to `notes`. Both
call `repository.save(order)`.

```java
// request A
Order o = repo.findById(id).orElseThrow();
o.setStatus("SHIPPED");
repo.save(o);                       // writes ALL of A's fields

// request B, overlapping
Order o = repo.findById(id).orElseThrow();
o.getNotes().add("customer called");
repo.save(o);                       // writes ALL of B's fields
```

Whichever `save` lands second wins **entirely**. B's document has no `SHIPPED` status,
because B's in-memory object never had one. Nothing conflicted, nothing threw, and both
requests returned 200.

In JPA this is much harder to reach by accident, because dirty checking only writes the
columns that actually changed — the mechanics are in
[06 · Dirty checking](../06-jpa-hibernate-model/14-dirty-checking.md) and
[06 · The shape of the update](../06-jpa-hibernate-model/14d-the-shape-of-the-update.md).
Two transactions touching different columns of the same row produce two `UPDATE`s that do
not overlap. Here there is no persistence context, so there is no snapshot, so there is
no delta, so there is no such protection.

### It is worse than the concurrent case

The overlapping-requests version needs two requests. The version that needs only one is a
projection:

```java
record OrderSummary(String id, String status) { }

OrderSummary s = mongo.query(Order.class).as(OrderSummary.class)
        .matching(where("_id").is(id)).oneValue();

// … later, someone maps it back and saves
```

Any object that does not carry every field of the document is a partially-populated
object, and saving it writes the absent fields as null or drops them. The same applies to
a DTO mapped back with MapStruct, to an object built in a test fixture, and to an entity
loaded through an older version of the class that did not have the newest field yet.

**The invariant to hold onto: `save` is only safe on an object you read in full and did
not narrow.**

## The two ways out

**`@Version`** turns the second write into an `OptimisticLockingFailureException` rather
than a silent overwrite. The reference is explicit that a mapped `@Version` property makes
"sure updates are only applied to documents with a matching version". It does not prevent
the lost update; it converts it into an error you can retry, which is the whole value of
optimistic locking and is argued in general terms in
[06 · `@Version` and optimistic locking](../06-jpa-hibernate-model/16-version-and-optimistic-locking.md).

```java
@Document("orders")
class Order {
    @Id String id;
    @Version Long version;
    …
}
```

**A partial update** — write the field you changed, not the object you loaded. That
removes the conflict rather than detecting it, and it is what
[03b · Partial updates and find-and-modify](03b-partial-updates.md) is about.

Use both. `@Version` protects the paths you forgot to convert.

## Gotchas

**★ `repository.save(entity)` is a whole-document replace, not a delta.** Every field of
the in-memory object is written, including the ones you never touched and the ones that
were `null` because you built the object from something narrower.

**★ Saving an object built from a projection destroys the fields the projection did not
select.** They are `null` in memory, and `null` in memory is written as absent or null in
the document. This is the most damaging version of the previous gotcha and it looks
completely reasonable in review.

**★ `save` on a document another request has modified silently loses their change.**
Without `@Version` there is no conflict, no exception, and no trace. Add `@Version` to
any document more than one code path writes.

**★ Adding a new field to a document class and deploying it alongside the old version
loses that field on every save the old instances perform.** During a rolling deploy both
versions are writing whole documents, and the old one does not know the new field exists.
This is a real, routine outage shape and it has no equivalent in a relational deployment,
where the old code simply does not mention the new column.

**★ `insert` and `save` differ only on collision, so the bug only appears when there is
one.** Every test with a fresh id passes for both. Choose deliberately: `insert` for
create, `save` for genuine upsert.

**★ `@Version` on a `long` rather than a `Long` cannot represent "not yet versioned".**
A primitive defaults to `0`, which is a legitimate version, so a genuinely new document
is indistinguishable from one at version zero. Use the boxed type.

**★ Optimistic locking here only covers the mapped save path.** Anything that writes the
document another way — a template update, an aggregation `$merge`, another service, a
script — does not increment the version and does not check it.

**★ `MongoTemplate` is thread-safe and `Query`/`Update` objects are not.** Building a
`Query` once as a field and mutating it per call is a data race that produces
intermittently wrong criteria.

**★ Reading with the repository and writing with the template is fine; the trap is doing
both to the same document without deciding which one owns the write.** Pick one route per
document type and enforce it in review, because the two have different concurrency
semantics and mixing them makes neither guarantee hold.

## Interview questions

**★ Why is `MongoTemplate` not an advanced-only API?**
Because the repository's `save` is a whole-document replace with no delta computation.
The first time two code paths write different fields of one document, you need a partial
update, and partial updates only exist on the template.

**★ What exactly is the difference between `insert` and `save`?**
`insert` fails with a duplicate-key error if a document with that `_id` exists; `save`
overwrites it. `save` performs an insert when the object is not already present, which is
what makes it an upsert.

**★ Two requests load the same order, change different fields, and both call `save`.
What happens?**
The second write wins completely; the first request's change is gone. Nothing throws.
JPA's dirty checking would have produced two non-overlapping `UPDATE`s; here there is no
persistence context and therefore no delta.

**★ Why does JPA not have this problem to the same degree?**
Because the persistence context keeps a snapshot of the loaded state and the flush writes
only what differs from it. The unit of work is the set of changed *columns*, not the
object. Spring Data MongoDB has no unit of work at all.

**★ How do you make the failure loud instead of silent?**
Add a `@Version` property. The mapped save then carries a version predicate and raises
`OptimisticLockingFailureException` on a mismatch, which you can retry. Better still, stop
replacing the document and issue a targeted update.

**★ Give a single-threaded way to lose data with `save`.**
Load a projection or map into a DTO that omits fields, then save an object reconstructed
from it. The omitted fields are null in memory and get written as such. No concurrency
required.

**★ What does a rolling deploy do to a document that gained a field in the new version?**
Old instances still write whole documents without it, so any document they save loses the
new field. The relational equivalent does not exist, because an `UPDATE` naming specific
columns leaves the others alone.

**★ Does `@Version` protect a document written by a template update?**
No. The version predicate rides on the mapped save. Template updates, aggregation merges
and any external writer bypass it entirely, which is why the version number on a
mixed-write document cannot be trusted.

**★ Where does `MongoTemplate` sit relative to `JdbcTemplate` conceptually?**
Same role: the store-specific operations API that the repository abstraction is built on,
and the thing you drop to when the abstraction cannot express your operation. The
difference is that you drop to `JdbcTemplate` mainly for queries, and to `MongoTemplate`
mainly for **writes**.

{/* FOOTER */}
