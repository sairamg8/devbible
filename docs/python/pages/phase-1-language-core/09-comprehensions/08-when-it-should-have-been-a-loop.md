---
title: "The honest line: six tests that say this comprehension should have been a loop, and what the loop looks like"
sidebar_label: "8 · When it should be a loop"
sidebar_position: 106
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> [The `break` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement),
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [Expression statements](https://docs.python.org/3.14/reference/simple_stmts.html#expression-statements),
> and the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions).
> Target: **CPython 3.14**.

**A comprehension is an expression that produces a container. Every property of
it follows from that: it has no statements, so no `try`, no `break`, no
intermediate variable and no logging line; it always produces a value, so
discarding that value means you wrote a loop with extra allocation; and it has
no indentation, so nesting is invisible. When any of those constraints starts
costing you, the comprehension has stopped being the shorter way to say the
thing and become a way to say it badly. Here are the six tests, each with the
loop it should have been.**

## Test 1 — the value is discarded

```python
[send_email(u) for u in users]        # a loop, written wrong
```

This builds a list of `len(users)` return values — usually `None` — and throws it
away. It allocates for no reason, and more importantly it tells the reader
"this produces a collection", which is false. The comprehension form also invites
a future maintainer to wonder what the list was for.

```python
for u in users:
    send_email(u)
```

That is not a stylistic preference. A comprehension whose value is unused is a
category error: you used an expression form for a statement's job. Linters flag
it (`flake8-bugbear` B018 and similar), and they are right to.

The same applies to a comprehension used purely for its side effects on
something else:

```python
[cache.set(k, v) for k, v in items]    # no
[results.append(f(x)) for x in xs]     # no, twice — it also builds a list of None
```

## Test 2 — you need `try`/`except`

There is no way to handle an exception inside a comprehension. If one element
raises, the whole comprehension dies and every element already computed is lost.

```python
records = [parse(line) for line in lines]     # one malformed line kills all of it
```

The only "fix" available inside the expression is to move the failure into a
function, which is a real technique but changes the design:

```python
def try_parse(line):
    try:
        return parse(line)
    except ValueError:
        return None

records = [r for r in map(try_parse, lines) if r is not None]
```

That works, and it is worth knowing. But notice what it cost: a named function
whose only purpose is to convert an exception into a sentinel, plus a filter to
remove the sentinel, plus the loss of the *reason* each line failed. When you
need the reason — and in data ingestion you always need the reason — write the
loop:

```python
records, errors = [], []
for lineno, line in enumerate(lines, 1):
    try:
        records.append(parse(line))
    except ValueError as exc:
        errors.append((lineno, str(exc)))
```

Now a bad line is reported with its number and its message, and the good lines
survive. No comprehension expresses that.

## Test 3 — you need to stop early

`break` is a statement. A comprehension has no statements, so it always consumes
its entire source.

```python
first_match = [x for x in huge if p(x)][0]     # scans everything, then indexes
```

That scans the whole of `huge` and then throws away all but one element — and
raises `IndexError` rather than something meaningful when there is no match. The
expression-level answer is a generator expression with `next`, which does stop
early:

```python
first_match = next((x for x in huge if p(x)), None)
```

That is genuinely better and is not a loop. But when the stopping condition is
more than a predicate on one element — when it depends on an accumulator, or on
how many you have collected, or on something outside the sequence — the answer
is `break`:

```python
selected = []
budget = 1000
for item in items:
    if budget < item.cost:
        break
    selected.append(item)
    budget -= item.cost
```

`itertools.takewhile` covers a subset of this (stop at the first failure of a
predicate), and `islice` covers "the first n". Between them they take most of
the easy cases; what they do not take is anything where the condition depends on
state you are accumulating, which is Test 4.

## Gotchas

**★ Symptom — a linter flags a comprehension whose result is not assigned to
anything.** Cause: it is a loop written as an expression; it allocates a list of
return values and discards it. Fix: `for` statement. There is no case where the
comprehension form is preferable when the value is unused.

**★ Symptom — one bad row in a file aborts the entire import and nothing is
saved.** Cause: an exception inside a comprehension propagates out and every
element computed so far is lost, because the list is never bound. Fix: a loop
with `try`/`except` inside it, collecting successes and failures separately —
which also gives you the line number and the reason.

**★ Symptom — a "find the first match" comprehension scans a large sequence
entirely and then raises `IndexError`.** Cause: `[...][0]` computes the whole
list before indexing, and a comprehension cannot `break`. Fix:
`next((x for x in xs if p(x)), None)`, which stops at the first match and has a
defined answer for "no match".

**Symptom — a `try` wrapped *around* a comprehension catches the failure but
loses which element caused it.** Cause: the exception propagates out of the
expression with no indication of how far it got, and the partial result is
unreachable because nothing was bound. Fix: move the `try` inside a loop, or
inside a helper the comprehension calls per element.

**Symptom — a "safe" comprehension built on a helper that swallows exceptions
silently drops rows in production.** Cause: the sentinel-and-filter pattern from
Test 2 turns every failure into an absence, and absences do not get logged. Fix:
have the helper return a result object rather than `None`, and partition it —
or write the loop, which is shorter than the result object.

**Symptom — `takewhile` was used to replace a `break` and stopped too early.**
Cause: `itertools.takewhile` stops at the first element failing the predicate; it
does not skip and continue. Fix: if you wanted "skip the bad ones and keep
going", that is a filter, not a `takewhile`; if you wanted to stop on a condition
that depends on accumulated state, that is a `break`.

## Interview questions

**★ Q: When should a comprehension be a loop instead?**
Six tests, three in this chunk and three in the next. When the value is
discarded — that is a loop written as an expression. When you need
`try`/`except`, because a comprehension has no statements and one bad element
loses all the work. When you need to stop early, because there is no `break`
(though `next(genexp, default)` covers the simple case). And then: when the body
wants intermediate names, when there are more than two `for` clauses, and when it
accumulates state across elements.

**★ Q: Why can't you use `try`/`except` inside a comprehension?**
Because a comprehension is an expression and `try` is a statement; there is no
statement position anywhere in the grammar. The available workaround is a helper
function that catches internally and returns a sentinel, then a filter to remove
the sentinel — which costs you the failure reason and the element that caused
it. When those matter, and in data processing they always do, write the loop.

**★ Q: How do you find the first matching element without scanning everything?**
`next((x for x in xs if p(x)), None)`. The generator expression is lazy, so it
stops at the first match, and the default makes "no match" a value rather than a
`StopIteration`. `[x for x in xs if p(x)][0]` scans the whole sequence and then
raises `IndexError` when there is none.

**Q: Is `[f(x) for x in xs]` with the result unused ever acceptable?**
No. It allocates a list of return values to discard, and it misleads the reader
about what the line produces. If you want the side effects, write
`for x in xs: f(x)`. Linters flag the comprehension form for exactly this reason.

**Q: What do `takewhile` and `islice` cover, and what do they not?**
`takewhile` covers "stop at the first element that fails this predicate" and
`islice` covers "the first n". Between them they replace most simple `break`s.
Neither covers a stop condition that depends on state you are accumulating as you
go, which is where `break` remains the only answer.

**Q: A comprehension raised halfway through — can you recover what it built?**
No. The list under construction is on the interpreter's stack and is never bound
to a name, so nothing references it after the exception unwinds. That is the
strongest practical reason to put the `try` inside a loop rather than around a
comprehension.

---

← Prev: [What actually costs](07b-what-actually-costs.md) · Index: [Comprehensions](README.md) · Next → [Three more tests](08b-three-more-tests.md)
