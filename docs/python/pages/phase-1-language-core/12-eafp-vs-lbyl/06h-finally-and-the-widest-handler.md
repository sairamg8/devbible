---
title: "else narrows what the handlers own, never what cleanup covers — finally runs over every clause, has no width knob, and no ordinary exit from a try skips it, which is why only cleanup that cannot fail belongs in one"
sidebar_label: "06h · Where `finally` sits"
sidebar_position: 148
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (clause execution order, the saved-exception rule, the "on the way out" rule) and
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> (the seven execution steps, the `__exit__` return-value rule, the `__enter__` guarantee,
> multi-item nesting) — plus
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception) and
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06g](06g-width-at-a-boundary.md) gave you two structural repairs — hoist the leap, put
the consumer in `else`. Both operate on what the *handlers* own. Neither touches `finally`,
which the reference defines as running over `try`, `except` and `else` alike: `finally` has
no width knob, and no ordinary exit from a `try` suite skips it. That is the whole reason
only cleanup that cannot fail belongs in one. The `with` statement is the sanctioned
alternative because it binds cleanup to an *object* rather than to a statement — and it
carries a trap of its own, because an `__exit__` that returns a true value suppresses every
exception in the block. The `finally` that *jumps* is [06k](06k-the-jump-that-discards.md);
the `finally` that *raises* is [06i](06i-when-cleanup-raises-and-the-grammar-refuses.md).**

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

That is the same shape the `os.access` entry uses, and now you can see the third reason for
it. The reference adds the rule for leaving the suite early:

> *"When a `return`, `break` or `continue` statement is executed in the `try` suite of a
> `try`…`finally` statement, the `finally` clause is also executed 'on the way out.'"*

and the `break` statement's own entry says the same thing from the other side:

> *"When `break` passes control out of a `try` statement with a `finally` clause, that
> `finally` clause is executed before really leaving the loop."*

So there is no ordinary exit from a `try` that skips `finally` — not a `return`, not an
exception, not a `break`. Everything the suite does is covered, which is precisely why the
only thing that belongs in a `finally` is cleanup that cannot fail. (The genuine cases where
`finally` does not run at all are about the process or the frame ceasing to exist rather
than about the statement:
[03g · When `finally` does not run](../11-exceptions/03g-when-finally-does-not-run.md).)

## `with` is the sanctioned form — and carries the same trap

A `try` / `finally` written to close one thing is a context manager spelled out longhand,
and the reference's seven execution steps for `with` say so. Step 7 is the one that matters:

> *"The context manager's `__exit__()` method is invoked. If an exception caused the suite
> to be exited, its type, value, and traceback are passed as arguments to `__exit__()`.
> Otherwise, three `None` arguments are supplied."*

> *"If the suite was exited due to an exception, and the return value from the `__exit__()`
> method was false, the exception is reraised. If the return value was true, the exception
> is suppressed, and execution continues with the statement following the `with`
> statement."*

🔴 **"If the return value was true, the exception is suppressed."** That is the same defect
as a `return` in `finally`, wearing different clothes — and it is easier to write by
accident, because `__exit__` is a method and methods return things. A cleanup method whose
last line is `return self._close()` suppresses every exception in the block the moment
`_close()` happens to return something truthy:

```python
class Session:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return self._close()          # 🔴 if _close() returns anything truthy, every
                                      #    exception in the with-block is suppressed
```

The correct shape returns nothing at all, so the exception is reraised:

```python
class Session:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self._close()                 # falsy (None) return: the exception propagates
```

Suppression is a real feature — it is how `contextlib.suppress` works — but it must be
*intended*, and it must name what it suppresses. See
[03d · Context managers as cleanup](../11-exceptions/03d-context-managers-as-cleanup.md)
and [11 · suppress and the explicit ignore](../11-exceptions/11-suppress-and-the-explicit-ignore.md).

### The guarantee is conditional on `__enter__` succeeding

The reference states the promise precisely, and the precision is the point:

> *"The `with` statement guarantees that if the `__enter__()` method returns without an
> error, then `__exit__()` will always be called. Thus, if an error occurs during the
> assignment to the target list, it will be treated the same as an error occurring within
> the suite would be."*

**If `__enter__` itself raises, `__exit__` is never called** — the numbered steps invoke
`__enter__` at step 4 and `__exit__` at step 7, and a raise at step 4 means steps 5 to 7 do
not happen. So a context manager that acquires two things in `__enter__` and fails on the
second has leaked the first, and no amount of `with` will clean it up:

```python
class Transaction:
    def __enter__(self):
        self.conn = pool.acquire()
        self.cur = self.conn.cursor()   # 🔴 if this raises, __exit__ never runs
        return self.cur                 #    and self.conn is leaked forever
```

`__enter__` must therefore be its own transaction — clean up after itself on the way out:

```python
class Transaction:
    def __enter__(self):
        self.conn = pool.acquire()
        try:
            self.cur = self.conn.cursor()
        except Exception:
            self.conn.release()         # __exit__ will not run; this is the only chance
            raise
        return self.cur

    def __exit__(self, exc_type, exc, tb):
        self.cur.close()
        self.conn.release()
```

### Multiple items nest, and nesting decides cleanup order

> *"With more than one item, the context managers are processed as if multiple `with`
> statements were nested"* — so `with A() as a, B() as b:` is *"semantically equivalent to"*
> `with A() as a:` containing `with B() as b:`.

Two consequences worth holding. Cleanup runs **inside-out**: `B.__exit__` before
`A.__exit__`, which is what you want when B was acquired from A. And a failure in `B()`'s
construction happens *inside* A's `with`, so `A.__exit__` does run — unlike the
single-manager `__enter__` case above. The parenthesised multi-line form is the same
statement:

```python
with (
    pool.acquire() as conn,
    conn.cursor() as cur,          # constructed inside conn's with; conn is cleaned up
):
    cur.execute(query)
```

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

**★ Symptom: a `with` block swallows every exception and the context manager looks
innocent.** Cause: `__exit__` returned a true value, and the reference is explicit that
*"if the return value was true, the exception is suppressed"*. A method that ends
`return self._close()` inherits whatever `_close()` returns. Fix: make `__exit__` return
`None` unless suppression is the deliberate, documented intent.

```python
def __exit__(self, exc_type, exc, tb):
    self._close()                 # not `return self._close()`
```

**★ Symptom: connections leak only when the database is slow, and the pool eventually
starves.** Cause: `__enter__` acquired the connection and then raised while opening a
cursor. The guarantee is conditional — *"if the `__enter__()` method returns without an
error, then `__exit__()` will always be called"* — so `__exit__` never ran and the
connection was never released. Fix: guard the second acquisition inside `__enter__` and
release on the way out, because nothing downstream will.

```python
def __enter__(self):
    self.conn = pool.acquire()
    try:
        self.cur = self.conn.cursor()
    except Exception:
        self.conn.release()
        raise
    return self.cur
```

**Symptom: cleanup ran in the wrong order and closed a connection before its cursor.**
Cause: the two managers were on separate statements, or acquired in the wrong sequence — in
one `with` they are *"processed as if multiple `with` statements were nested"*, so the last
one acquired is the first one released. Fix: acquire in dependency order in a single `with`
and let the nesting do it.

```python
with pool.acquire() as conn, conn.cursor() as cur:
    cur.execute(query)            # cur.__exit__ runs first, then conn.__exit__
```

**Symptom: a `finally` was added to "make sure the file closes" and the function started
raising `NameError` on the error path.** Cause: the same unbound-name problem, arrived at
from the other direction — `finally` is attached to the statement, and the statement runs
its cleanup whether or not the acquisition happened. Fix: if the cleanup belongs to an
object, it belongs in a `with`; keep `finally` for cleanup that is nobody's `__exit__`.

```python
span = tracer.start_span("query")   # not an object with cleanup semantics of its own
try:
    return conn.execute(query)
finally:
    span.end()                      # safe: `span` is bound before the try
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

**★ When do you reach for `try` / `finally` and when for `with`?**
`with` whenever the cleanup belongs to an object, which is almost always. The reference's
step 7 shows why: `__exit__` is invoked with the exception details and the exception is
reraised unless `__exit__` returns true, so the cleanup is bound to the object's lifetime
rather than to the statement's shape. That fixes the unbound-name failure for free — a `with`
cannot run cleanup for an object that was never constructed, whereas a `finally` runs on the
`except` path where the name may not exist. Keep `try` / `finally` for cleanup that is not an
object's responsibility: ending a span, decrementing a gauge, restoring a global you changed.

**★ If `__enter__` raises halfway through acquiring two resources, does `__exit__` run?**
No, and this is the one place the `with` statement's guarantee is narrower than people
assume. The reference words it exactly: *"The `with` statement guarantees that if the
`__enter__()` method returns without an error, then `__exit__()` will always be called."*
The conditional is load-bearing — `__enter__` is step 4 of seven and `__exit__` is step 7,
so a raise at step 4 skips it. A context manager that acquires more than one thing must
therefore unwind its own partial state before re-raising, exactly as if it were a
transaction. The alternative is to acquire one thing per manager and let multi-item nesting
handle the rest, since a failure constructing the second manager happens *inside* the
first's `with` and does trigger its `__exit__`.

**How is an `__exit__` that returns true the same defect as a `return` in `finally`, and how
is it different?** Same in effect: both make cleanup swallow an exception it never named, and
neither reads as a handler. Different in two ways that matter. First, `__exit__`'s
suppression is a documented, intended feature — *"if the return value was true, the exception
is suppressed"* — which is exactly how `contextlib.suppress` is built, whereas a jump out of
`finally` is a shape the language is actively trying to withdraw. Second, `__exit__`'s
version is easier to write by accident, because it is a method: `return self._close()`
quietly inherits whatever `_close()` returns. The review rule is the same either way — the
suppression must be intended and must name what it suppresses.

**Is there any exit from a `try` suite that skips its `finally`?**
Not by ordinary control flow. The reference is explicit that a `return`, `break` or
`continue` in the suite runs the `finally` *"on the way out"*, and the `break` statement's
own entry repeats it: *"When `break` passes control out of a `try` statement with a
`finally` clause, that `finally` clause is executed before really leaving the loop."* An
exception runs it on the way past. The cases where a `finally` genuinely does not run are
all about the process or the frame ceasing to exist rather than about the statement, and
they are [03g · When `finally` does not run](../11-exceptions/03g-when-finally-does-not-run.md)'s
subject. For the purposes of narrowing, treat `finally` as unconditional — that is what
makes "only cleanup that cannot fail belongs in it" a rule rather than advice.

**In `with A() as a, B() as b:`, which `__exit__` runs first, and why does it matter?**
`B`'s. The reference says multi-item managers are *"processed as if multiple `with`
statements were nested"*, so the form is equivalent to `with A()` containing `with B()`, and
an inner block's cleanup completes before the outer block's. It matters whenever the second
resource was derived from the first — a cursor from a connection, a file from a temporary
directory — because releasing the outer one first would invalidate the inner one mid-close.
It also means a failure while *constructing* `B()` is a failure inside `A`'s block, so
`A.__exit__` does run; that is the difference between splitting acquisitions across managers
and cramming them both into one `__enter__`.

**06f said "the traceback knows; the clause does not." Does a `finally` clause know which
exception it is about to re-raise?** The documentation does not settle this, and I would not
assert it either way. The saved exception is not bound to a name — there is no `finally … as
exc` — and the two functions that would tell you are documented in terms of handlers, not
cleanup: `sys.exception()` *"when called while an exception handler is executing (such as an
`except` or `except*` clause), returns the exception instance that was caught by this
handler"*, and `exc_info()` is defined in terms of the same "currently handled" exception.
Neither entry mentions `finally`. There is adjacent evidence pointing the other way — the
`raise` statement's description of implicit chaining says an exception *"may be handled when
an `except` or `finally` clause, or a `with` statement, is used"* — but that sentence is
about what sets `__context__`, not about what `sys.exception()` returns, so it does not
settle the question either. The design conclusion does not depend on resolving it: if the
cleanup needs to know what failed, that is an `except` clause, not a `finally` clause, and
writing it as one also gives you a name to log and a class to re-raise.

---

← Prev: [Width at a boundary](06g-width-at-a-boundary.md) · Index: [EAFP vs LBYL](README.md) · Next → [The jump that discards](06k-the-jump-that-discards.md)
