---
title: "`except E as e:` deletes `e` when the block ends — deliberately, to break a reference cycle that would keep the whole frame alive"
sidebar_label: "5c · The deleted `as` target"
sidebar_position: 123
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause)
> and [`del`](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> the Library Reference
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html)
> and [`BaseException.__traceback__`](https://docs.python.org/3.14/library/exceptions.html#BaseException.__traceback__).
> Exception class names for the failure case checked against CPython 3.14.4.
> Target: **CPython 3.14**.

**The name you bind with `as` does not survive the handler. Python deletes it at
the end of the `except` block — not "it goes out of scope", but an actual `del`,
compiled in, wrapped in its own `finally` so it happens even if the handler
raises. This surprises everyone once, and the surprise is worth converting into
understanding, because the reason is a real memory problem: an exception holds
its traceback, the traceback holds the frame, and the frame holds every local in
it — including the exception. Left alone, catching an exception would pin an
entire stack frame's worth of objects until the cycle collector got round to it.**

## What the reference says

> *"When an exception has been assigned using `as target`, it is cleared at the
> end of the `except` clause. This is as if:*
>
> ```python
> except E as N:
>     foo
> ```
>
> *was translated to:*
>
> ```python
> except E as N:
>     try:
>         foo
>     finally:
>         del N
> ```
>
> *This means the exception must be assigned to a different name to be able to
> refer to it after the `except` clause. Exceptions are cleared because with the
> traceback attached to them, they form a reference cycle with the stack frame,
> keeping all locals in that frame alive until the next garbage collection
> occurs."*

Three separate facts in there, all load-bearing.

**It is a `del`, not a scope rule.** Python has no block scope; every other name
bound inside an `except` block outlives it. This one name is special-cased.

**The `del` is inside a `finally`.** So the name is removed even when the handler
body raises or returns.

**The reason is the cycle.** `exception.__traceback__` → traceback object →
frame object → the frame's locals → the exception. A cycle that reference
counting alone cannot collect, holding every local variable in the frame,
including large ones.

## The failure it produces

```python
def parse(raw):
    try:
        return json.loads(raw)
    except ValueError as e:
        pass
    log.error("bad payload: %s", e)      # e is gone by here
```

On CPython 3.14.4 this raises `UnboundLocalError: cannot access local variable
'e' where it is not associated with a value` — because `e` is a function local
that has been deleted. `UnboundLocalError` is a subclass of `NameError`, so
`except NameError:` catches it, and older material describing this as a
`NameError` is not wrong. At module level, where the name is a global rather than
a local, the same code raises `NameError: name 'e' is not defined`.

The variant that catches people out even harder:

```python
def f():
    e = compute_something()      # a perfectly ordinary local
    try:
        risky()
    except ValueError as e:      # rebinds it...
        handle(e)
    return e                     # ...and now it is DELETED, not restored
```

The `as` target is an ordinary assignment to `e`, so it clobbers the previous
value, and the implicit `del` then removes the name entirely. The variable you
had before the `try` is gone, and the error you get is `UnboundLocalError` rather
than the wrong value — which is the merciful outcome, but only just. **Never use
a name for an `as` target that means something else in the same function.**

## The fix: assign to a different name

```python
def parse(raw):
    err = None
    try:
        return json.loads(raw)
    except ValueError as e:
        err = e                          # a second name survives the block
    log.error("bad payload: %s", err)
```

That works, and it is what the reference means by *"the exception must be
assigned to a different name"*. But be aware you have just re-created the cycle
the deletion existed to prevent — `err` holds the exception, which holds the
traceback, which holds this frame. For a short function that returns immediately
it does not matter. For a long-lived object, a module-level list, or a loop that
accumulates failures, it does.

Three better shapes, in order of preference:

**1 · Do the work inside the handler.** Usually the log line, the metric or the
re-raise can simply live in the `except` block, and the question does not arise.

```python
except ValueError as e:
    log.exception("bad payload")     # traceback included; nothing to carry out
    return None
```

**2 · Extract what you need, not the exception.** If all you want downstream is a
message or a code, take that:

```python
except ValueError as e:
    reason = str(e)                  # a str, no traceback, no cycle
```

**3 · Keep the exception but drop the traceback,** when you must accumulate
exception objects — for an `ExceptionGroup`, a report, a retry summary:

```python
failures = []
for item in items:
    try:
        process(item)
    except ProcessError as e:
        failures.append(e)           # keeps __traceback__ and the frame alive
```

That is the standard pattern for building an
**`ExceptionGroup`** *(not written yet)* and it is fine for a bounded batch. If
the list is long-lived, either format the traceback eagerly with
`traceback.format_exception(e)` and store the strings, or clear it with
`e.with_traceback(None)` — accepting that you then lose the traceback in the
final report, which is usually the wrong trade.

## You do not always need the name

Inside a handler the active exception is available without binding it:

> *"Before an `except` clause's suite is executed, the exception is stored in the
> `sys` module, where it can be accessed from within the body of the `except`
> clause by calling `sys.exception()`."*

That is what makes these work with no `as` at all:

```python
except ValueError:
    logger.exception("failed")       # reads the active exception itself
    raise                            # bare re-raise, same source
```

If your handler only logs and re-raises, drop the `as` clause entirely — one
fewer name, no deletion question, and `ruff`'s `F841` (unused variable) stops
complaining.

## It applies to `except*` too

The same clearing applies to the target of an `except*` clause; the reference
describes the target assignment for `except*` in the same terms, and there is no
carve-out. Since `break`, `continue` and `return` are all `SyntaxError`s in an
`except*` clause anyway, the only way to carry the group out is the same: assign
it to a second name.

## Gotchas

**★ Symptom — `UnboundLocalError: cannot access local variable 'e' where it is
not associated with a value` on a line just after an `except` block.** Cause: the
`as` target is deleted at the end of the handler; the reference shows the
compiled form as `try: foo finally: del N`. Fix: assign to a second name inside
the handler, or do the work inside the handler.

**★ Symptom — a variable that existed before the `try` is gone after it.**
Cause: an `except ... as e:` reusing a name already in use — the `as` binding
overwrites it and the implicit `del` then removes it. Fix: never use a meaningful
name as an `as` target; `e`, `exc` and `err` should be reserved for that purpose
in a given function.

**★ Symptom — memory grows in a service that collects failed items.** Cause:
storing caught exception objects keeps `__traceback__` alive, which keeps the
frame and every local in it alive — precisely the cycle the automatic deletion
exists to prevent. Fix: store a formatted string
(`traceback.format_exception(e)`) or the fields you need; keep raw exception
objects only for the lifetime of the batch.

**Symptom — the same code raises `NameError` at module level and
`UnboundLocalError` inside a function.** Cause: deleting a global versus deleting
a function local produce different errors. Fix: none — `UnboundLocalError` is a
`NameError` subclass, so a handler for `NameError` covers both.

**Symptom — `ruff` reports `F841` "local variable `e` is assigned to but never
used" on a handler.** Cause: an `as` clause on a handler that does not use the
name. Fix: delete the `as` clause. If you wanted the exception in the log, use
`logger.exception(...)` or `exc_info=True`, which read the active exception
without a name.

**Symptom — an exception saved for later re-raising has a traceback that stops
at the wrong place.** Cause: re-raising a stored exception object with `raise e`
appends to its existing traceback rather than creating a fresh one, so the
traceback spans both the original and the re-raise site. Fix: this is usually
what you want; if not, `raise e.with_traceback(None)` or convert to a new
exception with `from`. See [06 · The `raise` statement](06-the-raise-statement.md).

**Symptom — a closure or a lambda defined inside an `except` block fails when
called later.** Cause: it captured the `as` name, which is deleted when the block
ends, so the cell is unbound at call time. Fix: bind the exception to another
name and close over that, or pass it as a default argument.

## Interview questions

**★ Q: Why can't you use the `as` variable after the `except` block?**
Because Python compiles an implicit `del` of that name into the end of the
handler, inside a `finally` so it happens even if the handler raises. The
reference gives the exact translation. It is not a scope rule — every other name
bound in the block survives.

**★ Q: Why does Python do that?**
To break a reference cycle. The reference: *"with the traceback attached to them,
they form a reference cycle with the stack frame, keeping all locals in that
frame alive until the next garbage collection occurs."* The exception holds its
traceback, the traceback holds the frame, the frame holds its locals, and one of
those locals is the exception. Without the `del`, every caught exception would
pin a whole frame until the cycle collector ran.

**★ Q: How do you use the exception after the handler?**
Assign it to a different name inside the handler — the reference says this
explicitly. But prefer not to: do the logging or re-raising inside the block, or
extract just the message. If you must keep exception objects around for a long
time, format the traceback to a string rather than holding the object, or you
have deliberately re-created the cycle the deletion prevents.

**Q: What error do you actually get, `NameError` or `UnboundLocalError`?**
Inside a function, `UnboundLocalError` — on 3.14.4 the message is `cannot access
local variable 'e' where it is not associated with a value`. At module level,
`NameError`. `UnboundLocalError` is a subclass of `NameError`, so a handler for
either catches the local case.

**Q: You have `e = build_context()` before a `try`, and `except ValueError as e:`
inside it. What happens to the original `e`?**
It is overwritten by the `as` binding and then deleted when the handler ends. The
value from before the `try` is unrecoverable, and the next read of `e` raises
`UnboundLocalError`. Do not reuse names as `as` targets.

**Q: How do you log an exception without binding it at all?**
`logger.exception("...")` inside the handler, or `logger.error("...",
exc_info=True)`. Both read the active exception from `sys` — the reference says it
is stored there before the handler's suite runs and restored on leaving. A bare
`raise` uses the same mechanism.

**Q: Is it safe to keep a list of caught exceptions?**
For the duration of a bounded batch, yes — it is exactly how you build an
`ExceptionGroup`. For anything long-lived it is a memory leak in slow motion,
because each exception keeps a frame and all its locals alive. Format the
traceback into a string at capture time if the list outlives the operation.

---

← Prev: [Choosing the exception type](05b-choosing-the-exception-type.md) · Index: [Exceptions](README.md) · Next → [The `raise` statement](06-the-raise-statement.md)
