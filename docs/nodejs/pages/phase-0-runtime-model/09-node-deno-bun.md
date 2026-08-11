---
title: "Node vs Deno vs Bun"
sidebar_label: "09 · Deno and Bun"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Runtime landscapes move fast — treat the specifics as a
> snapshot and re-check before betting a production system on them.

**Three runtimes for the same language. Node wins on ecosystem and operational
boredom, and that is usually the deciding factor.**

## Why they exist

Deno (2020) was built by Node's original author as a do-over: secure by default,
TypeScript out of the box, no `node_modules`. It was fast and nobody could use
it, because the npm ecosystem was the whole point. **Deno 2 reversed that** — npm
packages, `package.json` and `node_modules` now work.

Bun (2022) attacked a different problem: speed and tool sprawl. One binary that
is runtime, package manager, bundler and test runner, built on
**JavaScriptCore** (Safari's engine) instead of V8.

Node's answer to both has been to absorb the good ideas — a built-in test
runner, `--watch`, `--env-file`, and native TypeScript type stripping are all
things Deno and Bun had first.

## The comparison

| | **Node.js** | **Deno** | **Bun** |
|---|---|---|---|
| Engine | V8 | V8 | JavaScriptCore |
| Written in | C++ / JS | Rust | Zig |
| TypeScript | Runs `.ts` by stripping types; no type checking | First-class, checks types | Runs `.ts` directly |
| Security | None — full access by default | **Permissions**: no file, network or env access unless granted | None by default |
| Package manager | npm / yarn / pnpm, separate tools | Built in, npm and JSR | Built in, very fast installs |
| Test runner, bundler | Test runner built in; bundler separate | Both built in | Both built in |
| npm compatibility | It *is* npm | High, not total | High, not total |
| Ecosystem and hiring | Enormous | Growing | Growing |
| Production track record | Two decades | Some | Less |

## About the benchmarks

You will find posts showing Bun serving two to three times the requests per
second of Node on a "hello world" endpoint, and starting an order of magnitude
faster. The startup difference is real and matters for serverless and CLI tools.

The throughput difference usually does not matter, because **your bottleneck is
almost never the runtime.** A route that queries Postgres and calls two internal
services spends its time waiting on those, not on parsing HTTP. Swapping runtimes
to fix latency is treating the wrong thing — index the query first.

Treat third-party benchmark tables as directional at best. Nobody's production
app looks like a hello-world loop.

## What each is genuinely good at

**Node** — anything with a long life and a team. Every library works, every
platform supports it, every hosting provider runs it, every operational problem
has been hit by someone else and written up. That last point is worth more than
throughput.

**Deno** — scripts and tools where the permission model earns its keep. Running
untrusted or semi-trusted code with `--allow-net=api.example.com` and nothing
else is a real security property Node cannot offer. Also pleasant for
single-file TypeScript utilities.

**Bun** — the development loop. Installs and test runs are dramatically faster,
and many teams use `bun install` and `bun test` while still deploying on Node.
That split gets you most of the benefit with none of the compatibility risk.

## The honest recommendation

For fullstack application work in 2026: **build on Node.** Not because it is the
fastest — it is not — but because compatibility gaps are the expensive kind of
problem. A native module that will not build, a library that assumes a Node
internal, an APM agent with no support: each one surfaces late, usually in
production, and none of them are your product.

Use Bun as a tool where it helps. Reach for Deno when the sandbox is the feature.
Revisit the question yearly.

## Gotchas

**Symptom:** A package works under Node and breaks under Bun or Deno
**Cause:** Compatibility is high but not complete — native addons, obscure
`node:` internals, and anything touching V8-specific behaviour are the usual
gaps.
**Fix:** Run the full test suite on the target runtime before committing, and
check your critical dependencies specifically. "Mostly compatible" is a
statement about the average package, not about yours.

**Symptom:** A benchmark promised 3× and production got 5%
**Cause:** The benchmark measured the runtime; your app is bound by the database
and the network.
**Fix:** Profile before switching. If the event loop is idle while requests are
slow, the runtime is not your problem.

**Symptom:** Deno refuses to read a file or open a socket
**Cause:** Working as designed — no permission was granted.
**Fix:** Grant the narrowest thing that works (`--allow-read=./data`), not
`--allow-all`. Blanket permissions throw away the one advantage you switched for.

**Symptom:** `bun install` produces a working app, CI on Node fails
**Cause:** Two package managers resolved the tree differently, and the lockfiles
disagree.
**Fix:** One package manager per repository, its lockfile committed, and the
same one in CI.

## Interview questions

**★ Why would you still choose Node over Bun or Deno for a production
application?**
Ecosystem completeness and operational maturity. Every library, host, monitoring
agent and deployment pattern targets Node, and the failure modes are documented.
Bun and Deno are faster on paper, but compatibility gaps surface late and cost
more than the performance saves — and most apps are bound by the database
anyway.

**★ What problem was Deno created to solve, and what changed in Deno 2?**
Deno addressed Node's design regrets: no sandbox, a bespoke module system,
TypeScript needing a build step. Its no-npm stance kept adoption low, so Deno 2
added npm, `package.json` and `node_modules` support while keeping the
permission model and native TypeScript.

**★ What makes Bun fast?**
JavaScriptCore instead of V8 gives much faster cold starts, the runtime is
written in Zig with heavily optimised I/O paths, and bundling the package
manager, bundler and test runner into one binary removes process and tooling
overhead. The startup gain is real; the request-throughput gain rarely dominates
a real workload.

**Node has copied several Deno and Bun features. Which?**
A built-in test runner (`node --test`), file watching (`--watch`), `.env` loading
(`--env-file`), a built-in SQLite client (`node:sqlite`), and native TypeScript
type stripping. The competition made Node better.

**When is Deno's permission model actually worth it?**
When you execute code you do not fully trust — plugins, user-supplied scripts, a
build step pulling arbitrary packages. Being able to say "network access to this
one host, no filesystem" is a property Node cannot express at all.

---

← Prev: [Running node](08-running-node.md) · Next → [How V8 optimizes JavaScript](10-how-v8-optimizes.md)
