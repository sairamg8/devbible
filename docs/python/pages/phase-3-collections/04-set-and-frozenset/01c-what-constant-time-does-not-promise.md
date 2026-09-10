---
title: "The O(1) on the 3.14 cost table is an average that assumes cheap, well-spread hashes — a bad `__hash__` makes every set operation linear, an attacker can manufacture the collisions if the salt is switched off, and a key built fresh for each lookup pays its whole hash every time"
sidebar_label: "1c · What O(1) does not promise"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html)
> (the `dict` preamble, the `set, frozenset` section and its notes); the data model's
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__) note on
> hash randomisation; [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED);
> [What's New in Python 3.10](https://docs.python.org/3.14/whatsnew/3.10.html) (NaN hashing); and
> CPython v3.14.7 [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c)
> and `Objects/unicodeobject.c` for hash-caching behaviour the documentation does not state (marked
> as implementation detail). Documentation-verified — **no sandbox run, no timings, no byte counts**.

**Python 3.14 is the first release whose documentation carries a cost table for the built-in types,
and the set rows are almost all O(1) or linear in the operands. The preamble those rows inherit is
the part people skip: the figures are *average-case*, they assume a hash function that makes
collisions uncommon, they assume the keys are well spread, and they assume that hashing and
comparing an element is itself O(1). Each assumption fails in production in a recognisable way — a
`__hash__` that returns a constant turns a set into a chain of `__eq__` calls, a server with its
string salt switched off can be fed collisions on purpose, and an element type with an expensive
hash pays that cost on every lookup of a fresh object. The table's other surprise — that a set does
not get cheaper to walk when you empty it — is [1d](01d-a-table-that-never-shrinks.md).**

## The documented table

> *"This page documents the time complexity of various operations on built-in types in CPython.
> Other Python implementations may have different performance characteristics. Additionally, the
> listed costs assume exact built-in types, as instances of subclasses may have different costs."*

The set section defers to the dict preamble and then adds its own worst case:

> *"The times listed for dict objects are average-case times, as they assume the hash function
> for the objects is sufficiently robust to make collisions uncommon. They also assume the keys are
> well-distributed among the set of possible keys. In the worst case, when every key hashes to the
> same value, each of the O(1) operations below instead takes O(n) time. They also assume that
> hashing and comparing a key is O(1)."*

> *"See `dict` as the `set` and `frozenset` implementations are similar, and the same caveats
> apply. In the worst case, O(1) operations instead take O(n) time, and operations that look up
> every element degrade accordingly."* —
> [Time complexity](https://docs.python.org/3.14/library/time-complexity.html)

| Operation | Complexity | Notes |
|---|---|---|
| `x in s` | O(1) | |
| Copy (`s.copy()`) | O(n) | [6] [7] |
| Add (`s.add(x)`) | O(1) | [1] |
| Discard (`s.discard(x)`, `s.remove(x)`) | O(1) | |
| Union (`s1 \| s2`, `s1.union(s2)`) | O(len(s1) + len(s2)) | [7] |
| Update (`s1 \|= s2`, `s1.update(s2)`) | O(len(s2)) | [1] [7] |
| Intersection (`s1 & s2`, `s1.intersection(s2)`) | O(min(len(s1), len(s2))) | [7] [8] |
| Intersection update (`s1 &= s2`) | O(min(len(s1), len(s2))) | [1] [7] [8] |
| Difference (`s1 - s2`, `s1.difference(s2)`) | O(len(s1)) | [7] [9] |
| Difference update (`s1 -= s2`) | O(min(len(s1), len(s2))) | [1] [7] [8] |
| Symmetric difference (`s1 ^ s2`) | O(len(s1) + len(s2)) | [7] |
| Symmetric difference update (`s1 ^= s2`) | O(len(s2)) | [1] [7] |
| Get length (`len(s)`) | O(1) | [5] |

Notes [1] and [5] are the ones this page needs: [1] *"Amortized. An individual operation may
occasionally be O(n) when the underlying storage is resized, but this cost is spread over many
operations, depending on the history of the container."* [5] *"The number of elements is stored in
the object, so `len()` does not need to count them."* Notes [6] to [9] — copying, the table that
never shrinks, and non-set arguments — are [1d](01d-a-table-that-never-shrinks.md). For contrast,
the same page gives `x in l` for a list and `x in t` for a tuple as **O(n)**.

## Assumption 1: collisions are uncommon

When every element hashes to the same value, every element's probe sequence starts at the same
slot and the stored-hash check in [1](01-the-hash-table-underneath.md) never rejects anything. Each
lookup falls through to identity-then-`==` against every element on the chain. One lookup becomes
O(n); building a set of *n* such elements performs O(n²) comparisons in total. Nothing raises —
the answers stay correct, which is exactly why this ships.

```python
class Sku:
    def __init__(self, vendor, code):
        self.vendor = vendor
        self.code = code

    def __eq__(self, other):
        if not isinstance(other, Sku):
            return NotImplemented
        return (self.vendor, self.code) == (other.vendor, other.code)

    def __hash__(self):
        return 1                    # 🔴 legal, correct, and O(n) per operation
```

The fix is the recipe the data model gives — hash a tuple of the fields `__eq__` compares:

```python
    def __hash__(self):
        return hash((self.vendor, self.code))
```

A weaker version of the same bug is a *low-entropy* hash: `return hash(self.vendor)` when a
catalogue has five vendors produces five long chains instead of one. It is still legal (equal
objects hash equal); it is just slow in proportion to the chain length.

Python has shipped this bug itself, and the fix is in the release notes:

> *"Hashes of NaN values of both `float` type and `decimal.Decimal` type now depend on object
> identity. Formerly, they always hashed to `0` even though NaN values are not equal to one another.
> This caused potentially quadratic runtime behavior due to excessive hash collisions when creating
> dictionaries and sets containing multiple NaNs."* —
> [What's New in Python 3.10](https://docs.python.org/3.14/whatsnew/3.10.html)

## Assumption 2: keys are well-distributed — unless someone chooses them

Collisions can also be *manufactured*. If an attacker controls the strings a server puts into a set
— header names, JSON keys, form fields — and can predict their hashes, they can send thousands that
collide. That is why string hashes are salted per process:

> *"By default, the `__hash__()` values of str and bytes objects are "salted" with an
> unpredictable random value. Although they remain constant within an individual Python process,
> they are not predictable between repeated invocations of Python."*

> *"This is intended to provide protection against a denial-of-service caused by carefully chosen
> inputs that exploit the worst case performance of a dict insertion, O(n²) complexity."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

The defence is on by default and can be switched off: *"Specifying the value 0 will disable hash
randomization."* ([`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED)).
The same salt is also why a set of strings iterates in a different order in every process
([6](06-iteration-order.md)); what a fixed seed is and is not for is covered in
[tuple · 3b](../02-tuple/03b-what-a-hash-value-is-not.md).

## Assumption 3: hashing and comparing are O(1)

"One hash per lookup" is only constant if the hash is. What each common element type costs, in
CPython 3.14.7:

- **`str`** — hashed over its full length the first time, then cached on the object
  (`unicode_hash` returns the stored value when it is not `-1`). The cache is per *object*: a key
  decoded from a request body is a new string, hashed in full on its first lookup.
- **`tuple`** — combined from every element's hash; see [tuple · 10b](../02-tuple/10b-what-operations-cost.md)
  for its per-object cache and why a tuple rebuilt per iteration pays again.
- **`frozenset`** — computed once from the stored element hashes and cached in the object
  (`frozenset_hash`), so a frozenset used as an element or key is hashed once.
- **Your class** — `__hash__` runs on every `add`, `in`, `remove` and `discard` with a fresh probe
  object. Nothing caches it for you.

An expensive `__hash__` is therefore a per-lookup tax. When the object is immutable, compute the
hash once:

```python
import json

class Fingerprint:
    __slots__ = ("payload_json", "_hash")

    def __init__(self, payload):
        self.payload_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        self._hash = hash(self.payload_json)      # paid once, at construction

    def __eq__(self, other):
        if not isinstance(other, Fingerprint):
            return NotImplemented
        return self.payload_json == other.payload_json

    def __hash__(self):
        return self._hash
```

Comparison has the same caveat on the collision path: `__eq__` runs only on a stored-hash match,
but when it runs it is your code, at your cost.

## Gotchas

**★ Symptom: a de-duplication step over custom objects gets steadily slower as the catalogue grows,
though nothing in the code changed.** Cause: `__hash__` returns a constant, or hashes one field with
few distinct values, so elements pile into a few probe chains and each operation compares against
the whole chain — the documentation's *"every key hashes to the same value"* case. Fix: hash a tuple
of every field `__eq__` compares.

```python
def __hash__(self):
    return hash((self.vendor, self.code, self.region))
```

**★ Symptom: the profiler shows `__hash__` as the top frame of a membership-heavy loop.** Cause:
each `in` with a fresh probe object calls `__hash__`, and this one serialises or walks a structure.
Fix: compute the hash once for immutable objects and return the stored value (the `Fingerprint`
class above), or look up by a cheap natural key instead of the whole object.

```python
seen_ids = {event.event_id for event in processed}
fresh = [event for event in incoming if event.event_id not in seen_ids]
```

**Symptom: after a container image change, a public endpoint that parses user-supplied keys into a
set falls over under a modest request rate.** Cause: someone set `PYTHONHASHSEED=0` in the image to
make test output deterministic, which *"will disable hash randomization"* and re-opens the O(n²)
collision attack the salt exists to stop. Fix: remove it from runtime images, and fix the tests
instead ([6](06-iteration-order.md)).

```dockerfile
# delete this line from the runtime image
ENV PYTHONHASHSEED=0
```

**Symptom: a set of tuples keyed on `(tenant, day)` inside a hot loop costs far more than the "O(1)"
suggested.** Cause: the loop builds a new tuple per iteration, so every lookup pays a fresh tuple
hash — assumption 3 fails for a freshly built composite key. Fix: build the key once when it does
not change within the loop.

```python
key = (tenant_id, report_day)
for metric in metrics:
    if key in already_reported:
        continue
    report(metric)
```

## Interview questions

**★ Is set membership always O(1)?**
On average, for well-behaved hashes, yes — that is what the 3.14 cost table says, and it calls the
figures *"average-case times"*. The worst case, when every element hashes to the same value, is
O(n) per operation, and the table also assumes that *"hashing and comparing a key is O(1)"*, which is
false for long strings on first use, for tuples of many parts and for any class with an expensive
`__hash__`. So the precise answer is: O(1) average lookups, after paying for one hash of the probe,
provided the element type's hash spreads values well.

**★ What happens if every element of a set returns the same hash?**
Everything still works and every answer is correct, but every element lands on one probe chain.
Each lookup compares against the chain with identity and `__eq__`, so it is O(n), and inserting *n*
elements does O(n²) comparisons. It is legal because the only hard rule is that equal objects hash
equally — a constant satisfies it. That is why the data model recommends hashing a tuple of the
comparison fields rather than inventing a hash.

**Why did Python 3.10 change the hash of NaN?**
Because NaN broke the "collisions are uncommon" assumption. Every NaN hashed to `0`, and NaNs never
compare equal, so a set or dict holding many NaNs put them all on one chain and building it was
quadratic. Since 3.10 NaN hashes by identity, which spreads distinct NaN objects across the table.
The side effect is that a set does not de-duplicate NaNs at all — each distinct NaN object is its
own element (**9** *(not written yet)*).

**Why are `str` hashes randomised, and what does that protect?**
So that nobody outside the process can predict which strings collide. Without it, an attacker who
controls the keys a server stores — JSON field names, headers, form fields — can send a batch that
all collide and turn each insertion into a scan, the *"denial-of-service caused by carefully chosen
inputs"* the data model cites. The cost is that string hashes, and therefore set iteration order,
differ between processes; `PYTHONHASHSEED=0` removes the protection and should never be how a test
suite gets deterministic output.

**Is a set of long strings still O(1) per lookup?**
The table part is; the hash is not. Hashing a string reads every character, so the first lookup
with a given string object costs time proportional to its length. CPython caches the result on the
object, so a string you hold and reuse is hashed once — but strings freshly decoded from each
request are new objects and pay again. The practical rule: the O(1) is in the number of *elements*
examined, not in the size of the element you are looking up.

---

← Prev: [What the table costs you](01b-what-the-table-costs-you.md) · [Topic index](README.md) · Next → [A table that never shrinks](01d-a-table-that-never-shrinks.md)
