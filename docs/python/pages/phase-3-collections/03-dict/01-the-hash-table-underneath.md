---
title: "A dict is a resizable hash table, and every property you rely on — O(1) lookup, hashable keys, insertion order — falls out of that one design decision"
sidebar_label: "01 · The hash table underneath"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html), [Design FAQ — *How are dictionaries implemented in CPython?*](https://docs.python.org/3.14/faq/design.html#how-are-dictionaries-implemented-in-cpython) — and against `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run, no timings, no byte counts**.

**Every surprising thing a `dict` does traces back to one sentence in the design FAQ: it is a resizable hash table. The key is converted to an integer, the integer picks a slot in an array, and the entry lives there. That is why lookup does not care how many keys there are, why a key has to be hashable, why two keys that compare equal can never both be present, and why a key you mutate afterwards effectively disappears. This chunk is the mechanism. The next one is the part the mechanism does *not* promise.**

## What the documentation actually commits to

The FAQ states the structure outright:

> *"CPython's dictionaries are implemented as resizable hash tables. Compared to B-trees, this gives better performance for lookup (the most common operation by far) under most circumstances, and the implementation is simpler."*

and then the lookup path:

> *"Dictionaries work by computing a hash code for each key stored in the dictionary using the `hash()` built-in function. The hash code varies widely depending on the key and a per-process seed … The hash code is then used to calculate a location in an internal array where the value will be stored. Assuming that you're storing keys that all have different hash values, this means that dictionaries take constant time -- *O*(1), in Big-O notation -- to retrieve a key."*

Read *"Assuming that you're storing keys that all have different hash values"* carefully. It is not decoration; it is the entire precondition, and [02 · What O(1) does not promise](01b-what-o1-does-not-promise.md) is about what happens when it fails.

The type-level contract is one sentence in `stdtypes`:

> *"A mapping object maps hashable values to arbitrary objects. Mappings are mutable objects. There is currently only one standard mapping type, the dictionary."*

## The three steps of a lookup

A `d[key]` is not one operation, it is three, and each can be the expensive one:

```python
config = {"host": "db.internal", "port": 5432, "ssl": True}

value = config["port"]
# 1. hash("port")            -> an int, via str.__hash__
# 2. int -> slot index       -> a masked slice of that int
# 3. compare the candidate   -> "port" == stored_key, via str.__eq__
```

Step 3 is the one people forget. A hash collision does not produce a wrong answer, it produces *another comparison*. The dictionary only returns a value once `==` says the stored key really is your key — which is why the FAQ insists:

> *"dictionary keys should be compared using `==`, not using `is`."*

That is also why a class with an expensive `__eq__` can make a "O(1)" dictionary slow while every complexity table still reads *O*(1). The time-complexity page says so in its own preconditions:

> *"They also assume that hashing and comparing a key is *O*(1)."*

## The documented cost table

This is the whole of what the language documentation promises about speed. Nothing here was measured by this page.

| Operation | Documented complexity |
|---|---|
| `key in d` | *O*(1) |
| `d[key]`, `d.get(key)` | *O*(1) |
| `d[key] = value` | *O*(1) |
| `del d[key]`, `d.pop(key)` | *O*(1) |
| `len(d)` | *O*(1) |
| `d.copy()` | *O*(*n*) |
| iteration | *O*(*n*) |
| `d.update(t)`, `d \|= t` | *O*(len(*t*)) |

Two entries earn attention. **`len(d)` is *O*(1)** — the dictionary stores its own count, so `if len(d) > 1000` never walks anything. And **`d.update(t)` is *O*(len(t))**, not *O*(len(d)) — merging a two-key patch into a hundred-thousand-key dictionary costs two insertions, which is exactly why the "rebuild the whole config" instinct is the wrong one.

## The single replacement that changes an algorithm's class

The one refactor worth reaching for by reflex:

```python
# O(n) per test — the list is scanned element by element
banned_ids = ["u-7712", "u-9910", "u-3325"]        # imagine 50_000 of these

def is_banned_slow(user_id: str) -> bool:
    return user_id in banned_ids                    # O(n)

# O(1) per test — one hash, one slot, one comparison
banned_ids = {"u-7712", "u-9910", "u-3325"}         # a set: the same table, no values

def is_banned_fast(user_id: str) -> bool:
    return user_id in banned_ids                    # O(1)
```

The time-complexity page gives *O*(1) for `key in d` and, for lists, membership is a scan. Inside a loop over a request batch, that is the difference between *O*(batch × banned) and *O*(batch). `set` is the same hash table with the values omitted — it gets its own topic at **04 · `set` and `frozenset`** *(not written yet)*.

## The layout is CPython's business — read it, do not depend on it

CPython 3.6 replaced the old open-addressed table with the "compact" layout: a small array of *indices* pointing into a dense, append-only array of *entries*. The 3.6 release notes describe the change and its measured saving:

> *"The `dict` type now uses a "compact" representation based on a proposal by Raymond Hettinger which was first implemented by PyPy. The memory usage of the new `dict()` is between 20% and 25% smaller compared to Python 3.5."*

The source header at `v3.14.7` still says *"As of Python 3.6, this is compact and ordered."* and explains why order comes free:

> *"Preserving insertion order — It's simple for combined table. Since dk_entries is mostly append only, we can get insertion order by just iterating dk_entries."*

🔴 **That paragraph is the mechanism, not the guarantee.** The guarantee is a separate, later decision, and [03 · Insertion order is a language guarantee](02-insertion-order-is-a-guarantee.md) draws the line precisely. Treat everything below as CPython trivia you may quote in a review and must never write a test against.

Three numbers from `Objects/dictobject.c` at `v3.14.7`, with the comments that justify them:

```text
#define PyDict_MINSIZE 8
    "8 allows dicts with no more than 5 active entries; experiments suggested this
     suffices for the majority of dicts (consisting mostly of usually-small dicts
     created to pass keyword arguments)."

#define USABLE_FRACTION(n) (((n) << 1)/3)
    "USABLE_FRACTION is the maximum dictionary load. Increasing this ratio makes
     dictionaries more dense resulting in more collisions. ... Fractions around 1/2
     to 2/3 seem to work well in practice."

#define GROWTH_RATE(d) ((d)->ma_used*3)
    "Growth rate upon hitting maximum load. Currently set to used*3. This means that
     dicts double in size when growing without deletions, but have more head room
     when the number of deletions is on a par with the number of insertions."
```

So: a fresh dict has room for five entries before it resizes, it resizes when it is two-thirds full, and it grows by tripling *live* entries — which is a doubling of capacity when nothing has been deleted. **None of that is in the language reference. All of it can change in 3.15.**

## Deletion leaves a tombstone

The same source describes four slot states — Unused, Active, **Dummy**, Pending — and pins down why a deleted slot cannot simply go back to Unused:

> *"Dummy slots cannot be made Unused again else the probe sequence in case of collision would have no way to know they were once active."*

The practical consequence is real even though the mechanism is not guaranteed: a dictionary that is churned hard — insert, delete, insert, delete, on the same table — accumulates tombstones and does not shrink on `del`. If you have a long-lived cache dictionary being emptied by key and refilled, the way to reclaim the table is to build a new one, not to keep deleting from the old one:

```python
# a long-lived dict churned by an eviction loop keeps its table capacity
sessions = {}

def compact(sessions: dict[str, Session]) -> dict[str, Session]:
    """Rebuild so the underlying table is sized to what is actually live."""
    return dict(sessions)          # one fresh table, no tombstones

sessions = compact(sessions)
```

⚠️ The `dict()` copy is *O*(*n*) and shallow — `d.copy()` is documented as *"Return a shallow copy of the dictionary"*, so the values are the same objects. That is a feature here and a bug in **08 · `copy` vs `deepcopy`** *(not written yet)* territory.

## Why "hashable" is not a stylistic preference

The FAQ's answer to *"Why must dictionary keys be immutable?"* is the whole argument for the next three chunks, so it belongs here in full:

> *"The hash table implementation of dictionaries uses a hash value calculated from the key value to find the key. If the key were a mutable object, its value could change, and thus its hash could also change. But since whoever changes the key object can't tell that it was being used as a dictionary key, it can't move the entry around in the dictionary. Then, when you try to look up the same object in the dictionary it won't be found because its hash value is different. If you tried to look up the old value it wouldn't be found either, because the value of the object found in that hash bin would be different."*

A mutable key does not raise. It *silently strands the entry*. That is [05 · Hashability](03-hashability-the-contract.md) and [07 · The key that mutates](03c-the-key-that-mutates.md).

## Gotchas

**★ Symptom: a "constant time" dictionary lookup is measurably slow, and the profiler blames `__eq__`.** Cause: the *O*(1) in the documentation is qualified — *"They also assume that hashing and comparing a key is *O*(1)."* A key whose `__hash__` walks a large tuple, or whose `__eq__` compares a long string field by field, pays that cost on every lookup, collision or not. Fix: key on something cheap and precomputed, and keep the heavy object as the value.

```python
# slow: every lookup rehashes and re-compares a big composite key
cache: dict[tuple[str, str, str, str], Result] = {}
cache[(tenant, region, sku, variant)] = result

# fast: hash a short interned string once, keep the full identity in the value
def cache_key(tenant: str, region: str, sku: str, variant: str) -> str:
    return f"{tenant}|{region}|{sku}|{variant}"

cache: dict[str, tuple[tuple[str, str, str, str], Result]] = {}
cache[cache_key(tenant, region, sku, variant)] = ((tenant, region, sku, variant), result)
```

**★ Symptom: `del d[k]` in a loop never reduces the process's memory.** Cause: deletion writes a *Dummy* slot; the table's capacity does not shrink, because *"Dummy slots cannot be made Unused again else the probe sequence in case of collision would have no way to know they were once active."* Fix: rebuild the dictionary rather than draining it in place.

```python
# does not reclaim table capacity
for key in list(expired):
    del cache[key]

# does — a new table sized to the live entries
cache = {k: v for k, v in cache.items() if k not in expired}
```

**Symptom: `d.update(big_other)` is unexpectedly the hot line in a request handler.** Cause: `update` is documented at *O*(len(*t*)) — the cost is the size of the *argument*, and if you are calling it in a loop with the same large defaults dictionary you are paying that size every iteration. Fix: hoist the invariant part out of the loop and merge the small part in.

```python
# O(len(DEFAULTS)) per request
for req in requests:
    settings = {}
    settings.update(DEFAULTS)
    settings.update(req.overrides)

# O(len(overrides)) per request; DEFAULTS is copied once
base = dict(DEFAULTS)
for req in requests:
    settings = base | req.overrides
```

**Symptom: `len(d)` inside a hot loop looks like a code smell to a reviewer who has been burned by other languages.** Cause: in languages where a map's size is computed by traversal, `len` in a loop is a real bug. In CPython it is not — the time-complexity page lists `len(d)` at *O*(1). Fix: none needed; leave it, and cite the table.

**Symptom: a code review asks you to "presize" a dict the way you would a list.** Cause: `list` has no public presize either, but people remember `PyDict_MINSIZE` and reach for it. There is no public API to preallocate a `dict` in the language documentation. Fix: build it from an iterable in one call so the resize sequence happens once, inside C, rather than growing it key by key from Python.

```python
# grows through several resizes, one Python-level statement per key
lookup = {}
for row in rows:
    lookup[row.id] = row

# one construction; the comprehension is still O(n) but the loop is not interpreted
lookup = {row.id: row for row in rows}
```

## Interview questions

**★ Why is a dictionary lookup *O*(1) when a list lookup by value is *O*(n)?**
Because the dictionary does not search. It computes an integer from the key with `hash()`, turns that integer into an index into an internal array, and goes straight to that slot; the FAQ describes exactly this and concludes that *"dictionaries take constant time -- O(1), in Big-O notation -- to retrieve a key"* under the assumption that keys have different hash values. A list has no such mapping from value to position, so `x in some_list` compares elements one at a time until it finds a match or runs out. The dictionary trades memory — a table that is deliberately kept below a 2/3 load — and a constraint on keys (they must be hashable) for that jump.

**★ What has to be true about a key for the *O*(1) claim to hold?**
Three things, and the documentation states all three. The hash function must be *"sufficiently robust to make collisions uncommon"*; the keys must be *"well-distributed among the set of possible keys"*; and hashing and comparing a key must themselves be *O*(1). Break any one and you are back to linear behaviour with the same code and the same complexity table. The first two are usually the attacker's problem, the third is usually your own — a `__hash__` over a big nested structure is a real cost paid on every single lookup.

**Why does `d.copy()` cost *O*(n) when `len(d)` costs *O*(1)?**
`len` reads a counter the dictionary already maintains. A copy has to allocate a new table and place every live entry into it, so its cost is proportional to the number of entries. The relevant practical point is that "copy the config so I don't mutate the caller's" is not free at scale, and `d.copy()` is documented as *shallow* — the values in the copy are the same objects, so copying does not protect you from a mutation *inside* a value.

**Why does a `dict` compare keys with `==` and not `is`, when a hash already told it where to look?**
Because a hash is a lossy projection: distinct keys can land on the same slot, so a slot match is only a candidate. Equality is what confirms it. The design FAQ makes this an explicit rejection of an alternative design — hashing lists by identity was considered and dropped precisely because *"if you construct a new list with the same value it won't be found"*, and the FAQ concludes that *"dictionary keys should be compared using `==`, not using `is`"*. This is why `d["ab" + "c"]` finds the entry stored under the literal `"abc"` even though those are potentially different string objects.

**What actually happens to the table when you delete a key, and why does it matter for a long-lived process?**
The slot becomes a *Dummy* — a tombstone that keeps collision probe sequences intact, because *"Dummy slots cannot be made Unused again else the probe sequence in case of collision would have no way to know they were once active."* The dictionary's *length* drops but its *capacity* does not; a cache that is churned by deleting and reinserting keeps the table it grew to. That is CPython implementation detail rather than a language guarantee, but the remedy is portable and cheap: periodically rebuild the mapping rather than draining it in place.

**Is the compact-dict layout something you can rely on?**
No — and the distinction is the one thing worth getting right in this area. The 3.6 release notes introduced the compact representation and explicitly said its *"order-preserving aspect … is considered an implementation detail and should not be relied upon."* What became guaranteed a release later is the *observable insertion order*, not the layout. So you may rely on iteration order; you may not rely on the load factor, the growth rate, the minimum size, the index-array width, or the presence of a shared-keys "split table" for instances.

---

← [Topic index](README.md) · Next → [02 · What O(1) does not promise](01b-what-o1-does-not-promise.md)
