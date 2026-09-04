---
title: "An if narrows a type for the checker and an except handler is not among the constructs mypy documents for narrowing — which is the one cost in this argument that is genuinely asymmetric, and it belongs third in the order, ahead of speed and behind atomicity"
sidebar_label: "07g · Provability and the order"
sidebar_position: 160
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against
> [mypy — Type narrowing](https://mypy.readthedocs.io/en/stable/type_narrowing.html)
> (the documented narrowing constructs, quoted below) and the Python 3.14 documentation —
> [Glossary: `EAFP`, `LBYL`](https://docs.python.org/3.14/glossary.html).
> Target: **Python 3.14**, mypy's current documentation.
> Documentation-validated; **no timings, nothing run**.

**There is exactly one cost in this argument that is asymmetric, checkable and free to
collect: a condition is something a type checker can reason about, and an `except` handler
is not among the narrowing constructs mypy documents. That makes LBYL, in a strictly typed
codebase, occasionally worth its duplicate lookup — it buys a proof re-checked on every
commit that a benchmark can never see. This chunk states that claim with its exact limits,
shows why `assert` is the one narrowing construct not to ship, and closes the cost
argument with the order to decide in: atomicity, contract, legibility and provability, and
only then speed — and only when a profiler named the line.**

## The type checker is a cost you can bank

mypy's own framing:

> *"This section is dedicated to several type narrowing techniques which are supported by
> mypy. Type narrowing is when you convince a type checker that a broader type is
> actually more specific, for instance, that an object of type `Shape` is actually of the
> narrower type `Square`."*

The constructs that page documents are all **conditions**: `isinstance()`, `issubclass()`,
`type(obj) is int`, `callable()`, `obj is not None`, plain truthiness, and `assert`. An
`except` handler is not among them.

```python
def total(order: Order | None) -> Decimal:
    # LBYL: the checker knows `order` is an Order inside the branch.
    if order is not None:
        return order.subtotal + order.tax
    return Decimal(0)

def total_eafp(order: Order | None) -> Decimal:
    # EAFP: inside the try, the declared type is still `Order | None`, so the checker
    # objects to the attribute access on the None arm rather than trusting the handler.
    try:
        return order.subtotal + order.tax
    except AttributeError:
        return Decimal(0)
```

⚠️ **The exact limit of that claim.** mypy's page documents which constructs *do* narrow;
it does not enumerate what fails to. So the defensible statement is *"an `except` handler
is not one of the documented narrowing constructs"* — not "mypy cannot narrow inside a
handler", which the documentation nowhere says. Check your checker's own release notes
before relying on either reading.

The practical consequence: on a strictly typed codebase, the `if` sometimes buys something
the `try` cannot — a proof, checked in CI on every commit, that the attribute exists. That
is a real benefit on the other side of the ledger from the duplicate lookup, and it is
invisible to every benchmark.

`assert` narrows too, and is the one construct on that list you should not reach for in
shipped code, because it is removed when Python runs optimised — see
[11 · `assert`](../11-exceptions/10-assert.md).

```python
def charge(order: Order | None) -> None:
    assert order is not None          # narrows for mypy, vanishes under -O
    gateway.charge(order.total)

def charge(order: Order | None) -> None:
    if order is None:                 # narrows for mypy, survives -O
        raise ValueError("order is required")
    gateway.charge(order.total)
```

## The order to decide in

Cost is the **last** question, not the first, and it only gets asked when a profiler has
already named the line.

1. **Atomicity.** Can the state change between the look and the leap? If yes, LBYL is not
   slower, it is wrong — [02 · The race between the look and the leap](02-the-race-between-look-and-leap.md),
   [02b · The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md),
   [02c · Databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md).
2. **Contract.** Is the miss expected or an error? Expected means a default-valued API —
   `get`, `defaultdict`, `discard`, `missing_ok` — and an error means let it raise:
   [03 · Mappings, the decision table](03-mappings-the-decision-table.md),
   [03b · Writing on a miss](03b-writing-on-a-miss.md).
3. **Legibility and provability.** Which fact does the next reader need, and does the `if`
   buy the type checker something a handler cannot?
4. **Cost.** Only with a profile pointing at this line, and then by counting operations
   first ([07b](07b-the-miss-rate-decides.md)) and measuring second
   ([07e](07e-measuring-instead-of-arguing.md)).

## Gotchas

**★ Symptom: mypy reports an error on an attribute access or an operand type inside a
`try` block that the `except` clause plainly handles.** Cause: the handler is not one of
the narrowing constructs the checker documents, so inside the `try` the value still has
its declared type. Fix: narrow with a condition where you need the proof, and keep EAFP
for the failures the type system does not model.

```python
def send(recipient: User | None, body: str) -> None:
    if recipient is None:
        raise ValueError("recipient is required")   # narrows; the checker is satisfied
    try:
        mailer.send(recipient.email, body)          # EAFP for the failure that is real
    except SMTPException as exc:
        queue_for_retry(recipient.id, body, exc)
```

**Symptom: `assert x is not None` was used to satisfy the type checker, and the
`AttributeError` appears only in production.** Cause: production runs with `-O` or
`PYTHONOPTIMIZE`, and assertions are removed; the narrowing was a compile-time
convenience with no runtime guarantee. Fix: raise explicitly — it narrows identically and
survives optimisation.

```python
if order is None:
    raise ValueError("order is required")
```

**Symptom: a review comment says "use `if`, it is faster" on a line nobody has
profiled.** Cause: cost was consulted first instead of last, and it is the only one of
the four criteria that needs evidence nobody in the thread has. Fix: answer the earlier
questions first, and if cost genuinely survives them, ask for the profile before the
rewrite. If the answer to "which line did the profiler name" is silence, the review
comment is a preference wearing a performance costume.

## Interview questions

**★ Does LBYL ever pay for itself with a type checker?**
Yes, and this is the strongest argument for it that is not about atomicity. mypy documents
its narrowing constructs — `isinstance()`, `issubclass()`, `type(x) is T`, `callable()`,
`x is not None`, truthiness, `assert` — and they are all conditions; an `except` handler is
not among them. So `if x is not None:` gives you a machine-checked proof, on every commit,
that the access inside the branch is valid, while the EAFP spelling leaves the declared
type unchanged and the checker unconvinced. Be precise about the limit, though: mypy's page
lists what narrows, not what fails to narrow, so the claim is about the documented
constructs rather than a stated inability.

**★ In review, in what order do you decide between the two styles?**
Atomicity, contract, legibility, cost. First: can the state change between the check and
the action? If it can, LBYL is a bug and no benchmark rescues it. Second: is the miss
expected or exceptional? An expected miss is a default-valued API — `get`, `defaultdict`,
`discard`, `missing_ok=True` — which is neither classic spelling and is usually the right
answer. Third: which fact does the reader need in front of them, the precondition or the
failure mode, and does an `if` buy the type checker a proof? Only fourth, and only if a
profiler has named the line, does relative cost enter — and then by counting operations
before reaching for a stopwatch.

**Why should `assert` not be the narrowing construct you ship?**
It is on mypy's documented list and it does convince the checker, which is exactly what
makes it a trap: assertions are removed when Python runs optimised, so the guarantee the
checker recorded at analysis time has no counterpart at runtime in production. The failure
mode is the worst shape available — the code passes CI, passes staging with assertions on,
and raises an `AttributeError` on a `None` only in the environment that runs with `-O`.
Use `assert` for invariants you believe cannot be false (a programmer error, not an input),
and raise explicitly for anything a caller can cause; `if x is None: raise ValueError(...)`
narrows identically and survives optimisation. The full treatment is
[11 · `assert`](../11-exceptions/10-assert.md).

**Cost is last in your order. Is there any case where it actually wins the argument?**
Yes, but the case is narrow enough to describe precisely: a tight in-process loop, no I/O
inside it, a profile that names the line, a miss rate you have measured rather than
assumed, and no restructuring available that removes the branch entirely. In that
situation the operation count is the argument — one lookup against two — and a `timeit`
sweep across your real miss rate settles it. Notice how much has to be true first. Every
time I have seen this argument raised in review, at least one of those conditions was
missing, most often the profile.


---

← Prev: [The costs that decide](07f-the-costs-that-actually-decide.md) · Index: [EAFP vs LBYL](README.md) · Next → [Unpacking](../13-unpacking/README.md)
