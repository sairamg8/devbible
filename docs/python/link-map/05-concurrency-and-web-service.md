---
title: "Link map · Python · Part 5 (phases 8–9)"
sidebar_label: "05 · concurrency and web service"
sidebar_position: 5
---

# Link map · Python · Part 5 (phases 8–9)

Covers every topic row of `docs/python/syllabus/03-application.md` in phase 8 (T08-01 to T08-13, concurrency and async) and phase 9 (T09-01 to T09-14, the web service). That is 27 rows. None has a written page yet (`docs/python/pages/` holds phases 0–3 and 7 only), so every block reads 🔲 not written.
*read* = I read the passage; *headings only* = fetched, the page's scope checked but not the passage in depth. Third-party links carry a date where the page shows one. No `#anchors` are given. A **Beyond the docs** line appears only where a good non-official explanation was found and fetched; its absence means none was verified, not that none exists. Twelve blocks (T08-08, T08-11, T08-13, T09-02, T09-03, T09-05, T09-07, T09-08, T09-10, T09-11, T09-12, T09-13) have no such line yet.

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). The docs.python.org pages below were fetched on 2026-10-13 at 3.14.8. Three things changed recently and older third-party pages predate them: the `multiprocessing` default start method on POSIX is now `forkserver` (not `fork`), `concurrent.interpreters` is new in 3.14, and `asyncio.TaskGroup` and `asyncio.timeout` need 3.11. FastAPI's current JWT tutorial uses `pwdlib` with Argon2 and `PyJWT`, not the older `passlib` and `python-jose` that many blog posts still show. Pydantic's docs moved to pydantic.dev/docs (the old docs.pydantic.dev URLs answer 301). realpython.com returned 403 to my fetches, so no Real Python page is linked: none could be verified.

---

## Phase 8 — Concurrency and async

### T08-01 · The decision: threads, processes or an event loop — Master · 🔲 not written
- **Read this:** [concurrent.futures](https://docs.python.org/3.14/library/concurrent.futures.html) · docs.python.org · puts `ThreadPoolExecutor`, `ProcessPoolExecutor` and the new `InterpreterPoolExecutor` behind one interface, so the choice is a one-word swap (*headings only*) · covers our angle: **partial** — a reference, not a decision guide; it does not say how to tell I/O-bound from CPU-bound · fetched 2026-10-13
- **Beyond the docs:** [Parallelism, Concurrency, and AsyncIO in Python - by example](https://testdriven.io/blog/python-concurrency-parallelism/) · Amal Shaji, TestDriven.io, last updated 2022-07-05 · defines CPU-bound versus IO-bound, then times the same job with threading, multiprocessing, `concurrent.futures` and AsyncIO, and says concurrency suits IO-bound work and parallelism CPU-bound work; it names no Python version and uses `asyncio.get_event_loop()`, which is dated · fetched 2026-10-13 (*read*)
- **Also good:** [A Conceptual Overview of asyncio](https://docs.python.org/3.14/howto/a-conceptual-overview-of-asyncio.html) · docs.python.org · the single-threaded event-loop model the third option rests on (*read*) · fetched 2026-10-13
- **Our delta:** the measuring step (profile, then pick) and the gate question about what breaks if a sync call sneaks into the async version.

### T08-02 · Threads, locks and `queue.Queue` — Understand · 🔲 not written
- **Read this:** [threading](https://docs.python.org/3.14/library/threading.html) · docs.python.org · the GIL note (only one thread runs bytecode at a time in CPython) and the Lock objects section (*read* both) · covers our angle: **partial** — does not explain why threads still help for I/O · fetched 2026-10-13
- **Also good:** [queue](https://docs.python.org/3.14/library/queue.html) · docs.python.org · `task_done` and `join` for handoff, and `Queue.shutdown()` (3.13+) for ending consumers cleanly (*read* those sections) · fetched 2026-10-13
- **Beyond the docs:** [Python Threading: The Complete Guide](https://superfastpython.com/threading-in-python/) · SuperFastPython, 2023-10-31 (no author named on the page) · says to use threads for blocking IO and for calls into C libraries such as NumPy that release the GIL, with the GIL quoted from the Python docs; the site also sells books · fetched 2026-10-13 (*read* the opening and the GIL and use-case passages)
- **Our delta:** the GIL is released during blocking I/O, so threads overlap waiting; and Queue as the handoff instead of shared lists plus locks.

### T08-03 · `concurrent.futures`: executors, `as_completed` vs `map` — Understand · 🔲 not written
- **Read this:** [concurrent.futures](https://docs.python.org/3.14/library/concurrent.futures.html) · docs.python.org · `ThreadPoolExecutor`, `ProcessPoolExecutor`, `as_completed()` (*read* the summary of the module) · covers our angle: **partial** — no worked "100 API calls, bounded workers" example · fetched 2026-10-13
- **Beyond the docs:** [ThreadPoolExecutor in Python: The Complete Guide](https://superfastpython.com/threadpoolexecutor-in-python/) · SuperFastPython, 2022-01-19 (no author named on the page) · covers `submit()`, `map()`, `as_completed()` and how `max_workers` bounds the pool, with a long run of examples; a book-length page, so I read the opening and the `as_completed()` passages, not all of it · fetched 2026-10-13 (*read*)
- **Our delta:** the `map` (input order, first error stops iteration) vs `as_completed` (finish order, per-future error handling) choice stated as a rule.

### T08-04 · `multiprocessing` under the hood: spawn vs fork, pickling — Understand · 🔲 not written
- **Read this:** [multiprocessing](https://docs.python.org/3.14/library/multiprocessing.html) · docs.python.org · start methods: spawn is the default on Windows and macOS, forkserver on other POSIX, and fork is "no longer the default start method on any platform"; "safely forking a multithreaded process is problematic" (*read* the start-methods passage; the last ~60,000 characters unread) · covers our angle: **partial** — pickling cost at the boundary is spread across other sections · fetched 2026-10-13
- **Beyond the docs:** [Python multiprocessing: Why your Pool gets stuck](https://pythonspeed.com/articles/python-multiprocessing/) · Itamar Turner-Trauring, pythonspeed, created 2018-09-04, updated 2024-09-13 · a lock held by another thread at `fork()` time stays locked in the child and deadlocks it, and the fix is to use spawn; written before 3.14, so its "will change" is now the shipped default of forkserver on Linux · fetched 2026-10-13 (*read*)
- **Our delta:** the concrete deadlock story plus the 3.14 default, and what must be picklable when a function crosses the process boundary.

### T08-05 · asyncio, the model: loop, coroutines, `await` — Master · 🔲 not written
- **Read this:** [A Conceptual Overview of asyncio](https://docs.python.org/3.14/howto/a-conceptual-overview-of-asyncio.html) · docs.python.org · the event loop runs queued jobs and hands control to each; `await` on a task cedes control back to the loop (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [How the heck does async/await work in Python 3.5?](https://snarky.ca/how-the-heck-does-async-await-work-in-python-3-5/) · Brett Cannon, 2016-02-11 · builds coroutines up from generators, `send()` and `yield from`, so `await` as a yield point is shown rather than asserted; from 2016, so it predates `asyncio.run` and says nothing of task groups · fetched 2026-10-13 (*read*)
- **Our delta:** cooperative on purpose: nothing else runs until you `await`.

### T08-06 · Tasks: `create_task`, `gather` vs `TaskGroup`, cancellation, `timeout` — Master · 🔲 not written
- **Read this:** [Coroutines and tasks](https://docs.python.org/3.14/library/asyncio-task.html) · docs.python.org · `TaskGroup` awaits all tasks on exit and raises an `ExceptionGroup`; `gather()` returns results in input order; `asyncio.timeout()` turns cancellation into `TimeoutError` (*read*) · covers our angle: **full** (3.11+) · fetched 2026-10-13
- **Beyond the docs:** [Waiting in asyncio](https://hynek.me/articles/waiting-in-asyncio/) · Hynek Schlawack, 2020-05-21, updated 2023-07-28 · compares `gather`, `wait` and `TaskGroup` side by side: `gather` cancels its children if it is itself cancelled, `wait` never cancels, `TaskGroup` cancels the rest on a failure · fetched 2026-10-13 (*read*)
- **Also good:** [Notes on structured concurrency, or: Go statement considered harmful](https://vorpus.org/blog/notes-on-structured-concurrency-or-go-statement-considered-harmful/) · Nathaniel J. Smith, 2018-04-25 · the argument behind `TaskGroup` (child tasks must finish inside a block); written for Trio, not asyncio · fetched 2026-10-13 (*read*)
- **Our delta:** "fan out 50 requests, fail cleanly" as one worked example, with the CancelledError rule from T08-09.

### T08-07 · The blocking-call trap: `to_thread` and `run_in_executor` — Master · 🔲 not written
- **Read this:** [Developing with asyncio](https://docs.python.org/3.14/library/asyncio-dev.html) · docs.python.org · debug mode logs callbacks slower than 100 ms; blocking code goes to `loop.run_in_executor()` (*read*) · covers our angle: **partial** — no worked freeze demonstration · fetched 2026-10-13
- **Also good:** [Coroutines and tasks](https://docs.python.org/3.14/library/asyncio-task.html) · docs.python.org · `asyncio.to_thread()` runs a blocking function in another thread and propagates context variables (*read* that entry) · fetched 2026-10-13
- **Beyond the docs:** [How to Use Asyncio to_thread()](https://superfastpython.com/asyncio-to_thread/) · SuperFastPython, 2022-11-28 (no author named on the page) · opens on why a blocking call halts the whole loop, then runs it with `to_thread()`; says the function is meant for IO-bound work, not CPU-bound · fetched 2026-10-13 (*read* the opening)
- **Our delta:** the same trap seen from FastAPI is T09-06. A to_thread call still occupies a thread, and CPU-bound work needs a process.

### T08-08 · `async with`, `async for`, async generators — Understand · 🔲 not written
- **Read this:** [PEP 525 — Asynchronous Generators](https://peps.python.org/pep-0525/) · peps.python.org · an `async for` producer written as a plain function with `yield`; `aclose()` finalizes one stopped partway (*read* the opening) · covers our angle: **partial** — a design document, no `async with` or `__aenter__` walk-through · fetched 2026-10-13
- **Our delta:** `@asynccontextmanager` and `AsyncExitStack`, plus closing async generators explicitly rather than leaving it to garbage collection.

### T08-09 · Common asyncio bugs: forgotten `await`, lost tasks, swallowed `CancelledError` — Understand · 🔲 not written
- **Read this:** [Coroutines and tasks](https://docs.python.org/3.14/library/asyncio-task.html) · docs.python.org · the loop holds only weak references to tasks, so keep a strong reference (a set with a done callback) or the task may be collected mid-execution (*read* that note) · covers our angle: **partial** — the never-awaited warning is on the Developing with asyncio page · fetched 2026-10-13
- **Also good:** [Developing with asyncio](https://docs.python.org/3.14/library/asyncio-dev.html) · docs.python.org · a coroutine that is never awaited emits a `RuntimeWarning` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Heisenbug lurking in your async code](https://textual.textualize.io/blog/2023/02/11/the-heisenbug-lurking-in-your-async-code/) · Will McGugan, Textual blog, 2023-02-11 · a short warning, not a post-mortem: a `create_task` result nobody holds can be garbage collected and the task silently stops; the page says a GitHub search found many projects with the bug and suggests `TaskGroup` to keep references · fetched 2026-10-13 (*read*)
- **Also good:** [Fire and forget (or never) with Python's asyncio](https://mkennedy.codes/posts/fire-and-forget-or-never-with-python-s-asyncio/) · Michael Kennedy, 2026-03-18 · the same set-plus-done-callback fix; his claim that it bites from Python 3.12 on is his own, I did not check it · fetched 2026-10-13 (*read*)
- **Our delta:** all three bugs in one place, with the swallowed `CancelledError` (a `BaseException` subclass) that breaks `TaskGroup` and `timeout`.

### T08-10 · Bounding concurrency with `asyncio.Semaphore` — Understand · 🔲 not written
- **Read this:** [Synchronization primitives](https://docs.python.org/3.14/library/asyncio-sync.html) · docs.python.org · `Semaphore` and `BoundedSemaphore`, which raises `ValueError` if released past its initial value (*read*) · covers our angle: **partial** — no HTTP example · fetched 2026-10-13
- **Beyond the docs:** [Limit concurrency with semaphore in Python asyncio](https://rednafi.com/python/limit-concurrency-with-semaphore/) · Redowan Delowar, 2022-02-10 · wraps each request in `async with` on `Semaphore(3)` so only three run at once; short and runnable · fetched 2026-10-13 (*read*)
- **Also good:** [Asyncio Semaphore](https://superfastpython.com/asyncio-semaphore/) · SuperFastPython, 2022-12-14 · a longer tutorial that defines the semaphore as a counter limiting how many tasks hold it at once, then works examples with coroutines (*read* the opening) · fetched 2026-10-13
- **Our delta:** a semaphore caps in-flight requests, not requests per second; a rate limit is a separate tool.

### T08-11 · Sync and async libraries don't mix by accident — Understand · 🔲 not written
- **Read this:** [HTTPX Async Support](https://www.python-httpx.org/async/) · python-httpx.org · a standard synchronous API by default, with `AsyncClient` and `await client.get(...)` for async (*read*) · covers our angle: **partial** — httpx only; the sync-ORM-in-async-view half is not here · fetched 2026-10-13
- **Also good:** [Asynchronous support](https://docs.djangoproject.com/en/stable/topics/async/) · Django docs · async views are supported, the ORM has `a`-prefixed methods such as `afirst()`, transactions do not work in async mode yet, and sync code must go through `sync_to_async()` (*read*) · fetched 2026-10-13
- **Our delta:** deciding sync or async per project, not per function.

### T08-12 · The GIL, precisely, and free-threading — Know · 🔲 not written
- **Read this:** [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html) · docs.python.org · an optional build with the GIL disabled, supported since 3.13; single-threaded overhead of roughly 1% on macOS aarch64 to 8% on x86-64 Linux (*read* the opening) · covers our angle: **partial** — says nothing of what the GIL protected or of check-then-act races · fetched 2026-10-13
- **Beyond the docs:** [Python Free-Threading Guide](https://py-free-threading.github.io/) · community guide for maintainers and users · pure Python code is thread-safe to about the same extent as with the GIL; the pitfalls are global state, dict-based caches and non-thread-safe dependencies, and it tracks which native-code packages support free threading (*read* the front page, not the sub-pages) · fetched 2026-10-13 (*read*)
- **Our delta:** the GIL never made your own check-then-act atomic; that is why a lock is still needed with or without it.

### T08-13 · Subinterpreters: `concurrent.interpreters` — When Needed · 🔲 not written
- **Read this:** [concurrent.interpreters](https://docs.python.org/3.14/library/concurrent.interpreters.html) · docs.python.org · isolated interpreters in one process; no concurrency on its own; most objects are copied between interpreters, so mutable data does not stay in sync (*read*) · covers our angle: **full** (new in 3.14) · fetched 2026-10-13
- **Also good:** [PEP 734](https://peps.python.org/pep-0734/) · peps.python.org · the motivation: make the long-existing multiple-interpreter support usable from Python, not only the C API (*read* the motivation) · fetched 2026-10-13
- **Our delta:** where it sits between threads and processes.

---

## Phase 9 — The web service

### T09-01 · WSGI vs ASGI — Understand · 🔲 not written
- **Read this:** [ASGI introduction](https://asgi.readthedocs.io/en/latest/introduction.html) · asgi.readthedocs.io · WSGI is one synchronous callable per request, which makes long-lived connections such as WebSockets hard; ASGI is an async callable handling many events and can wrap WSGI apps with a threadpool (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [PEP 3333](https://peps.python.org/pep-3333/) · peps.python.org · the WSGI 1.0.1 specification itself; the abstract calls it a standard interface between web servers and Python web applications (*read* the abstract) · fetched 2026-10-13
- **Beyond the docs:** [Moving from Flask to FastAPI](https://testdriven.io/blog/moving-from-flask-to-fastapi/) · Amal Shaji, TestDriven.io, last updated 2022-03-28 · sets a WSGI framework against an ASGI one across routing, validation, middleware, testing and deployment, side by side in code; from 2022 (*read* the contents list and the Testing and Deployment sections) · fetched 2026-10-13
- **Our delta:** the framework choice implies the server protocol.

### T09-02 · FastAPI routing: typed params, body models, response models — Master · 🔲 not written
- **Read this:** [Response Model - Return Type](https://fastapi.tiangolo.com/tutorial/response-model/) · FastAPI docs · `response_model` converts the returned data to the declared model, so fields not in it, such as a `password`, are dropped (*read*) · covers our angle: **partial** — the path, query and body pages come before it · fetched 2026-10-13
- **Also good:** [Path Parameters](https://fastapi.tiangolo.com/tutorial/path-params/) · FastAPI docs · declaration, type conversion and validation, the "Order matters" section on `/users/me` before `/users/{user_id}`, `Enum` (*read* the opening and the data-conversion section) · fetched 2026-10-13
- **Our delta:** validation as the framework's core trick, and the input-model/output-model split.

### T09-03 · Pydantic v2: models, validators, serialization, settings — Master · 🔲 not written
- **Read this:** [Validators](https://pydantic.dev/docs/validation/latest/concepts/validators/) · Pydantic docs · `field_validator` and `model_validator`, with after validators and the password-repeat model check as the example (*read* those sections; old docs.pydantic.dev URL answers 301) · covers our angle: **partial** — validators only; models and serialization are other pages · fetched 2026-10-13
- **Also good:** [Settings Management](https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/) · Pydantic docs · a `BaseSettings` subclass fills fields from matching environment variables, else the default (*read* the opening; the last ~26,000 characters unread) · fetched 2026-10-13
- **Our delta:** Pydantic as the boundary guard for all external data, not just HTTP.

### T09-04 · Dependency injection with `Depends` — Understand · 🔲 not written
- **Read this:** [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) · FastAPI docs · the introductory page for `Depends`: a dependency is a function taking the same parameters as a path operation function, shared through `Depends` (*read* the first example) · covers our angle: **partial** — `yield` sessions and overrides are later pages · fetched 2026-10-13
- **Beyond the docs:** [Testing FastAPI](https://www.oddbird.net/2024/02/09/testing-fastapi/) · Ed Rivas, OddBird, 2024-02-09 · swaps the real `get_db` for a test session through dependency overrides, with each test's database changes rolled back · fetched 2026-10-13 (*read*)
- **Our delta:** testable by override, no globals.

### T09-05 · Error handling: `HTTPException`, handlers, one error shape — Master · 🔲 not written
- **Read this:** [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) · FastAPI docs · raise `HTTPException` to return an error; `@app.exception_handler()` customizes how it and your own exception types become responses (*read*) · covers our angle: **partial** — no single error shape, no stack-trace-leak warning · fetched 2026-10-13
- **Our delta:** one envelope for the whole API, and a catch-all handler that logs server-side and returns nothing internal.

### T09-06 · `def` vs `async def` route handlers — Understand · 🔲 not written
- **Read this:** [Concurrency and async / await](https://fastapi.tiangolo.com/async/) · FastAPI docs · a plain `def` path operation runs in an external threadpool that FastAPI awaits, instead of blocking the server; `async def` is for functions that do no blocking I/O (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) · Zhanymkanov, GitHub, a conventions repo described as what the author's startup used with FastAPI · its Async Routes section: sync routes run in a threadpool, so blocking I/O does not stall the loop, while blocking calls inside `async def` do; for CPU-bound work, worker processes; the README shows no commit date · fetched 2026-10-13 (*read* the Async Routes and Dependencies sections)
- **Also good:** [One blocking call freezes every request: FastAPI's def vs async def](https://dev.to/r9v/one-blocking-call-freezes-every-request-fastapis-def-vs-async-def-52lh) · r9v, DEV Community, posted July 16 (the page shows no year; the account joined in 2026) · argues `async def` is a promise that everything inside is non-blocking, and shows debug mode naming the slow function; the figures are illustrative, there is no benchmark, and the author is a single new account · fetched 2026-10-13 (*read*)
- **Our delta:** wrong choice either blocks the loop or wastes threads. Ties back to T08-07.

### T09-07 · Middleware and CORS — Understand · 🔲 not written
- **Read this:** [CORS (Cross-Origin Resource Sharing)](https://fastapi.tiangolo.com/tutorial/cors/) · FastAPI docs · preflight is an `OPTIONS` request that `CORSMiddleware` intercepts and answers (*read*) · covers our angle: **partial** — no request-id logging · fetched 2026-10-13
- **Also good:** [Middleware](https://fastapi.tiangolo.com/tutorial/middleware/) · FastAPI docs · `@app.middleware("http")` and the order multiple middlewares run in: each new one wraps the app, so the last added is outermost (*read* that section) · fetched 2026-10-13
- **Also good:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · the browser's side: when a preflight happens, and credentialed requests cannot use the `*` wildcard (*read*) · fetched 2026-10-13
- **Our delta:** the debugging order for a CORS failure, and request ids in logs.

### T09-08 · Auth: OAuth2 password flow, JWT, hashing, scopes — Understand · 🔲 not written
- **Read this:** [OAuth2 with Password (and hashing), Bearer with JWT tokens](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) · FastAPI docs · Argon2 through `pwdlib` and signed JWTs through `PyJWT`; JWTs are signed, not encrypted (*read*) · covers our angle: **partial** — scopes are on the advanced page · fetched 2026-10-13
- **Our delta:** the SPA-plus-API arrangement and where the token is stored.

### T09-09 · Background work: `BackgroundTasks` vs a real queue — Understand · 🔲 not written
- **Read this:** [Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) · FastAPI docs · small post-response work; its Caveat section points to Celery for heavy computation (*read* that section) · covers our angle: **partial** — no delivery-guarantee discussion · fetched 2026-10-13
- **Also good:** [arq](https://arq-docs.helpmanual.io/) · arq docs · an asyncio and Redis job queue with effectively at-least-once semantics: "Jobs may be called more than once!", `Retry`, default `max_tries` 5 (*read*) · [Celery tasks guide](https://docs.celeryq.dev/en/stable/userguide/tasks.html) · Celery docs · `acks_late` acknowledges after the task returns and suits idempotent tasks; `task_reject_on_worker_lost` gives redelivery when a worker is lost (*read* those passages) · fetched 2026-10-13
- **Beyond the docs:** [Asynchronous Tasks with FastAPI and Celery](https://testdriven.io/blog/fastapi-and-celery/) · Michael Herman, TestDriven.io, last updated 2023-04-06 · wires a FastAPI route to a Celery worker with Redis as broker and result backend, a `/tasks/{task_id}` status route, and says to prefer Celery over `BackgroundTasks` for CPU-heavy work; it does not discuss delivery guarantees · fetched 2026-10-13 (*read*)
- **Our delta:** `BackgroundTasks` lives in the web process and is lost on a restart; a queue survives it, at the cost of possible duplicates.

### T09-10 · Serving: uvicorn, workers, `--reload` — Understand · 🔲 not written
- **Read this:** [Server Workers - Uvicorn with Workers](https://fastapi.tiangolo.com/deployment/server-workers/) · FastAPI docs · `--workers` starts several Uvicorn processes under a parent to use more cores; Kubernetes usually runs one process per container (*read*) · covers our angle: **partial** — no rule for how many · fetched 2026-10-13
- **Also good:** [Uvicorn deployment](https://uvicorn.dev/deployment/) · Uvicorn · `--reload` and `--workers` are mutually exclusive; Gunicorn with the Uvicorn worker class for production, and `uvicorn.workers` is deprecated for the `uvicorn-worker` package (*read*) · fetched 2026-10-13
- **Also good:** [Gunicorn design: how many workers](https://gunicorn.org/design/) · Gunicorn docs · its own rule of thumb: workers are not clients, typically 4 to 12 are enough, start from (2 x CPU cores) + 1 and adjust under load; Gunicorn's guidance for its sync-style workers, not FastAPI's (*read* the Scaling section) · fetched 2026-10-13
- **Our delta:** what "how many workers" depends on (cores, memory, orchestrator).

### T09-11 · OpenAPI for free: docs, tags, examples — Know · 🔲 not written
- **Read this:** [Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/) · FastAPI docs · tag metadata through `openapi_tags` and the `/docs`, `/redoc` and `openapi_url` settings (*read*) · covers our angle: **partial** — examples are on a separate page · fetched 2026-10-13
- **Our delta:** the generated schema as the frontend contract.

### T09-12 · Streaming, file uploads, WebSockets — Know · 🔲 not written
- **Read this:** [Custom Response](https://fastapi.tiangolo.com/advanced/custom-response/) · FastAPI docs · `StreamingResponse` takes an async generator or a normal generator and streams the body (*read* that entry) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Request Files](https://fastapi.tiangolo.com/tutorial/request-files/) · FastAPI docs · `File` and `UploadFile` (*headings only*; contents list checked) · [WebSockets](https://fastapi.tiangolo.com/advanced/websockets/) · FastAPI docs · `@app.websocket`, dependencies and `WebSocketDisconnect`, raised when the connection closes (*read* that section) · fetched 2026-10-13
- **Our delta:** the non-JSON endpoints in one place, and why a sync file read inside an async stream blocks the loop.

### T09-13 · Django, the other pole — Know · 🔲 not written
- **Read this:** [Writing your first Django app, part 1](https://docs.djangoproject.com/en/stable/intro/tutorial01/) · Django docs · project, development server, first view (*read* those sections) · covers our angle: **partial** — the admin, ORM and auth come in later parts · fetched 2026-10-13
- **Also good:** [Asynchronous support](https://docs.djangoproject.com/en/stable/topics/async/) · Django docs · the honest async picture: async views, `a`-prefixed ORM methods, no async transactions yet (*read*) · fetched 2026-10-13
- **Our delta:** when batteries-included beats assemble-your-own.

### T09-14 · Flask, the minimal WSGI baseline — Know · 🔲 not written
- **Read this:** [Quickstart](https://flask.palletsprojects.com/en/stable/quickstart/) · Flask docs (3.1.x) · routing, request data, sessions, errors; the `Flask` instance is the WSGI application (*read*) · covers our angle: **partial** — read-fluently scope · fetched 2026-10-13
- **Beyond the docs:** [The Flask Mega-Tutorial, Part I: Hello, World!](https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world) · Miguel Grinberg, 2023-12-03 · Part I of a long series that builds a whole Flask app: environment, package layout, the first route; this is the 2024 edition for Flask 3 (*read* Part I) · fetched 2026-10-13
- **Our delta:** recognise the shape, then map it onto FastAPI.
