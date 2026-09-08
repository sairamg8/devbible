---
title: "else narrows what the handlers own, never what cleanup covers — finally runs over try, except and else alike, carries none of else's three conditions, and no ordinary exit from a try suite skips it"
sidebar_label: "06h · Where `finally` sits"
sidebar_position: 148
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the clause execution order, the `else` condition, the saved-exception rule, the "on the
> way out" rule, the `try1_stmt` grammar, the last-`return`-wins rule) and
> [The `break` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06g](06g-width-at-a-boundary.md) gave you two structural repairs — hoist the leap, put
the consumer in `else`. Both operate on what the *handlers* own. Neither touches `finally`,
which the reference defines as running over `try`, `except` and `else` alike. That is not a
detail: `else` carries three explicit conditions and `finally` carries none, so every
narrowing move you make in the handlers leaves the cleanup's exposure exactly where it was.
This page is the mechanics — when each clause runs, and what skips which. What that leaves
you free to *put* in a `finally` is [06n](06n-what-belongs-in-a-finally.md); the sanctioned
alternative that binds cleanup to an object is
[06o](06o-with-is-the-sanctioned-form.md). The `finally` that *jumps* is
[06k](06k-the-jump-that-discards.md); the `finally` that *raises* is
[06i](06i-when-cleanup-raises-and-the-grammar-refuses.md).**

## The order the clauses actually run in

The reference states the whole of it in one paragraph:

> *"If `finally` is present, it specifies a 'cleanup' handler. The `try` clause is executed,
> including any `except` and `else` clauses. If an exception occurs in any of the clauses
> and is not handled, the exception is temporarily saved. The `finally` clause is executed.
> If there is a saved exception it is re-raised at the end of the `finally` clause. If the
> `finally` clause raises another exception, the saved exception is set as the context of
> the new exception."*

Read *"including any `except` and `else` clauses"* carefully — that is the sentence that
settles the question people actually ask after 06g. **Moving work into `else` does not take
it out from under `finally`.** It never did; that was not what `else` was for. `else`
narrows what the *handlers* own. `finally` is not a handler, so there is nothing there to
narrow, and consequently no way to narrow it.

```python
try:
    fp = open(path)                  # the leap
except FileNotFoundError:
    return {}
else:
    data = json.load(fp)             # narrowed: no longer owned by the except clause
finally:
    fp.close()                       # 🔴 still runs after `else`, and still runs on the
                                     #    FileNotFoundError path — where `fp` is unbound
```

Two facts stack there. `finally` runs after `else`, so a `json.load` failure is saved, the
close happens, and the failure is then re-raised — exactly what you want. But `finally` also
runs on the `except` path, where `open()` never returned and `fp` was never bound, so
`fp.close()` raises `NameError` and *replaces* the recovery you wrote. The fix is not more
`finally`; it is a context manager, which binds cleanup to a successful acquisition rather
than to the statement:

```python
try:
    fp = open(path)
except FileNotFoundError:
    return {}
else:
    with fp:                          # cleanup scoped to the object that exists
        return json.load(fp)
```

That is the same shape the `os.access` entry uses, and the whole argument for it is
[06o](06o-with-is-the-sanctioned-form.md).

## `else` can be skipped. `finally` cannot.

The two clauses look symmetrical in the grammar and are not symmetrical at all in execution.
`else` carries three conditions; `finally` carries none:

> *"The optional `else` clause is executed if the control flow leaves the `try` suite, no
> exception was raised, and no `return`, `continue`, or `break` statement was executed.
> Exceptions in the `else` clause are not handled by the preceding `except` clauses."*

Three ways to skip `else`, then — an exception, or a `return`, `continue` or `break` out of
the `try` suite. None of them skips `finally`:

```python
def load(path, cache):
    try:
        hit = cache[path]
        if hit is not None:
            return hit               # skips `else` entirely
    except KeyError:
        return None
    else:
        hit = _read(path)            # only reached on the fall-off-the-end path
        cache[path] = hit
        return hit
    finally:
        metrics.increment("load.attempted")   # runs on all three paths
```

That asymmetry is the practical content of the rule. Anything you move into `else` gains a
condition; anything you leave in `finally` does not. If a piece of cleanup is only correct on
some of those paths, `finally` is the wrong clause for it, and no amount of restructuring the
handlers will make it the right one.

The grammar reinforces the same division. `try1_stmt` requires **one or more** `except`
clauses before an optional `else` and an optional `finally`, so `try` / `finally` with no
`except` at all is legal and is the pure-cleanup shape — a statement with no handlers and
therefore nothing to narrow. `try` / `else` with no `except` is a `SyntaxError`, which is
[06l](06l-the-else-you-cannot-write.md)'s subject.

## No ordinary exit skips it

The reference adds the rule for leaving the suite early:

> *"When a `return`, `break` or `continue` statement is executed in the `try` suite of a
> `try`…`finally` statement, the `finally` clause is also executed 'on the way out.'"*

and the `break` statement's own entry says the same thing from the other side:

> *"When `break` passes control out of a `try` statement with a `finally` clause, that
> `finally` clause is executed before really leaving the loop."*

So there is no ordinary exit from a `try` that skips `finally` — not a `return`, not an
exception, not a `break`, and not a `return` from inside an `except` clause either, since
that clause is part of what the reference calls the `try` clause being executed. Everything
the statement does is covered. (The genuine cases where `finally` does not run at all are
about the process or the frame ceasing to exist rather than about the statement:
[03g · When `finally` does not run](../11-exceptions/03g-when-finally-does-not-run.md).)

The one thing that *does* change the outcome is a jump out of the `finally` clause itself.
The reference is blunt about it — *"If the `finally` clause executes a `return`, `break` or
`continue` statement, the saved exception is discarded"* — and 3.14 emits a `SyntaxWarning`
for it. That shape has its own page: [06k](06k-the-jump-that-discards.md).

## Gotchas

**★ Symptom: the alert says `NameError: name 'fp' is not defined`, and the real error was a
missing file.** Cause: `finally` runs on the `except` path too, where the name the cleanup
uses was never bound — so the cleanup's failure replaces the recovery. Fix: bind cleanup to
the object, not to the statement.

```python
try:
    fp = open(path)
except FileNotFoundError:
    return {}
else:
    with fp:                      # cleanup exists only where `fp` does
        return json.load(fp)
```

**★ Symptom: the `else` block never ran, but the `finally` did — and the cache was never
populated.** Cause: a `return` inside the `try` suite. The reference makes `else` conditional
on *"no `return`, `continue`, or `break` statement was executed"*, and makes `finally`
conditional on nothing at all. Fix: do not put the early exit in the `try` suite if `else`
has to run; keep the `try` to the leap and decide afterwards.

```python
try:
    hit = cache[path]
except KeyError:
    hit = None
else:
    if hit is None:
        hit = _read(path)
        cache[path] = hit
return hit                        # the exit is now outside the statement entirely
```

**Symptom: the `finally` fired on a path the `except` clause had already handled and returned
from, and the metric double-counts.** Cause: a `return` in an `except` clause is still an
exit from the statement, and `finally` runs *"on the way out"* of every one of them. The
handler recovering successfully does not make it a path the cleanup skips. Fix: if the
cleanup is only correct for the success path, it is not cleanup — put it in `else`, which is
the only clause that runs solely on success.

```python
try:
    row = fetch(key)
except KeyError:
    return None                   # `finally` still runs here
else:
    metrics.increment("fetch.hit")  # success-only work belongs in `else`
    return row
finally:
    conn.release()                # correct on every path, which is why it is here
```

**Symptom: a `continue` inside a loop's `try` skipped the bookkeeping in `else` but still ran
the `finally`, and the two counters disagree.** Cause: the same three conditions, reached
from the loop side — `continue` is one of the statements that skips `else`, and the `break`
entry's rule that cleanup runs *"before really leaving the loop"* applies to `continue`
equally. Fix: count in the clause whose run condition matches what you are counting.

```python
for key in keys:
    try:
        row = fetch(key)
        if row is None:
            continue              # skips `else`, still runs `finally`
    except KeyError:
        continue
    else:
        hits += 1                 # counts only genuine successes
    finally:
        attempts += 1             # counts every iteration, which is what it is for
```

## Interview questions

**★ You moved the risky call from `try` into `else`. Does `finally` still run over it — and
if so, what did the narrowing buy you?**
Yes, it still runs. The reference says the `try` clause is executed *"including any `except`
and `else` clauses"*, and only then is `finally` executed. But that does not undo anything,
because `else` and `finally` narrow different things: `else` removes the work from the
**handlers'** scope, and `finally` was never a handler. An exception raised in `else` is
temporarily saved, cleanup runs, and it is re-raised at the end of the `finally` clause — so
it still reaches the caller, having been cleaned up after. That is precisely the intended
result. The one shape that *does* undo the narrowing is a jump out of `finally`, which is
[06k](06k-the-jump-that-discards.md).

**★ `else` and `finally` both run after the `try` suite. What is the difference in when they
run?**
`else` is conditional on three things and `finally` on none. The reference: the `else` clause
runs *"if the control flow leaves the `try` suite, no exception was raised, and no `return`,
`continue`, or `break` statement was executed"*. So an exception skips it, and so does any
early exit from the suite. `finally` has no such conditions — the same `return` that skips
`else` runs `finally` *"on the way out"*. The practical reading is that `else` is the
success-only continuation of the `try` and `finally` is the unconditional epilogue of the
whole statement, which is why success-only work goes in `else` and only unfailable cleanup
goes in `finally`.

**Is there any exit from a `try` suite that skips its `finally`?**
Not by ordinary control flow. The reference is explicit that a `return`, `break` or
`continue` in the suite runs the `finally` *"on the way out"*, and the `break` statement's
own entry repeats it: *"When `break` passes control out of a `try` statement with a
`finally` clause, that `finally` clause is executed before really leaving the loop."* An
exception runs it on the way past, and a `return` from inside an `except` clause runs it too.
The cases where a `finally` genuinely does not run are all about the process or the frame
ceasing to exist rather than about the statement, and they are
[03g · When `finally` does not run](../11-exceptions/03g-when-finally-does-not-run.md)'s
subject. For the purposes of narrowing, treat `finally` as unconditional — that is what makes
"only cleanup that cannot fail belongs in it" a rule rather than advice.

**A `return` in the `try` suite of a `try` / `else` / `finally`. What runs, and in what
order?**
The return expression is evaluated in the `try` suite, `else` is skipped because a `return`
was executed, `finally` runs *"on the way out"*, and then the function returns the value that
was already computed — unless the `finally` itself executes a `return`, in which case the
reference's rule that *"the return value of a function is determined by the last `return`
statement executed"* makes the `finally`'s value win and the saved exception, if any, is
discarded. That second half is exactly what PEP 765 is withdrawing and what
[06k](06k-the-jump-that-discards.md) covers. The part worth remembering here is the first
half: computing the value is part of the `try` suite, so an exception while *computing* the
return value is caught by the statement's own handlers, while an exception raised by the
caller's use of that value is not.

**Why does `try` / `finally` with no `except` clause exist at all, if `finally` cannot
handle anything?**
Because handling and cleaning up are different jobs and the grammar keeps them separable.
`try1_stmt` requires at least one `except` before an `else`, but `try2_stmt` — the
`finally`-only form — has no handler requirement, so a statement can promise cleanup without
claiming to recover from anything. That is the honest shape for the very common case where
you must release something and have no idea how to fix a failure: the exception is saved,
cleanup runs, and it is re-raised unchanged, reaching a caller that does know. Writing
`except Exception: raise` around it to get the same effect would be strictly worse — it
creates a handler frame that a reader has to prove is transparent, and the width arguments in
06c through 06g all apply to it.

---

← Prev: [Width at a boundary](06g-width-at-a-boundary.md) · Index: [EAFP vs LBYL](README.md) · Next → [What belongs in a `finally`](06n-what-belongs-in-a-finally.md)
