---
title: "Python's json module writes NaN and Infinity that RFC 8259 forbids, and whether -0.0 survives the wire is decided by whether the producer emitted a decimal point"
sidebar_label: "6g · JSON and the wire"
sidebar_position: 66
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14
> [`json`](https://docs.python.org/3.14/library/json.html) reference
> (`allow_nan`, `parse_constant`, `parse_int`, `parse_float`, `skipkeys`, the
> "Infinite and NaN Number Values" section and the conversion tables) and
> [RFC 8259 §6 Numbers](https://www.rfc-editor.org/rfc/rfc8259.txt).
> Version spine: **Python 3.14.7**.

**Python's `json` module writes `NaN`, `Infinity` and `-Infinity` by default,
which RFC 8259 explicitly forbids — the module documentation says so itself, in
a comment inside its own example. A negative zero fares differently: it survives
`json.dumps` as the text `-0.0`, but a *producer* that emitted `-0` without a
decimal point hands Python's decoder an integer token, which routes through
`parse_int` and comes back as a plain `0` with the sign gone. Both tokens are
legal JSON. The two guards that fix this — `allow_nan=False` on the way out and
`parse_constant` on the way in — are both off by default, and the read-side one
requires you to write a function, which is why it is the one nobody adds. This
chunk is JSON; [06h](06h-other-runtimes-and-databases.md) is what the runtime
and the database at the other end do with the same values.**

## What `json.dumps` does with the four odd floats

The `json` docs are unusually direct about this. From the "Infinite and NaN
Number Values" section:

> *"The RFC does not permit the representation of infinite or NaN number values.
> Despite that, by default, this module accepts and outputs `Infinity`,
> `-Infinity`, and `NaN` as if they were valid JSON number literal values"*

with the documentation's own example, comment included:

```python
>>> # Neither of these calls raises an exception, but the results are not valid JSON
>>> json.dumps(float('-inf'))
'-Infinity'
>>> json.dumps(float('nan'))
'NaN'
>>> # Same when deserializing
>>> json.loads('-Infinity')
-inf
>>> json.loads('NaN')
nan
```

RFC 8259 §6 is equally direct on the other side:

> *"Numeric values that cannot be represented in the grammar below (such as
> Infinity and NaN) are not permitted."*

Negative zero is a different case. The RFC's grammar is
`number = [ minus ] int [ frac ] [ exp ]` with `int = zero / ( digit1-9 *DIGIT )`,
so **`-0` and `-0.0` are both syntactically valid JSON** — the minus is an
independent production. The RFC simply has no opinion about whether a consumer
must preserve the distinction, and every consumer that parses into a
binary64 does, while every consumer that parses `-0` into an integer does not.

## `allow_nan` — the write-side guard

> *"allow_nan (bool) – If `False`, serialization of out-of-range `float` values
> (`nan`, `inf`, `-inf`) will result in a `ValueError`, in strict compliance
> with the JSON specification. If `True` (the default), their JavaScript
> equivalents (`NaN`, `Infinity`, `-Infinity`) are used."*

The `JSONEncoder` entry adds the rationale: the default behaviour *"is not JSON
specification compliant, but is consistent with most JavaScript based encoders
and decoders."* That claim of consistency is the part to be careful about — see
below, because it is not consistent with JavaScript's own built-in.

If your JSON crosses a process boundary, turn it off:

```python
json.dumps(payload, allow_nan=False)     # raises ValueError instead of lying
```

This converts a silent interoperability failure at the consumer into a loud
`ValueError` in the producer, where you have the stack trace and the data.

## `parse_constant` — the read-side guard

> *"parse_constant (callable | None) – If set, a function that is called with
> one of the following strings: `'-Infinity'`, `'Infinity'`, or `'NaN'`. This
> can be used to raise an exception if invalid JSON numbers are encountered.
> Default `None`."*

```python
def reject(token: str):
    raise ValueError(f"non-RFC JSON number: {token}")

json.loads(body, parse_constant=reject)
```

Note the asymmetry: `allow_nan=False` on the way out is a keyword on a call you
already make, and `parse_constant` on the way in requires you to supply a
function. Neither is the default, so an unguarded service accepts `NaN` from any
client — which matters, because as [06](06-nan-inf-and-signed-zero.md) covers, a
NaN passes every `0 <= x <= 100` range check ever written.

## `-0` versus `-0.0` on the wire

The decoder splits number tokens by shape, and the two hooks are documented
separately:

> *"parse_float – If set, a function that is called with the string of every
> JSON float to be decoded. By default, this is equivalent to `float(num_str)`."*

> *"parse_int – If set, a function that is called with the string of every JSON
> int to be decoded. By default, this is equivalent to `int(num_str)`."*

So a token with a `frac` or an `exp` part goes through `float()` and keeps its
sign, and a bare integer token goes through `int()`, which has no sign bit to
keep:

| Token on the wire | Hook | Python value |
|---|---|---|
| `-0.0` | `parse_float` → `float('-0.0')` | `-0.0` |
| `-0.0e0` | `parse_float` | `-0.0` |
| `-0` | `parse_int` → `int('-0')` | `0` — sign gone |

**Whether the sign of a zero survives a JSON round trip is decided by the
producer's formatting, not by anything on your side.** A producer that writes
floats with `repr` emits `-0.0` and the sign survives; a producer that trims
trailing zeros, or a JavaScript producer using `JSON.stringify`, emits an
integer-shaped token and it does not.

If you need the distinction, the only reliable route is not to put it in a
number at all — send a separate sign field, or send the value as a string and
parse it yourself with `float`.

## Float dict keys are stringified, and the round trip is documented as lossy

> *"Keys in key/value pairs of JSON are always of the type `str`. When a
> dictionary is converted into JSON, all the keys of the dictionary are coerced
> to strings. As a result of this, if a dictionary is converted into JSON and
> then back into a dictionary, the dictionary may not equal the original one.
> That is, `loads(dumps(x)) != x` if x has non-string keys."*

So `{-0.0: 1}` serialises with a string key, and the value comes back keyed by
that string, not by a float. And because `{0.0: 'a', -0.0: 'b'}` was already a
one-entry dict before serialisation ever started
([06c](06c-signed-zero-and-serialisation.md)), you cannot recover the pair.

## Gotchas

**★ `json.dumps` produces invalid JSON by default and does not warn.** The
module's own documentation says so — *"the results are not valid JSON"* — but
`allow_nan=True` is the default and nothing in a code review flags a plain
`json.dumps(payload)`. The consumer discovers it, in production, as a parse
failure on the whole document rather than on one field.

**★ `-0` and `-0.0` on the wire are not the same value once Python has parsed
them.** A bare `-0` goes through `parse_int`, which is documented as equivalent
to `int(num_str)`, and comes back as a plain `0`. Any producer that trims a
trailing `.0` — a hand-written serialiser, a `format(x, 'g')`, a JavaScript
client — silently strips the sign of every zero it sends you, and no schema
validator will notice, because both tokens are valid JSON numbers.

**★ `parse_float=decimal.Decimal` does not fix the `-0` case.** It replaces the
*float* hook, and `-0` is not a float token; it still routes through
`parse_int`. If you want `Decimal` for every number you must override both
hooks — and even then `Decimal('-0')` only reappears for tokens that carried a
decimal point in the first place.

```python
json.loads(body, parse_float=Decimal, parse_int=Decimal)
```

**★ `allow_nan=False` raises `ValueError`, which is easy to catch too broadly.**
A `try/except ValueError` around a serialisation step — common when the same
block also handles encoding problems — turns the strict-compliance guard back
into silence. Catch it where you can log the offending field, or validate
up front with `math.isfinite` so the failure names the value.

**★ Float dict keys become strings, and the docs say the round trip is not
identity.** *"`loads(dumps(x)) != x` if x has non-string keys."* For zero keys
this compounds with the collapse described in
[06c](06c-signed-zero-and-serialisation.md): the dict had already merged `0.0`
and `-0.0` into one entry before serialisation began, so the loss happened
twice and only the second one is documented.

**★ `skipkeys=True` makes the key problem worse, not better.** It is documented
to skip keys that are not `str`, `int`, `float`, `bool` or `None` — a float key
is *not* skipped, it is coerced. So turning `skipkeys` on to "be safe about
weird keys" leaves float keys exactly as they were and silently drops the ones
you actually wanted to hear about.

**★ Sanitising inbound floats is not enough if you also serialise computed
ones.** A service that cleans what it receives but not what it produces still
emits negative zeros, because `round(x, 2)` lives on the outbound path
([06d](06d-where-negative-zero-comes-from.md)). Put the normalisation on both
edges, or put the whole weight on `allow_nan=False` plus an explicit
`+ 0.0` in the encoder's `default` hook.

## Interview questions

**★ Is `json.dumps(float('nan'))` valid JSON?**
No, and the Python documentation says so in as many words: *"The RFC does not
permit the representation of infinite or NaN number values. Despite that, by
default, this module accepts and outputs `Infinity`, `-Infinity`, and `NaN` as
if they were valid JSON number literal values."* RFC 8259 §6 states that
*"Numeric values that cannot be represented in the grammar below (such as
Infinity and NaN) are not permitted."* Pass `allow_nan=False` and you get a
`ValueError` in the producer instead of a parse error in the consumer.

**★ Does `-0.0` survive a JSON round trip?**
Through Python alone, yes: `json.dumps(-0.0)` writes a token with a decimal
point, and the decoder routes it through `parse_float`, documented as equivalent
to `float(num_str)`, so the sign returns. Through a foreign producer it depends
on formatting: a bare `-0` token is a JSON *integer* by RFC 8259's grammar,
Python routes it through `parse_int` — documented as equivalent to
`int(num_str)` — and `int` has no sign bit, so the sign is gone. The distinction
therefore lives in the producer's formatting choices, which is not a place to
put semantics.

**★ How do you make a Python JSON API strictly RFC-compliant in both
directions?**
`json.dumps(..., allow_nan=False)` on the way out, which is documented to raise
`ValueError` for `nan`, `inf` and `-inf` *"in strict compliance with the JSON
specification"*; and `json.loads(..., parse_constant=reject)` on the way in,
where `parse_constant` is documented to be called with `'-Infinity'`,
`'Infinity'` or `'NaN'` and *"can be used to raise an exception if invalid JSON
numbers are encountered"*. Neither is the default, and the asymmetry matters:
the write-side guard is a keyword on a call you already make, while the
read-side guard requires you to write a function, so it is the one that gets
skipped.

**★ Is `-0` legal JSON at all?**
Yes. RFC 8259's grammar is `number = [ minus ] int [ frac ] [ exp ]` with
`int = zero / ( digit1-9 *DIGIT )`, so the minus is an independent production
and `-0` parses. What the RFC does *not* do is say anything about whether a
consumer must preserve the distinction between `-0` and `0` — and since it also
notes that *"good interoperability can be achieved by implementations that
expect no more precision or range"* than IEEE 754 binary64, a consumer that
reads the token into a double will keep the sign while one that reads it into an
integer will not. Both are conforming.

**★ A payload contains `{"rate": -0.0}` and a downstream consumer keys a cache
on the parsed value. What can go wrong?**
The cache key collapses. `-0.0 == 0.0` and the two hash identically, so a
`-0.0` lookup returns the `0.0` entry and vice versa
([06c](06c-signed-zero-and-serialisation.md)). If the cached artefact is
sign-sensitive — a rendered string, a formatted report row — the wrong one is
served, and it stays wrong for the process lifetime because nothing about the
key looks different. Normalise on ingest with `x + 0.0`, before the value ever
reaches a hash-based structure.

---

← Prev: [Printing negative zero](06f-printing-negative-zero.md) · Index: [Numbers](README.md) · Next → [Other runtimes and databases](06h-other-runtimes-and-databases.md)

{/* FOOTER */}
