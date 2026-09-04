---
title: "`AGENTS.md` has two halves: the block Next.js writes and rewrites, and the one you own — and the framework can only fix hallucination about itself"
sidebar_label: "02 · AGENTS.md and repository context maps"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run, no timings**.

**The bundled documentation solves exactly one problem: an agent hallucinating *Next.js*. It does nothing about an agent hallucinating *your application* — which cache boundaries you drew, which reads are allowed where, why that one route is deliberately blocking. Those are the failures that survive a correct framework model, and this chapter's own thesis names them: agents fail on cache semantics and server/client boundaries unless you encode those rules in-repo. So `AGENTS.md` has two halves. The framework writes and rewrites one of them. The other is a repository context map, it is yours, and almost nobody writes it well. This page covers the mechanics of the first half briefly — [Appendix C part 1](../19-appendices/03-appendix-c-tooling.md) is the full reference — and then spends its length on the half that is actually your job.**

## Half one · what the framework writes

> *"Next.js ships version-matched documentation inside the `next` package… An `AGENTS.md` file at the root of your project directs agents to these bundled docs instead of their training data."*

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

On **16.3+**, `next dev` writes the file for you *"When an AI coding agent is detected in the environment and no managed block is present"*, generating both `AGENTS.md` and a `CLAUDE.md` containing the single line `@AGENTS.md`. On **16.2** the docs are bundled but nothing generates the file. On **16.1 and earlier** neither, and the legacy path downloads a copy to `.next-docs/`:

```bash
npx @next/codemod@canary agents-md
```

🔴 **The contract you must internalise is "upsert".**

> *"Existing `AGENTS.md` or `CLAUDE.md` files are upserted, so content outside the managed block is preserved"*

Everything between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` is **not yours** — it is rewritten by `next dev`. Everything outside is preserved forever. That boundary is the entire authoring model for this file, and the rest of this page is about what to put on your side of it.

## Half two · the repository context map

Here is the failure the framework cannot touch. An agent with perfect Next.js 16 knowledge still does not know:

- that `app/lib/dal.ts` is the only module allowed to talk to the database
- that your product catalogue is cached for an hour and your inventory count deliberately is not
- that `/checkout` is intentionally blocking and must stay that way
- that `components/ui/` is client-side and `components/data/` is not, and the boundary is load-bearing rather than incidental

None of that is inferable from the code with any confidence, because **the code that follows a rule and the code that violates it look identical.** A `fetch` without `"use cache"` is either a deliberate dynamic read or a forgotten cache marker, and nothing distinguishes them.

### What a good context map contains

Write **rules with reasons**, not descriptions. A description of the codebase is something an agent can derive; a rule is something it cannot.

```md
<!-- everything below is outside the managed block and is preserved -->

# SprintDesk — project rules

## Data access
All database access goes through `app/lib/dal.ts`, which imports `server-only` and
performs authorization in the query's `where` clause. Never query the database from a
route handler, a Server Action or a page directly — the authorization lives in the
query, so bypassing the DAL bypasses it silently rather than loudly.

## Caching
Cache Components is on. Data fetching is dynamic by default. Every read must be one of:
  - marked `"use cache"` with an explicit `cacheLife` and a `cacheTag`, or
  - below a `<Suspense>` boundary, or
  - on a route that exports `instant = false`, which requires a comment saying why.
A read that is none of these is a bug even though it builds.

`cacheLife` `stale` must be >= 300 seconds for anything that should appear in the App
Shell, and >= 30 seconds for anything prefetchable at all. Shorter values are silently
excluded from prerenders — do not "fix" a staleness complaint by lowering `stale`.

## Mutations
Use `updateTag` when the user who triggered the change will see the result on the next
render (profile edits, project renames). Use `revalidateTag(tag, profile)` for content
other people will see later. Getting this backwards produces "I saved it and it didn't
save" reports against a healthy cache.

## Boundaries
`components/ui/` is `"use client"`. `components/data/` is Server Components and must
never gain a `"use client"` directive — if a data component needs interactivity, split
it and pass the projected fields down as props. Never pass a database row across the
boundary; project the fields you need first, because props are serialized into the RSC
Payload in full.

## Deliberate exceptions
`/checkout` exports `instant = false` on purpose: the totals must be fresh at render
time and a stale shell is worse than a slower navigation. Do not "optimise" this route.

## Verifying your work
Run `next typegen && tsc --noEmit` before proposing a change; a full `next build` is not
needed to check whether routes type-check. Use the MCP `get_compilation_issues` and
`compile_route` tools rather than building.
```

🔴 **Every rule in that example exists because it is invisible in the diff.** That is the test for whether a rule belongs in the file: if a reviewer looking at the changed lines alone could tell the rule was broken, the rule does not need to be written down — the review catches it. If they could not, it does.

### The "deliberate exceptions" section earns its place fastest

An agent that encounters `export const instant = false` and does not know why will do one of two unhelpful things: leave it alone out of caution, or remove it as an optimisation. A one-line reason converts both into correct behaviour. The same applies to any intentional-looking-wrong code — a `useEffect` that deliberately omits a dependency, a query that deliberately over-fetches, a component that is deliberately not memoised.

## Where the file goes, and the one place this breaks

Most agents read it automatically:

> *"Most AI coding agents, including Claude Code, Codex, Cursor, and GitHub Copilot, automatically read `AGENTS.md` when they start a session."*

🔴 **The monorepo caveat is stated inside the managed block itself**, and it is the setup failure with no error message. The bundled-docs path is *"resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root."* In a workspace, `next` is often hoisted, or installed per-package, or both. A root `AGENTS.md` can point at a path that does not exist — and an agent that cannot find the docs falls back to exactly the training data the file was written to override, **silently**.

```bash
# Run this from the directory holding AGENTS.md. If it fails, so does the agent.
ls node_modules/next/dist/docs/ || echo "AGENTS.md is in the wrong place"
```

Put `AGENTS.md` beside the app that owns the dependency. In a monorepo that usually means one per app, each with its own project rules, plus a root file carrying only the rules that genuinely span packages.

## Turning it off, and why you probably should not

```ts
// next.config.ts
const nextConfig = { agentRules: false }
export default nextConfig
```

> *"We believe leaving auto-generation on is a good default. Benchmark results on nextjs.org/evals show agents do better when they read the bundled docs."*

The defensible reasons are policy-shaped rather than technical: a repository where generated files must not appear, or a monorepo where the auto-generated root file would point at a path that does not resolve. In the second case the better fix is placing a correct file where it belongs, not disabling the mechanism.

## Gotchas

**★ Symptom: your instructions to the agent keep disappearing.** Cause: they were written inside the managed markers, which `next dev` rewrites. Fix: move them outside `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->`. Content outside is explicitly preserved on upsert; content inside is not yours.

**★ Symptom: the working tree is permanently dirty with an `AGENTS.md` change you keep reverting.** Cause: `next dev` re-adds the block each run. Fix: commit it. The block states this about itself — removing it from a diff only re-creates the uncommitted change, and committing it with your work keeps the tree clean.

**★ Symptom: in a monorepo the agent still writes Next.js 14 code despite `AGENTS.md` existing at the root.** Cause: the docs path resolves from the file's own directory and `next` is not visible from the repo root. The agent finds nothing and falls back to training data with no error. Fix: `ls node_modules/next/dist/docs/` from the directory holding the file; if it fails, move `AGENTS.md` beside the app that depends on `next`.

**★ Symptom: the agent knows Next.js perfectly and still queries the database from a page component.** Cause: that is not a framework fact — it is your architecture, and nothing in the bundled docs mentions your DAL. Fix: write the rule, with the reason, outside the managed block.

```md
All database access goes through `app/lib/dal.ts`, which imports `server-only` and does
authorization in the query's `where` clause. Bypassing it bypasses authorization
silently rather than loudly.
```

**★ Symptom: an agent "cleans up" `export const instant = false` on your checkout route.** Cause: it looks like a performance mistake and nothing says otherwise. Fix: a deliberate-exceptions section. One sentence of intent converts an agent from a hazard into a collaborator on that file — and the same line stops a human doing it next quarter.

**★ Symptom: an agent responds to a staleness complaint by lowering `cacheLife` `stale` to 10 seconds, and prefetching stops working entirely.** Cause: it does not know about the enforced floors — under 30 seconds content is excluded from prerenders, under 5 minutes it never enters the App Shell. Fix: state the floors and the correct remedy in your rules, because this is a case where the plausible fix is the wrong one.

**★ Symptom: two developers get very different results from the same agent on the same repo.** Cause: `AGENTS.md` and `.mcp.json` were treated as personal editor config rather than source. Fix: commit both. They are as load-bearing as `tsconfig.json`, and leaving them untracked creates two classes of contributor with no visible cause.

**★ Symptom: `AGENTS.md` never appears on 16.3+ no matter how often you run `next dev`.** Cause: generation is conditional on an agent being detected in the environment; a plain terminal is not one. Fix: write the file by hand — it is ordinary Markdown — and the managed block will be upserted into it the first time an agent is present.

**★ Symptom: after upgrading from 16.1, agents read stale docs.** Cause: the legacy `agents-md` command downloaded a version-matched copy into `.next-docs/` at the time, and `AGENTS.md` still indexes it. Fix: repoint at `node_modules/next/dist/docs/` and delete `.next-docs/` once nothing references it — the docs prescribe exactly this post-upgrade check.

**★ Symptom: your context map is 400 lines and the agent ignores most of it.** Cause: it has become a description of the codebase rather than a set of rules. Fix: delete anything an agent could derive by reading the code, and keep only what it could not — the reasons, the deliberate exceptions, and the rules whose violation is invisible in a diff. The test is: could a reviewer looking at the changed lines alone tell this rule was broken? If yes, cut it.

**★ Symptom: `CLAUDE.md` and `AGENTS.md` have drifted apart.** Cause: someone put real content in `CLAUDE.md`. Fix: it is generated as the single line `@AGENTS.md` — an include, not a copy. Keep one source and let the other point at it.

## Interview questions

**★ What can bundled documentation fix, and what can it not?**
It fixes hallucination about the framework: which APIs exist, what is async, what a config key does, what the current file conventions are. It cannot fix hallucination about your application, because none of that is in the docs. Which module owns database access, which reads are deliberately dynamic, which route is intentionally blocking, where the client boundary sits and why — those survive a perfectly-informed agent, and they are the failures this chapter's own thesis names. That is why `AGENTS.md` has two halves and only one of them is written for you.

**★ Explain the upsert contract for `AGENTS.md`.**
Next.js rewrites the region between its `BEGIN`/`END` markers on `next dev` and leaves everything else untouched. So the managed block is not yours — editing it is futile — while everything outside it is preserved across regenerations and is where your project rules go. The corollary people miss is that you should commit the managed block rather than fight it: deleting it from a changeset only re-creates the uncommitted change, so the tree stays dirty until you accept it.

**★ What is the test for whether a rule belongs in a repository context map?**
Whether its violation is visible in the diff. If a reviewer reading only the changed lines could tell the rule was broken, code review already catches it and writing it down adds noise. If they could not — a missing `"use cache"` looks exactly like a deliberate dynamic read, a database query in a page looks exactly like a database query in the DAL — then the rule needs to be stated, because nothing else will catch it. That test also keeps the file short, which is what keeps it read.

**★ Why does a monorepo break this mechanism, and what makes the failure hard to notice?**
The bundled-docs path resolves relative to the `AGENTS.md` file's own directory, and in a workspace `next` may be hoisted to the root or installed per-package, so the path a root-level file names may not exist. The failure is silent by construction: the agent cannot find the docs, no error is raised, and it proceeds on training data — which is precisely the behaviour the file was added to prevent. So the setup appears complete and delivers nothing. The check is one `ls` from the directory containing the file.

**★ Why is a "deliberate exceptions" section disproportionately valuable?**
Because intentional-looking-wrong code is where an agent does active harm rather than merely failing. `export const instant = false` reads as an unoptimised route; a `useEffect` missing a dependency reads as a bug; a query that over-fetches reads as sloppiness. Facing those, an agent either leaves them alone out of caution — losing you the help — or "fixes" them, which is worse. One sentence of stated intent converts both outcomes into the right one, and it pays off for human reviewers on exactly the same schedule.

**★ Would you disable `agentRules`?**
Rarely, and not for tidiness. Vercel's position is that the default is right and their published benchmarks back it. The defensible cases are policy — a repository that forbids generated files — or a monorepo where the auto-generated root file would point at a path that does not resolve and would therefore be actively misleading. In that second case disabling it is the worse of two fixes; placing a correct `AGENTS.md` beside the app that owns the dependency solves the actual problem.

**★ A team reports that agent quality is inconsistent across developers on one repository. Where do you look?**
Whether `AGENTS.md` and `.mcp.json` are committed. Both are frequently treated as personal editor configuration and left untracked, which produces exactly this symptom: identical prompts and identical models producing different quality, with no visible cause in the codebase. They are source files with the same standing as `tsconfig.json`. The second thing to check, in a monorepo, is whether the file each developer has actually resolves to the bundled docs from where it sits.

**★ Your context map says data fetching is dynamic by default. Why is that worth writing down when the framework already knows it?**
Because the framework knows the default and only your team knows the consequence. The agent will read in the bundled docs that Cache Components makes fetching dynamic; what it will not know is that in this repository an unmarked read is considered a bug rather than an acceptable default, that your `stale` values have floors chosen deliberately, and that lowering `stale` to fix a staleness complaint will silently disable prefetching. That is the gap between knowing a framework's semantics and knowing a team's policy, and only one of those ships in `node_modules`.

---

← [Why the framework ships agent infrastructure](01-why-the-framework-now-ships-agent-infrastructure-the-shift-f.md) · [Chapter 14 overview](01-explanation.md) · Next → [The Next.js DevTools MCP server](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md)
