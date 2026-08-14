---
title: "Phase 10 — Events and user input"
sidebar_label: "Overview"
sidebar_position: 0
---

*14 topics.* As the syllabus puts it, **delegation is the row that pays for the phase** — it
is the difference between one listener and a thousand.

## Status — ✅ **COMPLETE — 14 of 14, every tier** (2026-08-15)

| Tier | Topics | State |
|---|---|---|
| Master | 01–04 | ✅ |
| Understand | 05–11 | ✅ |
| Know | 12–14 | ✅ |

Every topic is documentation-validated against MDN and the DOM specification, with the sources named
in each page's `> Verified:` line, every file under the 300-line cap, and **no console output for a
run that did not happen**. Written by lane B of the two-way JavaScript split. Lane B of the two-way JavaScript split owns this phase.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[The event model](./01-the-event-model/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[`addEventListener`](./02-addeventlistener/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[The event object](./03-the-event-object/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Event delegation](./04-event-delegation/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Form and input events](./05-form-and-input-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | **[Keyboard events](./06-keyboard-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07 | **[Pointer events](./07-pointer-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[Custom events](./08-custom-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[Scroll, resize and visibility](./09-scroll-resize-visibility/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[Page lifecycle](./10-page-lifecycle/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[Default actions you should not block](./11-default-actions/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[`EventTarget` as a base class](./12-eventtarget-base-class/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 13 | **[Touch and gestures](./13-touch-and-gestures/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |
| 14 | **[Debugging events](./14-debugging-events/README.md)** | <span className="db-tier t-know">Know</span> | ✅ |

## How these pages are verified

**Documentation-validated** against MDN and the DOM specification. No browser sandbox, so no
page prints output nobody produced; where browsers differ and the documentation does not
settle it, the page says so.

## Where this connects

- [Phase 9 · The DOM](../phase-9-dom/README.md) — the tree events travel through
- [Phase 8 · 04 · Leaks](../phase-8-modules-errors/04-leaks/README.md) — forgotten listeners, the leak this phase can cause
- [Phase 7 · 03 · Microtasks vs macrotasks](../phase-7-async/03-microtasks-vs-macrotasks/README.md) — event dispatch as a task

---

Start → [01 · The event model](./01-the-event-model/README.md)
