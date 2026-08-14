---
title: "Phase 10 — Events and user input"
sidebar_label: "Overview"
sidebar_position: 0
---

*14 topics.* As the syllabus puts it, **delegation is the row that pays for the phase** — it
is the difference between one listener and a thousand.

## Status — **in progress** (2026-08-14)

**Master tier first.** Phase 10 has **four** Master topics — 01 through 04 — written in
syllabus order. **01 of 4 done.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[The event model](./01-the-event-model/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | `addEventListener` | <span className="db-tier t-master">Master</span> | planned |
| 03 | The event object | <span className="db-tier t-master">Master</span> | planned |
| 04 | Event delegation | <span className="db-tier t-master">Master</span> | planned |
| 05–11 | Form and input events, keyboard, pointer, custom events, scroll/resize/visibility, page lifecycle, default actions | <span className="db-tier t-understand">Understand</span> | deferred |
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
