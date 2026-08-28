---
title: "Feature freeze and release candidates: what beta 1 obliges you to do in May, and where the free-threaded build sits in the release model"
sidebar_label: "3 · Feature freeze"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 602](https://peps.python.org/pep-0602/), the devguide
> [Development cycle](https://devguide.python.org/developer-workflow/development-cycle/)
> and [Status of Python versions](https://devguide.python.org/versions/),
> [PEP 790](https://peps.python.org/pep-0790/) (3.15 schedule),
> [PEP 779](https://peps.python.org/pep-0779/) (free-threading, phase II),
> [PEP 703](https://peps.python.org/pep-0703/), and the
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html)
> HOWTO.
> Version spine: **Python 3.14.7**; 3.15.0 rc1 released 2026-08-04, final due
> 2026-10-01.

**Beta 1, in early May, is the most consequential date on Python's calendar and
almost nobody outside the core team notices it. It is the moment the next
version's feature set stops moving — which means it is the moment you can start
testing against a target that will not change under you, and it is the start of
a five-month window in which the ecosystem either gets ready for October or does
not. If you maintain a library with a compiled extension, beta 1 is your
deadline, not October.**

## The milestones, with 3.15 as the worked example

PEP 790's schedule, which is the real thing rather than an idealised one:

| Milestone | Date | What may change |
|---|---|---|
| Development begins | 2025-05-07 | anything (this is 3.14's beta 1 day) |
| alpha 1 – alpha 8 | 2025-10-14 → 2026-04-07 | new features, semantics, bug fixes |
| **beta 1** | **2026-05-07** | **no new features from here** |
| beta 2 – beta 4 | 2026-06-02 → 2026-07-18 | bug fixes, doc and test changes |
| candidate 1 | 2026-08-04 | reviewed fixes for severe issues only |
| candidate 2 | 2026-09-01 (expected) | as above |
| final | 2026-10-01 (expected) | — |

PEP 790 annotates beta 1 with the same parenthetical every release schedule
carries: *"(No new features beyond this point.)"*

The devguide gives the per-stage rules that the annotation compresses:

> *"Alpha releases typically serve as a reminder to the core team that they need
> to start getting in changes that change semantics or add something to Python
> as such things should not be added during a Beta."*

> *"After a first beta release is published, no new features are accepted. Only
> bug fixes and improvements to documentation and tests can now be committed."*

> *"A branch preparing for an RC release can only have bugfixes applied that have
> been reviewed by other core team members. Generally, these issues must be
> severe enough (for example, crashes) that they deserve fixing before the final
> release. All other issues should be deferred to the next development cycle,
> since stability is the strongest concern at this point."*

> *"While the goal is to have no code changes between an RC and a final release,
> there may be a need for final documentation or test fixes."*

That last sentence is the answer to "should we wait for `3.x.1`?" from CPython's
side: the release candidate is *intended* to be byte-identical in behaviour to
the final release. Whatever risk remains in adopting `3.x.0` lives in the
ecosystem, not in the interpreter.

## What beta 1 means if you maintain a library

"No new features" is a promise made to *you*. Before beta 1, testing against the
next version is chasing a moving target — an alpha can change the semantics of
something you just adapted to. After beta 1, the API surface is fixed, and every
subsequent change is meant to be a fix. So beta 1 is the earliest date at which
work you do is guaranteed not to be wasted, and October is roughly five months
later.

The concrete obligations, in the order they bite:

**1 · Add the pre-release to CI the week beta 1 lands.** An allow-failure job on
the new version turns "does our library work on 3.15" from a question asked in
panic in October into a signal you have had since May. Both major runners can
install pre-releases, and so can `uv`:

```bash
# uv will use a pre-release when nothing else matches the request
uv python install 3.15
uv run --python 3.15 pytest
```

**2 · Rebuild compiled wheels for the new ABI tag.** A pure-Python wheel
(`py3-none-any`) keeps working across versions. An extension module does not: it
is built against a specific CPython ABI and tagged accordingly — `cp314` for
3.14, `cp315` for 3.15. Nothing about the release schedule builds those for you;
they exist because a maintainer ran a build. This is the single mechanical
reason the ecosystem lags each October, and it is why "check your compiled
dependencies" is step two of choosing a version in
[the previous chunk](02-the-support-window.md).

**3 · Read the "Pending removal" sections, not just the highlights.** The
What's New page for the version *being released* lists what is going away in the
next several versions. Acting on those lists during the beta window is how you
avoid discovering a removal on release day. [Chunk
4](04-version-directives-and-guards.md) and [chunk
6](06-seeing-deprecation-warnings.md) cover how to read them.

**4 · Publish before the final release if you can.** A wheel that appears on
PyPI in September means your users' October upgrade succeeds. A wheel that
appears in December means five weeks of issues asking why the install fails.

**5 · Do not ship a release built against an alpha.** Alphas are explicitly
*"aimed at testing by advanced users, not production use"*, and an alpha's ABI
can still move. Build release artefacts against beta 1 or later.

## The free-threaded build's place in the release model

Free-threading has its own, slower track running alongside the ordinary release
calendar, and confusing the two is common. PEP 779 states the framing:

> *"The acceptance of PEP 703 (Making the Global Interpreter Lock Optional in
> CPython), as announced by the Steering Council, describes three phases of
> development for the work to remove the Global Interpreter Lock. Phase I
> started early in the development of Python 3.13, and includes making the
> free-threaded (GIL-less) Python build available but explicitly experimental.
> Phase II would make the free-threaded build officially supported but still
> optional, and phase III would make the free-threaded build the default."*

And it places phase II precisely:

> *"With these criteria satisfied, we believe Python 3.14 is the right time frame
> for phase II of PEP 703."*

So the state of the world on the current release:

- **3.13** shipped the free-threaded build as *experimental* (phase I).
- **3.14** makes it *officially supported* (phase II) — but still **optional and
  not the default**. There are two distinct builds of CPython 3.14.
- **Phase III**, making it the default, is deliberately not scheduled. PEP 779:
  *"The decision to make free-threaded Python the default (phase III) is very
  different, and we expect it will revolve around community support,
  willingness, and showing clear benefit. That's left for a future PEP."*

What "officially supported" changed is the *status of the API and the build*,
not the status of your dependencies. PEP 779's own numbers on the cost, quoted
because they are the ones that matter when someone proposes switching:

> *"the performance penalty on linear performance, comparing a free-threaded
> build against a with-GIL build, as measured by the pyperformance benchmarks …
> is currently around 10% (except on macOS, where it's more like 3%)"*

> *"free-threaded Python currently sees about 15-20% higher memory use
> (geometric mean, as measured by pyperformance)"*

Because it is a separate build, it has a separate ABI tag — `cp314t` rather than
`cp314` — and a package needs a wheel built for it specifically. The HOWTO is
explicit about what happens when one is not ready:

> *"Some third-party packages, in particular ones with an extension module, may
> not be ready for use in a free-threaded build, and will re-enable the GIL."*

> *"The GIL may also automatically be enabled when importing a C-API extension
> module that is not explicitly marked as supporting free threading. A warning
> will be printed in this case."*

That silent-ish fallback is the trap: you can be running a free-threaded
interpreter, paying its performance and memory cost, with the GIL switched back
on by an import. Detecting it is the point of the three checks the HOWTO names:

> *"To check if the current interpreter supports free-threading, python -VV and
> sys.version contain 'free-threading build'. The new sys.\_is\_gil\_enabled()
> function can be used to check whether the GIL is actually disabled in the
> running process. The sysconfig.get\_config\_var("Py\_GIL\_DISABLED")
> configuration variable can be used to determine whether the build supports
> free threading. If the variable is set to 1, then the build supports free
> threading. This is the recommended mechanism for decisions related to the
> build configuration."*

Those are two different questions and the distinction is the whole point:

```python
import sys, sysconfig

# Is this a free-threaded BUILD? (build configuration — recommended for decisions)
supports_free_threading = sysconfig.get_config_var("Py_GIL_DISABLED") == 1

# Is the GIL actually off RIGHT NOW? (runtime state — can differ from the above)
gil_on = sys._is_gil_enabled()

if supports_free_threading and gil_on:
    print("free-threaded build, but something re-enabled the GIL")
```

The build can be free-threaded while the GIL is enabled — because an extension
asked for it, or because `PYTHON_GIL=1` or `-X gil=1` was passed. The
mechanics, and what free-threading does and does not change about writing
correct threaded code, belong to [02 · The GIL](../02-the-gil/README.md); what
belongs here is the release-model fact: **it is a second build of the same
version, on a multi-release adoption track, and adopting it is a separate
decision from adopting 3.14.**

Note the leading underscore on `sys._is_gil_enabled()`. Under PEP 387 a
name prefixed with `_` is explicitly not part of the public API and *"can change
or be removed at any time in any way"* — so guard calls to it rather than
assuming it exists.

## Gotchas

**Symptom:** you adapted a library to a 3.15 alpha and the change was wrong by beta
**Cause:** alphas are where semantics still move. PEP 602 gives new features seven months of alpha releases specifically so that they can change
**Fix:** treat alphas as early warning and beta 1 as the date to do the work. If you must track alphas, expect to redo it

**Symptom:** `pip install` of your own package fails on the new Python within days of its October release
**Cause:** no wheel exists for the new ABI tag, so the installer falls back to building from source on the user's machine, which needs a compiler and headers they do not have
**Fix:** build and publish `cp3XX` wheels during the beta/RC window. If your extension can use the stable ABI, an `abi3` wheel survives future minor versions and removes this problem permanently

**Symptom:** "we're on the free-threaded build" but there is no parallelism
**Cause:** an imported C extension that is not marked as supporting free threading re-enabled the GIL at import time. A warning is printed, and warnings scroll past
**Fix:** assert it at startup — `sys._is_gil_enabled()` must be False — and fail loudly rather than shipping a build that costs 10% and buys nothing

**Symptom:** a package installs on 3.14 and not on 3.14 free-threaded
**Cause:** they are different ABIs. `cp314` wheels are not `cp314t` wheels, and a project can publish one and not the other
**Fix:** check the tags on PyPI before planning a free-threaded deployment, and keep a with-GIL build available to fall back to

**Symptom:** someone reads "officially supported in 3.14" as "it is the default now"
**Cause:** PEP 779 is phase II of three. Phase II means supported and optional; phase III, the default, is not scheduled and requires a future PEP
**Fix:** say "supported, optional, separate build" — the distinction determines whether you have one interpreter to test or two

**Symptom:** a CI matrix pinned to `3.x` picks up a release candidate and turns red
**Cause:** a loose version request can resolve to a pre-release when the tooling allows it; `uv` will use a pre-release *"if there is no other available installation matching the request"*
**Fix:** be explicit. Keep pre-release jobs separate and allow-failure, and pin the production job to a final release

**Symptom:** you find out about a removal on release day despite eighteen months of notice
**Cause:** the notice lives in the "Pending removal in Python 3.X" sections of the What's New page and in `DeprecationWarning`s that are silent by default
**Fix:** read those sections during the beta window, and run your test suite with deprecation warnings visible — see [chunk 6](06-seeing-deprecation-warnings.md)

## Interview questions

**★ What does "beta 1" mean in Python's release process, and why should a library author care?**
It is feature freeze: after the first beta no new features are accepted into
that release, only bug fixes and documentation and test changes. For a library
author it is the first date at which the target stops moving, which makes it the
right moment to add the next version to CI and, if you ship compiled code, to
start building wheels for the new ABI tag. It falls in early May, about five
months before the October release — that gap is the ecosystem's entire
preparation window.

**★ Is the free-threaded build the default in 3.14?**
No. PEP 703's rollout has three phases: experimental in 3.13, officially
supported but still optional in 3.14 (that is PEP 779), and default at some
future point that has not been scheduled and needs another PEP. In 3.14 there
are two distinct builds of the same version, with distinct ABI tags — `cp314`
and `cp314t` — and choosing the free-threaded one is a separate decision from
upgrading to 3.14.

**★ How do you tell at runtime whether the GIL is actually disabled?**
Two different checks. `sysconfig.get_config_var("Py_GIL_DISABLED") == 1` tells
you the *build* supports free threading, and the HOWTO calls it the recommended
mechanism for build-configuration decisions. `sys._is_gil_enabled()` tells you
whether the GIL is off *in this process right now*, which can differ, because an
imported extension module that is not marked as free-threading-safe will
re-enable it, as will `PYTHON_GIL=1` or `-X gil=1`. Note the underscore on
`sys._is_gil_enabled` — that is a private name under PEP 387 and could change.

**Why do compiled packages break every October when pure-Python ones do not?**
A pure-Python wheel is tagged `py3-none-any` and is valid on every interpreter.
An extension module is compiled against a specific CPython ABI and tagged
`cp313`, `cp314` and so on, so a new minor version needs a newly built artefact.
Nothing in the release process produces those; a maintainer has to build and
upload them. The way out for a library is the stable ABI, which yields an `abi3`
wheel that keeps working on later minor versions.

**Should you wait for `3.x.1` before adopting a new Python?**
Not for the interpreter's sake. The release candidate stage exists to shake out
exactly those defects, and the devguide's stated goal is no code changes between
the RC and the final release. What is genuinely worth waiting for is your
dependency set: check that each compiled dependency publishes a wheel for the
new tag on your platform. That is a specific, checkable question rather than a
blanket delay.

**What is the difference between what an alpha, a beta and a release candidate may contain?**
An alpha may contain anything, including new features and semantic changes — it
is the tail of open development. A beta accepts no new features, only bug fixes
and documentation and test changes. A release candidate accepts only reviewed
fixes for issues severe enough to justify the risk, typically crashes, and
everything else is deferred to the next cycle.

---

← Prev: [The five-year support window](02-the-support-window.md) · Index: [The release model](README.md) · Next → [Version directives and guards](04-version-directives-and-guards.md)
