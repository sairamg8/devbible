---
title: "Insertion order stopped being a CPython accident in 3.7 and became a promise of the language — the release note, the ruling that produced it, and the exact line between what is guaranteed and what is layout"
sidebar_label: "03 · Order is a guarantee"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [What's New in Python 3.7](https://docs.python.org/3.14/whatsnew/3.7.html), [What's New in Python 3.6 — *New dict implementation*](https://docs.python.org/3.14/whatsnew/3.6.html#new-dict-implementation), [Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions) — plus [PEP 468](https://peps.python.org/pep-0468/), [PEP 520](https://peps.python.org/pep-0520/) and the python-dev ruling of [15 Dec 2017](https://mail.python.org/pipermail/python-dev/2017-December/151283.html). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**"Dicts are ordered in 3.7+" is one of the few pieces of Python folklore that is exactly true, and knowing *why* it is true — that it was an implementation accident in 3.6 that the language deliberately promoted to a guarantee in 3.7 — is what lets you tell the parts you may depend on from the parts you may not. You may depend on iteration order. You may not depend on the compact layout, the memory saving, the load factor, or `set` behaving the same way. And even where order is guaranteed, `==` still ignores it.**

## Three releases, three different statuses

| Version | Status of dict ordering | Source |
|---|---|---|
| ≤ 3.5 | genuinely arbitrary; varies with the hash seed | *"older versions of the language where random iteration order is still in effect, e.g. Python 3.5"* |
| 3.6 | **ordered in CPython, but an implementation detail** | 3.6 release notes |
| 3.7+ | **guaranteed by the language** | 3.7 release notes; `stdtypes` versionchanged |

The 3.6 release notes are unusually explicit that this was *not* yet a promise, and they even say what it would take to make it one:

> *"The order-preserving aspect of this new implementation is considered an implementation detail and should not be relied upon (this may change in the future, but it is desired to have this new dict implementation in the language for a few releases before changing the language spec to mandate order-preserving semantics for all current and future Python implementations; this also helps preserve backwards-compatibility with older versions of the language where random iteration order is still in effect, e.g. Python 3.5)."*

One release later, the 3.7 notes deliver exactly that:

🔴 > *"the insertion-order preservation nature of `dict` objects has been declared to be an official part of the Python language spec."*

The word *"declared"* links to a specific python-dev message. Guido van Rossum, 15 December 2017, closing the thread *"Guarantee ordered dict literals in v3.7?"*:

> *"Make it so. "Dict keeps insertion order" is the ruling. Thanks!"*

And the type documentation carries it as a `versionchanged` on `dict` itself, which is the sentence to quote in a code review:

🔴 > *"Changed in version 3.7: Dictionary order is guaranteed to be insertion order. This behavior was an implementation detail of CPython from 3.6."*

Because it is a *language* guarantee rather than a CPython one, every conforming implementation must do it — that was the entire point of waiting a release before declaring it.

## What the guarantee says, precisely

Three sentences in `stdtypes`, and every one of them is load-bearing:

> *"Dictionaries preserve insertion order. Note that updating a key does not affect the order. Keys added after deletion are inserted at the end."*

So:

```python
d = {"one": 1, "two": 2, "three": 3, "four": 4}

d["one"] = 42          # UPDATE  -> 'one' keeps its original first position
del d["two"]           # DELETE  -> 'two' leaves
d["two"] = None        # RE-ADD  -> 'two' is now LAST, not second
```

The documentation's own example ends with `{'one': 42, 'three': 3, 'four': 4, 'two': None}`. Re-assigning a key that is already present is *not* a re-insert — it writes the value into the existing entry and leaves the position alone. Deleting and re-adding **is** a re-insert, and it appends.

That difference is what makes the LRU-style idiom work at all, and the `collections` documentation states it as the sanctioned emulation of `OrderedDict.move_to_end`:

> *"A regular `dict` can emulate OrderedDict's `od.move_to_end(k, last=True)` with `d[k] = d.pop(k)` which will move the key and its associated value to the rightmost (last) position."*

```python
def touch(cache: dict[str, Row], key: str) -> None:
    """Move an existing key to the most-recently-used end."""
    cache[key] = cache.pop(key)      # pop removes it; assignment re-appends
```

⚠️ There is no cheap opposite. The same documentation says so: *"A regular `dict` does not have an efficient equivalent for OrderedDict's `od.move_to_end(k, last=False)` which moves the key and its associated value to the leftmost (first) position."* If you need to move to the front, you need `OrderedDict`, and that is one of the few remaining reasons to reach for it.

## Order is guaranteed; equality still ignores it

This is the trap that survives the folklore, because "dicts are ordered now" makes people expect ordered comparison. The constructor documentation is unambiguous:

🔴 > *"Dictionaries compare equal if and only if they have the same `(key, value)` pairs (regardless of ordering). Order comparisons ('&lt;', '&lt;=', '>=', '>') raise `TypeError`."*

```python
a = {"x": 1, "y": 2}
b = {"y": 2, "x": 1}

a == b            # True  — same pairs, order irrelevant
list(a) == list(b)  # False — the key sequences differ
a < b             # TypeError: '<' not supported between instances of 'dict' and 'dict'
```

If you genuinely need order-sensitive equality, the `collections` docs give the one-liner rather than making you reach for `OrderedDict`:

> *"A regular `dict` can emulate the order sensitive equality test with `p == q and all(k1 == k2 for k1, k2 in zip(p, q))`."*

```python
def equal_including_order(p: dict, q: dict) -> bool:
    return p == q and all(k1 == k2 for k1, k2 in zip(p, q))
```

That works because the first clause already establishes the two dictionaries have the same key *set* and the same length, so a positional walk of the keys is a pure order comparison.

## The guarantee spreads: `**kwargs` and class bodies

Two other places in the language depend on the same property, and both were settled by PEPs one release *before* the dict guarantee itself.

**PEP 468 — `**kwargs` is an ordered mapping.** The PEP's abstract:

> *"The `**kwargs` syntax in a function definition indicates that the interpreter should collect all keyword arguments that do not correspond to other named parameters. However, Python does not preserved the order in which those collected keyword arguments were passed to the function. In some contexts the order matters. This PEP dictates that the collected keyword arguments be exposed in the function body as an ordered mapping."*

The language reference now says it directly, without naming `dict`:

> *"If the form "`**identifier`" is present, it is initialized to a new ordered mapping receiving any excess keyword arguments, defaulting to a new empty mapping of the same type."*

```python
def build_query(table: str, **filters: object) -> str:
    # 'filters' preserves the caller's keyword order — guaranteed since 3.6 (PEP 468)
    where = " AND ".join(f"{col} = %s" for col in filters)
    return f"SELECT * FROM {table} WHERE {where}"

build_query("orders", tenant="acme", status="open")
# -> "SELECT * FROM orders WHERE tenant = %s AND status = %s", in that order
```

Note the PEP's own careful hedge, written before the dict ruling existed: *"Note that this does not necessarily mean OrderedDict. dict in CPython 3.6 is now ordered, similar to PyPy."*

**PEP 520 — class bodies.** The class namespace is a mapping too, and once it became ordered the PEP's own machinery became unnecessary. Its note, added after the fact, is the cleanest one-line summary of how far the compact dict reached:

> *"Note: Since compact dict has landed in 3.6, `__definition_order__` has been removed. `cls.__dict__` now mostly accomplishes the same thing instead."*

That is why `dataclasses` can generate `__init__` with fields in source order, and why an ORM can map columns in declaration order, without either of them keeping a side-table.

## Where the guarantee stops

🔴 **`set` is not covered.** The order ruling was about `dict`. The data model's hash-randomisation note says the opposite for sets, in as many words:

> *"Changing hash values affects the iteration order of sets. Python has never made guarantees about this ordering (and it typically varies between 32-bit and 64-bit builds)."*

So `list({"b", "a"})` is not reproducible across processes, while `list({"b": 1, "a": 2})` is. A test that sorts one and not the other is a test that fails on someone else's machine.

**The layout is not covered.** The compact representation, the *"between 20% and 25% smaller"* memory figure, the index array, the split/combined distinction — all of that is the *mechanism* the 3.6 notes described, and the 3.6 notes are also the place that told you not to rely on it. The 3.7 declaration promoted **observable insertion order**, nothing else.

**`OrderedDict` is not obsolete.** The `collections` documentation says it has *"become less important"*, not irrelevant, and lists what still differs — order-sensitive equality, `move_to_end`, `popitem(last=False)`, and a design tuned for reordering rather than for lookup:

> *"The regular `dict` was designed to be very good at mapping operations. Tracking insertion order was secondary."* … *"The `OrderedDict` was designed to be good at reordering operations. Space efficiency, iteration speed, and the performance of update operations were secondary."*

## Gotchas

**★ Symptom: two dictionaries built in different key orders compare equal, and a "config drift" check never fires.** Cause: `==` on dicts is *"if and only if they have the same (key, value) pairs (regardless of ordering)"* — order is guaranteed for *iteration*, never for *comparison*. Fix: compare the key sequences explicitly when order is part of what you are asserting.

```python
# does not detect reordering
assert loaded_config == expected_config

# detects it
assert loaded_config == expected_config and list(loaded_config) == list(expected_config)
```

**★ Symptom: an LRU cache built on `dict` never evicts the right entry — the "oldest" key keeps changing.** Cause: re-assigning an existing key does not move it. *"Note that updating a key does not affect the order."* Reading a value certainly does not either. Fix: pop and re-insert on every access, which is the documented `move_to_end(last=True)` emulation.

```python
def get(cache: dict[str, Row], key: str) -> Row | None:
    if key not in cache:
        return None
    value = cache.pop(key)      # remove
    cache[key] = value          # re-append: now most-recently-used
    return value
```

**★ Symptom: a test asserting on iteration order passes locally and fails in CI on another machine.** Cause: the collection under test is a `set`, or a `dict` built by iterating a set — and *"Python has never made guarantees about this ordering (and it typically varies between 32-bit and 64-bit builds)."* Fix: sort at the boundary where the set becomes a sequence.

```python
# unstable: set order leaks into the dict's insertion order
index = {tag: load(tag) for tag in tag_set}

# stable everywhere
index = {tag: load(tag) for tag in sorted(tag_set)}
```

**Symptom: code written for a library that still supports Python 3.6 relies on dict order and a reviewer objects.** Cause: on 3.6 the behaviour is real but explicitly *"an implementation detail of CPython"* — the promise starts at 3.7, and a non-CPython 3.6 runtime is free to differ. Fix: if the floor is 3.7 or newer, cite the `versionchanged` and move on; if it genuinely includes 3.6, use `OrderedDict` and say why in a comment.

```python
# requires-python = ">=3.7" in pyproject.toml is the actual fix; the guarantee
# is documented at stdtypes: "Changed in version 3.7: Dictionary order is
# guaranteed to be insertion order."
```

**Symptom: a colleague "optimises" a `dict` back to `OrderedDict` for an ordering-sensitive routine.** Cause: assuming the guarantee is weaker than it is. Fix: keep the `dict` unless you specifically need order-sensitive `==`, `move_to_end`, or `popitem(last=False)` — the `collections` docs list exactly those, and nothing else.

**Symptom: `**kwargs` order is relied on and a reviewer calls it undefined behaviour.** Cause: the reviewer is remembering pre-3.6 Python. Fix: cite PEP 468 and the language reference — *"it is initialized to a new ordered mapping receiving any excess keyword arguments"* — and keep the code.

**Symptom: JSON round-tripping reorders keys and a signature check fails.** Cause: the dict's order survived fine; `json.dumps` was called with `sort_keys=True` somewhere, or the two sides disagree about it. `sort_keys` defaults to `False`, so a plain dump preserves insertion order. Fix: make the choice explicit and identical on both sides, and sign the canonical form.

```python
import hmac
import json

canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
signature = hmac.new(secret, canonical.encode(), "sha256").hexdigest()
```

## Interview questions

**★ Are Python dictionaries ordered? Answer as precisely as you can.**
Since 3.7, yes, and it is a guarantee of the *language*, not of CPython: the 3.7 release notes say *"the insertion-order preservation nature of dict objects has been declared to be an official part of the Python language spec"*, and `stdtypes` carries *"Changed in version 3.7: Dictionary order is guaranteed to be insertion order. This behavior was an implementation detail of CPython from 3.6."* In 3.6 the behaviour existed but the release notes explicitly said it *"should not be relied upon"*. Before 3.6 iteration order was arbitrary and varied with the hash seed. The guarantee covers iteration order only — not the compact layout, not `set`, and not equality.

**★ Why did they wait a whole release between shipping the behaviour and promising it?**
Because a language guarantee binds every implementation, not just CPython. The 3.6 notes said so at the time: they wanted *"this new dict implementation in the language for a few releases before changing the language spec to mandate order-preserving semantics for all current and future Python implementations."* The delay gave PyPy, Jython and anyone else a window, and gave CPython a chance to discover that the compact layout was a mistake before it became irreversible. It was not, and Guido closed the thread in December 2017 with *"Make it so. "Dict keeps insertion order" is the ruling."*

**★ `d[k] = v` on a key that already exists — where does the key end up in iteration order?**
Exactly where it already was. *"Note that updating a key does not affect the order."* The assignment writes into the existing entry. To move a key to the end you have to remove it first, which is why the documented `move_to_end` emulation is `d[k] = d.pop(k)` and not just `d[k] = d[k]`. Delete-then-reinsert appends: *"Keys added after deletion are inserted at the end."*

**★ If dicts are ordered, why does `{"a": 1, "b": 2} == {"b": 2, "a": 1}` return True?**
Because ordering and equality are separate decisions and the documentation only changed one of them. `dict.__eq__` is defined as *"equal if and only if they have the same (key, value) pairs (regardless of ordering)"*, and that predates and survives the ordering guarantee — changing it would have broken essentially every program in existence. If you want order-sensitive comparison the `collections` documentation gives the idiom: `p == q and all(k1 == k2 for k1, k2 in zip(p, q))`.

**Does the ordering guarantee extend to `set`?**
No, and it is the most common place people over-generalise. The data model note on hash randomisation says *"Changing hash values affects the iteration order of sets. Python has never made guarantees about this ordering (and it typically varies between 32-bit and 64-bit builds)."* Sets are the same hash table without the ordered-entries requirement. A practical consequence: `{**a, **b}` and dict comprehensions built by iterating a set inherit the set's unspecified order.

**What is `OrderedDict` still for?**
Four things the `collections` documentation names: order-sensitive `==`; `move_to_end`, including the cheap move-to-*front* that `dict` has no efficient equivalent for; `popitem(last=False)`; and a data structure explicitly *"designed to be good at reordering operations"* where `dict` treats order tracking as secondary. For "I want to iterate in insertion order", a plain `dict` is correct and the docs say `OrderedDict` has *"become less important"*.

**What does the ordering guarantee have to do with `dataclasses` and ORMs?**
Class bodies execute into a namespace mapping, and once that mapping preserved order, the definition order of attributes became observable through `cls.__dict__` for free. PEP 520's own note records the consequence: *"Since compact dict has landed in 3.6, `__definition_order__` has been removed. `cls.__dict__` now mostly accomplishes the same thing instead."* That is why a `@dataclass` can generate `__init__` with parameters in the order you wrote the fields, without any extra bookkeeping.

---

← [02 · What O(1) does not promise](01b-what-o1-does-not-promise.md) · [Topic index](README.md) · Next → [04 · Working with the order](02b-working-with-the-order.md)
