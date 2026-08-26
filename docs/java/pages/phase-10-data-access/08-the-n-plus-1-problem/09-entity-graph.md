---
title: "An entity graph is a fetch plan expressed as data, and it is the first fix in this part that does not change the mapping"
sidebar_label: "9 · Entity graphs"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §3.8
> *Entity Graphs* and §3.8.1 *Use of Entity Graphs in find and query operations*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 user guide §12.6 *Dynamic fetching via Jakarta Persistence
> entity graph*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and *A Short Guide to Hibernate 7* §5.7 *Entity graphs and eager fetching*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Boot 4.1.0.

**A `join fetch` puts the fetch plan inside a query string, so fetching the same
rows with a different plan means writing a second query. An entity graph puts the
fetch plan in a *value* — an object you build, name and pass in — so one query,
or `find()` itself, can run with whatever plan the caller needs. That is the
whole idea; the six chunks after this one are mechanics.**

## The problem the graph solves

[Chunk 8](08-join-fetch.md) fixed N+1 by writing the fetch into the query:

```java
@Query("select o from Order o left join fetch o.lines where o.id = :id")
Optional<Order> findByIdWithLines(@Param("id") Long id);
```

That works, and it is the right first tool. But the fetch plan is now welded to
the query text, which produces a repository that looks like this after a year:

```java
Optional<Order> findById(Long id);
Optional<Order> findByIdWithLines(Long id);
Optional<Order> findByIdWithLinesAndCustomer(Long id);
Optional<Order> findByIdWithLinesAndCustomerAndShipments(Long id);
```

Four methods, one query, four fetch plans, and every new endpoint adds a fifth.
The `where` clause is duplicated four times, so a change to it has four places to
go and one of them will be missed. This is the combinatorial explosion entity
graphs exist to collapse: the **restriction** is one concern and the **fetch
plan** is another, and welding them together multiplies them.

With graphs there is one repository method and one plan per call site:

```java
Order forInvoice(Long id) {          // needs lines and their products
    var g = session.createEntityGraph(Order.class);
    g.addPluralSubgraph(Order_.lines).addSubgraph(OrderLine_.product);
    return session.find(g, id);
}

Order forTracking(Long id) {         // needs shipments only
    var g = session.createEntityGraph(Order.class);
    g.addPluralSubgraph(Order_.shipments);
    return session.find(g, id);
}

Order forAudit(Long id) {            // needs nothing but the row
    return session.find(Order.class, id);
}
```

Three fetch plans, one entity, zero new query strings, and each plan stated where
the requirement lives — which is the argument of
[chunk 18 · fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md). The
mechanics of that `createEntityGraph` / `find` pair are
[chunk 9b](09b-applying-a-graph.md).

## What an entity graph is

Jakarta Persistence 3.2 §3.8 defines an entity graph as a description, rooted at
one entity type, of which attributes should be fetched. It is a tree of
`AttributeNode`s, each of which may carry a `Subgraph` describing what to fetch
of *that* attribute's type.

Two things follow from "rooted at one entity type", and both matter:

- A graph is **not a query**. It has no `where`, no `order by`, no parameters. It
  says what to fetch, never which rows.
- A graph is **not a mapping**. Nothing on the entity changes. The declared
  `FetchType` of every association is exactly what it was; the graph overrides it
  for one execution.

That second point is what separates it from every fix in
[chunk 8e2](08e2-the-three-ways-out.md).

## "No graph" is itself a graph

The specification names the baseline a graph overrides:

> *"The default fetch graph for an entity or embeddable is defined to consist of
> the transitive closure of all of its attributes that are specified as
> `FetchType.EAGER` (or defaulted as such)."*

This is a genuinely useful reframing, and worth sitting with. Your mapping does
not declare *fixed* fetching behaviour; it declares **the default graph**, which
applies when no other graph is supplied. Fetch types stop being a property of the
entity and become a property of the *unspecified* case.

Once you see it that way, per-query fetch planning stops looking exotic. The
question at every call site is not "should I override the mapping" but "which
plan does this unit of work need", and the mapping is simply the answer for the
calls that have not thought about it.

## Where it sits among the fixes

| Fix | Scope | Changes the model | Extra statements |
|---|---|---|---|
| `join fetch` in a query | one query | no | none |
| **entity graph** | **one execution** | **no** | **none** |
| `@BatchSize` | the whole application | yes | ⌈N/k⌉ |
| `@Fetch(SUBSELECT)` | the whole application | yes | 1 |
| `List` → `Set` | the whole application | **yes, semantically** | none |
| projection | one query | no | none |

The graph and the fetch join are the two entries that are both per-query and
model-neutral. The difference between them is entirely about *where the plan
lives* — in a string, or in a value you can build, name, compose and pass
around.

## What a graph does not fix

An entity graph produces **joins**. It is a more convenient way to express the
SQL shape a `join fetch` produces, not a different mechanism. So it inherits
every one of the fetch join's problems:

- Fetching one collection produces **duplicate parents** unless something
  de-duplicates them — [chunk 8c](08c-duplicate-parents-and-distinct.md).
- Fetching two collections produces a **Cartesian product**, and if both are bags
  it raises `MultipleBagFetchException` exactly as a query would —
  [chunk 8e](08e-multiplebagfetchexception.md).
- Combining it with pagination has the same history and the same Hibernate 7.4
  resolution — [chunk 8d](08d-pagination.md).

[Chunk 9h](09h-a-graph-is-still-a-join.md) works through all three with graphs
specifically, and it is why the graph is not the last fix in this part. When the
join *itself* is the problem, the answer is batch fetching ([chunk 10](10-batch-size.md)) or a projection ([chunk 12](12-projections-and-dtos.md)) — not a
different way of writing the join.

## The chunks that follow

| Chunk | What it settles |
|---|---|
| [9b](09b-applying-a-graph.md) | Building one, and the three ways to apply it |
| [9c](09c-named-entity-graphs.md) | `@NamedEntityGraph` and the objection to it |
| [9d](09d-hibernates-graph-syntax.md) | Hibernate's text syntax, the parser, merging |
| [9e](09e-subgraphs.md) | Nested graphs, key subgraphs, subtype subgraphs |
| [9e2](09e2-how-deep-a-graph-should-go.md) | What each level costs, and how deep to go |
| [9f](09f-fetchgraph-vs-loadgraph.md) | The two hint keys, and what the spec actually promises |
| [9g](09g-spring-data-entitygraph.md) | `@EntityGraph` on a repository method |
| [9h](09h-a-graph-is-still-a-join.md) | Duplicates, Cartesian products, pagination |

## Gotchas

**⚠️ Expecting a graph to change which rows come back — and assuming it cannot.**
A graph has no `where`, so it does not *restrict*: adding `lines` does not narrow
the result to orders that have lines. But do not turn that into "a graph can
never change the result set". The introduction guide says a graph passed to
`find()` "adds a **left** outer join", while the user guide's §12.6.1 worked
example of a fetch graph over a `@ManyToMany` shows **inner** joins in the
generated SQL. I could not reconcile those two statements from the documentation
alone, and an inner join silently drops parents whose collection is empty. Treat
join type as something to verify per query, not to assume —
[chunk 9h](09h-a-graph-is-still-a-join.md).

**⚠️ Assuming a graph overrides `FetchType.EAGER` downward.**
Under load semantics it explicitly does not; that is what "load graph" *means*,
and an `EAGER` association you did not list is still fetched. Under fetch
semantics the specification says unlisted attributes are treated as `LAZY` —
but the same section also permits the provider to fetch more anyway. If
*not* fetching something is a requirement, the reliable instrument is the mapping
([topic 07 chunk 12](../07-relationships-fetch/12-fetch-type-defaults.md)) or a
projection. See [chunk 9f](09f-fetchgraph-vs-loadgraph.md).

**⚠️ Putting a graph on a query that already contains a `join fetch`.**
Now there are two fetch plans for one statement and no rule a reader can apply to
know which wins. Pick one mechanism per query. If the query needs a fetch it can
only express as a join — a filtered join, a join to a derived path — that is a
signal the graph was the wrong tool for it, not an invitation to use both.

**⚠️ Reaching for a graph on a `@ManyToOne(optional = false)` and expecting a
saving.**
A mandatory to-one is frequently fetched by the initial select anyway, so listing
it may change nothing. It also cannot be made lazy without bytecode enhancement —
[topic 07 chunk 06b](../07-relationships-fetch/06b-why-lazy-one-to-one-fails.md).
Confirm the graph did work with a statement count
([chunk 6b](06b-asserting-the-count-in-a-test.md)) rather than assuming.

**⚠️ Treating a graph as a caching or performance feature.**
It is a fetch *plan*. It reduces round trips by widening one statement, which
means it widens the result set by the same act. On a to-one that is close to
free; on a collection it costs exactly what a `join fetch` costs.

**⚠️ Using a graph on a paginated collection fetch without checking the Hibernate
version.**
The graph is a join, so everything [chunk 8d](08d-pagination.md) says about
pagination applies unchanged — including that the answer genuinely changed in
7.4 and that most material written before it is stale.

**⚠️ Adding a graph to a query and never checking whether it took effect.**
Every application mechanism for graphs has a silent-failure mode: a mistyped hint
key is ignored, a stale attribute name may not be resolved until first use, and a
graph rooted at the wrong type does nothing useful. None of these throw where you
would notice. A graph is exactly the kind of change that should be covered by a
query-count assertion.

**⚠️ Using a graph where the real answer is "this endpoint should not load
entities".**
A graph that names four associations, three of them collections, is not a fetch
plan; it is a report specification wearing a fetch plan's clothes. The size of
the graph is a useful smell — past two or three nodes, ask whether the endpoint
wants a projection.

## Interview questions

**★ What is an entity graph, in one sentence?**
A declarative fetch plan rooted at one entity type, expressed as a tree of
attribute nodes and subgraphs, attached to a single `find()` or query execution,
overriding the mapping's fetch types for that execution only.

**★ How is it different from `join fetch`?**
Mechanically it is not — both become outer joins in the generated SQL.
Structurally the difference is large: a `join fetch` lives inside a query string,
so the fetch plan and the restriction are one artefact and vary together, which
produces a repository with one method per (query × plan) combination. A graph is
a value, so one query can run under many plans and one plan can apply to many
queries. It decouples *what you fetch* from *which rows you fetch*.

**★ Does an entity graph change the mapping?**
No, and that is its main virtue over the fixes in
[chunk 8e2](08e2-the-three-ways-out.md). `@BatchSize`, `@Fetch(SUBSELECT)`,
changing a `List` to a `Set`, switching a `FetchType` — all are permanent
statements about the entity that every query in the application inherits. A graph
is scoped to one execution, so the endpoint that needs the collection pays for
it, and the endpoint that does not, does not.

**★ Does an entity graph solve the N+1 problem?**
It solves the *expression* problem, which is the one that actually matters: it
lets a call site state exactly what its unit of work needs. It introduces no new
fetching mechanism — the SQL is a join — so everything true of a fetch join is
true of a graph: duplicate parents on a collection fetch, a Cartesian product
when two collections are fetched, `MultipleBagFetchException` when both are bags.

**★ What does the specification mean by "the default fetch graph"?**
The plan you already have without asking for one: "the transitive closure of all
of its attributes that are specified as `FetchType.EAGER` (or defaulted as
such)". It is worth quoting in an interview because of what it implies — fetch
types are not a fixed property of the entity, they are the graph that applies
when no other graph is supplied. That reframing is what makes per-query fetch
planning feel like the normal case rather than an override.

**★ Can a graph make Hibernate fetch *less* than the mapping says?**
In principle yes, under fetch-graph semantics, where the spec says unlisted
attributes are treated as `LAZY`. In practice the same section grants the
provider explicit permission to do more: "The persistence provider is permitted
to fetch additional entity state beyond that specified by a fetch graph or load
graph." So a graph is a reliable instrument for fetching *more* and an unreliable
one for fetching *less*. If not fetching something is a requirement — a `@Lob`,
an expensive association — put it in the mapping or use a projection.

**★ When would you not use one?**
When the query needs two collections, because that is a Cartesian product however
it is expressed. When the operation is read-only and the output is a response
body, because a projection is smaller, avoids the persistence context and cannot
be accidentally modified. And when the plan is genuinely fixed for one query,
because then a `join fetch` in the query text is shorter, obvious to read, and
validated by Hibernate's query parser at bootstrap — which a graph built from
strings is not.

**★ How would you explain the value of graphs to a team that already uses
`join fetch` everywhere and is happy?**
By counting their repository methods. Ask how many of them differ only in what
they fetch, and how many `where` clauses are duplicated across those. That number
is the cost the graph removes. If it is small, they are right to be happy —
`join fetch` is a fine tool and this is not a migration worth doing for its own
sake. The argument for graphs is a maintenance argument, not a performance one,
and it only wins when the multiplication has actually started.

**★ Is there a downside to graphs compared with `join fetch`?**
Two. A graph built from attribute-name strings is unchecked, so a rename breaks
it in a way the compiler cannot see, whereas a `join fetch` path is validated
when Hibernate parses the query. And a graph is one more layer of indirection at
the point of reading: the query says what rows, something else says what is
fetched, and understanding a slow endpoint means finding both. Neither is a
reason not to use them, but both are reasons to keep graphs close to their call
sites and to prefer the metamodel-typed builders.

---

← Prev: [8e4 · Ordering and the call sites](08e4-ordering-and-the-call-sites.md) · Index: [08 · The N+1 problem](README.md) · Next → [9b · Building and applying](09b-applying-a-graph.md)
