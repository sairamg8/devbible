---
title: "A set iterates in the order of its hash table's slots, which depends on the hashes, the table's size and its history — so a set of strings comes out differently in every process, a set of small ints looks sorted by accident, two equal sets can iterate differently, and every place order leaks out needs a `sorted()`"
sidebar_label: "6 · Iteration order"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [`dict`](https://docs.python.org/3.14/library/stdtypes.html#dict),
> [numeric hashing](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> [`random.sample`](https://docs.python.org/3.14/library/random.html#random.sample),
> [`json`](https://docs.python.org/3.14/library/json.html) — the data model
> ([`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)), the
> [tutorial](https://docs.python.org/3.14/tutorial/datastructures.html#sets) and
> [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED); CPython
> v3.14.7 `Objects/setobject.c`, `Include/cpython/setobject.h` and `Lib/random.py` for the mechanism,
> marked *implementation detail*. Documentation-verified — **no sandbox run, no program output**.

**Sets are unordered in the documentation and ordered in practice: CPython walks the slots of the
hash table from first to last, so every iteration has *an* order — the one the hashes, the table
size and the insertion history produced. That order is stable enough to look like a property and
unstable enough to break everything that relies on it. For strings it changes with every process,
because string hashes are salted. The fix is never to make the order stable; it is to find every
place order leaves the set and put a `sorted()` there.**

## What is promised: nothing

> *"Being an unordered collection, sets do not record element position or order of insertion."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

> *"Because sets are unordered, iterating over them or printing them can produce the elements in a
> different order than you expect."* — [tutorial](https://docs.python.org/3.14/tutorial/datastructures.html#sets)

> *"Changing hash values affects the iteration order of sets. Python has never made guarantees about
> this ordering (and it typically varies between 32-bit and 64-bit builds)."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

Compare the dict, which does promise: *"Dictionaries preserve insertion order."* The two types share
most of their implementation ideas and none of this guarantee.

## Where the order comes from

Iteration walks the slot array from index 0 upward and yields every occupied slot
([1](01-the-hash-table-underneath.md) has the model). An element's slot starts at `hash & mask` and
moves on only when that slot is taken. So the order is a function of four things, none of which is
the order you added the elements in:

1. **The hash values.** Change a hash and the element moves.
2. **The table size.** The same hash lands in a different slot in a 32-slot table than in an 8-slot
   one; in 3.14.7 the table starts at 8 slots (`PySet_MINSIZE`) and grows as elements are added
   (implementation detail).
3. **The history.** When two elements want the same slot, whichever arrived first keeps it; removed
   elements leave markers ([1d](01d-a-table-that-never-shrinks.md)); a resize re-places everything.
4. **The build.** The data-model note above: 32-bit and 64-bit builds differ.

### Why strings reorder between runs

> *"By default, the `__hash__()` values of str and bytes objects are "salted" with an unpredictable
> random value. Although they remain constant within an individual Python process, they are not
> predictable between repeated invocations of Python."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

Within one process the salt is fixed, so a set of strings iterates the same way each time you walk
it unchanged (implementation detail — the docs do not promise even that). In the next process every
string hash is different, so every slot is different, so `list(names)` is a different permutation.
The same is true of anything hashed from strings: tuples of strings, frozensets of strings, and
instances whose `__hash__` hashes a string field.

### Why small integers look sorted

Integers are not salted, and a non-negative integer smaller than the hashing modulus hashes to
itself — the rule for rationals, *"define `hash(x)` as `m * invmod(n, P) % P`"*, reduces to `hash(n)
== n` ([numeric hashing](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)).
With `hash(n) == n` and slot `n & mask`, a set of small integers that all fit below the table size
sits in numeric order, and iteration yields them sorted. That is a coincidence of the mechanism, and
it ends as soon as a value reaches the table size: in an 8-slot table, `8 & 7 == 0`, so `8` sits in
slot 0, ahead of `1` in slot 1. Negative numbers break it too — `hash(-1)` is `-2`, per the rule
*"If the resulting hash is `-1`, replace it with `-2`"*.

This is how order bugs get past tests: the fixtures use small integer IDs, the order looks sorted and
stable, the assertion hard-codes it — and production, with string IDs or bigger numbers, disagrees.

### Why two equal sets can iterate differently

Equality compares membership; iteration walks a particular table. Two sets with the same members
but different histories — one built directly, one that grew large and was emptied, one where
colliding elements arrived in the opposite order — have different tables:

```python
def same_members_different_tables() -> tuple[set[str], set[str]]:
    direct = {"alpha", "beta", "gamma"}
    grown = {f"tmp-{i}" for i in range(1000)} | {"alpha", "beta", "gamma"}
    for i in range(1000):
        grown.discard(f"tmp-{i}")      # discard never shrinks the table (1d): same members, far more slots
    return direct, grown               # direct == grown; list(direct) may differ from list(grown)
```

`direct == grown` is `True`. Nothing makes `list(direct) == list(grown)` true, and in general it is
not.

## Setting `PYTHONHASHSEED` is not the fix

> *"If `PYTHONHASHSEED` is set to an integer value, it is used as a fixed seed for generating the
> hash() of the types covered by the hash randomization. Its purpose is to allow repeatable hashing,
> such as for selftests for the interpreter itself, or to allow a cluster of python processes to
> share hash values."* · *"Specifying the value 0 will disable hash randomization."* —
> [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED)

A fixed seed makes string order repeat between runs of the same build. It does not make it
*meaningful* — it is still slot order, and it still changes when the table size, the history, the
build or the Python version changes. It also switches off the denial-of-service protection the salt
exists for ([1c](01c-what-constant-time-does-not-promise.md)), which is why it belongs in a debugging
session, not in a runtime image. The general case against persisting or depending on hash values is
[tuple · 3b](../02-tuple/03b-what-a-hash-value-is-not.md).

## The fix: `sorted()` wherever order leaves the set

Order matters only where the set's contents leave it as a sequence — a response, a file, a log, a
test assertion, a loop whose outcome depends on which element comes first. Put the order there,
explicitly:

```python
import json

def render_tags(tags: set[str]) -> str:
    return json.dumps(sorted(tags))                  # the same text in every process

def first_matching_rule(path: str, prefixes: frozenset[str]) -> str | None:
    for prefix in sorted(prefixes, key=len, reverse=True):   # longest prefix wins, by rule, not by slot
        if path.startswith(prefix):
            return prefix
    return None
```

The JSON module states the same division of labour: *"This module's encoders and decoders preserve
input and output order by default. Order is only lost if the underlying containers are unordered."*
([`json`](https://docs.python.org/3.14/library/json.html)).

When the order you want is **arrival order**, not value order, a dict is the ordered set Python
ships: its keys are unique, hash-checked, and in insertion order. Note what its set operations
return, though — `d.keys() - removed` is a plain `set` ([3d](03d-views-and-abc-sets-as-operands.md)),
so the order is gone again. Filter with a comprehension instead:

```python
def remaining_in_order(queue: dict[str, None], done: set[str]) -> list[str]:
    return [job for job in queue if job not in done]  # dict order kept; the set only answers "done?"
```

`random.sample` no longer converts a set for you — *"Changed in version 3.11: The population must be
a sequence. Automatic conversion of sets to lists is no longer supported."* — and in 3.14.7 its error
says what to do instead: `Population must be a sequence.  For dicts or sets, use sorted(d).`
(`Lib/random.py`). The advice is about reproducibility: `random.seed(42)` makes the *choices*
repeatable, but the choices index into `list(s)`, whose order is not. Sort first, then sample.

## Gotchas

**★ Symptom: an API returns the same tags in a different order from each worker, and HTTP caches,
ETags and snapshot tests churn.** Cause: `list(tags)` is slot order, and string hashes are salted
per process. Fix: `sorted(tags)` at the response boundary — `render_tags` above.

**★ Symptom: a test that asserts `list(result) == [1, 2, 3]` passes for months and fails the day
the fixture uses string IDs or a value of 8 or more.** Cause: small non-negative ints hash to
themselves and land in numeric slot order by coincidence. Fix: assert on the set, or on sorted
output.

```python
assert result == {1, 2, 3}
assert sorted(result) == [1, 2, 3]
```

**★ Symptom: which routing rule, feature flag or plugin "wins" changes between restarts.** Cause:
a `for` loop over a set returns or breaks on the first match, and the first element depends on the
salt. Fix: define the precedence and iterate in it — `first_matching_rule` above.

**★ Symptom: a job seeded with `random.seed(...)` picks different "random" items in each run.**
Cause: `random.choice(list(candidates))` indexes into slot order, which differs per process. Fix:
sort before sampling.

```python
import random

def pick_reviewer(candidates: set[str], seed: int) -> str:
    rng = random.Random(seed)
    return rng.choice(sorted(candidates))
```

**★ Symptom: several worker processes split a set of IDs into partitions and some IDs are processed
twice while others are never processed.** Cause: each process computed `list(ids)[i::n]` from its
own slot order. Fix: partition a sorted list, or partition by a stable function of the ID.

```python
import zlib

def mine(ids: set[str], worker: int, workers: int) -> list[str]:
    return [i for i in sorted(ids) if zlib.crc32(i.encode("utf-8")) % workers == worker]
```

**Symptom: a code generator or lockfile writer produces a different file on every run, and every
commit shows a spurious diff.** Cause: it iterates a set. Fix: sort before writing.

**Symptom: a cache keyed by `str(roles)` or `repr(roles)` misses for identical role sets.** Cause:
the text follows iteration order. Fix: key on `frozenset(roles)` in-process, or on a sorted form
across processes ([5](05-frozenset-hashable-sets.md) has `stable_key`).

**Symptom: a content digest over a set differs between machines.** Cause: the bytes were fed in
iteration order. Fix: feed them sorted.

```python
import hashlib

def digest(ids: set[str]) -> str:
    h = hashlib.sha256()
    for i in sorted(ids):
        h.update(i.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()
```

**Symptom: order became deterministic after adding `PYTHONHASHSEED=0` to the Dockerfile, then
changed again after a Python upgrade — and a load test found the O(n²) collision path.** Cause: a
fixed seed repeats slot order only for one build and table history, and seed `0` *"will disable hash
randomization"*. Fix: remove it from runtime environments; sort at the boundary.

**Symptom: an "ordered set" built on a dict loses its order after a set operation.** Cause:
`d.keys() - removed` returns a plain `set`. Fix: filter with a comprehension —
`remaining_in_order` above.

**Symptom: `zip(names, emails)` over two sets pairs the wrong name with each email.** Cause: two
sets' iteration orders have nothing to do with each other. Fix: keep related values together in
one structure from the start — a dict or a list of tuples — never in parallel sets.

## Interview questions

**★ Why does a set of strings print in a different order each run, while a set of small integers
looks sorted?**
Iteration walks the hash table's slots in index order, and an element's slot comes from its hash.
String hashes are salted with a random value per process, so every run places the strings
differently. Small non-negative integers hash to themselves, so while they are smaller than the
table they occupy slots in numeric order and appear sorted — a coincidence that ends when a value
reaches the table size or goes negative. The docs say plainly that Python *"has never made
guarantees about this ordering"*.

**★ How do you make output built from a set deterministic?**
Sort it where it leaves the set: `sorted(s)` for responses, files, logs, digests and test
assertions, and an explicit precedence for loops whose result depends on which element comes first.
Do not try to stabilise the set itself — `PYTHONHASHSEED` only repeats one build's slot order and
disables hash randomisation. If you want arrival order rather than value order, keep the data in a
dict or list and use a set only for membership.

**★ Two sets compare equal. Do they iterate in the same order?**
Not necessarily. Equality is membership; iteration order is the layout of a particular table, which
depends on its size and on the history of insertions, collisions and deletions. A set that grew large
and was emptied back down to the same members has a bigger table and can iterate in a different
order from a freshly built one.

**Does Python have an ordered set?**
Not in the standard library as a set type. A `dict` with `None` values — `dict.fromkeys(items)` — is
the idiomatic ordered set: unique keys, insertion order, O(1) membership. Its keys view supports set
operators, but those return plain, unordered sets, so order-preserving filtering is done with a
comprehension over the dict.

**Why did `random.sample` stop accepting sets in 3.11?**
The documentation records the change — *"The population must be a sequence. Automatic conversion of
sets to lists is no longer supported."* — and the 3.14.7 error message suggests `sorted(d)`. A
sample is an index into a sequence; converting a set produced a sequence in slot order, so a seeded
generator could still return different elements in different processes. Sorting first makes the
population, and therefore the sample, reproducible.

---

← Prev: [frozenset beside set](05b-frozenset-beside-set.md) · [Topic index](README.md) · Next → **Equal but distinct elements** *(not written yet)*
