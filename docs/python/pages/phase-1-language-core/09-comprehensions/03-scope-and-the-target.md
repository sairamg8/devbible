---
title: "A comprehension has its own scope so its loop variable never leaks — but the leftmost iterable and a walrus both live outside it"
sidebar_label: "3 · Scope and the target"
sidebar_position: 94
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> [Execution model — naming and binding](https://docs.python.org/3.14/reference/executionmodel.html#naming-and-binding),
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> [PEP 572](https://peps.python.org/pep-0572/),
> and [PEP 709](https://peps.python.org/pep-0709/).
> Target: **CPython 3.14**.

**A `for` statement leaves its target bound after the loop. A comprehension does
not — the reference gives it an *implicitly nested scope* precisely so that names
assigned in the target list cannot leak. There are exactly two documented holes
in that isolation, and both are deliberate: the leftmost iterable expression is
evaluated in the enclosing scope, and an assignment expression binds in the
enclosing scope. Everything confusing about comprehension scope is one of those
two rules, the class-body consequence in the next chunk, or a closure capturing
the loop variable.**

## The rule, verbatim

> *"However, aside from the iterable expression in the leftmost `for` clause, the
> comprehension is executed in a separate implicitly nested scope. This ensures
> that names assigned to in the target list don't 'leak' into the enclosing
> scope."*

Compare the two constructs directly:

```python
for i in range(3):
    pass
print(i)                       # 2 — the for statement's target survives

[j for j in range(3)]
print(j)                       # NameError: name 'j' is not defined
```

The `for` statement's behaviour is also documented, in the compound statements
reference: *"Names in the target list are not deleted when the loop is
finished."* The two constructs disagree on purpose, and the comprehension is the
one that got it right. See
[The `for` statement](../08-control-flow/01-the-for-statement.md) for what that
means on the loop side.

The isolation is two-way. A comprehension's target does not overwrite an outer
name of the same shape:

```python
x = "important"
squares = [x * x for x in range(5)]
print(x)                       # still "important"
```

In Python 2 that printed `4`. The change to Python 3 was one of the quieter
breaking changes of the transition and it is the reason old code sometimes
depends on a leak that no longer happens.

## Why the leftmost iterable is different

The reference explains the asymmetry rather than just asserting it:

> *"The iterable expression in the leftmost `for` clause is evaluated directly in
> the enclosing scope and then passed as an argument to the implicitly nested
> scope. Subsequent `for` clauses and any filter condition in the leftmost `for`
> clause cannot be evaluated in the enclosing scope as they may depend on the
> values obtained from the leftmost iterable."*

Read the mechanism off that sentence: the leftmost iterable is evaluated
*outside*, and its result is handed *in*. Everything else runs inside because it
may depend on values that only exist inside. Before PEP 709 that "passed as an
argument" was literal — the comprehension was a function call and the iterator
was its single argument, visible in `locals()` as the synthetic name `.0`. After
PEP 709 the comprehension is inlined and there is no call, but the scoping rule
is unchanged; see [PEP 709 inlining](04-pep-709-inlining.md).

Three consequences that matter:

**An error in the leftmost iterable is raised where the comprehension is
written.** For a list comprehension this is invisible because the whole thing
runs immediately anyway. For a generator expression it is the difference between
an exception at definition and an exception at consumption, which is
[chunk 5b](05b-eager-leftmost-and-lazy-rest.md)'s subject.

**Only the leftmost iterable can see class-body names.** That is the whole of
the class-body trap in [chunk 3b](03b-the-class-body-trap.md).

**A walrus in the leftmost iterable is a `SyntaxError`.** PEP 572 disallows it
outright, because the expression straddles two scopes.

## The walrus leaks, on purpose

PEP 572 makes the comprehension's own isolation rule an exception for assignment
expressions:

> *"an assignment expression occurring in a list, set or dict comprehension or in
> a generator expression […] binds the target in the containing scope, honoring a
> `nonlocal` or `global` declaration for the target in that scope, if one
> exists."*

So a comprehension has one name that survives it, and it is never the `for`
target:

```python
if any((comment := line).startswith('#') for line in lines):
    print("First comment:", comment)
```

That example is from PEP 572. The value that satisfied the condition is
available afterwards, which no filter clause can give you. The full catalogue of
where `:=` is allowed and where it raises — including the class-body ban, the
iterable-expression ban and the name-collision `SyntaxError` — is owned by
[the walrus rules and scope](../05-truthiness/05b-walrus-rules-and-scope.md).
What belongs here is the asymmetry itself: **in one comprehension, `for x`
does not leak and `(y := ...)` does.** If that sounds inconsistent, it is not —
the `for` target is machinery the comprehension owns, and the walrus target is a
name you explicitly asked to keep.

## The closure trap: a lambda that captures the loop variable

This is not a comprehension bug, but comprehensions are where people meet it,
because building a list of callables is a natural thing to write as one.

```python
fns = [lambda: i for i in range(3)]
[f() for f in fns]             # every call returns 2
```

Each `lambda` closes over the *variable* `i`, not its value at the time the
lambda was made. By the time any of them is called, the comprehension has
finished and `i` holds its last value. The fix is a default argument, which is
evaluated at definition time:

```python
fns = [lambda i=i: i for i in range(3)]
[f() for f in fns]             # 0, 1, 2
```

or a factory function, which gives each closure its own cell:

```python
def make(i):
    return lambda: i

fns = [make(i) for i in range(3)]
```

`functools.partial` is a third option and reads better when the callable already
exists: `[partial(handle, i) for i in range(3)]`.

The trap is worse in a *generator expression*, because the comprehension has not
finished when the first lambda is made — the values are produced lazily, so what
each closure sees depends on when it is called relative to how far the generator
has been advanced. That is not a rule to memorise; it is a reason not to build
closures in a genexp at all.

## `nonlocal` and `global` inside a comprehension

The `for` target cannot be declared `global` or `nonlocal` — there is no
statement position inside a comprehension to declare it in. A walrus target can
be, but the declaration goes in the *containing* scope, and PEP 572 says the
binding honours it:

```python
def collect(rows):
    global last_seen
    return [r for r in rows if (last_seen := r.id) > 0]   # binds the global
```

This is legal and it is almost always the wrong design — a comprehension that
mutates module state is a loop pretending not to be one. See
[when it should have been a loop](08-when-it-should-have-been-a-loop.md).

## Gotchas

**★ Symptom — `NameError` on the loop variable immediately after a
comprehension.** Cause: the comprehension's target lives in an implicitly nested
scope and is gone when the comprehension finishes; the reference says this
*"ensures that names assigned to in the target list don't 'leak' into the
enclosing scope"*. Fix: if you need the value, you needed a `for` statement, or a
walrus, or you needed to keep the element rather than the target.

**★ Symptom — every callable in a list built by a comprehension returns the same
value.** Cause: each closure captured the loop *variable*, and after the
comprehension all of them see its final value. Fix: bind the value at definition
time with a default argument `lambda i=i: ...`, a factory function, or
`functools.partial`.

**★ Symptom — code ported from Python 2 stops working because a name is missing
after a list comprehension.** Cause: Python 2 list comprehensions ran in the
enclosing scope and leaked their target; Python 3 gave them their own scope. Fix:
compute the value you actually need inside the comprehension, or convert that
one comprehension back to a `for` statement.

**Symptom — a variable's value changes after a comprehension runs, with no
assignment statement in sight.** Cause: an assignment expression inside the
comprehension, which PEP 572 deliberately binds in the containing scope. Fix:
nothing, if it was intended — but name it something that reads as an export, and
do not reuse a name that already means something.

**Symptom — `SyntaxError` for `[x for x in (data := load())]`.** Cause: PEP 572
disallows named expressions entirely in a comprehension's iterable expressions,
because that expression is evaluated in a different scope from the rest of the
comprehension. Fix: assign on the previous line.

**Symptom — a comprehension inside a method cannot see a name and you cannot see
why.** Cause: either the class-body scope rule (next chunk) or a genuine typo;
inside a *method* body the normal function scoping applies and comprehensions can
read locals, closure variables and globals as usual. Fix: check whether the
comprehension is in the class body or in a method — they behave differently and
they are one indent level apart.

**Symptom — a generator expression built in a loop yields values from the wrong
iteration.** Cause: the genexp closes over the loop variable and is not consumed
until later, by which time the variable has moved on. Fix: consume it
immediately with `list(...)`, or bind the value with a default argument on a
generator *function*, or build the genexp from a local snapshot.

**Symptom — `del` on a name after a comprehension raises `NameError` even though
the comprehension "assigned" it.** Cause: the comprehension never assigned
anything in this scope; the target existed only in the nested scope. Fix: nothing
to delete.

## Interview questions

**★ Q: Does a comprehension's loop variable leak into the enclosing scope?**
No. The reference gives the comprehension a *"separate implicitly nested scope"*
specifically so that *"names assigned to in the target list don't 'leak' into the
enclosing scope"*. This is a Python 3 change: Python 2 list comprehensions did
leak. A `for` *statement*'s target still leaks, and that difference is
deliberate.

**★ Q: Then why does a walrus inside a comprehension leak?**
Because PEP 572 says so explicitly — an assignment expression in a comprehension
*"binds the target in the containing scope"*, honouring any `nonlocal` or
`global` declaration there. The two rules are not in conflict: the `for` target
is the comprehension's own machinery and is hidden, while a walrus target is a
name the author deliberately asked to keep. That is the whole point of the
feature, and it is what makes `if any((m := match(x)) for x in xs)` useful.

**★ Q: Which part of a comprehension is evaluated in the enclosing scope?**
Exactly one thing: the iterable expression of the leftmost `for` clause. The
reference says it *"is evaluated directly in the enclosing scope and then passed
as an argument to the implicitly nested scope"*. Everything else — later
iterables, all filters including the first one, and the element expression — runs
inside, because they may depend on values produced by that leftmost iterable.

**★ Q: Why does `[lambda: i for i in range(3)]` give three functions that all
return 2?**
Because a closure captures a variable, not a value. All three lambdas refer to
the same `i`, and by the time any of them runs the comprehension has finished
with `i` bound to `2`. Bind at definition time instead: `lambda i=i: i`, a
factory function, or `functools.partial`. The same trap exists with a plain
`for` loop; comprehensions just make it easy to write.

**Q: Can you use `nonlocal` or `global` for a comprehension's loop variable?**
No — there is no statement position inside a comprehension to put a declaration
in, and the target is scoped to the comprehension by design. A *walrus* target
can be affected by a `nonlocal` or `global` declared in the containing scope,
because PEP 572 says the binding honours one if it exists.

**Q: Was the leftmost iterable ever literally an argument?**
Yes. Before Python 3.12 a comprehension compiled to a nested function, and the
iterator for the leftmost iterable was passed as its single argument, visible in
`locals()` under the synthetic name `.0`. PEP 709 removed the function call in
3.12; the argument is gone but the scoping rule it implemented is unchanged.

**Q: Is the isolation one-way or two-way?**
Two-way. An outer name of the same spelling is not overwritten by the
comprehension, and the comprehension's target is not visible afterwards. PEP 709
preserves this with a bytecode trick — it saves any outer value on the stack
before the comprehension and restores it after.

---

← Prev: [Filter versus conditional expression](02c-filter-versus-conditional-expression.md) · Index: [Comprehensions](README.md) · Next → [The class body trap](03b-the-class-body-trap.md)
