---
title: "`pass` and `Ellipsis`: the empty block, and the object spelled `...`"
sidebar_label: "2 · `pass` and `Ellipsis`"
sidebar_position: 161
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `pass` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-pass-statement)
> and [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> the Library Reference
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`contextlib.suppress`](https://docs.python.org/3.14/library/contextlib.html#contextlib.suppress),
> [`types`](https://docs.python.org/3.14/library/types.html)
> and [`typing`](https://docs.python.org/3.14/library/typing.html).
> Target: **CPython 3.14**.

**Two pieces of syntax that look like punctuation and are not. **`pass` is a
statement** that does nothing, and it exists only because Python delimits blocks
by indentation, so a block cannot be empty the way `{}` can in C. **`Ellipsis` is
an object** — a singleton, spelled `...`, with a type and a truth value — doing
three unrelated jobs: a stub body, a typing placeholder where it has real
meaning, and the multidimensional slicing token it was invented for. And since
both turn up in the smallest statements in the language, this chunk also picks
up chained assignment, whose corner cases are the same left-to-right rule that
governs unpacking.**

## `pass` does nothing, deliberately

> `pass` *"is a null operation — when it is executed, nothing happens."*

It exists because Python delimits blocks by indentation, so a block cannot be
empty the way `{}` can in C. `pass` is the placeholder that makes an empty block
syntactically legal:

```python
class NotFoundError(Exception):
    pass

def todo():
    pass

for x in xs:
    pass            # exhaust an iterator for its side effects (rare, and a smell)

try:
    risky()
except SpecificError:
    pass            # ⚠ see below
```

That last one deserves a warning. `except SomeError: pass` is a **silent
swallow**, and the reason it is a smell is that a reader cannot tell whether the
author meant to ignore the error or forgot to handle it. `contextlib.suppress`
says the first one out loud:

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    os.remove(path)
```

Same behaviour, and the intent is now in the code. Use `pass` for structural
placeholders; use `suppress` for deliberate ignoring.

`pass` is not the only way to fill a block — a docstring alone is a complete
body, and is better for a class or function that is deliberately empty:

```python
class NotFoundError(Exception):
    """Raised when a lookup finds nothing."""      # no `pass` needed
```

## `Ellipsis` is an object, not syntax

```python
...                 # the literal
Ellipsis            # the same object, by name
type(...)           # <class 'ellipsis'> — types.EllipsisType
... is Ellipsis     # True
bool(...)           # True — it is truthy
```

From the docs: *"The same as the ellipsis literal `...`, an object frequently
used to indicate that something is omitted. Assignment to `Ellipsis` is
possible, but assignment to `...` raises a `SyntaxError`."*

That asymmetry is a curiosity worth knowing: `Ellipsis = 5` is legal (it is a
builtin name, not a keyword) while `... = 5` is not. Unlike `None`, `True` and
`False`, it was never promoted to a keyword.

Its three unrelated jobs:

**1. A stub body.** The convention in `.pyi` stub files and in `Protocol`
definitions:

```python
class Reader(Protocol):
    def read(self, n: int) -> bytes: ...
```

Purely stylistic — `pass` would work identically — but `...` is what typeshed
uses and what readers now expect for "there is deliberately no body here".

**2. Typing placeholders**, where it has real meaning:

```python
Callable[..., int]        # "any arguments, returns int"
tuple[int, ...]           # a variable-length tuple of ints — NOT a 2-tuple
```

`tuple[int, ...]` is the one to remember: the ellipsis means "one or more of the
preceding type", so it is the annotation for a homogeneous tuple of unknown
length. `tuple[int]` means a tuple of *exactly one* int, which is almost never
what someone writing it meant.

**3. Multidimensional slicing**, which is where it came from. `arr[..., 0]` in
numpy means "all the leading axes, then index 0 on the last". Plain Python
sequences do not use it — `[1,2,3][...]` raises `TypeError` — but the syntax
exists in the language so numpy can define it.

A fourth, minor use: as a **sentinel**, since it is a unique singleton. It works,
but a private `object()` is better, because `Ellipsis` may already mean
something in the same file.

## Chained assignment corner cases

```python
a = b = []          # ONE list, two names — a is b
a = b = c = 0       # fine for immutables
```

The reference: an assignment statement *"evaluates the expression list … and
assigns the single resulting object to each of the target lists, from left to
right"*. One object, several names. For an `int` that is harmless; for a mutable
it is the aliasing bug that
[topic 07](../07-assignment-and-aliasing/README.md) documents in full.

The left-to-right order is observable in the same way as unpacking:

```python
x = [0, 1]
i = 0
i = x[i] = 2        # i is assigned first, then x[i] → x[2]: IndexError
```

And chained assignment mixes freely with subscripts and attributes, which is
where it gets unreadable — `self.total = row["total"] = compute()` assigns the
same object to both. Legal; do not.

## Gotchas

**Symptom — `except X: pass` hides a real failure for months.** Cause: a bare
swallow is indistinguishable from a forgotten handler. Fix:
`contextlib.suppress(X)` when the ignoring is deliberate — the name says so — or
log at debug level. A `pass` in an `except` should be rare enough to be
noticeable in review.

**Symptom — `tuple[int]` fails type checking against a 3-tuple of ints.**
Cause: `tuple[int]` means a tuple of exactly one `int`. The variable-length form
is `tuple[int, ...]`, where the ellipsis means "more of the same". Fix: add the
`...`. This is the most common real bug involving `Ellipsis`.

**Symptom — `Ellipsis = something` silently succeeds.** Cause: unlike `None`,
`True` and `False`, `Ellipsis` is a builtin **name**, not a keyword, so it can be
rebound; only the `...` literal is protected. Fix: do not; and prefer a private
`object()` sentinel over `Ellipsis` so the name is never load-bearing.

**Symptom — `a = b = []` and mutating through `a` changes `b`.** Cause: chained
assignment binds **one** object to every target. Fix: `a, b = [], []` when you
want two lists. This is aliasing, not a chaining quirk —
[topic 07](../07-assignment-and-aliasing/README.md) is the full treatment.

**Symptom — a `for ...: pass` loop written to "consume" an iterator looks like
dead code and gets deleted.** Cause: the loop's purpose is the iterator's side
effects, which is invisible. Fix: `collections.deque(it, maxlen=0)` is the
idiomatic "exhaust and discard", and a comment beats either.

**Symptom — a chained assignment involving a subscript raises `IndexError` or
writes to the wrong place.** Cause: targets are assigned **left to right**, so
`i = x[i] = 2` sets `i` first and then resolves `x[i]` with the new value. Fix:
split it into two statements. Same rule as
[unpacking](../13-unpacking/01-tuple-assignment.md), and just as
counter-intuitive.

**Symptom — a `Protocol` or ABC method body written as `...` is reported as
having no implementation, or as returning `None`.** Cause: `...` is an
expression statement, not a marker — the function really does return `None`. In
a `.pyi` stub or a `Protocol` that is fine; in a concrete class it means the
method silently does nothing. Fix: `raise NotImplementedError` for a method
subclasses must override.

**Symptom — `bool(...)` is `True` and a truthiness check on a sentinel behaves
oddly.** Cause: `Ellipsis` is a perfectly ordinary truthy object. Fix: compare
with `is`, as with any sentinel — and prefer a private `object()` so nothing
else in the file can mean the same thing.

## Interview questions

**★ Q: What is the difference between `tuple[int]` and `tuple[int, ...]`?**
`tuple[int]` is a tuple of **exactly one** int. `tuple[int, ...]` is a
variable-length tuple of ints — the ellipsis means "more of the preceding type".
The single-element form is almost never what someone writing it intended, and a
checker will happily reject a three-element tuple against it.

**★ Q: Why does Python need `pass`?**
Because blocks are delimited by indentation, so there is no empty-block syntax
the way `{}` provides in C. `pass` is a null operation whose only job is to make
an empty suite legal. A docstring works as a body too, and is better for a class
or function that is deliberately empty.

**★ Q: `except SomeError: pass` — what is wrong with it?**
Nothing functionally; the problem is that a reader cannot tell deliberate
ignoring from a forgotten handler. `contextlib.suppress(SomeError)` expresses
the intent in the code, with identical behaviour, and makes the remaining bare
`pass` handlers worth looking at.

**Q: Can you assign to `Ellipsis`?**
Yes — `Ellipsis = 5` is legal, because it is a builtin name rather than a
keyword. `... = 5` is a `SyntaxError`. That asymmetry is documented and is the
one respect in which `Ellipsis` differs from `None`, `True` and `False`, all of
which are keywords.

**Q: What does `a = b = []` create?**
One list, bound to two names — `a is b` is `True`, so mutating through either is
visible through the other. The reference says the single resulting object is
assigned to each target list, left to right. For immutables it is harmless; for
a mutable it is the classic aliasing bug.

**Q: Where does the `...` syntax actually come from?**
Multidimensional slicing. `arr[..., 0]` in numpy means "all leading axes, then
index 0 on the last". The language provides the token so libraries can define
its meaning; plain Python sequences reject it. Its use as a stub body and as a
typing placeholder came later.

**Q: `...` or `pass` for a stub body — does it matter?**
Not functionally; both leave the function returning `None`. `...` is the
convention in `.pyi` stubs, `Protocol` definitions and overload declarations,
and readers now expect it there. In a concrete class neither is right for a
method subclasses must implement — `raise NotImplementedError` is.

**Q: What is `type(...)`?**
`types.EllipsisType`, and `...` is its sole instance, so `... is Ellipsis` is
`True`. It is truthy. That makes it usable as a sentinel, though a private
`object()` is better, because `Ellipsis` may already carry meaning elsewhere in
the same module.

---

← Prev: [`del`](01-del.md) · Index: [`del`, `pass`, `Ellipsis`](README.md) · Next → **Phase 2 — Functions, closures and decorators** *(not written yet)*
