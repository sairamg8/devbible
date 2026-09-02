---
title: "The `None` sentinel is the documented fix, but the choice between it, an empty tuple, a private sentinel and a factory is a design decision with different failure modes"
sidebar_label: "6b · Fixing mutable defaults"
sidebar_position: 80
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§8.7 Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions),
> the [Programming FAQ — "Why are default values shared between objects?"](https://docs.python.org/3.14/faq/programming.html#why-are-default-values-shared-between-objects),
> and [`functools`](https://docs.python.org/3.14/library/functools.html).
> Target: **CPython 3.14**.

**Knowing that `def f(items=[])` is broken is the easy half. The other half is
that there are four repairs, they are not interchangeable, and the most
commonly written one — `items = items or []` — reintroduces a different bug.
This chunk is the repair manual: which fix, when, what each one costs, and the
handful of cases where a mutable default is the deliberate and correct thing to
write.**

## The fixes, in order of preference

**1 — `None` sentinel.** The documented answer, and correct whenever `None` is
not a meaningful value for the parameter:

```python
def f(items: list[int] | None = None) -> list[int]:
    if items is None:
        items = []
    items.append(1)
    return items
```

Note the annotation: `list[int] | None`, not `list[int]`. A checker will
otherwise complain, and the signature should tell the truth about what callers
may pass.

**2 — a private sentinel object**, when `None` is a legal argument value and
you must distinguish "not supplied" from "supplied as `None`":

```python
_UNSET = object()

def update(name=_UNSET, email=_UNSET):
    if name is not _UNSET:
        self.name = name          # allows update(name=None) to mean "clear it"
```

**3 — do not mutate the default at all.** If the function only *reads* the
default, a mutable default is harmless in behaviour — but it is still a lint
error and still one refactor away from being a bug, so the empty-tuple form is
better:

```python
def f(items: Sequence[int] = ()) -> list[int]:
    return [x * 2 for x in items]     # () is immutable; nothing can accumulate
```

`()`, `""`, `0`, `frozenset()` and `None` are all safe defaults. An empty tuple
is the underrated one: it reads as "no items", it is falsy, it is iterable, and
it cannot accumulate.

**4 — a factory parameter**, when the caller should decide:

```python
def f(factory: Callable[[], list] = list):
    items = factory()
```

This is the same `default_factory` idea dataclasses formalise — see
[Dataclass defaults and linting](06c-dataclass-defaults-and-linting.md).

## The uses that are deliberate

The FAQ documents the memoisation idiom, which exploits exactly the shared
default:

> ```python
> # Callers can only provide two parameters and optionally pass _cache by keyword
> def expensive(arg1, arg2, *, _cache={}):
>     if (arg1, arg2) in _cache:
>         return _cache[(arg1, arg2)]
>
>     # Calculate the value
>     result = ... expensive computation ...
>     _cache[(arg1, arg2)] = result           # Store result in the cache
>     return result
> ```
>
> *"You could use a global variable containing a dictionary instead of the
> default value; it's a matter of taste."*

Two other legitimate uses:

```python
# Late-binding closure fix: capture the CURRENT value of i as a default
handlers = [lambda event, i=i: process(event, i) for i in range(3)]

# Micro-optimisation: bind a global to a local at def time (hot inner loops only)
def tight(data, _len=len, _range=range): ...
```

All three are recognisable by the underscore-prefixed or explicitly-bound
parameter name — the signal that the parameter is not part of the public
signature. If you write one, comment it, because the next reader will assume it
is the bug.

## In a long-lived process this is a leak

A default `[]` or `{}` that accumulates lives as long as the module, which in a
web worker means as long as the process. Requests append to it forever: memory
grows, and — much worse — one user's data is visible to the next request that
takes the default path. This is the failure walked through in
[Where it bites](11-where-it-bites.md), and it is the reason this
particular gotcha is tiered Master rather than filed as trivia.

## Gotchas

### The `None` fix written as `items = items or []`
**Symptom.** Passing an empty list that the function should have filled leaves
the caller's list empty.
**Cause.** `or` triggers on any falsy value, so an explicitly passed `[]` is
replaced by a *different* new list — the caller's list is silently discarded.
**Fix.** `if items is None:` — test for the sentinel, not for truthiness.
See **Truthiness** *(not written yet)*.

### A default that is a mutable module-level constant
**Symptom.** `def f(opts=DEFAULT_OPTS)` and one caller's `opts["x"] = 1` edits
the module constant for everyone.
**Cause.** The default is a reference to the shared object, exactly like any
other alias.
**Fix.** `opts=None` plus `opts = {**DEFAULT_OPTS, **(opts or {})}` in the body,
which also gives callers sane merge semantics.

### The lint is silenced because "we only read it"
**Symptom.** `# noqa: B006` on a default that is genuinely never mutated —
until someone adds a line six months later.
**Cause.** The safety depended on the body, not on the signature.
**Fix.** Use `()` or `None`. The immutable default costs nothing and removes
the dependence on future behaviour.

### The sentinel is `None` but `None` is a valid value
**Symptom.** `update(name=None)` meant "clear the name" and instead means "do
not change the name" — or vice versa. The API cannot express one of the two.
**Cause.** `None` was used both as "argument omitted" and as a domain value.
**Fix.** A private module-level sentinel: `_UNSET = object()`, tested with
`is`. `object()` instances compare only by identity, so no caller value can
collide with it. Type it as `Any` or a small `Literal`-free alias and document
it; some codebases use `enum.Enum` with a single member so the repr is
readable.

### `functools.partial` used to "fix" the default
**Symptom.** `f2 = functools.partial(f, items=[])` and the accumulation
continues.
**Cause.** The list is evaluated once, when `partial` is called, and stored on
the partial object. It is the identical mechanism one level out.
**Fix.** `None` in the underlying function. `partial` cannot supply a fresh
object per call; only a factory called inside the body can.

### The factory parameter is called at `def` time by mistake
**Symptom.** `def f(factory=list())` — note the parentheses — behaves exactly
like `def f(items=[])`.
**Cause.** `list()` is a call; `list` is the callable. One character.
**Fix.** Pass the callable, not its result: `factory=list`. This is the same
distinction as `defaultdict(list)` versus `defaultdict([])` and as
`field(default_factory=list)` versus `field(default=[])`.

## Interview questions

**★ Q: What is the correct fix, and what is wrong with `items = items or []`?**
The correct fix is a `None` sentinel with an identity test: `if items is None:
items = []`. The `or` form is subtly different — it also replaces any falsy
argument, so a caller who passes an existing empty list gets their list
discarded and silently replaced by a new one, and any mutations the function
performs never reach them.

**Q: Are there legitimate uses of a mutable default?**
Yes — the FAQ documents `def expensive(arg1, arg2, *, _cache={})` as a
memoisation idiom, and the classic `lambda event, i=i: ...` uses a default to
capture a loop variable's current value rather than closing over the name.
Both should be keyword-only or underscore-prefixed so the reader knows the
parameter is machinery, not API.

**Q: A function's default is a module-level `DEFAULT_CONFIG` dict. Is that
safe?**
No. The default is a reference to that dict, so any caller who mutates the
parameter mutates the module constant for the whole process — the same bug with
a longer blast radius, because the object is also reachable by name from
everywhere else.

**★ Q: When would you use a sentinel object instead of `None`?**
When `None` is a legal value the caller may pass and you must distinguish it
from "not supplied". `def update(email=None)` cannot express "set email to
null"; `_UNSET = object()` with `if email is not _UNSET` can. The sentinel must
be compared with `is`, and it should be module-private so no caller can
accidentally pass it.

**Q: Why is `()` a better default than `None` for a read-only sequence
parameter?**
Because it removes a branch and a type. `def f(items: Sequence[int] = ())`
needs no `if items is None`, its annotation is honest, and callers can pass a
list, a tuple or a generator's result. Use `None` when the function needs to
distinguish "no argument" from "empty argument", and `()` when it does not.

**Q: `def f(x=[], y=len(x))` — is that legal?**
Defaults are evaluated left to right in the enclosing scope, not in the
function's own namespace, so `x` in `len(x)` refers to whatever `x` means
*outside* the function — a `NameError` if nothing does. This is a good reason
never to write interdependent defaults; compute them in the body.

**Q: Your team wants to allow one mutable default for a memo cache. How do you
make it safe to review?**
Make the parameter keyword-only and underscore-prefixed (`*, _cache={}`), so it
is not part of the callable signature callers use, and comment why. Better
still, use `functools.lru_cache` or `functools.cache`, which express the intent
in one decorator — and read
[Caches and long-lived workers](11c-caches-workers-and-orm.md) first,
because a cache that returns mutable objects has its own aliasing problem.

---

← Prev: [The mutable default argument](06-mutable-default-argument.md) · Index: [Assignment and aliasing](README.md) · Next → [Dataclass defaults and linting](06c-dataclass-defaults-and-linting.md)
