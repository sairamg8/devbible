---
title: "Nested walks multiply rather than add, writes have their own N+1, and the best-disguised case is a perfectly good query called once per element"
sidebar_label: "4b · Three more shapes"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.4 *Association fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 user guide §12 *Bulk operations* and §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Spring Data JPA 4.1 reference *JPA Query Methods → Modifying queries*
> ([docs.spring.io/spring-data/jpa/reference/](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**[Chunk 4](04-the-shapes-it-hides-in.md) covered the three shapes that come
from reading an association. These three come from somewhere else: nesting,
writing, and calling a good method too many times. The last of them is the one
that survives every ORM, every framework and every rewrite, because there is
nothing framework-specific about it at all.**

## Shape 4 · The N+1 inside another N+1

Nesting multiplies rather than adds, and this is where a page goes from slow to
unusable.

```java
for (Order o : orders.findAll()) {          // 1 query
    for (OrderLine l : o.getLines()) {      // N queries
        audit(l.getProduct().getName());    // N × M queries
    }
}
```

With 100 orders averaging 10 lines that is 1 + 100 + 1,000 statements. The
arithmetic is **1 + N + N·M**, and it compounds with every level of nesting. Any
recursive walk of an entity graph — a category tree, an org chart, a
bill-of-materials — is this shape by construction, and its statement count is the
size of the subtree.

## Shape 5 · The write-side N+1

Reads get all the attention, but the identical shape appears on writes and costs
more, because writes take locks.

```java
for (Long id : idsToArchive) {
    Order o = orders.findById(id).orElseThrow();   // one select per id
    o.setArchived(true);                           // one update per id at flush
}
```

That is N selects and then N updates. The reads are the N+1 you already know; the
writes are its mirror image. Both go away with a single bulk statement:

```java
@Modifying
@Query("update Order o set o.archived = true where o.id in :ids")
int archiveAll(@Param("ids") Collection<Long> ids);
```

⚠️ A bulk update bypasses the persistence context, so entities already loaded in
this session keep their stale state and no dirty checking or callbacks run. That
trade-off belongs to **Topic 06 · The JPA and Hibernate model** *(not written
yet)*; what belongs here is that the read half of this loop is N+1 by any
definition, and that a `findAllById(ids)` fixes it in one line if you do need
the entities.

## Shape 6 · The single-row query in a service method called per element

The most disguised of all, because the query is explicit and correct — it is
merely called too often.

```java
List<Report> rows = orderIds.stream()
        .map(id -> reportService.buildFor(id))     // each one runs its own queries
        .toList();
```

`buildFor` is a well-written method with a well-written query. Nothing about it
is wrong. It is simply being invoked once per element of a list, which is N+1
with the second query hand-written instead of proxy-generated. This is the form
that appears in hand-rolled JDBC and in every ORM ever written, and it is why the
Hibernate guide insists the problem "even affects typical handwritten JDBC code
behind DAOs".

**The tell is structural, not textual: any expression of the form
`collection.stream().map(x -> somethingThatQueries(x))`.** It does not matter
whether the query is a proxy initialisation, a repository call or a `JdbcClient`
statement — see [Topic 01 · JDBC](../01-jdbc/README.md) for what a round trip
costs at the level below.

## Gotchas

**⚠️ Treating the nested case as "the same bug, a bit worse".**
It is a different order of magnitude. `1 + N + N·M` is quadratic in the size of
the graph, and a two-level walk over a few hundred parents can issue tens of
thousands of statements. Nested loops over entities deserve a hard look every
time, and a recursive walk deserves a different design entirely — a recursive CTE
in SQL, which is the argument of **Topic 05 · SQL-first access** *(not written
yet)*.

**⚠️ Trying to fix a nested N+1 with two collection fetch joins.**
It is the natural instinct and it produces either a Cartesian product or an
outright exception. Fetching two collections in one query multiplies their rows
together, and if both are mapped as `List` without an `@OrderColumn` you get
`MultipleBagFetchException` instead — see
[chunk 8e](08e-multiplebagfetchexception.md). The nested case is where subselect
fetching ([11 · `@Fetch(SUBSELECT)`](11-subselect.md)) and batch fetching
([10 · `@BatchSize`](10-batch-size.md)) genuinely earn their place.

**⚠️ Missing the write-side version because you only look at `select`s.**
N loads followed by N updates at flush is the same pathology and holds row locks
while it happens, which makes it a contention problem as well as a latency one.
Count *statements*, not `select`s.

**⚠️ Replacing a write loop with a bulk update and not thinking about the
persistence context.**
A bulk `@Modifying` statement is executed straight against the database. The user
guide is explicit that its effect "is not reflected in the persistence context,
nor in the state of entity objects held in memory at the time the statement is
executed", so any entity you already loaded keeps its stale value, and no dirty
checking, versioning or entity callbacks run for those rows. That is usually
fine for an archive flag and usually wrong for anything with business logic
attached.

**⚠️ Assuming `findAllById` fixes the read half completely.**
It fixes the round trips — one query instead of N — but it does not fetch any
associations, so if the loop body dereferences one you have merely moved the
N+1 down a level. Combine it with an entity graph
([9 · Entity graphs](09-entity-graph.md)) when the loop body navigates.

**⚠️ Not recognising shape 6 because the query is well written.**
`buildFor(id)` may be a model of good data access. That is irrelevant: it is
being invoked once per element of a list, which is N+1 with the second query
hand-written rather than proxy-generated. The quality of the inner method is not
the variable; the number of times it is called is.

**⚠️ Assuming a `Stream`-returning repository method streams the associations
too.**
It does not. Streaming the parents keeps the parent result set open and still
initialises each association one at a time on access — so you get N+1 with the
additional hazard of a long-lived cursor and a persistence context that grows for
the whole traversal.

## Interview questions

**★ What is the statement count for a nested N+1, and why does that matter?**
It is `1 + N + N·M` — one query for the parents, N for each parent's collection,
and M more for each element of each of those collections. That is quadratic in
the depth of the walk rather than linear, so a two-level iteration over a few
hundred parents with a modest fan-out issues tens of thousands of statements. It
matters because the mental model people carry from the flat case — "a hundred
extra queries, annoying but survivable" — badly understates it, and because
recursive walks over trees (categories, org charts, bills of materials) have this
shape by construction, with a statement count equal to the size of the subtree.
It also matters because the obvious fix does not work: you cannot simply
fetch-join both levels of collection, since two collection fetches in one query
produce a Cartesian product.

**★ Does N+1 happen on writes?**
Yes, and it is easy to miss because people grep for `select`. Loading entities
one at a time by id in a loop gives N selects, and modifying each one gives N
updates at flush — the same arithmetic, with the added cost that the updates take
row locks and hold them until commit, so it is a contention problem as well as a
latency one. The read half is fixed by loading the batch in one query with
`findAllById`; the whole thing is often better replaced by a single bulk
`@Modifying` JPQL update. The caveat is real, though: a bulk statement is not
reflected in the persistence context, so already-loaded entities keep stale
state, and no dirty checking, optimistic-lock version bump or entity callback
runs for the affected rows.

**★ Why is the per-element service call the hardest shape to see?**
Because every part of it is defensible in isolation. The inner method contains an
explicit, well-written, efficient query — often better than what a proxy would
have generated. The outer expression is an ordinary `stream().map()`. There is no
lazy loading involved, no mapping to inspect, and nothing framework-specific to
blame, so none of the usual N+1 heuristics fire. It is also the shape that
survives migrating away from JPA entirely: rewrite the whole layer in
`JdbcClient` and this one comes with you, which is the concrete sense in which
the Hibernate guide's claim that N+1 "even affects typical handwritten JDBC code
behind DAOs" is true. The only reliable detector is structural: an expression of
the form `collection.stream().map(x -> somethingThatQueries(x))`.

**★ How would you fix a recursive walk over a category tree?**
Not with any of the JPA fetch strategies, because none of them can express
"follow this association to arbitrary depth" — an entity graph has a fixed shape,
a fetch join has a fixed number of joins, and batch fetching still costs one
round trip per level. What actually fits is a recursive common table expression
in SQL, which walks the whole tree in a single statement and returns it as a flat
result you can assemble in memory. Hibernate 7 supports CTEs in HQL directly, and
a plain SQL query through `JdbcClient` is often simpler still. This is the
clearest case in the whole topic where the right answer is to leave the object
graph behind and write a query, which is what
[Topic 05 · SQL-first access](../05-sql-first-access/README.md) argues in general.

**★ You replaced a loop of `findById` with `findAllById`. Are you done?**
Only if the loop body does not navigate. `findAllById` collapses N primary-key
lookups into a single query with an `in` list, which removes the N you started
with — but the entities it returns have the same lazy associations as before, so
any dereference inside the loop reintroduces N+1 one level down. The complete fix
is `findAllById` plus an explicit fetch plan for whatever the body touches, via
an entity graph on the repository method. This is a good illustration of the
general rule that fixing N+1 means enumerating what the unit of work needs, not
applying one mechanical substitution.

---

← Prev: [4 · The shapes it hides in](04-the-shapes-it-hides-in.md) · Index: [08 · The N+1 problem](README.md) · Next → [4c · Serialisation and logging](04c-serialization-and-logging.md)
