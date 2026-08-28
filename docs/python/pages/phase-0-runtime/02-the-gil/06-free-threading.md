---
title: "Free-threaded CPython: officially supported in 3.14, still not the default, and it does not make your threaded code correct"
sidebar_label: "6 · Free-threaded CPython"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html),
> [PEP 779 – Criteria for supported status for free-threaded Python](https://peps.python.org/pep-0779/)
> (status **Final**),
> [PEP 703 – Making the Global Interpreter Lock Optional in CPython](https://peps.python.org/pep-0703/),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> and the C-API [Thread State and the GIL](https://docs.python.org/3.14/c-api/threads.html).
> Target: **CPython 3.14.7**.

**This is the single most out-of-date fact in older Python material. Every book,
course and blog post written before 2025 tells you the GIL is a permanent
architectural fact of CPython. As of Python 3.14 it is not: there is a second,
officially supported build of CPython in which the GIL is disabled and threads
execute Python bytecode in parallel on separate cores. It is not the default,
it costs single-threaded performance, and — the part people skip — it does not
fix a single one of the race conditions in chunk
[2](02-the-gil-is-not-thread-safety.md). It makes them more likely to happen.
This chunk is the status and the decision; chunk
[6b](06b-running-on-the-free-threaded-build.md) is what happens once you are
running on it.**

## What "officially supported" means, precisely

PEP 703 (accepted 2023) made the GIL *optional* at build time. PEP 779, now
**Final**, defined what it would take to stop calling that build experimental,
and 3.14 is the release that cleared the bar. What's New in 3.14 lists it in the
release changes as, flatly:

> *"PEP 779: Free-threaded Python is officially supported"*

The staging is deliberate and worth knowing by name, because it is what tells
you how much to bet on it:

| Phase | Meaning | Status |
|---|---|---|
| I | Experimental | 3.13 |
| **II** | **Officially supported, but still optional** | **3.14 — here now** |
| III | The default build | Not scheduled |

PEP 779's own words for phase II: *"Phase II would make the free-threaded build
officially supported but still optional."* The criteria it set were concrete —
performance within 15% of the GIL build, memory no more than 20% higher, APIs
stable enough to require no breaking changes, and improved internal
documentation.

🔴 **Phase III has no date.** The PEP is explicit that *"the decision to make
free-threaded Python the default (phase III) is very different"* and will depend
on *"community support, willingness, and showing clear benefit."* The PEP does
**not** state when GIL-enabled support would end. So the honest planning
posture for 2026 is: the default build is the default, the free-threaded build
is a supported option you may deliberately choose, and anyone telling you the
GIL is "gone" has read one headline.

## The cost, with the published number

Free threading is not free. From the free-threading HOWTO:

> *"The free-threaded build has additional overhead when executing Python code
> compared to the default GIL-enabled build. The amount of overhead depends on
> the workload and hardware. On the pyperformance benchmark suite, the average
> overhead ranges from about 1% on macOS aarch64 to 8% on x86-64 Linux
> systems."*

That is the trade in one line: **you pay up to about 8% on single-threaded work
to unlock N-core scaling on multi-threaded CPU work.** For a service whose
bottleneck is a database, that is a straight loss. For a service that burns CPU
in Python across many cores, it can be a large win. The decision is arithmetic,
not ideology — and the arithmetic needs your workload, not a benchmark suite.

The overhead exists because the GIL was doing real work cheaply. Reference
counting, previously safe because only one thread mutated it, now needs biased
reference counting and deferred reference counting; container operations need
per-object locks; the specialising adaptive interpreter has to be more careful
about what it caches. PEP 703 is the reference for the mechanisms.

## Checking which build you are on

Two different questions, two different calls, and they are not interchangeable:

```python
import sys, sysconfig

# Q1: was this interpreter BUILT with free threading support?
sysconfig.get_config_var("Py_GIL_DISABLED")   # 1 on a free-threaded build

# Q2: is the GIL actually disabled RIGHT NOW, in this process?
sys._is_gil_enabled()                          # False when free-threading is live
```

The HOWTO is specific about which to use for what:

> *"The `sysconfig.get_config_var("Py_GIL_DISABLED")` configuration variable can
> be used to determine whether the build supports free threading. If the
> variable is set to `1`, then the build supports free threading. This is the
> recommended mechanism for decisions related to the build configuration."*

and, for the runtime question:

> *"The new `sys._is_gil_enabled()` function can be used to check whether the
> GIL is actually disabled in the running process."*

⚠️ **`sys._is_gil_enabled` has a leading underscore.** It is a private,
CPython-specific name. Use it for diagnostics and logging; do not build
application logic on it, and do not expect it on another implementation. Note
also that `sysconfig.get_config_var("Py_GIL_DISABLED")` returns `None` — not
`0` — on a normal build, so test it truthily rather than with `== 0`.

Installing a free-threaded interpreter on each platform, and the `3.14t` /
`cp314t` naming that goes with it, is topic
[04 · Installing and versions](../04-installing-and-versions/12-free-threaded-builds.md),
with the runtime checks and packaging tags in
[13 · Confirming free-threading](../04-installing-and-versions/13-confirming-free-threading.md).

## Gotchas

**Symptom:** the single-threaded batch job got measurably slower after switching
builds
**Cause:** the documented free-threading overhead — about 1% on macOS aarch64 up
to about 8% on x86-64 Linux on pyperformance
**Fix:** expected, not a defect. If the job has no thread parallelism to gain,
run it on the default build. The two interpreters can coexist

**Symptom:** `pip install` fails or silently builds from source on `3.14t`
**Cause:** free-threaded builds need wheels tagged `cp314t`; a project that
publishes only `cp314` wheels has nothing to give you
**Fix:** check the project's wheel tags before committing to the build. This is
the practical blocker for most teams in 2026, more than any language issue

**Symptom:** `sysconfig.get_config_var("Py_GIL_DISABLED") == 0` never matches on
a normal build
**Cause:** on a GIL build the variable is absent, so the call returns `None`,
not `0`
**Fix:** test truthiness — `if sysconfig.get_config_var("Py_GIL_DISABLED"):`

**Symptom:** code branches on `sys._is_gil_enabled()` and breaks on PyPy
**Cause:** it is a private, CPython-specific function. The leading underscore is
the contract
**Fix:** use it for logging and diagnostics only. If behaviour must differ, gate
on the capability you actually need, not on the interpreter's internals

## Interview questions

**Is the GIL gone in Python 3.14?**
No. 3.14 makes the *free-threaded build* officially supported (PEP 779, phase
II), which means it is no longer experimental. It remains optional, and the
GIL-enabled build is still the default. Phase III — free threading as the
default — is explicitly not scheduled and depends on community adoption and
demonstrated benefit.

**What does free threading cost?**
Single-threaded performance, plus ecosystem risk. The documented pyperformance
overhead ranges from about 1% on macOS aarch64 to about 8% on x86-64 Linux. The
larger practical cost in 2026 is that C extensions must be built and marked for
it, and a single unmarked extension re-enables the GIL for the entire process.

**How do you tell whether the GIL is disabled?**
Two questions. `sysconfig.get_config_var("Py_GIL_DISABLED")` returns `1` if the
*build* supports free threading — the documented recommendation for
build-configuration decisions. `sys._is_gil_enabled()` returns whether the GIL
is disabled in *this running process*, which is the one that catches a runtime
re-enable. Check both; they can disagree.

---

← Prev: [Native code that releases the lock](05b-native-code-releases-the-gil.md) · Index: [The GIL](README.md) · Next → [Running on the free-threaded build](06b-running-on-the-free-threaded-build.md)
