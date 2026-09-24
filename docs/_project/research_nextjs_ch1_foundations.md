---
name: research-nextjs-ch1-foundations
description: Banked primary-source research for Next.js devbible chapter 1 (Introduction) — the support policy in MAJOR versions, the create-next-app prompt set verbatim, the 16.3 feature list, Node 20.9 / TS 5.1 floors, and the React-canary-built-in rule. Fetched 2026-09-04; do not re-fetch for chapter 1.
metadata:
  type: reference
---

# Next.js chapter 1 — banked research, 2026-09-04

**Fetched once for the whole chapter, per the `devbible-topic` skill. Do not re-fetch these
for any chapter-1 page.** Sources: `nextjs.org/support-policy`,
`nextjs.org/docs/app/getting-started/installation` (page header: `version: 16.3.4`,
`lastUpdated: 2026-07-21`), `nextjs.org/blog/next-16-3` (`publishedAt: August 3rd 2026`).

## 🔴 The support policy is stated in MAJOR versions — the corpus's own callout gets this wrong

`nextjs.org/support-policy`, quoted:

- **Canary** — *"Next.js publishes new versions to the `canary` channel daily."* Pre-release
  builds, extensively internally tested before promotion. Not recommended for production traffic.
- **Active LTS** — *"A major version of Next.js remains in Active LTS until the subsequent major
  version is released."* Gets new features, regular bug fixes, performance improvements, security
  patches.
- **Maintenance LTS** — *"Upon release of a new major, the previous major transitions to
  Maintenance LTS."* Commits to *"shipping only critical bug fixes and essential security
  updates."* **Two years following the initial release.**

| Major | Release date | Status |
|---|---|---|
| **16.x** | Oct 21, 2025 | **Active LTS** |
| **15.x** | Oct 21, 2024 | **Maintenance LTS** |

⚠️ **The correction callout already on `04-versioning-…` says "Active LTS (currently 16.3)" and
"Maintenance LTS (currently 15.5)". That names MINORS.** The policy's unit is the major line:
**16.x** and **15.x**. 16.3 and 15.5 are simply the newest minors *within* those lines. Fix the
callout; do not propagate it.

🔴 **Two findings that are load-bearing and are not on any page yet:**

1. **On Maintenance LTS, a semver-MINOR bump can break you.** Verbatim: *"For Maintenance LTS
   versions, updates will land as semver-minor releases, even if they are breaking changes."*
   So the usual "minors are safe, pin the major" habit is **wrong on 15.x**.
2. **15.x leaves Maintenance LTS around Oct 21, 2026** — two years from Oct 21, 2024, which is
   ~7 weeks after this was banked (2026-09-04). Anyone still on 15.x is nearly out of security
   patches. 🔴 Re-derive the remaining time from the release date at read time rather than
   quoting "7 weeks"; the arithmetic is the durable part.

## Floors and support matrix (installation page)

- **Minimum Node.js version: 20.9** (not "20+").
- **Minimum TypeScript version: `v5.1.0`.**
- Operating systems: macOS, Windows (including WSL), Linux.
- Browsers, zero-config: **Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+**.

## React: the App Router does NOT use your package.json React

Verbatim *Good to know*: *"The `App Router` uses React canary releases built-in, which include
all the stable React 19 changes, as well as newer features being validated in frameworks, but you
should still declare react and react-dom in package.json for tooling and ecosystem
compatibility."* And: *"The `Pages Router` uses the React version from your `package.json`."*

🔴 **That is a genuine gotcha:** the React version in your lockfile is not the React the App
Router renders with, so "pin React to fix a React bug" does not work the way people expect.

## `create-next-app` — the prompts, verbatim

`--yes` *"skips prompts using saved preferences or defaults. The default setup enables
TypeScript, Tailwind CSS, ESLint, App Router, and Turbopack, with import alias `@/*`, and
includes `AGENTS.md` (with a `CLAUDE.md` that references it)."*

First prompt set:

```txt
What is your project named? my-app
Would you like to use the recommended Next.js defaults?
    Yes, use recommended defaults - TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md
    No, reuse previous settings
    No, customize settings - Choose your own preferences
```

Under `customize settings`:

```txt
Would you like to use TypeScript? No / Yes
Which linter would you like to use? ESLint / Biome / None
Would you like to use React Compiler? No / Yes
Would you like to use Tailwind CSS? No / Yes
Would you like your code inside a `src/` directory? No / Yes
Would you like to use App Router? (recommended) No / Yes
Would you like to customize the import alias (`@/*` by default)? No / Yes
What import alias would you like configured? @/*
Would you like to include AGENTS.md to guide coding agents to write up-to-date Next.js code? No / Yes
```

⚠️ **`Would you like to use React Compiler?` is in the customize list but NOT in the recommended
defaults line.** So the recommended path leaves the compiler OFF.

## Bundler, linting, build

- *"Turbopack is now the default bundler. To use Webpack run `next dev --webpack` or
  `next build --webpack`."*
- *"Starting with Next.js 16, `next build` no longer runs the linter automatically."*
  Migration codemod: `npx @next/codemod@canary next-lint-to-eslint-cli .`
- Linter choice is ESLint (*"comprehensive rules"*) or Biome (*"fast linter + formatter"*).
- `next upgrade` also *"updates the documentation bundled inside the `next` package at
  `node_modules/next/dist/docs/`"* — this is the mechanism behind the retired Skills.

## The root layout

*"This file is the root layout. It's required and must contain the `<html>` and `<body>` tags."*
🔴 *Good to know*: *"If you forget to create the root layout, Next.js will automatically create
this file when running the development server with `next dev`."* — so a missing root layout is
**not** the error most people expect; dev silently fixes it and a build from a clean checkout
behaves differently from the machine it was written on.

Minimal pair, verbatim from the docs:

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
// app/page.tsx
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

## Next.js 16.3 — the feature list, exact names (published August 3rd 2026)

Stable, no code changes needed: **Less memory usage in dev** (Turbopack, *"up to 90% less"*,
from disk caching + memory eviction) · **Faster builds** (disk cache now covers `next build`,
*"5.5x faster builds"* on some CI projects) · **Faster type checking with TypeScript 7**
(*"a 10x faster native port"*; adopt with `pnpm add -D typescript@^7`) · **Faster server-side
rendering** (web streams replaced with native Node.js streams, *"up to 22% more requests under
load"*) · **Versioned docs for AI agents** · **Fewer prefetch requests** (prefetch inlining) ·
**Better caching for static assets** (immutable assets reusable across deploys) · **Custom error
boundaries** (`catchError` from `next/error`, with `retry()`) · **Built-in glob imports**
(`import.meta.glob`, Vite-compatible) · **Root params** (`import { lang } from
'next/root-params'`).

**Instant Navigations** — opt-in, two flags: `cacheComponents: true` and
`partialPrefetching: true`. Comprises **Instant Insights**, **Partial Prefetching**, **Better
Incremental Static Regeneration (ISR)**, **Navigation Inspector**, **Playwright test helper**
(`instant()` from `@next/playwright`).

🔴 **The strategic sentence, quote it:** *"The behaviors behind Instant Navigations will become
the default in a future major version, as they're part of our work over the last year to simplify
Next.js back to its roots: dynamic by default, with no hidden or implicit caching."*

### Experimental in 16.3

- **Rust-based React Compiler** — `reactCompiler: true` **plus**
  `experimental.turbopackRustReactCompiler: true`. Runs inside Turbopack instead of Babel-in-Node.
  On v0: **34% faster cold, 46% warm** to a ready page. 🔴 Verbatim caveat: *"These gains assume
  you've moved off Babel entirely. If you still run Babel for other transforms, the Rust compiler
  helps, but the gain is smaller."*
- **Network resilience** — `experimental.useOffline`, plus a `useOffline` hook from
  `next/offline`.

## Retired Skills — the reason, quoted

*"Running `next dev` writes and maintains a version-matched `AGENTS.md` block that points
directly to the bundled docs in your project's local node modules. With that knowledge now
reaching agents directly, we're retiring our earlier Skills that existed solely to bring current
documentation to your apps."*

## ⚠️ What is NOT in this file — corrected 2026-09-04

🔴 **This bank does NOT contain the Server and Client Components doc quotes.** It covers the
support policy, `create-next-app`, the version floors, the React-canary rule and the 16.3
feature list — nothing else.

A ch3 dispatch on 2026-09-04 told an agent the boundary quotes were banked here. They were
not; that doc was fetched *after* this file was written, and its quotes live inline in
`docs/nextjs/pages/01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md`.
The agent caught the error and sourced from that page instead. **Boundary and compiler-level
material is now banked separately in [[research-nextjs-ch3-boundaries]].**

**Lesson for dispatching:** state what a bank contains by *section*, not by *topic area* — and
`grep` the bank before promising an agent it is in there.

## What these sources do NOT settle

- **No "preview" channel definition on the support policy page.** The policy page names only
  canary and stable/LTS. The installation page links `preview.nextjs.org` as somewhere to
  *"explore features before they ship in a stable version"*, and 16.3 had a preview release, but
  **no formal definition of a preview channel was found.** Write it as observed practice, not as
  a documented channel tier.
- **No stated end-of-life date for 15.x** beyond the two-year rule; derive it, and say you did.

Related: [[progress-nextjs-import]]
