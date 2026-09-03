---
sidebar_position: 4
title: "**[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state in…"
sidebar_label: "**[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state in…"
description: "**[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state introspection; actionable error fix-menus."
---

# ▲ **[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state in…

> **Syllabus chapter:** 14. Agent-Driven Development  
> **Exact concept:** **[16.3 Preview]** First-party Skills for multi-step workflows; agent-browser with React state introspection; actionable error fix-menus.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

:::danger This page's premise reversed — verified 2026-09-03

This page presents first-party **Skills** as a 16.3 preview feature to look forward to.
**Vercel is retiring them.**

The [16.3 release post](https://nextjs.org/blog/next-16-3) states the earlier Skills existed
"solely to bring current documentation to your apps," and are being retired now that
documentation reaches agents directly.

**What actually shipped instead:**

- **`next dev` writes and maintains a version-matched `AGENTS.md` block** pointing at docs
  bundled in your project's own `node_modules/next/dist/docs/`. The agent reads the version
  you have installed, not its training data.
- **`create-next-app` scaffolds `AGENTS.md`** by default — plus a `CLAUDE.md` that
  references it.
- **`next upgrade`** refreshes those bundled docs as part of upgrading.
- **Instant Insights** (chapter 2) emits an **agent-ready fix prompt** for each slow
  navigation it finds — a concrete case of the framework handing an agent a structured task.

**The transferable lesson is the one this page already gets right:** teach the workflow
(context → propose → verify → human merge), not unstable flag names. This reversal is the
proof — the flag names went away and the workflow did not.
:::

## 1. Under-The-Hood Mechanics

### Why framework-level agent support

Agents hallucinate APIs when docs are wrong for the installed version. Bundling **version-matched** guidance and machine-readable structure reduces that.

### `AGENTS.md` as a contract

```md
# AGENTS.md
- Next 16.x App Router only — no new pages/ routes
- Default Server Components; `'use client'` only for interactivity leaves
- Mutations via Server Actions + Zod; authorize in DAL
- Never put secrets in client components
- Prefer revalidateTag over blanket revalidatePath
```

### MCP / DevTools

Model Context Protocol servers can expose build diagnostics, route trees, and errors to external agents. Treat them as **read + constrained write** tools with human review.

### Preview features (conceptual)

Instant navigations, agent-browser introspection, multi-step skills — teach the **workflow** (context → propose → verify → human merge), not unstable flag names.
