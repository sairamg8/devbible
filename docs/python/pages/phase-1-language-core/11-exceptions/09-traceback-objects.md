---
title: "The traceback is an object on the exception, most-recent-call-last, and the only part of a failure that cannot be reconstructed later"
sidebar_label: "9 · Traceback objects"
sidebar_position: 130
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`traceback`](https://docs.python.org/3.14/library/traceback.html),
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception),
> [`sys.exc_info`](https://docs.python.org/3.14/library/sys.html#sys.exc_info),
> [`sys.excepthook`](https://docs.python.org/3.14/library/sys.html#sys.excepthook),
> [`sys.unraisablehook`](https://docs.python.org/3.14/library/sys.html#sys.unraisablehook),
> [`sys.tracebacklimit`](https://docs.python.org/3.14/library/sys.html#sys.tracebacklimit),
> [`threading.excepthook`](https://docs.python.org/3.14/library/threading.html#threading.excepthook),
> [`BaseException.__traceback__`](https://docs.python.org/3.14/library/exceptions.html#BaseException.__traceback__),
> and [`with_traceback`](https://docs.python.org/3.14/library/exceptions.html#BaseException.with_traceback).
> Target: **CPython 3.14**.

The type and the message you can always recover — they are on the exception, and
you could re-raise it tomorrow. The traceback you cannot: it is a record of
frames that no longer exist, attached to the exception object, and every way of
losing a failure's diagnosis comes down to letting that object go while keeping
a string.

## Where it lives

> `BaseException.__traceback__` — A writable field that holds the traceback
> object associated with this exception.

So the traceback travels **with** the exception. Anything that has the exception
has the traceback; anything that has only `str(exc)` has thrown it away.

Two functions reach the exception being handled. The modern one:

> `sys.exception()` — This function, when called while an exception handler is
> executing (such as an `except` or `except*` clause), returns the exception
> instance that was caught by this handler. When exception handlers are nested
> within one another, only the exception handled by the innermost handler is
> accessible. If no exception handler is executing, this function returns
> `None`.

And the one every older codebase uses:

> `sys.exc_info()` — This function returns the old-style representation of the
> handled exception. If an exception `e` is currently handled (so `exception()`
> would return `e`), `exc_info()` returns the tuple `(type(e), e,
> e.__traceback__)`.

Three `None`s if nothing is being handled. Since 3.11 the type and traceback are
*derived from the value*, so mutating the exception mid-handling is reflected in
later `exc_info()` calls — the tuple is a view, not a snapshot.

New code has no reason to use `exc_info()` except where an API demands the
tuple, and `logging` is exactly that API — see
[logging exceptions](12-logging-exceptions.md).

## Most recent call last

The header the interpreter prints — *Traceback (most recent call last)* — is the
reading instruction. The **last** frame is where the exception was raised; the
first is the outermost caller. Two consequences:

- Read a traceback **from the bottom**. The bottom-most frame plus the exception
  line is the failure; everything above is how you got there.
- In a chained traceback the *last* block is the exception that reached the top,
  and the blocks above it are its cause or context, printed oldest-first. Which
  is why *"During handling of the above exception…"* appearing near the top
  means the interesting exception is the one at the bottom — see
  [exception chaining](06b-exception-chaining.md).

Since 3.11 the frame lines carry column markers under the failing sub-expression
(PEP 657), which is what makes `a.b.c().d` diagnosable at a glance instead of by
bisection.

## Formatting it yourself

The `traceback` module *"provides a standard interface to extract, format and
print stack traces of Python programs."* The four you need:

```python
traceback.print_exc()                     # to stderr, the active exception
traceback.format_exc()                    # the same thing as a string
traceback.print_exception(exc)            # a specific exception object
traceback.format_exception(exc)           # ... as a list of strings
```

`print_exc(limit=None, file=None, chain=True)` is documented as *"shorthand for
`print_exception(sys.exception(), limit=limit, file=file, chain=chain)`"* — so
it only means anything inside a handler, because outside one `sys.exception()`
is `None`.

Since **3.10** you pass the exception object itself rather than the old
three-tuple: `print_exception(exc, /, [value, tb,] limit=None, file=None,
chain=True)`. The `chain` flag is worth knowing about explicitly:

> If _chain_ is true (the default), then chained exceptions (the `__cause__` or
> `__context__` attributes of the exception) will be printed as well, like the
> interpreter itself does when printing an unhandled exception.

`chain=False` is how you deliberately log one exception without its history.

## Capturing a failure without holding the frames

A traceback object references frames, which reference their locals, which
reference everything those locals point at. Keeping an exception in a list to
report later keeps that whole graph alive. `TracebackException` exists for this:
it captures the *rendered* information and lets the frames go.

```python
tbe = traceback.TracebackException.from_exception(exc)
...
report("".join(tbe.format()))          # a generator of strings, chain=True by default
```

`from_exception(exc, *, limit=None, lookup_lines=True, capture_locals=False,
compact=False, max_group_width=15, max_group_depth=10)`. Two flags matter in
production: `lookup_lines` decides whether source lines are read eagerly (set it
`False` and the source may be gone by the time you format), and
`capture_locals` includes each frame's variables in the output — which is
enormously useful in a debugger and a data-leak in a log, because locals are
where the password parameter is.

`max_group_width` and `max_group_depth` truncate
[exception groups](08-exception-groups.md); `format_exception_only(*,
show_group=False)` (3.13) renders just the exception lines.

## The three hooks above your code

When nothing catches an exception, one of three hooks runs:

| Hook | Fires for | Note |
|---|---|---|
| `sys.excepthook(type, value, traceback)` | an uncaught exception in the main thread, other than `SystemExit` | *"just before the program exits"*; assign a three-argument function to customise |
| `threading.excepthook(args)` | *"uncaught exception raised by `Thread.run()`"* | `args` carries `exc_type`, `exc_value`, `exc_traceback`, `thread`; `SystemExit` is silently ignored, everything else prints to stderr. Added 3.8 |
| `sys.unraisablehook(unraisable)` | an exception with *"no way for Python to handle it. For example, when a destructor raises an exception or during garbage collection"* | the one that catches `__del__` failures |

`sys.excepthook` does **not** fire for a thread's exception — that is
`threading.excepthook`'s job, and `sys.excepthook` is only reached if the
threading hook itself raises. A crash reporter that installs only the former
silently misses every worker thread.

The threading docs also carry the warning that decides how you write such a
hook: *"Storing `exc_value` using a custom hook can create a reference cycle. It
should be cleared explicitly to break the reference cycle when the exception is
no longer needed."*

`sys.tracebacklimit` caps how much is printed for an uncaught exception —
*"When this variable is set to an integer value, it determines the maximum
number of levels of traceback information printed… The default is `1000`. When
set to `0` or less, all traceback information is suppressed and only the
exception type and value are printed."* Setting it to 0 in production to "clean
up" the logs is deleting the only copy of the diagnosis.

## `with_traceback`

```python
raise OtherException(...).with_traceback(tb)
```

The reference notes it *"was more commonly used before the exception chaining
features of PEP 3134 became available"* — which is the honest summary. `raise …
from exc` says the same thing better and keeps both tracebacks. Reach for
`with_traceback` only when re-raising an exception you carried across a boundary
that lost the frames, such as a worker returning an exception object.

## Gotchas

**★ Symptom — `traceback.format_exc()` reports no exception, in a function that
is definitely called after a failure.** Cause: it is shorthand for
`print_exception(sys.exception(), …)`, and `sys.exception()` returns `None`
outside a handler — the call moved into a helper that runs after the `except`
block ended. Fix: pass the exception explicitly.

```python
def report(exc):                       # not: report() using format_exc()
    log.error("%s", "".join(traceback.format_exception(exc)))
```

**★ Symptom — a worker thread dies and the crash reporter installed via
`sys.excepthook` logs nothing.** Cause: uncaught exceptions in `Thread.run()`
go to `threading.excepthook`. Fix: install both, and remember `args.exc_value`
can be `None`.

```python
threading.excepthook = lambda args: report(args.exc_value, thread=args.thread)
```

**★ Symptom — memory grows in a service that accumulates failures for a summary
report.** Cause: each stored exception holds its traceback, which holds every
frame and every local in them. Fix: store `TracebackException.from_exception`
output, or the formatted string, and drop the exception.

**★ Symptom — passwords, tokens or full request bodies appear in error
reports.** Cause: `capture_locals=True`, or a reporting library that captures
frame locals by default. Fix: leave it off in production, or scrub — locals are
exactly where credentials sit.

**★ Symptom — an exception logged from a `__del__` method or a weakref callback
never appears in the log.** Cause: that is an *unraisable* exception; it goes to
`sys.unraisablehook`, not to the exception machinery. Fix: install
`sys.unraisablehook` if finalizer failures matter, and prefer not to raise in
`__del__` at all.

**★ Symptom — the traceback in the log is one frame long and useless.** Cause:
`sys.tracebacklimit` was set low, or a handler formatted with `limit=1`. Fix:
remove the limit; if log volume is the problem, sample whole tracebacks rather
than truncating every one.

**★ Symptom — a nested handler logs the wrong exception.** Cause:
`sys.exception()` returns only the innermost handled exception, so a helper
called from an inner `except` sees that one, not the outer. Fix: pass the
exception you mean as an argument rather than looking it up.

**★ Symptom — an exception stored in `except E as e:` and used after the block
is a `NameError`.** Cause: the `as` target is deleted at the end of the clause —
see [the deleted `as` target](05c-the-as-target-is-deleted.md). Fix: assign it
to another name inside the block if you genuinely need it later, and accept the
lifetime that comes with it.

**★ Symptom — two log lines for one failure, one with a traceback and one
without.** Cause: something logged `str(exc)` and something else logged with
`exc_info`. Fix: one place logs the failure, with the exception object — see
[logging exceptions](12-logging-exceptions.md).

## Interview questions

**★ Q: How do you read a traceback?**
From the bottom. The header says *most recent call last*, so the final frame is
where the exception was raised and the line under it is the exception itself.
Frames above are the call chain. If there are several blocks, they are chained
exceptions printed oldest-first, so the bottom block is what actually reached
the top of the program. Since 3.11 the caret markers point at the exact
sub-expression that failed.

**★ Q: `sys.exception()` or `sys.exc_info()`?**
`sys.exception()` (3.11+) returns the exception instance being handled, or
`None` outside a handler. `sys.exc_info()` returns the old three-tuple
`(type(e), e, e.__traceback__)` — derived from the instance since 3.11 — and
exists for APIs that still want it, `logging`'s `exc_info` being the common one.
Prefer the former in new code.

**★ Q: How do you keep a failure for later reporting without keeping the frames
alive?**
`traceback.TracebackException.from_exception(exc)`, which captures what is
needed to render the traceback and releases the frames — then `"".join(
tbe.format())` when you report. Storing the exception itself keeps its
traceback, its frames and all their locals alive for as long as you hold it.

**Q: What is `exc.__traceback__`?**
A writable attribute holding the traceback object for that exception, which is
why passing the exception around passes the diagnosis around. `with_traceback`
sets it and returns the exception, though `raise … from exc` is the better tool
now.

**Q: How do you install a global handler for uncaught exceptions?**
`sys.excepthook` for the main thread, `threading.excepthook` for exceptions out
of `Thread.run()`, and `sys.unraisablehook` for the ones with nowhere to go —
destructors and garbage collection. All three, or the reporter has blind spots.
Clear any stored `exc_value` in a custom hook, since holding it creates a
reference cycle.

**Q: What does `chain=False` do when formatting?**
It formats the exception without its `__cause__`/`__context__` history. Useful
when you have already logged the cause and want one line about the consequence;
harmful as a default, because the cause is usually the answer.

**Q: Why is truncating tracebacks in production a bad trade?**
Because the traceback is the only part of a failure that cannot be
reconstructed. The type and message can be inferred from a log line; the frames
cannot be recovered once the process has moved on. If volume is the problem,
sample or aggregate whole tracebacks rather than shortening all of them.

---

← Prev: [`except*` semantics](08c-except-star-semantics.md) · Index: [Exceptions](README.md) · Next → [`assert`](10-assert.md)
