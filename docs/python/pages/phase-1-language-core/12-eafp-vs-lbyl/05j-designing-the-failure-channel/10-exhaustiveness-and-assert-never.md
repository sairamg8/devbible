---
title: "Add a fourth variant to a union and every if/elif that handled three keeps compiling and falls silently off the end — assert_never is the one construct that turns that into a type error, and it is a function call rather than an assert, so unlike assert False it survives -O"
sidebar_label: "10 · Exhaustiveness and assert_never"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`typing.assert_never`](https://docs.python.org/3.14/library/typing.html#typing.assert_never)
> (quoted verbatim below),
> [`typing.Never` / `typing.NoReturn`](https://docs.python.org/3.14/library/typing.html#typing.Never),
> [`typing.Literal`](https://docs.python.org/3.14/library/typing.html#typing.Literal) — and
> [mypy — Literal types and Enums](https://mypy.readthedocs.io/en/stable/literal_types.html)
> (exhaustiveness checking, `--enable-error-code exhaustive-match`).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A tagged union return ([05r](09-union-returns-and-exhaustiveness.md)) puts every outcome
in the signature, which is its whole point — and then quietly loses that guarantee the first
time somebody adds a variant, because an `if/elif` chain that handled three cases still
compiles when there are four. It falls off the end and returns `None`, or in a function
annotated `-> None` it does nothing at all and reports nothing anywhere. `typing.assert_never`
is the construct that closes this, and it works by an unusual mechanism worth understanding
rather than copying: it demands that the value reaching it has the bottom type, which is only
true when every other case has been eliminated. It is also a function call, not the `assert`
statement — so it is not stripped under `-O`, which is exactly the trap `assert False`
falls into.**

## The mechanism

> *"Ask a static type checker to confirm that a line of code is unreachable."*

> *"If a type checker finds that a call to `assert_never()` is reachable, it will emit an
> error. … For a call to `assert_never` to pass type checking, the inferred type of the
> argument passed in must be the bottom type, `Never`, and nothing else."*

> *"At runtime, this throws an exception when called."*

That middle sentence is the whole design. Each handled case *narrows* the value's type,
removing one member from the union; when every member has been removed, what is left is
`Never` — the type with no members, which [05k](02-the-raising-contract.md) introduced as
the return type of a function that only raises. `assert_never` accepts nothing else, so the
call type-checks precisely when the branches above it were exhaustive.

```python
from typing import assert_never


def describe(result: ChargeResult) -> str:
    match result:
        case Charged(receipt_id=rid):
            return f"charged, receipt {rid}"
        case Declined(decline_code=code):
            return f"declined: {code}"
        case GatewayDown(retry_after_s=secs):
            return f"gateway down, retry in {secs}s"
        case _:
            assert_never(result)     # every case covered -> `result` is Never here
```

Add a fourth member to `ChargeResult` and this stops type-checking immediately, at the one
place that has to change. mypy's documentation shows the same shape for enums and quotes the
error you get: *`Argument 1 to "assert_never" has incompatible type "Direction"; expected
"NoReturn"`* — the checker naming the variant you forgot.

⚠️ **This is a static device with a runtime backstop, not a runtime check.** The docs say it
*"throws an exception when called"*, which is correct behaviour for a line that should be
unreachable — but the value is the compile-time error, not the exception. By the time the
exception fires, the mistake has already shipped.

## It is not `assert`, and that distinction is load-bearing

The name invites the confusion and the consequence is real. `assert_never` is an ordinary
function call, so it executes under `python -O`. The `assert` *statement* does not — it is
removed under optimisation, which is why [05b · `assert` is not validation](../05b-assert-is-not-validation.md)
disqualifies it as a guard.

```python
case _:
    assert_never(result)      # ✅ checks exhaustiveness statically, survives -O
case _:
    assert False              # 🔴 proves nothing to the checker, and vanishes under -O
case _:
    raise AssertionError(result)   # survives -O, but the checker verifies nothing
```

The third form is the interesting one, because it looks defensible: it does survive `-O` and
it does fail loudly at runtime. What it does *not* do is make the checker verify anything —
adding a fourth variant leaves this code compiling and merely converts a silent fall-through
into a runtime error somebody has to hit. `assert_never` is the only one of the three that
fails in CI rather than in production.

## It works for enums and literals too, not only classes

`assert_never` cares about the inferred type being `Never`; it does not care how the union
was spelled. mypy's page documents the technique for `Literal` unions and for `Enum` members
as well as for classes:

```python
from enum import Enum
from typing import assert_never


class Direction(Enum):
    up = "up"
    down = "down"


def choose(direction: Direction) -> str:
    if direction is Direction.up:
        return "Going up"
    if direction is Direction.down:
        return "Going down"
    assert_never(direction)          # adding Direction.left breaks this line
```

⚠️ **Use `is` rather than `==` when discriminating enum members.** mypy's documentation shows
narrowing with `direction is Direction.up`; its own counter-example uses `==` and produces the
error *`Argument 1 to "assert_never" has incompatible type "Direction"; expected "NoReturn"`*
even for a chain that a human reads as complete. The identity comparison is what the checker
narrows on.

For `match` statements specifically, mypy documents a flag that catches the inexhaustive case
without the explicit call:

> *"For match statements specifically, inexhaustive matches can be caught without needing to
> use `assert_never` by using `--enable-error-code exhaustive-match`."*

That is worth enabling in a codebase that leans on `match`, but note what it does not cover:
`if/elif` chains and `isinstance` ladders still need the explicit call.

## Gotchas

**★ Symptom: adding a variant to a union return breaks nothing and the new case is silently
unhandled.** Cause: an `if/elif` chain or a `match` with no exhaustiveness marker simply falls
through; returning `None` from a function annotated `-> str` is caught, but a function
annotated `-> None` is not, and neither is one returning `Any`. Fix: end the chain with
`assert_never`, which fails to type-check the moment a variant is uncovered.

```python
case _:
    assert_never(result)
```

**★ Symptom: `assert_never` compiles fine and the branch runs in production.** Cause:
something upstream is typed `Any` — an untyped dependency, a `json.loads` result — so the
checker believed the union was exhausted when the value could be anything at all. Fix: the
runtime exception is doing its job here; the real repair is to type the boundary that produced
the `Any`, and to use a real `raise` rather than `assert_never` where the input is genuinely
unconstrained.

```python
def parse_result(raw: object) -> ChargeResult:
    match raw:
        case {"status": "charged", "receipt": str(rid), "amount": int(a)}:
            return Charged(rid, a)
        case {"status": "declined", "code": str(c)}:
            return Declined(c)
        case _:
            raise MalformedGatewayResponse(repr(raw))   # a raise, not assert_never
```

**★ Symptom: `assert_never` was replaced with `assert False` in review as "the same thing",
and the exhaustiveness check disappeared.** Cause: `assert` statements are removed under `-O`,
and `assert False` also tells the checker nothing about which variants remain — it narrows
nothing and proves nothing. Fix: `assert_never` is a function call, so it survives `-O`, and it
is the only form that makes the checker verify exhaustiveness.

```python
case _:
    assert_never(result)          # not `assert False`, not a bare `raise AssertionError`
```

**Symptom: an enum chain using `==` reports an `assert_never` error even though every member
is handled.** Cause: the checker narrows enum members on identity, and mypy's own
counter-example is exactly this — `direction == Direction.up` does not remove the member from
the union the way `direction is Direction.up` does. Fix: compare enum members with `is`.

```python
if direction is Direction.up:
    ...
```

**Symptom: an `if/elif` chain over `isinstance` checks type-checks with `assert_never` but the
equivalent `match` does not, or vice versa.** Cause: exhaustiveness support differs between
checkers and between construct kinds, and the Python documentation does not specify how any
particular checker performs the narrowing — mypy documents its own behaviour for `Literal`,
`Enum` and `match`, but that is mypy's documentation rather than the language's. Fix: confirm
against the checker your CI actually runs before relying on the pattern widely. The
`assert_never` call is standard; its ability to prove *your* particular chain exhaustive is a
property of your checker.

**Symptom: `--enable-error-code exhaustive-match` is on and an inexhaustive `if/elif` chain
still passes.** Cause: the flag is documented for `match` statements specifically; it does not
extend to `if/elif` ladders. Fix: keep the explicit `assert_never` for every non-`match`
discrimination, and treat the flag as a belt-and-braces addition rather than a replacement.

```python
if isinstance(result, Charged):
    return "ok"
if isinstance(result, Declined):
    return "declined"
assert_never(result)          # the flag does not cover this shape
```

**Symptom: `assert_never` is used as a general "unreachable" marker and fires in normal
operation.** Cause: it was placed after a `while True` loop, or on a branch the author
*believed* impossible for reasons the type system cannot see — business logic rather than type
exhaustion. Fix: `assert_never` is for cases eliminated by *types*; anything eliminated by
reasoning wants a real exception with a message a reader can act on.

```python
raise InvariantViolated(f"queue drained with {pending} items still pending")
```

## Interview questions

**★ What does `assert_never` do, and why is the runtime behaviour not the point?**
It asks the checker to prove a line is unreachable: *"For a call to `assert_never` to pass
type checking, the inferred type of the argument passed in must be the bottom type, `Never`,
and nothing else."* Put it in the default arm of a `match` over a union and the code
type-checks only while every variant is handled — add a member and the argument is no longer
`Never`, so the checker errors and names the variant you forgot. The runtime behaviour is a
backstop: the docs say it *"throws an exception when called"*, which is right for a line that
should be unreachable, but by then the mistake has already shipped. The value is the
compile-time failure at the one site that needed editing.

**★ Why is `assert_never(x)` not interchangeable with `assert False`?**
Two independent reasons, and both matter. First, `assert` statements are removed when Python
runs optimised, so the `assert False` version has no runtime effect at all in an environment
that uses `-O` — the same trap that disqualifies `assert` as a validation guard. `assert_never`
is an ordinary function call and survives. Second and more importantly, `assert False` proves
nothing statically: the checker learns nothing from it, so adding a fourth variant leaves the
code compiling. `assert_never` is the only spelling that fails in CI. A `raise
AssertionError(x)` is a middle case — it survives `-O`, but it still gives the checker nothing,
so it converts a silent fall-through into a runtime error rather than into a build failure.

**★ How do you get exhaustiveness checking over an enum or a set of string literals rather
than over classes?**
The same way, because `assert_never` cares only about the inferred type being `Never`, not
about how the union was spelled. mypy's documentation shows it for `Literal['one', 'two']` and
for `Enum` members, with each handled arm narrowing the remaining type until nothing is left;
adding a third literal or a third enum member makes the final call's argument non-`Never` and
the checker reports it, quoting an error of the form *`Argument 1 to "assert_never" has
incompatible type "Direction"; expected "NoReturn"`*. One detail catches people: narrow enum
members with `is`, not `==`, since that is the comparison mypy documents as narrowing. And for
`match` statements mypy also documents `--enable-error-code exhaustive-match`, which catches
the inexhaustive case without the explicit call — though not for `if/elif` chains.

**When is `assert_never` the wrong tool for an unreachable line?**
When the case is eliminated by reasoning rather than by types. `assert_never` only type-checks
if the checker can *prove* nothing reaches it, so a branch you believe impossible for business
reasons — a queue that should be empty, a status the state machine should never produce — will
either fail to type-check or, worse, pass because the value happens to be `Any`. Those lines
want a real exception with a message that says what invariant was violated, because a human
will be reading it at 3am and "assert_never" tells them nothing. The rule is narrow and easy to
state: `assert_never` for exhaustion of a union the type system knows about, an explicit raise
for everything else.

**What is the relationship between `assert_never` and `Never`?**
`Never` is the bottom type — the docs call it *"the bottom type, a type that has no members"* —
and `assert_never` is a function whose parameter is annotated with it. That is the entire
mechanism: a function taking `Never` can only be called with an expression the checker has
proved cannot produce a value, and a union from which every member has been narrowed away is
exactly such an expression. The typing documentation makes this explicit by showing
`def never_call_me(arg: Never) -> None` as the illustration of the bottom type in a parameter
position, with `assert_never` as the standard-library instance of it. So the two chunks of this
chapter that mention `Never` are describing the same idea from opposite ends:
[05k](02-the-raising-contract.md) uses it as a *return* type to say "control stops here", and
this one uses it as a *parameter* type to say "control cannot arrive here".

---

← Prev: [Union returns](09-union-returns-and-exhaustiveness.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Narrowing the try](../06-narrowing-the-try.md)
