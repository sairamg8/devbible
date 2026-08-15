---
title: "Shipping TypeScript to production"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Modules: TypeScript*,
> *Command-line API*, *Modules → Source map v3 support*) and the **`tsconfig`
> reference** on typescriptlang.org. **No sandbox, no console block on either
> chunk** — and deliberately **no stack trace is reproduced anywhere in this
> topic**, because no run produced one. Shapes are described, not pasted.

[Topic 01](../01-tsconfig-for-a-node-service/README.md) chose between compiling
with `tsc` and letting Node strip types. This topic is what that choice actually
costs and buys once the code is in a container that someone is paged about.

Two claims, one per chunk:

> **The type checker must run somewhere, and on the stripping path it is never
> the thing that starts your process.** No `tsc --noEmit` step in CI means the
> service is not type-checked — it is merely written in a language that has
> types.
>
> **A stack trace names the file that was executing.** On the build path that is
> `dist/server.js`, and getting back to your source needs source maps, a flag,
> and an awareness of the two ways that silently fails.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What actually ships](./01-what-actually-ships.md) | Both `Dockerfile` shapes and why Path A is multi-stage; the `package.json` fields that point at the artefact; what Path B demands in return (a pinned Node, a CI gate, a tighter `.dockerignore`); the choose-a-path table; and the four antipatterns named |
| 02 | [Source maps and stack traces](./02-source-maps-and-stack-traces.md) | Why Path B needs no maps at all; `sourceMap` vs `inlineSourceMap` vs `inlineSources`; `--enable-source-maps` and its three caveats — `Error.stack` latency, the `Error.prepareStackTrace` override, and `node_modules` being excluded; reading maps yourself; and whether to ship `.js.map` |

## Phase gate

You are done with this topic when you can take a service from a repository to a
running container **without a build step you cannot explain**, and — given a
production stack trace pointing at `dist/server.js:1:2847` — say exactly which
of the four things is missing: the maps, the flag, a non-delegating
`prepareStackTrace`, or the maps having been stripped from the artefact.

The tell that this topic has not landed: a `Dockerfile` that runs `tsc` at
container start. It moves a build failure into a rolling deploy and puts the
compiler in the runtime image, and it is still extremely common.

## Where this connects

- **← [01 · `tsconfig.json` for a Node 24 service](../01-tsconfig-for-a-node-service/README.md)**
  — the config half of the same decision. Chunk 01 there sets up Path A / Path B
  and explicitly defers the runtime half to here.
- **← [Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)** —
  why `NODE_ENV` cannot affect anything TypeScript does, and why the compiled
  output is a different file from the one you wrote.
- **← [Phase 0 · Checking vs transpiling](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)**
  — the distinction this topic turns into a CI requirement.
- **→ 04 · `catch (e: unknown)`** *(not written yet)* — the design point behind
  the `Error.stack` latency caveat: a service that treats expected outcomes as
  thrown errors pays source-map resolution on its normal path.

---

← [Phase 7 index](../README.md) · Start → [01 · What actually ships](./01-what-actually-ships.md)
