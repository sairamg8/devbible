---
title: "Depth along to-ones is nearly free and breadth across collections is not, so the number of plural nodes at one level predicts a graph's cost better than its size does"
sidebar_label: "9e2 · How deep to go"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.6.1 *Jakarta
> Persistence (key) subgraphs* (the worked SQL for a two-level graph) and §12.5
> *Dynamic fetching via JPQL*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> *A Short Guide to Hibernate 7* §8.6 *Join fetching*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Jakarta Persistence 3.2 specification §3.8.1
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Nothing in the specification limits a graph's depth, and the number people
quote — two levels — is a rule of thumb with nothing behind it. The measurable
rule is different and more useful: a graph's cost is driven by how many *plural*
nodes sit at any one level, not by how many nodes it has or how deep it goes.**

## The arithmetic

Every node in the graph becomes a join.

| Plan | Joins added | Rows returned |
|---|---|---|
| `customer` | 1 | 1 per order |
| `customer, billingAddress` | 2 | 1 per order |
| `lines` | 1 | 1 per line |
| `lines(product)` | 2 | 1 per line |
| `lines(product(supplier(country)))` | 4 | 1 per line |
| `lines, shipments` | 2 | lines **×** shipments |

Read the third column, not the second. Depth along **to-one** associations adds
joins and columns and nothing else — the row count is still driven by the widest
collection in the plan. Breadth across **collections at the same level**
multiplies.

So `lines(product(supplier(country)))` is a wide, cheap statement: four joins,
one row per order line, and one extra copy of each supplier and country column
per line. `lines, shipments` is nine characters and a Cartesian product. The
notation makes the cheap one look expensive and the expensive one look trivial,
which is exactly backwards.

## Why depth is nearly free and breadth is not

A to-one join adds at most one matching row per row already in the result, so the
cardinality does not change. A to-many join multiplies: each parent row becomes
as many rows as it has children. Two to-many joins at the same level multiply
against each other, because the database has no reason to relate the two child
sets — every line pairs with every shipment.

That is the Cartesian product [chunk 8e](08e-multiplebagfetchexception.md) is
about, and the introduction guide's §8.6 states it as the one case where its own
join-first advice stops applying: join fetching "becomes inefficient … when we
fetch two many-valued associations in parallel", because "joining both
collections in a single query would result in a cartesian product of tables, and
a large SQL result set".

**A graph does not change any of this.** It is a different notation for the same
joins, which is [chunk 9h](09h-a-graph-is-still-a-join.md).

## What depth does cost

Not rows, but three real things:

- **Column width.** Every level adds that entity's columns to every row of the
  result. Four levels of moderately wide entities is a wide row multiplied by the
  line count, and it is transferred and parsed in full. A `@Lob` anywhere in
  those four levels is transferred per row.
- **Plan complexity.** A four-way join has more join orders for the planner to
  consider than a two-way one, and more chances to pick badly on skewed data.
- **Persistence-context size.** Every entity fetched is managed, so it is
  snapshotted for dirty checking and lives until the context closes —
  [topic 06 chunk 11](../06-jpa-hibernate-model/11-the-persistence-context.md).
  A graph that loads four levels of an order loads four levels of *every* order
  the query returned.

The third is the one that surprises people, because it is invisible in the SQL. A
read-only endpoint that fetches deeply is paying for change tracking on data it
will never modify, which is one of the arguments for a projection.

## The signal that a graph has gone too deep

Not a number. This question:

> **What response is this graph the shape of?**

If the answer is a nested JSON document — an order, with its lines, with their
products, with their suppliers — the graph is standing in for a query. A
projection would say the same thing in one flat statement, returning the ten
columns the response actually contains instead of every column of four entities,
with no persistence context and no dirty checking (**chunk 12**, *not written
yet*).

If the answer is "the fields this business operation needs in order to decide
something", the graph is doing its job however deep it is.

## A worked comparison

Consider an invoice endpoint. The response contains the order number, the
customer's name, and for each line the product name and the line total.

```java
// Plan A — graph, four levels
"customer, lines(product(supplier))"
```

Fetches every column of `Order`, `Customer`, `OrderLine`, `Product` and
`Supplier` for every line, manages all of them, and gives the response layer four
fields out of perhaps forty columns.

```java
// Plan B — projection
@Query("""
    select new com.example.InvoiceLine(
        o.number, c.name, p.name, l.quantity * l.unitPrice)
    from Order o
      join o.customer c
      join o.lines l
      join l.product p
    where o.id = :id
    """)
List<InvoiceLine> invoice(@Param("id") Long id);
```

Same joins, four columns, no entities, no persistence context. Plan A is right if
something downstream is going to *modify* the order. Plan B is right if the
output is a document, which for an endpoint called "invoice" it is.

**The graph is not the wrong tool because it is deep. It is the wrong tool
because the operation was read-only.** Depth is just what made that obvious.

## Gotchas

**⚠️ Two plural nodes at the same level.**
The expensive shape, and the notation hides it — `"lines, shipments"` is nine
characters and a Cartesian product. Count plural nodes per level. That count, not
the depth and not the node total, is what predicts the row count.

**⚠️ Reading a deep graph as evidence of a well-planned fetch.**
A four-level graph is more often evidence that somebody kept adding nodes until
the `LazyInitializationException`s stopped. The tell is that the deepest nodes
have no visible relationship to the endpoint's output. Ask what the response
looks like before assuming the plan was designed rather than accumulated.

**⚠️ Forgetting that a `@Lob` several levels down is fetched per row.**
A graph that reaches a `Product` with a `@Lob description` transfers that blob
once per **line**, not once per product, because the join produces one row per
line. The persistence context de-duplicates the *entities*; the network does not
de-duplicate the *bytes*. See
[chunk 4e](04e-lazy-columns-and-hashcode.md) and
[topic 06 chunk 05b](../06-jpa-hibernate-model/05b-lobs-and-large-columns.md).

**⚠️ Adding a level to a graph without checking what the level is *made of*.**
"One more join" is a fair description of adding `product`, and a wrong one if
`Product` has thirty columns, an embeddable, and two eager to-ones of its own —
which are pulled in too, because the default fetch graph of the target entity
applies to any attribute you list without a subgraph. One node can be five joins.

**⚠️ Assuming the persistence-context cost is proportional to the response.**
It is proportional to what was *fetched*. A deep graph on a hundred-row page
manages several hundred entities, every one snapshotted for dirty checking, none
of which appears in the response beyond a field or two.

**⚠️ Using graph depth to avoid writing a query.**
It works, which is the problem. A four-level graph on a repository's `findById`
is easier to write than a projection query and it hides the same complexity
somewhere a reviewer will not see it. The projection has the cost written on its
face; the graph has it in a string.

**⚠️ Growing a shared named graph one node at a time.**
Each addition is cheap for the person making it and permanent for everyone
else — the union of all callers' needs is nobody's plan
([chunk 9c](09c-named-entity-graphs.md)). Depth in a *shared* graph is worse than
depth in a call-site graph for exactly this reason.

**⚠️ Measuring the fix by the disappearance of the lazy-loading exception.**
That is the same error as measuring the `Set` fix by the disappearance of
`MultipleBagFetchException` ([chunk 8e2](08e2-the-three-ways-out.md)). The
exception going away tells you the association is initialised; it says nothing
about how many rows or columns it cost. Count statements *and* look at the row
count — [chunk 6](06-count-do-not-read.md).

**⚠️ Treating "two levels" as a rule.**
It is a heuristic with nothing in the specification behind it, and it is wrong in
both directions: a five-level to-one chain can be perfectly reasonable, and a
one-level plan naming two collections can be a disaster. Use the plural-node
count and the response-shape question instead.

## Interview questions

**★ How deep should an entity graph go?**
There is no limit in the specification and "two levels" is folklore. The useful
rule is about breadth, not depth: count the **plural** nodes at each level. Depth
along to-one associations adds joins and columns but does not change the row
count; two collections at the same level multiplies rows, and if both are bags it
raises `MultipleBagFetchException`. So `lines(product(supplier))` is cheap and
`lines, shipments` is expensive, even though the second is shorter.

**★ What does depth actually cost, if not rows?**
Three things. Column width — every level's columns appear on every row of the
result, so a `@Lob` four levels down is transferred once per line rather than
once per entity. Planner complexity — more join orders to consider and more
chances to pick badly. And persistence-context size, which is the one people miss:
every entity fetched is managed and snapshotted for dirty checking and lives
until the context closes, so a deep graph on a hundred-row page manages several
hundred entities whose only contribution to the response is one field each.

**★ What does a very deep graph usually indicate?**
That the endpoint is building a document rather than loading an aggregate. An
order with its lines with their products with their suppliers is a report shape,
and a report is a query — a flat projection returning the columns the response
contains, with no persistence context and no dirty checking. The review question
that surfaces this is "what response is this graph the shape of?"; if the answer
is nested JSON, the graph is standing in for a query that would be smaller,
cheaper and more obvious.

**★ Is a graph with one node ever expensive?**
Yes, in two ways. If that node is a collection with high fan-out, one node is one
join and a large result set. And listing an attribute without a subgraph fetches
the target's *default* fetch graph — the transitive closure of its `EAGER`
attributes — so a single node on an entity that has two eager to-ones of its own
is really three joins. Node count is a poor proxy for join count.

**★ Two endpoints need overlapping plans. Do you share one graph?**
Only if the overlap is exact. Sharing a graph makes each caller pay for the
other's needs, and shared graphs grow monotonically because adding a node is free
for the person adding it. The composable alternative is several small graphs
merged at the call site with `EntityGraphs.merge`
([chunk 9d](09d-hibernates-graph-syntax.md)), which keeps the cost visible where
it is incurred.

**★ How would you review a pull request that deepens an existing graph?**
Ask three things. What in the response needs the new node — if the answer is "a
`LazyInitializationException`", the plan is being accumulated rather than
designed. Is the new node plural, and is there already a plural node at that
level. And what does the new node drag in by default, since an attribute listed
without a subgraph brings the target's whole default fetch graph. Then ask
whether the endpoint modifies anything; if it does not, the honest change is a
projection.

---

← Prev: [9e · Subgraphs](09e-subgraphs.md) · Index: [08 · The N+1 problem](README.md) · Next → [9f · fetchgraph vs loadgraph](09f-fetchgraph-vs-loadgraph.md)
