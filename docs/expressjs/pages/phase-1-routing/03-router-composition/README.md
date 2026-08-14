---
title: "Router composition"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`express.Router()` is a portable stack. Mount it on `app` (or another router) at
a prefix. That is how feature modules stay small — and how the request pipeline
becomes invisible if nobody assembles it in one place.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Mechanism claims
> are read from `router@2.2.0`'s `index.js` — `Router.prototype.handle`,
> `mergeParams`, `restore`, `trimPrefix`, `processParams` — in
> `sandbox/express-verify/node_modules/`, cited per chunk by function; behaviour
> is cross-checked against the Express
> [routing guide](https://expressjs.com/en/guide/routing.html) (a `Router` as a
> *"mini-app"*; parent params *"not accessible by default from the sub-routes"*;
> a param callback *"called only once in a request-response cycle"*) and the
> [request reference](https://expressjs.com/en/5x/api/request.html). **Reading
> source is not a run.** The two console blocks in this topic (chunks 01 and 02)
> are re-used unchanged from the earlier authorised `sandbox/express-verify` run
> and are **sandbox-measured**; nothing was executed for this rewrite.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Mounting a router](01-mounting-a-router.md)** | The four URL properties under a mount, what a router has and does not have, why it never learns its own prefix, and why `strict routing` does not cross a mount |
| 02 | **[mergeParams and isolation](02-mergeparams-and-isolation.md)** | `req.params` is replaced and then restored; `mergeParams` copies the parent and lets the child win; the bare-`:id` collision; and the authorization gap nesting invites |
| 03 | **[Composition at scale](03-composition-at-scale.md)** | The mount list as the only visible pipeline, the ordering constraints that have to hold, dependencies as arguments, and why an isolated router test proves less than it looks |

**Split on concept boundaries at the 300-line mark.** 01 is one mount, 02 is what
crosses a mount, 03 is thirty of them.

## Phase gate

You can say what `req.params` contains inside a nested router and why, name three
mount-order constraints and what each breaks, and explain why checking `:orgId`
does not authorize `:projectId`.

## Where this connects

- **← [Phase 0 · 02 · chunk 04](../../phase-0-express-basics/02-app-router-server/04-url-rewriting-and-options.md)**
  — `trimPrefix`, the mechanism behind the mount.
- **← [Phase 0 · 02 · chunk 05](../../phase-0-express-basics/02-app-router-server/05-sub-apps-and-the-server.md)**
  — the other mountable thing, and everything a sub-app has that a router does not.
- **← [02 · Params and query](../02-params-and-query/README.md)** — what a param is
  before it crosses a mount.
- **→ [04 · Route ordering](../04-route-ordering.md)** — order *within* a router.
- **→ [06 · `router.param`](../06-router-param.md)** — the shared-loading hook chunk
  03 uses, in full.
- **→ [07 · `app.route` and hosts](../07-app-route-and-hosts.md)** — chaining, and
  `mountpath` versus `req.baseUrl`.
- **→ [Phase 6 · 05 · Versioning](../../phase-6-rest-surface/05-versioning.md)** —
  what the per-version parent router is for.
- **→ [Phase 7 · 04 · DI without a framework](../../phase-7-layering/04-di-without-framework.md)**
  — why a router takes its dependencies as an argument.
- **→ [Phase 8 · 07 · Ownership](../../phase-8-validation-authz/07-ownership/README.md)** —
  the nested-resource authorization gap, in full.
- **→ [Phase 10 · 01 · The app factory](../../phase-10-app-factory/01-create-app.md)**
  — the factory chunk 03 sketches.

---

← Prev topic: [Params and query](../02-params-and-query/README.md) · Start → [Mounting a router](01-mounting-a-router.md)
