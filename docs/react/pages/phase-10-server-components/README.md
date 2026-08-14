---
title: "Phase 10 — Server Components and Server Functions"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line names
> its sources.

🚧 **15 of 19 topics written** — 17 leaf pages. The whole Master tier is done.

**The largest change to React since hooks, and the one most often described wrongly.**
Two directives, two module graphs, one serialization boundary — get those three right and
everything else in this phase follows from them. Almost every confusing RSC error message
is really a question about which graph a file ended up in.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[What a Server Component is](01-what-a-server-component-is/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | Runs ahead of time, in a separate environment, and its code never reaches the browser |
| 02 | **[The two module graphs](02-two-module-graphs.md)** | <span className="db-tier t-master">Master</span> | Server and client are separate builds with a boundary between them |
| 03 | **[`'use client'`](03-use-client.md)** | <span className="db-tier t-master">Master</span> | An **entry point into the client graph**, not "this file is a component" |
| 04 | **[`'use server'`](04-use-server.md)** | <span className="db-tier t-master">Master</span> | Marks a **Server Function**, and has nothing to do with Server Components |
| 05 | **[What crosses the boundary](05-what-crosses-the-boundary.md)** | <span className="db-tier t-master">Master</span> | Only serializable values — the exact list, and the error each violation gives |
| 06 | **[Server Function security](06-server-function-security/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | Every Server Function is a public endpoint anyone can call with any arguments |
| 07 | **[Passing Server Components as `children`](07-server-components-as-children.md)** | <span className="db-tier t-understand">Understand</span> | Wrap server-rendered content in a Client Component without pulling it client-side |
| 08 | **[Async components](08-async-components.md)** | <span className="db-tier t-understand">Understand</span> | `await` your data in render, with a Suspense boundary above it |
| 09 | **[Calling Server Functions from the client](09-calling-server-functions.md)** | <span className="db-tier t-understand">Understand</span> | RPC over the network — as a form action, in a transition, from a handler |
| 10 | **[Composition rules](10-composition-rules.md)** | <span className="db-tier t-understand">Understand</span> | Server renders client; client receives server as a prop; functions cross inward |
| 11 | **[Where interactivity goes](11-where-interactivity-goes.md)** | <span className="db-tier t-understand">Understand</span> | Push `'use client'` down to the leaves that genuinely need state |
| 12 | **[The December 2025 advisories](12-december-2025-advisories.md)** | <span className="db-tier t-understand">Understand</span> | The critical RCE, then the DoS and source-code exposure follow-ups |
| 13 | **[The RSC payload](13-the-rsc-payload.md)** | <span className="db-tier t-understand">Understand</span> | The Flight wire format — rows describing a tree, not HTML and not JSON |
| 14 | **[The renderer packages](14-renderer-packages.md)** | <span className="db-tier t-understand">Understand</span> | `react-server-dom-webpack` / `-turbopack` / `-parcel` and the `react-server` condition |
| 15 | **[Data fetching in RSC](15-data-fetching-in-rsc.md)** | <span className="db-tier t-understand">Understand</span> | No client waterfall, `cache()` to deduplicate, parallel sibling awaits |
| 16 | **[Next.js App Router vs React Router 7/8](16-nextjs-vs-react-router.md)** | <span className="db-tier t-understand">Understand</span> | The two mainstream implementations and what transfers between them |
| 17 | **[When RSC is the wrong choice](17-when-rsc-is-wrong.md)** | <span className="db-tier t-understand">Understand</span> | A 95 %-interactive dashboard, a static host, a working API. Saying no is valid |
| 18 | **[Server Components without a framework](18-without-a-framework.md)** | <span className="db-tier t-know">Know</span> | What you would have to build yourself, and why nobody does |
| 19 | **[Taint APIs](19-taint-apis.md)** | <span className="db-tier t-know">Know</span> | Make passing a secret to the client a runtime error instead of a leak |

## Why this phase sits after Phase 9

Because Actions and Server Functions were designed as one feature.
[Phase 9](../phase-9-forms-actions/README.md) established what `<form action={fn}>` does —
`FormData`, a transition, pending state, reset on success — and ended two topics on
conditions it could not yet explain: progressive enhancement requires **a Server Component
rendering the form and a Server Function as its action**. This phase is the other half of
that sentence.

Read the other way: everything here inherits Phase 8's concurrency and Phase 9's Action
semantics. A Server Function called from a form is still a transition; the only new thing
is that the function body runs somewhere else.

## The three ideas everything else hangs off

1. **A Server Component runs in a separate environment, ahead of time** — before bundling,
   either at build time or per request. Its code is never sent to the browser
   ([topic 01](01-what-a-server-component-is/README.md)).
2. **There are two module graphs, and `'use client'` is the door between them**
   ([topic 02](02-two-module-graphs.md), [topic 03](03-use-client.md)). A file is in the
   client graph if it has the directive *or is imported by something that does*.
3. **Only serializable values cross** ([topic 05](05-what-crosses-the-boundary.md)). Every
   "Functions cannot be passed directly to Client Components" error is this rule.

## Where this phase connects

- **[Phase 9 · Actions](../phase-9-forms-actions/02-actions.md)** — the calling convention
  a Server Function plugs into.
- **[Phase 9 · Progressive enhancement](../phase-9-forms-actions/11-progressive-enhancement.md)**
  — the conditions this phase finally explains.
- **[Phase 8 · Suspense](../phase-8-concurrent-suspense/02-suspense/README.md)** — what an
  `async` component suspends into.
- **Express** — a Server Function *is* an endpoint. Authorization, validation, status codes
  and error contracts are Express material; React owns only the calling convention.
- **PostgreSQL** — `await db.query(…)` inside a Server Component is the join between these
  two syllabi. Query design stays on the PG side.

## Gate

**Move on when** you can look at any file in an RSC app and say which graph it is in, what
would happen if you added `'use client'` to it, and why an `onClick` prop passed from a
Server Component throws — and you can write a Server Function that is safe against a caller
who ignores your UI entirely.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 9 — Forms, Actions and optimistic UI](../phase-9-forms-actions/README.md)
