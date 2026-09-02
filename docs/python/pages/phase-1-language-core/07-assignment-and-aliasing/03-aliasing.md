---
title: "Aliasing is two names reaching one object, and it is harmless for immutable objects and the source of every surprise for mutable ones"
sidebar_label: "3 · Aliasing: two names, one object"
sidebar_position: 73
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-did-changing-list-y-also-change-list-x),
> [§3.1 Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> the [glossary](https://docs.python.org/3.14/glossary.html#term-immutable),
> and [Built-in Types](https://docs.python.org/3.14/library/stdtypes.html).
> Target: **CPython 3.14**.

**An alias is a second route to the same object. Python creates them
constantly — assignment, argument passing, returning, putting an object into a
container, closing over it, storing it on `self` — and gives you no notification
that it did. For an immutable object that is a pure optimisation you can never
observe. For a mutable object it means a write through any one route is visible
through all of them, which is why the mutable/immutable split is not trivia
but the load-bearing distinction in the language.**

## The FAQ's own walkthrough

> ```python
> >>> x = []
> >>> y = x
> >>> y.append(10)
> >>> y
> [10]
> >>> x
> [10]
> ```
>
> *"There are two factors that produce this result: 1. Variables are simply
> names that refer to objects. […] 2. Lists are mutable, which means that you
> can change their content."*

Remove either factor and the surprise vanishes. Take away aliasing (make a
copy) and `x` is untouched. Take away mutability (use a tuple) and there is no
`append` to call. Every fix in this topic is one of those two moves.

The FAQ then contrasts with an immutable object, and the phrasing is worth
keeping:

> *"integers are immutable, and when we do `x = x + 1` we are not mutating the
> int 5 by incrementing its value; instead, we are creating a new object (the
> int 6) and assigning it to x (that is, changing which object x refers to)."*

## Which built-ins are which

| Mutable | Immutable |
|---|---|
| `list`, `dict`, `set`, `bytearray` | `int`, `float`, `complex`, `bool`, `Decimal`, `Fraction` |
| `collections.deque`, `defaultdict`, `Counter`, `OrderedDict` | `str`, `bytes`, `tuple`, `frozenset`, `range` |
| `array.array`, most class instances, `types.SimpleNamespace` | `None`, `Ellipsis`, `NotImplemented`, code objects |
| `io` buffers, locks, sockets, DB connections | `datetime`, `date`, `time`, `timedelta`, `UUID`, `Path` |

The right-hand column is the set of types you can hand to anyone without
thinking. The left-hand column is the set that needs a decision at every
boundary. Note that user-defined classes land in the left column by default:
an instance is mutable unless you did work to make it otherwise, and
"immutable-looking" is not immutable — see
[Designing away aliasing](10-designing-away-aliasing.md).

## The mutate/create pairs, and the `None` tell

Almost every mutating operation has a nearly identical non-mutating twin, and
the FAQ names the convention that distinguishes them:

> *"In general in Python (and in all cases in the standard library) a method
> that mutates an object will return `None` to help avoid getting the two types
> of operations confused. So if you mistakenly write `y.sort()` thinking it
> will give you a sorted copy of y, you'll instead end up with `None`."*

| Mutates in place (returns `None`) | Builds a new object |
|---|---|
| `items.append(x)` / `items.extend(xs)` | `items + [x]`, `[*items, x]` |
| `items.sort()` | `sorted(items)` |
| `items.reverse()` | `reversed(items)` (an iterator), `items[::-1]` |
| `items.insert(i, x)`, `items.remove(x)` | a comprehension |
| `items.clear()` | `[]` |
| `d.update(other)` | `d \| other`, `{**d, **other}` |
| `d.setdefault(k, v)` | `d.get(k, v)` |
| `s.add(x)`, `s.discard(x)`, `s \|= t` | `s \| {x}`, `s.union(t)` |
| `x[:] = new` | `x = new` |

`d.setdefault` deserves a callout: it both reads and *writes*, and the value it
inserts is the object you passed, so `d.setdefault(k, [])` hands the caller an
alias of a list now living inside `d`. That is usually the point — it is how
you build a dict of lists — but it means `d.setdefault(k, shared_default)` puts
one shared object under many keys.

`d.get(k, [])` has the opposite hazard: a fresh list is built on *every* call,
including the hits, so it is wasteful; and callers who append to the returned
list when the key was missing are appending to a list that was never stored.

## Aliases you did not write down

Assignment is the obvious one. These are the rest:

```python
def f(xs): ...      # calling f(mine) aliases mine to the parameter xs
return self._items  # a getter that returns the internal list hands out an alias
box.append(obj)     # the container now holds a reference; obj is aliased
d[key] = obj        # same
other = [obj, obj]  # ONE object, referenced twice, in one list
self.items = items  # __init__ storing the caller's list, not a copy
lambda: items       # a closure cell referring to the same object
CACHE[key] = result # the cache and the caller now share the result object
```

The getter is the most common leak in class design:

```python
class Order:
    def __init__(self):
        self._lines = []

    @property
    def lines(self):
        return self._lines       # caller can do order.lines.clear()
```

Returning `tuple(self._lines)` or `types.MappingProxyType` for a dict costs one
allocation and removes an entire class of bug — see
[Read-only views and boundary types](10b-read-only-views-and-boundaries.md).

## Nesting: a shallow copy stops one level down

```python
teams = {"a": ["ann"], "b": ["bob"]}
snapshot = dict(teams)         # new dict — but the SAME two lists
snapshot["a"].append("amy")    # teams["a"] is now ["ann", "amy"]
snapshot["c"] = ["cat"]        # this one is fine: only the new dict changed
```

The copy protected the *outer* structure and nothing inside it. Adding and
removing keys is isolated; mutating a value is not. This is the single most
common reason "I copied it and it still changed" gets said out loud, and it is
what [Shallow copy](08-shallow-copy.md) and
[deepcopy](08b-deepcopy.md) exist to settle.

## Two names, and then twenty

Aliasing scales badly because it is transitive and untracked. A list built in
`load_config()`, stored on an app object, passed to a router, captured in a
closure, and appended to a registry is one object with five routes to it, four
of which the person editing the fifth has never read. That is the shape of the
production bug in
[Where it bites: shared config](11-where-it-bites.md). The
defence is not vigilance; it is choosing immutable types or copying at exactly
one boundary and documenting which.

## Gotchas

### A "snapshot" that keeps changing
**Symptom.** `self._before = data` (or `dict(data)`) captured for an audit log
shows the post-change values.
**Cause.** Either no copy at all, or a shallow copy whose nested values are
still shared.
**Fix.** Decide the depth deliberately. For a flat dict of scalars,
`dict(data)` is enough. For anything nested, `copy.deepcopy(data)` or a
serialise-now approach (`json.dumps`) that produces a value, not a reference.

### A getter that lets callers edit your internals
**Symptom.** An object's invariants are violated and no method in the class
could have done it.
**Cause.** A property or method returned the internal `list`/`dict`/`set`
directly, so the caller mutated private state through a public alias.
**Fix.** Return a copy (`list(self._items)`), an immutable view
(`tuple(...)`, `types.MappingProxyType(self._d)`), or an iterator — and say so
in the docstring.

### `sorted_items = items.sort()`
**Symptom.** `AttributeError: 'NoneType' object has no attribute ...` a few
lines later, or a `TypeError` on iteration.
**Cause.** `sort()` mutates and returns `None` — by design, per the FAQ, so
that this exact confusion fails loudly rather than silently.
**Fix.** `sorted_items = sorted(items)` if you want a new list;
`items.sort()` on its own line if you meant to reorder in place, understanding
that everyone sharing `items` sees the new order.

### `d.setdefault(k, expensive())` evaluates the default every time
**Symptom.** A "cache" is slower than not caching.
**Cause.** Arguments are evaluated before the call, so `expensive()` runs on
hits too; `setdefault` only decides whether to *store* the result.
**Fix.** `try: d[k] except KeyError:` and compute in the handler, or
`collections.defaultdict(expensive)` when the factory takes no arguments.

### The same object appended twice
**Symptom.** Editing `rows[0]` also edits `rows[3]`.
**Cause.** The same object was put in the list more than once — commonly a
template dict reused in a loop: `for i in range(n): rows.append(template)`.
**Fix.** Build a fresh object per iteration inside the loop, or append
`dict(template)` / `copy.deepcopy(template)` and be explicit about the depth.

### An immutable "fix" that only moved the problem
**Symptom.** A `tuple` is handed out to be safe, and the contents still change.
**Cause.** A tuple's immutability is one level deep — it fixes which objects
are in it, not what those objects contain.
**Fix.** See [Immutability is shallow too](09-immutability-is-shallow.md).

## Interview questions

**★ Q: What is aliasing?**
Two or more names — or container slots, attributes, closure cells — referring
to the same object, so that a mutation performed through one is visible through
all of them. It is created by assignment, argument passing, storing an object
in a container or attribute, and returning it. Python never warns about it,
because for immutable objects it is invisible and desirable.

**★ Q: Why is `x = x + [1]` different from `x += [1]` when someone else holds
`x`?**
`x + [1]` builds a new list and rebinds the name, so the other holder still
sees the old list unchanged. `x += [1]` calls `list.__iadd__`, which extends
the existing list in place, so the other holder sees the appended element. See
[Augmented assignment](04-augmented-assignment.md).

**Q: Why do mutating methods return `None`?**
It is a deliberate stdlib-wide convention, stated in the FAQ: a method that
mutates returns `None` so that writing `y = y.sort()` fails immediately instead
of silently binding a value you did not expect. It also removes the ambiguity
of "did this return a new object or the same one?".

**Q: Which built-in types are immutable?**
`int`, `float`, `complex`, `bool`, `str`, `bytes`, `tuple`, `frozenset`,
`range`, `None`, `Ellipsis`, plus `Decimal`, `Fraction`, `datetime` and friends,
and `pathlib.Path`. Everything else you use daily — `list`, `dict`, `set`,
`bytearray`, `deque`, and instances of your own classes — is mutable.

**Q: You return `self._items` from a property. What is wrong with it?**
You have published a mutable alias of private state, so any caller can append,
clear or sort it without going through your class, bypassing every invariant
and every side effect your methods perform. Return `tuple(self._items)`, a
copy, or an iterator.

**Q: `snapshot = dict(config)` — what is and is not protected?**
The set of keys, and the top-level values' bindings: adding, removing or
replacing a key in `snapshot` does not affect `config`. Not protected: the
value objects themselves. If `config["hosts"]` is a list, both dicts point at
that one list, and appending through either is visible through both.

**Q: How do you decide between "copy at the boundary" and "use an immutable
type"?**
Copying is a runtime cost paid on every call and is easy to forget once; an
immutable type makes the mistake impossible and is checked by both the
interpreter and a type checker. Prefer the immutable type for values that cross
module boundaries or live a long time (config, domain values, cache entries),
and copy when the data is genuinely mutable working state and the copy is small.

---

← Prev: [Identity, equality and `id()`](02-identity-and-id.md) · Index: [Assignment and aliasing](README.md) · Next → [Repetition and shared references](03b-repetition-and-shared-refs.md)
