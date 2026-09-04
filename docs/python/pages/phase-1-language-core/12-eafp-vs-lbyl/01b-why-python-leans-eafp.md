---
title: "Python leans EAFP because its failure channel is specific, its protocols are duck-typed and a try that does not raise is free — and both style labels misclassify code the moment you apply them by counting keywords"
sidebar_label: "01b · Why Python leans EAFP"
sidebar_position: 121
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `EAFP`, `duck-typing`](https://docs.python.org/3.14/glossary.html),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access),
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html)
> ("zero-cost" exceptions),
> [`asyncio` exceptions](https://docs.python.org/3.14/library/asyncio-exceptions.html).
> Target: **Python 3.14**. Documentation-validated; **no timings**.

**Every language has both styles available; Python's standard library actively
prescribes one of them, and in one place calls the other a security hole. That is not
cultural — it follows from three concrete properties of the language: exceptions are
specific types carrying data, interfaces are duck-typed so the only complete test of an
interface is using it, and since 3.11 a `try` that does not raise costs nothing. But the
same glossary that gives you the vocabulary defines both styles by *keyword count*, and
that is how the labels get misapplied: a `try` spanning four operations reads as EAFP
while asserting nothing, and a domain-rule guard reads as LBYL while being simply
correct.**

## Why Python leans EAFP when other languages do not

The glossary's own contrast is with *"the LBYL style common to many other languages such
as C"*, and C is the honest comparison: a language whose failure channel is a return
value you may ignore has no cheap way to *offer* forgiveness. If `fopen` returns `NULL`
and sets `errno`, the check and the action are already fused, and the idiom that grew
around it is "test first".

Python's failure channel is different in three ways that all push the same direction.

- **Exceptions are specific and carry data.** `KeyError`, `AttributeError`,
  `FileNotFoundError`, `ValueError` are separate types in a documented hierarchy, so a
  handler can be as narrow as the operation. `except KeyError` is a *precise* statement
  about one failure mode, which is what makes EAFP safe here and reckless in a language
  with one exception type.
- **The protocols are duck-typed.** The glossary defines duck-typing as a style that
  *"does not look at an object's type to determine if it has the right interface; instead,
  the method or attribute is simply called or used"*, and says it *"typically employs
  `hasattr()` tests or EAFP programming"*. If the interface is "responds to `.read()`",
  the only complete test for it is calling `.read()`.
- **A `try` that does not raise is free.** From What's New in Python 3.11:
  > *""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when
  > no exception is raised."*

  The historical argument for LBYL — that setting up a `try` costs something on every
  pass — stopped being true in 3.11 for the no-exception path. Raising still costs; the
  guard does not.

And the standard library does not merely permit EAFP, it **prescribes** it in the one
place where LBYL is a security defect. The `os.access` documentation:

> *"Using `access()` to check if a user is authorized to e.g. open a file before actually
> doing so using `open()` creates a security hole, because the user might exploit the
> short time interval between checking and opening the file to manipulate it. It's
> preferable to use EAFP techniques."*

That is the reference manual telling you your `if` is a vulnerability. It is taken apart in
full, with the docs' own rewrite, in **the race between the look and the leap** *(not
written yet)*.

## What "style" hides — a worked misreading

Because both names describe *shape*, they get applied to code by counting keywords, and
counting keywords misclassifies constantly.

```python
# Shaped like EAFP. Is not EAFP.
def user_email(users, user_id):
    try:
        return users[user_id]["profile"]["email"]
    except (KeyError, TypeError):
        return None
```

Three lookups sit inside one `try`, and the handler cannot tell you which one failed, or
whether `TypeError` came from indexing `None` or from a genuinely wrong argument type.
That is not "assuming the existence of valid keys" — it is declining to say what the
function requires. EAFP is a claim about *one* operation; a `try` spanning four is an
absence of claims. [Narrowing the `try`](06-narrowing-the-try.md) is the repair, and it
is the single most common defect in code written by someone who has just been told EAFP
is Pythonic.

```python
# Shaped like LBYL. Is fine, and EAFP would be worse.
def transfer(account, amount: int) -> None:
    if amount <= 0:
        raise ValueError(f"amount must be positive, got {amount}")
    if amount > account.balance:
        raise InsufficientFunds(account.id, amount, account.balance)
    account.debit(amount)
```

Nothing here is racing: `amount` is a local, and the balance check is a *domain rule*
whose failure must be reported in domain terms, not discovered by letting a debit blow
up halfway through. The leap is expensive and irreversible, which is exactly the
territory [where LBYL is right](05-where-lbyl-is-right.md) — and a rule this topic
states as bluntly as it can: **you do not apologise for a money movement.**


## Gotchas

**★ Symptom: a reviewer writes "unpythonic, use EAFP" on a guard that was protecting an
irreversible operation.** Cause: both names name shapes, so review turns into keyword
counting — `if` bad, `try` good. Fix: answer the mechanical questions in code rather than
arguing the label, and say which one decided it. *"The state is local and the leap is a
DB write, so the check stays"* ends the discussion; *"this is more Pythonic"* does not.

**★ Symptom: `except Exception` around an EAFP leap swallows an asyncio cancellation, or
hides a genuine bug as a cache miss.** Cause: the handler was written to match "anything
goes wrong" rather than the one failure the assumption produces.
`asyncio.CancelledError` has been *"a subclass of `BaseException` rather than
`Exception`"* since 3.8 precisely so a broad `except Exception` cannot eat it — the docs
add that *"in almost all situations the exception must be re-raised"* — but
`except Exception` still eats every `TypeError` your own handler code contains. Fix: name
the exception the assumption implies, and nothing else.

```python
try:
    return cache[key]           # the assumption: the key is there
except KeyError:                # the only way that assumption fails
    return fetch_and_store(key)
```

The exception hierarchy, `BaseException`, the bare `except:` and why breadth is the
default mistake are [topic 11's](../11-exceptions/04b-the-bare-except.md) subject; this
topic assumes it.

**Symptom: a function validates its arguments, and so does every caller.** Cause: LBYL
with no owner — each layer looks before leaping because it does not trust the next.
Fix: name one owner. Validate at the boundary where untrusted data arrives, and inside
that boundary let the operation raise; a second check is dead code that will drift out of
step with the first.

```python
# Boundary: untrusted input, so it looks before it leaps.
def create_user_endpoint(payload: dict) -> Response:
    email = payload.get("email")
    if not email or "@" not in email:
        return Response(400, "email required")
    return Response(201, create_user(email))

# Inside the boundary: the precondition is already established. No second check.
def create_user(email: str) -> User:
    return repository.insert(User(email=email))
```

**Symptom: an `os.access` check passes and `open()` raises anyway, or worse, the file
that opened is not the file that was checked.** Cause: `access()` and `open()` are two
syscalls, and the docs are explicit that *"I/O operations may fail even when `access()`
indicates that they would succeed"*, and that the interval between them is exploitable.
Fix: delete the check and handle the failure of the real call — the rewrite the
documentation itself prints.

```python
try:
    fp = open("myfile")
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

**Symptom: someone "converts the codebase to EAFP" and the exception handlers start
catching three types each.** Cause: EAFP was read as a refactoring rule rather than as a
statement about a single assumption, so multi-step expressions moved wholesale into
`try` blocks. Fix: one assumption per `try`, and if a block needs three handlers it
needed three statements.

**Symptom: `hasattr` tests everywhere, and the code is still described as duck-typed.**
Cause: the glossary lists `hasattr()` tests *and* EAFP as duck-typing techniques, so
`hasattr` feels like the sanctioned choice — but a `hasattr` chain is LBYL wearing a duck
costume, with all the approximation error that implies. Fix: where the interface is
"responds to a call", call it; keep `hasattr` for optional-attribute *presence* on
objects you own.

## Interview questions

**★ Is EAFP faster than LBYL?**
Not a question with one answer, and the documentation supports only two narrow claims:
since 3.11 *""Zero-cost" exceptions are implemented, eliminating the cost of `try`
statements when no exception is raised"*, and a 3.11 change *"reduced the time required
for catching an exception by about 10%"*. So entering a `try` on the success path is
free, while raising and catching still costs something. That makes EAFP cheaper when the
assumption usually holds and more expensive when it usually fails. Anything more precise
than that is a benchmark nobody in this conversation has run — say so rather than
guessing.

**★ Give a case where LBYL is not merely acceptable but correct.**
Any leap that is irreversible, expensive, or whose failure must be reported in domain
terms: a funds transfer that must reject an over-balance withdrawal as
`InsufficientFunds` rather than discover it mid-write; a batch import that must report
*all* invalid rows rather than die on the first; a request handler validating untrusted
input at a trust boundary. In each, the state being checked is not shared, so there is no
gap to race, and the check *is* the business rule.

**★ What does duck typing have to do with this?**
It is the same argument at the level of interfaces. The glossary defines duck-typing as
determining suitability by using an object rather than inspecting its type — it *"does
not look at an object's type to determine if it has the right interface; instead, the
method or attribute is simply called or used"* — and says it *"typically employs
`hasattr()` tests or EAFP programming"*. If "is this file-like" means "does `.read()`
work", then calling `.read()` is the only complete test, and every type-shaped check
ahead of it is an approximation.

**A colleague says "EAFP means wrap it in `try`". What is wrong with that?**
It drops the half of the definition that carries the meaning. EAFP *assumes* — it states
a precondition in the shape of the code and handles the one specific way that assumption
can fail. A `try` around four operations catching three exception types asserts nothing
and diagnoses nothing; it is broader than any assumption you could name. The test is
whether you can say, in one sentence, which assumption this handler exists to absorb.

**Why does C-style code lean LBYL, and what changed in Python?**
The glossary's own contrast is with *"the LBYL style common to many other languages such
as C"*. A language whose failure channel is a return value has no cheap way to offer
forgiveness: if the call hands back `NULL` and sets `errno`, checking and acting are
already fused into one idiom, and the culture that grows around it is "test first".
Python has specific exception types carrying data, so a handler can be exactly as narrow
as the operation — and since 3.11 the guard itself is free when nothing raises.

**The documentation calls one of these styles a security hole. Which, and why?**
LBYL, in the `os.access` entry: *"Using `access()` to check if a user is authorized to
e.g. open a file before actually doing so using `open()` creates a security hole, because
the user might exploit the short time interval between checking and opening the file to
manipulate it. It's preferable to use EAFP techniques."* The mechanism is the gap: what
was checked and what was opened are resolved separately, and the path can be swapped in
between. It is the same two-operations problem as the mapping race, with an attacker
supplying the concurrency.

**In the documentation's own EAFP rewrite of the `access()` example, why is the `return`
inside an `else:` clause rather than inside the `try:`?**
So that only the `open()` call is guarded. If the `with fp: return fp.read()` sat inside
the `try`, a `PermissionError` raised by the *read* — or by anything else in that block —
would be absorbed by a handler written for the open. The `else` clause runs only when the
`try` body completed without raising, which keeps the assumption and its handler
one-to-one. That clause is [topic 11's](../11-exceptions/02-the-else-clause.md) subject
and it is what makes narrow EAFP practical.

**Their rewrite catches `PermissionError` only. Is that a bug?**
No — it is a faithful translation. The original checked `os.R_OK`, readability, so the
rewrite handles exactly the failure that check was predicting and lets everything else
propagate. A missing file still raises `FileNotFoundError` and still reaches the caller,
which is almost certainly what you want: the function's contract was "fall back to
default data if I may not read this", not "return default data whatever happens".

---

← Prev: [The two names](01-the-two-names.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The race between the look and the leap](02-the-race-between-look-and-leap.md)
