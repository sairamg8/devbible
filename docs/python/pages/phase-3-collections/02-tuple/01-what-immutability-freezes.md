---
title: "A tuple freezes its slots, not the objects in them — which is why a 'frozen' config can still grow a third element while you watch"
sidebar_label: "1 · What immutability freezes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference —
> [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> [Immutable sequences](https://docs.python.org/3.14/reference/datamodel.html#immutable-sequences),
> [Parenthesized forms](https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms);
> [Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#tuple) and
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types);
> the [glossary entry for *immutable*](https://docs.python.org/3.14/glossary.html#term-immutable);
> and the [tutorial on tuples](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**A tuple is an array of references that cannot be re-pointed. That is the entire
guarantee, and it is smaller than the word "immutable" makes it sound. The number of
slots is fixed and the object each slot points at is fixed — but if one of those objects
is a list, a dict, or a mutable instance of your own, its contents remain as changeable
as they ever were. The reference manual says this out loud in a parenthesis most readers
skim past, and every production incident involving a "frozen" tuple traces back to that
parenthesis.**

## The definition, in the reference's own words

The standard type hierarchy is unambiguous about what the freeze covers:

> *"An object of an immutable sequence type cannot change once it is created.  (If the
> object contains references to other objects, these other objects may be mutable and
> may be changed; however, the collection of objects **directly referenced** by an
> immutable object cannot change.)"* —
> [Immutable sequences](https://docs.python.org/3.14/reference/datamodel.html#immutable-sequences)

And the chapter opening spells out the consequence for *value*:

> *"(The value of an immutable container object that contains a reference to a mutable
> object can change when the latter's value is changed; however the container is still
> considered immutable, because the collection of objects it contains cannot be changed.
> **So, immutability is not strictly the same as having an unchangeable value, it is more
> subtle.**)"* —
> [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types)

Read that as a rule about **arrows**. A tuple owns *N* arrows. You cannot add one, remove
one, or bend one to point somewhere else. What sits at the far end of each arrow is
someone else's business.

## The demonstration, and why it is not academic

```python
# A "frozen" feature-flag record handed to every request handler.
DEFAULT_FLAGS = ("prod", ["beta-search", "new-checkout"])

def enable_for_debugging(flags):
    """Looks harmless. Is not."""
    flags[1].append("verbose-logging")

enable_for_debugging(DEFAULT_FLAGS)
# DEFAULT_FLAGS is now ("prod", ["beta-search", "new-checkout", "verbose-logging"])
# for every request in this process, forever.
```

`DEFAULT_FLAGS` was never rebound. `DEFAULT_FLAGS[1]` still points at exactly the same
list object it always did. The tuple's promise is intact and the config is wrong. The
tutorial states the same thing from the syntax side:

> *"It is not possible to assign to the individual items of a tuple, however it is
> possible to create tuples which contain mutable objects, such as lists."* —
> [Tuples and Sequences](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences)

The fix is not to protect the tuple. The tuple is fine. The fix is to make every slot
hold something that has no mutating operations:

```python
DEFAULT_FLAGS = ("prod", ("beta-search", "new-checkout"))
# or, when membership is the question rather than order:
DEFAULT_FLAGS = ("prod", frozenset({"beta-search", "new-checkout"}))
```

Now `DEFAULT_FLAGS[1].append(...)` raises `AttributeError` — a tuple has no `append` —
and the record really is closed to modification all the way down.

## What you actually get, stated precisely

Three guarantees, and they are worth naming separately because people conflate them:

1. **Fixed arity.** `len(t)` is a constant for the life of the object. No `append`, no
   `insert`, no `del t[0]`, no slice assignment. Any code holding the tuple can rely on
   the number of fields.
2. **Fixed slot identity.** `t[i] is t[i]` forever. The reference in slot *i* never
   changes, which is what makes `hash(t)` legal to compute — see
   [3 · Hashability](03-hashability.md).
3. **Fixed shape for unpacking.** `a, b, c = t` either always works or never works. It
   cannot start failing because someone appended a fourth element between two calls.

And one non-guarantee, which is the entire content of this page: **nothing about the
transitive contents.**

## Rebinding is not mutation

`+` on tuples always builds a new object; it never edits one.

```python
version = (3, 14)
newer = version + (7,)       # newer is (3, 14, 7)
# version is still (3, 14) — unchanged, because + made a new tuple.

version += (7,)              # version now names a DIFFERENT object
```

That last line reads like mutation and is not. `version += (7,)` computes
`version + (7,)`, gets a brand-new 3-tuple, and rebinds the *name* `version` to it. Any
other name that was pointing at the old 2-tuple still is. This distinction is the whole
of [2 · The `+=` that raises and mutates](02-the-augmented-assignment-trap.md), where it
stops being harmless.

## Copying: `tuple(t)` is documented to be free

Because a tuple cannot change, there is nothing to defend against, and the constructor
short-circuits:

> *"The constructor builds a tuple whose items are the same and in the same order as
> *iterable*'s items. … **If *iterable* is already a tuple, it is returned unchanged.**"* —
> [`tuple`](https://docs.python.org/3.14/library/stdtypes.html#tuple)

So the defensive-copy idiom that costs real memory on a list is a no-op on a tuple:

```python
def store_headers(self, headers):
    self.headers = tuple(headers)   # copies a list; returns the same object if
                                    # already a tuple, per the docs
```

⚠️ **That guarantee is written for `tuple(t)`, not for `t[:]`.** The documentation does
not state whether slicing a whole tuple returns the same object, so do not rely on it —
use `tuple(t)` when the identity matters and treat `t[:]` as "a tuple with the same
items". It also does not deep-copy: `tuple(headers)` gives you a new outer array over the
*same* inner objects, which is exactly the aliasing this page is about.

Two properties that follow directly from all of this — the thread-safety claim the
glossary makes, and the identity guarantee the reference pointedly refuses to make — get
their own page: [1b · Thread safety and identity](01b-thread-safety-and-identity.md).

## Gotchas

**★ Symptom: a module-level "constant" tuple has different contents on request 900 than
it did on request 1.** Cause: one of its slots holds a list or dict, and some handler
called `.append()` / `.update()` on it — the tuple never changed, its contents did. Fix:
make the nesting immutable at definition time and the mutating call becomes an error
instead of a silent write.

```python
# Before — mutable inner, silently shared
DEFAULT_SCOPES = ("read", ["orders", "invoices"])
# After — the AttributeError arrives at the offending line
DEFAULT_SCOPES = ("read", ("orders", "invoices"))
```

**★ Symptom: `tuple(rows)` did not protect the caller's data.** Cause: it is a shallow
copy — a new outer array of the *same* inner references, exactly as the docs describe.
Fix: convert each element too, or use `copy.deepcopy` when the shape is arbitrary.

```python
import copy

frozen_rows = tuple(tuple(r) for r in rows)   # one level deeper, cheap
deep_rows   = copy.deepcopy(rows)             # whole graph, expensive
```

**Symptom: `t.append(x)` raises `AttributeError: 'tuple' object has no attribute
'append'` and you expected `TypeError`.** Cause: the method does not exist at all; there
is nothing to reject the call. `TypeError: 'tuple' object does not support item
assignment` is what you get from `t[0] = x`, which is a different operation. Fix: build a
new tuple, or use a list if the collection is genuinely growing.

```python
t = ("a", "b")
t = t + ("c",)          # new object, name rebound
# or, when this happens in a loop, do not use a tuple at all:
items = ["a", "b"]
items.append("c")
```

**Symptom: a `@dataclass(frozen=True)` holding a tuple still lets a caller mutate what
the tuple contains.** Cause: `frozen=True` blocks attribute *assignment*, and the tuple
blocks slot *reassignment*; neither touches the list two levels down. Fix: the frozen
guarantee has to be applied all the way through — see
[8e · Frozen dataclasses](08e-frozen-dataclasses.md) for the full treatment, and note the
dataclasses documentation's own warning: *"It is not possible to create truly immutable
Python objects."*

## Interview questions

**★ Is a tuple immutable if it contains a list?**
Yes — and that is not a trick answer. The tuple's own state, the array of references, is
unchangeable: the length is fixed and no slot can be re-pointed. What the reference calls
its *value* can nonetheless change, because value includes the values of the contained
objects. The documentation's own phrasing is that *"immutability is not strictly the same
as having an unchangeable value, it is more subtle."* The practical consequence is that
such a tuple is immutable but **not hashable**, which is the topic of
[3 · Hashability](03-hashability.md).

**★ What is the difference between `t = t + (4,)` and `t.append(4)`?**
`t.append` does not exist; tuples have no mutating methods, so that line raises
`AttributeError`. `t + (4,)` builds an entirely new tuple and the assignment rebinds the
name `t` to it. Nothing that held the old tuple sees a change. If this happens inside a
loop it is also the quadratic-cost mistake the sequence documentation warns about — see
[10b · What operations cost](10b-what-operations-cost.md).

**Why does `tuple(x)` return `x` itself when `x` is already a tuple, while `list(x)`
always copies?**
Because there is nothing a copy would protect you from. A list copy exists so the caller
cannot mutate your data behind your back; a tuple cannot be mutated, so handing back the
same object is observably identical to handing back a copy and costs nothing. The docs
make this an explicit guarantee — *"If iterable is already a tuple, it is returned
unchanged"* — which makes `tuple(maybe_a_tuple)` a free normalisation at API boundaries.

**How do you actually get a deeply immutable record in Python?**
By construction, not by decoration: every field holds an `int`, `str`, `bytes`, `float`,
`bool`, `None`, an `enum` member, a `frozenset`, or another such record. Tuples,
`NamedTuple`s and frozen dataclasses all give you one level; the recursion is your job.
The dataclasses documentation is blunt that *"it is not possible to create truly
immutable Python objects"* — what you are building is a discipline the type system helps
you keep, not a runtime guarantee.

**Why does the language bother distinguishing "the collection of objects directly
referenced" from "the value"?**
Because hashing depends on the first and equality depends on the second. `hash(t)` is
allowed to be computed once and cached only if the slots cannot be re-pointed; `t1 == t2`
must ask each element whether it is equal, which can change over time if the elements are
mutable. That split is exactly why a tuple containing a list is a legal, immutable object
that `hash()` refuses to touch.

---

← [Topic index](README.md) · Next → [Thread safety and identity](01b-thread-safety-and-identity.md)
