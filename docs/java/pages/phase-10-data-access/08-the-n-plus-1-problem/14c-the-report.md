---
title: "Service two: the settlement report, where the parents are unbounded and there are two collections — the case that eliminates every join-based fix and leaves batching"
sidebar_label: "14c · Worked: the report"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12.8 *Batch fetching*,
> §12.9 *The `@Fetch` annotation mapping*, §12.11 *`FetchMode.SUBSELECT`*, §31.6 *Fetching*
> and Appendix A.7 *Fetch Related Settings* (`hibernate.default_batch_fetch_size`,
> `hibernate.use_subselect_fetch`)
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *Introduction* §9 *Fetching and lazy loading*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The second service is a monthly settlement report: every order settled in a period, each
one contributing its lines and its payments to a document. Same `Order`, same `lines`, and a
completely different right answer — because here the parent count is not a page, it is
however many orders the month had, and there are two collections rather than one. Those two
facts between them rule out every fix that joins, and they rule out the projection that was
correct for the list page.**

## The service as written

```java
@Transactional(readOnly = true)
public SettlementDocument build(YearMonth month) {
    List<Order> orders = orderRepository.findSettledBetween(
        month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant(),
        month.atEndOfMonth().atTime(LocalTime.MAX).toInstant(ZoneOffset.UTC));

    SettlementDocument doc = new SettlementDocument(month);
    for (Order order : orders) {
        doc.add(section(order));
    }
    return doc;
}

private Section section(Order order) {
    Section s = new Section(order.getId(), order.getSettledAt());
    for (OrderLine line : order.getLines()) {              // collection 1
        s.addLine(line.getProduct().getCode(),             // to-one, per line
                  line.getQuantity(), line.getAmount());
    }
    for (Payment p : order.getPayments()) {                // collection 2
        s.addPayment(p.getMethod(), p.getAmount());
    }
    return s;
}
```

## The evidence

**The count and its derivative.** The arithmetic of this shape: one statement for the
orders, one per order for `lines`, one per order for `payments`, and one per *line* for
`product`. So the count is not `2N + 1` — it is `1 + 2N + L`, where `L` is the total number
of lines across all orders. **The third level is the one people miss**, and it is the
largest term. A month with 4,000 orders averaging 5 lines is on the order of 4,000 + 8,000 +
20,000 statements. That nesting is exactly the multiplication
[4b · Three more shapes](04b-three-more-shapes.md) describes: nested walks multiply rather
than add.

**The call site.** Spread across `section` and the loops inside it — four separate
dereferences in a private method. There is no single place to attach a fetch plan, and the
repository method returns entities that three different loops navigate.

**What the caller does with the entities.** It reads them and builds a document. Read-only,
no mutation — so, like the list page, the entities are not needed *as entities*. But unlike
the list page, the **shape** genuinely is the graph: an order with its lines and its
payments, nested, per section.

**And one more fact the list page did not have: N is unbounded.** Not 25. However many
orders were settled, which grows every month and which nobody will notice growing.

## Why every join-based fix is out

**`join fetch` on both collections** is `MultipleBagFetchException` if both are `List`
([8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)). Change them both to
`Set` and the exception goes away and the real problem arrives: the SQL result is now the
cartesian product of lines and payments per order. An order with 5 lines and 3 payments
produces 15 rows; the report's whole month produces the sum of those products. That is the
trade [8e2 · The three ways out](08e2-the-three-ways-out.md) argues is being made for the
wrong reason — the statement count drops to 1 and the data volume goes up by a multiple that
nobody measured.

**`join fetch` on one collection and lazy on the other** halves the problem and leaves an
N+1. It also does not touch `line.product`, which is the largest term.

**An [entity graph](09-entity-graph.md)** is the same SQL with a nicer spelling, including the
cartesian product. A graph with two collection nodes joins twice, exactly as the query would.

**A projection** — the fix that was right for the list page — is wrong here for a reason
worth stating precisely: the output is **nested**. A flat projection over
`order × line × payment` reproduces the cartesian product in the projection instead of in the
entities. Two separate flat projections (one for lines, one for payments) stitched together
in memory by order id is a real and defensible design — it is two statements and no
duplication — but it means writing the join logic yourself, and it is only worth it if the
report is hot enough to justify the code. Say that out loud in review rather than pretending
the projection option does not exist.

## The fix

```java
@Entity
public class Order {

    @OneToMany(mappedBy = "order")
    @BatchSize(size = 100)
    private List<OrderLine> lines = new ArrayList<>();

    @OneToMany(mappedBy = "order")
    @BatchSize(size = 100)
    private List<Payment> payments = new ArrayList<>();
}

@Entity
public class OrderLine {

    @ManyToOne(fetch = FetchType.LAZY)
    @BatchSize(size = 200)
    private Product product;
}
```

`@BatchSize` does not join. The user guide's framing is that having "previously fetched
several `Department` entities", when you go to initialise the collection on each one, the
annotation "allows us to load multiple `Employee` entities in a single database round trip"
— that is, touching one uninitialised collection or proxy initialises **it together with
others of the same kind that are already loaded and still uninitialised, up to `size` of
them**, using an `IN` list rather than a join. So the shape becomes:
one statement for the orders, then a statement per batch of 100 orders for `lines`, a
statement per batch of 100 for `payments`, and a statement per batch of 200 for `product`.
The `1 + 2N + L` count collapses to something proportional to `N/100` and `L/200`, and — this
is the part that matters more than the count — **no row is ever duplicated.** Each entity is
returned exactly once. The mechanics, and how the batches are actually assembled, are
[10 · `@BatchSize`](10-batch-size.md).

Note the third annotation. Batching `Order.lines` and `Order.payments` fixes two of the three
terms; the largest one was `line.product`, and it needs its own. **Fixing the collections and
leaving the to-one is the most common way this fix is applied incompletely** — the count drops
by two thirds, the report is still slow, and everyone concludes batching "did not work".

### The global switch

```yaml
spring:
  jpa:
    properties:
      hibernate.default_batch_fetch_size: 100
```

Appendix A.7.1 describes `hibernate.default_batch_fetch_size` as specifying "the default value
for batch fetching", and is explicit about the alternative: "**By default, Hibernate only uses
batch fetching for entities and collections explicitly annotated `@BatchSize`.**"

Setting it globally is a defensible default for an application whose reports look like this one
— it turns "every lazy association batches" into the baseline and leaves `@BatchSize` for the
exceptions. It is a real behaviour change across every query in the application, so it belongs
in a deliberate decision with a re-measure, not in a config file someone edited to fix one
report.

## Why the fix does not stop there

`@BatchSize` fixes the statement count. It does not fix the other problem this service has:
**4,000 `Order` entities, plus their lines and payments and products, are all in one
persistence context at once.** That is the memory and flush-cost problem, and it is a separate
bug that the N+1 was hiding.

```java
@Transactional(readOnly = true)
public SettlementDocument build(YearMonth month) {
    SettlementDocument doc = new SettlementDocument(month);
    int page = 0;
    Page<Order> chunk;
    do {
        chunk = orderRepository.findSettledBetween(from, to, PageRequest.of(page++, 500));
        chunk.forEach(order -> doc.add(section(order)));
        entityManager.clear();
    } while (chunk.hasNext());
    return doc;
}
```

Chunking bounds the context; `clear()` detaches what has been processed
([../06-jpa-hibernate-model/13c-remove-refresh-detach-clear.md](../06-jpa-hibernate-model/13c-remove-refresh-detach-clear.md)).
⚠️ And note the interaction with the fix: **batching works within the loaded set**, so a
chunk of 500 with a batch size of 100 gives five statements per collection per chunk. Chunk
size and batch size should be chosen together — a chunk of 20 makes a batch size of 100
meaningless.

⚠️ Chunking with `Pageable` over data that is changing underneath you can skip or repeat rows
between pages. For a settlement report over a closed month that is not a concern; for a report
over live data, key-set pagination on `settledAt` plus id is the safer shape.

## Gotchas

**★ The deepest N+1 is the biggest and the least visible.** `line.product` runs once per line,
not once per order, so it dominates the count while looking like the innermost, least important
loop in the code.

**★ Batching the collections and forgetting the to-one is the classic incomplete fix.** Two
thirds of the statements disappear and the report stays slow, which is exactly the evidence
someone needs to argue the fix does not work.

**★ Turning both `List`s into `Set`s to escape `MultipleBagFetchException` converts an
exception into a cartesian product.** The build stops failing and the report starts moving a
multiple of the data. An exception you can see is better than a multiplication you cannot.

**★ `@BatchSize` changes behaviour for every caller of that mapping.** That is a feature here
— the report has no single call site — and a liability elsewhere. Anything that loads one
`Order` and touches `lines` now also batches, which is harmless, but the decision is global and
should be recorded as such.

**★ `hibernate.default_batch_fetch_size` is off unless you set it.** The documentation says
batch fetching is used only where `@BatchSize` appears. A codebase with no `@BatchSize`
annotations is doing no batching at all, however many articles about it are in the team wiki.

**★ Batching does not survive a persistence context that is cleared between touches.** The
batch is assembled from proxies already loaded and still uninitialised in the *current*
context. Clear the context between processing each order and every collection initialises
alone — you keep the memory fix and lose the batching one.

**★ Chunk size and batch size interact and are usually chosen independently.** A chunk smaller
than the batch size silently caps the batch. Pick the chunk size for memory, then set the batch
size no larger than it.

**★ A read-only transaction is not a licence to hold 4,000 entities.** `readOnly = true`
avoids the flush cost; it does not avoid the heap. The N+1 fix makes the memory problem worse
by making it faster to reach.

## Interview questions

**★ The report N+1s on two collections. Why not fetch-join both?**
Because two bags is `MultipleBagFetchException`, and the workaround — making them both `Set` —
replaces the exception with a cartesian product: every order returns lines × payments rows, and
the report's total row count is the sum of those products across the month. The statement count
would fall to one and the volume of data crossing the wire would rise by a multiple nobody
measured. When there is more than one collection, the question stops being "how do I join this"
and becomes "how do I avoid joining this", which is what batching and subselect fetching are
for.

**★ Why is a projection the right answer for the list page and the wrong one here?**
Because the list page's output was flat — six scalars per row — and this one's is nested. A
single flat projection over orders, lines and payments reproduces the same cartesian product in
the result set that the fetch join would have produced in the entities; you have moved the
multiplication, not removed it. Two flat projections stitched by order id in memory is a
genuine alternative, and it is more code and more test surface, so it is worth doing when the
report is hot and worth skipping when it is not. The general rule: projections are strongest
when the output shape is flat and weakest when it is a tree.

**★ How do you choose the batch size?**
By what bounds the statement count without producing an unwieldy `IN` list, and by the chunk
size you are already using. Values around 100 are a common starting point for collections and
somewhat larger for to-one proxies, because a to-one batch is a simple `IN` on the primary key.
The constraints that actually matter are the database's limit on parameters in an `IN` list and
the fact that the batch can only be as large as the number of uninitialised proxies present in
the context — so a batch size larger than the chunk size does nothing at all. Then re-measure,
because the right answer is a property of the data, not of the annotation.

**★ Batching fixed the count. Is the report fixed?**
No — the N+1 was hiding a second problem. Loading a month of orders with their lines, payments
and products into one persistence context is a heap problem and a flush-cost problem
independent of how many statements it took. The complete fix chunks the parents and clears the
context between chunks, sized so that the chunk is at least as large as the batch. Fixing only
the statement count converts a slow report into a fast one that runs out of memory in a busier
month, which is a worse failure than the one you started with.

**★ Would you set `hibernate.default_batch_fetch_size` globally instead of annotating?**
Sometimes, and deliberately. It changes the default for every lazy association in the
application, which is a large blast radius for a config line, and it makes the fix invisible at
the mapping — a reader of `Order` sees no annotation and no reason to think batching is
happening. The case for it is an application where the report shape is the norm rather than the
exception, in which case the annotation-per-association approach means remembering it forever
and forgetting it once. I would treat it as an architectural decision with a measurement, not a
tuning knob.

**★ When would subselect fetching beat batching here?**
When the parents were loaded by a query that can be re-run cheaply, because subselect fetching
issues one statement per collection for *all* the parents rather than one per batch — so the
count stops depending on the parent count entirely. It is the better fix for a single query over
a large result set. It is the worse fix here as soon as the report chunks, because each chunk
re-runs the subquery, and it is unavailable per-use-case except through a fetch profile
([13b · Enabling a profile](13b-enabling-and-the-default-profile.md)). Batching is chosen
because the parents arrive across many call sites and many chunks, not because it is faster in
the abstract.

---

← Prev: [14b · Worked: the list page](14b-the-list-page.md) · Index: [08 · The N+1 problem](README.md) · Next → [14d · Worked: the detail view](14d-the-detail-view.md)
