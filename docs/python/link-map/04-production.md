---
title: "Link map · Python · Part 4"
sidebar_label: "04 · Production"
sidebar_position: 4
---

# Link map · Python · Part 4 (phases 12–13)

Covers every topic row of `docs/python/syllabus/04-production.md`: T12-01 to T12-12 (phase 12, pytest) and T13-01 to T13-12 (phase 13, production and performance). That is 24 rows, numbered in table order.

*read* = I read the passage. *headings only* = fetched with HTTP 200, title and keyword counts checked, body not read end to end. Almost every link below is *headings only*, because this pass verified by fetching and keyword checks, not by full reads. Third-party links carry a date where the page shows one; undated means the page shows none. No `#anchors` are given.

🔴 **Version note.** docs.python.org on 2026-10-12 serves Python 3.15 pages at the `/3/` path, so the stdlib links here are current for 3.14 and 3.15 alike. Tool pages seen: pytest (stable), pytest-asyncio 1.4.0, AnyIO 4.15.1, coverage.py 7.16.2, pytest-cov 7.1.0, Hypothesis 6.169.0, Nox 2026.8.17, testcontainers-python 2.0.0, Click 8.5.x, structlog 26.1.0. The APScheduler page is the 3.x guide (3.11.3), not 4.x.

**Fetch caveats.** `github.com` and `realpython.com` answer 403, and `pypi.org` serves a challenge page; none of them is used as a Read-this. py-spy and pip-audit are therefore cited through their `raw.githubusercontent.com` README, which fetched fine. The old Ned Batchelder where-to-patch URLs I guessed returned 404 and are not used. No page of ours exists yet for phases 12–13 (`docs/python/pages` holds phases 0–3 and 7 only), so every row is 🔲.

---

## Phase 12 — Testing with pytest

### T12-01 · pytest fundamentals — Master · 🔲 not written
- **Read this:** [Get Started](https://docs.pytest.org/en/stable/getting-started.html) · docs.pytest.org · first test, plain assert, test_ discovery, grouping in classes (*headings only*) · covers our angle: **partial** — no `-k`, `::name`, `-x`, `--lf` detail · fetched 2026-10-12
- **Also good:** [How to invoke pytest](https://docs.pytest.org/en/stable/how-to/usage.html) · docs.pytest.org · node-id selection with `::` and the selection options (*headings only*) · fetched 2026-10-12
- **Also good:** [How to write and report assertions](https://docs.pytest.org/en/stable/how-to/assert.html) · docs.pytest.org · assertion introspection and rewriting (*headings only*) · fetched 2026-10-12
- **Our delta:** the daily-loop recipe (`-x`, `--lf`, `-k`) in one place; the failure-handling page `https://docs.pytest.org/en/stable/how-to/failures.html` fetched 200 but I could not confirm `--lf` on it.

### T12-02 · Fixtures — Master · 🔲 not written
- **Read this:** [How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) · docs.pytest.org · the canonical walk-through: injection by argument name, yield teardown, scopes, conftest, autouse (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [About fixtures](https://docs.pytest.org/en/stable/explanation/fixtures.html) · docs.pytest.org · the why behind the model, short (*headings only*) · fetched 2026-10-12

### T12-03 · `parametrize` — Understand · 🔲 not written
- **Read this:** [How to parametrize fixtures and test functions](https://docs.pytest.org/en/stable/how-to/parametrize.html) · docs.pytest.org · the mark, stacked decorators for grids, parametrized fixtures (*headings only*) · covers our angle: **partial** — I found no `ids=` text on the page · fetched 2026-10-12
- **Our delta:** readable failure ids and stacking into a grid, shown with our own example.

### T12-04 · Mocking and where to patch — Master · 🔲 not written
- **Read this:** [unittest.mock — where to patch](https://docs.python.org/3/library/unittest.mock.html) · docs.python.org · the section on patching the name where it is looked up, plus autospec (*headings only*) · covers our angle: **partial** — correct rule, but no "mock boundaries only" discipline and no `mocker` · fetched 2026-10-12
- **Also good:** [Why your mock doesn't work](https://nedbatchelder.com/blog/201908/why_your_mock_doesnt_work.html) · Ned Batchelder, Aug 2019 · a worked story of patching the wrong name (*headings only*) · fetched 2026-10-12
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler, undated page (originally 2007) · the vocabulary of doubles behind the boundary rule (*headings only*) · fetched 2026-10-12
- **Our delta:** `mocker` from pytest-mock (no page fetched for it) and the discipline of mocking only at boundaries.

### T12-05 · Built-in fixtures: `tmp_path`, `monkeypatch`, `capsys`, `caplog` — Understand · 🔲 not written
- **Read this:** [How to monkeypatch/mock modules and environments](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) · docs.pytest.org · setattr, setenv and friends (*headings only*) · covers our angle: **partial** — one of four fixtures · fetched 2026-10-12
- **Also good:** [How to use temporary directories and files](https://docs.pytest.org/en/stable/how-to/tmp_path.html) · docs.pytest.org · `tmp_path` (*headings only*) · fetched 2026-10-12
- **Also good:** [How to capture stdout/stderr output](https://docs.pytest.org/en/stable/how-to/capture-stdout-stderr.html) · docs.pytest.org · `capsys` (*headings only*) · fetched 2026-10-12
- **Also good:** [How to manage logging](https://docs.pytest.org/en/stable/how-to/logging.html) · docs.pytest.org · `caplog` (*headings only*) · fetched 2026-10-12
- **Our delta:** one page tying the four together as "no hand-rolled temp dirs or env juggling".

### T12-06 · Testing async code and FastAPI — Understand · 🔲 not written
- **Read this:** [Testing Dependencies with Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) · FastAPI docs · `dependency_overrides` in tests (*headings only*) · covers our angle: **partial** — the override half · fetched 2026-10-12
- **Also good:** [Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/) · FastAPI docs · `AsyncClient` with anyio (*headings only*) · fetched 2026-10-12
- **Also good:** [Testing with AnyIO](https://anyio.readthedocs.io/en/stable/testing.html) · AnyIO docs · the pytest plugin and async fixtures (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [Testing](https://fastapi.tiangolo.com/tutorial/testing/) FastAPI tutorial for `TestClient` — fine as the entry point; and the [pytest-asyncio](https://pytest-asyncio.readthedocs.io/en/stable/) home, a very short page.
- **Our delta:** pytest-asyncio async fixtures with loop scope; the anyio route is covered above.

### T12-07 · Real dependencies vs doubles (Testcontainers Postgres) — Understand · 🔲 not written
- **Read this:** [Getting started with Testcontainers for Python](https://testcontainers.com/guides/getting-started-with-testcontainers-for-python/) · testcontainers.com · a pytest suite against a real Postgres container (*headings only*) · covers our angle: **partial** — no "passed on SQLite, failed on Postgres" argument · fetched 2026-10-12
- **Also good:** [testcontainers-python](https://testcontainers-python.readthedocs.io/en/latest/) · project docs, v2.0.0 · API reference for the Python module (*headings only*) · fetched 2026-10-12
- **Our delta:** the SQLite-vs-Postgres divergence list and when a double is the right call.

### T12-08 · Test structure that scales: AAA, factories, flaky tests — Understand · 🔲 not written
- **Read this:** [Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html) · docs.pytest.org · causes and mitigations, including test-order and timing issues (*headings only*) · covers our angle: **partial** — no network category found, no factories · fetched 2026-10-12
- **Also good:** [Anatomy of a test](https://docs.pytest.org/en/stable/explanation/anatomy.html) · docs.pytest.org · the arrange, act, assert, cleanup shape (*headings only*) · fetched 2026-10-12
- **Also good:** [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) · Martin Fowler site, undated page · what to test at which level, with a flakiness section (*headings only*) · fetched 2026-10-12
- **Our delta:** factories and builders for model setup (no explainer found that I fetched; Python-specific factory libraries were not searched) and a fix per flaky class.

### T12-09 · Coverage — Know · 🔲 not written
- **Read this:** [Branch coverage measurement](https://coverage.readthedocs.io/en/latest/branch.html) · coverage.py docs, 7.16.2 · what branch measurement adds over line coverage (*headings only*) · covers our angle: **partial** — nothing on what coverage cannot prove · fetched 2026-10-12
- **Also good:** [pytest-cov](https://pytest-cov.readthedocs.io/en/latest/) · pytest-cov docs, 7.1.0 · landing page only; keyword checks for `--cov` and `fail-under` found nothing here, so the usage lives on sub-pages I did not fetch (*headings only*) · fetched 2026-10-12
- **Our delta:** the number as a floor and the limits of coverage; the pytest-cov command line.

### T12-10 · Hypothesis — Know · 🔲 not written
- **Read this:** [Quickstart](https://hypothesis.readthedocs.io/en/latest/quickstart.html) · Hypothesis docs, 6.169.0 · `given` and strategies, first property test (*headings only*) · covers our angle: **partial** — no round-trip story · fetched 2026-10-12
- **Also good:** [Introduction (tutorial)](https://hypothesis.readthedocs.io/en/latest/tutorial/introduction.html) · Hypothesis docs · fetched 200, the word round appears seven times, so likely the encode/decode example (*headings only*) · fetched 2026-10-12
- **Our delta:** the encoder round-trip and the surrogate-pair bug it finds.

### T12-11 · Multi-version test matrices (tox/nox) — Know · 🔲 not written
- **Read this:** [Nox tutorial](https://nox.thea.codes/en/stable/tutorial.html) · Nox docs, 2026.8.17 · sessions, parametrize over Pythons (*headings only*) · covers our angle: **partial** — nox only, no CI-job-per-version · fetched 2026-10-12
- **Also good:** [tox](https://tox.wiki/en/latest/) · tox docs · landing page, short; no matrix text on it (*headings only*) · fetched 2026-10-12
- **Our delta:** the CI matrix and libraries-versus-apps judgement.

### T12-12 · Doctests — When Needed · 🔲 not written
- **Read this:** [doctest — Test interactive Python examples](https://docs.python.org/3/library/doctest.html) · docs.python.org · the reference and the usage patterns (*headings only*) · covers our angle: full · fetched 2026-10-12

---

## Phase 13 — Production and performance

### T13-01 · `logging` done right — Master · 🔲 not written
- **Read this:** [Logging HOWTO](https://docs.python.org/3/howto/logging.html) · docs.python.org · loggers, handlers, formatters, levels, `getLogger(__name__)` (*headings only*) · covers our angle: **partial** — no structured JSON, no request ids · fetched 2026-10-12
- **Also good:** [Logging Cookbook](https://docs.python.org/3/howto/logging-cookbook.html) · docs.python.org · JSON-style logging, filters, contextvars for context (*headings only*) · fetched 2026-10-12
- **Also good:** [10 Best Practices for Logging in Python](https://betterstack.com/community/guides/logging/python/python-logging-best-practices/) · Better Stack, undated page · JSON logs and exception logging; vendor article (*headings only*) · fetched 2026-10-12
- **Our delta:** configure once at the entrypoint, request ids via contextvars, and "never print in a service".
- *Checked, not chosen:* [structlog — Why](https://www.structlog.org/en/stable/why.html), a library pitch rather than an explanation.

### T13-02 · Deploying in a container — Master · 🔲 not written
- **Read this:** [Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/) · uv docs · `--frozen`, cache mounts, layer ordering (*headings only*) · covers our angle: **partial** — no non-root or `PYTHONUNBUFFERED` text found · fetched 2026-10-12
- **Also good:** [Production-ready Python Docker Containers with uv](https://hynek.me/articles/docker-uv/) · Hynek Schlawack, undated page · multi-stage uv build (*headings only*) · fetched 2026-10-12
- **Also good:** [The best Docker base image for your Python application (February 2026)](https://pythonspeed.com/articles/base-image-python-docker-images/) · Itamar Turner-Trauring, Feb 2026 · slim versus Alpine and the rest (*headings only*) · fetched 2026-10-12
- **Our delta:** the missing-logs mystery (`PYTHONUNBUFFERED=1`; no fetched page mentions it) and a non-root user. Multi-stage background: [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), docs.docker.com.
- *Checked, not chosen:* [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/) — no multi-stage or slim text found.

### T13-03 · The performance model — Understand · 🔲 not written
- **Read this:** [All Pythons are slow, but some are faster than others](https://pythonspeed.com/articles/faster-python/) · pythonspeed.com, undated page · why Python is slow and which fast variants exist (*headings only*) · covers our angle: **partial** — no I/O-bound argument, no escape-hatch order · fetched 2026-10-12
- **Also good:** [The hidden performance overhead of Python C extensions](https://pythonspeed.com/articles/python-extension-performance/) · pythonspeed.com, undated page · Cython, Rust and the cost of crossing the boundary (*headings only*) · fetched 2026-10-12
- **Our delta:** boxed objects and dispatch explained, plus the ordered escape hatches. Avoid the [PythonSpeed/PerformanceTips](https://wiki.python.org/moin/PythonSpeed/PerformanceTips) wiki page: it mentions Python 2 nineteen times, so it is old.

### T13-04 · Profiling before optimizing — Understand · 🔲 not written
- **Read this:** [py-spy README](https://raw.githubusercontent.com/benfred/py-spy/master/README.md) · py-spy project (`github.com` itself returned 403, so this is the raw README) · sampling a running process without restart, flame graphs, dump (*headings only*) · covers our angle: **partial** — py-spy only · fetched 2026-10-12
- **Also good:** [profile and cProfile](https://docs.python.org/3/library/profile.html) · docs.python.org · the cProfile reference (*headings only*) · fetched 2026-10-12
- **Also good:** [SnakeViz](https://jiffyclub.github.io/snakeviz/) · project site · viewing cProfile output in a browser (*headings only*) · fetched 2026-10-12
- **Also good:** [timeit](https://docs.python.org/3/library/timeit.html) · docs.python.org · micro-benchmarks, command line included (*headings only*) · fetched 2026-10-12
- **Our delta:** the flame graph that indicts the ORM, and one workflow joining the four tools.

### T13-05 · Memory — Understand · 🔲 not written
- **Read this:** [tracemalloc](https://docs.python.org/3/library/tracemalloc.html) · docs.python.org · snapshots, `compare_to`, top allocation sites (*headings only*) · covers our angle: **partial** — tooling only, no refcounting story or usual suspects · fetched 2026-10-12
- **Also good:** [gc — Garbage Collector interface](https://docs.python.org/3/library/gc.html) · docs.python.org · the cycle collector's controls (*headings only*) · fetched 2026-10-12
- **Also good:** [Reference Counting (C API)](https://docs.python.org/3/c-api/refcounting.html) · docs.python.org · the refcount primitives, C-level (*headings only*) · fetched 2026-10-12
- **Our delta:** unbounded caches, lists that should be generators, and the limits of `sys.getsizeof`. The CPython devguide page on the garbage collector returned 404 at the URL I tried.

### T13-06 · Process management and graceful shutdown — Understand · 🔲 not written
- **Read this:** [Kubernetes best practices: terminating with grace](https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace) · Google Cloud blog, undated page · the SIGTERM, drain, exit sequence (*headings only*) · covers our angle: **partial** — not Python-specific · fetched 2026-10-12
- **Also good:** [Gunicorn design](https://gunicorn.org/design/) · gunicorn.org · worker types such as sync and gthread (*headings only*) · fetched 2026-10-12
- **Also good:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · kubernetes.io · the probe contract (*headings only*) · fetched 2026-10-12
- **Also good:** [Uvicorn deployment](https://uvicorn.dev/deployment/) · uvicorn.dev · workers and running under Gunicorn (*headings only*) · fetched 2026-10-12
- **Our delta:** a worker-count rule of thumb and SIGTERM handling inside Uvicorn; neither the Uvicorn nor FastAPI pages I checked mention SIGTERM by name.

### T13-07 · Security hygiene — Understand · 🔲 not written
- **Read this:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · OWASP · parameterized queries as the primary defence (*headings only*) · covers our angle: **partial** — generic, not Python · fetched 2026-10-12
- **Also good:** [secrets](https://docs.python.org/3/library/secrets.html) · docs.python.org · `token_urlsafe` and friends (*headings only*) · fetched 2026-10-12
- **Also good:** [pickle](https://docs.python.org/3/library/pickle.html) · docs.python.org · the security warning on untrusted data (*headings only*) · fetched 2026-10-12
- **Also good:** [pip-audit README](https://raw.githubusercontent.com/pypa/pip-audit/main/README.md) · PyPA (raw README; `github.com` gave 403) · auditing requirements and CI use (*headings only*) · fetched 2026-10-12
- **Our delta:** `yaml.safe_load` (the [PyYAML documentation](https://pyyaml.org/wiki/PyYAMLDocumentation) mentions `safe_load` twelve times, but I did not read the passage) and one checklist page for all five.

### T13-08 · Building a CLI — Understand · 🔲 not written
- **Read this:** [Argparse Tutorial](https://docs.python.org/3/howto/argparse.html) · docs.python.org · positional and optional arguments, help text (*headings only*) · covers our angle: **partial** — no subcommands found, no Typer/Click · fetched 2026-10-12
- **Also good:** [Typer](https://typer.tiangolo.com/) · Typer docs · type-hint-driven CLIs, subcommands, generated `--help` (*headings only*) · fetched 2026-10-12
- **Also good:** [Click](https://click.palletsprojects.com/en/stable/) · Click docs, 8.5.x · landing page only (*headings only*) · fetched 2026-10-12
- **Our delta:** exit-code conventions and when to leave argparse.

### T13-09 · Observability beyond logs — Know · 🔲 not written
- **Read this:** [Python zero-code instrumentation](https://opentelemetry.io/docs/zero-code/python/) · OpenTelemetry · the `opentelemetry-instrument` agent (*headings only*) · covers our angle: **partial** — I found no FastAPI, SQLAlchemy or httpx text on this page · fetched 2026-10-12
- **Also good:** [Sentry for Python](https://docs.sentry.io/platforms/python/) · Sentry docs · exception capture setup (*headings only*) · fetched 2026-10-12
- **Our delta:** the cross-layer trace FastAPI to SQLAlchemy to httpx. The [OpenTelemetry Python](https://opentelemetry.io/docs/languages/python/) landing page is the next click for instrumentation libraries.

### T13-10 · Caching in practice — Know · 🔲 not written
- **Read this:** [functools — lru_cache](https://docs.python.org/3/library/functools.html) · docs.python.org · `lru_cache` and `cache` for pure functions (*headings only*) · covers our angle: **partial** — nothing on Redis, TTLs or invalidation · fetched 2026-10-12
- **Also good:** [redis-py guide](https://redis.io/docs/latest/develop/clients/redis-py/) · redis.io · connecting and basic commands from Python (*headings only*) · fetched 2026-10-12
- **Our delta:** TTLs and invalidation as the hard part. A Redis cache-aside explainer I tried returned 404, and I found no other fetchable one.

### T13-11 · Scheduled and background work — Know · 🔲 not written
- **Read this:** [APScheduler 3.x user guide](https://apscheduler.readthedocs.io/en/3.x/userguide.html) · APScheduler docs, 3.11.3 · job stores, triggers, misfire handling (*headings only*) · covers our angle: **partial** — no cron-with-lock-file, no delivery-guarantee comparison · fetched 2026-10-12
- **Also good:** [Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) · FastAPI docs · in-process tasks and their limits (*headings only*) · fetched 2026-10-12
- **Our delta:** choosing by delivery guarantee, and lock files for cron scripts; no explainer on the latter was found.

### T13-12 · Upgrading Python — Know · 🔲 not written
- **Read this:** [What's new in Python 3.14](https://docs.python.org/3/whatsnew/3.14.html) · docs.python.org · the removal and deprecation sections for the current release (*headings only*) · covers our angle: **partial** — one release, not the method · fetched 2026-10-12
- **Also good:** [warnings](https://docs.python.org/3/library/warnings.html) · docs.python.org · `DeprecationWarning` and the `-W` flag (*headings only*) · fetched 2026-10-12
- **Also good:** [PEP 387 — Backwards Compatibility Policy](https://peps.python.org/pep-0387/) · peps.python.org · how long deprecations last (*headings only*) · fetched 2026-10-12
- **Our delta:** treating warnings as a to-do list and a staged rollout over the test matrix.
