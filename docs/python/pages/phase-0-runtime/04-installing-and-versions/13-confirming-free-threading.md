---
title: "Confirming free-threading: two checks that answer different questions, three ways the GIL comes back on, and the ABI tag that decides whether your wheels exist"
sidebar_label: "13 · Confirming free-threading"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html),
> [`sys`](https://docs.python.org/3.14/library/sys.html) and
> [`sysconfig`](https://docs.python.org/3.14/library/sysconfig.html),
> [PEP 779](https://peps.python.org/pep-0779/) and
> [PEP 387](https://peps.python.org/pep-0387/) on private names.
> Version spine: **Python 3.14.7**.

**Running the free-threaded executable does not guarantee the GIL is off. The
build supports free threading; the runtime may have re-enabled the lock because
an extension module asked for it, or because an environment variable was set
three deployments ago. You therefore need two checks, not one — and if you only
write one, you will write the wrong one, because the recommended check for
build configuration is not the one that answers "is the lock off right now".**

## Confirming what you actually got

Two different questions, two different answers, and conflating them is the
characteristic free-threading mistake:

> *"To check if the current interpreter supports free-threading, python -VV and
> sys.version contain 'free-threading build'. The new sys.\_is\_gil\_enabled()
> function can be used to check whether the GIL is actually disabled in the
> running process. The sysconfig.get\_config\_var("Py\_GIL\_DISABLED")
> configuration variable can be used to determine whether the build supports free
> threading. If the variable is set to 1, then the build supports free threading.
> This is the recommended mechanism for decisions related to the build
> configuration."*

```bash
python3.14t -VV        # the version string names the build
```

```python
import sys, sysconfig

is_free_threaded_build = sysconfig.get_config_var("Py_GIL_DISABLED") == 1
gil_currently_on = sys._is_gil_enabled()

if is_free_threaded_build and gil_currently_on:
    raise SystemExit(
        "free-threaded build but the GIL is enabled — "
        "an extension module or PYTHON_GIL/-X gil turned it back on"
    )
```

The GIL can be back on for three reasons, all documented:

> *"Free-threaded builds of CPython support optionally running with the GIL
> enabled at runtime using the environment variable PYTHON_GIL or the
> command-line option -X gil."*

> *"The GIL may also automatically be enabled when importing a C-API extension
> module that is not explicitly marked as supporting free threading. A warning
> will be printed in this case."*

That last one is the trap: you pay the free-threaded build's single-threaded
overhead and higher memory use — PEP 779 quotes roughly 10% and 15–20%
respectively — and get no parallelism, because one import switched the lock back
on and the warning scrolled past.

## Packages

The free-threaded build has its own ABI tag, `cp314t`, so a package with a C
extension needs a wheel built specifically for it. Two consequences:

- A package that installs on `3.14` may not install on `3.14t`, or may install
  from source and take much longer.
- Because the two builds have separate `site-packages`, installing a package
  once does not make it available in both.

The HOWTO points at community trackers for readiness; treat "does my dependency
set support free-threading" as a question to answer per project, from those
trackers and from each project's PyPI page, rather than as a general state of
the world.


## Gotchas

**Symptom:** `sysconfig.get_config_var("Py_GIL_DISABLED")` is 1 but threads still serialise
**Cause:** you checked the *build*, not the *runtime*. The build supports free threading; the GIL is on anyway
**Fix:** use both checks. The config variable is the documented mechanism for build-configuration decisions; `sys._is_gil_enabled()` is the one for "is it off right now"

**Symptom:** the free-threaded build is slower than the GIL build and nothing is parallel
**Cause:** an extension module that is not marked as free-threading-safe re-enabled the GIL at import, so you are paying the overhead and getting none of the benefit
**Fix:** assert `sys._is_gil_enabled()` is False at startup and fail loudly. The warning that CPython prints is easy to miss in a log

**Symptom:** `PYTHON_GIL=1` set in an environment and forgotten
**Cause:** it is a documented way to run a free-threaded build with the GIL enabled, typically set to work around one misbehaving extension, then never removed
**Fix:** grep the environment and the container definition for it as part of the same startup assertion, and print the value in your health output

**Symptom:** `sys._is_gil_enabled()` raises `AttributeError`
**Cause:** it is new, and it is private — an underscore-prefixed name carries no compatibility guarantee under PEP 387
**Fix:** guard it: `getattr(sys, "_is_gil_enabled", lambda: True)()` gives a sane answer on interpreters that lack it

**Symptom:** a script that checks `sys.version` for "free-threading build" fails on a different implementation
**Cause:** string matching on a free-form version string, which the `sys` docs tell you not to parse
**Fix:** use `sysconfig.get_config_var("Py_GIL_DISABLED")`, which the HOWTO explicitly recommends for build-configuration decisions

**Symptom:** `pip install` on the free-threaded build compiles from source and takes minutes
**Cause:** no `cp314t` wheel exists for that package, so the installer falls back to a source build
**Fix:** check the tags on the project's PyPI page before planning a free-threaded deployment. A missing `cp3XXt` wheel is a real blocker, not a slow path

**Symptom:** the dependency audit says "supports free-threading" but the deployment re-enables the GIL anyway
**Cause:** support is per package and per version, and one un-migrated transitive dependency is enough. Readiness is a property of the whole installed set, not of the packages you named
**Fix:** test the actual environment, with the startup assertion, rather than auditing the direct dependency list

**Symptom:** the GIL warning appears in development and not in production, or vice versa
**Cause:** the offending extension is imported on one code path and not the other — the GIL is enabled when the module is imported, not when the process starts
**Fix:** import the full dependency surface during the startup check, or perform the assertion after the application's imports have completed rather than at the top of the entry point

## Interview questions

**★ How do you confirm at runtime that the GIL is actually disabled?**
Two checks answering two questions.
`sysconfig.get_config_var("Py_GIL_DISABLED") == 1` says the build supports free
threading, and the HOWTO calls it the recommended mechanism for
build-configuration decisions. `sys._is_gil_enabled()` says whether the GIL is
off in this process right now, which can differ — an imported extension module
that is not marked as free-threading-safe re-enables it, as do `PYTHON_GIL=1` and
`-X gil=1`. `python -VV` and `sys.version` also contain the words "free-threading
build" for the build question.

**★ Why can a package install on 3.14 and fail on 3.14t?**
Because they are different ABIs. A compiled extension for the GIL build is
tagged `cp314`; the free-threaded build needs `cp314t`, which is a separate
artefact a maintainer has to build and upload. If it does not exist, the
installer falls back to building from source, which needs a toolchain and may
fail outright. On top of that, the two builds have separate `site-packages`, so
even a pure-Python package installed into one is not visible from the other.

**★ Name the three ways the GIL can be enabled on a free-threaded build.**
`PYTHON_GIL=1` in the environment, `-X gil=1` on the command line, and — the one
that catches people — automatically, when importing a C-API extension module
that is not explicitly marked as supporting free threading. The third prints a
warning, which is precisely why it goes unnoticed: it happens at import time,
inside a log nobody reads, and the process continues.

**Why is a startup assertion worth writing for this?**
Because the failure is silent and expensive. A free-threaded build with the GIL
re-enabled costs you roughly 10% single-threaded performance and 15–20% more
memory — PEP 779's own figures — and delivers no parallelism in exchange. There
is no error, only a warning at import time. An explicit check that raises turns
an invisible regression into a deployment that refuses to start.

**Why should you be careful calling `sys._is_gil_enabled()`?**
Because of the underscore. PEP 387 excludes underscore-prefixed names from the
backwards compatibility policy entirely — they can change or be removed at any
time in any way. It is currently the only way to answer the runtime question, so
use it, but guard it with `getattr` so that an interpreter without it degrades to
a safe default rather than crashing.

**How do you decide whether your project can move to a free-threaded build?**
Empirically, on the whole installed dependency set rather than the direct
dependency list, because one un-migrated transitive package is enough to
re-enable the lock. Build the environment on `3.14t`, check every dependency has a
`cp314t` wheel or builds cleanly, run the application with an assertion that
`sys._is_gil_enabled()` is False after imports complete, and then measure —
because the 10% single-threaded penalty has to be paid back by actual
parallelism to be worth it.

---

← Prev: [Free-threaded builds](12-free-threaded-builds.md) · Index: [Installing and versions](README.md) · Next → [Docker base images](14-docker-base-images.md)
