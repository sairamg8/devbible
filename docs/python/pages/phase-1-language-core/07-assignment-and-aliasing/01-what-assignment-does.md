---
title: "`=` binds a name to an object and never copies anything, which is the single fact the rest of this topic is consequences of"
sidebar_label: "1 · What `=` actually does"
sidebar_position: 70
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [§3.1 Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-did-changing-list-y-also-change-list-x),
> and the [glossary](https://docs.python.org/3.14/glossary.html).
> Target: **CPython 3.14**.

**In a C-family language `x = y` means "put a copy of y's value into the storage
called x". In Python it means "make the name `x` refer to the object `y`
already refers to". No storage is allocated, nothing is copied, and `x` has no
type of its own — the *object* has a type, and `x` is only a label currently
attached to it. Every aliasing bug in this topic is a program written by
someone who believed the first sentence while running the second.**

## The reference's own definition

The Language Reference opens §7.2 with a sentence that is worth reading twice,
because it names both halves of the topic:

> *"Assignment statements are used to (re)bind names to values and to modify
> attributes or items of mutable objects."*

Two operations, not one. **Rebinding** changes which object a name points at
and is invisible to everyone else holding a reference to the old object.
**Modifying** changes the object itself and is visible to *everyone*. `x = [1]`
is the first. `x[0] = 1` and `x.append(1)` are the second. Confusing them is
the entire bug class.

## Names are not boxes

The data model states the object side flatly:

> *"Every object has an identity, a type and a value."*

Names have none of the three. A name is a key in a namespace — a module's
globals dict, a function's local slots, a class body's namespace — whose value
is a reference to an object. Which means:

```python
x = 5            # the name x now refers to an int object
x = "five"       # the same name now refers to a str object; entirely legal
x = [1, 2, 3]    # and now to a list
```

Nothing about `x` changed type, because `x` never had one. Three different
objects took turns being what `x` refers to. This is why Python is dynamically
typed in the precise sense: **objects carry types, names carry nothing.** A
type annotation (below) attaches a *claim* to a name for a checker to read; the
interpreter does not enforce it and does not store it in the name.

The consequence people underestimate: assignment cannot fail because of a type
mismatch, cannot truncate, cannot slice a value to fit, and cannot convert.
There is no coercion step in `=` at all. If you assign a `float` to a name that
"holds an int", you have simply moved the label.

## Assignment never copies — not once, not ever

```python
a = [1, 2, 3]
b = a            # b is not a copy. b is the same list.
b.append(4)
# a is now [1, 2, 3, 4] — the FAQ walks exactly this case
```

The Programming FAQ answers this under *"Why did changing list 'y' also change
list 'x'?"* and gives the reason in two numbered points, the first of which is:

> *"Variables are simply names that refer to objects. Doing `y = x` doesn't
> create a copy of the list – it creates a new variable `y` that refers to the
> same object `x` refers to. This means that there is only one object (the
> list), and both `x` and `y` refer to it."*

That is not a quirk of lists. It is what `=` does for every object of every
type. It is only *observable* on mutable objects, because those are the only
ones you can change out from under a second name — which is why "mutable vs
immutable" and "aliasing" are the same subject discussed from two directions.

## Chained assignment: one object, many names, left to right

```python
a = b = c = 0
```

The reference documents both the shape and the order:

> *"assigns a single resulting object to each of the target lists, from left to
> right"*, with the comment *"`a = b = c = 0` # c is assigned 0, then b is
> assigned 0, then a is assigned 0"*.

Read that carefully. The right-hand side is evaluated **once**, producing one
object, and that one object is then bound to each target. For `0` nobody cares.
For a mutable object it is the trap:

```python
a = b = []       # ONE list, two names
a.append(1)      # b is now [1] as well
```

Compare with the data model, which calls this out explicitly in its discussion
of identity:

> *"after `c = []; d = []`, c and d are guaranteed to refer to two different,
> unique, newly created empty lists. (Note that `e = f = []` assigns the same
> object to both e and f.)"*

So `a, b = [], []` gives you two lists and `a = b = []` gives you one. The
difference is one character of punctuation and it is a difference in behaviour,
not in style. If you meant "two empty accumulators", the chained form is a bug
that will not show up until something appends.

## Multiple targets in one target list are also left to right

Tuple assignment looks simultaneous, and for plain names it effectively is —
`a, b = b, a` swaps because the right-hand tuple is fully evaluated before any
binding happens. But when a target is itself a subscript that depends on
another target, order becomes visible. The reference gives the canonical
example and states its output, so this is a documented result rather than one
I ran:

> *"the following program prints `[0, 2]`:"*
>
> ```python
> x = [0, 1]
> i = 0
> i, x[i] = 1, 2         # i is updated, then x[i] is updated
> print(x)
> ```

`i` is bound to `1` first; only then is `x[i]` evaluated as a target, and by
that point `i` is already `1`, so the write lands on `x[1]`. If binding were
truly simultaneous the answer would be `[2, 1]`.

The general rule to carry: **the right-hand side is evaluated completely first,
then targets are bound one at a time, left to right, with each target's
subexpressions evaluated at the moment that target is bound.**

## Annotated assignment binds exactly the same way

```python
count: int = 0                  # binds; the annotation is metadata
totals: dict[str, int] = {}     # binds; still one dict, still mutable
threshold: float                # binds NOTHING — declares only
```

The reference: *"If the right hand side is present, an annotated assignment
performs the actual assignment as if no annotation were present."* And a bare
`name: type` with no value creates no binding at all — referencing `threshold`
after that line raises `NameError`. The annotation is recorded for tools (in
`__annotations__` at module and class scope; function-local annotations are
not evaluated at runtime under PEP 563-style behaviour and PEP 649's lazy
evaluation in 3.14), but it never copies, never validates, and never makes the
object immutable. A name annotated `Sequence[int]` can be bound to a `list` and
that list can still be mutated by anyone who has it.

## Assignment expressions bind too

The walrus binds a name as a side effect of an expression:

```python
if (chunk := stream.read(4096)):
    process(chunk)
```

Same semantics — `chunk` is a name bound to whatever object `read` returned. It
is not a copy of the buffer. **Truthiness and the walrus** *(not written yet)*
covers where it earns its place; here it is only worth noting that it is an
extra binding site to look at when hunting for who else holds your object.

## Gotchas

### `a = b = []` when you wanted two accumulators
**Symptom.** Two counters, two buckets, two result lists — and everything lands
in both of them. Tests that check one list pass; the second assertion fails
with a length that is exactly double.
**Cause.** Chained assignment evaluates the right-hand side once and binds that
*one* object to every target. The reference documents it, and the data model
notes `e = f = []` explicitly.
**Fix.** Give each name its own object:

```python
a, b = [], []            # two separate lists — RHS builds two objects
# or
a = []
b = []
```

### "I copied it" — with `=`
**Symptom.** A function stores `self._original = data` "to keep the original"
and later finds the original has changed to match the modified version.
**Cause.** `=` binds; it does not copy. `self._original` and `data` are the
same object, so any mutation through either is visible through both.
**Fix.** Copy explicitly at the point you mean to. `list(data)` /
`dict(data)` for a shallow copy, `copy.deepcopy(data)` when the nesting
matters — see [Shallow copy](08-shallow-copy.md) and
[deepcopy](08b-deepcopy.md) for which one you actually need.

### A type annotation read as a guarantee
**Symptom.** A parameter annotated `Sequence[int]` is mutated by the callee
anyway, or a field annotated `tuple[int, ...]` receives a list at runtime and
nothing complains.
**Cause.** Annotations are not runtime checks. The reference is explicit that
an annotated assignment with a value assigns *"as if no annotation were
present"*.
**Fix.** Run a type checker in CI so the claim is verified somewhere, and where
the runtime guarantee actually matters, convert at the boundary:
`items = tuple(items)`.

### `i, x[i] = ...` read as simultaneous
**Symptom.** An index-and-store idiom writes to the wrong slot.
**Cause.** Targets bind left to right; a later target's subscript sees earlier
targets' new values.
**Fix.** Split it into two statements, in the order you actually mean. Clever
one-liners here cost more than they save.

### Rebinding a parameter to "return" a value
**Symptom.** `def f(x): x = compute()` changes nothing for the caller.
**Cause.** Binding a *name* inside the function only rewires that function's
local name. See [Function arguments](05-function-arguments.md).
**Fix.** Return the value.

## Interview questions

**★ Q: What does `x = y` do in Python?**
It binds the name `x` to the object that `y` currently refers to. It allocates
nothing, copies nothing, and converts nothing. Afterwards there is one object
with two names, and `x is y` is true. The Language Reference defines assignment
statements as being *"used to (re)bind names to values and to modify attributes
or items of mutable objects"* — `x = y` is the rebinding half.

**★ Q: Does Python have variables?**
It has names bound to objects, which is a weaker thing than a variable in C.
A C variable is a typed piece of storage that holds a value; a Python name is
an entry in a namespace that refers to an object. The practical differences:
a name has no type of its own, assigning to it never converts or truncates,
two names can refer to one object, and deleting a name does not necessarily
destroy the object.

**Q: Why does `a = b = []` behave differently from `a, b = [], []`?**
Chained assignment evaluates the single right-hand expression once and binds
that one resulting object to each target left to right, so `a` and `b` name the
same list. The tuple form evaluates two separate display expressions, creating
two distinct lists. The data model states the guarantee directly: `c = []; d =
[]` gives two unique lists, while `e = f = []` assigns the same object to both.

**Q: In `a = b = c`, which name is bound first?**
`a`, then `b`? No — the reference says targets are assigned *"from left to
right"*, and annotates `a = b = c = 0` as "c is assigned 0, then b is assigned
0, then a is assigned 0". That comment is about the *values*, and the ordering
is left to right across the target lists as written, so the leftmost target
list is bound first. For plain names the order is unobservable; it becomes
observable only when a target has side effects, such as a subscript or a
property setter.

**Q: `a, b = b, a` — how does the swap work without a temporary?**
The right-hand side `b, a` is an expression that is fully evaluated before any
binding happens, producing a tuple holding the two current references. Only
then are the targets bound from that tuple. So the "temporary" is the tuple,
built by the interpreter. (CPython optimises the two-element case into a stack
rotation rather than materialising a tuple, but the semantics are as described.)

**Q: Is a type annotation enforced at runtime?**
No. `x: int = "hello"` binds `x` to a string and raises nothing. Annotations
exist for static checkers and for runtime introspection by libraries that
choose to read them; the interpreter does not validate them. A bare `x: int`
with no value declares an annotation and creates no binding, so reading `x`
afterwards raises `NameError`.

**Q: Does `=` ever call a method on the object being assigned?**
Not on the object being assigned, no. But the *target* form matters: binding a
plain name is a namespace write, while `obj.attr = value` calls
`type(obj).__setattr__` and `obj[key] = value` calls
`type(obj).__setitem__` — both of which are ordinary methods that can validate,
transform or refuse. See [Assignment targets](01b-assignment-targets-and-del.md).

**Q: If names have no types, what does a variable annotation buy you?**
Verification by a separate tool, and documentation for humans. That is not
nothing — a checker catches the `Sequence[int]` parameter being handed a
`dict`. But it buys no runtime protection: an annotated name can be rebound to
anything, and an annotated mutable object can still be mutated by any other
holder of a reference to it.

---

← Prev: **Comparisons** *(not written yet)* · Index: [Assignment and aliasing](README.md) · Next → [Assignment targets and `del`](01b-assignment-targets-and-del.md)
