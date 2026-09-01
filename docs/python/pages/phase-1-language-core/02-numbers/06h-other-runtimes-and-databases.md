---
title: "JavaScript writes null where Python writes NaN and PostgreSQL sorts NaN as the largest value, so the same bytes mean three different things and the reconciliation has to be explicit"
sidebar_label: "6h · Other runtimes and databases"
sidebar_position: 67
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against
> [MDN on `JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
> and [MDN on `Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is),
> [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.txt),
> the [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
> documentation, the Python 3.14
> [`json`](https://docs.python.org/3.14/library/json.html) and
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html) references, and
> [`math.isfinite`](https://docs.python.org/3.14/library/math.html).
> Version spine: **Python 3.14.7**.

**The `json` documentation defends its non-compliant `NaN` output by saying it
is "consistent with most JavaScript based encoders and decoders". JavaScript's
own built-in is not one of them: `JSON.stringify` is documented to write `null`
for `Infinity` and `NaN`, and `JSON.parse` implements RFC 8259's grammar, which
has no production for either token — so a Python response containing one NaN
fails to parse *in its entirety* in the browser. A database is a third opinion
again: PostgreSQL documents `Infinity` and `NaN` for both its exact and inexact
numeric types and then states outright that it treats NaN as equal to itself and
greater than everything else, so `MAX()` returns the NaN row. And on negative
zero, every one of these systems is silent — which is a finding, not a
reassurance.**

## What JavaScript actually does

MDN documents `JSON.stringify`'s number handling in one sentence:

> *"The numbers `Infinity` and `NaN`, as well as the value `null`, are all
> considered `null`."*

So the two runtimes disagree in both directions:

| Value | Python `json.dumps` (default) | JS `JSON.stringify` |
|---|---|---|
| `float('nan')` | `NaN` | `null` |
| `float('inf')` | `Infinity` | `null` |
| `float('-inf')` | `-Infinity` | `null` |

On the read side, `NaN` and `Infinity` are not in RFC 8259's grammar —
*"Numeric values that cannot be represented in the grammar below (such as
Infinity and NaN) are not permitted"* — so a conforming parser, `JSON.parse`
included, rejects the document Python just produced. The failure mode is
therefore: Python writes a payload, the browser throws a syntax error on the
**whole response**, and the field that caused it is one NaN buried three levels
down in a list of 400 rows. `allow_nan=False` moves that failure to the
producer, where the stack trace names the field
([06g](06g-negative-zero-across-a-boundary.md)).

The reverse direction is quieter and worse: a JavaScript client that computed a
NaN sends you `null`, which `json.loads` decodes as `None`. A `None` where a
float was expected raises a `TypeError` somewhere downstream, far from the
arithmetic that produced it, and the original meaning — "this computation was
undefined" — is gone.

### Negative zero in JavaScript

JavaScript has the same two zeros with the same equality rule. MDN's `Object.is`
page states it exactly:

> *"The only difference between `Object.is()` and `===` is in their treatment of
> signed zeros and `NaN` values. The `===` operator (and the `==` operator)
> treats the number values `-0` and `+0` as equal, but treats `NaN` as not equal
> to each other."*

with the documented examples `Object.is(0, -0)` being `false` and
`Object.is(-0, -0)` being `true`. So the language-level semantics mirror
Python's exactly: `-0 === 0` is true, and a dedicated function is needed to see
the difference.

What `JSON.stringify` emits for a `-0` is **not documented on the MDN page**, and
I could not retrieve the relevant `Number::toString` steps from the ECMAScript
specification to confirm it either way. **Do not rely on a negative zero
surviving a JavaScript round trip in either direction.** If the sign matters,
carry it in a field of its own — which is the same conclusion the JSON chunk
reaches for a different reason.

## Databases

PostgreSQL documents the special values for both the exact `numeric` type and
the inexact floating-point types, in near-identical language:

> *"In addition to ordinary numeric values, the floating-point types have
> several special values: `Infinity`, `-Infinity`, `NaN`. These represent the
> IEEE 754 special values 'infinity', 'negative infinity', and 'not-a-number',
> respectively."*

and then disagrees with Python and with IEEE 754 about comparison, deliberately
and with a stated reason:

> *"IEEE 754 specifies that `NaN` should not compare equal to any other
> floating-point value (including `NaN`). In order to allow floating-point
> values to be sorted and used in tree-based indexes, PostgreSQL treats `NaN`
> values as equal, and greater than all non-`NaN` values."*

The `numeric` section says the same thing in its own words, so this is not a
float-only quirk — it is the database's comparison semantics.

The consequences run in both directions:

- `x != x` identifies a NaN in Python and identifies **nothing** in PostgreSQL.
- `GROUP BY` over a column of NaNs yields **one** group in the database and one
  group *per object* in Python, because Python's NaN hashing is identity-based
  ([06b](06b-detecting-nan-and-containers.md)).
- `MAX(col)` and `ORDER BY col DESC LIMIT 1` both return the NaN row, because
  NaN sorts above every real value.
- A `UNIQUE` constraint on a NaN column rejects a second NaN; a Python `set`
  would have accepted it.

The filter has to be written in the database's semantics, not Python's:

```sql
-- WHERE col = col is TRUE for NaN in PostgreSQL, so it filters nothing.
SELECT max(col) FROM t WHERE col <> 'NaN'::float8;
```

### On negative zero, the documentation is silent

The PostgreSQL documentation mentions negative zero **nowhere** — not in the
`numeric` section, not in the floating-point section, not in the comparison
notes. That silence is the finding. There is no documented guarantee that a
`-0.0` you insert comes back signed, none that an index distinguishes it, and
none that a cast between `numeric` and `double precision` preserves it. Do not
build on any of the three.

The same caution applies through Python's `sqlite3`, which documents only that
SQLite *"natively supports the following types: `NULL`, `INTEGER`, `REAL`,
`TEXT`, `BLOB`"*. A Python float maps to `REAL`; what happens to the sign of a
zero across a store-and-fetch is not documented, and SQLite's type affinity
means a value written to an `INTEGER`-affinity column may be converted, which
would discard the sign outright. Measure it on your own build if it matters, and
prefer not to need to.

## The boundary function

Everything above collapses into one rule: **normalise at the boundary, in one
named place, in code a reviewer can point at.**

```python
import math, json

def wire_safe(x: float) -> float:
    """Reject the values RFC 8259 forbids; flatten -0.0 to 0.0."""
    if not math.isfinite(x):
        raise ValueError(f"non-finite float cannot be serialised: {x!r}")
    return x + 0.0

json.dumps(payload, allow_nan=False)            # write side, always
json.loads(body, parse_constant=reject_token)   # read side, always
```

`math.isfinite` rejects all three of NaN, `inf` and `-inf` in a single call
([06b](06b-detecting-nan-and-containers.md)); `x + 0.0` removes a negative zero
and changes nothing else ([06e](06e-what-erases-the-sign.md)). Doing it in a
named function rather than inline means the next person to ask "why is this
here?" gets an answer from the docstring rather than from a git blame.

## Gotchas

**★ The `json` docs' claim of consistency "with most JavaScript based encoders
and decoders" does not cover the JavaScript built-in.** `JSON.stringify` maps
`Infinity` and `NaN` to `null`, and `JSON.parse` rejects the `NaN` token
outright. If the consumer is a browser, Python's default is not interoperable in
either direction — and the sentence in the docs reads as reassurance, which is
how it gets skipped in review.

**★ A single NaN fails the whole response, not one field.** JSON is parsed as a
document. One `NaN` token in row 217 of a 400-row payload means the browser gets
a syntax error and zero rows, which presents as "the API is down" rather than
"one value is bad". This is why `allow_nan=False` belongs on every outbound
`dumps` in a service, not just the ones you suspect.

**★ A JavaScript client's NaN arrives as `None`, and the meaning is lost.**
`JSON.stringify` wrote `null`; `json.loads` gives `None`; the downstream
`TypeError` is raised in a different function from the one that cares. If a
client can legitimately compute an undefined value, agree an explicit encoding
for it — a string sentinel, a status field — rather than letting two runtimes
negotiate it through their differing defaults.

**★ PostgreSQL sorts `NaN` as the largest value and treats NaNs as equal;
Python does neither.** `MAX(col)` returns the NaN, `ORDER BY col DESC LIMIT 1`
returns the NaN row, and a `UNIQUE` constraint rejects a second NaN. Application
code that then asserts the maximum is a real number fails. The fix belongs in
the query, and it cannot be `WHERE col = col`, because that predicate is true
for NaN in PostgreSQL and false in Python — the two idioms have opposite
meanings in the two systems.

**★ The `numeric` type is not a refuge from NaN.** PostgreSQL documents
`Infinity`, `-Infinity` and `NaN` for `numeric` as well as for the
floating-point types, with the same comparison semantics. Moving a money column
from `double precision` to `numeric` fixes the rounding
([10](10-decimal-for-money.md)) and does nothing at all about the special
values.

**★ The PostgreSQL documentation is silent on negative zero, and silence is not
a guarantee.** Neither section mentions it. A `-0.0` may or may not come back
signed, may or may not be distinguished by an index, and may or may not survive
a cast. If the distinction carries meaning in your domain, store an explicit
sign column where the behaviour is defined by your schema instead of by an
undocumented interaction between a driver, a type system and a storage format.

**★ SQLite's type affinity can convert a `REAL` you wrote into an `INTEGER`.**
The `sqlite3` docs list the five native types; SQLite itself applies affinity
rules based on the declared column type. A float stored in an
`INTEGER`-affinity column may be converted, and an integer has no sign bit. This
is a second, entirely different route to the same loss, and it is a schema
problem rather than a Python one.

**★ Three systems, three definitions of equality for the same eight bytes.**
Python: NaN unequal to itself, zeros equal, identity-based NaN hashing.
JavaScript: the same value semantics, but `JSON.stringify` erases the special
values. PostgreSQL: NaN equal to itself and maximal, so it can be indexed. Any
invariant you rely on has to be re-established at each crossing; none of them
travels with the data.

## Interview questions

**★ A Python service sends JSON to a browser and the browser throws a syntax
error on some responses. Where do you look first?**
A NaN or an infinity in the payload. Python's `json` emits the bare tokens
`NaN`, `Infinity` and `-Infinity` by default; `JSON.parse` implements RFC 8259's
grammar, which has no production for them, so the entire response fails rather
than one field. Reproduce by searching the raw response body for those three
tokens, then fix it at the producer with `allow_nan=False`. Note also that the
browser's own `JSON.stringify` would have written `null` for those values, so
the two runtimes were never symmetric and the Python docs' "consistent with most
JavaScript based encoders and decoders" does not describe the built-in.

**★ Your PostgreSQL query returns a maximum that Python then fails to compare.
What happened?**
The column contains a NaN, and PostgreSQL documents that it *"treats `NaN`
values as equal, and greater than all non-`NaN` values"* so that floats can be
sorted and used in tree-based indexes. `MAX()` and `ORDER BY ... DESC LIMIT 1`
therefore both return the NaN row. Python then applies IEEE semantics, where the
NaN compares false against everything, so a downstream range check fails open
rather than raising. The two systems have genuinely different comparison
semantics for identical bytes, and the reconciliation must be explicit — filter
NaNs in the query with `col <> 'NaN'::float8`, not with `col = col`, which is
true for NaN in PostgreSQL.

**★ Can you rely on a database preserving the sign of a zero?**
No, and not because it fails — because nothing says it succeeds. The PostgreSQL
documentation does not mention negative zero for either the `numeric` or the
floating-point types, and Python's `sqlite3` documentation lists SQLite's five
native types without discussing it. Silence is not a guarantee in either
direction, and SQLite's type affinity adds a second route to losing it. If the
distinction carries meaning, encode it as data — an explicit sign or state
column — rather than in a float's sign bit.

**★ Does moving from `double precision` to `numeric` protect you from NaN?**
No. PostgreSQL documents `Infinity`, `-Infinity` and `NaN` for `numeric` too,
with the same "equal to itself and greater than everything" comparison rule. The
change buys you exact decimal arithmetic and fixes rounding behaviour; it does
not remove the special values, and it does not align the database's comparison
semantics with Python's. Those are separate problems with separate fixes.

**★ Where should the normalisation live — the producer, the consumer, or both?**
The producer, enforced. `allow_nan=False` makes non-finite floats a `ValueError`
in the process that created them, where the stack trace and the data are both
available; the consumer, by contrast, sees only a failed parse of an entire
document. Add a read-side `parse_constant` guard as defence in depth, because
you do not control every producer. Normalising negative zero is the same
argument in miniature: do it on the way out, in one named function, so the
values that reach a hash, a set, a database or another runtime are already the
shape you intend.

**★ Three systems see the same eight bytes. Give one invariant that does not
survive the crossing.**
"`x != x` detects a NaN." True in Python, meaningless in PostgreSQL, which
treats NaNs as equal so that they can be indexed — and moot in a JSON payload
produced by JavaScript, where `JSON.stringify` replaced the NaN with `null`
before it ever left. Any of the three is enough to break code that assumes the
IEEE rule holds end to end, and the failure in each case is silent rather than
loud.

---

← Prev: [JSON and the wire](06g-negative-zero-across-a-boundary.md) · Index: [Numbers](README.md) · Next → [Comparing floats](07-comparing-floats.md)

{/* FOOTER */}
