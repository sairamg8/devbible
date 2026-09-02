---
title: "`MappingProxyType` is a live read-only view, not a frozen snapshot, and confusing a view with a copy is its own family of aliasing bug"
sidebar_label: "10b · Read-only views and boundaries"
sidebar_position: 91
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType),
> [`vars()`](https://docs.python.org/3.14/library/functions.html#vars),
> [Built-in Types — dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dict-views),
> [`memoryview`](https://docs.python.org/3.14/library/stdtypes.html#memoryview),
> and [PEP 416 — Add a frozendict builtin type (Rejected)](https://peps.python.org/pep-0416/).
> Target: **CPython 3.14**.

**Python has no `frozendict`, deliberately. What it has is
`types.MappingProxyType`, and the documentation's first two sentences say
exactly what it is and what it is not: *"Read-only proxy of a mapping. It
provides a dynamic view on the mapping's entries, which means that when the
mapping changes, the view reflects these changes."* Read-only for the holder of
the proxy; fully live with respect to the underlying dict. Handing someone a
proxy stops them writing and does not stop you — which is sometimes exactly
right and sometimes the bug.**

## The proxy, in full

```python
import types

_settings = {"timeout": 30, "retries": 3}
SETTINGS = types.MappingProxyType(_settings)

SETTINGS["timeout"]          # 30
SETTINGS["timeout"] = 60     # TypeError — no __setitem__
del SETTINGS["timeout"]      # TypeError
SETTINGS.update({})          # AttributeError — no such method

_settings["timeout"] = 60    # allowed — and SETTINGS now reports 60
```

Supported operations, per the docs: `key in proxy`, `proxy[key]`,
`iter(proxy)`, `len(proxy)`, `copy()`, `get()`, `items()`, `keys()`,
`values()`, `reversed(proxy)` (3.9) and `hash(proxy)` (3.12). Plus the `|`
operator since 3.9, which *"simply delegates to the underlying mapping"* and
therefore returns a new dict rather than mutating.

Two entries deserve attention:

> **`copy()`** — *"Return a shallow copy of the underlying mapping."*

That is the escape hatch: anyone holding the proxy can call `.copy()` and get a
real, mutable `dict`. This is not a leak — it is a copy, and mutating it does
nothing to the original — but it does mean the proxy is a write barrier, not a
secrecy mechanism.

> **`hash(proxy)`** *(3.12)* — *"Return a hash of the underlying mapping."*

Which means a proxy over a plain `dict` is still unhashable, because the dict
is. The addition only helps when the underlying mapping is itself hashable.

## Why there is no `frozendict`

PEP 416 proposed one and was rejected. Guido's reasons, quoted in the PEP,
include *"Multiple threads can agree by convention not to mutate a shared dict,
there's no great need for enforcement"* and *"There are existing idioms for
avoiding mutable default values"* — and the conclusion that produced the tool
we actually have:

> *"exposing the existing read-only dict proxy as a built-in type sounds good
> to me."*

`MappingProxyType` was added to `types` in 3.3 as a direct result. Knowing this
history is useful because it tells you what the proxy was designed for: it is
the type CPython already used internally for class `__dict__`, exposed. The
`vars()` documentation makes that visible:

> *"Objects such as modules and instances have an updateable `__dict__`
> attribute; however, other objects may have write restrictions on their
> `__dict__` attributes (for example, classes use a `types.MappingProxyType` to
> prevent direct dictionary updates)."*

## View versus copy — the distinction that matters

| | Reflects later changes to the source | Can be mutated by its holder |
|---|---|---|
| `MappingProxyType(d)` | **yes** | no |
| `dict(d)` / `d.copy()` | no | yes |
| `d.keys()` / `.values()` / `.items()` | **yes** | no (but the source can be) |
| `memoryview(buf)` | **yes** | only if the source is mutable |
| `list(d)` | no | yes |
| a list slice `xs[1:3]` | no — it is a copy | yes |
| a NumPy basic slice `arr[1:3]` | **yes** — it is a view | yes, and writes hit the original |

The last two rows are the cross-language trap. In pure Python, slicing a list
*copies*; in NumPy, basic slicing returns a **view** onto the same buffer, so
`arr[1:3] += 1` modifies the original array. Code that moves between the two
mental models writes `sub = arr[1:3]; sub[:] = 0` expecting a scratch copy and
silently edits the caller's data. NumPy's own documentation covers this under
"Copies and views"; the fix there is an explicit `.copy()`.

For pandas the answer has changed across major versions (Copy-on-Write became
the model in the 3.x line), so I am not going to state a rule here — check the
behaviour for the version you are pinned to, and treat any chained assignment
as suspect regardless.

## Dict views are live, and that is usually what you want

```python
d = {"a": 1}
ks = d.keys()
d["b"] = 2
list(ks)               # ['a', 'b'] — the view saw the insertion

for k in d:            # RuntimeError if you mutate d during iteration
    ...
for k in list(d):      # safe — the list is a snapshot
    del d[k]
```

`keys()` and `items()` also behave as set-like objects, so
`d1.keys() & d2.keys()` is a genuinely useful intersection. What they are not
is a snapshot: if you need one, materialise it with `list(...)` or `set(...)`.

## Building a read-only sequence

There is no `MappingProxyType` for sequences. The options:

```python
# 1 — convert (a copy, and the usual right answer)
def lines(self) -> tuple[Line, ...]:
    return tuple(self._lines)

# 2 — a live read-only view, hand-rolled from the Sequence ABC
class ReadOnlyList(Sequence):
    def __init__(self, data): self._data = data
    def __getitem__(self, i):  return self._data[i]
    def __len__(self):         return len(self._data)

# 3 — an iterator (one-shot, and the caller cannot index or re-read)
def lines(self):
    return iter(self._lines)
```

Option 1 is right almost always: it costs one allocation, it is a snapshot, and
`tuple` is a type everyone already understands. Option 2 is for large
collections where copying is the real cost — note it inherits `Sequence`'s
mixins (`__contains__`, `__iter__`, `index`, `count`) for free, and note that
its elements are still shared.

## `memoryview`, for the buffer case

`memoryview(buf)` is the zero-copy view over a bytes-like object: slicing a
`memoryview` returns another view rather than copying, which is how you parse a
large frame without allocating per field. It is read-only over `bytes` and
writable over `bytearray`, and `.toreadonly()` (3.8+) gives you a read-only
view over a writable buffer — the closest thing Python has to `const` on a
buffer. The cost is that a live view pins the buffer: the underlying
`bytearray` cannot be resized while any view exists. See
[bytes vs str](../04-bytes-and-encoding/README.md).

## Gotchas

### A `MappingProxyType` treated as a snapshot
**Symptom.** A "frozen" config handed to a module reports values that changed
later.
**Cause.** The proxy is documented as *"a dynamic view on the mapping's
entries"* — it reflects every change to the underlying dict.
**Fix.** If you want a snapshot, `dict(source)` (or
`MappingProxyType(dict(source))` for a frozen snapshot). If you want a live
read-only view, the proxy is already correct.

### A proxy over a dict with mutable values
**Symptom.** The proxy blocks writes and callers still change the config.
**Cause.** The proxy protects the mapping, not the values.
`proxy["hosts"].append(x)` reaches the underlying list, and
`proxy["hosts"] += [x]` even raises *after* mutating — see
[Raises *and* mutates](04b-tuple-item-raises-and-mutates.md).
**Fix.** Make the values immutable: tuples, frozensets, nested proxies, frozen
dataclasses.

### `proxy.copy()` used as if it were still protected
**Symptom.** Code takes `SETTINGS.copy()` and mutates it, then wonders why other
readers do not see the change (or, elsewhere, why they do).
**Cause.** `copy()` returns *"a shallow copy of the underlying mapping"* — a
real, mutable dict, with the original's values still shared.
**Fix.** Be explicit about which you wanted. `dict(proxy)` is the same thing
spelled more obviously.

### `RuntimeError: dictionary changed size during iteration`
**Symptom.** A loop deleting keys blows up part-way through.
**Cause.** `for k in d` iterates a live view.
**Fix.** `for k in list(d):` — materialise the keys first.

### A NumPy slice edited as if it were a copy
**Symptom.** A function "works on a slice" and the caller's array changes.
**Cause.** NumPy basic slicing returns a view over the same buffer, unlike
Python list slicing, which copies.
**Fix.** `arr[1:3].copy()` when you want independent data, and read the
function's docs for whether it returns a view or a copy.

### A read-only wrapper that leaks through iteration
**Symptom.** A custom `ReadOnlyList` is handed out and its elements are
mutated.
**Cause.** The wrapper controls the container, not the contents — the same
one-level rule as everything else in this topic.
**Fix.** Immutable elements, or accept that the wrapper is a write barrier on
the sequence only, and say so.

### A `memoryview` kept alive across a resize
**Symptom.** `BufferError: Existing exports of data: object cannot be re-sized`.
**Cause.** A live `memoryview` pins the underlying `bytearray`.
**Fix.** `release()` the view (or use a `with` block) before resizing.

## Interview questions

**★ Q: What is `types.MappingProxyType`?**
A read-only proxy over a mapping. The docs describe it as *"a dynamic view on
the mapping's entries, which means that when the mapping changes, the view
reflects these changes."* Holders of the proxy cannot write; whoever holds the
underlying dict still can. It is the type CPython uses for class `__dict__`,
exposed in `types` since 3.3.

**★ Q: Is a `MappingProxyType` a copy?**
No — that is the single most important thing about it. It is a live view. For a
snapshot you need `dict(source)`; for a frozen snapshot,
`MappingProxyType(dict(source))`, which copies once and then blocks writes to
the copy.

**★ Q: Why doesn't Python have a `frozendict`?**
PEP 416 proposed one and Guido rejected it, citing low real-world use, existing
idioms for the problems it targeted, and that *"Multiple threads can agree by
convention not to mutate a shared dict, there's no great need for
enforcement."* He suggested exposing the existing read-only dict proxy instead,
which is how `types.MappingProxyType` came to be public in 3.3.

**Q: Is `d.keys()` a copy of the keys?**
No, it is a view: it reflects insertions and deletions made after you obtained
it, and it is set-like, so `d1.keys() & d2.keys()` works. Iterating it while
mutating the dict raises `RuntimeError`. `list(d.keys())` is the snapshot.

**Q: How do you expose an internal list read-only?**
`tuple(self._items)` is the practical answer — one allocation, a snapshot, and
a type every caller understands. For very large collections, wrap it in a small
`collections.abc.Sequence` subclass that forwards `__getitem__` and `__len__`,
which gives you a live view for the cost of writing two methods. Neither
protects the elements.

**Q: How does list slicing differ from NumPy slicing?**
A Python list slice is a shallow *copy*: a new list holding the same element
objects. A NumPy basic slice is a *view* onto the same buffer, so writing
through it modifies the original array. Code that assumes the Python semantics
while working with arrays silently corrupts the caller's data; the fix is an
explicit `.copy()`.

**Q: What is `memoryview` for, and what does it cost?**
Zero-copy access to another object's buffer, so a large frame can be parsed
without allocating per field, and slices of the view are further views rather
than copies. It costs you the ability to resize the underlying object while a
view is live — an attempted resize raises `BufferError` — so views should be
released promptly.

---

← Prev: [Designing away aliasing](10-designing-away-aliasing.md) · Index: [Assignment and aliasing](README.md) · Next → [Where it bites in real code](11-where-it-bites.md)
