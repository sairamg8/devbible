---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 14 overview"
---

# ▲ Agent-Driven Development

> **Page priority:** 🟡 `[O]` **Occasional / Must Learn**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 14

Next is investing in **agent-readable project context** (not just autocomplete): `AGENTS.md`, MCP diagnostics, and preview “skills.” Agents fail on **cache semantics** and **server/client boundaries** unless you encode those rules in-repo.

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

## 2. Real-World Engineering Scenario

An agent “fixed” a slow page by adding `'use client'` at the layout root, shipping a 300KB client graph. An `AGENTS.md` rule (“no `'use client'` in layout.tsx”) + CI lint for client boundaries rejected the PR. Second attempt pushed client state into a leaf and kept the shell as RSC.

## 3. Production-Grade Code Example

```md
<!-- AGENTS.md excerpt -->
## Cache
- Explicit cache only; document every `use cache` / fetch tag
- After mutations: revalidateTag('…') matching the read path

## Review checklist for agent PRs
- [ ] Server/client boundary justified
- [ ] No secrets in client bundles
- [ ] Zod on every action input
- [ ] Playwright smoke still green
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Agents without version pins

They invent APIs from older blog posts. Pin Next/React and paste `package.json` versions into agent context.

### ⚠️ Pitfall 2: Unreviewed agent refactors of caching

Silent stale UI. Require human review on any cache/auth change.

### ⚠️ Pitfall 3: MCP with write access to prod

Never. Dev/staging only; least privilege.

### ⚠️ Pitfall 4: Empty `AGENTS.md`

If it’s not written, agents invent architecture. Keep it short and enforceable.
