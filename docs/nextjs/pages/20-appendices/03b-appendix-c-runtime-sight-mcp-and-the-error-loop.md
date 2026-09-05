---
title: "Appendix C · part 2 — giving an agent eyes: the MCP server's nine tools, the browser view it cannot otherwise reach, and the error menu that turns a failure into a prompt"
sidebar_label: "08 · Appendix C — MCP and the error loop"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`) and [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · MCP requires **Next.js 16 or above** and a running dev server. Documentation-verified; **no sandbox run, no timings**.

**[Part 1](03-appendix-c-tooling.md) fixed what an agent *knows*. This page fixes what it can *see*. An agent editing a Next.js app is working blind in two directions at once: it cannot look at the dev server's internal state, and it cannot look at the browser. Next.js closes the first gap with an MCP endpoint built into `next dev`, and the ecosystem closes the second with a CLI that renders the DOM, console, network and Web Vitals as text. On top of both sits the piece that changes the loop's shape entirely — blocking errors that print a menu of labelled fixes with their trade-offs, and a button that packages the chosen one into a prompt. The result is that the agent's next action comes from the framework rather than from a guess.**

## 1 · The MCP server, in two pieces

Confusing these two is the reason most "it will not connect" reports exist.

> *"Next.js 16+ includes a built-in MCP endpoint at `/_next/mcp` that runs within your development server. The `next-devtools-mcp` package automatically discovers and communicates with these endpoints"*

| Piece | Ships with | Runs where |
|---|---|---|
| `/_next/mcp` | the `next` package | inside your dev server |
| `next-devtools-mcp` | its own npm package | launched by your agent |

The second finds the first — plural:

> it can *"Connect to multiple Next.js instances running on different ports"* and *"Forward tool calls to the appropriate Next.js dev server."*

The docs give the reason for the split, and it is a design argument worth borrowing: *"This architecture decouples the agent interface from the internal implementation."* The tool names an agent depends on can stay stable while the framework's internals move.

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

That file is `.mcp.json` at the project root. **Requirements:** *"Next.js 16 or above"*, plus a dev server — *"When you start your development server, `next-devtools-mcp` will automatically discover and connect to your running Next.js instance."*

⚠️ **Stated as uncertain:** the documentation gives no version-support policy for `next-devtools-mcp` itself. It is installed `@latest` and versioned independently of `next`, so the pairing is whatever npm resolves that day. If you need reproducibility, pin it yourself — the docs do not tell you which pairings are supported.

## 2 · The nine tools, and what each is actually for

| Tool | Verbatim description | Use it when |
|---|---|---|
| `get_errors` | *"Retrieve current build errors, runtime errors, and type errors from your dev server"* | the entry point for almost every loop |
| `get_logs` | *"Get the path to the development log file containing browser console logs and server output"* | a failure that leaves a trace but not an error |
| `get_page_metadata` | *"Get metadata about specific pages including routes, components, and rendering information"* | "is this route static or dynamic, and why" |
| `get_project_metadata` | *"Retrieve project structure, configuration, and dev server URL"* | orienting in an unfamiliar repo |
| `get_routes` | *"Get all routes that will become entry points by scanning the filesystem. Returns routes grouped by router type (appRouter, pagesRouter). Dynamic segments appear as `[param]` or `[...slug]` patterns"* | before any change that touches routing |
| `get_server_action_by_id` | *"Look up Server Actions by their ID to find the source file and function name"* | 🔴 an error naming an action ID and nothing else |
| `get_compilation_issues` | *"Retrieve compilation warnings and errors for the whole project from the bundler. **Turbopack only.**"* | project-wide "does it compile" without a build |
| `compile_route` | *"Trigger on-demand compilation of a specific route without making an HTTP request to it… **Turbopack only.**"* | checking one route compiles, cheaply |

Two of these change the economics of an agent loop more than the rest.

**`get_server_action_by_id`** exists because a Server Action failure in a log gives you an opaque ID and nothing else. Without this tool an agent greps a hash across a codebase and usually fails; with it, the ID resolves to a file and a function name.

**`get_compilation_issues` and `compile_route`** replace the slowest step in the loop. The docs put it plainly: they *"report whether the code compiles straight from the dev server, so an agent doesn't have to run a full `next build` to find out."* 🔴 **Both are documented Turbopack only** — a project building with `--webpack` loses exactly this shortcut, which means the bundler choice quietly sets how fast agent-assisted work goes.

`compile_route` takes either form of route identifier, which matters because an agent usually has one and not the other:

- a `routeSpecifier` such as `/blog/[slug]`, *"as returned by `get_routes`"*
- a concrete `path` such as `/blog/hello-world`, *"which is resolved to the matching route using the dev router's live route table"*

## 3 · The two views, and why one server is not enough

> *"Runtime errors, client-side warnings, and rendered output live in the browser, where agents can't look."*

**The framework's view** is MCP, above. **The browser's view** is a separate tool:

> *"The **browser's view** comes from [`agent-browser`](https://github.com/vercel-labs/agent-browser), a CLI that exposes the DOM, console, network, and Web Vitals as structured text. With React DevTools enabled (pass `--enable react-devtools` to `agent-browser open`…), it also reports the component tree and which Suspense boundaries are still pending."*

The Suspense detail is the one that earns its place: *which boundaries are still pending* is precisely the question behind every "why is this route not instant" investigation, and it is invisible in both the HTML and the MCP tools. The documented interaction pattern is a read-decide loop rather than a screenshot — *"An agent runs a command like `react tree`, reads the output, and decides what to inspect next, instead of looking at a DevTools panel it can't see."*

There is a third, much simpler channel that needs no tooling at all:

> *"`next dev` forwards browser console errors and warnings to the terminal (the `logging.browserToTerminal` config), so the output agents already read carries the client-side failures they're asked to fix."*

And a fourth that solves a purely operational problem:

> *"`next dev` also writes its PID, port, and URL to `.next/dev/lock`. A second `next dev` in the same project prints the running server's URL and the PID to kill, so an agent connects to the existing server instead of starting a duplicate."*

That lock is why an agent no longer spawns a second dev server on port 3001 and then debugs the wrong one.

## 4 · Letting errors drive the fix

This is the part that changes the loop's shape, and it only exists with Cache Components on.

> *"With Cache Components enabled, a blocking error presents labeled fixes, each making a different trade-off. The dev overlay adds a **Copy prompt** button that packages the chosen fix into a paste-ready prompt."*

The same menu prints to the terminal and to `next build` output, *"so an agent reading CI logs sees it too"*:

```txt
Route "/products/[slug]": Next.js encountered uncached data during prerendering.

`fetch(...)` or `connection()` accessed outside of `<Suspense>` prevents the route
from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] Cache the data access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic
    at ProductPage (app/products/[slug]/page.tsx:52:32)
```

🔴 **Three labelled options, three different products.** `[stream]` keeps the route instant and shows a fallback. `[cache]` keeps it instant and shows possibly-stale data. `[block]` gives up instant navigation for that route in exchange for always-fresh content. An agent that picks one at random has made a product decision on your behalf, which is the argument for reviewing these rather than accepting them in bulk.

The `Learn more` link resolves to a page written for this purpose:

> *"Each page follows the same shape, with the canonical patterns for every fix, the trade-offs against the other fixes, and the gotchas an agent is likely to miss on a first attempt."*

Those pages live under `/docs/messages` and are **not bundled** into the package — the one documented gap in the offline story.

### When the build error is not enough

> *"In `next dev` the stack frame resolves to your source, in both the dev overlay and the terminal. A production build minifies server code, so when the build error alone isn't enough, `next build --debug-prerender` turns on server source maps and continues past the first failure."*

Both halves matter. Source maps get you a real frame; **continuing past the first failure** gets you the whole list in one build instead of one per build.

## 5 · Skills — repositioned, not withdrawn

🔴 **This corrects a claim that stood in [Appendix E](05-appendix-e-version-watchlist.md) until 2026-09-04**, which listed first-party Skills as *withdrawn, superseded by version-matched bundled docs.* The docs say something narrower and different:

> *"Framework knowledge comes from the bundled docs, not from Skills. Benchmark results show that always-available context outperforms on-demand retrieval. Skills cover the tasks that are workflows rather than lookups"*

So Skills lost the job of carrying framework *knowledge* — and kept the job of carrying framework *workflows*. They ship today:

```bash
npx skills add vercel/next.js --skill next-dev-loop
```

The documented taxonomy is three-way:

- **Runtime foundations** — *"give any coding task a repeatable inspect, edit, and verify cycle."*
- **Interactive workflows** — *"make broader changes with user checkpoints."*
- **Unattended loops** — *"work toward a verifiable goal and stop only for genuine decisions."*

| Skill | What it does | Prerequisite |
|---|---|---|
| `next-dev-loop` | verifies each change against a running dev server using MCP and the browser | Next.js 16.3+ with Turbopack |
| `next-cache-components-adoption` | turns the flag on, finds routes that cannot prerender, fixes them one feature at a time with check-ins | — |
| `next-cache-components-optimizer` | writes a failing `instant()` test for the UI you named, refactors until it passes, commits the test with the change | a route that already builds with Cache Components |
| `next-partial-prefetching-adoption` | audits existing `prefetch={true}` links, enables the flag, resolves the insights | Cache Components already adopted |

The optimizer's sequence is worth reading as a method rather than a product: **write the failing assertion first, then refactor until it passes, then commit the test alongside the change so the property cannot silently regress.** That is the only documented answer to a problem [Appendix A part 2](01b-appendix-a-glossary-turbopack-mcp-instant.md) sets out — instant navigation has no HTTP signal, so the only way it stays true is a test that would fail if it stopped being true.

## Gotchas

**★ Symptom: the agent reports the MCP server is not connected.** Cause: almost always no dev server, or one that was already running when the config was added. Fix: work the documented list in order — Next.js 16 or above · `next-devtools-mcp` present in `.mcp.json` · `npm run dev` running · **restart the dev server if it was already running** · confirm the agent loaded its MCP config.

**★ Symptom: `get_compilation_issues` is missing from the tool list.** Cause: it and `compile_route` are documented **Turbopack only**, and the project builds with `--webpack`. Fix: either move to Turbopack or stop designing the loop around those two tools — without them the compile check costs a full `next build` each time.

**★ Symptom: a Server Action fails in logs with an opaque ID and grep finds nothing.** Cause: the ID is generated, not a symbol in your source. Fix: resolve it with `get_server_action_by_id`, which maps it to the file and function name. This is the tool people do not know exists and therefore spend an hour not using.

**★ Symptom: two dev servers are running and the agent is inspecting the wrong one.** Cause: a second `next dev` was started rather than reusing the first. Fix: this is what `.next/dev/lock` is for — it holds the PID, port and URL, and a second `next dev` prints both the running URL and the PID to kill. Read it rather than guessing a port.

```bash
cat .next/dev/lock
```

**★ Symptom: a client-side error is invisible to the agent even though the browser console shows it.** Cause: the agent reads the terminal, not the browser. Fix: nothing, usually — `next dev` already forwards browser console errors and warnings to the terminal via `logging.browserToTerminal`. If they are not arriving, check that config before reaching for heavier tooling.

**★ Symptom: an agent "fixed" a prerender error by setting `export const instant = false` on eight routes.** Cause: `[block]` is the option that always works, so it is the one a model reaches for under uncertainty — and it silently trades away instant navigation. Fix: treat the three labels as a product decision. `[stream]` and `[cache]` preserve the property; `[block]` abandons it. Review these individually and never in bulk.

**★ Symptom: a production build error points into minified server code.** Cause: production builds minify server code, so the frame is useless. Fix: rebuild with source maps, and get the rest of the list at the same time.

```bash
next build --debug-prerender
```

**★ Symptom: you fix one prerender error, rebuild, and hit the next one — twelve times.** Cause: an ordinary build stops at the first failure. Fix: `--debug-prerender` *"continues past the first failure"*, so one build enumerates them all and you can plan the work instead of discovering it.

**★ Symptom: an agent cannot tell you why a route is not instant, even with MCP connected.** Cause: MCP exposes the framework's view; which Suspense boundaries are still pending is a browser-side fact. Fix: add the browser view — `agent-browser open --enable react-devtools` — which reports the component tree and pending boundaries as text.

**★ Symptom: a team decides not to use Skills because "they were withdrawn."** Cause: a real but outdated reading — Skills stopped being the vehicle for framework knowledge, which the bundled docs now carry. Fix: they ship today for workflows. `npx skills add vercel/next.js --skill next-dev-loop` is current, and the adoption Skills are the documented path for the Cache Components and Partial Prefetching migrations.

**★ Symptom: `next-cache-components-optimizer` refuses to run on a route.** Cause: it has a stated prerequisite — the route must already build with Cache Components. Fix: run `next-cache-components-adoption` first. The Skills are ordered, and the ordering is the same one the flags have: Cache Components, then Partial Prefetching.

**★ Symptom: an agent asks to run a full `next build` on every iteration.** Cause: it does not know the cheap compile check exists. Fix: tell it about `get_compilation_issues` and `compile_route`, or install `next-dev-loop`, whose entire purpose is that inspect-edit-verify cycle against the running server.

## Interview questions

**★ Describe the Next.js MCP architecture and why it is split in two.**
Two pieces. `next dev` exposes an MCP endpoint at `/_next/mcp` carrying live dev-server state — errors, logs, routes, compilation issues. Separately, `next-devtools-mcp` is an npm package the agent launches, configured in `.mcp.json`; it discovers those endpoints, can talk to several dev servers on different ports simultaneously, and forwards each tool call to the right one. The split is deliberate decoupling: the agent-facing tool names stay stable while the framework's internals change underneath, which is the same reason any protocol boundary exists.

**★ Two of the nine MCP tools carry a "Turbopack only" qualifier. Why does that matter beyond the tools themselves?**
`get_compilation_issues` and `compile_route` are the tools that answer "does this compile" without a full `next build`. That is the slowest step in an agent's edit-verify loop, so losing them does not remove a feature — it changes the loop from seconds to minutes per iteration. Which means the bundler decision, usually framed as a build-performance question, is also a decision about how fast agent-assisted development goes on that repository.

**★ An error log names a Server Action by an opaque ID. How do you find the code?**
`get_server_action_by_id`, which maps the ID to its source file and function name. The reason a manual search fails is that the ID is generated at build time and appears nowhere in the source, so grepping it returns nothing and people conclude the log is useless. This is the clearest case in the tool list of a capability that exists specifically because the alternative is impossible rather than merely slow.

**★ Next.js prints three labelled fixes for a blocking prerender error. Should an agent just pick one?**
No, because they are not three spellings of one fix — they are three different products. `[stream]` keeps the route instant and shows a fallback while data arrives. `[cache]` keeps it instant and may show stale data. `[block]` gives up instant navigation entirely for always-fresh content. An agent under uncertainty will gravitate to `[block]` because it always works, and the result is a codebase that quietly stops being instant. The right posture is that the menu tells you the options and the trade-offs, and a human picks per route.

**★ Why does `next build --debug-prerender` exist when the dev overlay already shows these errors?**
Two reasons the docs give. Production builds minify server code, so a build failure's stack frame does not resolve to your source the way the dev overlay's does — the flag turns on server source maps. And an ordinary build stops at the first failure, whereas this one continues past it, so a single build enumerates every prerender problem instead of revealing them one build at a time. On a large migration that difference is the whole afternoon.

**★ Were the first-party Next.js Skills withdrawn?**
No — repositioned, and the distinction is exact. Skills stopped being the mechanism for framework *knowledge*, because the docs bundled in `node_modules` do that better; Vercel's stated reason is that benchmarks show always-available context beating on-demand retrieval. What Skills carry now is *workflows*: `next-dev-loop` for the inspect-edit-verify cycle, and the adoption Skills for Cache Components and Partial Prefetching. They install with `npx skills add vercel/next.js`.

**★ How does `next-cache-components-optimizer` prove it succeeded, and why is that method necessary rather than nice?**
It writes a failing `instant()` test for the UI you named, refactors until the test passes, and commits the test with the refactor. That is necessary rather than stylistic because instant navigation has no HTTP signal at all — a route that lost it still returns 200 with correct HTML, just rendered at request time. There is nothing for a status check, a smoke test or even a body diff to catch. A committed assertion that would fail if the property regressed is the only durable evidence available.

**★ An agent needs to know which Suspense boundaries are still pending. Where does that come from?**
Not from MCP — that is the framework's view, and pending boundaries are a browser-side fact. It comes from `agent-browser` with React DevTools enabled, which reports the component tree and pending Suspense boundaries as structured text an agent can read. The general shape here is worth stating: the framework view and the browser view answer different questions, and `next-dev-loop` exists because most real investigations need both.

**★ What stops an agent from starting a second dev server and debugging the wrong one?**
`.next/dev/lock`, which `next dev` writes with its PID, port and URL. A second `next dev` in the same project does not silently take another port — it prints the running server's URL and the PID to kill, so the agent connects to the existing instance. It is a small mechanism that removes a whole category of confusing session where the agent's edits and the browser's page are on different servers.

---

← [Appendix C part 1 · agent docs and AGENTS.md](03-appendix-c-tooling.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix C part 3 · the CLI surface](03c-appendix-c-the-cli-surface.md)
