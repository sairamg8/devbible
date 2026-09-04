---
title: "A Python signature carries the return type and says nothing whatever about what the function raises — PEP 484 declined to propose that syntax on purpose, so no checker will ever tell a caller that a raise you added yesterday is unhandled"
sidebar_label: "01 · Type checkers and silent APIs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [PEP 484 § Exceptions](https://peps.python.org/pep-0484/#exceptions)
> (*"No syntax for listing explicitly raised exceptions is proposed…"*, quoted below) and the
> Python 3.14 documentation —
> [`typing.Never` / `typing.NoReturn`](https://docs.python.org/3.14/library/typing.html#typing.Never),
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Every chunk before this one has asked what *you* should write in front of an operation.
This one asks the opposite question: what will everyone who calls *your* function be forced
to write, and who decided that? The answer lives in the signature — and the signature is
only half a contract. The return type is a machine-readable fact that a type checker will
enforce at every call site. What the function raises is a rumour: Python has no syntax for
declaring it, PEP 484 explicitly declined to add one, and no checker in the ecosystem will
report a call site as newly wrong because you added a `raise`. That asymmetry is the whole
API-design argument in this chapter, and this chunk is the raising half of it.**

## A signature is half a contract

Write the two designs side by side and read only the first line of each:

```python
def get_user(user_id: int) -> User: ...          # raises UserNotFound. You cannot tell.
def find_user(user_id: int) -> User | None: ...  # may not find one. You cannot miss it.
```

The second line is a fact a tool can act on. The first is a claim about the body that
nothing outside the body records. PEP 484 settled this deliberately, in a section titled
*Exceptions* that is two sentences long:

> *"No syntax for listing explicitly raised exceptions is proposed. Currently the only
> known use case for this feature is documentational, in which case the recommendation is
> to put this information in a docstring."*

That is the entirety of Python's position on checked exceptions, and it has not moved
since. There is no `raises` clause, no `typing` construct that expresses "this call can
fail with `PaymentDeclined`", and no checker flag that reconstructs one — because there is
no declaration for a checker to compare a call site against.

### The Java contrast, drawn precisely

This is the road not taken, and it is worth stating exactly rather than as a slogan. In
Java a *checked* exception is part of the method signature — a `throws PaymentException`
clause — and the compiler refuses to build a caller that neither catches it nor re-declares
it. The enforcement is real: you cannot accidentally ignore a checked failure. The costs
are equally real and equally famous — `throws Exception` widening as it propagates up a
call stack until it means nothing, and empty catch blocks written for no reason except to
make the compiler stop talking. Java's own unchecked hierarchy (`RuntimeException`) exists
because the language designers accepted that not every failure survives that regime.

Python took the other trade in full: **nothing is enforced, so nothing is annoying, and
nothing is checked either.** Neither language offers a third option. Knowing which one you
are in tells you precisely what has to be a *convention* here, because it cannot be a rule.

### What that costs, stated bluntly

**If you add a `raise` to an existing function, no type checker in the Python ecosystem
will report a single call site as newly wrong.** Not mypy, not pyright, not any of them.
The change passes review, passes CI on both sides of the dependency, and the first thing
that notices is production. The same holds in reverse: delete a `raise` and every `except`
block your callers wrote becomes dead code that no tool reports as unreachable.

Three compensations are available, and all three are conventions rather than guarantees:

1. **A `Raises:` section in the docstring** — which is what PEP 484 itself recommends in
   the very next sentence. What belongs in one, and why it is versioned,
   is [05k](02-the-raising-contract.md).
2. **A test that exercises the failure path**, so *your* expectation of what a dependency
   raises is recorded somewhere executable and breaks loudly when the dependency changes.
3. **One base exception class per package**, so a caller has something to catch that
   survives you adding a new subclass. This is the only *structural* compensation of the
   three, and the one most often missing.

```python
# payments/errors.py — every failure this package raises inherits from one class.
class PaymentError(Exception):
    """Base class for every error raised by the payments package."""


class PaymentDeclined(PaymentError):
    def __init__(self, decline_code: str) -> None:
        super().__init__(f"declined: {decline_code}")
        self.decline_code = decline_code


class GatewayUnavailable(PaymentError):
    """The gateway could not be reached; the capture may or may not have applied."""
```

A caller who writes `except PaymentError:` keeps working when version 2.1 adds
`PaymentRateLimited(PaymentError)`. A caller who enumerated your three concrete classes
does not — and, again, nothing will tell them. **The base class is how a library author
gives back some of what the missing `throws` clause took away**, which is why every mature
package on PyPI has one and why a package without one is unpleasant to depend on.

The standard library models this in its own hierarchy: `LookupError` exists so that a
caller who is equally indifferent to `KeyError` and `IndexError` has one name to write, and
`OSError` collects the errno-shaped failures under a single catchable class. Which
package's exception a given handler is actually catching, and how wide that catch really
is, is [06f · Whose exception is it](../06f-whose-exception-is-it.md).

## Gotchas

**★ Symptom: a library adds a `raise` in a patch release, a nightly job dies, and CI was
green on both sides.** Cause: Python has no checked exceptions — PEP 484 declined to
propose *"syntax for listing explicitly raised exceptions"* — so no checker can compare a
call site against what the callee raises, and there is no type-level fix available. Fix:
compensate with a test that pins your expectation of the dependency's failure behaviour, so
the upgrade breaks a test rather than a pager.

```python
def test_gateway_timeout_is_translated(monkeypatch):
    monkeypatch.setattr(gateway, "capture", _raise_timeout)
    with pytest.raises(GatewayUnavailable):
        capture_payment("ord_1", 500)
```

**★ Symptom: a caller's `except PaymentDeclined:` stops covering a failure after upgrading
your library, and they find out from a user.** Cause: you added a new concrete exception
class and they had enumerated the old ones — with no `throws` clause, an exhaustive
`except` tuple is the only thing they could write, and it cannot be future-proof. Fix: give
the package one base class and document *that* as the contract, so a new subclass is
additive rather than breaking.

```python
class PaymentError(Exception):
    """Base class for every error raised by this package."""


class PaymentRateLimited(PaymentError):     # v2.1: existing `except PaymentError` covers it
    def __init__(self, retry_after_s: int) -> None:
        super().__init__(f"rate limited; retry after {retry_after_s}s")
        self.retry_after_s = retry_after_s
```

**Symptom: a caller catches `httpx.TimeoutException` around your function and the handler
silently stops matching after your release.** Cause: you began translating your
dependency's error into your own type — a good change — but the dependency's class was
never in any signature, so the callers relying on it had nothing to warn them. Fix: keep
the original on `__cause__` with `from exc` and name your type in the `Raises:` section, so
a caller can at least discover what replaced it.

```python
try:
    resp = httpx.get(url, timeout=5)
except httpx.TimeoutException as exc:
    raise GatewayUnavailable(url) from exc      # original survives on __cause__
```

**Symptom: a payload the type checker was happy with arrives with a string where an `int`
was declared.** Cause: annotations describe what your own code promises, not what a
stranger sends; nothing checks them at runtime. Fix: a checker is not a boundary — parse at
the edge with explicit checks, as [05 · Where LBYL is right](../05-where-lbyl-is-right.md)
argues, and let the annotation describe what comes *out* of the parser.

```python
def parse_refund(body: dict[str, object]) -> RefundCommand:
    ...          # the isinstance checks are the guard; the return type is the evidence
```

**Symptom: an internal helper raises a bare `Exception` and every caller catches
`Exception` to be safe.** Cause: with no declared contract, the only class a caller can be
sure of catching is the one you actually raised — so raising the root class trains every
caller into a bare-ish catch that also swallows their own bugs. Fix: raise the narrowest
class that describes the failure, always under your package base.

```python
raise PaymentDeclined(decline_code)     # not: raise Exception("declined")
```

## Interview questions

**★ Python has no checked exceptions. What does that actually cost you, and what do you do
about it?**
PEP 484 is explicit — *"No syntax for listing explicitly raised exceptions is proposed"* —
and the consequence is that adding a `raise` to a function makes no call site newly wrong
in the eyes of any checker, while deleting one turns every caller's handler into unreported
dead code. Java made the other choice: `throws` is part of the method signature and the
compiler forces catch-or-declare, which buys real enforcement and costs you
`throws Exception` widening up a call stack and empty catch blocks written to silence it.
Since Python gives you no enforcement, everything is convention: a `Raises:` section, which
is what PEP 484 recommends in its very next sentence; tests that exercise the failure path
so your expectation lives somewhere executable; and one base exception class per package so
a caller can catch something that survives your adding a subclass. The answer that lands in
an interview names which of those three is *structural* — the base class — because it is
the only one that protects a caller who never read your documentation.

**★ Why is "raise or return `None`" an API-design decision rather than a matter of taste?**
Because the two designs put the work in different places and only one of them is enforced.
`-> User | None` is a type, so every caller is required by their checker to narrow it before
touching the value — one decision by the author becomes a mandatory `if` in a hundred call
sites, including the ninety where the caller had no doubt the user existed. `-> User` with a
`raise` puts nothing in any caller: those who care write a `try`, and the rest let it
propagate to a handler that already knows what to do with a failed request. So the question
when designing a signature is not "which is cleaner in my file" but "how much LBYL am I
about to compel in code I will never read". The arithmetic, and the cases where `None` is
still exactly right, are [05m](04-the-bill-every-caller-pays.md).

**What does a type checker prove about data arriving from outside your program?**
Nothing whatsoever. Annotations are not enforced at runtime; a function annotated `-> int`
that returns a `str` is a perfectly ordinary Python program that no interpreter objects to.
What a checker verifies is the internal consistency of the code you gave it, which is
exactly why the trust boundary in [05 · Where LBYL is right](../05-where-lbyl-is-right.md) is a
run of `if` statements rather than a set of annotations. The correct division of labour is
that the boundary parses untrusted input into a typed object using explicit checks, and the
annotations then describe the *interior*, where the checker's proofs are worth something
because every value in scope came from code it has read.

**Why does a library need a base exception class if callers can just catch the concrete
types?**
Because "the concrete types" is a list that only you can change and only they can maintain.
Without a `throws` clause there is no way for a caller to be told that version 2.1 added
`PaymentRateLimited`; their `except (PaymentDeclined, GatewayUnavailable):` keeps compiling
and quietly stops covering a real failure. A base class turns that from a breaking change
into an additive one — `except PaymentError:` covers subclasses you have not written yet.
It is the same reason the standard library groups `KeyError` and `IndexError` under
`LookupError`: a caller who is indifferent between them should have one name to write, and
a caller who is not can still name the specific class.

**Would you want checked exceptions in Python if you could have them?**
The honest answer is a trade rather than a preference, and saying so is the point. Checked
exceptions would give you exactly what is missing here: a call site that fails to compile
when a callee starts raising something new, which is the failure mode this whole chunk is
about. What they historically cost is visible in Java — signatures that accumulate `throws`
clauses through layers that cannot handle anything, and handlers written to silence the
compiler rather than to recover. Python's dynamic dispatch would also make the analysis
much weaker: a `throws` clause on a method you call through a duck-typed reference tells you
about the declared type, not the object you actually got. So the realistic position is that
the enforcement is worth wanting and the language cannot easily give it to you, which is
precisely why the conventions above are not optional.

---

← Prev: [The check is the rule](../05i-the-check-is-the-rule.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The raising contract](02-the-raising-contract.md)
