---
title: "if x, x is True and x == True are three different questions, and only one of them is ever the right one"
sidebar_label: "4c · is True and the type system"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth),
> [`typing`](https://docs.python.org/3.14/library/typing.html)),
> [PEP 285](https://peps.python.org/pep-0285/),
> [PEP 647 — User-Defined Type Guards](https://peps.python.org/pep-0647/) and
> [PEP 742 — Narrowing types with `TypeIs`](https://peps.python.org/pep-0742/).
> Version spine: **Python 3.14.7**.

**`bool(x)` does not ask whether `x` is a boolean. The docs are precise about what
it does ask: *"The argument is converted using the standard truth testing
procedure."* That leaves three ways to write what looks like the same test, and they
are three genuinely different questions — `if x:` asks whether `x` is truthy,
`if x is True:` asks whether `x` is the `True` singleton, and `if x == True:` asks
whether `x` equals the integer `1`. The third accepts `1.0`, `Decimal(1)` and
`Fraction(1)` while rejecting a non-empty list, so it is neither of the other two
and should be deleted on sight. The type system has the same seam from the other
side: `bool` is assignable to `int`, so an annotation cannot say "an integer but not
a boolean", and a function annotated `-> bool` that returns a count is a lie nothing
enforces at runtime.**

## The three checks

| Written | Actually asks | Use when |
|---|---|---|
| `if x:` | is `x` truthy? | almost always — this is the idiom |
| `if x is True:` | is `x` the `True` singleton? | `True` must be distinguished from `1` and from every other truthy value |
| `if x == True:` | does `x` equal `1`? | never |

**`if x:`** runs the truth-testing protocol — `__bool__`, falling back to `__len__`,
defaulting to true. That protocol is [truthiness](../05-truthiness/README.md)'s
subject; what matters here is that it is the *only* one of the three that respects a
type's own opinion of itself. An empty list, an empty string, `0`, `None` and a
zero-length custom container all take the false branch, and that is almost always
the behaviour a reader expects.

**`if x is True:`** tests identity against the singleton. It is legitimate but
narrow, and it works only because `bool` is a closed type — the docs guarantee
*"Its only instances are `False` and `True`"*, so there is exactly one object to
compare against. That is why `x is True` is safe where `x is 1` is a bet on the
small-integer cache (see [identity and boundaries](01c-identity-and-boundaries.md)).

**`if x == True:`** is the one to remove. `==` compares by numeric value across the
whole numeric tower, so it accepts `1`, `1.0`, `Decimal(1)` and `Fraction(1)`, and
it rejects `"yes"` and `[1, 2]`. It is a numeric equality test wearing the costume of
a boolean test. Its partner `if x == False:` has the same problem and the same
replacement — `if not x:`.

Linters know this: `E712` (`comparison to True should be 'if cond is True:' or
'if cond:'`) is stable in both pycodestyle and Ruff, and it is worth having on as an
error rather than a warning.

## When `is True` is the right answer

One situation, and it is a common one: **a tri-state value**, where `True`, `False`
and `None` mean three different things. An optional flag from JSON. A nullable
boolean column. A config key that may be unset, meaning "inherit the default".

```python
if consent is True:
    record_opt_in()
elif consent is False:
    record_opt_out()
else:                       # None — never asked
    show_consent_banner()
```

Written with `if consent:` the unset case merges into the "no" case, which is a
different legal position. Written with `== True`, a `1` arriving from a database
driver that does not round-trip booleans (see
[booleans at a boundary](04e-booleans-at-a-boundary.md)) is silently accepted as an
explicit opt-in it never was.

The same shape appears in tests. `assert x` passes for any truthy value, so a
function that starts returning `1` instead of `True` keeps its test green. Where the
exact value matters, assert on it:

```python
assert has_items([1]) is True      # not: assert has_items([1])
```

`unittest` makes the same distinction: `assertTrue(x)` is a truthiness assertion,
`assertIs(x, True)` is an identity one. Reach for the second only where the type is
part of the contract — most of the time `assertTrue` is what you mean, and being
strict everywhere makes tests brittle for no gain.

## Gotchas

### `x == True` accepts `1.0` and `Decimal(1)`

**Symptom.** A check meant to test a flag passes for a numeric field.
**Cause.** `==` compares by numeric value across the whole numeric tower.
**Fix.** `if x:` for truthiness, `if x is True:` for the singleton. Never `== True`;
never `== False` either — `if not x:` is the counterpart. Enable `E712` as an error.

### A tri-state flag collapses to two states

**Symptom.** "Never asked" and "explicitly declined" take the same branch.
**Cause.** `if consent:` sends both `None` and `False` down the false path.
**Fix.** Test the three states explicitly with `is True` / `is False` / `else`.



### A test stays green after the return type changes

**Symptom.** A function starts returning `1` instead of `True` and nothing fails.
**Cause.** `assert x` and `assertTrue(x)` are truthiness assertions.
**Fix.** `assert x is True` / `assertIs(x, True)` where the exact value is part of
the contract — and only there, or the suite becomes brittle.




## Interview questions

**What is the difference between `if x:`, `if x is True:` and `if x == True:`?**
`if x:` runs the truth-testing protocol and is the idiom. `if x is True:` tests
identity against the singleton and is right only when `True` must be distinguished
from other truthy values. `if x == True:` asks whether `x` equals `1`, so it accepts
`1`, `1.0` and `Decimal(1)` while rejecting a non-empty list — it is neither of the
other two, and should be deleted.

**When is `x is True` actually the correct thing to write?**
When `True`, `False` and `None` are three distinct states — an optional flag from
JSON, a nullable column, a config key that may be unset — and a `1` arriving from a
source that does not round-trip booleans must not be treated as an explicit `True`.
The check is reliable because `bool` is a closed type with exactly two instances.

**Why is `x is True` safe when `x is 1` is not?**
`True` is a guaranteed singleton — the docs say `bool` *"cannot be subclassed
further"* and *"Its only instances are `False` and `True`."* The integer `1` is
interned only because of CPython's small-integer cache, which is an implementation
detail, not a language guarantee.






**Is `assertTrue(x)` the same as `assertIs(x, True)`?**
No. `assertTrue` is a truthiness assertion and passes for `1`, `"x"` or a non-empty
list; `assertIs(x, True)` is an identity assertion. Use the second only where the
exact type is part of the contract — using it everywhere makes a suite brittle.

**Which linter rule catches `== True`, and should it be an error?**
`E712`, stable in both pycodestyle and Ruff. Making it an error is worth it: the
expression is never correct, and the two things it might have meant — `if x:` and
`if x is True:` — differ in a way that matters.

---

← Prev: [Identity traps](04b-bool-identity-traps.md) · Index: [Numbers](README.md) · Next → [Booleans and the type system](04d-booleans-and-the-type-system.md)
