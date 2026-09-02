---
title: "Every binding form is an assignment, and the target you choose decides whether you rewire a name or mutate an object other people can see"
sidebar_label: "1b · Targets, binding forms and `del`"
sidebar_position: 71
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [§7.5 The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [§8.4 The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [§4.2 Naming and binding](https://docs.python.org/3.14/reference/executionmodel.html#naming-and-binding),
> and the [glossary](https://docs.python.org/3.14/glossary.html#term-reference-count).
> Target: **CPython 3.14**.

**`=` is not the only thing that binds a name, and a name is not the only thing
that can be a target. `for`, `with ... as`, `except ... as`, `import ... as`,
`def`, `class`, `global`/`nonlocal` and the walrus all bind; and a target can
be an attribute, a subscript or a slice, in which case the statement stops
being a rebinding and becomes a *mutation of somebody else's object*. Knowing
which of the two you wrote is the difference between `x = other` (nobody else
notices) and `x[:] = other` (everybody notices).**

## The target forms

The reference's grammar allows a target to be a name, an attribute reference, a
subscription, a slicing, a starred target, or a parenthesised/bracketed list of
targets. The behavioural split is binary:

| Target form | What it does | Who sees it |
|---|---|---|
| `x = v` | rebinds a name in a namespace | only code using that namespace |
| `obj.attr = v` | calls `type(obj).__setattr__` | every holder of `obj` |
| `obj[k] = v` | calls `type(obj).__setitem__` | every holder of `obj` |
| `obj[a:b] = it` | calls `__setitem__` with a `slice` | every holder of `obj` |
| `a, b = it` | unpacks, then binds each target | per-target, as above |
| `a, *rest = it` | binds `rest` to a **new list** | — |

The first row is the only one that leaves the old object untouched. The rest
are the reference's *"modify attributes or items of mutable objects"* half, and
they are how a function reaches out and changes the caller's data.

```python
def replace_all(items, new):
    items = new            # rebinds the local name. Caller sees nothing.

def replace_all_really(items, new):
    items[:] = new         # mutates the caller's list in place. Caller sees everything.
```

## `x[:] = other` is the in-place replace idiom, and it is a weapon

Slice assignment to the full slice discards the list's contents and refills it
from the iterable, **keeping the same list object**. That is exactly what you
want when other code already holds a reference and must see the new contents:

```python
config_list[:] = sorted(config_list)      # every alias sees the sorted order
config_list = sorted(config_list)         # only this name sees it; aliases keep the old list
```

and exactly what you must not do when the caller handed you a list to read.
Both spellings look almost identical in a diff. Learn to see the `[:]`.

The same pair exists for dicts, spelled with methods rather than a slice:

```python
settings.clear(); settings.update(new)    # in place — aliases see it
settings = dict(new)                      # rebinding — aliases do not
```

Note also that `x[:]` on the *right*-hand side is a shallow copy — `y = x[:]`
— while on the *left* it is an in-place overwrite. Same three characters,
opposite meanings, decided by which side of the `=` they are on.

## Starred targets always allocate a list

```python
first, *rest = "abcde"        # rest == ['b', 'c', 'd', 'e'] — a list, even from a str
head, *tail = some_tuple      # tail is a list, not a tuple
```

The starred target is documented to be assigned a list of the remaining items.
So `*rest` is one of the few binding forms that *does* create a new container,
which makes it a cheap way to detach a tail from an iterable — and a hidden
allocation if the iterable is enormous. [Unpacking](../13-unpacking/README.md)
covers the form properly; the aliasing point is only that `rest` is a fresh
list nobody else holds, while `head` is an alias of an element.

## Everything else that binds

```python
for row in rows: ...          # binds `row` once per iteration, in the enclosing scope
with open(p) as fh: ...       # binds `fh` (to the result of __enter__, not the context manager)
except ValueError as err: ... # binds `err` — and unbinds it at the end of the block
import json as j              # binds `j`
from os import path           # binds `path`
def f(): ...                  # binds `f`
class C: ...                  # binds `C`
match p: case [x, y]: ...     # capture patterns bind
(n := compute())              # binds `n`
```

Two of these have consequences people trip on.

**A `for` target is an ordinary assignment in the enclosing scope** — *"Names
in the target list are not deleted when the loop is finished"* — so it outlives
the loop and will happily clobber a name you were using:

```python
row = header
for row in rows:              # header reference is gone
    ...
print(row)                    # the LAST row, not the header — and not an error
```

**`except ... as err` is explicitly deleted at the end of the clause.** The
reference: *"When an exception has been assigned using `as target`, it is
cleared at the end of the `except` clause."* And the reason: *"Exceptions are
cleared because with the traceback attached to them, they form a reference
cycle with the stack frame, keeping all locals in that frame alive until the
next garbage collection occurs."* The practical effect:

```python
try:
    risky()
except ValueError as err:
    problem = err             # you must copy the reference out...
print(problem)                # ...because `err` no longer exists here
```

Referencing `err` after the block raises `NameError`, even though nothing in
your code deleted it.

## `del` unbinds a name; it does not delete an object

```python
a = [1, 2, 3]
b = a
del a          # the NAME a is gone. The list is not — b still refers to it.
b              # [1, 2, 3]
```

The reference calls deletion of a name *"the removal of the binding of that
name from the local or global namespace"*, and deleting an unbound name raises
`NameError`. The object disappears only when the last reference to it goes
away; the glossary defines reference count as *"the number of references to an
object. When the reference count of an object drops to zero, it is
deallocated."*

`del` on a subscript or attribute is the mutation form again — `del d[key]`
calls `__delitem__`, `del obj.attr` calls `__delattr__`, and both are visible
to every holder of the object:

```python
del cache[key]        # everyone sharing `cache` loses that key
del obj.cached_value  # invalidates a functools.cached_property, deliberately
```

That last line is a real idiom: `functools.cached_property` stores its result
in the instance `__dict__`, and `del obj.attr` is the documented way to force
recomputation.

## `global` and `nonlocal` change *which* namespace a target writes to

They bind nothing themselves; they redirect every subsequent binding of that
name in the function to an outer namespace. Without them, **any** assignment
to a name anywhere in a function body makes that name local for the whole
body — which is why reading before assigning raises `UnboundLocalError` rather
than falling back to the global. The mutation/rebinding split applies here too,
and it is the reason a lot of code "works" without `global`:

```python
REGISTRY = {}

def register(k, v):
    REGISTRY[k] = v      # MUTATION — no global needed, and no local created

def reset():
    REGISTRY = {}        # REBINDING — creates a local, the module dict is untouched
```

`reset()` is a silent no-op. It needs `global REGISTRY`, or better,
`REGISTRY.clear()`.

## Gotchas

### A function "clears" a module-level dict and nothing changes
**Symptom.** `reset()` runs without error, the registry still has every entry.
**Cause.** `REGISTRY = {}` inside a function binds a *local* name; the module
global is never touched. Because the name is only read after being assigned,
there is no `UnboundLocalError` to warn you.
**Fix.** Mutate instead of rebind — `REGISTRY.clear()` — which also keeps every
existing alias correct. Use `global` only when you genuinely must swap the
object, and accept that aliases will not follow.

### `items = new` where `items[:] = new` was meant
**Symptom.** A "normalise in place" helper has no effect on the caller's list.
**Cause.** Rebinding the parameter name. The caller's list was never touched.
**Fix.** `items[:] = new`, or — usually better — return the new list and let
the caller rebind. A function that mutates its argument *and* returns it is the
worst of both, because callers cannot tell which one they are relying on.

### `x[:] = huge_generator` on a list someone is iterating
**Symptom.** `RuntimeError`, a silently short iteration, or duplicated
elements.
**Cause.** In-place slice assignment mutates the object an active iterator is
walking.
**Fix.** Build a new list and rebind, or snapshot the iteration with
`for item in list(items):`.

### `err` is undefined after the `except` block
**Symptom.** `NameError: name 'err' is not defined` on a line *after* the
handler, in code that clearly bound it.
**Cause.** The reference specifies that `except E as err` deletes `err` at the
end of the clause, to break the frame-holding reference cycle through the
traceback.
**Fix.** Assign what you need to a separate name inside the block —
`message = str(err)` — rather than reaching for `err` later.

### A loop variable eats an existing name
**Symptom.** A value computed before a loop is the loop's last item afterwards.
**Cause.** The `for` target is a normal binding in the enclosing scope, with no
loop-local scoping and no warning about shadowing.
**Fix.** Name loop variables distinctly; `ruff`'s flake8-builtins and
pylint's `redefined-outer-name` catch the worst cases.

### `del` used as "free this memory"
**Symptom.** `del big_list` in a loop, memory unchanged.
**Cause.** `del` removes one binding. If anything else refers to the object —
another name, a list, a closure, a cache, an exception traceback — it stays
alive.
**Fix.** Find and drop the other references. A `functools.lru_cache` is a very
common hidden one; the docs note *"the cache keeps references to the arguments
and return values until they age out of the cache or until the cache is
cleared."*

## Interview questions

**★ Q: What is the difference between `x = y` and `x[:] = y`?**
`x = y` rebinds the name `x`; the object `x` used to refer to is unchanged and
every other reference to it still sees the old contents. `x[:] = y` performs
slice assignment on the object `x` refers to, replacing its contents while
keeping the same object, so every other reference sees the new contents. The
first is invisible outside the current scope; the second is visible everywhere.

**★ Q: Does `del x` free memory?**
It removes the binding of the name `x`. The object is deallocated only if that
was the last reference — CPython's reference counting deallocates at zero, as
the glossary describes. Any other name, container, closure cell or cache
holding the object keeps it alive.

**Q: Name five things other than `=` that bind a name.**
`for` targets, `with ... as`, `except ... as`, `import`/`from ... import` (with
or without `as`), `def`, `class`, function parameters, comprehension targets,
`match` capture patterns, the walrus `:=`, and `global`/`nonlocal` declarations
which redirect binding rather than performing it.

**Q: Why does `except ValueError as e:` leave `e` undefined after the block?**
Because the exception object references its traceback, which references every
frame in the stack, which references their local variables — including `e`
itself. That is a reference cycle holding a lot of memory. The reference
specifies the clause is compiled so that `e` is deleted in a `finally` at the
end of the handler, breaking it.

**Q: Why does mutating a global container work without the `global` keyword,
but rebinding it does not?**
`REGISTRY[k] = v` is not a binding operation at all — it is a method call on
the object the name already refers to, so the name is only *read*, and the read
finds the global. `REGISTRY = {}` is a binding, and any binding of a name in a
function body makes that name local throughout the body, so it creates a local
that vanishes when the function returns.

**Q: What type is `rest` in `a, *rest = (1, 2, 3)`?**
A `list`, always — `[2, 3]` here — regardless of what was unpacked. Starred
assignment is documented to build a list of the remaining items, so it is one
of the rare binding forms that allocates a new container rather than aliasing
an existing one.

**Q: `obj.attr = value` — is that assignment or a method call?**
Both, in the sense that the statement is an assignment whose target form
dispatches to `type(obj).__setattr__(obj, "attr", value)`. That is why a
property setter, a `__slots__` restriction, a frozen dataclass, or a validating
`__setattr__` can all reject it — an attribute assignment is arbitrary code,
unlike binding a plain name, which never is.

**Q: How do you force a `functools.cached_property` to recompute?**
`del obj.attr`. The cached value lives in the instance `__dict__` shadowing the
descriptor; deleting the instance attribute removes the shadow, so the next
access runs the function again. It is `__delattr__` doing the work, not any
cache API.

---

← Prev: [What `=` actually does](01-what-assignment-does.md) · Index: [Assignment and aliasing](README.md) · Next → [Identity, equality and `id()`](02-identity-and-id.md)
