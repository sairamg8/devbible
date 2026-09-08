---
title: "`BASE_URL` Mirrors Your Config and `SSR` Is Not an Access Control — the Two Built-Ins That Mislead"
sidebar_label: "`BASE_URL` & `SSR`"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [`base`](https://vite.dev/config/shared-options#base), [Server-Side Rendering](https://vite.dev/guide/ssr). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope: the claim that a false `import.meta.env.SSR` branch is *removed* is **not** documented either way. This page deliberately treats removal as an optimisation, never a guarantee, and says so where it matters.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `BASE_URL` Mirrors Your Config and `SSR` Is Not an Access Control

Three of the five built-ins do what their name suggests. These two do not, and both mislead in the
same direction: they **look** like they observe the world at runtime, and they are in fact
compile-time facts about how the bundle was produced.

---

## 1. Under-The-Hood Mechanics

### `BASE_URL` mirrors config, it does not detect deployment

> *"`import.meta.env.BASE_URL`: `{string}` the base url the app is being served from. This is determined by the `base` config option."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

Read the second sentence as the definition and the first as a description of the intent. `BASE_URL`
is a **copy of your `base` option**, substituted into the bundle at build time. It does not read a
request, a header or `window.location`, because none of those exist when the substitution happens.

```
vite.config.ts          BUILD               dist/assets/index-*.js
base: '/app/'    ──────────────────────►    const u = "/app/" + "config.json"
                                                     ↑ a literal
```

Deploying that same artefact at `/` does not change it. This is the general rule from
[chunk 1a](01a-build-time-vs-runtime-config.md) in its most commonly-hit form: **a value that was
compiled in cannot be discovered later.**

It also always ends with a trailing slash, which is where the second-most-common bug comes from.

### `SSR` is a per-graph flag

> *"`import.meta.env.SSR`: `{boolean}` whether the app is running in the server."*

The word doing the work is *"running"* — but the value is fixed at build time, so what it really
records is **which graph this module was built into.** Vite builds an SSR bundle and a client
bundle. A module reachable from both entries is built **twice**, and gets `true` in one copy and
`false` in the other.

```
src/shared/pricing.ts
   ├── imported by src/entry-server.ts  → built into the SSR graph    → SSR === true
   └── imported by src/entry-client.ts  → built into the client graph → SSR === false
                                            ↑ the same source file, two different constants
```

That is fine as a *branching* mechanism — run a Node-only code path on the server, a browser path in
the client. It is **not** an access control, and the distinction matters:

⚠️ **Whether a `if (import.meta.env.SSR)` branch is physically removed from the client bundle is not
documented.** `SSR` is `false` there, so the branch is statically false and a minifier will
generally treat it as dead code — but that is an *optimisation*, and the literal must exist in the
input for the optimiser to see it. Depending on it to keep a secret out of a bundle means depending
on a step nobody has promised will run, in a mode nobody has promised is enabled. **Exclusion must
be structural: the module must not be reachable from the client entry at all.**

---

## 2. Real-World Engineering Scenario

**A white-label app that worked for one customer and 404'd for the other forty.**

A product was deployed per customer: `acme.example.com/` for the flagship, and
`portal.example.com/acme/`, `/globex/`, `/initech/` for everyone on the shared portal. The team set
`base: '/'` and built once.

Everything worked for the flagship. On the portal, the HTML loaded — the server rewrote that — and
then every asset request went to `/assets/index-a1b2c3.js` instead of `/acme/assets/index-a1b2c3.js`.
A white screen with four 404s and no JavaScript error, because the errors were network failures on
`<script>` tags.

The instinct was to compute the base at runtime from `window.location.pathname`. That does work for
*fetch* URLs written by hand, and it does **not** work for the asset URLs Vite emits, because those
were already rewritten during the build using `base`. There is no runtime hook that retroactively
edits them.

The actual resolution had two halves, and the split is the lesson:

- **Asset URLs are build-time.** One build per base — a small matrix in CI, `--base=/acme/`
  per customer. Vite exposes `base` as a CLI flag precisely because this is a per-deployment
  decision, not a per-request one.
- **API URLs are runtime.** Those moved to a `/config.json` fetched at boot, since the API host
  genuinely varied per tenant and had no business being compiled in.

Trying to solve both halves with one mechanism is what cost the week.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Using BASE_URL correctly. It is your `base` config and it ALREADY ends with '/'.
const configUrl = `${import.meta.env.BASE_URL}config.json`;   // "/app/config.json"

// ❌ The double-slash bug. Most servers tolerate it; some CDNs and service workers
//    do not, and it silently breaks cache-key matching in a way that is very hard
//    to spot in a network panel because the response still looks fine.
// const bad = `${import.meta.env.BASE_URL}/config.json`;      // "/app//config.json"

// ✅ A small helper, so no call site has to remember the rule.
export const fromBase = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
```

```yaml
# .github/workflows/deploy.yml — one build per base, because asset URLs are baked in.
strategy:
  matrix:
    tenant: [acme, globex, initech]
steps:
  - run: yarn build --base=/${{ matrix.tenant }}/
  - run: aws s3 sync dist/ s3://portal/${{ matrix.tenant }}/
```

```typescript
// src/server-only/db.ts — structural exclusion. This module is imported ONLY by
// entry-server.ts, so it is never built into the client graph and its literals are
// never candidates for the client bundle at all.
import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ❌ What people write instead:
// if (import.meta.env.SSR) { const pool = new Pool({ connectionString: 'postgres://…' }); }
//    In the client build SSR is false. Whether that branch survives into dist/ depends
//    on the minifier, and no documentation promises it will not.
```

```typescript
// vite.config.ts — make the mistake impossible rather than reviewable.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      // Fail the CLIENT build if anything under src/server-only/ is reachable from it.
      // A build error beats a code review every time.
      onwarn(warning, warn) {
        if (warning.id?.includes('/src/server-only/')) {
          throw new Error(`server-only module reached the client graph: ${warning.id}`);
        }
        warn(warning);
      },
    },
  },
});
```

```typescript
// ✅ SSR used for what it IS good at: choosing a code path, not hiding a value.
export const storage = import.meta.env.SSR
  ? { get: (k: string) => serverCache.get(k) }   // no `window` on the server
  : { get: (k: string) => localStorage.getItem(k) };
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Expecting `BASE_URL` to reflect the deployment

It reflects `base`. Deploying the same artefact under a different sub-path does not update it,
because the value was substituted before any server existed. If the path genuinely varies per
deployment, that is a build matrix, not a runtime lookup.

### ⚠️ Pitfall 2 — Double-slashing

`BASE_URL` already ends with `/`. `` `${BASE_URL}/api` `` yields `//api`. Servers usually normalise
it; CDN cache keys and service-worker route matching frequently do not, so the symptom is a cache
miss or an unmatched route rather than a 404 — much harder to trace.

### ⚠️ Pitfall 3 — Fixing asset paths at runtime

Rewriting `window.__base` at boot cannot help the URLs Vite already emitted into the bundle and the
HTML during the build. It is not that the technique is difficult; there is nothing left to rewrite.

### ⚠️ Pitfall 4 — Treating `SSR` as an authorisation boundary

A secret guarded only by `if (import.meta.env.SSR)` is a literal in the client build's input. Whether
it survives into the output depends on dead-code elimination running, which no documentation
promises. Exclusion must be structural.

### ⚠️ Pitfall 5 — Assuming `SSR` distinguishes "server" from "browser" in a shared module

It distinguishes *graphs*. A module in both graphs exists twice with two different constants — so a
module-level side effect guarded by `SSR` runs on neither, both, or one, depending on which copy is
loaded. Anything stateful gated on `SSR` at module scope deserves a second look.

---

## Gotchas

**★ Symptom: `import.meta.env.BASE_URL` is `/` when the app is deployed under a sub-path.** Cause: `BASE_URL` mirrors the `base` config option; it does not detect the deployment. Fix: set `base` at build time for that deployment — it is not derivable at runtime, because the value was substituted before any server existed.

```bash
vite build --base=/acme/
```

**★ Symptom: assets 404 on one deployment and load fine on another, from the same artefact.** Cause: asset URLs were rewritten with `base` during the build, so one artefact is valid at exactly one base path. Fix: build per base — a CI matrix — and treat "one artefact, many paths" as the impossibility it is under static rewriting.

**★ Symptom: asset and API URLs contain a double slash.** Cause: `BASE_URL` already has a trailing `/` and the call site added another. Fix: strip leading slashes at a single helper rather than at every call site.

```ts
export const fromBase = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, '')}`;
```

**★ Symptom: a service worker's route matching or a CDN's cache key stops working, but pages still render.** Cause: a `//` in a path. Origin servers normalise it; caches and route matchers key on the literal string. Fix: same as above — and grep the built output for `//` in URL positions as a CI check, since the symptom never looks like a path bug.

**★ Symptom: a secret guarded by `if (import.meta.env.SSR)` is found in the client bundle.** Cause: `SSR` is a per-graph flag, not access control. In the client build it is `false`, so the branch is dead — but *dead* is not *absent* unless an optimiser removed it, which nothing documents. Fix: make the module unreachable from the client entry — a server-only directory, a separate entry, or a build-time error on the import.

**★ Symptom: a Node built-in import fails the client build even though its use is behind `if (import.meta.env.SSR)`.** Cause: the `import` is hoisted and resolved before any branch is evaluated — module resolution does not care about your condition. Fix: move the import into the server-only module entirely, or use a dynamic `import()` inside the branch so resolution is deferred.

```ts
// ❌ import { readFile } from 'node:fs/promises';     // resolved in BOTH graphs
// ✅
if (import.meta.env.SSR) { const { readFile } = await import('node:fs/promises'); }
```

**★ Symptom: a module-level side effect gated on `SSR` runs twice, or never.** Cause: a shared module is built into both graphs, so there are two copies with two different constants — and which copy runs depends on the entry. Fix: keep `SSR` branching inside functions, and put anything stateful in a module that belongs to exactly one graph.

**★ Symptom: `base` was changed and stale asset URLs persist after a rebuild.** Cause: a cached `index.html` still references the previous build's hashed filenames at the previous base. Fix: this is a deployment concern rather than a Vite one — serve `index.html` with `no-cache` and the hashed assets with a long `max-age`. The build did the right thing; the cache did not.

---

## Interview questions

**★ Why can't `BASE_URL` just detect where the app is deployed?**
Because it is substituted into the bundle at build time, before any server exists to ask. It mirrors
the `base` config option — a copy of your configuration, not an observation of reality. The same
reasoning explains why one artefact cannot be promoted across paths: a value that was compiled in
cannot be discovered later. Teams that genuinely need path-independence use a `<base>` tag or
resolve URLs relative to `import.meta.url`, both of which are runtime mechanisms, and both of which
give up the build-time rewriting that makes `base` useful in the first place.

**★ You need to deploy one app at forty different sub-paths. What do you do?**
Build forty times, with `--base` per deployment, in a CI matrix. It sounds wasteful and is not: a
Vite build is fast, the outputs are cacheable, and the alternative — resolving asset URLs at
runtime — means giving up the static rewriting that produces hashed, long-cacheable asset paths. The
important half of the answer is the split: **asset URLs are build-time and must be baked; API hosts
and tenant identifiers are runtime and belong in a fetched config document.** Teams that try to
solve both with one mechanism end up with a runtime shim that half-works and a cache strategy that
does not.

**★ Is `import.meta.env.SSR` a safe way to keep server-only code out of the client bundle?**
No. It reports which graph a module was built into, and a module imported by both server and client
entries is built into **both** — so in the client build `SSR` is `false` and the guarded branch is
dead code. Dead is not absent: removal depends on dead-code elimination running, and the
documentation makes no promise about it either way, so a secret behind that guard is a literal in
the build's input hoping an optimisation removes it. There is also a sharper version of the problem —
a top-level `import` of a Node built-in inside such a module is resolved regardless of the branch,
because imports are hoisted. Real exclusion is structural: the module must not be reachable from the
client entry.

**★ What is `SSR` actually good for, then?**
Choosing a code path in a module that legitimately runs in both places — reading from a server cache
versus `localStorage`, skipping a `window` measurement during render, picking a fetch base. It is a
branch selector, and it is a good one. The failure mode is only ever in the other direction: using a
branch to *hide* something rather than to *choose* something. A useful test is to ask what happens
if the branch is removed by nobody and the code merely never runs — if the answer is "fine", `SSR`
is the right tool; if the answer is "a secret is in the bundle", it is not.

**★ Why does a `//` in a URL cause such confusing bugs?**
Because the layer that tolerates it and the layer that does not are different layers. An origin
server normalises the path and serves the right file, so the page works. A CDN, a service worker's
route matcher and a cache key all operate on the literal string, so they miss — and a cache miss
looks like a performance problem, not a correctness one. The bug therefore presents as "the site is
slow" or "offline mode stopped working" weeks after the change that caused it, which is why the fix
belongs in a single helper rather than in everybody's memory.

---

← [Built-Ins & the String Trap](01c-built-in-constants-and-typing.md) · [Vite overview](../../README.md) · Next → [Modes & `NODE_ENV`](01e-modes-and-node-env.md)
