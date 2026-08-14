---
title: "Phase 10 — Events and user input"
sidebar_label: "Overview"
sidebar_position: 0
---

*14 topics.* As the syllabus puts it, **delegation is the row that pays for the phase** — it
is the difference between one listener and a thousand.

## Status — 🚧 **Understand tier under way — 6 of 14** (2026-08-15)

**Master tier ✅ COMPLETE** — all four Master topics (01–04), written in syllabus order.

🚧 **Now the Understand tier (05–11), then Know (12–14).** **05–06 are written** — Form and input
events, Keyboard events; 07 onward remain. Lane B of the two-way JavaScript split owns this phase.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[The event model](./01-the-event-model/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[`addEventListener`](./02-addeventlistener/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[The event object](./03-the-event-object/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Event delegation](./04-event-delegation/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Form and input events](./05-form-and-input-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | **[Keyboard events](./06-keyboard-events/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07–11 | Pointer events, custom events, scroll/resize/visibility, page lifecycle, default actions | <span className="db-tier t-understand">Understand</span> | 🚧 next |
| 12–14 | `EventTarget` as a base class, touch and gestures, debugging events | <span className="db-tier t-know">Know</span> | deferred |

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
