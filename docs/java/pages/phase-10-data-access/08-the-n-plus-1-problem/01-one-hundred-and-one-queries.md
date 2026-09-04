---
title: "You asked for one hundred orders and got one hundred and one queries — and every single one of them was fast"
sidebar_label: "1 · 101 queries"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.4 *Association fetching* and §8.5 *Batch fetching and subselect fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 user guide §17.8.4 *join fetch for association fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the `org.hibernate.annotations.FetchMode` javadoc in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/annotations/FetchMode.java)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Before any definition, look at the code. It is nine lines, every line is
ordinary, and it issues one hundred and one SQL statements where you expected
one. Nothing in the source says so. That gap — between what the Java says and
what the database sees — is the entire subject of this topic.**

## The code

Two entities. An order, and the lines on it.

```java
@Entity
class Order {
    @Id @GeneratedValue Long id;
    String reference;
    Instant placedAt;

    @OneToMany(mappedBy = "order")          // LAZY — that is the JPA default for @OneToMany
    List<OrderLine> lines = new ArrayList<>();
}

@Entity
class OrderLine {
    @Id @GeneratedValue Long id;
    @ManyToOne Order order;
    String sku;
    int quantity;
    BigDecimal unitPrice;
}
```

A repository, and a service that turns orders into a summary.

```java
interface OrderRepository extends JpaRepository<Order, Long> { }

@Service
class OrderSummaryService {

    private final OrderRepository orders;

    @Transactional(readOnly = true)
    public List<OrderSummary> summarise() {
        return orders.findAll().stream()              // ① one query
                .map(o -> new OrderSummary(
                        o.reference,
                        o.lines.size(),               // ② a query, per order
                        o.lines.stream()
                               .map(l -> l.unitPrice.multiply(BigDecimal.valueOf(l.quantity)))
                               .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }
}

record OrderSummary(String reference, int lineCount, BigDecimal total) {}
```

Read it again as a reviewer would. There is no loop that looks like a loop over
the database. There is no query in it at all except `findAll()`. It is a stream,
a map, and a fold — the shape everyone is taught to prefer.

## What actually runs

Line ① runs one `select` and gets one hundred `Order` rows back. Each one has a
`lines` field, and each of those fields holds not a list of order lines but a
**lazy collection proxy** — an object that knows the owning order's id and knows
how to go and fetch the rows if anybody ever asks.

Line ② asks. `o.lines.size()` cannot be answered without the rows, so the proxy
initialises itself, which means a `select` against `order_line` for one
`order_id`. Once initialised it stays initialised, so the `o.lines.stream()` on
the next line is free.

One hundred orders, one hundred initialisations, plus the original query.

**101 SQL statements. The developer wrote one.**

That is N+1: **N** queries to fill in the associations, plus the **1** you asked
for. The Hibernate 7.4 guide states the shape in exactly those terms:

> *"Here, a list of `N` rows is retrieved from the database in an initial query,
> and then associated instances of a related entity are fetched using `N`
> subsequent queries."*

## The arithmetic is the point

Rewrite the count as a function of the data, because that is what makes it a
production problem rather than a style problem:

| Orders in the result | SQL statements |
|---|---|
| 1 | 2 |
| 10 | 11 |
| 100 | 101 |
| 10,000 | 10,001 |

**The query count is a function of the row count, and the row count is a
function of how successful the business is.** A page that was correct and fast
on the day it shipped gets slower every week, in proportion to growth, with no
code change to blame it on. There is no other common bug in Java with that
property.

The general statement of the rule, whose fault it is, and what Hibernate calls it
in its own source are [chunk 1b](01b-the-general-rule.md).

## Gotchas

**⚠️ `size()` is not a cheap call on a lazy collection.**
It reads like `List.size()`, which is O(1) on an `ArrayList`. On an uninitialised
Hibernate collection it is a database round trip that materialises every row.
There is a narrow exception — an extra-lazy mapping could answer `size()` with a
`count` query — but on a plain `@OneToMany` the whole collection is loaded to
answer it.

**⚠️ The bug does not reproduce in your unit test.**
Your test has two orders, so it issues three queries instead of one and finishes
in single-digit milliseconds. The assertion passes. Nothing about a green test
distinguishes 3 statements from 3,001 — which is why
[chunk 6b](06b-asserting-the-count-in-a-test.md) argues for asserting on the
count itself.

**⚠️ Streams and method references hide it better than `for` loops do.**
`orders.stream().map(o -> o.lines.size())` is the same loop as
`for (Order o : orders) { o.getLines().size(); }`, but the functional form reads
as a transformation rather than as an iteration, and reviewers scan it as data
shaping. The idiom that is better style is worse at exposing this particular bug.

**⚠️ It is not a `findAll()` problem.**
`findAll()` makes a good demonstration because the N is obviously unbounded, but
any query returning more than a handful of parents does the same thing —
`findByStatus`, a paginated page of 50, a `@Query` with a `where` clause. Pruning
`findAll()` out of the codebase does not remove the shape.

**⚠️ The lines were already loaded, so you conclude there is no bug.**
If the same persistence context already fetched those `OrderLine` rows for
another reason, the collection initialises from the first-level cache and no SQL
runs. The bug is still there; it is masked by state left over from earlier in the
same transaction, and it comes back the moment the call is made first instead of
second.

**⚠️ Counting the queries by reading the code.**
You cannot. The count is `1 + N` where N is a runtime value — the number of rows
this particular call happened to return. No amount of static reading gives you a
number, which is precisely the property that makes this bug survive review.

## Interview questions

**★ What is the N+1 selects problem? Give a concrete example.**
It is issuing one query to fetch a list of N parent rows and then N further
queries — one per parent — to fetch an association, when a single query could
have fetched everything. The canonical example is a `findAll()` returning 100
orders followed by any code that touches each order's lazily-mapped `lines`
collection: the first `select` returns the orders, and then each collection proxy
initialises itself with its own `select` against `order_line` filtered by one
`order_id`, giving 101 statements in total. The essential property is that the
statement count is a function of the number of rows returned rather than of the
code, so the same unchanged method gets slower as the table grows.

**★ Why does `o.getLines().size()` cost a database round trip?**
Because `lines` does not hold a list — it holds a lazy collection proxy, an
object that knows the owning order's identifier and knows how to go and fetch the
rows if anybody asks. `size()` is a question that cannot be answered without the
rows, so asking it forces the proxy to initialise, which means a `select` against
the child table for that one foreign key. The call site gives no hint of this: it
is written exactly like `size()` on an `ArrayList`, which is a field read. Once
initialised the collection stays initialised for the life of the persistence
context, so a second call is free — which is why the cost is one query per
*parent* rather than one per access.

**★ Someone says "our N+1 is fine, each of those queries takes 0.4 ms". How do
you answer?**
By pointing out that per-query time is the wrong unit. Each statement is a
network round trip, and round trips do not compose the way computation does: they
are serialised, they each pay latency that has nothing to do with how much work
the database did, and they each hold the connection open. So the number that
matters is N × round-trip, and N is not a constant — it is however many rows the
query returned today, which grows with the business. A shape that costs 40 ms at
a hundred orders costs four seconds at ten thousand, with no code change in
between. Separately, the argument proves too much: if 101 cheap queries were
genuinely fine, so would be 10,001, and nobody believes that.

**★ Does using `List` versus `Set` for the collection change whether N+1
happens?**
Not for this. Both are lazy by default on `@OneToMany` and both initialise with
one `select` on first access, so the 101-statement count is identical. The choice
matters intensely for a *different* part of this topic — a `List` without an
`@OrderColumn` is mapped as a Hibernate *bag*, and you cannot fetch two bags in
one query, which is the `MultipleBagFetchException` covered in
[chunk 8e](08e-multiplebagfetchexception.md). So the collection type does not
cause N+1; it constrains which fix you are allowed to use.

**★ How would you explain the risk to a manager who wants to know whether to
prioritise it?**
Without jargon: the page currently asks the database one question for every row
it shows. That is fine today because there are not many rows. It is not a bug
that will stay the same size — the work grows in exact proportion to the amount
of data we hold, so the page gets slower as the business grows, on its own, with
nobody changing the code. And because all these requests share a small fixed pool
of database connections, when this page slows down it slows down every other page
too. The fix is a small change to how the data is loaded and it is cheap now;
what makes it expensive is finding it during an incident, because the symptoms
point at the wrong page.

---

Index: [08 · The N+1 problem](README.md) · Next → [1b · The general rule](01b-the-general-rule.md)
