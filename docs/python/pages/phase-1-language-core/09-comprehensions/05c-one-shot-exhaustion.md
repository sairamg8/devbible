---
title: "An exhausted generator does not raise — it looks exactly like an empty container, which is why a function that iterates twice returns a plausible wrong answer"
sidebar_label: "5c · One-shot exhaustion"
sidebar_position: 101
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Glossary — iterator](https://docs.python.org/3.14/glossary.html#term-iterator),
> [Iterator Types](https://docs.python.org/3.14/library/stdtypes.html#iterator-types),
> the Library Reference
> [`itertools.tee`](https://docs.python.org/3.14/library/itertools.html#itertools.tee),
> [`itertools.islice`](https://docs.python.org/3.14/library/itertools.html#itertools.islice),
> [`typing`](https://docs.python.org/3.14/library/typing.html),
> and the Language Reference
> [Generator expressions](https://docs.python.org/3.14/reference/expressions.html#generator-expressions).
> Target: **CPython 3.14**.

**A generator expression can be iterated exactly once, and the second attempt
does not fail — it produces nothing. That silence is what makes this the most
expensive property of generator expressions in production code: an aggregate
returns the right total and a count of zero, a validation pass consumes the data
the processing pass was going to use, and every test that passes a list instead
of a generator keeps passing. The defence is a decision at each function
boundary about whether you accept one pass or require a sequence, made
explicitly rather than by accident.**

## One-shot: exhaustion is silent

The glossary spells out the failure mode better than any explanation:

> *"When no more data are available a `StopIteration` exception is raised
> instead. At this point, the iterator object is exhausted and any further calls
> to its `__next__()` method just raise `StopIteration` again. […] A container
> object (such as a `list`) produces a fresh new iterator each time you pass it
> to the `iter()` function or use it in a `for` loop. Attempting this with an
> iterator will just return the same exhausted iterator object used in the
> previous iteration pass, **making it appear like an empty container**."*

That last clause is the bug. A generator you have already consumed does not raise
when you use it again — it behaves exactly like an empty sequence:

```python
def summarise(records):
    total = sum(r.amount for r in records)
    count = len([r for r in records])          # zero, if records is a generator
    return total, count
```

`summarise(list_of_records)` works. `summarise(genexp)` returns the right total
and a count of zero. No exception, no warning, wrong answer. This is the single
most common way generator expressions cause incidents.

Three shapes of the same bug:

```python
# 1. a function that iterates twice
def report(rows):
    header = max(len(r.name) for r in rows)
    for r in rows:                             # nothing
        print(r.name.ljust(header))

# 2. a check followed by a use
if any(r.invalid for r in rows):
    return errors_for(rows)                    # rows is partly or fully spent

# 3. a genexp stored on an object and used by two callers
self.pending = (t for t in tasks if not t.done)
```

## Defending against it

**Materialise at the boundary.** A public function that accepts an iterable and
needs more than one pass should say so by converting:

```python
def summarise(records):
    records = list(records)        # explicit, and now the contract is clear
    ...
```

That is honest: it declares the memory cost at the point where the requirement
is created. Do it once, at the top, not defensively at each use.

**Or make one pass.** Usually the two passes can be one:

```python
def summarise(records):
    total = count = 0
    for r in records:
        total += r.amount
        count += 1
    return total, count
```

**`itertools.tee` is a trap dressed as a solution.** It gives you two independent
iterators from one, but it does so by buffering: if one branch runs ahead, the
buffer holds every element in between. Two branches consumed at very different
rates use as much memory as a list, with more indirection. `tee` is right when
the branches advance roughly together and wrong as a general "make it
re-iterable" tool.

**Accept a callable, not a generator.** If the caller may need to re-run the
pipeline, pass the function that builds it:

```python
def report(make_rows):
    rows = make_rows()
    ...
    for r in make_rows():          # a fresh pipeline
```

**Type-hint the requirement.** `Sequence[Row]` in the signature tells both the
reader and the type checker that a one-shot iterator is not acceptable, while
`Iterable[Row]` promises you will make one pass — and then you must.

## Gotchas

**★ Symptom — a count, a sum or a `max` over the same argument returns zero,
empty or raises `ValueError: max() iterable argument is empty` on the second
use.** Cause: the argument is a generator and the first pass exhausted it; the
glossary notes an exhausted iterator makes *"it appear like an empty
container"*. Fix: `list(...)` at the top of the function, or restructure to a
single pass.

**★ Symptom — a validation pass reports no errors and the processing pass then
finds no rows.** Cause: `any(r.invalid for r in rows)` consumed `rows` — fully,
if nothing was invalid. Fix: materialise before validating, or fold the
validation into the single processing pass.

**★ Symptom — the bug does not reproduce in tests.** Cause: the test fixture is a
list, which produces a fresh iterator on every pass; only the production caller
passes a generator. Fix: write at least one test that passes `iter(fixture)` or a
genexp, which is the cheapest way to catch every double-iteration bug in a
codebase.

**★ Symptom — `itertools.tee` "fixed" a double-iteration bug and then memory use
went up.** Cause: `tee` buffers every element between the fastest and slowest
branch. Fix: if the branches do not advance together, materialise a list
instead — the same memory, less machinery, and obvious in review.

**Symptom — a generator built at module import yields nothing after the first
request.** Cause: it was consumed once and is shared across every caller. Fix:
build it lazily inside the function, or store a callable rather than a
generator.

**Symptom — `for` over a generator, then `break`, then `for` again, and the
second loop resumes rather than restarting.** Cause: a generator has no reset;
`break` leaves it partly consumed and the next `for` continues from there. Fix:
that resumption is sometimes exactly what you want — it is how the
"read the header, then hand the rest to the body parser" idiom works — but if you
meant to restart, you need a fresh generator.

**Symptom — passing a genexp to a library function works in tests with a list
and fails in production.** Cause: the library iterates more than once, and the
test fixture was a list. Fix: read the library's parameter type; if the
annotation says `Sequence`, give it one, and do not treat `Iterable` as
permission to pass a generator to something whose implementation you have not
read.

**Symptom — `RuntimeError: generator already executing`.** Cause: the same
generator is being advanced from two places at once — two threads, or a
re-entrant call where the element expression itself pulls from the same
generator. Fix: do not share one generator between concurrent consumers; give
each its own.

**Symptom — `sum()` over a generator returns 0 and no one notices for a
month.** Cause: an empty generator sums to 0, which is a legitimate total, so
there is no signal. Fix: where a zero result is meaningful, count separately in
the same pass and assert on the count — the emptiness must be detected, not
inferred from the aggregate.

**Symptom — a generator wrapped in `list()` twice returns data then an empty
list.** Cause: `list(gen)` consumes it; the second `list(gen)` sees an exhausted
iterator. Fix: assign the result of the first `list()` and reuse the list.

## Interview questions

**★ Q: What happens if a function iterates its argument twice and you pass a
generator expression?**
The first pass gets all the data and the second gets nothing — no exception. The
glossary describes an exhausted iterator as making *"it appear like an empty
container"*. That is why an aggregate can return a plausible total with a count
of zero. Fix by materialising at the boundary with `list(...)` or by making a
single pass.

**★ Q: How do you make a generator re-iterable?**
You do not — you either materialise it into a list, or you keep the *recipe*
rather than the generator: a generator function or a callable that builds a fresh
pipeline on each call. `itertools.tee` gives two iterators from one, but it
buffers between them, so it only helps when both branches advance at similar
rates.

**★ Q: How would you design a function's signature so this cannot happen?**
Annotate what you actually require. `Iterable[T]` is a promise that you will make
exactly one pass, and if you annotate it you must keep it. If you need more than
one pass, annotate `Sequence[T]` — or accept `Iterable[T]` and convert with
`list()` on the first line, which makes the memory cost explicit at the point
where the requirement is introduced. The wrong answer is accepting `Iterable` and
quietly iterating twice.

**Q: Why is a list not affected?**
Because a list is a *container*, not an iterator. The glossary: *"A container
object (such as a `list`) produces a fresh new iterator each time you pass it to
the `iter()` function or use it in a `for` loop."* An iterator returns itself
from `__iter__`, so re-iterating gives you the same spent object.

**Q: Is a generator expression thread-safe?**
No. Two threads pulling from one generator interleave its state; CPython raises
`ValueError: generator already executing` for the re-entrant case, and the
glossary notes that free-threaded CPython does not guarantee thread-safe
behaviour of iterator operations at all. Sharing one generator across threads is
a design error rather than something to make safe — give each consumer its own.

**Q: When is exhausting a generator partway through actually useful?**
When the stream has structure. Read the header lines with `itertools.islice` or a
bounded loop, then hand the *same* iterator to the body parser, which resumes
exactly where the header stopped. That resumption is a property no re-iterable
container gives you, and it is the reason `iter(f)` on a file is more useful than
`f.readlines()`.

**Q: You have a genexp and need both the first element and the rest. How?**
`first = next(gen)` and then use `gen` for the remainder — the generator has
already advanced past the first element, which is precisely what you want. If
you need the first element *and* a full pass, you need `itertools.chain([first],
gen)` to put it back, or a list.

---

← Prev: [Eager leftmost, lazy rest](05b-eager-leftmost-and-lazy-rest.md) · Index: [Comprehensions](README.md) · Next → [Dict and set comprehensions](06-dict-and-set-comprehensions.md)
