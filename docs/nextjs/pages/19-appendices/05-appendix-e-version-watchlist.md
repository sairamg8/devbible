---
sidebar_position: 50
title: "**Appendix E:** Version watchlist"
sidebar_label: "**Appendix E:** Version watchlist"
description: "**Appendix E:** Version watchlist — every **[16.3 Preview]** feature in this book, with its stabilization status to verify before production use."
---

# ▲ **Appendix E:** Version watchlist

> **Syllabus chapter:** 19. Appendices  
> **Exact concept:** **Appendix E:** Version watchlist — every **[16.3 Preview]** feature in this book, with its stabilization status to verify before production use.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> ⚠️ **This appendix's premise has resolved — verified 2026-09-03**
>
> Appendix E was a **watchlist**: "every [16.3 Preview] feature in this book, with its
> stabilization status to verify before production use." **16.3 shipped on 2026-08-03**, so
> there is nothing left to watch. It is now a record.
>
> **Shipped stable in 16.3** — Instant Insights · Partial Prefetching · Navigation Inspector ·
> loading shells for un-prerendered ISR routes · the `instant()` Playwright helper ·
> `catchError` (`next/error`) · root params (`next/root-params`) · `import.meta.glob` ·
> prefetch inlining · immutable static assets across deploys · TypeScript 7 type checking ·
> version-matched agent docs · native Node.js streams in SSR · Turbopack FS build cache ·
> Turbopack memory eviction.
>
> **Still experimental** — `experimental.turbopackRustReactCompiler` · `experimental.useOffline`.
>
> **Withdrawn** — the earlier first-party Skills, superseded by version-matched bundled docs.
> A previewed feature that was *retired* rather than stabilized, which is the honest reason
> this appendix exists.
>
> **Deprecated / removed** — `preferredRegion` (deprecated) · `next lint` (removed in 16).
>
> ⚠️ **Two of the opt-in behaviours become the default in a future major.** Vercel states the
> Instant Navigations behaviours (`cacheComponents` + `partialPrefetching`) will flip to
> default, so treat adopting them as a migration you schedule, not an experiment you defer.
>
> **Keep the habit, not the list:** re-verify against nextjs.org each release.

## Migration note

This chapter is part of the **devbible syllabus exact-topic migration**. Body content is being raised to full pilot quality (why-it-matters openers, production code, BAD/GOOD pitfalls). Syllabus concepts for this chapter are listed below as the authority checklist.

    - **Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable).
    - **Appendix C:** Tooling — editor/agent setups, MCP configuration, CLI wrappers.
    - **Appendix D:** Production Readiness Checklist (security, caching, observability, a11y, SEO).
    - **Appendix E:** Version watchlist — every **[16.3 Preview]** feature in this book, with its stabilization status to verify before production use.
