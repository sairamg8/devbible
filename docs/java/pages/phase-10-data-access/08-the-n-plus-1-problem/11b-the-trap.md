---
title: "Subselect fetching pays for the driving query twice and, on PostgreSQL's default isolation level, the two executions can see different data"
sidebar_label: "11b · The subselect trap"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.11
> *`FetchMode.SUBSELECT`* and §A.7.3 `hibernate.use_subselect_fetch`
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> *A Short Guide to Hibernate 7* §8.5
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the PostgreSQL 18 manual §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**The subselect's whole design is "describe the owners instead of listing them",
and describing them means running their query again. That is a bargain when the
query is an index lookup and a bad one when it is not — and on PostgreSQL's
default isolation level the two executions take *two different snapshots*, which
is a correctness question nobody expects from a fetching strategy.**

## Cost 1 · the query runs twice

```java
@Query("""
    select o from Order o
      join o.customer c
      join c.account a
    where lower(o.reference) like :pattern
      and o.placedAt between :from and :to
    order by o.placedAt desc
    """)
List<Order> search(...);
```

With `@Fetch(SUBSELECT)` on `Order.shipments`, touching any order's shipments
issues:

```sql
select ... from Shipment s
where s.order_id in (
    select o.id from Orders o
      join Customer c on ...
      join Account  a on ...
    where lower(o.reference) like ?
      and o.placed_at between ? and ?
);
```

Three joins, a `lower()` that defeats an index on `reference`, and a
leading-wildcard `LIKE`, planned and executed a second time. The saving was
⌈N/k⌉ − 1 small statements; the cost is the most expensive statement in the
request, doubled.

The introduction guide's defence of the strategy is careful, and reading it
carefully is the point:

> *"The execution of the subselect is likely to be relatively inexpensive, since
> the data should already be cached by the database."*

**"Likely"** and **"should"**, and "cached" meaning the database's buffer cache —
not a result cache. A query that scanned a large table warms the buffers and then
scans them again: cheaper than the first time, and not free. A query whose cost
is in *sorting* or in *join processing* re-does that work in full, because
buffers do not cache computation.

### The shapes where "twice" hurts

| Driving query | Second execution |
|---|---|
| `where id = ?` | free — but then there is no subselect, see [chunk 11](11-subselect.md) |
| `where status = ?`, indexed | nearly free, warm |
| `order by … limit …` over a large set | re-sorts |
| leading-wildcard `LIKE`, `lower(col)` | re-scans |
| three-way join with a filter on the far table | re-joins |
| a view, or a CTE with aggregation | recomputes |

## Cost 2 · it is a property of the collection role

`@Fetch(SUBSELECT)` sits on the association, so **every** query in the
application that touches that collection gets it. The endpoint you tuned gets its
two statements; the endpoint that loads a single order by id gets nothing (the
mode degrades to `SELECT`); and the endpoint whose driving query is the expensive
search above pays it twice, whether or not it ever wanted the shipments.

Nothing in HQL or in the entity-graph API can override this per query. The
introduction guide states the gap plainly when comparing fetch profiles to
graphs:

> *"The one and only advantage unique to fetch profiles is that they let us very
> selectively request subselect fetching. We can't do that with entity graphs,
> and we can't do it with HQL."*

So if you want subselect fetching **sometimes**, the mechanism is a fetch profile
([chunk 13](13-fetch-profiles.md)) or
`session.setSubselectFetchingEnabled(true)` on a session you control — not the
annotation.

## Cost 3 · two statements, two snapshots

This one is genuinely surprising, and it is a property of the database rather
than of Hibernate.

PostgreSQL's default isolation level is **Read Committed**, and the manual says:

> *"a `SELECT` query sees a snapshot of the database as of the instant the query
> begins to run."*
>
> *"…two successive `SELECT` commands can see different data, even though they
> are within a single transaction, if other transactions commit changes after the
> first `SELECT` starts and before the second `SELECT` starts."*

The subselect runs when you *touch* the collection, which can be a long way after
the driving query — after some business logic, after another query, in a
serialiser. So on Read Committed:

- An order committed by another transaction **between** the two statements
  matches the subselect but is not in your `List<Order>`. Its shipments are
  loaded into the persistence context and attached to nothing you can see.
  Harmless, and it makes the second statement bigger than the first result
  implies.
- An order **deleted** between the two statements is in your list and absent from
  the subselect, so its collection comes back empty rather than as it was when you
  read it.

Under **Repeatable Read** the problem disappears, because the manual says such a
transaction "sees a snapshot as of the start of the first non-transaction-control
statement in the transaction", so both executions agree.

⚠️ **Batch fetching does not have this exposure in the same way.** It fetches by
the ids it already holds, so a concurrently-inserted parent cannot enter the
result. It still sees a fresh snapshot for the *children*, but the owner set is
fixed.

This is not usually a bug you will be assigned. It is the kind of thing that
explains a report nobody could reproduce, and it is worth knowing which strategy
you are running when such a report arrives.

## The question I could not settle

**What happens to `setMaxResults` / a `Pageable` limit inside the subselect?**

The documentation describes the subselect as re-executing "an initial query" and
as fetching "based on the restriction used to load its owner(s)" — *restriction*,
which is not obviously the same thing as *limit and offset*. If the limit is not
carried into the subselect, a paginated driving query would fetch children for
every matching row rather than for the page.

🔴 **I could not confirm from the Hibernate 7.4 documentation whether the limit is
included.** I am not going to guess at it, and the several confident answers on
the web disagree with each other. The check is cheap and specific to your version:

```java
// page 1 of 5 rows, from a table with many matching rows
List<Order> page = session.createSelectionQuery("from Order where status = :s", Order.class)
        .setParameter("s", OPEN).setMaxResults(5).getResultList();
page.get(0).getShipments().size();     // triggers the subselect
// then assert the row count / statement shape for that second statement
```

If the limit is not propagated, subselect fetching is unsuitable for paginated
endpoints and batch fetching is the strategy that composes with pagination —
which is what [chunk 10](10-batch-size.md) claims for it on grounds that do not
depend on this question.

## Gotchas

**⚠️ Reading "should already be cached" as "free".**
Buffer caching removes I/O, not computation. Sorting, hashing, aggregating and
join processing are redone in full on the second execution. The reassurance in the
guide is honest and narrow; treat it as narrow.

**⚠️ Annotating one collection and forgetting which queries reach it.**
The mode is on the role. Grep for every query and every navigation path that
touches that collection before deciding the driving query is cheap — there is
usually more than one, and the expensive one is rarely the one you were looking
at.

**⚠️ Enabling `hibernate.use_subselect_fetch` globally.**
It makes every collection in the application re-run its owners' driving query.
That is a categorically different risk from
`hibernate.default_batch_fetch_size`, which only widens a `where` clause. If you
want a global default, batching is the one that is safe to set blind.

**⚠️ Assuming the subselect covers only the owners you are iterating.**
It covers "all owners associated with the persistence context" for that role. If
an earlier query in the same transaction loaded more, they are included, and the
second statement is larger than the loop in front of you suggests.

**⚠️ Using it on an endpoint that reads then writes.**
The second execution happens at collection-access time, and a flush before it
(triggered by another query, per [topic 06 chunk 11](../06-jpa-hibernate-model/11-the-persistence-context.md))
changes what the driving query matches. Subselect fetching after a write in the
same transaction is a shape worth avoiding rather than reasoning about.

**⚠️ Debugging it from the SQL log alone.**
The second statement contains the first one, so a log line for the subselect
*looks* like the driving query with extra text around it. It is easy to
mis-attribute — to think the driving query ran twice for some other reason, or to
count it as one statement. The tell is the `IN (SELECT …)`.

**⚠️ Mixing it with a `@Filter` or a soft-delete predicate.**
Anything that adds a restriction to the driving query is re-applied inside the
subselect. That is correct, and it means a mis-specified filter's cost is also
paid twice — and that changing the filter changes the child statement, which is
not where anyone looks.

**⚠️ Treating it as a per-query tuning knob because it is spelled like one.**
`@Fetch(FetchMode.SUBSELECT)` reads like a hint on an association. It is a
statement about every use of that association forever. Fetch profiles are the
mechanism for "sometimes".

## Interview questions

**★ What is the cost of subselect fetching?**
The driving query executes twice — once to load the owners, once inside the `IN`
subquery that loads the children. On an indexed lookup that is close to free and
the buffers are warm; on a wide join, a full scan, a leading-wildcard `LIKE` or
anything that sorts, you have doubled the most expensive statement in the request
to remove a handful of cheap ones.

**★ The Hibernate guide says the subselect is "likely to be relatively
inexpensive, since the data should already be cached". Do you agree?**
For I/O-bound queries, yes. The wording is careful, and so is the scope: the
database's buffer cache removes re-reading, not re-computing. A query whose cost
is a sort or a hash join redoes that work on the second execution regardless of
what is cached. So the sentence is a good default expectation and a bad guarantee,
and which one you are in is decided by the shape of your driving query.

**★ Is there a correctness issue?**
On PostgreSQL's default Read Committed level, yes, and it is worth knowing. The
manual says a `SELECT` "sees a snapshot of the database as of the instant the
query begins to run", and that two successive `SELECT`s in one transaction "can
see different data" if another transaction commits in between. The subselect runs
when the collection is touched, which can be much later than the driving query —
so a concurrently inserted owner can match the subselect without being in your
result list, and a deleted one can be in your list with an empty collection.
Repeatable Read removes the exposure, because both executions share the
transaction's snapshot. Batch fetching is less exposed because the owner set is
already fixed as a list of ids.

**★ Can you request subselect fetching for one query only?**
Not with HQL and not with an entity graph — the introduction guide says exactly
that when it explains what fetch profiles are still for: "the one and only
advantage unique to fetch profiles is that they let us very selectively request
subselect fetching. We can't do that with entity graphs, and we can't do it with
HQL." The available scopes are the mapping annotation, the global setting, a
session flag, and a fetch profile.

**★ Does subselect fetching work with pagination?**
I would not claim either way without checking the version, and I would say so.
The documentation describes the subselect as re-executing the initial query and as
fetching "based on the restriction used to load its owner(s)", and *restriction*
is not unambiguously *limit and offset*. If the limit is not carried in, the
child statement covers every matching row rather than the page, which would make
the strategy unsuitable for paginated endpoints. It is a five-line test to
establish, and batch fetching composes with pagination for reasons that do not
depend on the answer.

**★ How does the trap compare with batch fetching's trap?**
Batch fetching's failure mode is `k × fan-out` rows in one statement — a data
volume problem you can compute in advance. Subselect fetching's is a repeated
expensive query and a second snapshot — a problem whose size depends on the
*shape* of a query written somewhere else, possibly by someone else, possibly
after you chose the fetch mode. That asymmetry is why batching is the safer
global default and subselect is the deliberate, local choice.

**★ Given all that, when do you still reach for it?**
When a query returns many owners, the query itself is cheap, and you need two
collections — the case Hibernate's own guide names, where join-fetching both
would be a Cartesian product. Join-fetch one, subselect the other, and you get
three statements with no product. Outside that shape, batching is easier to
reason about and a projection is usually better than either.

---

← Prev: [11 · @Fetch(SUBSELECT)](11-subselect.md) · Index: [08 · The N+1 problem](README.md) · Next → [12 · Projections and DTOs](12-projections-and-dtos.md)
