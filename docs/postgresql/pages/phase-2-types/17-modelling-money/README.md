---
title: "Modelling money"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13. The type comparison, the float summing error and the
> `numeric`-as-a-string behaviour are **sandbox-measured** in
> [02 · numeric vs float](../02-numeric-vs-float.md)
> (`sandbox/pg-api/ex33-types-core.mjs`, PostgreSQL 18.4, Node 24, `pg`).
> Type and rounding semantics are validated against the **PostgreSQL 18**
> documentation, cited inline. **No console output in this topic** — the measured
> output lives on [02](../02-numeric-vs-float.md).

**[02 · numeric vs float](../02-numeric-vs-float.md) settles the type with
measurement. This topic is the modelling** — an amount is not a number,
arithmetic on it is not ordinary arithmetic, and the bugs are the ones that make
accounts fail to balance.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Storing money](01-storing-money.md)** | amount **and** currency, why not the `money` type, precision per quantity, and the two-decimal assumption that is wrong |
| 02 | **[Arithmetic and rounding](02-arithmetic-and-rounding.md)** | ties away from zero vs to even, rounding once, the missing penny, and FX rates |
| 03 | **[Ledgers and Node](03-ledgers-and-node.md)** | append-only ledgers, derived balances, and why `pg` hands you a string |

## The five rules

1. **`numeric` with a declared scale, plus a currency column.** Never
   `double precision` — measured, 1000 × 0.01 sums to **9.999999999999831**.
   Never the `money` type — locale-dependent, with a documented dump/restore
   hazard.
2. **Round once, at the end.** Rounding at each step compounds the discarded
   fractions.
3. **Allocate remainders explicitly.** 100 / 3 is 33.33 × 3 = 99.99; the penny
   must be given to someone. Assert that the parts sum to the whole.
4. **Store the FX rate you used, and when.** Otherwise historical reports change
   value every time they run.
5. **Keep it a string in JavaScript.** `pg` returns `numeric` as a string on
   purpose; `parseFloat` reintroduces exactly the problem the column type
   prevents.

## The rounding table worth memorising

| x | `numeric` | `double precision` |
|---|---|---|
| **2.5** | **3** (away from zero) | **2** (to even) |
| -2.5 | -3 | -2 |

Documented behaviour, and a second independent reason money is never float:
even its *rounding rule* differs from the one finance requirements assume.

## Phase gate

You are done here when your money columns carry a currency, your calculations
round once, your splits provably sum to the whole, and no code path calls
`parseFloat` on an amount.

## Where this connects

- [02 · numeric vs float](../02-numeric-vs-float.md) — the measurement behind
  the type choice, including integer cents at 2.8× faster.
- [The pg driver](../../phase-7-pg-driver/README.md) — type parsing, and why
  overriding it for `numeric` is a bad trade.
- [Transactional outbox](../../phase-12-beyond-tables/18-transactional-outbox.md)
  — making a ledger entry and its side effect atomic.
- [Audit and history tables](../../phase-12-beyond-tables/19-audit-history-tables.md)
  — immutable records, the same instinct as an append-only ledger.
- [Constraints](../../phase-3-ddl/04-constraints.md) — `CHECK` constraints on sign and range,
  and the composite key that stops currencies mixing.

---

← [Phase index](../README.md) · Start → [Storing money](01-storing-money.md)
