---
title: "An entity graph is a notation for joins, so every failure mode of the fetch join arrives with it — including two the documentation does not settle"
sidebar_label: "9h · A graph is still a join"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.6 and §12.6.1
> (including the generated SQL in the worked subgraph example)
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> *A Short Guide to Hibernate 7* §5.7 and §8.6
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> *A Guide to Hibernate Query Language* §4.3.1 *Duplicate removal*
> ([docs.hibernate.org/orm/7.4/querylanguage](https://docs.hibernate.org/orm/7.4/querylanguage/html_single/Hibernate_Query_Language.html))
> and the Jakarta Persistence 3.2 specification §3.8.1
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Entity graphs are a better *notation*. They are not a better *mechanism*. The
SQL a graph produces is the SQL a `join fetch` produces, so duplicate parents,
Cartesian products, `MultipleBagFetchException` and the pagination problem all
arrive unchanged — and two questions that a `join fetch` answers plainly, the
documentation does not answer for graphs at all.**

## The claim, stated precisely

The introduction guide, §5.7, on passing a graph to `find()`:

> *"This code adds a left outer join to our SQL query, fetching the associated
> `Publisher` along with the `Book`."*

And, for an extra level: *"This results in a SQL query with four left outer
joins."*

So: one node, one join. That is the whole mechanism. Everything else in this
chunk follows from it, and none of it is a criticism of graphs — it is a
correction to the belief, which is common, that switching from `join fetch` to a
graph is a *performance* change. It is a maintainability change with identical
SQL.

## Duplicate parents

A collection node produces one row per child, so the parent's columns repeat.
[Chunk 8c](08c-duplicate-parents-and-distinct.md) is the full treatment, and its
headline applies here too: **since Hibernate 6, do not write `distinct`** — the
HQL guide says duplicate results from `join fetch` "are automatically removed by
Hibernate in memory" and that "`distinct` should not be used for this purpose".

⚠️ **One thing I could not verify.** That guarantee is worded specifically about
"the use of `join fetch`". Whether the same automatic in-memory de-duplication
applies when the fetch was requested by an **entity graph** rather than by HQL
text is not stated in the Hibernate 7.4 documentation I could find, and I am not
prepared to assert it either way. The check is three lines and costs nothing:

```java
var graph = session.createEntityGraph(Order.class);
graph.addPluralSubgraph(Order_.lines);
List<Order> orders = session.createSelectionQuery("from Order", Order.class)
        .setEntityGraph(graph, GraphSemantic.LOAD)
        .getResultList();
assertThat(orders).doesNotHaveDuplicates();   // ← run it on your version
```

If it fails, the fix is a `Set` return type or a de-duplication in the mapper —
**not** `distinct`, which on Hibernate 6+ sends a real `DISTINCT` to the database
for nothing.

## Inner or outer? The documentation says both

This one matters, because the two joins are not interchangeable: an **inner** join
drops parents whose collection is empty, which is a change to the result set, not
to fetching.

- The introduction guide §5.7, quoted above: a graph "adds a **left** outer
  join".
- The user guide §12.6.1's worked example applies a `fetchgraph` to a `Project`
  with a `@ManyToMany List<Employee> employees` and an employee `department`, and
  prints the generated SQL as **three inner joins**:

  ```sql
  from Project p
  inner join Project_Employee p_e on p.id = p_e.projects_id
  inner join Employee e          on p_e.employees_id = e.id
  inner join Department d        on e.department_id = d.id
  ```

🔴 **I could not reconcile these two statements from the 7.4 documentation
alone.** Plausible explanations exist — the example may predate a change, or the
join type may depend on optionality, on the association kind, or on the graph
semantic — but "plausible" is not "verified", and this is exactly the kind of
claim that gets repeated wrongly.

**What to do about it, which does not depend on resolving it:** if the query must
return parents with empty collections, prove that it does. One test row with no
children, one assertion that it comes back. That test is worth having regardless
of which join type your version emits, because it also protects you against
somebody later "optimising" the graph into an inner join deliberately.

## Cartesian products and `MultipleBagFetchException`

Two collection nodes at the same level multiply, and if both map to bags,
Hibernate raises `MultipleBagFetchException` — from a graph exactly as from a
query. The graph notation makes this *easier* to write by accident, because
`{"lines", "shipments"}` is nineteen characters and the corresponding HQL is two
`left join fetch` clauses you would have had to type out.

Everything in [chunk 8e](08e-multiplebagfetchexception.md) and
[chunk 8e2](08e2-the-three-ways-out.md) applies without modification. In
particular, the `Set` "fix" is the same trap here: it silences the exception and
ships the product.

The graph-specific discipline is the one from
[chunk 9e2](09e2-how-deep-a-graph-should-go.md): **count plural nodes per level**,
not nodes.

## Pagination

A graph with a collection node plus a `Pageable` or `setMaxResults` is a
paginated collection fetch join. [Chunk 8d](08d-pagination.md) is the full
account, including that Hibernate 7.4 genuinely fixed it and that nearly
everything written before 7.4 is now stale.

Two graph-specific notes:

- The one-line-annotation problem. Adding
  `@EntityGraph(attributePaths = "lines")` to an existing
  `Page<Order> findAll(Pageable)` is a smaller-looking change than rewriting the
  query with a `join fetch`, and it has the same cost.
- The warning to grep for is the message text, not the code:
  `firstResult/maxResults specified with collection fetch`. The code was
  renumbered between Hibernate 5 and 6, so grepping `HHH000104` on a modern
  version finds nothing and proves nothing.

## When the join is the problem

If the query is a Cartesian product, no notation for the join fixes it. The
options that change the *mechanism* rather than the notation are:

| Instead of a graph | What it does | Chunk |
|---|---|---|
| `@BatchSize` | N → ⌈N/k⌉ statements, no product | [chunk 10](10-batch-size.md) |
| `@Fetch(SUBSELECT)` | one extra statement, no product | [chunk 11](11-subselect.md) |
| projection | no entities, no product, fewest columns | [chunk 12](12-projections-and-dtos.md) |
| fetch profile | a named, session-scoped plan that *can* request subselect | [chunk 13](13-fetch-profiles.md) |

The last row is the one people miss: a fetch profile can select subselect
fetching for an association, and an entity graph cannot express that at all — a
graph says *what*, never *how*.

## Gotchas

**⚠️ Believing a graph is faster than the equivalent `join fetch`.**
It is the same SQL. If a migration from `join fetch` to graphs changed a timing,
something else changed too — the plan gained or lost a node, or the semantic
changed from load to fetch, or a `distinct` was dropped. Find that, rather than
attributing it to the notation.

**⚠️ Assuming Hibernate 6's automatic duplicate removal covers graph-driven
fetches.**
The HQL guide's wording is about `join fetch`. I could not confirm it extends to
graphs. Assert it on your version rather than assuming, and if it does not hold,
use a `Set` return type — not `distinct`.

**⚠️ Assuming the graph's join is an outer join.**
The introduction guide says left outer; the user guide's worked example prints
inner joins. Whichever your version emits, an inner join silently drops parents
with empty collections, so a query whose contract includes "orders with no lines
still appear" needs a test that says so.

**⚠️ Writing `distinct` alongside a graph out of habit.**
On Hibernate 6+ the keyword's "only effect is to add `distinct` to the generated
SQL", which makes the database do real de-duplication work on a wide, already
de-duplicated result. It is a cost with no benefit, and it is more likely to
appear beside a graph than beside a `join fetch`, because the graph came from a
tutorial and the `distinct` came from a different one.

**⚠️ Two collection paths in an `attributePaths` array.**
The most compact way to write a Cartesian product in the entire JPA API. Count
plural nodes per level before adding one.

**⚠️ Adding a graph to a paginated method without re-reading the query.**
The annotation is one line; the consequence is a paginated collection fetch. On
Hibernate below 7.4 the cost is proportional to the whole matching set, not to
the page.

**⚠️ Reaching for a graph when the fix needed is a different mechanism.**
If the endpoint needs two collections, the answer is batching, subselect, or two
queries — not a cleverer graph. Graphs express *what to fetch*; they cannot
express *how*, which is precisely why fetch profiles still exist
([chunk 13](13-fetch-profiles.md)).

**⚠️ Testing a graph only for "did the association load".**
That test passes for a plan that also produced a hundred thousand rows. Assert
the statement count *and* look at the row count —
[chunk 6](06-count-do-not-read.md) — because the graph's whole risk profile is on
the row side, not the statement side.

**⚠️ Migrating every `join fetch` to a graph as a cleanup task.**
The migration is neutral on SQL and negative on one thing: a `join fetch` path is
validated when Hibernate parses the query, and a graph built from strings is not.
Migrate where the multiplication of repository methods is actually hurting; leave
the rest alone.

## Interview questions

**★ Is an entity graph faster than a `join fetch`?**
No. It is the same SQL — the introduction guide describes a graph as adding "a
left outer join to our SQL query" per node. The benefit is structural: the plan is
a value rather than part of a query string, so one query can carry many plans and
the repository stops multiplying. Anyone reporting a performance difference from
the migration alone has changed something else at the same time.

**★ Do you still need `distinct` with an entity graph?**
On Hibernate 6 and later you should not write `distinct` for duplicate removal at
all — the HQL guide says duplicates from `join fetch` "are automatically removed
by Hibernate in memory" and that "`distinct` should not be used for this
purpose", since its only remaining effect is to put a real `DISTINCT` in the SQL.
⚠️ I would add honestly that the guarantee is worded about `join fetch`, and I
could not confirm from the 7.4 docs that it covers graph-driven fetches; the
answer is to assert it in a test on your version, and if duplicates appear, use a
`Set` return type rather than the keyword.

**★ Does a graph produce an inner or an outer join?**
The introduction guide says a graph passed to `find()` "adds a left outer join".
The user guide's §12.6.1 worked example of a fetch graph over a `@ManyToMany`
shows inner joins in the generated SQL. I could not reconcile those from the
documentation, so I would not state a rule — I would write a test asserting that
a parent with an empty collection still comes back, because that is the only
consequence that matters and it is cheap to pin down.

**★ Can a graph raise `MultipleBagFetchException`?**
Yes. Two collection nodes at the same level are two collection fetch joins, and
if both map to bags the exception is the same one, for the same reason. The graph
form makes it easier to write by accident, because two collection paths in an
`attributePaths` array look much smaller than two `left join fetch` clauses.

**★ How does a graph interact with pagination?**
Exactly as a fetch join does. A collection node plus a limit is a paginated
collection fetch: safe on Hibernate 7.4 and later, and applied in memory after
fetching every matching row below that. The Spring Data form is the dangerous one
in practice, because adding `@EntityGraph(attributePaths = "lines")` to an
existing `Page` method is a one-line change that nobody re-reviews.

**★ What can a fetch join or a fetch profile do that a graph cannot?**
A `join fetch` can carry a restriction on the joined path — a filtered join —
which a graph cannot express at all, since a graph has no `where`. A fetch
profile can request *subselect* fetching for an association; a graph specifies
what to fetch and never how, so it has no way to say "fetch this one with a
second statement instead of a join". That is a real gap, and it is why
[chunk 13](13-fetch-profiles.md) is not redundant.

**★ When is the right move to stop using a graph entirely?**
When the join is the problem rather than the notation: two collections, a large
fan-out, or an endpoint that is producing a document rather than loading an
aggregate. Then the answer changes mechanism — batch fetching, subselect
fetching, or a projection — and no rearrangement of nodes will help, because
every rearrangement is still one statement with a join in it.

---

← Prev: [9g · Spring Data @EntityGraph](09g-spring-data-entitygraph.md) · Index: [08 · The N+1 problem](README.md) · Next → [10 · @BatchSize](10-batch-size.md)
