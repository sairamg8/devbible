---
title: "Form elements in JSX"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Markup,
> event ordering and every warning string on both chunks are printed by
> `sandbox/react-p1/ex12-form-elements.mjs`.

**Form elements are the one place where the DOM already holds state. React
either takes that state over or leaves it alone, and every warning in this topic
exists because the two got mixed.**

Two chunks, split where the subject changes: the first is the controlled /
uncontrolled decision and everything that follows from it; the second is the
three controls React reshaped, and reading a form without any state at all.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Controlled and uncontrolled](01-controlled-and-uncontrolled.md)** | Who owns the value, and the four warnings that mean you mixed them |
| 02 | **[select, textarea, files and FormData](02-select-textarea-and-formdata.md)** | The controls React spells differently, and the form you can read without state |

## The decision in one table

| Need | Mode |
|---|---|
| Validate or transform as the user types | controlled |
| Disable submit until valid | controlled (or `FormData` on change) |
| Two fields that constrain each other | controlled |
| A plain form submitted once | uncontrolled + `FormData` |
| A file input | uncontrolled — no choice |
| An integration with a non-React widget | uncontrolled |

## Where this connects

- **[Conditional rendering](../06-conditional-rendering.md)** — an input that
  resets on an unrelated toggle is usually a position change above it, not a
  form problem.
- **[Attributes vs props](../04-attributes-vs-props.md)** — `value`, `checked`
  and `disabled` follow the boolean and empty-value rules described there.
- **Phase 3** takes the controlled input apart as a state problem; **Phase 9**
  builds on the uncontrolled `FormData` route with React 19 Actions.

---

← Prev: [dangerouslySetInnerHTML](../12-dangerously-set-inner-html.md) · Index: [Phase 1](../README.md) · Start → [Controlled and uncontrolled](01-controlled-and-uncontrolled.md)
