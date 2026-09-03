---
title: "Six ways your own code throws the diagnosis away, and the one-line fix for each"
sidebar_label: "13 · Losing the traceback"
sidebar_position: 134
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`logging`](https://docs.python.org/3.14/library/logging.html#logging.Logger.exception)
> (`exception`, `exc_info`, `stack_info`),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html),
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception),
> [`sys.tracebacklimit`](https://docs.python.org/3.14/library/sys.html#sys.tracebacklimit),
> [`threading.excepthook`](https://docs.python.org/3.14/library/threading.html#threading.excepthook),
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html),
> [Developing with asyncio](https://docs.python.org/3.14/library/asyncio-dev.html),
> the Language Reference
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement),
> and [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement).
> Target: **CPython 3.14**.

The list splits in two. This chunk is the half you write yourself — six keywords
away from a traceback, in code you control. The other half is the boundaries
that drop it for you: [losing it across a boundary](13b-losing-it-across-a-boundary.md).

Every debugging session that begins *"the log just says `KeyError`"* is one of
the following. None of them are exotic; most of them are one keyword away from
being fine. The premise, from
[traceback objects](09-traceback-objects.md): the type and the message can be
reconstructed from a log line, and the traceback cannot — it is a record of
frames that no longer exist.
## 1 — Logging the exception as a string

```python
except Exception as exc:
    log.error(f"could not process order: {exc}")     # no traceback, no chain
```

`str(exc)` is the message and nothing else. The traceback, the cause and the
notes are all on the object you just discarded. Two fixes, and which one depends
only on whether you are inside the handler:

```python
except Exception:
    log.exception("could not process order")        # inside a handler
...
log.error("could not process order", exc_info=exc)  # anywhere, given the object
```

The docs are explicit that `Logger.exception` *"should only be called from an
exception handler"*, and that `exc_info` accepts *"an exception tuple … or an
exception instance"*. See **logging exceptions** *(not written yet)*.

Worse than useless when the exception has no message: `str(SomeError())` is
`''`, and the log line reads `could not process order: `.

## 2 — Swallowing outright

```python
try:
    cache.delete(key)
except Exception:
    pass
```

This is not "handling"; it is deciding that no failure of `cache.delete` will
ever matter, forever, including the ones that do not exist yet. If ignoring is
genuinely right, say which error you are ignoring and why — see
[the bare `except:`](04b-the-bare-except.md) and
**`suppress` and warnings** *(not written yet)*.

```python
with contextlib.suppress(KeyError):     # names the error, and only that error
    cache.delete(key)
```

## 3 — Re-raising as a new exception *after* the handler

Inside a handler, chaining is automatic — the reference says a new exception
raised while another is being handled gets the previous one as its
`__context__`. But store the exception and raise later, and there is no handler
active, so nothing chains:

```python
errors.append(exc)                     # handler ends here
...
raise BatchFailed("some records failed")            # __context__ is None
raise BatchFailed("some records failed") from errors[0]   # fix
```

Better still for a batch: an
[exception group](08-exception-groups.md), which keeps every traceback.

## 4 — `from None` used as tidying

`raise … from None` suppresses the context's **display**. Applied at a boundary
where the inner exception was the diagnosis, it deletes the answer from every
log — see [exception chaining](06b-exception-chaining.md).

## 5 — Returning a sentinel instead of raising

```python
def load(path):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return None                     # the failure is now a None, 40 frames away
```

The caller gets a `TypeError: 'NoneType' object is not subscriptable` in an
unrelated function and no record of the real error. Either raise, or return a
result object that carries the failure — see
[`None` and the no-result contract](../14-none-and-no-result/README.md).

## 6 — `return` inside `finally`

A `return`, `break` or `continue` in a `finally` block discards the in-flight
exception entirely, and until 3.14 nothing warned about it. This has its own
chunk because of how quiet it is:
[jumping out of `finally`](03e-return-break-continue-in-finally.md) and
[finding those jumps](03f-finding-and-fixing-finally-jumps.md).
## Gotchas


**★ Symptom — an error tracker shows the exception type and message but no
stack.** Cause: something in the chain logged `str(exc)` or reported
`{"error": str(exc)}`, and the handler that reached the tracker only ever saw a
string. Fix: pass the exception object to the reporter, and keep the string for
the user-facing response only.

```python
except DomainError as exc:
    log.exception("request failed")                 # server side: full traceback
    return JSONResponse({"detail": str(exc)}, 400)  # client side: message only
```

**★ Symptom — a log line reads `failed: ` with nothing after the colon.** Cause:
`%s` on an exception with no arguments — `str(SomeError())` is the empty string.
Fix: log the repr or the type, which always carry the class name.

```python
log.error("failed: %r", exc)         # SomeError()
```

**★ Symptom — a wrapped exception has no `__context__` and nobody can see the
original.** Cause: it was raised after the `except` block ended — from a stored
exception, a callback, or a `finally` — so implicit chaining had nothing active
to attach. Fix: `from exc`, explicitly.

**★ Symptom — `traceback.format_exc()` in a reporting helper returns no
exception information.** Cause: it is shorthand for
`print_exception(sys.exception(), …)` and the helper runs outside the handler.
Fix: pass the exception in and call `format_exception(exc)`.

**★ Symptom — an exception with useful `__notes__` is logged without them.**
Cause: the log line formats `str(exc)`, which does not include notes; only the
traceback formatter renders them. Fix: `exc_info`, as with everything else on
this page.
**★ Symptom — the bottom frame of the traceback is the `except` block, so the
handler's line looks like the origin of the failure.** Cause: `raise exc`
instead of a bare `raise` — re-raising the same object adds the current frame to
its traceback. Fix: a bare `raise`, which re-raises the active exception
untouched.

```python
except ValidationError:
    metrics.incr("validation_failed")
    raise                      # not: raise exc
```

## Interview questions


**★ Q: `log.error(f"failed: {exc}")` — what is wrong with it?**
Two things. It discards the traceback and the chained cause, because both live on
the exception object and only the message is being formatted; and it formats
eagerly, so the string is built even when the record is filtered out. The fix is
`log.exception("failed")` inside a handler, or `log.error("failed",
exc_info=exc)` anywhere else, with `%s` placeholders for the values.

**Q: Does re-raising a new exception inside an `except` block lose the
original?**
No — the reference says a new exception raised while another is being handled
gets it as `__context__`, and the interpreter prints both. It is lost when the
raise happens *outside* the handler, which is why deferred and callback-based
re-raises need an explicit `from exc`.

**★ Q: `raise exc` or a bare `raise` — what is the difference?**
A bare `raise` re-raises the active exception exactly as it was; `raise exc`
re-raises the same object but appends the current frame to its traceback, so the
handler's line appears as the most recent call and readers mistake it for the
origin. Inside a handler that is not translating anything, always the bare form.

**Q: What is the single highest-value habit here?**
Passing the exception *object* everywhere a failure is reported, and calling
`str()` on it only for text a human reads in a response body. Every item on this
page is a variation of losing that object early.

------

← Prev: **Logging exceptions** *(not written yet)* · Index: [Exceptions](README.md) · Next → [Losing it across a boundary](13b-losing-it-across-a-boundary.md)
