---
title: "Exceptions: four clauses, one hierarchy, two chains — and a dozen ways to lose the only copy of the diagnosis"
sidebar_label: "11 · Exceptions"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement),
> [The `assert` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-assert-statement),
> the Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html),
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html),
> [`warnings`](https://docs.python.org/3.14/library/warnings.html),
> [`logging`](https://docs.python.org/3.14/library/logging.html),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html),
> [`sys`](https://docs.python.org/3.14/library/sys.html)
> (`exception`, `exc_info`, `excepthook`, `unraisablehook`, `tracebacklimit`),
> [`threading.excepthook`](https://docs.python.org/3.14/library/threading.html#threading.excepthook),
> [`asyncio.TaskGroup`](https://docs.python.org/3.14/library/asyncio-task.html#task-groups),
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html),
> the [Tutorial — errors and exceptions](https://docs.python.org/3.14/tutorial/errors.html),
> [PEP 8](https://peps.python.org/pep-0008/),
> and [PEP 3134](https://peps.python.org/pep-3134/), [PEP 654](https://peps.python.org/pep-0654/),
> [PEP 678](https://peps.python.org/pep-0678/), [PEP 765](https://peps.python.org/pep-0765/).
> Target: **CPython 3.14**.

**Exception handling is four independent decisions that the syntax makes look
like one. *Which* exception to catch is a question about the
[hierarchy](04-the-exception-hierarchy.md) and about what your handler can
actually answer. *Where* to catch it is a question about which frame has enough
context to decide. *How much* of the `try` block to guard is the `else` clause's
entire reason for existing. And *what to do with it* is where the failures
live — because the type and the message survive anything, and the traceback
survives only as long as somebody holds the exception object.**

Three things in this topic are newer than most published material. Exception
groups and `except*` arrived in **3.11** and change what `except ValueError:`
means the moment `asyncio.TaskGroup` is involved. `add_note` (PEP 678, 3.11) is
the right tool for most of what people wrap exceptions to achieve. And **PEP 765
in 3.14** finally warns about a `return` inside `finally` — the quietest way in
the language to discard a production error.

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The four clauses](01-the-four-clauses.md)** | The three legal shapes of `try`; the full execution order; how a handler is chosen; handlers covering the whole call tree rather than the visible lines; nested statements and the inner handler winning; an exception raised in the `except` *header*; reaching the exception without `as` |
| 2 | **[The `else` clause](02-the-else-clause.md)** | The exact rule and the tutorial's own justification; the failure it prevents in the shape you meet it; PEP 8's version; the parallel with `for`/`else`; `else` versus `finally`, which are not interchangeable; where the `return` goes; when it is not worth it |
| 3 | **[`finally` and its guarantees](03-finally-and-its-guarantees.md)** | The mechanism in the reference's words; the full route table of every way out; the return value being computed *before* `finally` runs; why the exception is not visible inside it; `finally` in a loop |
| 3b | **[Cleanup patterns](03b-finally-cleanup-patterns.md)** | Acquire *before* the `try`; a `finally` must not raise; use `with` when the object owns its release; nested `finally` unwinding inside-out |
| 3c | **[Ownership and state](03c-cleanup-ownership-and-state.md)** | Do not close what you are handing back; the ownership question stated once; idempotent cleanup; restoring state rather than releasing resources |
| 3d | **[Context managers as cleanup](03d-context-managers-as-cleanup.md)** | `closing()`; `ExitStack` when the resource count is not static; the one power `finally` does not have — `__exit__` can **suppress**; `@contextmanager` as the `try`/`finally` you were about to write |
| 3e | **[Jumping out of `finally`](03e-return-break-continue-in-finally.md)** | The reference's one sentence, plus the second rule about `return`; the shapes it hides in; and what to write instead |
| 3f | **[Finding `finally` jumps](03f-finding-and-fixing-finally-jumps.md)** | What **3.14 (PEP 765)** does about it and why a warning rather than an error; version history, because old code compiles differently; sweeping a codebase; two shapes that are *not* the bug |
| 3g | **[When `finally` does not run](03g-when-finally-does-not-run.md)** | The five ways — `os._exit`, an interpreter crash, a daemon thread at shutdown, an unfinalized suspended generator, a `try` block that never ends — and designing for them |
| 4 | **[The exception hierarchy](04-the-exception-hierarchy.md)** | The two roots; the four direct children of `BaseException` and why each is there; the parts of the tree worth memorising; `StopIteration` living under `Exception` and what follows; "non-virtual base class" (ABC registration does not count); where to draw your own handlers |
| 4b | **[The bare `except:`](04b-the-bare-except.md)** | What it actually matches; the Ctrl-C bug in the shape it appears; PEP 8's rule and its two exceptions; why `except Exception:` is a different question; when you genuinely need `BaseException`; the line to grep for |
| 5 | **[Catching specific types](05-catching-specific-types.md)** | The matching rule and first-match-wins ordering as program logic; specific before general; combining types — and 3.14 finally allowing the parentheses to be dropped |
| 5b | **[Choosing the type](05b-choosing-the-exception-type.md)** | Separate clauses versus one tuple; the three questions that pick the class; naming it from the right module; catching what the callee *documents* rather than what it happens to raise; re-raising the cases that are not yours |
| 5c | **[The deleted `as` target](05c-the-as-target-is-deleted.md)** | What the reference says and the reference cycle it exists to break; the `NameError` it produces; assigning to another name; not needing the name at all; and that it applies to `except*` too |
| 6 | **[The `raise` statement](06-the-raise-statement.md)** | The grammar and three forms; bare `raise` and the `RuntimeError` outside a handler; `raise X` with a class versus an instance; bare `raise` versus `raise e` and the traceback difference; `with_traceback` and the 3.11 change; raising early in a loop |
| 6b | **[Exception chaining](06b-exception-chaining.md)** | `__context__` (automatic — and `with` counts as handling) versus `__cause__` (`raise … from`); that setting a cause also sets `__suppress_context__`; `from None` as a **display** decision that leaves the original in `__context__`; the boundary rule for wrapping; `add_note` as the cheaper option; reading a chain in a log |
| 7 | **[Custom exceptions](07-custom-exceptions.md)** | Derive from `Exception`, never `BaseException`; one base per package then narrow; the `args`/`__str__` contract; 🔴 the custom `__init__` that breaks `pickle`, `multiprocessing` and `concurrent.futures` reconstruction and never fires in single-process tests; builtin-versus-custom; subclass exactly one exception type |
| 8 | **[Exception groups](08-exception-groups.md)** | Why "the first error" is the wrong answer for parallel work; `ExceptionGroup` versus `BaseExceptionGroup` and the `Exception` split between them; raising one from a batch; nesting and the formatter's truncation; catching the container with plain `except` |
| 8b | **[`split`, `subgroup`, subclasses](08b-split-subgroup-and-subclasses.md)** | The group API `except*` is built on; what `split` preserves; the 3.13 callable condition; `derive` — and `__new__`, not `__init__`, for a different signature; `TaskGroup` behaviour including the `KeyboardInterrupt` exemption; handling a group by hand, and the `raise rest` you must not forget; walking a nested group |
| 8c | **[`except*` semantics](08c-except-star-semantics.md)** | Every matching clause runs, at most once each; the `as` target is **always a group**, even for a naked exception; the four syntax rules (no mixing, no bare `except*:`, no `break`/`continue`/`return`, cannot catch the group types); what escapes when a clause re-raises versus raises something new |
| 9 | **[Traceback objects](09-traceback-objects.md)** | `__traceback__` as the only part of a failure that cannot be reconstructed; `sys.exception()` versus `sys.exc_info()`; reading most-recent-call-last; the `traceback` module and the 3.10 calling convention; `TracebackException` for capturing without holding frames, and `capture_locals` as a credential leak; `sys.excepthook`, `threading.excepthook`, `sys.unraisablehook`, `sys.tracebacklimit` |
| 10 | **[`assert`](10-assert.md)** | The `if __debug__` equivalence; **no code is emitted under `-O`**, and `__debug__` cannot be assigned; the raise-versus-assert table with validation and security on the raise side; the always-true tuple trap; side effects as an `-O`-only behaviour change; where it genuinely wins, including pytest's rewritten assertions |
| 11 | **[`suppress` and the explicit ignore](11-suppress-and-the-explicit-ignore.md)** | The docs' own `try`/`except`/`pass` equivalence and their "very specific errors" restriction; 🔴 the body being **skipped, not resumed**; group-aware suppression since 3.12; `suppress` as the EAFP spelling; the three tests that disqualify it |
| 11b | **[Warnings](11b-warnings.md)** | What a warning is *for*; the four categories ignored by default and why your `DeprecationWarning` reaches nobody; `stacklevel=2`; the filter actions and `-W error` as upgrade insurance; `catch_warnings` and its documented thread-safety caveat; `logging.captureWarnings` |
| 12 | **[Logging exceptions](12-logging-exceptions.md)** | `log.exception` inside the handler only, `exc_info=exc` everywhere else, `str(exc)` never; `exc_info` versus `stack_info`; `%s` rather than an f-string, and the three reasons; log once at the frame that decides; the service-boundary shape; groups; libraries log nothing |
| 13 | **[Losing the traceback](13-losing-the-traceback.md)** | The six your own code commits — string logging, swallowing, re-raising after the handler, `from None`, sentinel returns, `return` in `finally` — plus the `raise exc` frame that makes the handler look like the origin |
| 13b | **[Losing it across a boundary](13b-losing-it-across-a-boundary.md)** | The six that are done *to* you — an un-awaited task reported only at GC, an unexamined future, a process boundary where the docs do not promise the traceback survives, a thread going to `threading.excepthook`, truncation, catching too early — and cleanup masking the real failure. Ends in a symptom-to-fix checklist |

## The one paragraph the whole topic expands

A `try` statement has four clauses and one execution order, and the `else`
clause exists so the guarded block contains only the line that can fail.
`finally` runs on every route out of the statement — including the ones you did
not write — which is why a `return` inside it discards an in-flight exception,
and why 3.14 now warns about that. Handlers are chosen by a linear
first-match-wins scan, so clause order is logic; a bare `except:` matches
`BaseException` and therefore eats Ctrl-C. Raising inside a handler chains the
old exception automatically as `__context__`, while `raise … from exc` states
causation as `__cause__` and takes over the display; `from None` hides the
original without deleting it. Since 3.11 several failures can propagate together
as an exception group, and `except*` runs every clause that matches, handing each
one a group rather than an exception. `assert` is the one statement the compiler
may delete, which disqualifies it for anything that must be checked. And every
way of ending up with a log you cannot debug from reduces to the same mistake:
letting go of the exception object and keeping a string.

## Where this connects

- **[Control flow](../08-control-flow/README.md)** owns the `else` clause's
  sibling on `for` and `while`, and the loop that a `try` inside it interacts
  with.
- **[Comprehensions](../09-comprehensions/README.md)** cannot host a `try`, which
  is one of the six tests for when a comprehension should have been a loop.
- **[`match`](../10-match-pattern-matching/README.md)** is the statement before
  this one; a `case` that matches nothing raises nothing, which is exactly the
  opposite failure mode.
- **EAFP vs LBYL** *(not written yet)* is the next topic and takes the argument
  this one sets up: whether to ask permission or apologise. It is deliberately
  written after this topic so its boundary is drawn against what these chunks
  actually say.
- **[`None` and the no-result contract](../14-none-and-no-result/README.md)** is
  the alternative to raising, and the reason a sentinel return moves a failure
  forty frames away from its cause.
- **Phase 2 — Functions** owns the decorator shape that `@retry` and
  `@handle_errors` take, and the `functools.wraps` metadata a handler-wrapping
  decorator must preserve.
- **Phase 5 — Iterators, generators, context managers** owns `__exit__`'s
  suppression power in full, `GeneratorExit`, and why a suspended generator's
  `finally` may never run.
- **Phase 8 — Concurrency and async** is where `TaskGroup`, `CancelledError` and
  `except*` stop being a curiosity and become the default shape of error
  handling.

---

← Prev: [`match` — structural pattern matching](../10-match-pattern-matching/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → **EAFP vs LBYL** *(not written yet)*
