---
title: "The decimal context is per thread and, in the C implementation, per coroutine — so a worker thread starts with the defaults your application never set"
sidebar_label: "10j · Contexts across threads"
sidebar_position: 109
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal` — Working with threads](https://docs.python.org/3.14/library/decimal.html#working-with-threads),
> [`decimal.HAVE_CONTEXTVAR`](https://docs.python.org/3.14/library/decimal.html#decimal.HAVE_CONTEXTVAR),
> [`threading.Thread`](https://docs.python.org/3.14/library/threading.html#threading.Thread),
> [`sys.flags.thread_inherit_context`](https://docs.python.org/3.14/library/sys.html#sys.flags.thread_inherit_context)
> and [`-X thread_inherit_context`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-X).
> Version spine: **Python 3.14.7**.

**`getcontext()` is not global; it is per thread, and in CPython's C
implementation it is stored in a context variable, which makes it per coroutine
as well. Everything follows from that. A precision or rounding mode set in
`main()` is invisible to every worker thread a thread pool creates. Whether a new
thread inherits its creator's context depends on a 3.14 interpreter flag whose
default differs between the free-threaded and the GIL builds. And the only
documented way to set a policy that every thread will see is to modify
`DefaultContext` before any thread starts.**

## The rule, stated by the docs

> *"The `getcontext()` function accesses a different `Context` object for each
> thread. Having separate thread contexts means that threads may make changes
> (such as `getcontext().prec=10`) without interfering with other threads.
> Likewise, the `setcontext()` function automatically assigns its target to the
> current thread."*

> *"If `setcontext()` has not been called before `getcontext()`, then
> `getcontext()` will automatically create a new context for use in the current
> thread. New context objects have default values set from the
> `decimal.DefaultContext` object."*

So there is no way to "set the decimal context for the process". There is only
setting it for *this* thread, or changing the prototype that future contexts are
built from.

## The 3.14 flag that decides what a new thread starts with

> *"The `sys.flags.thread_inherit_context` flag affects the context for new
> threads. If the flag is false, new threads will start with an empty context. In
> this case, `getcontext()` will create a new context object when called and use
> the default values from `DefaultContext`. If the flag is true, new threads will
> start with a copy of context from the caller of `threading.Thread.start()`."*

The flag itself is documented on the command line as
*"`-X thread_inherit_context=0,1` causes `Thread` to, by default, use a copy of
context of the caller of `Thread.start()` when starting. Otherwise, threads will
start with an empty context. If unset, the value of this option defaults to 1 on
free-threaded builds and to 0 otherwise."* It was added in 3.14, along with
`sys.flags.thread_inherit_context` and the `PYTHON_THREAD_INHERIT_CONTEXT`
environment variable.

Read that default twice: **the same program inherits contexts on a free-threaded
build and does not on a standard build.** A rounding mode set in the request
handler that reaches a worker on 3.14t and does not on 3.14 is a difference no
test will surface unless you run both.

`threading.Thread` also takes the decision explicitly, which is the form to prefer
because it does not depend on an interpreter flag:

> *"`context` is the `Context` value to use when starting the thread. The default
> value is `None` which indicates that the `sys.flags.thread_inherit_context` flag
> controls the behaviour… To explicitly start with an empty context, pass a new
> instance of `Context()`. To explicitly start with a copy of the current context,
> pass the value from `copy_context()`."*

```python
import threading
from contextvars import copy_context

threading.Thread(target=work, context=copy_context()).start()   # inherit, explicitly
```

Note that this `Context` is `contextvars.Context`, not `decimal.Context` — the two
share a name and are unrelated. The decimal context rides *inside* the
`contextvars.Context` in the C implementation, which is why copying one carries
the other.

## Setting a policy every thread will see

The documented mechanism is the prototype object, and the documented constraint is
the timing:

> *"To control the defaults so that each thread will use the same values throughout
> the application, directly modify the `DefaultContext` object. This should be done
> **before** any threads are started so that there won't be a race condition
> between threads calling `getcontext()`."*

```python
# Set applicationwide defaults for all threads about to be launched
DefaultContext.prec = 12
DefaultContext.rounding = ROUND_DOWN
DefaultContext.traps = ExtendedContext.traps.copy()
DefaultContext.traps[InvalidOperation] = 1
setcontext(DefaultContext)

# Afterwards, the threads can be started
t1.start()
t2.start()
t3.start()
```

The `setcontext(DefaultContext)` line matters: modifying the prototype does not
change the context the *current* thread already has, so the main thread needs to
be given it explicitly.

The docs also say when not to bother: *"In single threaded environments, it is
preferable to not use this context at all. Instead, simply create contexts
explicitly as described below."*

## Async: the context is per coroutine, not per event loop

> *"`decimal.HAVE_CONTEXTVAR`: The default value is `True`. If Python is configured
> using the `--without-decimal-contextvar` option, the C version uses a
> thread-local rather than a coroutine-local context and the value is `False`.
> This is slightly faster in some nested context scenarios."*

With the default build, the decimal context lives in a `ContextVar`. `asyncio`
runs each task in a copy of the context that created it, so a coroutine that does
`getcontext().prec = 40` changes precision for itself and for tasks it creates
afterwards, and not for its parent or its siblings. That is the behaviour you
want, and it is the opposite of what you get on a `--without-decimal-contextvar`
build, where the same code changes precision for every coroutine on that thread.

Do not rely on either. In async code, use `localcontext` — it restores on exit
regardless of which storage the build uses — and never mutate `getcontext()` in a
coroutine you did not write the caller of.

## Thread pools and executors

A `ThreadPoolExecutor` worker is a thread you never see created, so it gets
whatever the flag decides — usually an empty context, hence `DefaultContext`
defaults. Two safe patterns:

```python
from concurrent.futures import ThreadPoolExecutor
from decimal import setcontext, Context, ROUND_HALF_UP

def init_worker():
    setcontext(Context(prec=28, rounding=ROUND_HALF_UP))

ThreadPoolExecutor(max_workers=8, initializer=init_worker)
```

```python
# Or: do not depend on ambient context at all.
def price(amount, rate):
    with localcontext(prec=28, rounding=ROUND_HALF_UP):
        return (amount * rate).quantize(CENTS, rounding=ROUND_HALF_UP)
```

The second is strictly better. Any money function that reads the ambient context
is a function whose result depends on which thread ran it.

Processes are simpler and stricter: a `multiprocessing` worker is a fresh
interpreter state, so it starts from `DefaultContext` with no inheritance at all,
and any context set in the parent must be re-established in an initializer.

## Gotchas

**★ A library that mutates `getcontext()` corrupts its caller.** The context is
per-thread state with no ownership, so a library that sets
`getcontext().prec = 6` at import or in a helper has changed the arithmetic of
every other `Decimal` user in that thread. Nothing raises; results simply become
different. Library code must use `with localcontext(...)`. This is the decimal
equivalent of calling `locale.setlocale()` in a library.

**★ Your context settings do not reach thread-pool workers.** Setting `prec` or
`rounding` in `main()` configures the main thread only. Executor workers start
with the defaults, so the same computation rounds differently depending on where
it ran — and the divergence appears under load, when the pool actually spins up
extra workers.

**★ `thread_inherit_context` defaults differently on free-threaded builds.**
Documented as defaulting *"to 1 on free-threaded builds and to 0 otherwise"*. A
program that works on 3.14t because the worker inherited the caller's rounding
mode silently changes behaviour on the GIL build. Pass
`threading.Thread(context=...)` explicitly, or do not depend on ambient context.

**★ Modifying `DefaultContext` after threads have started is a race.** The docs
say so directly: *"Changing the fields after threads have started is not
recommended as it would require thread synchronization to prevent race
conditions."* A thread that has already called `getcontext()` keeps the old
values; one that has not gets the new ones.

**★ `setcontext(DefaultContext)` shares the object rather than copying it.**
`DefaultContext` is the prototype; assigning it as the current context means later
mutations of the prototype are visible in the thread that holds it, and vice
versa. If you want isolation, use `setcontext(DefaultContext.copy())`.

**★ `contextvars.Context` and `decimal.Context` are different classes with the same
short name.** `threading.Thread(context=...)` takes the former. Passing a
`decimal.Context` there is a type error at thread start, in a place where the
traceback is easy to misread.

**★ Trapping a signal in one thread does not trap it anywhere else.** Traps live
on the context. A test that sets `traps[Inexact] = True` in the test thread proves
nothing about the code running in a worker.

**★ `--without-decimal-contextvar` builds change async semantics.** On such a build
the context is thread-local, so two coroutines on the same event loop share it and
one can change the other's precision mid-await. `decimal.HAVE_CONTEXTVAR` tells
you which build you are on; code that must be correct on both should never rely
on ambient context surviving an `await`.

## Interview questions

**★ A colleague sets `getcontext().rounding = ROUND_HALF_UP` in `main()` and reports
that half the invoices still use banker's rounding. What is happening?**
The context is per thread. `main()` configured the main thread; the invoices that
still round to even are being computed on other threads — executor workers,
`Thread` targets, a web server's request pool — each of which got a fresh context
built from `DefaultContext`, where the rounding mode is `ROUND_HALF_EVEN`. The
fixes, in increasing order of robustness: set `DefaultContext` before any thread
starts; give every worker an `initializer` that calls `setcontext`; or stop
reading the ambient context and pass `rounding=` explicitly at every money
`quantize`.

**★ How does the decimal context behave across `await` points?**
On a standard CPython build, `decimal.HAVE_CONTEXTVAR` is `True` and the context
lives in a context variable, so each `asyncio` task runs with a copy of its
creator's context: a change made inside a task is visible to that task and to
tasks it later creates, but not to its parent or its siblings, and it survives
across `await`. On a `--without-decimal-contextvar` build the storage is
thread-local instead, so all coroutines on a thread share one context and a change
inside one leaks into the others between awaits. Because the behaviour is a build
option, correct code uses `localcontext` and does not depend on ambient state.

**★ What is `sys.flags.thread_inherit_context` and why should you care?**
New in 3.14, it decides whether a thread started via `threading.Thread.start()`
begins with a copy of its creator's context or with an empty one, which for
`decimal` decides whether your precision, rounding mode and traps cross the thread
boundary. It defaults to 1 on free-threaded builds and 0 otherwise, so the same
source behaves differently on 3.14 and 3.14t. `threading.Thread(context=...)`
overrides it per thread — pass `contextvars.copy_context()` to inherit explicitly,
or a fresh `contextvars.Context()` to start clean.

**★ A library sets `getcontext().prec = 6` at import. What breaks?**
Everything in that thread that does `Decimal` arithmetic afterwards, silently. The
context is per-thread global state with no ownership, so the library has changed
the arithmetic of the whole process's main thread. Nothing raises; results simply
become less precise, and only in the thread that imported it. The correct form is
`with localcontext(prec=6):` around the library's own computation.

**★ How should a library that does `Decimal` arithmetic handle contexts?**
It should never mutate `getcontext()`. If it needs particular precision it wraps
its own computation in `with localcontext(prec=...)` and returns a value re-rounded
to the caller's context with unary plus if the extra digits are internal. If it
needs a particular rounding mode for a result, it passes `rounding=` to the
`quantize` rather than setting it globally. The contract is that calling the
library leaves the caller's arithmetic exactly as it found it.

**★ How do you configure `decimal` for a `ProcessPoolExecutor`?**
You cannot inherit it: each process has its own interpreter state and starts from
`DefaultContext`. Pass an `initializer` that calls `setcontext` in the child, or —
again the better answer — write the arithmetic so it does not depend on ambient
context at all, so the pool topology cannot change the numbers.

---

← Prev: [Special values and stdlib interop](10i-special-values-and-stdlib-interop.md) · Index: [Numbers](README.md) · Next → [JSON and the wire format](10k-json-and-the-wire-format.md)

{/* FOOTER */}
