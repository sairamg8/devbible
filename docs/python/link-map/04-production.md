---
title: "Link map · Python · Part 4"
sidebar_label: "04 · Production"
sidebar_position: 4
---

# Link map · Python · Part 4 (phases 12–13)

Covers every topic row of `docs/python/syllabus/04-production.md`: T12-01 to T12-12 (phase 12, pytest) and T13-01 to T13-12 (phase 13, production and performance). That is 24 rows, numbered in table order.

*read* = I read the passage that backs the claim. *headings only* = fetched with HTTP 200, title and section headings checked, passage not read. Third-party links carry a date where the page shows one; undated means the page shows none. No `#anchors` are given. Every link was fetched on 2026-10-12 and answered 200.

🔴 **Version note.** Python 3.15 was released on 9 October 2026 (per its What's New page), and docs.python.org now serves 3.15.0 at `/3/`. Two consequences for this part: `/3/library/profile.html` is now the page for the **deprecated** pure-Python `profile` module (removal in 3.17), so profiling links go to the new `profiling` package instead; and the current What's New is 3.15, not 3.14. Our syllabus still calls 3.14 current. Tool versions seen: pytest-asyncio 1.4.0, AnyIO 4.15.1, coverage.py 7.16.2, pytest-cov 7.1.0, Hypothesis 6.169.0, Nox 2026.8.17, testcontainers-python 2.0.0, Click 8.5.x. The APScheduler page is the 3.x guide (3.11.3), not 4.x.

**Fetch caveats.** `github.com` and `realpython.com` answer 403, and `pypi.org` serves a challenge page; none of them is used. py-spy and pip-audit are cited through their `raw.githubusercontent.com` README. No page of ours exists yet for phases 12–13 (`docs/python/pages` holds phases 0–3 and 7 only), so every row is 🔲.

---

## Phase 12 — Testing with pytest

### T12-01 · pytest fundamentals — Master · 🔲 not written
- **Read this:** [Get Started](https://docs.pytest.org/en/stable/getting-started.html) · docs.pytest.org · first test with a plain `assert`, the `test_*.py` discovery rule, grouping tests in a class (*read*) · covers our angle: **partial** — no selection or rerun flags · fetched 2026-10-12
- **Also good:** [How to invoke pytest](https://docs.pytest.org/en/stable/how-to/usage.html) · docs.pytest.org · "Specifying which tests to run": `-k` keyword expressions and `::` node ids (*read*) · fetched 2026-10-12
- **Also good:** [How to re-run failed tests](https://docs.pytest.org/en/stable/how-to/cache.html) · docs.pytest.org · `--lf` / `--last-failed` reruns only the failures, `--ff` runs them first (*read*) · fetched 2026-10-12
- **Also good:** [How to handle test failures](https://docs.pytest.org/en/stable/how-to/failures.html) · docs.pytest.org · `-x` stops at the first failure, `--maxfail` after N (*read*) · fetched 2026-10-12
- **Also good:** [How to write and report assertions](https://docs.pytest.org/en/stable/how-to/assert.html) · docs.pytest.org · assertion introspection (*headings only*) · fetched 2026-10-12
- **Our delta:** the daily loop (`-x`, `--lf`, `-k`) in one place; upstream spreads it over three pages.

### T12-02 · Fixtures — Master · 🔲 not written
- **Read this:** [How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) · docs.pytest.org · requesting fixtures by argument name, autouse, scopes, yield teardown, conftest-level overrides, factories as fixtures (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [About fixtures](https://docs.pytest.org/en/stable/explanation/fixtures.html) · docs.pytest.org · the why, and the improvements over xUnit setup/teardown (*headings only*) · fetched 2026-10-12

### T12-03 · `parametrize` — Understand · 🔲 not written
- **Read this:** [How to parametrize fixtures and test functions](https://docs.pytest.org/en/stable/how-to/parametrize.html) · docs.pytest.org · the mark, parametrized fixtures, and "stack parametrize decorators" to get all combinations (*read*) · covers our angle: **partial** — no `ids=` here · fetched 2026-10-12
- **Also good:** [Parametrizing tests (examples)](https://docs.pytest.org/en/stable/example/parametrize.html) · docs.pytest.org · "Different options for test IDs": `ids=` as a list, `ids=` as a function, and `pytest.param(..., id=...)` (*read*) · fetched 2026-10-12
- **Our delta:** readable failure ids and grids, shown with our own example.

### T12-04 · Mocking and where to patch — Master · 🔲 not written
- **Read this:** [unittest.mock — where to patch](https://docs.python.org/3/library/unittest.mock.html) · docs.python.org · "Where to patch": patch the name where it is looked up, not where it is defined; autospec covered elsewhere on the page (*read*) · covers our angle: **partial** — no "mock boundaries only" discipline, no `mocker` · fetched 2026-10-12
- **Also good:** [Why your mock doesn't work](https://nedbatchelder.com/blog/201908/why_your_mock_doesnt_work.html) · Ned Batchelder, Aug 2019 · names versus values, then patching the wrong name; links to "stop mocking" alternatives (*read*) · fetched 2026-10-12
- **Also good:** [pytest-mock usage](https://pytest-mock.readthedocs.io/en/latest/usage.html) · pytest-mock docs · the `mocker` fixture has the same API as `mock.patch`, supporting the same arguments (*read*) · fetched 2026-10-12
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Martin Fowler, 2 Jan 2007 · the vocabulary of test doubles (*headings only*) · fetched 2026-10-12
- **Our delta:** the discipline of mocking only at boundaries.

### T12-05 · Built-in fixtures: `tmp_path`, `monkeypatch`, `capsys`, `caplog` — Understand · 🔲 not written
- **Read this:** [How to monkeypatch/mock modules and environments](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) · docs.pytest.org · functions, environment variables and dictionaries (*headings only*) · covers our angle: **partial** — one of four fixtures · fetched 2026-10-12
- **Also good:** [How to use temporary directories and files](https://docs.pytest.org/en/stable/how-to/tmp_path.html) · docs.pytest.org · `tmp_path` and retention (*headings only*) · fetched 2026-10-12
- **Also good:** [How to capture stdout/stderr output](https://docs.pytest.org/en/stable/how-to/capture-stdout-stderr.html) · docs.pytest.org · accessing captured output from a test (*headings only*) · fetched 2026-10-12
- **Also good:** [How to manage logging](https://docs.pytest.org/en/stable/how-to/logging.html) · docs.pytest.org · the `caplog` fixture section (*headings only*) · fetched 2026-10-12
- **Our delta:** one page tying the four together as "no hand-rolled temp dirs or env juggling".

### T12-06 · Testing async code and FastAPI — Understand · 🔲 not written
- **Read this:** [Testing Dependencies with Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) · FastAPI docs · `app.dependency_overrides` in tests (*headings only*) · covers our angle: **partial** — the override half · fetched 2026-10-12
- **Also good:** [Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/) · FastAPI docs · `AsyncClient` with the anyio marker (*headings only*) · fetched 2026-10-12
- **Also good:** [Testing with AnyIO](https://anyio.readthedocs.io/en/stable/testing.html) · AnyIO docs · marking async tests three ways, the clash with pytest-asyncio's auto mode, async fixtures (*read*) · fetched 2026-10-12
- **Also good:** [pytest-asyncio Concepts](https://pytest-asyncio.readthedocs.io/en/stable/concepts.html) · pytest-asyncio 1.4.0 · one event loop per collector, narrowest by default, widened with `loop_scope` (*read*) · fetched 2026-10-12
- *Checked, not chosen:* [Testing](https://fastapi.tiangolo.com/tutorial/testing/), the FastAPI `TestClient` entry point.
- **Our delta:** choosing between the anyio and pytest-asyncio routes in one suite.

### T12-07 · Real dependencies vs doubles (Testcontainers Postgres) — Understand · 🔲 not written
- **Read this:** [Getting started with Testcontainers for Python](https://testcontainers.com/guides/getting-started-with-testcontainers-for-python/) · testcontainers.com · a pytest suite against `PostgresContainer("postgres:16-alpine")` (*read*) · covers our angle: **partial** — no SQLite comparison anywhere on it · fetched 2026-10-12
- **Also good:** [testcontainers-python](https://testcontainers-python.readthedocs.io/en/latest/) · project docs, v2.0.0 · the module reference (*headings only*) · fetched 2026-10-12
- **Our delta:** the SQLite-vs-Postgres divergence list and when a double is the right call.

### T12-08 · Test structure that scales: AAA, factories, flaky tests — Understand · 🔲 not written
- **Read this:** [Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html) · docs.pytest.org · root causes: uncontrolled system state, test-order dependence under xdist, overly strict assertions (floats, timing), threads (*read*) · covers our angle: **partial** — no network category, no factories · fetched 2026-10-12
- **Also good:** [Anatomy of a test](https://docs.pytest.org/en/stable/explanation/anatomy.html) · docs.pytest.org · arrange, act, assert, cleanup (*read*) · fetched 2026-10-12
- **Also good:** [factory_boy introduction](https://factoryboy.readthedocs.io/en/stable/introduction.html) · factory_boy docs · a default way to get a new instance while overriding fields per call (*read*) · fetched 2026-10-12
- **Also good:** [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) · Ham Vocke on martinfowler.com, 26 Feb 2018 · what to test at which level; flakiness comes up under end-to-end tests (*headings only*) · fetched 2026-10-12
- **Our delta:** builders versus fixtures-as-factories (the fixtures page has a "Factories as fixtures" section), and a fix per flaky class.

### T12-09 · Coverage — Know · 🔲 not written
- **Read this:** [Branch coverage measurement](https://coverage.readthedocs.io/en/latest/branch.html) · coverage.py 7.16.2 · an `if` never taken false shows 100% statement coverage but a missing branch (*read*) · covers our angle: **partial** — nothing on what coverage cannot prove · fetched 2026-10-12
- **Also good:** [pytest-cov configuration](https://pytest-cov.readthedocs.io/en/latest/config.html) · pytest-cov 7.1.0 · `--cov`, `--cov-report`, `--cov-fail-under MIN`, `--cov-branch` (*read*) · fetched 2026-10-12
- **Our delta:** the number as a floor and the limits of coverage.

### T12-10 · Hypothesis — Know · 🔲 not written
- **Read this:** [Quickstart](https://hypothesis.readthedocs.io/en/latest/quickstart.html) · Hypothesis 6.169.0 · `given` and strategies, a first property test (*headings only*) · covers our angle: **partial** — no round-trip example · fetched 2026-10-12
- **Also good:** [Introduction to Hypothesis](https://hypothesis.readthedocs.io/en/latest/tutorial/introduction.html) · Hypothesis docs · tests a selection sort, then advises looking for round-trip properties such as encode/decode first (*read*) · fetched 2026-10-12
- **Our delta:** the encoder round-trip worked end to end, and the surrogate-pair bug it finds.

### T12-11 · Multi-version test matrices (tox/nox) — Know · 🔲 not written
- **Read this:** [Nox tutorial](https://nox.thea.codes/en/stable/tutorial.html) · Nox 2026.8.17 · "Testing against different and multiple Pythons", plus `nox.parametrize` (*read*) · covers our angle: **partial** — nox only · fetched 2026-10-12
- **Also good:** [Building and testing Python](https://docs.github.com/en/actions/tutorials/build-and-test-code/python) · GitHub Docs · a job `matrix` over `python-version` (*read*) · fetched 2026-10-12
- **Also good:** [tox](https://tox.wiki/en/latest/) · tox docs · landing page: run the tests under different Python versions and implementations (*read*) · fetched 2026-10-12
- **Our delta:** libraries-versus-apps judgement on how wide the matrix should be.

### T12-12 · Doctests — When Needed · 🔲 not written
- **Read this:** [doctest — Test interactive Python examples](https://docs.python.org/3/library/doctest.html) · docs.python.org · the reference and usage patterns (*headings only*) · covers our angle: full · fetched 2026-10-12

---

## Phase 13 — Production and performance

### T13-01 · `logging` done right — Master · 🔲 not written
- **Read this:** [Logging HOWTO](https://docs.python.org/3/howto/logging.html) · docs.python.org · loggers, handlers, formatters, levels, `logging.getLogger(__name__)` (*headings only*) · covers our angle: **partial** — no structured JSON, no request ids · fetched 2026-10-12
- **Also good:** [Logging Cookbook](https://docs.python.org/3/howto/logging-cookbook.html) · docs.python.org · "Use of contextvars" for per-request context and "Implementing structured logging" with JSON (*read*) · fetched 2026-10-12
- **Also good:** [10 Best Practices for Logging in Python](https://betterstack.com/community/guides/logging/python/python-logging-best-practices/) · Better Stack, updated 20 Jan 2026 · avoid the root logger, centralise config, JSON via python-json-logger; vendor article (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [structlog — Why](https://www.structlog.org/en/stable/why.html), a library pitch rather than an explanation.
- **Our delta:** configure once at the entrypoint, and "never print in a service".

### T13-02 · Deploying in a container — Master · 🔲 not written
- **Read this:** [Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/) · uv docs · `--frozen`, the cache mount, intermediate layers, bytecode compilation (*headings only*) · covers our angle: **partial** — no non-root or unbuffered-output text · fetched 2026-10-12
- **Also good:** [Production-ready Python Docker Containers with uv](https://hynek.me/articles/docker-uv/) · Hynek Schlawack, last revised 2026-08-06 · multi-stage uv build whose runtime stage runs as a non-root `useradd` user (*read*) · fetched 2026-10-12
- **Also good:** [The best Docker base image for your Python application (February 2026)](https://pythonspeed.com/articles/base-image-python-docker-images/) · Itamar Turner-Trauring, updated 4 Feb 2026 · why not Alpine, and what to use instead (*read*) · fetched 2026-10-12
- **Also good:** [Command line and environment](https://docs.python.org/3/using/cmdline.html) · docs.python.org · `PYTHONUNBUFFERED` is equivalent to `-u`, which forces stdout and stderr unbuffered (*read*) · fetched 2026-10-12
- **Our delta:** the missing-logs mystery as a story. Multi-stage background: [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), docs.docker.com.
- *Checked, not chosen:* [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/) — no multi-stage or slim text found.

### T13-03 · The performance model — Understand · 🔲 not written
- **Read this:** [Why Python is Slow: Looking Under the Hood](https://jakevdp.github.io/blog/2014/05/09/why-python-is-slow/) · Jake VanderPlas, May 2014 (Python 3.4) · dynamic typing, interpretation, and values as scattered `PyObject`s rather than dense buffers (*read*) · covers our angle: **partial** — old, and no I/O-bound argument or escape-hatch order · fetched 2026-10-12
- **Also good:** [The hidden performance overhead of Python C extensions](https://pythonspeed.com/articles/python-extension-performance/) · Itamar Turner-Trauring, updated 6 Jan 2023 · call and serialization overhead can make a Cython or Rust extension slower than expected (*read*) · fetched 2026-10-12
- **Also good:** [All Pythons are slow, but some are faster than others](https://pythonspeed.com/articles/faster-python/) · Itamar Turner-Trauring, updated 30 Jan 2026 · the same Python version runs 10–20% faster or slower depending on the build (Docker image, Ubuntu, uv) — a side note, not the model itself (*read*) · fetched 2026-10-12
- **Our delta:** why it rarely matters in an I/O-bound service, and the ordered escape hatches. Avoid the [PythonSpeed/PerformanceTips](https://wiki.python.org/moin/PythonSpeed/PerformanceTips) wiki page: it mentions Python 2 seventeen times.

### T13-04 · Profiling before optimizing — Understand · 🔲 not written
- **Read this:** [py-spy README](https://raw.githubusercontent.com/benfred/py-spy/master/README.md) · py-spy project · sample a running process without restarting it or changing code; `record` makes a flame graph, `dump` prints stacks (*read*) · covers our angle: **partial** — py-spy only · fetched 2026-10-12
- **Also good:** [profiling — Python profilers](https://docs.python.org/3/library/profiling.html) · docs.python.org, new in 3.15 · sampling versus deterministic profiling; `cProfile` stays as an alias of `profiling.tracing` (*read*) · fetched 2026-10-12
- **Also good:** [profiling.sampling (Tachyon)](https://docs.python.org/3/library/profiling.sampling.html) · docs.python.org, new in 3.15 · stdlib sampling profiler that can attach to a running process by PID and emit a flame graph (*headings only*) · fetched 2026-10-12
- **Also good:** [SnakeViz](https://jiffyclub.github.io/snakeviz/) · project site · browser viewer for cProfile output (*read*) · fetched 2026-10-12
- **Also good:** [timeit](https://docs.python.org/3/library/timeit.html) · docs.python.org · micro-benchmarks, command-line interface included (*headings only*) · fetched 2026-10-12
- **Our delta:** the flame graph that indicts the ORM, and when the 3.15 stdlib sampler replaces py-spy. On 3.14 the cProfile reference is [The Python Profilers (3.14)](https://docs.python.org/3.14/library/profile.html).

### T13-05 · Memory — Understand · 🔲 not written
- **Read this:** [tracemalloc](https://docs.python.org/3/library/tracemalloc.html) · docs.python.org · snapshots, `compare_to`, "Display the top 10" allocation sites (*headings only*) · covers our angle: **partial** — tooling only, no refcounting story · fetched 2026-10-12
- **Also good:** [gc — Garbage Collector interface](https://docs.python.org/3/library/gc.html) · docs.python.org · the cycle collector's controls (*headings only*) · fetched 2026-10-12
- **Also good:** [Reference Counting (C API)](https://docs.python.org/3/c-api/refcounting.html) · docs.python.org · the refcount primitives, C-level (*headings only*) · fetched 2026-10-12
- **Our delta:** unbounded caches, lists that should be generators, and the limits of `sys.getsizeof`.

### T13-06 · Process management and graceful shutdown — Understand · 🔲 not written
- **Read this:** [Kubernetes best practices: terminating with grace](https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace) · Google Cloud blog, May 18, 2018 · the app must catch SIGTERM and shut down; preStop hook as a fallback (*read*) · covers our angle: **partial** — not Python-specific · fetched 2026-10-12
- **Also good:** [Uvicorn server behavior](https://uvicorn.dev/server-behavior/) · uvicorn.dev · "Graceful Process Shutdown": finish in-flight responses and background tasks within the configured timeout (*read*) · fetched 2026-10-12
- **Also good:** [Gunicorn design](https://gunicorn.org/design/) · gunicorn.org · worker types (sync, gthread, async) and "How Many Workers?": start from (2 × CPU cores) + 1 (*read*) · fetched 2026-10-12
- **Also good:** [Uvicorn deployment](https://uvicorn.dev/deployment/) · uvicorn.dev · `--workers` (spawn, not pre-fork), signals to the manager, running under Gunicorn (*read*) · fetched 2026-10-12
- **Also good:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · kubernetes.io · the probe contract (*headings only*) · fetched 2026-10-12
- **Our delta:** wiring SIGTERM to Uvicorn's shutdown; the Uvicorn pages describe graceful shutdown but do not name SIGTERM. Its `--timeout-graceful-shutdown` flag is on [Uvicorn settings](https://uvicorn.dev/settings/).

### T13-07 · Security hygiene — Understand · 🔲 not written
- **Read this:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · OWASP · prepared statements with parameterized queries as primary defence option 1 (*read*) · covers our angle: **partial** — generic, not Python · fetched 2026-10-12
- **Also good:** [secrets](https://docs.python.org/3/library/secrets.html) · docs.python.org · `token_urlsafe` and friends (*headings only*) · fetched 2026-10-12
- **Also good:** [pickle](https://docs.python.org/3/library/pickle.html) · docs.python.org · the warning: unpickling untrusted data can execute arbitrary code (*read*) · fetched 2026-10-12
- **Also good:** [PyYAML Documentation](https://pyyaml.org/wiki/PyYAMLDocumentation) · pyyaml.org · `yaml.load` is as powerful as `pickle.load`; `yaml.safe_load` limits output to simple objects (*read*) · fetched 2026-10-12
- **Also good:** [pip-audit README](https://raw.githubusercontent.com/pypa/pip-audit/main/README.md) · PyPA · auditing requirements, GitHub Actions and pre-commit use (*headings only*) · fetched 2026-10-12
- **Our delta:** one checklist page for all five.

### T13-08 · Building a CLI — Understand · 🔲 not written
- **Read this:** [Argparse Tutorial](https://docs.python.org/3/howto/argparse.html) · docs.python.org · positional and optional arguments, help text (*headings only*) · covers our angle: **partial** — no Typer/Click · fetched 2026-10-12
- **Also good:** [Typer](https://typer.tiangolo.com/) · Typer docs · type-hint-driven CLIs, subcommand trees, free `--help` (*read*) · fetched 2026-10-12
- **Also good:** [Click](https://click.palletsprojects.com/en/stable/) · Click 8.5.x · landing page only (*headings only*) · fetched 2026-10-12
- **Our delta:** exit-code conventions and when to leave argparse.

### T13-09 · Observability beyond logs — Know · 🔲 not written
- **Read this:** [Python zero-code instrumentation](https://opentelemetry.io/docs/zero-code/python/) · OpenTelemetry · the agent monkey-patches libraries; `opentelemetry-bootstrap -a install` adds instrumentation for installed packages (*read*) · covers our angle: **partial** — the page's example is Flask, not FastAPI · fetched 2026-10-12
- **Also good:** OpenTelemetry Python Contrib pages for [FastAPI](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/fastapi/fastapi.html), [SQLAlchemy](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/sqlalchemy/sqlalchemy.html) and [HTTPX](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/httpx/httpx.html) · each supports auto-instrumentation (SQLAlchemy names `opentelemetry-instrument` explicitly) or a manual instrumentor (*read*, intros only) · fetched 2026-10-12
- **Also good:** [Sentry for Python](https://docs.sentry.io/platforms/python/) · Sentry docs · `sentry_sdk.init`, errors and traces (*headings only*) · fetched 2026-10-12
- **Our delta:** one trace crossing FastAPI, SQLAlchemy and httpx, end to end.

### T13-10 · Caching in practice — Know · 🔲 not written
- **Read this:** [functools — lru_cache](https://docs.python.org/3/library/functools.html) · docs.python.org · `lru_cache` and `cache` for pure functions (*headings only*) · covers our angle: **partial** — nothing on Redis, TTLs or invalidation · fetched 2026-10-12
- **Also good:** [Caching strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html) · AWS ElastiCache docs · lazy loading (cache-aside) versus write-through, and adding a TTL to get the benefits of both (*read*) · fetched 2026-10-12
- **Also good:** [EXPIRE](https://redis.io/docs/latest/commands/expire/) · redis.io · key timeouts, and which writes clear or keep them (*read*) · fetched 2026-10-12
- **Also good:** [redis-py guide](https://redis.io/docs/latest/develop/clients/redis-py/) · redis.io · connecting from Python (*headings only*) · fetched 2026-10-12
- **Our delta:** invalidation on write as the hard part, in Python.

### T13-11 · Scheduled and background work — Know · 🔲 not written
- **Read this:** [APScheduler 3.x user guide](https://apscheduler.readthedocs.io/en/3.x/userguide.html) · APScheduler 3.11.3 · triggers, job stores, misfire handling (*headings only*) · covers our angle: **partial** — no delivery-guarantee comparison · fetched 2026-10-12
- **Also good:** [Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) · FastAPI docs · in-process tasks; the "Caveat" points heavy work to Celery (*read*) · fetched 2026-10-12
- **Also good:** [flock(1)](https://man7.org/linux/man-pages/man1/flock.1.html) · man7.org · wrap a cron command in a file lock; `-n` fails instead of waiting (*read*) · fetched 2026-10-12
- **Our delta:** choosing by delivery guarantee; doing the cron lock from Python.

### T13-12 · Upgrading Python — Know · 🔲 not written
- **Read this:** [What's new in Python 3.15](https://docs.python.org/3/whatsnew/3.15.html) · docs.python.org · released 9 Oct 2026; "Removed", "Deprecated" and "Pending removal in 3.16 to 3.20" sections (*headings only*) · covers our angle: **partial** — one release, not the method · fetched 2026-10-12
- **Also good:** [What's new in Python 3.14](https://docs.python.org/3/whatsnew/3.14.html) · docs.python.org · the previous release, for anyone still moving to 3.14 (*headings only*) · fetched 2026-10-12
- **Also good:** [warnings](https://docs.python.org/3/library/warnings.html) · docs.python.org · `DeprecationWarning` and the `-W` flag (*headings only*) · fetched 2026-10-12
- **Also good:** [PEP 387 — Backwards Compatibility Policy](https://peps.python.org/pep-0387/) · peps.python.org · deprecations last at least two years; a 2025 update prefers five (*read*) · fetched 2026-10-12
- **Our delta:** treating warnings as a to-do list and a staged rollout over the test matrix.
