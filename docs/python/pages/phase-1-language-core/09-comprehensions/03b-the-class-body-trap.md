---
title: "A comprehension in a class body cannot see the class's other names, and the only exception is its leftmost iterable"
sidebar_label: "3b · The class body trap"
sidebar_position: 95
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Execution model — resolution of names](https://docs.python.org/3.14/reference/executionmodel.html#resolution-of-names),
> [Annotation scopes](https://docs.python.org/3.14/reference/executionmodel.html#annotation-scopes),
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> the Library Reference
> [`locals`](https://docs.python.org/3.14/library/functions.html#locals),
> and [PEP 572](https://peps.python.org/pep-0572/).
> Target: **CPython 3.14**.

**A class body is a scope that nested code blocks cannot read, and the reference
names comprehensions and generator expressions as nested code blocks. So a
comprehension written directly in a class body raises `NameError` for any other
class-level name it references — except the one in its leftmost iterable, which
is evaluated outside. This produces the most confusing `NameError` in Python,
because the name is visibly two lines above the failure and the same code works
perfectly one indent level deeper, inside a method.**

## The rule, verbatim

> *"The scope of names defined in a class block is limited to the class block; it
> does not extend to the code blocks of methods. This includes comprehensions and
> generator expressions, but it does not include annotation scopes, which have
> access to their enclosing class scopes."*

The reference then gives the failing example itself:

```python
class A:
    a = 42
    b = list(a + i for i in range(10))
```

That is quoted from the documentation, and it fails. The class body's `a` is not
visible to the generator expression's nested scope, so the name is looked up in
the enclosing scope chain — which skips class bodies entirely — and then in
globals, and then raises `NameError`.

## The one that works, and why

```python
class Config:
    items = ["a", "b", "c"]
    allowed = {"a", "c"}

    upper = [s.upper() for s in items]                 # works
    picked = [s for s in items if s in allowed]        # NameError: 'allowed'
```

`items` resolves and `allowed` does not, in the same statement. The reason is the
rule from [chunk 3](03-scope-and-the-target.md):

> *"aside from the iterable expression in the leftmost `for` clause, the
> comprehension is executed in a separate implicitly nested scope"*

The leftmost iterable is evaluated *in the class body*, where `items` is an
ordinary local name. Everything else runs in the nested scope, which cannot see
the class body. So a class-body comprehension can consume a class attribute and
cannot filter or transform by one.

That asymmetry is the whole trap. The failing name is never the obvious one — it
is the one in the filter, or the one in the head expression, or the one in the
second `for` clause.

```python
class Report:
    COLUMNS = ["id", "name"]
    WIDTH = 20

    # every one of these fails on the *second* class name
    padded  = [c.ljust(WIDTH) for c in COLUMNS]          # NameError: 'WIDTH'
    pairs   = [(c, WIDTH) for c in COLUMNS]              # NameError: 'WIDTH'
    grid    = [(a, b) for a in COLUMNS for b in COLUMNS] # NameError: 'COLUMNS'
```

The third is the sharpest: `COLUMNS` works in position one and fails in position
two, in the same line.

## Why class scope works this way at all

Class bodies use `LOAD_NAME`, not the lexical closure machinery, because the
namespace being built is going to become the class's `__dict__`. A nested code
block resolves free variables through the *lexical* chain of enclosing
**function** scopes; class bodies are not in that chain. This predates
comprehensions — it is the same reason a method cannot say `WIDTH` without
`self.WIDTH` or `Report.WIDTH`.

The documentation for `locals()` states the consequence for comprehensions
precisely:

> *"Calling `locals()` as part of a comprehension in a function, generator, or
> coroutine is equivalent to calling it in the containing scope, except that the
> comprehension's initialised iteration variables will be included. In other
> scopes, it behaves as if the comprehension were running as a nested function."*

"In other scopes" includes class bodies. So even though PEP 709 inlines
class-body comprehensions at the bytecode level — the PEP says *"Comprehensions
occurring in module or class scope are also inlined"* — the *name resolution*
semantics are unchanged. Inlining bought speed, not visibility. This is worth
being precise about, because "comprehensions are inlined now" is often
misremembered as "the class-body trap was fixed in 3.12". It was not.

## Module scope does not have the problem

```python
ITEMS = ["a", "b"]
ALLOWED = {"a"}
PICKED = [s for s in ITEMS if s in ALLOWED]     # fine at module level
```

Module-level names are *globals*, and a nested scope can always read globals.
Only class bodies create names that are neither local to the nested scope, nor in
an enclosing function scope, nor global. That is the exact hole.

## Gotchas

**★ Symptom — `NameError` in a class body for a name defined three lines above
it, inside a comprehension.** Cause: the comprehension runs in an implicitly
nested scope, and the reference states that the scope of class-block names *"does
not extend to the code blocks of methods. This includes comprehensions and
generator expressions"*. Fix: move the computation into a method or
`classmethod`, or lift the constants to module level —
[the workarounds are in the next chunk](03c-fixing-the-class-body-trap.md).

**★ Symptom — one class attribute in a comprehension resolves and another does
not, in the same line.** Cause: only the leftmost `for` clause's iterable is
evaluated in the class body; every other position runs in the nested scope. Fix:
do not reference class names from anywhere except the leftmost iterable.

**★ Symptom — someone says the class-body trap was fixed by comprehension
inlining in 3.12.** Cause: PEP 709 does inline class-scope comprehensions, so the
"nested function" is gone at the bytecode level, but name resolution is
unchanged — the `locals()` docs still describe a comprehension in a non-function
scope as behaving *"as if the comprehension were running as a nested function"*.
Fix: treat 3.12 as a performance change only, and keep the workarounds.

**Symptom — the same comprehension works inside a method and fails in the class
body.** Cause: a method is a function scope, so `self.X` and `cls.X` resolve
through attribute lookup rather than name resolution, and enclosing function
scopes are readable. Fix: nothing surprising is happening; the two contexts have
different rules and are one indentation level apart.

**Symptom — the trap appears only for a *second* level of nesting, e.g.
`[x for a in FIRST for x in a]` fails on the second clause.** Cause: only the
leftmost iterable is evaluated outside; a second `for` clause's iterable
expression runs inside the nested scope. Fix: as above.

**Symptom — a `NameError` from a class-body comprehension that names a *builtin*
you shadowed at class level.** Cause: the nested scope skips the class body and
falls through to globals and then builtins, so it finds the builtin rather than
your class attribute of the same name, and fails later with a type error instead
of a `NameError`. Fix: do not shadow builtins as class attributes, and do not
reference class attributes from a comprehension.

**Symptom — the same code works in a `SimpleNamespace` or a module-level
dictionary but not in a class.** Cause: those are runtime objects with ordinary
attribute access; the class-body rule is a compile-time name-resolution rule that
applies only to the textual class block. Fix: nothing to fix — the difference is
real and this is a useful way to remember which construct has the problem.

**Symptom — a comprehension in a class body silently reads a *global* of the
same name instead of the class attribute you meant.** Cause: the lookup skips the
class body and finds a module-level name, so there is no `NameError` at all —
just the wrong value. Fix: this is the worst form of the trap because it is
silent; never reference class-level names from a comprehension in a class body,
even when it appears to work.

## Interview questions

**★ Q: Why does `[x for x in items if x in allowed]` raise `NameError` inside a
class body when both names are class attributes?**
Because the comprehension body executes in an implicitly nested scope, and the
reference states that class-block names do not extend to nested code blocks,
*"including comprehensions and generator expressions"*. Nested scopes resolve
free variables through enclosing **function** scopes and then globals; a class
body is neither. `items` survives only because it is the leftmost iterable, which
the reference says is *"evaluated directly in the enclosing scope"*. `allowed` is
in the filter, which is not.

**★ Q: Did PEP 709's inlining change that?**
No. PEP 709 says comprehensions in module or class scope are inlined, but its
purpose was to remove the function object and frame, not to change scoping. The
`locals()` documentation still describes a comprehension in a non-function scope
as behaving *"as if the comprehension were running as a nested function"*. It is
a performance change with observable side effects on tracebacks and `locals()`,
not a semantic change to name resolution.

**Q: Why does the same code work at module level?**
Because module-level names are globals, and every nested scope can read globals.
The class-body case is special precisely because class names are neither local to
the nested scope, nor in an enclosing function scope, nor global.

**Q: Which is more dangerous, the `NameError` version or the version that
works?**
The version that works. If a module-level global happens to share the name, the
lookup succeeds against the wrong object and you get wrong data instead of an
exception. The `NameError` is the friendly outcome.

**Q: Does the trap apply to a generator expression as well as a list
comprehension?**
Yes, and the reference's own failing example is a generator expression:
`b = list(a + i for i in range(10))` inside `class A: a = 42`. Genexps are not
inlined by PEP 709, comprehensions are, and neither fact changes the scoping.

**Q: Does it apply to `async` comprehensions?**
Yes. The scope rule is about code blocks, not about whether the iteration is
asynchronous. An `async` comprehension in a class body is also unusual for a
second reason — asynchronous comprehensions are only allowed inside an
`async def` function, so it would not be in a bare class body anyway.

---

← Prev: [Scope and the target](03-scope-and-the-target.md) · Index: [Comprehensions](README.md) · Next → [Fixing the class body trap](03c-fixing-the-class-body-trap.md)
