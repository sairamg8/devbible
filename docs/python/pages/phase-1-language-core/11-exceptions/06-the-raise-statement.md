---
title: "A bare `raise` re-raises the active exception with its traceback intact; `raise e` re-raises the same object but adds the current frame to it"
sidebar_label: "6 · The `raise` statement"
sidebar_position: 124
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement)
> and [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause),
> the Library Reference
> [`BaseException.with_traceback`](https://docs.python.org/3.14/library/exceptions.html#BaseException.with_traceback)
> and [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception),
> and the Tutorial
> [Raising Exceptions](https://docs.python.org/3.14/tutorial/errors.html#raising-exceptions).
> Error message texts checked against CPython 3.14.4.
> Target: **CPython 3.14**.

**`raise` has three forms — bare, with an exception, and with `from` — and the
difference between the first two is the single most consequential detail in
debugging Python. A bare `raise` inside a handler continues the *existing*
exception, with its traceback pointing at the line that originally failed.
`raise e` on the same object continues it too, but appends the current frame, so
the traceback now includes the handler as if it were part of the failure. Neither
loses information, but people reach for `raise e` believing it is the same thing
and then wonder why every stack trace in their logs starts in the wrapper.**

## The grammar and the three forms

```text
raise_stmt: "raise" [expression ["from" expression]]
```

- `raise` — re-raise the active exception.
- `raise X` — raise `X`, chaining implicitly to whatever was being handled.
- `raise X from Y` — raise `X`, chaining explicitly. That is
  [06b](06b-exception-chaining.md).

## Bare `raise`

> *"If no expressions are present, `raise` re-raises the exception that is
> currently being handled, which is also known as the active exception. If there
> isn't currently an active exception, a `RuntimeError` exception is raised
> indicating that this is an error."*

On CPython 3.14.4 that error's message is `No active exception to reraise`.

The active exception is the one stored in `sys` for the duration of the handler,
which is why a bare `raise` needs no name:

```python
try:
    charge(order)
except PaymentDeclined:
    metrics.incr("payment.declined")
    raise                    # same exception, same traceback, plus this frame
```

This is the correct shape for **observe and pass on**: log it, count it, add a
note, roll something back — then let it continue to whoever can actually decide
what to do. It is also the shape PEP 8 names as one of the two acceptable uses of
a broad handler: *"if the code needs to do some cleanup work, but then lets the
exception propagate upwards with `raise`."*

Where "active exception" extends to:

- inside an `except` clause — the exception it caught;
- inside a `finally` clause on the unwind path — the parked exception (though a
  bare `raise` there is a code smell: the exception is going to be re-raised
  anyway);
- inside a `__exit__` method while handling an exception;
- **not** inside an `else` clause, and not in ordinary code — a bare `raise`
  there is the `RuntimeError`.

## `raise X` where X is a class or an instance

> *"Otherwise, `raise` evaluates the first expression as the exception object. It
> must be either a subclass or an instance of `BaseException`. If it is a class,
> the exception instance will be obtained when needed by instantiating the class
> with no arguments."*

So `raise ValueError` and `raise ValueError()` mean the same thing. The tutorial:
*"`raise ValueError` — shorthand for `raise ValueError()`"*.

Anything that is not a `BaseException` subclass or instance is a `TypeError`
whose message on 3.14.4 is `exceptions must derive from BaseException`. That
includes strings, which is the classic mistake carried over from other languages
and from Python 1.x:

```python
raise "config missing"          # TypeError, not a useful error
raise ConfigMissing("config missing")
```

The `raise Class` shorthand is worth avoiding for any exception whose constructor
takes arguments — instantiating with no arguments means an empty `args`, and an
empty message. `raise ValidationError` where the class expects a field name
produces an exception that tells nobody anything.

## Bare `raise` versus `raise e` — the traceback difference

Both continue the same exception object. The difference is what the traceback
ends up containing:

```python
try:
    work()
except Error:
    raise           # traceback: original raise site, then this frame

try:
    work()
except Error as e:
    raise e         # traceback: original raise site, this frame, AND the
                    # `raise e` line recorded as a separate entry
```

`raise e` re-raises an object that already has a `__traceback__`, and the raise
appends the current location to it. Practically, `raise e` inside the handler
that caught it produces a traceback with the handler line in it as though the
handler were part of the failure path; the original site is still there,
underneath. The bug is not lost information, it is *noise* — every trace in your
logs gains a frame that says nothing, and in a chain of wrappers each one adds
another.

There is also a correctness reason to prefer the bare form: `raise e` requires
the `as` name, and [that name is deleted at the end of the
handler](05c-the-as-target-is-deleted.md), so `raise e` is only ever valid inside
the block. Bare `raise` works anywhere the exception is active.

**Rule: inside the handler that caught it, always bare `raise`.** Use `raise e`
only when `e` is an exception you are re-raising from somewhere else — one you
stored in a list, or received from a `Future`, or built yourself.

## `with_traceback` and the 3.11 change

> *"A traceback object is normally created automatically when an exception is
> raised and attached to it as the `__traceback__` attribute. You can create an
> exception and set your own traceback in one step using the `with_traceback()`
> exception method (which returns the same exception instance, with its traceback
> set to its argument)"*

```python
raise Exception("foo occurred").with_traceback(tracebackobj)
```

This is a framework tool: re-raising an exception that travelled across a thread,
a process or an event loop, where you want the traceback from where it was
*raised* rather than from where it was received. `concurrent.futures` and
`asyncio` do this internally.

A behaviour change worth knowing if you maintain anything that edits tracebacks:

> *"Changed in version 3.11: If the traceback of the active exception is modified
> in an `except` clause, a subsequent `raise` statement re-raises the exception
> with the modified traceback. Previously, the exception was re-raised with the
> traceback it had when it was caught."*

So a library that trims internal frames (`pytest` and `hypothesis` both do this)
can mutate `__traceback__` and then bare-`raise`, and the edit sticks.

## `raise` in a loop, and the value of raising early

The other everyday use of `raise` is not re-raising at all — it is failing fast
on a precondition, so that the error names the real cause rather than a symptom
three functions later:

```python
def schedule(job, at):
    if at < now():
        raise ValueError(f"scheduled time {at} is in the past")
    ...
```

The alternative — returning `None`, or logging and continuing — moves the failure
to whichever caller first tries to use the missing result, which is where you
will read about it in a `TypeError: 'NoneType' object is not subscriptable`.
Which of those a function should do is the
`None`-versus-raise contract question, and it belongs to
[`None`, and the "no result" contract](../14-none-and-no-result/README.md).

## Gotchas

**★ Symptom — every traceback in the logs has the same wrapper frame in it, one
level deeper than the code that actually failed.** Cause: `raise e` inside the
handler that caught `e`, which appends the handler's own line to the traceback.
Fix: bare `raise` inside the handler that caught it. Reserve `raise e` for
exceptions arriving from elsewhere.

**★ Symptom — `RuntimeError: No active exception to reraise`.** Cause: a bare
`raise` where nothing is being handled — commonly in an `else` clause, in a
helper function called *from* a handler but returning before the raise, or in
code refactored out of an `except` block. Fix: pass the exception explicitly and
`raise e` from the new location, or keep the `raise` inside the handler.

**★ Symptom — `TypeError: exceptions must derive from BaseException`.** Cause:
`raise "some message"`, or raising a class that is not an exception. Fix: raise an
actual exception class or instance. Strings have not been raisable since Python
2.6.

**Symptom — a custom exception's message is empty when raised.** Cause: `raise
MyError` (the class, not an instance) — the reference says the class *"will be
obtained when needed by instantiating the class with no arguments"*, so a
constructor expecting a message gets none. Fix: `raise MyError("what happened")`.
Reserve the bare-class form for exceptions with no useful arguments.

**Symptom — a helper function `def _fail(): raise` does not work.** Cause: the
active exception is a property of the handler, and by the time the helper runs it
is still active — but if the helper is called anywhere else, or after the handler
has been left, there is no active exception. Fix: pass the exception in and re-raise
it explicitly, or keep the `raise` at the call site.

**Symptom — a re-raised exception's traceback is missing frames after crossing a
thread or process boundary.** Cause: the exception was pickled or reconstructed
and the traceback did not survive. Fix: `raise e.with_traceback(tb)` if you
captured the traceback separately, or format the traceback to a string at capture
time — `traceback.format_exception(e)` — and log that alongside.

**Symptom — `raise` inside a `finally` re-raises something unexpected.** Cause:
the exception information is *not* available in the `finally` clause per the
reference, so a bare `raise` there is not reading what you think. Fix: do not
bare-`raise` in a `finally`; the parked exception is re-raised automatically at
the end of it.

**Symptom — an exception raised inside an `except` block loses its relationship
to the original.** Cause: it does not — implicit chaining attaches the original
as `__context__`. What *does* lose it is `raise ... from None`. Fix: see
[06b · Exception chaining](06b-exception-chaining.md).

## Interview questions

**★ Q: What is the difference between `raise` and `raise e` inside an `except`
block?**
Both continue the same exception object. A bare `raise` re-raises the active
exception as it stands. `raise e` re-raises an object that already carries a
`__traceback__`, and appends the current location to it — so the handler's own
line appears in the traceback as if it were part of the failure. Use the bare
form inside the handler that caught the exception; use `raise e` only for an
exception that arrived from elsewhere.

**★ Q: What happens if you use a bare `raise` when nothing is being handled?**
`RuntimeError` — on 3.14.4 the message is `No active exception to reraise`. The
reference says a bare `raise` re-raises *"the exception that is currently being
handled"* and that the absence of one is an error.

**★ Q: When should a handler re-raise?**
Whenever it does not actually resolve the failure. Logging, counting, adding a
note, rolling back and closing are all *observations*; the decision about what
the failure means belongs further up. PEP 8 names this as one of the two
legitimate uses of a broad handler — do the cleanup, then *"let the exception
propagate upwards with `raise`"*.

**Q: Is `raise ValueError` the same as `raise ValueError()`?**
Yes — the reference says a class *"will be obtained when needed by instantiating
the class with no arguments"*. But for a custom exception whose constructor takes
a message or fields, the bare-class form silently produces an argument-free
instance, so prefer the explicit call whenever the constructor takes anything.

**Q: Can you raise a string?**
No. `TypeError: exceptions must derive from BaseException`. Raising strings was
removed in Python 2.6.

**Q: What is `with_traceback` for?**
Attaching a specific traceback to an exception you are about to raise — the
docs describe it as returning *"the same exception instance, with its traceback
set to its argument"*. It matters when an exception crosses a boundary (a thread,
a process, a future) and you want the traceback from where it was raised rather
than where it was received.

**Q: What changed in 3.11 about re-raising?**
If the active exception's traceback is modified inside an `except` clause, a
later bare `raise` re-raises it with the *modified* traceback; previously it used
the traceback the exception had when it was caught. This is what lets test
frameworks trim their own frames out of a failure and have the trimming survive
the re-raise.

---

← Prev: [The deleted `as` target](05c-the-as-target-is-deleted.md) · Index: [Exceptions](README.md) · Next → [Exception chaining](06b-exception-chaining.md)
