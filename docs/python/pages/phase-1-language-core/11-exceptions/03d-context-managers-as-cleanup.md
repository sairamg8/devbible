---
title: "`with` is `try`/`finally` with the cleanup attached to the object — plus the one power `finally` does not have"
sidebar_label: "3d · Context managers as cleanup"
sidebar_position: 115
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement),
> the Library Reference
> [`contextlib.closing`](https://docs.python.org/3.14/library/contextlib.html#contextlib.closing),
> [`contextlib.ExitStack`](https://docs.python.org/3.14/library/contextlib.html#contextlib.ExitStack),
> [`contextlib.contextmanager`](https://docs.python.org/3.14/library/contextlib.html#contextlib.contextmanager),
> and the Tutorial
> [Predefined Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#predefined-clean-up-actions).
> Target: **CPython 3.14**.

**Every `with` statement is a `try`/`finally` whose cleanup has been moved from
the call site into the object. That is worth doing for the obvious reason — the
cleanup is written once instead of at every use site — and for a subtler one: it
closes the window between acquiring and entering the guarded region, which is
where [03b's rule 1](03b-finally-cleanup-patterns.md) failures live. It also
grants one capability a `finally` does not have and cannot fake: a context
manager can *suppress* the exception. That capability is `contextlib.suppress`,
and it is also the source of the worst silent-failure bug a context manager can
carry.**

## `closing()` for anything with a `close()`

Not everything that needs closing is a context manager. `contextlib.closing`
retrofits one; the docs give its implementation, which is exactly the
`try`/`finally` you would have written:

```python
@contextmanager
def closing(thing):
    try:
        yield thing
    finally:
        thing.close()
```

> *"Even if an error occurs, `page.close()` will be called when the `with` block
> is exited."*

## `ExitStack` when the number of resources is not known statically

Nested `with` statements only work when you know at write time how many there
are. When the count comes from data, `ExitStack` is the answer:

```python
with contextlib.ExitStack() as stack:
    files = [stack.enter_context(open(p)) for p in paths]
    merge(files)
```

The docs on ordering:

> *"Each instance maintains a stack of registered callbacks that are called in
> reverse order when the instance is closed … Since registered callbacks are
> invoked in the reverse order of registration, this ends up behaving as if
> multiple nested `with` statements had been used with the registered set of
> callbacks. This even extends to exception handling — if an inner callback
> suppresses or replaces an exception, then outer callbacks will be passed
> arguments based on that updated state."*

And a warning worth reading twice:

> *"Note that callbacks are **not** invoked implicitly when the context stack
> instance is garbage collected."*

An `ExitStack` you build without a `with` and then drop on the floor cleans up
nothing. Use it as a context manager, or call `.close()` yourself.

## `__exit__` can suppress — `finally` never can

The one thing a context manager does that `try`/`finally` cannot is *swallow* the
exception. The `with` statement reference:

> *"If the suite was exited due to an exception, and the return value from the
> `__exit__()` method was false, the exception is reraised. If the return value
> was true, the exception is suppressed, and execution continues with the
> statement following the `with` statement."*

That is exactly how `contextlib.suppress` works. It also means an accidental
`return True` at the end of an `__exit__` turns a context manager into a silent
error-eater across every use site — and because `__exit__` bodies usually end in
a cleanup call, an accidental `return some_close_call()` that happens to return a
truthy value has the same effect. End `__exit__` with no `return` unless
suppression is the documented purpose.

## `@contextmanager` is the `try`/`finally` you were going to write

The decorator turns a generator into a context manager: everything before the
`yield` is `__enter__`, everything after is `__exit__`, and an exception in the
`with` body is raised **at the `yield`**.

```python
@contextlib.contextmanager
def timed(label):
    start = time.perf_counter()          # setup — before the try
    try:
        yield                            # the with body runs here
    finally:
        log(label, time.perf_counter() - start)
```

Three structural rules, and each has a `RuntimeError` attached to breaking it:

- **Exactly one `yield`.** Yielding twice means the generator did not stop when
  `__exit__` resumed it, and `contextlib` raises `RuntimeError: generator didn't
  stop`.
- **Setup goes before the `try`, not inside it.** If setup raises, the generator
  never yields and `contextlib` raises `RuntimeError: generator didn't yield` —
  and the underlying cause is only visible as the chained context.
- **The cleanup goes in `finally`, and the `yield` is the only thing in `try`.**
  Anything else in the `try` makes the cleanup fire for reasons unrelated to the
  `with` body.

Inside such a generator, the equivalent of `__exit__` returning true is catching
the exception around the `yield` and not re-raising it:

```python
@contextlib.contextmanager
def ignore_missing():
    try:
        yield
    except FileNotFoundError:
        pass            # equivalent to __exit__ returning True — be deliberate
```

Do that only when suppression is the documented purpose of the manager. There is
already a built-in for the general case —
[`contextlib.suppress`](11-suppress-and-the-explicit-ignore.md).

## Gotchas

**★ Symptom — an `ExitStack` built outside a `with` statement leaks every
resource it holds.** Cause: documented — callbacks are *not* invoked when the
stack instance is garbage collected. Fix: `with ExitStack() as stack:`, or an
explicit `stack.close()` in your own `finally`.

**★ Symptom — a `with` block silently continues after an exception that should
have propagated.** Cause: `__exit__` returned a truthy value — often
accidentally, by ending with `return self._cleanup()` where the cleanup returns
something truthy. Fix: let `__exit__` fall off the end (returning `None`, which
is false) unless suppression is deliberate and documented.

**★ Symptom — `RuntimeError: generator didn't yield` from a `@contextmanager`,
with the real error only visible further down the traceback.** Cause: setup code
inside the generator raised before the `yield`. Fix: keep setup before the `try`;
the exception then propagates as itself rather than being reported as a broken
context manager.

**Symptom — `RuntimeError: generator didn't stop`.** Cause: the generator has a
second `yield`, or a `yield` inside a loop that runs more than once. Fix: exactly
one `yield` on every path through the generator.

**Symptom — a file opened inside a list comprehension leaks when a later one
fails.** Cause: nothing owns the handles already opened when the comprehension
raises partway through. Fix: `with ExitStack() as stack:` and
`stack.enter_context(open(p))` per item — everything registered so far is
released on the way out.

**Symptom — `with open(a) as f, open(b) as g:` leaks `a`'s handle when opening
`b` fails.** Cause: it does not, in modern Python — a multi-item `with` is
defined as nested `with` statements, so `f` is already entered and is exited on
the failure. The real leak is the hand-rolled `f = open(a); g = open(b); try:`
version, where `f` is unmanaged if `open(b)` raises. Fix: use the multi-item
`with` (or `ExitStack`), never a run of bare `open` calls before the `try`.

**Symptom — cleanup order between two `with` statements is not what you
expected.** Cause: nested `with` (and `ExitStack`) release in reverse order of
acquisition — innermost first. Fix: acquire in the order whose reverse is the
release order you need; if that is impossible, they are not really nested and
should be separate blocks.

**Symptom — a context manager works under `with` but leaks when used
manually.** Cause: someone called `cm.__enter__()` without a matching
`__exit__()` in a `finally`. Fix: never call the protocol methods by hand; if you
need dynamic lifetime, that is what `ExitStack` is for.

## Interview questions

**★ Q: What can a context manager do that `try`/`finally` cannot?**
Suppress the exception. `__exit__` returning a true value means *"the exception
is suppressed, and execution continues with the statement following the `with`
statement"*. A `finally` has no such power — it can only *replace* an exception
by raising a new one, or discard it via `return`/`break`/`continue`, both of
which are accidents rather than designs.

**★ Q: How do you manage a number of context managers that is only known at
runtime?**
`contextlib.ExitStack`, with `stack.enter_context(cm)` per resource. Callbacks
run in reverse registration order, *"as if multiple nested `with` statements had
been used"*. Note they are **not** run on garbage collection, so the stack itself
must be used as a context manager or closed explicitly.

**Q: You have an object with `.close()` but no `__enter__`. What is the
one-liner?**
`with contextlib.closing(thing) as t:` — the docs give its implementation as
exactly `try: yield thing; finally: thing.close()`.

**Q: Where does setup code go in a `@contextmanager` generator, and why?**
Before the `try`, not inside it. If setup raises inside the `try`, the generator
never reaches its `yield` and `contextlib` reports `RuntimeError: generator
didn't yield` — burying your real error one level down as chained context.

**Q: In a `@contextmanager`, where does an exception raised by the `with` body
surface?**
At the `yield`. That is why the `yield` goes inside a `try` whose `finally` does
the cleanup — and why catching around the `yield` without re-raising is the
generator equivalent of `__exit__` returning `True`.

**Q: Why is `with` preferred over `try`/`finally` for resources?**
The acquisition is inside the construct, so there is no window in which the
resource exists but no cleanup is registered; the cleanup is written once, in the
object, rather than at every call site; and `ExitStack` composes an arbitrary
number of them. `try`/`finally` remains right for ad-hoc state with no object to
attach to.

---

← Prev: [Ownership and state](03c-cleanup-ownership-and-state.md) · Index: [Exceptions](README.md) · Next → [`return`, `break`, `continue` inside `finally`](03e-return-break-continue-in-finally.md)
