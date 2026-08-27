---
title: "Runtime optimisation: the specialising adaptive interpreter, the tail-call build, and the experimental JIT"
sidebar_label: "6 · Runtime optimisation"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against
> [PEP 659 – Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/),
> [What's New in Python 3.11 § Faster CPython](https://docs.python.org/3.14/whatsnew/3.11.html#faster-cpython),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (the new interpreter type; binary releases for the experimental JIT), and
> [PEP 744 – JIT Compilation](https://peps.python.org/pep-0744/) (status: Draft).
> Version spine: **Python 3.14.7**.

**CPython's compiler barely optimises, so all the optimisation happens while
your program is running — and since 3.11 the eval loop literally rewrites its
own bytecode as it watches which types flow through each instruction. That is
the specialising adaptive interpreter, and it is the reason 3.11 was
substantially faster than 3.10 without anyone changing their code. Two newer
mechanisms sit alongside it in 3.14: a tail-call interpreter that is a build
option, and a just-in-time compiler that ships in the official binaries but is
switched off. Knowing what each one is — and, more usefully, what each one is
*not* — is how you avoid both the "just enable the JIT" cargo cult and the
"Python can never be fast" fatalism.**

## The specialising adaptive interpreter (3.11+)

PEP 659's premise:

> *"In order to perform well, virtual machines for dynamic languages must
> specialize the code that they execute to the types and values in the program
> being run. This specialization is often associated with 'JIT' compilers, but
> is beneficial even without machine code generation."*

The What's New for 3.11 describes the mechanism plainly:

> *"The general idea is that while Python is a dynamic language, most code has
> regions where objects and types rarely change. This concept is known as type
> stability. At runtime, Python will try to look for common patterns and type
> stability in the executing code. Python will then replace the current
> operation with a more specialized one. This specialized operation uses fast
> paths available only to those use cases/types, which generally outperform
> their generic counterparts. This also brings in another concept called
> inline caching, where Python caches the results of expensive operations
> directly in the bytecode."*

Concretely: a generic `BINARY_OP` that has seen two `int` operands several
times gets rewritten *in the code object itself* into an int-specific variant
that skips the type-slot lookup. A `LOAD_ATTR` on repeated instances of the
same class gets rewritten into a version that reads a known dictionary offset,
with the class's version tag cached inline next to the instruction so it can
detect the class changing underneath it. The specialiser also *"combine[s]
certain common instruction pairs into one superinstruction, reducing the
overhead during execution."*

Three properties determine how you should reason about it:

- **It only specialises hot code.** *"Python will only specialize when it sees
  code that is 'hot' (executed multiple times). This prevents Python from
  wasting time on run-once code."* Startup paths, import-time work and one-shot
  scripts get none of the benefit — which is part of why Python startup did not
  get dramatically faster while steady-state execution did.
- **It de-specialises.** *"Python can also de-specialize when code is too
  dynamic or when the use changes."* A function called with ints a million
  times and then with `Decimal` reverts to the generic form. Re-specialisation
  is attempted periodically, so it adapts rather than giving up.
- **It is per-instruction, not per-function.** There is no compilation unit, no
  warm-up threshold you can tune, no flag. It is a property of individual
  bytecodes inside a code object.

3.11 as a whole reported *"between 10-60% faster than Python 3.10. On average,
we measured a 1.25x speedup on the standard benchmark suite"*, of which the
specialising interpreter was one of the key parts (alongside lazy frame objects
and inlined Python-to-Python calls, covered in
[the previous chunk](05-the-interpreter-loop.md)).

The practical guidance: **type-stable hot loops specialise and stay
specialised; type-polymorphic ones thrash.** Note carefully what this does
*not* mean — it has nothing to do with type annotations, which the interpreter
never consults. It is about the actual objects flowing through. And the effect
is real but modest; restructuring code for it without a measurement is a waste
of your afternoon.

## The tail-call interpreter (3.14, build option)

An internal reorganisation of the eval loop: instead of one enormous C
`switch`, each opcode becomes a small C function, and dispatch happens through
tail calls that modern compilers turn into direct jumps with better branch
prediction.

> *"Preliminary benchmarks suggest a geometric mean of 3-5% faster on the
> standard pyperformance benchmark suite, depending on platform and
> architecture. The baseline is Python 3.14 built with Clang 19, without this
> new interpreter. This interpreter currently only works with Clang 19 and
> newer on x86-64 and AArch64 architectures."*

It is opt-in at build time (`--with-tail-call-interp`), profile-guided
optimisation is *"highly recommended"* when using it, and the docs are explicit
about what it does not change:

> *"This new interpreter type is an internal implementation detail of the
> CPython interpreter. It doesn't change the visible behavior of Python
> programs at all. It can improve their performance, but doesn't change
> anything else."*

And the note that exists purely to head off a misunderstanding, and which makes
an excellent interview question:

> *"This is not to be confused with tail call optimization of Python functions,
> which is currently not implemented in CPython."*

Deep Python recursion still hits the recursion limit. Nothing about the
tail-call *interpreter* changes that. The name refers to how CPython's C code
dispatches between opcodes, not to your `factorial`.

## The JIT (3.14, shipped but off)

PEP 744 describes a copy-and-patch just-in-time compiler, generated from the
same DSL that generates the interpreter — so it tracks the interpreter's
semantics automatically rather than being a hand-written second
implementation. As of 3.14 it ships in the official binaries and is disabled:

> *"The official macOS and Windows release binaries now include an experimental
> just-in-time (JIT) compiler. Although it is not recommended for production
> use, it can be tested by setting `PYTHON_JIT=1` as an environment variable.
> Downstream source builds and redistributors can use the
> `--enable-experimental-jit=yes-off` configuration option for similar
> behavior."*

The honest number, from the same document:

> *"The JIT is at an early stage and still in active development. As such, the
> typical performance impact of enabling it can range from 10% slower to 20%
> faster, depending on workload."*

Three operational facts to carry:

```python
import sys
sys._jit.is_available()   # does this executable support JIT compilation?
sys._jit.is_enabled()     # is it on in this process?
```

- **Native tooling breaks.** *"native debuggers and profilers like gdb and perf
  are unable to unwind through JIT frames (Python debuggers and profilers,
  like pdb or profile, continue to work without modification)."*
- **It is mutually exclusive with free threading.** *"Free-threaded builds do
  not support JIT compilation."* Today you pick parallelism or experimental
  native compilation, not both.
- **PEP 744 is still Draft**, and its own framing is that the JIT is currently
  *about as fast as* the specialising interpreter on most platforms — which is
  an achievement for a young compiler and not yet a reason to turn it on.

## What none of this changes

Worth stating explicitly, because performance conversations drift:

- **Semantics are identical.** Specialisation, tail-call dispatch and the JIT
  are invisible to your program.
- **Type annotations do nothing at run time.** The specialiser observes actual
  types, not `int` in a signature. Since 3.14 annotations are not even
  evaluated eagerly by default.
- **Startup did not get much faster.** All three mechanisms need code to be
  executed repeatedly before they pay off. A CLI that runs for 80ms is
  dominated by imports, not by the eval loop.
- **The GIL is orthogonal.** This is about how fast *one* thread executes
  bytecode, not how many threads may do so. That is
  [topic 02](../02-the-gil/README.md).

## Gotchas

**Symptom:** a benchmark of a function shows wildly different numbers on the first few calls
**Cause:** the specialising interpreter has not warmed up — instructions specialise only after the code has been seen to be hot
**Fix:** this is exactly why `timeit` runs a loop many times and reports the best result. A single `time.perf_counter()` around one call measures the unspecialised path and tells you nothing about steady state

**Symptom:** a hot loop got measurably slower after someone generalised it to handle both `int` and `Decimal`
**Cause:** the arithmetic instructions can no longer stay specialised for one type; they de-specialise, re-specialise, and pay the generic path in between
**Fix:** if it matters, dispatch once at the top into two type-stable code paths rather than branching per iteration. Measure first — the effect is real but usually small next to whatever else the loop does

**Symptom:** adding type hints throughout a hot module made nothing faster
**Cause:** annotations are metadata. The interpreter never consults them for execution decisions, and since 3.14 they are lazily evaluated by default
**Fix:** hints buy static checking, editor support and readability, which is plenty. For speed you must remove work — vectorise, cache, or push the loop into C

**Symptom:** upgrading from 3.10 to 3.11 made the test suite barely faster while the benchmark suite claims 1.25x
**Cause:** test suites are dominated by import time, fixture setup and one-shot code, none of which specialises. The published figure is for a steady-state benchmark suite
**Fix:** expected. Measure your own workload; if it is import-bound, the fix is import cost, not the eval loop

**Symptom:** `PYTHON_JIT=1` made a workload slower
**Cause:** documented behaviour — the 3.14 JIT is experimental and the impact ranges from 10% slower to 20% faster depending on the workload
**Fix:** measure per workload, and keep it out of production; the release notes say it is not recommended there

**Symptom:** `perf` or `gdb` produces broken or truncated stacks after enabling the JIT
**Cause:** native debuggers and profilers cannot unwind through JIT frames yet
**Fix:** turn the JIT off while profiling natively, or use Python-level tooling (`pdb`, `profile`), which the docs say continue to work unchanged

**Symptom:** running the free-threaded build with `PYTHON_JIT=1` and seeing no JIT activity
**Cause:** free-threaded builds do not support JIT compilation at all
**Fix:** pick one. If the workload is parallelisable, free threading is the bigger win; if it is single-threaded and compute-heavy, the JIT is the thing to test

**Symptom:** someone claims 3.14 "added tail-call optimisation, so deep recursion is fine now"
**Cause:** conflating the tail-call *interpreter* (a C dispatch technique) with tail-call *optimisation* of Python functions. The docs explicitly warn against this confusion
**Fix:** CPython does not implement TCO for Python functions and the release notes say so. Convert deep recursion into iteration with an explicit stack

**Symptom:** a build of CPython with `--with-tail-call-interp` is slower than the default build
**Cause:** the measured gain assumes Clang 19+, x86-64 or AArch64, and profile-guided optimisation, which the docs call the only configuration tested and validated for improved performance
**Fix:** either build with PGO on a supported compiler and architecture, or leave the option alone. A hand-rolled non-PGO build is not the configuration the 3–5% figure refers to

**Symptom:** an attempt to make code faster by writing bytecode-friendly source (avoiding attribute lookups, unrolling loops) makes no measurable difference
**Cause:** the specialiser already caches attribute lookups inline once they are hot; you are duplicating work the runtime does better with more information
**Fix:** hoisting a lookup out of a loop is still a legitimate micro-optimisation for very hot code, but verify it. The overwhelming majority of real wins are algorithmic or come from not making the call at all

## Interview questions

**★ What is the specialising adaptive interpreter, and why is it not a JIT?**
It is PEP 659, shipped in 3.11: at run time CPython observes the types flowing
through individual bytecode instructions and rewrites hot ones into specialised
variants with inline caches — `LOAD_ATTR` becomes a known-offset read,
`BINARY_OP` becomes an int-specific multiply. It is not a JIT because it emits
no machine code; it rewrites bytecode into other bytecode. It specialises only
code that has been executed several times, de-specialises when types change,
and re-specialises periodically. 3.11 overall reported a 1.25x average speedup
on the standard benchmark suite, of which this was a key part.

**★ Does adding type hints make Python faster?**
No. Annotations are stored as metadata and the interpreter never consults them
for execution decisions — and since 3.14, under PEP 649/749, they are not even
evaluated eagerly by default. The specialising interpreter watches the *actual*
types flowing through each instruction at run time, so a well-annotated
function and an unannotated one receiving the same values specialise
identically. Hints buy static checking, editor support and readability, which
is the actual case for them.

**★ What is the 3.14 JIT and should you turn it on?**
An experimental copy-and-patch just-in-time compiler (PEP 744, still Draft),
now included in the official macOS and Windows binaries but disabled unless you
set `PYTHON_JIT=1`. The release notes say it is not recommended for production
and that the impact ranges from 10% slower to 20% faster depending on workload.
It cannot be combined with free-threaded builds, and native profilers like
`perf` and `gdb` cannot unwind through its frames. Test it on your workload out
of curiosity; do not ship it yet.

**★ Does the 3.14 tail-call interpreter mean Python finally has tail-call optimisation?**
No, and the documentation calls this confusion out explicitly. The tail-call
interpreter is an internal build option that implements each opcode as a small
C function chained by tail calls instead of one large `switch` — worth a
preliminary 3–5% on pyperformance with Clang 19+ on x86-64 and AArch64.
Tail-call optimisation of *Python* functions, which would let a recursive call
reuse its frame so depth stays constant, is explicitly not implemented in
CPython. Deep recursion still raises `RecursionError`; write a loop.

**Why did 3.11 make my web app only slightly faster when the announcement said up to 60%?**
Because the announced range is for a steady-state benchmark suite and the
mechanisms that produce it — specialisation, lazy frames, inlined calls — all
require code to be executed repeatedly before they pay off. A request handler
that is dominated by database round-trips, template rendering in C, or import
time on a cold worker sees little of it. The figure to trust is always the one
from your own workload.

**How does specialisation interact with duck typing? Am I punished for polymorphism?**
Mildly, and only in genuinely hot code. An instruction that sees one type stays
specialised; one that sees several de-specialises to the generic path and
retries later. The design deliberately makes re-specialisation cheap so
adaptation costs little. In practice this is not a reason to abandon
polymorphic design — it is a reason, in a profiled hot loop, to consider
dispatching once at the top rather than per element.

**What would you actually do to make a slow Python service faster, in order?**
Profile first, because the answer is almost never the interpreter. Then: remove
the work (caching, better queries, fewer round-trips); fix the algorithm; move
the hot loop out of Python (numpy, the database, a compiled extension); and
only then consider runtime-level options like a newer CPython, which gets you
the specialising interpreter for free, or the free-threaded build if the
workload is parallel. Enabling the experimental JIT belongs near the bottom of
that list, and rewriting Python "to help the compiler" is not on it at all.

---

← Prev: [The interpreter loop](05-the-interpreter-loop.md) · Index: [What Python is](README.md) · Next → [The GIL](../02-the-gil/README.md)
