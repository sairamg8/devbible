---
sidebar_position: 6
title: "Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundari…"
sidebar_label: "Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundari…"
description: "Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundaries) and how context files mitigate it."
---

# ▲ Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundari…

> **Syllabus chapter:** 14. Agent-Driven Development  
> **Exact concept:** Honest limits: where agents fail in App Router codebases (cache semantics, server/client boundaries) and how context files mitigate it.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

# ▲ Agent-Driven Development

> **Page priority:** 🟡 `[O]` **Occasional / Must Learn**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 14

Next is investing in **agent-readable project context** (not just autocomplete): `AGENTS.md`, MCP diagnostics, and preview “skills.” Agents fail on **cache semantics** and **server/client boundaries** unless you encode those rules in-repo.
