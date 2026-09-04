---
title: "Python publishes exactly two cost figures for exception handling, both from What's New in 3.11, and neither compares a try against an if — so the only honest place to start is the mechanism, which moved the cost onto the raising path rather than removing it"
sidebar_label: "07 · The cost argument"
sidebar_position: 154
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html),
> [Glossary: `EAFP`, `LBYL`](https://docs.python.org/3.14/glossary.html),
> and CPython's own implementation notes,
> [*Zero-Cost Exception Handling in Python*](https://github.com/python/cpython/blob/main/InternalDocs/exception_handling.md)
> (`main` branch, read 2026-09-03 — an implementation note, not a language guarantee).
> Target: **Python 3.14**.
> 🔴 **No timings, no benchmarks and no measured numbers appear on this page.** Every
> figure below is quoted from a named source.

**"Exceptions are slow" is the most-cited and least-examined reason people give for
picking a spelling, and the honest answer is narrow enough to state in two sentences of
quoted documentation. Python publishes exactly two cost claims about exception handling,
both from 3.11: entering a `try` that does not raise costs nothing, and catching an
exception got about 10% cheaper. Neither of them compares a `try` against an `if`, and no
official source anywhere gives you that ratio. This chunk establishes what the record
says and why — the structural change that made a non-raising `try` free, and the fact
that the cost was relocated onto the raising path rather than deleted. The argument you
can then actually win, in operation counts rather than seconds, is
[07b · The miss rate decides](07b-the-miss-rate-decides.md), extended by
[07c · The double-work argument](07c-the-double-work-argument.md); where the cost actually
sits once the path touches a disk or a socket is
[07d · Where the cost actually is](07d-where-the-cost-actually-is.md); what to do when
someone demands a number is
[07e · Measuring instead of arguing](07e-measuring-instead-of-arguing.md); and the costs
that decide the spelling in practice are
[07f · The costs that decide](07f-the-costs-that-actually-decide.md) — readability and
maintenance — and
[07g · Provability and the order to decide in](07g-provability-and-the-order-to-decide.md).**

## What the documentation actually says — the whole of it

From *What's New in Python 3.11*, in the Misc section:

> *""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when
> no exception is raised."*

And, separately:

> *"A more concise representation of exceptions in the interpreter reduced the time
> required for catching an exception by about 10%."*

That is the complete published record. Read what it does **not** say, because that is
where every bad argument in this area comes from:

- It gives **no per-raise cost**. "Raising is N times slower than returning" has no
  documented value.
- It **never compares `try` to `if`**. The 10% is 3.11 against 3.10, not `except`
  against `in`.
- There is **no benchmark, no workload and no machine** attached to either sentence.
- The 10% is about *catching*, i.e. the failure path. It says nothing about the success
  path, which the first sentence already declared free.

Anything more precise than *"entering a `try` that does not raise costs nothing; raising
and catching still costs something"* is not documentation — it is somebody's benchmark,
and you should ask which machine, which build and which miss rate before you repeat it.

## The mechanism, so you are not trusting a slogan

"Zero-cost" is a name for a structural change, not a marketing claim, and CPython's own
implementation notes describe it. The document is titled *Zero-Cost Exception Handling in
Python* and says:

> *"In the common case (where no exception is raised) the cost is reduced to zero (or
> close to zero)."*

> *"The cost of raising an exception is increased, but not by much."*

The shape of the mechanism is the part worth carrying around:

> *"The exception table is stored in the code object's `co_exceptiontable` field."*

> *"At runtime, when an exception occurs, the interpreter calls `get_exception_handler()`
> in Python/ceval.c to look up the offset of the current instruction in the exception
> table."*

So the handler's location is decided **at compile time** and parked in a table hanging
off the code object; the interpreter consults that table **only when an exception
occurs**. Entering the `try` therefore does no bookkeeping — there is nothing to push,
because the mapping from "instruction that failed" to "handler that catches it" is
already written down. The cost did not vanish; it **moved onto the raising path**, and
CPython's note is explicit that the raising path got more expensive, while refusing to
say by how much.

🔴 **The boundary of this claim.** Those sentences are CPython implementation notes on
the `main` branch, not the language reference — the language does not guarantee a cost
model, and another implementation (PyPy, GraalPy, MicroPython) is free to differ. Note
also the two hedges the authors put in themselves: *"or close to zero"*, and
*"increased, but not by much"*. Neither side is quantified in any source I could find.
If a page tells you the exact multiplier, ask where it came from.

**One piece of folklore this retires.** Pre-3.11, wrapping a `try` around each iteration
of a loop cost setup work per entry, so "hoist the `try` out of the loop" was performance
advice. With the cost of a non-raising `try` eliminated, that motivation is gone, and the
placement of the `try` is now a purely **semantic** decision:

```python
# Per item: one bad row is skipped, the batch completes.
imported = 0
for row in rows:
    try:
        table.insert(parse(row))
    except ValueError as exc:
        log.warning("skipping row %r: %s", row, exc)
    else:
        imported += 1

# Around the loop: one bad row aborts the batch. A different program.
try:
    for row in rows:
        table.insert(parse(row))
except ValueError as exc:
    raise ImportAborted(f"batch rejected at {row!r}") from exc
```

Choose between those two by asking whether the batch should survive a bad row. Never by
asking which is faster; the version that finishes the wrong work faster is not the
winner.

## Gotchas

**★ Symptom: "we moved the `try` outside the loop for performance", and now one malformed
record aborts a 200,000-record import.** Cause: pre-3.11 folklore applied to a
post-3.11 interpreter — the per-entry setup cost that justified hoisting no longer
exists, but hoisting silently changed the program's error semantics from *skip the row*
to *abandon the batch*. Fix: place the `try` where the recovery belongs, and let the
`else` clause carry the success bookkeeping.

```python
for record in records:
    try:
        parsed = parse(record)
    except ValueError as exc:
        rejected.append((record, str(exc)))
    else:
        store(parsed)
```

**Symptom: a team upgrades a 3.9 service to a current interpreter expecting
exception-heavy code to get dramatically faster, and the hot paths that raise on every
call barely move.** Cause: the published improvement is on the path that does *not* raise;
the same implementation notes say the raising path got more expensive, and the only
recorded gain on the failure side is that catching *"reduced the time required for
catching an exception by about 10%"*. An upgrade cannot fix a design that raises on the
common case. Fix: find the raises that are routine and give them a return value instead —
that is a code change, not a version change.

```python
# Raises on every cache miss, which is most calls during warm-up.
try:
    value = cache[key]
except KeyError:
    value = compute(key)
    cache[key] = value

# One lookup, no raise, same semantics.
value = cache.get(key, _MISSING)
if value is _MISSING:
    value = cache[key] = compute(key)
```

**Symptom: "zero-cost exceptions" is quoted as evidence that raising is free, so
exceptions get used as a loop-control mechanism.** Cause: the quote is scoped to `try`
statements *"when no exception is raised"*, and CPython's own note says the opposite about
the other path: *"The cost of raising an exception is increased, but not by much."* Zero
cost applies to the guard, never to the throw. Fix: if the "exception" happens on most
iterations, it is a return value, not an exception.

```python
# Control flow by exception on the common path.
def next_token(stream):
    try:
        return stream.pop()
    except IndexError:
        raise StopIteration from None

# The miss is expected; report it in the return value.
SENTINEL = object()

def next_token(stream):
    return stream.pop() if stream else SENTINEL
```

**Symptom: a `try` grew to wrap forty lines "because it is free anyway", and now a
`KeyError` from deep inside a called function is reported as a missing config key.**
Cause: "zero-cost" is a statement about **runtime cost**, not about scope. The width of a
`try` costs you nothing in time and everything in diagnosis — a wide block cannot tell
which operation raised. Fix: keep the `try` around the one operation whose failure you
are claiming to handle, and move the rest into `else`. See
[11 · The four clauses](../11-exceptions/01-the-four-clauses.md) and
[11 · The `else` clause](../11-exceptions/02-the-else-clause.md).

```python
try:
    dsn = config["database_url"]
except KeyError:
    raise ConfigError("database_url is required") from None
else:
    pool = connect(dsn)
    migrate(pool)
    warm_cache(pool)
```

## Interview questions

**★ Is exception handling slow in Python?**
Split the question, because the two halves have different answers and only one of them
is documented. *Setting up* a handler is free since 3.11 — What's New says
*""Zero-cost" exceptions are implemented, eliminating the cost of `try` statements when
no exception is raised"* — so a `try` on a path that does not raise costs nothing.
*Raising and catching* still costs something: the same release notes say a change
*"reduced the time required for catching an exception by about 10%"*, and CPython's
implementation notes say *"The cost of raising an exception is increased, but not by
much."* Nobody publishes how much, and nobody publishes it relative to an `if`. So the
defensible answer is: the guard is free, the throw is not, and the size of the throw is
an open question you would have to measure on your own workload.

**★ Why is `try` free now — what actually changed in 3.11?**
The handler's location moved from a runtime operation to a compile-time table. CPython's
notes describe an exception table *"stored in the code object's `co_exceptiontable`
field"*, and say that *"at runtime, when an exception occurs, the interpreter calls
`get_exception_handler()` in Python/ceval.c to look up the offset of the current
instruction in the exception table."* Because the mapping from failing instruction to
handler is already written down, entering the `try` has no bookkeeping to do — the table
is consulted only on the raising path. The cost was not removed, it was relocated, which
is why the same notes admit raising got more expensive. Two caveats worth volunteering:
this is CPython's implementation, not a language guarantee, and the authors hedge with
*"zero (or close to zero)"*.

**Pre-3.11 advice was "hoist the `try` out of the loop." Is that still good advice?**
Not as performance advice. The setup cost per `try` entry that justified it is what 3.11
eliminated for the non-raising case. It is still a real *semantic* decision: a `try`
inside the loop means a failing item is skipped and the loop continues; a `try` around
the loop means a failing item ends the loop. Pick by what should happen to the remaining
items, and treat any surviving "for speed" justification in a code comment as a note
about an interpreter nobody is running.

**Someone says "exceptions in Python are ten times more expensive than a comparison."
How do you respond?**
Ask for the source, the machine, the interpreter version and the miss rate, in that
order. The only published figure resembling it is the 3.11 note that catching got about
10% *cheaper than 3.10* — a version-over-version improvement, not a comparison with an
`if`, and a completely different claim from a 10× multiplier. If they have a real
benchmark, then it is a real number for their machine and their data and it is worth
looking at; if they have a remembered ratio, it is folklore with a decimal point in it.

---

← Prev: [The guard the platform deletes](06m-the-guard-the-platform-deletes.md) · Index: [EAFP vs LBYL](README.md) · Next → [The miss rate decides](07b-the-miss-rate-decides.md)
