---
title: "Why a comprehension beats a for-append loop, why map with a C function can beat both, and why map with a lambda never does"
sidebar_label: "7 · Performance"
sidebar_position: 104
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 709](https://peps.python.org/pep-0709/),
> [What's New in Python 3.12](https://docs.python.org/3.14/whatsnew/3.12.html#pep-709-comprehension-inlining),
> the Library Reference
> [`map`](https://docs.python.org/3.14/library/functions.html#map),
> [`filter`](https://docs.python.org/3.14/library/functions.html#filter),
> [`dis`](https://docs.python.org/3.14/library/dis.html),
> [`timeit`](https://docs.python.org/3.14/library/timeit.html),
> and [PEP 289](https://peps.python.org/pep-0289/).
> Target: **CPython 3.14**.

**A list comprehension is faster than the equivalent `for` loop with `append`
for one structural reason: the comprehension appends with a dedicated opcode
while the loop performs an attribute lookup and a method call on every
iteration. `map` can beat both when the function is implemented in C, because
the per-element work then happens without executing any Python bytecode — and
loses to both when the function is a `lambda`, because it reintroduces the
Python call the comprehension had eliminated. None of these differences is
large enough to matter unless the loop is hot, and the only honest way to
establish them for your code is `timeit`.**

## The structural difference: `LIST_APPEND` versus a method call

Both of these produce the same list:

```python
out = []
for x in xs:
    out.append(f(x))

out = [f(x) for x in xs]
```

The loop does three things per element that the comprehension does not: look up
the attribute `append` on `out`, build a bound method object, and perform a call.
The comprehension emits the `LIST_APPEND` opcode instead, which appends directly
to a list held on the stack. PEP 709's disassembly listings show it — both the
pre-3.12 and post-3.12 bytecode contain `LIST_APPEND` in the comprehension's
inner loop, and neither contains a `LOAD_METHOD`/`CALL` pair for `append`.

You can confirm the difference for any pair of snippets yourself, and this is the
right habit:

```python
import dis
dis.dis("out = [f(x) for x in xs]")
```

The half-measure that captures most of the win in a loop you cannot convert is
hoisting the bound method:

```python
out = []
append = out.append          # one lookup instead of len(xs) lookups
for x in xs:
    append(f(x))
```

That removes the attribute lookup but keeps the call. It is a real technique for
a hot loop that cannot be a comprehension, and it is unreadable enough that it
needs a comment saying why.

## What PEP 709 added on top

Before 3.12, the comprehension had an offsetting cost the loop did not: a
function object allocated and a frame pushed and popped, once per *execution* of
the comprehension. PEP 709 removed it, reporting *"up to 2x faster for a
microbenchmark of a comprehension alone"* and *"an 11% speedup for one sample
benchmark derived from real-world code that makes heavy use of comprehensions"*.

Read the shape of that: the removed cost was per-comprehension-execution, not
per-element. So the gain is largest for **small comprehensions executed many
times** — a comprehension inside a function called in a loop — and nearly
invisible for one comprehension over a million rows. That is also why the
whole-program figure is 11% and not 100%.

The full list of what inlining changed, including the observable side effects, is
in [what inlining changed](04b-what-inlining-changed.md).

## `map` and the C-function case

`map` returns an iterator that applies the function to each item. When the
function is implemented in C — `str`, `int`, `len`, `ord`, `operator.itemgetter`,
a `bytes` method — `map` performs the per-element call at the C level. The
comprehension `[str(x) for x in xs]` executes Python bytecode for every element:
load `str`, load `x`, call, append.

```python
list(map(str, xs))              # per element: a C-level call
[str(x) for x in xs]            # per element: bytecode, then a call
```

The mechanism is clear; the *ordering* is a measurement claim, not one the
documentation makes. CPython's specialising interpreter has narrowed the gap
substantially since 3.11, and the answer depends on the function, the data and
the version. Treat "`map` with a C function may be faster" as a hypothesis to
test with `timeit`, not a rule.

The lambda case is the one where the mechanism decides it:

```python
list(map(lambda x: x * 2, xs))  # per element: a full Python function call
[x * 2 for x in xs]             # per element: one BINARY_OP, no call
```

Here `map` cannot win. The comprehension inlines the expression and makes no call
at all; `map` must call a Python function per element, which means building a
frame per element — exactly the cost PEP 709 spent effort removing from
comprehensions. **`map` with a `lambda` is strictly more work than the equivalent
comprehension, and it also reads worse.** The same applies to
`filter(lambda x: ..., xs)` versus a comprehension's `if` clause.

That gives a clean rule:

| Shape | Prefer |
|---|---|
| `map(c_function, xs)` | either; `map` is a candidate, measure it |
| `map(lambda ..., xs)` | the comprehension, always |
| `filter(None, xs)` | `filter` — it is shorter and there is no predicate to write |
| `filter(lambda ..., xs)` | the comprehension's `if` clause |
| function does not exist yet | the comprehension; do not invent a lambda to feed `map` |

## `list(genexp)` versus a list comprehension

```python
[f(x) for x in xs]           # inlined, no frame, LIST_APPEND
list(f(x) for x in xs)       # a generator object with a frame, resumed per element
```

The second creates a generator, and `list` then drives it: each element requires
resuming the generator's frame, yielding, and returning to `list`. Since PEP 709
the comprehension has no frame at all. There is no case where `list(genexp)` is
preferable when both spellings are available. Where `list(...)` belongs is around
a generator that already exists — from a generator function, or as the end of a
pipeline built in stages.

The reverse error is the expensive one:

```python
sum([x.amount for x in rows])     # materialises a list of every amount
sum(x.amount for x in rows)       # streams
```

Here the *list* version is worse in both time and memory, and on large data the
memory is what kills the process. The rule from
[generator expressions](05-generator-expressions.md) applies: if the result is
consumed exactly once by one function, drop the brackets.

## Gotchas

**★ Symptom — rewriting a loop as a comprehension gave a much smaller
improvement than expected.** Cause: the win is the removal of an attribute lookup
and method call per element, which is a small constant. Everything else about the
loop is unchanged. Fix: expect a constant-factor gain, and look for an
algorithmic one if you need more.

**★ Symptom — `map` with a lambda was introduced "for speed" and is slower.**
Cause: `map` calls a Python function per element, which is the frame-per-element
cost a comprehension avoids by inlining the expression. Fix: use the
comprehension; `map` is only a performance candidate when the function is
implemented in C.

**★ Symptom — a comprehension got faster after upgrading to 3.12 in one place and
not another.** Cause: PEP 709 removed a per-*execution* cost. A comprehension run
a million times over three elements benefits enormously; one run once over a
million elements barely notices. Fix: none needed — but do not generalise the
speedup you saw in one place to another.

**Symptom — `list(genexp)` was chosen over a comprehension for "memory".** Cause:
a misapplied rule. `list(...)` materialises the whole thing regardless, so the
memory is identical and the generator adds a frame and per-element resumption.
Fix: use the comprehension; the memory win only exists if you never build the
list.

**Symptom — a benchmark says the comprehension is slower than the loop.** Cause:
usually the benchmark measures something else — a warm versus cold cache, a
different element expression, or an `append` that was already hoisted to a local.
Fix: `dis` both versions and check they differ only where you think they do.

**Symptom — the hoisted-`append` trick made the code slower.** Cause: on a short
loop the extra local and the lost readability buy nothing measurable; the trick
only pays when the loop body is trivial and the iteration count is large. Fix:
delete it. It is a last resort for code that cannot be a comprehension.

**Symptom — `map` beat the comprehension on 3.9 and lost on 3.14, with no code
change.** Cause: the specialising interpreter added in 3.11 narrowed the gap for
bytecode-level calls, and PEP 709 removed the comprehension's frame in 3.12. Fix:
re-measure on the interpreter you deploy; a performance answer has a version
attached to it.

## Interview questions

**★ Q: Why is a list comprehension faster than a `for` loop with `append`?**
Because it appends with a dedicated opcode. The loop must look up the `append`
attribute on the list, build a bound method and call it, once per element; the
comprehension emits `LIST_APPEND`, which operates on a list held on the stack.
Since 3.12 the comprehension also has no function object and no frame, because
PEP 709 inlines it. The difference is a constant factor and is almost never why a
piece of code is slow.

**★ Q: When can `map` beat a comprehension, and when can it not?**
It can when the function is implemented in C — `map(str, xs)` does the
per-element call without executing Python bytecode, while the comprehension runs
bytecode per element. It cannot when the function is a `lambda`: `map` then makes
a Python function call per element, which is exactly the frame-per-element cost
the comprehension avoids by inlining the expression. And the C case is a
measurement claim, not a documented guarantee — the specialising interpreter has
narrowed it. Measure with `timeit`.

**★ Q: `list(x for x in xs)` or `[x for x in xs]` — which and why?**
The comprehension. `list(genexp)` builds a generator object with its own frame
and resumes it once per element; since PEP 709 the comprehension has no frame at
all. `list(...)` is right only when the generator already exists — from a
generator function or a staged pipeline.

**Q: How much faster did comprehensions get in 3.12?**
PEP 709 reports *"up to 2x faster for a microbenchmark of a comprehension
alone"* and *"an 11% speedup for one sample benchmark derived from real-world
code"*. Those are the project's own numbers for their own benchmarks. The
removed cost was per execution of the comprehension, so the benefit scales with
how *often* comprehensions run, not with how much data they process.

**Q: Should you use `filter` instead of an `if` clause?**
Only for `filter(None, xs)`, where there is no predicate to write and the
documentation gives the exact equivalence. With a lambda, `filter` pays a Python
call per element for what the comprehension does with inline bytecode.

**Q: Does a comprehension preallocate the list?**
No. It cannot know how many elements it will produce — a filter may reject any
of them and the source may be lazy — so the list grows by CPython's usual
over-allocating strategy, exactly as `append` does. `list(sized_iterable)` *can*
size up front, which is one small reason `list(xs)` beats `[x for x in xs]` for a
plain copy.

---

← Prev: [Merging, fromkeys and hashability](06b-merging-fromkeys-and-hashability.md) · Index: [Comprehensions](README.md) · Next → [What actually costs](07b-what-actually-costs.md)
