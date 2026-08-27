---
title: "Binding in functions: call-by-binding, and what del really deletes"
sidebar_label: "2 · Binding in functions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference
> §7.5 [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html)
> and the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html)
> entry on argument passing. Target: **CPython 3.14**.

**A function call is just more binding. Parameters are names in a brand-new local
namespace, bound to the exact objects the caller handed over — so a function can
mutate your object but can never rebind your name. That one sentence answers
"is Python call-by-value or call-by-reference?" (neither), explains why a swap
function is impossible to write, and settles what `del` does and does not free.**

The other half of binding in a function — **default values, which are objects
created once when `def` runs** — is chunk
[2b · Default arguments](02b-default-arguments.md).

## Call-by-binding: neither by value nor by reference

Python is neither call-by-value nor call-by-reference. The accurate name is
**call-by-binding** (also "call by object reference", or "call by sharing"):
parameter names are bound to the caller's objects.

```python
def rename(items):
    items.append("x")   # MUTATES the caller's object — visible outside
    items = ["new"]     # REBINDS the local name only — invisible outside
    items.append("y")   # mutates the local list, which the caller never sees

data = ["a"]
rename(data)
print(data)             # ['a', 'x']
```

The consequences, as rules you can apply without re-deriving them:

- **A function can mutate any mutable argument you give it**, and you will see
  the result. There is no `const`, no `final`, no defensive copy done for you.
- **A function can never rebind a caller's name.** Assigning to a parameter is
  purely local. This is why "swap two of the caller's variables inside a
  function" is impossible in Python without returning them.
- **Whether a given function is safe to call with your list is a documentation
  question, not a language question.** If it matters, pass a copy
  (`f(items[:])`) or copy defensively inside.

The one thing that *looks* like an exception is a function that reassigns an
attribute — `obj.field = ...`. That is not rebinding a caller's name; it is
mutating the object `obj` refers to, by writing into its `__dict__`. Same rule.

## Where the "reference" intuition breaks

People coming from C++ reach for "pass by reference" and then get surprised
twice:

```python
def bump(n):
    n += 1        # n is an int: rebinds the LOCAL name to a new object
    return n

count = 5
bump(count)
print(count)      # 5 — unchanged
```

and

```python
def clear(cfg):
    cfg = {}      # rebinds local name; caller's dict untouched
def clear2(cfg):
    cfg.clear()   # mutates the caller's dict

settings = {"a": 1}
clear(settings);  print(settings)   # {'a': 1}
clear2(settings); print(settings)   # {}
```

Both behave identically under the model: `n += 1` and `cfg = {}` are rebindings
of a local name; `cfg.clear()` is a mutation of a shared object. Nothing about
the *parameter* changed between the two functions — only whether the body
mutated or rebound.

## Making functions honest about mutation

Two conventions the standard library uses and you should copy:

```python
items.sort()          # mutates, returns None
sorted(items)         # returns a new list, leaves the argument alone

lst.reverse()         # mutates, returns None
reversed(lst)         # returns a new iterator
```

**Returning `None` from a mutating function is deliberate.** It makes
`x = items.sort()` fail loudly instead of quietly binding `None`, and it stops
callers from assuming a copy came back. If you write a function that both mutates
its argument and returns it, you have created an API where the caller cannot tell
which happened — and someone will eventually write
`b = normalise(a)` and be astonished that `a` changed.

If you need to guarantee the caller is unaffected, copy on entry, at the widest
point where it is cheap:

```python
def normalise(headers):
    headers = {k.lower(): v for k, v in headers.items()}   # our own dict now
    headers.setdefault("accept", "*/*")
    return headers
```

## `del` deletes a name, not an object

```python
a = [1, 2]
b = a
del a          # removes the name 'a' from the namespace
print(b)       # [1, 2] — the object is fine; only one label went away
print(a)       # NameError
```

`del a` unbinds the name. The object is freed only when nothing refers to it any
more — CPython uses reference counting plus a cycle collector, so "nothing refers
to it" includes references you forgot about: a list you appended it to, a cache,
a closure, a live traceback held by `sys.last_value`, or the REPL's `_`.

`del` has three distinct jobs that share a keyword:

| Form | What it does |
|---|---|
| `del name` | Unbinds a name in the current namespace |
| `del obj.attr` | Calls `__delattr__` — mutates the object |
| `del lst[i]` / `del d[key]` | Calls `__delitem__` — mutates the container |

Only the first is name deletion. The other two are ordinary mutations and are
visible through every alias, exactly like `append`.

## Gotchas

**Symptom:** a function you called "returns a new list" but your original list changed too
**Cause:** you passed the object itself; the function mutated it in place
**Fix:** pass a copy at the call site (`f(items[:])`, `f(dict(cfg))`) or, if you own the function, copy on entry and return the copy. Make the answer to "does this mutate my argument?" readable from the signature or the docstring

**Symptom:** you assigned to a parameter inside a function expecting the caller to see it
**Cause:** assignment rebinds a local name; Python has no out-parameters
**Fix:** return the new value and have the caller rebind. For multiple outputs, return a tuple and unpack at the call site

**Symptom:** `del obj` did not free memory, or did not run `__del__`
**Cause:** `del` removes one binding; other references keep the object alive — a container, a cache, a closure, a traceback, the REPL's `_`
**Fix:** find the other reference. `del` is not `free()` and must never be used as one. If you are hunting a leak, look for the container that is still holding the object, not for a missing `del`

**Symptom:** `del` inside a loop over a list skips elements
**Cause:** `del lst[i]` mutates the list you are iterating; the iterator's index keeps advancing over a shortened sequence
**Fix:** build a new list (`lst = [x for x in lst if keep(x)]`) or iterate over a copy (`for x in lst[:]`). Never mutate the container you are iterating

## Interview questions

**★ Is Python call-by-value or call-by-reference?**
Neither, and asserting either will get you into trouble. Python passes object
references *by value*: the parameter is a fresh local name bound to the same
object the caller passed. So a function can mutate the object (visible to the
caller) but cannot rebind the caller's name (invisible). The precise term is
call-by-binding, or call-by-sharing. The one-line test: `items.append(1)` affects
the caller; `items = [1]` does not.

**★ Can a function change which object a caller's variable refers to?**
No. A function can rebind names in its own locals and — with `global` or
`nonlocal` — in the module or an enclosing scope. It can never reach into the
caller's frame to rebind a name. It can mutate any mutable object it was handed,
which is often mistaken for the same thing, and it can set attributes on an
object, which is also mutation.

**How do you decide whether a function should mutate its argument or return a new object?**
Pick one per function and make it obvious in the name and the return value.
`sort()` mutates and returns `None`; `sorted()` returns a new list. Returning
`None` from a mutator is deliberate: it makes `x = items.sort()` fail loudly. A
function that mutates *and* returns the same object is the worst option, because
the caller cannot tell which contract they got. If mutation is incidental to the
purpose, copy on entry — the cost is almost always trivial next to the debugging
cost of a shared-object surprise.

**What is `del x` and when would you actually use it?**
It removes the binding `x` from its namespace; the object is collected only if
nothing else references it. Legitimate uses: dropping a name in a long-lived
scope so a large object can be collected, removing a temporary you do not want
leaking out of a module namespace, and the container forms `del d[key]` /
`del lst[i]`, which are mutations rather than name deletion. It is not a
`free()`, and it is not a way to force `__del__` to run.

**A colleague says "Python copies small objects and shares large ones." What is wrong with that?**
Everything. Python never copies on assignment or on call, regardless of size. The
appearance of copying for small objects comes from immutability — you cannot
observe sharing of an `int` because nothing can change it — not from any
size-based policy. The distinction that matters is mutable versus immutable, and
it is a property of the type.

---

← Prev: [Names and objects](01-names-and-objects.md) · Index: [Everything is an object](README.md) · Next → [Default arguments](02b-default-arguments.md)
