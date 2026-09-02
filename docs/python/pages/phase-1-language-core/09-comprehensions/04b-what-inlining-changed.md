---
title: "What inlining actually changed: tracebacks, symtable, locals(), tracing — and the generator expressions that were left out"
sidebar_label: "4b · What inlining changed"
sidebar_position: 98
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 709](https://peps.python.org/pep-0709/),
> [What's New in Python 3.12 — PEP 709](https://docs.python.org/3.14/whatsnew/3.12.html#pep-709-comprehension-inlining),
> [What's New in Python 3.13 — PEP 667](https://docs.python.org/3.14/whatsnew/3.13.html),
> the Library Reference
> [`locals`](https://docs.python.org/3.14/library/functions.html#locals),
> [`symtable`](https://docs.python.org/3.14/library/symtable.html),
> and the [Glossary — optimized scope](https://docs.python.org/3.14/glossary.html#term-optimized-scope).
> Target: **CPython 3.14**.

**Removing the function call removed everything that depended on there being a
function call. What's New in 3.12 lists four consequences, and every one of them
has bitten a tool rather than a program: tracebacks lost a frame, `symtable`
lost a child table, `locals()` gained the whole enclosing scope, and a
comprehension over `locals()` can raise under coverage tracing. Generator
expressions were left out of the change, so the two constructs now differ in all
four respects — which is the practical reason to know any of this.**

## The four observable changes

What's New in 3.12 lists them. Quoted:

> *"There is no longer a separate frame for the comprehension in tracebacks, and
> tracing/profiling no longer shows the comprehension as a function call."*

> *"The `symtable` module will no longer produce child symbol tables for each
> comprehension; instead, the comprehension's locals will be included in the
> parent function's symbol table."*

> *"Calling `locals()` inside a comprehension now includes variables from outside
> the comprehension, and no longer includes the synthetic `.0` variable for the
> comprehension 'argument'."*

> *"A comprehension iterating directly over `locals()` (e.g. `[k for k in
> locals()]`) may see 'RuntimeError: dictionary changed size during iteration'
> when run under tracing (e.g. code coverage measurement). This is the same
> behavior already seen in e.g. `for k in locals():`. To avoid the error, first
> create a list of keys to iterate over: `keys = list(locals()); [k for k in
> keys]`."*

Taking them one at a time.

**Tracebacks lost a frame.** Before 3.12, an exception raised inside a list
comprehension showed a `<listcomp>` frame between the comprehension's line and
the exception. Now it does not. The line number of the comprehension is still
correct, so the traceback is shorter and no less precise — but log-parsing or
error-grouping code that matched on `<listcomp>` stopped matching, and
grouping heuristics in error trackers may fold together exceptions that used to
be distinct.

**`symtable` lost its children.** Any tool that walked
`symtable.symtable(...).get_children()` expecting a child table per comprehension
now finds the comprehension's names in the parent. Linters, refactoring tools and
static analysers written against 3.11 needed updating.

**`locals()` changed contents.** This is the one that reaches ordinary code,
usually through a logging helper or an f-string debugging idiom. Inside a
comprehension, `locals()` now returns the enclosing function's locals — not a
two-entry dict containing the iteration variable and `.0`.

**Coverage tools can turn `[k for k in locals()]` into a `RuntimeError`.** That
is the fourth bullet, and it is the nastiest because it only appears under
tracing: your test suite fails under `coverage` and passes without it. The fix is
in the quote — materialise the keys first.

## Where `locals()` stands in 3.14

Two changes stack here, and it is worth separating them. PEP 709 changed *what*
`locals()` sees inside a comprehension; PEP 667 (3.13) changed *what mutating the
result does*. The current documentation states the comprehension rule directly:

> *"Calling `locals()` as part of a comprehension in a function, generator, or
> coroutine is equivalent to calling it in the containing scope, except that the
> comprehension's initialised iteration variables will be included. In other
> scopes, it behaves as if the comprehension were running as a nested function."*

> *"Calling `locals()` as part of a generator expression is equivalent to calling
> it in a nested generator function."*

Read those two sentences together and you have the whole current picture:

| Context | `locals()` inside it |
|---|---|
| Comprehension in a function/generator/coroutine | the containing scope's locals, plus the comprehension's initialised iteration variables |
| Comprehension in a module or class body | as if it were a nested function |
| Generator expression, anywhere | as if it were a nested generator function |

The phrase *"initialised iteration variables"* is doing real work: with nested
`for` clauses, an inner target is only present once it has been bound, so the
contents of `locals()` change as the comprehension progresses.

And from PEP 667, the mutation rule for optimized scopes — the glossary lists
*"functions, generators, coroutines, comprehensions, and generator expressions"*
as optimized scopes — is that `locals()` returns *"independent snapshots of the
currently assigned local variables"*, so writing to the returned dict changes
nothing.

## What was not inlined

> *"Generator expressions are currently not inlined in the reference
> implementation of this PEP. In the future, some generator expressions may be
> inlined, where the returned generator object does not leak."*

A genexp must survive its defining statement — that is its whole purpose — so it
still needs a real frame, and it still shows as `<genexpr>` in tracebacks and as
a call to tracing tools. If you are debugging and one construct appears in the
profile and the other does not, this is why.

Asynchronous comprehensions did get the treatment:

> *"Asynchronous comprehensions are inlined the same as synchronous ones; no
> special handling is needed."*

And class and module scope:

> *"Comprehensions occurring in module or class scope are also inlined. In this
> case, the comprehension will introduce usage of fast-locals (`LOAD_FAST` /
> `STORE_FAST`) for the comprehension iteration variable within the comprehension
> only, in a scope where otherwise only `LOAD_NAME` / `STORE_NAME` would be used,
> maintaining isolation."*

Which is the sentence people misread as fixing the class-body trap. It does not —
see [the class body trap](03b-the-class-body-trap.md).

The PEP's own summary of the semantic result is the sentence worth keeping:

> *"In effect, comprehensions introduce a sub-scope where local variables are
> fully isolated, but without the performance cost or stack frame entry of a
> call."*

## Gotchas

**★ Symptom — a test suite passes normally and fails under `coverage` with
`RuntimeError: dictionary changed size during iteration`.** Cause: a
comprehension iterating directly over `locals()`; since inlining, that is the
enclosing frame's locals, and tracing can add to them mid-iteration. What's New
documents exactly this case. Fix: `keys = list(locals())` first, then iterate
`keys` — the documentation gives that fix verbatim.

**★ Symptom — log lines or error-tracker fingerprints changed after upgrading to
3.12 because a `<listcomp>` frame disappeared.** Cause: comprehensions no longer
create a frame, so tracebacks are one line shorter. Fix: update the matching;
there is nothing to restore, and the comprehension's own line number is still
reported correctly.

**★ Symptom — a debugging helper that dumps `locals()` from inside a
comprehension suddenly prints the whole function's variables.** Cause: PEP 709 —
`locals()` in a comprehension is now *"equivalent to calling it in the containing
scope"*. Fix: this is the documented behaviour; if you wanted just the iteration
variables, name them explicitly.

**★ Symptom — a profiler shows generator expressions as calls and comprehensions
not at all, and the two look inconsistent.** Cause: genexps were deliberately not
inlined, because the generator object outlives the defining statement and needs a
real frame. Fix: nothing to fix — expect the asymmetry and do not conclude that
your comprehensions are free.

**Symptom — a linter or codemod built on `symtable` stopped finding
comprehension scopes.** Cause: `symtable` no longer produces child tables for
comprehensions; their locals are in the parent function's table. Fix: update the
tool; the information is still there, one level up.

**Symptom — code that relied on the synthetic `.0` name in `locals()` broke.**
Cause: `.0` was the comprehension function's single argument — the iterator for
the leftmost iterable — and there is no function and no argument any more. Fix:
there is no replacement; the value lives on the stack.

**Symptom — a `sys.settrace`-based debugger no longer stops inside a
comprehension.** Cause: with no function call there is no call/return event;
What's New says *"tracing/profiling no longer shows the comprehension as a
function call"*. Fix: set the breakpoint on the enclosing line, or convert the
comprehension to a loop while debugging it.

**Symptom — mutating the dict returned by `locals()` inside a comprehension has
no effect.** Cause: PEP 667 in 3.13 — in an optimized scope, and the glossary
lists comprehensions among optimized scopes, `locals()` returns *"independent
snapshots of the currently assigned local variables"*. Fix: there is no supported
way to write locals from a comprehension; restructure so you do not need to.

**Symptom — `locals()` inside a nested comprehension is missing the inner
target on the first call and has it later.** Cause: the documentation says only
the comprehension's *"initialised iteration variables"* are included, and an
inner target is not initialised until its clause first runs. Fix: do not build
logic on the contents of `locals()`; it is a debugging aid.

## Interview questions

**★ Q: Name the observable differences a tool could detect after PEP 709.**
No `<listcomp>` frame in tracebacks; no call/return events for the comprehension
under `sys.settrace` or `sys.setprofile`; no child symbol table in `symtable`;
and `locals()` inside a comprehension returning the containing scope's variables
without the synthetic `.0`. There is also the documented `RuntimeError` when a
comprehension iterates `locals()` directly under tracing.

**★ Q: Why were generator expressions left out?**
Because the generator object outlives the statement that created it. Inlining
works by borrowing the enclosing frame, and a genexp needs its own frame to
suspend and resume in. The PEP says some genexps may be inlined in future *"where
the returned generator object does not leak"* — that is, where the compiler can
prove the generator is fully consumed in place.

**★ Q: What does `locals()` return inside a comprehension in 3.14?**
In a function, generator or coroutine, the documentation says it is *"equivalent
to calling it in the containing scope, except that the comprehension's
initialised iteration variables will be included"*. In a module or class body it
behaves *"as if the comprehension were running as a nested function"*. Inside a
generator expression it behaves as if in a nested generator function, because
genexps really are still nested functions.

**Q: What was `.0`?**
The synthetic name of the comprehension function's single parameter: the iterator
made from the leftmost iterable, which the reference describes as being *"passed
as an argument to the implicitly nested scope"*. It was visible in `locals()`
inside a comprehension before 3.12. There is no function now, so there is no
`.0`.

**Q: How do PEP 709 and PEP 667 interact?**
They answer different questions about the same call. PEP 709 (3.12) changed what
`locals()` *contains* inside a comprehension — the containing scope's variables.
PEP 667 (3.13) defined what happens when you *mutate* the returned mapping in an
optimized scope: it is an independent snapshot, so mutations are discarded. The
glossary lists comprehensions and generator expressions among optimized scopes,
so both apply.

**Q: Why does `[k for k in locals()]` only fail under coverage?**
Because tracing adds entries to the frame's locals while the comprehension is
iterating them, and since inlining that dict *is* the enclosing frame's locals
rather than a two-entry throwaway. What's New notes it is *"the same behavior
already seen in e.g. `for k in locals():`"* — the comprehension simply joined the
category of code that iterates a live namespace.

**Q: Should any of this change how you write comprehensions?**
Only one thing: do not iterate `locals()` (or `globals()`, or any live
namespace) directly in a comprehension. Everything else on this list is a
difference tools must handle, not a hazard for application code.

---

← Prev: [PEP 709 inlining](04-pep-709-inlining.md) · Index: [Comprehensions](README.md) · Next → [Generator expressions](05-generator-expressions.md)
