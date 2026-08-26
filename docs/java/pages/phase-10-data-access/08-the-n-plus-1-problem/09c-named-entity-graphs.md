---
title: "A named entity graph moves the fetch plan onto the entity, which buys reuse and costs the ability to see which endpoint the plan is for"
sidebar_label: "9c · Named entity graphs"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §10.3
> *EntityGraph Annotations* — §10.3.1 `NamedEntityGraph`, §10.3.2
> `NamedAttributeNode`, §10.3.3 `NamedSubgraph`
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> and *A Short Guide to Hibernate 7* §5.7
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**JPA's way to define a fetch plan without builder code is an annotation on the
entity. It works, it is portable, and Hibernate's own documentation says it "is so
verbose that it's just not worth using". This chunk is what the annotation
actually promises, and the structural objection that survives even if you
disagree about the verbosity.**

## The annotation

```java
@Entity
@NamedEntityGraph(
    name = "Order.forInvoice",
    attributeNodes = {
        @NamedAttributeNode("customer"),
        @NamedAttributeNode(value = "lines", subgraph = "lines.product")
    },
    subgraphs = @NamedSubgraph(
        name = "lines.product",
        attributeNodes = @NamedAttributeNode("product")
    )
)
class Order { … }
```

From a caller:

```java
EntityGraph<?> graph = entityManager.getEntityGraph("Order.forInvoice");
Order order = entityManager.find(Order.class, id,
        Map.of("jakarta.persistence.loadgraph", graph));
```

Fourteen lines of annotation to express a plan you would say in English as *"the
order, its customer, its lines and each line's product"*.

## What the specification actually pins down

§10.3.1, five facts that decide how you use it:

- **It must go on the root entity.** *"The annotation must be applied to the root
  entity of the graph."* You cannot declare `Order.forInvoice` on `OrderLine`,
  even though most of what it says is about lines.
- **`name` defaults to the entity name.** *"If no name is explicitly specified,
  the name defaults to the entity name of the annotated root entity."* A bare
  `@NamedEntityGraph` on `Order` is fetchable as `"Order"`.
- **Names are global.** *"Entity graph names must be unique within the
  persistence unit."* Not per entity. This is the whole reason for the
  near-universal `Entity.purpose` convention.
- **`includeAllAttributes`** defaults to `false`; setting it includes every
  attribute of the class, and you may still list an `attributeNode` alongside it
  "to specify a subgraph for the attribute".
- **`@NamedEntityGraph` is `@Repeatable`** (container `@NamedEntityGraphs`), so
  an entity can carry several plans without a wrapper.

`@NamedAttributeNode` takes `value`, `subgraph` and `keySubgraph` — the last for
the key of a `Map`-valued attribute. `@NamedSubgraph` takes `name`, an optional
`type` (required when the subgraph corresponds to a **subclass** of the referenced
attribute's type) and its own `attributeNodes`. There is also
`subclassSubgraphs` on the graph itself, "a list of subgraphs that add additional
attributes for subclasses of the root entity". The wiring is
[chunk 9e](09e-subgraphs.md)'s subject.

## Why the verbosity is structural, not cosmetic

Subgraphs cannot nest inline. Every level of depth becomes another top-level
`@NamedSubgraph`, joined to its use site by a string that nothing checks. A
three-level plan therefore reads bottom-up, in fragments, in an order unrelated to
the shape it describes:

```java
@NamedEntityGraph(
    name = "Order.full",
    attributeNodes = @NamedAttributeNode(value = "lines", subgraph = "L"),
    subgraphs = {
        @NamedSubgraph(name = "L", attributeNodes = @NamedAttributeNode(value = "product", subgraph = "P")),
        @NamedSubgraph(name = "P", attributeNodes = @NamedAttributeNode("supplier"))
    }
)
```

The Hibernate introduction guide's verdict is one sentence:

> *"JPA even specifies a way to define named entity graphs using annotations. But
> the annotation-based API is so verbose that it's just not worth using."*

That is a strong claim from the people who implement it, and
[chunk 9d](09d-hibernates-graph-syntax.md) is the one-line alternative they offer
instead.

## The objection that survives the verbosity argument

Suppose you find the annotation perfectly readable. There is still this:
`Order.forInvoice` is a statement about what **one endpoint** needs, written on
the **domain class**, with nothing linking the two.

A year later the entity carries six graphs. Nobody can tell which endpoints use
which, because the reference is a string resolved at runtime — not a compile-time
edge a "find usages" can follow reliably, and not something the build will
complain about. None of the six can be deleted with confidence. The entity has
accumulated the fetching requirements of the whole application, in a file that is
supposed to describe the domain.

This is the argument for keeping plans at their call sites: build them there
([chunk 9b](09b-applying-a-graph.md)), or use Spring Data's
`@EntityGraph(attributePaths = …)` on the repository method
([chunk 9g](09g-spring-data-entitygraph.md)), which puts the query and its plan
in the same declaration.

Named graphs earn their place when a plan is genuinely shared by several
unrelated callers and provider-neutrality matters. That is a real case; it is
just much rarer than the number of `@NamedEntityGraph` annotations in the average
codebase would suggest.

## Gotchas

**⚠️ Letting the graph name default.**
A `@NamedEntityGraph` with no `name` takes the **entity name**, so
`getEntityGraph("Order")` resolves it. That reads as "the graph for orders" and
means "whatever plan somebody put on the class first". Always name it, and name
it for the *use* rather than the shape: `Order.forInvoice`, not
`Order.withLines` — the second one goes stale the moment the invoice needs the
customer too.

**⚠️ Colliding names across entities.**
Graph names are unique per persistence unit, not per entity. Two classes each
declaring `"detail"` is a bootstrap failure, and an annoying one to read, because
the message names the graph and not the two classes that fought over it. The
`Entity.purpose` convention makes collisions impossible rather than merely
unlikely.

**⚠️ Reaching for `includeAllAttributes = true`.**
It means "fetch everything on this class" — every `@Lob`, every `@ManyToOne`,
every collection you were carefully keeping lazy. It is occasionally right for a
small flat entity and is usually a way of not deciding. If you want it, the real
question is whether the endpoint wants an entity at all
([chunk 12](12-projections-and-dtos.md)).

**⚠️ Assuming the graph name is checked somewhere.**
It is a string resolved at runtime. A typo surfaces as an
`IllegalArgumentException` from `getEntityGraph`, or as a silent `null` from
`createEntityGraph(String)`, which is worse — see
[chunk 9b](09b-applying-a-graph.md). Neither happens at compile time, and neither
happens at bootstrap.

**⚠️ Deleting an endpoint and leaving its graph behind.**
Nothing links a named graph to its callers, so unused graphs accumulate and are
never removed, because removing one is a change nobody can prove is safe. If you
use named graphs, grep the name before assuming a graph is live — and be aware
that the grep is the whole safety net.

**⚠️ Importing the wrong `@NamedEntityGraph`.**
`jakarta.persistence.NamedEntityGraph` and
`org.hibernate.annotations.NamedEntityGraph` have the same simple name, and an
IDE will happily pick either. The tell: the JPA one takes `attributeNodes = …`
and the Hibernate one takes `graph = "…"`. A compile error about a missing
`graph` element means the import is JPA's.

**⚠️ Declaring the graph on the entity you are fetching *into*.**
`Order.forInvoice` describes lines and products, so it feels natural to put it
near them. The spec forbids it: the annotation goes on the root. Getting this
wrong produces a graph that either does not resolve or resolves against the wrong
root and silently fetches nothing you wanted.

**⚠️ Forgetting `type` on a subclass subgraph.**
`@NamedSubgraph.type` "must be specified when the subgraph corresponds to a
subclass of the entity type corresponding to the referencing attribute node".
Omit it on a polymorphic association and the subgraph is interpreted against the
base type, so the subclass-only attributes you listed are not attributes of that
type at all.

**⚠️ Using a named graph as the place to record "what this entity is".**
A graph is not documentation of the aggregate. It is one caller's requirement.
The moment a graph is named after the entity rather than the use — `Order.full`,
`Order.detail`, `Order.everything` — it has stopped describing a fetch plan and
started describing a wish, and it will grow until it fetches the database.

## Interview questions

**★ Where must a `@NamedEntityGraph` be declared?**
On the root entity of the graph — the specification says "the annotation must be
applied to the root entity of the graph". A graph rooted at `Order` goes on
`Order`, even when everything interesting in it concerns `OrderLine`. The deeper
levels are `@NamedSubgraph` declarations in the same annotation, wired to their
use sites by name.

**★ What happens if you do not name the graph?**
It takes the entity name: "if no name is explicitly specified, the name defaults
to the entity name of the annotated root entity". So `getEntityGraph("Order")`
finds it. That is rarely what you want, because an entity usually ends up with
several plans and only one of them can be called `"Order"`.

**★ Are graph names scoped to the entity?**
No — "entity graph names must be unique within the persistence unit". That is why
the conventional name is `Entity.purpose`: it puts the entity in the name
explicitly rather than relying on a scoping rule that does not exist. Two
entities each declaring `"detail"` collide at bootstrap.

**★ What does `includeAllAttributes` do, and when would you use it?**
It includes every attribute of the annotated class in the graph, defaulting to
`false`, and you can still list an attribute node alongside it to attach a
subgraph. I would use it approximately never on a real entity, because "every
attribute" includes the `@Lob` and the collections that were lazy for a reason.
Its honest use is a small, flat, wholly-owned entity where laziness was never
buying anything.

**★ What is the strongest argument against named entity graphs?**
Not the verbosity — that is a matter of taste and Hibernate's text syntax fixes
it anyway. It is placement: the annotation states what one endpoint needs, on the
domain class, linked to that endpoint by a runtime string. The entity accumulates
the fetching requirements of the whole application, and none of them can be
deleted safely because nothing can prove a graph is unused. Keeping the plan next
to the query — at the call site, or on the repository method — removes the
problem entirely.

**★ When would you use one anyway?**
When the same plan is genuinely needed by several unrelated callers and
duplicating it would drift, and when provider neutrality rules out Hibernate's
syntax. That is a real situation. It is just far rarer than the number of
`@NamedEntityGraph` annotations in a typical codebase implies, because most of
them were written once, for one endpoint, and were named after the entity rather
than the use.

**★ How would you review a pull request that adds a seventh named graph to an
entity?**
By asking what the other six are for. If nobody in the room can name the
endpoints, that is the finding, and the fix is not to reject the seventh — it is
to move plans to their call sites as the endpoints are touched. I would also
check the name: a graph called after its purpose can be reasoned about, and one
called `Order.full` cannot, because "full" is not a requirement anybody has.

---

← Prev: [9b · Building and applying](09b-applying-a-graph.md) · Index: [08 · The N+1 problem](README.md) · Next → [9d · Hibernate's graph syntax](09d-hibernates-graph-syntax.md)
