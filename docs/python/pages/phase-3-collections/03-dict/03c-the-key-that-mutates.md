---
title: "A key whose hash changes after insertion does not raise, does not disappear from len() and does not vanish from iteration — it becomes an entry you can see and cannot look up"
sidebar_label: "07 · The key that mutates"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__), [Design FAQ — *Why must dictionary keys be immutable?*](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable), [Glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable), [`dataclasses.dataclass`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.dataclass). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**This is the worst bug in this entire topic, because nothing about it looks like a bug. The dictionary does not raise. `len(d)` still counts the entry. It still appears when you iterate. `d.keys()` still contains it. Only `k in d` and `d[k]` disagree — and `d[k]` raises `KeyError` for a key you can see printed in the same log line. The mechanism is one clause in the data model, and once you have read it the whole failure is obvious.**

## The one-sentence cause

🔴 > *"If a class defines mutable objects and implements an `__eq__()` method, it should not implement `__hash__()`, since the implementation of hashable collections requires that a key's hash value is immutable (**if the object's hash value changes, it will be in the wrong hash bucket**)."*

The parenthesis is the whole bug. The entry does not move when the key changes, because — as the design FAQ puts it — *"whoever changes the key object can't tell that it was being used as a dictionary key, it can't move the entry around in the dictionary."*

## Watching it happen

The class below is a perfectly ordinary "value object with an `__eq__` and a matching `__hash__`" — exactly what [06 · `__hash__` and `__eq__` in your own classes](03b-hash-and-eq-in-your-own-classes.md) told you to write. The only thing wrong with it is that nothing stops the fields changing.

```python
class Tag:
    def __init__(self, name: str) -> None:
        self.name = name

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Tag) and self.name == other.name

    def __hash__(self) -> int:
        return hash((self.name,))


tag = Tag("beta")
counts = {tag: 17}

tag.name = "stable"        # 🔴 the hash of `tag` has just changed
```

From this line onward the dictionary is in the state the data model warns about. Walk the operations:

| Operation | Result | Why |
|---|---|---|
| `len(counts)` | `1` | the entry is still there; the count is a stored integer |
| `list(counts)` | the same `Tag` object, once | iteration walks the entries array; it never hashes |
| `tag in counts` | `False` | membership hashes `tag` — new hash, wrong bucket, nothing found |
| `counts[tag]` | `KeyError` | same path as `in` |
| `counts[Tag("stable")]` | `KeyError` | equal to the stored key, but hashes to the *new* bucket |
| `counts[Tag("beta")]` | `KeyError` | hashes to the *old* bucket, but the stored key no longer equals it |

That last pair is the part that makes people file bugs against Python. The entry is unreachable from **both** sides: the FAQ says it in as many words —

> *"when you try to look up the same object in the dictionary it won't be found because its hash value is different. If you tried to look up the old value it wouldn't be found either, because the value of the object found in that hash bin would be different."*

And the invariant that the FAQ names when rejecting mutable keys is now broken in your own code:

> *"every value in `d.keys()` is usable as a key of the dictionary"*

Here it is not. `k = next(iter(counts))` gives you a key that `counts[k]` cannot resolve.

## The tell in a log

The symptom that reaches you is almost always this shape:

```python
for key in list(counts):          # iteration yields the stranded key happily
    value = counts[key]           # raises KeyError, naming that very key
```

A `KeyError` naming a key that the loop above it just produced. If you ever see that, stop looking at the lookup and look at what happened to the key object between insertion and now.

## Restoring the field un-strands the entry

Because nothing moved, putting the field back makes the entry reachable again:

```python
tag.name = "beta"          # back to the value it had at insertion time
counts[tag]                # 17 — the entry was never gone
```

That is a diagnostic, not a fix. It is also why the bug survives review: someone "fixes" it by restoring the value in one code path and the other three paths still strand it.

## The recovery: rebuild, and re-hash every key

Insertion computes a fresh hash for each key, so constructing a new dict from the old one's items places every entry in the bucket its *current* hash demands:

```python
counts = {key: value for key, value in counts.items()}
```

⚠️ Two caveats, both real:

1. **It is *O*(n)** and it invalidates every existing view — see [13 · The three views](05-the-three-views.md).
2. 🔴 **If two stranded keys now compare equal, the rebuild silently collapses them into one entry**, keeping the last value. A dict that was internally inconsistent becomes consistent by losing data, and nothing reports it. If that matters, count first:

```python
rebuilt = {key: value for key, value in counts.items()}
if len(rebuilt) != len(counts):
    logger.error("collapsed %d duplicate keys during rehash", len(counts) - len(rebuilt))
```

## The three real fixes

**Freeze the key type.** The documentation's own summary: *"Having a `__hash__` implies that instances of the class are immutable."* Make that true rather than hoped for.

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Tag:
    name: str
```

`frozen=True` raises on attribute assignment, so `tag.name = "stable"` fails at the point of the mistake instead of corrupting a table three modules away.

**Key on an immutable projection, not on the object.** Often the cleanest change, because it stops the mutable object from being a key at all:

```python
counts: dict[str, int] = {}
counts[tag.name] = 17            # the string is the key; the Tag is not
```

**Make the object unhashable and force the caller to be explicit.** Where a class genuinely must stay mutable, the data model's advice is to remove hash support rather than to hope: *"If a class defines mutable objects and implements an `__eq__()` method, it should not implement `__hash__()`."*

```python
class Tag:
    __hash__ = None              # deliberately unusable as a key

    def __init__(self, name: str) -> None:
        self.name = name

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Tag) and self.name == other.name
```

Now the mistake is a `TypeError: unhashable type: 'Tag'` at insertion — loud, immediate, and at the right line.

## Why built-in types cannot do this to you

There is no way to reach this state with `list`, `dict`, `set` or `bytearray` keys, because they are rejected at insertion — the `TypeError` fires before anything is stored. And you cannot reach it with a `tuple` of immutables, because there is nothing to mutate. The two ways in are:

1. **A custom class** with a `__hash__` over mutable state — the case above.
2. 🔴 **A tuple that *contains* a mutable object indirectly**, via a custom element whose hash is over mutable state. `hash((tag,))` delegates to `hash(tag)`, so a tuple key inherits the instability of any element that has it.

```python
routes = {(tag, "GET"): handler}     # hashes tag; inherits tag's instability
```

The same applies to `frozenset` — freezing the container does not freeze the elements' hashes.

⚠️ This is *not* a warning about mutable **values**. `{"users": []}` and then `d["users"].append(x)` is completely fine and extremely common; values are never hashed. The rule is about keys only.

## `set` has the identical bug

`set` and `frozenset` are the same table without values, so an element whose hash changes after `add()` is stranded in exactly the same way — `x in s` becomes `False` while `x` is still yielded by iteration. Everything on this page applies unchanged; [04 · `set` and `frozenset`](../04-set-and-frozenset/README.md) covers the set-specific surface.

## Gotchas

**★ Symptom: `KeyError` for a key that the enclosing loop just yielded.** Cause: the key's hash changed after insertion, so lookup probes a different bucket while iteration walks entries directly. Fix: rebuild the dict to re-hash every key, then fix the key type so it cannot happen again.

```python
counts = {key: value for key, value in counts.items()}    # re-hash now
# then: make Tag a frozen dataclass, or key on tag.name
```

**★ Symptom: an object is put in a dict, mutated, and a later `d[obj]` misses — but restoring the field makes it work again.** Cause: the entry never moved; only the probe target did. That restore-and-it-works behaviour is the definitive signature of a mutated key. Fix: freeze the key.

```python
@dataclass(frozen=True)
class Tag:
    name: str
```

**★ Symptom: after a "harmless" rehash rebuild, the dict has fewer entries than before.** Cause: two stranded keys that now compare equal collapsed into one, last value winning. Fix: compare lengths across the rebuild and refuse to continue silently.

```python
rebuilt = dict(counts.items())
assert len(rebuilt) == len(counts), "duplicate keys collapsed during rehash"
```

**★ Symptom: a cache keyed on a domain object returns stale entries after the object is updated.** Cause: the update changed a field that participates in `__hash__`, so the new lookup lands in a fresh bucket and misses — the old entry stays behind forever, never evicted, never found. Fix: key on an immutable identifier, not on the entity.

```python
cache: dict[str, Rendered] = {}
cache[order.id] = rendered           # the id, not the Order
```

**Symptom: a `frozen=True` dataclass is still stranding entries.** Cause: `frozen` blocks assignment to the dataclass's own attributes; it does nothing about mutation *inside* a field's value, and if a field is a mutable custom object with an unstable hash you are back where you started. Fix: make every field a genuinely immutable type.

```python
@dataclass(frozen=True)
class RouteKey:
    method: str
    segments: tuple[str, ...]        # not list, not a mutable custom class
```

**Symptom: a tuple key misbehaves although "tuples are immutable".** Cause: the tuple contains a custom object whose `__hash__` reads mutable state; `hash(tuple)` delegates to the element. Fix: put an immutable projection in the tuple.

```python
key = (tag.name, "GET")              # not (tag, "GET")
```

**Symptom: a set-membership test starts returning `False` for an element that iteration still yields.** Cause: identical mechanism — `set` is the same hash table. Fix: identical remedies; rebuild with `set(s)` and freeze the element type.

**Symptom: an ORM entity works as a dict key until it is flushed to the database.** Cause: the ORM assigns a primary key on flush, and the entity's `__hash__` is defined over that primary key — so the hash is `None`-based before flush and id-based after. Fix: never define `__hash__` over a field the persistence layer writes; use identity hashing (`eq=False`, or no `__eq__` at all) for entities, and value hashing only for genuine value objects.

## Interview questions

**★ What happens if you mutate an object that is being used as a dictionary key?**
Nothing visible, immediately — and that is the problem. The entry stays in the bucket its *old* hash chose, and the data model says exactly why: *"if the object's hash value changes, it will be in the wrong hash bucket."* From then on `len(d)` still counts it, iteration still yields it and `d.keys()` still contains it, but `k in d` is `False` and `d[k]` raises `KeyError`. The FAQ notes the entry is unreachable from both directions — the new value hashes elsewhere, and the old value no longer equals what is stored.

**★ How would you diagnose a `KeyError` raised on a key that the surrounding loop just produced?**
That combination is essentially diagnostic on its own: iteration does not hash, lookup does, so a key that iterates but does not resolve has had its hash change since insertion. Confirm it by restoring the field to the value it had at insertion time and retrying the lookup — if it succeeds, the entry was stranded, not missing. The permanent fix is to stop the key from being mutable: freeze the dataclass, key on an immutable projection, or set `__hash__ = None` so the insertion fails loudly instead.

**★ Can this happen with built-in types?**
Not directly. `list`, `dict`, `set` and `bytearray` are rejected at insertion with `TypeError: unhashable type`, and a tuple of immutables has nothing to mutate. It happens through a custom class whose `__hash__` reads mutable state — and, indirectly, through any tuple or frozenset that *contains* such an object, because container hashing delegates to the elements. Immutability of the container is not enough; the elements' hashes have to be stable too.

**★ Is `d = dict(d.items())` a safe way to recover?**
It re-hashes every key at insertion, so it does place every entry in the bucket its current hash demands — the entries become reachable again. It is safe in the narrow sense and unsafe in one specific way: if two stranded keys now compare equal, the rebuild merges them and the last value wins, silently. So assert on the length across the rebuild if the data matters. And it is a recovery, not a fix — nothing stops the next mutation.

**Does this apply to dictionary *values* too?**
No, and conflating the two produces a lot of unnecessary defensive copying. Values are never hashed; a dict holds a reference to whatever you put there. `config["hosts"].append("db2")` is ordinary Python and completely safe. The rule constrains keys only, which is why `dict[str, list[str]]` is a perfectly normal annotation and `dict[list[str], str]` cannot be constructed at all.

**Your ORM entities are used as dictionary keys and something is stale. Where do you look first?**
At what `__hash__` reads. The classic version is a hash defined over the primary key, which is `None` before the session flushes and an integer afterwards — so the entity is inserted under one hash and looked up under another, within a single request. Entities should hash by identity (do not define `__eq__`, or declare `eq=False`), and value objects should hash by their fields and be frozen. Mixing the two — value equality on a mutable, persistence-managed object — is what produces the stale entry.

---

← [06 · `__hash__` and `__eq__` in your own classes](03b-hash-and-eq-in-your-own-classes.md) · [Topic index](README.md) · Next → [08 · Equal keys that collide](03d-equal-keys-that-collide.md)
