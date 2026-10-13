---
title: "Link map · Python · Part 6 (phases 10–11)"
sidebar_label: "06 · data and rest apis"
sidebar_position: 6
---

# Link map · Python · Part 6 (phases 10–11)

Covers every topic row of phases 10 and 11 in `docs/python/syllabus/03-application.md`: T10-01 to T10-13 (data, files and integrations) and T11-01 to T11-17 (REST APIs and CRUD). That is 30 rows. None has a written page yet: `docs/python/pages/` holds phases 0–3 and 7 only, so every block says 🔲 not written.
*read* = I read the passage; *headings only* = fetched, headings checked. *status 200 only* = the URL returned 200 after redirects but I did not read the passage, so treat the description as the page's purpose, not a verified quote. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Search coverage is incomplete.** The web-search tool was out of budget for the whole session, so the verification pass ran no searches of its own, and the 15-block spot-check of blocks without a Beyond line could not be done. The Beyond lines below were found by fetching known pages directly, and each one was fetched and read. Topics with no Beyond line (T10-06 to T10-08, T10-10, T10-13, T11-02 to T11-04, T11-07, T11-08, T11-10, T11-12, T11-13, T11-16) were not searched for a non-official explanation, so the absence does not mean none exists. Re-run the search pass for those when a budget is available.

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). Pages under `docs.python.org/3/` are the current docs. SQLAlchemy and Alembic links use the `en/20` and `latest` paths. Pydantic's docs moved: `docs.pydantic.dev/latest/` now redirects to `pydantic.dev/docs/validation/latest/`. The Django time zone page is the 6.1 edition. Several third-party picks predate Python 3.12 or 3.14 and are marked as such in the block.

---

## Phase 10 — Data, files and integrations

### T10-01 · `pathlib` — Master · 🔲 not written
- **Read this:** [pathlib — Object-oriented filesystem paths](https://docs.python.org/3/library/pathlib.html) · docs.python.org · splits pure paths from concrete paths that do I/O; `Path.read_text(encoding=None, errors=None, newline=None)` and `Path.write_text(data, ...)` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Why you should be using pathlib](https://treyhunner.com/2018/12/why-you-should-be-using-pathlib/) · Trey Hunner, 2018-12-21 · argues from the code: `os.path` forces nested calls that read inside-out, while `Path` chains methods, and most `os`, `shutil` and `open` accept a `Path` since 3.6; written for 3.6 and 3.7 · fetched 2026-10-13 (*read*)
- **Our delta:** no `os.path` string surgery at all. Real Python's pathlib article returned 403 to my fetch, so it is not listed.

### T10-02 · Files properly: encoding, newlines, binary, atomic write — Understand · 🔲 not written
- **Read this:** [Reading and Writing Files](https://docs.python.org/3/tutorial/inputoutput.html) · docs.python.org · the tutorial section on `open`, modes and `with` · fetched 2026-10-13 (status 200 only)
- **Also good:** [tempfile](https://docs.python.org/3/library/tempfile.html) · docs.python.org · `NamedTemporaryFile` for the write-then-rename step · fetched 2026-10-13 (status 200 only)
- **Also good:** [Adding atomicwrite in stdlib](https://discuss.python.org/t/adding-atomicwrite-in-stdlib/11899) · python.org discussion thread opened 2021-11-12 by Inada Naoki (methane) · proposes a hidden temp file then rename; participants say `os.replace` is documented atomic on Unix and want that on Windows, a Windows approach changes the new file's security descriptor, and `fsync` has a cost so one argues against adding it (without it a crash can leave a 0-byte file); a design debate, not a tutorial, and it never states "same directory" as a rule · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Atomic, cross-filesystem moves in Python](https://alexwlchan.net/2019/atomic-cross-filesystem-moves-in-python/) · Alex Chan, 3 March 2019 · `os.rename()` is atomic on one filesystem and fails across filesystems with `EXDEV`; `shutil.move()` is not atomic; the fix is a unique temp file in the destination directory, then rename; does not mention `os.replace` · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit `encoding="utf-8"` rule (Windows default bug) and `newline` handling are argued by neither non-official page.

### T10-03 · `json` and its typed alternatives — Master · 🔲 not written
- **Read this:** [json — JSON encoder and decoder](https://docs.python.org/3/library/json.html) · docs.python.org · `load`, `dump`, the `default=` hook and `JSONEncoder` · fetched 2026-10-13 (status 200 only)
- **Beyond the docs:** [orjson](https://github.com/ijl/orjson) · project README on GitHub · covers the `datetime` rules (RFC 3339 output, naive handling via an option), native dataclass, `UUID` and `numpy` support, the `default=` hook that must raise for types it does not handle (else the value becomes `null`), and the biggest migration change: `dumps` returns `bytes`; a library README, so it is the vendor's own benchmark claims · fetched 2026-10-13 (*read*)
- **Our delta:** Pydantic as the typed boundary is not covered by the README. I dropped the PYnative `datetime` tutorial (Vishal Hule, updated 14 May 2021) because it is thin and says nothing of `orjson` or Pydantic.

### T10-04 · `datetime` without regret: aware vs naive, `zoneinfo`, UTC — Master · 🔲 not written
- **Read this:** [datetime](https://docs.python.org/3/library/datetime.html) · docs.python.org · defines aware and naive objects at the top of the page · fetched 2026-10-13 (status 200 only)
- **Also good:** [zoneinfo](https://docs.python.org/3/library/zoneinfo.html) · docs.python.org · IANA time zones in the stdlib (3.9+) · fetched 2026-10-13 (status 200 only)
- **Also good:** [Time zones](https://docs.djangoproject.com/en/6.1/topics/i18n/timezones/) · Django 6.1 documentation · a datetime with `tzinfo` set and describing an offset is aware, otherwise naive; stores UTC even for a one-zone site because of daylight saving and uses local time only for users; framework-flavoured but the reasoning is general · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Stop using utcnow and utcfromtimestamp](https://blog.ganssle.io/articles/2019/11/utcnow.html) · Paul Ganssle, published 2019-11-05, updated 2022-10-09 · `utcnow()` returns a naive datetime that Python then treats as local time in `timestamp()` and `astimezone()`; use `datetime.now(tz=timezone.utc)` instead; shows the bug class but not `zoneinfo` · fetched 2026-10-13 (*read*)
- **Our delta:** a stdlib-only version with `datetime.now(timezone.utc)`, `zoneinfo` at the display edge and ISO parsing.

### T10-05 · HTTP clients: `httpx` — Master · 🔲 not written
- **Read this:** [Timeout configuration](https://www.python-httpx.org/advanced/timeouts/) · HTTPX docs · four timeouts (connect, read, write, pool) and a `TimeoutException` after 5 seconds of network inactivity by default (*read*) · fetched 2026-10-13
- **Also good:** [Transports](https://www.python-httpx.org/advanced/transports/) · HTTPX docs · where `HTTPTransport(retries=N)` is configured · fetched 2026-10-13 (status 200 only)
- **Also good:** [Tenacity](https://tenacity.readthedocs.io/en/latest/) · Tenacity docs · `retry`, `wait_exponential`, `wait_random_exponential` (jitter), `stop_after_attempt`, and async support (*read*) · [How to Web Scrape with HTTPX and Python](https://www.scrapingbee.com/blog/web-scraping-with-httpx/) · Ismail Ajagbe, ScrapingBee blog, 22 June 2026 · states `HTTPTransport(retries=N)` retries only connection failures, not 429 or 5xx, and that a `Client` reuses the TCP/TLS connection; vendor blog with a scraping slant (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · Marc Brooker, AWS Architecture Blog, 04 Mar 2015 · why capped backoff alone still clusters retries and how jitter spreads them (with 100 contending clients, Full Jitter cut the call count by more than half); not Python-specific, and the Full Jitter formula is an image I could not read · fetched 2026-10-13 (*read*)
- **Our delta:** `requests` read-fluently as the legacy default; the backoff-with-jitter code written out in httpx.

### T10-06 · PostgreSQL from Python: `psycopg` 3 and `asyncpg` — Master · 🔲 not written
- **Read this:** [Passing parameters to SQL queries](https://www.psycopg.org/psycopg3/docs/basic/params.html) · psycopg 3 docs · warns not to merge values into a query by string formatting; the placeholder is always `%s`, unquoted, even for numbers; values go as the second argument of `execute()` (*read*) · fetched 2026-10-13
- **Also good:** [Connection pools](https://www.psycopg.org/psycopg3/docs/advanced/pool.html) · psycopg 3 docs · [Transactions management](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) · psycopg 3 docs · [asyncpg](https://magicstack.github.io/asyncpg/current/) · asyncpg docs · fetched 2026-10-13 (status 200 only)
- **Our delta:** not searched for a non-official explanation. An earlier pass saw only generic guides that were not opened.

### T10-07 · SQLAlchemy 2.0 — Understand · 🔲 not written
- **Read this:** [SQLAlchemy Unified Tutorial](https://docs.sqlalchemy.org/en/20/tutorial/index.html) · SQLAlchemy 2.0 docs · engine, session, declarative models and `select()` · fetched 2026-10-13 (status 200 only)
- **Also good:** [Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html) · SQLAlchemy 2.0 docs · lazy loading means N objects cost N+1 SELECT statements; "selectin loading is the most simple and efficient way to eagerly load collections" in most cases (*read*) · fetched 2026-10-13
- **Our delta:** not searched for a non-official explanation.

### T10-08 · Migrations with Alembic — Understand · 🔲 not written
- **Read this:** [Auto Generating Migrations](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) · Alembic docs · table and column renames come out as an add/drop pair to hand-edit, and "it is always necessary to manually review and correct the candidate migrations" (*read*) · fetched 2026-10-13
- **Also good:** [Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html) · Alembic docs · fetched 2026-10-13 (status 200 only)
- **Our delta:** not searched for a non-official explanation.

### T10-09 · `sqlite3` in the stdlib — Understand · 🔲 not written
- **Read this:** [sqlite3](https://docs.python.org/3/library/sqlite3.html) · docs.python.org · includes a tutorial and a how-to section · fetched 2026-10-13 (status 200 only)
- **Beyond the docs:** [Going Fast with SQLite and Python](https://charlesleifer.com/blog/going-fast-with-sqlite-and-python/) · Charles Leifer, 2017-11-01 · the module's implicit transactions can hold the write lock longer than needed; `isolation_level=None` for autocommit plus explicit `BEGIN`; WAL mode lets readers work while one connection writes; PRAGMAs to set on each new connection; from 2017, so it predates newer transaction-control options in the stdlib docs and ends in `pysqlite3` build advice we do not need · fetched 2026-10-13 (*read*)
- **Our delta:** tests and small tools, not tuning.

### T10-10 · `csv` and the line to polars/pandas — Understand · 🔲 not written
- **Read this:** [csv — CSV File Reading and Writing](https://docs.python.org/3/library/csv.html) · docs.python.org · dialects, `DictReader`, the `newline` note · fetched 2026-10-13 (status 200 only)
- **Our delta:** not searched for a non-official explanation.

### T10-11 · `tempfile`, `shutil`, `os` where pathlib ends — Understand · 🔲 not written
- **Read this:** [tempfile](https://docs.python.org/3/library/tempfile.html) · docs.python.org · fetched 2026-10-13 (status 200 only)
- **Also good:** [shutil](https://docs.python.org/3/library/shutil.html) · docs.python.org · tree copies and removal · fetched 2026-10-13 (status 200 only)
- **Beyond the docs:** [tempfile — Temporary File System Objects](https://pymotw.com/3/tempfile/index.html) · Doug Hellmann, Python Module of the Week; page shows "last updated 2016-12-28" · example-driven tour of `TemporaryFile`, `NamedTemporaryFile`, `TemporaryDirectory` and `SpooledTemporaryFile`, and why unique names are made hard to guess; `tempfile` only, nothing on `shutil` or `os` permissions · fetched 2026-10-13 (*read*)
- **Our delta:** `shutil` tree copies and permissions in tests.

### T10-12 · `pickle` — the warning label — Know · 🔲 not written
- **Read this:** [pickle](https://docs.python.org/3/library/pickle.html) · docs.python.org · opens with "The pickle module is not secure. Only unpickle data you trust", says malicious data can execute arbitrary code during unpickling, suggests signing with `hmac` and `json` for untrusted data, and has a "Comparison with json" section (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Dangerous Pickles — Malicious Python Serialization](https://intoli.com/blog/dangerous-pickles/) · Evan Sangaline, Intoli, 2017-10-17 · builds a malicious pickle by hand from the `GLOBAL` and `REDUCE` opcodes so loading it calls `eval`, which shows why the warning is literal; the example is Python 2 style (`__builtin__`) · fetched 2026-10-13 (*read*)
- **Our delta:** JSON at every boundary and signing with `hmac`, as a policy, not an exploit demo.

### T10-13 · Redis and MongoDB clients — Know · 🔲 not written
- **Read this:** [redis-py documentation](https://redis.readthedocs.io/en/stable/) · redis-py docs · fetched 2026-10-13 (status 200 only)
- **Also good:** [PyMongo documentation](https://pymongo.readthedocs.io/en/stable/) · PyMongo docs · fetched 2026-10-13 (status 200 only)
- **Our delta:** not searched for a non-official explanation.

---

## Phase 11 — REST APIs and CRUD, end to end

### T11-01 · What REST actually constrains — Master · 🔲 not written
- **Read this:** [Representational State Transfer (REST)](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm) · Roy Fielding's dissertation, chapter 5 · the source of the constraints (sections 5.1.2 Client-Server through 5.1.7 Code-On-Demand, and 5.2 resources and representations); academic and long (*headings only*) · fetched 2026-10-13
- **Also good:** [REST APIs must be hypertext-driven](https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven) · Roy Fielding, 2008-10-20 · his complaint that many HTTP interfaces called REST are RPC; an API not driven by hypertext "cannot be RESTful" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html) · Martin Fowler, 2010-03-18 · steps from one tunnelled endpoint to resources, then verbs and status codes, then hypermedia, and says the model is a learning aid, not a definition of REST; its examples are XML over HTTP · fetched 2026-10-13 (*read*) · covers our angle: **partial** (no URI design or the RPC-is-sometimes-right note)
- **Our delta:** URI design (plural nouns, nesting depth) and the honest RPC case. Protocol-level REST is taught on the Express side of this bible.

### T11-02 · The verb table: safe vs idempotent — Master · 🔲 not written
- **Read this:** [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110.html) · IETF · its table of contents lists 9.2.1 Safe Methods and 9.2.2 Idempotent Methods, which are the definitions (*headings only*) · fetched 2026-10-13
- **Also good:** [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) · MDN · says methods can be safe, idempotent or cacheable and has a comparison table with those three columns; it links the definitions out rather than giving them (*read*) · fetched 2026-10-13
- **Our delta:** the retry-policy framing. Not searched for a non-official explanation.

### T11-03 · Status codes as a contract — Master · 🔲 not written
- **Read this:** [Response Status Codes](https://fastapi.tiangolo.com/tutorial/response-status-code/) · FastAPI docs · `status_code=` on the decorator, `status.HTTP_201_CREATED`, and the 1xx to 5xx ranges; it never mentions 422 (*read*) · fetched 2026-10-13
- **Also good:** [HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) · MDN · fetched 2026-10-13 (status 200 only)
- **Our delta:** the 400 vs 422 choice and 404 vs 403 leakage are ours to argue. Not searched for a non-official explanation.

### T11-04 · The schema/model split — Master · 🔲 not written
- **Read this:** [Response Model](https://fastapi.tiangolo.com/tutorial/response-model/) · FastAPI docs · `response_model` filters out everything not declared in the output model; the `UserIn` / `UserOut` example drops `password` (*read*) · fetched 2026-10-13
- **Also good:** [SQL (Relational) Databases](https://fastapi.tiangolo.com/tutorial/sql-databases/) · FastAPI docs · separate create, read and table models · [Models](https://pydantic.dev/docs/validation/latest/concepts/models/) · Pydantic docs · fetched 2026-10-13 (status 200 only)
- **Our delta:** `ConfigDict(from_attributes=True)` beside a SQLAlchemy model; not searched for a non-official explanation.

### T11-05 · Layering a FastAPI service — Master · 🔲 not written
- **Read this:** [Bigger Applications — Multiple Files](https://fastapi.tiangolo.com/tutorial/bigger-applications/) · FastAPI docs · routers and project layout; does not teach a service or repository layer · fetched 2026-10-13 (status 200 only)
- **Also good:** [fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) · zhanymkanov, GitHub README · one package per domain with `router.py`, `schemas.py`, `models.py`, `dependencies.py` and `service.py`; "SQL-first, Pydantic-second"; it has no section on a repository layer (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Repository Pattern (chapter 2)](https://www.cosmicpython.com/book/chapter_02_repository.html) · Cosmic Python, the online edition of a book on architecture patterns with Python (the preface names the authors only as Harry and Bob) · "The Repository pattern is an abstraction over persistent storage", with SQLAlchemy examples, and an honest note that it costs an abstraction layer and pays off mainly for complex domains; not FastAPI-specific · fetched 2026-10-13 (*read*) · covers our angle: **partial** (the repository half; no router or service split)
- **Our delta:** router, service, repository with no `select()` in a router.

### T11-06 · The session and the transaction boundary — Master · 🔲 not written
- **Read this:** [Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/) · FastAPI docs · a `yield` dependency for a database session, exit code runs after the response by default (`scope="request"`), and an exception caught without re-raising gives the client a 500 with no log (*read*) · fetched 2026-10-13
- **Also good:** [Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html) · SQLAlchemy 2.0 docs · commit flushes then commits and expires all objects (the source of `DetachedInstanceError`), `expire_on_commit` turns that off, and the session lifecycle should sit outside the functions using it (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Unit of Work Pattern (chapter 6)](https://www.cosmicpython.com/book/chapter_06_uow.html) · Cosmic Python · one `with uow:` block per use case, explicit commit, rollback by default, so "the default behavior is to not change anything"; notes the SQLAlchemy `Session` is already unit-of-work-like and the pattern narrows it; not FastAPI-specific · fetched 2026-10-13 (*read*) · covers our angle: **partial** (no `Depends(get_db)`)
- **Our delta:** the service owns the commit, never the repository.

### T11-07 · Create — Master · 🔲 not written
- **Read this:** [Response Status Codes](https://fastapi.tiangolo.com/tutorial/response-status-code/) · FastAPI docs · fetched 2026-10-13 (*read*)
- **Also good:** [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) · MDN · fetched 2026-10-13 (*read*)
- **Our delta:** 201 with `Location` and `IntegrityError` to 409 are ours; not searched for a non-official explanation.

### T11-08 · Read: one resource, a collection, and N+1 — Master · 🔲 not written
- **Read this:** [Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html) · SQLAlchemy 2.0 docs · lazy loading gives N+1 SELECTs; `selectinload` is the usual fix (*read*) · fetched 2026-10-13
- **Our delta:** echoing the SQL to see the N+1; not searched for a non-official explanation.

### T11-09 · Pagination, filtering and sorting — Master · 🔲 not written
- **Read this:** [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · Markus Winand, Use The Index, Luke, published 2014-08-06, updated 2023-09-08 · offset drifts and duplicates rows when new rows arrive between pages; the seek method filters on the last key seen and cannot jump to arbitrary pages, which suits infinite scroll; SQL-only, no SQLAlchemy (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** SQLAlchemy 2.0 keyset code, sort whitelisting and the response envelope. Only this one source was found and no query of its own was run for the topic.

### T11-10 · Update: PUT vs PATCH — Master · 🔲 not written
- **Read this:** [Body — Updates](https://fastapi.tiangolo.com/tutorial/body-updates/) · FastAPI docs · PUT replaces, and omitting a stored field resets it to the model default; PATCH plus `model_dump(exclude_unset=True)` and `model_copy(update=...)` gives partial updates; the input model must have every field optional (*read*) · fetched 2026-10-13
- **Our delta:** the null-vs-absent problem and `ETag` / `If-Match`; not searched for a non-official explanation.

### T11-11 · Delete — Understand · 🔲 not written
- **Read this:** [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) · MDN · the comparison table lists DELETE as not safe, idempotent, not cacheable; the DELETE entry itself says nothing about idempotence (*read*) · fetched 2026-10-13
- **Our delta:** soft delete costs and FK cascade vs restrict; not searched for a non-official explanation.

### T11-12 · The error contract — Master · 🔲 not written
- **Read this:** [Problem Details for HTTP APIs (RFC 9457)](https://www.rfc-editor.org/rfc/rfc9457.html) · IETF · media type `application/problem+json`; optional members `type`, `status`, `title`, `detail`, `instance`; obsoletes RFC 7807 (*read*) · fetched 2026-10-13
- **Also good:** [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) · FastAPI docs · `HTTPException`, custom exception handlers, overriding the `RequestValidationError` handler, and a warning that returning `str(exc)` can leak file and line details (*read*) · fetched 2026-10-13
- **Our delta:** one shape for the whole API and domain exceptions that never import `HTTPException`; not searched for a non-official explanation.

### T11-13 · The frontend contract: OpenAPI client and CORS — Understand · 🔲 not written
- **Read this:** [Generating SDKs](https://fastapi.tiangolo.com/advanced/generate-clients/) · FastAPI docs · generates a TypeScript client with Hey API (`@hey-api/openapi-ts`), groups methods by tag, and shows a custom `generate_unique_id_function` for cleaner method names (*read*) · fetched 2026-10-13
- **Also good:** [CORS (Cross-Origin Resource Sharing)](https://fastapi.tiangolo.com/tutorial/cors/) · FastAPI docs · [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · fetched 2026-10-13 (status 200 only) · [openapi-typescript](https://openapi-ts.dev/) · project site · turns OpenAPI 3.0 and 3.1 schemas into TypeScript types, a different tool from the Hey API one the FastAPI page uses (*read*) · fetched 2026-10-13
- **Our delta:** the preflight, credentials and wildcard-origin behaviour; not searched for a non-official explanation.

### T11-14 · Auth for a real SPA — Understand · 🔲 not written
- **Read this:** [Security](https://fastapi.tiangolo.com/tutorial/security/) · FastAPI docs · OAuth2 with password and bearer JWT; does not argue cookie vs bearer · fetched 2026-10-13 (status 200 only)
- **Beyond the docs:** [Please stop using local storage](https://dev.to/rdegges/please-stop-using-local-storage-1i04) · Randall Degges, DEV Community, 2018-01-30 · argues any XSS flaw or third-party script can read localStorage, so JWTs and session data belong in `httpOnly` cookies with `SameSite`; the comment thread disputes it (httpOnly does not stop an attacker acting from the victim's browser, and headers avoid CSRF), and he prefers server sessions over JWTs, which is a stronger claim than our syllabus makes · fetched 2026-10-13 (*read*) · covers our angle: **partial**
- **Our delta:** the XSS/CSRF trade stated both ways, access plus refresh tokens, and ownership checks in the query.

### T11-15 · Versioning, idempotency keys and caching — Understand · 🔲 not written
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API docs · how an `Idempotency-Key` header makes POST retries safe; a vendor's design, not a standard · fetched 2026-10-13 (status 200 only)
- **Also good:** [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) · Brandur Leach, Stripe blog, February 22, 2017 · client-generated key retried until success, plus exponential backoff with jitter against thundering herds; says PUT and DELETE are idempotent and POST needs a key (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur, brandur.org, October 27, 2017 · stores the key with recovery points (`started`, `finished`) and runs each atomic phase as a Postgres transaction, with a unique index on user and key; the code is Ruby, and it goes further than a basic POST-retry endpoint needs · fetched 2026-10-13 (*read*)
- **Our delta:** URI vs header versioning and ETag caching are not covered by any pick; not searched for a non-official explanation of those.

### T11-16 · Django REST Framework, read fluently — Know · 🔲 not written
- **Read this:** [Quickstart](https://www.django-rest-framework.org/tutorial/quickstart/) · Django REST framework docs · fetched 2026-10-13 (status 200 only)
- **Also good:** [ViewSets](https://www.django-rest-framework.org/api-guide/viewsets/) · Django REST framework docs · fetched 2026-10-13 (status 200 only)
- **Our delta:** not searched for a non-official explanation. The testdriven.io DRF vs FastAPI URL I tried returned 404, so nothing is listed.

### T11-17 · The capstone — Understand · 🔲 not written
- **Read this:** [Testing](https://fastapi.tiangolo.com/tutorial/testing/) · FastAPI docs · `TestClient`; the capstone also needs real Postgres, which this page does not cover · fetched 2026-10-13 (status 200 only)
- **Beyond the docs:** [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) · GitHub repo under the `fastapi` organization (the page names no author) · a complete reference build: FastAPI, SQLModel and Pydantic, PostgreSQL, JWT auth, pytest, a React and TypeScript frontend with an automatically generated client, and Docker Compose; README only, I did not read the code · fetched 2026-10-13 (*read*) · covers our angle: **partial** (SQLModel not plain SQLAlchemy; no keyset pagination or error-contract claim in the README)
- **Our delta:** a synthesis page with the review checklist; no pick covers the checklist.
