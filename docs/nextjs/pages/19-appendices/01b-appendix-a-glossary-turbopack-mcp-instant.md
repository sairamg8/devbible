---
title: "Appendix A · part 2 — the build and tooling vocabulary: Turbopack, MCP and Instant Navigations, two of which the official glossary does not define"
sidebar_label: "02 · Glossary — Turbopack, MCP, Instant Navigations"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`), [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`), [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`) and [`partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching).
> Target: **Next.js 16.3.4** · Node.js **20.9+** · TypeScript **5.1+**. Documentation-verified; **no sandbox run, no timings**.

**Part 1 covered the three rendering terms, all of which the official glossary defines. This page covers the other three in the appendix's title — and two of them, `MCP` and `Instant Navigations`, have no glossary entry at all despite being current, shipped, documented features. That absence is worth stating plainly: a term missing from the glossary is not evidence the term is unofficial, and an appendix that quietly invents the missing entry is worse than one that names the gap and sources the definition from the guide that actually owns it. The third, Turbopack, is defined — and its definition badly understates the one fact that breaks upgrades.**

---

## 1 · Turbopack

> *"A fast, Rust-based bundler built for Next.js. Turbopack is the default bundler for `next dev` and available for `next build`. It provides significantly faster compilation times compared to Webpack."*

🔴 **That entry undersells it.** *"Available for `next build`"* reads like an option. The upgrade guide, which owns the fact, states it flatly:

> *"Starting with **Next.js 16**, Turbopack is stable and used by default with `next dev` and `next build`."*

You do not opt in. You opt **out**, with `--webpack`.

### Mistaken for: **an opt-in you have not taken**

This is the single most expensive misreading in the 16 upgrade, because the failure is loud in one direction and silent in the other.

**Loud:** if you have a `webpack()` function in `next.config`, the build *stops*.

> *"If your project has a custom `webpack` configuration and you run `next build` (which now uses Turbopack by default), the build will **fail** to prevent misconfiguration issues."*

And the cause is frequently not yours:

> *"If you see failing builds because a `webpack` configuration was found, but you don't define one yourself, it is likely that a plugin is adding a `webpack` option"*

**Silent:** everything webpack-shaped that is *not* a `webpack()` function simply stops being consulted. Webpack **plugins** have no Turbopack equivalent —

> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is available."*

— and the legacy Sass tilde import stops resolving:

> *"Turbopack fully supports importing Sass files from `node_modules`. Note that while Webpack allowed the legacy tilde (`~`) prefix, Turbopack does not support this syntax."*

```scss
/* styles/globals.scss */
/* Webpack accepted this. Turbopack does not. */
@import '~bootstrap/dist/css/bootstrap.min.css';

/* Turbopack: drop the tilde. */
@import 'bootstrap/dist/css/bootstrap.min.css';
```

The three escapes, in the order you should prefer them: migrate the config to `turbopack` options; run `next build --turbopack` and let it ignore the webpack config; or opt out entirely with `--webpack`.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build --webpack",
    "start": "next start"
  }
}
```

### Mistaken for: **available on every platform**

It is not, and this one bites CI on an unusual runner rather than on a laptop:

> *"On platforms without native bindings (e.g. FreeBSD, OpenBSD), Next.js falls back to WebAssembly (WASM) bindings. WASM bindings support core SWC features like compilation and minification, but **do not support Turbopack**. On these platforms, use the `--webpack` flag"*

### Where the config moved

`experimental.turbopack` is no longer experimental — it is a top-level `turbopack` key. And `resolve.fallback`, the webpack escape hatch for client code that imports Node built-ins, has a Turbopack equivalent with a different name:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      fs: {
        browser: './empty.ts', // We recommend to fix code imports before using this method
      },
    },
  },
}

export default nextConfig
```

The docs are explicit that this silences rather than solves: *"It is preferable to refactor your modules so that client code doesn't ever import from modules using Node.js native modules."*

### Related, and separately defined

> **File-system caching** — *"A Turbopack feature that stores compiler artifacts on disk between runs, reducing work across `next dev` or `next build` commands for significantly faster compile times."*

On by default for both commands in 16, via `experimental.turbopackFileSystemCacheForDev` and `experimental.turbopackFileSystemCacheForBuild`. 🔴 **On a CI runner that never preserves `.next/cache`, writing that cache is pure cost** — the docs say to set `turbopackFileSystemCacheForBuild: false` there.

There is a second, separate knob for memory:

> *"`turbopackMemoryEviction` controls whether Turbopack reclaims memory while the persistent (FileSystem) cache is enabled. After Turbopack writes a snapshot of its cache to disk, it can 'evict' the in-memory copies of that data and reload them from disk on demand."*

---

## 2 · MCP — the Model Context Protocol server

🔴 **The official Next.js glossary has no entry for MCP.** The definitions below come from the guide that owns the feature. This page states the gap rather than presenting an invented glossary entry.

> *"Next.js 16+ includes MCP support that enables coding agents to access your application's internals in real-time. To use this functionality, install the `next-devtools-mcp` package."*

The architecture is two pieces, and confusing them is why people cannot get it connected:

> *"Next.js 16+ includes a built-in MCP endpoint at `/_next/mcp` that runs within your development server. The `next-devtools-mcp` package automatically discovers and communicates with these endpoints"*

So: **`/_next/mcp` is inside your dev server** and ships with the framework. **`next-devtools-mcp` is a separate npm package** your agent runs, which finds those endpoints — including *"multiple Next.js instances running on different ports"* — and forwards each tool call to the right one.

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

### Mistaken for: **something that works against a production build**

It does not. Every capability is a **dev-server** capability: build errors, runtime errors, type errors, dev logs, compilation issues, route tables. Nothing about `next build` output or a running `next start` is exposed through it. The stated requirement is *"Next.js 16 or above"* plus a running dev server, and the entire troubleshooting list is about the dev server: *"Start your development server: `npm run dev`"*, *"Restart your development server if it was already running"*.

### Mistaken for: **a replacement for reading the docs**

The opposite: one of its capabilities *is* the docs.

> **Documentation Gateway** — *"Points your agent at the version-accurate docs bundled with your installed Next.js (in `node_modules/next/dist/docs/`), so explanations and generated code match the version you are running"*

The tool list and the `AGENTS.md` machinery are in [Appendix C](03-appendix-c-tooling.md).

⚠️ **Stated as uncertain:** the documentation does not give a version-support policy for `next-devtools-mcp` itself. It is installed as `@latest` and versioned independently of `next`, so the pairing you get is whatever npm resolves that day. Treat it as unpinned unless you pin it yourself.

---

## 3 · Instant Navigations

🔴 **The official glossary has no entry for "Instant Navigations" either.** It is the umbrella name used in the 16.3 release material for a group of behaviours that *are* individually documented. The honest definition is therefore compositional: **Instant Navigations is `cacheComponents` plus `partialPrefetching`, plus the dev-time validation that tells you when a route has stopped qualifying.**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

The prefetch half is defined:

> **Partial Prefetching** — *"A prefetching strategy for Cache Components routes where a `<Link>` prefetches a per-route App Shell by default instead of the full page. Enable it with `partialPrefetching: true` in `next.config.ts`."*

Contrast it with plain prefetching, which is what you get without the flag:

> **Prefetching** — *"Loading a route in the background before the user navigates to it. Next.js automatically prefetches routes linked with the `<Link>` component when they enter the viewport, making navigation feel instant."*

The difference is what travels: the whole page, versus the route's shared App Shell. The second is smaller and reusable across every link into that route, which is the entire economic argument — and it is why the two flags are sequenced rather than simultaneous. Partial Prefetching needs Cache Components already adopted.

The validation half:

> *"The migration is driven by **instant navigation validation**. With Cache Components enabled, Next.js validates in development whether navigating into each route renders instantly, and surfaces the code that would block it as an error or insight."*

### 🔴 Mistaken for: **something a status check can verify**

This is the gotcha that makes the whole feature slippery, and it is documented:

> *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the MCP `get_errors` tool."*

A route that has lost its instant navigation still renders correctly — just at request time. There is nothing in the status code or the body for CI to catch. The documented machine-checkable path is the `instant()` helper from `@next/playwright`, and the assertions that carry the value are the **negative** ones: asserting that streamed content is *absent* from the UI available at navigation time.

⚠️ **Schedule the adoption, do not defer it.** Vercel states the Instant Navigations behaviours will become the default in a future major. Treat `cacheComponents` + `partialPrefetching` as a migration with a date, not an experiment you can sit out. [Appendix E](05-appendix-e-version-watchlist.md) tracks the stabilization status of every preview feature in this book.

---

## Version skew — the term that only appears after you deploy twice

Not in this appendix's title, but it belongs on this page because it is a *build-identity* concept, and because nothing in development ever shows it to you.

> **Version skew** — *"After a new version of your application is deployed, clients that are still active may reference JavaScript, CSS, or data from an older build. This mismatch between client and server versions is called version skew, and it can cause missing assets, Server Action errors, and navigation failures. Next.js uses `deploymentId` to detect and handle version skew."*

Read the failure list carefully: **missing assets, Server Action errors, navigation failures.** All three look like unrelated bugs in an error tracker, all three are unreproducible locally, and all three cluster in the minutes after a deploy. The deployment mechanics are chapter 16's: [16 · Deployment, scaling and observability](../16-deployment-scaling-and-observability/01-explanation.md).

## Gotchas

**★ Symptom: `next build` fails with "webpack configuration was found" and your `next.config` has no `webpack()`.** Cause: a plugin is injecting one. Fix: find it, or force the bundler explicitly rather than guessing.

```json
{ "scripts": { "build": "next build --turbopack" } }
```

**★ Symptom: a `@import '~pkg/file.css'` in Sass resolves in dev on 15 and 404s after upgrading to 16.** Cause: Turbopack is now default and does not implement the legacy tilde. Fix: drop the tilde. If you cannot edit the import — it is inside a dependency — alias it:

```ts
// next.config.ts
const nextConfig = {
  turbopack: { resolveAlias: { '~*': '*' } },
}
export default nextConfig
```

**★ Symptom: a webpack plugin that instrumented your bundle silently stops producing output after upgrading, with no error.** Cause: Turbopack supports loaders but not plugins, and an unapplied plugin has nothing to report. Fix: there is no config that rescues this — either find a Turbopack-compatible alternative or build with `--webpack` until one exists. The docs say exactly that and offer no third option.

**★ Symptom: builds fail on a BSD CI runner and pass everywhere else.** Cause: no native bindings on that platform, so Next.js falls back to WASM, which does not support Turbopack. Fix: `--webpack` on that runner specifically.

**★ Symptom: CI build times did not improve and the runner shows extra disk writes.** Cause: Turbopack's filesystem cache is on by default for builds, and your CI discards `.next/cache` between runs, so every build writes a cache nobody reads. Fix: turn the build-time cache off in that environment.

```ts
// next.config.ts
const nextConfig = {
  experimental: { turbopackFileSystemCacheForBuild: false },
}
export default nextConfig
```

**★ Symptom: your agent cannot see any errors and reports the MCP server is not connected.** Cause: almost always no dev server, or one started before the agent loaded its config. Fix: work the documented list in order — Next.js 16 or above, `next-devtools-mcp` present in `.mcp.json`, `npm run dev` running, and restart the dev server if it was already running when you added the config.

**★ Symptom: you ask an agent to diagnose a production incident through MCP and it returns nothing useful.** Cause: every MCP capability is a dev-server capability; there is no production surface. Fix: use the telemetry path instead — `instrumentation.ts`, `onRequestError` and an OpenTelemetry exporter, covered in [chapter 16](../16-deployment-scaling-and-observability/01-explanation.md). Do not expect MCP to substitute for it.

**★ Symptom: `get_compilation_issues` or `compile_route` is missing from the agent's tool list.** Cause: both are documented **Turbopack only**. If the project builds with `--webpack`, they do not exist. Fix: either move the project to Turbopack or stop depending on those two tools in your workflow.

**★ Symptom: a route was instant last sprint and is not now, and no test caught it.** Cause: there is nothing to catch — the route still returns `200` with correct HTML, just rendered at request time. Fix: write the `instant()` assertion negatively, so it fails when content that should stream appears in the immediate UI.

```ts
import { test, expect } from '@next/playwright'

test('dashboard shell is instant', async ({ page, instant }) => {
  await page.goto('/')
  await instant(page.getByRole('link', { name: 'Dashboard' }).click(), async () => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // The load-bearing assertion is the negative one:
    await expect(page.getByTestId('revenue-total')).toBeHidden()
  })
})
```

**★ Symptom: you turn on `partialPrefetching` first and nothing improves.** Cause: it is a prefetching strategy *for Cache Components routes*; without `cacheComponents` there is no per-route App Shell for a `<Link>` to fetch. Fix: sequence them — adopt Cache Components, resolve the insights, then enable Partial Prefetching.

**★ Symptom: after a deploy, a handful of users hit "missing chunk" errors and failed Server Actions for a few minutes, then it clears on its own.** Cause: version skew — those clients are still holding the previous build's references. Fix: set a `deploymentId` so Next.js can detect the mismatch, and treat the post-deploy minutes as a known window rather than a mystery.

**★ Symptom: you quote a docs page's `version: 16.3.4` as proof it is current.** Cause: that field is the docs **build** number and is identical across every page; it is not a review date. Fix: read the page's own `lastUpdated:`. Fetch any docs URL with `.md` appended and the frontmatter comes with it. The production checklist is the live counter-example: `version: 16.3.4`, body dated `2026-03-10`.

## Interview questions

**★ Turbopack is the default in 16. What breaks loudly, and what breaks silently?**
Loudly: a `webpack()` function in `next.config` fails the build outright, deliberately, so you cannot ship a misconfiguration. Silently: webpack **plugins** stop being applied — Turbopack supports loaders but not plugins — and the legacy Sass tilde prefix stops resolving. There is a third, environment-shaped silent failure: on platforms with no native bindings, such as FreeBSD and OpenBSD, Next.js falls back to WASM bindings, which do not support Turbopack at all, so those builds need `--webpack`.

**★ Your build fails saying a webpack config was found, and you did not write one. What now?**
A dependency is adding it — the docs name that as the likely cause. Two ways forward. Short term, decide the bundler explicitly: `next build --turbopack` to ignore the injected config, or `--webpack` to keep it. Longer term, find the plugin, because the answer determines whether you are losing behaviour: if the plugin only set `webpack()` for a loader, migrating to `turbopack` options is straightforward, but if it was a webpack *plugin*, there is no Turbopack path and you are on `--webpack` until an alternative exists.

**★ Why would you turn Turbopack's filesystem cache off?**
When nothing reads it. It is on by default for both dev and build, and it pays for itself across repeated runs on the same machine. On a CI runner that starts from a clean checkout every time and never restores `.next/cache`, every build pays to write a cache no build ever reads. The docs name that case and the flag: `turbopackFileSystemCacheForBuild: false`.

**★ Explain how the Next.js MCP integration is wired, in two pieces.**
Piece one is inside the framework: `next dev` exposes an MCP endpoint at `/_next/mcp` that carries the dev server's live state — errors, logs, routes, compilation issues. Piece two is `next-devtools-mcp`, a separate npm package the coding agent launches, configured in `.mcp.json`. It discovers those endpoints, can talk to several dev servers on different ports at once, and forwards each tool call to the right one. The split is deliberate: it decouples the agent-facing interface from Next.js internals, so the tool surface can stay stable while the implementation moves.

**★ Can an agent use MCP to debug production?**
No. Everything it exposes is dev-server state, and the documented requirements are Next.js 16+ and a running dev server. There is no production surface at all. Production observability is a different mechanism entirely — `instrumentation.ts`, `onRequestError`, an OpenTelemetry exporter — and conflating the two is how a team ends up with no production telemetry because "the agent can see errors."

**★ Two MCP tools are documented "Turbopack only". Which, and why does that qualifier matter?**
`get_compilation_issues` and `compile_route`. It matters because both are the tools that let an agent find out whether code compiles *without* running a full `next build` — which is the single biggest time saving in an agent loop. A project on `--webpack` loses exactly that shortcut, so the bundler choice quietly changes how fast agent-assisted work goes, not just how fast builds go.

**★ Define "Instant Navigations" precisely.**
Carefully, because the official glossary does not define it — it is an umbrella name for a set of individually documented behaviours. Concretely it is `cacheComponents` plus `partialPrefetching`, plus the dev-time instant navigation validation that reports routes which have stopped qualifying. Under it, a `<Link>` prefetches the route's shared App Shell rather than the whole page, so the UI at click time comes from something already in the browser. The honest framing in an interview is to say the umbrella term is release-note vocabulary and then name the two flags, rather than pretending it is a single documented API.

**★ How would you prove in CI that a route still navigates instantly?**
Not with a status check, because there is nothing to check: an offending route returns `200` with fully rendered HTML, just rendered at request time. The insight exists only in the dev overlay, the dev-server log, or the MCP `get_errors` tool. The documented mechanism is the `instant()` helper from `@next/playwright`, which scopes assertions to the UI available at navigation time — and the load-bearing assertions are negative: assert that the streamed content is *absent* from the immediate UI, so the test fails the moment a data read climbs back above a Suspense boundary.

**★ Why is `partialPrefetching` a separate flag from `cacheComponents` if both are part of the same feature story?**
Because they solve different halves and have different prerequisites. `cacheComponents` changes how a route is rendered and cached — it is the model shift, and it can fail your build. `partialPrefetching` changes what a `<Link>` fetches ahead of a click: the per-route App Shell instead of the whole page. Partial Prefetching needs Cache Components already adopted, so they are sequenced rather than simultaneous, which is exactly why the framework ships them as two flags and two separate adoption Skills.

**★ What is version skew and why is it invisible in development?**
It is the mismatch that appears when a new build is deployed while users still have the previous build loaded: their browser holds references to JavaScript, CSS and serialized data that the new server no longer serves. The documented symptoms are missing assets, Server Action errors and navigation failures. It is invisible in development because there is only ever one build — skew requires two deployments and a user who spanned them. `deploymentId` is the mechanism Next.js uses to detect it, and the practical discipline is to expect a burst of these in the minutes after every deploy rather than to treat each one as a new bug.

**★ A doc page says `version: 16.3.4`. Is it current?**
That field tells you nothing about the page. It is the docs build number and is stamped identically on every page in the set. Freshness lives in each page's own `lastUpdated:`. The glossary's is 2026-08-25; the production checklist's is 2026-03-10, and its body still describes Partial Prerendering as experimental — which 16 removed. Fetching a docs URL with `.md` appended returns the frontmatter along with the content, which is the cheapest way to check.

---

← [Glossary, part 1 — PPR, RSC, Cache Components](01-appendix-a-glossary-ppr.md) · [Chapter 19 overview](01-explanation.md) · Next → **Glossary, part 3 — the A–Z** *(not written yet)*
