---
sidebar_position: 7
title: "**Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates…"
sidebar_label: "**Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates…"
description: "**Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates, a scoped Zustand store for board UI state."
---

# ▲ **Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates…

> **Syllabus chapter:** 8. State Management in an RSC World  
> **Exact concept:** **Project Milestone:** SprintDesk board filters in the URL, drag-and-drop with optimistic updates, a scoped Zustand store for board UI state.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 2. Real-World Engineering Scenario

**SprintDesk board:**  
- Task list + columns → **server state** (RSC + tagged revalidation)  
- Active filters → **URL** (`?status=doing&assignee=me`)  
- Drag-and-drop order while dragging → **client state** (Zustand)  
- Checkbox toggle → **optimistic client** + Server Action + `revalidateTag('tasks')`  

Putting the entire board in Zustand duplicates the server cache and causes hydration/auth leaks if the store is global on the server. Putting drag state only on the server makes the UI feel laggy.
