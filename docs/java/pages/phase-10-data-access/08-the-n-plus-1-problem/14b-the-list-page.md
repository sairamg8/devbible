---
title: "Service one: the order list page, where the right fix is to stop loading entities — and every fetch plan you could have applied instead would have been slower and more fragile"
sidebar_label: "14b · Worked: the list page"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12 *Fetching* and §31.6
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §9 *Fetching and lazy loading*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Jakarta Persistence 3.2 specification's JPQL constructor expression
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/))
> and the Spring Data JPA 4.1 reference on projections and paging
> ([docs.spring.io/spring-data/jpa/reference/](https://docs.spring.io/spring-data/jpa/reference/)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Three services, three N+1s, three different fixes — and in all three cases the *same*
association is involved. This is the first: a paged order list that renders 25 rows of
customer name, status, total and item count. It is the most common N+1 shape in any
application, the one a fetch join appears to solve, and the one where applying a fetch join
is a mistake you will still be paying for in a year.**

## The service as written

```java
@GetMapping("/orders")
public Page<OrderRow> list(Pageable pageable) {
    return orderRepository.findByStatus(Status.OPEN, pageable)
                          .map(this::toRow);
}

private OrderRow toRow(Order order) {
    return new OrderRow(
        order.getId(),
        order.getCustomer().getName(),      // to-one
        order.getStatus(),
        order.getPlacedAt(),
        order.getTotal(),
        order.getLines().size()             // collection
    );
}
```

Nothing here is unusual and nothing here looks wrong. `findByStatus` is a derived finder,
`Order.customer` is `@ManyToOne(fetch = LAZY)`, `Order.lines` is
`@OneToMany(mappedBy = "order")`, and both are dereferenced inside a mapping method that
reads like plain object code.

## The evidence

Run the three measurements from [14 · Choosing a fix](14-choosing-a-fix.md).

**The count and its derivative.** Work out the shape before measuring, so you know what you
are looking for: one query for the page, then one per row for `customer`, then one per row
for `lines` — so a page of 10 should cost about 21 statements and a page of 25 about 51.
A count that tracks that arithmetic when you take it is confirmation; a count that stays flat
means the association was already being fetched some other way and you are looking at the
wrong problem. Two N+1s stacked like this is the ordinary case, not a pathological one — the
shapes chunk ([4b · Three more shapes](04b-three-more-shapes.md)) covers why they arrive in
pairs.

**The call site.** `toRow`, not the repository. This is the detail that decides the
outcome: the association is not navigated by the query, it is navigated by the mapper, one
row at a time, after the query has returned.

**What the caller does with the entities.** It reads six values off them and throws them
away. It does not mutate. It does not flush. It does not hold a reference past the response.
**The persistence context is doing bookkeeping for 25 entity graphs so that six scalars per
row can be read out of them.**

That third fact is the whole answer, and every fix below that ignores it is a fix that
optimises the loading of objects that should not have been loaded.

## The fixes that would have "worked"

It is worth walking these, because each of them is what a competent developer proposes in
review and each of them is worse.

**`left join fetch o.customer left join fetch o.lines`.** Two problems at once. The
collection fetch join collides with `Pageable`, which is the pagination conflict
[8d · Pagination](08d-pagination.md) exists for; and the join multiplies the result — 25
orders averaging 4 lines is 100 SQL rows carrying 25 orders' worth of duplicated parent
columns, so Hibernate can hand you 25 objects. All of that to compute `lines.size()`.

**An [entity graph on the finder](09g-spring-data-entitygraph.md).** Cleaner to write and identical
underneath — the same join, the same multiplication, the same paging conflict for the
collection. Attaching the plan to the call rather than the query text does not change what
the SQL does.

**[`@BatchSize` on the association](10-batch-size.md).** This one genuinely fixes the
statement count, and it does so without multiplying rows or breaking paging: instead of 25
statements for `lines` you get a small fixed number using an `IN` list. It is a good fix,
and it is still the wrong one here — because it makes the loading of 25 full `OrderLine`
graphs efficient rather than making it unnecessary. You are now fetching every column of
every line to call `size()` on the collection.

**A fetch profile** ([13 · Fetch profiles](13-fetch-profiles.md)). Same objection, plus a
session-wide switch to reason about.

Notice the pattern: every one of those answers "how do I load this in fewer statements", and
none of them answers "why am I loading this".

## The fix

```java
public record OrderRow(
    Long id,
    String customerName,
    Status status,
    Instant placedAt,
    BigDecimal total,
    long lineCount
) {}
```

```java
@Query("""
       select new com.example.orders.OrderRow(
           o.id, c.name, o.status, o.placedAt, o.total, count(l.id))
       from Order o
       join o.customer c
       left join o.lines l
       where o.status = :status
       group by o.id, c.name, o.status, o.placedAt, o.total
       """)
Page<OrderRow> findRows(@Param("status") Status status, Pageable pageable);
```

**One statement, and it stays one statement at any page size.** The `count(l.id)` is
computed by the database, which is where counting belongs; the `join o.customer` is an inner
join rather than a fetch join, so it contributes columns to the projection without
populating an association; and because nothing returned is an entity, there is no
persistence context bookkeeping, no proxies, no dirty checking at flush, and nothing left
for a later `toRow` to navigate.

Three details in that query are load-bearing and are the ones people get wrong.

**`join` versus `join fetch`.** The customer is joined, not fetched. `fetch` is what
populates an association on a returned entity, and there is no returned entity here — the
constructor expression selects `c.name` directly. Writing `join fetch` in a query with a
constructor expression is a category error; the guide is explicit that a fetch clause is
meaningful only where the query's result is the thing being fetched onto.

**`left join o.lines`, not `join`.** An inner join drops orders with no lines. The count for
those orders should be zero and the row should still appear. This is the same trap
[8 · join fetch](08-join-fetch.md) flags for fetch joins, and it bites just as hard in a
projection — with the extra unpleasantness that the row simply vanishes from the page rather
than showing a wrong number.

**Every non-aggregated column is in `group by`.** PostgreSQL will reject the statement
otherwise, and the error arrives at runtime, from the database, in whatever integration test
first exercises the query. Listing them is tedious and there is no way around it in
standard JPQL.

### The Spring Data alternative

An interface projection is less typing when the shape is simple:

```java
public interface OrderRowView {
    Long getId();
    String getCustomerName();
    Status getStatus();
    Instant getPlacedAt();
    BigDecimal getTotal();
    long getLineCount();
}
```

⚠️ The two are not equivalent, and the difference matters for exactly this bug. A
**closed** interface projection over a derived query lets Spring Data restrict the selected
columns; but a projection whose accessors are backed by an `@Query` returning entities, or
whose methods are default methods navigating the entity, does not — it will materialise
entities and the N+1 comes straight back. If you use interface projections to fix an N+1,
verify the statement count afterwards rather than assuming. The mechanics are
[12c · Spring Data projections](12c-spring-data-projections.md).

## What this buys beyond the statement count

**It is robust against the next developer.** The other fixes leave `Order.lines` in place,
lazily loadable, one dereference away from the bug returning. `OrderRow` has no `lines`. A
future requirement to show line descriptions on the list page has to change the query, which
is visible in review, rather than adding `order.getLines().get(0)` to a mapper, which is not.

**It removes a class of correctness bug too.** Entities returned from a read-only endpoint
are managed until the persistence context closes, which means an accidental setter call in a
mapper is an `UPDATE` at flush time. A record cannot do that.

**It makes the page's cost independent of the association graph.** Add a third collection to
`Order` next quarter and this endpoint does not notice. Every entity-based fix would have to
be revisited.

## When this fix is wrong

Being honest about the boundary matters as much as the recommendation.

- **When the caller mutates.** A projection is read-only by construction; if the service
  updates the orders it just listed, load entities.
- **When the shape is genuinely the entity graph.** An export that serialises orders with all
  their lines and payments is not better served by a projection with twenty fields; that is the
  detail-view case, and the third service works it through.
- **When there are many such queries and the DTOs multiply.** A projection per endpoint is
  real maintenance cost. It is usually worth it, and it is not free, and pretending otherwise
  is how teams end up with forty near-identical records.
- **When the page must also sort by a computed value.** `order by count(l.id)` in a paged
  query is legal but the interaction with `Pageable`'s sort handling is fiddly; check what SQL
  you actually get before shipping it.

## Gotchas

**★ The N+1 is in the mapper, not the repository, so the repository looks innocent.** Every
review that stares at `findByStatus` finds nothing wrong with it. The bug lives in `toRow`,
which reads like data transformation rather than data access.

**★ `getLines().size()` initialises the whole collection.** It does not issue a `count`. It
fetches every row of every line to compute a number the database could have returned. This is
one of the most expensive cheap-looking calls in JPA.

**★ An inner join in a projection silently removes rows.** Unlike the fetch-join version, you
do not even get a wrong count — the order disappears from the page and the total row count is
off by however many orders have no lines.

**★ `join fetch` inside a constructor expression does not mean anything.** There is no entity
being returned for the fetch to populate. Depending on the query it is either rejected or
merely useless, and either way it signals that the author has not decided whether this query
returns entities or values.

**★ Forgetting `group by` on a column produces a database error, not a JPQL one.** It surfaces
at runtime from PostgreSQL, so a query that compiles and deploys can fail on first execution.

**★ An interface projection is not automatically a column restriction.** Backed by an
`@Query` that selects entities, or with default methods that navigate them, it materialises the
full graph and projects afterwards — the N+1 survives behind a shape that looks like a fix.

**★ Replacing entities with a record does not fix the *other* endpoints.** `Order.lines` is
still lazy and still there. This fix is deliberately call-site-scoped; the report and the
detail view are separate decisions, which is the point of the next two chunks.

## Interview questions

**★ The list page N+1s on two associations. Why not just fetch-join both?**
Because one of them is a collection and the query is paged, which is the conflict that makes
collection fetch joins and row limits disagree; and because fetching the collection multiplies
the result set — 25 orders with four lines each is 100 rows of duplicated parent columns — to
produce a number the database could have computed with `count`. Even setting the paging problem
aside, the query would be moving several times the data for a strictly worse outcome. The
statement count would look better and the endpoint would not be.

**★ Why is a projection preferable to `@BatchSize` here, when `@BatchSize` also fixes the
count?**
`@BatchSize` makes loading the entities efficient; the projection makes loading them
unnecessary. The caller reads six scalars and discards the objects, so every column of every
`OrderLine` that a batch fetch brings back is waste — efficiently retrieved waste, but waste.
The projection also removes the association from the returned type entirely, so the bug cannot
be reintroduced by a later change to the mapper, whereas with `@BatchSize` the lazy association
is still sitting there one dereference away.

**★ Is `getLines().size()` really a problem? It looks like a cheap call.**
It initialises the collection. Hibernate has no way to answer `size()` without loading the
collection's contents, so a call that reads like arithmetic issues a select and materialises
every `OrderLine` for that order — with all its columns, and with its own associations now
navigable and lazily loadable. Across a page of 25 that is 25 statements and potentially
hundreds of entities in the persistence context, all to produce 25 integers. Wanting a count is
a strong signal that you want a projection.

**★ You are told the team standard is "always return entities from repositories". How do you
argue this change?**
On correctness before performance. Entities returned to a read-only endpoint stay managed until
the context closes, so an accidental setter in a mapper becomes an `UPDATE`; they carry
associations that make the next N+1 a one-line change away; and they couple the wire format to
the schema, so a column rename becomes an API change. The performance argument — one statement
instead of 51, no result-set multiplication, cost independent of the association graph — is real
but it is the second argument. The first is that a read endpoint returning a mutable managed
object is a category error.

**★ How would you stop this regressing?**
A test that asserts the statement count for the endpoint at two different page sizes and fails
if it moves, which is what [6b · Asserting the count](06b-asserting-the-count-in-a-test.md)
builds. Asserting a single count is weaker than asserting it does not grow — the whole signature
of this bug is a count that scales with rows, so measuring at 10 and at 25 and requiring
equality is the assertion that actually encodes the property you care about.

**★ The entities are already loaded and you only need the count. Is there anything better than
`getLines().size()`?**
Yes — `Hibernate.size(order.getLines())`, which the javadoc documents as obtaining the size
"without fetching its state from the database". Same for `Hibernate.isEmpty` and
`Hibernate.contains`. It still costs a statement per call, so across a page of parents it is a fix
for data volume rather than for statement count, and a projection that counts in SQL remains
better when you control the query. But when you are handed already-loaded entities and asked for a
number, it is the correct call and almost nobody knows it exists.

---

← Prev: [14 · Choosing a fix](14-choosing-a-fix.md) · Index: [08 · The N+1 problem](README.md) · Next → [14c · Worked: the report](14c-the-report.md)
