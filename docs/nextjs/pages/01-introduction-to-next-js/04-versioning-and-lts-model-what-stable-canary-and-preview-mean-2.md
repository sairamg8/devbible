---
sidebar_position: 4.5
title: "Versioning and LTS model: what \"stable,\" \"canary,\" and \"preview\" mean; how to read the release ch…"
sidebar_label: "Versioning and LTS model: what \"stable,\" \"canary,\" and \"preview\" mean; how to read the release ch…"
description: "Versioning and LTS model: what \"stable,\" \"canary,\" and \"preview\" mean; how to read the release channel before adopting a feature. *(Callout: current stable is 1"
---

# ▲ Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the release ch…

> **Syllabus chapter:** 1. Introduction to Next.js  
> **Exact concept:** Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the release channel before adopting a feature. *(Callout: current stable is 16.2.x; 16.3 is in preview.)*

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

This page owns the syllabus concept **Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the…** under chapter *Introduction to Next.js*.

> ⚠️ **Version corrected — verified 2026-09-03**
>
> This page was written when **16.2** was current and 16.3 was in preview. That is no longer true.
>
> | | This page says | Upstream, 2026-09-03 |
> |---|---|---|
> | Current stable | 16.2.x | **16.3.4** |
> | 16.3 | "in preview" | **stable since 2026-08-03** |
> | Node.js floor | 20+ | **20.9** |
> | React | 19.2+ | the App Router **bundles React canary** built-in; declare `react`/`react-dom` anyway for tooling |
>
> **The release model has a name this page does not use.** Alongside stable / canary / preview,
> Next.js publishes **Active LTS** (currently **16.3**) and **Maintenance LTS** (currently
> **15.5**). Security releases patch both lines — the August 2026 release shipped as 16.3.3 and
> 15.5.24 — so "which LTS line am I on" is the question that decides how cheap patching is.
>
> Every **`[16.3 Preview]`** tag elsewhere in this book is stale for the same reason. See
> **Appendix E**, which is now a shipped/withdrawn record rather than a watchlist.

## Scope

> Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the release channel before adopting a feature. *(Callout: current stable is 16.2.x; 16.3 is in preview.)*

## Explanation

**Versioning and LTS model: what "stable," "canary," and "preview" mean; how to read the…** is a first-class item in the devbible syllabus for this chapter. See **Overview** in this chapter for the full narrative; this file is the sidebar entry for the concept name itself.

### Key takeaways

- Know the definition and where it sits in *Introduction to Next.js*.
- Know one production failure mode related to this concept.
- Prefer the Overview + sibling concept pages for full code walkthroughs when this page is a thin pointer.
