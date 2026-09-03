---
sidebar_position: 2
title: "Pages Router → App Router migration roadmaps for legacy codebases."
sidebar_label: "Pages Router → App Router migration roadmaps for legacy codebases."
description: "Pages Router → App Router migration roadmaps for legacy codebases."
---

# ▲ Pages Router → App Router migration roadmaps for legacy codebases.

> **Syllabus chapter:** 17. Advanced Ecosystem Topics  
> **Exact concept:** Pages Router → App Router migration roadmaps for legacy codebases.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

The advanced patterns in a mature App Router codebase are less about new APIs and more about **deliberate placement** of the boundaries already covered elsewhere in this bible — where exactly `'use client'` starts, where `<Suspense>` boundaries are drawn, and how `error.tsx` boundaries nest.

### Pushing `'use client'` As Deep As Possible
Since the client boundary propagates to everything imported beneath it (see [rendering strategies](../03-server-components-vs-client-components/01-default-architecture-everything-is-a-server-component-rsc.md)), placing `'use client'` at a **high**, coarse level (e.g. an entire page) forces the ENTIRE subtree into the client bundle — even server-only-capable child components that never actually needed interactivity. Pushing the boundary down to the **smallest** actually-interactive leaf component (a single button, a single form) keeps everything else in that subtree as zero-client-JS Server Components.

### Granular Streaming: Multiple Independent `<Suspense>` Boundaries
A single page can have several **independent** Suspense boundaries at different nesting levels, each streaming in as soon as *its own* data resolves — rather than one boundary around the whole page (which would mean the slowest single piece of data blocks everything behind that one boundary from ever streaming early).

### Error Boundary Hierarchy: `error.tsx` vs `global-error.tsx`
`error.tsx` catches errors within its own segment and below, but explicitly **not** errors in its own segment's `layout.tsx` (which must be caught by a parent's `error.tsx`). `global-error.tsx` (at the app root) is the boundary of last resort — it must render its **own** complete `<html>`/`<body>` tags, since it replaces the ENTIRE root layout when triggered, catching even errors the root layout itself throws.

---
