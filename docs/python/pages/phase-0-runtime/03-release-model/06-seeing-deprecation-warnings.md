---
title: "Seeing deprecation warnings: the default filter discards the notice, and four ways to switch it back on before the upgrade forces you to"
sidebar_label: "6 · Seeing the warnings"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [`warnings` module](https://docs.python.org/3.14/library/warnings.html),
> [Python Development Mode](https://docs.python.org/3.14/library/devmode.html),
> [What's new in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> and [PEP 387](https://peps.python.org/pep-0387/).
> Version spine: **Python 3.14.7**.

**The deprecation notice period described in [the previous
chunk](05-the-deprecation-policy.md) is real, long, and by default completely
invisible to you. `DeprecationWarning` is filtered out in every module except
`__main__` — which is exactly where library and framework code never runs. This
chunk is the mechanical fix: what the default filter actually is, the four ways
to override it, and the two documentation sections that carry the same
information without needing a runtime warning at all.**

## Why the warning never reached you

`DeprecationWarning` is filtered out by default. The `warnings` docs say so in
the category table:

> *"DeprecationWarning: Base category for warnings about deprecated features when
> those warnings are intended for other Python developers (ignored by default,
> unless triggered by code in \_\_main\_\_)."*

and restate the consequence:

> *"Notably, this "ignored by default" list includes DeprecationWarning (for
> every module except \_\_main\_\_), which means developers should make sure to
> test their code with typically ignored warnings made visible in order to
> receive timely notifications of future breaking API changes (whether in the
> standard library or third party packages)."*

The default filter list, as printed in the docs, is exactly this:

```text
default::DeprecationWarning:__main__
ignore::DeprecationWarning
ignore::PendingDeprecationWarning
ignore::ImportWarning
ignore::ResourceWarning
```

The first line shows deprecations from `__main__`; the second silences them
everywhere else. So a deprecated call in your script prints a warning, and the
identical call inside your package does not. This is a deliberate design — end
users of an application should not see library churn — but it means the notice
period defaults to being invisible to the people who need it.

### Turning it on, four ways

```bash
# 1. One run, all default-filtered warnings visible
python -W default -m myapp

# 2. Same, for a whole environment and its subprocesses
export PYTHONWARNINGS=default

# 3. Development Mode: -W default plus faulthandler, allocator debug hooks,
#    and asyncio debug. The docs describe it as similar to:
#      PYTHONMALLOC=debug PYTHONASYNCIODEBUG=1 python -W default -X faulthandler
python -X dev -m myapp

# 4. Make them fatal, which is what you want in CI
python -W error::DeprecationWarning -m pytest
```

The Development Mode docs list what the added filter surfaces —
`DeprecationWarning`, `ImportWarning`, `PendingDeprecationWarning` and
`ResourceWarning` — and note that *"Normally, the above warnings are filtered by
the default warning filters."*

In a test suite, make it permanent and make it fail:

```toml
# pyproject.toml
[tool.pytest.ini_options]
filterwarnings = [
    "error::DeprecationWarning",
    # carve out the ones you cannot fix yet, with the reason in the comment.
    # The fourth field is the module the warning is attributed to; check your
    # runner's docs for whether it matches literally or as a regex:
    # "default::DeprecationWarning:some_vendor_package",
]
```

The `warnings` docs point out that `unittest`'s own runner already does the
equivalent — *"the test runner provided by the unittest module"* implicitly
enables all warnings when running tests — so if you are on `unittest` you may
already be seeing them and ignoring them, which is a different problem.

The documented pattern for a test runner or tool that wants warnings on without
overriding a user's explicit choice:

```python
import sys
if not sys.warnoptions:
    import os, warnings
    warnings.simplefilter("default")            # this process
    os.environ["PYTHONWARNINGS"] = "default"    # and subprocesses
```

## "What's New" pages and the pending-removal lists

Each minor release has a *What's New* page, and its purpose is stated on it:

> *"This article explains the new features in Python 3.14, compared to 3.13."*
> … *"This article doesn't attempt to provide a complete specification of all
> new features, but instead gives a convenient overview. For full details refer
> to the documentation, such as the Library Reference and Language Reference."*

For upgrade planning, the highlights section is the least useful part of the
page. The sections that matter are the ones at the bottom: **Deprecated**,
**Removed**, and a series headed **Pending removal in Python 3.15**, **3.16**,
**3.17**, **3.18** and **3.19**. Those lists are the machine-readable-by-a-human
version of your migration backlog, and they are published years ahead — the 3.14
page carries pending-removal entries reaching to 3.19.

Two entries from 3.14's *Pending removal in Python 3.15* list, as examples of
what such an entry looks like:

> *"ctypes: The undocumented ctypes.SetPointerType() function has been
> deprecated since Python 3.13."*

> *"http.server: The obsolete and rarely used CGIHTTPRequestHandler has been
> deprecated since Python 3.13. No direct replacement exists."*

Both were deprecated in 3.13, are listed for removal in 3.15, and — because they
are library APIs used from inside packages rather than from `__main__` — most
users of them have never seen a warning about either.

The upgrade routine that follows from all of this:

1. Read the *Removed* section of the target version's What's New page. These are
   already gone; nothing you do at runtime will find them for you except a test.
2. Read *Pending removal in Python 3.(target+1)* and file the work now, while
   there is no deadline pressure.
3. Run your full test suite under `-W error::DeprecationWarning` on the current
   version. Anything that fails is scheduled to break within a few releases.
4. Only then change the version pin.



## Gotchas

**Symptom:** the upgrade broke on a removal you had years of notice about
**Cause:** `DeprecationWarning` is ignored by default in every module except `__main__`, so the notice was emitted into a filter that discarded it
**Fix:** run the test suite with `-W error::DeprecationWarning`, or set `filterwarnings` in `pyproject.toml`. Make it fail in CI, not print in a log nobody reads

**Symptom:** the deprecation warning appears when you run a script and vanishes when the same code is imported
**Cause:** exactly the documented default filter — `default::DeprecationWarning:__main__` followed by `ignore::DeprecationWarning`
**Fix:** do not use "it does not warn" as evidence that a call is fine. Reproduce with warnings explicitly enabled before concluding anything

**Symptom:** enabling warnings floods the log with deprecations from third-party packages you cannot fix
**Cause:** the filter is global, and your dependencies have their own migration debt
**Fix:** turn deprecations into errors globally and add narrow, commented per-module exemptions, so the exemption list is itself a visible backlog rather than a blanket `ignore`

**Symptom:** setting `PYTHONWARNINGS` fixed the visibility locally but not in the container
**Cause:** the variable has to reach the process that actually runs the code; a shell export does not survive into an unrelated container, and some entrypoints scrub the environment
**Fix:** set it in the image or the process manager, or use the in-code pattern that also propagates to subprocesses via `os.environ["PYTHONWARNINGS"]`

**Symptom:** you turned deprecations into errors and a dependency's import now crashes the test session at collection time
**Cause:** the deprecated call happens at import, so the error escapes before any test runs
**Fix:** add a targeted module-scoped exemption for that package with the upstream issue link in the comment, rather than reverting the whole policy

**Symptom:** the same deprecation prints once and then never again, so a later run looks clean
**Cause:** the `default` filter action prints only the first occurrence per unique location. A second run in the same process, or a different call site, will not re-print
**Fix:** use `-W always::DeprecationWarning` when you are auditing, and `-W error::DeprecationWarning` when you want a build to fail. Never conclude "it stopped happening" from a quiet second run

**Symptom:** a `SyntaxWarning` from a dependency survives every filter you set
**Cause:** the `warnings` docs note that syntax warnings are *"typically emitted when compiling Python source code, and hence may not be suppressed by runtime filters"* — the warning happens before your filter is installed
**Fix:** address it at the source, or suppress at compile time; do not expect `filterwarnings` in a test config to catch it

**Symptom:** your library's own tests are clean but your users report deprecation noise
**Cause:** a test runner that enables warnings for the code under test, combined with a library that emits warnings from an import path users hit and your tests do not
**Fix:** exercise the public import surface in tests, and check what your package emits on a bare `import yourpkg` with warnings enabled

**Symptom:** deprecation warnings appear in production logs and alarm operators
**Cause:** somebody set `PYTHONWARNINGS=default` globally, or the application enables warnings unconditionally
**Fix:** the `warnings` docs give the intended shape — check `sys.warnoptions` first, so an explicit user setting wins and the application's own default does not override a deliberate choice

## Interview questions

**★ Why did a `DeprecationWarning` not warn you before the upgrade broke?**
Because the default warning filter ignores `DeprecationWarning` everywhere
except `__main__`. The documented default filter list is
`default::DeprecationWarning:__main__` followed by `ignore::DeprecationWarning`,
so a deprecated call in a script prints and the identical call inside a package
does not. The design intent is that end users of an application should not see
library churn; the consequence is that the deprecation notice period is
invisible unless you opt in with `-W default`, `PYTHONWARNINGS`, `-X dev`, or a
`filterwarnings` setting in your test configuration.

**★ How do you make deprecations visible, and where should that setting live?**
In the test suite, permanently, as an error rather than a print — `filterwarnings
= ["error::DeprecationWarning"]` in `pyproject.toml` for pytest, or
`-W error::DeprecationWarning` on the command line. That way a newly introduced
deprecation fails a build on the day it appears rather than surfacing during an
upgrade two years later. Exemptions for dependencies you cannot fix go in as
narrow, commented entries so the list doubles as a backlog.

**What does `-X dev` do beyond showing warnings?**
Python Development Mode adds the `default` warning filter — surfacing
`DeprecationWarning`, `ImportWarning`, `PendingDeprecationWarning` and
`ResourceWarning` — and also installs debug hooks on the memory allocators,
enables `faulthandler`, and turns on asyncio debug mode. The docs describe it as
similar to running `PYTHONMALLOC=debug PYTHONASYNCIODEBUG=1 python -W default -X
faulthandler`. It is a development and CI switch, not a production one: the
allocator hooks cost real performance.

**What is a What's New page for, and which part of it do you read for an upgrade?**
Its stated purpose is to explain the new features of a release compared to the
previous one, as an overview rather than a specification. For an upgrade the
highlights are the least useful section: the ones that matter are *Deprecated*,
*Removed*, and the series of *Pending removal in Python 3.X* lists, which reach
several releases into the future — the 3.14 page carries entries as far out as
3.19. Those lists are your migration backlog, published years ahead of the
deadline.

**What would you actually do to prepare a codebase for next October's release?**
Run the existing test suite under `-W error::DeprecationWarning` on the current
version and fix what fails, because those are the scheduled breakages. Read the
*Removed* and *Pending removal in Python 3.X* sections of the new version's
What's New page and file the rest. Add the beta to CI as an allow-failure job as
soon as it lands in May. Then, and only then, move the version pin — with the
`requires-python` floor updated to match what I am actually testing.

**Why does `unittest` show warnings that a plain script run does not?**
Because its test runner enables warnings for the code under test — the
`warnings` docs point to it as the example of a runner that does this
implicitly. That is the intended behaviour for test runners generally: the
default filter is tuned for application end users, and a test suite is precisely
the context where developer-facing warnings should be loud.

**Someone proposes setting `PYTHONWARNINGS=ignore` in production to clean up the logs. What do you say?**
That it treats the symptom and destroys the signal — including `RuntimeWarning`
and `ResourceWarning`, which report real defects such as an un-awaited coroutine
or an unclosed socket. The right shape is the documented one: leave the default
filter in production, make warnings errors in the test suite, and if the
application genuinely needs to hide them from end users, do it in code guarded
by `if not sys.warnoptions:` so an operator who explicitly asks for warnings
still gets them.

---

← Prev: [The deprecation policy](05-the-deprecation-policy.md) · Index: [The release model](README.md) · Next → [Installing and managing versions](../04-installing-and-versions/README.md)
