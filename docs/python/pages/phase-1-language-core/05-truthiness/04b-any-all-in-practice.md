---
title: "`any` and `all` in practice: mappings, finding the element, and the neighbouring tools"
sidebar_label: "4b · `any` and `all` in practice"
sidebar_position: 59
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`any()`](https://docs.python.org/3.14/library/functions.html#any),
> [`all()`](https://docs.python.org/3.14/library/functions.html#all),
> [`next()`](https://docs.python.org/3.14/library/functions.html#next),
> [`filter()`](https://docs.python.org/3.14/library/functions.html#filter),
> [`itertools`](https://docs.python.org/3.14/library/itertools.html),
> and [PEP 479](https://peps.python.org/pep-0479/).
> Target: **CPython 3.14**.

**`any` and `all` answer exactly one question each — *is there one* and *are
they all* — and return a bare `bool`. Most of the time the question is adjacent
rather than identical: which one, how many, the first one, everything up to the
first failure. Each of those has a one-line idiom, and reaching for the wrong
one produces either a second full pass over the data or a `StopIteration` in
production. This chunk is that family, plus the mapping trap, where iterating a
`dict` gives you keys and almost nobody means keys.**

## `any` and `all` with a mapping

Iterating a `dict` yields its **keys**, which is rarely the question:

```python
any(config)                 # "is any KEY truthy" — basically "is the dict non-empty",
                            # unless you have "" or 0 as a key
any(config.values())        # "is any VALUE truthy" — usually what was meant
all(config.values())        # "is every value truthy"
any(v is not None for v in config.values())     # "is any value present"
```

That last form is the one to reach for whenever falsy-but-valid values are in
play — the same [empty-versus-missing](02-empty-versus-missing.md) distinction,
now inside a generator expression.

`items()` is what you want as soon as the answer needs to name the offender:

```python
missing = [k for k, v in config.items() if v is None]
if missing:
    raise ConfigError(f"unset keys: {', '.join(sorted(missing))}")
```

That is strictly better than `if not all(config.values()):` followed by an error
message that cannot say which key was wrong — and it costs one comprehension.

## When you need the element, not the answer

`any` tells you *whether*, never *which*. The idiom for "which" is `next` over a
generator with a default:

```python
first_admin = next((u for u in users if u.is_admin), None)
if first_admin is not None:
    ...
```

Two details make this work:

- **The parentheses around the generator expression are required** when `next`
  has a second argument. Without them it is a syntax error, because Python
  cannot tell the generator from a second positional argument.
- **The `None` default is what stops it raising.** Bare
  `next(u for u in users if u.is_admin)` raises `StopIteration` when nothing
  matches, and that is a genuinely dangerous exception to leak — see the PEP 479
  note below.

`filter` is the same thing spelled differently, and `next(filter(pred, xs), None)`
reads well when `pred` is already a named function. For "which *ones*", a
comprehension is clearer than `filter` and is what PEP 8-shaped code uses.

### Why a bare `next` is worse than a normal exception

[PEP 479](https://peps.python.org/pep-0479/) changed what happens when
`StopIteration` escapes the body of a generator: it is converted into a
`RuntimeError`. The motivation was exactly this bug — an unguarded `next` inside
a generator used to end the *outer* iteration silently, so a lookup failure deep
inside a pipeline looked like "the data ran out". Now it raises, but it raises
something whose message does not obviously name the cause.

The rule is simple: **`next()` always takes a default**, unless you are
deliberately catching `StopIteration` on the very next line.

## The neighbouring questions

| Question | Tool |
|---|---|
| Is at least one true? | `any(...)` |
| Are all true? | `all(...)` |
| Are none true? | `not any(...)` — reads better than `all(not x for x in xs)` |
| Which is the first true one? | `next((x for x in xs if pred(x)), None)` |
| Which ones? | `[x for x in xs if pred(x)]` |
| How many are true? | `sum(1 for x in xs if pred(x))` — or `sum(map(bool, xs))` |
| Take while true, then stop | `itertools.takewhile(pred, xs)` |
| Skip while true, then take the rest | `itertools.dropwhile(pred, xs)` |
| Group runs of equal truth | `itertools.groupby(xs, key=pred)` |
| Is exactly one true? | `sum(map(bool, xs)) == 1` |

`sum(1 for x in xs if pred(x))` is worth committing to memory: it counts without
building a list, and it is the honest answer to "how many", which people
otherwise write as `len([x for x in xs if pred(x)])` — allocating the whole list
to throw it away.

`sum(map(bool, xs))` works for the same reason `True + True == 2` does: `bool`
is a subclass of `int`. It is the shortest spelling of "how many truthy
elements", and it is the natural way to express "exactly one", which comes up in
validation ("supply either a file or a URL, not both").

### `not any` versus `all(not ...)`

```python
if not any(errors):                      # clear
if all(not e for e in errors):           # same answer, harder to read
```

They agree in every case, including the empty one — `not any([])` is `True` and
`all(...)` over an empty generator is also `True`. Prefer `not any(...)`: one
negation instead of one per element, and it short-circuits identically.

De Morgan is worth stating once because it is the source of a real refactoring
bug: `not all(P)` is `any(not P)`, **not** `all(not P)`. Turning "not everything
passed" into "everything failed" is a change of meaning, and it survives review
because both sentences sound like negations of the original.

## Gotchas

**Symptom — `any(config)` returns `True` for a config whose values are all
`None`.** Cause: iterating a dict yields keys, so you tested whether any *key*
is truthy. Fix: `any(config.values())`, or
`any(v is not None for v in config.values())` when falsy-but-valid values matter.

**Symptom — a config validation error says "invalid configuration" and cannot
name the key.** Cause: `all(config.values())` collapses the whole mapping into
one bool, throwing away which entry failed. Fix: build the failure list with a
comprehension over `.items()` and report it — the check and the message then come
from the same expression.

**Symptom — `next(x for x in xs if pred(x))` raises `StopIteration` in
production.** Cause: no element matched and there is no default. Inside a
generator or an `async` function this is worse than a normal exception — PEP 479
turns a `StopIteration` escaping a generator into a `RuntimeError`, whose message
does not name the real cause. Fix: always pass the default:
`next((x for x in xs if pred(x)), None)`.

**Symptom — `next(x for x in xs, None)` is a `SyntaxError`.** Cause: a generator
expression must be parenthesised when it is not the sole argument. Fix:
`next((x for x in xs), None)`. The error message points at the comma, which does
not obviously suggest the fix.

**Symptom — `all(d.get(k) for k in required)` rejects a payload where a required
field is legitimately `0` or `""`.** Cause: the generator truth-tests the value
rather than checking presence. Fix: `all(k in d for k in required)`, which is
the question "are all required keys present".

**Symptom — refactoring `not all(checks)` into `all(not c for c in checks)`
changes behaviour.** Cause: De Morgan — `not all(P)` is `any(not P)`, not
`all(not P)`. "Not everything passed" and "everything failed" are different
claims. Fix: `any(not c for c in checks)`, or leave the original alone.

**Symptom — a "count the matches" line shows up as a memory spike.** Cause:
`len([x for x in huge if pred(x)])` materialises every match before counting.
Fix: `sum(1 for x in huge if pred(x))`, which holds one element at a time.

**Symptom — `takewhile` returns nothing on data you can see is sorted
correctly.** Cause: `takewhile` stops at the **first** element failing the
predicate, so a single out-of-order leading element ends it immediately — it is
not a filter. Fix: use a comprehension if you meant "all matching elements";
`takewhile` is for prefixes only.

**Symptom — `filter(None, xs)` silently drops legitimate zeros.** Cause: passing
`None` as the function makes `filter` keep only truthy elements — that is its
documented behaviour, and it is the same falsy-collapse as everywhere else in
this topic. Fix: `filter(lambda x: x is not None, xs)`, or the clearer
comprehension `[x for x in xs if x is not None]`.

## Interview questions

**★ Q: How would you count how many elements satisfy a predicate?**
`sum(1 for x in xs if pred(x))` — it counts lazily without building a list. The
alternative people reach for, `len([x for x in xs if pred(x)])`, allocates the
whole list to throw it away. `sum(map(bool, xs))` works too, and relies on `bool`
being a subclass of `int`.

**★ Q: `any(d)` versus `any(d.values())` — what is the difference?**
Iterating a `dict` yields keys, so `any(d)` asks whether any key is truthy,
which for normal string keys is just "is the dict non-empty". `any(d.values())`
asks the question people mean. And when falsy-but-valid values are in play,
neither is right — `any(v is not None for v in d.values())` is.

**★ Q: How do you get the first element matching a predicate?**
`next((x for x in xs if pred(x)), None)`. The parentheses around the generator
are required once `next` has a second argument, and the default is what turns
"no match" into `None` instead of `StopIteration`.

**Q: Why does `next(gen)` with no default sometimes turn into a `RuntimeError`?**
Because of PEP 479: a `StopIteration` that escapes the body of a generator is
converted into a `RuntimeError`, so an unguarded `next` inside a generator does
not quietly end the outer iteration — it raises something confusing instead.
Always pass a default.

**Q: Is `not any(xs)` the same as `all(not x for x in xs)`?**
Yes, in every case including the empty one. Prefer `not any(xs)` — one negation
rather than one per element, and it reads as the sentence you mean. The trap
next door is different: `not all(P)` is `any(not P)`, **not** `all(not P)`.

**Q: What does `filter(None, xs)` do?**
Keeps only the truthy elements — passing `None` as the function is documented
shorthand for the identity predicate. It is concise and it is the same
falsy-collapse this whole topic warns about, so it silently drops `0`, `""` and
`[]`. `[x for x in xs if x is not None]` says what is usually meant.

**Q: When would you use `takewhile` rather than a comprehension?**
When you want a **prefix**, not a filter. `takewhile` stops at the first element
that fails the predicate and discards the rest, which is right for reading a
header block until the first blank line, or consuming a sorted stream up to a
cutoff. If a later matching element should still be included, you wanted a
comprehension.

**Q: How do you check that exactly one of several options was supplied?**
`sum(map(bool, (file, url, stdin))) == 1`. It reads directly as "how many were
given", and it works because `bool` is an `int`. The `if (file and not url) or
(url and not file)` form does not generalise past two options and is a classic
source of precedence bugs.

---

← Prev: [`any` and `all`](04-any-and-all.md) · Index: [Truthiness](README.md) · Next → [The walrus operator](05-the-walrus-operator.md)
