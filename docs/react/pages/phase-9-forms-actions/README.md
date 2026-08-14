---
title: "Phase 9 — Forms, Actions and optimistic UI"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line names
> its sources.

🚧 **In progress — 5 of 14 topics written.** The phase's whole Master tier is done.

**React 19 turned "submit a form" from a pile of `useState` into a first-class
primitive.** Actions are transitions wearing a form — which is why this phase sits
directly after [Phase 8](../phase-8-concurrent-suspense/README.md), where the transition
machinery underneath them was established.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[Controlled inputs, all of them](01-controlled-inputs/README.md)** | <span className="db-tier t-master">Master</span> | Every input type — and why file inputs are always uncontrolled |
| 02 | **[Actions](02-actions.md)** | <span className="db-tier t-master">Master</span> | `<form action={…}>`, `FormData`, an automatic transition and pending state |
| 03 | **[`useActionState`](03-useactionstate.md)** | <span className="db-tier t-master">Master</span> | The hook that replaces the four `useState` calls every form used to need |
| 04 | **[Validation](04-validation.md)** | <span className="db-tier t-master">Master</span> | Client for feedback, server for truth, field errors through the return value |
| 05 | **[Uncontrolled forms and `FormData`](05-uncontrolled-and-formdata.md)** | <span className="db-tier t-understand">Understand</span> | `name` attributes as the contract, and when this beats controlled outright |
| 06 | `useFormStatus` | <span className="db-tier t-understand">Understand</span> | Pending state without prop drilling — and the constraint that it must be inside the form |
| 07 | `useOptimistic` | <span className="db-tier t-understand">Understand</span> | Show the expected result now; revert automatically when the action settles |
| 08 | Multiple actions in one form | <span className="db-tier t-understand">Understand</span> | `formAction` for save-vs-delete, and how it meets `useActionState` |
| 09 | Form reset semantics | <span className="db-tier t-understand">Understand</span> | What React resets for you, when that is wrong, and `requestFormReset` |
| 10 | Errors in actions | <span className="db-tier t-understand">Understand</span> | Thrown reaches an error boundary; returned reaches `useActionState` |
| 11 | Progressive enhancement | <span className="db-tier t-understand">Understand</span> | A form that submits before hydration, and what that requires |
| 12 | Accessible forms | <span className="db-tier t-understand">Understand</span> | Labels, `useId`, `aria-invalid`, announcing results, focusing the first error |
| 13 | ⚠ `useFormState` | <span className="db-tier t-know">Know</span> | The old name, **deprecated**, still exported from `react-dom` in 19.2.8 |
| 14 | Form libraries | <span className="db-tier t-know">Know</span> | What React Hook Form and TanStack Form still add over Actions |

## Why this phase sits after Phase 8

Because an Action *is* a transition. [Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md)
established the vocabulary — *"Functions called in `startTransition` are called
Actions"* — the pending state that spans an `await`, the post-`await` limitation, and the
fact that errors reach an error boundary. It also named the abstractions built on top:
`useActionState`, `<form>` actions and Server Functions, **which handle request ordering
for you**. This phase is those abstractions.

Read the other way: everything here inherits Phase 8's behaviour. A form submission is
non-blocking, its pending state is a transition's pending state, and the same rules about
what is marked and what is not still apply.

## Where this phase connects backwards

- **[Phase 8 · Async transitions](../phase-8-concurrent-suspense/09-async-transitions.md)**
  — Actions, `isPending` spanning the whole operation, and errors reaching a boundary.
- **[Phase 8 · Error boundaries and Suspense](../phase-8-concurrent-suspense/16-error-boundaries-and-suspense.md)**
  — the thrown-versus-returned distinction topic 10 turns into a design decision.
- **[Phase 3 · State is a snapshot](../phase-3-state/02-state-is-a-snapshot.md)** — why
  controlled inputs need the updater form as much as anything else does.
- **[Phase 5 · `useId`](../phase-5-refs-context-reducers/14-useid.md)** — the accessible
  label-to-input association topic 12 depends on.
- **[Phase 4 · You might not need an effect](../phase-4-effects/06-you-might-not-need-an-effect/README.md)**
  — submitting in an effect keyed on a flag is the anti-pattern Actions replace.

## Coverage

**14 topics.** 5 written so far → 7 files. Topics 01–04 are all four Master rows. Topic 01 is chunked into two parts (517
lines): the contract, then the eight places it applies differently.

## Gate

**Deliverable:** a comment form that disables its button while pending, shows the new
comment optimistically, restores the typed text and shows a field-level error when the
server rejects it, and **still submits with JavaScript disabled**.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 8 — Concurrent rendering, Suspense and transitions](../phase-8-concurrent-suspense/README.md)
