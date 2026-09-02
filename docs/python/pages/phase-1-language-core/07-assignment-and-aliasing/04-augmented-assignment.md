---
title: "`+=` mutates a list in place and rebinds a name for an int, so the same three characters are visible to your aliases or invisible to them depending on the type"
sidebar_label: "4 · Augmented assignment"
sidebar_position: 75
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2.1 Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements),
> the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-did-changing-list-y-also-change-list-x),
> [§3.3.8 Emulating numeric types](https://docs.python.org/3.14/reference/datamodel.html#emulating-numeric-types),
> and [`list`](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types).
> Target: **CPython 3.14**.

**Augmented assignment is the one operator in Python whose observable effect
depends on the type of its left operand. For a `list`, `x += y` calls
`__iadd__`, extends the existing object and every alias sees it. For an `int`,
`str` or `tuple`, there is no `__iadd__`, so it computes a new object and
rebinds the name, and no alias sees anything. The FAQ's summary — *"`+=` mutates
lists but not tuples or ints"* — is the whole thing, and it is why `x += [1]`
and `x = x + [1]` are not interchangeable.**

## What the statement actually does

The reference:

> *"An augmented assignment evaluates the target […] and the expression list,
> performs the binary operation specific to the type of assignment on the two
> operands, and assigns the result to the original target. The target is only
> evaluated once."*

> *"An augmented assignment statement like `x += 1` can be rewritten as
> `x = x + 1` to achieve a similar, but not exactly equal effect. In the
> augmented version, `x` is only evaluated once. Also, when possible, the
> actual operation is performed in-place, meaning that rather than creating a
> new object and assigning that to the target, the old object is modified
> instead."*

and on ordering:

> *"Unlike normal assignments, augmented assignments evaluate the left-hand
> side before evaluating the right-hand side. For example, `a[i] += f(x)` first
> looks-up `a[i]`, then it evaluates `f(x)` and performs the addition, and
> lastly, it writes the result back to `a[i]`."*

> *"For targets which are attribute references, the same caveat about class and
> instance attributes applies as for regular assignments."*

Three facts follow. The target expression is evaluated **once** — so
`d[expensive_key()] += 1` calls `expensive_key` once, unlike the expanded form.
The read happens **before** the right-hand side — so if `f(x)` mutates `a`, the
value being added to is the pre-mutation one. And there is **always a store at
the end**, even when the operation was performed in place; that final store is
the whole subject of [the tuple case](04b-tuple-item-raises-and-mutates.md).

## The protocol

`x += y` tries `type(x).__iadd__(x, y)` first. If the type defines it, the
method may mutate `x` and return `x` (or return anything else); whatever comes
back is then **assigned to the target**. If the type has no `__iadd__`, Python
falls back to `__add__`/`__radd__`, producing a new object, which is then
assigned. Either way, the assignment happens.

The FAQ spells out the list case:

> *"(a) if an object implements an `__iadd__()` magic method, it gets called
> when the `+=` augmented assignment is executed, and its return value is what
> gets used in the assignment statement; and (b) for lists, `__iadd__()` is
> equivalent to calling `extend()` on the list and returning the list."*

and shows the equivalence:

> ```python
> >>> result = a_list.__iadd__([1])
> >>> a_list = result
> ```
>
> *"The object pointed to by a_list has been mutated, and the pointer to the
> mutated object is assigned back to a_list. The end result of the assignment
> is a no-op, since it is a pointer to the same object that a_list was
> previously pointing to, but the assignment still happens."*

## The alias table

```python
shared = [1, 2]
mine = shared

mine += [3]          # __iadd__ → extend. shared is now [1, 2, 3].
mine = mine + [4]    # __add__ → new list. shared stays [1, 2, 3].
```

| Type | `x += y` | Aliases of `x` see it? |
|---|---|---|
| `list` | `list.extend` in place | **yes** |
| `set` | `set.update` in place (`\|=`, `&=`, `-=`, `^=`) | **yes** |
| `bytearray`, `array.array`, `deque` | in place | **yes** |
| `dict` | no `__iadd__`; `d \|= other` **is** in place (PEP 584) | **yes for `\|=`** |
| `int`, `float`, `Decimal`, `Fraction`, `complex` | new object, rebind | no |
| `str`, `bytes`, `tuple`, `frozenset` | new object, rebind | no |
| your class | whatever you implemented, or `__add__` fallback | you decide |

`dict` is the one worth memorising separately: `d += other` is a `TypeError`,
but `d |= other` was added by PEP 584 and is an in-place update — the same
semantics as `d.update(other)`, visible to every alias, while `d | other`
builds a new dict.

## `list.__iadd__` accepts any iterable; `list.__add__` does not

This asymmetry catches people who "simplified" a line:

```python
xs = [1, 2]
xs += "ab"        # xs == [1, 2, 'a', 'b']  — extend() accepts any iterable
xs = xs + "ab"    # TypeError: can only concatenate list (not "str") to list
xs += {"k": 1}    # appends the KEY 'k' — a dict is an iterable of keys
```

So `+=` is strictly more permissive than `+` for lists, and its permissiveness
is the kind that turns a string into four separate characters in your result
list without an exception. When the operand's type is not obviously a list,
write `xs.extend(...)` if you mean extend and `xs.append(...)` if you mean
append; the explicit method names make the intent reviewable.

## `+=` on a name in an enclosing scope

```python
total = 0

def add(n):
    total += n        # UnboundLocalError: cannot access local variable 'total'
```

Augmented assignment is an assignment, so it makes `total` local for the entire
function body; the read half then finds an unbound local. The two fixes differ
in kind: `global total` / `nonlocal total` makes the rebinding hit the outer
namespace, while switching to a mutable accumulator (`totals.append(n)`,
`counter["total"] += n`) sidesteps binding entirely because the outer name is
only ever read. The second is usually the better design and is also why
`counter[k] += 1` works inside a function with no declaration at all — the
target is a subscript, not a name.

## `self.x += 1` on a class attribute quietly forks it

```python
class Counter:
    count = 0                 # class attribute

    def bump(self):
        self.count += 1       # reads Counter.count, writes self.count
```

The read resolves through the class, the write always goes to the instance, so
the first `bump()` creates an *instance* attribute shadowing the class one.
Every instance now counts independently and `Counter.count` stays `0`. This is
the benign half of a trap whose malignant half — a mutable class attribute
where `+=` never rebinds — is [class-attribute
aliasing](07-class-attribute-aliasing.md).

## String concatenation in a loop

`str` has no `__iadd__`, so `s += chunk` builds a new string every time and the
loop is quadratic in principle. CPython contains an optimisation that resizes
the string in place when the target is a simple local name and the reference
count is one, which often makes it behave linearly — but it is an
implementation detail with fragile preconditions (it does not apply if anything
else holds a reference), it is absent from other implementations, and it is not
something to design around. `"".join(parts)` is the idiom, and it is also
honest about the allocation.

## Gotchas

### A function `+=`s a list parameter and the caller's data grows
**Symptom.** A helper "returns" a combined list and the caller's original list
has the extra items too.
**Cause.** `items += extra` extends in place. The parameter is an alias of the
caller's list.
**Fix.** `items = items + extra` (new object, caller untouched), or
`result = [*items, *extra]`, or copy at the top of the function. Pick one and
document which the function does.

### `total += n` inside a function raises `UnboundLocalError`
**Symptom.** An error on the first line that touches a module-level counter.
**Cause.** Any assignment to a bare name in a function makes it local for the
whole body; the read half of `+=` then finds it unbound.
**Fix.** `global`/`nonlocal` if a rebinding is genuinely intended, or restructure
to return the value, or accumulate into a mutable object.

### `xs += some_string` splatters characters into a list
**Symptom.** `['a', 'b', 'c']` where you expected `['abc']`.
**Cause.** `list.__iadd__` is `extend`, which accepts any iterable, and a string
is an iterable of characters.
**Fix.** `xs.append(some_string)`. Reserve `+=` for cases where the operand is
obviously a list.

### `Counter.total += 1` but `Counter.total` stays 0
**Symptom.** A class-level counter never increases; each instance has its own.
**Cause.** Augmented assignment on `self.attr` reads through the class and
writes to the instance, forking the attribute on first use.
**Fix.** Write to the class explicitly — `type(self).count += 1` or
`Counter.count += 1` — and be aware that a class-level mutable counter is
shared state with all the thread-safety questions that implies.

### `a[i] += f(x)` where `f` mutates `a`
**Symptom.** An off-by-one or a lost update in code that looks atomic.
**Cause.** The reference specifies the left side is read first, then the right
side is evaluated, then the result is stored. `f(x)`'s mutation happens between
the read and the store and is overwritten by it.
**Fix.** Split the statement, and do not mutate a container from inside an
expression that is also writing to it.

### `s += chunk` in a hot loop
**Symptom.** A string-building loop that is fine on 1,000 items and pathological
on 1,000,000.
**Cause.** `str` is immutable; each `+=` in principle allocates and copies. The
CPython in-place-resize optimisation applies only under narrow refcount
conditions and is not a guarantee.
**Fix.** Collect into a list and `"".join(parts)`, or write into an
`io.StringIO`.

### `xs *= n` on a caller's list
**Symptom.** A helper "repeats" a sequence and the caller's list is now n times
longer.
**Cause.** `list.__imul__` repeats in place, and it repeats *references*, so
the extra elements are the same objects as the originals.
**Fix.** `xs = xs * n` for a new list, and see
[Repetition and shared references](03b-repetition-and-shared-refs.md)
for why the repeated elements are shared either way.

### `d = d | other` where `d |= other` was needed (or vice versa)
**Symptom.** Config merges that do or do not propagate to other holders of the
dict, inconsistently.
**Cause.** PEP 584 gave dicts both operators with the usual split: `|` builds a
new dict, `|=` updates in place.
**Fix.** Choose on the aliasing question, not on brevity. If other modules hold
the dict and must see the merge, `|=`; if they must not, `|`.

## Interview questions

**★ Q: Is `x += y` the same as `x = x + y`?**
Not exactly. The reference says it can be rewritten that way "to achieve a
similar effect, but not exactly equal": the target is evaluated only once, and
if the type defines `__iadd__` the operation is performed in place on the
existing object rather than producing a new one. For a list that difference is
visible to every other reference to the list; for an int it is not visible at
all.

**★ Q: `a = [1, 2]; b = a; b += [3]` — what is `a`?**
`[1, 2, 3]`. `list.__iadd__` is equivalent to `extend`, mutating the shared
object. Had you written `b = b + [3]`, `a` would still be `[1, 2]` because a new
list would have been built and only `b` rebound.

**★ Q: Why does `total += 1` raise `UnboundLocalError` for a module-level
`total`?**
Because augmented assignment is an assignment, and assigning to a bare name
anywhere in a function body makes that name local for the entire body. The read
side of `+=` then looks up an unbound local rather than falling back to the
global. Declare `global total`, or accumulate into a mutable object whose name
is only read.

**Q: Which built-in types implement `__iadd__`?**
The mutable ones: `list`, `set` (via `|=`, `&=`, `-=`, `^=`), `bytearray`,
`array.array`, `collections.deque`, and `dict` for `|=` since PEP 584.
Immutable types — `int`, `float`, `str`, `bytes`, `tuple`, `frozenset` — do
not, so `+=` on them falls back to `__add__` and rebinds.

**Q: In `a[i] += f(x)`, what is the evaluation order?**
The reference states it precisely — *"augmented assignments evaluate the
left-hand side before evaluating the right-hand side"* — so `a[i]` is read
first, then `f(x)` is evaluated, then the addition is performed, then the
result is written back to `a[i]`. Also, `a` and `i` are evaluated only once, unlike in the expanded
`a[i] = a[i] + f(x)`.

**Q: Why does `xs += "abc"` work when `xs + "abc"` is a `TypeError`?**
`list.__add__` requires another list. `list.__iadd__` is `list.extend`, which
accepts any iterable, and a string is an iterable of one-character strings. So
the augmented form succeeds and appends three separate elements.

**Q: Does `s += x` on strings run in linear or quadratic time?**
Semantically quadratic: strings are immutable, so each step allocates a new
string and copies. CPython has an optimisation that can resize in place when
the target is a simple local with a reference count of one, which often makes
loops behave linearly, but it is an implementation detail with preconditions
you cannot see in the source. Use `"".join()`.

**Q: `self.count += 1` where `count` is a class attribute — what happens on the
first call?**
The read finds `count` on the class (value `0`), adds one, and the store creates
an *instance* attribute `count = 1` that shadows the class attribute from then
on. The class attribute remains `0`, and every instance ends up with its own
counter, which is almost never what the author intended.

---

← Prev: [Repetition and shared references](03b-repetition-and-shared-refs.md) · Index: [Assignment and aliasing](README.md) · Next → [The tuple item that raises and mutates](04b-tuple-item-raises-and-mutates.md)
