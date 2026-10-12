---
title: "Link map · Python · Part 3c"
sidebar_label: "03c · Application (11)"
sidebar_position: 3
---

# Link map · Python · Part 3c (phase 11)

Covers every topic row of `docs/python/syllabus/03-application.md` phase 11, REST APIs and CRUD end to end: T11-01 to T11-17, 17 rows in table order. Parts 3a and 3b hold phases 7–10. No page of ours exists yet for this phase, so every row is 🔲.
*headings only* = fetched with a browser User-Agent, title, size and keyword counts checked against the claim, body not read end to end; nothing here is marked *read*. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** SQLAlchemy docs are the 2.0 series, Pydantic and FastAPI are the latest docs, MDN status pages use the current "422 Unprocessable Content" name. RFC 9457 (Problem Details) replaced RFC 7807, so any Problem Details article citing 7807 is stale. This phase deliberately links to the Node-side REST pages for protocol theory; the pages below are the outside references, not a replacement for those.
Not fetchable: `github.com` (403, so the popular FastAPI best-practices repo cannot be cited) and `pypi.org`. The OWASP JWT cheat sheet URL I tried returned 404 and is not used.

---

### T11-01 · What REST actually constrains — Master · 🔲 not written
- **Read this:** [REST APIs must be hypertext-driven](https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven) · Roy Fielding, 2008 · the author of REST says which JSON-over-HTTP APIs are not REST (*headings only*) · covers our angle: **partial** — theory, no URI design rules · fetched 2026-10-12
- **Also good:** [Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · Microsoft Azure Architecture Center · resource-oriented URIs and nesting, in practice (*headings only*) · fetched 2026-10-12
- **Our delta:** where an RPC-shaped endpoint is the honest answer.

### T11-02 · The verb table, safe vs idempotent — Master · 🔲 not written
- **Read this:** [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) · MDN · every method with its safe and idempotent properties (*headings only*) · covers our angle: **partial** — the retry-policy framing is ours · fetched 2026-10-12
- **Also good:** [Safe (HTTP Methods)](https://developer.mozilla.org/en-US/docs/Glossary/Safe/HTTP) · MDN · the definition of safe (*headings only*) · fetched 2026-10-12
- **Our delta:** why the distinction is a retry policy, and why POST is neither.
- *Checked, not chosen:* [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) · the normative text, 72,000 words, too long for a learner.

### T11-03 · Status codes as a contract — Master · 🔲 not written
- **Read this:** [HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) · MDN · the full code list with meanings (*headings only*) · covers our angle: **partial** — no CRUD map, no FastAPI 422 default · fetched 2026-10-12
- **Also good:** [422 Unprocessable Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422) · MDN · the code FastAPI returns for validation failures (*headings only*) · fetched 2026-10-12
- **Our delta:** 400 vs 422 for your frontend, and `status_code=` on the decorator (the Response Status Code page of FastAPI covers the syntax).

### T11-04 · The schema/model split — Master · 🔲 not written
- **Read this:** [Extra Models](https://fastapi.tiangolo.com/tutorial/extra-models/) · fastapi.tiangolo.com · separate input, output and database models, with the password example (*headings only*) · covers our angle: **partial** — no SQLAlchemy `from_attributes` link · fetched 2026-10-12
- **Also good:** [Response Model, Return Type](https://fastapi.tiangolo.com/tutorial/response-model/) · fastapi.tiangolo.com · `response_model` as the filter (*headings only*) · fetched 2026-10-12
- **Our delta:** `ConfigDict(from_attributes=True)` against an ORM class (documented on the Pydantic Models page).

### T11-05 · Layering a FastAPI service — Master · 🔲 not written
- **Read this:** [Bigger Applications, Multiple Files](https://fastapi.tiangolo.com/tutorial/bigger-applications/) · fastapi.tiangolo.com · `APIRouter` and the folder structure (*headings only*) · covers our angle: **partial** — routers only; no service or repository layer · fetched 2026-10-12
- **Our delta:** router, service and repository, and why a router never contains a `select()`. I found no fetchable article that explains the three layers well.
- *Not opened:* the zhanymkanov FastAPI best-practices repository (github.com returned 403, not fetchable — unverified).

### T11-06 · The session and the transaction boundary — Master · 🔲 not written
- **Read this:** [Transactions and Connection Management](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) · docs.sqlalchemy.org · begin, commit and rollback semantics of the Session (*headings only*) · covers our angle: **partial** — nothing on who commits in a layered service · fetched 2026-10-12
- **Also good:** [Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/) · fastapi.tiangolo.com · the `get_db` shape (*headings only*) · fetched 2026-10-12
- **Our delta:** the service commits, and the detached-instance error after a commit (`expire_on_commit` is documented on the Session Basics page; the error name did not appear there).

### T11-07 · Create — Master · 🔲 not written
- **Read this:** [201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/201) · MDN · what 201 and the `Location` header promise (*headings only*) · covers our angle: **partial** — nothing on the insert race · fetched 2026-10-12
- **Also good:** [409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409) · MDN · the code for a unique-constraint clash (*headings only*) · fetched 2026-10-12
- **Our delta:** check-then-insert race, and `IntegrityError` (Core Exceptions page of SQLAlchemy) translated to 409.

### T11-08 · Read, 404 vs empty list, N+1 — Master · 🔲 not written
- **Read this:** [Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html) · docs.sqlalchemy.org · `selectinload` and lazy-loading trade-offs (*headings only*) · covers our angle: **partial** — nothing on 404 versus empty list · fetched 2026-10-12
- **Our delta:** the two different questions behind 404 and an empty list, and echoing SQL to see the N+1 (`echo` in Engine Configuration).

### T11-09 · Pagination, filtering and sorting — Master · 🔲 not written
- **Read this:** [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · use-the-index-luke.com · why offset pages are slow and drift, and what seek replaces them with (*headings only*) · covers our angle: **partial** — SQL concept only, no SQLAlchemy code · fetched 2026-10-12
- **Also good:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · OWASP · allow-listing identifiers such as column names (*headings only*) · fetched 2026-10-12
- **Our delta:** keyset pagination in SQLAlchemy 2.0, the response envelope, and sort whitelisting as ORDER BY injection defence.
- *Checked, not chosen:* [Paginate Results](https://www.cockroachlabs.com/docs/stable/pagination) · CockroachDB docs · vendor-specific.

### T11-10 · Update, PUT vs PATCH — Master · 🔲 not written
- **Read this:** [Body, Updates](https://fastapi.tiangolo.com/tutorial/body-updates/) · fastapi.tiangolo.com · PUT versus PATCH and `exclude_unset` in one short page (*headings only*) · covers our angle: **partial** — no optimistic concurrency · fetched 2026-10-12
- **Also good:** [HTTP conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests) · MDN · `If-Match` and the lost-update problem (*headings only*) · fetched 2026-10-12
- **Our delta:** null versus absent in PATCH, and a version column (SQLAlchemy Versioning page) behind the ETag.

### T11-11 · Delete — Understand · 🔲 not written
- **Read this:** [204 No Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/204) · MDN · when 204 is the right answer (*headings only*) · covers our angle: **partial** — nothing on idempotent delete or soft delete · fetched 2026-10-12
- **Our delta:** the second DELETE still returning 204, soft delete costs, and cascade versus restrict. none found — tried: MDN, SQLAlchemy docs, FastAPI docs for soft delete.

### T11-12 · The error contract — Master · 🔲 not written
- **Read this:** [RFC 9457, Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) · rfc-editor.org · the standard error body, short at about 5,000 words (*headings only*) · covers our angle: **partial** — no FastAPI wiring · fetched 2026-10-12
- **Also good:** [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) · fastapi.tiangolo.com · custom handlers and overriding `RequestValidationError` (*headings only*) · fetched 2026-10-12
- **Our delta:** domain exceptions that never import `HTTPException`, and never leaking a trace or SQL string.

### T11-13 · The frontend contract — Understand · 🔲 not written
- **Read this:** [Generating SDKs](https://fastapi.tiangolo.com/advanced/generate-clients/) · fastapi.tiangolo.com · generating a TypeScript client from the OpenAPI schema (*headings only*) · covers our angle: **partial** — CORS is elsewhere · fetched 2026-10-12
- **Also good:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · preflight, credentials and the wildcard rule (*headings only*) · fetched 2026-10-12
- **Also good:** [openapi-typescript](https://openapi-ts.dev/introduction) · openapi-ts.dev · a generator that needs no runtime (*headings only*) · fetched 2026-10-12

### T11-14 · Auth for a real SPA — Understand · 🔲 not written
- **Read this:** [Get Current User](https://fastapi.tiangolo.com/tutorial/security/get-current-user/) · fastapi.tiangolo.com · a `Depends` chain yielding the current user (*headings only*) · covers our angle: **partial** — nothing on cookies, refresh tokens or ownership checks · fetched 2026-10-12
- **Also good:** [Cross-Site Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · the CSRF half of the cookie trade-off (*headings only*) · fetched 2026-10-12
- **Our delta:** the bearer-versus-httpOnly-cookie trade (the OWASP HttpOnly page is the XSS half), refresh tokens, and ownership checks inside the query.

### T11-15 · Versioning, idempotency keys and caching — Understand · 🔲 not written
- **Read this:** [Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · Microsoft Azure Architecture Center · URI versus header versioning among its sections (*headings only*) · covers our angle: **partial** — idempotency keys and caching are minor here · fetched 2026-10-12
- **Also good:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API reference · the Idempotency-Key header as shipped in a real API (*headings only*) · fetched 2026-10-12
- **Also good:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · `Cache-Control` and ETag revalidation (*headings only*) · fetched 2026-10-12
- **Our delta:** what counts as breaking, and the bulk-endpoint partial-failure shape.
- *Checked, not chosen:* the IETF Idempotency-Key header draft, a stub on the page I fetched.

### T11-16 · Django REST Framework — Know · 🔲 not written
- **Read this:** [Quickstart, Django REST framework](https://www.django-rest-framework.org/tutorial/quickstart/) · django-rest-framework.org · serializers, a `ViewSet` and a router in one tutorial (*headings only*) · covers our angle: **partial** — no Pydantic or FastAPI comparison · fetched 2026-10-12
- **Also good:** [Permissions](https://www.django-rest-framework.org/api-guide/permissions/) · django-rest-framework.org · permission classes (*headings only*) · fetched 2026-10-12
- **Our delta:** serializers versus Pydantic, and when a shop picks DRF.

### T11-17 · The capstone — Understand · 🔲 not written
- **Read this:** [Testing](https://fastapi.tiangolo.com/tutorial/testing/) · fastapi.tiangolo.com · `TestClient` for endpoint tests (*headings only*) · covers our angle: **partial** — not against real Postgres, no React page · fetched 2026-10-12
- **Also good:** [testcontainers-python](https://testcontainers-python.readthedocs.io/en/latest/) · testcontainers docs · a throwaway Postgres container for tests (*headings only*) · fetched 2026-10-12
- **Our delta:** the review checklist for any CRUD endpoint, and the React consumer.

---

Part 3c ends the application layer.
