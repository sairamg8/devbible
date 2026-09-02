---
title: "A `return`, `break` or `continue` inside `finally` discards the in-flight exception — the quietest way to lose a production error"
sidebar_label: "3e · Jumping out of `finally`"
sidebar_position: 116
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement — `finally` clause](https://docs.python.org/3.14/reference/compound_stmts.html#finally-clause),
> [PEP 765 — Disallow return/break/continue that exit a finally block](https://peps.python.org/pep-0765/),
> the Tutorial
> [Defining Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#defining-clean-up-actions),
> and [PEP 654](https://peps.python.org/pep-0654/).
> Target: **CPython 3.14**.

**This is the single nastiest silent failure in Python's exception model. A
`return`, `break` or `continue` executed inside a `finally` block does not merely
change where control goes — it **throws away the exception that was in flight**.
No traceback, no log line, no trace of the error at all; the function simply
returns a value or the loop simply continues. It is a one-word edit away from any
ordinary `finally`, and it survives testing because the failing path looks like
the succeeding path. This chunk is the semantics and the fix;
[03f](03f-finding-and-fixing-finally-jumps.md) is the 3.14 `SyntaxWarning` that
finally makes it findable.**

## The reference states it in one sentence

> *"If the `finally` clause executes a `return`, `break` or `continue` statement,
> the saved exception is discarded. For example, this function returns 42."*

```python
def f():
    try:
        1/0
    finally:
        return 42
```

The `ZeroDivisionError` is raised, parked while the `finally` runs, and then the
`return` in the `finally` leaves the function — so the parked exception is never
re-raised. `f()` returns `42`. The `__context__` chaining that usually preserves
a superseded exception does not apply, because there is no *new* exception to
attach it to; the exception is simply dropped.

## And a second rule about `return` specifically

> *"The return value of a function is determined by the last `return` statement
> executed. Since the `finally` clause always executes, a `return` statement
> executed in the `finally` clause will always be the last one executed. The
> following function returns 'finally'."*

```python
def foo():
    try:
        return 'try'
    finally:
        return 'finally'
```

That is the milder of the two failures: the `try` clause's `return` value is
discarded rather than an exception, and at least the caller gets *something*.
The dangerous case is the first one, where a genuine error becomes a normal
return.

## The shapes it appears in

**The "always return something" handler.** Someone wants a default value and
puts it where it "definitely runs":

```python
def load_config(path):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("no config at %s", path)
    finally:
        return DEFAULT_CONFIG        # eats every error, including the log's own
```

A `JSONDecodeError` from a malformed config file is discarded and the service
starts on defaults, silently. PEP 765's survey found this shape everywhere:

> *"73% of real-world usages were incorrect"*

with the examples being *"logging exceptions in an `except` block while a
`finally` block's `return` statement silently suppresses them"* and *"`return`
statements in `finally` overriding `return` values from `except` blocks."*

**The retry loop that never fails.**

```python
for attempt in range(3):
    try:
        return fetch(url)
    except TimeoutError:
        pass
    finally:
        continue            # discards TimeoutError AND cancels the return
```

The `continue` in the `finally` discards whatever is in flight — including the
value the `try`'s `return` was carrying out. The loop runs three times and falls
out the bottom returning `None`.

**The `break` that hides a fatal error.**

```python
while True:
    try:
        process(next_item())
    finally:
        if shutting_down:
            break          # any exception from process() vanishes here
```

## What to write instead

**For a default value:** put the `return` in the `except` clause, where it is
scoped to the failure you actually named.

```python
def load_config(path):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("no config at %s", path)
        return DEFAULT_CONFIG        # only for the error you named
```

A `JSONDecodeError` now propagates, as it should — a malformed config is a
deployment bug, not a missing-file condition.

**For "clean up and keep going":** put the control flow in the `except`, not the
`finally`.

```python
for item in items:
    try:
        process(item)
    except RecoverableError:
        logger.warning("skipping %s", item.id)
        continue                     # explicit, and only for this error
    finally:
        item.release()
```

**For "clean up and stop":** `break` in the `try` or the `except`, never the
`finally` — the `finally` still runs on the way out, so nothing is lost.

## Gotchas

**★ Symptom — a function returns a normal-looking value in production while the
work it does fails, and nothing appears in the logs.** Cause: a `return` inside a
`finally`; the reference is explicit that *"the saved exception is discarded"*.
There is no chained context and no traceback because there is no new exception.
Fix: move the `return` into the `except` clause; see
[03f](03f-finding-and-fixing-finally-jumps.md) for how to find every instance.

**★ Symptom — a retry loop silently returns `None` after three attempts instead
of raising.** Cause: `continue` in a `finally` discards both the exception and
the value a `return` in the `try` was carrying out. Fix: `continue` in the
`except` clause; the `finally` still runs before the jump.

**Symptom — a function returns the wrong one of two possible values.** Cause: a
`return` in `finally` overrides the `return` in `try` or in an `except`, because
*"the return value of a function is determined by the last `return` statement
executed"* and the `finally` always runs last. Fix: one `return` per route, none
of them in the `finally`.

## Interview questions

**★ Q: What happens if you `return` from inside a `finally` block?**
The in-flight exception is discarded — completely, with no traceback and no
chained context — and the function returns normally. The reference's example is a
function whose `try` does `1/0` and whose `finally` does `return 42`; it returns
`42`. It also overrides any `return` from the `try` or `except`, because the
function's value is that of the last `return` executed and the `finally` always
runs last.

**★ Q: Why is that worse than an exception being caught by a broad `except`?**
Because a broad `except` at least has a body you can put a log line in, and the
exception object still exists. A `return` in `finally` produces no evidence at
all: the failure path and the success path are indistinguishable from outside the
function, so it does not show up in tests, in logs, or in error tracking.

**Q: Does `break` in a `finally` have the same problem as `return`?**
Yes, and `continue` too — the reference lists all three as discarding the saved
exception. `continue` has the extra history that it was outright illegal in a
`finally` before Python 3.8.

**Q: You want a function to return a default when a file is missing. Where does
the `return` go?**
In the `except FileNotFoundError:` clause. That scopes the default to the one
failure you understand and lets every other failure — a permissions error, a
malformed file — propagate. Putting it in `finally` makes the default the answer
to *every* failure, including the ones that are bugs.

---

← Prev: [Context managers as cleanup](03d-context-managers-as-cleanup.md) · Index: [Exceptions](README.md) · Next → [Finding and fixing `finally` jumps](03f-finding-and-fixing-finally-jumps.md)
