---
title: "Part 3 · State, Styling & UX"
sidebar_label: "3 · State, Styling & UX"
sidebar_position: 3
---

> Verified: 2026-09-03 against the
> [August 2026 security release](https://nextjs.org/blog/august-2026-security-release).
> ⚠️ Imported syllabus verbatim; drift flagged inline. **Chapter 9 carries a live security
> correction — read it before following the `next/image` bullet.**

## 8 · State Management in an RSC World

- The fundamental split: **server state** (data on the server, cached by the framework) vs. **client state** (ephemeral UI state).
- When RSC data flow is enough — and when it isn't (optimistic UI, cross-component client state, real-time sync).
- URL as state: `searchParams`, `nuqs`-style patterns, shareable filter/sort state.
- Client-state tools compared: React Context, Zustand, Jotai — trade-offs, hydration pitfalls, per-request store instantiation to avoid state leaking between users.
- TanStack Query / RTK Query in App Router: when a client cache still earns its place (polling, infinite scroll, websocket-driven data) and when it's redundant with the framework cache.
  - ⚠️ **The line moved.** `use cache: private` makes client-memory-only caching a *framework* primitive, which changes when a third-party client cache still earns its place.
- `useOptimistic` and `useActionState` as framework-native alternatives to heavy client stores.
- **Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates, a scoped Zustand store for board UI state.

## 9 · Styling and UI

- CSS Modules, global stylesheets, utility-first Tailwind configuration.
- CSS-in-JS caveats at Server Component boundaries.
- Font optimization with `next/font` (zero layout shift).
- `next/image`: priority, blur placeholders, remote patterns, AVIF/WebP.
  - 🔴 **SECURITY CORRECTION — do not follow the AVIF half of this bullet.** The August 2026
    security release **disabled AVIF optimization** in Next.js to mitigate
    **GHSA-2xp9-vwfh-vxw4**: unauthenticated **remote code execution** via `libheif` (under
    `sharp`) when optimizing an attacker-controlled AVIF image. Patched in **16.3.3 /
    15.5.24**. Treat AVIF as *currently disabled upstream, status to re-verify*.
- `next/script` loading strategies for third-party scripts.
- **Project Milestone:** SprintDesk design system pass — theming, optimized avatars/attachments, font pipeline.

## 10 · Forms, Authentication, and Security Hardening

- Server Actions for mutations with `useActionState` and `useOptimistic`.
- Boundary validation: React Hook Form + Zod schemas shared across server/client.
- Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions.
- Defense in depth: `proxy.ts` as a coarse filter, **data-access-layer authorization as the real gate**, per-route runtime checks.
- **RSC serialization hardening:** lessons from React2Shell (CVE-2025-55182) — deserialization attack surface, keeping internal objects off the wire, strict cross-origin prefetch policy, dependency patch hygiene and the KEV catalog as a monitoring habit.
  - ➕ **The 2026 record is missing.** Two **critical** CVEs, both patched in 16.3.3 / 15.5.24:
    **GHSA-2xp9-vwfh-vxw4** (AVIF RCE via libheif → `sharp`, see chapter 9) and
    **CVE-2026-75604 / GHSA-p293-qw3h-jr36** — unauthenticated RCE on **Windows-hosted**
    servers running Pages Router *and* App Router **without** Cache Components. Linux and
    macOS unaffected; **no known workaround**. A concrete argument for finishing the
    Pages→App migration in chapter 17.
  - ➕ **Also missing:** Content Security Policy, the Data Security guide, and the
    *Authentication with Cache Components* guide.
- **Project Milestone:** SprintDesk auth (Auth.js), team-scoped authorization in the data layer, hardened Server Actions with Zod at every boundary.
