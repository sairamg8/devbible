---
title: "`any` and `all`: truthiness over an iterable, and the vacuous truth that ships"
sidebar_label: "4 · `any` and `all`"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`any()`](https://docs.python.org/3.14/library/functions.html#any),
> [`all()`](https://docs.python.org/3.14/library/functions.html#all),
> [`next()`](https://docs.python.org/3.14/library/functions.html#next),
> [`filter()`](https://docs.python.org/3.14/library/functions.html#filter),
> [`itertools`](https://docs.python.org/3.14/library/itertools.html),
> and [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing).
> Target: **CPython 3.14**.

**`any` and `all` are truthiness applied across an iterable, and they inherit
every property of it: they truth-test each element with the same protocol `if`
uses, they short-circuit, and they collapse falsy-but-legitimate values the same
way. They also have one behaviour that is not inherited and catches everyone
once — `all([])` is `True`. "Every user is verified" is true of an empty user
list, which is mathematically correct and operationally a data-loss incident
waiting for the day the query returns nothing.**

## The definitions, from the docs

The docs give the equivalent code for both, and reading it answers most
questions about them:

```python
def any(iterable):
    for element in iterable:
        if element:
            return True
    return False

def all(iterable):
    for element in iterable:
        if not element:
            return False
    return True
```

Four facts fall out of those six lines:

1. **They truth-test elements**, not compare them. `any([0, "", []])` is `False`
   because every element is falsy — not because the list is empty.
2. **They short-circuit.** `any` stops at the first truthy element, `all` at the
   first falsy one. An infinite generator is fine as long as the answer is
   findable.
3. **They return a real `bool`**, unlike `and`/`or`. `any` gives you `True`, not
   the element that was truthy — if you need the element, see
   [chunk 4b](04b-any-all-in-practice.md).
4. **The empty case is decided by the fall-through.** `any([])` returns `False`;
   `all([])` returns `True`. The docs state the second explicitly: `all` returns
   `True` *"if all elements of the iterable are true (or if the iterable is
   empty)"*.

## `all([])` is `True`, and that is the bug

This is **vacuous truth**: the claim "every element satisfies P" has no
counter-example in an empty collection, so it holds. Mathematically
unimpeachable; operationally the source of a specific and expensive class of
bug.

```python
def can_deploy(checks):
    return all(c.passed for c in checks)

can_deploy([])      # True — zero checks passed, so deploy!
```

The shape recurs everywhere a guard is written as "all of the things are OK":

```python
if all(u.email_verified for u in users):        # True when users is empty
    send_bulk_announcement()

if all(f.exists() for f in required_files):     # True when the glob matched nothing
    start_service()

if all(r.status == 200 for r in responses):     # True when every request failed
    mark_healthy()                              # to produce a response at all
```

That last one is the nastiest: an outage that produces *zero* responses reads as
"every response was 200".

The fix is always the same — assert non-emptiness separately, because it is a
separate question:

```python
if checks and all(c.passed for c in checks):
    deploy()
```

or, when emptiness is genuinely an error rather than a "no":

```python
if not checks:
    raise ValueError("no checks configured")
if not all(c.passed for c in checks):
    raise DeployBlocked(...)
```

:::caution
`if checks and all(...)` consumes `checks` twice if it is a generator — the
truthiness test does not, because a generator is always truthy, but that is
worse: the guard silently does nothing. **Materialise first** (`checks =
list(checks)`) whenever you need both the emptiness check and the `all`.
:::

`any([])` being `False` is the same fall-through and almost never surprises
anyone, because "at least one" reading as false for an empty collection matches
intuition. It is only `all` that needs the extra guard.

## Generator argument versus list argument

```python
any(u.is_admin for u in users)          # generator: stops at the first admin
any([u.is_admin for u in users])        # list: builds the whole list first
```

Both give the same answer. The first stops as soon as it finds an admin; the
second evaluates `u.is_admin` for every user, allocates a list, and *then*
short-circuits over a list that is already fully built. When the predicate is
expensive — an attribute that hits the database, a network call, a regex over a
large string — the difference is the whole cost of the operation.

The list form is not always wrong. It is right when you need the list anyway, or
when the iterable is a one-shot generator you must not consume:

```python
results = [check(x) for x in items]     # need these for the report as well
if not all(results):
    report_failures(results)
```

ruff flags the throwaway case as `C419` (*unnecessary list comprehension passed
to any/all*).

### Side effects inside the predicate

Short-circuiting means the predicate does **not** run for every element:

```python
any(log_and_check(x) for x in items)    # logs only up to the first truthy result
```

If the logging was the point, this is a bug, and it is invisible until someone
notices the log is short. Keep `any`/`all` predicates pure; do the side effects
in an explicit loop.

## Gotchas

**Symptom — a deploy gate, health check or validation passes when there is
nothing to check.** Cause: `all([])` is `True` — vacuous truth — so a query that
returned zero rows reads as "everything passed". Fix: check non-emptiness as a
separate question: `if items and all(...)`, or raise when the collection is
empty because that is genuinely a different failure.

**Symptom — `if items and all(...)` silently stops guarding after someone
changes `items` to a generator.** Cause: a generator object is always truthy, so
the emptiness half of the guard becomes a no-op, and the `all` then sees an
already-partly-consumed iterator. Fix: `items = list(items)` first, and do both
tests against the list.

**Symptom — `any(...)` over an expensive predicate is much slower than
expected.** Cause: the argument is a **list comprehension**, so every element is
evaluated before `any` sees any of them; the short-circuit happens over a list
that is already fully built. Fix: drop the brackets and pass a generator
expression. ruff flags this as `C419`.

**Symptom — logging inside an `any(...)` predicate produces fewer lines than
there are elements.** Cause: `any` short-circuits, so the predicate stops running
at the first truthy result. Fix: keep the predicate pure and put the logging in
an explicit loop — a comprehension whose purpose is a side effect is a
comprehension in the wrong place.

**Symptom — `all()` over a generator returns `True` but the loop afterwards
finds nothing.** Cause: `all` consumed the generator. An iterator is exhausted
once read; the second consumer sees an empty sequence — which, for another
`all`, is `True` again, so the bug compounds rather than announcing itself. Fix:
materialise into a list before you need it twice.

**Symptom — `all(x for x in row)` returns a plausible `False` for a row
containing a `None`, with no clue why.** Cause: the predicate truth-tests rather
than compares, so `None`, `0` and `""` are indistinguishable failures. Fix:
write the comparison you mean — `all(x > 0 for x in row)` raises `TypeError`
naming the row, which is a better outcome than a silent `False`.

**Symptom — a validation that "every field is filled in" rejects a legitimate
zero.** Cause: `all(record[f] for f in fields)` truth-tests the values, so `0`,
`""` and `False` count as unfilled. Fix: decide the question — `all(f in record
for f in fields)` for presence, or `all(record[f] is not None for f in fields)`
for non-null.

**Symptom — `any()` on an infinite generator hangs.** Cause: it only
short-circuits when it *finds* a truthy element; if none exists it iterates
forever. Fix: bound the iterable (`itertools.islice`) when the source may be
unbounded and a negative answer is possible.

## Interview questions

**★ Q: What does `all([])` return, and why does it matter?**
`True` — vacuous truth, since an empty collection has no counter-example. It
matters because guards are written as "all the checks passed", and a query that
returns zero rows then reads as success: an empty deploy-check list deploys, an
empty required-files list starts the service, zero HTTP responses all count as
200. Check non-emptiness separately: `if items and all(...)`.

**★ Q: `any(f(x) for x in xs)` or `any([f(x) for x in xs])` — is there a difference?**
Same answer, different cost. The generator form stops calling `f` at the first
truthy result; the list form calls `f` for every element, builds a list, and only
then short-circuits over it. When `f` is expensive the difference is the entire
cost of the operation. ruff flags the list form as `C419`.

**Q: Do `any` and `all` return a boolean or an element?**
A real `bool`, unlike `and`/`or` which return one of their operands. If you need
the element that matched, use `next((x for x in xs if pred(x)), None)` — with
the default, so no match gives `None` rather than `StopIteration`.
[Chunk 4b](04b-any-all-in-practice.md) covers that family.

**Q: How do `any`/`all` decide whether an element is true?**
With the same truth-testing protocol `if` uses — `__bool__`, falling back to
`__len__`. So they inherit every truthiness surprise: `"False"` is truthy, a
custom class with neither method is always truthy, and a numpy array of more
than one element raises.

**Q: You need to know both "did every check pass" and "which ones failed". What do you write?**
Not two passes over a generator — the first consumes it. Materialise once and
use it twice: `results = [(c, c.passed) for c in checks]`, then
`failed = [c for c, ok in results if not ok]` and `if not failed:`. That also
gives you the failure list for the error message, which `all()` alone throws
away.

**Q: Why is `any` safe on an infinite generator but `all` is not — or is it the other way round?**
Both short-circuit, so both are safe *when the answer is findable*: `any`
terminates as soon as it meets a truthy element, `all` as soon as it meets a
falsy one. Neither terminates when the answer requires exhausting an infinite
source — `any` over an all-falsy infinite generator hangs, and so does `all` over
an all-truthy one.

---

← Prev: [Precedence and negation](03b-precedence-and-negation.md) · Index: [Truthiness](README.md) · Next → [`any` and `all` in practice](04b-any-all-in-practice.md)
