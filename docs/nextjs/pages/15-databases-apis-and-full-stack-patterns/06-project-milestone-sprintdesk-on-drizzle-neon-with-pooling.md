---
sidebar_position: 6
title: "**Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates;…"
sidebar_label: "**Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates;…"
description: "**Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates; a background job for digest emails."
---

# ▲ **Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates;…

> **Syllabus chapter:** 15. Databases, APIs, and Full-Stack Patterns  
> **Exact concept:** **Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates; a background job for digest emails.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 2. Real-World Engineering Scenario

SprintDesk on Vercel + Neon hit `too many connections` during a traffic spike because each serverless instance opened a direct DB connection. Switching to the **pooled connection string** and moving digest emails to a **background job** stabilized latency and error rates.
