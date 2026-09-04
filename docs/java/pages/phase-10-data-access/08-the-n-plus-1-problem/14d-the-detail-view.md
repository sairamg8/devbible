---
title: "Service three: the order detail view, where N is one and almost everything works — which is why this is the case that teaches you the fix is a property of the call site, not the association"
sidebar_label: "14d · Worked: the detail view"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12.5 *Dynamic fetching via
> queries*, §12.6 *Dynamic fetching via Jakarta Persistence entity graph*, §12.8 *Batch
> fetching* and §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §9 *Fetching and lazy loading*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Jakarta Persistence 3.2 specification's `EntityGraph` and JPQL fetch join
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The third service loads one order and renders everything about it: the customer, the
shipping address, the lines with their products, and the payments. It has the same
associations and the same missing fetch plan as the other two, and the right answer is
different again — because `N` is one. Almost every fix works here, which sounds like good
news and is actually the point: when the constraint disappears, what is left is a design
choice, and the detail view is where you learn which fix you would have picked for the right
reasons.**

## The service as written

```java
@GetMapping("/orders/{id}")
@Transactional(readOnly = true)
public OrderDetail detail(@PathVariable Long id) {
    Order order = orderRepository.findById(id)
                                 .orElseThrow(OrderNotFound::new);
    return OrderDetail.from(order);   // touches customer, address, lines, products, payments
}
```

## The evidence

**The count and its derivative.** One statement for the order, one for `customer`, one for
`shippingAddress`, one for `lines`, one per line for `product`, one for `payments`. The
arithmetic is `5 + L` where `L` is the number of lines on this one order. **And it does not
grow with the number of orders in the system — it grows with the size of one order.**

That is the crucial difference from the previous two services, and it changes what the number
means. Ten statements for a detail view is not the same problem as ten thousand for a report,
even though both are "an N+1". The unbounded case is a scaling bug; the bounded case is
avoidable waste. Both are worth fixing and only one of them is an incident.

**The call site.** `findById` — a Spring Data method you did not write — followed by
navigation inside `OrderDetail.from`. So the query text is not yours, which normally rules
out `join fetch`; but nothing stops you adding a repository method that is yours.

**What the caller does with the entities.** Reads them into a DTO. As with the list page, the
entities are strictly speaking not needed — and unlike the list page, the shape being read
*is* the graph, and the answer to "should this be a projection" is genuinely arguable rather
than obvious.

## Why entities, honestly

The list page went to a projection because the output was six flat scalars. Here the output is
a tree with the same shape as the entity graph, and three arguments push the other way:

- **A projection of a tree is several queries stitched by hand.** You would select the order
  header, the lines, and the payments separately and assemble them — which is what the
  entity fix does for you, correctly, with less code.
- **The detail path is usually shared with the command path.** The service that renders the
  order is very often the one that later cancels a line or applies a credit, and having one
  well-fetched load used by both is worth more than saving a persistence context on the read.
- **At `N = 1` the cost arguments against entities are small.** One managed graph, one flush
  check, bounded by one order. The reasons to avoid entities on the list page were all
  multiplied by the page size.

None of these are absolute. A detail endpoint that is purely a read, is very hot, and never
shares code with a write is a perfectly good candidate for two projections. Say which of these
applies rather than applying a rule.

## The fix

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("""
           select o from Order o
           join fetch o.customer
           join fetch o.shippingAddress
           left join fetch o.lines l
           left join fetch l.product
           where o.id = :id
           """)
    Optional<Order> findDetailById(@Param("id") Long id);
}
```

Two statements in total: this one, and one more for `payments` when it is touched — because
`Order.payments` still carries the `@BatchSize` added for the report
([14c · Worked: the report](14c-the-report.md)), and a batch of one is still a single
statement.

Four things in that query are deliberate.

**`join fetch` on the to-ones, not `left join fetch`.** `customer` and `shippingAddress` are
mandatory on this model, so an inner join is correct and slightly cheaper. If either were
optional, an inner join would make the whole order vanish from the result — the
disappearing-parent trap from [8 · join fetch](08-join-fetch.md), which at `N = 1` presents as
a 404 for an order that exists.

**`left join fetch` on `lines`.** An order with no lines must still load.

**`left join fetch l.product`** — fetching two levels deep in one statement. This is the term
that was `L` statements, and it is the one most often left out because it is the innermost.
Deep fetch joins are legal and are exactly what you want at `N = 1`.

**`payments` is deliberately not fetched.** Adding `left join fetch o.payments` would be a
second bag — `MultipleBagFetchException`
([8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)) — and even with `Set`
collections it would multiply the result by the payment count. One order with 5 lines and 3
payments becomes 15 rows to carry 8 child objects. **At `N = 1` the cartesian product is
bounded, which makes it tolerable, not free.** Leaving the second collection to a batched or
lazy load costs one extra statement and no duplication, which is the better trade.

### The entity graph alternative

```java
@EntityGraph(attributePaths = {"customer", "shippingAddress", "lines", "lines.product"})
Optional<Order> findWithDetailById(Long id);
```

Same SQL, no query text, and the plan is attached to the call rather than fused into it — so
the same derived finder can be reused with a different graph elsewhere. **This is the better
default of the two**, and the reason the `@Query` version is shown first is that it makes the
generated joins visible while you are learning what the fix does. The mechanics, including
subgraph syntax and `fetchgraph` versus `loadgraph`, are
[9 · Entity graphs](09-entity-graph.md).

## The punchline

**`Order.lines` — one association — got three different treatments across three services:**

| Service | `N` | Fix for `Order.lines` |
|---|---|---|
| List page | a page of parents | **not loaded at all** — the projection counts in SQL |
| Report | unbounded parents, two collections | **`@BatchSize`** — batched, never joined |
| Detail view | one parent | **`left join fetch`** — joined, two levels deep |

The mapping did not change between them. `Order.lines` is `@OneToMany(mappedBy = "order")`,
lazy, with a batch size, in all three. **What changed was the call site**, and that is the
whole argument of [18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md):
the mapping's job is to describe the relationship and default to lazy; the query's job is to
declare what this particular unit of work needs.

Note also that the fixes compose without fighting. The detail view's fetch join **overrides**
the batch size for `lines` in that query — the collection arrives initialised, so there is
nothing left for batching to do — while the batch size still serves `payments` in the same
request. A mapping-level default and a call-site override are the right shape precisely because
the override silently wins where it applies and the default silently covers everything else.

## Gotchas

**★ `join fetch` on an optional to-one turns "order exists" into 404.** The inner join drops
the row. At `N = 1` there is no partial result to notice — the whole response disappears — so
this presents as a bug in the lookup rather than a bug in the fetch plan.

**★ The two-level fetch (`l.product`) is the term people leave out.** It is the innermost loop
and the largest count, exactly as in the report, and it is invisible in a query that already
looks like it has been optimised.

**★ "N is one so it does not matter" is how a detail view becomes a report.** The same service
method gets called in a loop by a bulk export six months later, and the bounded waste becomes
unbounded. Fixing it while it is bounded is cheap.

**★ Fetching both collections because the product is bounded.** It is bounded and it is still
a multiplication — 15 rows for 8 objects — and it costs you a `MultipleBagFetchException` if
both are `List`. One collection per fetch join remains the rule even when the parent count is
one.

**★ Adding the fetch plan to `findById` itself.** Tempting, and wrong: `findById` is used by
every other code path, including the ones that only want the header, and Spring Data's
`findById` participates in `getReference` and cascade behaviour. Add a new method with a name
that says what it fetches.

**★ A fetch join and a `@BatchSize` on the same association is not a conflict.** The join wins
where it applies because the collection arrives initialised; the batch size covers the call
sites that did not join. Having both is the normal, healthy state, not a mistake to tidy up.

## Interview questions

**★ Everything works at `N = 1`. So why bother fixing it?**
Because "N is one" is a property of today's call site, not of the code. A detail-view service
method is the single most likely thing in an application to end up inside a loop — a bulk
export, a reconciliation job, a batch notification — and at that point six statements per order
becomes six thousand. Fixing it while it is bounded costs one repository method; fixing it after
it is unbounded costs an incident. There is also a smaller, immediate reason: six round trips is
six times the latency of one, and on a detail page that is user-visible.

**★ Why not fetch-join the payments too, given there is only one order?**
Because it is a second bag, so with `List` collections it raises `MultipleBagFetchException`,
and with `Set` collections it produces the cartesian product of lines and payments — fifteen SQL
rows to deliver eight child objects for a five-line, three-payment order. That product is bounded
by one order, so it is survivable rather than dangerous, but it buys nothing: leaving payments to
a lazy or batched load costs exactly one extra statement and no duplication. The rule "at most one
collection per fetch join" holds regardless of parent count; what changes with parent count is how
badly breaking it hurts.

**★ Fetch join or entity graph for this endpoint?**
Entity graph, for reuse. The plan attaches to the call rather than to query text, so
`findWithDetailById` and a leaner `findById` can serve the same rows with different plans without
duplicating a query string, and the attribute paths are a declaration of intent that reads better
in review than a five-line JPQL block. I would use `@Query` with `join fetch` when the fetch is
genuinely inherent to the query — when the joins also filter, or when I need `left` versus `inner`
control the graph cannot express.

**★ The same association was fixed three different ways across three services. Is that not
inconsistent?**
It is the opposite — it is what consistency actually looks like. The mapping says the same thing
in all three cases: this is a lazy one-to-many with a sensible batching default. Each call site
then declares what that unit of work needs, because a page of 25 rows, an unbounded report and a
single detail load genuinely have different requirements. The inconsistent design is the one that
picks a single fetch strategy in the mapping and forces all three call sites to live with it —
which is what `EAGER` does, and why it is the subject of its own chunk.

**★ Would you consider a projection for this endpoint?**
Yes, and I would probably not choose it. The output is a tree, so a projection means two or three
flat queries stitched together in application code — more code and more test surface than the
fetch plan, for a load whose cost is already bounded by one order. The cases that would flip my
answer are a very hot endpoint where the persistence-context overhead shows up in a profile, or a
read path that is genuinely separate from any write path and could therefore be typed as
read-only end to end. The list page went the other way because its output was flat and its cost
was multiplied by the page size; neither is true here.

**★ How do you make sure this stays fixed?**
The same way as the other two: a test asserting the statement count for the endpoint, plus — and
this one is specific to fetch joins — an assertion that the returned graph is actually initialised
before the transaction ends. A fetch plan that silently stops applying (someone changes the
repository method the controller calls) shows up as a `LazyInitializationException` only if
open-session-in-view is off. With Boot's default leaving it on, the same regression shows up as a
quietly slower endpoint and nothing else, which is the subject of the next chunk.

**★ The detail service is now called in a loop by a new bulk endpoint. What changes?**
Every constraint that was slack becomes tight. The two statements per order become two thousand;
the cartesian product that was bounded by one order is now summed across all of them if anything
fetch-joins a second collection; and the persistence context accumulates every order and its graph
with no boundary at which to clear it. The fix is not to tune the detail method — it is to accept
that a bulk operation is a different call site with different requirements, and give it its own
query, chunked, with batching, exactly as the report has. Reusing a single-parent load inside a
loop is the most reliable way to turn a good fetch plan into a bad one.

**★ Why show the `@Query` version before the `@EntityGraph` version if the graph is the better
default?**
Because the JPQL makes the generated joins visible while you are deciding what the fix should be,
and the graph does not. `left join fetch l.product` reads as "one statement, two levels deep, outer
join so orders with no lines survive"; `attributePaths = {"lines", "lines.product"}` says what to
fetch and is silent about inner versus outer and about how many statements result. Once you know
what the plan does, the graph is the better artefact — it is shorter, attaches to the call rather
than the query text, and can be varied per method. It is a worse teaching tool and a better
production one.

---

← Prev: [14c · Worked: the report](14c-the-report.md) · Index: [08 · The N+1 problem](README.md) · Next → [15 · Open session in view](15-open-in-view.md)
