---
title: "The order is guaranteed, so the operations that consume it are worth knowing exactly — reversed, popitem's LIFO promise, first-and-last access, and rebuilding a dict in a different order"
sidebar_label: "04 · Working with the order"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted), [`collections` — OrderedDict objects](https://docs.python.org/3.14/library/collections.html#ordereddict-objects). Error strings read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag, not from a run. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.
> Corrected 2026-09-21: an earlier version of this page called `next(iter(d))` *O*(1) without
> qualification. Re-read from the same `v3.14.7` `Objects/dictobject.c`: `dictiter_new`,
> `dictiter_iternextkey_lock_held`, `dictreviter_iter_lock_held`, `delitem_common`,
> `dict_popitem_impl`, `insertion_resize` and `dictresize` — the scan, the deletion, the tail trim
> and the compaction that decide the cost, all quoted or named in *When `next(iter(d))` is not
> O(1)* below.

**Once order is a guarantee, a set of operations becomes meaningful that previously were not: taking the last item, taking the first, walking backwards, and rebuilding a mapping in a chosen order. Each has a documented promise attached — `popitem()` is LIFO *by guarantee* since 3.7, `reversed(d)` exists *since 3.8*, and `sorted()` is stable *by guarantee* — and each has a shape that is obviously correct and a shape people write instead. This chunk is the ordering toolkit.**

## `popitem()` — LIFO, and that is a promise

> *"Remove and return a `(key, value)` pair from the dictionary. Pairs are returned in LIFO (last-in, first-out) order."*

> *"Changed in version 3.7: LIFO order is now guaranteed. In prior versions, `popitem` would return an arbitrary key/value pair."*

Two separate facts, and the second one is why this belongs beside the order guarantee rather than beside `del`. Before 3.7 `popitem()` gave you *some* pair; from 3.7 it gives you the most recently inserted one. That turns it into a usable stack discipline over a mapping.

```python
pending: dict[str, Job] = {}
pending["job-1"] = job_1
pending["job-2"] = job_2

key, job = pending.popitem()        # ('job-2', job_2) — the newest
```

The documentation names its intended use:

> *"`popitem` is useful to destructively iterate over a dictionary, as often used in set algorithms. If the dictionary is empty, calling `popitem` raises a `KeyError`."*

Destructive iteration is the one loop over a dictionary that is *safe* to write while mutating it, because it never holds an iterator:

```python
def drain(pending: dict[str, Job]) -> None:
    """Consume every entry, newest first, while the dict shrinks under us."""
    while pending:
        key, job = pending.popitem()
        run(job)
```

⚠️ `popitem()` takes no arguments on `dict`. `OrderedDict.popitem(last=False)` does, and the `collections` documentation spells out the `dict` equivalent for the other end:

> *"A regular `dict` can emulate OrderedDict's `od.popitem(last=False)` with `(k := next(iter(d)), d.pop(k))` which will return and remove the leftmost (first) item if it exists."*

```python
first_key, first_value = (k := next(iter(queue)), queue.pop(k))    # FIFO by hand
```

That walrus expression is the documented idiom, not a trick someone invented; it works because `next(iter(d))` is the first key in insertion order and `pop` removes it. On an empty dict it raises `StopIteration`, not `KeyError` — a real difference from `popitem()`. Its cost is not flat, either: on a dict drained from the front it degrades, as *When `next(iter(d))` is not O(1)* below shows.

## First and last without removing anything

There is no `d.first()` or `d.last()`. There are two one-liners, and both are *O*(1) as long as no entries were deleted from the end they read — *When `next(iter(d))` is not O(1)*, below, is what happens when some were:

```python
first_key = next(iter(d))                 # StopIteration if d is empty
last_key  = next(reversed(d))             # StopIteration if d is empty

first_key = next(iter(d), None)           # sentinel form, no exception
last_key  = next(reversed(d), None)
```

`reversed(d)` is documented and versioned:

> *"`reversed(d)` — Return a reverse iterator over the keys of the dictionary. This is a shortcut for `reversed(d.keys())`."* — *"Added in version 3.8."*

> *"Dictionaries and dictionary views are reversible."* — *"Changed in version 3.8: Dictionaries are now reversible."*

🔴 **Do not write `list(d)[0]` or `list(d.keys())[-1]`.** Those build a full list — *O*(n) time and *O*(n) memory — to read one element. On a 200,000-key cache inside a request handler that is a real cost, and it is invisible in review because it looks like indexing.

```python
# O(n) allocation to read one key
newest = list(cache.keys())[-1]

# O(1), and it reads better
newest = next(reversed(cache))
```

## When `next(iter(d))` is not *O*(1)

The quoted `collections` recipe states no cost for it, and the source shows why it is not a flat *O*(1) — an implementation detail of CPython, not a language guarantee. A CPython dict keeps its entries in a dense array in insertion order (the compact layout, [01](01-the-hash-table-underneath.md)). A fresh iterator starts at slot 0 (`dictiter_new` sets `di_pos` to `0`), and its first `next` walks forward over *dead* slots — entries whose value is `NULL` — until it reaches a live one. From `dictiter_iternextkey_lock_held` in CPython **v3.14.7**, the branch for `str` keys (the general-key branch is the same loop, and the free-threaded build's `dictiter_iternext_threadsafe` repeats it):

```c
PyDictUnicodeEntry *entry_ptr = &DK_UNICODE_ENTRIES(k)[i];
while (i < n && entry_ptr->me_value == NULL) {
    entry_ptr++;
    i++;
}
if (i >= n)
    goto fail;
key = entry_ptr->me_key;
```

Deleting never repairs that. `delitem_common` — which `del d[k]` and `d.pop(k)` both reach — sets the entry's key and value to `NULL` and leaves `dk_nentries`, the array's length, alone. The array is compacted only by a resize, and a resize is triggered by an *insertion* that finds no usable slot (`insertion_resize`, then `dictresize`, which copies just the live entries), never by a deletion. This is the layout of an ordinary dict; the shared-key split table behind instance `__dict__`s is read by a separate branch (`get_index_from_order`) and is not what is described here. So:

- **The cheap case.** Creating the iterator, and the first `next` when slot 0 is live, is *O*(1) — a dict that has only been inserted into, or that was just resized or rebuilt from its live items.
- **The expensive case.** With *k* dead slots ahead of the first live entry, `next(iter(d))` scans *k* slots, which is *O*(k). Each deletion of the current first key adds one, and only a resize resets the count.
- **Draining from the front is quadratic.** `while d: k = next(iter(d)); d.pop(k)` — the documented FIFO emulation above — scans 0, then 1, then 2 … dead slots: *O*(n²) for *n* entries when nothing is inserted meanwhile. A steady insert-one-delete-one queue saw-tooths instead: the dead run grows until an insertion forces a resize, then drops. Each skipped slot is a `NULL` check, so the constant is small; the shape is the point, and this page reports no timings.
- **The back mirrors it.** `next(reversed(d))` starts at `dk_nentries - 1` and skips dead slots backwards (`dictreviter_iter_lock_held`), so it degrades after `del d[k]` or `d.pop(k)` on the newest keys in the same way. `popitem()` is the exception: it walks back to the last live entry and then sets `dk_nentries` to that entry's index (`dict_popitem_impl`), which drops the dead tail, so a `popitem()` drain never rescans what it already removed.

The structure built for cheap access at both ends is `collections.deque`. When items must also be found or cancelled by key, `OrderedDict.popitem(last=False)` reads the head of a linked list instead — [07 · `OrderedDict`](../06-collections-module/07-ordereddict-what-it-still-does.md) has the mechanism and the same source.

## Iterating the three views in step

The views documentation guarantees that keys and values line up, and hands you the idiom:

> *"Keys and values are iterated over in insertion order. This allows the creation of `(value, key)` pairs using `zip()`: `pairs = zip(d.values(), d.keys())`. Another way to create the same list is `pairs = [(v, k) for (k, v) in d.items()]`."*

Both spellings are in the docs, and the second is the one to prefer in application code because it does not depend on the reader knowing the co-ordering rule. Reach for the `zip` form only when you are already holding the two views separately.

```python
# clear, and needs no cross-view guarantee to read
inverted = {value: key for key, value in d.items()}
```

`reversed` works on the views too, with the same guarantee stated in the opposite direction:

> *"`reversed(dictview)` — Return a reverse iterator over the keys, values or items of the dictionary. The view will be iterated in reverse order of the insertion."*

```python
for key, value in reversed(audit_log.items()):   # newest entry first
    print(key, value)
```

## Rebuilding a dict in a different order

A dict cannot be re-sorted in place — there is no `d.sort()`. Ordering means constructing a new one, and because `dict()` accepts an iterable of pairs, that is one expression:

```python
from operator import itemgetter

scores = {"carol": 91, "alice": 78, "bob": 95}

by_name  = dict(sorted(scores.items()))                          # key ascending
by_score = dict(sorted(scores.items(), key=itemgetter(1), reverse=True))
```

`sorted` carries the guarantee that makes multi-pass sorting work:

> *"The built-in `sorted()` function is guaranteed to be stable. A sort is stable if it guarantees not to change the relative order of elements that compare equal --- this is helpful for sorting in multiple passes (for example, sort by department, then by salary grade)."*

So a two-key sort is two sorted calls, least significant first, and the dict you build from the result carries that exact order:

```python
rows = list(employees.items())
rows.sort(key=lambda kv: kv[1].salary_grade)     # secondary first
rows.sort(key=lambda kv: kv[1].department)       # primary last
by_dept_then_grade = dict(rows)
```

The top-N shape, which is where people reach for a full sort they do not need:

```python
import heapq
from operator import itemgetter

top_10 = dict(heapq.nlargest(10, scores.items(), key=itemgetter(1)))
```

`heapq` is [07 · `heapq` and `bisect`](../07-heapq-and-bisect/README.md); the point here is that `dict(...)` over any ordered iterable of pairs is how a dict acquires an order, whatever produced that order.

⚠️ **`sorted(d)` sorts the keys, not the items.** `sorted(d)` iterates `d`, and iterating a dict yields keys — *"`iter(d)` — Return an iterator over the keys of the dictionary."* So `sorted(d)` gives you a **list of keys**, and `dict(sorted(d))` is a `ValueError` unless the keys happen to be 2-element iterables. The item form is `sorted(d.items())`.

## Order-sensitive output: the two places it actually matters

**Serialisation.** `json.dumps` writes keys in iteration order unless told otherwise; `sort_keys` defaults to `False`. If two services must produce byte-identical JSON — for a signature, a cache key, or a diff-based config check — pin the ordering explicitly on both sides rather than relying on both dicts having been built the same way:

```python
import json

def canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))
```

**SQL and CSV column order.** A dict built by a comprehension over a `set` inherits the set's unspecified order, and that leaks straight into a generated `INSERT` or a CSV header. Sort at the point where the unordered thing becomes an ordered one:

```python
columns = {name: coerce(name) for name in sorted(required_columns)}   # a set -> stable
header = ",".join(columns)
```

## Gotchas

**★ Symptom: `d.popitem()` returns a different entry than expected on an old runtime.** Cause: LIFO is only guaranteed from 3.7 — *"In prior versions, `popitem` would return an arbitrary key/value pair."* Fix: if 3.6 or earlier is genuinely in scope, take the last key explicitly rather than trusting `popitem`.

```python
last_key = next(reversed(d))     # 3.8+; explicit, not reliant on popitem's ordering
value = d.pop(last_key)
```

**★ Symptom: `list(d.keys())[0]` shows up as an allocation hotspot.** Cause: it materialises every key to read one. Fix: `next(iter(d))`, which builds an iterator instead of a list and reads one live entry, skipping any deleted slots ahead of it (their cost is the FIFO gotcha below).

```python
first_key = next(iter(d))
```

**★ Symptom: `dict(sorted(d))` raises `ValueError: dictionary update sequence element #0 has length 1; 2 is required` — or silently produces nonsense.** Cause: `sorted(d)` sorts *keys*; `dict()` then tries to interpret each key as a `(key, value)` pair. Fix: sort the items view.

```python
ordered = dict(sorted(d.items()))
```

**★ Symptom: a "sort the dict" function returns `None`.** Cause: someone reached for `list.sort()` semantics. `dict` has no `sort` at all, and `d.update(...)` — the nearest thing to an in-place mutator — is documented as *"Return `None`."* Fix: rebuild and rebind.

```python
# wrong: there is no dict.sort, and update returns None
# scores = scores.update(sorted(scores.items()))

scores = dict(sorted(scores.items(), key=lambda kv: kv[1]))
```

**Symptom: a FIFO drain loop written as `d.popitem()` processes newest-first.** Cause: `popitem` is LIFO by guarantee. Fix: use the documented leftmost emulation — for a small dict; the next gotcha is what it costs on a large one.

```python
while d:
    key, value = (k := next(iter(d)), d.pop(k))     # oldest first
    handle(key, value)
```

**★ Symptom: the leftmost-emulation drain above gets slower the further it runs — each iteration scans more dead slots than the one before.** Cause: every `pop` leaves a dead slot at the front of the entries array, and every new `next(iter(d))` scans all of them from slot 0 — *O*(n²) in total when nothing refills the dict (`dictiter_iternextkey_lock_held`, `v3.14.7`). Fix: take a snapshot once and pop by key, or use a structure built for the front.

```python
for key in list(d):                  # one O(n) snapshot; keys added by handle() are not seen
    handle(key, d.pop(key))
```

```python
from collections import OrderedDict

queue = OrderedDict(d)               # a queue that is also refilled while it drains
while queue:
    key, value = queue.popitem(last=False)     # head of a linked list, not a scan
    handle(key, value)
```

**Symptom: `popitem()` on an empty dict raises `KeyError`, and the surrounding code was written to expect `StopIteration`.** Cause: the two idioms fail differently — *"If the dictionary is empty, calling `popitem` raises a `KeyError`"*, whereas `next(iter(d))` raises `StopIteration`. Fix: guard on truthiness, which is unambiguous for both.

```python
while d:                     # not `while True: ... except KeyError`
    key, value = d.popitem()
```

**Symptom: a multi-key sort produces the wrong grouping.** Cause: the sorts were applied in the wrong order. Stability means the *last* sort is the primary key. Fix: sort least-significant first.

```python
rows.sort(key=itemgetter(2))     # tie-breaker
rows.sort(key=itemgetter(0))     # primary
```

**Symptom: two services sign the same payload and produce different signatures.** Cause: one dumped in insertion order and the other sorted, or the two dicts were built by different code paths. `sort_keys` defaults to `False`, so "we both used `json.dumps`" is not a shared contract. Fix: define one canonical form and use it on both sides.

```python
canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
```

**Symptom: `reversed(d)` raises `TypeError` on a runtime you support.** Cause: dict reversibility was *"Added in version 3.8"*. Fix: on ≤ 3.7, reverse the materialised keys — accepting the *O*(n) — and leave a comment naming the floor.

```python
last_key = list(d)[-1]     # 3.7 floor: reversed(d) is 3.8+
```

## Interview questions

**★ Which entry does `d.popitem()` remove, and since when?**
The most recently inserted one. The documentation says *"Pairs are returned in LIFO (last-in, first-out) order"* and marks it *"Changed in version 3.7: LIFO order is now guaranteed. In prior versions, `popitem` would return an arbitrary key/value pair."* That makes it a stack pop over a mapping, and the docs suggest it precisely for *"destructively iterate over a dictionary"* — a `while d: d.popitem()` loop is the one mutation-during-consumption pattern that cannot raise `RuntimeError`, because it never holds an iterator.

**★ How do you get the first key of a dict without building a list?**
`next(iter(d))`. Iterating a dict yields keys in insertion order, so the first thing the iterator produces is the first key, with no list built — *O*(1) when no deleted entries sit ahead of it, *O*(k) when k do (next question). The last key is `next(reversed(d))`, available since 3.8. Both raise `StopIteration` on an empty dict, and both take a sentinel second argument if you would rather have a default. `list(d)[0]` gives the same answer and costs a full copy of the key sequence, which is the version that shows up in profiles.

**★ Is `next(iter(d))` always *O*(1)?**
No. A fresh dict iterator starts at the first slot of the entries array and skips dead slots — entries whose value is `NULL`, left behind by `del` and `pop` — until it finds a live one (`dictiter_iternextkey_lock_held`, CPython `v3.14.7`). Deletion never compacts that array; a resize does, and only an insertion triggers one. So the cost is proportional to the deletions from the front since the last resize, and the documented FIFO emulation `(k := next(iter(d)), d.pop(k))`, looped over a dict that is not being refilled, is *O*(n²) overall. `popitem()` does not have the problem in the other direction, because it trims the dead tail as it goes. For a real queue use `collections.deque`, or `OrderedDict.popitem(last=False)` when items must also be found by key.

**★ Why is there no `dict.sort()`?**
Because sorting a hash table in place is not a thing a hash table can do — position is determined by insertion, and the entries array is append-only by construction. Ordering a mapping means building a new one: `dict(sorted(d.items(), key=...))`. That is also why the `dict` ordering guarantee is about *insertion*, not about any intrinsic order over keys; a dict has no notion of a key being "less than" another, which is exactly why `<` between dicts raises `TypeError`.

**Why does `sorted(d)` give keys and `sorted(d.items())` give pairs?**
Because `sorted` consumes an iterable, and iterating a dict is documented as *"a shortcut for `iter(d.keys())`"*. So `sorted(d)` is `sorted(d.keys())`. This is the same asymmetry that makes `for k in d` idiomatic and `for k in d.keys()` redundant. The failure mode is loud when you feed the result to `dict()` — you get a `ValueError` about sequence element length — and silent when you feed it to something that accepts a list of keys.

**What does `sorted` being stable buy you when reordering a dict?**
Multi-key ordering without writing a composite key function. Sort by the least significant field first and the most significant last; equal elements keep the relative order the previous pass gave them, because *"A sort is stable if it guarantees not to change the relative order of elements that compare equal."* The dict you build from the result inherits that exact sequence, since insertion order is the dict's order.

**When does dict ordering leak into something a user can see?**
Serialisation and generated code, mostly: JSON key order (`json.dumps` defaults to `sort_keys=False`, so insertion order is what ships), CSV headers, generated `INSERT` column lists, form field order, and `repr()` in logs and error messages. Each of those is a place where a dict built by iterating an unordered source — a `set`, or `os.environ` in some contexts — produces output that differs between processes, and the fix is always to sort at the boundary rather than to hunt the non-determinism downstream.

---

← [03 · Order is a guarantee](02-insertion-order-is-a-guarantee.md) · [Topic index](README.md) · Next → [05 · Hashability — the contract](03-hashability-the-contract.md)
