---
title: "Part 3 — Testing with Storybook"
sidebar_label: "3 · Testing with Storybook"
sidebar_position: 3
---

> Phases 6–8 · Play functions, accessibility, and visual regression

The argument for this part in one line: **you already wrote the states — testing
them should not mean writing them again.** A story is a component in a known
state; a test is a component in a known state plus assertions. Storybook's testing
story is entirely about closing that gap.

Where this sits against the **Jest & RTL** track: RTL runs in jsdom and is faster
and cheaper, and remains the right tool for logic-heavy components. Everything
here runs in a **real browser**, which is the only place layout, focus order,
scroll and CSS-dependent behaviour are real.

---

## Phase 6 — Interaction testing with play functions

Five topics.

| Topic | Tier |
|---|---|
| **The `play` function** — a story that drives itself after render; the same file is now the demo *and* the test, so the two cannot drift apart | <span className="db-tier t-master">Master</span> |
| **`storybook/test`** — the instrumented Testing Library + Vitest bundle (**moved from `@storybook/test` in 9.0**); `within`, `expect`, `fn`, `userEvent` | <span className="db-tier t-master">Master</span> |
| `userEvent` over `fireEvent`, and awaiting **every** interaction — the missing `await` that makes a play function flaky rather than failing | <span className="db-tier t-understand">Understand</span> |
| Assertions and spies — `expect(...).toHaveBeenCalledWith(...)` against an `fn()` arg, and `waitFor` / `findBy*` for anything async | <span className="db-tier t-understand">Understand</span> |
| **Debugging in the Interactions panel** — stepping through, the rewind control, and reading a failure that the CI log only showed you as a stack trace | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write a story that fills a form, submits it,
asserts the submit handler got the right payload, and you can explain what a
missing `await userEvent.click(...)` does to it.

---

## Phase 7 — Accessibility testing

Four topics. The cheapest real quality win in this entire track.

| Topic | Tier |
|---|---|
| **`@storybook/addon-a11y`** — axe-core running against the live preview iframe, per story, with no test to write | <span className="db-tier t-master">Master</span> |
| Reading a violation — impact level, the rule id, the failing node, and which ones are genuinely blocking | <span className="db-tier t-understand">Understand</span> |
| **Configuring and disabling rules** — per-story `parameters.a11y`, and the honest line between "axe cannot see this" and "we are hiding it" | <span className="db-tier t-understand">Understand</span> |
| A11y in CI — failing a build on new violations, and why a baseline beats a hard zero on an existing codebase | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** every story in one component passes with no suppressions,
and you can justify each suppression anywhere else.

⚠ **What axe cannot check:** roughly the half that matters most — whether the
label makes sense, whether focus order is logical, whether an error is announced.
A green a11y panel is a floor, not a pass.

---

## Phase 8 — Visual regression testing

Four topics.

| Topic | Tier |
|---|---|
| Why visual regression exists — the bug class no unit test sees: a changed token, a shifted margin, an overflow at one breakpoint | <span className="db-tier t-understand">Understand</span> |
| Chromatic — snapshots per story, baselines, and the review-and-accept loop | <span className="db-tier t-understand">Understand</span> |
| **Making snapshots deterministic** — freezing dates, seeding random data, disabling animation, and waiting for fonts; the four causes of a diff that is not a change | <span className="db-tier t-understand">Understand</span> |
| Cost control — snapshot count is the bill; what to skip, and `chromatic.disableSnapshot` | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** two consecutive runs on an unchanged branch produce zero
diffs.

---

## Deliberately not here

| Left out | Why |
|---|---|
| Chromatic's enterprise workflow (TurboSnap tuning, permissions, SSO) | Vendor and plan specific |
| Self-hosted visual-diff infrastructure | Real, but a platform-team project, not a fullstack one |
| End-to-end testing | That is the **Playwright** track — a different layer with a different bug class |
| Unit testing components in jsdom | That is the **Jest & RTL** track |

---

**← Prev** [Part 2 — Composing stories](02-composing-stories.md) ·
**Next →** [Part 4 — Configuration and shipping](04-configuration-and-shipping.md)
