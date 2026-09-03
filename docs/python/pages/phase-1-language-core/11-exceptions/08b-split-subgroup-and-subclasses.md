---
title: "`split` and `subgroup` are the group API `except*` is built on — and a subclass that does not override `derive` quietly stops being itself"
sidebar_label: "8b · `split`, `subgroup`, subclasses"
sidebar_position: 128
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`BaseExceptionGroup.subgroup`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.subgroup),
> [`split`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.split),
> [`derive`](https://docs.python.org/3.14/library/exceptions.html#BaseExceptionGroup.derive),
> [`asyncio.TaskGroup`](https://docs.python.org/3.14/library/asyncio-task.html#task-groups),
> [`asyncio.CancelledError`](https://docs.python.org/3.14/library/asyncio-exceptions.html#asyncio.CancelledError),
> and [PEP 654](https://peps.python.org/pep-0654/).
> Target: **CPython 3.14**.

[The previous chunk](08-exception-groups.md) built and raised groups. This one
takes them apart. Everything here is ordinary library API — no new syntax — which
matters twice over: it is what `except*` is implemented in terms of, and it is
the only way to handle a group on a Python that cannot parse `except*` at all.

## `split`, `subgroup` and the fields they carry

These are the tools for handling part of a group programmatically — and they are
what `except*` is built on:

```python
group = ExceptionGroup("batch", [OSError("disk"), ValueError("row 4")])

retryable, permanent = group.split(OSError)   # (match, rest), either may be None
disk_only = group.subgroup(OSError)           # match, or None
```

The condition is an exception type, a tuple of types, or — since **3.13** — any
callable that takes an exception and returns a truth value:

```python
transient, rest = group.split(lambda e: getattr(e, "retryable", False))
```

What survives the operation matters:

> The nesting structure of the current exception is preserved in the result, as
> are the values of its `message`, `__traceback__`, `__cause__`, `__context__`
> and `__notes__` fields. Empty nested groups are omitted from the result.

So splitting is not lossy. And the condition is checked at every level,
including on the nested groups themselves — if a nested *group* matches, *"it is
included in the result in full."*

## Subclassing a group: override `derive`, and maybe `__new__`

`split` and `subgroup` have to build new groups, and by default they build
plain `ExceptionGroup`s — which silently discards your subclass:

```python
class ImportErrors(ExceptionGroup):
    def derive(self, excs):
        return ImportErrors(self.message, excs)
```

> A subclass needs to override it in order to make `subgroup()` and `split()`
> return instances of the subclass rather than `ExceptionGroup`.

You do not have to copy the metadata: *"`subgroup()` and `split()` copy the
`__traceback__`, `__cause__`, `__context__` and `__notes__` fields from the
original exception group to the one returned by `derive()`."*

And the constructor rule that surprises everyone:

> Note that `BaseExceptionGroup` defines `__new__()`, so subclasses that need a
> different constructor signature need to override that rather than
> `__init__()`.

```python
class Errors(ExceptionGroup):
    def __new__(cls, errors, exit_code):
        self = super().__new__(Errors, f"exit code: {exit_code}", errors)
        self.exit_code = exit_code
        return self

    def derive(self, excs):
        return Errors(excs, self.exit_code)
```

## Where you will meet one without asking

`asyncio.TaskGroup` (3.11) is the common route:

> Once all tasks have finished, if any tasks have failed with an exception other
> than `asyncio.CancelledError`, those exceptions are combined in an
> `ExceptionGroup` or `BaseExceptionGroup` (as appropriate; see their
> documentation) which is then raised.

Two details worth carrying: *"The first time any of the tasks belonging to the
group fails with an exception other than `asyncio.CancelledError`, the remaining
tasks in the group are cancelled"* — so a group from a `TaskGroup` usually holds
one real failure plus cancellations — and the base-exception exemption:

> If any task fails with `KeyboardInterrupt` or `SystemExit`, the task group
> still cancels the remaining tasks and waits for them, but then the initial
> `KeyboardInterrupt` or `SystemExit` is re-raised instead of `ExceptionGroup`
> or `BaseExceptionGroup`.

The practical consequence for any code that awaits a `TaskGroup`: a handler
written as `except ValueError:` will not fire, because what arrives is a group
*containing* a `ValueError`. That is what
[`except*`](08c-except-star-semantics.md) is for.

## Handling part of a group, by hand

The shape `except*` gives you for free, written out — take what you understand,
re-raise the rest:

```python
try:
    run_batch(records)
except ExceptionGroup as eg:
    retryable, rest = eg.split(TransientError)
    if retryable is not None:
        requeue(retryable.exceptions)
    if rest is not None:
        raise rest        # the failures nobody here can answer
```

🔴 **`if rest is not None: raise rest` is not optional.** Drop it and you have
written a silent swallow of every failure you did not think about — the
[bare `except:`](04b-the-bare-except.md) mistake with extra steps. `except*`
does this re-raise for you, which is most of its value.

Note that `raise rest` re-raises a group whose members keep their original
tracebacks, because `split` preserves `__traceback__`.

## Walking a nested group

`exceptions` is one level deep, so anything that needs every leaf has to
recurse. There is no builtin for it; this is the whole of it:

```python
def leaves(exc):
    if isinstance(exc, BaseExceptionGroup):
        for member in exc.exceptions:
            yield from leaves(member)
    else:
        yield exc

counts = collections.Counter(type(e).__name__ for e in leaves(eg))
```

That `Counter` is usually what an operator actually wants from a batch failure —
*"4,102 × ConnectionResetError, 3 × ValueError"* — rather than the first fifteen
tracebacks the formatter is willing to print.

## Gotchas

**★ Symptom — a handler that worked for years stops firing after moving work
into an `asyncio.TaskGroup`.** Cause: the exception now arrives wrapped in an
`ExceptionGroup`, and `except ValueError:` does not match a group that
*contains* a `ValueError`. Fix: `except*`, or catch the group and split it.

```python
try:
    async with asyncio.TaskGroup() as tg:
        for url in urls: tg.create_task(fetch(url))
except* ValueError as eg:
    handle(eg.exceptions)
```

**★ Symptom — a custom group subclass comes back as a plain `ExceptionGroup`
after `split`, and downstream `isinstance` checks fail.** Cause: `derive` was
not overridden, so the split built the base class. Fix: override `derive`; and
if the constructor signature differs, override `__new__` rather than
`__init__`, because `BaseExceptionGroup` defines `__new__`.

**★ Symptom — `AttributeError: 'NoneType' object has no attribute
'exceptions'`.** Cause: `subgroup`/`split` return `None` for an empty result,
and the code went straight to `.exceptions`. Fix: test for `None` — it is the
documented "nothing matched" answer, not an error.

```python
match = eg.subgroup(TransientError)
for exc in (match.exceptions if match else ()):
    requeue(exc)
```

**★ Symptom — filtering for `ValueError` returns members that are not
`ValueError`s.** Cause: the condition is checked against nested *groups* too,
and the docs say if it is true for a nested group *"it is included in the result
in full"*. Fix: that is the rule — filter the leaves yourself if you need
per-exception precision, using a walk rather than a single `subgroup`.

**★ Symptom — a group from a `TaskGroup` is mostly `CancelledError` and the real
failure is hard to find.** Cause: documented behaviour — the first non-cancel
failure cancels the remaining tasks, so their `CancelledError`s land in the same
group. Fix: split them off before reporting.

```python
real, _cancels = eg.split(lambda e: not isinstance(e, asyncio.CancelledError))
```

**★ Symptom — a batch retries forever, or retries work that already succeeded.**
Cause: the retry re-ran the whole batch because the *group* was caught, rather
than the members `split` identified as retryable. Fix: retry
`match.exceptions`' payloads only, and re-raise `rest` immediately.

**★ Symptom — a group is caught, partly handled, and the remaining failures
never surface anywhere.** Cause: `rest` was computed and dropped. Fix:
`if rest is not None: raise rest`. This is the single most common bug in
hand-written group handling, and the reason to prefer `except*` when the syntax
is available.

**★ Symptom — a `subgroup` call raises something unrelated from inside the
condition.** Cause: a callable condition that touches attributes not every
member has — `lambda e: e.retryable` over a mixed group. Fix: `getattr(e,
"retryable", False)`, or narrow by type first.

## Interview questions

**★ Q: Your `except ValueError:` stopped catching after a refactor to
`asyncio.TaskGroup`. Why?**
A `TaskGroup` combines task failures into an `ExceptionGroup` (or
`BaseExceptionGroup`), and a group containing a `ValueError` is not a
`ValueError`. Handle it with `except* ValueError:`, or catch the group and use
`split`/`subgroup`. The group will also usually carry `CancelledError`s, because
the first real failure cancels the group's remaining tasks.

**★ Q: How do you take only the retryable failures out of a group?**
`match, rest = group.split(condition)`, where the condition is an exception
type, a tuple of types, or — since 3.13 — any callable taking an exception.
`match` holds the matching members, `rest` the others, and either can be
`None`. Retry `match`, then `raise rest` if it is not `None`; forgetting that
re-raise is how failures get swallowed.

**★ Q: You subclass `ExceptionGroup` to carry an extra field. What must you
override?**
`derive`, so `split` and `subgroup` return your subclass instead of a plain
`ExceptionGroup` — and `__new__` rather than `__init__` if the constructor
signature differs, because `BaseExceptionGroup` defines `__new__`. You do not
need to copy `__traceback__`, `__cause__`, `__context__` or `__notes__`; the
split copies those onto whatever `derive` returns.

**Q: What does `split` preserve, and why does that matter?**
The nesting structure, and the `message`, `__traceback__`, `__cause__`,
`__context__` and `__notes__` fields; empty nested groups are dropped. It
matters because it makes partial handling non-destructive — you can pull the
transient failures out of a group, re-raise the rest, and the re-raised half
still has the tracebacks and notes it was created with.

**Q: How do you get every individual exception out of a nested group?**
Recurse: `exceptions` is one level deep, so walk it and yield the members that
are not themselves `BaseExceptionGroup`s. There is no builtin flatten. In
practice a `Counter` over the leaf type names is a better report than the
tracebacks, because the formatter truncates at 15 wide and 10 deep anyway.

**Q: Why does any of this API exist when `except*` does the same thing?**
Because `except*` is syntax and this is not. `split` and `subgroup` work on a
Python whose parser predates `except*`, they work inside a function that takes
the condition as a parameter, and they are what a framework uses to implement
its own partial-failure policy. `except*` is the ergonomic case of the same
operation.

---

← Prev: [Exception groups](08-exception-groups.md) · Index: [Exceptions](README.md) · Next → [`except*` semantics](08c-except-star-semantics.md)
