---
title: "Link map · Python · Part 3b"
sidebar_label: "03b · Application (9–10)"
sidebar_position: 3
---

# Link map · Python · Part 3b (phases 9–10)

Covers every topic row of `docs/python/syllabus/03-application.md` for phase 9 (the web service, T09-01 to T09-14) and phase 10 (data, files and integrations, T10-01 to T10-13). That is 27 rows, numbered in table order. Part 3a holds phases 7–8, part 3c holds phase 11. No page of ours exists yet for these phases, so every row is 🔲.
*read* = I read the passage that carries the claim; *headings only* = fetched, title and headings checked. Every link was re-fetched with a browser User-Agent on 2026-10-12 and returned HTTP 200. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** docs.python.org `/3/` pages were titled Python 3.15.0 on 2026-10-12. FastAPI's JWT tutorial now uses `pwdlib` with Argon2 (18 hits for pwdlib, 2 for bcrypt), so older passlib-based tutorials are stale. psycopg docs were 3.3.7.dev1, SQLAlchemy docs are the 2.0 series, Alembic 1.20.0, Django's `/en/stable/` redirects to 6.1, Flask stable is 3.1.x.
Not fetchable: `realpython.com` (Cloudflare challenge, 403, on re-check; its picks were replaced), `github.com` (403; orjson is cited through raw.githubusercontent.com instead, see T10-03), `pypi.org` (bot challenge), `uvicorn.org` (proxy tunnel failure; the serving topic uses FastAPI's pages instead).

---

## Phase 9 — The web service

### T09-01 · WSGI vs ASGI — Understand · 🔲 not written
- **Read this:** [ASGI introduction](https://asgi.readthedocs.io/en/latest/introduction.html) · asgi.readthedocs.io · the spec authors set ASGI against WSGI (*read*) · covers our angle: **partial** — short; no framework implication · fetched 2026-10-12
- **Our delta:** why the framework choice implies a protocol.

### T09-02 · FastAPI routing — Master · 🔲 not written
- **Read this:** [Request Body](https://fastapi.tiangolo.com/tutorial/body/) · fastapi.tiangolo.com · Pydantic models as bodies (*read*) · covers our angle: **partial** — path and query params live on separate pages · fetched 2026-10-12
- **Also good:** [Response Model, Return Type](https://fastapi.tiangolo.com/tutorial/response-model/) · fastapi.tiangolo.com · `response_model` filtering what leaves (*read*) · fetched 2026-10-12
- **Our delta:** one page tying path, query, body and response together; see also the Path Parameters and Query Parameters pages on the same site.

### T09-03 · Pydantic v2 — Master · 🔲 not written
- **Read this:** [Models](https://docs.pydantic.dev/latest/concepts/models/) · docs.pydantic.dev · `BaseModel` and validation entry points (*read*) · covers our angle: **partial** — validators, serialization and settings are on sibling pages · fetched 2026-10-12
- **Also good:** [Validators](https://docs.pydantic.dev/latest/concepts/validators/) · docs.pydantic.dev · `field_validator` and `model_validator` (*read*) · fetched 2026-10-12
- **Our delta:** Pydantic as the guard for all external data, not just HTTP; serialization control (the Serialization page) and settings.

### T09-04 · Dependency injection with `Depends` — Understand · 🔲 not written
- **Read this:** [Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/) · fastapi.tiangolo.com · the session-per-request pattern (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Testing Dependencies with Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) · fastapi.tiangolo.com · the testable-by-override half (*read*) · fetched 2026-10-12

### T09-05 · Error handling — Master · 🔲 not written
- **Read this:** [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) · fastapi.tiangolo.com · `HTTPException`, custom handlers, overriding the validation handler (*read*) · covers our angle: **partial** — no mention of stack-trace leakage · fetched 2026-10-12
- **Our delta:** one error shape for the whole API, and never leaking a trace.

### T09-06 · `def` vs `async def` handlers — Understand · 🔲 not written
- **Read this:** [Concurrency and async / await](https://fastapi.tiangolo.com/async/) · fastapi.tiangolo.com · when each form is right, and the threadpool behind `def` (*read*) · covers our angle: full · fetched 2026-10-12

### T09-07 · Middleware and CORS — Understand · 🔲 not written
- **Read this:** [CORS](https://fastapi.tiangolo.com/tutorial/cors/) · fastapi.tiangolo.com · configuring CORSMiddleware (*read*) · covers our angle: **partial** — preflight gets only a short mention · fetched 2026-10-12
- **Also good:** [CORS, MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · the preflight mechanism in detail (*read*) · fetched 2026-10-12
- **Our delta:** request-scoped logging ids; the Middleware page on FastAPI's site covers the mechanism.

### T09-08 · Auth: OAuth2 password flow, JWT, hashing, scopes — Understand · 🔲 not written
- **Read this:** [OAuth2 with Password, Bearer with JWT tokens](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) · fastapi.tiangolo.com · password hashing with Argon2 via pwdlib and JWT end to end (*read*) · covers our angle: **partial** — scopes are on another page, bcrypt barely mentioned · fetched 2026-10-12
- **Also good:** [OAuth2 scopes](https://fastapi.tiangolo.com/advanced/security/oauth2-scopes/) · fastapi.tiangolo.com · the scopes half (*read*) · fetched 2026-10-12

### T09-09 · Background work: `BackgroundTasks` vs a queue — Understand · 🔲 not written
- **Read this:** [Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) · fastapi.tiangolo.com · small after-response work, with a pointer to Celery for heavier jobs (*read*) · covers our angle: **partial** — one Celery mention, no delivery-guarantee discussion · fetched 2026-10-12
- **Our delta:** the delivery-guarantee difference and arq or Celery as the real queue.

### T09-10 · Serving: uvicorn, workers, `--reload` — Understand · 🔲 not written
- **Read this:** [Server Workers, Uvicorn with Workers](https://fastapi.tiangolo.com/deployment/server-workers/) · fastapi.tiangolo.com · running several worker processes (*read*) · covers our angle: **partial** — the how-many question is on the concepts page · fetched 2026-10-12
- **Also good:** [Deployments Concepts](https://fastapi.tiangolo.com/deployment/concepts/) · fastapi.tiangolo.com · replication and what it depends on (*read*) · fetched 2026-10-12
- **Our delta:** `--reload` for dev only. uvicorn.org (not fetchable — unverified) was not used.

### T09-11 · OpenAPI for free — Know · 🔲 not written
- **Read this:** [Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/) · fastapi.tiangolo.com · tags and the generated docs (*read*) · covers our angle: **partial** — examples are separate · fetched 2026-10-12
- **Also good:** [Declare Request Example Data](https://fastapi.tiangolo.com/tutorial/schema-extra-example/) · fastapi.tiangolo.com · examples in the schema (*read*) · fetched 2026-10-12

### T09-12 · Streaming, uploads, WebSockets — Know · 🔲 not written
- **Read this:** [Request Files](https://fastapi.tiangolo.com/tutorial/request-files/) · fastapi.tiangolo.com · `UploadFile` (*read*) · covers our angle: **partial** — one of three non-JSON endpoints · fetched 2026-10-12
- **Also good:** [WebSockets](https://fastapi.tiangolo.com/advanced/websockets/) · fastapi.tiangolo.com · the WebSocket endpoint (*read*) · fetched 2026-10-12
- **Our delta:** streaming responses; the Custom Response page on FastAPI's site mentions `StreamingResponse` only briefly (6 hits).

### T09-13 · Django — Know · 🔲 not written
- **Read this:** [Django at a glance](https://docs.djangoproject.com/en/stable/intro/overview/) · docs.djangoproject.com · model, admin and the batteries tour (*read*) · covers our angle: **partial** — async story is separate · fetched 2026-10-12
- **Also good:** [Asynchronous support](https://docs.djangoproject.com/en/stable/topics/async/) · docs.djangoproject.com · the honest async picture (*read*) · fetched 2026-10-12

### T09-14 · Flask — Know · 🔲 not written
- **Read this:** [Quickstart, Flask 3.1.x](https://flask.palletsprojects.com/en/stable/quickstart/) · flask.palletsprojects.com · routes and the WSGI app object (*read*) · covers our angle: full · fetched 2026-10-12
- *Checked, not chosen:* the Flask Foreword page URL, which returns 404.

---

## Phase 10 — Data, files and integrations

### T10-01 · `pathlib` — Master · 🔲 not written
- **Read this:** [pathlib](https://docs.python.org/3/library/pathlib.html) · docs.python.org · `Path` joining, `glob` and text reads and writes, with a basic-use tour up top (*headings only*) · covers our angle: **partial** — a reference, not a tutorial · fetched 2026-10-12
- **Our delta:** the walk-through; Real Python's pathlib tutorial returned 403 on re-check and is not linked.

### T10-02 · Files properly: encoding, newline, atomic writes — Understand · 🔲 not written
- **Read this:** [Built-in functions, open](https://docs.python.org/3/library/functions.html) · docs.python.org · `encoding` and `newline` parameters (*read*) · covers our angle: **partial** — nothing on atomic temp-and-rename · fetched 2026-10-12
- **Also good:** [tempfile](https://docs.python.org/3/library/tempfile.html) · docs.python.org · the temp-file half of an atomic write (*headings only*) · fetched 2026-10-12
- **Our delta:** the Windows default-encoding bug and `os.replace` as the rename step.

### T10-03 · `json` and `datetime` serialization — Master · 🔲 not written
- **Read this:** [json](https://docs.python.org/3/library/json.html) · docs.python.org · the `default` hook is the fix for non-serializable types (*read*) · covers our angle: **partial** — no orjson, no Pydantic · fetched 2026-10-12
- **Also good:** [orjson README](https://raw.githubusercontent.com/ijl/orjson/master/README.md) · the project's own README (raw file; github.com itself returned 403) · serializes `datetime`, dataclass, numpy and UUID natively, datetimes as RFC 3339 strings (*read*) · fetched 2026-10-12
- **Our delta:** the datetime error and its fixes, and Pydantic as the typed alternative.
- *Checked, not chosen:* Real Python's JSON article (returned 403 on re-check, so not linked).

### T10-04 · `datetime` without regret — Master · 🔲 not written
- **Read this:** [datetime](https://docs.python.org/3/library/datetime.html) · docs.python.org · defines aware and naive objects precisely (*read*) · covers our angle: **partial** — a reference, no store-UTC-convert-at-edge policy · fetched 2026-10-12
- **Also good:** [Stop using utcnow and utcfromtimestamp](https://blog.ganssle.io/articles/2019/11/utcnow.html) · Paul Ganssle, 2019-11-05 · why naive UTC timestamps are a bug class (*read*) · fetched 2026-10-12
- **Our delta:** `zoneinfo` (see its docs page) and ISO parsing.

### T10-05 · HTTP clients with `httpx` — Master · 🔲 not written
- **Read this:** [Timeouts, HTTPX](https://www.python-httpx.org/advanced/timeouts/) · python-httpx.org · connect, read and the rest of the timeout model (*read*) · covers our angle: **partial** — retries are elsewhere · fetched 2026-10-12
- **Also good:** [Clients, HTTPX](https://www.python-httpx.org/advanced/clients/) · python-httpx.org · connection reuse through a `Client` (*read*) · fetched 2026-10-12
- **Our delta:** retries with backoff (transport retries cover connect failures only; see its Transports page) and `requests` read-fluently (the HTTPX Requests Compatibility page).

### T10-06 · PostgreSQL from Python — Master · 🔲 not written
- **Read this:** [Passing parameters to SQL queries](https://www.psycopg.org/psycopg3/docs/basic/params.html) · psycopg 3 docs · placeholders instead of string formatting, with the injection warning (*read*) · covers our angle: **partial** — pooling and transactions are separate · fetched 2026-10-12
- **Also good:** [Transactions management](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) · psycopg 3 docs · the context-manager transaction (*read*) · fetched 2026-10-12
- **Our delta:** connection pooling (the Connection pools page on the same site) and asyncpg.

### T10-07 · SQLAlchemy 2.0 — Understand · 🔲 not written
- **Read this:** [ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html) · docs.sqlalchemy.org · declarative models with Mapped and `select()` (*read*) · covers our angle: **partial** — relationships and N+1 are elsewhere · fetched 2026-10-12
- **Also good:** [Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html) · docs.sqlalchemy.org · lazy loading, N plus one, `selectinload` (*read*) · fetched 2026-10-12
- **Our delta:** diagnosing N+1 by logging the SQL (`echo` in Engine Configuration).

### T10-08 · Migrations with Alembic — Understand · 🔲 not written
- **Read this:** [Auto Generating Migrations](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) · Alembic 1.20.0 docs · what autogenerate detects and what it misses (*read*) · covers our angle: **partial** — nothing on the pipeline · fetched 2026-10-12
- **Also good:** [Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html) · Alembic docs · upgrade and downgrade (*read*) · fetched 2026-10-12
- **Our delta:** running migrations in CI and deploys.

### T10-09 · `sqlite3` — Understand · 🔲 not written
- **Read this:** [sqlite3](https://docs.python.org/3/library/sqlite3.html) · docs.python.org · connection, cursor and placeholders (*read*) · covers our angle: full · fetched 2026-10-12

### T10-10 · `csv` — Understand · 🔲 not written
- **Read this:** [csv](https://docs.python.org/3/library/csv.html) · docs.python.org · dialects, `DictReader`, the newline note (*read*) · covers our angle: **partial** — no polars or pandas line · fetched 2026-10-12
- **Our delta:** where to stop and reach for polars or pandas.

### T10-11 · `tempfile`, `shutil`, `os` — Understand · 🔲 not written
- **Read this:** [shutil](https://docs.python.org/3/library/shutil.html) · docs.python.org · tree copies and removal (*read*) · covers our angle: **partial** — temp dirs are on the tempfile page · fetched 2026-10-12
- **Also good:** [tempfile](https://docs.python.org/3/library/tempfile.html) · docs.python.org · `TemporaryDirectory` for tests (*headings only*) · fetched 2026-10-12

### T10-12 · `pickle`, the warning label — Know · 🔲 not written
- **Read this:** [pickle](https://docs.python.org/3/library/pickle.html) · docs.python.org · the security warning on untrusted data (*read*) · covers our angle: full · fetched 2026-10-12

### T10-13 · Redis and MongoDB clients — Know · 🔲 not written
- **Read this:** [redis-py guide](https://redis.io/docs/latest/develop/clients/redis-py/) · redis.io, page updated 2026-10-05 · connect, basic commands, and a short asyncio section (*read*) · covers our angle: **partial** — no guidance on when to pick which client · fetched 2026-10-12
- **Also good:** [Get Started with PyMongo](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/get-started/) · mongodb.com (the old pymongo.readthedocs.io tutorial URL redirects here) · `MongoClient` and `AsyncMongoClient` basics (*read*) · fetched 2026-10-12
- **Our delta:** sync versus async client choice inside a FastAPI service.

---

Part 3c continues with phase 11.
