---
title: "Names and objects: assignment binds a label, it never copies a value"
sidebar_label: "1 · Names and objects"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference
> §3.1 [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html)
> and §7.2 [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html).
> Target: **CPython 3.14**.

**In Python, `x = expr` evaluates `expr` to an *object* and makes the name `x`
refer to it. Nothing is copied, nothing is boxed, nothing is converted. Two
names can refer to the same object, and if that object is mutable, a change made
through one name is visible through the other — not because Python passed
something "by reference", but because there was only ever one object and two
labels on it. Once you can see that picture, aliasing bugs stop being magic and
become arithmetic.**

## Objects have three properties; names have none

The Language Reference is explicit:

> *"Every object has an identity, a type and a value. An object's identity never
> changes once it has been created; you may think of it as the object's address
> in memory."*

Names have none of those. A name is an entry in a namespace — a dict-like
mapping from a string to an object reference. `x = [1, 2]` does two separate
things:

1. Build a `list` object containing references to the objects `1` and `2`.
2. Store a reference to that list under the key `"x"` in the current namespace.

There is no "variable x" holding bytes. There is a namespace entry and a heap
object, and the only connection between them is a pointer.

This is why `type(x)` is a question about the *object*, not the name, and why a
name can refer to an `int` on one line and a `Request` on the next without any
declaration or cast.

## Rebinding versus mutating — the whole game

Two operations look similar and are completely different:

```python
a = [1, 2, 3]
b = a            # b is now a second label on the SAME list object

b.append(4)      # MUTATE: change the object both names point at
print(a)         # a sees the change — there is only one list

b = [9, 9]       # REBIND: point the name b at a brand-new list object
print(a)         # a is untouched — b simply stopped pointing at a's list
```

- **Mutation** (`b.append`, `b[0] = ...`, `b.sort()`, `d["k"] = ...`) changes the
  object. Every name bound to that object sees it.
- **Rebinding** (`b = ...`) changes only which object the name `b` refers to. No
  other name is affected, ever.

The reason this trips people is that both are written with the name on the left.
`b[0] = 5` looks like assignment but is a method call on the object
(`b.__setitem__(0, 5)`); `b = 5` is genuinely an assignment to the name. The
square brackets are the whole difference.

## Immutable objects make the distinction invisible

```python
a = 10
b = a
b += 1
print(a)   # still 10
```

Nothing here contradicts the model. `int` is immutable — there is no operation
that changes the value of the object `10` — so `b += 1` *must* create a new
object `11` and rebind `b` to it. The label model is identical for `int`, `str`,
`tuple`, `frozenset` and `bytes`; you just cannot observe it, because the
mutating half of the picture does not exist for them.

That invisibility is exactly what makes the list case surprising. The rule never
changed; only the observability did.

The Reference adds the subtlety that "immutable" is about the container, not the
reachable graph:

> *"The value of an immutable container object that contains a reference to a
> mutable object can change when the latter's value is changed; however the
> container is still considered immutable, because the collection of objects it
> contains cannot be changed."*

A tuple of lists is immutable and its contents can still change under you. That
is also why such a tuple is unhashable — a fact Phase 3's data model builds on.

## The `+=` asymmetry, which is the same fact wearing a disguise

```python
x = [1, 2]
y = x
x += [3]        # calls list.__iadd__ → mutates in place, then rebinds x to the same object
print(y)        # [1, 2, 3] — y sees it

p = (1, 2)
q = p
p += (3,)       # tuple has no __iadd__ → builds a NEW tuple, rebinds p
print(q)        # (1, 2) — q does not see it
```

`+=` is not a single operation. For types that define `__iadd__` (list, set,
`bytearray`, `collections.Counter`, numpy arrays) it mutates and then rebinds the
name to the *same* object. For types that do not, it falls back to `x = x + y`,
which constructs a new object. Same syntax, opposite aliasing consequences,
decided by the type on the left.

The nastiest form of this appears with a tuple containing a list:

```python
t = (["a"], "b")
t[1] += "c"       # TypeError: 'tuple' object does not support item assignment
```

…and the item is nevertheless **not** modified, while

```python
t = (["a"], "b")
t[0] += ["c"]     # TypeError — but the list IS now ["a", "c"]
```

mutates the inner list *and then* raises, because `__iadd__` runs first
(mutating) and the subsequent store back into the tuple is what fails. This is a
real consequence of `+=` being "mutate, then store", and it is why "it raised, so
nothing happened" is not a safe assumption in Python.

## Multiple assignment, and where it surprises

```python
e = f = []          # ONE list, two names — the Reference says so explicitly
e.append(1)
print(f)            # [1]

c = []
d = []              # TWO distinct lists, guaranteed
```

The Language Reference is unambiguous here:

> *"after `c = []; d = []`, c and d are guaranteed to refer to two different,
> unique, newly created empty lists. (Note that `e = f = []` assigns the same
> object to both e and f.)"*

The same fact makes `[[0] * 3] * 3` a bug factory: the outer `* 3` replicates the
*reference* three times, so all three rows are one list.

```python
grid = [[0] * 3] * 3
grid[0][0] = 9
print(grid)          # every row shows the 9 — there is one row object

grid = [[0] * 3 for _ in range(3)]   # the fix: three separate list objects
```

The comprehension is not a style preference here. Its body executes once per
iteration, so it *constructs* three lists; `*` only ever duplicates references.

## Copying, named here and settled later

Because assignment never copies, "give me my own version" is always an explicit
request, and it comes in two strengths:

```python
import copy

shallow = copy.copy(config)       # new outer object; SAME inner objects
deep    = copy.deepcopy(config)   # new outer object and new inner objects, recursively
```

`list(x)`, `x[:]`, `dict(x)` and `set(x)` are all shallow copies. If `config` is
`{"hosts": ["a"]}`, a shallow copy gives you a new dict whose `"hosts"` key
points at the *original* list — appending to it is visible through both. Phase
1's **Assignment semantics** *(not written yet)* makes the choice a decision
procedure; the trigger to remember from here is: *shallow copy = new outer label
set, same inner objects*.

## Gotchas

**Symptom:** `x += [1]` changed a list a colleague's code was also holding, but `x = x + [1]` did not
**Cause:** `list.__iadd__` mutates in place and rebinds to the same object; `+` builds a new object and rebinds
**Fix:** when you mean "give me my own list", write `x = x + [...]` or copy explicitly. Reserve `+=` for when in-place mutation is the intent, and say so in the docstring if the list came from a caller

**Symptom:** `t[0] += ["c"]` raises `TypeError` and yet the inner list was modified
**Cause:** `+=` is mutate-then-store; the mutation via `__iadd__` succeeds before the store back into the immutable tuple fails
**Fix:** do not write item-augmented assignment against a tuple. Name the inner object instead: `inner = t[0]; inner.append("c")`

**Symptom:** every row of a grid built with `[[0] * cols] * rows` changes together
**Cause:** sequence repetition copies references, not objects — all rows are one list object
**Fix:** build with a comprehension: `[[0] * cols for _ in range(rows)]`

**Symptom:** a tuple you used as a dict key raises `TypeError: unhashable type: 'list'`
**Cause:** the tuple contains a list; immutability of the container does not make its contents immutable, and hashing recurses into them
**Fix:** freeze the contents too — `tuple(inner)` or `frozenset(inner)` — before using it as a key

**Symptom:** `copy.copy(config)` still lets a change leak into the original
**Cause:** a shallow copy duplicates the outer container only; the nested objects are shared
**Fix:** `copy.deepcopy` when the structure is nested and independence matters — and be aware deepcopy follows the whole reachable graph, so it is not free on large structures

**Symptom:** a "snapshot" you took with `snapshot = self.items` shows later changes
**Cause:** that is a second label, not a snapshot
**Fix:** `snapshot = list(self.items)` (or `tuple(...)` if it should also be read-only). The word "snapshot" in a variable name is a good prompt to check that a copy actually happened

**Symptom:** two module-level names that "should" be independent share state
**Cause:** `DEFAULTS = {}` and `CONFIG = DEFAULTS` at import time — one dict, two module globals, and the module body ran once
**Fix:** `CONFIG = dict(DEFAULTS)`. Module-level mutable state shared by aliasing is especially hard to spot because the binding is far from the mutation

## Interview questions

**★ What does `a = b` do when `b` is a list?**
It binds the name `a` to the exact list object `b` refers to. Nothing is copied —
not the list, not its elements. After it, `a is b` is True and any mutation
through either name is visible through the other. To get an independent list you
must ask for one: `a = b[:]`, `a = list(b)`, or `copy.deepcopy(b)` if the
elements themselves must be independent too.

**★ Explain the difference between `x += [1]` and `x = x + [1]`.**
`+=` calls `list.__iadd__`, which extends the existing list in place and rebinds
the name to that same object — so any other name bound to it sees the change.
`x + [1]` builds a new list and rebinds only `x`. For immutable types like tuple
there is no `__iadd__`, so `+=` degrades to the second form and the distinction
vanishes. One syntax, a type-dependent semantic difference.

**★ Why does `[[0] * 3] * 3` misbehave, and what do you use instead?**
`[x] * n` builds a list of `n` references to the *same* `x`. When `x` is itself a
mutable list, all `n` rows are one object, so writing to one row writes to all.
Use `[[0] * 3 for _ in range(3)]`: the comprehension body runs three times and
constructs three distinct lists.

**What actually happens when you write `x = 5`?**
The compiler emits an instruction to load the constant object `5` and store a
reference to it under the name `x` — a `STORE_FAST` into the function's
fast-locals array inside a function, or a `STORE_NAME`/`STORE_GLOBAL` into a
namespace dict at module level. No memory is allocated for "the variable x"; a
namespace entry now points at an existing `int` object. Topic
**12 · Bytecode inspection with `dis`** *(not written yet)* shows how to see
which instruction you actually got.

**Is a tuple immutable if it contains a list?**
Yes — the tuple is immutable, meaning the set of references it holds cannot
change. The objects it references can still change. That is why a tuple
containing a list is unhashable: hashing recurses into the elements, and the
element's value is not stable. "Immutable" in Python is a statement about one
object, never about everything reachable from it.

**What is the difference between `copy.copy` and `copy.deepcopy`, and when does it matter?**
`copy.copy` (and `list(x)`, `x[:]`, `dict(x)`) creates a new outer container
holding the *same* element references. `copy.deepcopy` recursively copies the
reachable object graph, tracking already-visited objects so cycles terminate. It
matters exactly when the structure is nested and the caller must not observe your
mutations — a config dict of lists, a parsed JSON payload you are about to
normalise in place. It costs proportionally to the whole graph, so it is not a
default.

**How would you explain aliasing to someone coming from Java?**
It is the same as Java's reference semantics for objects, with one difference
that removes the escape hatch: Python has no primitives. In Java `int x = y`
copies a value; in Python `x = y` binds a label even for integers — you simply
cannot observe it, because `int` is immutable. So the Java intuition "objects are
shared, primitives are copied" becomes "everything is shared, and only mutability
decides whether sharing is visible".

---

← Index: [Everything is an object](README.md) · Next → [Binding in functions](02-binding-in-functions.md)
