---
title: "The loop that dies with 'dictionary changed size during iteration' usually has no del in it — the mutation is inside a handler, a defaultdict read, a cached_property, an import, or another thread"
sidebar_label: "15 · The mutations you did not write"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [`sys.modules`](https://docs.python.org/3.14/library/sys.html#sys.modules), [`functools.cached_property`](https://docs.python.org/3.14/library/functools.html#functools.cached_property), [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#defaultdict-objects). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**[14 · Mutating while iterating](05b-mutating-while-iterating.md) is the mechanism: an iterator over a live table, a size check on every step. This page is where that mechanism actually bites. A loop whose body visibly deletes a key gets caught in review. A loop whose body calls a function that — three frames down — registers a handler, reads a missing `defaultdict` key, caches a property into `__dict__`, or triggers an import, gets shipped. The error arrives in production with a traceback that points at the `for` line and nothing inside it. The fix never changes: snapshot what you iterate.**

## The mutations you did not write

The loops that fail in production are rarely the ones with a `del` in the body. They are the ones where the body calls something that mutates the same dictionary.

**Observers that unsubscribe themselves.** A dispatcher walks its handler table; one handler, on receiving the event, unregisters itself:

```python
from collections.abc import Callable


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[Event], None]] = {}

    def subscribe(self, name: str, handler: Callable[[Event], None]) -> None:
        self._handlers[name] = handler

    def unsubscribe(self, name: str) -> None:
        self._handlers.pop(name, None)

    def publish(self, event: Event) -> None:
        for handler in list(self._handlers.values()):     # snapshot: handlers may unsubscribe
            handler(event)
```

Without the `list(...)`, the first one-shot handler kills the loop for every handler after it. The mirror image is a handler that *subscribes* a follow-up handler while handling — an insertion, same failure.

**`defaultdict` reads.** Indexing a `defaultdict` with a missing key *inserts* it — `__missing__` fires on `d[k]` and nowhere else — so a read inside a loop over the same `defaultdict` is an insertion:

```python
from collections import defaultdict

totals: defaultdict[str, int] = defaultdict(int)
# ... populated ...
for key in totals:
    ratio = totals[key] / totals[key + ":baseline"]   # inserts ":baseline" keys -> RuntimeError
```

Read with `.get()`, which never calls the factory, or snapshot the keys first.

**Lazy pipelines.** A generator expression over a dict holds a live iterator until it is consumed:

```python
stale = (key for key, entry in cache.items() if entry.expired())
cache["fresh"] = build()          # mutation before consumption
for key in stale:                  # RuntimeError on the first step
    del cache[key]
```

Materialise with `list(...)` at the point where the answer should be fixed.

**Other threads.** A second thread writing to a shared dictionary mutates it under your loop just as surely as the loop body could. That is [25 · `dict` across threads](10-dict-across-threads.md).

## The namespaces that are dictionaries

Several things in Python that do not look like dictionaries *are* dictionaries, and they are mutated as a side effect of ordinary code.

**An instance's `__dict__`, and `cached_property`.** `vars(obj)` returns the instance's attribute dictionary itself, not a copy. `functools.cached_property` writes into that dictionary the first time the property is read — the documentation describes it as writing *"to the attribute with the same name"*, and adds that it *"requires that the `__dict__` attribute on each instance be a mutable mapping"*. So a serialiser that walks `vars(self)` and, for each attribute, calls a method that touches a not-yet-cached property adds a key to the dictionary it is iterating:

```python
from functools import cached_property


class Report:
    def __init__(self, rows: list[Row]) -> None:
        self.rows = rows
        self.title = "Quarterly"

    @cached_property
    def total(self) -> int:
        return sum(row.amount for row in self.rows)

    def describe(self, name: str) -> str:
        return f"{name} (of {self.total})"          # first call caches 'total' into __dict__

    def to_dict(self) -> dict[str, object]:
        # BROKEN: the first describe() call inserts 'total' into vars(self)
        # return {name: self.describe(name) for name in vars(self)}

        return {name: self.describe(name) for name in list(vars(self))}
```

**`sys.modules`.** The module registry is a plain dict, and importing adds to it. The `sys` documentation says so in as many words, and prescribes the fix:

> *"If you want to iterate over this global dictionary always use `sys.modules.copy()` or `tuple(sys.modules)` to avoid exceptions as its size may change during iteration as a side effect of code or activity in other threads."*

Anything that walks loaded modules — a plugin scanner, a leak detector, a "which version of X is loaded" diagnostic — and touches an attribute that triggers a lazy import will hit it:

```python
import sys

def loaded_versions() -> dict[str, str]:
    versions = {}
    for name, module in sys.modules.copy().items():       # the documented shape
        version = getattr(module, "__version__", None)     # may import a submodule
        if isinstance(version, str):
            versions[name] = version
    return versions
```

**`globals()` and module `__dict__`s.** `globals()` returns the module's namespace dictionary. A loop over it that defines a function, imports a name or assigns a module-level variable is inserting into the dictionary it walks. Snapshot with `list(globals().items())`.

**`os.environ`.** It is a mapping over the process environment; code under a loop that sets or unsets a variable — directly, or inside a library that "helpfully" configures itself — changes the size. Iterate `dict(os.environ)` if the loop body calls anything you did not write.

## Recursion over a shared structure

A walker that recurses into child nodes and, at some node, *registers* something in a shared index is mutating that index mid-walk if any outer frame is iterating it:

```python
def index_tree(node: Node, index: dict[str, Node]) -> None:
    for child_id, child in list(index.items()):        # outer frames iterate `index` too
        if child.parent_id == node.id:
            index[f"{node.id}/{child_id}"] = child      # an inner frame inserts
            index_tree(child, index)
```

The snapshot at the top of each frame is what makes it safe; without it the innermost insertion kills every enclosing loop at its next step. The cleaner version separates the two concerns entirely — walk a read-only structure, write into a *different* dictionary, and merge at the end.

## Gotchas

**★ Symptom: an event bus stops delivering to later handlers after the first one-shot handler fires.** Cause: the handler unsubscribed itself — a deletion from the dict being iterated — and the loop died with `RuntimeError`, often swallowed by a broad `except` in the dispatcher. Fix: publish over a snapshot of the handlers.

```python
for handler in list(self._handlers.values()):
    handler(event)
```

**★ Symptom: a loop over a `defaultdict` raises `RuntimeError` even though its body only reads.** Cause: `dd[missing]` calls `__missing__`, which inserts. Fix: read with `get`, which never invokes the factory.

```python
for key in totals:
    baseline = totals.get(key + ":baseline", 0)
```

**Symptom: a generator over `d.items()` raises on its first `next()`.** Cause: it was created, then the dict was mutated, then it was consumed — the generator's iterator saw the mutation. Fix: materialise at the moment the answer should be fixed.

```python
stale = [key for key, entry in cache.items() if entry.expired()]
```

**★ Symptom: a plugin scanner or diagnostics endpoint intermittently raises `dictionary changed size during iteration` on `sys.modules`.** Cause: something reached from the loop body imported a module, which inserts into `sys.modules`; the `sys` docs name *"a side effect of code or activity in other threads"*. Fix: the documented shape.

```python
for name, module in sys.modules.copy().items():
    inspect_module(name, module)
```

**★ Symptom: `to_dict()` over `vars(self)` fails only on the first call for each instance.** Cause: a `cached_property` read during the walk wrote its value into the instance `__dict__` — the very dictionary `vars(self)` returned. The second call succeeds because the key already exists. Fix: snapshot the attribute names.

```python
return {name: self.describe(name) for name in list(vars(self))}
```

**Symptom: a handler that subscribes a follow-up handler breaks dispatch for everyone after it.** Cause: an insertion into the handler table mid-iteration — the mirror image of self-unsubscription. Fix: the same snapshot, and decide explicitly whether a handler added during dispatch should see the *current* event (it will not, with a snapshot — which is usually the right answer).

```python
for handler in list(self._handlers.values()):   # handlers added now fire from the next event
    handler(event)
```

**Symptom: a function that loops over `globals()` to register decorated functions fails when it defines a helper.** Cause: `globals()` is the live module namespace; defining or importing anything inside the loop inserts into it. Fix: snapshot.

```python
for name, obj in list(globals().items()):
    if getattr(obj, "_is_route", False):
        register(name, obj)
```

**Symptom: a recursive tree walk dies in an outer frame when an inner frame registers a node.** Cause: the outer frame is still iterating the index the inner frame inserted into. Fix: snapshot at each frame, or write into a separate result dictionary and merge once at the end.

```python
def collect(node: Node, index: dict[str, Node], found: dict[str, Node]) -> None:
    for child_id, child in index.items():          # `index` is never written during the walk
        if child.parent_id == node.id:
            found[f"{node.id}/{child_id}"] = child
            collect(child, index, found)

found: dict[str, Node] = {}
collect(root, index, found)
index |= found
```

**Symptom: the traceback points at the `for` line and nothing in the loop body looks wrong.** Cause: the iterator's check runs at the *start* of each step, so the error is always reported at the `for`, never at the line that mutated. Fix: search the call graph of the body for anything that writes to the same object — handlers, `defaultdict` indexing, `cached_property`, imports, `setattr` on objects whose `__dict__` you are walking — and snapshot instead of hunting.

```python
for key, value in list(shared.items()):     # cheapest way to prove the body is the culprit
    handle(key, value)
```

## Interview questions

**★ How can a loop whose body contains no `del` and no assignment still raise this error?**
When something it calls mutates the same dictionary. The classic cases are a handler that unsubscribes itself from the registry being iterated, a `defaultdict` read that inserts via `__missing__`, a lazily-consumed generator created before a mutation, a callback or `__del__` that touches a shared cache, and another thread writing to the same object. In every case the fix is the same snapshot — `list(d)` or `list(d.values())` — taken at the point where the loop starts.

**★ Why does iterating `sys.modules` need a copy?**
Because it is an ordinary dictionary that the import system inserts into, and importing can happen as a side effect of almost anything — attribute access on a lazily-loading package, a function that imports inside its body, another thread. The `sys` documentation is explicit: *"If you want to iterate over this global dictionary always use `sys.modules.copy()` or `tuple(sys.modules)` to avoid exceptions as its size may change during iteration as a side effect of code or activity in other threads."* It is one of the few places the standard library documents the snapshot rule for a specific dictionary.

**Why does walking `vars(obj)` interact badly with `functools.cached_property`?**
`vars(obj)` hands back the instance's real `__dict__`, and `cached_property` stores its computed value by writing *"to the attribute with the same name"* — into that same dictionary. So the first read of a cached property during the walk inserts a key into the dictionary being iterated. The symptom is distinctive: it fails once per instance and then never again, because after the first call the key already exists and the read is a lookup, not an insertion.

**Why is the error always reported at the `for` line?**
Because the iterator checks the size at the start of each step, not at the moment of mutation — the dictionary does not know it is being iterated and cannot complain when it is modified. The mutation completes normally; the next call to the iterator's `__next__` discovers the discrepancy. That is why the traceback is uninformative about the cause, and why the practical diagnosis is to snapshot the iteration and see whether the error goes away rather than to hunt for the mutating line.

**When a handler subscribes a new handler during dispatch, should the new one receive the current event?**
That is a design decision the dictionary cannot make for you, and a snapshot makes it for you implicitly: iterating `list(handlers.values())` means handlers added during dispatch fire from the next event onward. That is almost always the intended semantics — it matches what a browser or a GUI toolkit does — and it avoids unbounded dispatch when handlers keep adding handlers. If you genuinely need "including ones added during this dispatch", that is a work queue, not a dictionary iteration.

**Which everyday objects are live dictionaries that ordinary code mutates as a side effect?**
An instance's `__dict__` (returned as-is by `vars(obj)`, and written by `setattr` and by `functools.cached_property`), a module's namespace (returned by `globals()`, written by every `def`, `import` and module-level assignment), `sys.modules` (written by every import), and `os.environ` (a mapping over the process environment that libraries sometimes configure). Iterating any of them while calling code you did not write is iterating a dictionary that code may grow. Snapshot first: `list(vars(obj))`, `list(globals().items())`, `sys.modules.copy()`, `dict(os.environ)`.

---

← [14 · Mutating while iterating](05b-mutating-while-iterating.md) · [Topic index](README.md) · Next → [16 · Set operations on views](05d-set-operations-on-views.md)
