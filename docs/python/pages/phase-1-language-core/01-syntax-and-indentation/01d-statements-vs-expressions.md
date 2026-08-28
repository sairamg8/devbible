---
title: "Assignment is a statement, not an expression, and that one grammatical fact explains why `if x = f():` will not parse and why the walrus operator had to be invented"
sidebar_label: "1d · Statements vs expressions"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§7 Simple statements](https://docs.python.org/3.14/reference/simple_stmts.html),
> [§8 Compound statements](https://docs.python.org/3.14/reference/compound_stmts.html),
> [PEP 572](https://peps.python.org/pep-0572/), the
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> improved-error-messages section, and CPython 3.14's
> [`Grammar/python.gram`](https://github.com/python/cpython/blob/3.14/Grammar/python.gram)
> and [`Parser/pegen_errors.c`](https://github.com/python/cpython/blob/3.14/Parser/pegen_errors.c).
> Target: **CPython 3.14**.

**Python splits its grammar in two: an *expression* produces a value, a *statement*
does something. Assignment is on the statement side, and always has been — which is
why `if x = f():` is not a subtle bug in Python the way it is in C, but a hard
`SyntaxError`, and why adding assignment-inside-an-expression in Python 3.8 required
a whole new operator with its own PEP rather than relaxing a rule. Learn to read a
`SyntaxError` as "you put a statement where the grammar wanted a value" and a large
fraction of Python's refusals stop being arbitrary.**

## Simple, compound, and what a "statement list" is

> *"A simple statement is comprised within a single logical line. Several simple
> statements may occur on a single line separated by semicolons."*

> *"Compound statements contain (groups of) other statements; they affect or control
> the execution of those other statements in some way."*

The full list of simple statements from §7 is worth reading once, because it is
exactly the set of things that are *not* expressions: expression statement,
`assert`, assignment, augmented assignment, annotated assignment, `pass`, `del`,
`return`, `yield`, `raise`, `break`, `continue`, `import`, `future`, `global`,
`nonlocal`, and `type`.

Every one of those is a thing you cannot put where a value is expected. That is not
a list to memorise; it is a list to recognise when a `SyntaxError` says
`expected expression`.

An *expression statement* is the bridge — an expression used purely for its effect:

> *"Expression statements are used (mostly interactively) to compute and write a
> value, or (usually) to call a procedure (a function that returns no meaningful
> result; in Python, procedures return the value `None`). Other uses of expression
> statements are allowed and occasionally useful."*

```python
items.append(3)      # expression statement: the return value is discarded
items.sort()         # ditto — and this is why `x = items.sort()` gives None
```

## Assignment is a statement, and what that forbids

Because `assignment_stmt` is a statement production and not an expression one, none
of the following can be written:

```python
# All of these are SyntaxError, not runtime errors:
if x = compute():          ...     # assignment where a condition is expected
while line = f.readline(): ...
total = (subtotal = 10)            # assignment is not a value
return count = count + 1
[y = f(v) for v in values]         # assignment inside a comprehension
print(x = 1)                       # (this one is a keyword argument, not assignment)
```

3.14 diagnoses the first case specifically. `Grammar/python.gram` carries a
dedicated invalid-syntax rule producing the message
`invalid syntax. Maybe you meant '==' or ':=' instead of '='?` — the parser has
recognised what you probably meant and names both plausible repairs.

This is the design decision C did not make, and PEP 572 says why it stayed:

> *"The syntactic similarity between `if (x == y)` and `if (x = y)` belies their
> drastically different semantics."*

In C, `if (x = 0)` compiles, assigns, and takes the false branch. An entire
convention — Yoda conditions, `if (0 == x)` — exists to work around it. Python does
not need the convention because the construct does not parse.

## The walrus, and why it needed a new operator

PEP 572 added assignment *expressions* in Python 3.8, deliberately spelled
differently from assignment statements:

> *"This is a proposal for creating a way to assign to variables within an
> expression using the notation `NAME := expr`."*

A separate operator preserves the property that made `=`-in-a-condition impossible:
you cannot type `:=` by accident when you meant `==`. And the PEP adds a rule that
stops the two spellings from becoming interchangeable:

> *"Unparenthesized assignment expressions are prohibited at the top level of an
> expression statement."*

```python
y := f(x)        # SyntaxError
(y := f(x))      # legal, and pointless — write y = f(x)
```

The cases it exists for are the ones where the statement form forces you to
duplicate work or restructure the loop:

```python
# Compute once, test, and keep the value.
if (n := len(payload)) > 1024:
    raise ValueError(f"payload too large: {n} bytes")

# The read loop that used to need a `while True` and a `break`.
while (chunk := stream.read(8192)):
    sink.write(chunk)

# Filter and reuse the computed value in one comprehension.
results = [parsed for line in lines if (parsed := parse(line)) is not None]
```

Note the third one carefully: without `:=` you either call `parse` twice or write a
loop. That is the whole justification, and it is also the boundary — a walrus that
does not avoid recomputation or a restructure is usually just a harder-to-read
assignment.

## Gotchas

### A bare expression statement that you meant as a mutation does nothing

**Symptom.** A string, tuple or frozenset "cleanup" that has no effect, with no
error and no warning.
**Cause.** An expression statement evaluates the expression and discards the result.
On an immutable type there is nothing else it could do.
**Fix.** Rebind the name. The tell is a line consisting of a method call whose class
you know to be immutable.

```python
name = "  ada  "
name.strip()            # evaluated, result discarded, `name` unchanged
name = name.strip()     # correct
```

### `x: int` on its own binds no name

**Symptom.** `NameError` on a variable you are certain you declared.
**Cause.** An *annotated assignment statement* without a right-hand side is a
declaration of type only — §7 lists `annotated_assignment_stmt` separately from
`assignment_stmt`, and with no value there is no binding. At class and module level
it records the annotation; it never creates the name.
**Fix.** Give it a value, or use it only where a declaration is what you want (a
dataclass field, a `Protocol` member, a class-level attribute annotation).

```python
class Config:
    retries: int            # annotation only: Config.retries raises AttributeError
    timeout: float = 3.0    # annotation AND assignment: this one exists

import dataclasses

@dataclasses.dataclass
class Point:
    x: float                # here the annotation is exactly what is wanted
    y: float
```

### Chained assignment binds one object to every target

**Symptom.** Appending to one list changes "the other one".
**Cause.** The grammar is `(target_list "=")+ starred_expression` — the right-hand
side is evaluated **once**, then bound to each target left to right. There is no
copy anywhere in that rule.
**Fix.** Construct one object per name.

```python
a = b = []          # ONE list, two names for it
a = []; b = []      # two lists
rows = [[] for _ in range(3)]   # and this, not [[]] * 3, for the same reason
```

Assignment semantics get their own topic later in this phase —
**07 · Assignment semantics and aliasing** *(not written yet)*; the point here is
purely grammatical, the single `starred_expression` on the right of a chain.

### Statements cannot be arguments, so `del` and `pass` cannot be passed anywhere

**Symptom.** `SyntaxError` on something that looks like a function call.
**Cause.** `del`, `pass`, `break`, `continue`, `import`, `global` and the rest are
statements. There is no value for a call to receive.
**Fix.** 3.14 says this in as many words. Its new message for a statement in a
conditional expression is `expected expression after 'else', but statement is given`
(and the mirror-image `expected expression before 'if', but statement is given`),
which is the clearest statement-versus-expression diagnostic the interpreter has
ever produced.

```python
# x = 1 if ok else pass          -> SyntaxError: expected expression after 'else'...
x = 1 if ok else None            # a value is what belongs there
```

### A walrus in a comprehension leaks into the enclosing scope

**Symptom.** A name defined only inside a comprehension is visible after it.
**Cause.** This is deliberate in PEP 572: a comprehension's iteration variable is
local to the comprehension, but an assignment expression binds in the *containing*
scope. It is the mechanism that makes the filter-and-reuse pattern work.
**Fix.** Nothing to fix — but do not rely on it for anything you would not have
written as an explicit assignment, and never let the leaked name shadow something
you still need.

## Interview questions

**Why is `if x = 1:` a `SyntaxError` in Python when it compiles in C?**
Because assignment in Python is a statement, and a statement cannot appear where the
grammar wants an expression. PEP 572 states the motive directly — the syntactic
similarity between `if (x == y)` and `if (x = y)` hides a drastic semantic
difference — so Python never allowed it, and when assignment-in-an-expression was
finally added it got a distinct spelling, `:=`, that you cannot type by accident.
3.14 even suggests both repairs in the error: `invalid syntax. Maybe you meant '=='
or ':=' instead of '='?`

**When should you actually use the walrus operator?**
When it removes a recomputation or a restructure: capturing a value you need both to
test and to use (`if (n := len(x)) > 10`), a read loop that would otherwise need
`while True` plus a `break`, or a comprehension filter whose predicate computes the
value you want to keep. Using it as a shorter `=` at statement level is not just
poor style — PEP 572 forbids the unparenthesized form there outright.

**What is an "expression statement" and why does the concept matter?**
It is an expression evaluated purely for its side effect, with the value thrown
away — `items.append(3)`, `logger.info(...)`, a bare `f()`. It matters because it is
the only place an expression is legal as a whole statement, and because a line that
*looks* like it does something to an immutable object (`name.strip()`) is exactly
this construct doing nothing. In interactive mode the rule changes: the REPL prints
the value of a non-`None` expression statement, which is why people believe the
statement "returns" something.

**Does `x: int` create a variable?**
No. That is an annotated assignment with no right-hand side: it records the
annotation (in `__annotations__` at module and class level, and nowhere at all for a
local) and binds no name. `x: int = 0` both annotates and binds. Getting this wrong
produces a `NameError` or `AttributeError` on something you are sure you declared.

**What does `a = b = []` do?**
Evaluates the right-hand side once and binds the *same* list object to both names —
the grammar is `(target_list "=")+` with a single expression on the right, so no
copy is made anywhere. Mutating through `a` is visible through `b`.

**Why is `x = items.sort()` `None`?**
Because `items.sort()` is a procedure — it mutates in place and returns `None`, and
in a statement position that return value is simply discarded. Assigning it captures
the `None`. This is a deliberate convention across the standard library: methods that
mutate return `None`, and the functions that return a new object (`sorted`,
`reversed`) are named differently.

---

← Prev: [Whitespace and tooling](01c-whitespace-and-tooling.md) · Index: [Syntax and indentation](README.md) · Next → [Line joining, semicolons and one-line suites](01e-line-joining-and-semicolons.md)
