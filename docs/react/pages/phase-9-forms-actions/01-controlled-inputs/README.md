---
title: "Controlled inputs, all of them"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<input>`](https://react.dev/reference/react-dom/components/input),
> [`<select>`](https://react.dev/reference/react-dom/components/select),
> [`<textarea>`](https://react.dev/reference/react-dom/components/textarea), and MDN
> [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file).
> No sandbox script backs this topic; claims are cited, not measured.

**Controlled is a contract, not a style: supply the value on every render, update it
synchronously on every change. React does not observe the input — it overwrites it.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The controlled contract](01-the-controlled-contract.md)** | What "controlled" means mechanically, the Pitfall, and why `undefined` is what flips an input to uncontrolled |
| 02 | **[Every input type, and the one you cannot control](02-every-input-type.md)** | `textarea` without children, `select` with the value on the select, radio groups — and file inputs, which the browser will not let you control |

**Split at 300 lines on a concept boundary** — the rule, then the eight places it applies
differently.

## The three sentences to keep

> To render a *controlled* input, pass the `value` prop to it (or `checked` for checkboxes
> and radios). React will **force the input to always have the `value` you passed.**

> An input **cannot switch** between being controlled or uncontrolled over its lifetime.

> **You cannot set the value of a file picker from a script.** Attempting to do so has no
> effect. *(MDN)*

The first is the mechanism, the second is the rule most codebases break by accident with an
`undefined` initial value, and the third is why one input type is exempt from all of it.

## Where this connects

- **→ [Actions](../02-actions.md)** — built around reading the whole form from `FormData`,
  which is the uncontrolled model and needs no state per field.
- **→ [Uncontrolled forms and `FormData`](../05-uncontrolled-and-formdata.md)** — the case
  that this is more often right than the React habit suggests.
- **↔ [Phase 8 · Urgent vs transition](../../phase-8-concurrent-suspense/07-urgent-vs-transition.md)**
  — a controlled input's update must stay urgent; transitions cannot control text inputs.
- **↔ [Phase 3 · State is a snapshot](../../phase-3-state/02-state-is-a-snapshot.md)** —
  why "synchronously" in the contract is not a stylistic preference.
- **↔ [Phase 3 · Resetting state with `key`](../../phase-3-state/07-resetting-state-with-key.md)**
  — the idiomatic way to clear a file input.

---

← Index: [Phase 9](../README.md) · Start → [The controlled contract](01-the-controlled-contract.md)
