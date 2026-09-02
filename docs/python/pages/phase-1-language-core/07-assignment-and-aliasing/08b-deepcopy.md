---
title: "`deepcopy` recurses through the whole object graph, keeps a memo so cycles and shared references survive, and copies far more than you usually meant"
sidebar_label: "8b · deepcopy"
sidebar_position: 86
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`copy` — Shallow and deep copy operations](https://docs.python.org/3.14/library/copy.html),
> [`pickle`](https://docs.python.org/3.14/library/pickle.html),
> and the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#how-do-i-copy-an-object-in-python).
> Target: **CPython 3.14**.

**`copy.deepcopy` is the only tool that makes a genuinely independent copy of a
nested structure, and the `copy` documentation opens its description of it by
listing two problems it has that shallow copy does not: it can loop on
recursive objects, and *"because deep copy copies everything it may copy too
much"*. It solves the first with a memo dictionary. It cannot solve the
second — that one is your judgement, every time.**

## The definition and the two problems, verbatim

> *"A deep copy constructs a new compound object and then, recursively, inserts
> copies into it of the objects found in the original."*

> *"Two problems often exist with deep copy operations that don't exist with
> shallow copy operations:*
>
> - *Recursive objects (compound objects that, directly or indirectly, contain
>   a reference to themselves) may cause a recursive loop.*
> - *Because deep copy copies everything it may copy too much, such as data
>   which is intended to be shared between copies."*

And the mechanism:

> *"The `deepcopy()` function avoids these problems by:*
>
> - *keeping a `memo` dictionary of objects already copied during the current
>   copying pass; and*
> - *letting user-defined classes override the copying operation or the set of
>   components copied."*

## What the memo actually buys you

The memo is a dict keyed by `id()` of objects already copied in this pass. Two
consequences, and the second is the one people do not expect:

**Cycles terminate.** A node that refers to itself, or a parent/child pair that
point at each other, is copied once; the second time the recursion reaches it,
the memo already has the copy and returns it. Without the memo this would
recurse until `RecursionError`.

```python
a = {"name": "root"}
a["self"] = a                 # a cycle
b = copy.deepcopy(a)          # terminates; b["self"] is b
```

**The aliasing topology is preserved.** If one object appears twice inside the
structure, the copy also contains one object twice — not two equal copies:

```python
shared = {"k": 1}
original = [shared, shared]
c = copy.deepcopy(original)

c[0] is c[1]          # True — the memo returned the same copy the second time
c[0] is shared        # False — it IS a copy, just a single one
```

That is the correct semantics (a copy should be structurally identical) and it
is why `deepcopy` is not equivalent to "recursively rebuild with
comprehensions", which would produce two separate dicts. It also means the memo
is a live map of what has been copied, and you can *pre-seed* it — see below.

## What `deepcopy` does not descend into

> *"This module does not copy types like module, method, stack trace, stack
> frame, file, socket, window, or any similar types. It does 'copy' functions
> and classes (shallow and deeply), by returning the original object unchanged;
> this is compatible with the way these are treated by the `pickle` module."*

So functions, classes, modules and methods come out the other side as the same
object — deliberately. Atomic immutables (`int`, `str`, `bytes`, `float`,
`bool`, `None`) are likewise returned unchanged, because copying them would be
pointless. Everything else is reconstructed.

The types named in that sentence are the *safe* refusals. The dangerous cases
are the objects that are not on that list and that `deepcopy` will happily try
to reconstruct — a database connection wrapper, a session, a lock, a client
holding a socket — which is the subject of
[Copy hooks and uncopyable objects](08c-copy-hooks-and-uncopyable.md).

## Pre-seeding the memo: deep copy *except* these

The second parameter is public API, and it is the precise tool for "copy
everything except the things that must stay shared":

```python
def draft(order):
    memo = {id(order.session): order.session}    # do NOT copy the DB session
    return copy.deepcopy(order, memo)
```

Every reference to `order.session` anywhere in the graph resolves through the
memo to the original object. This is far better than the usual workarounds
(temporarily setting the attribute to `None`, or catching the exception), and it
is the reason to know the memo exists at all. The docs describe the memo as
*"an opaque object"* from the point of view of `__deepcopy__` implementations;
pre-seeding it from the outside is nonetheless the documented signature
`copy.deepcopy(x[, memo])`.

## Cost

`deepcopy` is recursive Python-level work: for every object it does a type
dispatch, a memo lookup, an allocation and a recursive descent into every
element or attribute. Its cost scales with the *total number of objects
reachable*, not with the size of the thing you thought you were copying — a
"small" order object that transitively reaches a customer, an address book, a
price list and a cache is a large copy. I am not going to quote a multiplier,
because it depends entirely on graph shape; the actionable rule is: **never put
`deepcopy` on a per-request or per-row hot path without measuring, and never
call it on an object whose reachable graph you have not inspected.**

Cheaper alternatives, in rough order of preference:

1. **Build the new structure explicitly** — `{**cfg, "db": {**cfg["db"], ...}}`
   copies exactly the levels you are changing.
2. **Copy one level with `dict(...)`/`list(...)`** where the values are
   immutable.
3. **Convert to immutable types once** so no copy is ever needed again.
4. **`copy.deepcopy`** when the structure is deep, irregular and genuinely
   yours.

## The serialisation round trip, and why it is not the same thing

```python
clone = json.loads(json.dumps(data))       # a "deep copy" for JSON-shaped data
clone = pickle.loads(pickle.dumps(obj))    # a "deep copy" for picklable objects
```

The JSON trip is a *conversion*, not a copy: tuples become lists, non-string
dict keys become strings, `datetime`, `Decimal`, `set` and custom classes fail
or need an encoder, and NaN/Infinity round-trip only because Python's `json`
extends the standard. It is fine when the data is already JSON-shaped and about
to be serialised anyway; it is a bug factory when it is used as a general copy.

The pickle trip is closer — `deepcopy` uses the same `__reduce_ex__` protocol —
but it is slower for in-memory work, it fails on the same unpicklable objects,
and it never preserves object identity with anything outside the pickle.

## Gotchas

### `deepcopy` on an ORM instance drags in the session
**Symptom.** Copying a model object raises an obscure error from deep inside the
ORM, or produces a detached object that explodes on first attribute access, or
takes seconds.
**Cause.** The instance graph reaches the identity map, the session, a
connection pool and every loaded relationship.
**Fix.** Pre-seed the memo with the session, copy only the columns you need
into a plain dict or dataclass, or use the ORM's own `make_transient` /
detach API. See [Caches, workers and ORM
instances](11c-caches-workers-and-orm.md).

### `RecursionError` from `deepcopy`
**Symptom.** A deep copy of a deeply nested structure blows the stack.
**Cause.** The memo prevents infinite loops from *cycles*, but not deep
*linear* nesting — a 5,000-level nested list still recurses 5,000 frames.
**Fix.** Flatten the structure, raise `sys.setrecursionlimit` knowingly, or
copy iteratively with your own worklist. A structure that deep usually
indicates a modelling problem.

### Two references in, two objects out — expected, and wrong
**Symptom.** Code that relies on `copy[0] is copy[1]` being false (or true) is
surprised.
**Cause.** `deepcopy` preserves sharing via the memo: an object appearing twice
in the original appears once, twice-referenced, in the copy.
**Fix.** Know which you want. If you need genuinely independent objects,
construct them; `deepcopy` is defined to reproduce structure, not to
de-duplicate it.

### `deepcopy` used as a hot-path defensive copy
**Symptom.** A profile dominated by `copy.deepcopy` and `_deepcopy_dict`.
**Cause.** Someone defended a handler with a deep copy of the request payload
and the payload transitively reaches a lot of objects.
**Fix.** Copy the levels you actually mutate, or freeze the data once at
ingestion and never copy again.

### `json.loads(json.dumps(x))` used as deepcopy
**Symptom.** Tuples arrive as lists, integer dict keys arrive as strings, a
`Decimal` raises `TypeError: Object of type Decimal is not JSON serializable`,
or a `datetime` silently becomes a string.
**Cause.** It is a serialisation round trip through a type system smaller than
Python's, not a copy.
**Fix.** `copy.deepcopy` for a copy. Use JSON when you actually want JSON.

### A `deepcopy` that silently shares something
**Symptom.** After a deep copy, one attribute still points at the original.
**Cause.** Some class in the graph defines `__deepcopy__` (or `__reduce__`) and
returns `self`, which is a legitimate and common choice for singletons,
connections and enums.
**Fix.** Not a bug — but know it, and check the classes in your graph before
assuming total independence. `copy.deepcopy` is only as deep as the classes it
traverses allow.

## Interview questions

**★ Q: What is the difference between `copy.copy` and `copy.deepcopy`?**
Shallow copy builds a new container holding references to the *same* contained
objects; deep copy builds a new container holding *copies* of the contained
objects, recursively. The docs' wording: shallow *"inserts references into it to
the objects found in the original"*, deep *"recursively, inserts copies into it
of the objects found in the original"*.

**★ Q: How does `deepcopy` handle a structure that contains a reference to
itself?**
It keeps a memo dictionary of objects already copied in the current pass, keyed
by identity. When the recursion reaches an object it has already copied, it
returns the existing copy instead of recursing again, so cycles terminate and
the copy has the same cycle.

**★ Q: What are the two problems the docs say deep copy has?**
Recursive objects can cause a recursive loop, and — the one that matters in
design — *"because deep copy copies everything it may copy too much, such as
data which is intended to be shared between copies"*. The memo fixes the first;
nothing fixes the second except deciding what should be shared.

**Q: What does `deepcopy` do with a function, a class or a module?**
Returns the original object unchanged. The docs list module, method, stack
trace, stack frame, file, socket and window as types the module does not copy,
and say functions and classes are "copied" by returning them unchanged, for
compatibility with `pickle`.

**Q: How would you deep-copy an object but keep one attribute shared?**
Pre-seed the memo: `copy.deepcopy(obj, {id(shared): shared})`. Every reference
to `shared` anywhere in the graph resolves to the original. The alternative —
implementing `__deepcopy__` on the owning class — is right when the rule belongs
to the class rather than to one call site.

**Q: Is `json.loads(json.dumps(x))` a valid deep copy?**
Only for data that is already JSON-shaped, and even then it converts rather
than copies: tuples become lists, non-string keys become strings, and anything
JSON cannot represent either raises or needs a custom encoder. Use it when the
data is about to be serialised anyway; do not use it as a general copy.

**Q: Two identical-looking sublists appear twice in a structure. After
`deepcopy`, how many objects are there?**
It depends on whether they were the same object or two equal objects. The memo
preserves identity: one object referenced twice becomes one copy referenced
twice; two distinct-but-equal objects become two distinct copies. `deepcopy`
reproduces the reference graph, it does not normalise it.

**Q: When should you not call `deepcopy`?**
When the graph reaches resources — sockets, file handles, locks, DB sessions,
thread pools; when it is on a hot path and you have not measured; when the
structure is flat enough that a one-level copy is sufficient; and when you can
instead make the data immutable once and never copy it again.

---

← Prev: [Shallow copy](08-shallow-copy.md) · Index: [Assignment and aliasing](README.md) · Next → [Copy hooks and uncopyable objects](08c-copy-hooks-and-uncopyable.md)
