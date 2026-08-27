---
title: "Immortal objects, free-threading, and why every one of these caches is a trap"
sidebar_label: "4b · Immortal objects"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [PEP 683 — Immortal Objects](https://peps.python.org/pep-0683/) (Final, 3.12),
> [PEP 779 — Criteria for supported status for free-threaded Python](https://peps.python.org/pep-0779/)
> (Final, 3.14),
> [`sys.getrefcount`](https://docs.python.org/3.14/library/sys.html#sys.getrefcount)
> and the [glossary entry for *immortal*](https://docs.python.org/3.14/glossary.html),
> plus CPython 3.14's `should_intern_string` in
> [`Objects/codeobject.c`](https://github.com/python/cpython/blob/3.14/Objects/codeobject.c)
> for the free-threaded build's interning rule. Target: **CPython 3.14**.

**Since 3.12, some objects have a reference count that the runtime never touches
— not to save memory, but to stop a read of `None` from writing to memory on
every core in the machine. That is the last of CPython's identity-affecting
implementation details, and this chunk closes the topic by putting all of them
side by side and drawing the only conclusion that matters: none of them is a
guarantee, and every one of them makes a wrong `is` pass its tests.**

This chunk closes [7 · Everything is an object](README.md) and continues
[4 · Caching and interning](04-caching-and-interning.md).

## Immortal objects (PEP 683)

Since 3.12, some objects are **immortal**: their reference count is set to a magic
value and never changes, so the runtime never has to write to them.

The objects covered are the ones every line of Python touches: `None`, `True`,
`False`, `Ellipsis`, `NotImplemented`, the static type objects (`int`, `str`,
`list`, …), and the runtime's static global objects — which in CPython's
implementation includes the small-integer table and the statically allocated
interned strings.

The motivation is the CPU cache, not memory. Under refcounting, merely *reading*
`None` writes to the memory holding `None` — an increment and later a decrement.
On a many-core machine that turns a read-only shared object into a cache line
ping-ponging between cores. Freezing the refcount removes the write entirely.
PEP 683 is a direct prerequisite for the free-threaded build (PEP 703, officially
supported in 3.14 per [PEP 779](https://peps.python.org/pep-0779/)), where that
contention would otherwise be crippling.

The visible consequence is in `sys.getrefcount`:

> *"Note that the returned value may not actually reflect how many references to
> the object are actually held. For example, some objects are immortal and have a
> very high refcount that does not reflect the actual number of references.
> Consequently, do not rely on the returned value to be accurate, other than a
> value of 0 or 1."*
>
> *"Changed in version 3.12: Immortal objects have very large refcounts that do
> not match the actual number of references to the object."*

And PEP 683 itself says the magic value is not a number you may depend on: *"the
refcount value of immortal objects is an implementation detail"* that may change
between versions.

**What free-threading changes**, at the level this phase needs: the free-threaded
build cannot use a plain non-atomic increment for every reference, so it combines
several strategies — immortalization for the objects above, biased reference
counting for objects that stay on one thread, and deferred reference counting for
some others. The practical consequences for ordinary code are that
`sys.getrefcount` is even less meaningful, that all string constants are interned
and immortalized (so string identity behaviour differs from the GIL build), and
that any code depending on `__del__` firing at a precise moment is on thinner ice
than it already was. Topic **02 · The GIL** *(not written yet)* is where the
free-threaded build is covered properly.

## The honest conclusion

Read the four sections back as a list of *sources of accidental identity*:

| Mechanism | Makes these the same object | Scope of the guarantee |
|---|---|---|
| Small-integer table | ints in `-5..256` | CPython only, range unspecified |
| Compiler const cache | equal constants of the same type | one compilation unit, CPython only |
| Constant folding | results of constant expressions, within size limits | CPython only, limits unspecified |
| String interning | ASCII identifier-shaped string constants | CPython only, differs by build |
| Immortal objects | `None`, `True`, `False`, static types | 3.12+, magic value unspecified |

Not one row has a stability guarantee. Every row makes `is` return `True` in
circumstances where `==` was what you meant.

That is the actual danger, and it is worth stating flatly: **these caches do not
cause bugs, they conceal them.** A `is` where `==` belonged is already wrong the
moment it is written. Interning is what makes it pass code review, pass the unit
tests, pass staging with fixture data, and then fail against a production payload
whose strings came off a socket. The failure has no relationship in time or in
place to the mistake, which is the worst property a bug can have.

The defence is mechanical, not intellectual:

```bash
python -W error::SyntaxWarning -m compileall src/     # turn the compiler's warning into a failure
ruff check --select F632 src/                          # "use of is with a literal"
```

and one rule you never negotiate: **`is` for `None`, for `True`/`False` when you
mean the singleton, and for sentinels you created. `==` for everything else.**

## Gotchas

**Symptom:** identity behaviour of string constants differs between two builds of the same Python version
**Cause:** the free-threaded build interns and immortalizes *all* string constants; the default GIL build interns only ASCII identifier-shaped ones
**Fix:** treat string identity as unspecified. This is the clearest available proof that it is not a language-level property — the same source, the same version, two answers

**Symptom:** `sys.getrefcount(None)` returns an absurd number
**Cause:** `None` is immortal since 3.12; its refcount is a magic constant the runtime never modifies
**Fix:** nothing is wrong. The docs say not to rely on `getrefcount` for anything other than distinguishing 0 and 1. Use `gc.get_referrers` or a memory profiler if you are actually hunting a leak

**Symptom:** a refcount-based test ("assert this object has exactly two references") is flaky or wrong
**Cause:** `getrefcount` includes its own temporary argument reference, immortal objects report a magic value, and the free-threaded build defers and biases counts
**Fix:** do not test refcounts. Test the observable behaviour instead — that a `weakref` dies, that a context manager closed the handle, that a cache evicted an entry

**Symptom:** a colleague argues `is` is faster than `==` and should be used on the hot path
**Cause:** it is faster, and it also answers a different question
**Fix:** the correct optimisation for hot-path equality is comparing enum members (`status is Status.ACTIVE` is legitimate — each member is a singleton by construction), comparing integers, or interning your own strings with `sys.intern` and comparing those. Never swapping `==` for `is` on values whose identity is accidental

**Symptom:** `__del__` runs later than expected, or not where expected, after moving to the free-threaded build
**Cause:** deferred and biased reference counting change *when* a count reaches zero; CPython has never promised deterministic finalisation, and free-threading widens the gap
**Fix:** never rely on `__del__` for resource release. Use a context manager or an explicit `close()` — `contextlib.closing` if the object has no `__enter__`

## Interview questions

**★ What are immortal objects and why were they introduced?**
PEP 683, landed in 3.12: certain objects — `None`, `True`, `False`, `Ellipsis`,
`NotImplemented`, static type objects and the runtime's static globals — have a
fixed magic reference count the runtime never modifies. The reason is not memory
but cache coherency: under ordinary refcounting, merely *reading* `None` writes
to the memory holding `None`, so a read-only shared object causes its cache line
to bounce between cores. Freezing the refcount removes those writes, which is a
prerequisite for the free-threaded build to scale. The visible effect is that
`sys.getrefcount` on such an object returns a very large, meaningless number —
the docs say so explicitly.

**★ Does the free-threaded build change any of this?**
Yes, in ways that reinforce the rule. It interns and immortalizes *all* string
constants rather than only identifier-shaped ones, so two string constants can
have different identity behaviour on two builds of the same CPython version. It
also replaces the single non-atomic refcount with a combination of
immortalization, biased reference counting for objects that stay on one thread,
and deferred reference counting, which makes `sys.getrefcount` less meaningful
still and makes the timing of `__del__` less predictable. The practical takeaway
is unchanged: identity of values you did not construct is not a property you may
depend on.

**★ When is `is` on something other than `None` legitimate?**
When the object is a documented singleton or one you created and hold. `True` and
`False`, `Ellipsis`, `NotImplemented`, a module-private `_MISSING = object()`
sentinel, enum members (each member is a singleton by construction, which is why
`status is Status.ACTIVE` is idiomatic), and direct aliasing questions such as
"is this the same list object the caller handed me?". The unifying test: can you
point at the one object and say where it was created? If not, use `==`.

**★ How would you stop `is`-instead-of-`==` from ever reaching your main branch?**
Three layers. The compiler already emits a `SyntaxWarning` for `is` against any
literal other than `None`, `True`, `False` and `Ellipsis` — turn it into an error
in CI with `python -W error::SyntaxWarning -m compileall src/`. Add `ruff`'s
`F632` to the lint set so it is caught during development. And in review, treat
any `is` whose right-hand side is not `None`, a boolean, an enum member or a
named sentinel as a defect by default, and make the author justify it.

**A test asserts `id(a) == id(b)`. What is wrong with it?**
Two things. It should be `a is b`, which is what it means and cannot be misread.
And `id()` values are only guaranteed unique and constant *during an object's
lifetime*, so if either side is a temporary that dies before the comparison — a
real risk when both sides are expressions — the ids can coincide for two
different objects. Chunk [3](03-identity-and-equality.md) covers the lifetime
rule.

**Why is `sys.getrefcount` almost never the tool you want?**
Because its documented guarantee is narrow: the value "may not actually reflect
how many references to the object are actually held", immortal objects report a
magic constant, the call itself adds a temporary reference, and the free-threaded
build defers some counts entirely. The docs conclude "do not rely on the returned
value to be accurate, other than a value of 0 or 1". For leak hunting, the right
tools are `gc.get_referrers`, `tracemalloc`, and — most often — finding the
container that is still holding the object.

**What is the single sentence you would leave a team with from this topic?**
Assignment binds a name to an object; `is` asks whether two names reached the
same object, and everything CPython does to make that True by accident —
small-integer caching, constant merging, folding, interning, immortality — is an
implementation detail that will make a wrong comparison pass its tests and fail
in production. Use `==` unless you can name the one object you are pointing at.

---

← Prev: [Caching and interning](04-caching-and-interning.md) · Index: [Everything is an object](README.md) · Next → [Imports](../08-imports/README.md)
