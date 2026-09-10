---
title: "A set is a hash table of references with nothing attached — `x in s` hashes `x` once and inspects a few slots instead of scanning, which is why a lookup costs one hash and usually no `__eq__` call at all"
sidebar_label: "1 · The hash table underneath"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset);
> the language reference — [membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)
> and [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons);
> the design FAQ [How are dictionaries implemented in CPython?](https://docs.python.org/3.14/faq/design.html#how-are-dictionaries-implemented-in-cpython);
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html);
> and CPython v3.14.7 [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c)
> for the lookup mechanism, which the documentation does not describe — every source-derived
> statement is marked as an implementation detail. Documentation-verified — **no sandbox run, no
> program output**.

**A `set` exists to answer one question — *is this value in the collection?* — and it answers it
without looking at the other elements. It computes the value's hash, turns the hash into a slot
number, and compares against whatever is stored in that slot; a list asked the same question
compares against every element until it finds a match. The answer is defined identically for
both — the reference spells it `any(x is e or x == e for e in y)` — but the set reaches it by
arithmetic instead of by walking. This page is that mechanism, step by step and then as a model
you can run in your head. The restrictions it imposes — hashable elements, no index, no order, a
stored hash it never re-checks — are [1b](01b-what-the-table-costs-you.md); what "O(1)" does not
promise is [1c](01c-what-constant-time-does-not-promise.md).**

## What the documentation promises

> *"A `set` object is an unordered collection of distinct hashable objects. Common uses include
> membership testing, removing duplicates from a sequence, and computing mathematical operations
> such as intersection, union, difference, and symmetric difference."*

> *"Like other collections, sets support `x in set`, `len(set)`, and `for x in set`. Being an
> unordered collection, sets do not record element position or order of insertion. Accordingly,
> sets do not support indexing, slicing, or other sequence-like behavior."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

The three uses in the first sentence are the three halves of this topic: membership
([2](02-the-membership-test-in-a-loop.md)), dedupe ([4](04-dedupe-and-what-it-destroys.md)) and
algebra ([3](03-set-algebra-instead-of-nested-loops.md)). The second quote is the price list, and
[1b](01b-what-the-table-costs-you.md) explains each item on it.

## What `x in s` actually does

The language reference defines the *answer* of a membership test for every built-in container
the same way:

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the
> expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."* —
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

A list computes exactly that expression: it walks `e` over every element. A set produces the
same answer without the walk. In CPython 3.14.7 (implementation detail, from `set_lookkey` in
`Objects/setobject.c`):

1. **Hash once.** `hash(x)` calls `x.__hash__()`. That is the only call into `x`'s type that is
   guaranteed to happen.
2. **Pick a start slot.** The table is an array whose size is a power of two (at least 8 —
   `PySet_MINSIZE`). The start slot is `hash & (size - 1)`.
3. **Check the slot.** An empty slot means *absent* — the search stops. A slot whose **stored**
   hash differs from `hash(x)` cannot hold `x`, so it is skipped without calling anything. Only
   when the stored hash is equal does CPython try identity (`stored is x`) and then, if that
   fails, `stored == x`.
4. **Probe onward.** On a mismatch it inspects nearby slots, then jumps using more bits of the
   hash, until it finds a match or an empty slot.

The source's own summary of step 4:

> *"To improve cache locality, each probe inspects a series of consecutive nearby entries before
> moving on to probes elsewhere in memory. This leaves us with a hybrid of linear probing and
> randomized probing."*

and of why a set is tuned differently from a dict, although it is derived from the dict code:

> *"Use cases for sets differ considerably from dictionaries where looked-up keys are more likely
> to be present. In contrast, sets are primarily about membership testing where the presence of
> an element is not known in advance. Accordingly, the set implementation needs to optimize for
> both the found and not-found case."* — CPython v3.14.7 `Objects/setobject.c`, header comment

The consequence that matters day to day: **`__eq__` almost never runs.** Unequal elements almost
always have unequal hashes, so the stored-hash comparison rejects them for free. A lookup costs
one hash plus, typically, zero or one equality calls — not *n* of them. Identity is tried before
equality for the same reason the reference gives for every built-in container: *"The built-in
containers typically assume identical objects are equal to themselves. That lets them bypass
equality tests for identical objects to improve performance and to maintain their internal
invariants."* ([Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons))

## A model you can read

CPython's table is C. This is the same idea in Python — runnable, simplified, and labelled as a
model rather than the implementation:

```python
class ToySet:
    """A teaching model of CPython's set table (Objects/setobject.c, v3.14.7).

    Kept from CPython: hash once; start at hash & mask; compare the stored hash
    before trying identity and ==; grow before the table is about 60% full;
    reuse the stored hashes when growing. Dropped: runs of adjacent probes,
    deleted-slot markers, removal, and the C details of resizing.
    """

    def __init__(self, iterable=()):
        self._slots = [None] * 8          # PySet_MINSIZE
        self._used = 0
        for element in iterable:
            self.add(element)

    def _probe(self, element, h):
        mask = len(self._slots) - 1
        i = h & mask
        perturb = h & 0xFFFF_FFFF_FFFF_FFFF   # the C code treats the hash as unsigned
        while True:
            slot = self._slots[i]
            if slot is None:
                return i, False               # an empty slot ends the search
            stored_hash, stored = slot
            if stored_hash == h and (stored is element or stored == element):
                return i, True
            perturb >>= 5
            i = (i * 5 + 1 + perturb) & mask

    def add(self, element):
        h = hash(element)                     # TypeError here if unhashable
        i, found = self._probe(element, h)
        if found:
            return                            # the element already stored is kept
        self._slots[i] = (h, element)
        self._used += 1
        if self._used * 5 >= (len(self._slots) - 1) * 3:
            self._grow()

    def _grow(self):
        live = [slot for slot in self._slots if slot is not None]
        self._slots = [None] * (len(self._slots) * 4)
        for stored_hash, stored in live:      # hashes reused, never recomputed
            i, _ = self._probe(stored, stored_hash)
            self._slots[i] = (stored_hash, stored)

    def __contains__(self, element):
        return self._probe(element, hash(element))[1]

    def __len__(self):
        return self._used

    def __iter__(self):
        for slot in self._slots:
            if slot is not None:
                yield slot[1]
```

Read `_probe` against the four steps and three later chunks stop being surprising: iteration walks
slots, so order is whatever the hashes made it ([6](06-iteration-order.md)); `add` keeps the element
already stored, so the first of several equal values wins ([7](07-equal-but-distinct-elements.md));
and `_grow` never re-hashes, so an element whose hash changed after insertion is never re-filed
([8](08-custom-classes-as-elements.md)).

Two details of the model are load-bearing rather than cosmetic. The growth check keeps the table
under about 60% full — CPython's condition is literally `fill*5 < mask*3` in `set_add_entry` — and
that guarantee is what lets `_probe`'s `while True` end: a failed search always reaches an empty
slot. The source says so where it rebuilds a table, *"set_lookkey needs at least one virgin slot to
terminate failing searches"*. And the start slot comes from the low bits of the hash, which is why
hash quality matters: hashes that agree in their low bits pile into the same neighbourhood until
the perturbation spreads them out ([1c](01c-what-constant-time-does-not-promise.md)).

## Gotchas

**★ Symptom: `x in s` is `True` although `x == stored` is `False` for the element it matched.**
Cause: step 3 tries identity before equality, exactly as the reference's `x is e or x == e`
spells out, so the very same object is always found. The classic case is NaN, which is never equal
to itself — `nan in {nan}` finds it by identity, while a freshly parsed NaN is not found at all.
Fix: do not build membership logic on values that are not equal to themselves; filter them at the
boundary ([numbers · NaN in containers](../../phase-1-language-core/02-numbers/06b-detecting-nan-and-containers.md)).

```python
import math

def finite_readings(values):
    return {v for v in values if math.isfinite(v)}   # NaN and ±inf never enter the set
```

**★ Symptom: an object's `__eq__` has a breakpoint and is never hit during `x in s`, even though an
equal object is in the set.** Cause: the lookup found the *same object* and returned on identity,
or it rejected every slot on the stored hash — `__eq__` runs only for a distinct object whose hash
matches. Fix: test with a distinct-but-equal object if you need to exercise `__eq__`.

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Order:
    order_id: int

pending_orders = {Order(order_id=17)}
probe = Order(order_id=17)                 # a different object, equal and same hash
assert probe in pending_orders             # the stored hash matches, so __eq__ runs
```

**Symptom: `AttributeError` (or any other exception) raised by a line that is only `if item in
seen:`.** Cause: step 1 calls your `__hash__`, and step 3 may call your `__eq__`; either can run
arbitrary code, and anything it raises propagates out of the `in` expression. Only a `TypeError`
from hashing is rewritten into the 3.14 *cannot use … as a set element* message — the source
re-formats the error only when it is exactly a `TypeError`. Fix: make `__hash__` and `__eq__`
depend only on attributes that are set, immutably, in `__init__`.

```python
class ApiClient:
    __slots__ = ("_base_url", "_tenant")

    def __init__(self, base_url, tenant):
        self._base_url = base_url
        self._tenant = tenant

    def __eq__(self, other):
        if not isinstance(other, ApiClient):
            return NotImplemented
        return (self._base_url, self._tenant) == (other._base_url, other._tenant)

    def __hash__(self):
        return hash((self._base_url, self._tenant))   # nothing here can be missing
```

## Interview questions

**★ Walk through what happens when Python evaluates `x in s` for a set.**
Python calls `hash(x)`, which calls `x.__hash__()`. CPython masks the hash down to a slot index in
a power-of-two table and looks at that slot. An empty slot ends the search with `False`. A slot
whose stored hash differs is skipped without calling anything. On a stored-hash match it checks
identity first and then `==`. On a mismatch it probes further slots — a short run of neighbours,
then a jump driven by more bits of the hash — until it finds the element or an empty slot. The
answer matches the reference's `any(x is e or x == e for e in y)`; the work is one hash and,
typically, zero or one equality calls rather than one per element.

**★ When does `__eq__` get called during a set lookup?**
Only when a slot holds an element whose stored hash equals the probe's hash and that element is
not the probe object itself. Different hashes short-circuit before equality; the same object
short-circuits on identity. So an expensive `__eq__` is paid rarely — but it does run on genuine
hash collisions, which is why a `__hash__` that returns a constant degrades every operation to a
chain of `__eq__` calls ([1c](01c-what-constant-time-does-not-promise.md)).

**Why does a failed lookup always terminate?**
Because the table is never allowed to fill up. CPython resizes when the used-plus-deleted count
reaches about 60% of the table (`fill*5 < mask*3` is the condition for *not* resizing), so there is
always an empty slot somewhere on the probe sequence, and the probe recurrence visits every slot
eventually. The source notes the requirement explicitly — *"set_lookkey needs at least one virgin
slot to terminate failing searches"*. The empty slot is what turns "not found" into a definite
answer instead of a scan of the whole table.

**How is a set related to a dict in CPython?**
The set implementation was *"Derived from Objects/dictobject.c"* and the 3.14 cost table says the
two *"implementations are similar, and the same caveats apply"* — both are open-addressed hash
tables with the same hashability rules. The differences are that a set stores no values, keeps no
insertion order (a dict has guaranteed it since 3.7), and is tuned for lookups that miss as often
as they hit, where a dict assumes looked-up keys are usually present.

**Is `x in s` for a set semantically different from `x in l` for a list?**
The documented answer is the same — identity or equality, per the membership rule — but the set
adds a precondition the list does not have: `x` must be hashable, and equal values must hash
equally. A list can test membership for an unhashable probe (`[1] in [[1]]` is fine); a set raises
`TypeError` for it. And an object whose `__eq__` claims equality with something whose hash differs
is found by the list's scan but not by the set's lookup, because the set never compares across
different hashes. Converting a list membership test into a set one is therefore an optimisation
with preconditions, which [2](02-the-membership-test-in-a-loop.md) lists.

---

← Prev: [Overview](README.md) · [Topic index](README.md) · Next → [What the table costs you](01b-what-the-table-costs-you.md)
