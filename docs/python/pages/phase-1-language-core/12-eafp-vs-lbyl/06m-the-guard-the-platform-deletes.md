---
title: "Under -O the compiler emits no code at all for an assert statement, and the flag can arrive from an environment variable, a base image or a pre-compiled .pyc — so a check you can read in the source may not exist in the program that runs"
sidebar_label: "06m · The guard the platform deletes"
sidebar_position: 168
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 reference — [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement),
> [`-O` / `-OO` / `PYTHONOPTIMIZE`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-O),
> [`__debug__`](https://docs.python.org/3.14/library/constants.html#debug__), [`sys.flags`](https://docs.python.org/3.14/library/sys.html#sys.flags),
> [PEP 488](https://peps.python.org/pep-0488/), [`importlib.util.cache_from_source`](https://docs.python.org/3.14/library/importlib.html#importlib.util.cache_from_source),
> [`compileall`](https://docs.python.org/3.14/library/compileall.html), [Cached bytecode invalidation](https://docs.python.org/3.14/reference/import.html#pyc-invalidation),
> [`doctest`](https://docs.python.org/3.14/library/doctest.html), and the [Click docs](https://click.palletsprojects.com/en/stable/documentation/) (stable, read 2026-09-10).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06j](06j-ambient-state-the-guard-cannot-see.md) covered ambient state you configure:
`decimal` contexts and warning filters. This chunk is the harder half, where the ambient
state belongs to the interpreter itself and your code has no say. Under `-O` the compiler
emits *no code at all* for an `assert`, so a handler for `AssertionError` guards a
statement that is not in the program — and the flag need not appear on any command line
you can see, because `PYTHONOPTIMIZE` in a base image sets it, and a `.pyc` compiled at a
level bakes it in. [06s](06s-the-check-that-lies.md) covers the other half of the same
problem: the guard that does run, and answers wrongly.**

## `-O` and the `assert` that is not there

The most complete version of "ambient state decides whether it raises" is the one where the
statement is removed from the program entirely. The reference:

> *"In the current implementation, the built-in variable `__debug__` is `True` under normal
> circumstances, `False` when optimization is requested (command line option `-O`). **The
> current code generator emits no code for an `assert` statement when optimization is
> requested at compile time.**"*

Not "the assertion passes" — *no code is emitted*. So `except AssertionError` around a call
that validates with `assert` is a handler for something that cannot happen under `-O`, and
the invalid data proceeds:

```python
# 🔴 Under `python -O`, validate() emits nothing and this handler is unreachable.
def validate(order):
    assert order.total >= 0, "negative total"

try:
    validate(order)
except AssertionError:
    return reject(order)
```

```python
def validate(order):
    if order.total < 0:                    # a real check, in the emitted program
        raise InvalidOrder("negative total")

try:
    validate(order)
except InvalidOrder:
    return reject(order)
```

The reference's own equivalence makes the mechanism plain — `assert expression1, expression2`
is equivalent to `if __debug__: if not expression1: raise AssertionError(expression2)` — and
`__debug__` is fixed at interpreter start: *"Assignments to `__debug__` are illegal. The
value for the built-in variable is determined when the interpreter starts."* The constants
reference adds that it is not even assignable: `__debug__` *"cannot be reassigned
(assignments to them, even as an attribute name, raise `SyntaxError`)"*. This is [05b ·
`assert` is not validation](05b-assert-is-not-validation.md)'s subject; it appears here
because it is the purest case of the pattern.

## What `-O` removes, and what it does not

The command-line documentation is narrower and stranger than the name suggests. `-O` is
documented as exactly two deletions, plus the bytecode filename change covered below:

> *"Remove assert statements and any code conditional on the value of `__debug__`."*

`-OO` adds a third:

> *"Do `-O` and also discard docstrings."*

That is the whole documented surface. There is **no documented speed optimisation** — no
inlining, no constant propagation, no dead-code pass you can point at in the docs. `-O`
makes a program faster only in the sense that code you deleted does not run. Anyone who set
`PYTHONOPTIMIZE=1` "for performance" bought exactly one thing: the removal of their own
checks.

### `if __debug__:` goes the same way

*"any code conditional on the value of `__debug__`"* is not a footnote — it deletes
hand-written blocks too, and those blocks are frequently doing something the program
depends on:

```python
# 🔴 Under -O the whole block is removed, registrations and all.
if __debug__:
    register_invariant_checks(engine)
    engine.echo = True
```

```python
if settings.debug_checks:        # a value you own, in a program you can read
    register_invariant_checks(engine)
```

The rule of thumb: `__debug__` is fine as a *marker* of a diagnostic that is allowed to
vanish, and never as the switch for anything with a side effect the rest of the program
observes.

## The three ways optimization arrives

**One — the command line.** `python -O app.py`. Visible, greppable, rare in the wild.

**Two — the environment.** This is the one that reaches production without appearing in a
diff:

> *"`PYTHONOPTIMIZE` — If this is set to a non-empty string it is equivalent to specifying
> the `-O` option. If set to an integer, it is equivalent to specifying `-O` multiple
> times."*

So `PYTHONOPTIMIZE=2` is `-OO`, docstrings included. A base container image with `ENV
PYTHONOPTIMIZE=1`, a Kubernetes `env:` entry, a systemd `Environment=` line or a CI runner
default all set it for every process in the tree. Nothing in the application changed, the
tests still pass where the variable is unset, and the validation quietly stopped running.

⚠️ The two sentences do not settle `PYTHONOPTIMIZE=0`: `"0"` is both *a non-empty string* (which the
first sentence equates to `-O`) and *an integer* (which the second reads as "`-O` zero times").
**The documentation does not resolve this and I could not confirm the behaviour without running
it.** Do not use `PYTHONOPTIMIZE=0` to mean "off" — unset the variable.

**Three — the bytecode.** Optimization is applied *at compile time*, so a `.pyc` built with
`compileall -o 2` already has its assertions removed, whatever flags the interpreter that
loads it was given. `compileall` documents the level as a build-time choice, repeatable:

> *"Compile with the given optimization level. May be used multiple times to compile for
> multiple levels at a time (for example, `compileall -o 1 -o 2`)."*

## The cache is per optimisation level

This is where the `.opt-1` and `.opt-2` tags in the `-O` and `-OO` entries land. PEP 488
gives each level its own filename, so the levels coexist in one `__pycache__`:

> *"`'{name}.{cache_tag}.opt-{optimization}.pyc'.format(name=module_name, cache_tag=sys.implementation.cache_tag, optimization=str(sys.flags.optimize))`"*

with the unoptimized case keeping the old name — *"When no optimization level is specified,
the pre-PEP `.pyc` file name will be used"*. `importlib.util.cache_from_source` exposes the
same mapping from the library side, defaulting to the running process:
*"`None` causes the interpreter's optimization level to be used"*.

Two consequences. The interpreter looks for **one** file — PEP 488: *"the import system
looks for a single bytecode file based on the optimization level of the interpreter already
and generates a new bytecode file if it doesn't exist"*. With source present a level mismatch
only costs a recompile; with source absent the module is not found at all, which is why PEP
488 says bytecode-only distributors *"will have to choose which optimization level they want
their bytecode files to be"*. And whether a stale cache is noticed at all depends on how it
was built — the import reference says one variant is never checked: *"For unchecked
hash-based `.pyc` files, Python simply assumes the cache file is valid if it exists."* Such
an image runs the bytecode it shipped with, so an `assert` added to the source afterwards is
not in the process: the `-O` symptom from an entirely different cause. Build the cache
checked, and force it, if a source edit must be able to win:

```bash
python -m compileall --invalidation-mode checked-hash -f -q /app
```

## Make the interpreter say it out loud

`__debug__` is a bool; `sys.flags.optimize` is the integer, and it is the only one of the two
that distinguishes `-O` from `-OO`. `sys.flags` is documented as *"a named tuple [that]
exposes the status of command line flags"*, with `flags.optimize` mapped to *"`-O` or
`-OO`"*. Log it at startup, where you can see it, instead of inferring it from behaviour:

```python
import sys
if sys.flags.optimize:      # 1 = asserts gone; 2 = asserts and docstrings gone
    logger.warning("optimization level %d: assert statements are not compiled in",
                   sys.flags.optimize)
```

## Gotchas

**★ Symptom: validation stopped rejecting bad input after a deployment change, and nothing
in the diff touched validation.** Cause: the deployment added `-O`, and *"the current code
generator emits no code for an `assert` statement when optimization is requested at compile
time"* — so the `assert` is not in the program and `except AssertionError` guards nothing.
Fix: assertions are for programmer errors; a check that must run is an `if` and a `raise`.

```python
if order.total < 0:
    raise InvalidOrder("negative total")
```

**★ Symptom: the same image behaves differently in two clusters and no command line
differs.** Cause: `PYTHONOPTIMIZE` — *"If this is set to a non-empty string it is equivalent
to specifying the `-O` option"* — so a base image or a deployment template can delete every
`assert` in the tree with an environment variable. Fix: assert the interpreter's own state at
startup, where you can see it, rather than discovering it from behaviour.

```python
if not __debug__:
    logger.warning("running under -O: assert statements are not compiled in")
```

**★ Symptom: a debug-only registration never happens in production, and removing the flag
"fixes" it.** Cause: `-O` removes *"any code conditional on the value of `__debug__`"*, so
an `if __debug__:` block is gone in its entirety — not skipped, absent. Anything that block
was wiring up (a metrics hook, an SQL echo, an invariant checker) never existed. Fix: gate
optional behaviour on your own configuration value, which no interpreter flag can delete.

**★ Symptom: the doctest suite collects nothing on the production interpreter and everything
locally.** Cause: `-OO` is documented as *"Do `-O` and also discard docstrings"*, and doctest
is documented to search docstrings — *"The module docstring, and all function, class and
method docstrings are searched"*. With the docstrings discarded there is nothing left to
search. (The doctest page itself does not mention `-OO`; this is the consequence of the two
documented sentences, not a quote.) Fix: never run a doctest suite under an optimized
interpreter — and if docstrings carry executable examples you rely on, that is one more
reason `-OO` is not a deployment default.

**Symptom: a CLI's help text is empty in production.** Cause: `-OO` is documented as *"Do
`-O` and also discard docstrings"*, and the tool builds its help from `__doc__` — Click, for
one, documents that *"For commands, the docstring of the function is automatically used if
provided."* It is the same class of defect as the missing `assert`: the interpreter removed
something the code depends on existing. Fix: never derive runtime behaviour from docstrings;
keep help text in a string constant the optimiser does not touch.

```python
HELP = "Reconcile settlements for a date range."
@click.command(help=HELP)
def reconcile():
    """Reconcile settlements for a date range."""   # documentation only, not the help text
```

## Interview questions

**★ Why is `except AssertionError` never a real guard?**
Because the statement it is guarding may not be in the program. The reference is unambiguous:
*"The current code generator emits no code for an `assert` statement when optimization is
requested at compile time."* Not "the check passes" — the check is absent, so the invalid
data flows on and the handler is unreachable. `__debug__` is also fixed at startup —
*"Assignments to `__debug__` are illegal. The value for the built-in variable is determined
when the interpreter starts"* — so nothing at runtime can restore it. Worse, `-O` can arrive
from `PYTHONOPTIMIZE` rather than a command line, so the change is invisible in the
application's own configuration. Assertions state what you believe is already true, for the
benefit of a developer; anything a caller can cause is an `if` and a `raise`. That is
[05b](05b-assert-is-not-validation.md)'s argument, and the `except AssertionError` clause is
the tell that the distinction was missed.

**★ What exactly does `-O` do?**
Two things, and it is worth being able to recite them because most of what people assume is
not in the documentation at all: *"Remove assert statements and any code conditional on the
value of `__debug__`"*, plus a `.opt-1` tag on the cached bytecode filename. `-OO` adds
*"discard docstrings"* and tags `.opt-2`. That is the entire documented behaviour — no
inlining, no constant folding, nothing described as making code faster. The correct summary
is that `-O` is a *deletion* flag, not an optimiser, and the things it deletes are the ones a
careful codebase put there deliberately.

**★ You cannot see `-O` on any command line. Name the ways it can still be in effect.**
Three. The environment: *"If this is set to a non-empty string it is equivalent to specifying
the `-O` option. If set to an integer, it is equivalent to specifying `-O` multiple times"* —
so a base image's `ENV PYTHONOPTIMIZE=2`, a pod spec or a CI default silently applies `-OO`.
Pre-compiled bytecode: optimization happens at compile time, so a `.pyc` produced by
`compileall -o 1` carries the deletions regardless of how the interpreter was started. And a
wrapper: an entrypoint script, a supervisor unit or a `Makefile` target that inserts the flag
between your `docker run` and the interpreter. The only reliable answer comes from inside the
process — `sys.flags.optimize`.

**★ Name the kinds of ambient state that decide whether a call raises at all.**
Four appear in the standard library and cover most real cases. A library-level context
object, `decimal` being the model — per-thread, with a `traps` list that decides whether a
signal becomes an exception. The warning filter, where the `"error"` action turns any
`warn()` call into a raise. The interpreter's optimisation flag, where `-O` deletes `assert`
statements and any `if __debug__:` block outright, and can be set from `PYTHONOPTIMIZE`
rather than the command line. And the platform, where `os.access` may report success on a
filesystem whose permission semantics it cannot express, and `os.path.exists` may report
`False` for a file it merely cannot `stat`. What they have in common is that none of them are
visible in the file containing the `try`, which is why "read the handler and the suite" is a
necessary but not sufficient review. The fourth is [06s](06s-the-check-that-lies.md)'s
subject, and it is the one where the guard runs and still misleads you.

**`__debug__` or `sys.flags.optimize` — which should a startup check use?**
`sys.flags.optimize`, unless all you care about is "were assertions compiled in". `__debug__`
is a bool: it is documented as *"true if Python was not started with an `-O` option"*, so it
collapses `-O` and `-OO` into one `False` and cannot tell you that docstrings were discarded
too. `sys.flags` is *"a named tuple [that] exposes the status of command line flags"* with
`flags.optimize` covering *"`-O` or `-OO`"* as an integer, so `> 1` is the docstring
question. Use `__debug__` in code (it is the constant the compiler folds), and
`sys.flags.optimize` in the message you log.

**Can you turn assertions back on at runtime after starting with `-O`?**
No. Two independent reasons, and both are documented. The value is frozen — *"Assignments to
`__debug__` are illegal. The value for the built-in variable is determined when the
interpreter starts"* — and the constants reference adds that assigning to it raises
`SyntaxError`, so the attempt does not even compile. More fundamentally, there is nothing to
turn on: the code generator emitted no bytecode for the statement, so even if the flag flipped
there would be no instruction to execute. The only remedy is a new process without the flag,
and a `__pycache__` that does not still hold the optimized bytecode.

---

← Prev: [`catch_warnings` and tests](06u-catch-warnings-and-the-test-runner.md) · Index: [EAFP vs LBYL](README.md) · Next → [The check that lies](06s-the-check-that-lies.md)
