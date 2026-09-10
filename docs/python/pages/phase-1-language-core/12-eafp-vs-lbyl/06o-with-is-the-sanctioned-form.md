---
title: "with binds cleanup to an object instead of a statement — the seven steps load __exit__ before __enter__ is ever called, and a truthy __exit__ suppresses an exception while leaving every other kind of exit untouched"
sidebar_label: "06o · `with` is the sanctioned form"
sidebar_position: 150
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> (the seven execution steps verbatim and the three paragraphs of step 7) and
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> for the contrast with a jump out of `finally`. Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**[06n](06n-what-belongs-in-a-finally.md) ended on a contrapositive: cleanup that needs a
name the `try` suite created is an object's lifetime written out longhand. `with` is the form
that gives the lifetime back to the object, and the reference specifies it as seven numbered
steps rather than as an idiom. Two of them decide almost everything on this page. `__exit__`
is looked up at step 3, *before* `__enter__` is invoked at step 4, so a manager missing its
cleanup method fails before it has acquired anything and cannot have its cleanup swapped
mid-block. And step 7 consults `__exit__`'s return value **only** on the exception path, so a
truthy `__exit__` suppresses an exception but — unlike a `return` in a `finally` — cannot
touch a `return`, a `break` or a `continue`. What the statement guarantees about `__enter__`
is [06p](06p-the-guarantee-and-the-nesting.md).**

## The seven steps

The reference gives the whole semantics as a numbered list, for a `with` with one item:

> *"1. The context expression (the expression given in the `with_item`) is evaluated to
> obtain a context manager. 2. The context manager's `__enter__()` is loaded for later use.
> 3. The context manager's `__exit__()` is loaded for later use. 4. The context manager's
> `__enter__()` method is invoked. 5. If a target was included in the `with` statement, the
> return value from `__enter__()` is assigned to it. 6. The suite is executed. 7. The context
> manager's `__exit__()` method is invoked."*

🔴 **Steps 2 and 3 are lookups; step 4 is the first call.** Both halves of the protocol are
resolved before anything is acquired, which is the difference between a `with` failing
cleanly and a `with` failing halfway. A class that defines `__enter__` and forgets `__exit__`
does not acquire a connection and then discover it cannot release it — it fails at step 3,
before `__enter__` runs at all:

```python
class Half:
    def __enter__(self):
        self.conn = pool.acquire()    # never reached: the lookup at step 3 fails first
        return self.conn

with Half() as conn:                  # TypeError, and nothing was acquired
    conn.execute(query)
```

The same ordering is why swapping `__exit__` on an object *inside* the block changes nothing:
the callable the statement will use was captured at step 3, before the suite at step 6 ever
ran. Cleanup is decided when the statement begins, not when it ends — which is the precise
sense in which `with` binds cleanup to the object rather than to the code.

Step 1 is worth a second look too. The *context expression* is evaluated once, to obtain the
manager, and everything afterwards is done to that one object. `with make_session() as s:`
calls `make_session()` exactly once; a retry that wants a fresh manager has to re-enter the
statement, not re-run the expression.

## Step 7 — what suppression does, and what it does not touch

Step 7 has three paragraphs, and most readers stop after two:

> *"The context manager's `__exit__()` method is invoked. If an exception caused the suite
> to be exited, its type, value, and traceback are passed as arguments to `__exit__()`.
> Otherwise, three `None` arguments are supplied."*

> *"If the suite was exited due to an exception, and the return value from the `__exit__()`
> method was false, the exception is reraised. If the return value was true, the exception is
> suppressed, and execution continues with the statement following the `with` statement."*

> *"If the suite was exited for any reason other than an exception, the return value from
> `__exit__()` is ignored, and execution proceeds at the normal location for the kind of exit
> that was taken."*

🔴 **The third paragraph is the one that separates this from a `finally`.** A `return`,
`break` or `continue` in a `finally` *discards the saved exception* and can replace the
function's return value; a truthy `__exit__` can do neither. Its return value is consulted
**only** on the exception path, and *"execution proceeds at the normal location for the kind
of exit that was taken"* on every other. So the two defects are not the same defect after all:
`__exit__` suppression is strictly narrower and, unlike the `finally` jump, it is a documented
feature rather than a shape PEP 765 is withdrawing.

The first paragraph is what makes suppression *decidable*. `__exit__` receives the type, value
and traceback, so a manager that suppresses can suppress by class — which is the whole
mechanism behind `contextlib.suppress`. A `finally` clause has no name for the exception at
all, so it can only discard everything or nothing.

It is still easy to write by accident, because `__exit__` is a method and methods return
things. A cleanup whose last line is `return self._close()` suppresses every exception in the
block the moment `_close()` happens to return something truthy:

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

## Gotchas

**★ Symptom: a `with` block swallows every exception and the context manager looks
innocent.** Cause: `__exit__` returned a true value, and the reference is explicit that
*"if the return value was true, the exception is suppressed"*. A method that ends
`return self._close()` inherits whatever `_close()` returns. Fix: make `__exit__` return
`None` unless suppression is the deliberate, documented intent.

```python
def __exit__(self, exc_type, exc, tb):
    self._close()                 # not `return self._close()`
```

**★ Symptom: `TypeError` naming `__exit__` on a class that clearly defines `__enter__`, and
no resource was acquired.** Cause: the lookup at step 3 happens before the call at step 4, so
a manager missing `__exit__` fails before acquiring anything. This is the benign direction of
the ordering — nothing leaked — but it is also why the traceback points at the `with` line
rather than at any code you wrote inside the manager. Fix: define both halves of the protocol,
or wrap the object in `contextlib.closing` and let it supply the missing half
([06q](06q-contextlib-when-the-object-does-not-cooperate.md), and
[06x](06x-closing-a-close-method-is-enough.md) for `closing` itself).

```python
class Session:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):   # required, even if it only closes
        self._close()
```

**★ Symptom: an `__exit__` was made to return `True` "so the caller keeps its return value",
and now every exception in the block disappears.** Cause: two unrelated behaviours were
confused. The return value is consulted *only* on the exception path; on any other exit
*"the return value from `__exit__()` is ignored"*, so a `return` inside the block was never
at risk. Making `__exit__` truthy did not protect the return value — it silenced the errors.
Fix: return `None`, and let the normal exit proceed at *"the normal location for the kind of
exit that was taken"*.

```python
def __exit__(self, exc_type, exc, tb):
    self._close()
    return None                   # a `return` inside the block was never in danger
```

**Symptom: an object's `__exit__` was patched inside the `with` block and the patch had no
effect.** Cause: step 3 loaded the callable before the suite at step 6 ran, so the statement
is holding the original. Fix: decide the cleanup before entering — choose the manager, or
wrap it, rather than mutating it mid-block.

```python
manager = QuietSession() if quiet else Session()   # decided before step 3
with manager as session:
    session.execute(query)
```

**Symptom: a retry loop re-runs the `with` body but keeps getting the same exhausted
manager.** Cause: the context expression is evaluated once at step 1, so a manager captured
into a variable and re-entered is the same object every time — and a manager that is not
documented as reusable has no obligation to work twice. Fix: put the *expression* inside the
loop, so each attempt evaluates step 1 again.

```python
for attempt in range(3):
    with make_session() as session:   # step 1 runs per attempt, not once
        if session.try_execute(query):
            break
```

**Symptom: an exception raised inside `__exit__` itself replaces the block's exception, and
the original is only visible under `__context__`.** Cause: `__exit__` is cleanup, and cleanup
that raises displaces what it was cleaning up after — the same rule as a `finally` that
raises, reached through the protocol instead of the clause. Fix: an `__exit__` handles its own
failures, exactly as a `finally` must.

```python
def __exit__(self, exc_type, exc, tb):
    try:
        self._close()
    except OSError:
        log.warning("close failed", exc_info=True)   # does not displace exc
```

## Interview questions

**★ When do you reach for `try` / `finally` and when for `with`?**
`with` whenever the cleanup belongs to an object, which is almost always. The reference's
step 7 shows why: `__exit__` is invoked with the exception details and the exception is
reraised unless `__exit__` returns true, so the cleanup is bound to the object's lifetime
rather than to the statement's shape. That answers 06n's first question for free — a `with`
cannot run cleanup for an object that was never constructed, whereas a `finally` runs on the
`except` path where the name may not exist. Keep `try` / `finally` for cleanup that is not an
object's responsibility: ending a span, decrementing a gauge, restoring a global you changed.

**★ Steps 2 and 3 load `__enter__` and `__exit__` before step 4 invokes `__enter__`. What
does that ordering actually guarantee?**
That a manager which cannot clean up never acquires anything. Both halves of the protocol are
resolved before the first call, so the failure mode for an incomplete manager is a `TypeError`
at the top of the statement with no resource held, rather than a leak discovered at the
bottom. It also fixes the identity of the cleanup callable for the whole statement: whatever
`__exit__` resolved to at step 3 is what runs at step 7, so reassigning it during the suite
has no effect. Both properties come from the same fact — the statement decides how it will
end before it begins.

**★ How is an `__exit__` that returns true the same defect as a `return` in `finally`, and
how is it different?** Same in effect on the exception path: both make cleanup swallow an
exception it never named, and neither reads as a handler. Different in two ways that matter.
First, `__exit__`'s suppression applies *only* to exceptions — step 7's third paragraph says
that on any other exit *"the return value from `__exit__()` is ignored"* — whereas a `return`
in a `finally` also replaces the function's return value, so the `finally` version is strictly
wider. Second, `__exit__`'s suppression is a documented, intended feature, which is exactly
how `contextlib.suppress` is built, whereas the `finally` jump is a shape PEP 765 is actively
withdrawing. The review rule is the same either way: the suppression must be intended and must
name what it suppresses.

**Why can `contextlib.suppress` name the exceptions it swallows when a `finally` cannot?**
Because step 7 passes `__exit__` the type, value and traceback of whatever left the suite, so
the cleanup is holding the exception and can decide by class. A `finally` clause has no such
binding — there is no `finally … as exc` — so the only discard it can perform is total, via a
`return`, `break` or `continue`, and it performs it blind. That asymmetry is the reason
selective suppression is a supported feature of one construct and an accident of the other,
and it is why "swallowing exceptions" is a fair criticism of a `finally` jump and an
incomplete one of a context manager.

**Your manager needs to log the exception but not swallow it. What does `__exit__` return?**
Something falsy, which in practice means falling off the end and returning `None`. Step 7 says
the exception *"is reraised"* when the return value is false, so logging and returning nothing
gives you observation without interference. The trap is that the logging call itself often
returns something, and `return log.exception(...)` or `return self._record(exc)` inherits it —
which is the same accident as `return self._close()`. Write the side effect as a statement and
leave the `return` off entirely; if the manager genuinely should suppress, say so with an
explicit `return True` next to a comment naming what is being suppressed and why.

---

← Prev: [What belongs in a `finally`](06n-what-belongs-in-a-finally.md) · Index: [EAFP vs LBYL](README.md) · Next → [The guarantee and the nesting](06p-the-guarantee-and-the-nesting.md)
