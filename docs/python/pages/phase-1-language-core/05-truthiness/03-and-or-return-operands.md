---
title: "`and` and `or` return an operand, not a boolean — and short-circuit while doing it"
sidebar_label: "3 · `and` and `or` return operands"
sidebar_position: 56
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Boolean Operations — `and`, `or`, `not`](https://docs.python.org/3.14/library/stdtypes.html#boolean-operations-and-or-not)
> and [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> the Language Reference
> [Boolean operations](https://docs.python.org/3.14/reference/expressions.html#boolean-operations),
> and [PEP 505](https://peps.python.org/pep-0505/).
> Target: **CPython 3.14**.

**`x or y` does not evaluate to `True` or `False`. It evaluates to `x` or to
`y` — the actual object — and the docs flag this as an explicit exception to
the rule that boolean-result operations return booleans. That is what makes
`name or "anonymous"` a default-value idiom rather than a comparison, and it is
also what makes `port = config.get("port") or 8080` wrong the day someone
configures port `0`. `not`, by contrast, always returns a real `bool`. Three
operators, two different answers to "what type do I get back", and the
difference is load-bearing.**

## The table, from the docs

These are the Boolean operations, ordered by **ascending** priority — so `or`
binds most loosely and `not` most tightly:

| Operation | Result | Note |
|---|---|---|
| `x or y` | if *x* is true, then *x*, else *y* | short-circuits: only evaluates *y* if *x* is false |
| `x and y` | if *x* is false, then *x*, else *y* | short-circuits: only evaluates *y* if *x* is true |
| `not x` | if *x* is false, then `True`, else `False` | always a `bool` |

And the sentence that makes it official, from Truth Value Testing:

> *"Operations and built-in functions that have a Boolean result always return
> `0` or `False` for false and `1` or `True` for true, unless otherwise stated.
> (Important exception: the Boolean operations `or` and `and` always return one
> of their operands.)"*

Read the two rows carefully — they are not symmetric in the way people
remember. `or` returns the **first truthy** operand, or the last one if none is
truthy. `and` returns the **first falsy** operand, or the last one if all are
truthy. In both cases the last operand is returned regardless of its truth
value, which is why `0 or []` is `[]` and `1 and ""` is `""`.

```python
"alice" or "anonymous"   # "alice"   — first operand is truthy
""      or "anonymous"   # "anonymous"
0       or []            # []        — neither is truthy; the LAST is returned
None    or 0 or ""       # ""        — same rule, chained
"alice" and "anonymous"  # "anonymous" — both truthy, last returned
""      and "anonymous"  # ""        — first falsy operand, short-circuits
```

`not` is the odd one out and always narrows to a `bool`:

```python
not []          # True   — a real bool, not []
not "alice"     # False
not not [1, 2]  # True   — the "coerce to bool" idiom; bool([1, 2]) is clearer
```

The practical consequence of the asymmetry: **the type of an `and`/`or`
expression is the union of its operand types**, which is why a function that
returns `a or b` can hand back something the annotation did not promise. A type
checker will tell you, if the annotation is honest.

## Short-circuiting is a guarantee, not an optimisation

The docs describe both operators as short-circuit, so you can rely on it for
correctness rather than merely for speed:

```python
if user is not None and user.is_active:     # never touches .is_active on None
if not items or items[0] is None:           # never indexes an empty list
if cache_hit or expensive_lookup():         # the call does not happen on a hit
```

Each of those is *only* correct because the right operand is not evaluated.
Rewriting them with a non-short-circuiting operator breaks them:

```python
if user is not None & user.is_active:   # wrong: & is bitwise, evaluates both,
                                        # and binds tighter than `is not`
```

The mirror-image consequence is that a side effect in the right operand
**conditionally** happens. Do not write side effects into boolean operators. The
idiom exists in Perl and shell (`mkdir x || die`), reads as clever in Python, and
hides control flow from every reader and every debugger breakpoint.

## The `or` default idiom, and exactly when it is wrong

```python
display_name = name or "anonymous"
```

This is idiomatic, common, and correct **when every falsy value should be
replaced**. For a display name, `""` and `None` both mean "nothing to show", so
collapsing them is right.

It is wrong the moment a falsy value is a legitimate answer:

```python
port    = config.get("port")    or 8080   # port 0 becomes 8080
retries = config.get("retries") or 3      # "no retries" becomes 3
limit   = user_limit            or 100    # limit=0 becomes 100
name    = payload.get("name")   or "N/A"  # a deliberate "" becomes "N/A"
enabled = settings.get("on")    or True   # False becomes True — always on!
```

That last line is the worst of them: a feature flag that cannot be turned off.
Every one of these is the [empty-versus-missing](02-empty-versus-missing.md) bug
wearing an operator instead of an `if`.

The fix is to say which question you mean:

```python
port = config.get("port")
if port is None:
    port = 8080

# or, in one expression:
port = 8080 if config.get("port") is None else config["port"]

# or, best, let the lookup carry the default:
port = config.get("port", 8080)     # only substitutes for an ABSENT key
```

`dict.get`'s own default is the cleanest of the three, because it substitutes on
*absence* rather than on falsiness — which is the distinction the whole topic is
about. It still cannot tell an absent key from a stored `None`;
[chunk 2b](02b-where-the-gap-opens.md) covers that.

### The rule of thumb

> Use `x or default` when the default should replace **every** falsy value.
> Use `x if x is not None else default` when it should replace **only** `None`.

If you cannot say which one you meant in a sentence, the `or` form is probably a
bug waiting for a zero.

### Chained `or` defaults

```python
timeout = cli_arg or env_value or config_value or 30
```

This is the classic "precedence of configuration sources" one-liner, and it has
the same flaw multiplied by four: any source that legitimately supplies `0` is
skipped in favour of the next one down. When zero is meaningful, the honest form
is a loop over candidates with an `is not None` test, which also gives you
somewhere to log *which* source won:

```python
for source, value in [("cli", cli_arg), ("env", env_value), ("config", config_value)]:
    if value is not None:
        log.debug("timeout from %s", source)
        timeout = value
        break
else:
    timeout = 30
```

## The `and` guard idiom

`and` returning its operand makes a compact "safe navigation":

```python
city = user and user.address and user.address.city
```

If `user` is `None`, the whole expression is `None`. If `user.address` is
`None`, the expression is `None`. Otherwise it is the city. It is concise, and
it has the same flaw in the other direction: if `user.address` is a falsy
*object* — an empty `Address()` with `__len__` — the expression returns that
object rather than the city, so the caller gets an `Address` where it expected a
`str | None`.

The explicit form is longer and says what it means:

```python
city = user.address.city if user is not None and user.address is not None else None
```

For attribute chains, the honest observation is that Python has no `?.`
operator. [PEP 505](https://peps.python.org/pep-0505/) proposed none-aware
operators (`?.`, `??`) and is **deferred** — not rejected, not accepted — so the
`and` chain and the explicit conditional are what exist today.

## Gotchas

**Symptom — a configured value of `0` is silently replaced by the default.**
Cause: `x = config.get("k") or DEFAULT` substitutes for every falsy value, and
`0` is falsy. Fix: `config.get("k", DEFAULT)` if only an absent key should get
the default, or an explicit `is None` test if a stored `None` should too.

**Symptom — a feature flag cannot be turned off.** Cause:
`enabled = settings.get("on") or True` — `False or True` is `True`, so the flag
is on no matter what is configured. Fix: `settings.get("on", True)`, and never
use `or` to default a boolean.

**Symptom — a config layering chain silently skips a source that supplied
zero.** Cause: `cli or env or config or 30` moves on from any falsy value, so an
explicit `--timeout 0` is treated as absent. Fix: iterate the candidates and
take the first that `is not None`, which also lets you log which one won.

**Symptom — a "safe navigation" chain returns an object instead of `None` or the
attribute.** Cause: `a and a.b and a.b.c` returns the first falsy operand, which
may be a falsy *object* rather than `None`. Fix: explicit `is not None` tests,
or the conditional expression. Python has no `?.` — PEP 505 is deferred.

**Symptom — a side effect in a boolean expression sometimes does not happen.**
Cause: short-circuiting means the right operand is not evaluated at all. Fix:
this is the documented behaviour; move the side effect into a statement. Any
expression whose *purpose* is its side effect belongs on its own line.

**Symptom — `x = x or []` in a loop reuses the same list across iterations.**
Cause: the `or` returns the existing object when it is truthy, so a list built
in a previous pass is carried forward. Fix: this is aliasing rather than
truthiness — see [Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md) — but
the `or` form is what hides it. Prefer an explicit `is None` test.

**Symptom — a type checker complains that a function annotated `-> str` returns
`str | None`.** Cause: the body is `return name or default` where `default` is
itself `None`, or `return a and a.b` where `a` may be falsy. Fix: the checker is
right — the expression's type is the union of its operands. Either narrow before
returning, or annotate the honest union.

**Symptom — `a and b` raises on numpy arrays where `a & b` works.** Cause: `and`
truth-tests its left operand and a multi-element array refuses to produce a truth
value. `and`/`or`/`not` cannot be overloaded — there are no dunders for them —
so array libraries co-opt `&`/`|`/`~` instead. Fix: use the bitwise operators and
parenthesise, since they bind tighter than the comparisons.
[Chunk 1c](01c-what-if-x-costs.md) has the detail.

## Interview questions

**★ Q: What does `x or y` return?**
Not a boolean — one of the operands. `x` if `x` is truthy, otherwise `y`. The
docs call this out as an explicit exception to the rule that boolean-result
operations return booleans. `and` is the mirror: the first falsy operand, or the
last one if all are truthy. `not` is the only one of the three that always
returns a real `bool`.

**★ Q: What is wrong with `port = config.get("port") or 8080`?**
It replaces every falsy value, not just a missing one, so a deliberately
configured port `0` becomes 8080. The same bug hits `retries=0`, `limit=0`,
`name=""` and — worst — `enabled=False`, which produces a feature flag that
cannot be turned off. Use `config.get("port", 8080)` to default on absence, or
an explicit `is None` test.

**★ Q: Does Python guarantee short-circuiting, or is it an optimisation?**
It is guaranteed and documented, which is why `if user is not None and
user.is_active:` is correct code rather than merely fast code. The right operand
of `and` is evaluated only when the left is truthy, and of `or` only when the
left is falsy.

**Q: What is the type of `a or b`?**
The union of the operand types. That is a real consequence, not a technicality:
a function whose body is `return name or None` cannot be annotated `-> str`, and
a checker will say so. It is also why the `and` guard chain can return an
`Address` from an expression the caller reads as `str | None`.

**Q: How do you write "safe navigation" in Python?**
There is no `?.`; PEP 505 proposed none-aware operators and is deferred. The
options are an `and` chain (`user and user.address and user.address.city`),
which returns the first falsy operand and so can hand back a falsy object rather
than `None`, or an explicit conditional expression, which is longer and exact.

**Q: Can you overload `and` and `or` for your own type?**
No. There are no `__and_bool__`/`__or_bool__` dunders — the operators are part of
the grammar and truth-test their operands. That is precisely why numpy and
pandas overload the *bitwise* `&`, `|` and `~` for element-wise logic, and why
mixing them up produces either an ambiguity error or silently wrong precedence.

**Q: Is `not not x` a reasonable way to get a bool?**
It works and it is a real idiom, but `bool(x)` says the same thing in fewer
characters and reads as a conversion rather than a puzzle. Use `bool(x)`.

**Q: Why is `mkdir_or_die = make_dir() or fail()` a bad idea in Python even though the shell equivalent is normal?**
Because it hides control flow inside an expression: whether `fail()` runs depends
on the truth value of `make_dir()`'s return, which is usually `None` and
therefore always falsy — so `fail()` always runs. Even when the truth values are
right, a debugger breakpoint on the line cannot tell you which branch was taken.
Statements are free; use one.

---

← Prev: [Tri-states and the API boundary](02c-tri-states-and-the-api-boundary.md) · Index: [Truthiness](README.md) · Next → [Precedence and negation](03b-precedence-and-negation.md)
