---
title: "The memo is a public parameter with a private layout: because deepcopy asks it for id(x) before copying anything, you can pre-seed it to keep an object shared, to substitute a replacement, to drop a reference — or reuse it across calls to keep two copies consistent, and get stale copies if you reuse it too long"
sidebar_label: "02b · The memo as an API"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copy` documentation](https://docs.python.org/3.14/library/copy.html) and [`Lib/copy.py` at v3.14.7](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**. The documentation calls the memo *"an opaque object"*; every technique below relies on the source's convention that the memo maps `id(original)` to its copy, and the page says which claims are documented and which are read from the code.

**The signature `deepcopy(obj[, memo])` makes the memo dictionary a public parameter, and the implementation reads it before it copies anything: if `id(x)` is a key, the value is returned. That is enough to build four tools the documentation never names. Seed the memo with `id(resource): resource` and the resource stays shared. Seed it with `id(old): new` and every reference to the old object in the copy becomes the new one. Seed it with `None` and the reference is dropped. Pass one memo to two calls and the two copies keep sharing what the originals shared. The price is that the layout is a convention rather than a promise, so each tool wants a test, and a memo kept too long returns copies of a structure that has since changed.**

## What the documentation promises and what the source does

The documented contract is small. `deepcopy` takes an optional `memo`; a `__deepcopy__` hook receives one, and the hook must pass it on:

> *"If the `__deepcopy__` implementation needs to make a deep copy of a component, it should call the deepcopy() function with the component as first argument and the memo dictionary as second argument. The memo dictionary should be treated as an opaque object."*

That sentence covers passing the memo *along*. It does not describe writing to it, and it does not describe passing your own. What makes both work is visible in `deepcopy` ([02](02-deepcopy-the-algorithm.md)): `y = memo.get(id(x), _nil)`, and a hit is returned without copying — and it is the same convention that `__deepcopy__` implementations follow when they write `memo[id(self)] = new`. Phase 1 introduced [pre-seeding to keep a session shared](../../phase-1-language-core/07-assignment-and-aliasing/08b-deepcopy.md); this chunk covers the rest of the API and the ways it goes wrong. Wrap the convention in one helper so a change touches one place:

```python
import copy


def deepcopy_with(obj, keep=(), replace=()):
    """Deep-copy obj.

    Objects in keep stay shared with the original.
    Each (original, substitute) pair in replace is swapped in wherever
    original is referenced inside the copy.
    """
    memo = {id(item): item for item in keep}
    for original, substitute in replace:
        memo[id(original)] = substitute
    return copy.deepcopy(obj, memo)
```

## Tool 1 — keep resources shared

```python
import copy
from dataclasses import dataclass, field


@dataclass
class Session:
    dsn: str


@dataclass
class Order:
    order_id: str
    session: Session
    lines: list = field(default_factory=list)


session = Session("postgresql://reports")
order = Order("A-100", session, ["pen", "ink"])

draft = deepcopy_with(order, keep=[session])

assert draft.session is session               # shared: never entered
assert draft.lines is not order.lines         # copied
assert draft.lines == order.lines
```

When `deepcopy` reaches `order.session` it finds `id(session)` in the memo and returns the value. The session's own attributes are never visited, so anything the session holds — a socket, a lock — is never copied either.

## Tool 2 — substitute while copying

The memo maps an identity to whatever you like; the value is returned as-is, not copied:

```python
replacement = Session("postgresql://scratch")
scratch = deepcopy_with(order, replace=[(session, replacement)])

assert scratch.session is replacement
assert order.session is session
```

Every reference to `session` anywhere in the graph resolves to `replacement`, including ones several objects deep. That is the tool for handing a copy to a test with a fake client, or to a background job with its own connection.

## Tool 3 — drop a reference

The sentinel `_nil` exists so that a memo entry whose value is *falsy* still counts as a hit (`if y is not _nil`). So `None` is a valid substitute:

```python
@dataclass
class Report:
    title: str
    cache: dict
    rows: list


report = Report("Q3", {"k": "expensive"}, [1, 2, 3])
lean = deepcopy_with(report, replace=[(report.cache, None)])

assert lean.cache is None
assert lean.rows == [1, 2, 3] and lean.rows is not report.rows
```

## Tool 4 — one memo across calls keeps copies consistent

```python
pool = {"size": 10}
web = {"name": "web", "pool": pool}
worker = {"name": "worker", "pool": pool}

memo = {}
web2 = copy.deepcopy(web, memo)
worker2 = copy.deepcopy(worker, memo)

assert web2["pool"] is worker2["pool"]
assert web2["pool"] is not pool
```

Copying a tuple `(web, worker)` in one call does the same thing when both are in hand at once; sharing the memo is for the case where the second structure only exists later, or is produced by another function you pass the memo to.

## The same memo, reused too long

A memo remembers *every* object it has copied, including the top-level one. Passing it again for the same object returns the first copy:

```python
state = {"counter": [0]}
memo = {}

first = copy.deepcopy(state, memo)
state["counter"].append(1)
second = copy.deepcopy(state, memo)

assert second is first                 # the memo hit for id(state)
assert first["counter"] == [0]         # and it does not reflect the change
```

One memo belongs to one consistent copy. For a snapshot per event or per request, build a fresh dictionary each time.

## The entry at `id(memo)`

`_keep_alive` stores the list of copied originals under `id(memo)`. Code that iterates the memo to "collect what was copied" gets that list among the values:

```python
copied = {key: value for key, value in memo.items() if key != id(memo)}
```

That is what *"opaque"* protects: the layout is not documented, so treat the dictionary as write-through for seeds and read-nothing-out. If you need a record of what was copied, count it in your own hook.

## Gotchas

**★ Symptom: `deepcopy(order, {session: session})` still copies the session (or raises `TypeError: unhashable type`).** Cause: the memo is keyed by `id(obj)`, an integer, not by the object. A plain object as a key never matches an integer lookup, and an unhashable one (a dataclass with the default `eq=True`) cannot be a key. Fix: `{id(session): session}`.

```python
memo = {id(session): session}
draft = copy.deepcopy(order, memo)
```

**★ Symptom: the second snapshot equals the first, though the state changed in between.** Cause: the same memo was reused; the top-level object is already in it. Fix: create the memo inside the function that takes the snapshot.

```python
def snapshot(state):
    return copy.deepcopy(state, {})
```

**★ Symptom: the pre-seeded resource is still copied inside one class.** Cause: a `__deepcopy__` somewhere in the graph calls `copy.deepcopy(self.client)` *without* the memo, which starts a fresh, empty memo for that subtree. Fix: forward the memo in every hook, and add a test that asserts the shared object's identity after the copy.

```python
import copy


class Exporter:
    def __init__(self, client, rows):
        self.client = client
        self.rows = rows

    def __deepcopy__(self, memo):
        clone = type(self).__new__(type(self))
        memo[id(self)] = clone
        clone.client = copy.deepcopy(self.client, memo)     # memo passed on
        clone.rows = copy.deepcopy(self.rows, memo)
        return clone
```

**Symptom: an equal but distinct session inside the graph is still copied.** Cause: the memo matches identity. `Session(dsn)` built twice is two objects, and only the one you seeded is protected. Fix: find every distinct instance (`{id(s): s for s in sessions}`) or restructure so one object is held by everyone.

```python
sessions = [order.session, order.audit_session]
draft = copy.deepcopy(order, {id(s): s for s in sessions})
```

**Symptom: code that reads `memo.values()` after a copy finds a list of the original objects.** Cause: `_keep_alive` stores them at `id(memo)`. Fix: do not read the memo; or skip `id(memo)` as above.

**Symptom: a helper that seeds the memo stops working after a refactor of an unrelated class.** Cause: the seed depends on the convention, not on a documented interface, and nothing failed loudly. Fix: keep the seeding in one function and give it a test.

```python
def test_deepcopy_with_keeps_shared_objects_shared():
    session = Session("postgresql://reports")
    order = Order("A-1", session, ["pen"])
    assert deepcopy_with(order, keep=[session]).session is session
```

## Interview questions

**★ How do you deep-copy an object graph but keep one member shared with the original?**
Pre-seed the memo: `copy.deepcopy(obj, {id(shared): shared})`. `deepcopy` looks up `id(x)` before copying anything and returns a hit as-is, so every reference to `shared` in the graph resolves to the original and its internals are never visited. The alternative — a `__deepcopy__` on the owning class that assigns the attribute without copying it — is better when the rule belongs to the class rather than to one call site.

**★ Why does passing one memo to two `deepcopy` calls keep shared children shared, and what goes wrong if you keep using that memo?**
The memo records every object copied; the second call finds the first call's copies and reuses them, so a child both structures referenced is one child in both copies. The same property makes a long-lived memo return stale copies: an object already in it is returned from the first call even if the original has since changed. One memo per consistent copy.

**Can the memo substitute an object instead of sharing it?**
Yes. A hit is returned as-is, so mapping `id(old)` to `new` replaces every reference to `old` in the copy with `new`. Mapping to `None` removes the reference; the `_nil` sentinel in `deepcopy` exists so a falsy value is still a hit.

**Is pre-seeding the memo documented?**
Only partly. The documentation defines the `memo` parameter and says a `__deepcopy__` must pass it on and treat it as opaque. Seeding it works because of how the implementation reads the memo, the same convention hook authors follow when they write `memo[id(self)] = new`. Isolate it in one helper and test the identity you depend on.

**What is stored at `memo[id(memo)]`, and why does it matter?**
A list of every original that was copied, put there by `_keep_alive` so no original can be freed and have its `id` reused during the call. It matters because the memo is not a clean map of copies: anything that iterates it finds that entry, and the memo is the reason a big deep copy keeps the whole original alive until it returns.

---

← [02 · deepcopy, the algorithm](02-deepcopy-the-algorithm.md) · [Topic index](README.md) · Next → [03 · Cycles and shared children](03-cycles-and-shared-children-traced.md)
