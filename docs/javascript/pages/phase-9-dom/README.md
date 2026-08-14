---
title: "Phase 9 — The DOM"
sidebar_label: "Overview"
sidebar_position: 0
---

*19 topics.* The document as a data structure you can mutate. As the syllabus puts it, the
sanitising row is **the one security bug a frontend developer is most likely to ship
personally**.

## Status — ✅ **Understand tier COMPLETE — 15 of 19** (2026-08-14)

**Master tier ✅ COMPLETE** — all six Master topics (01–06), written in syllabus order.
**Understand tier ✅ COMPLETE** — 07–15, all nine, every one chunked.

🚧 **Next: the Know tier (16–18), then When Needed (19).** Lane B of the two-way JavaScript split
owns this phase.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[What the DOM is](./01-what-the-dom-is/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Selecting elements](./02-selecting-elements/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Creating and inserting](./03-creating-and-inserting/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[`textContent` vs `innerText` vs `innerHTML`](./04-text-vs-html/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Attributes versus properties](./05-attributes-vs-properties/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[Sanitising HTML](./06-sanitising-html/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[Traversal](./07-traversal/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[Classes and styles from JavaScript](./08-classes-and-styles/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[Forms](./09-forms/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[Removing and replacing](./10-removing-and-replacing/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[Batching DOM work](./11-batching-dom-work/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[Layout thrashing](./12-layout-thrashing/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[Measuring elements](./13-measuring-elements/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14 | **[Scrolling](./14-scrolling/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 15 | **[Focus and accessibility from JavaScript](./15-focus-and-accessibility/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 16–18 | `<dialog>`/popover/`inert`, `MutationObserver`, shadow DOM | <span className="db-tier t-know">Know</span> | 🚧 next |
| 19 | Selection, `Range` and `contenteditable` | <span className="db-tier t-when">When Needed</span> | deferred |

## How these pages are verified

🔴 **Documentation-validated, and this phase needs the warning most.** The syllabus flagged
an open question — how Part 3 gets verified without a browser. The answer under the
no-new-sandboxes rule is: **claims are checked against MDN and the specifications, cited by
name, and no page prints output nobody produced.** Where behaviour differs across browsers
and the documentation does not settle it, the page says so rather than guessing.

## Where this connects

- [Phase 0 · 06 · Hosts and globals](../phase-0-how-javascript-runs/06-hosts-and-globals.md) — why the DOM is not part of the language
- [Phase 7 · 03 · Microtasks vs macrotasks](../phase-7-async/03-microtasks-vs-macrotasks/README.md) — where rendering fits between tasks
- [Phase 8 · 04 · Leaks](../phase-8-modules-errors/04-leaks/README.md) — detached nodes, the DOM-specific leak
- [Phase 10 · 04 · Event delegation](../phase-10-events/04-event-delegation/README.md) — what
  [07 · Traversal](./07-traversal/README.md) is the vocabulary for

---

Start → [01 · What the DOM is](./01-what-the-dom-is/README.md)
