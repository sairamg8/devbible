---
title: "`t[0] += [x]` raises a TypeError and performs the mutation anyway, because augmented assignment is an operation followed by a store and only the store fails"
sidebar_label: "4b · Raises *and* mutates"
sidebar_position: 76
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Programming FAQ — "Why does a_tuple[i] += ['item'] raise an exception when the addition works?"](https://docs.python.org/3.14/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works),
> [§7.2.1 Augmented assignment](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html#frozen-instances),
> and [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType).
> Target: **CPython 3.14**.

**This is the single most famous corner of Python's assignment semantics, and
it is famous because it violates the assumption that a statement which raises
did nothing. `a_tuple[0] += ['item']` raises `TypeError: 'tuple' object does
not support item assignment` *and* leaves the list inside the tuple extended.
Both halves are correct behaviour: the in-place operation succeeded, and the
mandatory write-back to the tuple slot failed. Once you can explain this, you
understand augmented assignment completely.**

## The FAQ, verbatim

> ```python
> >>> a_tuple = (['foo'], 'bar')
> >>> a_tuple[0] += ['item']
> Traceback (most recent call last):
>   ...
> TypeError: 'tuple' object does not support item assignment
> ```
>
> *"The exception is a bit more surprising, and even more surprising is the
> fact that even though there was an error, the append worked:"*
>
> ```python
> >>> a_tuple[0]
> ['foo', 'item']
> ```

And the mechanism:

> *"Thus, in our tuple example what is happening is equivalent to:"*
>
> ```python
> >>> result = a_tuple[0].__iadd__(['item'])
> >>> a_tuple[0] = result
> Traceback (most recent call last):
>   ...
> TypeError: 'tuple' object does not support item assignment
> ```
>
> *"The `__iadd__()` succeeds, and thus the list is extended, but even though
> result points to the same object that `a_tuple[0]` already points to, that
> final assignment still results in an error, because tuples are immutable."*

## Why the store happens at all

Because the language says so. The reference defines augmented assignment as
performing the operation *"and assigns the result to the original target"*. It
does not special-case "the result is the object we started with"; there is no
`if new is old: skip the store`. The store is unconditional, and for a `list`
target it is a harmless no-op that rebinds a slot to the object already in it.
For a tuple slot it is `tuple.__setitem__`, which does not exist.

So the statement decomposes into three steps and fails on the third:

1. **Read** `a_tuple[0]` → the list.
2. **Operate** `list.__iadd__(['item'])` → the list is extended *now*, and
   returns itself.
3. **Store** `a_tuple[0] = <the list>` → `TypeError`.

Step 2 is not rolled back. Python has no transaction around a statement.

## The whole family, because it is not just tuples

Any target whose *read* yields a mutable object and whose *write* is refused
produces the same half-completed statement:

```python
# frozen dataclass
@dataclass(frozen=True)
class Config:
    hosts: list[str]

cfg = Config(hosts=["a"])
cfg.hosts += ["b"]        # FrozenInstanceError — and cfg.hosts is now ["a", "b"]

# namedtuple
Point = collections.namedtuple("Point", "tags")
p = Point(tags=[])
p.tags += ["x"]           # AttributeError — and p.tags is now ["x"]

# read-only mapping view
proxy = types.MappingProxyType({"hosts": ["a"]})
proxy["hosts"] += ["b"]   # TypeError: 'mappingproxy' object does not support item assignment
                          # — and the UNDERLYING dict's list is now ["a", "b"]

# a property with a getter and no setter
obj.items += [x]          # AttributeError: can't set attribute — items already mutated
```

The `MappingProxyType` case is the one that matters in practice, because
`MappingProxyType` is often reached for precisely to make a config
un-writable — and it stops the write it can see while the in-place extend of a
nested list sails straight past it. A read-only *view* is not a read-only
*object graph*; see
[Read-only views and boundary types](10b-read-only-views-and-boundaries.md).

## How to write what you meant

If you want the mutation, ask for it directly, with no store:

```python
a_tuple[0].append("item")      # no assignment statement at all — works, no exception
a_tuple[0].extend(["item"])    # identical
cfg.hosts.append("b")          # works on a frozen dataclass, because frozen is shallow
```

If you want the tuple to be genuinely immutable, do not put a list in it:

```python
a_tuple = (("foo",), "bar")            # tuple of tuples: nothing to mutate
cfg = Config(hosts=("a",))             # frozen dataclass holding a tuple
```

And if you want to "modify" it, build a new one:

```python
a_tuple = (a_tuple[0] + ["item"],) + a_tuple[1:]
cfg = dataclasses.replace(cfg, hosts=cfg.hosts + ("b",))
```

## The related non-atomicity

Even where nothing raises, augmented assignment is three steps, not one, and
nothing makes those steps atomic:

```python
counts[key] += 1      # LOAD, ADD, STORE — a second thread can interleave
```

Two threads incrementing the same key can both read the same old value and both
store `old + 1`, losing one increment. This is not new in 3.14, and the GIL
never protected it — the GIL guarantees bytecode-level atomicity for individual
operations, not for the read-modify-write pair the compiler emits here. The
free-threaded build makes the window wider. Use
`collections.Counter` under an explicit `threading.Lock`, or
`itertools.count`, or hand the work to a single owner thread or a queue.

## Gotchas

### A `TypeError` that also changed your data
**Symptom.** A traceback says the assignment failed, and the object was modified
anyway. Retry logic then double-applies it.
**Cause.** `__iadd__` mutated in place before the store was attempted; the store
failed and nothing was undone.
**Fix.** In an `except` handler around augmented assignment, never assume the
target is unchanged. Better: do not write augmented assignment against a target
you know is immutable — use `.append`/`.extend` when you mean mutation.

### `MappingProxyType` treated as "now nobody can change my config"
**Symptom.** A wrapped settings mapping is still mutated by a caller.
**Cause.** The proxy blocks writes to its own keys. It does not deep-freeze; a
`list` or `dict` *value* fetched through it is the original mutable object.
**Fix.** Make the values immutable too — tuples, frozensets, frozen
dataclasses, or nested `MappingProxyType`. A proxy over a flat mapping of
scalars is genuinely read-only; over a nested one it is theatre.

### A frozen dataclass that is not frozen
**Symptom.** `frozen=True` and the instance's list field keeps growing.
**Cause.** `frozen=True` installs `__setattr__`/`__delattr__` that raise
`FrozenInstanceError`. It does nothing about the objects the attributes refer
to. The docs are direct: *"It is not possible to create truly immutable Python
objects. However, by passing `frozen=True` to the `@dataclass` decorator you
can emulate immutability."*
**Fix.** Give frozen dataclasses immutable field types —
`tuple[str, ...]`, `frozenset[int]`, other frozen dataclasses — and convert in
`__post_init__` if callers pass lists.

### `counts[k] += 1` from two threads
**Symptom.** A counter that is consistently a little too low under
concurrency, and correct in every test.
**Cause.** Read-modify-write is three bytecodes; nothing makes them atomic.
**Fix.** A lock around the increment, a per-thread counter merged at the end,
or a single owner. Do not rely on the GIL.

### `p.tags += [x]` on a `NamedTuple` "works" in dev
**Symptom.** Code that mutates a namedtuple's list field is discovered only
when the `AttributeError` surfaces in a path that is exercised rarely.
**Cause.** The append half already happened, so the visible data is right and
only the exception is wrong-looking.
**Fix.** Same as above — make the field a tuple, and use `p._replace(...)` to
produce a modified copy.

## Interview questions

**★ Q: `t = (['a'], 'b'); t[0] += ['c']` — what happens?**
It raises `TypeError: 'tuple' object does not support item assignment`, **and**
`t[0]` is `['a', 'c']` afterwards. Augmented assignment calls
`list.__iadd__`, which extends the list in place and returns it, and then
unconditionally stores the result back into `t[0]` — which a tuple refuses.
The mutation is not rolled back.

**★ Q: Why does `t[0].append('c')` work on the same tuple?**
Because it is a method call, not an assignment statement. Nothing writes to the
tuple slot; the tuple still refers to the same list object, and only that list's
contents changed. A tuple guarantees which objects it holds, not what those
objects contain.

**★ Q: Does `frozen=True` on a dataclass make instances immutable?**
It makes *attribute rebinding* raise `FrozenInstanceError` — the docs say it
"emulates" immutability and note that truly immutable Python objects are not
possible. Any mutable object stored in a field remains fully mutable, so
`obj.items.append(x)` succeeds. Freeze deeply by choosing immutable field
types.

**Q: Why is the store performed even when `__iadd__` returned the same object?**
Because the language specifies that augmented assignment assigns the result to
the target, with no exemption for identity. CPython does not compare the result
to the original; the `STORE` is emitted unconditionally. For mutable targets it
is a harmless rebinding of a slot to the object already there.

**Q: How would you make a genuinely read-only configuration object?**
Convert the whole graph to immutable types at the boundary: `tuple` for
sequences, `frozenset` for sets, frozen dataclasses or `NamedTuple` for
records, and `MappingProxyType` only over mappings whose values are already
immutable. A single proxy at the top protects one level and nothing below it.

**Q: Is `counter[key] += 1` thread-safe?**
No. It compiles to a load, a binary in-place add and a store, and another
thread can run between any two of them, so concurrent increments can be lost.
The GIL serialises bytecode execution but does not make a multi-bytecode
read-modify-write atomic, and the free-threaded build removes even that
serialisation. Use a lock, per-thread accumulation, or a single owner.

**Q: You catch the `TypeError` from an augmented assignment and retry. What can
go wrong?**
The in-place half already ran, so the retry applies it a second time: a list
that should have gained one element gains two. Exception handling around
augmented assignment cannot assume the target is unchanged, which is a strong
argument for writing the explicit `.extend()` you actually mean.

---

← Prev: [Augmented assignment](04-augmented-assignment.md) · Index: [Assignment and aliasing](README.md) · Next → [Function arguments](05-function-arguments.md)
