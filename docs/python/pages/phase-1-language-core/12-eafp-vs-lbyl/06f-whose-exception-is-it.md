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
> the [Tutorial — Errors and Exceptions](https://docs.python.org/3.14/tutorial/errors.html),
> and [`os.access`](https://docs.python.org/3.14/library/os.html#os.access).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Every exception class is raised by many pieces of code, and an `except` clause matches
on the class alone — it has no way to ask *who raised this*. So a handler written for
"the lookup I am testing" also owns the same class raised by anything the guarded suite
calls, however deep. That is the mechanism behind every width defect in
[06](06-narrowing-the-try.md), and PEP 8 states it in a comment on its own example. The
two repairs are mechanical: **hoist the leap** so the `try` suite holds one expression,
and put the work that consumes the result in **`else`**, which the reference defines as
being inside the statement and outside the handlers.**

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

Three times the lines, and each earns its place: the error message now names the field,
which is the entire content of a support ticket. ⚠️ Note the third clause is
`decimal.InvalidOperation`, not `ValueError` — `decimal`'s signalling classes are their
own family, so check what the call you are guarding actually raises rather than assuming
the builtin. Which class to name is
[06c](06c-the-breadth-of-one-class.md); the `from exc` is
[exception chaining](../11-exceptions/06b-exception-chaining.md).

## `else` is the narrowing tool, and the docs use it on purpose

The Language Reference:

> *"The optional `else` clause is executed if the control flow leaves the `try` suite, no
> exception was raised, and no `return`, `continue`, or `break` statement was executed.
> Exceptions in the `else` clause are not handled by the preceding `except` clauses."*

That last sentence is the whole mechanism: **`else` is inside the statement and outside
the handlers.** The tutorial states the intent:

> *"It is useful for code that must be executed if the try clause does not raise an
> exception. The use of the `else` clause is better than adding additional code to the
> `try` clause because it avoids accidentally catching an exception that wasn't raised by
> the code being protected by the `try` … `except` statement."*

The `os.access` entry then applies it. Its LBYL original:

```python
if os.access("myfile", os.R_OK):
    with open("myfile") as fp:
        return fp.read()
return "some default data"
```

and, in the docs' words, *"is better written as"*:

```python
try:
    fp = open("myfile")
except PermissionError:
    return "some default data"
else:
    with fp:
        return fp.read()
```

Read that as a width decision rather than an EAFP demo — there are three of them in six
lines. Only `open()` is in the `try`. The `with` and the `read()` are in `else`, so a
`PermissionError` raised by the *read* propagates instead of being answered with default
data. And the clause is `except PermissionError`, not `except OSError`, so a missing file
still raises `FileNotFoundError` at the caller. The clause's full semantics — including
what happens when the `try` suite returns — are
[topic 11 · the `else` clause](../11-exceptions/02-the-else-clause.md); why the LBYL
original is a *security* defect is
[02b · The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md).

## Keep the assignment out of the `try`

The subtlest width defect is a single statement that is secretly two operations, and the
usual shape is an assignment whose right-hand side wraps the leap in a call:

```python
try:
    value = compute_discount(cart[coupon_code])   # 🔴 compute_discount is guarded too
except KeyError:
    value = Decimal("0")
```

`cart[coupon_code]` is the leap; `compute_discount(...)` is work that happens to be on
the same line. Hoist:

```python
try:
    coupon = cart[coupon_code]                    # leap
except KeyError:
    value = Decimal("0")
else:
    value = compute_discount(coupon)              # work
```

The rule generalises: **the `try` suite should contain the expression that can fail and
nothing else** — not the call that consumes it, not the `return` that ships it, not the
logging that describes it. Two more shapes of the same mistake:

```python
# 🔴 The f-string is inside the guard; a __repr__ that raises becomes a cache miss.
try:
    return render(f"hit: {cache[key]}")
except KeyError:
    return render("miss")

# 🔴 The whole managed block is guarded, not the acquisition.
try:
    with open(path) as fp:
        return json.load(fp)          # read errors inside the parse are OSErrors too
except OSError:
    return {}
```

The second is worth dwelling on. `except OSError` around a `with` block guards
*everything the block does*, and because `json.load` reads from the handle, an `OSError`
mid-read is answered with `{}` — a truncated file becomes an empty config. Narrow it by
moving the parse where its own failures are visible:

```python
try:
    fp = open(path)
except FileNotFoundError:
    return {}                          # the one assumption: this file may not exist yet
else:
    with fp:
        return json.load(fp)           # decode and read errors now reach the caller
```

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

**★ Symptom: a truncated config file is silently read as an empty config.** Cause:
`except OSError` wrapped a whole `with open(...)` block, so a read failure partway
through the parse produced the "file absent" recovery. Fix: guard the acquisition only
and parse in `else` — shown above.

**Symptom: a handler that returns a default is reached when the *handler's own*
dependency is broken.** Cause: the `try` suite included the call that builds the fallback,
so a failure in the fallback path matched the same clause. Fix: build the fallback
outside the guarded suite.

```python
fallback = DEFAULT_SETTINGS          # constructed before the leap, never inside it
try:
    raw = store[tenant_id]
except KeyError:
    return fallback
else:
    return merge(fallback, decode(raw))
```

**Symptom: moving code into `else` did not narrow anything, because the `try` suite still
`return`s.** Cause: the reference is explicit that `else` runs only when *"no `return`,
`continue`, or `break` statement was executed"* — a `try` suite that returns skips the
`else` entirely, so the guarded call and the returned expression are still the same
statement. Fix: assign in the `try`, return in the `else`.

```python
try:
    value = collection[key]     # assign here
except KeyError:
    return None
else:
    return transform(value)     # return here
```

**Symptom: an f-string inside a `try` turned a `__repr__` bug into a cache miss.** Cause:
formatting runs code — `__str__`, `__repr__`, `__format__` — and its exceptions are
raised inside the guarded suite. Fix: build the value, leave the suite, then format.

```python
try:
    hit = cache[key]
except KeyError:
    return render("miss")
else:
    return render(f"hit: {hit}")
```

**Symptom: `except AttributeError` around `config.database.host` reports "not
configured" for a misspelling of `host`.** Cause: three attribute accesses in one
expression, one clause, and no way to tell which failed — the same defect as a chained
subscript. Fix: one access at a time, with the default form where the attribute really is
optional.

```python
db = config.database                       # a missing `database` is a real error
host = getattr(db, "host", "localhost")    # this one is genuinely optional
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

**★ Why does the `else` clause exist, and how does it narrow a handler?**
Because there is no other way to say "run this only if the guarded operation succeeded,
but do not guard it". The reference: *"Exceptions in the `else` clause are not handled by
the preceding `except` clauses."* So moving the follow-on work from `try` to `else`
removes it from the handler's scope without removing it from the success path. The
tutorial gives the rationale directly — it *"avoids accidentally catching an exception
that wasn't raised by the code being protected"*.

**★ In the documentation's own EAFP rewrite of the `os.access` example, three separate
narrowing decisions were made. What are they?**
First, only `open()` is inside the `try` — the `with` and the `read()` are in `else`, so a
read failure is not answered with default data. Second, the clause is
`except PermissionError`, not `except OSError`, so a missing file still raises
`FileNotFoundError` at the caller. Third, the success-path `return` lives in `else` rather
than in `try`, which is what makes the first decision expressible at all. It is a faithful
translation of an `os.R_OK` check, not a catch-all.

**★ Why should the assignment be outside the `try` when the value is not used until
afterwards anyway?**
Because "the assignment" is usually two operations on one line.
`value = compute_discount(cart[code])` has the leap (`cart[code]`) and the work
(`compute_discount`) inside the same guard, so the work's exceptions are in the handler's
scope. Hoisting the leap into a `try` of its own and putting the work in `else` costs two
lines and removes an entire class of misattributed failure. It is exactly what PEP 8's
"Correct" example does.

**How do you find out, in review, whether a handler is catching a callee's exception?**
Ask of every line in the `try` suite: *would I want this handler to fire if this line
failed?* Then ask it about everything those lines call, transitively — which is the point
at which you stop and narrow the block, because you cannot audit a call tree you do not
own. That is why "the `try` suite contains one expression" is a rule rather than a
preference: it is the only version of the question you can actually answer.

**You moved the follow-on work into `else` and nothing changed. Why?**
Almost certainly because the `try` suite still contains a `return`. The reference says
`else` runs only if *"the control flow leaves the `try` suite, no exception was raised,
and no `return`, `continue`, or `break` statement was executed"* — so a returning `try`
suite skips `else` altogether, and whatever you moved is unreachable. Assign inside the
`try`, return inside the `else`.

**Is an f-string inside a `try` really a width problem?**
Yes, and a common one. Formatting invokes `__str__`, `__repr__` or `__format__`, all of
which run arbitrary code, so `f"hit: {cache[key]}"` inside a `try` guarded by
`except KeyError` covers both the lookup and anything the value's `__repr__` does. It is
the same defect as a call on the right-hand side of an assignment, in a shape people do
not read as a call.

**Why is `decimal.InvalidOperation` used in the receipt repair rather than
`ValueError`?**
Because `decimal` raises its own signalling classes rather than the builtin, so a clause
naming `ValueError` would not catch it while still claiming to. It is the general lesson
in a specific place: before naming a class, check what the call you are guarding is
documented to raise, rather than assuming the builtin that describes the situation. Topic
11's [05b · Choosing the type](../11-exceptions/05b-choosing-the-exception-type.md) is
the reference for catching what the callee documents.

---

← Prev: [Attribute, value and Exception](06e-attribute-value-and-exception.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → **Width at a boundary** *(not written yet)*
