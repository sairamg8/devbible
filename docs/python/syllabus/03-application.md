---
title: "Part 3 — Application layer"
sidebar_label: "3 · Application"
sidebar_position: 3
---

> Phases 7–11 · Packaging and tooling, concurrency, the web service, data, and
> the REST API you actually ship

This is where Python becomes a shipped service: a reproducible project, the
right concurrency model for the workload, a FastAPI app, real I/O against
PostgreSQL — and then Phase 11, where those last two stop being separate
subjects and become one CRUD resource a frontend can consume.

---

## Phase 7 — Packaging, projects and tooling

Python's historical weak spot, now largely solved — if you use the current
tools. This phase is opinionated on purpose: `pyproject.toml`, `uv`, `ruff`.

| Topic | Tier |
|---|---|
| **`pyproject.toml`** — the one config file: project metadata, dependencies, tool config; the death of `setup.py`/`requirements.txt` sprawl | <span className="db-tier t-master">Master</span> |
| **`uv`**: venv + resolver + lockfile + `uv run` — the 2026 default workflow; `pip` + `venv` as the baseline you can always fall back to | <span className="db-tier t-master">Master</span> |
| **Dependencies done right**: ranges in `pyproject.toml`, **a committed lockfile** for the app, extras (`[project.optional-dependencies]`), dependency groups (dev/test) — and why apps lock but libraries range | <span className="db-tier t-master">Master</span> |
| Project layout: the **src layout** (and the import-the-wrong-copy bug flat layout invites), tests outside the package, one project per repo vs workspaces | <span className="db-tier t-understand">Understand</span> |
| **`ruff`**: linter + formatter in one — replacing flake8/isort/black; rule selection, `--fix`, and putting it in CI and pre-commit | <span className="db-tier t-understand">Understand</span> |
| Entry points: `[project.scripts]` — `mycli = mypkg.cli:main`, installed as a command | <span className="db-tier t-understand">Understand</span> |
| Wheels vs sdists, and native extensions — why `pip install` sometimes compiles C, and what a missing wheel for your platform looks like | <span className="db-tier t-understand">Understand</span> |
| **Config and secrets**: environment variables, `.env` in dev only, typed settings objects (pydantic-settings) — 12-factor as Python practices it | <span className="db-tier t-understand">Understand</span> |
| Single-file scripts with **inline metadata (PEP 723)**: `uv run script.py` resolving its own deps — automation scripts that carry their environment | <span className="db-tier t-know">Know</span> |
| Editable installs (`-e .`), path dependencies, simple monorepos | <span className="db-tier t-know">Know</span> |
| `pre-commit` — the hook harness the ecosystem standardized on | <span className="db-tier t-know">Know</span> |
| Publishing to PyPI: build backends, `uv build`/`twine`, versioning, trusted publishing from CI | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a src-layout project where `uv sync` on a clean machine
reproduces the environment exactly, `ruff check` and the type checker pass in
CI, and a console script installs and runs.

---

## Phase 8 — Concurrency and async

Three models, one decision: threads, processes, or an event loop. Most real
mistakes are picking the wrong one — or blocking the loop with the right one.

| Topic | Tier |
|---|---|
| **The decision**: I/O-bound → threads or asyncio; CPU-bound → processes (or native code); and *how to tell which you are* — the model behind every other row | <span className="db-tier t-master">Master</span> |
| Threads: `threading.Thread`, locks, `queue.Queue` for handoff — why threads genuinely help for I/O despite the GIL | <span className="db-tier t-understand">Understand</span> |
| **`concurrent.futures`**: `ThreadPoolExecutor` (100 API calls, bounded workers), `ProcessPoolExecutor`, `as_completed` vs `map` — the high-level API that covers most needs | <span className="db-tier t-understand">Understand</span> |
| `multiprocessing` under the hood: **spawn vs fork** (fork's deadlock hazards — no longer the default on any major platform), pickling costs at the boundary | <span className="db-tier t-understand">Understand</span> |
| **asyncio, the model**: the event loop, coroutines, `await` as a yield point, `asyncio.run` — single-threaded concurrency, cooperative on purpose | <span className="db-tier t-master">Master</span> |
| **Tasks**: `create_task`, **`gather` vs `TaskGroup`** (structured, fail-fast — 3.11+), cancellation, `asyncio.timeout` — fan out 50 requests, fail cleanly | <span className="db-tier t-master">Master</span> |
| **The blocking-call trap**: one `time.sleep` or sync DB call freezes every request — spotting it, and `asyncio.to_thread` / `run_in_executor` as the escape | <span className="db-tier t-master">Master</span> |
| `async with` / `async for`, async generators — resources and streams in async code | <span className="db-tier t-understand">Understand</span> |
| **Common asyncio bugs**: the forgotten `await` (a coroutine that never ran — and the warning that says so), fire-and-forget tasks garbage-collected mid-flight (hold the reference), swallowed `CancelledError` | <span className="db-tier t-understand">Understand</span> |
| Bounding concurrency: `asyncio.Semaphore` — 500 URLs, 10 at a time, without DDoSing the target (or yourself) | <span className="db-tier t-understand">Understand</span> |
| Sync and async libraries don't mix by accident: httpx's two APIs, sync ORMs in async views — the architecture question, decided per project | <span className="db-tier t-understand">Understand</span> |
| The GIL, precisely: what it protects (interpreter state, refcounts), what it never protected (your check-then-act), C extensions releasing it — and **free-threading's** practical effect on this phase | <span className="db-tier t-know">Know</span> |
| Subinterpreters (`concurrent.interpreters`, 3.14) — the third parallelism story | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** given "fetch 200 product pages, parse them, write
results", you choose the model, bound its concurrency, and can say what breaks
if a sync HTTP call sneaks into the async version.

---

## Phase 9 — The web service

FastAPI is the through-line — it is where typing, Pydantic, async and
decorators all pay off at once. Django and Flask are taught as recognition:
what they are, when they win.

| Topic | Tier |
|---|---|
| **WSGI vs ASGI** — the two server protocols, sync vs async at the interface, and why the framework choice implies one | <span className="db-tier t-understand">Understand</span> |
| **FastAPI routing**: path/query params typed in the signature, request bodies as Pydantic models, response models filtering what leaves — validation as the framework's core trick | <span className="db-tier t-master">Master</span> |
| **Pydantic v2**: `BaseModel`, validation and coercion, `field_validator`/`model_validator`, serialization control, `pydantic-settings` — the boundary guard for *all* external data, not just HTTP | <span className="db-tier t-master">Master</span> |
| **Dependency injection with `Depends`**: shared DB sessions, auth extraction, pagination params — testable by override, no globals | <span className="db-tier t-understand">Understand</span> |
| **Error handling**: `HTTPException`, custom exception handlers, one error shape for the whole API — and never leaking a stack trace to a client | <span className="db-tier t-master">Master</span> |
| `def` vs `async def` route handlers — FastAPI runs sync handlers in a threadpool; the wrong choice either blocks the loop or wastes threads | <span className="db-tier t-understand">Understand</span> |
| Middleware and CORS — request-scoped logging with ids, the browser preflight you will debug at least once | <span className="db-tier t-understand">Understand</span> |
| **Auth**: OAuth2 password flow, JWT bearer tokens, password hashing (bcrypt/argon2), scopes — the standard SPA + API arrangement | <span className="db-tier t-understand">Understand</span> |
| Long work doesn't belong in a request: `BackgroundTasks` for small things, a real queue (Celery/arq) for everything else — and the delivery-guarantee difference | <span className="db-tier t-understand">Understand</span> |
| **Serving**: uvicorn, workers vs processes, `--reload` in dev only — what "how many workers?" actually depends on | <span className="db-tier t-understand">Understand</span> |
| OpenAPI for free: the generated docs as the frontend contract, tagging, examples | <span className="db-tier t-know">Know</span> |
| Streaming responses, file uploads, WebSockets — the non-JSON endpoints | <span className="db-tier t-know">Know</span> |
| **Django** — the other pole: ORM, admin, auth included; when batteries-included beats assemble-your-own (and Django's async story, honestly) | <span className="db-tier t-know">Know</span> |
| Flask — the minimal WSGI baseline a decade of codebases are written in; read it fluently | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a FastAPI service with one resource: validated create,
paginated list, JWT-protected mutation, DB session via `Depends`, one error
shape — and the auto-docs page as the demo.

---

## Phase 10 — Data, files and integrations

The everyday I/O of a working service: files, JSON, the database, other
people's APIs, and time — tiered by how often each one pages someone.

| Topic | Tier |
|---|---|
| **`pathlib`**: `Path` everywhere, `/` joining, `glob`, `read_text`/`write_text` — modern path work, no `os.path` string surgery | <span className="db-tier t-master">Master</span> |
| Files properly: `with open(...)`, explicit `encoding="utf-8"` (the Windows-default bug), newline handling, binary mode, atomic-write patterns (temp + rename) | <span className="db-tier t-understand">Understand</span> |
| **`json`**: `load`/`dump`, the "`datetime` is not JSON serializable" rite of passage and its fixes, `orjson` when speed matters — and Pydantic as the typed alternative at boundaries | <span className="db-tier t-master">Master</span> |
| **`datetime` without regret**: **aware vs naive** (the bug class), `zoneinfo`, store UTC / convert at the edge, `date` vs `datetime`, ISO parsing — the same discipline as Java's `java.time`, same reasons | <span className="db-tier t-master">Master</span> |
| **HTTP clients**: `httpx` (sync and async, one API), **timeouts on every call**, retries with backoff, sessions/connection reuse — `requests` read-fluently as the legacy default | <span className="db-tier t-master">Master</span> |
| **PostgreSQL from Python**: `psycopg` 3 (and `asyncpg`), **parameterized queries always** — injection dies here too — connection pooling, transactions as context managers | <span className="db-tier t-master">Master</span> |
| **SQLAlchemy 2.0**: engine/session, the declarative models, `select()` style, relationships and their lazy-loading N+1 — the same disease as JPA, diagnosed the same way (log the SQL) | <span className="db-tier t-understand">Understand</span> |
| **Migrations with Alembic**: autogenerate (then *read the diff* — it misses renames), upgrade/downgrade, migrations in the repo and the pipeline | <span className="db-tier t-understand">Understand</span> |
| `sqlite3` in the stdlib — real SQL with zero setup: prototypes, tests, small tools | <span className="db-tier t-understand">Understand</span> |
| `csv` — dialects, `DictReader`, encodings from the wild; and the honest line where you reach for polars/pandas instead (recognition, not mastery — this is the backend track) | <span className="db-tier t-understand">Understand</span> |
| `tempfile`, `shutil`, `os` where pathlib ends — temp dirs in tests, tree copies, permissions | <span className="db-tier t-understand">Understand</span> |
| **`pickle` — the warning label**: arbitrary code execution on load; never for untrusted data, JSON at every boundary | <span className="db-tier t-know">Know</span> |
| Redis and MongoDB clients (`redis-py`, async variants) — the bible's other stores, driven from Python | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can pull JSON from an API with httpx (timeout,
retry), upsert it into Postgres with parameterized SQL in one transaction, and
every timestamp in the table is UTC-aware by construction.


---

## Phase 11 — REST APIs and CRUD, end to end

**The payoff phase, and the reason this track exists.** Phase 9 gave you FastAPI
mechanics; Phase 10 gave you a database. Neither one, alone, is an API. This
phase carries a single resource all the way through — create, read, update,
delete — with the design decisions, the status codes, the layering and the
transaction boundary that separate a demo from something a team maintains.

Protocol-level REST is already taught in this bible from the Node side, and
these pages **link there rather than re-derive it**: the
[Express REST surface](../../expressjs/pages/phase-6-rest-surface/README.md)
phase covers resources, status mapping, versioning, idempotency keys and ETags
as HTTP concerns. What follows is the half that is genuinely Python's — Pydantic
at the boundary, SQLAlchemy behind it, and the shape of a FastAPI project that
survives its fortieth endpoint.

| Topic | Tier |
|---|---|
| **What REST actually constrains**: resources not actions, URI design (plural nouns, how deep to nest, when to stop), the difference between "a REST API" and JSON over HTTP — and the honest note on where an RPC-shaped endpoint is the right answer | <span className="db-tier t-master">Master</span> |
| **The verb table**: GET/POST/PUT/PATCH/DELETE, **safe vs idempotent** and why the distinction is a retry policy rather than trivia, why POST is neither, `HEAD`/`OPTIONS` | <span className="db-tier t-master">Master</span> |
| **Status codes as a contract**: the CRUD → status map — 201 + `Location`, 200 vs 204, **400 vs 422** (FastAPI answers validation failures with 422 by default, and your frontend must be told), 404 vs 403 and what each leaks, 409 for conflicts — plus `status_code=` on the decorator | <span className="db-tier t-master">Master</span> |
| **The schema/model split**: `ProductCreate` / `ProductUpdate` / `ProductRead` beside the SQLAlchemy `Product`, `ConfigDict(from_attributes=True)`, and `response_model` as the leak-stopper — **the most common FastAPI design error is one class doing both jobs**, and the hashed password that reached a browser is how teams find out | <span className="db-tier t-master">Master</span> |
| **Layering a FastAPI service**: router → service → repository, what belongs in each layer, the folder layout that survives forty endpoints, and why a router should never contain a `select()` | <span className="db-tier t-master">Master</span> |
| **The session and the transaction boundary**: `Depends(get_db)` with `yield`, one transaction per request, **who commits** (the service, never the repository), rollback on exception, and the `DetachedInstanceError` that follows a commit | <span className="db-tier t-master">Master</span> |
| **Create**: body → validation → insert → **201 with `Location`** and the created resource; the check-then-insert race, and why the unique constraint — `IntegrityError` translated to 409 — is the only real fix | <span className="db-tier t-master">Master</span> |
| **Read**: one resource vs a collection, **404 vs an empty list** (different answers to different questions), `response_model` over a list, and the **N+1 that every list endpoint grows** — how to see it (echo the SQL) and `selectinload` as the fix | <span className="db-tier t-master">Master</span> |
| **Pagination, filtering and sorting**: offset/limit and its drift under concurrent writes, **keyset (cursor) pagination** in SQLAlchemy 2.0, a filter contract that does not decay into a query language, **sort whitelisting** (accepting a raw column name is `ORDER BY` injection), and the response envelope the frontend consumes | <span className="db-tier t-master">Master</span> |
| **Update — PUT vs PATCH**: full replacement vs partial, **`model_dump(exclude_unset=True)`** as the whole trick, the null-vs-absent problem PATCH inherits from JSON, and optimistic concurrency with `ETag` / `If-Match` instead of last-write-wins | <span className="db-tier t-master">Master</span> |
| **Delete**: 204 vs 200-with-body, **idempotent delete** (the second `DELETE` is still 204, not 404), **soft delete and everything it costs** — every query filters forever, unique constraints stop meaning what they said — cascade vs restrict at the foreign key | <span className="db-tier t-understand">Understand</span> |
| **The error contract**: one error shape for the whole API, **RFC 9457 Problem Details**, custom exception handlers, translating `RequestValidationError` into your shape, domain exceptions that never import `HTTPException` — and never letting a stack trace or an SQL string reach a client | <span className="db-tier t-master">Master</span> |
| **The frontend contract**: OpenAPI as the source of truth, **generating a typed TypeScript client** from it, and **CORS and the preflight** you will debug at least once — credentials, custom headers, and the wildcard origin that stops working the moment a cookie appears | <span className="db-tier t-understand">Understand</span> |
| **Auth for a real SPA**: bearer JWT vs an httpOnly cookie (the XSS/CSRF trade, stated honestly), access + refresh tokens, `Depends` chains that yield the current user, and **ownership checks pushed into the query** rather than the handler — 403 vs 404 as a disclosure decision | <span className="db-tier t-understand">Understand</span> |
| **Versioning, idempotency keys and caching**: URI vs header versioning and what actually counts as a breaking change, `Idempotency-Key` for POST retries, `ETag`/`If-None-Match` and `Cache-Control` on reads, bulk endpoints and their partial-failure shape | <span className="db-tier t-understand">Understand</span> |
| **Django REST Framework**, read fluently: serializers vs Pydantic, `ViewSet` + router vs explicit routes, permission classes, the browsable API — and the honest "when a shop picks DRF over FastAPI" (the admin, an ORM already in place, batteries over assembly) | <span className="db-tier t-know">Know</span> |
| **The capstone**: one resource, five endpoints, layered and transactional, paginated, error-shaped, tested against real Postgres and consumed by a React page — plus the review checklist to hold any CRUD endpoint against | <span className="db-tier t-understand">Understand</span> |

**Gate — deliverable:** a `/products` resource with all five endpoints, a
router that contains no SQL, a service that owns the transaction, keyset
pagination, one error shape, a generated TypeScript client that compiles, and
a React page that lists, creates and edits through it. You can defend every
status code it returns.

---

← Prev: [Part 2 — The data model](02-data-model.md) · Next → [Part 4 — Production](04-production.md)
