---
title: "PostgreSQL numeric is the right column and it still rounds you silently on scale, orders NaN the opposite way to Python, and SQLite has no decimal type at all"
sidebar_label: "10l · SQL storage for Decimal"
sidebar_position: 111
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the PostgreSQL 18 manual on
> [numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) and
> [monetary types](https://www.postgresql.org/docs/18/datatype-money.html), and the
> Python 3.14 library reference for
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html) —
> [`register_adapter`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.register_adapter)
> and [SQLite and Python types](https://docs.python.org/3.14/library/sqlite3.html#sqlite-and-python-types).
> Version spine: **Python 3.14.7**, PostgreSQL 18.

**A `numeric` column is exact arithmetic in the database and the correct home for
money — but its scale is enforced by rounding, not by rejection, so an amount with
one digit too many is quietly changed by the server after your application
computed it exactly. Its `NaN` ordering is the deliberate opposite of Python's.
Its `money` type takes its precision from a server locale and should not be used.
And SQLite has five types, none of them decimal, so every amount you store there
is a choice between text that sorts wrongly and integers that need the currency
exponent carried alongside.**

## PostgreSQL: `numeric` is exact, and rounds when you are not looking

> *"The type `numeric` can store numbers with a very large number of digits. It is
> especially recommended for storing monetary amounts and other quantities where
> exactness is required. Calculations with `numeric` values yield exact results
> where possible, e.g., addition, subtraction, multiplication. However,
> calculations on `numeric` values are very slow compared to the integer types, or
> to the floating-point types described in the next section."*

The behaviour that surprises people is the asymmetry between the two ways a value
can be too big for its column:

> *"If the scale of a value to be stored is greater than the declared scale of the
> column, the system will round the value to the specified number of fractional
> digits. Then, if the number of digits to the left of the decimal point exceeds
> the declared precision minus the declared scale, an error is raised."*

**Too many decimal places rounds silently. Too many integer digits raises.** So
`NUMERIC(3, 1)` *"will round values to 1 decimal place and can store values
between -99.9 and 99.9, inclusive"*. A three-decimal dinar amount inserted into a
`NUMERIC(19, 2)` column is rounded by the database, after your application went to
the trouble of computing it exactly, and nothing in the application logs will show
it. Quantize to the column's scale in Python — and assert it — so the rounding
happens where your rounding mode applies.

Other details worth carrying:

- *"The maximum precision that can be explicitly specified in a `numeric` type
  declaration is 1000."*
- Since PostgreSQL 15, *"it is allowed to declare a `numeric` column with a
  negative scale. Then values will be rounded to the left of the decimal point."*
  `NUMERIC(2, -3)` *"will round values to the nearest thousand"*.
- Storage is not padded: *"Numeric values are physically stored without any extra
  leading or trailing zeroes. Thus, the declared precision and scale of a column
  are maximums, not fixed allocations."*
- `numeric` supports `Infinity`, `-Infinity` and `NaN`, but *"an infinity can only
  be stored in an unconstrained `numeric` column, because it notionally exceeds
  any finite precision limit."*

### The `NaN` disagreement

> *"In most implementations of the 'not-a-number' concept, `NaN` is not considered
> equal to any other numeric value (including `NaN`). In order to allow `numeric`
> values to be sorted and used in tree-based indexes, PostgreSQL treats `NaN`
> values as equal, and greater than all non-`NaN` values."*

Python does the opposite on both counts: `Decimal('NaN') == Decimal('NaN')` is
`False`, and ordering against a `NaN` signals `InvalidOperation` rather than
sorting it to the top ([10i](10i-special-values-and-stdlib-interop.md)). So a
`GROUP BY` or `DISTINCT` that collapses `NaN`s in the database will not collapse
them in Python, `ORDER BY amount DESC` puts `NaN` first while a Python `sorted()`
raises, and a round-trip test comparing the two will fail in a way that looks like
a driver bug. The real answer is to keep `NaN` out of money columns entirely with
a `CHECK` constraint.

### The `money` type, and why not to use it

> *"The `money` type stores a currency amount with a fixed fractional precision;
> see Table 8.3. The fractional precision is determined by the database's
> `lc_monetary` setting."*

> *"Since the output of this data type is locale-sensitive, it might not work to
> load `money` data into a database that has a different setting of `lc_monetary`.
> To avoid problems, before restoring a dump into a new database make sure
> `lc_monetary` has the same or equivalent value as in the database that was
> dumped."*

> *"Division of a `money` value by an integer value is performed with truncation of
> the fractional part towards zero."*

A type whose scale comes from a server setting and whose dumps are not portable is
not a type to build a ledger on. The manual's own advice under the floating-point
section is the one to follow: *"If you require exact storage and calculations
(such as for monetary amounts), use the `numeric` type instead."*

⚠️ **Driver mapping is out of scope here and must not be assumed.** Which Python
type a driver returns for a `numeric` column, and how it adapts a `Decimal` on the
way in, is a property of the driver rather than of PostgreSQL. I could not verify
psycopg's adaptation documentation for this page, so nothing about it is asserted:
check your driver's own documentation, and pin the behaviour with a round-trip
test that asserts both the type and the exponent of what comes back.

## SQLite has no decimal type

> *"SQLite natively supports the following types: `NULL`, `INTEGER`, `REAL`,
> `TEXT`, `BLOB`."*

There is no fifth option. A `Decimal` must be adapted to one of those, and the
choice is yours:

```python
import sqlite3
from decimal import Decimal

sqlite3.register_adapter(Decimal, str)                      # store as TEXT
sqlite3.register_converter("decimal", lambda b: Decimal(b.decode()))

con = sqlite3.connect("ledger.db", detect_types=sqlite3.PARSE_DECLTYPES)
con.execute("CREATE TABLE t (amount decimal NOT NULL)")
```

`register_adapter` is *"Register an adapter callable to adapt the Python type
`type` into an SQLite type. The adapter is called with a Python object of type
`type` as its sole argument, and must return a value of a type that SQLite
natively understands."* The converter is the other direction and needs
`detect_types`, because SQLite columns are dynamically typed and the declared type
is the only clue.

**TEXT preserves the digits and the scale but sorts and compares as text**, so
`WHERE amount > '9'` is a string comparison and `ORDER BY amount` is
lexicographic. **INTEGER minor units** sort and aggregate correctly and are the
better choice whenever you need SQL to do arithmetic — at the cost of storing the
currency's exponent alongside. **REAL is a double** and is never the right answer
for money.

Note the deprecation while you are here: *"The default adapters and converters are
deprecated as of Python 3.12. Instead, use the Adapter and converter recipes and
tailor them to your needs."* That covers the built-in `date`/`datetime` handling,
not `Decimal` (which never had one) — but it is the same code path, and a codebase
that relied on the implicit `datetime` adapters will start warning in the same
place you are adding your `Decimal` one.

## Gotchas

**★ PostgreSQL rounds scale overflow and raises on precision overflow.** The
asymmetry means "too precise" is silent and "too large" is loud. Quantize to the
column's scale in the application, where your rounding mode is the one that
applies, and assert it before the insert.

**★ `NUMERIC` without a precision is not the same as `NUMERIC(19, 2)`.** An
unconstrained column accepts any scale — including a three-place amount you meant
to store as two — and will happily hold `Infinity`. Constrain the column, or add a
`CHECK (scale(amount) = 2)`.

**★ PostgreSQL sorts `NaN` as the largest value and treats `NaN = NaN` as true.**
Python does neither. Any code that reconciles a database ordering with a Python
ordering diverges on `NaN`, and `DISTINCT` collapses in one and not the other.
Forbid `NaN` in money columns with a `CHECK` constraint.

**★ `money` in PostgreSQL depends on a server locale setting.** Its fractional
precision comes from `lc_monetary` and its dumps are not portable to a database
with a different setting. Use `numeric`.

**★ SQLite `TEXT` money sorts lexicographically.** `'100.00' < '99.00'` is true as
text. If SQL needs to compare, aggregate or index amounts, store integer minor
units instead and convert on the way out.

## Interview questions

**★ What happens when you insert `19.999` into a `NUMERIC(19, 2)` column?**
It is silently rounded to two decimal places by the database. PostgreSQL only
raises when the digits to the *left* of the point exceed precision minus scale.
That means over-precise money is a silent data change with the database's rounding
rule rather than yours, which is why the application should quantize to the
column's scale — with its own rounding mode — and assert the scale before the
insert.

**★ Why does a round-trip test of `NaN` through PostgreSQL fail in a way
that looks like a driver bug?**
Because the two systems define `NaN` comparison oppositely. PostgreSQL documents
that it *"treats `NaN` values as equal, and greater than all non-`NaN` values"* so
that `numeric` can be sorted and indexed; Python follows IEEE, where `NaN` equals
nothing including itself and ordering signals `InvalidOperation`. So the database
groups, distincts and orders `NaN`s and Python refuses to. Nothing is broken; the
semantics differ. Keep `NaN` out of money columns with a `CHECK` constraint rather
than trying to reconcile them.

**★ How do you store a `Decimal` in SQLite?**
SQLite has five native types and none is decimal, so you adapt. `str` via
`sqlite3.register_adapter(Decimal, str)` preserves the digits and the scale but
sorts and compares as text, which is wrong for any SQL-side arithmetic. Integer
minor units sort, aggregate and index correctly, at the cost of carrying the
currency exponent separately. `REAL` is a double and is never right. Reading back
needs `register_converter` plus `detect_types=PARSE_DECLTYPES`, since the column's
declared type is the only type information SQLite keeps.

---

← Prev: [JSON and the wire format](10k-json-and-the-wire-format.md) · Index: [Numbers](README.md) · Next → [Decimal vs integer minor units](10m-decimal-versus-integer-minor-units.md)

{/* FOOTER */}
