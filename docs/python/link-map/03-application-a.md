---
title: "Link map · Python · Part 3a"
sidebar_label: "03a · Application (7–8)"
sidebar_position: 3
---

# Link map · Python · Part 3a (phases 7–8)

Covers every topic row of `docs/python/syllabus/03-application.md` for phase 7 (packaging, T07-01 to T07-12) and phase 8 (concurrency, T08-01 to T08-13). That is 25 rows, numbered in table order. Part 3b holds phases 9–10, part 3c holds phase 11.
*read* = I read the passage that carries the claim; *headings only* = fetched, title and headings checked. Every link was re-fetched with a browser User-Agent on 2026-10-12 and returned HTTP 200. Third-party links carry a date where the page shows one. No `#anchors` are given. ✅ paths were checked to exist; they are phase directories, each holding a README plus chunks.

🔴 **Version note.** docs.python.org pages fetched on 2026-10-12 are titled Python 3.15.0, so the `/3/` URLs track the newest docs, not 3.14. For 3.14 behaviour the What's new page (3.14.8 docs) is cited where it matters. The multiprocessing page records that 3.14 moved the POSIX default start method from fork to forkserver.
Not fetchable: `realpython.com` (Cloudflare challenge, 403, on re-check; its picks were replaced), `github.com` (403), `pypi.org` (bot challenge). None of them is linked.

---

## Phase 7 — Packaging, projects and tooling

### T07-01 · `pyproject.toml` — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/01-pyproject-toml/`
- **Read this:** [Writing your pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) · packaging.python.org · the PyPA's own walkthrough of the build-system and project tables (*read*) · covers our angle: **partial** — no history of setup.py/requirements.txt sprawl · fetched 2026-10-12
- **Our delta:** why the file replaced setup.py and requirements sprawl, and the tool tables beside it.

### T07-02 · `uv` — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/02-uv/`
- **Read this:** [Working on projects](https://docs.astral.sh/uv/guides/projects/) · docs.astral.sh, page updated 2026-10-09 · create, sync, lock and `uv run` in one guide (*read*) · covers our angle: **partial** — no pip plus venv baseline comparison · fetched 2026-10-12
- **Also good:** [The venv module](https://docs.python.org/3/library/venv.html) · docs.python.org · the stdlib floor you can always fall back to (*read*) · fetched 2026-10-12
- **Our delta:** the fallback workflow with pip and venv, side by side.

### T07-03 · Dependencies done right — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/03-dependencies/`
- **Read this:** [Managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/) · docs.astral.sh, page updated 2026-08-14 · ranges, extras, dependency groups and the lockfile in one place (*read*) · covers our angle: **partial** — the app-locks, library-ranges argument is not made here · fetched 2026-10-12
- **Also good:** [install_requires vs requirements files](https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/) · packaging.python.org · the abstract versus concrete dependency distinction behind that rule (*read*) · fetched 2026-10-12
- **Our delta:** why apps lock and libraries range, stated as a rule.

### T07-04 · Project layout, the src layout — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/04-project-layout/`
- **Read this:** [src layout vs flat layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/) · packaging.python.org · the import-the-wrong-copy argument from the PyPA (*read*) · covers our angle: **partial** — nothing on tests outside the package or workspaces · fetched 2026-10-12
- **Also good:** [Using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/) · docs.astral.sh, page updated 2026-10-09 · the one-repo, many-projects option (*read*) · fetched 2026-10-12
- **Our delta:** tests layout and when a workspace is worth it.

### T07-05 · `ruff` — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/05-ruff/`
- **Read this:** [The Ruff Linter](https://docs.astral.sh/ruff/linter/) · docs.astral.sh · rule selection and `--fix` from the tool's own docs (*read*) · covers our angle: **partial** — formatter and CI wiring live on other pages · fetched 2026-10-12
- **Also good:** [Ruff Integrations](https://docs.astral.sh/ruff/integrations/) · docs.astral.sh · pre-commit and GitHub Actions snippets (*read*) · fetched 2026-10-12
- **Our delta:** replacing flake8, isort and black, and what to select first.

### T07-06 · Entry points, `[project.scripts]` — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/06-entry-points/`
- **Read this:** [Creating and packaging command-line tools](https://packaging.python.org/en/latest/guides/creating-command-line-tools/) · packaging.python.org · a console script from `[project.scripts]` to an installed command (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/) · packaging.python.org · the exact format, for the exit-status detail (*read*) · fetched 2026-10-12

### T07-07 · Wheels vs sdists, native extensions — Understand · 🔲 not written
- **Read this:** [Package Formats](https://packaging.python.org/en/latest/discussions/package-formats/) · packaging.python.org · wheel versus sdist; when pip finds no wheel it falls back to downloading the sdist and compiling a wheel (*read*) · covers our angle: **partial** — no missing-wheel error walk-through · fetched 2026-10-12
- **Our delta:** what the error looks like when no wheel matches your platform, and the fix.

### T07-08 · Config and secrets — Understand · 🔲 not written
- **Read this:** [Settings Management (pydantic-settings)](https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/) · pydantic.dev · typed settings from environment variables and a dotenv file (*read*) · covers our angle: **partial** — nothing on why `.env` is for development only · fetched 2026-10-12
- **Also good:** [The Twelve-Factor App, Config](https://12factor.net/config) · 12factor.net · the principle: configuration lives in the environment (*read*) · fetched 2026-10-12
- **Our delta:** `.env` in dev only, and what production injects instead.

### T07-09 · Single-file scripts, inline metadata (PEP 723) — Know · 🔲 not written
- **Read this:** [Running scripts](https://docs.astral.sh/uv/guides/scripts/) · docs.astral.sh, page updated 2025-12-09 · `uv run` resolving a script's own dependencies (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 723, Inline script metadata](https://peps.python.org/pep-0723/) · peps.python.org · the block format itself (*read*) · fetched 2026-10-12

### T07-10 · Editable installs, path dependencies, simple monorepos — Know · 🔲 not written
- **Read this:** [Local project installs](https://pip.pypa.io/en/stable/topics/local-project-installs/) · pip docs (v26.2.1) · what `-e .` does and when (*read*) · covers our angle: **partial** — path dependencies and monorepos are not covered · fetched 2026-10-12
- **Also good:** [Using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/) · docs.astral.sh · the monorepo half (*read*) · fetched 2026-10-12
- **Our delta:** path dependencies in `pyproject.toml`.

### T07-11 · `pre-commit` — Know · 🔲 not written
- **Read this:** [pre-commit](https://pre-commit.com/) · pre-commit.com · the tool's own page: install, config file, hooks (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Using uv with pre-commit](https://docs.astral.sh/uv/guides/integration/pre-commit/) · docs.astral.sh, page updated 2026-10-09 · keeping the lockfile in sync from a hook (*read*) · fetched 2026-10-12

### T07-12 · Publishing to PyPI — Know · 🔲 not written
- **Read this:** [Building and publishing a package](https://docs.astral.sh/uv/guides/package/) · docs.astral.sh, page updated 2026-09-02 · `uv build` and `uv publish` end to end (*read*) · covers our angle: **partial** — trusted publishing is not the focus · fetched 2026-10-12
- **Also good:** [Publishing with GitHub Actions](https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/) · packaging.python.org · the CI workflow with trusted publishing (*read*) · fetched 2026-10-12
- **Our delta:** build backends and versioning; the twine route as the older path (the Packaging Projects tutorial at packaging.python.org covers it).

---

## Phase 8 — Concurrency and async

### T08-01 · The decision: I/O-bound vs CPU-bound — Master · 🔲 not written
- **Read this:** [Choose the Right Python Concurrency API](https://superfastpython.com/python-concurrency-choose-api/) · SuperFastPython (undated page) · step 1 is CPU-bound versus IO-bound, then threads, asyncio or processes (*read*) · covers our angle: **partial** — no mention of free-threaded builds · fetched 2026-10-12
- **Also good:** [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) · docs.python.org · the stdlib's thread, interpreter and process executors behind one interface (*read*) · fetched 2026-10-12
- **Our delta:** how to tell which you are (profile first), and the free-threaded exception.

### T08-02 · Threads, locks, `queue.Queue` — Understand · 🔲 not written
- **Read this:** [threading](https://docs.python.org/3/library/threading.html) · docs.python.org · its GIL and performance considerations section: one thread runs bytecode at a time, free-threaded builds since 3.13 lift that (*read*) · covers our angle: **partial** — a reference, few worked examples · fetched 2026-10-12
- **Also good:** [Python Threading: The Complete Guide](https://superfastpython.com/threading-in-python/) · SuperFastPython, 2023-10-31 · locks, queues and the GIL with runnable examples (*headings only*) · fetched 2026-10-12
- **Also good:** [queue](https://docs.python.org/3/library/queue.html) · docs.python.org · the reference for handoff (*headings only*) · fetched 2026-10-12
- **Our delta:** why threads help I/O despite the GIL.

### T08-03 · `concurrent.futures` — Understand · 🔲 not written
- **Read this:** [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) · docs.python.org · both executors, `map` and `as_completed` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ThreadPoolExecutor vs ProcessPoolExecutor](https://superfastpython.com/threadpoolexecutor-vs-processpoolexecutor/) · SuperFastPython, 2021-11-24 · a side-by-side of when each wins (*read*) · fetched 2026-10-12

### T08-04 · `multiprocessing`, spawn vs fork — Understand · 🔲 not written
- **Read this:** [multiprocessing](https://docs.python.org/3/library/multiprocessing.html) · docs.python.org · start methods spawn, fork and forkserver, plus the pickling constraints (*read*) · covers our angle: **partial** — a reference, not a story about fork deadlocks · fetched 2026-10-12
- **Our delta:** the fork-with-threads hazard and the 3.14 switch to forkserver as the POSIX default.

### T08-05 · asyncio, the model — Master · 🔲 not written
- **Read this:** [A conceptual overview of asyncio](https://docs.python.org/3/howto/a-conceptual-overview-of-asyncio.html) · docs.python.org · builds event loop, coroutine and await from first principles (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Asyncio: The Complete Guide](https://superfastpython.com/python-asyncio/) · SuperFastPython, 2023-10-09 · runnable examples of the same model (*headings only*) · fetched 2026-10-12

### T08-06 · Tasks, `gather` vs `TaskGroup`, cancellation, timeout — Master · 🔲 not written
- **Read this:** [Coroutines and tasks](https://docs.python.org/3/library/asyncio-task.html) · docs.python.org · `create_task`, `gather`, `TaskGroup`, `asyncio.timeout` and cancellation in one page (*read*) · covers our angle: **partial** — reference style; the fail-fast comparison is ours to draw · fetched 2026-10-12
- **Our delta:** the 50-requests fan-out example and what fail-fast means in practice.

### T08-07 · The blocking-call trap — Master · 🔲 not written
- **Read this:** [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) · docs.python.org · the debug mode and the running-blocking-code section (*read*) · covers our angle: **partial** — `asyncio.to_thread` is documented on the coroutines page, not here · fetched 2026-10-12
- **Also good:** [Event loop, run_in_executor](https://docs.python.org/3/library/asyncio-eventloop.html) · docs.python.org · the executor escape hatch (*read*) · fetched 2026-10-12
- **Our delta:** spotting the blocking call, and `to_thread` as the first choice.

### T08-08 · `async with`, `async for`, async generators — Understand · 🔲 not written
- **Read this:** [PEP 525, Asynchronous Generators](https://peps.python.org/pep-0525/) · peps.python.org · the design and semantics of async generators (*headings only*) · covers our angle: **partial** — a PEP, not a tutorial; `async with` is out of scope · fetched 2026-10-12
- **Also good:** [Compound statements](https://docs.python.org/3/reference/compound_stmts.html) · docs.python.org · sections 8.9.2 and 8.9.3 define `async for` and `async with`, usable only inside a coroutine (*read*) · fetched 2026-10-12
- **Also good:** [Asynchronous Context Managers in Python](https://superfastpython.com/asynchronous-context-manager/) · SuperFastPython, 2022-12-03 · `__aenter__` and `__aexit__` as awaited coroutines (*read*) · fetched 2026-10-12
- **Our delta:** resources and streams in practice.

### T08-09 · Common asyncio bugs — Understand · 🔲 not written
- **Read this:** [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) · docs.python.org · covers the never-awaited coroutine warning and debug mode (*read*) · covers our angle: **partial** — task reference-holding and swallowed `CancelledError` sit on other pages · fetched 2026-10-12
- **Also good:** [Coroutines and tasks](https://docs.python.org/3/library/asyncio-task.html) · docs.python.org · the cancellation section and the note on keeping a task reference (*read*) · fetched 2026-10-12
- **Our delta:** the three bugs side by side with the warning each produces.

### T08-10 · Bounding concurrency with `Semaphore` — Understand · 🔲 not written
- **Read this:** [Synchronization Primitives](https://docs.python.org/3/library/asyncio-sync.html) · docs.python.org · the asyncio `Semaphore` reference (*read*) · covers our angle: **partial** — no 500-URL example · fetched 2026-10-12
- **Our delta:** the 500 URLs, 10 at a time worked example.

### T08-11 · Sync and async libraries don't mix — Understand · 🔲 not written
- **Read this:** [Async Support, HTTPX](https://www.python-httpx.org/async/) · python-httpx.org · one library, a sync `Client` and an `AsyncClient` (*read*) · covers our angle: **partial** — nothing on sync ORMs in async views · fetched 2026-10-12
- **Also good:** [Concurrency and async / await, FastAPI](https://fastapi.tiangolo.com/async/) · fastapi.tiangolo.com · when async def is or is not right (*read*) · fetched 2026-10-12
- **Our delta:** the per-project architecture decision.

### T08-12 · The GIL, precisely, and free-threading — Know · 🔲 not written
- **Read this:** [Python support for free threading](https://docs.python.org/3/howto/free-threading-python.html) · docs.python.org · what the free-threaded build changes and its limits (*read*) · covers our angle: **partial** — does not explain what the GIL never protected · fetched 2026-10-12
- **Also good:** [PEP 703](https://peps.python.org/pep-0703/) · peps.python.org · the rationale; its container thread-safety section says what the GIL protects (internal interpreter state) (*read*) · fetched 2026-10-12
- **Our delta:** the check-then-act race, and C extensions releasing the lock.
- *Checked, not chosen:* Real Python's GIL article (2018, pre-free-threading; returned 403 on re-check, so not linked).

### T08-13 · Subinterpreters, `concurrent.interpreters` — When Needed · 🔲 not written
- **Read this:** [concurrent.interpreters](https://docs.python.org/3/library/concurrent.interpreters.html) · docs.python.org · the 3.14 module for multiple interpreters in one process (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [What's new in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html) · docs.python.org (3.14.8) · the release note framing it as a parallelism option (*read*) · fetched 2026-10-12

