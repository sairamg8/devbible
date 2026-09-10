---
title: "A set does not get cheaper when you empty it — removal marks slots deleted and never resizes, so iteration and copying still pay for the set's peak size, and the costs the 3.14 table does quote for intersection and difference assume the other operand is a set too"
sidebar_label: "1d · A table that never shrinks"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html)
> (the `set, frozenset` section, notes 6–9); [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset);
> and CPython v3.14.7 [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c)
> (`set_discard_entry`, `set_add_entry`, `set_table_resize`, `set_clear_internal`, `set_merge`,
> `set_issubset`, `set_isdisjoint`, `set_richcompare`) for behaviour the documentation does not
> state — marked as implementation detail. Documentation-verified — **no sandbox run, no timings,
> no byte counts**.

**The 3.14 cost table prices set operations in terms of the number of elements, and then its
footnote 7 quietly redefines "elements" for everything that walks the table: it means the number of
slots the set had at its largest, not the number it holds now. Removal in CPython marks a slot
deleted and moves on; nothing shrinks the table until an insertion triggers a resize. A set used as
a work queue that peaked at a million entries iterates like a million-entry set long after it has
been drained. Two further footnotes say that the attractive intersection and difference figures
assume both operands are sets, and several everyday operations — iteration, `pop`, subset tests,
`==` — have no row at all.**

## Footnote 7, verbatim

The note is attached to copy, union, update, intersection, difference, symmetric difference and
their in-place forms:

> *"These operations scan the container's internal hash table, which is not shrunk when elements
> are removed. After removing most elements, they still take time proportional to the container's
> former size, until a later insertion triggers a resize."* —
> [Time complexity](https://docs.python.org/3.14/library/time-complexity.html), note 7

## What removal actually does

In CPython 3.14.7 (implementation detail), `discard`, `remove` and `pop` all end in the same few
lines: the slot's key is replaced with a shared *dummy* marker, its stored hash is set to `-1`, and
the live count is decremented. The table keeps its size. The header describes the three states a
slot can be in — CPython v3.14.7 `Include/cpython/setobject.h`:

```c
/* There are three kinds of entries in the table:

1. Unused:  key == NULL and hash == 0
2. Dummy:   key == dummy and hash == -1
3. Active:  key != NULL and key != dummy and hash != -1
```

Dummies must stay, because a lookup that stopped at a deleted slot would miss every element that
was placed *past* it on the same probe chain. They are skipped by lookups, skipped by iteration —
but iteration still has to *visit* them, and so does every operation that walks the table.

Three things reclaim the space:

- **An insertion that trips the resize check.** `set_add_entry` resizes when used-plus-deleted slots
  reach about 60% of the table (`fill*5 < mask*3` is the condition for *not* resizing), and a resize
  copies only active entries — *"dummy entries aren't copied over, of course"*. The new table is
  sized from the live count, so it can be smaller than the old one.
- **`difference_update` / `-=`** checks afterwards: *"If more than 1/4th are dummies, then resize
  them away."*
- **`clear()`** resets the set to its built-in 8-slot table in place (`set_empty_to_minsize`).

## Churn is not a leak

A set that stays the same size while elements come and go — a window of recently seen IDs, a set of
in-flight request IDs — does not grow without bound. When `set_add_entry` probes for a new element
it remembers the first deleted slot it passes and reuses it if the element turns out to be absent;
and every insertion into a never-used slot counts towards the 60% trigger, so the dummies are purged
at the next resize. The table size tracks the live count within a constant factor. What churn does
cost is longer probe chains between resizes, which is part of why the figures are averages.

## Giving the space back

```python
def compacted(pending: set) -> set:
    """A new set sized for the live elements. One O(old table) scan to build it."""
    return set(pending)


def compact_in_place(pending: set) -> None:
    """Same result, same object — for a set other code also holds a reference to."""
    live = set(pending)        # scans the old table once
    pending.clear()            # back to the small built-in table
    pending |= live            # one pre-sized merge from a set
```

The first rebinds a name; anything else holding the old object keeps the old table. The second
keeps the object's identity: `clear()` drops the large table, and a merge from a set resizes once to
fit (`set_merge` does *"one big resize at the start, rather than incrementally resizing as we insert
new keys"*). Both cost one walk of the old table — note 7 applies to the copy that builds `live` —
so compact after a bulk drain, not after every removal.

## The costs that assume a set argument

> *"[8] O(len(t)) if t is not a set."* — attached to intersection, intersection update and
> difference update.
>
> *"[9] O(len(s) + len(t)) if t is not a set."* — attached to difference.

The method forms accept any iterable ([3b](03b-operators-versus-methods.md)), and when they get one
they must iterate it and hash every element — there is no stored hash to reuse and no way to know
the smaller side in advance. So `s.intersection(t)` with a three-element `s` and a million-element
list `t` costs a million hashes; with a million-element *set* `t` it costs three lookups. Converting
`t` with `set(t)` costs the same million hashes, so it only pays when the converted set is reused.

## What the table does not list

Iteration, `pop()`, `issubset`/`<=`, `issuperset`/`>=`, `isdisjoint` and `==` have no row. From the
3.14.7 source, not the documentation:

- **Iteration** walks the whole table from slot 0, so note 7 applies to it as well.
- **`s <= t`** with two sets first returns `False` if `len(s) > len(t)`, then does one lookup in `t`
  per element of `s`. With a non-set `t`, `s.issubset(t)` builds the intersection first — every
  element of `t` is hashed.
- **`==`** returns `False` on differing sizes; for two frozensets whose hashes are already cached it
  also returns `False` on differing hashes; otherwise it falls back to the subset walk.
- **`isdisjoint`** iterates the smaller of two sets, or iterates a non-set argument, and stops at the
  first common element. **`issuperset`** with a non-set argument likewise stops at the first element
  that is missing. Those two are the predicates that can answer before consuming all of a generator;
  `issubset` with a non-set argument cannot, because it builds the intersection first.
- **`pop()`** scans forward from a remembered position (`so->finger`, *"Search finger for pop()"*),
  skipping empty and deleted slots.

Treat those as the current implementation, not a contract; the documented guarantee stops at the
table.

## Gotchas

**★ Symptom: a worker that drained a huge in-memory set keeps high memory, and every `for job in
pending` is as slow as it was at peak.** Cause: note 7 — removal never shrinks the table, and
iteration scans every slot, deleted or not. Fix: rebuild once after a bulk drain, or `clear()` when
it is empty.

```python
if len(pending) < peak_size // 16:
    pending = set(pending)
    peak_size = len(pending)
```

**★ Symptom: after "compacting" a shared registry with `registry = set(registry)`, another module
still sees the old, large set — and keeps adding to it.** Cause: rebinding changes what one name
refers to; every other reference still points at the original object. Fix: compact in place so the
object's identity survives.

```python
live = set(registry)
registry.clear()
registry |= live
```

**Symptom: `small_set.intersection(rows_from_db)` is slow even though `small_set` has five
elements.** Cause: note 8 — with a non-set argument the method iterates and hashes the whole
argument. Fix: iterate the small side and probe a set you already hold, or keep the large side as a
set if you intersect with it repeatedly.

```python
row_ids = {row.id for row in rows_from_db}        # built once, reused
wanted_present = {i for i in small_set if i in row_ids}
```

**Symptom: checking whether any of a generator's items is banned consumes the whole generator.**
Cause: `bool(banned & set(stream))` or `banned.intersection(stream)` must iterate everything before
answering. Fix: `isdisjoint` stops at the first common element, so it consumes only as much of the
stream as it needs.

```python
def contains_banned_word(words, banned):
    return not banned.isdisjoint(words)     # stops at the first hit
```

## Interview questions

**★ Why doesn't removing most elements from a set make iterating it faster?**
Because CPython removes an element by marking its slot deleted, and iteration visits every slot to
find the live ones. The 3.14 cost table says such operations *"still take time proportional to the
container's former size, until a later insertion triggers a resize"*. The deleted markers cannot
simply be dropped, because a lookup that stopped at a deleted slot would miss elements placed
further along the same probe chain. `set(s)` builds a compact copy; `s.clear()` resets in place;
clear-then-merge compacts in place without losing the object's identity.

**What does `s.intersection(lst)` cost compared with `s & other_set`?**
With two sets, intersection is O(min(len(s1), len(s2))) — CPython iterates the smaller one and
probes the larger. With a list argument, note 8 applies: O(len(lst)), because the list has to be
iterated and every element hashed. The operator form refuses the list outright; the method accepts
it and pays for it. If you intersect against the same large collection repeatedly, keep it as a set.

**A set stays around a thousand elements but sees millions of adds and removes a day. Does its table
grow forever?**
No. An insertion reuses the first deleted slot on its probe path when the element is absent, and
every insertion into a never-used slot counts towards the resize threshold, at which point the
table is rebuilt from the live elements only. The table size tracks the live count within a constant
factor. The cost of churn is somewhat longer probe chains between resizes — one reason the table's
figures are averages rather than bounds.

**Which set operations have no row in the 3.14 cost table, and how would you reason about them?**
Iteration, `pop`, the subset and superset tests, `isdisjoint` and `==`. Iteration is a walk of the
table, so it is proportional to the table's size, including deleted slots. A subset test is one
lookup per element of the smaller-or-equal side after a size check; equality is a size check and
then the same walk. `isdisjoint` is the one that stops early. None of that is documented, so it is
the right answer for "how does CPython 3.14 do it", not for "what does Python promise".

---

← Prev: [What O(1) does not promise](01c-what-constant-time-does-not-promise.md) · [Topic index](README.md) · Next → [The membership test in a loop](02-the-membership-test-in-a-loop.md)
