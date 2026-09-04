---
title: "The only annotation Python gives the raising channel is Never — it is what stops a guard from losing its narrowing when you factor it into a helper — and everything else about what a function raises lives in a docstring section that PEP 484 named as the alternative to syntax it declined to add"
sidebar_label: "02 · The raising contract"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Python 3.14 documentation —
> [`typing.Never` / `typing.NoReturn`](https://docs.python.org/3.14/library/typing.html#typing.Never)
> (*"the bottom type, a type that has no members"*, quoted below) — and
> [PEP 484 § Exceptions](https://peps.python.org/pep-0484/#exceptions)
> (*"the recommendation is to put this information in a docstring"*).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[01](01-type-checkers-and-silent-apis.md) established that Python has no syntax for
declaring what a function raises. This chunk is what you build in the hole that leaves.
There is exactly one type-level tool — `typing.Never`, which says a call does not return,
and whose real job is stopping a raising helper from silently destroying a caller's
narrowing — and after that you are down to a docstring section that PEP 484 recommended by
name. Neither is enforcement. Both are the only artefacts in which the other half of your
contract can exist at all, which is why they are worth writing with the care you would give
a signature.**

## `Never` — the return type of a function that only raises

A helper that always raises has a real return type, and it is not `None`:

> *"`Never` and `NoReturn` represent the
> [bottom type](https://en.wikipedia.org/wiki/Bottom_type), a type that has no members."*
>
> *"They can be used to indicate that a function never returns, such as `sys.exit()`."*
>
> *"`Never` and `NoReturn` have the same meaning in the type system and static type
> checkers treat both equivalently."*

This is not decoration. It is the one place where the raising channel and the type checker
actually meet: `Never` is what lets a raising helper **preserve narrowing** in its caller.

```python
from typing import Never


def fail_not_found(user_id: int) -> Never:
    raise UserNotFound(user_id)


def display_name(user_id: int) -> str:
    user = find_user(user_id)           # -> User | None
    if user is None:
        fail_not_found(user_id)         # `-> Never`: the checker knows the flow ends here
    return user.name                    # `user` is narrowed to User — no error
```

Annotate `fail_not_found` as `-> None` instead and the last line becomes a type error: as
far as the checker is concerned the helper returns, control reaches the next statement, and
`user` is still `User | None`. The same annotation is what makes `sys.exit()` usable in the
middle of a function without every line below it being flagged.

Which constructs narrow at all — `isinstance()`, `is not None`, truthiness, `assert` — and
why an `except` handler is not among the ones mypy documents is
[07g · Provability and the order](../07g-provability-and-the-order-to-decide.md)'s subject.
What matters here is the interaction, and it bites in a completely ordinary refactor:
**an inline `if x is None: raise ...` narrows, and factoring that guard into
`check_present(x)` silently stops narrowing unless the helper is annotated `-> Never`.**
The extracted helper is a strict improvement in every respect except the one nobody
remembers, and the error appears at the *call site*, several lines below the change.

⚠️ **`Never` and `NoReturn` are documented as equivalent for type checkers**, so choosing
between them is style. `NoReturn` reads naturally in a return position; `Never` is the name
you want in a *parameter* position, which is how `assert_never` works — that is
[10 · Exhaustiveness and `assert_never`](10-exhaustiveness-and-assert-never.md).

A second, quieter payoff: a checker that understands `Never` can flag code *after* the call
as unreachable. That turns "this validator always raises, so the `return None` below it is
dead" from a comment somebody has to notice into a diagnostic somebody cannot merge past.

## Then write `Raises:`, because nothing else will

PEP 484 did not merely decline exception syntax — it named the alternative in the same
breath: *"the recommendation is to put this information in a docstring."* That sentence is
why a `Raises:` section is not documentation hygiene in Python. **It is the only place the
other half of the contract can live.**

```python
def capture_payment(order_id: str, amount_cents: int) -> Receipt:
    """Capture an authorised payment and return the receipt.

    Raises:
        OrderNotFound: no order with this id. Do not retry.
        OrderNotAuthorized: the order exists but has not been authorised.
        PaymentDeclined: the gateway refused. Carries `.decline_code`.
        GatewayUnavailable: the gateway could not be reached; the capture may
            or may not have happened. Reconcile before retrying — do not blind-retry.
    """
```

Four rules make that section worth reading rather than worth skipping:

- **Document what a caller might reasonably catch, not everything that could escape.**
  `MemoryError`, a `TypeError` from a bug of yours, a `KeyboardInterrupt` — none of those
  are part of anyone's contract, and listing them turns the section into noise that trains
  readers to skip it.
- **Document the ambiguous ones especially.** `GatewayUnavailable` is the entry that earns
  the docstring: the caller cannot know whether a retry is safe unless you say so, and no
  type in any language expresses "possibly applied". That is
  [05d · Irreversible leaps](../05d-irreversible-leaps.md)'s problem arriving as prose because
  it cannot arrive as a type.
- **Name the attributes the exception carries.** A caller writing
  `except PaymentDeclined as exc:` needs to know `exc.decline_code` exists. That is a
  signature too, and it is equally invisible — putting the data on the exception rather
  than inside its message is [05i · The check is the rule](../05i-the-check-is-the-rule.md).
- **Treat the section as an API surface with a version.** Removing an entry is a relaxation
  and is usually safe. *Adding* one is a breaking change for every caller with a `try`
  around your function, even though nothing anywhere will say so. What that migration looks
  like is [03 · Versioning the failure channel](03-versioning-the-failure-channel.md).

### What it cannot do, and the one thing that helps

A docstring is unchecked prose, so it rots exactly like a comment: a `Raises:` entry
naming an exception the function stopped raising two years ago is worse than no entry,
because a reader trusts it. Nothing in Python will diff a docstring against a body.

The partial answer is to pin the load-bearing entries with a test — which converts the two
or three that actually matter from prose into something that fails when it becomes false:

```python
def test_capture_declined_carries_a_code():
    with pytest.raises(PaymentDeclined) as excinfo:
        capture_payment("ord_declined", 500)
    assert excinfo.value.decline_code == "insufficient_funds"
```

That test is not testing the docstring. It is testing the *contract the docstring
describes*, which is the only version of "checking" available in a language that declined
to put the information in the signature.

## Gotchas

**★ Symptom: the checker reports "cannot access attribute on `None`" on the line *after* a
guard that plainly raises.** Cause: the guard was factored into a helper annotated
`-> None`, so the checker believes control returns and the union is still live past it —
the narrowing you had when the `raise` was inline was lost in the refactor. Fix: annotate
the helper `-> Never` (or `NoReturn`); the bottom type is what tells the checker the flow
ends there.

```python
def fail_not_found(user_id: int) -> Never:
    raise UserNotFound(user_id)
```

**★ Symptom: a `Raises:` section lists nine exception types and nobody reads it.** Cause:
it was written by enumerating everything that could escape rather than everything a caller
might catch — `MemoryError` and internal `TypeError`s crowd out the two entries that
matter. Fix: list only what is part of the contract, and say what each one implies for a
retry.

```python
def fetch_invoice(invoice_id: str) -> Invoice:
    """Fetch an invoice.

    Raises:
        InvoiceNotFound: no such invoice. Do not retry.
        BillingUnavailable: upstream is down. Safe to retry with backoff.
    """
```

**★ Symptom: a `Raises:` entry names an exception the function has not raised in two
years, and a caller writes a handler for it.** Cause: the docstring is not checked by
anything, so it rots like a comment, and unlike a stale comment it is load-bearing. Fix:
pin the entries that matter with a test, so the prose has something underneath it that
fails when it stops being true.

```python
def test_missing_invoice_raises():
    with pytest.raises(InvoiceNotFound):
        fetch_invoice("inv_does_not_exist")
```

**Symptom: a caller retries a payment capture after an error and the customer is charged
twice.** Cause: the `Raises:` section named `GatewayUnavailable` but did not say whether
the operation may have applied, so "retry on transient errors" looked like a safe default.
Fix: say it, in the entry, in the imperative — the type cannot carry it and the caller
cannot derive it.

```python
    Raises:
        GatewayUnavailable: the capture may or may not have applied. Reconcile
            against the gateway before retrying; do not retry blindly.
```

**Symptom: a guard helper is annotated `-> NoReturn` in one module and `-> Never` in
another, and a reviewer asks which is correct.** Cause: both are, and the docs say so —
they *"have the same meaning in the type system and static type checkers treat both
equivalently"*. Fix: pick one per codebase for consistency rather than correctness;
`NoReturn` reads better as a return annotation, `Never` is the name you need in a parameter
position.

**Symptom: a function annotated `-> Never` returns normally on one path, and nothing
complains at runtime.** Cause: annotations are not enforced by the interpreter; `Never` is
a promise to a checker, not a guard. Fix: make the body structurally incapable of returning
— a single `raise`, with no branches — and let the checker verify the claim you made.

```python
def fail_unauthorised(user_id: int) -> Never:
    raise Unauthorised(user_id)          # one statement; nothing to fall through
```

## Interview questions

**★ What is `typing.Never` for, and what does it buy beyond documentation?**
It is the bottom type — the docs describe `Never` and `NoReturn` as representing *"the
bottom type, a type that has no members"* — and it is how you tell a checker that a call
does not return. The practical payoff is narrowing. A raising helper annotated `-> None`
leaves the checker believing control flows past it, so a `User | None` stays a union and the
next line is an error; annotated `-> Never`, the branch is understood to end and everything
after it sees the narrowed type. This bites in a very ordinary refactor: an inline
`if x is None: raise ...` narrows, and factoring that guard into `check_present(x)` silently
stops narrowing unless the helper says `-> Never`. It is also what makes `sys.exit()` usable
mid-function, and it lets a checker report genuinely unreachable code after the call. The
docs state the two names are treated equivalently by static checkers, so the choice between
the spellings is style.

**★ A reviewer wants the `Raises:` section deleted as "redundant with the code". How do you
answer?**
By pointing at the signature. The return type is in the code in a form a machine can read;
what the function raises is not, anywhere, and PEP 484 says so — it declined to add the
syntax and recommended the docstring in its place. So the section is not duplicating a
machine-readable fact, it is the *only* record of one. The versioning argument usually
finishes it: adding an entry is a breaking change for every caller with a `try` around the
call, and if the section does not exist there is no artefact in which that change can even
be noticed, let alone reviewed. The fair part of the objection is rot — a docstring is
unchecked prose — and the answer to that is a test on the entries that matter, not deletion.

**★ How would you make a library's exception contract discoverable, given that no tool
enforces it?**
Three artefacts, in decreasing order of how much they protect a caller who never reads
documentation. First, a single base exception class per package, so `except PaymentError:`
survives every subclass you add later — that is the only structural protection available,
and it is [01](01-type-checkers-and-silent-apis.md)'s subject. Second, a `Raises:` section
on every public function, listing what a caller might reasonably catch, naming the
attributes the exception carries, and saying what each failure implies for a retry. Third,
tests that pin the load-bearing entries so the docstring cannot silently rot. None of these
is enforcement; together they are the difference between an upgrade that breaks a test and
one that breaks a customer.

**What actually goes in a `Raises:` entry beyond the class name?**
Three things the class name cannot carry. **Whether a retry is safe** — the single most
valuable line in the section, because "possibly applied" is unrepresentable in any type
system and a caller will otherwise assume a transient-looking error is retryable. **What
the exception carries** — if a handler needs `exc.decline_code` or `exc.retry_after_s`,
that attribute is as much a part of the signature as a parameter, and equally invisible.
**Which condition produces it**, in the domain's words rather than the implementation's:
"no order with this id" tells a caller what to check; "the SELECT returned no rows" tells
them about your storage layer and will be wrong after the next refactor.

**If `Never` is only a promise to the type checker, what stops a `Never` function from
returning?**
Nothing at runtime — annotations are not enforced by the interpreter, so a function
annotated `-> Never` with a conditional `return` is an ordinary Python program that will
happily return. What stops it is the checker, which verifies the claim against the body: a
path that falls off the end of a `Never`-annotated function is an error where the checker
runs. The discipline that makes this reliable is keeping such helpers structurally trivial —
one `raise`, no branches — so there is no path for the claim to be wrong on. That is the
same distinction as everywhere else on this page: the annotation records the intent, the
checker verifies your code against it, and neither one is a guard against data or a
guarantee at runtime.

---

← Prev: [Type checkers and silent APIs](01-type-checkers-and-silent-apis.md) · Index: [Designing the failure channel](README.md) · Next → [Versioning the failure channel](03-versioning-the-failure-channel.md)
