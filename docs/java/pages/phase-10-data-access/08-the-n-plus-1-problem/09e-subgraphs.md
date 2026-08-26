---
title: "A subgraph is how a fetch plan gets a second level, and Jakarta Persistence 3.2 quietly renamed half the API for building one"
sidebar_label: "9e · Subgraphs"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification — the
> `Graph` and `EntityGraph` interfaces (`addSubgraph`, `addElementSubgraph`,
> `addTreatedSubgraph`, `addMapKeySubgraph` and the deprecations listed in the
> 3.2 revision history), §10.3.2 `NamedAttributeNode` and §10.3.3 `NamedSubgraph`
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> and the Hibernate ORM 7.4 user guide §12.6.1 *Jakarta Persistence (key)
> subgraphs* and §12.6.2 *Jakarta Persistence SubGraph sub-typing*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Every attribute node in a graph can carry a subgraph describing what to fetch
of *that* attribute's type, which is what makes a plan more than one level deep.
Jakarta Persistence 3.2 added four methods and deprecated three for building
them, and the pair most people reach for — `addSubgraph` on a collection — now
has a more precise sibling that says what it actually means.**

## What a subgraph is

The user guide's definition, §12.6.1:

> *"A subgraph is used to control the fetching of sub-attributes of the
> `AttributeNode` it is applied to."*

And the rule that decides where one is legal:

> *"Specifying a subgraph is only valid for an attribute (or its 'key') whose
> type is a `ManagedType`. So while an `EntityGraph` must correspond to an
> `EntityType`, a `Subgraph` is legal for any `ManagedType`."*

Two consequences. You cannot put a subgraph under a `String` or an `int` —
there is nothing beneath a basic attribute to describe. And you *can* put one
under an `@Embeddable`, because an embeddable is a managed type even though it is
not an entity.

## The three notations

Programmatic, JPA-portable:

```java
var graph = entityManager.createEntityGraph(Order.class);
graph.addAttributeNode("customer");
graph.addElementSubgraph("lines")            // ← the elements of the collection
     .addAttributeNode("product");
```

Named, JPA-portable — subgraphs are declared separately and wired by name:

```java
@NamedEntityGraph(
    name = "Order.forInvoice",
    attributeNodes = @NamedAttributeNode(value = "lines", subgraph = "L"),
    subgraphs = @NamedSubgraph(name = "L",
                               attributeNodes = @NamedAttributeNode("product"))
)
```

Hibernate's text form — nesting is parentheses, and it reads like the shape it
describes:

```java
@org.hibernate.annotations.NamedEntityGraph(graph = "customer, lines(product)")
```

The three produce the same runtime object. The difference is entirely how much of
your attention a second level costs to read, and it is the reason
[chunk 9d](09d-hibernates-graph-syntax.md) exists. What each extra level *costs
the database* is [chunk 9e2](09e2-how-deep-a-graph-should-go.md).

## What 3.2 changed, and what it deprecated

The 3.2 revision history records four additions to `Graph` —
`addTreatedSubgraph()`, `addElementSubgraph()`, `addTreatedElementSubgraph()`,
`addMapKeySubgraph()` (plus `addAttributeNode()` and `removeAttributeNode()`
overloads) — and three deprecations **for removal**:

| Deprecated in 3.2 | Replacement |
|---|---|
| `EntityGraph.addSubclassSubgraph(Class)` | `addTreatedSubgraph(Class)` |
| `addSubgraph(Attribute, Class)` | `addTreatedSubgraph(Attribute, Class)` |
| `addKeySubgraph(…)` | `addMapKeySubgraph(…)` |

The renaming is not cosmetic. `addSubgraph(attribute, SomeSubclass.class)` reads
as "a subgraph of this attribute, of that type", which is ambiguous between *the
attribute's element type* and *a narrowing of it*. `addTreatedSubgraph` says
narrowing, in the same vocabulary criteria queries already use for `treat()`.

⚠️ Deprecated **for removal** is stronger than deprecated. Code written against
3.1 that calls `addKeySubgraph` or `addSubclassSubgraph` compiles today and is
scheduled not to.

## `addSubgraph` versus `addElementSubgraph`

This is the distinction the 3.2 API makes explicit and the one worth internalising.

For a plural attribute — `Set<OrderLine> lines` — what does a subgraph describe?
The collection, or its elements? The answer has always been "the elements", but
the method name did not say so. 3.2 adds one that does:

```java
<E> Subgraph<E> addElementSubgraph(PluralAttribute<? super T, ?, E> attribute);
```

Its javadoc: *"Add a node to the graph that corresponds to a collection element
that is a managed type."* The typed signature makes it a compile error to call it
on a to-one, and makes the returned `Subgraph<E>` the *element* type rather than
something looser.

Hibernate's `Session` adds `addPluralSubgraph(PluralAttribute)` as its own
metamodel-typed variant of the same idea.

**In new code:** `addSubgraph` for a to-one, `addElementSubgraph` for a
collection, `addMapKeySubgraph` for a map's key. The names now carry the
information.

## Map keys have their own graph

A `Map<Movie, Showing>` has a managed type on both sides, so a subgraph has to
say which one it means:

```java
graph.addMapKeySubgraph(Ticket_.showing)      // the KEY's graph
     .addAttributeNode("cast");
graph.addSubgraph("showing")                  // the VALUE's graph
     .addAttributeNode("auditorium");
```

The spec's wording in the fetch-graph rules is that if a map key "is an entity,
and a map key subgraph is not specified for the attribute node, the map key is
fetched according to its default fetch graph" — so the key is fetched either way,
and the key subgraph only controls *how much* of it.

In the named annotation, this is `@NamedAttributeNode(value = …, keySubgraph =
"…")`. In Hibernate's text form it is the `.key` suffix:
`GraphParser.parse(Ticket.class, "showing(id(movie(cast)))", em)` is the guide's
example of reaching through a key.

## Subtype subgraphs

When an attribute's type has subclasses, you can describe attributes that exist
only on one of them:

```java
graph.addTreatedSubgraph("responsibleParty", Corporation.class)
     .addAttributeNode("ceo");
```

The javadoc for the older form explains the inheritance rule, which survives the
rename: *"This allows for multiple subclass subgraphs to be defined for this node
of the entity graph. Subclass subgraphs will automatically include the specified
attributes of superclass subgraphs."* So a `Corporation` subgraph inherits
whatever you specified for `LegalEntity`; you list only the extra.

In the named annotation, `@NamedSubgraph.type` carries the subclass — and the
spec says it *"must be specified when the subgraph corresponds to a subclass of
the entity type corresponding to the referencing attribute node"*, with only
"subclass-specific attributes" listed. `@NamedEntityGraph.subclassSubgraphs`
does the same for subtypes of the **root** entity.

Hibernate's parser expresses the same thing as `responsibleParty(Corporation: ceo)`
in the default legacy mode, or `responsibleParty:Corporation(ceo)` in modern mode
— [chunk 9d](09d-hibernates-graph-syntax.md).

## Gotchas

**⚠️ Calling `addSubgraph` on a collection and assuming it means the collection.**
It means the elements, and always has. 3.2's `addElementSubgraph` exists to say
so out loud. Nothing breaks if you keep using `addSubgraph` — but a reader has to
know the convention, and the typed `addElementSubgraph(PluralAttribute…)` makes
the wrong call a compile error instead.

**⚠️ Using `addKeySubgraph` or `addSubclassSubgraph` in new code.**
Both are deprecated **for removal** in 3.2, in favour of `addMapKeySubgraph` and
`addTreatedSubgraph`. They still work; they are scheduled not to. A codebase
migrating from 3.1 should sweep for these once, not discover them one at a time
during an upgrade.

**⚠️ Putting a subgraph under a basic attribute.**
`IllegalArgumentException` — "if the attribute's target type is not a managed
type". It is an easy mistake in the string-based API, where `addSubgraph("name")`
compiles perfectly, and an impossible one in the typed API.

**⚠️ Forgetting that an `@Embeddable` takes a subgraph.**
A subgraph is legal for any `ManagedType`, not only entities. So
`addSubgraph("shippingAddress").addAttributeNode("country")` is valid, and it is
the correct way to control fetching *inside* an embeddable that has its own
associations — a case people usually assume is unreachable from a graph.

**⚠️ Mutating a statically defined graph.**
Several `Graph` methods declare `IllegalStateException` "if the `EntityGraph` has
been statically defined". A graph obtained from `getEntityGraph(name)` is that.
Take a mutable copy with `createEntityGraph(name)` first —
[chunk 9b](09b-applying-a-graph.md) — and note that the copy returns `null`, not
an exception, for an unknown name.

**⚠️ Omitting `type` on a `@NamedSubgraph` for a subclass.**
The spec requires it "when the subgraph corresponds to a subclass of the entity
type corresponding to the referencing attribute node". Without it the subgraph is
interpreted against the base type, and the subclass-only attributes you listed
are not attributes of that type at all.

**⚠️ Re-listing superclass attributes in a subclass subgraph.**
"Subclass subgraphs will automatically include the specified attributes of
superclass subgraphs", and the spec says only "subclass-specific attributes are
listed". Repeating them is harmless but signals that the author did not know the
rule, which usually means the plan was written by trial and error.

**⚠️ Wiring a named subgraph to the wrong node by typo.**
`@NamedAttributeNode(value = "lines", subgraph = "Lnies")` is two strings that
must match, checked at runtime if at all. This is the concrete cost of the
declare-then-reference design, and it grows with depth: a three-level plan has
two such joins to get right.

## Interview questions

**★ What is a subgraph, and where is one legal?**
It controls the fetching of sub-attributes of the attribute node it is attached
to — the second and subsequent levels of a fetch plan. The user guide's rule is
that a subgraph is "only valid for an attribute (or its 'key') whose type is a
`ManagedType`", so: entities yes, embeddables yes, basics no. The root of an
`EntityGraph` must be an `EntityType`, but a `Subgraph` may be any managed type.

**★ What did Jakarta Persistence 3.2 change about building them?**
It added `addTreatedSubgraph`, `addElementSubgraph`, `addTreatedElementSubgraph`
and `addMapKeySubgraph`, and deprecated `addSubclassSubgraph`,
`addSubgraph(Attribute, Class)` and `addKeySubgraph` **for removal**. The point
of the renaming is precision: `addTreatedSubgraph` says "narrow to this subtype"
in the same vocabulary as criteria `treat()`, and `addElementSubgraph` says the
subgraph applies to a collection's *elements*, which was always true and was
never stated by the name.

**★ On a `Set<OrderLine> lines`, what does a subgraph describe?**
The elements — the `OrderLine`s — not the collection. `addElementSubgraph` is the
3.2 method that says so and is typed to `PluralAttribute`, so it cannot be called
on a to-one. Hibernate's `addPluralSubgraph` is the equivalent metamodel-typed
variant on `Session`.

**★ How do you control fetching for a `Map`'s key?**
`addMapKeySubgraph(MapAttribute)` in code, `@NamedAttributeNode(keySubgraph =
"…")` in the annotation, or a `.key` suffix in Hibernate's text syntax. It is
needed because a `Map<Movie, Showing>` has managed types on both sides and a
plain subgraph addresses the value. Note the key is fetched regardless — the spec
says an entity key with no key subgraph "is fetched according to its default
fetch graph"; the key subgraph only controls how much of it comes with it.

**★ How do you fetch an attribute that exists only on a subclass?**
`addTreatedSubgraph(attribute, Corporation.class)`, or `@NamedSubgraph` with
`type = Corporation.class`, or Hibernate's `responsibleParty(Corporation: ceo)`.
The inheritance rule is that subclass subgraphs automatically include the
attributes specified for superclass subgraphs, so you list only the extras.
`@NamedEntityGraph.subclassSubgraphs` does the same for subtypes of the graph's
own root.

**★ What is the practical downside of the named-subgraph wiring?**
Two strings that must match and that nothing checks until runtime: the
`subgraph = "L"` on the attribute node and the `name = "L"` on the
`@NamedSubgraph`. The number of these grows with depth, they are invisible to
refactoring tools, and the failure is a graph that silently describes less than
its author thought. Hibernate's parenthesised text form removes the problem by
nesting inline.

---

← Prev: [9d · Hibernate's graph syntax](09d-hibernates-graph-syntax.md) · Index: [08 · The N+1 problem](README.md) · Next → [9e2 · How deep to go](09e2-how-deep-a-graph-should-go.md)
