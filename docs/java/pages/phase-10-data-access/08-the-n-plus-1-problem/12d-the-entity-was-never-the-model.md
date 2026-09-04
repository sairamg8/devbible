---
title: "Most endpoints that hit N+1 were never loading an aggregate — they were assembling a document out of a change-tracking mechanism nobody in that request was using"
sidebar_label: "12d · The entity was never the model"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.8 and the
> chapter on the persistence context
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> *A Short Guide to Hibernate 7* §8.4 *Association fetching*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Jakarta Persistence 3.2 specification §3.1 *EntityManager* and §4.9.2
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> and the Spring Data JPA 4.1 *Projections* reference
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Boot 4.1.1.

**Part 3 has been a sequence of increasingly careful answers to the wrong
question. Join fetches, entity graphs, batch sizes and subselects are all ways of
getting the object graph you asked for more cheaply. The projection is the first
one that asks whether you wanted an object graph — and for the endpoints where
N+1 actually shows up, the answer is almost always no.**

## What an entity is for

An entity is not a data structure. It is a **managed** object: a row, plus an
identity in a persistence context, plus a snapshot of its loaded state, plus a
place in a graph of proxies that will go to the database when touched.

Every one of those parts exists to support **writing**. The identity map keeps
one instance per row so two updates cannot conflict in memory. The snapshot
exists so a flush can compute what changed. The proxies exist so navigation is
possible without deciding everything up front.

Hibernate's own introduction guide states the discipline the model demands:

> *"explicitly specify all the data you're going to need right at the start of a
> session/transaction, and fetch it immediately in one or two queries, and only
> then start navigating associations between persistent entities."*

That is a workable rule for a unit of work that reads some rows, applies a domain
decision and writes some rows. It is a strange rule to impose on an endpoint
whose entire job is to turn four columns into JSON.

## The three questions

Ask them in order, at every endpoint that shows an N+1:

**1 · Does this operation write anything?** If no, none of the machinery above is
being used. The identity map is preventing conflicts that cannot occur, the
snapshot is being diffed at flush against a state nothing will change, and the
proxies are the exact mechanism producing the bug.

**2 · Is the output a document?** A response body, a report, a CSV, a message
payload. A document is a *shape*, and shapes are what queries return. The
recursive structure of the object graph looks like the nesting of the JSON, and
that resemblance is what makes the entity feel like the right source — but the
resemblance is a coincidence of both being trees.

**3 · Does the shape follow a table or a screen?** An `Order` entity is shaped by
the `ORDERS` table. An invoice is shaped by what an invoice contains. When those
diverge — and they diverge as soon as a field comes from three tables or a total
is computed — you are transforming, and the transformation is cheaper in SQL than
in Java.

**Three "no, document, screen" answers and the entity was never the model.**

## What the N+1 was telling you

This is the reframing worth taking away from the whole topic.

An N+1 is not primarily a performance defect. It is a **structural signal**: the
code is walking a graph at render time, which means the shape of the output was
decided somewhere other than the query. The extra queries are how the runtime
tells you that the data access layer did not know what the request needed.

Every fix in this part responds to that signal differently:

| Fix | What it says |
|---|---|
| `join fetch` | "I will decide up front, in the query" |
| entity graph | "I will decide up front, in a value the caller supplies" |
| `@BatchSize` | "I cannot decide up front, so amortise it" |
| `@Fetch(SUBSELECT)` | "I cannot decide up front, so describe the owners once" |
| **projection** | **"There is no graph to walk"** |

The first four make the walk cheaper. Only the last one removes it, and only the
last one cannot be undone by a change to a serialiser two quarters from now.

## Read and write want different shapes

Not a framework, not an architecture — an observation you can act on one endpoint
at a time:

```java
// write path: entity, because the operation writes
@Transactional
public void cancel(Long orderId, String reason) {
    Order order = orders.findById(orderId).orElseThrow();
    order.cancel(reason);                     // dirty checking earns its keep here
}

// read path: projection, because the operation renders
@Transactional(readOnly = true)
public List<OrderSummary> recent(Instant cutoff) {
    return orders.summaries(cutoff);          // no graph, no proxies, no snapshots
}
```

Two shapes over one table, chosen by what the operation does. Nothing in JPA
discourages this; it is only that the tutorials teach one repository returning
one type, and that shape is what puts entities on the read path in the first
place.

## The honest counter-arguments

Take them seriously, because they are sometimes right.

- **"Two models is duplication."** They are not duplicates; they are different
  projections of the same table, and they change for different reasons — the
  write model changes when the domain changes, the read model when the screen
  does. That said, three records that differ by one field each *are* duplication,
  and dynamic projections
  ([chunk 12c2](12c2-dto-projections-in-spring-data.md)) exist for it.
- **"The entity gives me the domain methods."** On the write path, yes, and that
  is exactly where to keep it. A read path calling `order.total()` is calling a
  method that walks a collection — which is the N+1 again, in domain-model
  clothing. Move the computation into the query.
- **"We might need to write later."** Then convert later; a projection to entity
  is a small, local change. The reverse — discovering the read path has been
  mutating entities by accident — is not.
- **"The second-level cache serves entities, not projections."** True, and a real
  argument for entity loads on hot, small, rarely-changing reference data. It is
  not an argument for loading an order and its lines to render an invoice.

## Where this leaves the toolbox

Nothing in part 3 is retired. The ranking is:

1. **Does the operation write?** If yes, entities, and fetch deliberately — a
   `join fetch` or an entity graph, per call site.
2. **If it reads:** a projection, unless something above genuinely argues
   otherwise.
3. **`@BatchSize` globally, always**, as a floor under everything nobody has
   found yet ([chunk 10](10-batch-size.md)). It costs nothing and it is the only
   fix that helps code you have not read.
4. **Everything else — subselect, `Set`, `@OrderColumn`, eager mappings — is a
   local decision with a global blast radius.** Make them deliberately or not at
   all.

The decision procedure itself, worked through against real endpoint shapes, is
[chunk 14](14-choosing-a-fix.md).

## Gotchas

**⚠️ Converting to projections and keeping the entity graph annotations.**
A repository method returning a record does not need `@EntityGraph`, and leaving
it there is a reader's trap: it implies associations are being fetched when there
is no entity to fetch them onto. Remove them in the same change.

**⚠️ Building a projection and then loading the entity to compute one field.**
`summaries()` followed by `findById()` inside the mapping loop is an N+1 built out
of projections, and it is easier to write than it sounds because the projection
made the first query feel finished. Whatever the field is, compute it in the
query.

**⚠️ Treating "read-only" as a transaction flag rather than a model decision.**
`@Transactional(readOnly = true)` asks the runtime not to flush. A projection has
nothing to flush. The flag is worth setting and it is a much weaker guarantee
than choosing the right shape — see
[topic 06 chunk 11](../06-jpa-hibernate-model/11-the-persistence-context.md).

**⚠️ Moving domain logic into the query and losing it.**
A total computed in JPQL is a business rule living in a string. If the rule is
non-trivial — tiered discounts, tax by jurisdiction — the honest options are a
database view, a materialised column maintained on write, or accepting the entity
load. "Put it in the query" is right for `quantity * unitPrice` and wrong for
policy.

**⚠️ Converting the write path too.**
Dirty checking is genuinely valuable when you are changing rows: it computes the
minimal update, handles optimistic locking, and cascades. Replacing it with
hand-written updates to "be consistent" trades a mechanism that works for one you
now maintain.

**⚠️ Assuming a projection is always fewer bytes.**
It is fewer *columns*, on the same rows. A projection over a join with fan-out
still repeats the parent's projected columns per child. If the fan-out is the
problem, the fix is [chunk 12b](12b-projecting-a-collection.md)'s two queries, not
a narrower select list.

**⚠️ Rewriting everything at once.**
The conversion is per endpoint and each one is small: a record, a query, a
controller change. A campaign to remove entities from all read paths is a large
change with no incremental value and a large surface for regressions. Convert the
ones that are slow or that serialise the most, and stop.

**⚠️ Using this argument to avoid learning the fetching tools.**
Write paths still need `join fetch` and entity graphs, `@BatchSize` still belongs
in every application, and the pagination and duplicate-parent rules still apply
wherever entities are loaded. "Just use projections" is a good default and a bad
substitute for knowing what the runtime does.

**⚠️ Declaring victory when the query count drops.**
The row count is the other half, and the whole of
[chunk 6](06-count-do-not-read.md). A single projection query returning two
hundred thousand rows is not a fix; it is a differently-shaped incident.

## Interview questions

**★ What do you mean, "the entity was never the model"?**
That an entity is a *managed* object — a row plus identity, plus a dirty-checking
snapshot, plus proxies — and every one of those parts exists to support writing.
An endpoint that reads and renders uses none of them, and the proxies are
precisely the mechanism that produces its N+1. For such an endpoint, the entity
is not a model of the operation; it is a model of the table, carrying machinery
the request never uses.

**★ How do you decide, at a given endpoint?**
Three questions. Does it write anything? Is the output a document — a response
body, a report, a payload? And does the shape follow a table or a screen? A
read-only endpoint producing a document whose shape does not match any single
table is one a projection describes better, and no amount of fetch tuning will
change that.

**★ Is that not just CQRS?**
It is the useful part of it, without the ceremony. There is no separate store, no
event stream and no eventual consistency — one database, one schema, one
transaction, and two shapes over it chosen by what the operation does. Calling it
CQRS invites an argument about infrastructure; calling it "read paths return
records" gets it merged.

**★ Doesn't that duplicate the model?**
It creates a second *shape*, not a second model, and the two change for different
reasons: the entity when the domain changes, the record when the screen does.
That is a feature — coupling them is what makes a UI change touch the mapping. The
real duplication risk is several near-identical records, and dynamic projections
handle that.

**★ What do you lose?**
Dirty checking, cascading and the identity map, all of which you were not using on
a read path. Concretely you also lose second-level entity cache hits, which is a
genuine argument for entity loads on small, hot, rarely-changing reference data.
And you lose the ability to call domain methods on the result — though a domain
method that walks a collection was the N+1 in the first place.

**★ So is N+1 a performance problem or a design problem?**
Both, and the design half is the more useful reading. The extra queries are the
runtime telling you that the shape of the output was decided somewhere other than
the query — that the code is walking a graph at render time. You can make the walk
cheaper with a join, a graph, a batch size or a subselect, and all four are
legitimate. Only removing the walk makes the fix permanent, because only that one
cannot be undone by somebody adding a getter to a serialiser.

**★ Would you ban entities from read paths?**
No. A rule that strong will be wrong somewhere — a small hot lookup served by the
second-level cache, a read-then-write flow, a legacy endpoint where the change is
not worth it. I would make the projection the *default* for new read endpoints,
convert the slow ones as they surface, and keep `hibernate.default_batch_fetch_size`
set globally so that whatever is left never degrades past ⌈N/k⌉.

**★ If you had one sentence for a team that keeps hitting this?**
Decide what the request needs before the query runs, and then have the query
return exactly that. Everything in this topic — fetch joins, graphs, batch sizes,
subselects, projections — is a different answer to "how", and every N+1 is
evidence that "what" was never answered.

---

← Prev: [12c2 · DTO projections in Spring Data](12c2-dto-projections-in-spring-data.md) · Index: [08 · The N+1 problem](README.md) · Next → [13 · Fetch profiles](13-fetch-profiles.md)
