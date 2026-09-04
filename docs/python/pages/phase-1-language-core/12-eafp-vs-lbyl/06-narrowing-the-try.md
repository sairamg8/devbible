---
title: "EAFP is a claim about exactly one assumption, so a handler spanning four operations is not EAFP at all — it is a promise you cannot state, and width has three independent axes rather than one"
sidebar_label: "06 · Narrowing the try"
sidebar_position: 141
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against
> [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/) (the
> `try`-width rule, quoted verbatim below), the Python 3.14
> [Glossary — `EAFP`](https://docs.python.org/3.14/glossary.html), the Language Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> and [`json`](https://docs.python.org/3.14/library/json.html) (`JSONDecodeError` as a
> `ValueError` subclass). Target: **Python 3.14**. Documentation-validated;
> **no sandbox run**.

**The glossary defines EAFP as code that *"assumes the existence of valid keys or
attributes and catches exceptions if the assumption proves false"* — singular
assumption, singular failure. A `try` block containing four statements does not assume
one thing; it declines to say what it requires, and its handler absorbs failures nobody
predicted. This is the commonest defect in code written by someone who has just been
told EAFP is Pythonic, and it is a strict regression on the LBYL version it replaced:
the `if` at least named the condition it was testing. This chunk gives the rule, the
one-sentence test that applies it, and the first two of the three *independent* axes
along which a handler gets too wide.**

## The rule, and the one-sentence test

> **One assumption per `try`. If you cannot say in a single sentence which assumption
> this handler absorbs, the block is too wide.**

Say the sentence out loud, in this form:

> *"This handler exists because `<one operation>` may fail with `<one exception>` when
> `<one stated condition>` — and in that case the right answer is `<one recovery>`."*

Four slots. If any slot needs the word "or", or a list, or "something in there", the
block is wider than the claim, and the fix is structural rather than cosmetic. The test
is not a heuristic — it is the definition of the style restated as a check. EAFP earns
its safety entirely from the narrowness of what it asserts, so a handler you cannot
describe is not a cautious version of EAFP; it is the absence of a claim wearing EAFP's
syntax.

PEP 8 says the same thing in the imperative:

> *"Additionally, for all try/except clauses, limit the `try` clause to the absolute
> minimum amount of code necessary. Again, this avoids masking bugs:"*

Note *"masking bugs"* rather than "catching too much". The cost of width is not that
extra expected exceptions get handled — it is that **your own defects are answered with a
plausible return value**, which is the most expensive failure mode a service has,
because monitoring records a success.

## Width has three independent axes

| Axis | The defect | The question that exposes it |
|---|---|---|
| **1 · Statements in the `try`** | four operations, one handler | *would I want this handler to fire if line 3 failed?* |
| **2 · Types in the `except`** | `except (KeyError, ValueError, TypeError)` | *does my recovery make sense for each of these separately?* |
| **3 · Breadth of one type** | `Exception`, `OSError`, `LookupError`, `AttributeError` | *how many failures does this class cover that I did not predict?* |

They are independent: a block can be one statement, one clause and still far too wide.
Axis 3 is the one that survives review, because the code *looks* tight — it has its own
chunk, [06c · The breadth of one class](06c-the-breadth-of-one-class.md).

### Axis 1 — statements

Each statement in the suite multiplies the handler's reach by everything that statement
calls, transitively. Two statements is not "twice as wide", it is "as wide as two call
trees you did not audit". The practical floor PEP 8 is pointing at is **one expression
that can fail**; everything downstream of it belongs in `else` or outside the statement.

### Axis 2 — the tuple

A tuple of types is a claim that **one recovery is correct for all of them**. Usually it
is not, and the tuple grew because each new production traceback got appended to it
rather than understood:

```python
# 🔴 Not a claim. A changelog of past incidents.
except (KeyError, TypeError, AttributeError, ValueError):
    return default
```

Topic 11 covers when separate clauses beat one tuple in
[05b · Choosing the type](../11-exceptions/05b-choosing-the-exception-type.md); the
width question here is simpler — if you need four classes, you had four assumptions and
should have had four blocks.

## What the rest of this argument covers

Diagnosing width is this chunk. The other six pieces have their own, because each has
primary-source backing and failure modes of its own:

- **[06b · A worked width repair](06b-a-worked-width-repair.md)** — one function failing
  on all three axes at once, the six distinct situations its single handler answers
  identically, and the repair decision by decision.
- **[06c · The breadth of one class](06c-the-breadth-of-one-class.md)** — axis 3 for
  `OSError`: fifteen documented subclasses, the 3.3 merge that folded `socket.error` in,
  the one situation with no subclass at all, and the ladder to climb when nothing
  narrower exists.
- **[06d · The lookup classes](06d-the-lookup-classes.md)** — `LookupError`, `KeyError`,
  `IndexError`, the slice that cannot fail, and the five sources of a `KeyError` that are
  not the subscript you were guarding.
- **[06e · Attribute, value and `Exception`](06e-attribute-value-and-exception.md)** —
  `AttributeError` covering assignment as well as reference, `ValueError` defined
  residually, `TypeError` as the class that means "you called it wrong", and the one
  legitimate `except Exception`.
- **[06f · Whose exception is it?](06f-whose-exception-is-it.md)** — the two mechanical
  repairs, with PEP 8's own correct/wrong pair and the documentation's `os.access`
  rewrite: hoist the leap, and put the consumer in `else`.
- **[06g · Width at a boundary](06g-width-at-a-boundary.md)** — loops, translation with
  `raise … from`, `contextlib.suppress`, observability, and the one place a wide handler
  is right.

## Gotchas

**★ Symptom: the `except` clause has grown a new exception type after every production
incident.** Cause: axis 2 — the block is too wide, so each new escapee gets appended to
the tuple instead of understood. Fix: split on statement boundaries until each handler
has one type, then delete the types nothing actually raises.

```python
# Was: except (KeyError, TypeError, AttributeError, ValueError): return default
try:
    raw = record["payload"]
except KeyError:
    return default

try:
    return decode(raw)
except DecodeError:                  # the callee's documented failure, and only that
    return default
```

**★ Symptom: `except ValueError` around a tuple assignment fires on a well-formed
input.** Cause: axis 1 plus a coincidence of class — unpacking the wrong number of values
raises `ValueError`, the same class the parse raises, so the two failures are
indistinguishable to the handler. Fix: separate the shape check from the parse.

```python
parts = spec.split(":")
if len(parts) != 2:
    raise ConfigError(f"expected host:port, got {spec!r}")
host, raw_port = parts
try:
    port = int(raw_port)
except ValueError as exc:
    raise ConfigError(f"port is not a number: {raw_port!r}") from exc
```

**Symptom: `try: return d[k]` / `except KeyError:` around a `defaultdict` never fires,
and the mapping grows on every read.** Cause: the width problem's mirror image — a
handler narrower than nothing, because `__missing__` inserts and returns rather than
raising, so the clause is dead code. Fix: `.get()`, which bypasses the factory.

```python
value = counts.get(key, 0)        # not counts[key] inside a try that can never fire
```

[03b · Writing on a miss](03b-writing-on-a-miss.md) has the `__missing__` mechanism.

**Symptom: a chained subscript under one `except KeyError` returns `None` and nobody can
say which level was absent.** Cause: axis 1 inside a single expression — three subscripts
are three operations however few lines they occupy. Fix: `get` per level, or do not catch
at all and let the `KeyError` name the level;
[03c · Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md) works both
through.

**Symptom: two `try` blocks were merged in review "to reduce nesting".** Cause: nesting
depth was treated as the cost function. It is not — two *sequential* `try` statements at
the same indentation are flatter **and** narrower than one block with two handlers. Fix:
sequential, not nested, with each failure returning or raising immediately.

```python
try:
    token = headers["authorization"]
except KeyError:
    return Response(401, "missing credentials")

try:
    claims = decode_jwt(token)
except InvalidToken:
    return Response(401, "bad credentials")

return Response(200, profile_for(claims["sub"]))
```

**★ Symptom: a metrics increment inside a `try` stopped firing after an unrelated line
above it began failing.** Cause: axis 1 has a second edge nobody looks at — an exception
does not only *reach* the handler, it **abandons the rest of the suite**. A wide `try` is
also a wide skip, and the lines after the raising one vanish silently. Fix: one operation
per suite; bookkeeping goes after the statement or in `else`.

```python
try:
    receipt = gateway.capture(order_id)
except CardDeclined:
    metrics.incr("payments.declined")
    return Declined(order_id)
else:
    metrics.incr("payments.captured")      # was inside the try, and was being skipped
    return Captured(receipt)
```

**Symptom: the same four-type `except` clause is copy-pasted across a dozen call
sites.** Cause: the wide handler travelled as a unit, because copying it was cheaper than
stating what it assumed. Fix: extract the narrow operation into one function that owns
its single assumption, and call that everywhere instead of duplicating the handler.

```python
def stocked(catalogue: dict[str, Product], sku: str) -> Product | None:
    """One assumption, stated once: this SKU may not be in the catalogue."""
    try:
        return catalogue[sku]
    except KeyError:
        return None
```

**Symptom: a `try` suite grew a debug `log.info` line and the handler started firing for
a new reason.** Cause: logging inside the guarded suite is guarded code — an f-string
that calls a broken `__repr__`, or a formatting argument that is a missing key, raises
inside the `try`. Fix: log outside the suite, or in the handler, never inside the leap.

```python
try:
    record = index[doc_id]
except KeyError:
    return None
log.debug("resolved %s to %s", doc_id, record.title)   # outside the guard
return record
```

## Interview questions

**★ How wide should a `try` block be, and who says so?**
One assumption wide. PEP 8 is explicit: *"for all try/except clauses, limit the `try`
clause to the absolute minimum amount of code necessary. Again, this avoids masking
bugs"*. In practice that means one expression that can fail, with the work that consumes
its result in `else` and everything else outside the statement. The operational test is
whether you can complete the sentence *"this handler exists because X may raise Y when Z,
and then the right answer is W"* — four slots, no lists, no "or".

**★ Name the three ways a handler gets too wide.**
Too many statements in the `try`; too many types in the `except`; and one type that is
broader than the assumption. They are independent — a block can have one statement and
one clause and still be badly wide. The third is the one that survives review, because
the code looks tight: `except OSError` around a single `open()` covers a missing file, a
permission denial, a directory, descriptor exhaustion and a read-only filesystem, five
situations with five different right answers.

**★ Why does PEP 8 say width "masks bugs" rather than "catches too much"?**
Because the exceptions that hurt are not the extra *expected* ones — they are your own
defects. A `try` wide enough to cover a callee turns that callee's `KeyError` or
`ValueError` into your handler's recovery value, so a bug is reported as a successful
call returning a default. Nothing alerts, nothing logs, and the discrepancy surfaces
weeks later somewhere downstream. A crash is cheap by comparison; it names the frame.

**Is a `try` with two statements always wrong?**
No. Two statements are fine when they form one indivisible assumption and the same
recovery is right for both — reading two related keys out of the same payload, where a
miss on either means the payload is the wrong shape. What makes it defensible is that the
sentence test still passes with a single condition: *"this handler exists because this
payload may not be a v2 event"*. What makes it indefensible is the version where the two
statements fail for unrelated reasons and the handler cannot tell which fired.

**Does narrowing conflict with EAFP? Is this an argument for LBYL?**
No — it is what makes EAFP a claim rather than a shape. The glossary's definition is that
EAFP *"assumes the existence of valid keys or attributes and catches exceptions if the
assumption proves false"*: *assumes* is the load-bearing word, and a four-statement `try`
assumes nothing. A narrow `try` and an `if` both name a condition; the narrow `try` names
it without opening a gap between the check and the action, which is the argument of
[01 · The two names](01-the-two-names.md).

**★ How does the width of a `try` affect what gets *skipped* rather than what gets
caught?**
They are the same number, and only one of them gets reviewed. When an exception is raised
inside a suite, control leaves that suite immediately — every statement after the raising
line is abandoned. So a five-statement `try` is a five-statement handler *and* a
five-statement skip: the metrics increment, the audit write and the cache warm that
followed the failing call all silently do not happen, and no handler mentions them. This
is the same mechanism that makes a multi-statement `contextlib.suppress` body dangerous,
and it is why bookkeeping belongs in `else` rather than in `try`.

**A wide handler and a narrow one return the same value for every input in your test
suite. Why prefer the narrow one?**
Because the inputs that distinguish them are the ones your tests do not have: a callee
with a bug, a `NULL` column, a full disk. A test suite exercises the failure modes you
thought of, and a wide handler is precisely a statement about the ones you did not.
Equivalence under the tests you wrote is not evidence about behaviour under the failures
you will meet — the same argument the topic makes about LBYL and concurrency in
[02 · The race between the look and the leap](02-the-race-between-look-and-leap.md).

---

← Prev: **Where LBYL is right** *(not written yet)* · Index: **EAFP vs LBYL** *(not written yet)* · Next → [A worked width repair](06b-a-worked-width-repair.md)
