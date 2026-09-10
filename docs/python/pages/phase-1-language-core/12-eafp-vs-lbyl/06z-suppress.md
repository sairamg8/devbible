---
title: "suppress is EAFP with the handler made declarative, which is why it reads better than try/except/pass and why it is dangerous — it suppresses for the rest of the block, not for the statement you were thinking of"
sidebar_label: "06z · `suppress`"
sidebar_position: 156
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`suppress`, its warning
> paragraph, and the *Reentrant context managers* section). Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**`suppress` is the only member of `contextlib` whose purpose is to change control flow rather
than to guarantee cleanup, and it is the one this topic has been building toward: it is EAFP with
the handler written declaratively, at the top of the block, naming exactly which failures are
acceptable. It is the correct replacement for `try: … except OSError: pass`, because a reader can
tell at a glance that the ignoring is deliberate. It is also the single easiest `contextlib`
member to misuse, because of one property that its name does not suggest — **it suppresses for
the rest of the block.** The exception does not resume at the next statement; it exits the `with`
entirely, skipping every statement after the one that raised. A two-line block guarded by
`suppress` is not two guarded statements. The mirror image — a manager that deliberately does
nothing at all — is [06za](06za-nullcontext-the-manager-that-does-nothing.md).**

## What it is, and what it is for

> *"Return a context manager that suppresses any of the specified exceptions if they occur in the
> body of a `with` statement and then resumes execution with the first statement following the
> end of the `with` statement."*

The canonical use is a cleanup that may already have happened. This is the LBYL/EAFP decision of
[02b](02b-the-filesystem-and-the-atomic-flag.md) written in its final form — the `os.path.exists`
check has a race, the `try` / `except` has none, and `suppress` says the same thing as the `try`
in one line:

```python
import os
from contextlib import suppress

with suppress(FileNotFoundError):
    os.remove(cache_path)
```

It accepts several classes, exactly as an `except` clause does:

```python
with suppress(FileNotFoundError, IsADirectoryError):
    os.remove(cache_path)
```

The gain over `try` / `except` / `pass` is not brevity, it is legibility of *intent*. A `pass` in
an `except` block is indistinguishable from an unfinished handler — reviewers cannot tell whether
someone meant to ignore the error or meant to come back later. `suppress` has no other reading.

## 🔴 It suppresses for the rest of the block

Read the definition again with the emphasis where it belongs: the exception is suppressed *and
then* execution *"resumes execution with the first statement following the end of the `with`
statement"*. Not the next statement in the block — the first statement **after** the block.

```python
with suppress(FileNotFoundError):
    os.remove(cache_path)          # if this raises FileNotFoundError…
    os.remove(index_path)          # 🔴 …this never runs, silently
```

That block does not mean "remove both, ignoring missing files". It means "remove the first, and if
it was there, remove the second". Nothing in the syntax hints at it, the code passes review, and
the index file is deleted on most runs and left behind on exactly the runs where the cache was
already gone.

**One statement per `with`** is the honest form:

```python
with suppress(FileNotFoundError):
    os.remove(cache_path)
with suppress(FileNotFoundError):
    os.remove(index_path)
```

**Or a loop, when the statements are the same statement:**

```python
for path in (cache_path, index_path, lock_path):
    with suppress(FileNotFoundError):
        os.remove(path)
```

🔴 **Note where the `with` sits in that loop.** Putting it *outside* the loop reintroduces the
original bug in a worse form — the first missing file ends the entire loop, and every remaining
path is skipped:

```python
with suppress(FileNotFoundError):        # 🔴 the loop exits at the first miss
    for path in (cache_path, index_path, lock_path):
        os.remove(path)
```

## The docs' own warning is narrower than most uses of it

> *"As with any other mechanism that completely suppresses exceptions, this context manager should
> be used only to cover very specific errors where silently continuing with program execution is
> known to be the right thing to do."*

*"Very specific errors"* and *"known to be the right thing"* are both doing work. `suppress(Exception)`
satisfies neither, and it is the form that turns up in code that was fighting a flaky test.
`suppress(KeyError)` around fifteen lines satisfies the second but not the first — it will also
swallow a `KeyError` from a dictionary access three statements later that you never intended to
guard.

**`suppress` cannot tell you whether it fired.** There is no `else`, no return value, no flag. If
the code after the block depends on whether the operation succeeded, `suppress` is the wrong
construct and a `try` / `except` / `else` is the right one:

```python
try:
    os.remove(cache_path)
except FileNotFoundError:
    removed = False
else:
    removed = True
metrics.increment("cache.removed" if removed else "cache.absent")
```

## It is reentrant, which is unusual

> *"`threading.RLock` is an example of a reentrant context manager, as are `suppress()`,
> `redirect_stdout()`, and `chdir()`."*

A reentrant manager *"may also be used inside a `with` statement that is already using the same
context manager"* — so unlike a `@contextmanager` result ([06v](06v-one-yield-and-one-use.md)), a
single `suppress` object may be entered while already entered, and nesting behaves as you would
expect: the innermost `with` that names a matching class is the one that catches, because it is
the first `__exit__` the exception reaches.

## Gotchas

**★ Symptom: only the first of several cleanup statements ever runs, and only on the runs where
something was already missing.** Cause: `suppress` resumes *"with the first statement following
the end of the `with` statement"* — the rest of the block is skipped, not merely the failing line.
Fix: one statement per `with`, or a loop with the `with` inside it.

```python
for path in (cache_path, index_path, lock_path):
    with suppress(FileNotFoundError):
        os.remove(path)
```

**★ Symptom: a loop guarded by `suppress` processes one item and stops, with no error anywhere.**
Cause: the `with` was placed outside the loop, so the first matching exception exits the entire
loop and lands after the block. This is the previous gotcha at a larger scale and it is harder to
see, because the loop *looks* like the unit of work. Fix: the `with` goes inside, so the unit of
suppression is the unit of work.

```python
for path in paths:
    with suppress(FileNotFoundError):
        os.remove(path)             # each iteration is independently guarded
```

**★ Symptom: a genuine bug — a typo'd attribute, a `None` where an object was expected — produces
no traceback and no log line.** Cause: `suppress(Exception)`, which the docs rule out directly:
the manager *"should be used only to cover very specific errors where silently continuing with
program execution is known to be the right thing to do"*. Fix: name the exact class, and if you
cannot name it, you do not yet know that continuing is correct — use `try` / `except` with a log
and a reraise instead.

```python
with suppress(FileNotFoundError):   # not Exception, and not OSError "to be safe"
    os.remove(cache_path)
```

**★ Symptom: the code after the block behaves as if the operation succeeded.** Cause: `suppress`
has no `else` clause and no result — it cannot tell the following statements whether it fired, so
they run on both paths. Fix: when the outcome matters, the handler must be a real one.

```python
try:
    shutil.rmtree(workspace)
except FileNotFoundError:
    metrics.increment("workspace.absent")
else:
    metrics.increment("workspace.removed")
```

**Symptom: a `KeyError` from an unrelated dictionary lookup is being swallowed.** Cause:
`suppress(KeyError)` was wrapped around a long block for the sake of one lookup, and it covers
every statement in it. The class is specific; the *region* is not. Fix: shrink the block to the
statement — the same width argument as [06](06-narrowing-the-try.md), reached through a different
construct.

```python
timeout = DEFAULT_TIMEOUT
with suppress(KeyError):
    timeout = config["timeouts"]["upstream"]
send_request(url, timeout)          # outside the suppressed region
```

**Symptom: a missing key silently leaves a variable unassigned, and the next line raises
`NameError` or `UnboundLocalError`.** Cause: the assignment was the suppressed statement, so the
name was never bound. `suppress` guards a statement; it does not supply a value. Fix: bind a
default *before* the block — or use the construct designed for defaults.

```python
timeout = config.get("upstream_timeout", DEFAULT_TIMEOUT)
```

**Symptom: a reviewer replaces `try` / `except` / `pass` with `suppress` and the behaviour
changes.** Cause: the original `try` covered one statement inside a longer body, and the
replacement `with` covered the whole body. The two constructs have the same *semantics* and
different *default widths*: a `try` naturally hugs one statement, a `with` naturally wraps a
block. Fix: port the width along with the construct, and re-read the block afterwards asking
which statements the suppression now covers.

## Interview questions

**★ Why prefer `contextlib.suppress(FileNotFoundError)` to `try` / `except FileNotFoundError:
pass`?**
Because the intent is legible. A bare `pass` in an `except` clause reads identically whether it
was deliberate or abandoned, so every reviewer has to ask, and linters flag it for the same
reason. `suppress` has exactly one meaning — this class of failure is acceptable here — and it
puts that declaration at the top of the block where it is read first, rather than at the bottom
where it is read last. The semantics are the same; the difference is that one form documents
itself and the other requires a comment that will not be written. The caveat is that the two forms
do not have the same natural *width*, which is the next question.

**★ `with suppress(FileNotFoundError): os.remove(a); os.remove(b)` — what does it actually do?**
It removes `a`, and removes `b` only if removing `a` did not raise `FileNotFoundError`. The docs
say the manager suppresses the exception and *"then resumes execution with the first statement
following the end of the `with` statement"* — the end of the *statement*, not the next line of the
block. So `suppress` is a block-level construct that people read as a line-level one. Anything
after the raising statement inside the block is skipped, which is fine when the block is one
statement and a silent bug when it is not. The rule to carry: one guarded statement per `suppress`
block, or a loop with the `with` inside it.

**★ When is `suppress` the wrong tool even though the exception really is expected?**
Three cases. When the following code depends on whether it fired — there is no `else`, no result,
and no way to ask, so you need `try` / `except` / `else`. When you need a *value* rather than a
guarded action, since a suppressed assignment leaves the name unbound and the fix is a default
(`dict.get`, a preceding assignment), not a suppression. And when you cannot name the class
narrowly: the docs limit the construct to *"very specific errors where silently continuing with
program execution is known to be the right thing to do"*, so if the honest answer is
`suppress(Exception)`, the honest conclusion is that you do not yet know what you are ignoring.

**`suppress` is documented as reentrant. What does that mean, and when does it matter?**
It means a single `suppress` object *"may also be used inside a `with` statement that is already
using the same context manager"* — the same instance can be entered while already entered. In
practice you rarely hold a `suppress` object at all, since `suppress(FileNotFoundError)` is
cheaper to write than a name for it, so the property mostly matters as a contrast: a
`@contextmanager` result is single use and cannot be re-entered at any depth, `threading.Lock` is
reusable but not reentrant, and `suppress`, `redirect_stdout` and `chdir` are reentrant. It also
tells you nesting is well-defined: an inner `suppress` naming a matching class catches first,
because its `__exit__` is the first one the exception reaches.

---

← Prev: [`closing` — a `close()` method is enough](06x-closing-a-close-method-is-enough.md) · Index: [EAFP vs LBYL](README.md) · Next → [`nullcontext` — the manager that does nothing](06za-nullcontext-the-manager-that-does-nothing.md)
