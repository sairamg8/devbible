---
title: "An except clause cannot tell who raised — only what class — so PEP 8 prints a wrong version that catches only KeyError, has only two calls, and reports a bug in the callee as a missing key"
sidebar_label: "06f · Whose exception is it?"
sidebar_position: 146
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against
> [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/) (the
> correct/wrong pair below is PEP 8's own, comments included), the Python 3.14 Language
> Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [Traceback objects](https://docs.python.org/3.14/reference/datamodel.html#traceback-objects),
> and [`decimal`](https://docs.python.org/3.14/library/decimal.html#decimal.InvalidOperation)
> (signals, `DefaultContext` traps).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Every exception class is raised by many pieces of code, and an `except` clause matches
on the class alone — the reference defines the match as a test against *the class or a
non-virtual base class of the exception object*, and there is no third thing it can ask.
So a handler written for "the lookup I am testing" also owns the same class raised by
anything the guarded suite calls, however deep. That is the mechanism behind every width
defect in [06](06-narrowing-the-try.md), and PEP 8 states it in a comment on its own
example. This chunk is the diagnosis — how to recognise the defect and what it does to a
running system. The two mechanical repairs, `else` and hoisting the assignment, are
[06g](06g-width-at-a-boundary.md).**

## An `except` clause matches on class, never on origin

The Language Reference describes the whole of the matching rule:

> *"When an exception occurs in the `try` suite, a search for an exception handler is
> started. This search inspects the `except` clauses in turn until one is found that
> matches the exception."*

> *"The raised exception matches an `except` clause whose expression evaluates to the
> class or a non-virtual base class of the exception object, or to a tuple that contains
> such a class."*

Read what is **not** in those two sentences. No mention of which line raised, which
function, which module, how deep in the call stack, or whether the frame is one you wrote.
The predicate is `isinstance`-shaped and nothing else. A clause therefore over-matches
along two independent axes:

| Axis | What widens the clause | Where it is treated |
|---|---|---|
| **Class breadth** | naming a base class — `except OSError` owns `FileNotFoundError`, `PermissionError`, `IsADirectoryError`, `TimeoutError` and the rest | [06c · The breadth of one class](06c-the-breadth-of-one-class.md) |
| **Origin breadth** | the guarded suite calling code that raises the same class | this page |

The two compound. `except OSError` around a `with` block is wide on both axes at once, and
that is the shape that eats a truncated file. **Origin breadth is the more dangerous of the
pair**, because narrowing the class is a visible edit to the clause and narrowing the
origin is an invisible property of the suite: the clause you are reading looks precise.

### The traceback knows; the clause does not

The information is not lost — it is only unavailable to the match. The reference says *"When
an exception handler is entered, the stack trace is made available to the program"*, and
that it is accessible *"as the `__traceback__` attribute of the caught exception"*, with
`tb_next` being *"the next level in the stack trace (towards the frame where the exception
occurred)"*. So the raising frame is reachable — but only **after** the match has happened:

```python
import traceback

try:
    value = collection[key]
except KeyError as exc:
    frames = traceback.extract_tb(exc.__traceback__)   # frames[-1] raised, frames[0] is here
    logger.warning("KeyError from %s:%d", frames[-1].filename, frames[-1].lineno)
    raise
```

🔴 **Diagnose with that, never decide with it.** Branching on `frames[-1].filename` asserts
a fact about another module's source layout: it breaks on the first refactor, and there is
no Python frame at all behind a C-level raise. Origin is expressible only as the shape of
the `try` suite — which is why the repair in [06g](06g-width-at-a-boundary.md) is
structural rather than conditional. And if a handler swallows the exception and logs only
`str(exc)`, the frame goes with it —
[13 · Losing the traceback](../11-exceptions/13-losing-the-traceback.md).

## PEP 8's own pair — read the comments, they are the argument

Verbatim from PEP 8, including its comments:

```python
# Correct:
try:
    value = collection[key]
except KeyError:
    return key_not_found(key)
else:
    return handle_value(value)

# Wrong:
try:
    # Too broad!
    return handle_value(collection[key])
except KeyError:
    # Will also catch KeyError raised by handle_value()
    return key_not_found(key)
```

The two versions differ by **no exception types and no statements** — the same single
`KeyError` clause, the same two calls. The only change is *where the boundary of the
`try` falls*, and that change is the difference between a correct program and one where
a bug inside `handle_value` is reported to the caller as a missing key.

Note that the "Correct" half does two things at once, and they are the two repairs:

1. **The assignment is hoisted out of the leap** — `value = collection[key]` is the whole
   `try` suite.
2. **The follow-on work moves into `else`** — `handle_value(value)` runs on success,
   outside the handler's reach.

Both are worked in [06g](06g-width-at-a-boundary.md).

## A worked case: the invoice that came out at zero

```python
# 🔴 The handler was written for a missing SKU. It also absorbs a bug in pricing.
def line_total(catalogue: dict[str, Product], sku: str, qty: int) -> Decimal:
    try:
        return price_for(catalogue[sku], qty)
    except KeyError:
        return Decimal("0.00")

def price_for(product: Product, qty: int) -> Decimal:
    tier = product.price_tiers[bracket_for(qty)]     # ← raises KeyError for qty > 500
    return tier.unit_price * qty
```

`price_for` has a real defect: `bracket_for(600)` returns a bracket name that
`price_tiers` does not contain. The `KeyError` it raises is indistinguishable, to
`except KeyError`, from `catalogue[sku]` missing.

The observable symptom is not a crash and not a log line — it is **large orders invoiced
at zero**, found by finance rather than by monitoring. That is the shape width defects
take in production: not an outage, a wrong number.

```python
def line_total(catalogue: dict[str, Product], sku: str, qty: int) -> Decimal:
    try:
        product = catalogue[sku]        # the one assumption: this SKU may be unstocked
    except KeyError:
        return Decimal("0.00")
    else:
        return price_for(product, qty)  # its KeyError is now a KeyError, and escapes
```

The same failure with `ValueError`, which is worse because so much of the standard
library raises it:

```python
# 🔴 Written for "the header field is not a number". Also owns strptime and Decimal.
def parse_receipt(header: str, body: str) -> Receipt:
    try:
        item_count = int(header)
        stamped = datetime.strptime(body[:19], "%Y-%m-%dT%H:%M:%S")
        total = Decimal(body[19:])
    except ValueError:
        raise BadReceipt("item count is not a number")
    return Receipt(item_count, stamped, total)
```

The handler asserts one thing and reports one thing while covering three, so every
malformed timestamp in production is filed as a bad item count. Three blocks, three
messages, three chained causes:

```python
def parse_receipt(header: str, body: str) -> Receipt:
    try:
        item_count = int(header)
    except ValueError as exc:
        raise BadReceipt(f"item count is not a number: {header!r}") from exc

    try:
        stamped = datetime.strptime(body[:19], "%Y-%m-%dT%H:%M:%S")
    except ValueError as exc:
        raise BadReceipt(f"unparseable timestamp: {body[:19]!r}") from exc

    try:
        total = Decimal(body[19:])
    except decimal.InvalidOperation as exc:
        raise BadReceipt(f"unparseable total: {body[19:]!r}") from exc

    return Receipt(item_count, stamped, total)
```

which is the entire content of a support ticket. ⚠️ Note the third clause is
`decimal.InvalidOperation`, not `ValueError` — `DecimalException` is *"Base class for other
signals and a subclass of `ArithmeticError`"*, a family of its own, so check what the call
you are guarding actually raises rather than assuming the builtin that describes the
situation in English. Which class to name is
[06c](06c-the-breadth-of-one-class.md); the `from exc` is
[exception chaining](../11-exceptions/06b-exception-chaining.md).

## Gotchas

**★ Symptom: `key_not_found` is reported for a key that is definitely present.** Cause:
PEP 8's "Wrong" example exactly — the `try` wrapped `handle_value(collection[key])`, so a
`KeyError` raised *inside* `handle_value` matched the handler. Fix: hoist the leap, put
the consumer in `else`.

```python
try:
    value = collection[key]
except KeyError:
    return key_not_found(key)
else:
    return handle_value(value)
```

**★ Symptom: large orders are invoiced at zero and nothing is logged.** Cause: a
`KeyError` from a pricing-tier lookup deep inside the callee matched a handler written
for a missing SKU, so a defect returned a plausible number. Fix: guard the subscript
alone; the callee's `KeyError` then escapes with its own frame in the traceback — the
`line_total` repair above.

**★ Symptom: malformed timestamps are logged as "invalid item count".** Cause: one
`except ValueError` covering `int()`, `strptime()` and a `Decimal()` in the same suite —
the handler's message asserts one field while its scope covers three. Fix: one `try` per
conversion, each with a message naming its own field, each chaining with `from exc`.

**Symptom: `except decimal.InvalidOperation` never fires and totals arrive as `NaN`.**
Cause: the process installed a `Context` whose `traps` list does not include
`InvalidOperation`, so the constructor returned `Decimal('NaN')` instead of raising — the
guard was correct and the leap simply did not fail. Fix: name the trap explicitly at the
boundary where you parse, or test the result.

```python
with decimal.localcontext() as ctx:
    ctx.traps[decimal.InvalidOperation] = True
    total = Decimal(body[19:])           # now raises, whatever the ambient context is
```

**Symptom: a handler written for "file missing" also answers "disk full".** Cause: class
breadth rather than origin breadth — `except OSError` matches *"the class or a non-virtual
base class of the exception object"*, and the whole errno family descends from `OSError`.
Fix: name the leaf class; [04 · The exception
hierarchy](../11-exceptions/04-the-exception-hierarchy.md) is the map.

```python
try:
    fp = open(path)
except FileNotFoundError:                # not OSError — ENOSPC still escapes
    return {}
```

## Interview questions

**★ PEP 8 prints a "Wrong" version of a `try` that catches only `KeyError` and contains
only two calls. What is wrong with it?**
`try: return handle_value(collection[key])` puts both the lookup and its consumer inside
the guard, so — in PEP 8's own comment — it *"will also catch KeyError raised by
handle_value()"*. The handler was written to mean "this key is not in the collection" and
now also means "something inside `handle_value` did a failing dict lookup". The fix
changes no exception types and adds no clauses: hoist the subscript so it is the whole
`try` suite, and move `handle_value(value)` into `else`.

**★ The handler has the exception object in its hand. Why can it not just ask where the
exception came from?**
Because the match happens before the handler exists — origin is not part of the predicate,
so there is no clause you can write that means "a `KeyError` from *this* subscript". Once
the handler is entered you *can* reach the raising frame through `exc.__traceback__` and
`tb_next`, but branching on it means asserting facts about another module's file layout,
which breaks under refactoring and does not exist at all for a C-level raise. The origin is
expressible only as the shape of the `try` suite, which makes the repair structural.

**★ A clause can be too wide in two different ways. Name both and say which is worse.**
Class breadth — naming a base class, so `except OSError` owns every errno subclass — and
origin breadth, where the guarded suite calls code that raises the same class. Origin
breadth is worse in practice, because class breadth is visible in the clause you are
reading and can be found by grep, while origin breadth is a property of the suite and of
the entire call tree beneath it. A reviewer scanning for `except Exception` finds the
first kind and walks straight past the second.

**Why is `decimal.InvalidOperation` used in the receipt repair rather than `ValueError`?**
Because `decimal` raises its own signalling classes rather than the builtin.
`DecimalException` is documented as *"Base class for other signals and a subclass of
`ArithmeticError`"*, so a clause naming `ValueError` would never catch it while still
claiming to. It is the general lesson in a specific place: before naming a class, check
what the call you are guarding is documented to raise. Topic 11's
[05b · Choosing the type](../11-exceptions/05b-choosing-the-exception-type.md) is the
reference for catching what the callee documents.

**Does a broad `except Exception` at the top of a request handler have the same defect?**
No — that one is a deliberate boundary, and topic
[05c · The quiet boundaries](05c-the-quiet-boundaries.md) is where it belongs. Its scope is
honest: it says "anything that gets this far becomes a 500", and it logs the traceback
rather than substituting a plausible value. The defect on this page is the opposite shape —
a clause that *looks* surgical, names one specific class, and quietly covers a call tree.
A reader trusts a narrow-looking clause, which is exactly why it does more damage.

---

← Prev: [Attribute, value and Exception](06e-attribute-value-and-exception.md) · Index: [EAFP vs LBYL](README.md) · Next → [Width at a boundary](06g-width-at-a-boundary.md)
