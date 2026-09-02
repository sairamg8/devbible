---
title: "A generator expression computes nothing until asked, which is the whole point and also the whole problem"
sidebar_label: "5 · Generator expressions"
sidebar_position: 99
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Generator expressions](https://docs.python.org/3.14/reference/expressions.html#generator-expressions),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions),
> the [Glossary](https://docs.python.org/3.14/glossary.html#term-generator-expression),
> the Library Reference
> [`any`](https://docs.python.org/3.14/library/functions.html#any),
> [`all`](https://docs.python.org/3.14/library/functions.html#all),
> [`sum`](https://docs.python.org/3.14/library/functions.html#sum),
> and [PEP 289](https://peps.python.org/pep-0289/).
> Target: **CPython 3.14**.

**Wrapping a comprehension in parentheses does not build a container — it builds
a *generator iterator*, an object that remembers where it is and produces the
next value only when something calls `next()` on it. That buys constant memory
over an arbitrarily long input and lets `any`, `all`, `next` and `zip`
short-circuit without computing values nobody will look at. It costs you the
ability to iterate more than once, to know the length, or to index — and it
moves every exception in the body from the line where you wrote the expression to
the line where somebody consumed it.**

## What a genexp actually is

The reference is precise:

> *"At runtime, a generator expression evaluates to a generator iterator which
> yields the same values as the corresponding list comprehension."*

and gives the equivalent generator function:

```python
def make_generator_of_squares(iterator):
    for x in iterator:
        yield x ** 2

make_generator_of_squares(iter(range(10)))
```

That code is from the documentation, and it is the mental model to keep. Note
what it shows: the iterable is turned into an iterator *outside*, and passed in.
That is the same leftmost-iterable rule from
[scope](03-scope-and-the-target.md), and it is why `(x ** 2 for x in
nonexistent)` raises immediately while `(nonexistent for x in range(10))` does
not. That asymmetry has its own chunk —
[eager leftmost, lazy everything else](05b-eager-leftmost-and-lazy-rest.md).

The glossary's definition adds the practical framing:

> *"An expression that returns an iterator. It looks like a normal expression
> followed by a `for` clause defining a loop variable, range, and an optional
> `if` clause."*

## Memory: the reason PEP 289 exists

PEP 289's rationale:

> *"Many of the use cases do not need to have a full list created in memory.
> Instead, they only need to iterate over the elements one at a time."*

The comparison it draws:

```python
sum([x*x for x in range(10)])     # builds a 10-element list first
sum(x*x for x in range(10))       # builds nothing
```

At ten elements this is a curiosity. At ten million it is the difference between
a few hundred megabytes of list and a few hundred bytes of generator state. The
rule that follows: **if the only thing you do with a list comprehension is pass
it to a function that iterates it once, it should have been a generator
expression.** That covers `sum`, `min`, `max`, `any`, `all`, `sorted`, `set`,
`dict`, `tuple`, `"".join`, `itertools.chain` and every `for` loop.

The exceptions are the functions that need the whole thing anyway. `sorted(genexp)`
materialises internally — it has to, since sorting is not streaming — so the
genexp saves you nothing but costs nothing either. `len()` on a genexp is a
`TypeError`, and `random.choice` needs a sequence.

## Short-circuiting is the other half

`any` and `all` stop at the first decisive element, and with a generator
expression that means the rest is never computed:

```python
if any(is_fraudulent(o) for o in orders):    # stops at the first fraudulent order
    alert()

if all(r.status == "ok" for r in results):   # stops at the first non-ok
    proceed()
```

With a list comprehension inside, `[is_fraudulent(o) for o in orders]` runs
`is_fraudulent` on every order before `any` sees a single value. The
short-circuit still happens — it just happens after all the work. On an expensive
predicate that is the entire cost of the operation, and it is invisible in
review because the two lines differ by two characters.

`next` with a default is the same idea for "find the first":

```python
first_admin = next((u for u in users if u.is_admin), None)
```

The extra parentheses are required here because `next` takes a second argument;
see [the four forms](01-the-four-forms.md). This is the expression form of the
`for`/`else` search in
[`for`/`else`](../08-control-flow/03-for-else-and-while-else.md), and it stops
at the first match rather than scanning the whole list.

For the truthiness side of `any` and `all` — including the empty-sequence
answers and the "any of an empty list is False" trap — see
[`any` and `all`](../05-truthiness/04-any-and-all.md).

## Piping without building anything

Generator expressions compose. Each stage adds a small constant amount of state,
not a copy of the data:

```python
lines    = (line.rstrip("\n") for line in open_file)
nonblank = (line for line in lines if line)
records  = (parse(line) for line in nonblank)
valid    = (r for r in records if r.is_valid())

total = sum(r.amount for r in valid)
```

Nothing is read from the file until `sum` starts pulling, and at no point does
more than one line exist. Written as list comprehensions, that is four full
copies of the file in memory.

Two disciplines make this safe. First, the file must still be open when `sum`
runs — laziness moves the read, and a `with` block that closes before
consumption produces `ValueError: I/O operation on closed file`. Second, each
stage may only be consumed once; assigning `nonblank` to two different pipelines
gives the second one nothing.

## `list(genexp)` versus a list comprehension

They produce equal lists. They are not the same code:

```python
[f(x) for x in xs]        # inlined since 3.12; appends directly
list(f(x) for x in xs)    # builds a generator, then the list constructor drains it
```

The second creates a generator object with its own frame, then resumes that frame
once per element while `list` pulls. The first, since PEP 709, has no frame at
all. There is no situation in which `list(genexp)` is preferable to the
comprehension when both are available — it is strictly more machinery for the
same result. Where `list(...)` *is* right is when the generator already exists as
a variable, or comes from a generator function, or when the expression is a
pipeline you built in stages.

The mirror-image mistake is more common and more expensive: passing a list
comprehension where a genexp belongs.

```python
sum([len(r.items) for r in rows])     # builds the whole list of ints first
sum(len(r.items) for r in rows)       # streams
```

## `tuple`, `set`, `dict` from a genexp

```python
tuple(x * 2 for x in xs)
set(x.owner for x in xs)              # or {x.owner for x in xs}
dict((x.id, x) for x in xs)           # or {x.id: x for x in xs}
```

In the second and third cases the brace form is better: it is shorter, it says
what type it builds at the start of the line rather than the end, and it does not
create an intermediate generator. `dict((k, v) for ...)` in particular also
allocates a tuple per element that the dict comprehension does not.

## Gotchas

**★ Symptom — a memory spike from a line that looks like a simple aggregate.**
Cause: a list comprehension inside `sum`, `max`, `any` or `"".join`; the list is
fully built before the function sees anything. Fix: drop the brackets. The
generator expression is the same characters minus two, and it is what PEP 289
was added for.

**★ Symptom — an expensive predicate runs for every element even though `any`
should have stopped early.** Cause: `any([p(x) for x in xs])` — the comprehension
completes before `any` is called, so the short-circuit saves nothing. Fix:
`any(p(x) for x in xs)`.

**★ Symptom — `TypeError: object of type 'generator' has no len()`.** Cause: a
generator has no length; it does not know how many values it will produce until
it produces them. Fix: `sum(1 for _ in gen)` if you must count — which consumes
it — or build a list if you needed the length and the data.

**Symptom — `ValueError: I/O operation on closed file` from a line far from any
file handling.** Cause: a generator expression over a file object escaped the
`with` block and was consumed after the file closed. Fix: consume inside the
block (`return list(...)`), or return the file-handling generator *function* so
the caller drives it while the `with` is still on its stack.

**Symptom — `TypeError: 'generator' object is not subscriptable`.** Cause:
indexing a genexp. Fix: `next(itertools.islice(gen, n, None))` for the nth item
without materialising, or a list if you need random access at all.

**Symptom — a genexp assigned to a name and returned from a function produces
nothing at the call site.** Cause: something already consumed it — often a
`log.debug(f"{sum(gen)} rows")` line that ran first. Fix: return a list, or
return a generator *function* the caller can call again; and never consume a
generator for logging.

**Symptom — `sorted(x for x in xs)` uses as much memory as the list version.**
Cause: sorting cannot stream; `sorted` materialises its input. Fix: nothing to
fix, but do not expect a genexp to make a sort memory-cheap — if the data does
not fit, you need an external sort or a heap.

**Symptom — a pipeline of generator expressions produces nothing at all on the
second run of a request handler.** Cause: one of the stages was created at module
import and is shared; it was exhausted on the first request. Fix: build
pipelines inside the function that consumes them, never at module level.

**Symptom — the generator's repr in a log says `<generator object <genexpr>>`
instead of the data.** Cause: something logged the generator itself rather than
its contents, and formatting it does not consume it. Fix: `list(gen)` at the log
site — but note that this consumes it and the real consumer will then see
nothing.

## Interview questions

**★ Q: When should you use a generator expression instead of a list
comprehension?**
Whenever the result is consumed once, by one consumer, and you do not need
`len`, indexing or a second pass. That covers everything passed to `sum`, `max`,
`any`, `all`, `join`, `set`, `dict`, `sorted` and a `for` loop. The two wins are
memory — PEP 289's motivation, *"they only need to iterate over the elements one
at a time"* — and short-circuiting, which only exists if the values are produced
lazily.

**★ Q: What does `any([p(x) for x in xs])` cost that `any(p(x) for x in xs)`
does not?**
It calls `p` on every element regardless of the answer, and it allocates a list
of booleans. `any` short-circuits either way, but in the first version there is
nothing left to short-circuit — the work already happened during argument
evaluation.

**★ Q: Is `list(x for x in xs)` ever better than `[x for x in xs]`?**
No, when you have the choice. Since 3.12 the comprehension is inlined and has no
frame, while the genexp version builds a generator object and resumes its frame
once per element. `list(...)` is the right call when the generator already
exists — from a generator function, or as a pipeline you assembled in stages.

**Q: How do you get the first matching element without scanning the whole
sequence?**
`next((x for x in xs if p(x)), None)`. The genexp is lazy so it stops at the
first match, and the default avoids `StopIteration`. The parentheses around the
genexp are mandatory because `next` has a second argument.

**Q: Why does a generator expression have no `len()`?**
Because it has not produced its values yet and cannot know how many there will
be — the underlying iterable may itself be lazy, infinite, or filtered by a
predicate whose results depend on data not yet read. Counting requires
consuming: `sum(1 for _ in gen)`.

**Q: What is the memory profile of chaining four generator expressions?**
Constant in the size of the data and linear in the number of stages: each stage
holds one frame and the value currently in flight. That is the argument for
building pipelines out of genexps rather than intermediate lists — but it
requires that the source stays valid (an open file, a live connection) for the
whole consumption.

**Q: Does a generator expression evaluate anything at the moment you write it?**
Yes — exactly one thing: the leftmost iterable, plus the `iter()` call on it. The
reference says errors from that expression are raised *"at the point where the
generator expression is defined, rather than at the point where the first value
is retrieved"*. Everything else is deferred. That is the subject of the next
chunk.

---

← Prev: [What inlining changed](04b-what-inlining-changed.md) · Index: [Comprehensions](README.md) · Next → [Eager leftmost, lazy rest](05b-eager-leftmost-and-lazy-rest.md)
