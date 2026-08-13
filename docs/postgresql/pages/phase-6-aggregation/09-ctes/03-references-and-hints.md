---
title: "References, hints and the plan"
sidebar_label: "03 · References, hints and the plan"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37b-cte-inlining.mjs`.

**The reference count is the one part of the inlining rule that changes what work happens
rather than just where the filter goes: referenced twice, a CTE is computed once. The hint
that overrides that is a request the planner is free to ignore, and the plan test everyone
reaches for answers a narrower question than the one being asked.**

## Referenced twice: computed once

```sql
WITH k AS (SELECT kind, count(*) AS n FROM agg_events GROUP BY kind)
SELECT a.kind, a.n, b.n AS other FROM k a JOIN k b ON b.kind <> a.kind;
```

```console
  -- 9c. CTE referenced TWICE — materialized automatically
  Nested Loop (actual rows=12.00 loops=1)
    Join Filter: (b.kind <> a.kind)
    Buffers: shared hit=3803
    CTE k
      ->  Finalize GroupAggregate (actual rows=4.00 loops=1)
            Group Key: agg_events.kind
            Buffers: shared hit=3803
    ->  CTE Scan on k a (actual rows=4.00 loops=1)
          Storage: Memory  Maximum Storage: 17kB
    ->  CTE Scan on k b (actual rows=4.00 loops=4)
          Storage: Memory  Maximum Storage: 17kB
  Planning Time: 0.219 ms
  Execution Time: 56.532 ms
```

The aggregate over 500 000 rows runs **once**, into a 17 kB tuplestore, and both references
scan that. `Buffers: shared hit=3803` is a single pass over the table.

**This is the one thing a CTE gives you that a repeated subquery does not.** Write the same
aggregate as two separate derived tables and it is two aggregates; name it once and
reference it twice and it is one.

## Forcing it back to inline doubles the work

```console
  -- 9d. ...forced back to inline with NOT MATERIALIZED (runs the CTE twice)
  Nested Loop (actual rows=12.00 loops=1)
    Buffers: shared hit=7606
    ->  Finalize GroupAggregate (actual rows=4.00 loops=1)
          Buffers: shared hit=3803
    ->  Materialize (actual rows=4.00 loops=4)
          Buffers: shared hit=3803
          ->  Subquery Scan on b
                ->  Finalize GroupAggregate (actual rows=4.00 loops=1)
                      Buffers: shared hit=3803
  Planning Time: 0.226 ms
  Execution Time: 124.127 ms
```

**`Buffers: shared hit=7606` — exactly twice 3803.** The 500 000-row aggregate is computed
once per reference, and the query takes 2.2× as long (56.5 ms → 124.1 ms).

Note the `Materialize` node in that plan, because it is easy to misread as "so it did cache
it after all". It caches the four *result* rows for the nested loop's inner side — and it
sits **above a second full aggregate**. Materializing a result and computing it twice are
different things, and the buffer count is what tells them apart. A plan node named
`Materialize` is not evidence that the expensive part happened once.

So the automatic behaviour is the right one here, and `NOT MATERIALIZED` on a
multiply-referenced CTE is usually a pessimisation. It pays only when the CTE is cheap and
inlining unlocks something bigger — an index the fence was hiding, or a join order the
planner could not otherwise reach.

## `NOT MATERIALIZED` cannot override volatility

```console
  -- volatile CTE + NOT MATERIALIZED — can the hint override volatility?
    Aggregate
      CTE r
        ->  Seq Scan on agg_events
      ->  CTE Scan on r
            Filter: (x >= '0'::double precision)
```

`CTE r` and `CTE Scan on r` are both still there. **The hint was ignored.**
`NOT MATERIALIZED` asks the planner to inline; it does not license a rewrite that would
change the answer, and inlining a volatile CTE would do exactly that — each reference would
re-roll `random()`.

The same thing shows in the result rather than the plan:

```console
2 refs, NOT MATERIALIZED             : [{"same":true}]
  ^ if NOT MATERIALIZED runs it twice, two independent random() values -> false
```

Two reads of a `random()` CTE, explicitly asked to inline, still agree — because it was
materialized regardless. **Treat `NOT MATERIALIZED` as a request, not a guarantee**, and
read the plan when it matters.

> **How this page was measured, and one correction.** The original script demonstrated
> volatility with `(SELECT x FROM r) = (SELECT x FROM r)` returning `true`. That query
> references `r` **twice**, so the multiple-reference rule alone explains the result —
> volatility was never isolated by it. The single-variable table in
> [the previous chunk](02-the-inlining-rule.md) and the plans here are what actually
> establish the rule. Real console output can still be the wrong evidence for the claim
> it is attached to.

## "No `CTE` node" is not "the filter reached the scan"

The one-word verdict answers *"was there a fence?"* — not *"did the optimization actually
happen?"* `OFFSET 0` separates the two:

```console
  -- OFFSET 0 — no CTE node, but the filter is stuck above a Subquery Scan
    Aggregate
      ->  Subquery Scan on e
            Filter: (e.kind = 'refund'::text)
            ->  Seq Scan on agg_events
```

No `CTE` node, so by the crude test it "inlined" — but the filter sits above a
`Subquery Scan` instead of at the scan, and the parallel plan is gone. Compare the plain
case, where the filter is *on* the scan and two workers appear:

```console
  -- plain single-reference CTE — filter reaches the scan, plan goes parallel
    Finalize Aggregate
      ->  Gather
            Workers Planned: 2
            ->  Partial Aggregate
                  ->  Parallel Seq Scan on agg_events
                        Filter: (kind = 'refund'::text)
```

`OFFSET 0` was the classic pre-12 optimization fence for subqueries, and **it still blocks
subquery pull-up in 18**. It survives as a way to fence without the `MATERIALIZED` keyword,
and as a booby trap in old queries that used it deliberately — someone removing what looks
like a no-op `OFFSET 0` is changing the plan.

The lesson generalises: when you care about the plan, read the plan. A checklist that looks
for one node name answers a narrower question than the one you asked.

## When to force the fence deliberately

`MATERIALIZED` is right when:

- **The CTE is expensive and referenced many times.** This is automatic, but writing it
  makes the intent explicit and survives a later edit that drops it to one reference.
- **The CTE calls a volatile function whose result must be stable across the statement** —
  one `random()` sample, one batch of generated ids. The fence is applied for you, but
  saying so documents that the query depends on it.
- **The planner's estimate for the inlined form is badly wrong** and the resulting plan is
  worse than materialising a small intermediate. Verify with `EXPLAIN (ANALYZE, BUFFERS)`
  both ways rather than assuming — the 6× in
  [the previous chunk](02-the-inlining-rule.md) is a warning about which direction the
  surprise usually runs.

It is wrong when used as documentation — *"this is a step"* — on a large scan.

## In Node

```js
// Force the fence only where the query depends on it, and say why.
const {rows} = await pool.query(
  `WITH sample AS MATERIALIZED (          -- one random draw, reused by both branches
     SELECT id, random() AS r FROM agg_events WHERE kind = $1
   )
   SELECT (SELECT count(*)::int FROM sample WHERE r < 0.5) AS lo,
          (SELECT count(*)::int FROM sample WHERE r >= 0.5) AS hi`,
  [kind],
);
```

- **A slow endpoint with a CTE is a plan question, not a CTE question.** Get the plan for
  the real statement with the real parameters before rewriting anything; the fix is as
  likely to be an index as a keyword.
- **`EXPLAIN` through the driver is just another query.**
  `pool.query('EXPLAIN (ANALYZE, BUFFERS) ' + sql, params)` returns the plan as rows. Build
  that string from your own SQL only — never from user input.
- **Do not tune this per request.** Whether a CTE inlines is a property of the statement
  text, so it is decided once when the query is written, not per call.

## Trade-off

The reference-count rule gives you compute-once for free, which is the strongest reason to
name an expensive intermediate rather than repeat it. What you give up is control: the
decision is the planner's, it is made from the statement text rather than from the data,
and the one lever you have — `NOT MATERIALIZED` — is advisory and silently ignored in
exactly the cases where the semantics are at stake. The practical consequence is that CTE
performance questions can only be answered by reading a plan, never by reading the SQL.

## Gotchas

**Symptom:** an expensive CTE appears to run twice
**Cause:** `NOT MATERIALIZED` on a multiply-referenced CTE. Measured: `shared hit` went
3803 → 7606, exactly double, and the time 56.5 ms → 124.1 ms
**Fix:** remove the hint and let the automatic materialization stand

**Symptom:** `NOT MATERIALIZED` had no effect at all
**Cause:** the CTE is volatile, recursive, or data-modifying — the hint cannot license a
rewrite that would change the answer. Measured: a `random()` CTE with `NOT MATERIALIZED`
still plans as `CTE r` + `CTE Scan on r`
**Fix:** none for volatility; if the goal was a single evaluation, that is already what you
have

**Symptom:** a plan shows `Materialize`, so the expensive step looks like it ran once
**Cause:** `Materialize` caches the rows of its own subtree for a repeated inner scan; it
can sit above a second full computation
**Fix:** compare `Buffers` totals against a single pass. Doubling is the tell

**Symptom:** a CTE has no `CTE` node in the plan but the filter still is not at the scan
**Cause:** something blocked subquery pull-up — `OFFSET 0` is the classic one and still
works in 18
**Fix:** remove the `OFFSET 0`, and check the whole plan shape rather than the absence of
one node

**Symptom:** removing a "pointless" `OFFSET 0` made a query slower
**Cause:** it was load-bearing — an intentional optimization fence written before
`MATERIALIZED` existed
**Fix:** replace it with `MATERIALIZED` on the CTE so the intent is visible, and re-measure

## Interview questions

**★ If a CTE is referenced twice, how many times does it run?**
Once — multiple references trigger automatic materialization. Measured: `Buffers: shared
hit=3803`, one pass over the table, with both `CTE Scan`s reading a 17 kB tuplestore.
Forcing `NOT MATERIALIZED` made it run twice — buffers 7606, time 56.5 ms → 124.1 ms.

**★ Does `NOT MATERIALIZED` always inline?**
No, it is a request. It is ignored whenever inlining would change the answer — volatile,
recursive, or data-modifying CTEs stay fenced. Measured with a `random()` CTE that still
planned as `CTE r` + `CTE Scan on r` despite the hint.

**★ How do you tell from a plan whether a CTE was inlined — and what does that test miss?**
An inlined CTE leaves no `CTE <name>` node and no `CTE Scan`. That only tells you there was
no CTE fence. It does not tell you the filter reached the scan: `OFFSET 0` produces a plan
with no `CTE` node whose filter is still stuck above a `Subquery Scan`, with no parallelism.

**★ A plan shows a `Materialize` node above your CTE's work. Did the expensive part run once?**
Not necessarily. `Materialize` caches its subtree's output rows for a repeated inner scan,
and it can sit above a second full computation of the same aggregate. Compare `Buffers`
against one pass — an exact doubling means it ran twice.

**When would you deliberately write `MATERIALIZED`?**
When the CTE is expensive and referenced several times and you want the intent recorded;
when it contains a volatile function whose value must be stable across the statement; or
when measurement shows the inlined plan is worse. The last one needs `EXPLAIN (ANALYZE,
BUFFERS)` both ways — the default assumption should be that the fence costs you.

**Someone deletes an `OFFSET 0` from an old query as dead code. What can go wrong?**
It may have been a deliberate optimization fence from before `MATERIALIZED` existed.
Removing it allows subquery pull-up and changes the plan. If the fence is wanted, express
it as `MATERIALIZED` so the next reader can see it is load-bearing.

---

← [The inlining rule](02-the-inlining-rule.md) · Next topic → [Data-modifying CTEs](../modifying-ctes/)
