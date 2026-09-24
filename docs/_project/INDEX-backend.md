---
name: devbible-index-backend
description: devbible index shard — PostgreSQL, Node, Express, Docker & Podman, Redis, MongoDB, Nginx, Git, Python, DSA and system-design
metadata:
  type: reference
---

# devbible index — Backend / data

Postgresql, node, express, docker & podman, redis, mongodb, nginx, git, python, dsa and system-design.

**One line per memory: the claim, then the terms to search on.** If an entry tells you the
answer, the file has been duplicated into a surface every session loads — put the answer in
the file. Budget: 74 entries, sharded at 120 ([../shared/MEMORY-ARCHITECTURE.md](../shared/MEMORY-ARCHITECTURE.md)).

> 🗄️ **Not here? It is not missing.** The pre-2026-09-08 index, with the long-form summary
> of every entry, is verbatim in [INDEX-ARCHIVE.md](INDEX-ARCHIVE.md); closed lanes are in
> [LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md). Search all of it without loading any of it:
> `shared/scripts/recall.sh <terms>`


## Feedback — how the user wants this worked

- [Docker only 20260814](feedback_docker_only_20260814.md) — The standing instruction that locked session 40090c06 to Docker & Podman — full Node-style syllabus, own worktree,…
- [STANDING INSTRUCTION — Express, LOCKED (2026-08-14)](feedback_express_supersedes_react_only.md) — Express is a LOCKED standing order (2026-08-14, session b7f137c4) — how it started, what it superseded, and why… `b7f137c4`

## Standing decisions

- [MongoDB syllabus](project_mongodb_syllabus.md) — MongoDB syllabus — 15 phases, 204 topics, 4 parts, written 2026-08-14; zero pages, unclaimed, ready for any session… `{tags: "a"}` `{tags: ["a"]}` `{field: null}` `lean()`
- [PostgreSQL Phase 14 — real-world scenarios](project_postgresql_phase14_scenarios.md) — The approved but deferred Phase 14 syllabus — 18 real-world PG + Node scenarios, one working sandbox app each `phase 14` `scenarios`
- [PostgreSQL syllabus proposal](project_postgresql_syllabus.md) — The PostgreSQL syllabus proposal — 14 phases, 228 topics, awaiting user approval; the three instructions that shaped… `psql` `pg` `postgresql` `postgres` `syllabus`
- [Real-world addon syllabus — DESIGN](project_realworld_addon_syllabus_design.md) — Real-world addon syllabus — DESIGN (awaiting approval) · session 08ab5390 `08ab5390` `real world` `cookbook` `addon` `syllabus design`
- [Real World — the remaining 19 topics SPLIT THREE WAYS +…](project_realworld_split_3way.md) — The Real World track's remaining 19 topics split three ways by phase — chunk A (TypeScript), B (CSS recipes), C…
- [Redis syllabus](project_redis_syllabus.md) — Redis syllabus — the scope decision, the 74-topic inventory, version facts, and why this track was picked up `8679dc8c` `when needed` `node-redis` `ioredis` `redis`

## Reference

- [Express verification](reference_express_verification.md) — Express pages — the phase-by-phase quality cliff, the verification harness, the 4 measured errors, and the… `express` `expressjs` `verify` `cliff` `outline`
- [Fable's PostgreSQL corpus review](reference_fable_postgresql_review.md) — The Fable rubric review of the whole PostgreSQL corpus (2026-08-13) — the measured proof for item 14's re-split, one… `count(*)` `explain`
- [PostgreSQL FK syntax — banked quotes](research_postgresql_p3_fk_syntax.md) — Verbatim PG 18 quotes behind phase-3 `03b`/`03c`: REFERENCES vs FOREIGN KEY, MATCH types, legal FK targets, SET NULL column subsets — do not re-derive `references` `foreign key` `match full` `match simple` `composite`
- [PostgreSQL phase-13 concepts (07–18)](reference_postgresql_concepts_phase13.md) — The load-bearing concepts and cited sources behind PostgreSQL phase 13 topics 07-18, plus the two missing rows… `pg_upgrade` `truncate` `phase 13`
- [PostgreSQL pages validation](reference_postgresql_pages_validation.md) — PostgreSQL explanation pages are a template stamped 216 of 228 times — the full mechanical audit, the 12 real pages,… `verified:` `postgresql` `postgres`
- [PostgreSQL Phase 10 — indexes](reference_postgresql_phase10_indexes.md) — The measured dataset behind PostgreSQL Phase 10 (indexes and the planner) — what each of ex23–ex26 proved, including… `postgresql` `phase 10` `index`
- [PostgreSQL Phase 11 — MVCC and concurrency](reference_postgresql_phase11_mvcc.md) — The measured dataset behind the 16 Phase 11 pages — which open transactions actually block VACUUM, HOT/fillfactor,… `release()` `postgresql`
- [PostgreSQL Phase 12 — beyond plain tables](reference_postgresql_phase12_beyond_tables.md) — The measured dataset behind the phase-12 pages — GIN not serving ->> equality, jsonb costing 13x in storage, the… `->>` `42p17`
- [PostgreSQL Phase 13 — security, operations, production](reference_postgresql_phase13_ops.md) — The measured dataset behind PostgreSQL Phase 13 (security, operations, production) — privileges, secrets,… `vacuum` `maintain`
- [PostgreSQL Phase 1 — psql](reference_postgresql_phase1_psql.md) — The measured dataset behind the 15 Phase 1 psql pages — the -c interpolation trap, \i vs \ir, COPY vs \copy, exit… `-c` `\i` `\ir` `on_error_stop` `copy`
- [PostgreSQL Phase 2 — data types](reference_postgresql_phase2_types.md) — The measured dataset behind the 16 Phase 2 type pages — uuid v4 vs v7 index cost, jsonb bigger than json, the cast… `= any` `postgresql` `phase 2` `types`
- [PostgreSQL Phase 5 — joins](reference_postgresql_phase5_joins.md) — The measured dataset behind the 13 PostgreSQL Phase 5 join pages — the confounded LATERAL benchmark and its… `exists` `join` `distinct` `not in` `[]`
- [PostgreSQL Phase 6 — aggregation](reference_postgresql_phase6_aggregation.md) — The measured dataset behind PostgreSQL Phase 6 (aggregation, windows, CTEs) — the fixture seed bug that had to be… `count(distinct)`
- [PostgreSQL Phase 7 — the pg driver](reference_postgresql_phase7_driver.md) — The measured dataset behind PostgreSQL Phase 7 (the pg driver) — timeouts, prepared statements, type mapping,… `query_timeout` `fatal` `error`
- [PostgreSQL Phase 9 — API CRUD](reference_postgresql_phase9_api_crud.md) — The measured dataset behind the 18 phase-9 API-CRUD pages — the propagation bug that half-commits, jsonbagg losing… `jsonb_agg` `postgresql` `phase 9`
- [PostgreSQL sandbox](reference_postgresql_sandbox.md) — The PostgreSQL sandbox at sandbox/pg-api — container setup, connection facts, and what each of the 67 ex.mjs / ex.sh… `ex*` `devbible-mysql` `psql -c` `sandbox` `pg-api`

## Research behind the pages

- [Dsa phase0](research_dsa_phase0.md) — Banked primary-source quotes for docs/dsa/pages/phase-0-the-interview-and-practice/ (14 pages) — MDN…
- [Dsa phase1](research_dsa_phase1.md) — Banked primary-source quotes for docs/dsa/pages/phase-1-complexity/ (11 pages) — MDN Map/Set sublinear-access…
- [Dsa phase2](research_dsa_phase2.md) — Banked primary-source quotes for docs/dsa/pages/phase-2-recursion-maths-bits/ (13 pages) — MDN bitwise 32-bit…
- [Python 11 exceptions](research_python_11-exceptions.md) — Banked primary-source research for devbible Python phase 1 topic 11 (exceptions) — chaining, custom exceptions,…
- [Python p01 t12 eafp vs lbyl](research_python_p01_t12_eafp_vs_lbyl.md) — Banked primary-source research for devbible Python phase 1 topic 12 (EAFP vs LBYL) — the glossary definitions, the…
- [Python p02 t01 def and return](research_python_p02_t01_def_and_return.md) — Banked Research: Python Phase 2 · Topic 01 — def and return
- [Python p02 t02 parameters in full](research_python_p02_t02_parameters_in_full.md) — Banked Research: Python Phase 2 · Topic 02 — Parameters in full
- [Python p02 t03 scope and closures](research_python_p02_t03_scope_and_closures.md) — Banked Research: Python Phase 2 · Topic 03 — Scope and closures
- [Python p02 t04 lambda](research_python_p02_t04_lambda.md) — Banked Research: Python Phase 2 · Topic 04 — lambda
- [Python p02 t05 decorators](research_python_p02_t05_decorators.md) — Banked Research: Python Phase 2 · Topic 05 — Decorators
- [Python p02 t06 functools](research_python_p02_t06_functools.md) — Banked Research: Python Phase 2 · Topic 06 — functools
- [Python p02 t07 callables beyond functions](research_python_p02_t07_callables_beyond_functions.md) — Banked Research: Python Phase 2 · Topic 07 — Callables beyond functions
- [Python p02 t08 docstrings](research_python_p02_t08_docstrings.md) — Banked Research: Python Phase 2 · Topic 08 — Docstrings
- [Python p02 t09 annotations at runtime](research_python_p02_t09_annotations_at_runtime.md) — Banked Research: Python Phase 2 · Topic 09 — Annotations at runtime
- [Python p02 t10 recursion and the limit](research_python_p02_t10_recursion_and_the_limit.md) — Banked Research: Python Phase 2 · Topic 10 — Recursion and the limit
- [Python p03 t01 list internals](research_python_p03_t01_list_internals.md) — Banked, do not re-derive · listobject.c, complexity, Timsort, sorting HOWTO, 3.14 threadsafety · 1,077 lines
- [Python p03 t02 tuple](research_python_p03_t02_tuple.md) — Banked, do not re-derive · immutability, hashability, packing/unpacking, namedtuple · 1,142 lines
- [Python p03 t03 dict](research_python_p03_t03_dict.md) — Banked, do not re-derive · hash table, insertion order, views, merge, key contract · 1,000 lines
- [Python p03 t04 set and frozenset](research_python_p03_t04_set_and_frozenset.md) — Banked, do not re-derive · setobject.c, set algebra, hashing, 3.14 threadsafety · 950 lines
- [Python p03 t05 slicing](research_python_p03_t05_slicing.md) — Banked, do not re-derive · slice objects, indices(), copies vs views, islice, pagination · 747 lines
- [Python p03 t06 collections](research_python_p03_t06_collections_module.md) — Banked, do not re-derive · defaultdict, Counter, deque, namedtuple, ChainMap, OrderedDict, UserDict · 1,113 lines
- [Python p03 t07 heapq and bisect](research_python_p03_t07_heapq_and_bisect.md) — Banked, do not re-derive · heap invariant, nlargest, max-heaps 3.14, priority queues, bisect key=, insort
- [Python p07 t01 pyproject](research_python_p07_t01_pyproject.md) — Banked, do not re-derive · PEP 517/518/621/639/735, core metadata, backends · 800 lines
- [Python p07 t02 uv](research_python_p07_t02_uv.md) — Banked, do not re-derive · uv 0.12.12 — sync, lock, run, workspaces, uv pip, tools, config, build · 514 lines
- [Python p07 t03 dependencies](research_python_p07_t03_dependencies.md) — Banked, do not re-derive · PEP 440/508/621/631/735, lockfiles, resolution · 1,596 lines
- [Python p07 t04 project layout](research_python_p07_t04_project_layout.md) — Banked, do not re-derive · src vs flat, sys.path, pytest import modes, discovery, uv workspaces · 713 lines
- [Python p07 t05 ruff](research_python_p07_t05_ruff.md) — Banked, do not re-derive · ruff 0.16.6 lint/format, rules, fix safety, suppressions, pre-commit, CI · 533 lines
- [Python p07 t06 entry points](research_python_p07_t06_entry_points.md) — Banked, do not re-derive · console-script wrappers, entry_points.txt, importlib.metadata, plugins, uvx/pipx
- [Python p03 t08 copy and deepcopy](research_python_p03_t08_copy_and_deepcopy.md) — Banked, do not re-derive · copy.copy, deepcopy memo, __reduce_ex__, copy.replace, uncopyable types; §12 = 30-chunk plan
- [Python p03 t09 iteration idioms](research_python_p03_t09_iteration_idioms.md) — Banked, do not re-derive · enumerate, zip strict, reversed, any/all, min/max key=/default=, mutation while iterating
- [Python p07 t07 wheels and sdists](research_python_p07_t07_wheels_and_sdists.md) — Banked, do not re-derive · wheel tags, manylinux/musllinux, sdist, pip/uv build flags, missing-wheel errors; 19-chunk plan at the end
- [System design phase0](research_system-design_phase0.md) — Banked primary-source quotes for docs/system-design/pages/phase-0-the-interview/ (13 pages) — Norvig's latency…
- [System design phase1](research_system-design_phase1.md) — Banked primary-source quotes for docs/system-design/pages/phase-1-the-method/ (18 pages) — RFC 9110 safe/idempotent…
- [System design phase2](research_system-design_phase2.md) — Banked primary-source quotes for docs/system-design/pages/phase-2-request-path/ (18 pages) — RFC 6585 (429), RFC…
- [System design phase3](research_system-design_phase3.md) — Banked primary-source quotes for docs/system-design/pages/phase-3-caching/ (16 topics) — RFC 9111 HTTP caching…

## Progress — what happened, by lane

- [Docker chunk B — FINISHED, phases 6 storage + 7 networking…](progress_docker_chunk_b.md) — Docker & Podman chunk B (phases 6 storage, 7 networking) — per-file progress, decisions and traps. Session 17c9da97,… `17c9da97`
- [Docker chunk C — phases 8 Compose + 9 MERN/PERN stack…](progress_docker_chunk_c_findings.md) — Docker chunk C (phases 8 Compose + 9 MERN/PERN) — the verified per-page claims and fixed filenames. Open only when… `016j3kvb`
- [Docker chunk D · phase 11 — Podman in depth, evidence and…](progress_docker_chunk_d_phase11.md) — Docker chunk D · phase 11 Podman in depth — fixed filenames, per-topic record, and the verified Podman/systemd…
- [Docker chunk D · phase 12 — Delivery, CI and orchestration,…](progress_docker_chunk_d_phase12.md) — Docker chunk D · phase 12 Delivery, CI and orchestration — fixed filenames, per-topic record, and the verified…
- [DOCKER & PODMAN — locked, syllabus done, phase 0 next…](progress_docker_podman.md) — Docker & Podman track in devbible — the cold start, the 192-topic syllabus, the worktree it lives in, and the… `instructions.md` `40090c06`
- [DOCKER & PODMAN — the FOUR-WAY SPLIT, chunks A B C D…](progress_docker_split_4way.md) — The FOUR-way Docker & Podman split (chunks A B C D) — per-chunk phases, cursor, rules. Open this on "pick docker A" `016j3kvb`
- [EXPRESS — Master-tier depth pass COMPLETE (2026-08-14)](progress_express_master_depth_pass.md) — Express Master-tier depth pass — the live Express resume point, the measured depth defect, the 28-topic worklist and… `b7f137c4`
- [Express completion run](progress_expressjs_completion.md) — Express completion run — live resume point, per-phase state, the measured effort estimate, and what each of the… `8679dc8c` `qs` `simple` `body: undefined` `express`
- [Mongodb pages](progress_mongodb_pages.md) — Live progress of the MongoDB explanation pages — claimed 2026-08-14 on finishing CSS; Phase 0 under way,…
- [NGINX — new track, session 21fbf27e (2026-08-14)](progress_nginx_build.md) — devbible — Nginx track (session 21fbf27e, from 2026-08-14) `21fbf27e` `devbible-nginx` `nginx` `main` `keepalive`
- [Node.js completeness audit](progress_nodejs_completeness_audit.md) — Node.js completeness audit — 2026-08-14 (session 8679dc8c) `8679dc8c` `pages < topics` `progress.js` `> verified:` `done: true`
- [Node.js improvement pass — REVIEW DONE, GAPS QUEUED](progress_nodejs_improve_review.md) — Node.js — improvement pass (review first) · session 08ab5390 `08ab5390` `nodejs` `node js gaps` `gaps` `improve`
- [NODEJS P8 T28 · bcrypt — first topic under the topic skill…](progress_nodejs_p8_t28_bcrypt.md) — Node.js phase 8 topic 28 (bcrypt) — the first topic written under the devbible-topic skill, and what the run proved… `f08a412c`
- [PostgreSQL repo and build state](progress_postgresql_repo_and_build.md) — devbible's repo state (remote, Pages, branches, commit policy, shared checkout) and the build/link-mistake catalogue… `sandbox/` `5650954` `e40c5b3`
- [PostgreSQL review remediation](progress_postgresql_review_remediation.md) — Session 7 — the cross-phase correctness review's 14 findings, which 13 are fixed, the two review claims that failed… `j_orders` `created_at` `review`
- [PostgreSQL rewrite handoff](progress_postgresql_rewrite_handoff.md) — Live resume point for the PostgreSQL page rewrite — exactly which pages are done, what is next, and the house style… `052a10c2` `resume` `postgresql`
- [PostgreSQL earlier session log](progress_postgresql_session_log.md) — How each earlier PostgreSQL phase landed (phases 1,2,4,5,7,11) — the scripts, the counts and the lesson each session… `history` `how was this built`
- [PYTHON PHASE 7 — THE LIVE CURSOR](CURSOR-PYTHON-PHASE7.md) — separate lane, packaging/projects/tooling · version spine (uv 0.12.12, ruff 0.16.6, pre-commit 4.6.2) · wave plan · the parallel-agent rules that were paid for
- [PYTHON — THE LIVE CURSOR](progress_python_pages.md) — LIVE cursor for the devbible Python track — the lock, the syllabus extension that added Phase 11 (REST/CRUD), the… `f985178b` `exclude_unset` `dis` `-x importtime`
- [Real World track — build](progress_realworld_build.md) — Real World track — build progress · session 08ab5390 `08ab5390` `docs/real-world/` `a93a6724` `real world` `realworld`
- [Real World phase 7 CLOSED — the 2026-09-01 run](progress_realworld_p7_close.md) — The 2026-09-01 run that CLOSED Real World phase 7 — chapters 05 Dark mode and 06 The overlay layer. Chunk layouts,… `no-preference`
- [REAL WORLD — the resume point after the 2026-09-01…](progress_realworld_run_20260901.md) — THE RESUME POINT for Real World after the 2026-09-01 three-agent run. Phase 7 closed; phases 6 and 8 part-written by… `findoneandupdate`
- [Redis — the THREE-way split, chunks A B C](progress_redis_split_3way.md) — The THREE-way Redis split (chunks A B C) — per-chunk cursor, worklist, page shape and rules. Open this the moment… `3bb1face`
- [Docker chunk A — COMPLETE, phases 4 + 5 (2026-08-15)](progress_session_20260815_docker_chunk_a.md) — Session record — Docker chunk A (phases 4 and 5), COMPLETE 28/28 on 2026-08-15 (2e26b051 then e75b3868). Page… `e75b3868`
- [SESSION 2026-08-15 · 016J3KVb — Docker chunk C CLOSED, and…](progress_session_20260815_docker_chunk_c.md) — 2026-08-15 session 016J3KVb — Docker chunk C CLOSED (phases 8+9, 31/31) plus two self-inflicted defects worth…
- [SESSION 2026-08-14/15 — React Part B closed, MongoDB to 34/82](progress_session_20260815_react_b_mongodb.md) — Session record 2026-08-14/15 — React Part B (Phase 14) finished and merged, then MongoDB picked up and taken from 5…
- [Session 2026-08-17 — Real World + full corpus audit](progress_session_20260817_realworld_audit.md) — Session ab508775 on 2026-08-17 — closed Real World 5·05, fixed the PostgreSQL confounded benchmark, ran the full… `ab508775`
- [Site and node syllabus](progress_site_and_node_syllabus.md) — Live state of the devbible build — Node COMPLETE (232 pages), PostgreSQL 13 stamps left (phase-13 07-18 + phase-0… `tier-map.mjs` `tiers.mjs` `visited` `resume`

## Boards, cursors, briefs and plans

- [BRIEF DSA SYSTEM DESIGN](BRIEF-DSA-SYSTEM-DESIGN.md) — The drafting contract for the two new devbible tracks, docs/dsa/ and docs/system-design/ — file shape, tier badges,…
- [CURSOR DSA SYSTEM DESIGN](CURSOR-DSA-SYSTEM-DESIGN.md) — 🔴 START HERE for the two devbible tracks docs/dsa/ and docs/system-design/. Syllabi complete 2026-09-07; EXPLANATION…
- [CURSOR INTERVIEW](CURSOR-INTERVIEW.md) — 🔴 START HERE: interview-prep track (PERN/MERN, Java, Python) — 🔒 cursor + bank live in the private store
- [PLAN DSA](PLAN-DSA.md) — The per-phase topic scope for every DSA syllabus part (parts 01–08, phases 0–20), banked at the 90 % usage kill…
- [PLAN SYSTEM DESIGN](PLAN-SYSTEM-DESIGN.md) — The per-phase topic scope for every System Design syllabus part not yet written (parts 03–13, phases 4–23) — the…
- [Redis — paste-ready prompts for all three chunks](PROMPT-redis-chunks.md) — Paste-ready bootstrap prompts for the three Redis chunks (A, B, C) — hand one to each new session
