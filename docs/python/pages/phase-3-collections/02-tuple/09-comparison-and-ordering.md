---
title: "Tuples compare like words in a dictionary — the first unequal pair decides and the shorter tuple wins a tie — and because nothing past that first difference is ever looked at, a tuple holding a `None` sorts fine until the day two rows tie"
sidebar_label: "9 · Comparison and ordering"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons);
> the [Sorting Techniques](https://docs.python.org/3.14/howto/sorting.html) HOWTO;
> the [`json` conversion tables](https://docs.python.org/3.14/library/json.html#py-to-json-table);
> and CPython 3.14 [`Objects/tupleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c)
> (`tuple_richcompare`) and [`Objects/object.c`](https://github.com/python/cpython/blob/3.14/Objects/object.c)
> for the comparison algorithm and the error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**Tuple ordering is the reason tuples make good sort keys, heap entries and composite
versions: `(tenant, day)` sorts by tenant and then by day with no code at all. The rule is
lexicographic — find the first position where the two tuples differ and let that pair decide;
if one runs out first, it is smaller. What the rule leaves implicit, and CPython's
implementation makes concrete, is that the positions *before* the difference are only ever
tested for equality and the positions *after* it are never looked at. That is why an
unorderable value such as `None` can sit in a tuple key for months and only raise `TypeError`
on the day two rows agree on every field in front of it. The other half of the page is the
type rule: a tuple is never equal to a list, which quietly breaks every comparison after a
JSON round trip.**

## The rules, from the reference

> *"Sequences compare lexicographically using comparison of corresponding elements.  The
> built-in containers typically assume identical objects are equal to themselves.  That lets
> them bypass equality tests for identical objects to improve performance and to maintain
> their internal invariants."*

> *"Collections that support order comparison are ordered the same as their first unequal
> elements (for example, `[1,2,x] <= [1,2,y]` has the same value as `x <= y`).  If a
> corresponding element does not exist, the shorter collection is ordered first (for example,
> `[1,2] < [1,2,3]` is true)."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

```python
("acme", "2026-09-09") < ("acme", "2026-09-10")   # True — decided by the second item
("acme",) < ("acme", "2026-09-10")                # True — shorter is first
(3, 14) < (3, 14, 0)                              # True — same reason
(2, "z") < (10, "a")                              # True — 2 < 10 decides; "z" never compared
```

## How the comparison actually runs

CPython 3.14's `tuple_richcompare` does its work in two steps, and both matter (excerpt; one
source comment shortened):

```c
/* Search for the first index where items are different. */
for (i = 0; i < vlen && i < wlen; i++) {
    int k = PyObject_RichCompareBool(vt->ob_item[i], wt->ob_item[i], Py_EQ);
    if (k < 0)
        return NULL;
    if (!k)
        break;
}

if (i >= vlen || i >= wlen) {
    /* No more items to compare -- compare sizes */
    Py_RETURN_RICHCOMPARE(vlen, wlen, op);
}

/* We have an item that differs -- shortcuts for EQ/NE */
if (op == Py_EQ) {
    Py_RETURN_FALSE;
}
if (op == Py_NE) {
    Py_RETURN_TRUE;
}

/* Compare the final item again using the proper operator */
return PyObject_RichCompare(vt->ob_item[i], wt->ob_item[i], op);
```

Read as rules:

1. **The prefix is compared with `==` only.** Two `None`s, two dicts, two objects with no
   ordering at all — as long as they are equal (or identical) they pass the first loop
   without `<` ever being asked of them.
2. **Exactly one pair is compared with `<`**, the first unequal one.
3. **Everything after that pair is ignored.** A `TypeError` waiting in position 3 never
   fires if position 1 already differed.
4. **`PyObject_RichCompareBool` checks identity first** — that is the *"assume identical
   objects are equal to themselves"* sentence in the reference, and it is why a tuple
   holding the same NaN object equals itself even though `nan == nan` is false.

So `TypeError` from a tuple comparison is **data-dependent**:

```python
(1, None) < (2, None)     # fine: position 0 differs, the Nones are never ordered
(1, None) < (1, None)     # fine: all equal, then lengths compared
(1, None) < (1, 5)        # TypeError: None vs 5 is the first unequal pair
```

The message is CPython's `"'%s' not supported between instances of '%.100s' and '%.100s'"`
from `Objects/object.c` — `'<' not supported between instances of 'NoneType' and 'int'`.

## Tuples are only equal to tuples

> *"Sequences (instances of `tuple`, `list`, or `range`) can be compared only within each of
> their types, with the restriction that ranges do not support order comparison.  Equality
> comparison across these types results in inequality, and ordering comparison across these
> types raises `TypeError`."*

> *"For two collections to compare equal, they must be of the same type, have the same length,
> and each pair of corresponding elements must compare equal (for example, `[1,2] == (1,2)` is
> false because the type is not the same)."*

The place this bites is serialisation. The `json` module encodes `list, tuple` as an array
and decodes every array as a `list`
([conversion tables](https://docs.python.org/3.14/library/json.html#py-to-json-table)), so
anything that went through JSON — an HTTP body, a cached payload, a fixture file — comes back
unequal to the tuple that went in:

```python
import json

key = ("acme", "2026-09-10")
restored = json.loads(json.dumps(key))     # ['acme', '2026-09-10']
restored == key                            # False — list vs tuple
tuple(restored) == key                     # True
```

⚠️ The "same type" wording has one exception worth knowing: tuple *subclasses*. The C check
is `PyTuple_Check`, which accepts subclasses, so a named tuple equals a plain tuple with the
same items — the leak [8d](08d-when-a-dataclass-beats-a-tuple.md) is about.

## Equality follows the contents, so it can change

A tuple compares element values, and a mutable element's value can change after the fact:

```python
a = ("acme", ["eu"])
b = ("acme", ["eu"])
a == b                   # True today
a[1].append("us")
a == b                   # False now — the tuples never changed, their contents did
```

That is the distinction [1](01-what-immutability-freezes.md) draws between the collection of
references (fixed) and the value (not fixed), and it is why such a tuple is refused as a dict
key: equality that can change cannot back a hash that must not.

## Gotchas

**★ Symptom: a nightly report sorted fine for months, then crashed with `TypeError: '<' not
supported between instances of 'NoneType' and 'int'`.** Cause: the sort key is a tuple with an
optional field, and the first two rows ever to tie on the fields before it reached the `None`
— only the first unequal pair is ordered. Fix: make the optional field orderable in the key;
`(value is None, value)` puts missing values last and, for two missing values, compares
`None == None` in the prefix scan rather than ordering them.

```python
rows.sort(key=lambda r: (r.tenant, r.discount is None, r.discount))
```

**★ Symptom: `assert load_cached_key() == ("acme", "2026-09-10")` fails with identical-looking
values.** Cause: the cached value round-tripped through JSON and is a list; a list never equals a
tuple. Fix: convert at the deserialisation boundary.

```python
cached = tuple(json.loads(raw))
```

**★ Symptom: `"3.9" > "3.14"` is `True`, so the version check allowed an unsupported runtime.**
Cause: strings compare character by character, and `"9" > "1"`. Fix: compare tuples of integers,
which compare element by element.

```python
def parse_version(v: str) -> tuple[int, ...]:
    return tuple(int(part) for part in v.split("."))

parse_version("3.9") < parse_version("3.14")      # True
```

**Symptom: `"3.14"` and `"3.14.0"` are treated as different versions and sort apart.** Cause:
`(3, 14) < (3, 14, 0)` — the shorter tuple is ordered first even though the extra component is
zero. Fix: normalise the length before comparing.

```python
def version_key(v: str, width: int = 3) -> tuple[int, ...]:
    parts = [int(p) for p in v.split(".")]
    return tuple(parts + [0] * (width - len(parts)))
```

**Symptom: `sorted(pairs)` raises `TypeError` about `dict` only for some inputs.** Cause: the
tuples are `(priority, payload_dict)`; dicts are equal-comparable but not orderable, so the sort
works until two priorities tie. Fix: sort by the orderable part only.

```python
from operator import itemgetter

pairs.sort(key=itemgetter(0))            # stable: ties keep their input order
```

**Symptom: rows containing NaN come out of `sorted()` in an order that makes no sense.** Cause:
NaN is unordered with everything, and the sorting HOWTO says to *"remove special values prior to
sorting"* for exactly this reason. Fix: filter or map NaN before sorting.

```python
from math import isnan

clean = sorted(r for r in readings if not isnan(r[1]))
```

## Interview questions

**★ How does Python compare two tuples?**
Lexicographically. It walks both tuples in step, comparing corresponding items for equality
until it finds the first pair that differs; that pair's comparison is the result. If one tuple
runs out first, the shorter one is smaller; if both run out together, they are equal. Equality
between a tuple and any other built-in sequence type is always false, and ordering across those
types raises `TypeError`.

**★ Why does `(1, None) < (2, None)` work while `(1, None) < (1, 5)` raises?**
Because only the first unequal pair is compared with `<`. In the first case position 0 differs,
`1 < 2` decides, and the `None`s are never ordered. In the second, position 0 is equal, so the
scan moves on and the first unequal pair is `None` and `5`, which have no ordering — CPython
raises `TypeError` with *"'&lt;' not supported between instances of 'NoneType' and 'int'"*. The
error depends on the data, which is why it tends to appear long after the code shipped.

**Why is `[1, 2] == (1, 2)` false?**
Because the reference requires collections to be the same type to compare equal — its own
example is exactly this expression. The design treats a list and a tuple as different kinds of
thing (an array and a record), and making them equal would also force them to hash alike,
which a list cannot. The practical consequence is that anything decoded from JSON, which only
produces lists, must be converted before being compared with a tuple.

**What does "the built-in containers typically assume identical objects are equal to
themselves" mean for tuples?**
Element comparisons check identity before calling `==`. For almost every object that changes
nothing. For NaN it changes the answer: `x = float("nan")` gives `x == x` false but `(x,) ==
(x,)` true, because the tuple comparison sees the same object in both slots and skips the
equality test. The same shortcut is what lets a NaN-keyed entry be found in a dict, and its
absence is what changed dataclass equality in 3.13 ([8e](08e-frozen-dataclasses.md)).

**Is `(1, 2) < (1, 2, 3)`?**
Yes. All corresponding items are equal, so the lengths decide and the shorter tuple is ordered
first — the reference's own example uses lists, `[1,2] < [1,2,3]`, and the rule is the same. It
is also why `("acme",)` sorts before every `("acme", day)` tuple, which makes a one-element
tuple a useful lower bound when bisecting a sorted list of composite keys.

**Why are tuples a better representation for version numbers than strings?**
Because they compare numerically, element by element: `(3, 9) < (3, 14)`, while `"3.9" <
"3.14"` is false since strings compare character by character. Two cautions carry over from the
tuple rules: pad to a fixed length if `3.14` and `3.14.0` should be equal, and do not mix types
in a position (`(3, 14, "rc1")` against `(3, 14, 0)` raises when it gets there).

---

← [Frozen dataclasses](08e-frozen-dataclasses.md) · [Topic index](README.md) · Next → [Sort keys and priority queues](09b-sort-keys-and-priority-queues.md)
