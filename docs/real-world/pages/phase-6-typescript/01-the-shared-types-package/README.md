---
title: "The shared types package"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Node.js packages documentation (`exports`,
> conditional exports), the Yarn workspaces docs and the TypeScript handbook's
> `moduleResolution` reference. Documentation-validated; **no timings, no
> console blocks**.

**One package the API and the client both import.** Not because duplication is
untidy, but because two copies of `Order` drift and nothing tells you — the
rename ships, both sides compile, and a user finds it.

Two chunks, split where the decisions split:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Why a package, and what goes in it](01-why-a-package.md)** | The three ways to share a shape and what each costs; the workspace layout; 🔴 **row type vs resource type** — the two that look identical until the schema grows `deleted_at`; what must stay out (`pg`, `express`, `node:*`, server config); and deriving `OrderStatus` from an `as const` array so the union and the runtime list cannot diverge |
| 2 | **[Consuming it from both sides](02-consuming-it.md)** | 🔴 **Compiled `dist/` vs source-consumed**, and why a stale `dist/` is the worse failure; the `exports` map as a *mechanical* boundary rather than a convention; why conditional exports are refused here; and 🔴 **why `strict` must match across consumers** — `strictNullChecks` changes what a type means, so identical text yields different types |

## The three sentences to keep

1. **The test for inclusion is "would both sides be wrong if they disagreed?"**
   Response shapes pass; database row types fail.
2. **Derive the union from the runtime array**, with `as const` — one
   declaration, two artifacts, no way to update one and not the other.
3. **`strict` is part of the package's contract**, not a per-app preference,
   because it changes what the shared types mean.

## Phase gate

You are done with this topic when you can say why the client importing the
API's types is a build problem rather than a style problem, place a new type on
the right side of the row/resource line, explain what an `exports` map makes
impossible, and say what breaks when two consumers disagree about `strict`.

## Where this connects

Everything downstream in this phase imports from here: the zod schemas of
**chapter 02** *(not written yet)* infer into these shapes, the query modules of
**chapter 03** *(not written yet)* map rows onto them, and the
[validation engine](../../phase-5-js-functions/05-the-validation-engine.md)
checks values against the runtime constants this package exports.
