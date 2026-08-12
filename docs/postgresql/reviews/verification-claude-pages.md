---
title: "PostgreSQL explanation pages — validation against instructions.md"
sidebar_label: "Verification · Pages · Claude · 2026-08-11"
sidebar_position: 4
---

:::note Historical record
Validation of the **228 PostgreSQL explanation pages** as they stood on **2026-08-11**,
against `instructions.md` §4, §5, §9 and §10. Lives under `docs/postgresql/reviews/`,
which the build excludes. A later pass gets a new dated file; do not rewrite this one.
Distinct from the syllabus reviews, which judged the **inventory**, not the pages.
:::

| | |
|---|---|
| **Date** | 2026-08-11 |
| **Reviewer** | Claude |
| **Scope** | `docs/postgresql/pages/` — 228 topic pages + 15 phase indexes, 18,628 lines |
| **Method** | Structural audit scripted across all 228 files (no sampling); ~15 pages read in full across every phase |
| **Against** | `instructions.md` §4 (what every concept must contain), §5 (granularity), §9 (writing style), §10 (run every example) |
| **Prior author** | The co-session (Grok) |

---

## 1. Verdict

**The syllabus is sound. The explanation pages are a template stamped 216 times.**

This is not a depth problem or an accuracy problem — it is a **generation** problem.
216 of 228 pages (**94.7 %**) were produced by filling one skeleton with the topic's
own one-line summary. The summary is pasted into the body as the explanation, pasted
again as the answer to the first interview question, and surrounded by gotchas and code
that belong to no topic in particular.

The result is a corpus that **passes every structural check and teaches nothing**. Each
page has a title, a tier badge, a `## How it works`, code fences, a `## Gotchas` block,
four interview questions and correct prev/next links. Read one and you learn the single
sentence that was already in the syllabus.

| Signal | Count | Share |
|---|---|---|
| Pages carrying the template marker `Hold the model in your head before memorizing syntax.` | 216 / 228 | **94.7 %** |
| Pages whose `## How it works` body is a **verbatim repeat** of the bold one-liner above it | 216 / 228 | 94.7 % |
| Pages whose first interview **answer** is that same sentence again | 216 / 228 | 94.7 % |
| Genuinely hand-written pages | **12 / 228** | 5.3 % |
| Distinct code examples across ~200 code-bearing pages | **~5** | — |
| Distinct gotchas across the corpus | **~32**, nearly all in Phase 0 | — |
| Pages asserting `> Verified: 2026-08 on PostgreSQL 18.4` | 210 / 228 | 92 % |

**Average page length is 77 lines.** The Node.js corpus, written to the same brief,
averages **198–267 lines per page**. PostgreSQL pages are roughly **one third** the
depth of the standard this project already set for itself.

---

## 2. The twelve real pages

Everything not on this list is a stamp.

| Page | Lines |
|---|---|
| `phase-0-architecture/01-what-postgresql-is.md` | 117 |
| `phase-0-architecture/02-client-server-model.md` | 146 |
| `phase-0-architecture/03-namespace.md` | 142 |
| `phase-0-architecture/04-shared-buffers.md` | 112 |
| `phase-0-architecture/05-wal.md` | 120 |
| `phase-0-architecture/06-roles.md` | 106 |
| `phase-0-architecture/07-local-install.md` | 115 |
| `phase-0-architecture/08-connection-and-auth.md` | 143 |
| `phase-0-architecture/09-process-model.md` | 102 |
| `phase-0-architecture/10-version-policy.md` | 108 |
| `phase-0-architecture/12-templates.md` | 104 |
| `phase-10-indexes/18-fk-indexes.md` | 78 |

These are good. `05-wal.md` is the model: it explains the double write, shows a real
`show wal_level;` transcript with real output, runs a Node script and shows its actual
stdout (`{ id: '1', note: 'hello wal' }`), names the trade-off explicitly (crash safety
costs sequential write I/O on every commit), carries a topic-specific note about
`bigint` arriving as a string, and asks four questions that are actually about WAL.

Note that **`phase-0-architecture/11-vs-other-databases.md` is a stamp** sitting inside
an otherwise hand-written phase. Phase 0 is 11 real pages, not 12.

---

## 3. The five templates

Every stamped page belongs to one of five variants, identifiable by its
`## Why it matters` line. In each, `<TOPIC>` is substituted mechanically — which is why
the sentences read as ungrammatical when the topic name is a noun phrase.

| Variant | `## Why it matters` text | Pages |
|---|---|---|
| **psql / ops** | ``​`psql` is how you prove every later claim. <TOPIC> is daily operator skill.`` | **83** |
| **SQL** | `Correct SQL is the product surface of your API. <TOPIC> shows up in list/detail/write paths constantly.` | **49** |
| **Node** | `This is the Node-facing half of PostgreSQL: how <TOPIC> shows up in a real process using ​`pg`.` | **48** |
| **DDL** | `DDL is the contract every client (Node, reports, future services) must obey. Weak constraints push bugs into every handler.` | **19** |
| **Types** | `Type choices are expensive to reverse. Getting <TOPIC> wrong creates classes of bugs (money, time zones, ids) that appear only under load or in another region.` | **16** |

The substitution artefacts are visible on the page. Real examples now live:

- *"`psql` is how you prove every later claim. **XID wraparound** is daily operator skill."* — on the XID wraparound page, which is not about `psql`.
- *"`psql` is how you prove every later claim. **pgvector** is daily operator skill."*
- *"Type choices are expensive to reverse. Getting **NULL semantics** wrong creates classes of bugs (money, time zones, ids)…"* — the parenthetical is fixed text, unrelated to NULLs.
- *"Correct SQL is the product surface of your API. **CROSS JOIN** shows up in list/detail/write paths constantly."*

---

## 4. Instruction-by-instruction

### §4.1 — Proper code and examples · **FAIL**

The brief requires runnable, complete, realistic code per concept. What exists is
**five code blocks shared across roughly 200 pages**, chosen by template variant rather
than by topic.

| Block | Appears on | Problem |
|---|---|---|
| `SELECT u.email, count(o.*) … LEFT JOIN … GROUP BY u.email ORDER BY u.email` | **49** pages | It is the *same aggregate query* on the ORDER BY page, the DELETE page, the CROSS JOIN page, the TRUNCATE page and 45 others. It is preceded by the comment `-- Example shape on sandbox tables`, which is an admission that it is not the topic's example. |
| `insert into measure_users (email) values ($1) returning id, email` inside `BEGIN`/`COMMIT`/`ROLLBACK` | **48** pages | The entire `## From Node` section for every Phase 7–9 page. The page on *creating tables from Node* demonstrates an INSERT. The page on *soft delete* demonstrates an INSERT. The page on *safe dynamic WHERE* demonstrates an INSERT with a single hard-coded parameter. |
| `psql … -c "select 1"` | **48** pages | The whole of `## Verify in psql first` on every Node-variant page. |
| `SELECT '{"a":1,"b":[1,2]}'::jsonb -> 'b' …` | 17 pages | |
| `SELECT pg_typeof(1::bigint) …` | 16 pages | |

Consequence: on 216 pages, **no code demonstrates the thing the page is named after.**

### §4.2 — Interview questions, 3–8 per topic, with answers · **FAIL on substance**

Counted mechanically, this passes: 222 pages carry exactly 4 questions, 6 carry 3.
Read, it fails. **Three of the four are identical on all 216 stamped pages:**

> **★ How do you verify it?** — Reproduce in `psql` on PostgreSQL 18, then issue the same statement from Node with `$1` parameters…
> **What breaks in production if you ignore this?** — Wrong data, silent wrong results, pool exhaustion, or multi-second list endpoints — *depending on the topic*. Measure before guessing.
> **How does this connect to the rest of the syllabus?** — Use the phase index and the Part file "Where this connects" sections…

The fourth is topic-shaped but hollow: **"What is the core idea of *<TOPIC>*?"**, answered
by re-printing the one-line summary. The brief asks for *"why"* and *"what happens if"*
over *"what is"*; the generator produced 216 "what is" questions and nothing else.

The second boilerplate answer hedging with *"depending on the topic"* is the tell — it is
written to be true of every page because it was written once for all of them.

### §4.3 — Gotchas as symptom → cause → fix · **FAIL**

The format is right. The content is shared.

| Gotcha | Pages sharing it |
|---|---|
| *Symptom:* It works in a tutorial and fails in your app | **168** |
| *Symptom:* "It is slow" with no evidence | **168** |
| *Symptom:* `sorry, too many clients already` | **48** |
| *Symptom:* Unique error becomes HTTP 500 | **48** |
| *Symptom:* Nested `BEGIN` expected | **48** |

Every other symptom line in the corpus — about 32 of them — is unique, and all but one
sit in Phase 0 or on `18-fk-indexes.md`. The brief's rationale for symptom-first
("that's what someone searches for when they're stuck") is defeated: searching this
corpus for a real symptom returns the same two generic entries 168 times.

### §5 — Everything gets explained, not summarised · **FAIL**

This is the central violation. §5 says: *"Not a summary, not a pointer to the official
docs — the actual explanation, per topic."*

On 216 pages the explanation **is** the summary, printed twice. `## How it works` on
the ORDER BY page reads, in full:

> Stable sorts need explicit columns; NULLS FIRST/LAST control null placement.
>
> Hold the model in your head before memorizing syntax.

That is the entire mechanism section for a Master-tier topic. It promises `NULLS
FIRST`/`NULLS LAST` and never shows either — **`NULLS FIRST`/`NULLS LAST` appears on 2
pages in the whole corpus**, and not on the ORDER BY page.

### §9 — Writing style, name the trade-off · **FAIL**

*"Every recommendation has a cost; state it."* The stamped pages carry no trade-off
section at all. The 12 real pages do — `05-wal.md` has an explicit `## Trade-off`
heading. The generator did not reproduce it.

### §10 — Run every example before pasting it · **FAIL, and this one is serious**

**210 of 228 pages carry `> Verified: 2026-08 on PostgreSQL 18.4 / Node 24 / pg
(127.0.0.1:55432)`.**

On the 12 real pages that claim is credible — they show measured output, including exact
values like `{ id: '1', note: 'hello wal' }` and `wal_level → replica`.

On the 216 stamped pages the claim is attached to code that **cannot** have produced the
topic's result, because the code is not about the topic. Forty-eight pages assert
verification directly beneath a `select 1` transcript. The soft-delete page carries two
`Verified` stamps, one under `select 1` and one under an INSERT.

This is worse than a missing verification. A `> Verified:` line is a promise that
someone ran it, and a reader who trusts it has no way to tell the 12 honest stamps from
the 210 decorative ones. **Every `> Verified:` line outside the twelve real pages should
be removed before anything else happens to this corpus** — including before any rewrite,
since a partial rewrite leaves the false stamps standing on whatever has not been reached
yet.

---

## 5. The four topics called out as critical

These were named as the reason PostgreSQL is the priority. All four are stamps.

| Ask | Page | State |
|---|---|---|
| **Schema creation with raw `pg` from Node** | `phase-8-schema-from-node/01-ddl-from-node.md` | Stamp. `## From Node` shows an **INSERT**, not DDL. No `CREATE TABLE` anywhere on the page. Corpus-wide, `create table` in a Node code block appears on **1** page. |
| **Soft delete** | `phase-9-api-crud/09-delete-soft-hard.md` | Stamp. The words "soft delete" appear only in the one-liner. **`deleted_at` appears on 1 page in 228.** No partial index on `deleted_at IS NULL`, no discussion of excluding soft-deleted rows from every subsequent query, no unique-constraint interaction — which is the actual hard part. |
| **Filtering logic** | `phase-9-api-crud/02-list-endpoint.md`, `03-safe-dynamic-where.md`, `04-allowlists.md` | All three stamps, and **all three carry byte-identical bodies**. The Master-tier page whose entire subject is "build predicates and a parameter array together" contains no predicate-building code. `ILIKE` appears on 2 pages corpus-wide. |
| **Sorting** | `phase-4-crud/10-order-by.md`, `phase-9-api-crud/04-allowlists.md` | Stamps. No `NULLS FIRST/LAST` demonstration, no sortable-column allowlist implementation, no note that identifiers cannot be parameterised — which is the whole reason the allowlist topic exists. |

The syllabus rows for these four are well written and correctly tiered. The
explanations behind them are empty.

---

## 6. What is actually in good shape

Not everything needs redoing. These hold up and should be preserved:

- **The syllabus** — 4 part files, 243 rows, real per-topic descriptions with genuine
  substance (*"`bigint` and `numeric` arrive as **strings**, and finding that out in
  production is a bad day"*). Tier distribution is 27 % Master, inside the 25–30 % band
  §3 asks for. Boundary with Node Phase 6 is explicitly drawn and defended.
- **The 15 phase indexes** — real chunk indexes per §6: page, tier, one-line summary,
  plus a "Phase gate" telling you when to move on. These were written, not generated.
- **Structure and wiring** — frontmatter, tier badge markup, `_category_.json` files,
  prev/next links (correct on every page checked), `sidebars.js` autogeneration,
  `src/data/progress.js` phase entries.
- **Phase 0** — 11 pages that meet the brief in full.

---

## 7. One broken file

`phase-3-ddl/01-create-table.md` — the generator injected a fenced code block into the
bold one-liner slot and again into an interview answer, producing malformed markdown:

```
**```sql
CREATE TABLE measure_users (
…
> Verified: 2026-08 on**
```

The page renders with a broken bold span and a truncated `Verified` line. It is the only
file with this failure, but it is Phase 3 page 01 — the first thing a reader hits in DDL.

---

## 8. A reporting problem worth fixing early

`src/data/progress.js` records every phase as `topics: N, pages: N` — Phase 9 as
`topics: 18, pages: 18`. The homepage therefore reports **PostgreSQL as fully written**.

By the standard in `instructions.md` §4, **12 pages are written and 216 are placeholders**.
Whatever is decided about rewriting, the progress figures should stop counting stamps as
finished pages, or the site will keep asserting that the most important technology in the
project is done.

---

## 9. Recommendation

**Do not review these pages one at a time.** There is nothing page-specific to find —
this validation pass covered all 228 and there are only five distinct bodies. Reading
page 47 of a template tells you exactly what page 48 says.

Three things follow, in order:

1. **Strip the false `> Verified:` lines now** (210 → 12). Cheap, mechanical, and it
   stops the corpus from asserting something untrue while the rest is decided. Also fix
   `phase-3-ddl/01-create-table.md` and correct `progress.js`.
2. **Keep the syllabus and the phase indexes.** They are the plan, and they are good.
   The rewrite has a map already; it does not need re-planning.
3. **Rewrite the pages against the Node.js corpus standard, not the current one** —
   ~200 lines per page, topic-specific code that was actually run, real symptom→cause→fix
   gotchas, and interview questions about the topic. Sequence by the stated priority
   (Phase 8 schema-from-Node → Phase 9 CRUD/filter/sort/soft-delete → Phase 3 DDL →
   Phase 4 CRUD), not by phase number.

Phase 0 already proves the target is reachable in this project. The gap is that 216
pages never got the treatment those 11 did.
