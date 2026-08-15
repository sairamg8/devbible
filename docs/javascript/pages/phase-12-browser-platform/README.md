---
title: "Phase 12 — The browser platform"
sidebar_label: "Overview"
sidebar_position: 0
---

*21 topics.* Everything else the platform hands you — scheduling, observation, extra threads, and
the security surface. As the syllabus puts it, this phase is **broad by design**: most rows are
Know until a project needs them.

## Status — 🚧 **16 of 21** · Understand tier ✅ COMPLETE (03–13) · Know tier under way (14–16) · Master ✅ (01–02)

**Master tier is complete** — 01 and 02, both written. The **Understand tier is now the work**
(chunk **D** of the four-way JavaScript split), taken in order, lowest number first. This phase
is deliberately broad above the Master line: the syllabus says most rows *"are Know until a
project needs them"*.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[DevTools beyond `console.log`](./01-devtools/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Client-side security](./02-client-side-security/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Timers and frames](./03-timers-and-frames/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 04 | **[`IntersectionObserver`](./04-intersectionobserver/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 05 | **[`ResizeObserver`](./05-resizeobserver/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | **[`PerformanceObserver` and the metrics that matter](./06-performanceobserver/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07 | **[Web Workers](./07-web-workers/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[The History API and client-side routing](./08-history-and-routing/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[`window`, `document`, `navigator`, `screen`](./09-window-document-navigator/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[`WebCrypto`](./10-webcrypto/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[Accessibility from JavaScript](./11-accessibility-from-javascript/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[Feature detection and progressive enhancement](./12-feature-detection/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[What belongs on the server instead](./13-what-belongs-on-the-server/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14 | **[Yielding to the main thread](./14-yielding-to-the-main-thread.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 15 | **[Cross-tab coordination](./15-cross-tab-coordination/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 16 | **[Clipboard, Web Share and File System Access](./16-clipboard-share-files/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 17–20 | Permissions/Geolocation/Notifications, media, Page Visibility, i18n | <span className="db-tier t-know">Know</span> | 🚧 next |
| 21 | `SharedArrayBuffer` and `Atomics` | <span className="db-tier t-when">When Needed</span> | deferred |

## Coverage

| Tier | Topics | Written |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 2 | **2** ✅ |
| <span className="db-tier t-understand">Understand</span> | 11 | **11** ✅ (03–13) |
| <span className="db-tier t-know">Know</span> | 7 | **3** (14–16) |
| <span className="db-tier t-when">When Needed</span> | 1 | 0 |
| **Total** | **21** | **16** |

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
