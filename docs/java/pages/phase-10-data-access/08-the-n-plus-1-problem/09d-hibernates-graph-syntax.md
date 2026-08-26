---
title: "Hibernate parses a fetch plan from a string, which turns fourteen lines of annotation into one and makes runtime-assembled plans possible"
sidebar_label: "9d · Hibernate's graph syntax"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.6.3 *Creating
> and applying Jakarta Persistence graphs from text representations*, §12.6.4
> *Combining multiple Jakarta Persistence entity graphs into one* and §12.6.5
> *`@NamedEntityGraph` with text representation*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the Jakarta Persistence 3.2 specification —
> `EntityManagerFactory.addNamedEntityGraph` and §3.8
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The plan `@NamedEntityGraph` needed fourteen lines for is
`"customer, lines(product)"`. Hibernate will parse that from an annotation, from
a `SessionFactory`, or from a string you build at runtime — which is the feature
that makes client-driven fetch plans possible at all. It is also explicitly not
part of the specification, and one of its two syntaxes is not the default.**

## The annotation form

```java
@Entity
@org.hibernate.annotations.NamedEntityGraph(
    graph = "customer, lines(product)"
)
class Order { … }
```

The user guide's own example is
`@NamedEntityGraph( graph="title,isbn,author(name,phoneNumber)" )`. The grammar
is described as "a comma-separated list of attribute names, optionally including
any subgraph specifications", where a subgraph is the parenthesised list after an
attribute name and nests to any depth.

Note that basic attributes are listable too — `title,isbn` in that example are
columns, not associations. That is a fetch-graph consideration and mostly matters
for lazy basics; see [chunk 9f](09f-fetchgraph-vs-loadgraph.md).

Two things arrived in **Hibernate 7.3**:

- A **`root`** attribute naming the graph's root entity type explicitly. When the
  annotation is placed **on a package** rather than a class, `root` is
  **mandatory** — omitting it emits a deprecation warning in legacy parser mode
  and is an **error** in modern mode:

  ```java
  @org.hibernate.annotations.NamedEntityGraph(
      name = "Book.graph",
      root = Book.class,
      graph = "title,isbn,author(name,phoneNumber)"
  )
  package com.example.model;
  ```

- **`hibernate.graph_parser_mode`**, selecting which syntax the parser accepts.

## The two parser modes

| | `legacy` | `modern` |
|---|---|---|
| Default | ✅ **yes** | no |
| Subtype subgraph | `responsibleParty(Corporation: ceo)` | `responsibleParty:Corporation(ceo)` |
| Root-subtype subgraph | ✗ not available | `:Corporation(ceo), :NonProfit(sector)` |

Both forms "produce the same runtime `EntityGraph` structure" for the subtype
case; modern additionally allows subgraphs that originate at a **subtype of the
root entity**, which legacy cannot express at all.

🔴 **The default is `legacy`**, so modern syntax fails to parse unless somebody
set the property — and legacy syntax fails once somebody does. In a project that
uses subtype subgraphs, pin the mode explicitly rather than inheriting it.

## Parsing at runtime

```java
EntityGraph<Order> graph = GraphParser.parse(
        Order.class, "customer, lines(product)", entityManager);
```

`org.hibernate.graph.GraphParser` and `SessionFactory#parseEntityGraph` are the
two entry points. The guide notes the parsed graph "actually functions exactly
as" the equivalent named-graph mapping — it is the same object by another route.

Two syntax details only the parser documentation states:

- **Map keys** are addressed by appending `.key` to the attribute name:
  `GraphParser.parse(Ticket.class, "showing(id(movie(cast)))", em)` is the
  guide's worked example of reaching into a map key's own graph.
- **Duplicate attribute names are legal and meaningful.** Writing
  `responsibleParty(taxIdNumber), responsibleParty(Corporation: ceo)` does not
  create two nodes.

That second point is the spec's merge rule, quoted by the guide: duplicate
specification of an attribute node "results in the originally registered
`AttributeNode` to be re-used effectively merging the 2 `AttributeNode`
specifications together". One node, several subgraphs.

## Combining graphs

The same rule makes plans composable, which is the argument for several small
graphs rather than one large one:

```java
var a   = GraphParser.parse(Order.class, "customer",       entityManager);
var b   = GraphParser.parse(Order.class, "lines(product)", entityManager);
var all = EntityGraphs.merge(entityManager, Order.class, a, b);
```

`EntityGraphs.merge` produces the union. `lines(product)` merged with
`lines(taxRate)` yields **one** `lines` node carrying both subgraphs.

This is what named graphs cannot do well: a big graph is the union of everybody's
needs and therefore nobody's plan, whereas small graphs merged at the call site
put the cost where it is incurred.

## Registering a built graph under a name

```java
entityManagerFactory.addNamedEntityGraph("Order.forInvoice", graph);
```

The JPA escape hatch: named-graph ergonomics without annotation verbosity and
without adopting Hibernate's parser. It mutates factory-level state, so it
belongs in startup code, once — never anywhere a request can reach.

## The genuine use case: a client-driven plan

An API that lets a caller name the fields it wants maps almost exactly onto a
graph string:

```java
EntityGraph<Order> planFor(Set<String> requested) {
    String spec = requested.stream()
            .filter(ALLOWED::contains)          // ← not optional
            .collect(joining(", "));
    return GraphParser.parse(Order.class, spec, entityManager);
}
```

🔴 **The allow-list is the entire security story here.** A caller who can put
arbitrary text into that string can ask for
`lines(product(supplier(orders(lines(product)))))` and make the database
materialise a large fraction of the schema in one statement. Field selection
driven by user input is a denial-of-service surface, and a graph parser is a
direct route to it. Depth-limit it too, not just field-limit it.

## Which mechanism, when

| Situation | Use |
|---|---|
| Plan constant, one call site | build it there — [9b](09b-applying-a-graph.md) |
| Plan constant, Spring Data repository method | `@EntityGraph(attributePaths = …)` — [9g](09g-spring-data-entitygraph.md) |
| Plan constant, several callers, must be portable | JPA `@NamedEntityGraph` — [9c](09c-named-entity-graphs.md) |
| Plan constant, several callers, Hibernate is fine | `graph = "…"` |
| Plan assembled from independent concerns | small graphs + `EntityGraphs.merge` |
| Plan varies per request | `GraphParser.parse` **with an allow-list** |

## Gotchas

**⚠️ Writing the text syntax and expecting it to be portable.**
The guide is explicit: *"Parsing a textual representation of a graph is not (yet)
a part of the Jakarta Persistence specification. So the syntax described here is
specific to Hibernate."* That is a fine trade made deliberately and a bad one made
by accident — and it is invisible at the call site, because what comes out is a
standard `EntityGraph`.

**⚠️ Assuming `hibernate.graph_parser_mode` is `modern`.**
It defaults to **`legacy`**. Modern subtype syntax silently is not silent — it
fails to parse — but the failure is a bootstrap or first-call error that reads
like a typo rather than like a configuration problem, and the fix is a property
nobody thinks to look for.

**⚠️ Flipping the parser mode for one graph and breaking the others.**
It is a global setting. Changing it to `modern` to use a root-subtype subgraph
changes how *every* text graph in the application parses, including the
legacy-form subtype graphs somebody wrote last year. Grep for `(` followed by a
type name and a colon before flipping it.

**⚠️ A package-level `@NamedEntityGraph` without `root`.**
Legacy mode warns; **modern mode errors**. So a package-level graph that works
today fails at bootstrap the moment someone flips the mode for an unrelated
reason. Always give `root` on a package-level graph, warning or not.

**⚠️ Building the parse string by concatenating user input.**
Covered above and worth repeating as a gotcha because it does not look like an
injection: there is no SQL in the string, so it does not trip the reflexes SQL
injection trained. The damage is a legal graph that is enormous. Allow-list the
field names **and** cap the depth.

**⚠️ Parsing the same constant string on every request.**
`GraphParser.parse` walks the metamodel; for a constant plan that is pure waste.
Either use the annotation form, or parse once at startup and register it with
`addNamedEntityGraph`.

**⚠️ Calling `addNamedEntityGraph` from request-handling code.**
It mutates the `EntityManagerFactory`. Doing it per request grows factory state
without bound and races with every other thread reading it. It is a startup
operation.

**⚠️ Expecting `EntityGraphs.merge` to detect conflicts.**
It computes a union; there is nothing to conflict. Merging "fetch nothing extra"
with "fetch everything" gives you "fetch everything", quietly. If two callers
merge their plans into a shared one, each caller now pays for the other's needs,
and the merge is exactly the mechanism that makes that invisible.

**⚠️ Listing basic attributes in the text form without knowing why.**
`"title,isbn,author(name)"` names two columns. Under load semantics that is
harmless noise; under fetch semantics it is a statement that the *other* columns
should not be fetched, which only means anything for attributes that can actually
be lazy. Know which semantic you are applying before reading anything into a list
of basics — [chunk 9f](09f-fetchgraph-vs-loadgraph.md).

**⚠️ Treating the `.key` suffix as decoration.**
`showing.key(...)` addresses the graph of a `Map`'s **key** type, and the
unsuffixed name addresses the **value**. On a `Map<Movie, Showing>` those are two
different entities, and confusing them produces a plan that fetches the wrong
side of the map and looks correct in review.

## Interview questions

**★ What is Hibernate's text syntax for entity graphs?**
A comma-separated list of attribute names with parenthesised subgraphs —
`"customer, lines(product)"` — nesting to any depth, with `.key` appended to
address a map key's graph. It is available three ways:
`@org.hibernate.annotations.NamedEntityGraph(graph = "…")`,
`GraphParser.parse(Class, String, EntityManager)`, and
`SessionFactory#parseEntityGraph`. The guide is explicit that it is **not** part
of the Jakarta Persistence specification.

**★ Would you use it in preference to `@NamedEntityGraph`?**
In a codebase that has already accepted Hibernate, yes, on readability grounds
alone — the same plan is one line instead of fourteen, and subgraphs nest inline
instead of being wired by name to a separate declaration. Hibernate's own
introduction guide says the JPA annotation "is so verbose that it's just not
worth using". In a provider-neutral codebase, no, and the JPA annotation's
verbosity is the price of that neutrality.

**★ What is `hibernate.graph_parser_mode` and what is its default?**
It selects which text syntax the parser accepts, and it defaults to **`legacy`**.
Modern mode changes the subtype-subgraph form from
`responsibleParty(Corporation: ceo)` to `responsibleParty:Corporation(ceo)` and
adds root-subtype subgraphs — `:Corporation(ceo)` — which legacy cannot express.
It is global, so flipping it changes how every text graph in the application
parses, which makes it a migration rather than a per-graph choice.

**★ What happens if you name the same attribute twice in a graph?**
You get one node, not two. The spec's rule, which the guide quotes, is that
duplicate specification of an attribute node "results in the originally
registered `AttributeNode` to be re-used effectively merging the 2
`AttributeNode` specifications together" — so
`responsibleParty(taxIdNumber), responsibleParty(Corporation: ceo)` produces a
single node with two subgraphs. That rule is also what makes
`EntityGraphs.merge` well-defined.

**★ How would you build a fetch plan that depends on what the client asked for?**
`GraphParser.parse(Order.class, spec, entityManager)`, with `spec` assembled from
the request. That is the honest use case for a runtime parser and it is genuinely
useful for field-selection APIs. ⚠️ The field names must come from an allow-list
and the depth must be capped, because a caller who controls that string can ask
for a graph that joins most of the schema. It does not look like an injection —
there is no SQL in it — which is exactly why it gets missed.

**★ How do you compose two independently-defined plans?**
`EntityGraphs.merge(entityManager, Order.class, a, b, …)`, which unions them
under the duplicate-node rule. This is the reason to prefer several small graphs
over one big one: a big graph is the union of everybody's requirements and
therefore describes nobody's, and it grows monotonically because adding to it is
free for the person adding and costly for everyone else.

**★ When would you call `addNamedEntityGraph`?**
At startup, once, when you want the ergonomics of a named graph — callers just
say `getEntityGraph("Order.forInvoice")` — without the annotation's verbosity and
without adopting Hibernate's parser. It mutates `EntityManagerFactory` state, so
it must not be called from request-handling code.

**★ Is there a downside to defining graphs as strings at all?**
Yes, and it is the same one the JPA annotation has: nothing checks the attribute
names at compile time. A rename breaks the graph, and the failure surfaces at
parse time or first use rather than in the build. The metamodel-typed builders
([chunk 9b](09b-applying-a-graph.md)) are the only form `javac` verifies, so for
a constant plan that lives in Java anyway, they remain the safest choice; the
string forms buy conciseness and runtime flexibility with that check.

---

← Prev: [9c · Named entity graphs](09c-named-entity-graphs.md) · Index: [08 · The N+1 problem](README.md) · Next → [9e · Subgraphs](09e-subgraphs.md)
