---
title: "Phase 4 — Flexbox, deeply"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification and the **MDN** flexbox guides. Sources named per page.
> Written at **full Master depth** on the user's instruction — topics become
> chunk directories rather than single pages.

**✅ 7 of 7 topics written.** Named in the brief. The bar is not "can you
centre a div" — it is whether you can predict what happens when the content is
wider than the container, which is where every real flexbox bug lives.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [The flex sizing algorithm](./01-the-flex-sizing-algorithm/README.md) | <span className="db-tier t-master">Master</span> | ✅ written — chunked ×3 |
| 02 | [The automatic minimum size](./02-the-automatic-minimum-size/README.md) | <span className="db-tier t-master">Master</span> | ✅ written — chunked ×2 |
| 03 | [The `flex` shorthand, properly](./03-the-flex-shorthand/README.md) | <span className="db-tier t-master">Master</span> | ✅ written — chunked ×2 |
| 04 | [`flex-basis` vs `width`](./04-flex-basis-vs-width.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [Main and cross axis](./05-main-and-cross-axis.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [Flexbox patterns that carry real applications](./06-flexbox-patterns/README.md) | <span className="db-tier t-master">Master</span> | ✅ written — chunked ×2 |
| 07 | [Flexbox and text overflow](./07-flexbox-and-text-overflow.md) | <span className="db-tier t-understand">Understand</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **7 of 7 — COMPLETE** |
| Pages on disk (chunks counted separately) | **13** |
| Depth | full Master — chunk directories, not single pages |
| Evidence | specification and MDN, named per page; **no console blocks** (no-new-sandboxes rule) |

## The organising idea

Flexbox sizes items in **three stages, in order**: base sizes, then grow or
shrink, then alignment. Each stage hands a finished number to the next, and
every classic flexbox surprise is one identifiable stage behaving as specified:

- an item that **will not shrink** → its automatic minimum size floor (stage one's clamp)
- **uneven columns** despite `flex: 1` everywhere → base sizes were content-derived
- **`justify-content` doing nothing** → stage two already consumed the free space

## Phase gate

You can build a nav bar whose middle item truncates with an ellipsis while the
right-hand group stays fixed — and explain exactly why it needed `min-width: 0`.

## Where this connects

- **← [Phase 3 · Custom properties](../phase-3-custom-properties/README.md)** —
  fluid values feed the sizes this algorithm consumes.
- **→ Phase 5 · Grid** — `min-width: 0` and `minmax(0, 1fr)` are the same
  content-floor problem in two layout systems.

---

← [Phase 3 · Custom properties](../phase-3-custom-properties/README.md) · Start → [01 · The flex sizing algorithm](./01-the-flex-sizing-algorithm/README.md)
