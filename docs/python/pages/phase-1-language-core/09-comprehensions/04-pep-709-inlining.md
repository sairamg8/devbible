---
title: "PEP 709: since 3.12 a list, dict or set comprehension is inlined into its enclosing code, and four observable things changed with it"
sidebar_label: "4 · PEP 709 inlining"
sidebar_position: 97
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 709](https://peps.python.org/pep-0709/),
> [What's New in Python 3.12 — PEP 709](https://docs.python.org/3.14/whatsnew/3.12.html#pep-709-comprehension-inlining),
> the Library Reference
> [`locals`](https://docs.python.org/3.14/library/functions.html#locals),
> [`symtable`](https://docs.python.org/3.14/library/symtable.html),
> the [Glossary — optimized scope](https://docs.python.org/3.14/glossary.html#term-optimized-scope),
> and [What's New in Python 3.13 — PEP 667](https://docs.python.org/3.14/whatsnew/3.13.html).
> Target: **CPython 3.14**.

**Before 3.12, every execution of a comprehension allocated a single-use function
object, called it, and threw it away — one Python frame per comprehension, every
time. PEP 709 removed that for list, dict and set comprehensions by compiling
them directly into the enclosing code object, using a new opcode to save and
restore any clashing outer variable. The scoping guarantees are unchanged; the
speed roughly doubled for the comprehension itself; and four things that tools
and debug code depend on changed. Generator expressions were explicitly **not**
inlined, which is why they and comprehensions now behave differently under
tracing and in `locals()`.**

## What the PEP says it did

> *"Comprehensions are currently compiled as nested functions, which provides
> isolation of the comprehension's iteration variable, but is inefficient at
> runtime. This PEP proposes to inline list, dictionary, and set comprehensions
> into the code where they are defined, and provide the expected isolation by
> pushing/popping clashing locals on the stack."*

The cost it removed, in the PEP's own words:

> *"Each time `f()` is called, a new single-use function object is allocated (by
> `MAKE_FUNCTION`), called (allocating and then destroying a new frame on the
> Python stack), and then immediately thrown away."*

and what replaced it:

> *"There is no longer a separate code object, nor creation of a single-use
> function object, nor any need to create and destroy a Python frame."*

## How isolation survives without a scope

This is the part worth understanding, because it explains every behaviour change
below. The PEP:

> *"Isolation of the `x` iteration variable is achieved by the combination of the
> new `LOAD_FAST_AND_CLEAR` opcode at offset `6`, which saves any outer value of
> `x` on the stack before running the comprehension, and `30 STORE_FAST`, which
> restores the outer value of `x` (if any) after running the comprehension."*

So the comprehension's target is now a *local of the enclosing function*, saved
and restored around the comprehension. That gives the same two-way isolation as
before — an outer `x` is not clobbered, and the comprehension's `x` is not
visible afterwards — by a completely different mechanism. The "if any" matters:
`LOAD_FAST_AND_CLEAR` handles the unbound case, which is why the outer name is
still unbound after the comprehension if it was unbound before.

The PEP also handles the cases where the name is not a plain local:

> *"In some cases, the comprehension iteration variable may be a global or
> cellvar or freevar, rather than a simple function local, in the outer scope. In
> these cases, the compiler also internally pushes and pops the scope information
> for the variable when entering/leaving the comprehension, so that semantics are
> maintained."*

And a second, less advertised win:

> *"If the comprehension accesses variables from the outer scope, inlining avoids
> the need to place these variables in a cell, allowing the comprehension (and
> all other code in the outer function) to access them as normal fast locals
> instead. This provides further performance gains."*

That is the sleeper benefit: before 3.12, a comprehension that read an enclosing
local forced that local into a cell for the *whole function*, slowing down every
other use of it. Inlining removed that.

## The speedup, attributed

The PEP's abstract:

> *"up to 2x faster for a microbenchmark of a comprehension alone, translating to
> an 11% speedup for one sample benchmark derived from real-world code that makes
> heavy use of comprehensions."*

What's New in 3.12 states it as *"This speeds up execution of a comprehension by
up to two times."* Both numbers are the project's, from a microbenchmark and one
sample workload respectively. They are not a promise about your code, and the
11% figure in particular is explicitly *"one sample benchmark"*. If you need a
number for your own code, measure it.

## Gotchas

**★ Symptom — someone claims comprehensions are now as cheap as a `for` loop
because they were inlined.** Cause: half-remembering the PEP. Inlining removed
the per-execution function object and frame, which is exactly the overhead a
`for` loop never had; a comprehension was slower than a loop for that reason and
is faster than one for a different reason (`LIST_APPEND` versus a bound method
call). Fix: see [performance](07-performance.md) for what actually differs.

**★ Symptom — after upgrading to 3.12, a function that uses a comprehension over
a closure variable got faster in code *unrelated* to the comprehension.** Cause:
the PEP's secondary effect — the outer variable no longer has to be placed in a
cell, so every other access to it in that function became a fast local. Fix:
nothing; this one is free, and it is the reason the whole-benchmark number is
larger than the comprehension-only number would predict.

**★ Symptom — an outer variable is unexpectedly *unbound* after a comprehension
that used the same name, in code that previously raised nothing.** Cause: this
is the correct behaviour and always was — `LOAD_FAST_AND_CLEAR` restores the
outer value *"(if any)"*, so a name that was unbound before the comprehension is
unbound after it, exactly as when comprehensions were functions. Fix: do not
reuse a name for a comprehension target and an outer variable; the isolation is
guaranteed, but the reader is not.

**Symptom — a benchmark shows nothing like a 2x improvement.** Cause: the 2x is
*"a microbenchmark of a comprehension alone"*; the PEP's own whole-program figure
is 11% on one sample. Fix: measure your own workload — the overhead removed was
per-comprehension-execution, so the gain scales with how often small
comprehensions run, not with how much data they process.

**Symptom — a comprehension in a hot loop is still the bottleneck after
upgrading.** Cause: inlining removed frame setup, not the work inside. If the
element expression calls a Python function per item, that call still costs a
frame. Fix: the optimisation available to you is removing the per-element call,
not the comprehension.

## Interview questions

**★ Q: What did PEP 709 change, and in which version?**
Python 3.12. List, dict and set comprehensions are compiled directly into the
enclosing code object instead of being compiled as a nested function that is
allocated, called and discarded on every execution. The PEP reports up to a 2x
speedup on a comprehension microbenchmark and 11% on one real-world-derived
benchmark. Generator expressions were not inlined.

**★ Q: If a comprehension no longer has its own function, how does its loop
variable still not leak?**
By saving and restoring. The compiler emits `LOAD_FAST_AND_CLEAR` before the
comprehension, which stashes any existing value of the name on the stack and
clears it, and a `STORE_FAST` afterwards which puts it back. The PEP describes
the net effect as *"a sub-scope where local variables are fully isolated, but
without the performance cost or stack frame entry of a call"*. Where the name is
a global, cellvar or freevar rather than a plain local, the compiler pushes and
pops the scope information too.

**Q: Why is inlining a *compiler* change rather than an interpreter
optimisation?**
Because the isolation has to be arranged at compile time: the compiler must know
which names clash with the enclosing scope, emit the save/restore around the
comprehension, and decide whether each name is a local, a cell or a global. An
interpreter-level optimisation would have no way to establish that without the
symbol table.

**Q: Does inlining mean a comprehension in a class body can now see class
names?**
No. The PEP inlines class-scope comprehensions but explicitly preserves
isolation, and the `locals()` documentation still describes a comprehension in a
non-function scope as behaving *"as if the comprehension were running as a nested
function"*. Inlining is a code-generation change, not a name-resolution change.

**Q: Did the semantics of the comprehension itself change at all?**
Not the language semantics. What's New says the iteration variables *"remain
isolated and don't overwrite a variable of the same name in the outer scope, nor
are they visible after the comprehension"*. Everything that changed is
observability — tracebacks, tracing, `symtable`, `locals()` — which is covered in
[the observable changes](04b-what-inlining-changed.md).

---

← Prev: [Fixing the class body trap](03c-fixing-the-class-body-trap.md) · Index: [Comprehensions](README.md) · Next → [What inlining changed](04b-what-inlining-changed.md)
