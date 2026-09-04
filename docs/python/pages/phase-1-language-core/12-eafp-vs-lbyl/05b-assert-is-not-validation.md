---
title: "An assert is not validation: the code generator emits nothing for it under -O, so an assert that guards untrusted input is a check one deployment flag away from not existing at all"
sidebar_label: "05b · assert is not validation"
sidebar_position: 132
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement)
> (`__debug__`, `-O`, *"emits no code"*, *"assignments to `__debug__` are illegal"*),
> and [mypy — Type narrowing](https://mypy.readthedocs.io/en/stable/type_narrowing.html)
> (`assert` is one of the documented narrowing constructs).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[05](05-where-lbyl-is-right.md) argued that a trust boundary is the one place where every
objection to LBYL evaporates. This chunk is the commonest way that argument gets
mis-implemented: spelling the check `assert`. It reads as documentation, it is one line,
and it satisfies a type checker — mypy lists `assert` among its narrowing constructs — so
it looks like the tidy way to state a precondition. The Language Reference disqualifies it
in a single sentence: the code generator emits **no code** for an `assert` when `-O` is
requested. Under optimisation your validation is not weakened, it is absent from the
bytecode, and the only thing standing between a stranger's JSON and your database is a
command-line flag someone chose in a `Dockerfile`.**

## `assert` is a tripwire, never a boundary check

`assert` is tempting for validation because it reads as documentation, it is one line, and
it satisfies a type checker — mypy's narrowing page lists `assert` alongside `isinstance()`
and `obj is not None`. It is still not a check, and the reference says why:

> *"In the current implementation, the built-in variable `__debug__` is `True` under
> normal circumstances, `False` when optimization is requested (command line option
> `-O`). The current code generator emits no code for an `assert` statement when
> optimization is requested at compile time."*

And the equivalence that makes the mechanism obvious — the docs' own:

> *"The simple form, `assert expression`, is equivalent to*
> `if __debug__:` / `if not expression: raise AssertionError`*"*

So an `assert` is an `if` whose condition silently includes *"and the interpreter was not
started with `-O`"*. That is a property of your deployment, not of your data. A validation
that a `Dockerfile` can delete is not a validation. The reference adds that *"assignments
to `__debug__` are illegal"* and that *"the value for the built-in variable is determined
when the interpreter starts"* — you cannot re-enable it from inside the program either.

```python
# 🔴 Under `python -O` this function has no checks at all.
def refund(cmd, gateway, conn):
    assert isinstance(cmd.amount_cents, int)
    assert cmd.amount_cents > 0
    gateway.refund(cmd.order_id, cmd.amount_cents)

# The boundary raises unconditionally. The interior may assert, and means
# something entirely different by it.
def parse_refund(body: dict[str, object]) -> RefundCommand:
    amount = body.get("amount_cents")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
        raise BadRequest("amount_cents", "must be a positive integer")
    return RefundCommand(order_id=str(body["order_id"]), amount_cents=amount, reason="")


def refund(cmd: RefundCommand, gateway, conn) -> None:
    assert cmd.amount_cents > 0, "parse_refund guarantees this; a failure here is our bug"
    gateway.refund(cmd.order_id, cmd.amount_cents)
```

**The distinction to hold on to: the boundary's `if` is about the client, the interior's
`assert` is about you.** One produces a 400 and is a normal Tuesday; the other produces an
`AssertionError` and is a bug report. `assert`'s place in the exception hierarchy, and
what `AssertionError` should and should not mean in a codebase, is
[topic 11's](../11-exceptions/10-assert.md).

## Gotchas

**★ Symptom: validation works in tests and vanishes in production.** Cause: the check was
an `assert`, and production runs `python -O`; the reference states the code generator
*"emits no code for an `assert` statement when optimization is requested at compile
time"*. Fix: an `if` that raises a real exception, and keep `assert` for conditions whose
violation is your own bug.

```python
if cmd.amount_cents <= 0:
    raise BadRequest("amount_cents", "must be positive")
```

**Symptom: `assert isinstance(row, dict)` was the only thing stopping an `AttributeError`,
and it is gone in production.** Cause: `assert` used to *narrow* rather than to document —
it does convince mypy, which lists `assert` among its narrowing constructs, and it convinces
nothing at runtime under `-O`. Fix: make it a raising `if`, which narrows for the checker
*and* exists at runtime.

```python
if not isinstance(row, dict):
    raise TypeError(f"expected a mapping row, got {type(row).__name__}")
```

**★ Symptom: a test asserting a tuple always passes.** Cause: `assert (cond, "message")`
asserts the *tuple*, and a non-empty tuple is always truthy — the two-expression form is
`assert cond, "message"` with a comma, not parentheses. Fix: drop the parentheses, and
prefer a raising `if` anywhere the check is load-bearing.

```python
assert amount > 0, "amount must be positive"      # correct: two expressions
if amount <= 0:                                    # better where it must not vanish
    raise BadRequest("amount_cents", "must be positive")
```

**Symptom: `AssertionError` in a production log with no message and no context.** Cause: a
bare `assert expr` — the reference notes it is *"unnecessary to include the source code for
the expression that failed in the error message; it will be displayed as part of the stack
trace"*, which gives you the expression but nothing about the *values*. Fix: use the
second expression to carry the data, or raise a domain exception that carries the fields.

```python
assert cmd.amount_cents > 0, f"non-positive amount reached refund(): {cmd!r}"
```

**Symptom: a decorator or context manager re-enables assertions by setting `__debug__`.**
Cause: it cannot — the reference states that *"assignments to `__debug__` are illegal"* and
that *"the value for the built-in variable is determined when the interpreter starts"*.
Fix: stop trying to make `assert` conditional at runtime; if the check must be
controllable, make it an ordinary `if` on a real setting.

```python
if SETTINGS.strict_mode and not invariant_holds(order):
    raise InvariantViolated(order.id)
```

## Interview questions

**★ Is `assert` an acceptable way to validate input?**
No, and the reason is documented rather than stylistic: `assert expression` is equivalent
to `if __debug__: if not expression: raise AssertionError`, and *"the current code generator
emits no code for an `assert` statement when optimization is requested at compile time"*.
Under `python -O` your validation is not weakened, it is absent — the bytecode does not
contain it. Use an `if` that raises a client-error or domain type. `assert` stays genuinely
useful one level in, as a tripwire stating a condition the boundary already guaranteed; its
failure then means "our code has a bug", which is exactly what `AssertionError` should
mean.

**★ `assert isinstance(x, Foo)` silences the type checker. Does that make it safe?**
It makes it *typed*, not *checked*, and those come apart under `-O`. mypy documents `assert`
as one of its narrowing constructs, so the code after it type-checks. But narrowing is a
compile-time claim about what your program would do if the assertion held, and with `-O`
nothing verifies that it holds. If the narrowing is load-bearing at runtime — the value
really might be something else, because it came from JSON, a database or a plugin — write
`if not isinstance(...): raise TypeError(...)`. That narrows identically and survives
optimisation. Reserve `assert` for facts you have already proved elsewhere.

**What is `assert` actually for, then?**
Stating a condition that is already guaranteed, so that a violation is caught close to the
mistake instead of five frames away. Its audience is a developer, its failure is a bug
report, and its removal under `-O` is acceptable precisely because it was never the thing
enforcing the condition. Test suites are the other legitimate home: they never run with
`-O`, and there the assertion *is* the check.

**Where is `assert` unambiguously the right tool?**
In tests, and in interior tripwires. Test suites never run with `-O`, so there the
assertion *is* the check and the framework's rewriting of it gives better failure output
than a hand-rolled `if`. Inside a boundary, an `assert` documents a fact the boundary has
already established and turns a violation into an immediate, local `AssertionError`
instead of an `AttributeError` five frames later — with the honest understanding that it is
a debugging aid whose disappearance under optimisation changes nothing about correctness.

---

← Prev: [Where LBYL is right](05-where-lbyl-is-right.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The quiet boundaries](05c-the-quiet-boundaries.md)
