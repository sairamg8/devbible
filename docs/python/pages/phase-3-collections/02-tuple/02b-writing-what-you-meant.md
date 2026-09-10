---
title: "There are four correct rewrites of a tuple-slot augmented assignment, and picking one forces you to say whether the record is a snapshot or a scratchpad"
sidebar_label: "2b · Writing what you meant"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference on
> [Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements);
> [`dataclasses.replace`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.replace)
> and [Frozen instances](https://docs.python.org/3.14/library/dataclasses.html#frozen-instances);
> [`list.extend`](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [`set.update`](https://docs.python.org/3.14/library/stdtypes.html#frozenset.update)
> and [`dict` merge (`|=`)](https://docs.python.org/3.14/library/stdtypes.html#dict);
> the [`namedtuple._replace`](https://docs.python.org/3.14/library/collections.html#collections.somenamedtuple._replace)
> reference. Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Every occurrence of `t[i] += x` is a question the author did not answer: is this record
a snapshot that should be rebuilt, or a scratchpad that should be mutated? The four
rewrites below each answer it explicitly, and none of them can raise the way the original
does. The one that surprises people is the fourth — `+=` on a *name* bound to a tuple is
completely legal, because there is no slot being written; the name is being rebound to a
new object, and every other reference to the old one is unaffected.**

## 1 · The record is a scratchpad → call the method

If the list inside was always meant to be mutable, say so with a mutating method. No
assignment statement, therefore nothing for the tuple to reject:

```python
config = ("prod", ["read"])
config[1].extend(["write", "admin"])     # explicit; no exception, no ambiguity
```

The same shape for the other two containers:

```python
tags   = ("release", {"beta"})
tags[1].update({"canary"})               # set.update, not |=

routes = ("v1", {"GET /orders": handler})
routes[1].update({"POST /orders": create})   # dict.update, not |=
```

⚠️ This is the correct rewrite *and* a warning sign. A tuple whose second slot is a
growable list is a record pretending to be a container. If it keeps growing, it wanted to
be a `list` or a class.

## 2 · The record is a snapshot → rebuild it

The slot cannot be re-pointed, so build a new tuple. Make the contents immutable at the
same time, or the next author repeats the mistake:

```python
config = ("prod", ("read",))
config = (config[0], config[1] + ("write", "admin"))
```

For a slot in the middle of a longer tuple, the general form is slice–insert–slice:

```python
def with_field(record, index, value):
    """Return a copy of `record` with slot `index` replaced by `value`."""
    return record[:index] + (value,) + record[index + 1:]

config = with_field(config, 1, config[1] + ("write",))
```

🔴 If you are writing `with_field`, stop and read section 3. Index arithmetic on a record
is the symptom [7 · Multiple return values](07-multiple-return-values.md) is about.

## 3 · The indexing is unreadable → name the fields

Three positional fields is already past the point where `config[1]` communicates
anything. A frozen record does the rebuild for you and gives the field a name:

```python
from dataclasses import dataclass, replace

@dataclass(frozen=True, slots=True)
class Config:
    env: str
    scopes: tuple[str, ...]

config = Config("prod", ("read",))
config = replace(config, scopes=config.scopes + ("write", "admin"))
```

`dataclasses.replace` returns a new instance and leaves the original untouched — the
frozen flag makes `config.scopes = ...` raise `FrozenInstanceError`, which the docs
describe as *"a subclass of `AttributeError`"*, so the failure arrives at the assignment
rather than after it.

A `NamedTuple` gets the same treatment with `_replace`:

```python
from typing import NamedTuple

class Config(NamedTuple):
    env: str
    scopes: tuple[str, ...]

config = Config("prod", ("read",))
config = config._replace(scopes=config.scopes + ("write",))
```

> *"Return a new instance of the named tuple replacing specified fields with new values"* —
> [`_replace`](https://docs.python.org/3.14/library/collections.html#collections.somenamedtuple._replace)

Both are covered properly in [8 · Named records](08-named-records.md); the point here is
that both make the rebuild a one-liner that names the field.

## 4 · You only wanted a bigger tuple → rebind the name

`+=` applied to a **name** that holds a tuple is fine. There is no subscript store, so
there is nothing to raise:

```python
scopes = ("read",)
scopes += ("write",)          # scopes now names a NEW tuple ("read", "write")
```

The reference explains why this is not mutation:

> *"An augmented assignment statement like ``x += 1`` can be rewritten as ``x = x + 1`` to
> achieve a similar, but not exactly equal effect. In the augmented version, ``x`` is only
> evaluated once. Also, when possible, the actual operation is performed *in-place*"* —
> [Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)

*"When possible"* is doing the work. A tuple has no `__iadd__`, so the in-place path is
unavailable; `tuple.__add__` runs, a new object comes back, and the name is rebound.

🔴 **What that line does not do:** it does not modify the tuple any *other* name still
points at. If `scopes` also lives in a dict, a class attribute, or a closure, those still
hold the old 1-tuple. Write the new value back where it is read from.

## The adjacent trap: the left-hand side is evaluated first

The reference calls this out because it surprises people who read `+=` as pure sugar for
`x = x + …`:

> *"Unlike normal assignments, augmented assignments evaluate the left-hand side *before*
> evaluating the right-hand side.  For example, ``a[i] += f(x)`` first looks-up ``a[i]``,
> then it evaluates ``f(x)`` and performs the addition, and lastly, it writes the result
> back to ``a[i]``."*

For a tuple target this means the failing write is genuinely last — after the lookup,
after the right-hand side ran, after any side effects `f(x)` had, and after `__iadd__`
mutated whatever it was given. An exception at the end therefore proves nothing about
what did or did not happen earlier in the statement.

The same paragraph gives the other reason to prefer `+=` over `x = x + y` when the target
is expensive: *"The target is only evaluated once."* `counts[expensive_key()] += 1`
calls `expensive_key()` once; the spelled-out version calls it twice.

## Which operators do this

Any augmented operator whose left operand implements the in-place dunder and whose
container is a tuple. The reference's `augop` production lists them all: `+=`, `-=`, `*=`,
`@=`, `/=`, `//=`, `%=`, `**=`, `>>=`, `<<=`, `&=`, `^=`, `|=`.

In practice you meet three:

```python
t = (["a"], {"k"}, {"x": 1}, 7)
t[0] += ["b"]        # list.__iadd__  -> extends, then TypeError
t[1] |= {"y"}        # set.__ior__    -> updates,  then TypeError
t[2] |= {"y": 2}     # dict.__ior__   -> updates,  then TypeError  (dict |= is 3.9+)
t[3] += 1            # int has no __iadd__ -> nothing mutated, then TypeError
```

The first three mutate and then raise. The fourth raises cleanly, because `int` has no
in-place method and the freshly computed `8` is simply discarded when the store fails.

**The rule that predicts it:** a mutation escapes exactly when the contained object
implements the corresponding `__i*__` method. Immutable contents — `int`, `str`, `float`,
`bytes`, `tuple`, `frozenset` — never do, which is one more argument for keeping tuples
free of mutable members.

## Gotchas

**★ Symptom: `scopes += ("admin",)` "worked" but the object in the registry did not
change.** Cause: `+=` on a *name* bound to a tuple builds a new tuple and rebinds only
that name; every other reference still points at the old object. Fix: write the new value
back where it is read from.

```python
registry["scopes"] = registry["scopes"] + ("admin",)
```

**★ Symptom: `t[1] |= {"new"}` on a set inside a tuple raised, and the set has the new
member.** Cause: identical mechanism to the list case — `set.__ior__` updates in place
and returns the same set, then the tuple store fails. Fix: call the method, or rebuild
with a `frozenset`.

```python
t[1].add("new")                        # mutate deliberately
# or
t = (t[0], frozenset(t[1] | {"new"}))  # rebuild deliberately
```

**★ Symptom: `a[i] += f(x)` fired `f`'s side effects even though the statement raised.**
Cause: the reference specifies left-hand side first, then right-hand side, then the
write; `f(x)` ran two steps before the failure. Fix: compute first, assign explicitly, so
the failure ordering is visible.

```python
new_value = f(x)
a[i] = a[i] + new_value      # now the TypeError is obviously about the store
```

**Symptom: a helper that "updates a field" of a tuple grew into slice arithmetic nobody
can review.** Cause: `record[:i] + (v,) + record[i+1:]` is correct and unreadable — the
index is a magic number and an off-by-one is invisible. Fix: give the record a type and
let `_replace` or `dataclasses.replace` name the field.

```python
config = config._replace(scopes=config.scopes + ("write",))
```

**Symptom: switching a list field to a tuple broke `config[1] += extra` at runtime, in a
path with no test.** Cause: the list version silently mutated in place; the tuple version
raises, and the failure surfaces wherever the code was not covered. Fix: this is the
right outcome — make the mutation explicit at the call site before you change the type,
so the compiler of last resort is code review rather than production.

```python
# do this first, while the field is still a list
config[1].extend(extra)
# then change the field to a tuple and let this line fail loudly in review
```

**Symptom: `counts[key()] += 1` calls `key()` twice after someone "simplified" it to
`counts[key()] = counts[key()] + 1`.** Cause: the augmented form evaluates the target
once; the expanded form does not. Fix: keep `+=` when the target expression has a cost or
a side effect, and bind it to a name when you need the expanded form.

```python
k = key()
counts[k] = counts[k] + 1
```

## Interview questions

**★ Is `x += y` the same as `x = x + y`?**
The reference says *"similar, but not exactly equal"*. Two differences matter. The target
is evaluated only once, so `d[expensive()] += 1` calls `expensive()` once rather than
twice. And *"when possible, the actual operation is performed in-place"* —
`list.__iadd__` mutates and returns `self`, so `a += b` on lists is `a.extend(b)` plus a
redundant rebinding, whereas `a = a + b` always allocates a new list. For immutable types
the two forms coincide, because there is no in-place path to take.

**★ `scopes += ("admin",)` where `scopes` is a tuple — legal or not?**
Legal, and it is not a mutation. There is no subscript being written, so nothing raises;
`tuple.__add__` builds a new tuple and the *name* `scopes` is rebound to it. The catch is
that this is a purely local effect: any dict entry, attribute, or closure cell still
holding the old tuple sees no change. If the tuple is the shared state, you have to write
the new object back into whatever holds it.

**★ How would you make `t[0] += ['c']` impossible rather than merely wrong?**
Stop storing mutable objects in tuples you call records. `(['a'], 'b')` becomes
`(('a',), 'b')`, and the offending line now fails at step 1 — before anything is modified
— because tuples have no `__iadd__` and `tuple + list` is not a defined operation. The
failure moves from "after the damage" to "instead of the damage", which is the only
difference that matters at 2am.

**What other operators show this behaviour?**
Every augmented operator, whenever the contained object implements the corresponding
in-place dunder: `|=` on a set inside a tuple calls `set.__ior__` and updates it, `|=` on
a dict calls `dict.__ior__`, `*=` on a list calls `list.__imul__`. All of them mutate and
then fail the store. `int`, `str`, `float`, `bytes` and `tuple` slots fail cleanly because
none of them has an in-place method to run.

**Given a 5-tuple, how do you produce a copy with one field changed?**
Mechanically: `record[:i] + (new,) + record[i+1:]`. Practically: you should not be doing
this to a bare tuple. Both named-record forms give you the operation with the field named
— `nt._replace(field=new)` for a `NamedTuple`, `dataclasses.replace(obj, field=new)` for
a frozen dataclass — and both are one expression with no index arithmetic to get wrong.
If the record is a bare tuple and you need this operation, that is the signal to give it
a type.

**Why is `dataclasses.replace` preferred over constructing the class directly?**
Because it copies every field you did not name, so adding a sixth field later does not
silently drop it from this code path. `Config(config.env, new_scopes)` is a positional
constructor call that breaks — or worse, keeps working with the wrong values — the moment
the field list changes. `replace()` states only the delta.

**If `+=` on a tuple name is a rebinding, is it safe under concurrency?**
The rebinding itself is a single reference store, so a reader sees either the old tuple or
the new one. The *statement* is not atomic: read, add, store are separate steps, so two
threads running `shared += (x,)` can lose one of the updates. Immutable values give you
free consistent snapshots, not free compare-and-swap — see
[1b · Thread safety and identity](01b-thread-safety-and-identity.md).

---

← [The `+=` that raises and mutates](02-the-augmented-assignment-trap.md) · [Topic index](README.md) · Next → [Hashability](03-hashability.md)
