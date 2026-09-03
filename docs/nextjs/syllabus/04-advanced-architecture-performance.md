---
title: "Part 4 · Advanced Architecture & Performance"
sidebar_label: "4 · Advanced Architecture & Performance"
sidebar_position: 4
---

> Verified: 2026-09-03 against the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3)
> and the [live docs navigation](https://nextjs.org/docs).
> ⚠️ Imported syllabus verbatim; drift flagged inline. **Chapter 14's Skills bullet has
> reversed upstream — read the flag before following it.**

## 11 · Performance Optimization & Turbopack

- Turbopack in dev and production: Fast Refresh, optimized builds, Rust React Compiler support.
  - ⚠️ **Two things conflated.** `reactCompiler: true` is **stable**. The **Rust port is
    experimental** (`experimental.turbopackRustReactCompiler`) and only pays off once Babel
    is fully out of the pipeline — 34% faster cold / 46% warm on v0, less if Babel stays.
- React Compiler: retiring manual `useMemo`/`useCallback`.
- Bundle analysis, dynamic imports, lazy loading.
- Node.js runtime vs. Edge runtime: capabilities, cold starts, choosing per route.
  - ⚠️ **`preferredRegion` is now marked deprecated** in the route segment config — audit
    this bullet and chapter 16's multi-region material against current guidance.
- Core Web Vitals tuning: LCP, INP, CLS auditing workflows.
- `instrumentation.ts` for OpenTelemetry and application monitoring.
  - ➕ **Missing, all free on upgrade:** App Router SSR moved from web streams to **native
    Node.js streams** (**+22% requests under load**, zero code change); dev memory down ~90%
    via eviction; **`import.meta.glob`** (Vite-compatible glob imports with HMR for Server
    Components reading local files).
- **Project Milestone:** SprintDesk performance audit — bundle map, INP fixes on the board, instrumented tracing.

## 12 · SEO, Metadata, and Accessibility

- Static and dynamic metadata: `metadata` objects, `generateMetadata()` at scale.
- Open Graph, Twitter cards, structured JSON-LD.
- `sitemap.ts` and `robots.ts` automation; localized metadata for i18n routes.
- Accessibility: semantic HTML, ARIA, safe hydration, keyboard-first interactive components.
- Common SEO pitfalls in RSC/streaming setups and automated auditing.
- **Project Milestone:** SprintDesk public pages fully indexed — dynamic OG images, JSON-LD, sitemap, a11y audit of the board.
  - ➕ **Missing:** the rest of the metadata-file conventions (`favicon`/`icon`/`apple-icon`, `manifest.json`, `generateImageMetadata`, `generateSitemaps`, `generateViewport`, `ImageResponse`) and the **PWAs** guide.

## 13 · Testing and Developer Experience

- Unit and component testing: Jest / Vitest + React Testing Library; testing Server Components and Server Actions.
- End-to-end flows with Playwright; testing streaming and PPR behavior.
  - ➕ **Missing:** the **`instant()` helper** (`@next/playwright`) — assert what is visible
    during a navigation *without waiting for the network*, so a test fails the moment instant
    UI regresses. The failure modes it catches are the teachable part: a `cookies()` read
    added to a shared header de-opts the route; a moved `<Suspense>` boundary starts blocking.
- Type-safety as testing: strict TS config, typed routes, Zod contract tests.
  - ➕ **Missing: TypeScript 7** — a 10× native port, released 2026-07. `next build` can use
    it for type checking. ⚠️ **`experimental.useTypeScriptCli` is an opt-OUT** — the
    project-local `tsc` is already the default; setting it `false` makes the build exit on
    TS 7. Adopting TS 7 is just installing it. Floor stays TS 5.1.
- Monorepos with Turborepo: shared packages, remote caching, CI pipelines.
  - ⚠️ **Linting moved.** `next build` no longer runs the linter; ESLint **or Biome** run
    from npm scripts, with the `next-lint-to-eslint-cli` codemod for old projects.
- **Project Milestone:** SprintDesk test suite — unit coverage on the data layer, Playwright flows for auth + board CRUD.

## 14 · Agent-Driven Development

- Why the framework now ships agent infrastructure: the shift from autocomplete to workflow agents.
- `AGENTS.md` and repository context maps: version-matched bundled docs to eliminate agent hallucination.
  - ⚠️ **The shipped mechanism is more specific:** `next dev` **writes and maintains** a
    version-matched `AGENTS.md` block pointing at docs bundled in
    `node_modules/next/dist/docs/`; `create-next-app` scaffolds `AGENTS.md` + a referencing
    `CLAUDE.md`; `next upgrade` refreshes those docs.
- The Next.js DevTools MCP server: exposing build diagnostics and structural information to external tools.
- **[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state introspection; actionable error fix-menus.
  - 🔴 **REVERSED.** Vercel is **retiring** the earlier first-party Skills — precisely because
    versioned bundled docs now reach agents directly. This bullet is a good case study in why
    a preview feature is not a plan.
- Practical agent workflows: agent-authored migrations, automated interface verification loops, guardrails and review discipline.
- Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundaries) and how context files mitigate it.
- **Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-executed refactor with human review.
