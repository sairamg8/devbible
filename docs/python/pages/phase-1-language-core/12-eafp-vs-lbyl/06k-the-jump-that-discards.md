---
title: "A return, break or continue in a finally block discards the saved exception outright — a wider handler than except BaseException: pass, and one that does not read as a handler at all"
sidebar_label: "06k · The jump that discards"
sidebar_position: 150
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the discard rule, the return-value rule, the 3.14 `SyntaxWarning`) and
> [The `break` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement)
> — and [PEP 765](https://peps.python.org/pep-0765/).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06h](06h-finally-and-the-widest-handler.md) established that `finally` covers every
clause and cannot be narrowed. That is harmless while it only cleans up. It stops being
harmless the moment it *jumps*: a `return`, `break` or `continue` in a `finally` block
discards the saved exception outright — not re-raised, not chained, not logged. It is a
wider handler than `except BaseException: pass`, and unlike that clause it does not read as
error handling at all, so nobody reviewing it sees a handler. It discards return values by
the same mechanism. Python 3.14 emits a `SyntaxWarning` for the shape, and PEP 765 proposes
withdrawing it entirely.**

## The rule, and the one fact underneath it

> *"If the `finally` clause executes a `return`, `break` or `continue` statement, the saved
> exception is discarded."*

Discarded. The saved exception ceases to exist. `except BaseException: pass` is *narrower*
than this, because at least it names a class, at least the exception object is bound inside
the handler, and at least it turns up in a grep for handlers. PEP 765 states both behaviours
in its Motivation:

> *"If the `finally` clause executes a `break`, `continue` or `return` statement, exceptions
> are not re-raised."*

> *"If a `finally` clause includes a `return` statement, the returned value will be the one
> from the `finally` clause's `return` statement, not the value from the `try` clause's
> `return` statement."*

The second is the half people miss: it is not only exceptions that vanish. And neither
behaviour is a special rule about `finally` — both fall out of one ordinary fact:

> *"The return value of a function is determined by the last `return` statement executed.
> Since the `finally` clause always executes, a `return` statement executed in the `finally`
> clause will always be the last one executed."*

The documentation ships this function and states that it returns `'finally'`:

```python
def foo():
    try:
        return 'try'
    finally:
        return 'finally'
```

`finally` always runs; its `return` is therefore always the last one executed; "last one
executed" is the whole definition of a function's return value. The exception discard is the
same fact seen from the other side — control leaves the statement at the `return`, so it
never reaches the point where the saved exception would be re-raised. Knowing it as one fact
rather than three special cases is what lets you predict the `break` and `continue`
versions without looking them up.

## A worked case: the status-code wrapper

The shape almost never arrives as `return 'finally'`. It arrives as a wrapper that wants to
report a status and close a resource in one place:

```python
# 🔴 Every exception in the body becomes HTTP 200 with an empty result.
def handle(request):
    conn = pool.acquire()
    try:
        rows = conn.execute(request.query)
        return Response(200, rows)
    finally:
        conn.release()
        return Response(200, [])        # "make sure we always return something"
```

Read what the last line does. `conn.execute` raises `OperationalError`; the exception is
saved; `finally` runs; the `return` discards it; the caller receives a `200` with an empty
list. There is no log line, no metric, no traceback, and the endpoint's error rate is zero.
The author's intent — *always return something* — is satisfied perfectly, which is why the
line survives review.

The repair keeps the intent and moves the fallback where it can be seen:

```python
def handle(request):
    conn = pool.acquire()
    try:
        rows = conn.execute(request.query)
    except OperationalError:
        logger.exception("query failed")
        return Response(503, [])        # the fallback is a named, visible decision
    else:
        return Response(200, rows)
    finally:
        conn.release()                  # cleanup only
```

Both `return`s are now in clauses that own them, the cleanup still runs on every path — the
reference guarantees `finally` executes *"on the way out"* of a `return` — and an exception
nobody anticipated propagates instead of being reported as success.

## What 3.14 changed

> *"Changed in version 3.14: The compiler emits a `SyntaxWarning` when a `return`, `break`
> or `continue` appears in a `finally` block (see PEP 765)."*

PEP 765 is titled *"Disallow return/break/continue that exit a finally block"* and its
Abstract is *"This PEP proposes to withdraw support for `return`, `break` and `continue`
statements that break out of a `finally` block."* But it is a warning, not an error:

> *"CPython will emit a `SyntaxWarning` in version 3.14, and we leave it open whether, and
> when, this will become a `SyntaxError`."*

⚠️ The PEP also notes that *"a `SyntaxError` is permitted by the language spec, so that
other Python implementations can choose to implement that"* — so the same source file may
compile on CPython 3.14 and refuse to compile elsewhere. Treat the warning as the error it
is going to be. It is emitted by the **compiler**, so a run that imports only already-cached
bytecode may not surface it; compiling the tree explicitly is the reliable trigger:

```bash
python -W error::SyntaxWarning -m compileall -q src/
```

I could not find a documented statement about whether bytecode caching suppresses a repeat
emission of a `SyntaxWarning`, so treat the `compileall` step as the belt-and-braces form
rather than as a documented guarantee.

## Gotchas

**★ Symptom: an exception raised in `else` vanished and the function returned normally.**
Cause: the `finally` clause executes a `return`, and *"the saved exception is discarded"* —
so all the narrowing you did in `else` bought nothing, because `finally` runs over `else`
too. Fix: get the `return` out of `finally`; put cleanup in a context manager and return
from `else`.

```python
try:
    fp = open(path)
except FileNotFoundError:
    return {}
else:
    with fp:
        return json.load(fp)      # the return lives here, never in a finally
```

**★ Symptom: a function returns the wrong value, and no exception was involved.** Cause:
PEP 765's second behaviour — *"the returned value will be the one from the `finally`
clause's `return` statement, not the value from the `try` clause's `return` statement"*. The
docs' own `foo()` returns `'finally'`. Fix: compute in the suite, clean up in `finally`,
return once after the statement.

```python
def load(path):
    try:
        result = json.load(open(path))
    finally:
        metrics.flush()           # cleanup only — no return, break or continue
    return result
```

**★ Symptom: a `break` in a `finally` inside a loop silently ends the loop and swallows the
error.** Cause: the same discard rule — `break` is one of the three jumps that drops the
saved exception, and in a retry loop it converts "every attempt failed" into "we are done,
apparently successfully". Fix: let the exception drive the loop and keep `finally` to
cleanup.

```python
for attempt in range(3):
    try:
        return client.get(url)
    except ConnectionError:
        continue                  # loop control lives in the handler
    finally:
        span.end()                # no break, no return, no continue
raise Unavailable(url)
```

**★ Symptom: a retry loop reports success for a request that never succeeded.** Cause: the
third jump — a `continue` in the `finally` of a retry loop discards the saved exception on
every iteration, so the loop exhausts its attempts and falls through to whatever follows it
with no error ever raised. It is the most invisible of the three, because `continue` in a
retry loop *looks* deliberate. Fix: same rule — the `finally` cleans up and nothing else.

```python
# 🔴 every failure is discarded; the function returns None after three silent attempts
for attempt in range(3):
    try:
        return client.get(url)
    finally:
        if attempt < 2:
            continue

# the exception decides whether to retry, and the last one escapes
for attempt in range(3):
    try:
        return client.get(url)
    except ConnectionError:
        if attempt == 2:
            raise
    finally:
        span.end()
```

**★ Symptom: an endpoint's error rate is zero and users report failures.** Cause: the
status-code wrapper above — a `return` in `finally` turning every exception into a success
response. The metric is derived from the response, and the response is a lie. Fix: the
fallback belongs in an `except` clause where it is named, logged and countable.

```python
except OperationalError:
    logger.exception("query failed")
    return Response(503, [])
```

**Symptom: a `return` in `finally` swallowed a `Ctrl-C` and the process would not stop.**
Cause: the discard rule names no class and makes no exception for `BaseException`
descendants, so `KeyboardInterrupt` and `SystemExit` go the same way as everything else.
That is what "wider than `except BaseException`" means concretely. Fix: as above — no jump
in `finally`; if you genuinely mean to ignore something, name it in an `except` clause where
it is visible.

```python
try:
    result = work()
except KeyboardInterrupt:
    logger.info("interrupted, shutting down")   # deliberate, named, greppable
    raise
finally:
    release()
```

**Symptom: CI never reported the 3.14 `SyntaxWarning` for a `return` in `finally`.** Cause:
the warning is emitted by the **compiler**, so a test run that imports already-compiled
bytecode need not surface it, and warnings are not errors by default anyway. Fix: compile
the tree explicitly with the warning promoted.

```bash
python -W error::SyntaxWarning -m compileall -q src/
```

## Interview questions

**★ Why is a `return` in a `finally` block the widest exception handler you can write?**
Because it catches every class from every frame and then destroys the evidence: *"if the
`finally` clause executes a `return`, `break` or `continue` statement, the saved exception
is discarded."* Compare `except BaseException: pass`, which at least names a class, at least
binds the exception object, and at least appears in a grep for handlers. A `return` in
`finally` reads as control flow, not as error handling, so nobody reviewing it sees a
handler at all — and it takes `KeyboardInterrupt` and `SystemExit` with it. It discards
return values for the same reason: a function's value is *"determined by the last `return`
statement executed"*, and `finally` always executes last.

**★ Is the return-value behaviour a special rule about `finally`?**
No, and that is the useful thing to be able to say. There is one rule — the value comes from
the last `return` executed — and one fact — `finally` always executes. Everything else
follows. The documentation makes exactly that argument: *"Since the `finally` clause always
executes, a `return` statement executed in the `finally` clause will always be the last one
executed."* The exception discard is the same fact from the other side: control leaves the
statement at the `return`, so it never reaches the point where the saved exception would be
re-raised. Knowing it as one fact rather than two special cases is what lets you predict the
`break` and `continue` versions without looking them up.

**★ How do you find these in a codebase you did not write?**
Let the compiler do it. Since 3.14 *"the compiler emits a `SyntaxWarning` when a `return`,
`break` or `continue` appears in a `finally` block"*, so compiling the tree with the warning
promoted to an error surfaces every instance at once: `python -W error::SyntaxWarning -m
compileall -q src/`. Grep is a poor substitute because the jump is rarely on the line after
`finally:` — it is usually several lines in, after the cleanup, which is exactly why it
survives review. Run it as a build step rather than a one-off; the shape reappears the next
time somebody wants a function to "always return something".

**A colleague says a `return` in `finally` is fine here because nothing in the `try` can
raise. What do you say?** That the claim is about today's call tree, not about the
statement. `MemoryError`, `KeyboardInterrupt` and a `SystemExit` from a signal handler are
always possible, and the next edit to the `try` suite adds whatever it adds — the discard is
silent, so nothing will tell you when that day comes. It also costs nothing to write it the
other way: assign in the suite, clean up in `finally`, return after the statement. And in
3.14 the compiler already disagrees with your colleague, which makes the argument short.

**PEP 765 emits a warning and explicitly leaves escalation open. How should that affect what
you write today?** Write as if it were already an error. The PEP's Abstract proposes *"to
withdraw support"* for the shape; the Specification says only that *"CPython will emit a
`SyntaxWarning` in version 3.14, and we leave it open whether, and when, this will become a
`SyntaxError`"*; and it notes that a `SyntaxError` *"is permitted by the language spec, so
that other Python implementations can choose to implement that"*. So the file that compiles
for you today may already fail to compile on another implementation, and the escalation on
CPython is a matter of when rather than whether. There is no cost to complying early — the
alternative shape is shorter and clearer — and no upside to being the codebase that
discovers the change during an upgrade.

---

← Prev: [Where `finally` sits](06h-finally-and-the-widest-handler.md) · Index: [EAFP vs LBYL](README.md) · Next → [When cleanup raises](06i-when-cleanup-raises-and-the-grammar-refuses.md)
