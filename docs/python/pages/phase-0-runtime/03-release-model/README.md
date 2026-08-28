---
title: "The release model: one feature release every October, five years of support for each, and a deprecation policy you can plan a migration against"
sidebar_label: "03 · The release model"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 602 – Annual Release Cycle for Python](https://peps.python.org/pep-0602/),
> the devguide [Status of Python versions](https://devguide.python.org/versions/)
> and [Development cycle](https://devguide.python.org/developer-workflow/development-cycle/),
> [PEP 387 – Backwards Compatibility Policy](https://peps.python.org/pep-0387/),
> [PEP 745](https://peps.python.org/pep-0745/) (3.14 schedule),
> [PEP 719](https://peps.python.org/pep-0719/) (3.13 schedule),
> [PEP 790](https://peps.python.org/pep-0790/) (3.15 schedule) and
> [PEP 779](https://peps.python.org/pep-0779/) (free-threading, phase II).
> Version spine: **Python 3.14.7** (2026-08-05) is current and in bugfix;
> 3.15.0 release candidate 1 shipped 2026-08-04, final due 2026-10-01;
> `main` is the future 3.16.

**Python's release calendar is not trivia. It is the input to four decisions you
will make on every project: which minor version you build on, how long you have
before that version stops receiving security fixes, whether a function you just
found in the documentation exists on your production interpreter, and how much
notice you get before something you depend on is deleted. All four are answered
by two documents — PEP 602 for the cadence and PEP 387 for the compatibility
policy — plus one page, the devguide's *Status of Python versions*, that tells
you where every version stands today.**

The shape is simple enough to memorise and precise enough to plan against: a
feature release every October, developed over seventeen overlapping months, then
two years of bugfix releases roughly every two months, then three years of
source-only security fixes, then nothing. Five years, end to end, per version.
Everything else in this topic is a consequence of those numbers.

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The annual cadence](01-the-annual-cadence.md)** | PEP 602's twelve-month cadence and seventeen-month development window; `major.minor.micro`; exactly what a `.z` release may and may not change; the five release statuses; the branch model |
| 2 | **[The five-year support window](02-the-support-window.md)** | Two years bugfix plus three years security; what "security-only" costs you in practice; where 3.9 through 3.16 actually sit today; choosing the version to start a new project on |
| 3 | **[Feature freeze and the free-threaded build](03-feature-freeze.md)** | Alpha, beta 1, release candidate, final — and what each milestone obliges a library author to do; where the free-threaded build sits in the release model after PEP 779 |
| 4 | **[Version directives and guards](04-version-directives-and-guards.md)** | Reading "Added in version 3.12" against your deploy target; the docs default to the newest version; `sys.version_info`, feature detection, and the syntax a runtime guard cannot protect you from |
| 5 | **[The deprecation policy](05-the-deprecation-policy.md)** | PEP 387: what is public API and what was never covered; the two-release floor and the five-year preference; soft deprecation; provisional APIs |
| 6 | **[Seeing the warnings](06-seeing-deprecation-warnings.md)** | Why `DeprecationWarning` is silent outside `__main__`, the four ways to switch it on, and reading the "Pending removal in Python 3.X" lists |

## The one-paragraph version

Every October a new `3.x.0` ships. It was branched from `main` seventeen months
earlier and frozen for features at its first beta, five months before release —
which is why two Python versions are always in development at once. Once
released, it gets bugfix releases (`3.x.1`, `3.x.2`, …) about every two months
for two years, then goes *security-only*: source-only releases, on no schedule,
for exploitable bugs only, for three more years. Five years after `3.x.0`, the
branch is frozen and deleted. Anything the core team wants to remove must be
deprecated in the documentation and, where possible, emit a `DeprecationWarning`
for at least two releases — in practice they now aim for five years — before it
goes. The catch is that `DeprecationWarning` is invisible by default outside
`__main__`, so the notice period exists and you will not see it unless you ask.

## Why this is an Understand topic and not a Know topic

You do not need to memorise dates. You do need to be able to answer, without
looking anything up:

- *"Is it safe to upgrade this service from 3.14.4 to 3.14.7 on a Friday?"* —
  the answer follows from the rule about what a micro release is allowed to
  contain.
- *"We are on 3.11. How long have we got?"* — the answer follows from the
  support table, and it is shorter than most teams assume, because 3.11 is
  already security-only.
- *"The docs say this exists. Why does production say it does not?"* — the
  answer is that docs.python.org defaults to the newest version and your
  container does not.

## Phase gate contribution

After this topic you can state which Python version a new service should start
on and defend it; read a version directive in the standard library docs against
your actual deploy target; and explain why a `DeprecationWarning` your test
suite never printed still means something will break in eighteen months.

## Where this connects

- **[04 · Installing and managing versions](../04-installing-and-versions/README.md)**
  is the mechanical half of this topic: once you have decided *which* version,
  that page is how you get it onto a machine without breaking the machine.
- **Phase 7 — Packaging** turns "which versions do we support" into a
  `requires-python` constraint and a CI matrix.

---

← Prev: [The GIL](../02-the-gil/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [The annual cadence](01-the-annual-cadence.md)
