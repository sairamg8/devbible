---
title: "Part 4 — Production"
sidebar_label: "4 · Production"
sidebar_position: 4
---

> Phases 12–13 · pytest, and running Python where it counts

The last mile: tests that let you refactor without fear, and the operational
craft — logging, profiling, deployment — that keeps a Python service boring in
the good way.

---

## Phase 12 — Testing with pytest

pytest won. The ecosystem's plugins, fixtures and plain-assert style are the
standard; `unittest` is read-only legacy. The hard skills here are fixtures and
knowing *where to patch*.

| Topic | Tier |
|---|---|
| **pytest fundamentals**: discovery (`test_*.py`), plain `assert` with rewritten introspection, running subsets (`-k`, `::name`), `-x`/`--lf` — the daily loop | <span className="db-tier t-master">Master</span> |
| **Fixtures**: dependency-injected setup by argument name, **scopes** (function → session), `yield` fixtures for teardown, `conftest.py` sharing — the feature that *is* pytest | <span className="db-tier t-master">Master</span> |
| **`parametrize`**: one test, every edge case as a row — ids for readable failures, stacked parametrize for grids | <span className="db-tier t-understand">Understand</span> |
| **Mocking**: `unittest.mock` / `mocker`, **`patch` and the where-to-patch rule** (patch where it's *used*, not where it's defined — the trap everyone hits once), `autospec=True` so refactors break tests loudly, mock discipline: boundaries only | <span className="db-tier t-master">Master</span> |
| The built-in fixtures: `tmp_path`, `monkeypatch` (env vars, attributes), `capsys`, `caplog` — no hand-rolled temp dirs or env juggling | <span className="db-tier t-understand">Understand</span> |
| **Testing async code**: pytest-asyncio/anyio, async fixtures, testing FastAPI with `TestClient`/`AsyncClient` and dependency overrides | <span className="db-tier t-understand">Understand</span> |
| Real dependencies vs doubles: **Testcontainers-style Postgres** for the data layer vs mocking the repo — the "passed on SQLite, failed on Postgres" lesson, same as Java's | <span className="db-tier t-understand">Understand</span> |
| Test structure that scales: arrange-act-assert, factories/builders for model setup, and the flaky-test taxonomy (time, order, network) with fixes | <span className="db-tier t-understand">Understand</span> |
| Coverage with `coverage.py`/pytest-cov — branch coverage on, the number as a floor, and what it cannot prove | <span className="db-tier t-know">Know</span> |
| **Hypothesis** — property-based testing: the encoder round-trip that found the surrogate-pair bug no example test would have written | <span className="db-tier t-know">Know</span> |
| Multi-version test matrices: tox/nox, CI jobs per Python version — for libraries more than apps | <span className="db-tier t-know">Know</span> |
| Doctests — examples in docstrings that can't rot | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** the Phase 11 CRUD resource tested three ways — pure unit tests
for the domain, endpoint tests with dependency overrides, one data-layer suite
against real Postgres — green in CI with coverage reported.

---

## Phase 13 — Production and performance

Python's operational reality: a logging module older than some teammates, real
profilers, and a deployment story that is 90% "build a good container".

| Topic | Tier |
|---|---|
| **`logging` done right**: loggers/handlers/formatters/levels, `getLogger(__name__)`, configure once at the entrypoint, **structured JSON logs** with request ids, `exc_info`/`logger.exception` — and never `print` in a service | <span className="db-tier t-master">Master</span> |
| **Deploying in a container**: slim base images, `uv sync --frozen` layer-cached, non-root, `PYTHONUNBUFFERED=1` (the missing-logs mystery), multi-stage builds — ties to this bible's Docker section | <span className="db-tier t-master">Master</span> |
| **The performance model**: why pure-Python loops are slow (boxed objects, dynamic dispatch), why it usually doesn't matter in an I/O-bound service, and the escape hatches in order — better algorithm, stdlib/C-backed libs, caching, native extension (Rust/C) last | <span className="db-tier t-understand">Understand</span> |
| **Profiling before optimizing**: cProfile + snakeviz for calls, **py-spy** for a live production process (no restart), `timeit` for micro-questions — the flame graph that indicts the ORM, not your code | <span className="db-tier t-understand">Understand</span> |
| Memory: refcounting + the cycle collector, `tracemalloc` for "where did 2 GB go", the usual suspects (caches without bounds, lists that should be generators), `sys.getsizeof`'s limits | <span className="db-tier t-understand">Understand</span> |
| Process management: uvicorn/gunicorn worker counts, **graceful shutdown** (SIGTERM → drain → exit), liveness vs readiness probes — the same contract as every other service in this bible | <span className="db-tier t-understand">Understand</span> |
| **Security hygiene**: parameterized SQL (again, because it's that important), `secrets` module for tokens, `yaml.safe_load`, pickle refused at boundaries, dependency audit (`pip-audit`) in CI | <span className="db-tier t-understand">Understand</span> |
| Building a CLI: `argparse` fluently, Typer/Click for anything with subcommands — exit codes, `--help` that helps | <span className="db-tier t-understand">Understand</span> |
| Observability beyond logs: OpenTelemetry auto-instrumentation, Sentry for exceptions — request traced across FastAPI → SQLAlchemy → httpx | <span className="db-tier t-know">Know</span> |
| Caching in practice: `lru_cache` for pure functions, Redis for shared state, TTLs and invalidation as the actual hard part | <span className="db-tier t-know">Know</span> |
| Scheduled and background work: cron + a script (with lock files), APScheduler, or the queue from Phase 9 — choosing by delivery guarantee | <span className="db-tier t-know">Know</span> |
| Upgrading Python: reading the What's New, `DeprecationWarning` as a to-do list, staged rollout with the test matrix | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** for "the API got slow this week", you have the order —
metrics/logs first, then py-spy on the live process, then the DB query log —
and can name which layer each tool can and cannot see.

---

← Prev: [Part 3 — Application layer](03-application.md) · Index: [Python](../README.md)
