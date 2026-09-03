---
title: "A bare `except:` catches `BaseException`, which is why the classic bug is a script that will not respond to Ctrl-C"
sidebar_label: "4b · The bare `except:`"
sidebar_position: 120
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations),
> the Python 3.14 Language Reference
> [`except` clause](https://docs.python.org/3.14/reference/compound_stmts.html#except-clause),
> and the Library Reference
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html).
> Target: **CPython 3.14**.

**`except:` with no expression matches every exception there is — which means it
matches `KeyboardInterrupt` and `SystemExit` too. The result is the most
recognisable bug in this whole topic: a long-running script inside a loop that
prints an error on every Ctrl-C and carries on regardless, because your interrupt
was caught and discarded as though it were an application error. `except
Exception:` is one word longer and does not have that failure. There are exactly
two situations in which a bare `except:` is defensible, and PEP 8 names both.**

## What it actually matches

> *"An expression-less `except` clause, if present, must be last; it matches any
> exception."*

"Any exception" means any `BaseException`, so `except:` and `except
BaseException:` catch the same set. The difference is only that the second one
says so.

Because [`KeyboardInterrupt`, `SystemExit`, `GeneratorExit` and
`BaseExceptionGroup`](04-the-exception-hierarchy.md) were deliberately placed
outside `Exception` so that broad handlers would not see them, a bare `except:`
undoes exactly the design decision the hierarchy was built around.

## The Ctrl-C bug, in the shape it appears

```python
while True:
    try:
        item = queue.get(timeout=1)
        process(item)
    except:                          # catches KeyboardInterrupt too
        logger.error("worker error")
        continue
```

Ctrl-C sets a pending interrupt; the interpreter *"makes a check for interrupts
regularly"* and raises `KeyboardInterrupt` at the next check. Here that lands
inside the `try`, is caught, is logged as "worker error", and the loop starts
again — so the next Ctrl-C does the same. The process becomes unkillable by
normal means and the operator escalates to `kill -9`, which skips every
`finally` — see [03g](03g-when-finally-does-not-run.md). One bad handler turned a
graceful shutdown into data loss.

The same handler eats `sys.exit()`. A worker that calls `sys.exit(1)` on a fatal
config error raises `SystemExit`, which this loop logs and continues past.

The fix is one word:

```python
    except Exception:
        logger.exception("worker error")
        continue
```

Now `KeyboardInterrupt` and `SystemExit` propagate, the loop's `finally` blocks
run, and the process exits. (`logger.exception` rather than `logger.error` is the
other half of the fix — see **13** *(not written yet)*.)

## PEP 8's rule and its two exceptions

> *"When catching exceptions, mention specific exceptions whenever possible
> instead of using a bare `except:` clause."*

PEP 8 then names the only two cases where the bare form is acceptable:

> *"If the exception handler will be printing out or logging the traceback; at
> least the user will be aware that an error has occurred."*

> *"If the code needs to do some cleanup work, but then lets the exception
> propagate upwards with `raise`. `try...finally` can be a better way to handle
> this case."*

Both have the same property: **the exception is not swallowed.** The first
reports it, the second re-raises it. A bare `except:` whose body does not log the
traceback *and* does not re-raise has no defence.

Note PEP 8's own aside on the second case — *"`try...finally` can be a better way
to handle this case"* — which is usually true. If you are catching everything only
to clean up, `finally` does that without a handler at all.

## `except Exception:` is a different question

`except Exception:` is not the same sin. It is broad, and broad handlers hide
bugs, but it does not break interrupt or exit. There are legitimate places for
it, and they share a shape: **a boundary where an unhandled exception would take
down something bigger than the operation.**

```python
# a request handler boundary
try:
    return view(request)
except Exception:
    logger.exception("unhandled error in %s", view.__name__)
    return http_500()
```

```python
# a per-item loop that must not abort the batch
for row in rows:
    try:
        process(row)
    except Exception:
        logger.exception("row %s failed", row.id)
        failures.append(row.id)
raise_if_too_many(failures)
```

The rules that make those acceptable:

1. **It logs the traceback**, not `str(e)`.
2. **It records the failure** somewhere a human or a metric will see.
3. **It is at a boundary** — a request, a job, a batch item — not wrapped around
   an arbitrary function call in the middle of business logic.
4. **It does not report success.** The batch example collects failures and acts
   on them; the handler version returns a 500, not a 200.

`ruff`'s `BLE001` (*blind except*) flags `except Exception:` for exactly the
cases that fail those rules; `E722` flags the bare `except:` unconditionally.

## When you genuinely need `BaseException`

There is one recurring legitimate use: a boundary that must run cleanup or record
an outcome for *every* termination, including interrupt and exit, and then let it
continue.

```python
try:
    run()
except BaseException:
    span.set_status("error")
    raise                    # ALWAYS — this is what makes it legal
```

Write `except BaseException:` rather than `except:` here so a reader can see the
choice was deliberate. And the bare `raise` is not optional: without it you have
written the unkillable-loop bug with extra steps.

If a top-level handler must both catch broadly and *not* re-raise everything, name
the escapes first:

```python
try:
    main()
except (KeyboardInterrupt, SystemExit):
    raise                                  # let these through, always
except Exception:
    logger.exception("fatal")
    sys.exit(1)
```

That ordering works because [the first matching clause
wins](05-catching-specific-types.md).

## `except Exception: pass` — the line to grep for

```python
try:
    cache.delete(key)
except Exception:
    pass
```

Every failure mode of `cache.delete` — a typo in the method name
(`AttributeError`), a serialization bug (`TypeError`), an exhausted connection
pool — is now indistinguishable from success. If ignoring the error really is
right, say which error, and say it with the construct built for it:

```python
with contextlib.suppress(CacheMissError):
    cache.delete(key)
```

See **11 · `suppress` and warnings** *(not written yet)*. A `pass` in a
handler should always name a specific exception; a `pass` under `except
Exception:` is nearly always an unfinished thought.

## Gotchas

**★ Symptom — Ctrl-C prints an application error and the program keeps
running.** Cause: a bare `except:` (or `except BaseException:`) inside a loop
catching `KeyboardInterrupt`. Fix: `except Exception:`. This is the canonical
bug this topic exists to prevent.

**★ Symptom — `sys.exit(1)` in an error path does not exit and the process
reports success.** Cause: `SystemExit` is a `BaseException`, caught by the same
bare handler. Fix: narrow to `except Exception:`, or re-raise `SystemExit` and
`KeyboardInterrupt` explicitly in a first clause.

**★ Symptom — a bare `except:` hides a typo for months.** Cause: an
`AttributeError` or `NameError` from misspelled code inside the `try` is caught
along with everything else, and the handler's message describes a different
problem. Fix: catch specific types; if the handler must be broad, it must log the
traceback so the real class name is visible.

**Symptom — `SyntaxError: default 'except:' must be last`.** Cause: a bare
`except:` written before other clauses; the reference requires it to be last.
Fix: it should not be there at all, but if it is, move it to the end.

**Symptom — `except Exception:` in a `finally`-less loop reports the batch as
successful when every item failed.** Cause: the handler logs and continues but
nothing aggregates the failures. Fix: collect failures and decide at the end —
raise, or return a partial-success result the caller can act on. Consider
`ExceptionGroup` — [08](08-exception-groups.md).

**Symptom — a broad handler in a library swallows the caller's cancellation.**
Cause: `asyncio.CancelledError` is a `BaseException`, so `except Exception:` is
already safe — but a bare `except:` in library code cancels cancellation. Fix:
never write a bare `except:` in a library; the cost is paid by code you cannot
see.

**Symptom — `ruff` reports `BLE001` on a handler you believe is correct.**
Cause: `except Exception:` at a genuine boundary is a legitimate use the rule
cannot distinguish. Fix: keep it, log the traceback, and suppress the rule at
that line with a comment explaining that it is a boundary — a reviewed
suppression is better than turning the rule off globally.

**Symptom — an `except Exception:` handler runs and the program continues into
code that assumes success.** Cause: reaching the end of a handler means handled;
control resumes after the whole statement. Fix: the handler must `return`,
`raise`, or set state the next lines check.

## Interview questions

**★ Q: What is wrong with a bare `except:`?**
It matches any exception, including `KeyboardInterrupt`, `SystemExit` and
`GeneratorExit` — the classes deliberately placed outside `Exception` so that
broad handlers would not see them. The recognisable symptom is a loop that
catches Ctrl-C, logs it as an application error and keeps going, so the process
cannot be stopped gracefully. `except Exception:` is the correct broad handler.

**★ Q: When is a bare `except:` acceptable?**
PEP 8 names two cases: when the handler prints or logs the traceback, *"at least
the user will be aware that an error has occurred"*, and when the code does
cleanup and then re-raises with `raise` — for which PEP 8 itself notes that
`try...finally` is often better. Both keep the exception visible. A bare
`except:` that neither logs nor re-raises has no justification.

**★ Q: `except Exception:` — always bad?**
No, but it needs a reason. It is right at a *boundary* — a request handler, a job
runner, a per-item loop — where an unhandled exception would take down something
larger than the operation. It is wrong in the middle of business logic. And
wherever it appears it must log the traceback and record the failure; a handler
that catches broadly and reports success is worse than a crash.

**Q: How do you write a top-level handler that logs everything but still lets
Ctrl-C work?**
Put `except (KeyboardInterrupt, SystemExit): raise` as the first clause and
`except Exception:` after it. First-match-wins ordering means the escapes are
handled before the broad clause is considered.

**Q: Is `except BaseException:` ever right?**
Yes, in one shape: a boundary that must record an outcome for every kind of
termination and then re-raises unconditionally — a tracing span, a metric, a
transaction rollback. The bare `raise` is what makes it legal. Prefer the
explicit `except BaseException:` over `except:` so the intent is visible.

**Q: What is wrong with `except Exception: pass`?**
It converts every failure — including typos, type errors and exhausted
connection pools — into silent success, with no record anywhere. If ignoring a
specific error is genuinely correct, name that error and use
`contextlib.suppress(ThatError)`, which documents the intent and cannot
accidentally widen.

**Q: Which linter rules cover this?**
`ruff`/`pycodestyle` `E722` for the bare `except:`, and `ruff` `BLE001` (blind
except) for `except Exception:` / `except BaseException:`. `E722` should be an
error in any codebase; `BLE001` is worth enabling with per-line suppressions at
the handful of real boundaries.

---

← Prev: [The exception hierarchy](04-the-exception-hierarchy.md) · Index: [Exceptions](README.md) · Next → [Catching specific types](05-catching-specific-types.md)
