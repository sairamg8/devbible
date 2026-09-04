---
title: "A tagged union return puts every failure in the signature, which is the one thing Python's exception channel structurally cannot do — and the price is no propagation operator, no must_use, no traceback and no stdlib alignment, which is why it belongs at the layer that decides and nowhere above it"
sidebar_label: "09 · Union returns"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) (`frozen`),
> [`typing.assert_never`](https://docs.python.org/3.14/library/typing.html#typing.assert_never),
> [PEP 604 union syntax](https://peps.python.org/pep-0604/) and
> [`match` statements](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[08](08-overloads.md) used the type system to record a distinction made by an *argument*.
This chunk records one made by the *outcome*: a tagged union return, where `charge()` gives
back a `Charged`, a `Declined` or a `GatewayDown` and the caller cannot touch any of them
without discriminating first. That is genuinely the one thing Python's exception channel
cannot offer, because [01](01-type-checkers-and-silent-apis.md) established that raises are
absent from every signature. It is also half-sold, and the four costs are specific to Python:
there is no propagation operator, nothing forces a caller to inspect the value, the origin of
a failure is whatever you remembered to attach, and the whole standard library reports
failure the other two ways. The pattern's own failure mode — extend the union and every
existing branch keeps compiling — is [10](10-exhaustiveness-and-assert-never.md).**

## The shape

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Charged:
    receipt_id: str
    amount_cents: int


@dataclass(frozen=True)
class Declined:
    decline_code: str


@dataclass(frozen=True)
class GatewayDown:
    retry_after_s: int


ChargeResult = Charged | Declined | GatewayDown


def charge(order_id: str, amount_cents: int) -> ChargeResult: ...
```

What this buys is real: **every outcome is in the signature**, so the failures are as
machine-readable as the success. A caller cannot forget `Declined` exists, because the
checker will not let them reach `.receipt_id` without discriminating — which is exactly the
enforcement the raising channel cannot give you at any price.

## And now the costs, stated honestly

This pattern arrives from Rust and Go with its virtues advertised and its Python-specific
costs left out. All four of these are real:

- **No propagation operator.** A raise unwinds thirty frames by itself; a result object must
  be checked and re-returned at every level in between. Python has no `?` operator, so ten
  layers of `ChargeResult` is ten explicit re-wrappings, and the middle layers are pure
  ceremony that exists only to move the value.
- **Nothing forces the caller to look.** Discarding a return value is legal and unreported —
  there is no `must_use` in Python — so a caller who writes `charge(o, 500)` and moves on has
  silently thrown away a decline. An exception cannot be ignored that way. That is its one
  structural advantage over every alternative in this chapter, and it is not small.
- **It is not what the standard library does.** Every stdlib API reports failure by raising
  or by a `None`/sentinel return, so a result-object layer sits *on top of* exceptions: you
  are running two failure channels at once, with a translation layer between them that has to
  be exhaustive or the abstraction leaks.
- **Tracebacks get worse.** An exception carries the frames where it happened. A
  `GatewayDown` object carries whatever you remembered to put in it, and after four
  re-returns the origin is gone unless you attached it deliberately.

**The rule that survives contact with a real codebase:** use a union return where the failure
is an ordinary, expected outcome that the *immediate* caller will branch on — a payment
decline, a validation result, a parse that may not match — and keep exceptions for failures
that need to travel. A result object propagated through six layers has reimplemented
exceptions by hand, with worse ergonomics and no traceback.

Every `match` in this chunk ends with a `case _: assert_never(result)`. That line is not
decoration and it is not an `assert` — what it does, and why the union return is unsafe
without it, is [10 · Exhaustiveness and `assert_never`](10-exhaustiveness-and-assert-never.md).

## Gotchas

**★ Symptom: a caller ignores a `ChargeResult` and a decline vanishes.** Cause: Python has no
`must_use`, so discarding a return value is legal and unreported; the result-object pattern
has no equivalent of an exception's mandatory propagation. Fix: raise for the outcomes that
must not be ignored, and reserve the union for the ones the immediate caller genuinely
branches on.

```python
result = charge(order_id, amount)
match result:
    case Declined(decline_code=code):
        raise PaymentDeclined(code)      # this one must travel
    case Charged() | GatewayDown():
        return result
    case _:
        assert_never(result)
```

**Symptom: a result object arrives four layers up with no idea where it came from.** Cause:
it was re-returned by each layer and carries only the fields you thought to add, unlike an
exception which carries the frames. Fix: either attach the origin explicitly when you create
it, or stop propagating the object and raise at the layer that first cannot proceed.

```python
@dataclass(frozen=True)
class GatewayDown:
    retry_after_s: int
    origin: str            # which call produced this, since there is no traceback
```

**Symptom: the middle four layers of a call stack all say the same three lines.** Cause: with
no propagation operator, every intermediate function must destructure the union and re-return
it, so the ceremony scales with depth. Fix: convert at the first layer that cannot proceed —
turn the failure variants into a raise there — so only the layers that genuinely branch carry
the union.

```python
def place_order(order_id: str, amount: int) -> Charged:
    result = charge(order_id, amount)
    match result:
        case Charged():
            return result                        # union stops here
        case Declined(decline_code=code):
            raise PaymentDeclined(code)
        case GatewayDown(retry_after_s=secs):
            raise GatewayUnavailable(secs)
        case _:
            assert_never(result)
```

**Symptom: the union is `Charged | Declined | dict` and nothing narrows properly.** Cause: one
member is a structural type rather than a distinct class, so a `match` or `isinstance` cannot
cleanly discriminate it from the others and the "tag" the pattern depends on does not exist.
Fix: every member of a tagged union should be a distinct class you defined, so identity of type
*is* the tag.

```python
@dataclass(frozen=True)
class RawPayload:            # not a bare dict
    body: dict[str, object]


ChargeResult = Charged | Declined | GatewayDown | RawPayload
```

## Interview questions

**★ Should you use Result objects in Python?**
Sometimes, and the honest answer names the costs. What they buy is that every outcome is in
the signature — the checker will not let a caller ignore a `Declined` variant, which is the
enforcement Python's exception channel structurally cannot provide, because raises appear in
no signature. What they cost is four things: no propagation operator, so every intermediate
layer must check and re-return; no `must_use`, so a caller can discard the value entirely and
nothing complains, which an exception makes impossible; no traceback, so the origin is
whatever you remembered to attach; and no stdlib alignment, so you are running two failure
channels at once with a translation layer between them. The rule that survives contact with a
real codebase is to use a union return where the failure is an ordinary outcome the
*immediate* caller branches on, and to raise for failures that need to travel. A result object
propagated through six layers is hand-rolled exceptions with worse ergonomics.

**★ Where exactly should a union return be converted back into an exception?**
At the first layer that cannot proceed on its own. The union is valuable where a caller
genuinely branches — the checkout handler that renders "card declined" beside the form, the
retry loop that reads `retry_after_s` — and it is pure ceremony everywhere else, because with
no `?` operator each intermediate layer has to destructure and re-return it. So the shape is:
the boundary function returns the union, one layer up decides, and the variants that mean "we
cannot continue" become raises there with their data carried on the exception. That gives you
the machine-checked exhaustiveness where the decision is made and the free propagation
everywhere above it, which is the combination neither channel provides on its own.

**Your union has three variants and each caller writes the same three-arm `match`. Is that a
smell?**
It is a signal to look, not an automatic defect. If the three arms genuinely do different
things at each call site — different messages, different retry policies — the repetition is
the point and `assert_never` keeps it honest. If they do the *same* thing at every call site,
the discrimination belongs in one place: write a single function that takes the union and
either returns the success variant or raises, and let every caller use that instead. The tell
is whether the arms differ. Identical `match` blocks in five modules is the union being
propagated past the layer that should have collapsed it, which is the same mistake as
threading a result object through six frames.


← Prev: [Overloads](08-overloads.md) · Index: [Designing the failure channel](README.md) · Next → [Exhaustiveness and `assert_never`](10-exhaustiveness-and-assert-never.md)
