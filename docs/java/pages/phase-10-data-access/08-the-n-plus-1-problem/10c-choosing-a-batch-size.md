---
title: "Batch size bounds owners and not rows, so the number to reason about is k times the fan-out, and the returns from raising k fall off far faster than people expect"
sidebar_label: "10c · Choosing a batch size"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.8 *Batch
> fetching* and §A.7.1 `hibernate.default_batch_fetch_size`
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.annotations.BatchSize` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/BatchSize.html)),
> and *A Short Guide to Hibernate 7* §5.8 and §8.5
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Spring Boot 4.1.0, PostgreSQL 18.
> 🔴 There is no database on this machine and this page contains **no
> measurements** — the arithmetic below is derivation, not benchmarking.

**`k` is the number of *owners* per statement, never the number of rows. The rows
are `k × fan-out`, which is why the same `k` is sensible on an association with
three children per parent and reckless on one with five hundred. And because the
statement count is ⌈N/k⌉, almost all of the benefit arrives in the first tenfold
increase and almost none after it.**

## The two quantities you are trading

| | formula | grows with |
|---|---|---|
| Round trips | `1 + ⌈N/k⌉` | **smaller** `k` |
| Rows per statement | `k × fan-out` | **larger** `k` |
| Bind parameter size | `k` ids (one array on PostgreSQL) | larger `k` |

`N` is the number of parents resident in the session — usually the page size.
`fan-out` is the average number of children per parent, and the tail of that
distribution matters more than the average.

If a round trip costs `R` and the association's rows cost `C` each, the total is
roughly `(1 + ⌈N/k⌉)·R + N·fan-out·C`. **The second term does not depend on `k`
at all** — you transfer the same rows either way, just in fewer statements. So
raising `k` only ever buys you round trips, and it buys them at a decreasing
rate.

## Why the returns fall off so fast

For `N = 100` parents:

| `k` | statements (1 + ⌈N/k⌉) | removed vs `k = 1` |
|---|---|---|
| 1 | 101 | — |
| 5 | 21 | 79% |
| 10 | 11 | 89% |
| 25 | 5 | 95% |
| 50 | 3 | 97% |
| 100 | 2 | 98% |
| 1000 | 2 | 98% |

The jump from 1 to 10 removes 89 statements. The jump from 10 to 100 removes
nine. The jump from 100 to 1000 removes none, because `k` is already ≥ `N`.

**This is the single most useful fact about choosing `k`:** anything in the range
of "roughly your page size" is within a couple of statements of optimal, and
tuning within that range is not where your time goes.

## Start from the page size

The natural value of `N` is the number of parents the driving query returned, and
in a paginated endpoint that is the page size. So:

> **Set `k` at or slightly above your typical page size.**

At `k ≥ N`, the statement count is exactly 2 — one for the parents, one for all
the children — which is the same count `@Fetch(SUBSELECT)` gives you
([chunk 11](11-subselect.md)) without the subselect's re-execution of the
driving query.

A default of 20–50 covers page sizes of 20, 25 and 50, which is most of the
paginated endpoints anyone writes:

```properties
spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

Then override *downward* on the associations where `k × fan-out` is too large,
which is the direction people forget — they tune `k` up on the slow association
when the slow association is the one that needs it smaller.

## Where the fan-out decides for you

The row count per statement is `k × fan-out`, so:

| association | fan-out | `k = 50` gives | verdict |
|---|---|---|---|
| `Order.shipments` | 1–3 | ≤ 150 rows | fine |
| `Order.lines` | 5–50 | ≤ 2,500 rows | fine |
| `Customer.orders` | 1–5,000 | up to 250,000 rows | **no** |
| `Product.reviews` | 0–100,000 | unbounded | **not a mapped collection at all** |

The last row is the important one. When a collection has no bound, the fix is not
a smaller batch size; it is that the association should not be loaded as a
collection. It should be a paginated query of its own — which is
[chunk 4d](04d-the-ones-you-cannot-make-lazy.md)'s territory and, ultimately,
[chunk 12](12-projections-and-dtos.md)'s territory.

⚠️ **Reason about the tail, not the mean.** An association averaging four
children with a ninety-ninth percentile of nine thousand will be fine in testing
and will produce a single enormous statement for one customer in production. The
batch multiplies the tail along with everything else.

## Two placements, two defaults

Because `@BatchSize` on an association overrides the global setting, you end up
with a layered configuration, and that is the right shape:

```java
// global: 50, set once in application.properties

@Entity
class Customer {
    @OneToMany(mappedBy = "customer")
    @BatchSize(size = 5)          // ← override DOWN: unbounded fan-out
    Set<Order> orders;
}

@Entity
@BatchSize(size = 200)            // ← override UP: tiny rows, resolved everywhere
class Currency { … }
```

The entity-class placement is where a *large* `k` is usually safe: a reference
entity has one row per proxy, so `k × fan-out = k`, and 200 ids in one array is a
smaller statement than most queries in the application.

## When `k` is not the variable

Three situations where tuning the batch size is the wrong activity:

- **The endpoint needs one statement.** Then it wants a join or a projection, and
  ⌈N/k⌉ ≥ 2 is a fixed cost you cannot tune away.
- **The fan-out is unbounded.** No `k` is safe; the association should not be
  fetched as a collection.
- **A lock mode is set.** The user guide is explicit that with a `LockModeType`
  other than `NONE`, Hibernate "will not execute a batch fetching", so `k` has no
  effect on that path at all.

## Gotchas

**⚠️ Tuning `k` upward on the association that is already too heavy.**
The instinct is "fewer statements is better", so the slowest association gets the
biggest batch — and its statement was slow because `k × fan-out` was already
large. On a high-fan-out association, the correct move is almost always
*downward*.

**⚠️ Choosing `k` from the average fan-out.**
The batch multiplies the ninety-ninth percentile just as faithfully as the mean.
An association that is usually four children and occasionally nine thousand needs
a `k` chosen for the nine thousand, or needs not to be a collection.

**⚠️ Setting `k` far above the page size and thinking it helps.**
At `k ≥ N` the statement count is already 2. Raising `k` from 100 to 1000 for a
page of 25 changes nothing except the size of the array parameter in the rare
case where more parents are resident than you thought.

**⚠️ Leaving an old explicit `@BatchSize(size = 3)` in place after setting a
global default.**
The annotation wins. Years-old small batch sizes are a common reason a single
association stays slow after the global setting is introduced, and nothing
reports the discrepancy — grep for `@BatchSize` after setting the global.

**⚠️ Assuming a power-of-two `k` is better.**
It is not, and the belief comes from confusing `@BatchSize` with
`hibernate.query.in_clause_parameter_padding` —
[chunk 10b](10b-what-the-sql-looks-like.md). On PostgreSQL the batch is a single
array parameter and the statement text does not vary with `k` at all.

**⚠️ Forgetting that `N` is what is *resident*, not what you are looping over.**
Hibernate batches from unfetched proxies and collection roles associated with the
session. A transaction that ran three queries before the loop can have far more
resident parents than the loop's collection, so the effective `N` — and therefore
the array size — is larger than the code in front of you suggests.

**⚠️ Tuning `k` when the real problem is that the endpoint loads four
associations.**
Four batched associations at ⌈N/k⌉ each is four times the statements and four
times the rows, and no value of `k` fixes an endpoint fetching things it does not
use. Count what the response actually contains first.

**⚠️ Treating the global default as a decision that needs a benchmark.**
It does not. Anything between 20 and 50 is within two statements of optimal for
almost every paginated endpoint, and the alternative is `k = 1`, which is the N+1
you were trying to fix. Set it, then spend the analysis on the associations where
`k × fan-out` is dangerous.

**⚠️ Reporting the improvement as a statement count only.**
Going from 101 statements to 5 is a real win and says nothing about rows, which
are unchanged. If the endpoint was slow because it was moving a hundred thousand
rows, batching moved the same hundred thousand rows in five statements —
[chunk 6](06-count-do-not-read.md).

## Interview questions

**★ How do you choose a batch size?**
Start from the page size, because `N` — the number of resident parents — is
usually the page size, and at `k ≥ N` the statement count is already down to two.
A global default of 20–50 covers most paginated endpoints. Then override
individual associations *downward* where `k × fan-out` produces too many rows per
statement. The thing to reason about is `k × fan-out`, not `k`.

**★ Why is the returns curve so steep?**
Because the statement count is `1 + ⌈N/k⌉`, which is hyperbolic in `k`. For a
hundred parents, going from `k = 1` to `k = 10` removes ninety of the hundred and
one statements; going from 10 to 100 removes nine more; going beyond `N` removes
none. So the difference between a well-chosen `k` and a merely reasonable one is
a couple of round trips, and it is not where tuning effort belongs.

**★ Does a bigger batch size ever make things worse?**
Yes, and this is the part people miss: `k` bounds the number of *owners* per
statement, not the number of rows. Rows are `k × fan-out`. A batch size of 50 on
an association averaging five thousand children is a quarter-million-row
statement, and the fact that it is *one* statement is no consolation. On
high-fan-out associations the correct adjustment is downward.

**★ What does raising `k` not buy you?**
Rows. The total row volume is `N × fan-out` regardless of `k` — you transfer the
same data, in fewer statements. So batch size tuning only ever buys round trips.
If the endpoint is slow because of data volume rather than round trips, no `k`
helps and the answer is a projection.

**★ Would you set a global default or annotate per association?**
Both, layered. A global `hibernate.default_batch_fetch_size` is the floor under
every N+1 in the application, including the unfound ones, and it costs nothing —
it cannot create a Cartesian product or change a result set. Then annotate the
exceptions: down on unbounded or high-fan-out collections, up on small reference
entities where `k × fan-out = k` and a large array is cheap.

**★ An association is still slow after you set the global default. What do you
check first?**
Whether it carries its own `@BatchSize`, because the annotation overrides the
global and an old `size = 3` will silently keep its 3. Then whether the fan-out
makes `k × fan-out` the actual problem. Then whether the path holds a lock mode
other than `NONE`, since the user guide says batch fetching does not run at all
in that case.

**★ Is there a batch size that means "never batch"?**
`@BatchSize` requires "a strictly positive integer", so `size = 1` is the way to
express it — and it is exactly the N+1 behaviour, one statement per owner. It is
occasionally the right override, on an association where the fan-out is so large
that a single owner's children are already too much to want two of.

**★ How would you justify the batch size you picked, in a design review?**
By naming `N` and the fan-out. "The page is 25, so `N` is 25; `k = 50` gives two
statements. The fan-out is at most 40 lines, so the child statement returns at
most a thousand rows." That is a two-sentence argument from two numbers you can
look up, and it is more convincing than any benchmark, because it explains what
happens when the page size or the data changes.

---

← Prev: [10b · What the SQL looks like](10b-what-the-sql-looks-like.md) · Index: [08 · The N+1 problem](README.md) · Next → [11 · @Fetch(SUBSELECT)](11-subselect.md)
