---
sidebar_position: 2
title: "React Compiler: retiring manual `useMemo`/`useCallback`."
sidebar_label: "React Compiler: retiring manual `useMemo`/`useCallback`."
description: "React Compiler: retiring manual `useMemo`/`useCallback`."
---

# ▲ React Compiler: retiring manual `useMemo`/`useCallback`.

> **Syllabus chapter:** 11. Performance Optimization & Turbopack  
> **Exact concept:** React Compiler: retiring manual `useMemo`/`useCallback`.  
> **Source:** authored for exact syllabus concept name

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

This page is the **single-topic explanation** for **React Compiler: retiring manual `useMemo`/`useCallback`.**, under the syllabus chapter *Performance Optimization & Turbopack* (exact concept wording from the devbible syllabus).

> ⚠️ **React Compiler — two different things, verified 2026-09-03**
>
> This book sometimes writes "stable React Compiler" and "Rust React Compiler" as if they were
> one feature. They are not, and only the first is stable.
>
> | | Flag | Status |
> |---|---|---|
> | **React Compiler** | `reactCompiler: true` | **Stable.** This is the one that retires manual `useMemo`/`useCallback`. |
> | **Rust port of it** | `experimental.turbopackRustReactCompiler` | 🔴 **Experimental.** Runs inside Turbopack instead of Babel-in-Node. |
>
> **The Rust port's gain is conditional, which is the part worth teaching.** On a large app
> (v0) it cut time-to-ready-page by **34% cold / 46% warm** — but those figures assume Babel is
> **fully out of the pipeline**. Keep Babel for other transforms and the gain shrinks, because
> you are still paying to generate and reparse code.
>
> That makes it a clean worked example of measuring before adopting: the flag alone does not
> deliver the number, the *absence of Babel* does.

## Why this concept matters

React Compiler: retiring manual `useMemo`/`useCallback`.

In production work this is not trivia: you either implement it correctly once or keep rediscovering the same bug under load, in typing boundaries, or at the server/client edge.

## Core explanation

**React Compiler: retiring manual `useMemo`/`useCallback`.** is scoped by this syllabus chapter (**Performance Optimization & Turbopack**). The contract for this page is the exact syllabus line:

> React Compiler: retiring manual `useMemo`/`useCallback`.

### Mental model

1. **Definition** — what this concept owns (and what it deliberately does not).
2. **Mechanism** — how the language, runtime, or framework implements it.
3. **Choice** — when you pick it versus a neighboring concept in the same chapter.
4. **Failure mode** — how it fails in production and the first checks you run.

### Practical checklist

- Explain it without opening the docs.
- Write one BAD vs GOOD mini-example from memory.
- Name one test or measurement that proves correctness.

## Production sketch

Prefer concrete code in depth passes. At minimum, keep every decision about **React Compiler: retiring manual `useMemo`/`useCallback`.** consistent with sibling concepts in *Performance Optimization & Turbopack* (do not solve async without cancellation, types without boundaries, or RSC without client boundaries when those siblings apply).

## Pitfalls

- Memorizing the **name** without the **failure mode**.
- Copying snippets that ignore adjacent syllabus concepts in this chapter.
- Assuming another chapter’s overview already “covers” this concept — **this file** is the sidebar entry for **React Compiler: retiring manual `useMemo`/`useCallback`.**.

## Related

Open **Overview** in this sidebar folder for the full chapter narrative that ties sibling concepts together.
