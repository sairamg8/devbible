---
title: "14 · Agent-driven development — the framework now ships infrastructure for coding agents, and everything it ships is aimed at one problem: an agent's mental model of Next.js is two majors out of date and it has no way to know"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 14 index: why the framework ships agent infrastructure, AGENTS.md and version-matched bundled docs, the DevTools MCP server's nine tools, Skills and agent-browser and the fix menu, agent-authored migrations, the verification loop, the honest limits, and the SprintDesk milestone."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and the [production checklist](https://nextjs.org/docs/app/guides/production-checklist) (body dated `2026-03-10`). Every chunk carries its own `> Verified:` line naming the pages and `lastUpdated` values it was written from.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout**, so nothing here is probed — documentation-verified throughout, with **no sandbox run**, no timings and no console output.

**The managed block Next.js writes into your `AGENTS.md` opens with the line `# This is NOT the Next.js you know`, and that sentence is the whole chapter. Everything the framework ships here — version-matched documentation inside the `next` package, an MCP endpoint inside the dev server, a Copy prompt button on the error overlay, Skills for the workflows that are not lookups — exists because the model writing your code learned a Next.js that no longer exists, and because the ways it gets 16 wrong are unusually quiet. The App Router's most consequential properties do not fail loudly. A route that stops streaming still returns `200` with correct HTML. A cache profile guessed into existence typechecks. A boundary moved one level up produces an identical settled DOM. So the infrastructure is not really about making agents smarter; it is about manufacturing signals where the platform provides none, and then writing down the decisions no signal can supply. The chapter ends with the honest version of that: what none of it reaches, and why the remaining failures are now failures of product knowledge rather than framework knowledge.**

## 🔴 What this chapter corrects

Four claims in wide circulation are wrong at 16.3.4, each corrected with a verbatim source on the page that owns it:

| Claim you will meet | What the documentation says | Where |
|---|---|---|
| First-party Skills were withdrawn, superseded by bundled docs | **Repositioned, not withdrawn.** Framework knowledge comes from the bundled docs; Skills ship today for *"the tasks that are workflows rather than lookups"* | [04](04-163-preview-first-party-skills-for-multi-step-workflows.md) |
| An `AGENTS.md` is something you hand-write | On 16.3+, `next dev` generates it when it detects an agent, and *upserts* an existing file so your content outside the managed block survives | [02](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) |
| Agents need a docs MCP server to get current Next.js information | The docs ship **inside the package** at `node_modules/next/dist/docs/`, read *"with no network request or external lookup required"*; MCP exists for **runtime** sight instead | [03](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) |
| Give an agent good context and App Router mistakes go away | The failure boundary moved from *does not know Next.js 16* to *does not know your product*, which no amount of framework context reaches | [06b](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Why the framework ships agent infrastructure](01-why-the-framework-now-ships-agent-infrastructure-the-shift-f.md)** | the shift from autocomplete to agent-readable project context, and what problem each piece is aimed at |
| 2 | **[`AGENTS.md` and repository context maps](02-agentsmd-and-repository-context-maps-version-matched-bundled.md)** | 🔴 version-matched docs bundled in the package; the managed block and its markers; `create-next-app` and `--no-agents-md`; the 16.3 / 16.2 / ≤16.1 version floors |
| 3 | **[The DevTools MCP server](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md)** | the `/_next/mcp` endpoint and all nine tools; 🔴 `get_compilation_issues` and `compile_route` are **Turbopack only**; the Documentation Gateway |
| 4 | **[Skills, `agent-browser` and fix-menus](04-163-preview-first-party-skills-for-multi-step-workflows.md)** | 🔴 Skills repositioned not withdrawn; the four named Skills; `agent-browser` reporting which Suspense boundaries are still pending; `logging.browserToTerminal`; `.next/dev/lock` |
| 5 | **[Agent-authored migrations](05-practical-agent-workflows-agent-authored-migrations.md)** | the published upgrade prompt analysed clause by clause; the three codemods and what they do **not** cover; `--debug-build-paths` scoping |
| 6 | **[The verification loop and review discipline](05b-the-verification-loop-guardrails-and-review-discipline.md)** | 🔴 the failing assertion is written **first** and committed with the change; guardrails enforced in the environment rather than the prompt |
| 7 | **[Honest limits: the silent failures](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md)** | 🔴 `revalidateTag`'s second argument — the type system checks arity and never the value; boundary placement is tree-global while a diff is file-local; the class that returns `200` with correct HTML |
| 8 | **[What an agent cannot decide](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md)** | 🔴 `[stream]`/`[cache]`/`[block]` all clear the error and mean different things; an authz check that proves the session and never the relationship; a11y as behaviour; changed defaults with **no diff** |
| 9 | **[Milestone: SprintDesk gets an `AGENTS.md`](07-project-milestone-sprintdesk-gets-an-agentsmd.md)** | the context map built from decisions rather than advice, MCP proven with a checked `get_routes`, one scoped refactor, and 14 tickable acceptance criteria |

## Phase gate

You are done with this chapter when you can take a repository you know well and write its `AGENTS.md` in under twenty lines, where **every line fails the derivability test** — nothing an agent could have got from the code or from the framework's own bundled documentation. Then, for each line, name the failure it prevents and say whether that failure would have produced a signal: a build error, a failing test, a wrong pixel, or nothing at all.

The common stopping point is a file full of good advice about Server Components. That advice is already in the package, better written, version-matched, and read without a network request. The chapter's actual subject is the other file — the one that says how stale your data may be, which routes must keep their shell, and what your authorization rule means — because those are the facts that no tooling on this list can supply and every failure worth a page comes from missing them.

## Where this connects

- [Chapter 5 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the model an agent's training data predates, and the source of the guessed-profile failure
- [Chapter 3 · Server vs Client Components](../03-server-components-vs-client-components/05b-what-server-only-does-not-protect.md) — what `server-only` does and does not catch when a boundary moves
- [Chapter 13 · Testing and developer experience](../13-testing-and-developer-experience/10-the-instant-playwright-helper.md) — the `instant()` helper the verification loop is built on, and the linter you must restore yourself after 16
- [Chapter 10 · Forms, auth and security hardening](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md) — why an action's session check is not an authorization check
- [Chapter 12 · SEO, metadata and accessibility](../12-seo-metadata-and-accessibility/01-explanation.md) — accessibility as behaviour under assistive technology, which is the limit case for agent-authored markup
- [Appendix B · the changes nothing catches](../19-appendices/02c-appendix-b-the-changes-nothing-catches.md) — the changed defaults with no diff, which a migration review must start from
- [Appendix C · tooling](../19-appendices/03-appendix-c-tooling.md) — the reference half of this chapter: MCP tools, the CLI surface, the codemods

---

Start → [01 · Why the framework ships agent infrastructure](01-why-the-framework-now-ships-agent-infrastructure-the-shift-f.md)
