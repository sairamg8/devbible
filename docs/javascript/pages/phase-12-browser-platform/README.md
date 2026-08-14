---
title: "Phase 12 — The browser platform"
sidebar_label: "Overview"
sidebar_position: 0
---

*21 topics.* Everything else the platform hands you — scheduling, observation, extra threads, and
the security surface. As the syllabus puts it, this phase is **broad by design**: most rows are
Know until a project needs them.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 12 has **two** Master topics — 01 and 02 — and **both are written**.
The Understand and Know rows are deferred until the Master tiers of the remaining phases are
written. This phase is deliberately broad and shallow above the Master line: the syllabus says
most rows *"are Know until a project needs them"*.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[DevTools beyond `console.log`](./01-devtools/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Client-side security](./02-client-side-security/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03–13 | Timers and frames, `IntersectionObserver`, `ResizeObserver`, `PerformanceObserver`, Web Workers, History API, `window`/`document`/`navigator`, `WebCrypto`, accessibility, feature detection, what belongs on the server | <span className="db-tier t-understand">Understand</span> | deferred |
| 14–20 | Yielding to the main thread, cross-tab coordination, Clipboard/Web Share/File System Access, permissions, media, Page Visibility, i18n | <span className="db-tier t-know">Know</span> | deferred |
| 21 | `SharedArrayBuffer` and `Atomics` | <span className="db-tier t-when">When Needed</span> | deferred |

## How these pages are verified

**Documentation-validated** against MDN, the WHATWG Console specification and the browser
vendors' own DevTools documentation. No sandbox and no browser session, so **no page prints
console output, a timing, or a screenshot** nobody produced.

## Where this connects

- [Phase 11 · Network, storage and data transfer](../phase-11-network-storage/README.md) — what the Network panel is showing you
- [Phase 9 · The DOM](../phase-9-dom/README.md) — the sinks that make client-side security a topic
- [Phase 7 · Asynchronous JavaScript](../phase-7-async/README.md) — long tasks, and why the main thread is the resource

---

Start → [01 · DevTools beyond `console.log`](./01-devtools/README.md)
