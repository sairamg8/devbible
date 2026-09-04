---
title: "The React Compiler is a build-time memoizer you turn on with one top-level key, it has been stable since Next.js 16, and it is deliberately not on by default"
sidebar_label: "02 · React Compiler"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`reactCompiler` config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-02-11`), the Next.js
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`), and the React
> [React Compiler introduction](https://react.dev/learn/react-compiler/introduction).
> Documentation-verified; **no timings, no sandbox run, no build measured here**.
> Target: **Next.js 16.3.4 · React Compiler stable since Next.js 16 · React 19.2.8**.

**The React Compiler rewrites your components at build time so React skips re-rendering the parts that did not
change — the job `useMemo` and `useCallback` were doing by hand.** In Next.js it is one top-level config key,
stable since 16, and **not on by default**, and the reason it is off is a build-cost question rather than a
correctness one. The mechanical fact underneath everything is that the compiler ships as a **Babel plugin**,
and under Turbopack a Babel plugin is *additive* to SWC rather than a replacement for it. This page covers what
the compiler optimises, how you enable it, the SWC pre-filter that keeps the Babel bill from being
catastrophic, and the three things it is routinely — wrongly — expected to fix. What enabling it costs, and the
experimental Rust port that exists to reduce that cost, is
[02b](02b-what-the-react-compiler-costs-and-the-rust-port.md); adopting it file by file with directives is
[02c](02c-annotation-mode-and-the-two-directives.md); the memoization you must not delete on the way in is
[02d](02d-migrating-existing-memoization.md); and what it surfaces in old code once it is on is
[02e](02e-what-the-compiler-surfaces-in-old-code.md).

## What the compiler actually does

It is a build-time optimiser, not a runtime library. Nothing is added to your component tree; the components
themselves come out the other side with memoization baked in.

> *"Next.js includes support for the React Compiler, a tool designed to improve performance by automatically
> optimizing component rendering. This reduces the need for manual memoization using `useMemo` and
> `useCallback`."*
> — Next.js `reactCompiler` reference

React's own documentation is more specific about *which* performance problem it is aimed at, and this matters
because it tells you which apps will see nothing:

> *"React Compiler's automatic memoization is primarily focused on **improving update performance**
> (re-rendering existing components), so it focuses on these two use cases: 1. **Skipping cascading re-rendering
> of components** … 2. **Skipping expensive calculations from outside of React**"*
> — react.dev, React Compiler introduction

🔴 **Read that as a scoping statement, not a sales pitch.** *Update* performance is re-render cost after the
first paint. A route that is mostly Server Components rendering static markup with a thin client island has
almost no update work to skip — the compiler will compile it and change nothing you can feel. The apps that
benefit are the ones with a large, stateful, interactive client tree: a board, an editor, a filter-heavy table.

The mechanism, stated by React:

> *"React Compiler automatically applies the equivalent of manual memoization, ensuring that only the relevant
> parts of an app re-render as state changes, which is sometimes referred to as \"fine-grained reactivity\"."*

And its framing of the developer benefit, which is the honest headline — it removes a class of decision, not a
class of code:

> *"React Compiler does this optimization automatically for you, freeing you from this mental burden so you can
> focus on building features."*

## Turning it on

Two steps, and the order does not matter. Install the Babel plugin as a dev dependency:

```bash
npm install -D babel-plugin-react-compiler
```

Then set the key. It is **top-level** — not under `experimental`:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}

export default nextConfig
```

The JavaScript form, for a project that has not moved to `next.config.ts`:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
}

module.exports = nextConfig
```

**Where "stable" and "not default" come from, verbatim:**

> *"Built-in support for the React Compiler is now stable in **Next.js 16** following the React Compiler's 1.0
> release. The React Compiler automatically memoizes components, reducing unnecessary re-renders with zero
> manual code changes."*
> *"The `reactCompiler` configuration option has been promoted from `experimental` to stable. It is not enabled
> by default as we continue gathering build performance data across different application types."*
> — Next.js 16 upgrade guide

🔴 **"We continue gathering build performance data" is the whole reason it ships off.** It is not a stability
caveat about the output — the compiler is 1.0 and the flag is stable. It is a caveat about **what enabling it
does to your build times**, which is [02b](02b-what-the-react-compiler-costs-and-the-rust-port.md) in full.
Anyone who tells you `reactCompiler: true` is a free win has skipped the sentence Vercel wrote to say it might
not be.

## The SWC pre-filter — the mechanism most write-ups miss

The compiler is distributed as a Babel plugin. Under Turbopack, Babel is additive: a detected Babel
configuration does **not** replace SWC, it runs alongside it, so every matching file is parsed and regenerated
twice. That rule, and the `turbopackUseBuiltinBabel` flag behind it, is owned by
[01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md) — read it there,
because it is the mechanism underneath everything on this page and the next.

Next.js's answer is not to make Babel faster. It is to run Babel on **fewer files**:

> *"Next.js includes a custom performance optimization written in SWC that makes the React Compiler more
> efficient. Instead of running the compiler on every file, Next.js analyzes your project and only applies the
> React Compiler to relevant files. This avoids unnecessary work and leads to faster builds compared to using
> the Babel plugin on its own."*
> *"The React Compiler runs through a Babel plugin. To keep builds fast, Next.js uses a custom SWC optimization
> that only applies the React Compiler to relevant files—like those with JSX or React Hooks."*
> — Next.js `reactCompiler` reference

So the pipeline for a given file is a two-stage decision:

| Stage | Runs in | Decides |
|---|---|---|
| 1 · Pre-filter | **SWC** (Rust, in-process) | Does this file contain JSX or React Hooks? |
| 2 · Compilation | **Babel** (JavaScript) | Only if stage 1 said yes — apply `babel-plugin-react-compiler` |

**What this buys you, concretely.** A typical app is mostly not components: `lib/` utilities, Zod schemas,
database access, route handlers with no JSX, generated types, config, tests. None of those reach Babel. The
Babel tax lands on `app/` and `components/` and stops there.

**What it does not buy you.** It is a filter, not an elimination. A UI-heavy codebase *is* mostly JSX, so a
large fraction of it still goes through Babel. The pre-filter narrows the blast radius; it does not remove the
second pipeline. That distinction is exactly why the two doc statements about build cost read so differently —
see [02b](02b-what-the-react-compiler-costs-and-the-rust-port.md).

## What it does not replace

The compiler is memoization. It is not a fix for the three things people most often hope it is:

- **It does not shrink your bundle.** The memoized output is *more* code, not less — cache slots, comparisons
  and guards are generated into every compiled component. The real levers are on
  [03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md).
- **It does not fix a slow server render.** Update performance is a client-side re-render concern; a route
  spending most of its time waiting on a database query is unchanged by it.
- **It does not repair broken effect dependencies.** A `useEffect` firing too often because it depends on an
  unstable object may well stop firing once that object is memoized — but the dependency array is still wrong,
  and it will bite again the day the component opts out with `"use no memo"`
  ([02c](02c-annotation-mode-and-the-two-directives.md)).

## Gotchas

**★ Symptom: `reactCompiler: true` is in `next.config.ts` and nothing changed — no error, no optimisation.**
Cause: `babel-plugin-react-compiler` is not installed. The compiler itself ships as that separate Babel plugin;
the Next.js flag only wires it in. Fix: install it as a dev dependency and rebuild.

```bash
npm install -D babel-plugin-react-compiler
```

**★ Symptom: you put `reactCompiler` under `experimental` and TypeScript flags it as not existing on
`NextConfig`.** Cause: it was promoted out of `experimental` in 16 — *"The `reactCompiler` configuration option
has been promoted from `experimental` to stable."* Fix: move it to the top level.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ❌ experimental: { reactCompiler: true },
  reactCompiler: true,
}

export default nextConfig
```

**★ Symptom: a React-less utility file — a Zod schema, a `lib/` helper — is suspected of slowing the build
after enabling the compiler.** Cause: it is not being compiled at all. The SWC pre-filter only sends files
*"with JSX or React Hooks"* to Babel. Fix: stop looking there and look at `app/` and `components/`; that is
where the pass actually lands. If a helper genuinely must stay out of the compiler's way, the file-level
opt-out is a directive, not a config exclusion — see
[02c](02c-annotation-mode-and-the-two-directives.md).

**Symptom: the compiler is enabled but a route that is entirely Server Components feels exactly as slow as
before.** Cause: the optimisation target is *update* performance — re-rendering existing components — and a
Server-Component route does not re-render on the client at all. Fix: measure the right thing. Client re-render
cost is a React Profiler question; that route's latency is a data-fetching and streaming question, covered in
[05 · Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md).

**Symptom: first-load JavaScript went *up* slightly after enabling the compiler.** Cause: that is the expected
direction. Automatic memoization is generated code, so compiled components are larger than their sources. Fix:
accept it as the trade — you bought update performance with bytes — and if the bytes are the problem you had a
bundle problem, not a memoization problem. Confirm which with `next experimental-analyze`
([03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md)) before reverting the flag.

**Symptom: two engineers disagree about whether "the React Compiler" is stable, and both are certain.** Cause:
there are two features with nearly the same name. `reactCompiler` is stable; `experimental.turbopackRustReactCompiler`
is not. Fix: settle it by naming the config key rather than the feature — the full distinction is on
[02b](02b-what-the-react-compiler-costs-and-the-rust-port.md).

## Interview questions

**★ What does the React Compiler actually optimise, and which applications get nothing from it?**
It targets *update* performance: cascading re-renders of a component tree when only one node's data changed,
and expensive calculations recomputed inside a component on every render. It generates the equivalent of manual
memoization at build time so React can skip work it would otherwise redo. An application whose routes are
almost entirely Server Components rendering static markup gets very little, because there is no client
re-render to skip — but it still pays the Babel compile cost on every file containing JSX. The applications
that benefit are the ones with large, stateful, interactive client trees.

**★ Is `reactCompiler` a Next.js feature or a React feature?**
The compiler is React's — its own 1.0 release, its own documentation on react.dev, its own directive semantics.
What Next.js owns is the *integration*: the top-level `reactCompiler` config key, the SWC pre-filter that
decides which files the Babel plugin sees, and the promotion of the flag out of `experimental` in 16. The
practical consequence is that questions about *what the compiler does to your code* are answered at react.dev,
and questions about *what it costs your build* are answered in the Next.js docs.

**★ The compiler runs on Babel and Turbopack is Rust. Why isn't that fatal for build times?**
Because Next.js does not hand every file to Babel. A custom SWC optimisation pre-filters the project and only
sends files that actually contain JSX or React Hooks to `babel-plugin-react-compiler` — *"This avoids
unnecessary work and leads to faster builds compared to using the Babel plugin on its own."* In a typical app
that excludes utilities, schemas, database code, config and non-JSX route handlers. It is a real saving, and it
is also a filter rather than an elimination: a UI-heavy repo is mostly JSX, so most of it still crosses into
Babel.

**What is the relationship between the React Compiler and bundle size?**
There is one, and it is the wrong direction for anyone hoping otherwise. Memoization is generated code: cache
slots, comparisons, guards. Compiled output is larger than the source, not smaller. If your problem is a large
first load, the compiler is not a lever; `optimizePackageImports`, moving render-only libraries into Server
Components, and `next/dynamic` are, and those live on
[03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md).

**Where does the compiler sit relative to Turbopack's own pipeline?**
Beside it, not inside it. Turbopack compiles with SWC; the React Compiler is a Babel plugin, and since Next.js
16 a detected Babel configuration makes Babel run *in addition to* SWC rather than replacing it. So a compiled
file is processed by both toolchains. The SWC pre-filter is what keeps that from applying to the whole project.
The experimental Rust port of the compiler exists precisely to collapse that duplication, and it is a separate,
non-stable flag.

---

← [01e · What Turbopack does not support](01e-what-turbopack-does-not-support-and-how-to-read-the-list.md) · [Chapter index](01-explanation.md) · Next → [02b · What the React Compiler costs](02b-what-the-react-compiler-costs-and-the-rust-port.md)
