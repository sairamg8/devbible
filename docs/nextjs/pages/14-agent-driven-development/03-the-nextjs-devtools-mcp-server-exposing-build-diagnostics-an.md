---
title: "The MCP server is how an agent stops guessing — nine tools that answer questions the source code cannot, and one that resolves an ID no grep will ever find"
sidebar_label: "03 · The DevTools MCP server"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`) and [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · requires **Next.js 16 or above** and a running dev server. Documentation-verified; **no sandbox run, no timings**.

**An agent editing your app without MCP is doing something no competent engineer would accept: proposing fixes for errors it has not seen, on routes it has not enumerated, verifying nothing. Everything it knows comes from reading source files, and a running Next.js application knows a great deal that is not in any source file — which routes actually exist, whether the project currently compiles, what the dev server logged thirty seconds ago, and which source function a Server Action ID belongs to. This page is about working with that surface: what to ask, what the answers are good for, and the two places it stops. [Appendix C part 2](../19-appendices/03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md) is the reference; this is the practice.**

## Setting it up, in one file

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

`.mcp.json` at the project root, and **commit it** — it is source, not editor config.

The architecture is two pieces and mixing them up is why setup fails:

> *"Next.js 16+ includes a built-in MCP endpoint at `/_next/mcp` that runs within your development server. The `next-devtools-mcp` package automatically discovers and communicates with these endpoints"*

`/_next/mcp` ships **inside the framework** and exists only while `next dev` runs. `next-devtools-mcp` is a **separate npm package your agent launches** that finds those endpoints — *"Connect to multiple Next.js instances running on different ports"* — and forwards each call to the right one.

⚠️ **Stated as uncertain:** the documentation gives no version-support policy for `next-devtools-mcp` itself. It installs as `@latest`, versioned independently of `next`, so the pairing is whatever npm resolves that day. Pin it yourself if you need reproducibility.

## The nine tools, grouped by the question they answer

### "What is broken right now?"

**`get_errors`** — *"Retrieve current build errors, runtime errors, and type errors from your dev server"*. This is the entry point for almost every loop, and the reason is that it collapses three separate investigations into one call: build failures, runtime exceptions and type errors arrive together, already associated with the routes they came from.

**`get_logs`** — *"Get the path to the development log file containing browser console logs and server output"*. Note it returns a **path**, not contents. That is deliberate: logs are large, and an agent should grep them rather than ingest them.

### "What exists?"

**`get_routes`** — *"Get all routes that will become entry points by scanning the filesystem. Returns routes grouped by router type (appRouter, pagesRouter). Dynamic segments appear as `[param]` or `[...slug]` patterns"*.

🔴 **Use this before any change that touches routing**, because the filesystem-to-route mapping is exactly where an agent's assumptions are weakest: route groups in parentheses do not appear in URLs, private folders prefixed with an underscore are not routes at all, and parallel-route slots beginning `@` are not either. Reading the directory tree and inferring routes gets all three wrong; asking gets them right.

**`get_project_metadata`** — *"Retrieve project structure, configuration, and dev server URL"*. The orienting call in an unfamiliar repository.

**`get_page_metadata`** — *"Get metadata about specific pages including routes, components, and rendering information"*. The *rendering* part is what earns it a place: whether a route is static or dynamic is a question about the build, not the source.

### "Where did this come from?"

**`get_server_action_by_id`** — *"Look up Server Actions by their ID to find the source file and function name"*.

🔴 **This is the tool nobody knows exists and it solves an otherwise impossible problem.** A failing Server Action appears in logs as an opaque generated ID. That ID is created at build time and **appears nowhere in your source**, so grepping for it returns nothing and people reasonably conclude the log line is useless. The tool maps it back to a file and a function name.

### "Does it compile?"

**`get_compilation_issues`** — *"Retrieve compilation warnings and errors for the whole project from the bundler. **Turbopack only.**"*

**`compile_route`** — *"Trigger on-demand compilation of a specific route without making an HTTP request to it. Accepts either a `routeSpecifier` (e.g. `/blog/[slug]`, as returned by `get_routes`) or a `path` (e.g. `/blog/hello-world`) which is resolved to the matching route using the dev router's live route table. Returns any compilation issues for the route. **Turbopack only.**"*

These two change the economics of the whole loop. The docs say why:

> they *"report whether the code compiles straight from the dev server, so an agent doesn't have to run a full `next build` to find out."*

🔴 **Both are Turbopack only.** A project building with `--webpack` loses them, which means the bundler decision — normally framed as build performance — also sets how fast agent-assisted work goes on that repository. That is worth knowing before someone opts out of Turbopack for an unrelated reason.

Note `compile_route` accepts **either** identifier, which matters because an agent usually has one and not the other: a route pattern from `get_routes`, or a concrete URL from a bug report.

## The loop this enables

Without MCP, an agent's cycle is: read source → guess → edit → ask a human. With it:

1. **`get_errors`** — what is actually failing, with routes attached
2. **`get_server_action_by_id`** if the error names an action ID
3. read the relevant source, and the bundled docs for the API involved
4. edit
5. **`compile_route`** on the affected route — seconds, not a full build
6. **`get_errors`** again to confirm the error is gone and no new one appeared

Step 5 is the one that makes the loop viable. A cycle gated on `next build` costs minutes per iteration on a large app, which is enough to push an agent toward proposing a batch of speculative changes rather than verifying one at a time — and a batch is exactly what you cannot review well.

## Where it stops

**It is dev-only.** Every capability is a dev-server capability: build errors, runtime errors, type errors, dev logs, compilation issues, route tables. There is no production surface, and the requirements are *"Next.js 16 or above"* plus a running dev server. Production observability is a completely different mechanism — `instrumentation.ts`, `onRequestError`, an OpenTelemetry exporter — covered in [chapter 16](../16-deployment-scaling-and-observability/01-explanation.md).

**It is the framework's view, not the browser's.** Rendered output, the DOM, client console state, Web Vitals and which Suspense boundaries are still pending are not in it. That is [page 04](04-163-preview-first-party-skills-for-multi-step-workflows.md)'s subject.

There is also a much simpler channel worth knowing before reaching for tooling:

> *"`next dev` forwards browser console errors and warnings to the terminal (the `logging.browserToTerminal` config), so the output agents already read carries the client-side failures they're asked to fix."*

And one that removes a whole class of confused session:

> *"`next dev` also writes its PID, port, and URL to `.next/dev/lock`. A second `next dev` in the same project prints the running server's URL and the PID to kill, so an agent connects to the existing server instead of starting a duplicate."*

## Gotchas

**★ Symptom: the agent reports the MCP server is not connected.** Cause: almost always no dev server, or one that was already running when the config was added. Fix: work the documented list in order — Next.js 16+ · `next-devtools-mcp` in `.mcp.json` · `npm run dev` running · **restart the dev server if it was already running** · confirm the agent loaded its MCP config. The restart is the step people skip.

**★ Symptom: a Server Action fails in the logs with an opaque ID and grep finds nothing.** Cause: the ID is generated at build time and does not exist in your source. Fix: `get_server_action_by_id`. Without it this is unsolvable by search, which is why people conclude the log is useless and go looking somewhere else entirely.

**★ Symptom: an agent proposes a full `next build` on every iteration.** Cause: it does not know the cheap compile check exists. Fix: point it at `get_compilation_issues` and `compile_route`, or install the `next-dev-loop` Skill whose entire purpose is that cycle. A loop gated on full builds pushes an agent toward batching speculative changes, which is the review problem, not just a speed problem.

**★ Symptom: `get_compilation_issues` and `compile_route` are missing from the tool list.** Cause: both are documented **Turbopack only** and the project builds with `--webpack`. Fix: move to Turbopack, or stop building the workflow around those two tools — and know that the bundler choice is now also an agent-velocity choice.

**★ Symptom: an agent invents routes that do not exist, or misses ones that do.** Cause: it inferred routing from the directory tree, where route groups `(marketing)`, private folders `_components` and parallel slots `@modal` all mislead. Fix: `get_routes`, which returns what will actually become an entry point, grouped by router, with dynamic segments shown as `[param]` or `[...slug]`.

**★ Symptom: you ask an agent to diagnose a production incident through MCP and get nothing useful.** Cause: there is no production surface — every capability is dev-server state. Fix: use telemetry instead. The dangerous version of this mistake is a team concluding they have observability because the agent can see errors; those are two different systems and only one of them is running in production.

**★ Symptom: the agent is inspecting a dev server that is not the one you are looking at.** Cause: a second `next dev` was started on another port. Fix: `.next/dev/lock` holds the PID, port and URL, and a second `next dev` prints both the running URL and the PID to kill rather than silently taking another port. Read it instead of guessing.

```bash
cat .next/dev/lock
```

**★ Symptom: a client-side error is invisible to the agent although the browser console shows it.** Cause: the agent reads the terminal, not the browser. Fix: usually nothing is needed — `next dev` already forwards browser console errors and warnings to the terminal via `logging.browserToTerminal`. If they are not arriving, check that config before adding tooling.

**★ Symptom: `get_logs` returns a path and the agent ingests the whole file.** Cause: treating a path as a request to read everything. Fix: it returns a path deliberately, because dev logs are large; grep it for the route or the timestamp in question. An agent that reads the whole log has spent its context on noise before reaching the failure.

**★ Symptom: `get_page_metadata` says a route is dynamic and the source looks entirely static.** Cause: something below it reads a Request-time API, or a dependency does — and the rendering mode is a property of the whole subtree, not of the file you are reading. Fix: trust the tool over the source reading, then find the read. This is exactly the class of question MCP exists for: the answer is not in any one file.

**★ Symptom: `.mcp.json` works for one developer and not another.** Cause: it was not committed. Fix: commit it, as you would `tsconfig.json`. MCP configuration is repository configuration.

## Interview questions

**★ Describe the two pieces of the Next.js MCP setup and why the split exists.**
`next dev` exposes an MCP endpoint at `/_next/mcp` carrying live dev-server state — errors, logs, routes, compilation status. Separately, `next-devtools-mcp` is an npm package the agent launches, configured in `.mcp.json`, which discovers those endpoints, can address several dev servers on different ports at once, and forwards each tool call to the right one. The docs give the reason as decoupling: the agent-facing tool surface stays stable while the framework's internals change underneath, which is the ordinary argument for any protocol boundary.

**★ Why can `get_server_action_by_id` not be replaced by searching the codebase?**
Because the ID is generated at build time and does not appear in the source at all. A Server Action failure in a log gives you that ID and nothing else, so grepping returns zero results — and the usual conclusion is that the log line is unhelpful, which sends the investigation somewhere unrelated. The tool maps the ID back to the file and function. It is the clearest example in the tool list of a capability that exists because the alternative is impossible rather than merely slow.

**★ Two MCP tools are Turbopack-only. Why does that matter beyond the tools?**
`get_compilation_issues` and `compile_route` answer "does this compile" without a full `next build`, and that is the slowest step in an agent's edit-verify cycle. Losing them does not remove a feature so much as change the loop from seconds per iteration to minutes — which in turn changes agent behaviour, because a slow verify step pushes toward batching several speculative edits before checking. So a decision usually framed as build performance is also a decision about how reviewable agent-assisted work is on that repository.

**★ Why would you use `get_routes` rather than reading the `app/` directory?**
Because the directory tree is not the route table and three conventions actively mislead: route groups in parentheses organise files without appearing in URLs, folders prefixed with an underscore are excluded from routing entirely, and `@`-prefixed parallel-route slots are not routes either. An agent inferring routes from folders gets all three wrong in the same direction — inventing routes that do not exist. The tool returns what will actually become an entry point, grouped by router type, with dynamic segments rendered as `[param]` or `[...slug]`.

**★ Can MCP help with a production incident?**
No. Every capability is dev-server state and the stated requirements are Next.js 16+ with a running dev server; there is no production surface. The failure worth guarding against is not the wasted attempt but the conclusion that follows it — a team believing they have observability because their agent can see errors, when what it can see is one developer's dev server. Production needs `instrumentation.ts`, `onRequestError` and an exporter, which is an unrelated system that has to be built.

**★ Walk through the loop MCP makes possible.**
`get_errors` to find what is actually failing with routes attached; `get_server_action_by_id` if the error names an action ID; read the relevant source and the version-matched bundled docs for the API involved; edit; `compile_route` on the affected route to check compilation in seconds; `get_errors` again to confirm the original error is gone and nothing new appeared. The load-bearing step is the second-to-last, because a cheap verify is what allows one change at a time — and one change at a time is what makes the work reviewable.

**★ `get_logs` returns a path rather than contents. Is that a limitation?**
It is a design choice and the right one. Development logs are large, and an agent that ingests a whole log file has spent its context window on noise before it reaches the relevant line. Returning a path lets the agent grep for the route, the timestamp or the error string and read only what matters. The general principle is worth carrying into any tool you design for an agent: return a handle to large data, not the data.

---

← [`AGENTS.md` and repository context maps](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) · [Chapter 14 overview](01-explanation.md) · Next → **Skills, agent-browser and error fix-menus** *(not written yet)*
