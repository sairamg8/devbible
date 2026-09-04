---
title: "The cost question has one shape that decides it — the miss rate — and you can settle it by counting operations instead of seconds: LBYL pays its extra lookup on the hit, EAFP pays a raise on the miss, and get with a default pays neither"
sidebar_label: "07b · The miss rate decides"
sidebar_position: 149
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`d[key]`, `get`, `key in d`),
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict),
> [What's New in Python 3.11 — Misc](https://docs.python.org/3.14/whatsnew/3.11.html).
> Target: **Python 3.14**.
> 🔴 **Every count on this page is a count of operations in the code beside it.** There
> are no timings here, and the one place a ratio would be needed is called out as
> undocumented rather than guessed.

**[07 · The cost argument](07-the-cost-argument.md) established that the published record
is two sentences and that neither compares a `try` with an `if`. This chunk makes the
argument you *can* make from the code alone: LBYL performs the operation twice and EAFP
performs it once, so the two spellings put their extra work on opposite paths — LBYL on
the hit, EAFP on the miss. That makes the **miss rate** the only variable that decides,
and it produces a crossover condition with exactly one unknown in it: the ratio of a
lookup to a raise, which no official source publishes. That unknown is why this argument
ends in "measure it", never in a number. The other half of that arithmetic — that LBYL
performs the operation twice, which is a claim about complexity rather than time and is
therefore the one you can defend in review without a stopwatch — is
[07c · The double-work argument](07c-the-double-work-argument.md).**

## The number you are allowed to state: operations, not seconds

Here are the three spellings of one dictionary read, annotated with the count of lookups
each performs. This is not a timing — it is arithmetic over the code you can see.

```python
MISSING = object()

# LBYL — two lookups on a hit, one on a miss.
def lbyl(cache, key):
    if key in cache:        # lookup 1
        return cache[key]   # lookup 2
    return MISSING

# get with a default — exactly one lookup, hit or miss.
def with_default(cache, key):
    return cache.get(key, MISSING)   # lookup 1

# EAFP — one lookup on a hit; one lookup plus a raise and a catch on a miss.
def eafp(cache, key):
    try:
        return cache[key]   # lookup 1
    except KeyError:        # on a miss: + raise + catch
        return MISSING
```

Read the LBYL row again: **it pays its extra lookup on the hit**, the path you asserted
was the common one when you chose LBYL in the first place. That is the single strongest
structural point against `if key in d: d[key]`, and it needs no measurement at all.

## The shape that decides it is the miss rate

Model it, with the model's assumptions stated out loud: let `h` be the cost of one
lookup, `r` the cost of one raise-and-catch, and `p` the fraction of calls that miss.
Treat every lookup as costing the same and ignore per-call overhead — this is a model of
the operation count, not a measurement.

| Spelling | Cost |
|---|---|
| `if k in d: d[k]` | `2h(1 - p) + hp` = `h(2 - p)` |
| `d.get(k, default)` | `h` |
| `try: d[k]` | `h + pr` |

Three conclusions fall straight out:

1. **EAFP beats LBYL exactly when `p / (1 - p) < h / r`.** The left side is yours to
   know — it is your data's miss rate. The right side is the ratio of a lookup to a
   raise, and **no official source publishes it**. That is the entire reason this
   argument cannot be settled from documentation: the crossover depends on a number
   nobody documents.
2. **When `p` is near zero, EAFP costs `h` and LBYL costs nearly `2h`.** EAFP wins, and
   the docs' "clean and fast" phrasing in the [glossary](01-the-two-names.md) is about
   this case.
3. **`d.get(k, default)` costs `h` for every value of `p`.** It is never worse than
   either, which is why a routine miss is a `get`, not a contest between the other two —
   see [03 · Mappings, the decision table](03-mappings-the-decision-table.md).

The catch on `get` is not performance, it is meaning: it cannot distinguish *absent* from
*present and equal to the default*, and it does not fire `__missing__`. Both of those,
with code, are in [03](03-mappings-the-decision-table.md) and
[03b · Writing on a miss](03b-writing-on-a-miss.md).

## Gotchas

**★ Symptom: someone rewrote a hot loop's `try` as an `if` "for speed" and nothing got
faster — or it got slower.** Cause: on the no-raise path the `try` was already free
(*"eliminating the cost of `try` statements when no exception is raised"*), while the
`if` added a second lookup to every successful iteration. The rewrite optimised the path
that had no cost and taxed the path that runs every time. Fix: put it back, or use the
one-lookup spelling that also reads well.

```python
# Slower AND longer: two lookups per hit.
for key in keys:
    if key in index:
        emit(index[key])

# One lookup per iteration, no exception on the common path.
for key in keys:
    row = index.get(key)
    if row is not None:
        emit(row)
```

**★ Symptom: the `except KeyError` branch is where the profiler says the time goes.**
Cause: your assumption is wrong most of the time, so you are paying `r` — the one cost
the documentation confirms is non-zero — on the majority of calls. EAFP is a bet that the
assumption holds; a miss-dominated path is a lost bet. Fix: stop raising on the common
case.

```python
from collections import defaultdict

# Before: a raise per new key, and every key is new the first time.
groups = {}
for user in users:
    try:
        groups[user.team].append(user)
    except KeyError:
        groups[user.team] = [user]

# After: no exception is raised at all.
groups = defaultdict(list)
for user in users:
    groups[user.team].append(user)
```

⚠️ `defaultdict` changes what a *read* means as well as a write — inside a `defaultdict`,
`try: d[k] / except KeyError` never fires and silently inserts a key. That trap is
[03b · Writing on a miss](03b-writing-on-a-miss.md).

**Symptom: a comprehension that "handles errors" is written by calling a helper per
element, and the loop is now slower than the plain `for` it replaced.** Cause: a
comprehension may only contain expressions, so a `try` cannot appear in one — the usual
workaround is a helper function, which adds one Python-level call per element that the
statement form does not pay. That is an operation-count claim, and it is the one place
where EAFP genuinely costs more *shape* than LBYL. Fix: either use an expression-level
spelling that cannot raise, or write the explicit loop.

```python
# One extra function call per element, purely to host the try.
def _safe(row):
    try:
        return parse(row)
    except ValueError:
        return None

parsed = [p for p in (_safe(r) for r in rows) if p is not None]

# Expression-level, no call, no exception: the mapping already has a miss API.
codes = [country_by_iso.get(row.iso, UNKNOWN) for row in rows]

# Or the statement form, which is what the comprehension was imitating.
parsed = []
for row in rows:
    try:
        parsed.append(parse(row))
    except ValueError as exc:
        rejected.append((row, str(exc)))
```

**Symptom: a code review rejects `.get()` in favour of `if k in d: d[k]` on grounds of
"explicitness", on a hot path.** Cause: a real readability preference applied without
noticing it doubles the lookup on the common path — the two-lookup form is the only one
of the three spellings that is never optimal on operation count. Fix: if the miss has a
sensible default, `get` is both one operation and one line; keep the `in` test only when
you need presence *itself* as the answer.

```python
timeout = settings.get("timeout", DEFAULT_TIMEOUT)   # one lookup, one line

if "timeout" in settings:                            # presence IS the fact you need
    log.info("timeout overridden in config")
```

**Symptom: a micro-benchmark is pasted into a review to prove `try`/`except` is far
slower.** Cause: benchmarks of this pair almost always raise on 100% of iterations,
which sets `p = 1` — the corner of the model where EAFP is worst and which is, by
construction, not the case you wrote EAFP for. Fix: demand the miss rate before you
accept the number, and parameterise it — the design of that harness is in
[07e · Measuring instead of arguing](07e-measuring-instead-of-arguing.md).

## Interview questions

**★ When would you *not* use EAFP for performance reasons?**
When the miss is the common case rather than the exception, because that is the only path
the documentation confirms costs anything. A parser looking up unknown keys in a mostly
empty dict, a cache with a low hit rate, a lookup table populated lazily on first use —
in each of those you would raise and catch on the majority of calls. Note the right fix
is usually not LBYL: `d.get(k, default)`, `defaultdict`, or `Counter` all perform **one**
lookup and never raise, whereas `if k in d: d[k]` performs two on the hit. So "the miss
is common" argues for the default-valued API, not for the guard.

**★ Count the operations in the three spellings of a dict read. Which is cheapest, and
why does that not settle the choice?**
`if k in d: d[k]` performs two lookups on a hit and one on a miss; `d.get(k, default)`
performs one either way; `try: d[k] / except KeyError` performs one on a hit and one plus
a raise-and-catch on a miss. On operation count `get` is never worse than either
alternative. It does not settle the choice because the three spellings do not mean the
same thing: `get` cannot distinguish absent from present-and-equal-to-the-default, it
does not trigger a `dict` subclass's `__missing__`, and if the miss is genuinely an
error, returning a default converts a loud failure into a silent wrong answer several
frames later. Cost picks between spellings that are already semantically equivalent; it
never picks the semantics.

**★ What is the crossover condition between the two spellings, and why can you not
evaluate it from the documentation?**
With `h` the cost of one lookup, `r` the cost of one raise-and-catch and `p` the miss
rate, LBYL costs `h(2 - p)` and EAFP costs `h + pr`, so EAFP wins exactly when
`p / (1 - p) < h / r`. The left-hand side is a property of your data and you can measure
it cheaply — count the misses. The right-hand side is a property of the interpreter, and
no official source publishes it: the only figures Python gives are that a non-raising
`try` costs nothing and that catching got about 10% cheaper in 3.11, neither of which is a
ratio against a lookup. That is why every honest version of this argument ends in "measure
it on your build" rather than in a number, and why quoting somebody else's multiplier is
quoting their hardware.

**★ You are writing a lookup against a cache with a deliberately low hit rate. Which
spelling?**
Neither of the two classic ones — `get` with a default, or a `defaultdict` if a miss
should populate. A low hit rate means the miss is the common case, and EAFP would pay a
raise-and-catch on the majority of calls, which is the one cost the documentation confirms
is non-zero. But LBYL is not the answer either: it performs two lookups on the hits, which
is the smaller population, and only one on the misses — it optimises the wrong path in the
same breath. `d.get(k, default)` performs one lookup regardless and raises nothing, so it
is never worse than either. The follow-up worth volunteering is the semantic caveat: `get`
cannot tell absent from present-and-equal-to-the-default, so if that distinction matters
you need a unique sentinel rather than `None`.

---

← Prev: [The cost argument](07-the-cost-argument.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [The double-work argument](07c-the-double-work-argument.md)
