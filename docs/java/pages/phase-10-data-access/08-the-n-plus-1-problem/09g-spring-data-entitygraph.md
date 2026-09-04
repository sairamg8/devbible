---
title: "Spring Data's @EntityGraph puts the fetch plan on the repository method, which is the only placement that keeps the query and its plan in one declaration"
sidebar_label: "9g · Spring Data @EntityGraph"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference *JPA Query
> Methods* → "Configuring Fetch- and LoadGraphs"
> ([docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)),
> the `org.springframework.data.jpa.repository.EntityGraph` javadoc
> ([docs.spring.io/spring-data/jpa/docs/current/api](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/EntityGraph.html)),
> and the Jakarta Persistence 3.2 specification §3.8.1
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**Everything [chunk 9c](09c-named-entity-graphs.md) objects to about named graphs
is solved by one annotation placement: `@EntityGraph(attributePaths = …)` on the
repository method puts the plan next to the query it applies to, so a reader sees
both at once and deleting the method deletes the plan. It also defaults to
`FETCH` semantics, which is the opposite of `find()`, and it inherits the
pagination problem in full.**

## The two forms

Referencing a named graph — the documented example:

```java
public interface GroupRepository extends CrudRepository<GroupInfo, String> {

  @EntityGraph(value = "GroupInfo.detail", type = EntityGraphType.LOAD)
  GroupInfo getByGroupName(String name);
}
```

Ad hoc, with no annotation on the entity at all — and this is the form worth
reaching for:

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

  @EntityGraph(attributePaths = { "customer", "lines", "lines.product" })
  Optional<Order> findById(Long id);
}
```

The reference documentation's wording: *"The provided `attributePaths` are
translated into the according `EntityGraph` without needing to explicitly add
`@NamedEntityGraph` to your domain types."*

## What the annotation's javadoc pins down

| Element | Default | Meaning |
|---|---|---|
| `value` | `""` | name of a `@NamedEntityGraph`; falls back to `JpaQueryMethod.getNamedQueryName()` when empty |
| `type` | **`EntityGraphType.FETCH`** | fetch or load semantics |
| `attributePaths` | `{}` | paths to fetch; "direct properties of the entity or **nested properties via a `property.nestedProperty`**" |

Two behaviours worth knowing exactly:

- 🔴 **`attributePaths` wins.** The javadoc: *"If `attributePaths()` are specified
  then we ignore the entity-graph name `value()` and treat this `EntityGraph` as
  dynamic."* Setting both is not a merge and not an error — the name is silently
  discarded.
- 🔴 **The default is `FETCH`.** `find(graph, id)` is always `LOAD`
  ([chunk 9f](09f-fetchgraph-vs-loadgraph.md)). So the same plan, applied through
  a repository method and through `EntityManager.find`, is interpreted
  *differently* on any model that has an `EAGER` association. On a fully lazy
  model they coincide, which is one more reason to map everything lazy.

Nested paths use dots, and they nest arbitrarily: `"lines.product.supplier"` is
the equivalent of a two-level subgraph without any `@NamedSubgraph` wiring. This
is the ergonomic win over the JPA annotation — a plan that took fourteen lines in
[chunk 9c](09c-named-entity-graphs.md) is one line here.

## Why the placement is the point

Compare where the plan lives:

| Placement | Reader sees the query and plan together? | Deleting the endpoint removes the plan? |
|---|---|---|
| `@NamedEntityGraph` on the entity | no | no |
| built at the call site | yes | yes |
| **`@EntityGraph` on the repository method** | **yes** | **yes** |

That second column is the maintenance argument. The named-graph failure mode is
an entity accumulating six plans that nobody can attribute to an endpoint and
nobody dares delete. Here the plan is one line above the method signature: it is
obvious what it is for, and it goes when the method goes.

The third column matters more than it looks. A fetch plan is dead code the moment
its caller disappears, and the only placements where the compiler and the code
reviewer can see that are the two that put the plan inside the method.

## Where you can put it

The reference documents it on a **declared query method** — derived or
`@Query`-annotated. It composes with `@Query`:

```java
@EntityGraph(attributePaths = "lines")
@Query("select o from Order o where o.placedAt > :cutoff")
List<Order> recent(@Param("cutoff") Instant cutoff);
```

⚠️ **Re-declaring an inherited method** — putting `@EntityGraph` on your own
`findAll()` or `findById()` override — is a widely used pattern, and the Spring
Data JPA 4.1 reference does not document it either way. I state it as
conventional rather than as guaranteed; the documented, unambiguous placement is
a method you declared yourself, and giving it a name of its own
(`findByIdForInvoice`) also removes the question of which callers get the plan.

That last point is the important one: overriding `findById` applies the plan to
**every** caller of `findById`, including the ones that only wanted the row. A
named method applies it to the callers that asked.

## What it does not change

`@EntityGraph` generates joins, so it carries the whole of
[chunk 9h](09h-a-graph-is-still-a-join.md) with it:

- A collection path produces **duplicate parents** in a `List` return type unless
  something de-duplicates — [chunk 8c](08c-duplicate-parents-and-distinct.md).
- Two collection paths at the same level produce a **Cartesian product**, and two
  bags raise `MultipleBagFetchException` —
  [chunk 8e](08e-multiplebagfetchexception.md).
- With a `Pageable`, it is the same pagination question as a `join fetch` —
  [chunk 8d](08d-pagination.md) — and on Hibernate below 7.4 the limit is applied
  in memory after fetching every matching row.

**The Pageable case is the one that bites in Spring Data specifically**, because
the annotation is so easy to add to an existing paged method that nobody
re-examines the query. `Page<Order> findAll(Pageable)` plus
`@EntityGraph(attributePaths = "lines")` is a one-line change with a
version-dependent cost proportional to the whole table.

## Gotchas

**⚠️ Setting `value` and `attributePaths` together.**
`attributePaths` wins and the named graph is silently ignored — the javadoc says
so explicitly. Nothing warns you, so a method that looks like it uses the
carefully-tuned `Order.forInvoice` graph is actually using whatever is in the
paths array.

**⚠️ Assuming the semantics match `find()`.**
`@EntityGraph` defaults to `FETCH`; `EntityManager.find(graph, id)` is always
`LOAD`. Identical plans, different interpretation, on any model with an eager
association. Set `type` explicitly if the distinction can matter in your
mappings, and read [chunk 9f](09f-fetchgraph-vs-loadgraph.md) to decide whether
it can.

**⚠️ A typo in `attributePaths`.**
It is a string array. The failure is not at compile time, and depending on how
the path resolves it may be a startup failure, a runtime
`IllegalArgumentException`, or a plan quietly missing a node. A repository test
that asserts the query count is the practical guard —
[chunk 6b](06b-asserting-the-count-in-a-test.md).

**⚠️ Adding it to an inherited `findById` and applying it to the world.**
Every caller of `findById` now fetches the collection, including the audit path
that wanted one row and the `existsById`-shaped code that wanted nothing.
Declare a named method instead; the plan then reaches only the callers that asked
for it, and the method name documents why.

**⚠️ Combining it with `Pageable` and not checking the Hibernate version.**
A collection path plus a `Pageable` is a paginated collection fetch join by
another name. On Hibernate 7.4 and later this is genuinely fixed; below it, the
limit is applied in the JVM after materialising every matching row. It is a
one-line annotation with a whole-table cost — [chunk 8d](08d-pagination.md).

**⚠️ Two collection paths in one `attributePaths`.**
`{"lines", "shipments"}` is a Cartesian product expressed in nineteen characters,
and if both are `List`s it is a `MultipleBagFetchException` at runtime. The
annotation's concision is exactly what makes this easy to write without noticing
— see [chunk 9e2](09e2-how-deep-a-graph-should-go.md) on counting plural nodes
per level.

**⚠️ Returning `Page<T>` from a graph method and letting the count query be
derived.**
The count query must be over the parents only. Spring Data derives it from the
query, and a derived count over a fetch-joined query is meaningless. Where you
have supplied `@Query`, supply `countQuery` too.

**⚠️ Expecting `@EntityGraph` to work on a `@NativeQuery`.**
A graph shapes SQL the provider generates; a native query's SQL is yours. I could
not find any statement in the Spring Data JPA 4.1 reference or the Jakarta
Persistence 3.2 specification that a graph applies to a native query, and would
not rely on it — use a projection or `@SqlResultSetMapping`.

**⚠️ Using one graph method for several endpoints with different needs.**
The moment two endpoints share `findByIdWithEverything`, the plan is the union of
their requirements and neither of them is paying for what it uses. The whole
value of method-level placement is that a method is cheap to add — add a second
one.

**⚠️ Treating `@EntityGraph` as a substitute for thinking about the return
type.**
It fetches entities. If the endpoint serialises them to JSON, the graph is
choosing which parts of the object graph to materialise so a serialiser can walk
them, and a projection would state the same thing as a set of columns
([chunk 12b](12b-projecting-a-collection.md)).

## Interview questions

**★ What does `@EntityGraph` on a repository method do?**
It attaches a JPA entity graph to that query method. Two forms: `value` names a
`@NamedEntityGraph` declared on the entity, or `attributePaths` declares an ad
hoc graph inline — the reference says the paths "are translated into the according
`EntityGraph` without needing to explicitly add `@NamedEntityGraph` to your domain
types". Paths may be nested with dots, `"lines.product"`, which replaces the
`@NamedSubgraph` wiring entirely.

**★ What happens if you set both `value` and `attributePaths`?**
`attributePaths` wins. The javadoc is explicit: "If `attributePaths()` are
specified then we ignore the entity-graph name `value()` and treat this
`EntityGraph` as dynamic." It is silent — no warning that the named graph you
referenced is being discarded.

**★ What semantics does it default to?**
`EntityGraphType.FETCH`. That is worth knowing because `EntityManager.find(graph,
id)` is always `LOAD`, so the same plan applied through the two routes is
interpreted differently on any model with an `EAGER` association. On a fully lazy
model the two coincide and the default does not matter.

**★ Why is putting the graph on the repository method better than on the
entity?**
Because it keeps the query and its fetch plan in one declaration. A
`@NamedEntityGraph` on the entity is a statement about one endpoint's needs
written on the domain class, linked to that endpoint by a runtime string —
so the entity accumulates plans nobody can attribute and nobody can safely
delete. On the method, the plan is one line above the signature, and it is
deleted when the method is.

**★ What is the risk of putting it on an overridden `findById`?**
Every caller of `findById` gets the plan, including the ones that wanted a bare
row. Fetch plans should reach the callers that asked for them, so a named method
— `findByIdForInvoice` — is safer and self-documenting. ⚠️ I would also note that
the Spring Data 4.1 reference documents `@EntityGraph` on *declared* query
methods and does not address overriding inherited ones either way, so the pattern
is conventional rather than specified.

**★ Does `@EntityGraph` avoid the fetch join's problems?**
No — it *is* a fetch join, expressed as an annotation. A collection path gives you
duplicate parents in a `List` return type, two collection paths give a Cartesian
product and, if both are bags, `MultipleBagFetchException`, and a `Pageable` plus
a collection path is a paginated collection fetch with all the history that
carries. The annotation's brevity is the hazard: nineteen characters can express a
quadratic query.

**★ How would you decide between `@EntityGraph` and a `@Query` with `join
fetch`?**
`@Query` with `join fetch` when the plan is fixed and the query is already
hand-written — it is one artefact, validated by Hibernate's parser at bootstrap,
and there is nothing extra to read. `@EntityGraph` when the query is derived (so
there is no query text to add the fetch to), when several methods share a
restriction but differ in plan, or when the plan is nested and a `join fetch`
chain would be noisy. Both are per-query and model-neutral; the choice is about
which one a reader will understand faster.

**★ Where would you not use it at all?**
On a read-only endpoint whose output is a document. The graph decides which
entities to materialise so a serialiser can walk them; a projection decides which
columns to select. The projection is smaller, has no persistence context, cannot
be accidentally modified, and states the response shape in the query itself —
[chunk 12](12-projections-and-dtos.md).

---

← Prev: [9f · fetchgraph vs loadgraph](09f-fetchgraph-vs-loadgraph.md) · Index: [08 · The N+1 problem](README.md) · Next → [9h · A graph is still a join](09h-a-graph-is-still-a-join.md)
