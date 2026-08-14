---
title: "17.3 · Ledgers and the Node side"
sidebar_label: "03 · Ledgers & Node"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13. The `numeric`-arrives-as-a-string behaviour is
> **sandbox-measured** in [02 · numeric vs float](../02-numeric-vs-float.md)
> (`sandbox/pg-api/ex33-types-core.mjs`). Type semantics are validated against
> the **PostgreSQL 18** documentation. **No console output on this page.**

**Where money is stored is settled; how it is accumulated and how it crosses into
JavaScript are the remaining two ways to get it wrong.**

## The ledger pattern

For anything where balances must be defensible — payments, credits, wallets,
accounting — **do not store a mutable balance.** Store immutable entries and
derive the balance:

```sql
CREATE TABLE ledger_entries (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  bigint      NOT NULL REFERENCES accounts(id),
  amount      numeric(14,2) NOT NULL,   -- signed: + credit, − debit
  currency    char(3)     NOT NULL REFERENCES currencies(code),
  created_at  timestamptz NOT NULL DEFAULT now(),
  reference   text        NOT NULL
);

CREATE INDEX ON ledger_entries (account_id, created_at);
```

```sql
SELECT sum(amount) FROM ledger_entries WHERE account_id = $1;
```

Why this is worth the extra reads: a mutable `balance` column loses history, is
corrupted permanently by any bug that updates it wrongly, and is a contention
point every concurrent transaction fights over. An append-only ledger is
auditable, reconstructible, and each entry is an independent insert.

When derivation becomes too slow, add a **materialised snapshot** — a periodic
balance row plus the entries since — rather than reverting to a mutable balance.
That keeps the audit trail and bounds the read.

Two related pages: making the ledger's entries and their side effects atomic is
the [transactional outbox](../../phase-12-beyond-tables/18-transactional-outbox.md),
and keeping an immutable record of change is
[audit and history tables](../../phase-12-beyond-tables/19-audit-history-tables.md).

## From Node: `numeric` arrives as a string

Measured in [02 · numeric vs float](../02-numeric-vs-float.md): `pg` returns
`numeric` as a **JavaScript string**, not a number.

This is correct and deliberate. JavaScript's `number` is an IEEE-754 double, so
converting `numeric` to it would reintroduce exactly the imprecision the column
type exists to avoid.

```js
const {rows} = await pool.query('SELECT total_amount FROM invoices WHERE id = $1', [id]);
rows[0].total_amount        // '19.99'  ← a string
```

The rules that follow:

- **Never `parseFloat`.** It silently converts to a double and reintroduces the
  problem.
- **Do arithmetic in the database where you can.** `SUM`, tax, discounts computed
  in SQL stay in `numeric` and stay exact.
- **Where you must compute in JavaScript, use a decimal library** — `decimal.js`,
  `big.js` or similar — and keep values as strings at the boundaries.
- **Do not "fix" this** by overriding `pg`'s type parser to produce numbers.
  It looks convenient and it discards the guarantee.

For integer-cents storage the situation differs: `bigint` also arrives as a
string in `pg` (to avoid exceeding `Number.MAX_SAFE_INTEGER`), but cent values in
practice fit safely in a JavaScript integer, so `BigInt()` or a careful
`Number()` is defensible — with the unit still living in your code, which is the
cost noted in [chunk 01](01-storing-money.md).

## Trade-off

Exact money arithmetic trades **convenience for defensibility**. Rounding once at
the end, allocating remainders explicitly, storing the FX rate you used, and
deriving balances from an immutable ledger all add code and columns that a
mutable-balance, round-as-you-go design does not need — and that design is
genuinely simpler to write.

What you buy is the ability to answer "why is this number what it is" a year
later, and to have the parts sum to the whole every time. For anything a customer
is charged or an auditor may examine, that is not a nice-to-have.

The trade worth making consciously is **where the arithmetic happens**. Computing
in SQL keeps everything in `numeric` and exact, at the cost of business logic
living in queries. Computing in JavaScript keeps the logic where it is testable,
at the cost of needing a decimal library and discipline about never touching
`parseFloat`. Both are defensible; mixing them carelessly — some totals computed
in SQL, others in JS with floats — is how two parts of one system come to
disagree about the same invoice.

## Gotchas

**Symptom:** Totals differ by a penny from what was charged
**Cause:** Rounding at each step instead of once at the end; the discarded
fractions compound.
**Fix:** Carry full precision through, round once at the charging boundary, and
store both the inputs and the rounded outputs.

**Symptom:** Split amounts do not sum to the total
**Cause:** Even division with rounding — 100 / 3 gives 33.33 × 3 = 99.99.
**Fix:** Largest-remainder allocation: floor each share, distribute the leftover
units to the largest remainders. Assert that the parts sum to the whole.

**Symptom:** `round(2.5)` gives 3 in one place and 2 in another
**Cause:** Documented — `numeric` rounds ties away from zero, `double precision`
rounds ties to even. The value passed through a float somewhere.
**Fix:** Keep money in `numeric` end to end.

**Symptom:** Historical reports change value over time
**Cause:** Converting currencies at query time using today's rate.
**Fix:** Store `fx_rate` and `fx_rate_at` with the transaction and report the
stored converted amount.

**Symptom:** JavaScript arithmetic on amounts is slightly wrong
**Cause:** `parseFloat` on the string `pg` returns for `numeric`, reintroducing
IEEE-754 imprecision.
**Fix:** Keep it a string; compute in SQL, or use a decimal library. Do not
override the type parser.

**Symptom:** A balance column drifted from the sum of its transactions
**Cause:** A mutable balance updated by application code — one bug corrupts it
permanently and the history to repair it is gone.
**Fix:** Append-only ledger, derive the balance, snapshot periodically if reads
become slow.

## Interview questions

**★ How does `numeric` rounding differ from float rounding?**
`numeric` rounds ties **away from zero** (2.5 → 3), while `real` and
`double precision` round ties **to even** (2.5 → 2) — documented, with a
comparison table in the PostgreSQL manual. Beyond float's inexactness, this means
float rounding follows a different rule from the one financial requirements
usually assume, which is a second independent reason money is `numeric`.

**★ You must split £100 three ways. What do you store?**
Not 33.33 three times — that sums to 99.99. Use largest-remainder allocation:
floor each share in minor units, then distribute the leftover units to the
largest fractional remainders, giving 33.34 / 33.33 / 33.33. The invariant to
test is that the parts sum exactly to the whole; no rounding rule alone achieves
it, because the problem is divisibility, not rounding.

**★ Why store the exchange rate with the transaction?**
Because the rate applied at the moment of the transaction is part of the record.
Without `fx_rate` and `fx_rate_at`, a report re-converts at the current rate and
produces figures that do not match what the customer was charged, with no way to
reconstruct the original. Rates also need far more scale than amounts —
`numeric(18,8)` against `numeric(14,2)`.

**★ Why does `pg` return `numeric` as a string, and what should you do about it?**
Because JavaScript's `number` is an IEEE-754 double, so converting would
reintroduce exactly the imprecision `numeric` exists to prevent. Keep it a
string: do the arithmetic in SQL where possible, use a decimal library where not,
and never `parseFloat` or override the type parser for convenience.

**Why derive a balance instead of storing one?**
An append-only ledger is auditable and reconstructible, and each entry is an
independent insert. A mutable balance column loses history, is permanently
corrupted by any bug that writes it wrongly, and becomes a contention point for
every concurrent transaction. When derivation gets slow, add periodic balance
snapshots rather than reverting to a mutable column.

**Where should money arithmetic happen — SQL or application code?**
Either consistently. SQL keeps values in `numeric` and exact, at the cost of
logic in queries; application code keeps logic testable, at the cost of needing a
decimal library and never touching `parseFloat`. The failure is mixing them
carelessly, so that two parts of the system compute the same invoice differently.

---


---

← [Arithmetic and rounding](02-arithmetic-and-rounding.md) · Next → [Phase index](../README.md)
