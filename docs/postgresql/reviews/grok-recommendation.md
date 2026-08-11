---
title: "PostgreSQL proposed syllabus — recommendation (Grok)"
sidebar_label: "Recommendation · Grok · 2026-08-11"
sidebar_position: 1
---

:::note Historical record
Review of the **proposed** PostgreSQL syllabus as of **2026-08-11**. Lives under
`docs/postgresql/reviews/` (excluded from the built site). Not the live syllabus —
promote only after explicit approval. Later decisions should get a new dated file;
do not silently rewrite this one.
:::

| | |
|---|---|
| **Date** | 2026-08-11 |
| **Reviewer** | Grok (grok-4.5) |
| **Scope** | `docs/postgresql/reviews/proposed-syllabus/` — README + four part files |
| **Against** | `instructions.md` (goal, tiers, granularity, process); raw Postgres + `psql` + Node `pg` learning path |
| **Skills available** | `postgresql-table-design`, `postgresql-optimization` (no Supabase skill) |
| **Target versions (claimed)** | PostgreSQL **18.4**, Node **24** LTS, driver **`pg`** |

---

## 1. Verdict

**Agree — approve the inventory with bounded amendments, not a rework.**

This is a strong syllabus for the project goal: a central MERN/PERN reference that
teaches PostgreSQL toward **backend mastery**, not as isolated DBA trivia. The three
shaping instructions are implemented correctly:

1. Dedicated **Node + raw `pg`** part (Phases 7–9)
2. Dedicated **`psql`** phase (Phase 1)
3. Example policy tying concepts to application code

Direction is right: **raw SQL first**, ORMs left in Node Phase 6 as comparison, no
Prisma/Neon-first detour. Structure, tier story, version anchors, and process after
approval match how Express/Node syllabi are handled.

**Do not start explanation pages until this inventory is approved and promoted.**

---

## 2. What fits the brief

| Check | Assessment |
|---|---|
| Fullstack backend focus | Strong — CRUD API patterns, not pure theory |
| `psql` for control | Phase 1 earns its weight as the verification tool |
| Raw `pg` from Node | Parts 3 is the right home for migrations, seeding, repository SQL |
| Master ~25–30% | Claimed **60 / 228 (26%)** — inside band |
| Tiers as effort, not vanity | Perf/ops deliberately Understand-heavy — correct |
| Cross-links / “deliberately not here” | Clear; reduces scope creep into Redis/Nginx/Docker |
| Example policy (SQL + `pg` + real output + Node error shape) | Stricter than Node/Express — appropriate for a backend bible |
| Boundary table with Node Phase 6 | Honest about overlap; right default is recap + link |
| ORM stance | Raw-first confirmed as the learning path |
| Process after approval | Promote → `progress.js` → **stop** — correct |

Master-only claim is fair: design a schema, write the SQL a CRUD API needs, drive it
from Node, read an `EXPLAIN` when it gets slow.

Installed skills map cleanly:

- **table-design** → Phases 2–3 (+ index design in 10)
- **optimization** → Phases 10–12  
No Supabase skill is required for this inventory.

---

## 3. Recommendations (priority order)

### R1 — Approve the Node Phase 6 boundary exception, with a hard recap rule

**Agree with the proposed split** in the proposal README:

| Concern | Home |
|---|---|
| Pool sizing, exhaustion, lifecycle | Node 6 (written) |
| Transaction propagation through services | Node 6 (written) |
| N+1, repository *rationale*, ORM trade-off | Node 6 (written) |
| Writing SQL through the driver; DDL/seed/bulk; CRUD/pagination patterns | **PG Part 3** |

**Writing rule to add to the README before promotion:**

> Recap rows that touch Node 6 mechanics are **short**: about **≤ 40 lines**, one
> outbound link, **no second full treatment** of pool sizing, service-layer
> transaction propagation, N+1, or the ORM comparison.

Without that rule, Part 3 will quietly re-own Node 6.

### R2 — Soften the example policy for pure `psql` meta-command pages

The hard rule (“every page carries SQL **and** Node `pg`”) is right for Phases 2–13.
For **Phase 1** (`\d`, `\x`, `.psqlrc`, query buffer), a forced `pg` half is either
padding or fiction.

**Suggested policy:**

- **Phases 2–13:** both halves required (SQL/shell + Node meaning).
- **Phase 1:** `psql`-first by default; require a Node bridge only where the skill
  feeds application code (e.g. `\errverbose` / SQLSTATE → `error.code`; `\timing`
  vs app-side measurement).

### R3 — Accept full inventory; deliver in two waves (do not delete Part 4 from the map)

228 topics is large (second only to Node). Part 4 is still what separates “CRUD demo”
from production backend literacy.

| Wave | Scope | Outcome |
|---|---|---|
| **A — Build** | Parts 1–3 + **Phase 10** (indexes / `EXPLAIN`) | Design, query, wire Node, fix “why is this slow” |
| **B — Produce** | Phases 11–13 | Concurrency, advanced features, security & ops |

Optional later: treat Phase 12 as thinner “reference” pages after Wave A — demote
**delivery depth**, not the row inventory, until needed.

**Do not** drop Part 4 from the approved map just to feel smaller. Defer writing it.

### R4 — Topic-level amendments (high ROI)

**Add or promote**

| Change | Where | Why |
|---|---|---|
| **FK columns need explicit indexes** | Phase 3 and/or Phase 10 | PostgreSQL does not auto-index FKs; core gotcha (table-design skill) |
| **Covering indexes (`INCLUDE`)** | Phase 10 | Pairs with list endpoints and keyset pagination |
| **Common SQLSTATE map** | Near Phase 7 errors | Mini-table: `23505`, `23503`, `40001`, `40P01`, `57014` → HTTP / retry |
| Nested-TX illusion (savepoints vs true nesting from Node) | Phase 11 + Phase 9 | Stops a frequent wrong mental model |

**Deduplicate**

| Topic | Issue | Fix |
|---|---|---|
| Parameterized queries / `$1` | Master in **both** Phase 4 and Phase 7 | Canonical treatment in **Phase 7**; Phase 4 keeps “why never string-build values” + link |

**Keep as-is (do not expand the syllabus for these yet)**

| Topic | Stance |
|---|---|
| **`pgvector`** | One **When Needed** row — enough unless an AI feature track starts |
| FDW, procedures, table inheritance | Already When Needed — keep thin |
| Prisma / Drizzle | Stay in Node 6 comparison only |

### R5 — Granularity before writing pages

Pre-group so the first phase write does not thrash against the **300-line** cap:

- String / date function rows → one grouped page each (every function still gets an
  example; no per-function URLs)
- psql daily meta-commands → prefer “daily `\d` family” + “scripting” over many
  thin pages
- Window ranking vs navigation already split sensibly — keep that

**Optional polish:** one-line **gate** per phase (“move on when…”) like Express —
helps reading order without adding topics.

### R6 — Project process alignment

`instructions.md` still says **strict focus: Node.js**. That is fine while this stays
a **proposal**. On promotion:

1. Move parts to `docs/postgresql/syllabus/`
2. Add overview + sidebar + `progress.js` phases at `pages: 0`
3. Update project “Current state” so the map stays honest
4. **Stop** — explanation pages only when you explicitly start PostgreSQL page work
   (one technology at a time)

### R7 — Minor tier nits (non-blocking)

- **Disaster drill** (Phase 13 Know) sits under “backups are Master”. Either promote
  the drill to Understand or fold “restore once and verify” into the `pg_dump` Master
  page.
- Phase 0 postmaster/workers as Know is fine — do not expand into a mini DBA handbook.
- Phase 9 create/find/update/delete as Understand is right if `list` + safe dynamic
  `WHERE` + allowlists stay Master.

---

## 4. Answers to the proposal’s open questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Boundary exception with Node 6? | **Yes** — with the ≤40-line recap rule (R1) |
| 2 | 228 topics — accept or cut? | **Accept inventory**; deliver Wave A then B (R3) |
| 3 | ORM stance? | **Confirm raw-SQL-first**; Prisma/Drizzle stay in Node 6 |
| 4 | Bigger `pgvector` section? | **No** for now — one When Needed row |

---

## 5. Suggested approval package

Approve the proposed syllabus **if** the following are accepted as amendments to apply
on promotion (or in a short follow-up edit of the proposal README):

1. Node 6 boundary exception + recap length rule  
2. Phase 1 example-policy exception for pure meta-commands  
3. Wave A / Wave B delivery plan recorded in the overview  
4. Explicit **FK index** callout; **`INCLUDE`** indexes named in Phase 10  
5. Parameterized-query ownership: Phase 7 canonical, Phase 4 links  

Not required for approval:

- Supabase skill install  
- Expanding `pgvector`  
- Dropping Part 4 from the map  

---

## 6. What not to do next

- Do **not** scaffold all explanation pages  
- Do **not** mass-write Phase 12–13 before Parts 1–3 + Phase 10 exist  
- Do **not** re-teach pool sizing and ORM comparison at full length in Part 3  
- Do **not** treat this file as the live syllabus — it is a **recommendation only**

---

## 7. Next steps (for the human owner)

| Step | Action |
|---|---|
| A | Accept / reject / amend this recommendation |
| B | If accepted: edit proposal README with R1–R3 policy lines (or re-review) |
| C | Promote to `docs/postgresql/syllabus/` + overview + `progress.js` |
| D | Start pages **only** when explicitly requested — prefer Wave A phase order |

---

## 8. Source paths reviewed

```
docs/postgresql/reviews/proposed-syllabus/README.md
docs/postgresql/reviews/proposed-syllabus/01-foundations.md
docs/postgresql/reviews/proposed-syllabus/02-sql.md
docs/postgresql/reviews/proposed-syllabus/03-node-and-pg.md
docs/postgresql/reviews/proposed-syllabus/04-performance-and-production.md
```

Project brief: repo root `instructions.md`.
