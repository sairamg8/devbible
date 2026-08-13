---
title: "RETURNING and merge_action()"
sidebar_label: "02 · RETURNING"
sidebar_position: 2
---

# `RETURNING` and `merge_action()`

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex55-merge-returning.mjs`.

**`MERGE` supports `RETURNING`, and has since PostgreSQL 17.** Widely-repeated advice
says otherwise — this page said so itself, seven times, until `ex55` was run against
the server.

## It works

```console
$ node ex55-merge-returning.mjs
=== server version ===
PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
server_version_num = 180004

=== 1. plain MERGE ... RETURNING ===
MERGE ... RETURNING id, qty                    → OK
┌─────────┬────┬─────┬────────────┐
│ (index) │ id │ qty │ note       │
├─────────┼────┼─────┼────────────┤
│ 0       │ 1  │ 111 │ 'existing' │
│ 1       │ 2  │ 222 │ 'existing' │
│ 2       │ 4  │ 444 │ 'inserted' │
└─────────┴────┴─────┴────────────┘
```

The target is aliased `t`, so `RETURNING t.id, t.qty, t.note` reads the row as it
stands after the action — including on the `INSERT` branch.

## `merge_action()` gives the breakdown `rowCount` cannot

```console
=== 2. merge_action() in RETURNING ===
RETURNING merge_action(), t.id, t.qty          → OK
┌─────────┬──────────────┬────┬─────┬────────────┐
│ (index) │ merge_action │ id │ qty │ note       │
├─────────┼──────────────┼────┼─────┼────────────┤
│ 0       │ 'UPDATE'     │ 1  │ 111 │ 'existing' │
│ 1       │ 'DELETE'     │ 2  │ 20  │ 'existing' │
│ 2       │ 'INSERT'     │ 4  │ 444 │ 'inserted' │
└─────────┴──────────────┴────┴─────┴────────────┘

=== 5. rowCount and per-action counts from the driver ===
rowCount = 3 (rows affected by ALL actions)
per-action counts derived from merge_action(): { UPDATE: 1, DELETE: 1, INSERT: 1 }
```

`rowCount` is `3` and says nothing about the split. One `reduce` over the returned
rows produces the per-action counts the command tag never carried:

```js
const byAction = res.rows.reduce(
  (a, r) => (a[r.action] = (a[r.action] || 0) + 1, a), {});
// { UPDATE: 1, DELETE: 1, INSERT: 1 }
```

Note the `DELETE` row returns `qty: 20` — the value **before** the statement ran.
There is no post-state for a deleted row, so `RETURNING` gives you the old one.

## It is legal in exactly one place

```console
=== 3. does merge_action() work outside a MERGE? ===
select merge_action()                          → 42601 MERGE_ACTION() can only be
                                                 used in the RETURNING list of a
                                                 MERGE command
```

Not in a `SELECT`, not in a `WHERE`, not in the `SET` list of the `UPDATE` branch —
only in the `RETURNING` list of a `MERGE`.

## `old.` and `new.` work here too

PostgreSQL 18's `RETURNING` aliases apply, so one statement can report the before and
after of every row it touched:

```console
=== 4. OLD/NEW aliases in a MERGE RETURNING (PG18 feature) ===
RETURNING old.qty, new.qty                     → OK
┌─────────┬──────────┬──────┬─────┐
│ (index) │ action   │ was  │ now │
├─────────┼──────────┼──────┼─────┤
│ 0       │ 'UPDATE' │ 10   │ 111 │
│ 1       │ 'UPDATE' │ 20   │ 222 │
│ 2       │ 'INSERT' │ null │ 444 │
└─────────┴──────────┴──────┴─────┘
```

`old.qty` is `null` on the `INSERT` row, because there was no old row — that is the
tell for which branch fired if you would rather not call `merge_action()`. It is a
weaker signal than `merge_action()` though: a genuine pre-existing `NULL` is
indistinguishable from "there was no old row".

## Trade-off

`RETURNING` on a `MERGE` costs a round trip's worth of rows you may not need — a
reconcile touching 100k rows returns 100k rows unless you narrow the list. When you
only want counts, `RETURNING merge_action()` alone is the cheapest useful form; when
you want nothing, omit `RETURNING` and read `rowCount`.

## Gotchas

**Symptom:** `RETURNING` is rejected on a `MERGE`
**Cause:** PostgreSQL 16 or earlier — support arrived in 17.
**Fix:** Upgrade, or `INSERT … ON CONFLICT … RETURNING`, or re-query.

**Symptom:** `42601 MERGE_ACTION() can only be used in the RETURNING list of a MERGE
command`
**Cause:** `merge_action()` was called in a `SELECT`, a `WHERE`, or the `SET` list.
**Fix:** It is legal in exactly one position — the `RETURNING` list of a `MERGE`.

**Symptom:** `rowCount` does not say how many rows were inserted
**Cause:** It is the total across all branches — measured, 3 for one update, one
insert and one delete.
**Fix:** `RETURNING merge_action()` and count the actions client-side. Separate
statements are not needed for this any more.

**Symptom:** A deleted row came back with its old values
**Cause:** That is correct — a `DELETE` branch has no post-state, so `RETURNING`
yields the pre-state.
**Fix:** Nothing to fix; branch on `merge_action()` before reading the values.

**Symptom:** `old.qty` is `null` and the code concluded the row was inserted
**Cause:** A pre-existing `NULL` looks identical to "no old row".
**Fix:** Use `merge_action()` for the branch, not a null check.

## Interview questions

**★ How do you find out what a `MERGE` actually did?**
`RETURNING merge_action()` — it returns `'INSERT'`, `'UPDATE'` or `'DELETE'` per row.
Measured: one statement returned one of each, and `rowCount` was `3` with no
breakdown. `merge_action()` is legal only in a `MERGE`'s `RETURNING` list; anywhere
else raises `42601`. A common wrong answer is that `MERGE` has no `RETURNING` — true
before PostgreSQL 17, false since.

**What does `rowCount` mean after a `MERGE`?**
Total rows affected across all branches, with no breakdown — measured, 3 for one
update, one insert and one delete. The `MERGE` command tag carries no split either.

**What does `RETURNING` yield on the `DELETE` branch?**
The row as it was before deletion — there is no post-state. Measured: the deleted row
came back with `qty: 20`, its pre-statement value.

---

← [Three actions in one statement](01-three-actions.md) · Next → [Against `ON CONFLICT`](03-vs-on-conflict.md)
