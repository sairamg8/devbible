---
title: "The difference between fetchgraph and loadgraph is what happens to attributes you did not list, and the specification permits the provider to ignore it in one direction"
sidebar_label: "9f · fetchgraph vs loadgraph"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §3.8.1
> *Use of Entity Graphs in find and query operations*, §3.8.1.1 *Fetch Graph
> Semantics* and §3.8.1.2 *Load Graph Semantics*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 user guide §12.6
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.graph.GraphSemantic` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/graph/GraphSemantic.html)),
> and *A Short Guide to Hibernate 7* §5.7 and §11.3 *Bytecode enhancement*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Data JPA 4.1.0.

**Both hint keys make the attributes you list `EAGER`. They differ only in what
happens to the attributes you did **not** list: a fetch graph says those become
`LAZY` regardless of the mapping, a load graph says they keep whatever the
mapping gave them. And the same specification section that draws the distinction
then permits the provider to fetch more than either graph asked for — which is
why "Hibernate ignores `fetchgraph`" has been a live complaint for a decade and
is not, technically, a violation.**

## The two keys

```java
query.setHint("jakarta.persistence.fetchgraph", graph);   // fetch semantics
query.setHint("jakarta.persistence.loadgraph",  graph);   // load semantics
```

or, typed, on Hibernate:

```java
query.setEntityGraph(graph, GraphSemantic.FETCH);
query.setEntityGraph(graph, GraphSemantic.LOAD);
```

The graph object is identical. Only the interpretation changes.

## What the specification says

§3.8.1.1, on **fetch** semantics:

> *"When the `jakarta.persistence.fetchgraph` property is used to specify an
> entity graph, attributes that are specified by attribute nodes of the entity
> graph are treated as `FetchType.EAGER` and attributes that are not specified
> are treated as `FetchType.LAZY`."*

§3.8.1.2, on **load** semantics:

> *"…attributes that are specified by attribute nodes of the entity graph are
> treated as `FetchType.EAGER` and attributes that are not specified are treated
> according to their specified or default `FetchType`."*

Both sections add that primary key and version attributes "never need to be
specified" and are always fetched.

| | listed attributes | unlisted attributes |
|---|---|---|
| `fetchgraph` | `EAGER` | **forced `LAZY`** |
| `loadgraph` | `EAGER` | mapping's own `FetchType` |

Hibernate's own restatement, user guide §12.6, is blunter: fetch graph means
unlisted attributes "will **ALWAYS** be treated as `FetchType.LAZY`"; load graph
means they "use their static mapping specification".

## The escape clause that makes fetch semantics advisory

Immediately before those two subsections, §3.8.1 says:

> *"The persistence provider is permitted to fetch additional entity state beyond
> that specified by a fetch graph or load graph. It is required, however, that
> the persistence provider fetch all state specified by the fetch or load
> graph."*

🔴 **Read that carefully. Over-fetching is legal; under-fetching is not.**

So a graph is a **floor**, never a ceiling. `fetchgraph`'s promise that unlisted
attributes become `LAZY` is a promise the provider may decline to keep, and
declining is conformant. This is the single most important sentence in the entity
graph specification and it is almost never quoted, which is why the internet
argument about whether Hibernate "implements `fetchgraph` correctly" has never
resolved: the behaviour people complain about is permitted.

## What Hibernate 7.4 documents

`GraphSemantic.FETCH`: *"Attributes not explicitly specified are treated as
`FetchType.LAZY` and are not fetched."*

`GraphSemantic.LOAD`: *"Attributes not explicitly specified are treated as
`FetchType.LAZY` or `FetchType.EAGER` depending on the mapping of the attribute,
instead of forcing `FetchType.LAZY`."*

That is Hibernate stating it implements the distinction as written. ⚠️ **I could
not verify from the 7.4 documentation what Hibernate does in the cases where
forcing `LAZY` is structurally impossible**, and there are at least two of those —
see the next section. The documentation states the intent; it does not enumerate
the exceptions. Where this matters to you, the honest procedure is to check the
statement count for your mapping rather than to trust either the docs or a blog.

## Two places `fetchgraph` cannot deliver

**A lazy basic attribute without bytecode enhancement.** The introduction guide
is explicit about `@Basic(fetch = FetchType.LAZY)`:

> *"Without the bytecode enhancer, this instruction is ignored, and the field is
> always fetched immediately, as part of the initial select that retrieves the
> `Book` entity."*

If a mapped-lazy field is fetched eagerly without enhancement, a *graph*-imposed
laziness has no mechanism either. Leaving a `@Lob` out of a fetch graph does not
stop it being selected on an unenhanced entity.

**A to-one that cannot be proxied.** Lazy to-one fetching depends on a proxy, and
the user guide notes the class must be non-final with non-final accessors, or
implement an interface, for that to work; interception-based lazy loading needs
enhancement and still requires a proxy for polymorphic associations. A `@OneToOne`
with `optional = false` on the inverse side is the classic case that cannot be
lazy at all — [topic 07 chunk 06b](../07-relationships-fetch/06b-why-lazy-one-to-one-fails.md).

In both cases the attribute is fetched whether or not the graph names it, and the
specification's permission to "fetch additional entity state" is what makes that
conformant rather than a bug.

## Why it usually does not matter

The introduction guide's §5.7 gives the resolution, and it is worth internalising
because it dissolves the whole question:

> *"You're right, the names make no sense. But don't worry, if you take our
> advice, and map your associations `fetch=LAZY`, there's no difference between a
> 'fetch' graph and a 'load' graph, so the names don't matter."*

That is exact. If every association is `LAZY`, then "unlisted attributes are
`LAZY`" and "unlisted attributes keep their mapping" describe the same set. The
distinction only has teeth in a codebase that has `EAGER` mappings — and an
`EAGER` mapping is the thing [topic 07 chunk 12](../07-relationships-fetch/12-fetch-type-defaults.md)
and [chunk 16](16-eager-is-not-a-fix.md) argue against for
independent reasons.

**So the practical rule is: map everything lazy, and then stop caring which key
you use.** If you cannot map everything lazy, use `fetchgraph` and verify, rather
than assuming it un-fetches anything.

## The defaults nobody chose

Three defaults you will meet without deciding:

- **`find(graph, id)` is always LOAD.** No parameter changes it. The
  specification's javadoc says "interpreting the `EntityGraph` as a load graph",
  and the introduction guide states it as a rule.
- **Spring Data's `@EntityGraph` defaults to `FETCH`.** Its javadoc: `type`
  "defaults to `EntityGraph.EntityGraphType.FETCH`". So the same graph applied
  through a repository method and through `find()` is interpreted **differently**
  unless you say otherwise — [chunk 9g](09g-spring-data-entitygraph.md).
- **A hint you mistype is neither.** `setHint` ignores unrecognised keys, so a
  typo silently gives you the default graph — the mapping's own — which looks
  like load semantics and is not a graph at all.

## Gotchas

**⚠️ Assuming `fetchgraph` will stop something being fetched.**
It is a request, and §3.8.1 permits the provider to fetch more. Use it to state
what you need, never to prevent something expensive from loading. If not loading
a column or association is a requirement, the instruments are the mapping,
bytecode enhancement, or a projection.

**⚠️ Quoting a blog about Hibernate "not implementing `fetchgraph` properly".**
Most of that material predates Hibernate 6, and all of it argues against a
promise the specification never made unconditionally. The 7.4 `GraphSemantic`
javadoc states the intended behaviour plainly; where reality diverges it does so
in the direction the spec allows. Check your own statement counts instead.

**⚠️ Mixing the two keys on the same query.**
Setting both hints is not defined to do anything sensible, and nothing warns you.
One of them wins and which one is not something to discover in production. Set
one, and prefer `setEntityGraph(graph, semantic)` where the semantic is an enum
parameter and cannot be set twice.

**⚠️ Expecting `find(graph, id)` to give you fetch semantics.**
It cannot. If you specifically need fetch semantics you must go through a query
with a hint or `setEntityGraph`, which for a lookup by id means writing
`select o from Order o where o.id = :id` — a query you did not want, for a
distinction that probably does not matter if your mappings are lazy.

**⚠️ Not noticing that Spring Data and `find()` disagree by default.**
`@EntityGraph` defaults to `FETCH`, `find(graph, id)` is always `LOAD`. On a
fully-lazy model these coincide. On a model with any `EAGER` association they do
not, and the same plan produces different SQL depending on which door you came
through.

**⚠️ Using `fetchgraph` to "turn off" an `EAGER` association and then relying on
it.**
Even if it works in your Hibernate version today, you are relying on behaviour
the specification declines to guarantee, in a place where a version upgrade can
change it silently and the only symptom is a slower endpoint. Fix the mapping.

**⚠️ Leaving a `@Basic(fetch = LAZY)` column out of a fetch graph and believing
it is not selected.**
Without bytecode enhancement the mapping itself is ignored — the guide says the
field "is always fetched immediately, as part of the initial select". A graph
cannot impose laziness that the runtime has no mechanism to implement.

**⚠️ Reading "the default fetch graph" as "nothing is fetched".**
It is the transitive closure of the `EAGER` attributes, which on a badly-mapped
entity is most of the schema. Load semantics *keep* that, so applying a load
graph to an entity with eager associations adds to a plan that was already wide.

**⚠️ Treating the choice as a performance decision.**
It is a semantics decision with a performance side effect that is zero on a
lazily-mapped model. If choosing between the keys visibly changes your query
plan, that is information about your mappings, not about the keys — go and read
[topic 07 chunk 12](../07-relationships-fetch/12-fetch-type-defaults.md).

## Interview questions

**★ What is the difference between `jakarta.persistence.fetchgraph` and
`jakarta.persistence.loadgraph`?**
Only what happens to attributes the graph does **not** name. Both make the listed
attributes `EAGER`. Under fetch semantics the spec says unlisted attributes "are
treated as `FetchType.LAZY`", regardless of the mapping; under load semantics
they "are treated according to their specified or default `FetchType`". Primary
key and version attributes are always fetched under both and never need to be
listed.

**★ Does Hibernate honour fetch semantics?**
It documents that it does — `GraphSemantic.FETCH`'s javadoc says unlisted
attributes "are treated as `FetchType.LAZY` and are not fetched". But the
specification, in the same section that defines the two semantics, says "the
persistence provider is permitted to fetch additional entity state beyond that
specified by a fetch graph or load graph", so over-fetching is conformant and a
fetch graph is a **floor, not a ceiling**. There are at least two structural
cases where forcing laziness is impossible anyway — an unenhanced
`@Basic(fetch = LAZY)`, and a to-one that cannot be proxied — and I would not
rely on fetch semantics to prevent a load in either.

**★ So when does the distinction actually matter?**
Only when some association is mapped `EAGER`. The Hibernate introduction guide
says so directly: "if you take our advice, and map your associations
`fetch=LAZY`, there's no difference between a 'fetch' graph and a 'load' graph".
On a fully lazy model the two keys describe the same set of attributes. If the
choice visibly changes your SQL, that is a fact about your mappings.

**★ Which semantic does `find(graph, id)` use?**
Load, always. The JPA 3.2 javadoc for that overload says it interprets the graph
as a load graph and there is no option to change it. If you need fetch semantics
for a lookup by id you have to write it as a query and use a hint or
`setEntityGraph`.

**★ What does Spring Data's `@EntityGraph` default to?**
`EntityGraphType.FETCH` — its javadoc says the `type` element "defaults to
`EntityGraph.EntityGraphType.FETCH`". That is worth knowing precisely because
`find()` defaults to LOAD, so the same plan applied through the two routes is
interpreted differently on any model with an eager association.

**★ Can a fetch graph make Hibernate load *less* than the mapping asks for?**
In principle, that is exactly what it says it does. In practice, treat it as
unreliable: the specification grants the provider explicit permission to fetch
more, and there are mappings where laziness is not implementable — a lazy basic
field on an entity that was not bytecode-enhanced is "always fetched immediately",
per the guide, and a non-proxyable to-one cannot be deferred at all. To
guarantee something is not loaded, change the mapping, enable enhancement, or
project.

**★ What happens if you set both hints?**
Nothing defined and nothing warned about. One interpretation wins, and which one
is not something the specification settles. Use `setEntityGraph(graph,
GraphSemantic)` instead, where the semantic is a single enum argument and the
question cannot arise.

**★ Someone reports that a fetch graph is loading an association they left out.
How do you respond?**
First establish whether the association is mapped `EAGER`, because under load
semantics that is correct behaviour and the fix is the mapping. If it is mapped
lazy, check whether it can be lazy at all — a non-optional to-one on the inverse
side, or a lazy basic on an unenhanced class, cannot. If it is genuinely lazy and
genuinely unlisted, you have hit the provider's permission to over-fetch, which
is conformant; the practical answer is still to change the mapping or use a
projection, because arguing about conformance does not make the query faster.

---

← Prev: [9e2 · How deep to go](09e2-how-deep-a-graph-should-go.md) · Index: [08 · The N+1 problem](README.md) · Next → [9g · Spring Data @EntityGraph](09g-spring-data-entitygraph.md)
