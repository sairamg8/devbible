---
name: progress-nextjs-ch16-crud
description: Chapter 16 (Next.js — Building a CRUD API with Postgres) — the fixed chapter-wide decisions three parallel forks were given, the lane split, and the pin gap found while opening it. Read with cursor-nextjs.
metadata:
  type: project
---

# Next.js chapter 16 · Building a CRUD API with Postgres — opened 2026-09-05

**Session `ae9a805f`**, immediately after closing ch19. The user's instruction:
*"pick ch16 and split work between 3 agents again and do not wait for my response make sure
your saving session progress and untill now all the completed work should pushed and monitor
the deployment"*.

The chapter index was written in a previous session and is **the contract** — 13 topics, each a
topic rather than a page, each carrying a bold *(not written yet)* placeholder. Its thesis, kept:
**ch15 answers WHICH, ch16 answers HOW and what breaks — CRUD is easy until two requests
overlap.** Almost every topic is a concurrency or a trust question wearing a REST verb as a
costume.

## 🔴 The chapter-wide decisions, fixed BEFORE the forks launched

This is the part that makes a three-fork chapter read as one build rather than three essays, and
it is the thing to copy. **All three briefs carried the identical block, verbatim.** A fork that
has to invent the resource, the schema or the stack will invent a different one from its
siblings, and the seams are invisible until a reader tries to follow the build across topics.

**The resource: SprintDesk `cards`.** A card belongs to a board; a board belongs to a team; a
team has members. Continues the application built across chapters 4–17.

**The HTTP surface**, assigned to lanes:

```
GET    /api/boards/[boardId]/cards      list             topic 06  (fork B)
POST   /api/boards/[boardId]/cards      create           topic 05  (fork B)
GET    /api/cards/[cardId]              read one         topic 06  (fork B)
PATCH  /api/cards/[cardId]              partial update   topic 07  (fork C)
PUT    /api/cards/[cardId]              full replace     topic 07  (fork C)
DELETE /api/cards/[cardId]              delete           topic 08  (fork C)
```

**The canonical `cards` schema**, given identically to every lane — `id`, `boardId` (FK cascade),
`title`, `body`, `status` (enum), `position` (sparse double), `version` (int, optimistic
concurrency), `createdAt`, `updatedAt`, `deletedAt` (nullable, soft delete), plus a composite
index on `(board_id, created_at, id)`.

🔴 **Three columns exist for a topic that is in a different lane, and each brief says who owns
which** — `version` is topic 07's, `deletedAt` is topic 08's, and the composite index is topic
06's keyset-pagination index. Every other lane may *reference* them and must not re-explain them.
⚠️ One deliberate cross-lane exception: `deletedAt` changes every read, so fork B was told to
carry the "forgot `WHERE deleted_at IS NULL`" gotcha even though it does not own soft delete.

**The ownership predicate is the chapter's spine:** a caller may touch a card only if they are a
member of the team that owns the board that owns the card, and it is enforced **inside the Data
Access Layer** (topic 04) so no Route Handler or Server Action can route around it.

**The single error envelope is topic 10's** — every other lane was explicitly forbidden from
defining a competing shape.

## The lanes and their position blocks

Non-contiguous blocks again, per the ch19 finding; the chapter is renumbered gap-free at close.

| Lane | Topics | Position block |
|---|---|---|
| fork A | 01 resource contract · 02 schema and migrations · 03 the connection · 04 the DAL | **10–29** |
| fork B | 05 CREATE · 06 READ — the two deepest topics, hence only two | **30–49** |
| fork C | 07 UPDATE · 08 DELETE · 09 transactions — the concurrency core | **50–69** |
| coordinator | 10 errors · 11 ownership · 12 testing · 13 milestone, then the index | **70–89** |

Lane B gets two topics rather than three deliberately: CREATE carries idempotency keys and the
`SQLSTATE`-to-status mapping, READ carries offset-versus-keyset pagination, and both are
multi-chunk topics on their own.

## 🔴 Carried into every brief from ch19: "the brief is not evidence"

The ch19 run produced two cases where a fork correctly refused a claim the coordinator had
written into its own brief. Every ch16 brief now ends with an explicit instruction that a
primary source **outranks the brief**, that contradicting it is wanted, and that a
`## What I could not confirm` section is a finding rather than a shortfall.

## Pin gap found and closed while opening the chapter

**`@neondatabase/serverless` had no pin**, while **three** ch15 pages already bolded
**`1.1.0`** on their `> Target:` lines — `06-project-milestone`, `01b-the-three-kinds-of-pool`
and `01g-prisma-the-generated-client`. The claim was correct (registry `latest` is `1.1.0`,
confirmed against registry.npmjs.org 2026-09-05) but **unwatched**.

🔴 **The failure mode is the lesson: a package no pin declares reports nothing, and "nothing"
renders identically to "no drift" on the currency board.** Added at `30f7d46b` with the
operational trap on its note — the HTTP driver (`neon()`) and the WebSocket driver
(`Pool`/`Client`) ship in the same package with different lifecycle rules, so a bump touches
both. ch16 itself references the driver **by name only** and makes no version claim.

## 🔴 STATE AT WIND-DOWN — 2026-09-05, session `ae9a805f` at 92%

**56 files · 12,499 lines · 888 ★ on disk, ALL COMMITTED AND PUSHED** (`origin/main` at
`c86fd705`). `docs/` and `src/` are clean. All three forks reported and closed.

| Lane | State | Commit |
|---|---|---|
| fork A · topics 01–04 | ✅ 18 files, 3,971 lines, positions 10–27 | `50117a49` |
| fork B · topics 05–06 | ✅ 15 files, 3,690 lines, positions 30–44 | `8e3562e2` |
| fork C · topics 07–09 | ✅ 19 files, 4,175 lines, positions 50–68 | `869f0911` |
| coordinator · topic 10 | ✅ 2 files, 401 lines, positions 70–71 | `99a63d35` |
| coordinator · topic 11 | ✅ 1 file, positions 72 | `c86fd705` |

**Chapter-wide QC at wind-down, all green:** 0 over cap (largest 285) · 0 missing tier badge,
`> Verified:`, `## Gotchas` or `## Interview questions` · **466 relative links, 0 dangling** ·
0 duplicate positions · 0 control bytes · 0 escaped backticks · 0 ` ```console ` · 0 MDX hazards.

### 🔴 START HERE — three things are owed, in this order

**1 · Topic 12 · Testing the API, and topic 13 · Project milestone are NOT WRITTEN.** They are
the coordinator's lane, positions **73 onward** in the block 70–89. The chapter index
(`01-explanation.md`) describes both:
- **12 · Testing the API** — what is worth asserting at the HTTP boundary vs in the DAL; the
  seed and reset story. ⚠️ ch13 owns runners and CI, so this topic must NOT re-teach them —
  the same constraint that reshaped topic 10.
- **13 · Project milestone** — the finished API wired to the UI and deployed. The model to copy
  is ch15's `06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md`.

**2 · Replace the 7 remaining `{/* FOOTER */}` markers.** Each lane's first and last file
carries one and the coordinator owns them all:
`01-the-resource-contract.md` · `04e-function-per-use-case.md` · `05-create.md` ·
`06g-conditional-requests-and-etag.md` · `07-update.md` · `09g-the-one-genuine-superpower.md` ·
`10-errors-and-one-response-shape.md`.
🔴 `grep -rln '^{/\* FOOTER \*/}$'` on the directory **must be empty** before the chapter closes.

**3 · Renumber gap-free 0–N in reading order, then rewrite `01-explanation.md`.** The index still
carries **13 bold *(not written yet)* placeholders** in its chunk table and its `Start →` footer;
every one becomes a real link. `grep -rn 'not written yet'` must then return only the genuinely
future topic-12/13 references, and nothing at all once those are written.

### Two overlaps a coordinator must reconcile at close

- **`ETag` is generated in two places.** fork B's `06g-conditional-requests-and-etag.md`
  (read side: `If-None-Match`, 304) and fork C's `07e-etag-if-match-and-412.md` (write side:
  `If-Match`, 412). They are genuinely different pages, but **the tag-generation function is
  defined twice** — one must cross-link the other rather than redefine it.
- **The `position` float scheme** is explained in fork B's `05ea-the-position-value-and-concurrent-creates.md`
  and again in fork C's `07g-position-collisions-and-updatedat.md`.

## What the three forks corrected, and why it is the most valuable output of the run

🔴 **Every fork contradicted a primary source or its own draft, and said so.** The instruction
that produced this — *"the brief is a starting point, not evidence; if a source contradicts it,
the source wins"* — is now proven twice over and belongs in every future fork brief.

**Fork A, on PostgreSQL 18 `ALTER TABLE`, correcting MY brief:**
- `ADD COLUMN … NOT NULL` with no default is **not** a rewrite-and-block. *"If no column
  constraints are specified, NULL is used as the `DEFAULT`"* — and NULL is what a `NOT NULL`
  column cannot hold, so on a populated table it **fails immediately**, regardless of size. It
  is widely taught as the opposite. The genuinely dangerous form is a **volatile** default,
  which does rewrite and looks identical to `DEFAULT now()` in a diff.
- A non-volatile default does not rewrite either — *"In neither case is a rewrite of the table
  required."*

**Fork B, correcting its own shipped code:** it wrote `CHECK (position = position)` to reject
`NaN` — correct in IEEE 754 and JavaScript, **wrong in PostgreSQL**, whose numeric-types
reference says *"PostgreSQL treats NaN values as equal, and greater than all non-NaN values."*
So `NaN = NaN` is true and the check passes. Now a finite-range check, and the trap is taught.

**Fork C, correcting its own draft:** an **invalid unique index is not inert.** *"if a failure
does occur in the second scan, the 'invalid' index continues to enforce its uniqueness
constraint afterwards"* while being *"ignored for querying purposes"* — so the hazard is an
**invisible active constraint**, not an absent one.

### 🔴 Two tooling findings worth more than the pages they sit in

**1 · `drizzle-orm` 0.45.2 WRAPS every driver error.** `pg-core/session.js` throws
`new DrizzleQueryError(queryString, params, e)` from six `catch` sites, and `errors.js` builds
the message as `` `Failed query: ${query}\nparams: ${params}` `` with `this.cause = cause`.
**So `err.code` is `undefined` and the SQLSTATE is on `err.cause.code`** — and logging
`err.message` leaks your SQL *and its bound parameters*, which is exactly what `10b` says must
never reach a log. Read from the published package; **not a documented API, so re-verify on any
bump.**

**2 · `WebFetch`'s summariser PARAPHRASES specification text.** It rendered RFC 9110 §9.3.5's
*"its current functionality"* as *"its current representation"*, and returned RFC 7231's 204
wording for a RFC 9110 request. 🔴 **Fetch the raw `.txt` from rfc-editor.org for any RFC quote.**
This is a general finding about the tool, not about RFCs.

### Smaller but load-bearing

- **Drizzle `.where()` ASSIGNS, it does not compose** (`this.config.where = where; return this`).
  A second `.where()` silently drops the tenancy scope and the soft-delete predicate — and the
  builder mutates `this`, so a hoisted base query is shared mutable state.
- **Drizzle `with:` is NOT an N+1** — it emits `lateral` + `json_agg`, one statement.
- **`updateTag` is Server-Action-only** — *"It cannot be used in Route Handlers"* — so a REST
  surface **structurally cannot** have read-your-own-writes through the cache. ✅ This resolves
  an open question banked in `research_nextjs_ch15_databases_and_api_design.md` §O.
- **`40003 statement_completion_unknown`** is in the error-code appendix but is **not** named as
  retryable by PG18 §13.5; treating it as retryable can double-apply a write.
- **PostgreSQL 18.6 shipped 2026-08-13**; the corpus pins **18.4**. Nothing written depends on
  the difference (class-23 codes are stable since 9.3) — **for the currency lane, not this one.**

## Found, not fixed

- 🔴 **`DATABASE_URL_DIRECT` vs `DIRECT_URL`.** ch15 `01b-the-three-kinds-of-pool.md` names the
  direct connection string `DATABASE_URL_DIRECT`; ch15 `01ga`, `01ia` and the ch15 milestone all
  use `DIRECT_URL`, and ch16 uses `DIRECT_URL` throughout. **ch15 `01b` is the odd one out** and
  a reader following both chapters gets two names for one variable.
- **17 unresolved link warnings in the site build** (run `33945403722`, which otherwise
  succeeded). None in ch19 or ch16. Mostly Next.js doc URLs written as **site-relative**
  (`/docs/app/…`) in ch9/ch10, so they render as internal 404s, plus dead anchors in ch10, ch15
  and one Java page. Spawned as its own task rather than folded into this chapter.

## Where this connects

- [[cursor-nextjs]] — the live resume cursor
- [[plan-nextjs-ch15b-crud-api-postgres]] — the original brief and the per-topic scope
- [[progress-nextjs-ch19-capstone]] — the fork-parallelism findings this run reuses
