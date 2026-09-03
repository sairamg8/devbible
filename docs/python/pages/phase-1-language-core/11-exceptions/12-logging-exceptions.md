---
title: "`log.exception` inside the handler, `exc_info=exc` everywhere else, and never the exception's `str()` — the three lines that decide whether a log is debuggable"
sidebar_label: "12 · Logging exceptions"
sidebar_position: 134
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`logging.Logger.exception`](https://docs.python.org/3.14/library/logging.html#logging.Logger.exception),
> [`Logger.debug`](https://docs.python.org/3.14/library/logging.html#logging.Logger.debug)
> (the `exc_info` and `stack_info` keyword semantics),
> [`logging.captureWarnings`](https://docs.python.org/3.14/library/logging.html#logging.captureWarnings),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html),
> [`sys.exc_info`](https://docs.python.org/3.14/library/sys.html#sys.exc_info),
> and [`ExceptionGroup`](https://docs.python.org/3.14/library/exceptions.html#ExceptionGroup).
> Target: **CPython 3.14**.

A caught exception has a type, a message, a traceback, a chain and possibly
notes. `str()` gives you the message. Everything on this page is about not
throwing the other four away between the `except` and the log aggregator.

## The two calls

```python
except Exception:
    log.exception("could not process order %s", order_id)
```

> `Logger.exception(msg, *args, **kwargs)` — Logs a message with level `ERROR`
> on this logger. The arguments are interpreted as for `debug()`. Exception info
> is added to the logging message. **This method should only be called from an
> exception handler.**

That last sentence is a hard constraint, and the reason is
[`sys.exception()`](09-traceback-objects.md): with no `exc_info` argument the
record is built from the exception currently being handled, and outside a
handler there is none. Called from a helper that runs after the `except` block,
`log.exception` produces a record claiming an error with no exception attached.

Outside a handler, pass the object:

```python
log.error("could not process order %s", order_id, exc_info=exc)
```

> If `exc_info` does not evaluate as false, it causes exception information to be
> added to the logging message. If an exception tuple (in the format returned by
> `sys.exc_info()`) or an exception instance is provided, it is used; otherwise,
> `sys.exc_info()` is called to get the exception information.

Three accepted forms, then: a falsy value (nothing added), a `sys.exc_info()`
tuple, or **an exception instance** — the last being the one to use, since it is
what you already have. `log.exception(msg)` is exactly
`log.error(msg, exc_info=True)`.

## `exc_info` is not `stack_info`

They look interchangeable and are not. The docs draw the line precisely:

> the former is stack frames from the bottom of the stack up to the logging
> call in the current thread, whereas the latter is information about stack
> frames which have been unwound, following an exception, while searching for
> exception handlers.

`stack_info=True` answers *"how did we get to this log call"*. `exc_info`
answers *"where did the exception come from"*. For a failure you want
`exc_info`; `stack_info` earns its place on a warning-level record where the
question is which caller triggered it.

## `%s`, not an f-string

```python
log.error("order %s failed for user %s", order_id, user_id)   # yes
log.error(f"order {order_id} failed for user {user_id}")      # no
```

Three reasons, in increasing order of how much they matter:

1. **Cost.** The f-string is built before the call, even when the record is
   filtered out by level or by a handler.
2. **Aggregation.** With `%s` the message *template* is constant, so a log
   aggregator can group ten thousand failures as one event with parameters. An
   f-string produces ten thousand distinct messages.
3. **Handlers can use the arguments.** `record.args` is available to filters and
   formatters — structured output can promote them to fields. Interpolate early
   and they are gone.

The same applies to the exception: `log.error("failed: %s", exc)` is still
losing the traceback. Pass it as `exc_info`, not as a value.

## Log once, at the frame that decides

The single most common structural mistake is logging at every level:

```python
def fetch(url):
    try:
        return client.get(url)
    except HTTPError:
        log.exception("fetch failed")     # copy 1
        raise

def sync(urls):
    for url in urls:
        try:
            fetch(url)
        except HTTPError:
            log.exception("sync failed")  # copy 2 — same traceback
            raise
```

Three layers produce three copies of one traceback at three timestamps, and an
on-call engineer counting errors sees three failures. The rule:

- **The frame that decides logs.** Retry, skip the record, return a 400, fail
  the batch — whoever makes that call owns the log record.
- **Lower frames add facts, not records.** `exc.add_note(f"url={url}")` and a
  bare `raise` — see [exception chaining](06b-exception-chaining.md).
- **A library logs almost nothing.** It raises; the application decides whether
  a failure is worth a line. A `logging.NullHandler` on the library's logger is
  the convention that makes that safe.

## The service-boundary shape

At an HTTP edge, two different audiences need two different things from the same
exception:

```python
@app.exception_handler(DomainError)
async def handle_domain_error(request, exc):
    log.exception("request failed", extra={"path": request.url.path})   # full traceback
    return JSONResponse({"detail": str(exc)}, status_code=exc.status)   # message only
```

`str(exc)` in the response body, the exception object in the log. Sending the
traceback to the client is an information leak; sending only the message to the
log is [losing the traceback](13-losing-the-traceback.md).

`extra=` is how structured context gets onto the record without being crammed
into the message — a request id, a tenant, a path. Keys collide with the
`LogRecord`'s own attributes (`message`, `args`, `exc_info`, …), so namespace
them if a formatter starts behaving strangely.

## Exception groups

```python
except* ValueError as eg:
    log.error("validation failed", exc_info=eg)
```

`exc_info` on a group renders the whole tree, because the formatter walks it —
truncated at `max_group_width` (15) and `max_group_depth` (10), per
[exception groups](08-exception-groups.md). `str(eg)` gives only the summary
message and a sub-exception count, which is how a batch failure reaches a log as
a single unhelpful line. When the members are what matter, count them
explicitly:

```python
kinds = collections.Counter(type(e).__name__ for e in eg.exceptions)
log.error("batch failed: %d errors %s", len(eg.exceptions), dict(kinds), exc_info=eg)
```

## Warnings into the same pipeline

`logging.captureWarnings(True)` routes the `warnings` machinery through logging,
onto the `py.warnings` logger — the counterpart for the other half of
[`suppress` and warnings](11b-warnings.md). Without it, a `ResourceWarning`
about an unclosed connection goes to stderr in a process nobody is watching.

## What is left when logging is not enough

Two hooks worth wiring once, both from
[traceback objects](09-traceback-objects.md): `sys.excepthook` for an uncaught
exception in the main thread, and `threading.excepthook` for one out of
`Thread.run()`. Without the second, a dead worker thread is silent — the default
prints to stderr, and stderr is not the log.

## Gotchas

**★ Symptom — a log record at ERROR level with the message but no traceback,
from a line that definitely says `log.exception`.** Cause: it was called outside
an exception handler — from a callback, a `finally`, or a helper invoked after
the `except` block — so there was no active exception to attach. Fix: pass the
exception explicitly.

```python
def report(exc, order_id):
    log.error("order %s failed", order_id, exc_info=exc)   # not log.exception(...)
```

**★ Symptom — the same traceback appears three times per failure and error
counts are inflated.** Cause: log-and-re-raise at several layers. Fix: log at
the deciding frame only; lower layers use `add_note` and a bare `raise`.

**★ Symptom — a log aggregator shows tens of thousands of unique error
messages that are all the same error.** Cause: f-string messages, so every
record has a distinct template. Fix: `%s` placeholders with the values as
arguments.

**★ Symptom — CPU spent formatting log messages that are never emitted.**
Cause: eager interpolation — an f-string, or `"...".format(...)`, or `str(obj)`
on something expensive — evaluated before the level check. Fix: `%s` and
arguments; `logger.isEnabledFor(logging.DEBUG)` around a genuinely expensive
computation.

**★ Symptom — `log.error("failed: %s", exc)` produces `failed: ` with nothing
after it.** Cause: the exception has no arguments, so `str(exc)` is empty. Fix:
`%r`, or better, drop it from the message and pass `exc_info=exc`.

**★ Symptom — an exception's notes are missing from the log.** Cause: `%s` on
the exception, which does not render `__notes__` — only the traceback formatter
does. Fix: `exc_info`, as with the traceback and the chain.

**★ Symptom — a batch failure logs one line saying "3 sub-exceptions" and
nothing else.** Cause: `str()` on an exception group. Fix: `exc_info=eg` for the
tree, plus an explicit count or `Counter` in the message for the shape.

**★ Symptom — a library floods an application's logs, or logs nothing at all
depending on whose `basicConfig` ran first.** Cause: a library configuring
logging, or logging errors it should have raised. Fix: libraries raise and
attach a `NullHandler`; applications configure handlers and decide what is
logged.

**★ Symptom — `extra={"message": ...}` or `extra={"args": ...}` raises or
mangles the record.** Cause: `extra` keys are set as attributes on the
`LogRecord` and collide with its own. Fix: namespace them —
`extra={"req_id": ...}`, or a single `extra={"ctx": {...}}`.

**★ Symptom — the traceback in the log stops at the framework's dispatch
function.** Cause: the framework caught the original, raised its own, and the
record carries the second one. Fix: log from the framework's own error hook, and
follow `__cause__`/`__context__`, which `exc_info` prints by default.

**★ Symptom — a warning about an unclosed socket never reaches the log
aggregator.** Cause: warnings go to stderr, and four categories are ignored by
default. Fix: `logging.captureWarnings(True)` plus a filter that enables the
category you care about.

**★ Symptom — logging an exception keeps a request object alive and memory
grows.** Cause: the record holds `exc_info`, which holds the traceback and every
frame's locals, and a queue-based handler holds records. Fix: format at the
handler boundary rather than queueing raw records, and never attach the
exception to anything long-lived — see
[custom exceptions](07-custom-exceptions.md).

## Interview questions

**★ Q: `log.exception`, `log.error(..., exc_info=exc)`, or
`log.error(str(exc))` — when each?**
`log.exception(msg)` inside an exception handler; the docs say it should only be
called there, because with no `exc_info` argument the record is built from the
exception currently being handled. `log.error(msg, exc_info=exc)` anywhere else
— a callback, a supervisor, a deferred report. `log.error(str(exc))` never: it
keeps the message and discards the traceback, the chain and the notes.

**★ Q: Why `%s` placeholders rather than an f-string in a log call?**
The f-string is built even when the record is dropped by the level or a filter;
it destroys the constant message template an aggregator groups on; and it hides
the values from filters and formatters that could promote them to structured
fields. `log.error("order %s failed", order_id)` costs nothing when DEBUG is off
and groups cleanly when it is on.

**★ Q: Where should an exception be logged?**
Once, at the frame that decides what happens — retry, skip, respond 400, fail
the batch. Deeper frames add context with `add_note` and re-raise; libraries
raise and log nothing, with a `NullHandler` attached. Logging at every level
produces duplicate tracebacks and inflated error counts, and still leaves the
decision unrecorded.

**Q: What is the difference between `exc_info` and `stack_info`?**
`exc_info` attaches the exception and its unwound frames — where the failure
came from. `stack_info` attaches the current call stack up to the logging call —
how execution reached this line. The docs state the distinction explicitly. Use
`exc_info` for failures; `stack_info` when the question is which caller did
this.

**Q: How do you log an exception group usefully?**
`exc_info=eg`, which renders the tree (truncated at 15 wide and 10 deep), and a
message that carries the shape — the member count, or a `Counter` of member
types. `str(eg)` alone gives the summary and a count, which is how a
ten-thousand-failure batch becomes one unhelpful line.

**Q: A worker thread dies and the log is silent. Why?**
Because an exception out of `Thread.run()` goes to `threading.excepthook`, whose
default prints to stderr rather than through logging. Install a
`threading.excepthook` that logs — and `sys.excepthook` for the main thread —
then clear the stored exception, which the docs warn creates a reference cycle.

**Q: Should a library log the exceptions it raises?**
No. It raises; the application decides whether that failure deserves a record,
at what level, with what context. A library that logs either duplicates the
application's record or writes to a logger nobody configured. Attach a
`NullHandler` and stay quiet.

---

← Prev: [Warnings](11b-warnings.md) · Index: [Exceptions](README.md) · Next → [Losing the traceback](13-losing-the-traceback.md)
