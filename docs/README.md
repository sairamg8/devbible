---
title: "Contents"
sidebar_label: "Contents"
sidebar_position: 0
slug: /
---

:::info 🔒 Active work — who is writing what

Several Claude sessions work in this repo at once. **Check here before you start,
and add your own row when you claim something.**

| Area | Claimed by | Since | State |
|---|---|---|---|
| **React** — all of `docs/react/` | session `52a29103` | 2026-08-13 | 🔴 **Active.** **Phases 0–3 COMPLETE** (79 files); starting **Phase 4 · Effects**. See the [React claim notice](react/pages/README.md) |
| **PostgreSQL** — all of `docs/postgresql/` | session `052a10c2` | 2026-08-13 | ✅ **COMPLETE — RELEASED, free to pick up.** Phase 13 finished 18/18 (every stamp gone), plus new phase-2 topic 17 (money) and phase-3 topic 20 (multi-tenancy). **298 pages, 298 carrying `> Verified:`, 0 files over 300 lines, 0 broken links.** Topics 07–18 are documentation-validated under the no-new-sandboxes rule and say so inline. Remaining PG work is *review only* — the rubric pass and `/code-review ultra`. |
| **JavaScript** — all of `docs/javascript/` | session `01ECVvH5` | 2026-08-13 | 🔴 **Active.** **Phases 3, 4 and 5 Master tiers COMPLETE** — P3 01–08, P4 01/03–08, P5 01/02/04–07/09/10. Next: **Phase 6 · Iteration, destructuring and generators**. See the [JavaScript claim notice](javascript/pages/README.md) |
| **Unclaimed** | — | — | **MongoDB, Docker, Redis, Nginx have zero pages** — good places to start |

**Rules for a shared checkout:** never `git add -A` — stage explicit paths only.
`src/data/progress.js` is edited by everyone; touch only your language's rows.
`yarn build` exits 0 with broken links, so grep the log — but a **duplicate doc
id exits 1**, and that failure is often another session mid-write, so wait and
retry before investigating.

:::

Every technology in the bible sits in its own folder, holding two things in this
order:

1. **Syllabus** — the topic inventory. What to learn, in what order, and **how
   hard to work on each item**. No explanations, no code.
2. **Explanations** — the actual pages, one per topic, with runnable code,
   gotchas and interview questions. Written phase by phase once the syllabus is
   approved.

## 🔴 The critical rule — do not violate this

**The 300-line cap is a FILE-SIZE rule, never a content budget.**

It caps how much lives in one *file*. It says **nothing** about how much a
*topic* gets explained. A topic may run 1000+ lines in total — that is normal and
expected for a Master-tier topic.

- **Write the explanation the topic deserves FIRST, then split.** Never size a
  page to fit the cap. Never trim a section, drop a gotcha, or shorten interview
  answers to save lines. Coverage is fixed; file count is the variable.
- At 301 lines, **split on a concept boundary** into a topic directory:
  `NN-topic/` with `_category_.json`, a `README.md` index, and `NN-chunk.md`
  parts. Each chunk repeats the tier badge and `> Verified:` line and carries its
  **own** Gotchas and Interview questions.
- **The tell that you got this wrong:** a run of pages all landing in a narrow
  band just under the cap. Real topic lengths vary widely; clustering at ~200–290
  is evidence of budgeting, not of topics that happened to be that size.

Two rules that pair with it:

- **Never invent output.** Every number, timing and error string comes from a run
  that actually happened. No run means **no console block** — write the
  explanation without it rather than reconstructing one from memory.
- **No new sandboxes.** Validate against the official documentation or the web
  and **name the source** in the `> Verified:` line. Pages backed by an existing
  script are marked **sandbox-measured** so a reader can tell measured evidence
  from cited evidence.

**Link form:** every link ends in `.md` and keeps every numeric prefix —
`../01-inner-join/README.md` for a directory index,
`../01-inner-join/02-fan-out.md` for a file inside it. The directory-slug form
broke 188 links; never bulk-`sed` these.

## Priority tiers

Every topic carries exactly one tier. The tier answers *"how much effort does this
deserve right now?"* — it is about **effort allocation**, not importance.

| Badge                                                    | Tier                | Bar to clear                                                                                       |
| -------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| <span className="db-tier t-master">Master</span>         | Must Learn & Master | Use it confidently **without opening documentation**. If you look it up mid-task, you're not done. |
| <span className="db-tier t-understand">Understand</span> | Must Understand     | Know **how it works**, use it correctly. Looking up exact signatures is fine.                      |
| <span className="db-tier t-know">Know</span>             | Should Know         | Know **what it is, why it exists, when it's the right tool**. Details when needed.                 |
| <span className="db-tier t-when">When Needed</span>      | Learn When Needed   | **Don't study upfront.** Learn it the day a project demands it.                                    |

Tiers are assigned **for fullstack application development** — this bible's
purpose. `worker_threads` is <span className="db-tier t-know">Know</span> for a CRUD API and would be <span className="db-tier t-master">Master</span> at a
media-processing company. Where a tier is context-dependent, the syllabus says so.

## Coverage

Ordered by how far the explanations have got, not alphabetically.

| Technology                    | Syllabus              | Explanations                                                                      |
| ----------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| **[Node.js](./nodejs/README.md)**        | 4 parts · 248 topics | **Complete** — [232 pages](./nodejs/pages/README.md) across 13 phases                |
| **[PostgreSQL](./postgresql/README.md)** | 4 parts · 229 topics | **✅ COMPLETE** — [298 pages](./postgresql/pages/README.md) across 14 phases; every page carries a `> Verified:` line |
| **[JavaScript](./javascript/README.md)** | 5 parts · 337 topics | In progress — [45 pages](./javascript/pages/README.md), phases 0–3                   |
| **[TypeScript](./typescript/README.md)** | 4 parts · 187 topics | In progress — [37 pages](./typescript/pages/README.md), phases 0–2                   |
| **[CSS](./css/README.md)**               | 4 parts · 119 topics | In progress — [28 pages](./css/pages/README.md), phases 0–1                          |
| **[React](./react/README.md)**           | 4 parts · 244 topics | In progress — [79 pages](./react/pages/README.md), **phases 0–3 complete**, phase 4 next |
| **[Git](./git/README.md)**               | 4 parts · 191 topics | In progress — [14 pages](./git/pages/README.md), phase 0                             |
| **[Express](./expressjs/README.md)**     | 4 parts · 114 topics | **Draft** — [78 pages](./expressjs/pages/README.md) cover all 11 phases, but they are outlines awaiting depth and measurement |
| MongoDB                       | Not started           | —                                                                                   |
| Docker & Podman               | Not started           | —                                                                                   |
| Redis                         | Not started           | —                                                                                   |
| Nginx                         | Not started           | —                                                                                   |

Express is listed last on purpose: every phase has a file, so the sidebar looks
finished, but the pages average a third the depth of the rest and have not been
run against a sandbox yet.

## What "Verified" means

Every number, timing, error string and console block on a page comes from a script
that was actually executed — never from memory or plausibility. A page that has
been through that carries a `> Verified:` line under its title naming the versions
it was measured on. A page without one has not cleared that bar yet.
