---
title: "An `except*` clause running is not a promise the statement finished — the leaves nobody matched merge with whatever your handlers raised and propagate on, and the thing bound to your `as` target is a group even when exactly one flat exception was raised"
sidebar_label: "06y · What escapes, what you are handed"
sidebar_position: 164
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 Language Reference —
> [The `try` statement · `except*` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-star)
> (the merge rule, the wrapping rule, the mandatory-type rule, the `TypeError` on a
> `BaseExceptionGroup` subclass),
> [Built-in Exceptions — `BaseExceptionGroup`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup)
> (the constructor's automatic class selection, `exceptions`, `subgroup()`, `split()`),
> and [PEP 654](https://peps.python.org/pep-0654/) for the naked-`except*` rationale.
> Target: **Python 3.14**; `except*` is **new in 3.11**. Documentation-validated;
> **no sandbox run**.

**[06r](06r-except-star-does-not-mix.md) established that `except*` handling is plural. This
chunk is what that costs you at the two places it actually shows up in code: the line after
the statement, and the `as` target. After every clause has run, the unmatched leaves are
merged with anything the clauses themselves raised and the merged group *propagates on* — so
a clause running tells you a subgroup was handled, never that control will reach the next
line. And the target is always a `BaseExceptionGroup`, even for a single flat exception,
which means every attribute you used to read off the exception now lives one level down. Both
are narrowing questions: an `except*` clause claims less than it looks like it claims, and
you have to decide explicitly who owns the rest.**

## Whatever you did not match keeps going

This is the sentence that changes how the code after the statement is written:

> *"After all `except*` clauses execute, the group of unhandled exceptions is merged with any
> exceptions that were raised or re-raised from within `except*` clauses. This merged
> exception group propagates on."*

An `except` clause that runs means the statement completed and control reached the following
line. An `except*` clause that runs means **nothing of the kind** — the statement can still
raise on its way out, carrying every leaf no clause claimed plus anything the handler bodies
raised. The reference's own worked example handles `TypeError` and `OSError` out of a
four-member group and shows the unmatched `ValueError` propagating on inside a one-member
`ExceptionGroup`.

```python
# `results` is assigned only if nothing unmatched escapes the statement.
try:
    results = gather_all(tasks)          # documented to raise an ExceptionGroup
except* ValueError as eg:
    logger.warning("%d bad inputs", len(eg.exceptions))
    results = []
return post_process(results)             # may never be reached, even though a clause ran
```

If the following line must run whatever happened, you need either a clause matching
everything you are prepared to own — `except* Exception` — or an outer statement to catch the
residual. There is no `except*` spelling of the bare `except:`; see the next section.

The merge also runs the other way, and it is the part people forget: an exception *your*
handler raises does not replace the residual, it joins it. Two independent failures — the one
you could not handle and the one your handler hit while handling — leave the statement
together, in one group. That is a feature (nothing is lost) with a real cost (the caller now
has to be group-aware even for the failure your handler caused).

## The type is mandatory, and one type is forbidden

Two restrictions on the clause expression, and they exist for different reasons:

> *"The exception type for matching is mandatory in the case of `except*`, so `except*:` is a
> syntax error."*

> *"A `TypeError` is raised if a matching type is a subclass of `BaseExceptionGroup`, because
> that would have ambiguous semantics."*

PEP 654 gives the rationale for the first:

> *"An empty \"match anything\" `except*` block is not supported as its meaning may be
> confusing"*

The difference in *when* they fire matters more than the rules themselves. The missing type
is caught at compile time, so you find it immediately. The forbidden type is a **runtime**
`TypeError` raised while the handler search evaluates the clause — so `except* ExceptionGroup:`
compiles, ships, and only bites the day something raises inside the suite, at which point you
get a `TypeError` instead of any handling at all. The first restriction is a grammar
refusal and its gotcha lives with the other grammar refusals in
[06r](06r-except-star-does-not-mix.md); the second is a runtime failure and belongs here.

```python
# 🔴 TypeError at match time — the clause looks fine until the suite raises.
try:
    run_all(jobs)
except* ExceptionGroup:
    pass

# Match leaves. The clause is already handed a group; you never name the group type.
try:
    run_all(jobs)
except* ValueError as eg:
    logger.warning("%d bad values", len(eg.exceptions))
```

## A flat exception is wrapped before you see it

> *"If the exception raised from the `try` block is not an exception group and its type
> matches one of the `except*` clauses, it is caught and wrapped by an exception group with
> an empty message string. This ensures that the type of the target `e` is consistently
> `BaseExceptionGroup`."*

The reference demonstrates this with `raise BlockingIOError` under `except* BlockingIOError
as e` and shows the bound value as `ExceptionGroup('', (BlockingIOError(),))` — an empty
message string and a one-element `exceptions` tuple. So the `as` target is a group
**always**, and the `exceptions` attribute is how you get back to the exception:

> *"A tuple of the exceptions in the `excs` sequence given to the constructor. This is a
> read-only attribute."*

```python
try:
    payload = decode(frame)
except* UnicodeDecodeError as eg:
    for exc in eg.exceptions:            # a group even if `decode` raised exactly one
        logger.warning("bad byte at %d", exc.start)
    payload = None
```

The consistency is the point: without it, every clause body would have to open by asking
whether it had been handed one exception or many, which is precisely the branch the construct
exists to delete. The price is that no attribute of the original exception is reachable on
the target, and the failure mode is an `AttributeError` at the worst possible moment — inside
a handler, on the error path, where nothing else is going right either.

## `ExceptionGroup` vs `BaseExceptionGroup`, and what `except Exception` still catches

Two classes, split exactly on `Exception`:

> *"The difference between the two classes is that `BaseExceptionGroup` extends
> `BaseException` and it can wrap any exception, while `ExceptionGroup` extends `Exception`
> and it can only wrap subclasses of `Exception`. This design is so that `except Exception`
> catches an `ExceptionGroup` but not `BaseExceptionGroup`."*

> *"The `BaseExceptionGroup` constructor returns an `ExceptionGroup` rather than a
> `BaseExceptionGroup` if all contained exceptions are `Exception` instances, so it can be
> used to make the selection automatic. The `ExceptionGroup` constructor, on the other hand,
> raises a `TypeError` if any contained exception is not an `Exception` subclass."*

For a width argument, that design sentence is the load-bearing one. The reason a group
containing a `KeyboardInterrupt` is a `BaseExceptionGroup` is precisely so that a broad
`except Exception` upstream does not swallow it — the discipline from
[06c](06c-the-breadth-of-one-class.md) survives grouping. But notice *why* it survives: the
**constructor** chose the class by inspecting the leaves. Nothing your clause said protected
you. If you build a group yourself with the wrong constructor, you have moved a
`KeyboardInterrupt` inside the reach of every `except Exception` between you and the top of
the stack.

```python
# Let the constructor decide — it downgrades to ExceptionGroup only when it is safe to.
raise BaseExceptionGroup("shutdown", collected)   # collected may contain a KeyboardInterrupt
```

## Gotchas

**★ Symptom: an `except* ValueError` clause definitely ran, and an exception still came out
of the statement.** Cause: it was never a promise that one would not — *"the group of
unhandled exceptions is merged with any exceptions that were raised or re-raised from within
`except*` clauses. This merged exception group propagates on."* Fix: decide explicitly what
owns the residual — widen the last clause to the class you are prepared to own, or wrap the
whole statement so the leftovers have a home.

```python
try:
    try:
        results = gather_all(tasks)
    except* TimeoutError as eg:
        logger.warning("%d timed out", len(eg.exceptions))
        results = []
except* Exception as residual:     # the leaves the inner statement did not claim
    logger.exception("unhandled: %r", residual.exceptions)
    results = []
```

**★ Symptom: `AttributeError` on the `as` target — `eg.filename`, `eg.start` or `eg.errno`
does not exist.** Cause: the target is a group, not the exception. A flat exception matched
by an `except*` clause *"is caught and wrapped by an exception group with an empty message
string"*, so the type of the target is consistently `BaseExceptionGroup`. Fix: reach through
`.exceptions`, and loop rather than indexing, because the same code has to work when the
group really does hold several.

```python
try:
    handle = open(path)
except* OSError as eg:
    for exc in eg.exceptions:      # never `eg.filename`
        logger.error("%s: %s", exc.filename, exc.strerror)
    handle = None
```

**★ Symptom: `TypeError` raised at the `except*` clause instead of the clause handling
anything.** Cause: the matching type is a subclass of `BaseExceptionGroup`, and the reference
raises *"because that would have ambiguous semantics"* — a nested group is both a candidate
leaf and a container, with no obviously-correct reading. It is checked at match time, so it
hides in the source until something raises. Fix: match the leaf class; if you genuinely need
to filter on group-ness or on a predicate, catch the group with a plain `except` and use
`subgroup()`/`split()` explicitly.

```python
try:
    run_all(jobs)
except ExceptionGroup as eg:                 # plain except, not except*
    retryable, fatal = eg.split(TimeoutError)
    if fatal is not None:
        raise fatal
    retry_later(retryable.exceptions)
```

**Symptom: a `KeyboardInterrupt` disappears into a broad `except Exception` upstream after
you started grouping failures yourself.** Cause: the class was chosen by whichever constructor
you called. `ExceptionGroup` *"extends `Exception`"*, so an `ExceptionGroup` you built by hand
is catchable by `except Exception` regardless of what is inside it — and the `ExceptionGroup`
constructor's own `TypeError` guard only fires if a contained exception is not an `Exception`
subclass. Fix: construct with `BaseExceptionGroup` and let it downgrade, which the docs
describe as making *"the selection automatic"*.

```python
# The constructor inspects the leaves and returns ExceptionGroup only when all are Exception.
raise BaseExceptionGroup("worker shutdown", collected)
```

**Symptom: an error raised *by your handler* reaches the caller wrapped in a group, and the
caller's `except OSError` misses it.** Cause: the merge rule folds exceptions raised inside
`except*` clauses into the propagating group rather than letting them out flat. Fix: either
make the caller group-aware, or do not raise from inside the clause — record the decision and
raise after the statement, where an ordinary flat exception is still possible.

```python
try:
    ingest_all(sources)
except* ConnectionError as eg:
    unreachable = [e.host for e in eg.exceptions]   # collect, do not raise here
else:
    unreachable = []
if unreachable:
    raise SourcesUnavailable(unreachable)           # flat, outside the statement
```

## Interview questions

**★ Your `except* TimeoutError` clause ran and the caller still saw an exception. What
escaped?**
The residual group. After every clause has run, *"the group of unhandled exceptions is merged
with any exceptions that were raised or re-raised from within `except*` clauses"*, and that
merged group propagates on. So a clause running tells you a *subgroup* was handled, never
that the statement completed. This is the biggest practical difference between reading the
two grammars: after an `except` clause the next line runs; after an `except*` clause the next
line runs only if no leaf was left over. Anything you assign in a clause and use afterwards
needs either an outer handler or a final clause wide enough to own what remains.

**★ Why does `except* BlockingIOError as e` bind a group when the suite raised a single flat
`BlockingIOError`?**
For type consistency of the target. The reference wraps it — *"it is caught and wrapped by an
exception group with an empty message string. This ensures that the type of the target `e` is
consistently `BaseExceptionGroup`"* — and shows the bound value as `ExceptionGroup('',
(BlockingIOError(),))`. Without that rule every clause body would begin by asking whether it
had one exception or many, which is exactly the branch `except*` exists to remove. The cost
shows up as an `AttributeError` the first time someone writes `e.errno`: the attributes live
on the leaves, reachable through `e.exceptions`.

**★ Why is matching on a `BaseExceptionGroup` subclass a `TypeError` rather than simply never
matching?**
Because the intent is genuinely ambiguous, and the reference says so — a `TypeError` is
raised *"because that would have ambiguous semantics"*. A group nested inside a group is both
a candidate leaf (the split could match the group object itself) and a container (the split
could descend into it), and neither reading is obviously right. Failing loudly beats picking
one silently. The sharp edge is *when* it fails: this is evaluated during the handler search,
so `except* ExceptionGroup:` is perfectly valid syntax that only raises the day the suite
does, turning a handler into a new failure.

**★ How do you filter a group on something that is not a type — a predicate, a host, an error
code?**
Not with `except*`, which only takes a type. Catch the group with a plain `except
ExceptionGroup` and call `subgroup()` or `split()` yourself: the condition *"can also be a
callable (other than a type object) that accepts an exception as its single argument and
returns true for the exceptions that should be in the subgroup"*, and `split()` returns
*"the pair `(match, rest)`"* so you keep the part you did not claim and can re-raise it. That
is also the honest answer to "how do I do `except*` with a `finally`-style guarantee about
the remainder" — once you are calling `split()`, ownership of `rest` is explicit in the code
rather than implied by the grammar.

**In a topic about narrowing the `try`, when is `except*` the right tool at all?**
Only when the API you are calling is documented to raise a group — concurrency primitives
that run several things and collect every failure are the canonical case, and
[11 · 08 Exception groups](../11-exceptions/08-exception-groups.md) covers which ones and
what they promise. For ordinary sequential code `except*` is strictly worse: you lose
`return` out of the handler, your `as` target needs unwrapping, and you acquire a residual
you now have to find a home for. The decision is the same one the whole 06 sequence makes
about width — match the shape of the failure channel the callee actually documents, rather
than the shape you would prefer, and put the boundary where the two shapes meet.

---

← Prev: [`except*` does not mix](06r-except-star-does-not-mix.md) · Index: [EAFP vs LBYL](README.md) · Next → [Ambient state](06j-ambient-state-the-guard-cannot-see.md)
