---
title: "Adding or deleting a key while a loop walks the dict raises RuntimeError on the next step — or, when the size happens to come out even, silently skips entries — so the rule is: snapshot first, then mutate"
sidebar_label: "14 · Mutating while iterating"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Glossary — *dictionary view*](https://docs.python.org/3.14/glossary.html#term-dictionary-view). Iterator checks and both error strings read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag, not from a run. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A `for` loop over a dict does not copy anything — it holds an iterator that walks the live table and remembers how many entries it expects to see. Change the number of entries and the next step of the loop raises `RuntimeError`. Change the entries without changing the number — delete one, add one — and the loop may raise a different `RuntimeError`, or may simply finish having missed some. The documentation promises neither outcome; it promises only that you cannot rely on either. Every correct fix on this page has the same shape: decide what to change while walking a snapshot, then change it.**

## The documented rule

The view documentation is the only normative sentence, and it is deliberately loose:

🔴 > *"Iterating views while adding or deleting entries in the dictionary may raise a `RuntimeError` or fail to iterate over all entries."*

Two words carry the weight. *"may raise"* — so the exception is not a guarantee you can build on. *"or fail to iterate over all entries"* — so the absence of an exception does not mean the loop was correct. `for k in d` is the same iterator as `for k in d.keys()` (*"`iter(d)` … is a shortcut for `iter(d.keys())`"*), so the rule covers plain loops, `.items()`, `.values()`, comprehensions over the dict, and anything else that holds an iterator across a mutation.

## What the iterator actually checks

In CPython the key iterator records two numbers when it is created — the dictionary's size, and a countdown of how many entries it still expects — and checks them on every step. From `Objects/dictobject.c` at `v3.14.7`:

```c
// at creation
di->di_used = used;
di->len = used;

// on every step, before producing anything
if (di->di_used != d->ma_used) {
    PyErr_SetString(PyExc_RuntimeError,
                    "dictionary changed size during iteration");
    di->di_used = -1; /* Make this state sticky */
    return NULL;
}

// after finding the next live entry
// We found an element (key), but did not expect it
if (di->len == 0) {
    PyErr_SetString(PyExc_RuntimeError,
                    "dictionary keys changed during iteration");
    goto fail;
}
```

That gives three distinct outcomes, and the difference between them is whether the *count* moved:

| What the loop body did | What the next step sees | Outcome |
|---|---|---|
| deleted a key, or added a key | size differs from the recorded size | `RuntimeError: dictionary changed size during iteration` |
| deleted one key and added another | size unchanged; an extra entry turns up after the countdown hit zero | `RuntimeError: dictionary keys changed during iteration` |
| deleted one and added one, and the new entry is not reached | size unchanged, countdown not exhausted | **no error** — and the set of keys the loop saw is not the set the dict holds |

The third row is the documentation's *"fail to iterate over all entries"*. An insertion can also trigger a resize that rebuilds the entries array, after which the iterator's saved position points into a different layout. Which entries get skipped or revisited then depends on table internals no program should reason about — which is exactly why the documentation stops at *"may"*.

⚠️ The `di_used = -1` line matters in practice: once the size error has fired, **every subsequent step raises too**. Catching `RuntimeError` and carrying on with the same loop is not recovery; the iterator is dead.

## What is *not* a mutation of the iteration

The documentation's sentence is about **adding or deleting entries**. Two common operations are neither.

**Replacing the value of a key that is already present.** `d[k] = new_value` for an existing `k` writes into the existing entry — *"updating a key does not affect the order"* — so the size and the key set are unchanged and neither check fires:

```python
prices = {"apple": 1.20, "pear": 0.90, "plum": 2.10}

for name in prices:
    prices[name] = round(prices[name] * 1.1, 2)     # value replacement only — fine
```

**Mutating the value objects themselves.** Appending to a list stored under a key changes the list, not the dictionary:

```python
for tenant, events in by_tenant.items():
    events.sort(key=lambda e: e.at)                  # the dict is untouched
```

And one thing that *is* a mutation but is harmless: mutating and then leaving the loop immediately. The check runs on the *next* step, so a loop that `break`s straight after the mutation never takes one:

```python
for key, session in sessions.items():
    if session.id == target_id:
        del sessions[key]
        break                                        # no further step, no error
```

That is legal and correct. Leave a comment on it, because it looks like the bug below and a well-meaning refactor that removes the `break` reintroduces it.

## The four correct shapes

**1 · Iterate a snapshot, mutate the real thing.** `list(d)` copies the keys *before* the loop starts, so the loop holds no iterator over `d` at all:

```python
for key in list(cache):
    if cache[key].expired():
        del cache[key]
```

The glossary names this as *the* escape from a live view: *"To force the dictionary view to become a full list use `list(dictview)`."* Use `list(d.items())` when you need the values too.

**2 · Rebuild with a comprehension.** The cleanest spelling when the result can be a *new* dictionary:

```python
cache = {key: entry for key, entry in cache.items() if not entry.expired()}
```

**3 · Collect, then apply.** Decide in one pass, change in a second — the right shape when the dictionary's *identity* must survive (see below):

```python
expired = [key for key, entry in cache.items() if entry.expired()]
for key in expired:
    del cache[key]
```

**4 · Drain it.** When the goal is to consume every entry, `popitem()` never holds an iterator, so the dict shrinking under the loop is the whole point — [04 · Working with the order](02b-working-with-the-order.md) covers its LIFO guarantee:

```python
while pending:
    key, job = pending.popitem()
    run(job)
```

## Rebuild versus in place: the identity question

Shapes 2 and 3 are not interchangeable. A comprehension produces a **new** object and rebinds one name to it; every other reference still holds the old dictionary, unfiltered.

```python
# registry.py
HANDLERS: dict[str, Handler] = {}

# dispatcher.py — imported the object, not the name
from registry import HANDLERS as handlers

# admin.py
import registry

def disable_plugins() -> None:
    registry.HANDLERS = {k: h for k, h in registry.HANDLERS.items() if not h.plugin}
    # dispatcher.handlers still points at the OLD dict — plugins keep running
```

The in-place forms keep every reference in agreement:

```python
def disable_plugins() -> None:
    doomed = [k for k, h in registry.HANDLERS.items() if h.plugin]
    for key in doomed:
        del registry.HANDLERS[key]
```

When there is a lot to remove, "filter, then swap the contents" does the same thing in two calls — `clear()` then `update()` on the one shared object:

```python
kept = {k: h for k, h in registry.HANDLERS.items() if not h.plugin}
registry.HANDLERS.clear()
registry.HANDLERS.update(kept)
```

Every loop on this page mutates the dictionary *visibly* — there is a `del` or an assignment in the body. The loops that fail in production usually do not: the body calls a handler, reads a `defaultdict`, touches a `cached_property`, or shares the dictionary with another thread. Those are [15 · The mutations you did not write](05c-the-mutations-you-did-not-write.md).

## Gotchas

**★ Symptom: `RuntimeError: dictionary changed size during iteration` from a loop that deletes expired entries.** Cause: `del d[k]` inside `for k in d` changes the size; the iterator checks the size on its next step. Fix: iterate a snapshot of the keys.

```python
for key in list(cache):
    if cache[key].expired():
        del cache[key]
```

**★ Symptom: the same error from a loop that *adds* keys — typically one that normalises them.** Cause: `d[k.lower()] = d.pop(k)` both removes and adds, and the intermediate size is what the iterator sees. Fix: build a new dictionary; key normalisation is a transformation, not an edit.

```python
headers = {name.lower(): value for name, value in headers.items()}
```

**★ Symptom: `RuntimeError: dictionary keys changed during iteration`.** Cause: the loop deleted one key and inserted another, so the size is unchanged but the iterator found an entry after its countdown reached zero. Fix: snapshot, exactly as for the size error — the two messages have one cause.

```python
for old_key in list(mapping):
    mapping[migrate(old_key)] = mapping.pop(old_key)
```

**★ Symptom: no exception, but some entries were never processed.** Cause: a same-size mutation that the iterator could not detect — the documented *"or fail to iterate over all entries"*. Fix: treat "no error" as meaningless; any add-or-delete inside the loop means the loop needs a snapshot.

```python
for key, value in list(mapping.items()):
    reconcile(mapping, key, value)          # may add and remove keys freely
```

**Symptom: code catches the `RuntimeError` and continues, and every later step raises again.** Cause: the iterator marks itself dead — `di->di_used = -1; /* Make this state sticky */`. Fix: there is no recovery on the same iterator; restructure the loop to snapshot.

```python
for key in list(d):
    process_and_maybe_delete(d, key)
```

**Symptom: after "filtering" a shared registry, another module still sees the removed entries.** Cause: the filter was a comprehension that rebound one name to a new dict; the other module holds the old object. Fix: mutate in place.

```python
doomed = [k for k, h in HANDLERS.items() if h.plugin]
for key in doomed:
    del HANDLERS[key]
```

**Symptom: a loop that calls `d.update(patch)` works in tests and raises in production.** Cause: `update` only changes the size when `patch` contains a key `d` does not have. The test patches only touched existing keys. Fix: snapshot, or collect the patch and apply it after the loop.

```python
patches = {key: fix(value) for key, value in config.items() if needs_fix(value)}
config.update(patches)                 # after iteration, not during
```

**Symptom: a reviewer flags `del d[k]` followed by `break` as the mutation-during-iteration bug.** Cause: it looks identical, but the check runs on the *next* step and `break` ensures there is none. Fix: keep it, and say why in a comment so a refactor does not drop the `break`.

```python
for key, session in sessions.items():
    if session.id == target_id:
        del sessions[key]
        break          # safe: no further iteration step after the mutation
```

## Interview questions

**★ Why does deleting from a dict inside a `for` loop over it raise `RuntimeError`?**
Because the loop is driven by an iterator over the live table, not a copy. CPython's dict iterator records the size when it is created and compares it on every step; a mismatch raises `RuntimeError: dictionary changed size during iteration`. The reason for checking at all is that the iterator walks entries by position, and an insertion can resize and rebuild the table, invalidating that position — continuing would produce garbage. The documentation states the contract loosely on purpose: *"Iterating views while adding or deleting entries in the dictionary may raise a `RuntimeError` or fail to iterate over all entries."*

**★ Is that exception guaranteed? Can you rely on it to catch the bug?**
No. The documentation says *"may raise"*, and pairs it with *"or fail to iterate over all entries"*. In CPython a mutation that leaves the size unchanged — delete one, add one — is only caught if the loop happens to reach the new entry after its countdown is exhausted, in which case you get `RuntimeError: dictionary keys changed during iteration`; otherwise the loop finishes silently having seen the wrong set of keys. So the exception is a diagnostic you sometimes get, not a safety net.

**★ What are the correct ways to delete matching keys from a dict?**
Iterate a snapshot — `for k in list(d): if pred(k): del d[k]` — which holds no iterator over `d`. Rebuild — `d = {k: v for k, v in d.items() if not pred(k)}` — which is clearest but creates a new object. Or collect then delete — build a list of doomed keys in one pass, delete in a second — which keeps the dictionary's identity. The choice between the last two is whether anything else holds a reference to the dictionary: if it does, the comprehension leaves them looking at the unfiltered original.

**★ Can you assign to `d[k]` inside `for k in d`?**
Yes, if `k` is already a key — that replaces the value in the existing entry, which is neither adding nor deleting an entry, and *"updating a key does not affect the order"*. Neither of CPython's iterator checks fires. Assigning to a key that is *not* present is an insertion, and that is exactly the mutation the documentation warns about. The practical trap is code that "only updates" but occasionally computes a key that does not exist yet.

**Why is `while d: d.popitem()` safe when `for k in d: del d[k]` is not?**
Because it never holds an iterator. Each `popitem()` is a complete operation on the current state of the dictionary; the `while` re-evaluates truthiness each time. There is no saved position to invalidate. The `stdtypes` documentation recommends it for precisely this: *"`popitem` is useful to destructively iterate over a dictionary, as often used in set algorithms."*

**How does this compare with mutating a `list` while iterating it?**
The list iterator is an index that advances by one each step and performs no size check, so deleting from a list inside a `for` over it raises nothing and silently skips the element that slid into the deleted position. The dict's check is louder but not stronger — it catches the size case and some same-size cases, not all of them. Both structures share the fix: iterate a copy, or build a new container.

**Why doesn't the dict iterator just work on a snapshot, so mutation during iteration is always safe?**
Because a snapshot costs *O*(n) time and memory on every loop, and the overwhelming majority of loops never mutate. Views and iterators are deliberately *O*(1) to create — *"a dynamic view on the dictionary's entries"* — and the language hands you the snapshot as an explicit, visible operation when you need it: `list(d)`, `list(d.items())`, or `d.copy()`. The size check is the cheap compromise: it catches the most common mistake without charging every loop for the rare one.

---

← [13 · The three views](05-the-three-views.md) · [Topic index](README.md) · Next → [15 · The mutations you did not write](05c-the-mutations-you-did-not-write.md)
