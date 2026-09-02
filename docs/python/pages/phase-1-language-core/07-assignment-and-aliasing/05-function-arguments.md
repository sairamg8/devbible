---
title: "Arguments are passed by assignment, which means rebinding a parameter is invisible to the caller and mutating one is visible to everybody"
sidebar_label: "5 · Function arguments"
sidebar_position: 77
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Programming FAQ — "How do I write a function with output parameters (call by reference)?"](https://docs.python.org/3.14/faq/programming.html#how-do-i-write-a-function-with-output-parameters-call-by-reference),
> [§8.7 Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions),
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> and the [glossary](https://docs.python.org/3.14/glossary.html#term-parameter).
> Target: **CPython 3.14**.

**Python is neither call-by-value nor call-by-reference, and arguing about
which it is wastes the afternoon. The FAQ gives the operational answer in one
sentence — *"Remember that arguments are passed by assignment in Python"* — and
that single fact predicts everything: a parameter name is bound to the caller's
object exactly as `param = arg` would bind it, so rebinding the parameter
rewires only the callee's local name, while calling a mutating method reaches
through to the caller's object.**

## The FAQ's sentence, and why it settles the argument

> *"Remember that arguments are passed by assignment in Python. Since assignment
> just creates references to objects, there's no alias between an argument name
> in the caller and callee, and consequently no call-by-reference."*

Read the middle clause carefully: *no alias between the argument **name** in
the caller and the parameter **name** in the callee.* The two names are
independent. What they are both bound to is the same object. That is why:

- It is **not call by value** — nothing was copied, and the callee can mutate
  the caller's data.
- It is **not call by reference** — the callee cannot rebind the caller's name;
  there is no out-parameter, no `&x`, no `ref`.

The name the literature uses for this arrangement is **call by sharing** (also
"call by object reference"): the argument and the parameter *share* an object.
The Python docs do not use that term; they describe the mechanism instead, and
the mechanism is what you should reason with.

## The two functions, side by side

The FAQ gives both, with their outputs:

> ```python
> >>> def func1(a, b):
> ...     a = 'new-value'        # a and b are local names
> ...     b = b + 1              # assigned to new objects
> ...     return a, b            # return new values
> ...
> >>> x, y = 'old-value', 99
> >>> func1(x, y)
> ('new-value', 100)
> ```

`x` and `y` are unchanged. Both statements in `func1` are *rebindings* of local
names.

> ```python
> >>> def func2(a):
> ...     a[0] = 'new-value'     # 'a' references a mutable list
> ...     a[1] = a[1] + 1        # changes a shared object
> ...
> >>> args = ['old-value', 99]
> >>> func2(args)
> >>> args
> ['new-value', 100]
> ```

`args` is changed. Both statements in `func2` are *item assignments* on the
shared object. Nothing about the calling convention differs between the two
functions; only the target form of the assignments inside them.

## The one-screen version to keep in your head

```python
def f(items):
    items = []          # rebind: caller sees nothing
    items.append(1)     # ...and this now appends to the LOCAL list, not the caller's

def g(items):
    items.append(1)     # mutate: caller sees [.., 1]
    items[:] = []       # mutate: caller's list is now empty
    items.clear()       # mutate: same
```

`f` is the classic broken "clear the list" helper. The first line severed the
connection to the caller's object, so everything after it operates on a list
nobody else will ever see.

## Parameters are names; arguments are objects

The FAQ's terminology entry is worth having straight, because interview
questions use both words:

> *"Parameters are defined by the names that appear in a function definition,
> whereas arguments are the values actually passed to a function when calling
> it."*

So "mutating the argument" is accurate and "mutating the parameter" is not
quite — you rebind a parameter and you mutate an argument.

## `*args` and `**kwargs` are fresh containers

A useful asymmetry. The reference:

> *"If the form `*identifier` is present, it is initialized to a tuple receiving
> any excess positional parameters, defaulting to the empty tuple. If the form
> `**identifier` is present, it is initialized to a new ordered mapping
> receiving any excess keyword arguments, defaulting to a new empty mapping of
> the same type."*

So inside the function:

```python
def h(**kwargs):
    kwargs["injected"] = True     # safe: kwargs is a NEW dict, per call

d = {"a": 1}
h(**d)                             # d is untouched — ** unpacks into the new dict
```

Mutating `kwargs` never touches the caller's dict, because `**d` at the call
site copies the *mapping* into the function's new dict. But it is only one
level deep: `kwargs["a"]` is still the caller's object, so
`kwargs["a"].append(...)` reaches through. Same for `*args` — a new tuple
holding the caller's objects.

This is the one place Python gives you a free defensive copy, and it is exactly
one level.

## Return values are aliases too

```python
def get_defaults():
    return DEFAULTS          # the module-level dict itself

cfg = get_defaults()
cfg["debug"] = True          # you just edited DEFAULTS for the whole process
```

The call boundary is symmetric: handing an object *out* aliases it just as
surely as taking one *in*. Any function returning a mutable object that it also
keeps has published a handle to its own state — the same defect as the leaky
getter in [Aliasing](03-aliasing.md), and the mechanism behind the
`lru_cache` failure in
[Caches and long-lived workers](11c-caches-workers-and-orm.md).

## When mutating an argument is the right design

It is not always wrong. In-place APIs exist because copying is expensive:

- `list.sort()`, `random.shuffle(x)`, `heapq.heappush(h, x)` — the caller
  explicitly asked for an in-place operation, and the name says so.
- Large buffers: `readinto(buf)`, NumPy's `out=` parameter, `array.array`
  slices — copying a 200 MB array to avoid a mutation is worse than the
  mutation.
- Accumulators the caller owns and passed on purpose: `collect(results)`.

What makes those acceptable is that the mutation is the *documented purpose* of
the call, visible in the name, and the function returns `None` so the caller
cannot mistake it for a pure one. What makes mutation a bug is when it is a
side effect of a function whose name promises a computation —
`validate(order)`, `render(context)`, `calculate_totals(rows)`. Those should
not touch their inputs, and how to make sure they do not is
[Saying "don't touch mine"](05b-dont-touch-mine.md).

## Gotchas

### A helper that "empties" a list does nothing
**Symptom.** `reset(items)` runs, the caller's list still has every element.
**Cause.** The helper did `items = []`, rebinding its local parameter.
**Fix.** `items.clear()` or `items[:] = []` if in-place is the contract; better,
return a new empty list and let the caller rebind.

### A pure-sounding function corrupts its input
**Symptom.** Calling `calculate_totals(rows)` twice gives different answers;
running a test in isolation passes and running the suite fails.
**Cause.** The function sorts, pops, or `+=`s its argument. The second call sees
data the first call modified.
**Fix.** Copy at the top of the function (`rows = list(rows)`), or restructure
to build a new structure. Add a test that asserts the input is unchanged:
`before = copy.deepcopy(rows); f(rows); assert rows == before`.

### `f(*args)` believed to protect the elements
**Symptom.** A function that takes `*items` still mutates the caller's objects.
**Cause.** The new tuple protects the *sequence*, not the elements. The
elements are the caller's objects.
**Fix.** Copy the elements if you need to, or accept immutable element types.

### A getter returns the live collection
**Symptom.** `service.get_config()["timeout"] = 1` changes behaviour globally.
**Cause.** The function returned its internal object, not a copy or a view.
**Fix.** Return `types.MappingProxyType(self._cfg)`, `dict(self._cfg)`, or a
frozen dataclass — see
[Read-only views and boundary types](10b-read-only-views-and-boundaries.md).

### Mutating and returning
**Symptom.** Two callers of the same function disagree about whether the input
changed; a refactor that adds a copy breaks one of them.
**Cause.** The function both mutates its argument and returns it, so callers
could not tell which behaviour they depended on.
**Fix.** Pick one. Mutate and return `None` (the stdlib convention), or leave
the input alone and return a new object. Never both.

### A default argument used as the "empty" case
**Symptom.** State leaks between unrelated calls.
**Cause.** `def f(items=[])` — the default object is created once at definition
time and shared by every call that omits the argument.
**Fix.** The `None` sentinel; the whole story is in
[The mutable default argument](06-mutable-default-argument.md).

## Interview questions

**★ Q: Is Python call by value or call by reference?**
Neither, and the FAQ's phrasing is the useful one: *"arguments are passed by
assignment"*. The parameter name is bound to the same object the argument
expression produced. Rebinding the parameter affects only the callee's
namespace (so it is not call by reference), but the callee can mutate the
shared object (so it is not call by value). The common name for this is call by
sharing.

**★ Q: Show me a function that changes its caller's list and one that does
not.**
`def g(xs): xs.append(1)` changes it — item/method mutation reaches the shared
object. `def f(xs): xs = xs + [1]` does not — it builds a new list and rebinds
the local name. The difference is entirely in the statement inside the
function, not in how the call was made.

**★ Q: How do you write a function that must not modify its arguments?**
Take a copy at the top (`items = list(items)` for one level,
`copy.deepcopy(items)` for a nested structure), or require immutable types in
the signature and convert at the boundary, or simply never call a mutating
method or assign to an item/attribute of an argument. A type annotation of
`Sequence[int]` documents the intent and a type checker will flag `.append`,
but nothing enforces it at runtime.

**Q: Does mutating `kwargs` inside a function affect the caller's dict?**
No. The reference says `**identifier` *"is initialized to a new ordered
mapping"*, and `f(**d)` at the call site copies `d`'s items into that new
mapping. But the *values* are the caller's objects, so mutating
`kwargs["config"]` does reach the caller.

**Q: `def f(x): x += [1]` versus `def f(x): x = x + [1]` — do they differ for
the caller?**
Yes, decisively. `x += [1]` calls `list.__iadd__`, which extends the caller's
list in place. `x = x + [1]` builds a new list and rebinds the local name,
leaving the caller's list alone. See
[Augmented assignment](04-augmented-assignment.md).

**Q: When is it acceptable for a function to mutate its argument?**
When that is the function's stated job and its name says so — `sort`,
`shuffle`, `extend`, `readinto`, `update` — and when it returns `None` so
callers cannot confuse it with a pure function. It is also acceptable when the
data is large enough that copying is the real cost, provided the contract is
documented.

**Q: How would you detect, in a test, that a function is mutating its input?**
Deep-copy the input before the call and assert equality afterwards:
`before = copy.deepcopy(payload); handler(payload); assert payload == before`.
For big inputs, hash a serialisation instead. Either way, make it a test rather
than a convention.

---

← Prev: [Raises *and* mutates](04b-tuple-item-raises-and-mutates.md) · Index: [Assignment and aliasing](README.md) · Next → [Saying "don't touch mine"](05b-dont-touch-mine.md)
