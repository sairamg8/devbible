---
title: "The costs that actually decide this choice are paid by the next reader — a handler wide enough to hide a bug, a precondition validated in three layers that disagree, and a guard that runs the property it is guarding — and none of them is measured in seconds"
sidebar_label: "07f · The costs that decide"
sidebar_position: 153
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr),
> [`str.isdigit`](https://docs.python.org/3.14/library/stdtypes.html#str.isdigit),
> [Glossary: `EAFP`, `LBYL`](https://docs.python.org/3.14/glossary.html).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**By the time a team is arguing about whether `try` is slower than `if`, it is arguing
about the smallest cost in the room. The costs that decide real code are paid by whoever
reads it next: a handler wide enough to swallow a bug that then surfaces three modules
away; a precondition checked in three layers, each with a slightly different idea of what
valid means; a `hasattr` that runs a property and therefore its side effects, twice. Each
of those is priced below in code, and each is worth more than any difference a benchmark
of the two spellings would find. The remaining asymmetry — that a condition is provable to
a type checker and a handler is not — plus the order to decide in, is
[07g · Provability and the order to decide in](07g-provability-and-the-order-to-decide.md).**

## Cost 1 — the handler wide enough to hide a bug

A `try` costs nothing at runtime when nothing raises, which is exactly why it grows. The
cost of a wide handler is paid at 2am, when a `KeyError` raised by a typo four frames
down is reported as a missing configuration key.

```python
# The handler claims to be about a missing key. It is about any KeyError anywhere
# in three function calls, including the ones that are bugs.
try:
    profile = load_profile(config["user_id"])
    theme = profile["preferences"]["theme"]
    render(theme)
except KeyError:
    render(DEFAULT_THEME)

# Each try covers the one operation whose failure it claims to handle.
try:
    user_id = config["user_id"]
except KeyError:
    raise ConfigError("user_id is required") from None

profile = load_profile(user_id)
theme = profile.get("preferences", {}).get("theme", DEFAULT_THEME)
render(theme)
```

The second version is longer and that is the point: the extra lines are the ones that say
which failure was anticipated. Narrowing is the whole subject of
[06 · Narrowing the try](06-narrowing-the-try.md).

## Cost 2 — the precondition validated in three layers

LBYL's other maintenance cost is that a check is duplicable, so it gets duplicated: the
view validates, the service validates again, the repository validates a third time — and
they drift, because each author had a slightly different idea of what valid meant.

```python
# Three checks, three definitions, one of which is wrong: isdigit() is a Unicode
# property test, not a parse test, so '²'.isdigit() is True while int('²') raises.
def view(request):
    if not request.form["qty"].isdigit():
        return error("qty must be a number")
    return service(request.form["qty"])

def service(qty):
    if not qty.isdigit():
        raise ValueError("bad qty")
    return repository(int(qty))

def repository(qty):
    if qty < 0:
        raise ValueError("bad qty")
    return insert(qty)
```

Parse once, at the boundary, with the operation that defines validity — and then let the
inner layers state their requirement in the type system rather than re-testing it:

```python
def view(request):
    try:
        qty = int(request.form["qty"])
    except (KeyError, ValueError):
        return error("qty must be a whole number")
    if qty < 0:
        return error("qty must not be negative")
    return service(qty)

def service(qty: int) -> Receipt:   # the contract is the signature, not a re-check
    return repository(qty)
```

Two things got cheaper and neither is measured in seconds: there is now **one** definition
of valid, and it is the same operation that the program actually performs. The
`isdigit`-versus-`int` trap in the first version is documented — `'²'.isdigit()` is `True`
because *"a digit is a character that has the property value Numeric_Type=Digit or
Numeric_Type=Decimal"*, which is a different question from whether `int()` can parse it.

## Cost 3 — the guard that runs the thing it is guarding

`hasattr` is documented as *"implemented by calling `getattr(object, name)` and seeing
whether it raises an `AttributeError` or not"*. So the check performs the access, and if
the attribute is a property, its body runs — including anything it does on the way.

```python
# The property issues a query; hasattr runs it, then the branch runs it again.
if hasattr(order, "settled_total"):
    invoice.amount = order.settled_total

# One access, one query.
total = getattr(order, "settled_total", None)
if total is not None:
    invoice.amount = total
```

The duplicated unit of work here is unbounded — a property can query, cache, log or
mutate — which is why this is a different order of mistake from a duplicated dict lookup.

## The asymmetry in what each spelling documents

Both spellings run; they document different facts, and that is a design decision worth
making deliberately.

| Spelling | The fact it puts in front of the reader |
|---|---|
| `if key in config:` | The **precondition**: this code only makes sense when the key is present |
| `try: config[key]` / `except KeyError:` | The **failure mode**: this is what happens when it is not |

If the next reader most needs to know the rule, write the rule. If they most need to know
what happens when it breaks, write the handler. "Which is faster" answers neither
question.

## Gotchas

**★ Symptom: a wide `except Exception` is defended in review as "cheaper than checking
everything", and a week later a typo in an attribute name is being served as a default
value.** Cause: none of the published cost claims say anything about handler *width* —
zero-cost is about entering a `try`, not about how much it covers. Fix: catch the specific
type, around the specific operation, and let everything else propagate.

```python
try:
    rate = rates[currency]
except KeyError:
    raise UnknownCurrency(currency) from None
```

**★ Symptom: the same input is validated in the view, the service and the repository, and
the three checks disagree about one edge case.** Cause: LBYL guards are duplicable, so
they get duplicated, and each copy encodes a slightly different definition. Fix: parse at
the boundary with the operation that defines validity, then state the requirement as a
type.

```python
def view(request):
    try:
        qty = int(request.form["qty"])
    except (KeyError, ValueError):
        return error("qty must be a whole number")
    return service(qty)

def service(qty: int) -> Receipt:
    return repository(qty)
```

**★ Symptom: a log line or a database query appears twice per request and the code only
does it once.** Cause: a `hasattr` check on a property — the check performs the access,
so the property body runs during the test and again at the use site. Fix: one access with
a default.

```python
total = getattr(order, "settled_total", None)
if total is not None:
    invoice.amount = total
```

## Interview questions

**★ What is the real cost of EAFP in a large codebase?**
Handler drift. A `try` that costs nothing to enter also costs nothing to widen, so over a
few years the block grows to cover operations whose failures nobody thought about, and the
`except` clause becomes a claim the code cannot honour — the same `KeyError` now means
"config missing" or "typo in a dict literal" or "upstream changed a payload shape", and
all three are reported as the first. The mitigations are structural rather than
performance-related: catch the narrowest type, wrap the narrowest block, use `else` for
the success path so the body of the `try` stays one operation long, and re-raise with
`from` so the original cause survives.

**Why is "validate in every layer" not free?**
Because each copy of a check is a separate definition that can drift, and the drift is
silent. The `isdigit` example is the canonical one: it answers a Unicode property question
(*"a digit is a character that has the property value Numeric_Type=Digit or
Numeric_Type=Decimal"*), while `int()` answers a parsing question, so a layer using
`isdigit` accepts strings the layer using `int()` rejects. On top of that, every layer
pays the check at runtime, and none of them owns the rule — so when the rule changes, you
find out which layers were missed from a bug report.

**Which spelling documents the code better?**
Neither, universally — they document different things, and that is how to choose. `if key
in config:` tells the reader the precondition this code depends on. `try: config[key] /
except KeyError:` tells the reader what happens when the precondition fails. Decide which
of those two facts the next person to open the file will need, and write that one. It is a
better tie-breaker than performance because it is answerable without measuring anything.

**Someone rejects `get` with a default because "it hides errors". Are they right?**
Sometimes, and the test is the contract, not the cost. If an absent key means the caller
made a mistake, a default converts a loud failure into a wrong answer several frames later
and they are right to object. If an absent key is a normal, expected state with a
meaningful fallback, then `get` states that in one operation and one line, and the
alternatives are strictly worse — `if k in d: d[k]` does the lookup twice, and a
`try`/`except` raises on a case you have just described as normal. The disagreement is
about whether the miss is an error, so settle that first and the spelling follows.


---

← Prev: [Measuring instead of arguing](07e-measuring-instead-of-arguing.md) · Index: [EAFP vs LBYL](README.md) · Next → [Provability and the order to decide in](07g-provability-and-the-order-to-decide.md)
