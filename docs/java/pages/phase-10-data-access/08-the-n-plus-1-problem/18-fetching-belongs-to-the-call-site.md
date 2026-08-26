---
title: "The mapping's job is to describe the relationship and default to lazy; deciding what to fetch is the query's job — get that boundary right and N+1 becomes a mistake you have to work to make"
sidebar_label: "18 · Fetching belongs to the call site"
sidebar_position: 59
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §9 *Fetching and lazy
> loading* and §9.16 *Named fetch profiles*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §12.1 *The basics*, §12.6 and §31.6.1 *Fetching
> associations*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification's `FetchType` and `EntityGraph`
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**Everything in this topic reduces to one boundary. A mapping describes a relationship that is
true of the data — this order has lines, this line belongs to a product — and that statement is
the same for every query in the application. What each query *needs* is different every time.
Put the fetch decision in the mapping and you have answered a per-call-site question in a
per-model place, which is why `EAGER` cannot be overridden and why every fix in this topic
except one is applied at a query. Hibernate's own documentation lands in the same place: "it's
better to use `LAZY` associations, and only fetch them eagerly on a per-query basis."**

## The evidence from the three services

[14b](14b-the-list-page.md), [14c](14c-the-report.md) and [14d](14d-the-detail-view.md) put the
same association through three call sites and reached three different fixes:

| Call site | What it needed from `Order.lines` |
|---|---|
| Paged list | a **count**, computed in SQL — the entities were never needed |
| Report over a month | the entities, **batched**, never joined |
| Detail view for one order | the entities, **joined**, two levels deep |

The mapping did not change. It could not have — no single value of `fetch` is right for all
three, and any mapping-level decision would have been wrong for two of them. **That is not a
quirk of this example; it is the general case**, and it is why the fetch strategy cannot live
where the relationship lives.

## What the mapping should say

Everything that is true of the relationship regardless of who is asking:

```java
@Entity
public class Order {

    @ManyToOne(fetch = FetchType.LAZY)          // cardinality + the minimal default
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @OneToMany(mappedBy = "order",              // owning side
               cascade = CascadeType.ALL,       // lifecycle
               orphanRemoval = true)            // lifecycle
    @BatchSize(size = 100)                      // how unplanned loads are grouped
    private List<OrderLine> lines = new ArrayList<>();
}
```

Cardinality, the owning side, the join column, the lifecycle rules — these are facts about the
model. `fetch = LAZY` is there not as a fetch decision but as the **absence** of one: it is the
minimal position, and the only one every call site can build on.

⚠️ **`fetch = LAZY` on `@ManyToOne` and `@OneToOne` is not the default and must be written every
time.** Jakarta Persistence specifies `EAGER` for both, which the Hibernate introduction calls
"the problem of JPA having specified the wrong default". [16 · EAGER is not a
fix](16-eager-is-not-a-fix.md) is the long argument; the short one is that omitting the attribute
is itself a decision, made by the specification, in the wrong direction.

## Why `@BatchSize` is in that list and nothing else is

`@BatchSize` looks like a mapping-level fetch decision and is a different kind of thing. It does
not cause anything to load. It changes **how loads that were going to happen anyway are
grouped** — when a proxy is touched, others already in the context and still uninitialised are
resolved with it.

So it is a default for the *unplanned* case, and unplanned loads are exactly what a large
codebase has: cascades, serialisers, code paths nobody enumerated. A batch size makes those cost
`N/size` statements instead of `N`, and it never forces a load a caller did not ask for. It is
also silently overridden wherever a call site does declare a plan — a fetch join initialises the
collection, so there is nothing left to batch
([14d · Worked: the detail view](14d-the-detail-view.md)).

**A safety net that lowers the cost of mistakes without preventing correct decisions is the only
kind of fetch configuration that belongs in a mapping.** `EAGER` fails that test in both
directions: it forces loads nobody asked for and it prevents any caller declining.

## What the call site should say, and how

The call site's job is to declare what this unit of work needs, in a way that is visible to
whoever reads the call. Four spellings, in rough order of how often they are right:

**An entity graph on the repository method.** The plan attaches to the call, the method name
says what it fetches, and the same rows can be served by several methods with different plans.
This is the default for a Spring Data codebase.

**`join fetch` in the query.** When the fetch is inherent to the query — when the joins also
filter, or you need `left` versus `inner` control a graph cannot express.

**A projection.** When entities are not what the caller needs at all. This is not a fetch plan;
it is the recognition that there was nothing to fetch.

**A fetch profile.** For the loads with nowhere to hang a plan, and for selective subselect
fetching ([13 · Fetch profiles](13-fetch-profiles.md)).

### The naming rule that does most of the work

```java
Optional<Order> findById(Long id);                 // header only
Optional<Order> findDetailById(Long id);           // + customer, address, lines, products
Page<OrderRow>  findRows(Status s, Pageable p);    // projection, no entities
```

**A repository method's name should imply its fetch plan, and one method should have exactly
one.** The alternative — a single `findById` that different callers wish behaved differently —
is how an association ends up `EAGER`: someone needed the customer, `findById` did not fetch it,
and the smallest change that worked was in the mapping.

This also makes the review question mechanical. A new call to `findById` followed by
`.getCustomer()` is visibly wrong in the diff, because the method name said what it fetched.

## The rule that makes it stick: entities do not leave the service layer

The individual practices above are hard to enforce one at a time. One boundary enforces most of
them at once: **the service layer returns DTOs; entities live inside `@Transactional` methods and
do not escape them.**

What follows automatically:

- **Serialisers cannot walk an association**, so the entire class of N+1s in
  [4c · Serialisation and logging](04c-serialization-and-logging.md) disappears.
- **Controllers cannot navigate**, so
  [open-session-in-view](15-open-in-view.md) becomes unnecessary and can be turned off, which
  restores `LazyInitializationException` as a build-time signal.
- **The fetch plan is forced to be complete inside the transaction**, because the mapping to the
  DTO happens there and would fail otherwise.
- **The API contract stops tracking the schema**, which is worth more than any of the above and
  has nothing to do with fetching.

The cost is real: a DTO per read shape, and mapping code. That cost is the actual subject of the
argument, and it should be argued on its merits rather than settled by whichever N+1 was most
recently painful.

## Where the discipline breaks in practice

**A shared mapper.** One `OrderMapper` used by three endpoints has to satisfy the union of their
needs, so it navigates everything, so every endpoint fetches everything. Per-shape mappers look
like duplication and are not — they are the place each call site's requirements are written down.

**A "detail" DTO that grows.** Every field added to a response adds an association to fetch. The
fetch plan and the DTO drift apart silently, and the count creeps back one field at a time.
Nothing catches this except an assertion on the statement count.

**Entities in caches, queues and events.** Publishing a managed entity on an event bus hands a
lazily-navigable object to a listener with no transaction. Publish identifiers or immutable
values.

**`toString`, `equals` and `hashCode`.** These are call sites too, they run everywhere, and one
of them reading an association re-creates the N+1 after every other fix worked
([4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)).

## Gotchas

**★ `fetch = LAZY` on a to-one is not a preference, it is a correction.** JPA's default is
`EAGER`, so leaving it off is choosing eager by omission — and it is the most common way an
application acquires eager mappings nobody decided on.

**★ "The mapping should default to lazy" is not "the mapping should say nothing".** Cardinality,
the owning side, cascade and orphan-removal rules all belong there, and getting *those* wrong
produces worse bugs than a fetch plan does.

**★ A batch size in the mapping does not excuse a missing fetch plan.** It bounds the damage; it
does not make a page of parents load in one statement. Treat it as the floor, not the answer.

**★ One repository method serving several fetch needs is the pressure that produces `EAGER`.**
Watch for a `findById` whose callers all immediately dereference something. That is a missing
method, not a missing eager mapping.

**★ A shared mapper defeats the whole boundary.** It converts several call sites' distinct needs
into one union, and the union is always the largest fetch plan of the three.

**★ Returning DTOs does not help if the DTO is built outside the transaction.** The mapping has
to happen where the persistence context is alive, which in practice means in the service, not in
the controller.

**★ The boundary is not free and pretending otherwise loses the argument.** A team that has been
told DTOs cost nothing will abandon the practice at the first thirty-field response. Say the cost
out loud, then say what it buys.

## Interview questions

**★ Why should fetch strategy live in the query rather than the mapping?**
Because a mapping is a statement about the model and is therefore the same for every caller,
while what to fetch differs per unit of work — the same association can want a SQL count on a
list page, batched loads in a report and a two-level join on a detail view. A mapping-level
decision has to be wrong for most call sites, and in the `EAGER` direction it is also
irreversible: the user guide is explicit that the eager strategy "cannot be overwritten on a per
query basis". Lazy is the minimal position that every call site can build on, which is why the
Hibernate documentation's own recommendation is to "use `LAZY` associations, and only fetch them
eagerly on a per-query basis".

**★ Is `@BatchSize` not a mapping-level fetch decision, and therefore the same mistake?**
It is mapping-level and it is a different category. It does not cause any load to happen — it
changes how loads that were going to happen anyway are grouped, resolving several uninitialised
proxies in one statement instead of one each. So it never forces a caller to fetch something, and
it is silently superseded wherever a call site declares a real plan, because a fetch-joined
collection arrives initialised. That is what a mapping-level default should look like: it lowers
the cost of the unplanned case and constrains nobody.

**★ What single rule prevents most N+1s?**
Entities do not leave the service layer. It removes serialisation walks, removes controller
navigation, makes open-session-in-view unnecessary so `LazyInitializationException` becomes a
useful signal again, and forces every fetch plan to be complete inside the transaction because
the mapping to the DTO happens there. It also decouples the API from the schema, which is the
better argument for it. The cost is a DTO per read shape, and that cost is real enough that the
rule fails on teams who were told it was free.

**★ How should repository methods be named and organised?**
One method per fetch plan, with a name that implies the plan — `findById` for the header,
`findDetailById` for the fully-fetched graph, `findRows` for the projection. It makes the
common review error visible in the diff, because a call to the lean method followed by a
dereference reads wrong on the page. And it removes the pressure that produces eager mappings: a
caller who needs more asks for a method rather than changing the model on everyone's behalf.

**★ Your team pushes back that DTOs are boilerplate. What is your answer?**
That they are, and that is the trade. What they buy is that the response shape is a decision
rather than an accident, that the API stops changing when the schema does, that a read endpoint
cannot accidentally write, and that the fetch plan is forced to be complete because the mapping
happens inside the transaction. If the boilerplate is genuinely the blocker, the negotiation I
would offer is DTOs on the read paths that are hot or public, entities on internal write paths,
and statement-count assertions everywhere — rather than abandoning the boundary entirely, which
puts you back to fetch plans that depend on which branches of a serialiser ran.

**★ You have applied this everywhere and an N+1 still appears. Where?**
Almost always in something that is a call site without looking like one: an `equals`, `hashCode`
or `toString` on the entity that reads an association and therefore runs inside every collection
operation and every log statement; a shared mapper that navigates the union of three endpoints'
needs; an event published with a managed entity attached; or a DTO that grew a field whose
association nobody added to the fetch plan. The structural fixes prevent the shapes you can see.
The assertion on the statement count is what catches the ones you cannot.

**★ Where does CQRS-style read/write separation fit into this argument?**
It is the same boundary taken further, and the argument for it here is narrower than the usual one.
The write side genuinely wants entities: identity, dirty checking, cascades and optimistic locking
are all doing real work when you are changing state. The read side wants none of that — it wants a
shape, once, cheaply — and every N+1 in this topic is a read path paying for machinery it does not
use. You do not need separate models or separate stores to get most of the benefit: projections on
the read paths and entities on the write paths is the same idea at a scale a normal service can
adopt in an afternoon.

**★ Does this argument change for a GraphQL API, where the client chooses the shape?**
It sharpens it, because the client now chooses the fetch plan and the client is not in your
repository. A GraphQL resolver per field is structurally an N+1 generator — a field resolver called
once per parent object is the shape from [4 · The shapes it hides in](04-the-shapes-it-hides-in.md)
with a framework wrapped around it. The mapping-level answer is the same as ever, lazy plus a batch
size, and the call-site answer becomes a batching layer that collects the identifiers requested
during one resolution pass and loads them in one statement. What does not work is the thing that
looks easiest: making the associations eager so every resolver finds its data already loaded, which
makes every query fetch the union of every possible client request.

---

← Prev: [17b · The second-level cache](17b-the-second-level-cache.md) · Index: [08 · The N+1 problem](README.md) · Next → [19 · The review checklist](19-the-checklist.md)
