---
title: "mode, bool_and and hypothetical sets"
sidebar_label: "02 · mode, bool_and, hypothetical"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37e-ordered-set-checks.mjs`.

**Three smaller families that share the ordered-set machinery or answer set-shaped
questions: `mode()` for the commonest value, `bool_and`/`bool_or` for "all" and "any", and
the hypothetical-set aggregates that ask where a value *would* rank. Each has one behaviour
that is not what the English word suggests.**

## `mode()` — and what it does with a tie

```sql
SELECT mode() WITHIN GROUP (ORDER BY kind) AS commonest FROM agg_events;
```

```console
mode()                  : [{"commonest":"click"}]
```

Taken alone that looks like a fact about the data. It is not:

```console
=== A. mode() reports a sort order when the input is tied ===
kind counts: [{"kind":"click","n":125000},{"kind":"purchase","n":125000},{"kind":"refund","n":125000},{"kind":"view","n":125000}]
mode()     : [{"commonest":"click"}]
  ^ all four tied at 125000; mode() returned the alphabetically first
mode() with the order reversed: [{"commonest":"view"}]
  ^ same data, different answer — proof the tie is broken by the ordering
```

**All four values are tied at exactly 125 000**, and reversing the ordering changes the
answer from `click` to `view` against identical data. `mode()` returns the first of the
tied values *in the `WITHIN GROUP` sort order*. Nothing about this data makes clicks more
common than views.

It is not simply returning the minimum, though — given a real winner it picks it regardless
of sort position:

```console
mode() on a genuine winner   : [{"commonest":"zeta"}]
  ^ zeta wins on frequency despite sorting last, so mode() is not just min()
mode() over an empty set     : [{"commonest":null}]
```

That is the gotcha worth carrying: **`mode()` on tied inputs is decided by the `ORDER BY`,
not by frequency**, and it reports a single winner with no indication that it was a
four-way tie. A dashboard tile reading "Most common event: click" would be actively
misleading here.

If ties are possible — and they usually are on low-cardinality columns — return the counts
instead, or at least return the runner-up:

```sql
SELECT kind, count(*) AS n
FROM agg_events GROUP BY kind
ORDER BY n DESC, kind
LIMIT 3;
```

`mode()` ignores `NULL`s, and returns `NULL` for an empty input.

## `bool_and` and `bool_or`

The set versions of *all* and *any*:

```sql
SELECT customer_id,
       bool_and(status = 'paid') AS all_paid,
       bool_or(status = 'paid')  AS any_paid,
       count(*) FILTER (WHERE status <> 'paid')::int AS unpaid
FROM agg_orders GROUP BY customer_id ORDER BY customer_id;
```

```console
bool_and / bool_or      : [{"customer_id":1,"all_paid":false,"any_paid":true,"unpaid":1},
                           {"customer_id":2,"all_paid":true,"any_paid":true,"unpaid":0},
                           {"customer_id":3,"all_paid":false,"any_paid":false,"unpaid":1},
                           {"customer_id":4,"all_paid":false,"any_paid":false,"unpaid":1},
                           {"customer_id":null,"all_paid":false,"any_paid":false,"unpaid":1}]
```

Customer 2 is the only one whose orders are all paid, and `unpaid` agrees at 0. Pairing
`bool_and` with a `FILTER`ed count like this is a good habit — the boolean says *whether*,
the count says *how many*, and they cross-check each other. `FILTER` is
[topic 04](../filter-clause/).

`every()` is a standard-SQL alias for `bool_and`, and behaves identically:

```console
=== B. every() is an alias for bool_and ===
[{"bool_and":false,"every":false,"identical":true}]
```

### Over an empty set it is `NULL`, not `true`

```console
bool_and over an empty set: [{"all_paid":null}]
  NULL, not true — the vacuous-truth answer people expect from "all" is not what you get
```

```console
=== D. bool_and over an empty set, and the coalesce fix ===
[{"raw":null,"coalesced":true}]
```

**Logic says "all of nothing is true"; SQL says `NULL`.** `bool_and` is an aggregate, and
aggregates over an empty set return `NULL` — the same rule that makes `sum()` `NULL` rather
than 0, [seen in the subqueries topic](../11-subqueries/02-correlated-and-cost.md).

This matters most in exactly the place it is least visible: a `LEFT JOIN`ed report where
some parent has no children. `all_paid` comes back `NULL`, a JavaScript `if (row.all_paid)`
treats it as false, and a customer with no orders is quietly reported as having unpaid ones.
`coalesce(bool_and(...), true)` is the fix, and *which* default is right is a decision worth
making explicitly rather than inheriting from truthiness.

## Hypothetical-set aggregates

These ask: *if this value were inserted into the ordered set, where would it land?*

```sql
SELECT rank(150) WITHIN GROUP (ORDER BY amount) AS rank_of_150,
       percent_rank(150) WITHIN GROUP (ORDER BY amount)::numeric(6,4) AS pct
FROM agg_events;
```

```console
hypothetical-set        : [{"rank_of_150":"66721","pct":"0.1334"}]
```

An `amount` of 150 would rank **66 721st** out of the non-null values, putting it at the
**13.34th percentile**. Note that this is the mirror image of `percentile_cont`: a
percentile maps a fraction to a value, and `percent_rank` maps a value to a fraction.

The family is `rank`, `dense_rank`, `percent_rank` and `cume_dist`, each taking the
hypothetical value as its argument and the ordering in `WITHIN GROUP`. The argument list
must match the `ORDER BY` list in number and type — two `ORDER BY` columns need two
arguments.

**The obvious use is a percentile without a self-join**: "what percentile is this user's
score?" is one aggregate rather than a `count(*) WHERE score < mine` divided by a total.

These are the aggregate counterparts of the window functions in
[ranking](../ranking/), which give each existing row its rank. Same names, different
question: the window version ranks the rows you have, the hypothetical-set version ranks a
row you do not.

## In Node

```js
const {rows: [summary]} = await pool.query(
  `SELECT coalesce(bool_and(status = 'paid'), true) AS all_paid,
          coalesce(bool_or(status = 'paid'), false) AS any_paid,
          count(*)::int                             AS orders
   FROM agg_orders WHERE customer_id = $1`,
  [customerId],
);
```

- **`coalesce` both booleans, and choose each default deliberately.** With no orders,
  "all paid" is vacuously true and "any paid" is false. Leaving them `NULL` pushes the
  decision into whatever JavaScript's truthiness does with `null`, which is a decision
  nobody made.
- **Return the count too.** `all_paid: true, orders: 0` is honest; `all_paid: true` alone
  is a claim about a customer who has never ordered.
- **`mode()` needs a tie-breaking story before it reaches a UI.** If the label says "most
  common", either prove the winner is not tied or render the top three with counts.
- **`rank(...) WITHIN GROUP` returns `bigint`** — a string in the driver until you `::int`
  it ([phase 7](../../phase-7-pg-driver/09-pg-types.md)).

## Trade-off

All three families collapse a set into a single value that reads like a sentence — *the
commonest kind*, *all orders paid*, *this score's percentile* — which is exactly what a
summary endpoint or a dashboard tile wants. The cost is that each hides its ambiguous
cases: `mode()` hides ties, `bool_and` hides emptiness behind `NULL`, and a hypothetical
rank hides how many values it was ranked against. None of them is wrong; each needs a
companion count before the sentence it produces is safe to show a user.

## Gotchas

**Symptom:** "most common value" is reported confidently and is arbitrary
**Cause:** `mode()` breaks ties by the `WITHIN GROUP` ordering, not by frequency. Measured:
it returned `click` from a four-way tie at exactly 125 000 each
**Fix:** return the top few with their counts, or verify the winner is not tied

**Symptom:** a customer with no orders is reported as having unpaid ones
**Cause:** `bool_and` over an empty set is `NULL`, and `NULL` is falsy in JavaScript
**Fix:** `coalesce(bool_and(...), true)` — and decide the default deliberately

**Symptom:** `every()` behaves differently from `bool_and` — it should not
**Cause:** it does not; `every` is a standard-SQL alias for `bool_and`
**Fix:** no change needed; pick one spelling for consistency

**Symptom:** `rank(x) WITHIN GROUP (ORDER BY a, b)` raises an argument-count error
**Cause:** the hypothetical arguments must match the `ORDER BY` list in number and type
**Fix:** supply one argument per ordering column

**Symptom:** a percentile from `percent_rank` disagrees with one from `percentile_cont`
**Cause:** they are inverses, not the same function — one maps a value to a fraction, the
other a fraction to a value
**Fix:** confirm which direction the question runs before comparing them

## Interview questions

**★ What does `mode()` do when two values are equally common?**
It returns the first in the `WITHIN GROUP` sort order, with no indication of the tie.
Measured: four values tied at exactly 125 000 each, and `mode()` returned `click` because
it sorts first alphabetically. Never render it as "most common" without checking.

**★ What does `bool_and` return over an empty set, and why does it matter?**
`NULL`, not `true` — aggregates over an empty set are `NULL`, the same rule that makes
`sum()` `NULL` rather than 0. It matters because `NULL` is falsy in most client languages,
so "all orders paid" silently becomes false for a customer with no orders.
`coalesce(..., true)` is the fix.

**★ What is a hypothetical-set aggregate?**
One that reports where a value *would* rank if it were added to the ordered set —
`rank`, `dense_rank`, `percent_rank`, `cume_dist`. Measured: `rank(150) WITHIN GROUP (ORDER
BY amount)` returned 66 721, and `percent_rank(150)` returned 0.1334.

**★ How does `rank(x) WITHIN GROUP` differ from the `rank()` window function?**
The window function ranks each row that exists; the hypothetical-set aggregate ranks a value
that does not, returning a single number for the whole set.

**When would you use `percent_rank` over `percentile_cont`?**
They are inverses. Use `percent_rank` when you have a value and want its position ("this
score is at the 87th percentile"); use `percentile_cont` when you have a position and want
the value ("what is the p95 latency").

---

← [Percentiles](01-percentiles.md) · Next topic → [Window frames](../frames/)
