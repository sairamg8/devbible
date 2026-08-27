---
title: "NaN: the float that is not equal to itself, and silently unsorts your data"
sidebar_label: "3b · NaN"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference §6.10
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html)
> (value comparisons — the not-a-number paragraph), the
> [`math.isnan`](https://docs.python.org/3.14/library/math.html) and
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) library docs, and
> the [`json`](https://docs.python.org/3.14/library/json.html) `allow_nan`
> documentation. Target: **CPython 3.14**.

**NaN is the one value in Python for which `x == x` is False and `x != x` is
True, and that is not a bug — it is IEEE 754, implemented faithfully. The cost is
that every algorithm that assumes a total order breaks quietly around it:
`sorted()` returns an unsorted list with no error, `max()` returns whichever
element the comparison sequence happened to favour, and `json.dumps` emits a
token that is not valid JSON. None of these raise. All of them are documented.**

This chunk continues [3 · Identity and equality](03-identity-and-equality.md).
The related surprise — that `nan in [nan]` is nevertheless True — is chunk
[3c · Container comparison](03c-container-comparison.md), because it is really a
fact about containers rather than about NaN.

## NaN is not equal to itself, by specification

The reference is explicit and cites the standard:

> *"The not-a-number values `float('NaN')` and `decimal.Decimal('NaN')` are
> special. Any ordered comparison of a number to a not-a-number value is false. A
> counter-intuitive implication is that not-a-number values are not equal to
> themselves. For example, if `x = float('NaN')`, `3 < x`, `x < 3` and `x == x`
> are all false, while `x != x` is true. This behavior is compliant with IEEE
> 754."*

Read the first sentence again: **any ordered comparison against NaN is false**.
Not "raises", not "returns NaN" — false. So `x < 3` and `x >= 3` are *both*
false, which breaks the assumption every sorting and bucketing algorithm makes,
that exactly one of `a < b`, `a == b`, `a > b` holds.

```python
nan = float('nan')

nan == nan          # False
nan != nan          # True   ← the only expression in Python where this happens
nan < 1             # False
nan >= 1            # False  ← not the negation of the line above
max([1, nan, 3])    # order-dependent and meaningless
sorted([3, nan, 1]) # returns *a* list; it is not sorted, and no error is raised
```

`sorted` is the dangerous one. Timsort assumes a consistent ordering; with NaN in
the input it still terminates, still returns a list of the right length, and the
order it produces depends on the input order and the algorithm's internal
comparisons. There is **no exception**. A NaN that reached your data through a
division, a `float("nan")` in a CSV, a pandas missing value, or a JSON payload
turns your "sorted" report into a silently wrong one.

The correct test is never `== float('nan')` — that is False for every input
including NaN. It is `math.isnan`:

```python
import math

math.isnan(nan)                       # True
[x for x in values if not math.isnan(x)]   # drop them before sorting
sorted(values, key=lambda x: (math.isnan(x), x))   # or push them to the end
```

`math.isnan` raises `TypeError` on non-floats, so if your list is mixed, guard
with `isinstance(x, float)` first — a `Decimal('NaN')` needs
`decimal.Decimal.is_nan()` instead, and a `None` needs a separate check.

## JSON does not save you

`NaN` is not valid JSON, and Python emits it anyway by default:

> *"If `allow_nan` is true (the default), then `NaN`, `Infinity`, and `-Infinity`
> will be encoded as such. This behavior is not JSON specification compliant, but
> is consistent with most JavaScript based encoders and decoders. Otherwise, it
> will be a `ValueError` to encode such floats."*

So `json.dumps({"x": float("nan")})` produces a document containing the bare
token `NaN`, which a strict parser in Go, Java or Rust will reject, and which
`JSON.parse` in a browser will reject too. The Python decoder is equally
permissive by default:

> *"It also understands `NaN`, `Infinity`, and `-Infinity` as their corresponding
> `float` values, which is outside the JSON spec."*

If your service publishes JSON to anything you do not control, set
`allow_nan=False` and let the `ValueError` find the bug at the boundary, where it
is cheap, instead of in a consumer's parser at 3am.

```python
json.dumps(payload, allow_nan=False)     # ValueError instead of invalid JSON
```

## Gotchas

**Symptom:** `sorted()` returns a list that is not sorted, with no error
**Cause:** a NaN in the input; every ordered comparison against NaN is false, so the sort's ordering assumption is violated and it produces an arbitrary permutation
**Fix:** filter or partition NaNs before sorting — `[x for x in xs if not math.isnan(x)]`, or `sorted(xs, key=lambda x: (math.isnan(x), x))` to push them to the end. Never assume a silent sort was a correct one when the floats came from outside the program

**Symptom:** `x == float('nan')` is always False, even when `x` is NaN
**Cause:** NaN is unequal to everything, including other NaNs
**Fix:** `math.isnan(x)` for floats, `x.is_nan()` for `decimal.Decimal`, and guard with `isinstance` if the sequence is mixed. `x != x` also works but reads like a typo

**Symptom:** `min()` / `max()` over data containing NaN returns a nonsensical result
**Cause:** both `<` and `>` are false against NaN, so which element "wins" depends purely on iteration order and which comparisons the implementation happens to make
**Fix:** clean the data first, or use `numpy.nanmax` / `statistics` functions with an explicit missing-value policy. There is no ordering of NaN that is correct; there is only one you chose deliberately

**Symptom:** `if x >= threshold: ... else: ...` sends NaN values down the `else` branch, and `if x < threshold` sends them down `else` too
**Cause:** `x >= t` and `x < t` are *both* False for NaN, so NaN falls into whichever branch is the negation
**Fix:** test for NaN explicitly before the range check. Trichotomy — exactly one of `<`, `==`, `>` holding — is the assumption NaN breaks, and every two-branch numeric condition silently relies on it

**Symptom:** a consumer written in Go, Java or Rust rejects your JSON with a parse error near `NaN`
**Cause:** Python's `json` encoder emits the bare tokens `NaN`, `Infinity` and `-Infinity` by default, which the JSON specification does not permit
**Fix:** `json.dumps(payload, allow_nan=False)` and handle the resulting `ValueError` at your serialisation boundary — usually by mapping NaN to `null` deliberately

**Symptom:** a NaN arrived from an upstream JSON payload that "could not have contained one"
**Cause:** Python's decoder is permissive in the same direction — it "understands `NaN`, `Infinity`, and `-Infinity` as their corresponding float values, which is outside the JSON spec"
**Fix:** pass `parse_constant=` to `json.loads` to raise on those tokens, if your contract says they cannot appear. Otherwise validate for NaN after parsing, at the same boundary where you validate everything else

**Symptom:** `Decimal('NaN')` behaves differently from `float('nan')` in a comparison
**Cause:** `decimal` follows the same IEEE rules but has its own signalling variants and its own context; `math.isnan` is not the right test for it
**Fix:** `Decimal.is_nan()`. If you are doing money arithmetic in `Decimal` (Phase 1's numbers row), decide what a NaN means in your domain — usually it means the input was invalid and should have been rejected at parse time

## Interview questions

**★ What happens if you sort a list that contains NaN?**
Nothing visible, and that is the problem. Every ordered comparison against NaN is
false, so the sort's assumption that exactly one of `a < b`, `a == b`, `a > b`
holds is violated. It terminates, returns a list of the right length, and the
order is an arbitrary function of the input order and the internal comparison
sequence. No exception is raised. The habit to build is: floats that came from
outside the program get a NaN check before they get sorted, bucketed or compared.

**★ How do you test whether a value is NaN?**
`math.isnan(x)` for floats and `x.is_nan()` for `decimal.Decimal`. Never
`x == float('nan')`, which is False for every input including NaN. `x != x` is
the underlying trick and is correct, but it reads like a mistake and a reviewer
will "fix" it. If the sequence is mixed, guard with `isinstance(x, float)` first,
because `math.isnan` raises `TypeError` on a string or `None`.

**Why is `x >= 1` not the negation of `x < 1`?**
Because NaN makes both false. The reference says any ordered comparison against a
not-a-number value is false, so trichotomy does not hold. Every `if`/`else` over
a numeric threshold silently assumes it does, which means NaN quietly takes the
`else` branch of both a condition and its negation — the same input can appear
in two mutually exclusive buckets depending on how each check was written.

**Why does Python allow `json.dumps` to emit `NaN` when it is not valid JSON?**
For compatibility with JavaScript-based encoders and decoders, which historically
accepted it — the docs say so directly and describe the behaviour as "not JSON
specification compliant". The default is permissive on both encode and decode.
Since a strict parser in another language will reject the document, any service
publishing JSON outward should set `allow_nan=False` and decide explicitly what a
missing number serialises to, which is almost always `null`.

**Where do NaNs actually come from in a backend?**
`0.0 / 0.0` and `inf - inf` in arithmetic; `float("nan")` parsed out of a CSV or
a JSON payload; pandas and numpy, which use NaN as their missing-value marker, so
any dataframe column with a gap is full of them; and databases that return NaN
for aggregate functions over empty or invalid sets. The common thread is that the
NaN enters at a boundary and travels a long way before it is compared — which is
why the check belongs at the boundary, not at the comparison.

---

← Prev: [Identity and equality](03-identity-and-equality.md) · Index: [Everything is an object](README.md) · Next → [Container comparison](03c-container-comparison.md)
