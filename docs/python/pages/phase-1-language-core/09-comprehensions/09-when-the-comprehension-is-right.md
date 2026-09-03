---
title: "The other side of the line: six situations where the comprehension is the right answer, including one the loop cannot express"
sidebar_label: "9 · When it is right"
sidebar_position: 108
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 202](https://peps.python.org/pep-0202/),
> [PEP 289](https://peps.python.org/pep-0289/),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions),
> the Python 3.14 Language Reference
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> and the Library Reference
> [`sorted`](https://docs.python.org/3.14/library/functions.html#sorted),
> [`sum`](https://docs.python.org/3.14/library/functions.html#sum),
> [`min`](https://docs.python.org/3.14/library/functions.html#min),
> [`dict.fromkeys`](https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys),
> [`itertools.chain`](https://docs.python.org/3.14/library/itertools.html#itertools.chain).
> Target: **CPython 3.14**.

The previous two chunks are six tests for *no*. Applied on their own they drift
into a rule that a loop is always the safer choice, which is worse advice than
the comprehension abuse they were written against. This chunk is the other
direction: the cases where the comprehension is not merely acceptable but the
better engineering, and one where the loop genuinely cannot do the same thing.

## What the comprehension was actually for

PEP 202's rationale is one sentence, and it is narrower than how the feature
gets used: list comprehensions "provide a more concise way to create lists in
situations where `map()` and `filter()` and/or nested loops would currently be
used." **Creating a container.** Not iterating, not driving side effects, not
replacing control flow — building one collection out of another.

Every case below is a case of that, and every case in
[when it should be a loop](08-when-it-should-have-been-a-loop.md) is a case of
something else wearing the syntax.

## Case 1 — map, filter, or both, over one collection

The base case, and the one that needs no defence:

```python
names = [u.name for u in users]                       # map
active = [u for u in users if u.is_active]            # filter
active_names = [u.name for u in users if u.is_active] # both
```

The loop form of the third is four lines, one of which is `result = []` and one
of which is `result.append(...)` — two lines of bookkeeping around one line of
intent. That ratio is the whole argument.

## Case 2 — where a statement cannot go

A comprehension is an **expression**, so it fits everywhere a statement does
not: an argument, a `return`, a default, a dict value, a decorator argument, the
right-hand side of a walrus, a `dataclass` `field(default_factory=...)` body.

```python
def summary(rows):
    return {
        "ids":   [r.id for r in rows],
        "total": sum(r.amount for r in rows),
        "kinds": {r.kind for r in rows},
    }
```

Writing that with loops means three accumulators and a `return` far away from
the three things being built. This is the case where the loop cannot express the
same code at all — not because it produces a different value, but because there
is nowhere in a dict display to put a `for` statement.

## Case 3 — an aggregate that should never be materialised

`sum`, `any`, `all`, `min`, `max`, `sorted`, `set`, `dict`, `"".join`,
`math.fsum` and every other consuming callable takes an iterable, so the
generator expression form does the same work without building the intermediate
list at all:

```python
total   = sum(r.amount for r in rows)
worst   = min(rows, key=lambda r: r.score)
present = any(r.id == wanted for r in rows)
```

The HOWTO is explicit about why this matters at scale: a list comprehension
returns a list, "not an iterator", so it "isn't useful if you're working with
iterators that return an infinite stream or a very large amount of data.
Generator expressions are preferable in these situations." `any` and `all` add
short-circuiting on top — see
[generator expressions](05-generator-expressions.md).

## Case 4 — a lookup table, an index, or a dedup

A dict or set comprehension turns an O(n) scan into an O(1) test, and the
comprehension is the readable half of that change:

```python
by_id     = {u.id: u for u in users}          # lookup table
allowed   = {p.name for p in permissions}     # membership set
unique    = list(dict.fromkeys(seen))         # dedup, order preserved
```

That middle line is the fix behind most of
[what actually costs](07b-what-actually-costs.md): the slow comprehension was
never slow because it was a comprehension, it was slow because its `if x in ys`
tested a list.

## Case 5 — a `key=` function's worth of shaping, inline

`sorted`, `groupby` and `heapq.nlargest` all take a `key`, and the shaping that
feeds them is usually one expression:

```python
top = sorted((s for s in sessions if s.duration), key=lambda s: -s.duration)[:10]
```

The alternative is a named function used once, three lines away from its only
call site. Once the shaping needs two steps, name it — that is
[test 4](08b-three-more-tests.md).

## Case 6 — you want no partial result on failure

This one is rarely stated and it is a correctness argument, not a style one.
Assignment evaluates the right-hand side **before** binding the target. If the
comprehension raises halfway through, the name is never bound at all:

```python
parsed = [parse(line) for line in lines]   # raises -> `parsed` is untouched
```

The loop form does the opposite. `result` exists and holds the elements
processed before the failure, and the next `except` handler up sees a
half-populated list that looks like a complete one:

```python
result = []
for line in lines:
    result.append(parse(line))   # raises -> `result` holds the first k items
```

Both behaviours are legitimate — [test 2](08-when-it-should-have-been-a-loop.md)
wants the partial result, because skipping bad rows *is* the requirement. The
point is that all-or-nothing is a property you can choose, and the
comprehension is how you choose it.

## The readability rule that actually holds

One `for`, an optional `if`, an output expression short enough to read without
scrolling. Two `for` clauses when the second is a genuine flatten of a
two-level structure. Past that, [test 5](08b-three-more-tests.md) applies, and
`itertools.chain.from_iterable` is usually the thing that was wanted.

None of this is a performance argument. The speed difference is real and
documented in [performance](07-performance.md), but it is small enough that it
should never be the reason — the reason is that the concise form says "build
this collection from that one" and nothing else.

## Gotchas

**★ Symptom — a reviewer asks for a loop to be "modernised" into a
comprehension, and the result is a comprehension whose value is thrown away.**
Cause: the loop was driving side effects, so the rewrite has no container to
build and the comprehension is being used as a statement. Fix: leave it a loop.
The comprehension only wins when there is a collection to produce.

```python
# NOT a candidate for a comprehension — nothing is being built
for user in users:
    send_welcome_email(user)
```

**★ Symptom — a function returns a generator expression and its caller reports
zero rows on the second call.** Cause: case 3's laziness escaped the function
that owned it, so the caller got a one-shot iterator where it expected a
collection. Fix: keep the genexp inside the aggregate, or return a list at the
boundary and let the caller decide.

```python
def amounts(rows):
    return [r.amount for r in rows]      # a return value is a collection
total = sum(r.amount for r in rows)      # a genexp is an argument
```

**★ Symptom — a dict comprehension built as a lookup table has fewer entries
than the source.** Cause: the key is not unique, and the duplicate-key rule
kept the last value silently. Fix: assert the width you expect, or group
instead — see [dict and set comprehensions](06-dict-and-set-comprehensions.md).

```python
by_id = {u.id: u for u in users}
assert len(by_id) == len(users), f"{len(users) - len(by_id)} duplicate ids"
```

**★ Symptom — dedup with a set comprehension reorders the output, and a
downstream diff or golden-file test starts failing.** Cause: a set has no
order. Fix: `dict.fromkeys`, which preserves insertion order because the dict
does.

```python
unique = list(dict.fromkeys(names))   # not {n for n in names}
```

**★ Symptom — the all-or-nothing property of case 6 is relied on, and the
function still leaves partial state behind.** Cause: the comprehension is
rebinding a name that already exists, or the elements themselves have side
effects — the assignment is atomic, the element construction is not. Fix: bind
a fresh name and keep the element expression pure; if it writes to a database
or a file, that is a `for` loop with a transaction around it.

**★ Symptom — a comprehension is the right tool and still unreadable in
review.** Cause: the output expression, not the structure — a nested call chain
or a long conditional expression in front of the `for`. Fix: name the
transformation and keep the comprehension.

```python
def display_name(u): return f"{u.last.upper()}, {u.first}"
labels = [display_name(u) for u in users if u.is_active]
```

## Interview questions

**★ Q: Why were list comprehensions added when `map` and `filter` already
existed?**
PEP 202's own rationale: a more concise way to create lists where `map()`,
`filter()` and/or nested loops would otherwise be used. Concision was the goal;
the speed advantage over a `for`/`append` loop is a consequence of how the
bytecode ended up, not the motivation. It also removed the need for a `lambda`
in the common case, which is where `map` reads worst.

**★ Q: Give me a case where a comprehension is the only reasonable option.**
Anywhere a statement cannot appear — inside a dict or list display, as a call
argument, in a `return`, as a `default_factory`. A `for` statement has nowhere
to live in `{"ids": [...], "total": ...}`, so the loop version has to hoist
three accumulators out of the structure they belong to.

**★ Q: List comprehension or generator expression, and how do you decide?**
Does anything need the collection itself — indexing, `len`, a second pass, a
return value that outlives the call? Then a list. Is it being consumed once by
something that takes an iterable — `sum`, `any`, `join`, a `for` — then a
generator expression, which the HOWTO recommends outright for very large or
infinite streams because it never materialises the list.

**Q: Is there a correctness reason to prefer a comprehension over a loop?**
Yes, one: the target is bound only after the whole right-hand side has been
evaluated, so a comprehension that raises leaves the name untouched rather than
half-populated. If a caller retries, it cannot double-process the prefix. When
you *want* the prefix — skip the bad rows and keep the good ones — the loop with
`try`/`except` is the correct shape instead.

**Q: A colleague says comprehensions are always faster, so always use them. What
do you say?**
That the premise is roughly true for building a list and irrelevant to the
decision. The gap is a specialised opcode instead of a resolved method call plus
the PEP 709 inlining, which matters at a scale most code never reaches; and it
reverses for `map` with a `lambda`. Choose on whether a collection is being
built, then on readability. If the comprehension needs a `try`, an early exit,
or state carried across elements, no speed difference redeems it.

**Q: When does a two-clause comprehension stay acceptable?**
When the second `for` is a flatten of a genuinely two-level structure and reads
in the same order as the nested loops it replaces — `[cell for row in grid for
cell in row]`. When the second clause is really a join against another
collection, or a third clause appears, `itertools.chain.from_iterable` or a loop
says it better.

---

← Prev: [Three more tests](08b-three-more-tests.md) · Index: [Comprehensions](README.md) · Next → [`match` — structural pattern matching](../10-match-pattern-matching/README.md)
