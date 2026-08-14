---
title: "Phase 9 — The DOM"
sidebar_label: "Overview"
sidebar_position: 0
---

*19 topics.* The document as a data structure you can mutate. As the syllabus puts it, the
sanitising row is **the one security bug a frontend developer is most likely to ship
personally**.

## Status — **in progress** (2026-08-14)

**Master tier first.** Phase 9 has **six** Master topics — 01 through 06 — written in
syllabus order. **04 of 6 done.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[What the DOM is](./01-what-the-dom-is/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Selecting elements](./02-selecting-elements/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Creating and inserting](./03-creating-and-inserting/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[`textContent` vs `innerText` vs `innerHTML`](./04-text-vs-html/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | Attributes versus properties | <span className="db-tier t-master">Master</span> | planned |
| 06 | Sanitising HTML | <span className="db-tier t-master">Master</span> | planned |
| 07–15 | Traversal, classes and styles, forms, removing and replacing, batching, layout thrashing, measuring, scrolling, focus and accessibility | <span className="db-tier t-understand">Understand</span> | deferred |
| 16–18 | `<dialog>`/popover/`inert`, `MutationObserver`, shadow DOM | <span className="db-tier t-know">Know</span> | deferred |
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

---

Start → [01 · What the DOM is](./01-what-the-dom-is/README.md)
