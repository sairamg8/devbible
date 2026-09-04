---
title: "At a trust boundary LBYL is not a fallback for people who dislike exceptions — it is the only correct shape, because untrusted input has no invariants yet for an exception to violate, and the boundary's whole job is to create them once so the interior never checks again"
sidebar_label: "05 · Where LBYL is right"
sidebar_position: 131
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `LBYL`, `EAFP`](https://docs.python.org/3.14/glossary.html#term-LBYL),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`get` — *"never raises a `KeyError`"*),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) (`frozen`).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Four chunks of this topic have argued that a look is a claim about the past and that
the leap is the only test that is not out of date. All of that is true and none of it
applies to untrusted input, because untrusted input has no past: nothing has yet
established that `amount_cents` is an integer, so there is no invariant for an exception
to report the violation of. A trust boundary exists precisely to manufacture those
invariants — once, in one place, in the shape of `if ...: raise` — and everything inside
it is then allowed to assume. That is LBYL, it is correct, and the failure mode of
"prefer EAFP" here is a `KeyError` from four frames deep, served to a stranger as an HTTP
500.**

## The six cases where the check wins

The three questions from [the two names](01-the-two-names.md) — can the pre-condition
change, does the check ask the same question, and what does the failure branch need to
know — come out in favour of the `if` in a small, nameable set of situations. This is the
whole list, and the rest of chunk 05 is those six cases in order.

| | Case | Why the check wins | Where |
|---|---|---|---|
| 1 | **A trust boundary** | there is no established invariant yet, so nothing will raise on your behalf | this chunk; [05b](05b-assert-is-not-validation.md) for why the check cannot be an `assert`, [05c](05c-the-quiet-boundaries.md) for the boundaries that do not look like edges |
| 2 | **An irreversible or expensive leap** | a failed attempt cannot be discarded — the check filters almost all bad calls before money moves | [05d](05d-irreversible-leaps.md) |
| 3 | **A cheap look in front of a catastrophic leap** | the asymmetry pays for two operations, and a lock closes the gap the check leaves open | [05d](05d-irreversible-leaps.md) |
| 4 | **The check *is* the domain rule** | the guard exists to *create* a domain error, not to dodge a built-in one | [05i](05i-the-check-is-the-rule.md) |
| 5 | **Failures must be aggregated into a report** | conditions compose into data; a raise ends the loop | [05h](05h-aggregating-failures.md) |
| 6 | **The checker must be shown a narrowing, or the API never raises** | an `if` is a condition; a handler is not, and some calls answer failure with `None` | [05j](05j-type-checkers-and-silent-apis.md) |

## A boundary is where invariants are created, not where they are re-checked

An HTTP payload, a webhook body, a CLI argument, an environment variable, an uploaded
file, a message off a broker, a row written by an older version of your own code — all of
these arrive as *shapes you hope for*. The interior of your program is written against
types: `RefundCommand`, `int`, `EmailAddress`. Something has to convert one into the
other, and that conversion is a series of explicit tests whose failure is a *client's*
mistake rather than a program bug.

Two properties make the boundary the one place where every objection to LBYL evaporates:

- **The state being checked is a local.** The request body is a `dict` you just parsed and
  nobody else holds a reference to. There is no gap, because there is no second writer —
  the ownership test from [the race between look and leap](02-the-race-between-look-and-leap.md)
  clears it outright.
- **The check and the operation ask the same question.** `if not 1 <= amount <= MAX` *is*
  the requirement; it is not an approximation of some downstream operation that might
  disagree with it. There is no `isdigit`-style mismatch available, because nothing
  downstream would have complained at all.

## The pattern: parse at the edge, assume inside

```python
from dataclasses import dataclass

MAX_REFUND_CENTS = 100_000_00


@dataclass(frozen=True)
class RefundCommand:
    order_id: str
    amount_cents: int
    reason: str


class BadRequest(Exception):
    """A client error: the caller sent something the boundary refuses."""

    def __init__(self, field: str, detail: str) -> None:
        super().__init__(f"{field}: {detail}")
        self.field = field
        self.detail = detail


def parse_refund(body: dict[str, object]) -> RefundCommand:
    order_id = body.get("order_id")
    if not isinstance(order_id, str) or not order_id:
        raise BadRequest("order_id", "must be a non-empty string")

    amount = body.get("amount_cents")
    if isinstance(amount, bool) or not isinstance(amount, int):
        raise BadRequest("amount_cents", "must be an integer")
    if not 1 <= amount <= MAX_REFUND_CENTS:
        raise BadRequest("amount_cents", f"must be between 1 and {MAX_REFUND_CENTS}")

    reason = body.get("reason", "")
    if not isinstance(reason, str) or len(reason) > 500:
        raise BadRequest("reason", "must be a string of at most 500 characters")

    return RefundCommand(order_id=order_id, amount_cents=amount, reason=reason)
```

Every `if` in that function is LBYL and every one of them is right. Three details are
doing real work:

- **`body.get(...)` rather than `body[...]`.** A missing key is not an exceptional event at
  a boundary; it is the commonest input. `get` is documented to *"never raise a
  `KeyError`"*, so absence flows into the same `isinstance` check that catches a wrong
  type, and one branch produces one message.
- **`isinstance(amount, bool)` first.** `bool` is a subclass of `int`, so a JSON `true`
  passes `isinstance(amount, int)`. Without that clause a refund of `True` cents is a
  legal command.
- **The return type is `RefundCommand`, not `dict`.** This is what makes the interior's
  assumption checkable rather than hopeful — see the last gotcha in this chunk.

And the interior, which does not validate anything:

```python
def refund(cmd: RefundCommand, gateway, conn) -> None:
    # No re-validation. cmd.amount_cents is an int in range because the only way
    # to build a RefundCommand is through parse_refund.
    row = conn.execute(
        "SELECT amount_cents FROM orders WHERE id = ?", (cmd.order_id,)
    ).fetchone()
    if row is None:
        raise OrderNotFound(cmd.order_id)
    gateway.refund(cmd.order_id, cmd.amount_cents, cmd.reason)
```

Note which check survived inward: `row is None`. That one is not re-validation of the
client's input — it is a question about *shared state the boundary knows nothing about*,
and it is [05d](05d-irreversible-leaps.md)'s subject, races and all.

The two things this pattern is most often got wrong by each get their own chunk: spelling
the check `assert`, which the reference disqualifies outright
([05b](05b-assert-is-not-validation.md)), and failing to notice that an environment
variable, a declared upload size or a stored JSON column is a boundary too
([05c](05c-the-quiet-boundaries.md)).

## Gotchas

**★ Symptom: the same field is validated in the handler, the service and the repository,
and the three disagree about the maximum length.** Cause: LBYL with no owner — each layer
checks because it does not trust the next, so the rule exists in three places and drifts.
Fix: one boundary produces a type, and every inner signature demands that type; a second
check is then unreachable by construction.

```python
# The rule lives once, next to the type it constrains.
@dataclass(frozen=True)
class Reason:
    text: str

    def __post_init__(self) -> None:
        if len(self.text) > 500:
            raise BadRequest("reason", "must be at most 500 characters")


def refund(cmd: RefundCommand, reason: Reason) -> None: ...   # cannot be over-length
```

**★ Symptom: a malformed request produces a 500 and a traceback in the log instead of a
400.** Cause: no boundary check, so a built-in exception from four frames down became the
response — `KeyError: 'amount_cents'` is a *server* error as far as your framework is
concerned. Fix: parse at the edge and map the one client-error type to a status.

```python
def handle_refund(body: dict[str, object], gateway, conn) -> tuple[int, str]:
    try:
        cmd = parse_refund(body)
    except BadRequest as exc:
        return 400, f"{exc.field}: {exc.detail}"
    refund(cmd, gateway, conn)
    return 202, "accepted"
```

**Symptom: a boolean payload field is accepted as a numeric one, and an order is refunded
for one cent.** Cause: `bool` is a subclass of `int`, so `isinstance(True, int)` is true
and a JSON `true` passes an integer check. Fix: reject `bool` explicitly before the `int`
test, and put the clause in that order.

```python
if isinstance(amount, bool) or not isinstance(amount, int):
    raise BadRequest("amount_cents", "must be an integer")
```

**Symptom: a client typo — `amont_cents` — is accepted, and the refund goes out at the
default amount.** Cause: the boundary reads the keys it knows about and ignores everything
else, so a misspelled field is indistinguishable from an omitted one. Fix: refuse unknown
keys at the boundary; the set difference is one line and it turns a silent wrong answer
into a 400 naming the typo.

```python
ALLOWED_REFUND_FIELDS = frozenset({"order_id", "amount_cents", "reason"})


def parse_refund(body: dict[str, object]) -> RefundCommand:
    unknown = sorted(set(body) - ALLOWED_REFUND_FIELDS)
    if unknown:
        raise BadRequest("body", f"unknown fields: {', '.join(unknown)}")
    # ... the field checks above follow unchanged
```

**Symptom: "reason not provided" and "reason provided as an empty string" behave
identically, and an audit trail cannot tell them apart.** Cause: `body.get("reason", "")`
collapses absent into empty, which is the [empty-versus-missing](../05-truthiness/02-empty-versus-missing.md)
distinction losing its second half. Fix: keep the two apart in the type when the domain
cares, and only collapse them where you have decided the domain does not.

```python
reason = body.get("reason")
if reason is not None and not isinstance(reason, str):
    raise BadRequest("reason", "must be a string")
if reason is not None and len(reason) > 500:
    raise BadRequest("reason", "must be at most 500 characters")
# reason is now str | None — absent and empty stay distinguishable downstream
```

**Symptom: the boundary validated the payload and the interior still received `None`.**
Cause: the boundary checked the `dict` and then passed *the same `dict`* inward, so the
guarantee was a comment rather than a value — the next caller reached the interior
directly. Fix: return a new, typed, frozen object from the boundary and make the raw
`dict` unreachable from the interior's signature. That is what
`parse_refund() -> RefundCommand` buys: the interior *cannot* be called with unvalidated
data, so the absence of checks there is a proof rather than a hope.

## Interview questions

**★ Three layers touch the same request payload. Where does validation belong, and why
not in all three?**
In exactly one — the outermost layer that receives untrusted data — and its output should
be a type the inner layers demand. Validating in all three is not defence in depth; it is
the same business rule written three times, and the copies drift the first time the rule
changes. Defence in depth at this seam is *typing*, not repetition: if the interior's
signature takes `RefundCommand` and the only constructor path is the boundary parser, the
inner checks are unreachable code that can only ever go stale.

**★ Everything else in this topic says a check goes stale the moment it passes. Why does
that objection not apply at a trust boundary?**
Because staleness needs a second writer, and there is not one. The request body is a local
object your handler just built; no thread, process, filesystem or database can mutate
`body["amount_cents"]` between the `isinstance` test and the construction of the command.
Run the ownership test and the boundary clears it outright, which is exactly why this is
the strongest case for LBYL in the language — it is not a trade-off, it is a case where
the hazard is absent.

**★ If the boundary is LBYL, why is the interior allowed to be EAFP?**
Because the interior operates on established invariants, and an exception is how an
established invariant reports being violated. Inside the boundary, a `KeyError` means "the
data does not look like the shape we proved it had", which is a bug worth a traceback —
not a client mistake worth a 400. The two styles are doing different jobs on different
kinds of failure: the boundary converts *foreign* input into *domestic* types, and the
interior assumes domestic types and lets the operation be the test.

**Why return a typed object from the boundary instead of the validated dictionary?**
Because a `dict` carries no evidence of having been validated, so every function that
accepts one has to decide whether to trust it — and the honest answer, at review time, is
that nobody can tell. A frozen dataclass makes the validation a *fact about the value*:
the type appears in the interior's signature, the checker enforces it at every call site,
and there is no second construction path that skips the checks. It converts "we validate
this at the edge" from a convention into something the tooling can see.

**A reviewer says the boundary function is "unpythonic — six `if`s in a row".** How do you
answer?
By naming the mechanism rather than the label. Those six `if`s test properties of a local
object against requirements that no downstream operation would object to: nothing raises
`ValueError` because a refund reason is 501 characters long, so there is no exception
available to catch. The glossary's own hazard for LBYL is the race between the look and
the leap, and there is no race here. Six `if`s at a boundary and zero `if`s inside it is
the shape to defend; a `try` around the whole handler catching three built-in types is the
thing that actually deserves the review comment.

---

← Prev: [hasattr and duck typing](04c-protocols-and-structural-checks.md) · Index: [EAFP vs LBYL](README.md) · Next → [`assert` is not validation](05b-assert-is-not-validation.md)
