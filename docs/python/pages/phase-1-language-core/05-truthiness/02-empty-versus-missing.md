---
title: "Empty versus missing: the bug where \"no results yet\" and \"no results\" look identical"
sidebar_label: "2 · Empty versus missing"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against
> [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations),
> the Python 3.14 Library Reference
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> and [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional).
> Target: **CPython 3.14**.

**Truthiness answers one question — "does this container have anything in it" —
and application code routinely uses it to ask a different one: "did anyone give
me a value". Those two questions have the same shape at the call site and
different answers for `0`, `""`, `[]`, `{}` and `False`. Every value that is
both legitimate and falsy sits in the gap between them. This is the most
expensive bug in the topic because it does not raise, it does not log, and it
produces a plausible wrong answer — the empty dashboard that says "no orders"
when the truth is "the orders query has not run yet".**

## The two questions

```python
if items:               # "does items have anything in it?"
if items is not None:   # "did I get an items back at all?"
```

Those are different questions. They agree for every non-empty list and disagree
for exactly one input — the empty one — and that input is the interesting case.
PEP 8 names the trap directly:

> *"Beware of writing `if x` when you really mean `if x is not None` – e.g. when
> testing whether a variable or argument that defaults to None was set to some
> other value. The other value might have a type (such as a container) that could
> be false in a boolean context!"*

The values that fall in the gap:

| Value | Truthy? | Is it a legitimate answer? |
|---|---|---|
| `None` | No | Usually means "no answer" |
| `0` | No | **Yes** — a real count, a real price, a real index |
| `0.0` | No | **Yes** — a real measurement |
| `""` | No | **Yes** — a cleared field, a deliberate blank |
| `[]`, `{}`, `set()` | No | **Yes** — a query that found nothing |
| `False` | No | **Yes** — a flag deliberately turned off |
| `Decimal("0.00")` | No | **Yes** — a zero-value invoice line |

Every row except the first is a value someone meant to send you, and truthiness
throws them all in the same bin as "nothing arrived".

## The bug, in the shape it actually takes

```python
def render_orders(user):
    orders = cache.get(f"orders:{user.id}")     # None on a cache miss
    if orders:
        return template("orders.html", orders=orders)
    return template("no_orders.html")
```

Two completely different situations reach `no_orders.html`:

1. The cache **missed** — we do not know whether this user has orders.
2. The cache **hit** and the answer was `[]` — this user genuinely has none.

The first should trigger a database read. The second should not. The code cannot
tell them apart, so it either shows "no orders" to a user who has fifty, or it
re-queries on every request for users who genuinely have none. Both bugs are
invisible in testing, because test fixtures rarely include a *cached empty
result* — the fixture is either "no cache" or "cache with data", and the third
case is the one that ships.

The fix is to stop overloading one variable with two facts:

```python
def render_orders(user):
    orders = cache.get(f"orders:{user.id}")
    if orders is None:                      # a miss — go and find out
        orders = db.orders_for(user)
        cache.set(f"orders:{user.id}", orders)
    if orders:                              # now the truthiness question is safe
        return template("orders.html", orders=orders)
    return template("no_orders.html")
```

Note the shape: the `is None` test comes **first** and resolves "do we know",
and only then does the truthiness test ask "is it empty". Once `orders` is
guaranteed to be a list, `if orders:` is exactly the right idiom and PEP 8
endorses it. **Truthiness is not the enemy** — using it before you have
established that a value exists is.

## The habit that prevents all of it

Say the question you mean.

| The question | Write |
|---|---|
| Did I get a value? | `is None` / `is not None`, or a sentinel when `None` is legitimate |
| Is this container empty? | `if items:` / `if not items:` — **after** you know it is a container |
| Is this flag on? | `if flag:` when it is a real `bool`; `is True` only to exclude other truthy values, which is rare |
| Is this number non-zero? | `if n != 0:` when zero is meaningful; `if n:` only when it genuinely is not |

Two tests in sequence is not a code smell here — it is the accurate expression
of two facts. Collapsing them into one is the bug.

## Let the type checker hold the contract

Type annotations turn the first row of that table from something you remember
into something a tool enforces:

```python
def find_tags(post_id: int) -> list[str] | None: ...   # None is on the table
def find_tags(post_id: int) -> list[str]: ...          # a promise: always a list
```

The first signature makes a checker in strict mode flag every
`for tag in find_tags(pid):` that forgot the `None`. The second is a promise —
make it and then keep it, by raising for the missing case rather than returning
`None`.

What the checker cannot do is catch the semantic half. A function annotated
`-> list[str]` that returns `[]` for *both* "no such post" and "a post with no
tags" is perfectly type-correct and still wrong, because it has thrown away a
distinction the caller needs. That part is a contract you write down —
`X | None` says "there may be no value", it does not say *what the absence
means*. [Where the gap opens](02b-where-the-gap-opens.md) walks the five places
this happens in practice.

## Gotchas

**Symptom — a dashboard shows "no data" for a user who definitely has data, but
only sometimes.** Cause: `if rows:` conflates a cache miss (`None`) with a
cached empty result (`[]`), so the miss path renders the empty state instead of
fetching. Fix: test `if rows is None:` for the miss, populate, and only then use
truthiness for the empty check.

**Symptom — passing `limit=0` gets you 50 results.** Cause: `if not limit:
limit = 50` treats a deliberate zero as "not supplied". Fix: default the
parameter to `None` and test `if limit is None:`. The same bug hits `page=0`,
`timeout=0`, `retries=0` and `discount=0`.

**Symptom — a `Decimal("0.00")` invoice line disappears from a report.** Cause:
`if line.amount:` filters out a legitimate zero-value line. Fix: filter on the
question you mean — `if line.amount is not None:` for existence, or explicitly
`if line.amount != 0:` if zero lines really should be hidden.

**Symptom — a "did the user type anything" check rejects a deliberate single
space, or accepts one.** Cause: `if name:` is true for `" "`, and
`if name.strip():` is false for it — two reasonable readings of the same
question, silently chosen by whichever line got written. Fix: decide and say so:
`if name is None:` for "no field submitted", `if not name.strip():` for "nothing
meaningful typed". They are different validations and deserve different
messages.

**Symptom — a retry loop never retries.** Cause: `if not response.get("errors"):
return` treats a missing `errors` key and an empty `errors: []` identically, but
one means "the call succeeded" and the other may mean "the call did not report".
Fix: check the status the API actually documents rather than the truthiness of a
list that may be absent for unrelated reasons.

**Symptom — a `functools.lru_cache`-style memo keeps hitting the database for
keys whose answer is legitimately empty.** Cause: the caller re-runs the query
whenever the cached value is falsy — `if not cached: cached = fetch()` — so an
empty result is never treated as cached. Fix: cache a distinguishable "we looked
and found nothing" value, and test `is None` (or `is _MISSING`) for the miss.

**Symptom — a type checker is silent about a `None` that crashes at runtime.**
Cause: the function is annotated `-> list[str]` but has a `return None` path, or
is unannotated so the checker infers `Any`. Fix: annotate the honest type
(`list[str] | None`) and let the checker force every caller to handle it, or
change the function to always return a list and raise for the missing case.

**Symptom — the bug reproduces in production and never in tests.** Cause: the
gap only opens for the *empty-but-present* case, and fixtures almost never
include it — they cover "nothing there" and "several things there". Fix: add the
empty case to the fixture set deliberately. For every function that can return a
container, there are three tests, not two: missing, empty, populated.

## Interview questions

**★ Q: What is wrong with `if items:` to check whether a query returned results?**
Nothing, *if* you already know `items` is a list. The bug is using it to also
answer "did the query run" — a cache miss, a failed call or an unset variable is
typically `None`, which is falsy, so "we do not know" and "we know it is empty"
take the same branch. Test `is None` for existence first, then truthiness for
emptiness.

**★ Q: Which values sit in the gap between "empty" and "missing"?**
Everything falsy that is also a legitimate value: `0`, `0.0`, `Decimal("0.00")`,
`""`, `[]`, `{}`, `set()` and `False`. Only `None` is unambiguously "no answer".
Any code that uses truthiness to test for presence is wrong for all of the
others, and the failure is silent.

**Q: Is `if items:` bad style, then?**
No — PEP 8 explicitly recommends it for sequences, and it is the form that
survives a change of container type. The rule is about *ordering*: establish
that the value exists (`is None`), then ask whether it is empty. Two tests, two
questions.

**Q: Does a type checker catch this class of bug?**
It catches the `None` half if you annotate honestly: `-> list[str] | None`
forces every caller to handle the `None` branch, and strict mode flags the ones
that do not. It cannot catch the semantic half — a function annotated
`-> list[str]` that returns `[]` for both "no such post" and "post with no tags"
is type-correct and still wrong. That part is a contract you write down.

**Q: You inherit code full of `if x:` checks. How do you find the dangerous ones?**
Look for conditions on values that can be `None`: anything from `dict.get`, a
cache, an ORM nullable field, a function with an `Optional` return, or a
parameter defaulting to `None`. Those are where "missing" and "empty" both flow
into one branch. Conditions on values that are always a container — a
comprehension result, a literal, a freshly-built list — are fine and PEP 8 asks
for them.

**Q: Why does this bug survive code review so reliably?**
Because the correct code and the buggy code are the same line. `if orders:` is
idiomatic, endorsed by PEP 8, and reads well; nothing about it signals that
`orders` might be `None`. The information that makes it wrong lives in the
*previous* line — where the value came from — and reviewers read conditions, not
provenance.

**Q: How many test cases does a function returning `list[str] | None` need?**
Three, not two: `None`, `[]`, and a populated list. Most suites cover the first
and third, which is exactly why the empty-but-present case is the one that
ships.

---

← Prev: [What `if x:` costs](01c-what-if-x-costs.md) · Index: [Truthiness](README.md) · Next → [Where the gap opens](02b-where-the-gap-opens.md)
