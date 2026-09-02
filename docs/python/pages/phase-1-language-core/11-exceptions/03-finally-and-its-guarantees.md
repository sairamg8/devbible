---
title: "`finally` runs on every route out of the statement — including the routes you did not write"
sidebar_label: "3 · `finally` and its guarantees"
sidebar_position: 112
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement — `finally` clause](https://docs.python.org/3.14/reference/compound_stmts.html#finally-clause),
> the Tutorial
> [Defining Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#defining-clean-up-actions),
> and [`sys.exit`](https://docs.python.org/3.14/library/sys.html#sys.exit).
> Target: **CPython 3.14**.

**`finally` is the only construct in Python that runs on *every* exit from a
block: falling off the end, an exception you caught, an exception you did not
catch, a `return`, a `break`, a `continue`. That universality is the whole
value — and it is also why `finally` is dangerous, because "every route out"
includes routes the author of the `finally` body never considered. This chunk is
the guarantee and the exact ordering; [03b](03b-finally-cleanup-patterns.md) is
how to write cleanup that survives it.**

## The mechanism, in the reference's own words

> *"If `finally` is present, it specifies a 'cleanup' handler. The `try` clause is
> executed, including any `except` and `else` clauses. If an exception occurs in
> any of the clauses and is not handled, the exception is temporarily saved. The
> `finally` clause is executed. If there is a saved exception it is re-raised at
> the end of the `finally` clause. If the `finally` clause raises another
> exception, the saved exception is set as the context of the new exception."*

Read as an algorithm:

1. Run everything else — `try`, and whichever of `except`/`else` applies.
2. If an exception is in flight and unhandled, **park it**.
3. Run the `finally` suite.
4. If the `finally` suite finished normally and there is a parked exception,
   **re-raise it**.
5. If the `finally` suite raised, that new exception wins and the parked one is
   attached to it as `__context__`.

Note *"including any `except` and `else` clauses"*: `finally` wraps the whole
statement. An exception raised inside a handler, or inside `else`, is parked the
same way.

And for the non-exception routes:

> *"When a `return`, `break` or `continue` statement is executed in the `try`
> suite of a `try`…`finally` statement, the `finally` clause is also executed 'on
> the way out.'"*

## The full route table

Every one of these runs the `finally`:

| Route out of the `try` statement | `finally` runs? |
|---|---|
| Fell off the end of the `try` suite | Yes |
| Exception raised and handled by an `except` | Yes |
| Exception raised and **not** matched by any `except` | Yes, then it propagates |
| Exception raised **inside** an `except` handler | Yes, then the new one propagates |
| Exception raised inside the `else` clause | Yes, then it propagates |
| `return` in the `try` suite | Yes, before the function actually returns |
| `break` or `continue` in the `try` suite (inside a loop) | Yes, before the jump |
| `return` in an `except` handler | Yes |
| `sys.exit()` anywhere in the statement | Yes — it raises `SystemExit`, an ordinary exception |
| `KeyboardInterrupt` during the `try` suite | Yes — also an ordinary exception |

The last two are worth dwelling on. `sys.exit()` is not a system call; the docs
are explicit:

> *"Cleanup actions specified by finally clauses of `try` statements are honored,
> and it is possible to intercept the exit attempt at an outer level."*

So `sys.exit()` inside a `try`/`finally` still cleans up, and `except
SystemExit:` (or a `BaseException` handler) can *cancel* it entirely. That is
sometimes what you want in a test harness and almost never what you want in
production code. The `sys.exit` docs add a second constraint worth knowing:
*"Since `exit()` ultimately 'only' raises an exception, it will only exit the
process when called from the main thread, and the exception is not
intercepted."* A `sys.exit()` in a worker thread kills that thread, not the
process. The cases where `finally` genuinely does **not** run are in
[03g · When `finally` does not run](03g-when-finally-does-not-run.md).

## The return value is computed before `finally` runs

`return expr` evaluates `expr` first, and *then* leaves the block — so the
`finally` sees a value that has already been produced:

```python
def f(items):
    try:
        return items.pop()     # pop() happens here
    finally:
        items.clear()          # ...and only then does this run
```

The popped item is returned even though the list was cleared afterwards, because
`pop()` already ran and the result is being carried out of the function. Note
that this only holds because the returned object is the popped *element*; if a
function returns the list itself, a `finally` that mutates the list mutates what
the caller receives, because they are the same object — see
[assignment and aliasing](../07-assignment-and-aliasing/README.md).

What a `finally` cannot do is change *which* object is returned — unless it
executes its own `return`, which is the trap in
[03e](03e-return-break-continue-in-finally.md).

## The exception is not visible inside `finally`

A short sentence with real consequences:

> *"The exception information is not available to the program during execution of
> the `finally` clause."*

So this is not a supported way to find out whether the block failed:

```python
try:
    do_work()
finally:
    if sys.exception() is not None:      # do not rely on this here
        logger.error("failed")
```

If you need to know, you need an `except` clause — that is what they are for. The
two idiomatic shapes:

```python
ok = False
try:
    do_work()
    ok = True
finally:
    metrics.record(success=ok)
```

```python
try:
    do_work()
except Exception:
    metrics.record(success=False)
    raise
else:
    metrics.record(success=True)
```

The second is longer and strictly better: no flag to keep in sync, and the
explicit `raise` makes it obvious the exception is not being swallowed. It also
distinguishes "failed with an `Exception`" from "was cancelled by a
`KeyboardInterrupt`", which the flag version cannot — see
[04 · The exception hierarchy](04-the-exception-hierarchy.md).

## `finally` in a loop

`break` and `continue` in the `try` suite both trigger the `finally` before they
jump. That makes `try`/`finally` inside a loop body predictable:

```python
for path in paths:
    handle = open_raw(path)
    try:
        if not handle.valid:
            continue                 # finally runs, then next iteration
        if handle.is_terminator:
            break                    # finally runs, then out of the loop
        process(handle)
    finally:
        handle.release()             # every iteration, every route
```

Every iteration releases exactly once, on all four routes (invalid, terminator,
processed, raised). The corresponding *unsafe* thing is putting `continue` or
`break` in the `finally` itself — [03e](03e-return-break-continue-in-finally.md).

## `finally` versus a `while` loop's `else`

They answer different questions and are often confused in retry code:

| Clause | Question it answers |
|---|---|
| loop `else` | did the loop finish without `break`? |
| `try` `else` | did the suite finish without raising? |
| `try` `finally` | (asks nothing — always runs) |

A retry loop usually wants all three: `try`/`except` per attempt, `break` on
success, `else` on the loop for "ran out of attempts", and `finally` for the
per-attempt cleanup. See
[`for`/`else` and `while`/`else`](../08-control-flow/03-for-else-and-while-else.md).

## Gotchas

**★ Symptom — `sys.exit()` in a worker does not exit the process, or exits much
later than expected.** Cause: `sys.exit()` raises `SystemExit`; every `finally`
on the way out runs first, any broad handler upstream can catch it, and it only
terminates the process at all when raised on the main thread. Fix: do not use
broad handlers; if you truly must exit immediately without cleanup, that is
`os._exit` — see [03g](03g-when-finally-does-not-run.md).

**★ Symptom — a `finally` that logs "operation failed" logs it on success too.**
Cause: `finally` cannot see whether an exception occurred; the reference says the
exception information is not available there. Fix: `except ...: log; raise`
paired with `else:`, or a success flag if you must keep one clause.

**Symptom — a `finally` mutates the object the function just returned and the
caller sees the mutation.** Cause: the return *value* is fixed before the
`finally` runs, but if that value is a mutable object the `finally` still holds a
reference to, mutating it is visible. Fix: return a copy, or move the mutation
out of the `finally`.

**Symptom — Ctrl-C appears to do nothing during a long loop with a `finally`.**
Cause: `KeyboardInterrupt` is an ordinary exception, so it is parked and every
`finally` on the unwind path runs first; a slow or broadly-catching `finally`
delays or absorbs it. Fix: keep `finally` bodies short and non-catching.

**Symptom — `else` and `finally` both present, and someone moved success-path
code into `finally` "because it always runs anyway".** Cause: confusing the two
clauses. Fix: `finally` runs on the failure route too, where the success-path
names may be unbound and the work is wrong to do at all. Success-path work
belongs in `else`.

**Symptom — a `finally` inside a loop releases a resource that a `break` was
meant to hand out of the loop.** Cause: `break` runs the `finally` on its way
out, so the release happens before the code after the loop sees the resource.
Fix: hand ownership out explicitly (assign to a name outside the loop and do not
release on the success route), or restructure so the loop returns.

## Interview questions

**★ Q: When does `finally` run?**
On every route out of the `try` statement: normal completion, a handled
exception, an unhandled exception (parked, then re-raised after the `finally`),
an exception raised inside a handler or inside `else`, and a `return`, `break` or
`continue` executed in the `try` suite — the reference calls that last case
running 'on the way out'. It also runs for `SystemExit` and `KeyboardInterrupt`,
because those are ordinary exceptions.

**★ Q: Can `finally` see the exception that is in flight?**
No. The reference: *"The exception information is not available to the program
during execution of the `finally` clause."* If you need to know, use an `except`
clause that logs and re-raises, or set a success flag before the `finally`.

**Q: Does `finally` run before or after the `return` value is computed?**
After. `return expr` evaluates `expr`, then the `finally` runs, then the value is
handed back. So mutating the returned object in `finally` is visible to the
caller, but you cannot change *which* object is returned — unless the `finally`
executes its own `return`.

**Q: Does `sys.exit()` skip `finally` blocks?**
No. `sys.exit()` raises `SystemExit`, which is an ordinary exception: cleanup
actions in `finally` are honoured and the exit *"can be intercepted at an outer
level"*. It also only exits the process when raised on the main thread and not
caught.

**Q: Is `try`/`finally` safe inside a loop with `break` and `continue`?**
Yes — both run the `finally` before they jump, so each iteration cleans up
exactly once. What is unsafe is a `break` or `continue` written *inside* the
`finally` body.

**Q: You need a metric recorded on both success and failure, plus different
labels for each. How do you write it?**
`try` / `except Exception: record(failure); raise` / `else: record(success)`.
Do not use `finally` with a flag unless you have to: the `except`/`else` shape
names both outcomes, keeps the re-raise visible, and lets a `KeyboardInterrupt`
pass through un-labelled rather than being counted as an application failure.

---

← Prev: [The `else` clause](02-the-else-clause.md) · Index: [Exceptions](README.md) · Next → [Cleanup patterns that survive `finally`](03b-finally-cleanup-patterns.md)
