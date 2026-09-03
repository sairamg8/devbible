---
title: "`assert` is a statement the compiler can delete, which decides every correct use of it"
sidebar_label: "10 · `assert`"
sidebar_position: 131
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement),
> the Library Reference
> [`AssertionError`](https://docs.python.org/3.14/library/exceptions.html#AssertionError),
> [`__debug__`](https://docs.python.org/3.14/library/constants.html#debug__),
> the [command line reference](https://docs.python.org/3.14/using/cmdline.html#cmdoption-O)
> (`-O`, `-OO`, `PYTHONOPTIMIZE`),
> and the [pytest documentation on assertion rewriting](https://docs.pytest.org/en/stable/how-to/assert.html).
> Target: **CPython 3.14**.

`assert` is the only statement in Python whose code the compiler is allowed to
not emit. Everything you need to know about when to use it follows from that one
fact, and the reference states it plainly.

## What the statement actually is

> The simple form, `assert expression`, is equivalent to
>
> ```python
> if __debug__:
>     if not expression: raise AssertionError
> ```
>
> The extended form, `assert expression1, expression2`, is equivalent to
>
> ```python
> if __debug__:
>     if not expression1: raise AssertionError(expression2)
> ```

And then the sentence that matters:

> In the current implementation, the built-in variable `__debug__` is `True`
> under normal circumstances, `False` when optimization is requested (command
> line option `-O`). The current code generator emits no code for an `assert`
> statement when optimization is requested at compile time.

**No code.** Not a cheap branch — nothing. Under `-O`, `-OO`, or
`PYTHONOPTIMIZE=1` in the environment, every `assert` in every module compiled
in that run is absent from the bytecode.

You also cannot re-enable it from inside the program:

> Assignments to `__debug__` are illegal. The value for the built-in variable is
> determined when the interpreter starts.

## The one rule

🔴 **Never `assert` anything the program's correctness depends on at runtime.**
A check that must happen is an `if` and a `raise`. An `assert` is a statement of
what you believe is already true.

| You are checking | Use |
|---|---|
| A caller passed a bad argument | `raise TypeError` / `ValueError` |
| Untrusted input — a request body, a form field, a file | validation code, `raise` |
| An authorisation or security condition | `if not allowed: raise` |
| A value from another system — API response, DB row | `raise`, or a schema library |
| An invariant *your own code* maintains | `assert` |
| "This branch cannot be reached" | `assert False` or `raise AssertionError` |
| A precondition in a test | `assert` (this is pytest's whole idiom) |

The dangerous case is the middle one, because it works in development and
vanishes in whatever environment sets `PYTHONOPTIMIZE`. A permission check
written as `assert user.is_admin` is a permission check that does not exist in
production.

## The tuple trap

```python
assert (value > 0, "value must be positive")     # ALWAYS passes
```

A non-empty tuple is truthy — see [truthiness](../05-truthiness/README.md) — so
the assertion is trivially true and the message is never seen. It is the single
most common `assert` bug, common enough that CPython's compiler warns about it
with a `SyntaxWarning` saying the assertion is always true and suggesting the
parentheses be removed. The fix is a comma, not brackets:

```python
assert value > 0, "value must be positive"
```

The same shape appears when an assertion is wrapped for line length. Use a
backslash or parenthesise the **expression only**:

```python
assert (
    value > 0
), "value must be positive"
```

## Side effects belong nowhere near it

```python
assert queue.pop() is not None      # under -O, nothing is popped
assert log_and_check(item)          # under -O, nothing is logged
```

Because the statement can be compiled away, an `assert` whose expression *does*
something makes the program behave differently under `-O`. This is the class of
bug that reproduces only in the environment you cannot debug in.

## `AssertionError` is catchable, and catching it is a smell

`AssertionError` is an ordinary `Exception` subclass, so `except Exception:`
catches it and `except AssertionError:` works. Neither is usually right: an
assertion firing means a belief about your own code was wrong, and the useful
response is a loud failure and a stack trace, not recovery. The exception is a
test runner or a task supervisor whose whole job is to catch everything and
report — see [the bare `except:`](04b-the-bare-except.md).

If a condition is one you expect to handle, it was never an assertion.

## Where `assert` is genuinely the best tool

**Invariants inside a module.** A statement that documents and enforces at once:

```python
def _merge(left, right):
    assert left.tenant_id == right.tenant_id, "merge across tenants"
    ...
```

**Unreachable branches**, which is also how you get a useful failure when an
enum grows a member:

```python
match state:
    case State.OPEN:   ...
    case State.CLOSED: ...
    case _:            raise AssertionError(f"unhandled state {state!r}")
```

Prefer the explicit `raise AssertionError(...)` over `assert False` in that
position, precisely because it survives `-O`.

**Tests.** pytest rewrites assertion statements in test modules so that a bare
`assert a == b` reports both values on failure, which is why test suites use
plain `assert` rather than `assertEqual`. The corollary is that you must not run
a test suite under `-O` — the assertions would be gone and every test would
pass.

**Narrowing for a type checker.** `assert isinstance(x, Foo)` tells a checker
what you know, and is acceptable when the alternative is a cast — but it is not
a runtime type guarantee at an API boundary, where the answer is `raise
TypeError`.

## Gotchas

**★ Symptom — an assertion never fires, even with an obviously false
condition.** Cause: parentheses around both the condition and the message, so a
truthy tuple is being asserted. Fix: remove the parentheses; heed the compiler's
`SyntaxWarning`, which names this exact mistake.

**★ Symptom — validation that works locally is absent in production, and bad
data reaches the database.** Cause: `assert` used for validation plus `-O` or
`PYTHONOPTIMIZE=1` in the deployment environment — a container image, a
supervisor config, a CI variable that survived into staging. Fix: `if not …:
raise ValueError(...)` for anything that must be enforced.

**★ Symptom — behaviour differs between a local run and an optimised one, in a
way unrelated to speed.** Cause: an `assert` with a side effect — a `pop`, a
counter increment, a log call, an initialisation. Fix: move the effect out and
assert on the result.

```python
item = queue.pop()
assert item is not None
```

**★ Symptom — a security check passes for users who should not have access.**
Cause: the check is an `assert`, and the code was compiled with optimisation.
Fix: rewrite as `if`/`raise`, then grep the codebase for `assert` near anything
authorising, because this is never a single instance.

**★ Symptom — a service catches `AssertionError` and continues in a corrupted
state.** Cause: a broad `except Exception:` around code whose invariants just
failed. Fix: let assertion failures reach the top; if a supervisor must catch
them, log the traceback and terminate the unit of work rather than continuing.

**★ Symptom — an assertion makes a hot loop measurably slower.** Cause: the
assertion's expression is expensive — `assert sorted(xs) == xs`, `assert
len(set(ids)) == len(ids)` — and it runs on every iteration, since production
almost never enables `-O`. Fix: assert cheap invariants inside loops and
expensive ones at the boundary, or guard the expensive one with `if __debug__:`
so the intent is visible.

**★ Symptom — `ValueError: The truth value of an array with more than one
element is ambiguous` from an assertion.** Cause: asserting a numpy array or
pandas object directly. Fix: assert a scalar — `.all()`, `.any()`, or a
comparison of shapes.

**★ Symptom — a test suite passes in one CI job and fails in another with the
same code.** Cause: one job sets `PYTHONOPTIMIZE`, so every `assert` in the
tests disappeared and nothing was checked. Fix: never optimise a test run;
`assert` *is* the test.

**★ Symptom — an `assert` message is a long f-string, and profiling shows it
being built on every call.** Cause: the message expression is evaluated only
when the assertion fails, so this is usually a misreading — but an f-string in
the *condition* is not. Fix: check which half the expression is in; the message
after the comma costs nothing while the assertion holds.

## Interview questions

**★ Q: When do you use `assert` and when do you `raise`?**
`assert` states a belief about your own code — an invariant you expect to be
true, whose violation is a bug. `raise` enforces a contract with the outside
world: arguments, input, data from another system, permissions. The dividing
line is not taste, it is that the compiler emits no code for `assert` under
`-O`, so anything that must be checked cannot be an assertion.

**★ Q: What exactly happens to assertions under `-O`?**
Nothing is emitted for them. The reference says the code generator emits no code
for an `assert` statement when optimisation is requested at compile time, and
`__debug__` — which the statement is defined in terms of — is `False` and cannot
be assigned. So the checks are not skipped at runtime, they are absent from the
bytecode.

**★ Q: Why is `assert (cond, "message")` wrong?**
It asserts a two-element tuple, which is always truthy, so the assertion always
passes and the message is never shown. CPython's compiler emits a
`SyntaxWarning` for it. The correct form separates them with a comma:
`assert cond, "message"`.

**Q: Can you catch `AssertionError`?**
Yes — it derives from `Exception`, so both `except AssertionError:` and
`except Exception:` catch it. You usually should not: an assertion firing means
a belief about your own code was false, and continuing runs on a state you have
just proven you do not understand.

**Q: Test suites use bare `assert`. Why is that fine there?**
Because pytest rewrites assertions in test modules to report the operands on
failure, so `assert a == b` gives the same diagnosis as a dedicated helper —
and because a test *is* a statement about beliefs. The catch is that the suite
must not run under `-O`, or the assertions vanish and everything passes.

**Q: Is `assert isinstance(x, Foo)` a type check?**
For a type checker, yes — it narrows. For runtime, no: it disappears under
optimisation and it raises the wrong exception class for an argument error. At
an API boundary, `raise TypeError`.

---

← Prev: [Traceback objects](09-traceback-objects.md) · Index: [Exceptions](README.md) · Next → **`suppress`, warnings and the explicit ignore** *(not written yet)*
