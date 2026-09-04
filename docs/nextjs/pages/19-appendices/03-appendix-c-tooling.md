---
title: "Appendix C · part 1 — making an agent read your version instead of its training data: AGENTS.md, the docs bundled inside node_modules, and the same docs over the network"
sidebar_label: "07 · Appendix C — agent docs and AGENTS.md"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run, no timings**.

**Next.js 16 shipped a piece of infrastructure that has nothing to do with rendering: a copy of its own documentation, version-matched, inside `node_modules`. The reason is stated in the managed block the framework writes into your repository, and it is unusually blunt for a framework — *"This is NOT the Next.js you know."* Every coding agent's training data describes a Next.js where `params` is synchronous, `middleware` is the file name, `next lint` exists and PPR is experimental. All four are wrong now. This page covers the mechanism that fixes it: what gets bundled, how `AGENTS.md` points at it, what the framework writes for you and what it will overwrite, and how to reach the same docs over the network when `node_modules` is not the right surface.**

## 1 · What is actually bundled

> *"Next.js ships version-matched documentation inside the `next` package, allowing AI coding agents to reference accurate, up-to-date APIs and patterns."*

The layout mirrors the docs site:

```txt
node_modules/next/dist/docs/
├── 01-app/
│   ├── 01-getting-started/
│   ├── 02-guides/
│   └── 03-api-reference/
├── 02-pages/
├── 03-architecture/
└── index.mdx
```

Two properties matter more than the contents:

> *"Agents always have access to docs that match your installed version, with no network request or external lookup required."*

**Version-matched** is the whole point — upgrading Next.js upgrades the docs in the same step, *"including new guidance for existing features."* **No network request** is the second point and it is the one that makes it usable inside a sandbox, an air-gapped CI runner, or any agent that cannot browse.

🔴 **One thing is deliberately not bundled:** the per-error pages under `/docs/messages`. Those stay online, which matters because they are exactly what an error's `Learn more` link points at.

## 2 · `AGENTS.md` — the pointer, and the block you do not own

> *"An `AGENTS.md` file at the root of your project directs agents to these bundled docs instead of their training data."*
> *"Most AI coding agents, including Claude Code, Codex, Cursor, and GitHub Copilot, automatically read `AGENTS.md` when they start a session."*

### How it gets there

**New projects:** *"`create-next-app` generates `AGENTS.md` and `CLAUDE.md` automatically."* Suppress with `--no-agents-md`.

```bash
npx create-next-app@canary --no-agents-md
```

**Existing projects, on 16.3 or later:** the framework writes it during `next dev`.

> *"When an AI coding agent is detected in the environment and no managed block is present, Next.js auto-generates `AGENTS.md` and `CLAUDE.md` at the project root. Existing `AGENTS.md` or `CLAUDE.md` files are upserted, so content outside the managed block is preserved"*

🔴 **"Upserted" is the load-bearing word.** Your own instructions survive; the block between the markers does not — it is rewritten. The generated block says so about itself:

```md
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
```

And `CLAUDE.md` is generated as a single line that defers to it:

```md
@AGENTS.md
```

The last paragraph is the practically useful one: deleting the block from a changeset does not remove it, because `next dev` writes it back — so you get a permanently dirty tree until you commit it. It also tells you exactly where to look if you doubt any of this, naming the generator at `node_modules/next/dist/server/lib/generate-agent-files.js`.

**Put your own instructions outside the markers.** That is the documented contract:

> *"Add your own project-specific instructions outside the `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` markers, and they're preserved when Next.js updates the managed block."*

### Turning it off

> *"We believe leaving auto-generation on is a good default. Benchmark results on nextjs.org/evals show agents do better when they read the bundled docs."*

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
}

export default nextConfig
```

### 🔴 The three version tiers

This is the part that determines what you actually have to do, and it is easy to skim past:

| Your version | Docs bundled? | `AGENTS.md` auto-generated? | What you do |
|---|---|---|---|
| **16.3+** | yes | yes, by `next dev` | nothing |
| **16.2** | yes | **no** | write `AGENTS.md` yourself, pointing at `node_modules/next/dist/docs/` |
| **16.1 and earlier** | **no** | no | run the legacy command below |

```bash
npx @next/codemod@canary agents-md
```

> *"the legacy `agents-md` command… downloads a version-matched copy to `.next-docs/` in the project root and indexes it in `AGENTS.md`."*

And if you used that route before upgrading, clean up after:

> *"After upgrading, verify `AGENTS.md` still points at the docs for the installed Next.js version… If the pre-upgrade setup downloaded docs into `.next-docs/`, update `AGENTS.md` to point at the bundled docs, then remove `.next-docs/` once nothing references it."*

## 3 · The monorepo caveat, stated in the block itself

The managed block contains a parenthetical that is easy to read past and expensive to get wrong: the path is *"resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root."*

In a workspace layout, `next` is frequently hoisted to the root `node_modules`, or installed per-package, or both. An `AGENTS.md` at the repo root of a monorepo can therefore point at a path that does not exist — and an agent that cannot find the docs falls back on exactly the training data the file was written to override, silently. Put `AGENTS.md` next to the app that owns the dependency, or state the real relative path explicitly.

## 4 · The same docs over the network

For agents that fetch rather than read the filesystem — and for you, at a terminal — every docs page is available as Markdown:

> *"Append `.md` to any page URL on nextjs.org/docs for a plain Markdown version, and clients that send an `Accept: text/markdown` header get Markdown too. This includes the per-error pages under `/docs/messages`, which are not bundled."*

```bash
curl -sL https://nextjs.org/docs/app/guides/self-hosting.md | head -40
curl -sL -H 'Accept: text/markdown' https://nextjs.org/docs/app/guides/self-hosting | head -40
```

🔴 **The Markdown form carries frontmatter, and the frontmatter carries the freshness.** Every page returns a `version:` and a `lastUpdated:`. The first is the docs build and is identical everywhere; the second is the page's own review date and is the only one worth quoting. This is how [Appendix D](04-appendix-d-production-readiness-checklist-security.md) established that the official production checklist is months behind the release it is stamped with.

Two indexes exist, following the [`llms.txt` convention](https://llmstxt.org/):

| URL | What it is |
|---|---|
| [`/docs/llms.txt`](https://nextjs.org/docs/llms.txt) | index of every documentation page |
| [`/docs/llms-full.txt`](https://nextjs.org/docs/llms-full.txt) | the entire documentation as one file |
| [`/docs/sitemap.md`](https://nextjs.org/docs/sitemap.md) | a semantic, grouped index of paths |

**Use the sitemap before guessing a URL.** A wrong docs path returns a *"Page Not Found"* body containing helpful-looking prose — which an agent will happily summarise as if it were content.

## Gotchas

**★ Symptom: an agent writes `const { slug } = params` against a 16 project and is confident about it.** Cause: it is answering from training data, where `params` was synchronous. Fix: put `AGENTS.md` in place so it reads `node_modules/next/dist/docs/` first. This is the class of error the whole mechanism exists for, and the framework's own heading names it — *"This is NOT the Next.js you know."*

**★ Symptom: your working tree is permanently dirty with a change to `AGENTS.md` you keep deleting.** Cause: `next dev` re-adds the managed block every time. Fix: commit it. The block tells you this about itself — removing it from a diff only re-creates the uncommitted change, and committing it with your work keeps the tree clean.

**★ Symptom: you edited the agent instructions and they vanished after the next `next dev`.** Cause: you edited inside the managed markers, which are rewritten. Fix: move your instructions outside `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->`; content outside them is explicitly preserved on upsert.

**★ Symptom: in a monorepo the agent still uses training data despite `AGENTS.md` existing.** Cause: the bundled-docs path is resolved from the file's own directory, and in a workspace `next` may not be visible from the repo root at all. Fix: place `AGENTS.md` beside the app that depends on `next`, or write the actual relative path. Verify by listing it — if `ls` fails from that directory, so does the agent.

```bash
ls apps/web/node_modules/next/dist/docs/ || ls node_modules/next/dist/docs/
```

**★ Symptom: an agent cannot find the page for an error code even though it has the bundled docs.** Cause: the `/docs/messages` pages are deliberately **not** bundled. Fix: let it fetch them, with `.md` appended — that is the documented reason the network form exists.

**★ Symptom: after upgrading from 16.1, agents read stale docs from `.next-docs/`.** Cause: the legacy `agents-md` command downloaded a version-matched copy at the time, and `AGENTS.md` still indexes it. Fix: repoint `AGENTS.md` at `node_modules/next/dist/docs/` and delete `.next-docs/` once nothing references it — the docs prescribe exactly this post-upgrade check.

**★ Symptom: `AGENTS.md` never appears on 16.3+ however many times you run `next dev`.** Cause: generation is conditional — the docs say it happens *"When an AI coding agent is detected in the environment"*. A plain terminal is not that. Fix: write the file by hand; it is ordinary Markdown, and the managed block will be upserted into it the first time an agent is present.

**★ Symptom: `create-next-app` produced `CLAUDE.md` and a reviewer asks why it duplicates `AGENTS.md`.** Cause: it does not. The generated `CLAUDE.md` is the single line `@AGENTS.md` — an include, not a copy. Fix: leave it. Editing it to hold real content forks two files that were designed to have one source.

**★ Symptom: you cite a docs page as current because it says `version: 16.3.4`.** Cause: that field is the docs build number, stamped identically on every page. Fix: read `lastUpdated:` instead. Fetching with `.md` appended returns both, which is why the network form is worth knowing even when you have the bundled copy.

**★ Symptom: an agent summarises a docs page that does not exist.** Cause: it guessed a URL, got a 404 body full of navigational prose, and treated it as content. Fix: resolve paths through `/docs/sitemap.md` first. The failure is silent by construction — a 404 on that site returns readable text, not an error an agent recognises.

## Interview questions

**★ Why would a framework ship its own documentation inside `node_modules`?**
Because the alternative is a model answering from training data that describes an older major, and in Next.js 16 that gap is enormous: synchronous `params`, `middleware` as a filename, `next lint`, experimental PPR — all wrong now. Bundling makes the docs version-matched by construction, since upgrading the package upgrades the docs, and removes the network from the path entirely, so it works in a sandbox or an offline CI runner. The framework's own framing is a heading rather than an argument: *"This is NOT the Next.js you know."*

**★ What does "upserted" mean for `AGENTS.md`, and what should you keep where?**
It means Next.js rewrites the region between its markers and leaves everything else alone. So the managed block is not yours — editing it is pointless because `next dev` restores it — while anything outside the markers is preserved across regenerations and is where your project-specific instructions belong. The practical corollary is to commit the block rather than fight it: deleting it from a diff only re-creates the uncommitted change.

**★ Three Next.js versions need three different setups for agent docs. Name them.**
On 16.3 and later, the docs are bundled and `next dev` auto-generates `AGENTS.md` and `CLAUDE.md` when it detects an agent — nothing to do. On 16.2, the docs are bundled but nothing generates the file, so you write `AGENTS.md` yourself pointing at `node_modules/next/dist/docs/`. On 16.1 and earlier the docs are not bundled either, so you run `npx @next/codemod@canary agents-md`, which downloads a version-matched copy into `.next-docs/` and indexes it — and which you must then undo after upgrading, or agents will keep reading the stale copy.

**★ What breaks about this mechanism in a monorepo?**
Path resolution. The bundled-docs path is resolved relative to the `AGENTS.md` file's own directory, and in a workspace `next` is often hoisted, or installed per-package, so the repo-root `node_modules` may not contain it at all. The failure is silent: the agent cannot find the docs and falls back to training data, which is the exact behaviour the file was added to prevent. The fix is to put `AGENTS.md` beside the package that depends on `next`, and the check is to `ls` the path from that directory.

**★ Why are the `/docs/messages` pages deliberately not bundled?**
They are the targets of the `Learn more` links attached to runtime and build errors, and they are written for agents to read — one page per error, with the canonical fix for each option and the trade-offs between them. Keeping them online means they can be corrected and extended without shipping a new `next` package, which matters most for the error pages precisely because that is where guidance changes fastest. The docs cover the gap by making every page fetchable as Markdown.

**★ How do you check whether a Next.js docs page is current?**
Fetch it with `.md` appended, or send `Accept: text/markdown`, and read the frontmatter. Two fields come back and only one is meaningful: `version:` is the docs build and is identical on every page, while `lastUpdated:` is that page's own review date. The production checklist is the case worth remembering — `version: 16.3.4`, `lastUpdated: 2026-03-10`, and a body still calling Partial Prerendering experimental.

**★ An agent gives you a confident summary of a docs page. What is the cheapest way it could be wrong?**
It fetched a URL that does not exist. The docs site returns a *"Page Not Found"* body containing tips and index links — readable prose, not a machine-legible error — so a model can summarise it without ever noticing. Resolving paths through `/docs/sitemap.md` first costs one fetch and removes the failure mode entirely.

**★ Would you turn `agentRules` off?**
Rarely, and not for tidiness. Vercel's stated position is that the default is right and that their published benchmarks show agents perform better with the bundled docs available. The defensible reasons to disable it are policy-shaped rather than technical — a repository where generated files must not appear, or a monorepo where the auto-generated root file would point at a path that does not resolve and would therefore be worse than nothing. In the second case the better fix is to place a correct `AGENTS.md` where it belongs rather than to disable the mechanism.

---

← [Appendix B part 3 · the changes nothing catches](02c-appendix-b-the-changes-nothing-catches.md) · [Chapter 19 overview](01-explanation.md) · Next → **Appendix C part 2 · runtime sight — MCP, agent-browser and the error loop** *(not written yet)*
