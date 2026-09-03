---
sidebar_position: 7
title: "**Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-e…"
sidebar_label: "**Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-e…"
description: "**Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-executed refactor with human review."
---

# ▲ **Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-e…

> **Syllabus chapter:** 14. Agent-Driven Development  
> **Exact concept:** **Project Milestone:** SprintDesk gets an `AGENTS.md`, MCP-connected diagnostics, and one agent-executed refactor with human review.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
