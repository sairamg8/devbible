---
title: "Python — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against docs.python.org (3.14), the Python Insider release
> posts (3.14.7 / 3.13.15), and PEP 790 (the 3.15 schedule).

The complete topic inventory for Python, tiered for **mastery in backend
service development and automation**. 14 phases, split into 4 parts to stay
under the 300-line file cap.

Python sits outside this bible's MERN/PERN core — it is here as the second
backend language, taught toward the same job: a production API in front of
PostgreSQL, plus the scripting and automation work Python uniquely owns. Where
a concept already lives elsewhere in the bible (SQL, HTTP, Docker, Redis), the
Python pages will link there rather than reteach it. Data science and ML are
**out of scope** — named where relevant (pandas/polars, numpy) at recognition
level only.

## Version facts

| | |
|---|---|
| Current stable | **Python 3.14** (3.14.7, 5 Aug 2026) — the build target |
| Also maintained | 3.13 (3.13.15) in bugfix; 3.10–3.12 security-only |
| Next release | **3.15.0 — 1 Oct 2026** (RC1 shipped 4 Aug 2026); headline: lazy imports via the `lazy` keyword |
| Release model | One major each October; ~2 years bugfix + 3 years security per line |
| Free-threading | Free-threaded CPython **officially supported since 3.14** (PEP 779) — the GIL is now optional, not gone |
| Build on today | **3.14** for new services · know how to read "added in 3.x" against an older deploy target |

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | The runtime and GIL, language core, functions and decorators | 0–2 |
| 2 | **[The data model](syllabus/02-data-model.md)** | Collections in depth, classes and dunders, generators, typing | 3–6 |
| 3 | **[Application layer](syllabus/03-application.md)** | Packaging and uv, concurrency and asyncio, FastAPI, data and files, **the REST/CRUD API** | 7–11 |
| 4 | **[Production](syllabus/04-production.md)** | pytest, logging, profiling, deployment | 12–13 |

## Explanations

Not started — the syllabus comes first, the explanation pages follow once it is
approved. Status lives in **[Explanations](./pages/README.md)**.

import Progress from '@site/src/components/Progress';

<Progress lang="python" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 60 | 33% |
| <span className="db-tier t-understand">Understand</span> | 82 | 46% |
| <span className="db-tier t-know">Know</span> | 31 | 17% |
| <span className="db-tier t-when">When Needed</span> | 7 | 4% |
| **Total** | **180** | |

By part: Foundations 38 · Data model 49 · Application 69 · Production 24.

If you only ever finish the <span className="db-tier t-master">Master</span>
set, you can build, test and ship a FastAPI service and write automation the
team trusts. The rest is range.

## Prerequisites

Programming in at least one language (this bible's JavaScript track more than
qualifies), and SQL through joins — the data phase leans on the PostgreSQL
section rather than reteaching it.

## Reading order

Phases are sequential and the order is load-bearing. Four rules:

1. **Do not skip Phase 0.** The GIL, venvs and the import system are where
   "Python is being weird" complaints actually live.
2. **Do not start FastAPI (Phase 9) before Phases 2 and 6.** FastAPI *is*
   decorators plus type hints plus Pydantic — learning it first means learning
   an incantation.
3. **asyncio (Phase 8) before the web service**, because `async def` route
   handlers without the event-loop model produce the blocking bug you can't see.
4. **Phase 11 is the destination.** REST design, CRUD end to end, layering and
   the transaction boundary need both FastAPI (Phase 9) and SQLAlchemy
   (Phase 10) in hand — which is exactly why it sits after them rather than
   inside Phase 9.

Phases 12–13 can run alongside whatever you're building from Phase 9 onward.

## Sources

- [docs.python.org/3.14](https://docs.python.org/3.14/) · [What's New in 3.14](https://docs.python.org/3/whatsnew/3.14.html)
- [Python Insider — 3.14.7 / 3.13.15](https://blog.python.org/2026/08/python-3147-31315/) · [PEP 790 — 3.15 schedule](https://peps.python.org/pep-0790/) · [endoflife.date/python](https://endoflife.date/python)
- [PEP 779 — free-threaded Python, officially supported](https://peps.python.org/pep-0779/)
- [uv docs](https://docs.astral.sh/uv/) · [ruff docs](https://docs.astral.sh/ruff/)
- [FastAPI docs](https://fastapi.tiangolo.com/) · [Pydantic docs](https://docs.pydantic.dev/) · [SQLAlchemy 2.0 docs](https://docs.sqlalchemy.org/en/20/)
- [pytest docs](https://docs.pytest.org/) · [typing docs + spec](https://typing.python.org/)
