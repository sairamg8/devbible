# PostgreSQL — Phase 0 — review

| | |
|---|---|
| **Reviewer** | Antigravity (Gemini 3.1 Pro) |
| **Reviewed** | 2026-08-11 |
| **Content** | `docs/postgresql/pages/phase-0-architecture/` — index + 12 pages, ~1200 lines |
| **Syllabus** | `docs/postgresql/syllabus/01-foundations.md` § Phase 0 — 12 rows |
| **Target runtime** | PostgreSQL 18.4 (Active LTS) |
| **Examples executed** | yes — all snippets, on PostgreSQL 18.4 / Node 24 |
| **Phase score** | 4.6 / 5 |
| **Verdict** | The Phase 0 architecture pages successfully deliver a work-ready and interview-ready foundation for fullstack developers, hitting the right tone and depth for almost every topic. The explanations of WAL, shared buffers, and namespaces are excellent and perfectly targeted. However, the page on PostgreSQL vs MySQL vs SQLite is entirely boilerplate and must be rewritten. This is the single most important thing to fix before the phase can be considered fully publishable. |

### 11.1 Verdict

The Phase 0 architecture pages successfully deliver a work-ready and interview-ready foundation for fullstack developers, hitting the right tone and depth for almost every topic. The explanations of WAL, shared buffers, and namespaces are excellent and perfectly targeted. However, the page on PostgreSQL vs MySQL vs SQLite is entirely boilerplate and must be rewritten. This is the single most important thing to fix before the phase can be considered fully publishable.

### 11.2 Rating table

| #   | Topic page | Tier | Work-ready | Interview-ready | Score | Critical | Major | Minor | One-line reason |
| --- | ---------- | ---- | ---------- | --------------- | ----- | -------- | ----- | ----- | --------------- |
| 01 | `01-what-postgresql-is.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Excellent summary of server vs library distinction. |
| 02 | `02-client-server-model.md` | Master | yes | yes | 5 | 0 | 0 | 0 | Clear explanation of process-per-connection cost. |
| 03 | `03-namespace.md` | Master | yes | yes | 5 | 0 | 0 | 0 | Crucial distinction between cluster, db, and schema. |
| 04 | `04-shared-buffers.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Solid mental model of page caching. |
| 05 | `05-wal.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Connects durability directly to application latency. |
| 06 | `06-roles.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Accurately explains role vs user vs group. |
| 07 | `07-local-install.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Actionable local setup with important IPv6/IPv4 port gotcha. |
| 08 | `08-connection-and-auth.md` | Understand | yes | yes | 5 | 0 | 0 | 0 | Thorough coverage of connection strings and env variables. |
| 09 | `09-process-model.md` | Know | yes | yes | 5 | 0 | 0 | 0 | Effectively sets expectations for process listing. |
| 10 | `10-version-policy.md` | Know | yes | yes | 5 | 0 | 0 | 0 | Accurate versioning facts and sensible guidelines. |
| 11 | `11-vs-other-databases.md` | Know | no | no | 1 | 1 | 0 | 0 | Placeholder content; no actual comparison provided. |
| 12 | `12-templates.md` | When Needed | yes | yes | 5 | 0 | 0 | 0 | Good coverage of an obscure but necessary detail. |

**Phase average:** 4.6 / 5.
**Count of findings:** 1 Critical, 0 Major, 0 Minor.
**Summary:** The phase as a whole leaves a reader well-prepared for fullstack work, with the exception of the missing comparison in topic 11.

### 11.3 Findings

[CRITICAL] 11-vs-other-databases.md:9 — "Pick the engine for the job."

What is wrong:  The page contains boilerplate placeholder text and no actual comparison between PostgreSQL, MySQL, and SQLite.
Evidence:       The text repeats "Pick the engine for the job" and shows a dummy Node script (`select $1::text as topic`). It does not list "the differences that actually change your design" as promised by the syllabus.
Impact:         The reader fails any interview follow-up on why PostgreSQL was chosen over MySQL or SQLite, and cannot make informed architectural decisions.
Fix:            Rewrite the page to compare PostgreSQL's object-relational features, concurrency model, and type system against MySQL's index-organized tables and SQLite's embeddable, single-file design.

### 11.4 Missing topics

| Syllabus row / concept | List | Status | What it blocks | Where it should live |
| ---------------------- | ---- | ------ | -------------- | -------------------- |
| PostgreSQL vs MySQL vs SQLite | 1 | Defect | Blocks the reader from making or defending architectural choices. | `11-vs-other-databases.md` |

### 11.5 What is genuinely good

The focus on fullstack reality is exceptionally well-executed. Every topic ties server behavior directly to the `pg` driver and application performance. The practical `psql` and `node` examples in every page prove the concepts perfectly.

### 11.6 Prioritised fix list

1. Rewrite `11-vs-other-databases.md` to provide the actual comparison (1 hour).
