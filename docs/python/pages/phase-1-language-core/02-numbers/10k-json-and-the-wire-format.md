---
title: "JSON has one number type and it is a double, so reading money out of a request body and writing it back are both explicit acts you must remember to perform"
sidebar_label: "10k · JSON and the wire format"
sidebar_position: 110
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`json`](https://docs.python.org/3.14/library/json.html) —
> [`json.load`/`loads`](https://docs.python.org/3.14/library/json.html#json.load),
> [`json.dump`/`dumps`](https://docs.python.org/3.14/library/json.html#json.dump)
> and [Infinite and NaN number values](https://docs.python.org/3.14/library/json.html#infinite-and-nan-number-values) —
> and the [`decimal`](https://docs.python.org/3.14/library/decimal.html) context
> attributes. Version spine: **Python 3.14.7**.

**Everything in the previous chunks is about keeping a value exact inside one
process. The value does not live there — it arrives as JSON and leaves as JSON,
and JSON has exactly one number type, which every consumer in the world implements
as a double. `json.loads` therefore produces `float` unless you pass
`parse_float`, and `json.dumps` refuses a `Decimal` outright rather than guessing.
Both of those defaults are correct and both of them mean the same thing: reading
and writing money over the wire are explicit acts, each one line long, and each
one you forget is a class of silent corruption.**

## JSON in: `parse_float`

JSON's grammar has one number type and no notion of scale. By default Python
parses every non-integer literal with `float`:

> *"`parse_float` (callable | None) – If set, a function that is called with the
> string of every JSON float to be decoded. If `None` (the default), it is
> equivalent to `float(num_str)`. This can be used to parse JSON floats into
> custom datatypes, for example `decimal.Decimal`."*

```python
import json
from decimal import Decimal

json.loads('1.1', parse_float=Decimal)          # Decimal('1.1')
json.loads(body, parse_float=Decimal)           # every float in the document
```

The callable receives the **original substring**, not a float, so nothing has been
rounded before you see it — this is a lossless hook, and it is the only correct
way to read money out of JSON as a number. `parse_int` is the same hook for
integer literals, if you want minor units as `Decimal` too.

Two hazards remain. `parse_float` applies to *every* float in the document, so a
latitude and a price both become `Decimal` — usually fine, occasionally a
surprise for downstream code that expects floats. And it does nothing about
`NaN`/`Infinity` literals, which have their own hook:

> *"`allow_nan` (bool) – If `False`, serialization of out-of-range float values
> (`nan`, `inf`, `-inf`) will result in a `ValueError`, in strict compliance with
> the JSON specification. If `True` (the default), their JavaScript equivalents
> (`NaN`, `Infinity`, `-Infinity`) are used."*

> *"The RFC does not permit the representation of infinite or `NaN` number values.
> Despite that, by default, this module accepts and outputs `Infinity`,
> `-Infinity`, and `NaN` as if they were valid JSON number literal values."*

`parse_constant` is *"called with one of the following strings: `'-Infinity'`,
`'Infinity'`, or `'NaN'`"* — point it at something that raises, and a document
containing those tokens is rejected at parse time rather than at the first
comparison that returns `False` in both directions.

## JSON out: `default=`, and the argument for strings

`json.dumps` has no `Decimal` support at all. The encoder's escape hatch is:

> *"`default` (callable | None) – A function that is called for objects that can't
> otherwise be serialized. It should return a JSON encodable version of the object
> or raise a `TypeError`. If `None` (the default), `TypeError` is raised."*

```python
def money_default(o):
    if isinstance(o, Decimal):
        return str(o)                  # "19.99" — exact, scale preserved
    raise TypeError(f"not serialisable: {type(o).__name__}")

json.dumps(payload, default=money_default)
```

**Emit a string, not a float.** `default=float` is the tempting one-liner and it
undoes the entire exercise: the value becomes a double on the way out, and the
consumer — very often JavaScript, whose only number type is a double — cannot
recover it. A string preserves the digits and the scale (`"19.90"` stays two
places), and it forces the consumer to parse deliberately. If your API contract
must emit a JSON number, at least emit it with the correct scale and document the
precision limit; there is no way to make a JSON number both exact and universally
readable.

Note also that `str(Decimal)` is affected by the context's `capitals` setting for
values that print exponentially, and by the value's own exponent: a `Decimal`
whose exponent is small enough prints as `1E+2` rather than `100`. Quantize before
serialising, so the string is the one your schema promises.

## Gotchas

**★ `json.loads` without `parse_float` has already lost the money by the time you
see it.** Converting the resulting `float` to `Decimal` afterwards converts the
*error* exactly. The hook is the only place the original digits still exist.

**★ `default=float` in `json.dumps` silently undoes everything.** It is the most
common "fix" for the `TypeError`, it type-checks, it produces valid JSON, and it
turns exact money into a double on the way out. Serialise `str(amount)`.

**★ A JSON document containing `NaN` or `Infinity` parses by default.** Python's
encoder and decoder both accept them despite the RFC. Set
`parse_constant` to something that raises on the way in, and `allow_nan=False` on
the way out if you must emit numbers.

**★ Quantizing a value read back from JSON or SQL does not repair it.** If it
arrived as a float and lost digits on the way, `quantize` rounds the corrupted
value neatly to two places and hands you a wrong number that passes every scale
assertion. Fix the boundary; a `quantize` after the fact only hides the evidence.

**★ `capitals` changes `str()`, and `str()` is your wire format.** With
`capitals=1` (the default) a value large or small enough to print exponentially
serialises as `1E+9`; with `capitals=0` it is `1e+9`. Exported CSVs, cache keys
and signature payloads all differ between the two. Quantize before serialising so
the exponential form never appears.

**★ CSV and spreadsheet exports are a float boundary too.** A CSV read with
`pandas` becomes `float64` unless you pass a converter; opening it in Excel
converts it again. If a report must be exact, emit it as text and mark the column
as text.

## Interview questions

**★ How do you read money out of a JSON request body without losing precision?**
`json.loads(body, parse_float=Decimal)`. The hook is called with the original
substring of every JSON float, so no conversion has happened yet — this is
lossless, unlike converting the resulting `float` afterwards, which converts the
error exactly. Add `parse_constant` pointing at something that raises so `NaN` and
`Infinity`, which Python accepts by default despite the RFC forbidding them, are
rejected at parse time.

**★ `json.dumps` raises `TypeError` on your `Decimal`. What do you do, and what do
you not do?**
Pass `default=` a function that returns `str(amount)`. What you do not do is
`default=float`: it is the obvious fix, it produces valid JSON, and it converts
exact money to a double on the way out — and if the consumer is JavaScript, whose
only number type is a double, the value cannot be recovered even in principle. A
string keeps the digits and the scale, and makes the consumer parse deliberately.

**★ Write the boundary function that turns an untrusted string into money. What must
it check that `Decimal()` does not?**
`Decimal()` accepts far more than an amount: underscores, surrounding whitespace,
non-ASCII digits, exponent notation, and the words `inf`/`Infinity`/`NaN`/`sNaN`
in any case. So the constructor is a converter, not a validator, and everything
your contract requires has to be asserted separately — the character set, the
finiteness, the sign, and the scale.

```python
from decimal import Decimal, InvalidOperation
import re

AMOUNT = re.compile(r"\A-?\d{1,12}(\.\d{1,2})?\Z")   # ASCII digits, <=2 places

def parse_money(raw: str) -> Decimal:
    if not AMOUNT.fullmatch(raw):
        raise ValueError(f"not an amount: {raw!r}")
    try:
        d = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"not an amount: {raw!r}") from exc
    if not d.is_finite():
        raise ValueError(f"not finite: {raw!r}")
    return d
```

The regex does the shape check, `Decimal` does the conversion, and `is_finite()`
is belt-and-braces for anything the regex is later loosened to allow.

**★ Where would you put the assertions in a system that must never lose a cent?**
At each boundary, in both directions. On the way in: parse with `parse_float=Decimal`,
validate the shape and finiteness, and quantize to the currency's scale with the
`Inexact` trap so over-precise input is rejected rather than rounded. Inside:
compute at full context precision and quantize once where a value becomes a
recorded amount. On the way out: assert the exponent before serialising, emit
strings rather than JSON numbers, and constrain the column so the database cannot
round for you. Each of these is one line, and each one omitted is a class of bug
that only appears in aggregate.

---

← Prev: [Decimal contexts across threads](10j-decimal-contexts-across-threads.md) · Index: [Numbers](README.md) · Next → [numeric, money and SQLite storage](10l-sql-storage-for-decimal.md)

{/* FOOTER */}
