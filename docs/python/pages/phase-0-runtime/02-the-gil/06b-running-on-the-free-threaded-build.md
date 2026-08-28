---
title: "Running on the free-threaded build: the three ways the GIL comes back on, and why correct code is identical on both builds"
sidebar_label: "6b · Running on it"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html)
> (the `PYTHON_GIL` environment variable and `-X gil` option, automatic
> re-enabling on importing an unmarked C-API extension, and the built-in-types
> locking note) and the C-API
> [Thread State and the GIL](https://docs.python.org/3.14/c-api/threads.html)
> on detaching the thread state in a free-threaded build.
> Target: **CPython 3.14.7**.

**Chunk [6](06-free-threading.md) covered what the free-threaded build is and
whether to choose it. This chunk covers what happens once you have. Two things
bite in practice, and neither is a language problem: you can be running the
free-threaded interpreter with the GIL quietly switched back on, and you can be
running it with genuinely parallel threads over code that was never safe.**

## The three ways the GIL comes back on

This is the operational trap. You can install the free-threaded build, run your
program on it, and still be running with the GIL — silently, as far as most
people look.

**1. You asked for it.** The build supports re-enabling the lock:

> *"Free-threaded builds of CPython support optionally running with the GIL
> enabled at runtime using the environment variable `PYTHON_GIL` or the
> command-line option `-X gil`."*

```bash
PYTHON_GIL=1 python3.14t app.py     # GIL on, deliberately
python3.14t -X gil=1 app.py         # same, via the command line
python3.14t -X gil=0 app.py         # force it off
```

`PYTHON_GIL=1` is the correct emergency lever when a dependency turns out not to
be thread-safe in practice. It is also the thing someone sets in a Dockerfile to
fix a crash and never removes.

**2. A C extension asked for it, on your behalf.**

> *"The GIL may also automatically be enabled when importing a C-API extension
> module that is not explicitly marked as supporting free threading. A warning
> will be printed in this case."*

An extension declares its support with the `Py_mod_gil` slot; without that
marker, importing it re-enables the GIL for the whole process. **This is the
common case in 2026.** Your pure-Python code is ready; one transitive dependency
with a compiled component is not, and the entire benefit evaporates at import
time. The warning is printed — to stderr, once, at import — which in a
containerised service means nobody sees it.

**3. You are not on the build you think you are.** `python3.14` and
`python3.14t` are two separate interpreters. A venv, a CI image or a `#!` line
pointing at the wrong one produces exactly the behaviour of a GIL build, because
it is one.

🔴 **The practical instruction: assert it at startup.** If free-threading is the
reason you deployed this build, do not assume you got it.

```python
import sys, logging

if sys._is_gil_enabled():
    logging.error(
        "GIL is ENABLED — free-threaded parallelism is not active. "
        "Check PYTHON_GIL, -X gil, and whether a C extension re-enabled it."
    )
```

## What free threading does not change

🔴 **It does not make your threaded code thread-safe.** Everything in chunk
[2](02-the-gil-is-not-thread-safety.md) still applies, and applies harder. The
GIL never provided thread safety — it only made the unsafe windows narrow enough
that a race might need hours to show up. Remove it and those windows widen to
true parallelism: `counter += 1` across four real cores loses updates
reproducibly rather than occasionally. **A test suite that passed for years on a
GIL build is not evidence.**

The built-in containers do carry internal locks, and the HOWTO is careful to
frame that as an implementation detail rather than a promise:

> *"Built-in types like `dict`, `list`, and `set` use internal locks to protect
> against concurrent modifications in ways that behave similarly to the GIL.
> However, Python has not historically guaranteed specific behavior for
> concurrent modifications to these built-in types, so this should be treated as
> a description of the current implementation, not a guarantee of current or
> future behavior."*

with the recommendation stated outright:

> *"It's recommended to use the `threading.Lock` or other synchronization
> primitives instead of relying on the internal locks of built-in types, when
> possible."*

Which is the same advice chunks [3](03-making-threaded-code-correct.md) and
[4](04-lock-discipline-and-testing.md) give for the GIL build. **The correct
code is identical on both builds.** That is the reassuring half of this: if you
wrote it properly, free threading is a deployment decision, not a rewrite.

**It does not remove the need to detach the thread state in C extensions,**
either — a point that surprises extension authors:

> *"On a free-threaded build, the GIL is usually out of the question, but
> detaching the thread state is still required, because the interpreter
> periodically needs to block all threads to get a consistent view of Python
> objects without the risk of race conditions. For example, CPython currently
> suspends all threads for a short period of time while running the garbage
> collector."*

And it does not change the I/O story from chunk
[5](05-io-releases-the-gil.md) at all. If your service is waiting on a database,
free threading gives you nothing, at a cost of up to 8%.

## Gotchas

**Symptom:** installed the free-threaded build, saw no speedup at all
**Cause:** a C extension without the `Py_mod_gil` marker re-enabled the GIL at
import; the warning went to stderr and was never read
**Fix:** log `sys._is_gil_enabled()` at startup and treat `True` as a
deployment failure. Then find the offending import — start with the compiled
dependencies

**Symptom:** a threaded counter that was "fine for three years" now loses
thousands of updates
**Cause:** it was never fine. The GIL made the race window one bytecode wide;
free threading makes it genuinely concurrent
**Fix:** the fix is the one it always needed — a lock around the whole
read-modify-write, per chunk [3](03-making-threaded-code-correct.md). Free
threading did not cause this bug, it revealed it

**Symptom:** `PYTHON_GIL=1` in the deployment environment, and nobody knows why
**Cause:** somebody set it to work around a crash and it outlived the crash
**Fix:** treat it like any other emergency flag — record why, link the issue,
and re-test on every dependency upgrade

**Symptom:** a C extension works on the free-threaded build but deadlocks
occasionally under load
**Cause:** it holds the thread state across a long native call. The interpreter
periodically needs to stop all threads — for the garbage collector, for example
— and cannot while one refuses to detach
**Fix:** the extension must still use `Py_BEGIN_ALLOW_THREADS` around long or
blocking native work. Removing the GIL did not remove that requirement

**Symptom:** a library's docs say it is "thread-safe", and it corrupts state
under free threading
**Cause:** "thread-safe" written before 2025 frequently meant "safe under the
GIL" — that is, safe because operations were never truly simultaneous
**Fix:** treat pre-free-threading thread-safety claims as untested on this
build. The `Py_mod_gil` marker is the only claim that is specifically about it

## Interview questions

**Name the ways the GIL can be back on in a free-threaded build.**
`PYTHON_GIL=1` or `-X gil=1`; importing a C-API extension that is not marked as
supporting free threading, which enables it automatically with a warning; and
simply running the wrong interpreter — `python3.14` rather than `python3.14t`.

**Does free threading fix my race conditions?**
No — it makes them worse, in the useful sense that they now happen reliably. The
GIL never guaranteed atomicity of anything above a single bytecode. Code that
was correct under a lock stays correct; code that was accidentally passing
because the race window was one bytecode wide will now fail. Correct code is the
same on both builds.

**Can I rely on `dict` and `list` being safe under free threading?**
Not as a guarantee. They do use internal locks, and the documentation describes
that behaviour — while stating plainly that it is a description of the current
implementation and not a guarantee of current or future behaviour, and
recommending `threading.Lock` or another synchronisation primitive instead.

**Do C extensions still need `Py_BEGIN_ALLOW_THREADS` on a free-threaded build?**
Yes. The documentation states that detaching the thread state is still required,
because the interpreter periodically needs to block all threads for a consistent
view of objects — it suspends all threads briefly while running the garbage
collector, for example.

**Your service runs on `python3.14t`. How do you prove free threading is
actually active?**
Assert it at startup rather than assuming it: log or fail on
`sys._is_gil_enabled()`. The build supporting free threading and the process
running without the GIL are two different facts, and the three re-enabling paths
all produce a working program that silently gives you none of the benefit.

**When would you actually deploy the free-threaded build today?**
When the workload is CPU-bound *in Python* (not in a C extension that already
releases the lock — see chunk
[5b](05b-native-code-releases-the-gil.md)), when it parallelises across threads,
when the whole dependency tree publishes `cp314t` wheels, and when you have
verified at startup that the GIL is actually off. If any of those is false, the
default build is the right answer.

---

← Prev: [Free-threaded CPython](06-free-threading.md) · Index: [The GIL](README.md) · Next → [Everything is an object](../07-everything-is-an-object/README.md)

