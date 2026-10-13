---
title: "Link map · Python · Part 7 (phases 12–13)"
sidebar_label: "07 · testing and production"
sidebar_position: 7
---

# Link map · Python · Part 7 (phases 12–13)

Covers every topic row of `docs/python/syllabus/04-production.md` in phase 12 (T12-01 to T12-12, testing with pytest) and phase 13 (T13-01 to T13-12, production and performance). That is 24 rows. None has a written page yet (`docs/python/pages/` holds phases 0–3 and 7 only), so every block reads 🔲 not written.
*read* = I read the passage the block cites (fetched text, checked for the specific claim); *headings only* = fetched, page title, headings and size checked, but the claim itself not read. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Search limit.** The web-search budget for this run was used up before any topic could be searched, in both the research pass and the verification pass (every WebSearch call was refused). No topic has had its mandatory search, and the 15-block spot-check by search could not be run. Every **Beyond the docs** line below comes from a page already known and fetched directly; a topic with no such line was not searched, which is not the same as "no good page exists". Re-run the search pass for those topics. Real Python (realpython.com) answers 403 to both fetch routes, so no Real Python page is linked. PyPI pages (`py-spy`, `pip-audit`) answer 200 but serve a JavaScript "Client Challenge" page, not content, so they are replaced by the projects' GitHub pages (read through the fetch tool).

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). The docs.python.org pages below were fetched at the `3.14` path on 2026-10-13. pytest, FastAPI, Hypothesis and the other library docs are the `stable` or `latest` builds, so they move without notice (pytest docs show 9.x output, pytest-asyncio 1.4.0, pytest-cov 7.1.0, structlog 26.1.0 on 2026-10-13). Older third-party pages predate this: the Fowler (2011) and Batchelder (2007, 2019) posts are about ideas that have not changed, but the code in them may be dated. The pytest-asyncio and FastAPI async-test pages change often; check the version shown on the page.

---

## Phase 12 — Testing with pytest

### T12-01 · pytest fundamentals: discovery, assert, subsets, `-x`/`--lf` — Master · 🔲 not written
- **Read this:** [Get Started](https://docs.pytest.org/en/stable/getting-started.html) · docs.pytest.org · first test, plain `assert`, running tests (*read*) · covers our angle: **partial** — a start page; selecting by `-k` and node ID is on the usage page, `--lf` on the cache page · fetched 2026-10-13
- **Also good:** [How to invoke pytest](https://docs.pytest.org/en/stable/how-to/usage.html) · docs.pytest.org · run a module, a directory, `-k` keyword expressions, `::` node IDs (*read*) · [How to re-run failed tests and maintain state between test runs](https://docs.pytest.org/en/stable/how-to/cache.html) · docs.pytest.org · `--lf` and `--ff` (*read*) · [How to handle test failures](https://docs.pytest.org/en/stable/how-to/failures.html) · docs.pytest.org · stopping early with `-x` (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Pytest for Beginners](https://testdriven.io/blog/pytest-for-beginners/) · Špela Giacomelli, TestDriven.io, last updated 2022-09-28 · test organization and naming, then running a package, a class, one test, by keyword, with `--lf` and `-x` explained in the flags section, on a small FastAPI app; 2022, so check flags against the current docs · fetched 2026-10-13 (*read*)
- **Our delta:** the daily loop as a unit (`-x --lf`, then `-k`), and why assert rewriting gives the failure diff.

### T12-02 · Fixtures: scopes, `yield`, `conftest.py` — Master · 🔲 not written
- **Read this:** [How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) · docs.pytest.org · request by argument name, scopes, yield teardown, `conftest.py` sharing (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [About fixtures](https://docs.pytest.org/en/stable/explanation/fixtures.html) · docs.pytest.org · the explanation page: "Improvements over xUnit-style setup/teardown functions", fixtures that use other fixtures (*read*) · fetched 2026-10-13
- **Our delta:** fixture scope versus test isolation (a session-scoped DB handle that tests then mutate).

### T12-03 · `parametrize` — Understand · 🔲 not written
- **Read this:** [How to parametrize fixtures and test functions](https://docs.pytest.org/en/stable/how-to/parametrize.html) · docs.pytest.org · `@pytest.mark.parametrize`, stacking, `pytest_generate_tests` (*read*) · covers our angle: **partial** — the short how-to; the `ids` options are on the examples page below · fetched 2026-10-13
- **Also good:** [Parametrizing tests](https://docs.pytest.org/en/stable/example/parametrize.html) · docs.pytest.org · "Different options for test IDs": `ids=` lists, `--collect-only` to see generated IDs (*read*) · fetched 2026-10-13
- **Our delta:** readable ids so a failure names the row. (Not searched; see the search note above.)

### T12-04 · Mocking and where to patch — Master · 🔲 not written
- **Read this:** [unittest.mock](https://docs.python.org/3.14/library/unittest.mock.html) · docs.python.org · has a "Where to patch" section and `autospec` (*read*) · covers our angle: **partial** — a reference, not the "boundaries only" discipline · fetched 2026-10-13
- **Also good:** [unittest.mock examples](https://docs.python.org/3.14/library/unittest.mock-examples.html) · docs.python.org · worked patterns (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Why your mock doesn't work](https://nedbatchelder.com/blog/201908/why_your_mock_doesnt_work) · Ned Batchelder, 2019-08-02 · "mock the object where it is used, not where it is defined", with a worked example where `from os import listdir` means the test must patch `product.listdir`, not `os.listdir`; also warns that mocking is easy to over-use · fetched 2026-10-13 (*read*)
- **Our delta:** `autospec=True` so refactors break tests loudly, and mocking only at boundaries.

### T12-05 · Built-in fixtures: `tmp_path`, `monkeypatch`, `capsys`, `caplog` — Understand · 🔲 not written
- **Read this:** [How to monkeypatch/mock modules and environments](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) · docs.pytest.org · `setenv`, `setattr`, `setitem`, with automatic undo (*read*) · covers our angle: **partial** — one of four fixtures · fetched 2026-10-13
- **Also good:** [How to use temporary directories and files](https://docs.pytest.org/en/stable/how-to/tmp_path.html) · docs.pytest.org · `tmp_path` (*read*) · [How to capture stdout/stderr output](https://docs.pytest.org/en/stable/how-to/capture-stdout-stderr.html) · docs.pytest.org · `capsys` (*read*) · [How to manage logging](https://docs.pytest.org/en/stable/how-to/logging.html) · docs.pytest.org · `caplog` (*read*) · fetched 2026-10-13
- **Our delta:** one page that ties the four together as "no hand-rolled temp dirs or env juggling".

### T12-06 · Testing async code and FastAPI — Understand · 🔲 not written
- **Read this:** [Testing](https://fastapi.tiangolo.com/tutorial/testing/) · FastAPI · `TestClient` (*read*) · covers our angle: **partial** — sync client only · fetched 2026-10-13
- **Also good:** [Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/) · FastAPI · `AsyncClient` with anyio (*read*) · [Testing Dependencies with Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) · FastAPI · `dependency_overrides` (*read*) · [pytest-asyncio](https://pytest-asyncio.readthedocs.io/en/stable/) · pytest-asyncio docs · plugin that runs coroutine tests; the landing page only, its concepts and how-to sections cover fixtures and loop scopes (*headings only*) · fetched 2026-10-13
- **Our delta:** choosing pytest-asyncio or anyio once, and clearing overrides after each test.

### T12-07 · Real dependencies versus doubles (Testcontainers Postgres) — Understand · 🔲 not written
- **Read this:** [testcontainers-python](https://testcontainers-python.readthedocs.io/en/latest/) · Testcontainers docs · Postgres container module (*headings only*) · covers our angle: **partial** — the mechanism, not the "passed on SQLite, failed on Postgres" argument · fetched 2026-10-13
- **Our delta:** the argument for a real engine in the data-layer suite. (Not searched; see the search note above.)

### T12-08 · Test structure and flaky-test taxonomy — Understand · 🔲 not written
- **Read this:** [Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html) · docs.pytest.org · root causes (uncontrolled system state, test-order reliance, overly strict assertions, threads), then `pytest-randomly` and `pytest-random-order` to expose order problems and `pytest-rerunfailures` to mitigate (*read*) · covers our angle: **partial** — no clock or network section · fetched 2026-10-13
- **Also good:** [About fixtures and test anatomy](https://docs.pytest.org/en/stable/explanation/anatomy.html) · docs.pytest.org · Arrange, Act, Assert, Cleanup (*read*) · [factory_boy](https://factoryboy.readthedocs.io/en/stable/) · factory_boy docs · factories for model setup (*headings only*) · [Flaky Tests at Google and How We Mitigate Them](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) · John Micco, Google Testing Blog, 2016-05-27 · defines a flaky result as both pass and fail on the same code, lists causes such as concurrency and infrastructure, and quarantine as a mitigation (*read* the opening) · fetched 2026-10-13
- **Beyond the docs:** [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html) · Martin Fowler, 2011-04-14 · names lack of isolation, asynchronous behavior, remote services, time and resource leaks as causes; fixes include never using bare sleeps (use a callback, or poll with a timeout) and controlling the clock; language-neutral, and has no cause called "order" (isolation is the closest) · fetched 2026-10-13 (*read*)
- **Our delta:** the Python fixes: `freezegun`-style clock injection, `pytest-randomly` for order, no network in unit tests.

### T12-09 · Coverage with `coverage.py` / pytest-cov — Know · 🔲 not written
- **Read this:** [Branch coverage measurement](https://coverage.readthedocs.io/en/latest/branch.html) · coverage.py docs · what branch measurement adds over line coverage, partial branches (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [pytest-cov](https://pytest-cov.readthedocs.io/en/latest/) · pytest-cov docs · landing page with the table of contents (Configuration, Reporting, xdist); the `--cov-branch` flag is not on this page, look in its Configuration and Reporting sections (*headings only*) · [How coverage.py works](https://coverage.readthedocs.io/en/latest/howitworks.html) · coverage.py docs · lines that ran versus lines that could have run, branches as arcs (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Flaws in coverage measurement](https://nedbatchelder.com/blog/200710/flaws_in_coverage_measurement) · Ned Batchelder (coverage.py maintainer), 2007-10-30 · statement coverage shows which lines ran, so 100% cannot prove every path combination or data case was tested, and shows a "sort" test that never checks the list is sorted; the page itself says it is 19 years old, so it predates today's branch measurement · fetched 2026-10-13 (*read*)
- **Our delta:** the number as a floor, not a target.

### T12-10 · Hypothesis and property-based testing — Know · 🔲 not written
- **Read this:** [Quickstart](https://hypothesis.readthedocs.io/en/latest/quickstart.html) · Hypothesis docs · first property test with `@given` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [What is Hypothesis?](https://hypothesis.works/articles/what-is-hypothesis/) · David R. MacIver, 2016-07-24 · property-based versus example-based tests, strategies, and a local database that saves failing examples so a rerun tries them first (*read*) · fetched 2026-10-13
- **Our delta:** the round-trip property as the first property to write.

### T12-11 · Multi-version test matrices: tox / nox — Know · 🔲 not written
- **Read this:** [tox](https://tox.wiki/en/latest/) · tox docs · environments per Python version (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [nox](https://nox.thea.codes/en/stable/) · nox docs · sessions written in Python (*headings only*) · fetched 2026-10-13
- **Our delta:** when an application does not need a matrix at all. (Not searched; see the search note above.)

### T12-12 · Doctests — When Needed · 🔲 not written
- **Read this:** [doctest](https://docs.python.org/3.14/library/doctest.html) · docs.python.org · examples in docstrings, `testmod`, the `ELLIPSIS` and `NORMALIZE_WHITESPACE` option flags (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [How to run doctests](https://docs.pytest.org/en/stable/how-to/doctest.html) · docs.pytest.org · `--doctest-modules` (*read*) · fetched 2026-10-13
- **Our delta:** running doctests under pytest in CI, so examples cannot rot.

---

## Phase 13 — Production and performance

### T13-01 · `logging` done right and structured logs — Master · 🔲 not written
- **Read this:** [Logging HOWTO](https://docs.python.org/3.14/howto/logging.html) · docs.python.org · loggers, handlers, formatters, levels, `getLogger(__name__)` (*read*) · covers our angle: **partial** — no JSON logs or request ids · fetched 2026-10-13
- **Also good:** [Logging Cookbook](https://docs.python.org/3.14/howto/logging-cookbook.html) · docs.python.org · "Implementing structured logging" and "Adding contextual information to your logging output" (*read*) · [Logging Best Practices](https://www.structlog.org/en/stable/logging-best-practices.html) · structlog docs · log to unbuffered standard out and let other tools handle the rest; canonical log lines (*read* the opening) · fetched 2026-10-13
- **Beyond the docs:** [Why structlog?](https://www.structlog.org/en/stable/why.html) · structlog docs · argues for logging events as key-value context instead of prose strings, which fits JSON logs with request ids · fetched 2026-10-13 (*read*)
- **Our delta:** configure once at the entrypoint, `getLogger(__name__)`, `logger.exception`, never `print`.

### T13-02 · Deploying in a container — Master · 🔲 not written
- **Read this:** [Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/) · Astral docs · `uv sync --frozen` / `--locked` with `--no-install-project` and layer caching (*read*) · covers our angle: **partial** — no `PYTHONUNBUFFERED`, and no non-root user text · fetched 2026-10-13
- **Also good:** [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/) · FastAPI docs · Dockerfile from a `python:3.14` base, the process-count question, a "Docker Image with uv" section; does not say "slim" (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Production-ready Python Docker Containers with uv](https://hynek.me/articles/docker-uv/) · Hynek Schlawack, published 2024-08-28, updated 2026-08-06 · multi-stage build: install dependencies first with `uv sync --no-install-project` for caching, copy only the pre-built virtualenv into the runtime image, and run as a non-root `app` user; does not mention `PYTHONUNBUFFERED` · fetched 2026-10-13 (*read*)
- **Also good:** [The best Docker base image for your Python application](https://pythonspeed.com/articles/base-image-python-docker-images/) · Itamar Turner-Trauring, pythonspeed, last updated 2026-02-04, created 2026-01-30 · base image choice, including installing Python with uv on any base (*read* the opening) · fetched 2026-10-13
- **Our delta:** `PYTHONUNBUFFERED=1` and the missing-logs mystery.

### T13-03 · The performance model — Understand · 🔲 not written
- **Read this:** [Why Python is Slow: Looking Under the Hood](https://jakevdp.github.io/blog/2014/05/09/why-python-is-slow/) · Jake VanderPlas, 2014-05-09 · Python is dynamically typed and interpreted, and values are stored in scattered objects rather than dense buffers, which is why NumPy and compiled code help (*read* the opening) · covers our angle: **partial** — 2014, numerical focus, no mention of the 3.11+ specializing interpreter or the 3.13 JIT · fetched 2026-10-13
- **Also good:** [What's New In Python 3.11](https://docs.python.org/3.14/whatsnew/3.11.html) · docs.python.org · Faster CPython: "PEP 659: Specializing Adaptive Interpreter" and an FAQ on how to write code to use the speedups (*read* the contents) · fetched 2026-10-13
- **Our delta:** why it usually does not matter in an I/O-bound service, and the escape-hatch order. (Not searched; see the search note above.)

### T13-04 · Profiling before optimizing — Understand · 🔲 not written
- **Read this:** [The Python Profilers](https://docs.python.org/3.14/library/profile.html) · docs.python.org · cProfile, pstats, deterministic profiling and its limitations (*read*) · covers our angle: **partial** — no snakeviz or flame graphs · fetched 2026-10-13
- **Also good:** [timeit](https://docs.python.org/3.14/library/timeit.html) · docs.python.org · micro-benchmarks (*headings only*) · [py-spy](https://github.com/benfred/py-spy) · GitHub · Rust sampling profiler that attaches to a running process by PID without restarting it, `py-spy record` writes a flame graph SVG; attaching to a process you did not start usually needs root on Linux (*read* via the fetch tool; curl answers 403) · [Beyond cProfile: Choosing a Python performance profiler](https://pythonspeed.com/articles/beyond-cprofile/) · Itamar Turner-Trauring, pythonspeed, last updated 2021-10-01, created 2019-10-17 · deterministic cProfile versus sampling profilers, and when to choose which (*read* the opening) · fetched 2026-10-13
- **Beyond the docs:** [An awesome new Python profiler: py-spy!](https://jvns.ca/blog/2018/09/08/an-awesome-new-python-profiler--py-spy-/) · Julia Evans, 2018-09-08 · py-spy profiles any already-running program by reading its memory, shown with a top-style display; 2018, so flags may have changed · fetched 2026-10-13 (*read*)
- **Our delta:** the order: metrics and logs, then py-spy on the live process, then the DB query log.

### T13-05 · Memory: refcounting, GC, `tracemalloc` — Understand · 🔲 not written
- **Read this:** [tracemalloc](https://docs.python.org/3.14/library/tracemalloc.html) · docs.python.org · snapshots (`take_snapshot`) and top allocation sites (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [gc](https://docs.python.org/3.14/library/gc.html) · docs.python.org · the cycle collector (*read*) · [sys](https://docs.python.org/3.14/library/sys.html) · docs.python.org · `getsizeof` counts only the object itself, "not the memory consumption of objects it refers to" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Measuring memory usage in Python: it's tricky!](https://pythonspeed.com/articles/measuring-memory-python/) · Itamar Turner-Trauring, pythonspeed, last updated 2026-02-25, created 2021-06-21 · resident versus allocated memory and why they disagree (swapping, memory that is never touched); does not mention `tracemalloc`, and does not cover refcounting or the GC · fetched 2026-10-13 (*read* the opening and the allocated-versus-resident section)
- **Our delta:** the usual suspects: unbounded caches, lists that should be generators. (Not searched; see the search note above.)

### T13-06 · Process management: workers, graceful shutdown, probes — Understand · 🔲 not written
- **Read this:** [Gunicorn design](https://gunicorn.org/design/) · Gunicorn docs · pre-fork worker model; "workers = (2 × CPU cores) + 1" as a starting point, with 4–12 workers usually enough (*read*) · covers our angle: **partial** — SIGTERM handling is on the signals page below · fetched 2026-10-13
- **Also good:** [Gunicorn signals](https://gunicorn.org/signals/) · Gunicorn docs · `TERM` on the master is a graceful shutdown that waits for workers up to `graceful_timeout` (*read* via the fetch tool) · [Uvicorn deployment](https://uvicorn.dev/deployment/) · Uvicorn docs · workers, Gunicorn as process manager, `SIGHUP` graceful restart (*read*) · [Liveness, readiness and startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · Kubernetes docs · (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Configuring Gunicorn for Docker](https://pythonspeed.com/articles/gunicorn-in-docker/) · Itamar Turner-Trauring, pythonspeed, last updated 2025-01-17, created 2019-05-20 · with one worker stuck on a slow query the heartbeat query times out and the load balancer may decide the container is stuck and stop sending it traffic (in some environments it is restarted); start at least two workers plus threads with the gthread class; also log to stdout with `--log-file=-` · fetched 2026-10-13 (*read*)
- **Our delta:** SIGTERM, drain, exit as one contract.

### T13-07 · Security hygiene — Understand · 🔲 not written
- **Read this:** [secrets](https://docs.python.org/3.14/library/secrets.html) · docs.python.org · `token_urlsafe` and `compare_digest` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [pickle](https://docs.python.org/3.14/library/pickle.html) · docs.python.org · the warning against unpickling untrusted data (*read*) · [pip-audit](https://github.com/pypa/pip-audit) · GitHub (pypa) · scans environments and requirements files for known vulnerabilities, with an official GitHub Action for CI (*read* via the fetch tool; curl answers 403) · [PyYAML documentation](https://pyyaml.org/wiki/PyYAMLDocumentation) · pyyaml.org · `safe_load` (*read*) · [sqlite3](https://docs.python.org/3.14/library/sqlite3.html) · docs.python.org · placeholders for parameterized SQL (*read*) · fetched 2026-10-13
- **Our delta:** one checklist; the driver for our stack is Postgres, so the SQL example differs. (Not searched.)

### T13-08 · Building a CLI: argparse, Typer / Click — Understand · 🔲 not written
- **Read this:** [Argparse Tutorial](https://docs.python.org/3.14/howto/argparse.html) · docs.python.org · positional and optional arguments, help text (*read*) · covers our angle: **partial** — no exit-code guidance · fetched 2026-10-13
- **Also good:** [Typer](https://typer.tiangolo.com/) · Typer docs · (*headings only*) · [Click](https://click.palletsprojects.com/en/stable/) · Click docs · (*headings only*) · [Why Click?](https://click.palletsprojects.com/en/stable/why/) · Click docs · why Click has its own parser instead of building on argparse: argparse "does not allow proper nesting of commands by design" (*read* via the fetch tool) · fetched 2026-10-13
- **Our delta:** exit codes and a `--help` that helps. (Not searched.)

### T13-09 · Observability: OpenTelemetry, Sentry — Know · 🔲 not written
- **Read this:** [OpenTelemetry Python zero-code instrumentation](https://opentelemetry.io/docs/zero-code/python/) · OpenTelemetry docs · `opentelemetry-distro` and `opentelemetry-instrument` auto-instrumentation (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Sentry for FastAPI](https://docs.sentry.io/platforms/python/integrations/fastapi/) · Sentry docs · `sentry_sdk.init` for FastAPI (*read*) · [OpenTelemetry for Python](https://opentelemetry.io/docs/languages/python/) · OpenTelemetry docs · (*headings only*) · fetched 2026-10-13
- **Our delta:** one request traced across FastAPI, SQLAlchemy and httpx. (Not searched.)

### T13-10 · Caching in practice — Know · 🔲 not written
- **Read this:** [functools (`lru_cache`)](https://docs.python.org/3.14/library/functools.html) · docs.python.org · `lru_cache` and `cache` (*read*) · covers our angle: **partial** — nothing on Redis, TTLs or invalidation · fetched 2026-10-13
- **Our delta:** TTLs and invalidation as the hard part. (Not searched.)

### T13-11 · Scheduled and background work — Know · 🔲 not written
- **Read this:** [APScheduler 3.x](https://apscheduler.readthedocs.io/en/3.x/) · APScheduler docs · the 3.x line, docs version 3.11.3.post3; PyPI lists 3.11.3 as the current release and only 4.0.0 alphas beyond it (checked through the PyPI JSON API), so 3.x is the stable line on 2026-10-13 (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** choosing by delivery guarantee. (Not searched.)

### T13-12 · Upgrading Python — Know · 🔲 not written
- **Read this:** [What's New In Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html) · docs.python.org · (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [warnings](https://docs.python.org/3.14/library/warnings.html) · docs.python.org · turning warnings into errors with `-W error` (*read*) · [PEP 387](https://peps.python.org/pep-0387/) · peps.python.org · backwards compatibility policy and deprecation periods (*headings only*) · fetched 2026-10-13
- **Our delta:** deprecation warnings as a to-do list and a staged rollout. (Not searched.)
