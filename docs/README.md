---
title: "Contents"
sidebar_label: "Contents"
sidebar_position: 0
slug: /
---

Every technology in the bible sits in its own folder, holding two things in this
order:

1. **Syllabus** — the topic inventory. What to learn, in what order, and **how
   hard to work on each item**. No explanations, no code.
2. **Explanations** — the actual pages, one per topic, with runnable code,
   gotchas and interview questions. Written phase by phase once the syllabus is
   approved.

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
| **[PostgreSQL](./postgresql/README.md)** | 4 parts · 229 topics | **Near complete** — [270 pages](./postgresql/pages/README.md) across 14 phases; 13 topics outstanding in phase 13 |
| **[JavaScript](./javascript/README.md)** | 5 parts · 337 topics | In progress — [45 pages](./javascript/pages/README.md), phases 0–3                   |
| **[TypeScript](./typescript/README.md)** | 4 parts · 187 topics | In progress — [37 pages](./typescript/pages/README.md), phases 0–2                   |
| **[CSS](./css/README.md)**               | 4 parts · 119 topics | In progress — [28 pages](./css/pages/README.md), phases 0–1                          |
| **[React](./react/README.md)**           | 4 parts · 244 topics | In progress — [14 pages](./react/pages/README.md), phase 0                           |
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
