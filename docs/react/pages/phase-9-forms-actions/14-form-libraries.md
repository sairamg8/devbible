---
title: "Form libraries"
sidebar_label: "14 · Form libraries"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**. The React-side facts come from react.dev
> ([`<form>`](https://react.dev/reference/react-dom/components/form),
> [`useActionState`](https://react.dev/reference/react/useActionState),
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus),
> [`useOptimistic`](https://react.dev/reference/react/useOptimistic)).
> ⚠️ **The comparison with third-party libraries is engineering judgement, not
> documentation**, and no library version numbers or feature claims are asserted here —
> check each library's own docs, which change faster than this page will.
> No sandbox script backs this page; claims are cited, not measured.

**React 19's built-ins cover more of a form than they used to, and they do not cover
everything. The useful question is not "library or not" but "which of the four things a
library gives me do I actually need?"**

## What the built-ins now cover

Everything in topics 02–12, which is more than most people realise:

| Need | Built-in |
|---|---|
| Submission handling | `<form action>` — no `onSubmit`, no `preventDefault` |
| Reading all values | `FormData`, keyed by `name` |
| Pending state | `useActionState`'s `isPending`, or `useFormStatus` in a child |
| Server errors as state | `useActionState`'s returned state |
| Optimistic UI | `useOptimistic` |
| Request ordering | Sequential queueing in `useActionState` |
| Reset after success | Automatic, plus `requestFormReset` |
| Basic validation | Platform constraint validation |
| Works before hydration | With a Server Component + Server Function |

For a form that submits, validates on the server, shows errors and disables its button, that
list is complete. **A library adds nothing to it.**

## What a library still adds

⚠️ **Judgement.** Four things, and they are real:

**1. Schema validation with inferred types.** Declaring the shape once — with Zod, Valibot or
similar — and getting parsing, validation, error messages and TypeScript types from that one
declaration. The built-ins give you `FormData` full of strings
([topic 05](05-uncontrolled-and-formdata.md)); everything above that is yours to write, and
writing it twice (client and server) is exactly the drift MDN warns about
([topic 04](04-validation.md)). A shared schema is the clean answer to that.

**2. Field arrays.** Add, remove and reorder repeated groups — line items, contacts,
questions. `FormData` handles repeated names with `getAll`, but managing the *editing*
experience (a stable key per row, insert-at-index, reorder) is real work the built-ins do not
help with.

**3. Dirty and touched tracking.** "Has this field been edited?", "has the form changed at
all?", "should the unsaved-changes prompt appear?". Nothing in React tracks this; an
uncontrolled form does not even know.

**4. Per-field subscriptions.** A library that controls fields individually can update one
without re-rendering the form — which is the problem
[topic 05](05-uncontrolled-and-formdata.md) says uncontrolled forms avoid by having no state
at all, and which returns the moment you need live cross-field behaviour.

## When the built-ins are genuinely enough

⚠️ **Judgement**, drawn from the tables above:

- Fields are known and fixed — no dynamic rows.
- Validation is server-authoritative, with the platform's attributes for early feedback.
- Nothing needs live cross-field logic while typing.
- No unsaved-changes prompt.
- The form submits and shows the result.

That describes most forms in most applications: sign-in, contact, settings, a comment box, a
search filter. **Reaching for a library there is cost without return** — a dependency, an API
to learn, and a layer between you and the platform behaviour the rest of this phase
describes.

## When a library earns its place

- A multi-step wizard with cross-step validation.
- Dynamic field arrays the user edits.
- A schema shared between client and server, with types derived from it.
- A large form where per-keystroke behaviour matters and per-field subscriptions are the
  difference.
- An existing codebase already standardised on one — consistency has real value.

## The compatibility question

⚠️ **Judgement, and the part most likely to be out of date.** Libraries written before React
19 assume `onSubmit` and controlled fields; Actions assume `<form action>` and `FormData`.
The two models overlap awkwardly, and library support for Actions has been arriving at
different speeds.

**So check, rather than assume**: whether the library supports a function `action`, whether
it plays well with `useActionState`'s returned state, and whether it preserves the
progressive-enhancement path ([topic 11](11-progressive-enhancement.md)) — a library that
requires JavaScript to submit removes that entirely, which may be fine or may be the reason
you chose Actions.

**Deliberately not asserted here:** which libraries currently support what. That changes
faster than this page, and a confident claim would be wrong within months —
[rule: a claim documentation cannot settle is stated as uncertain or left out].

## The decision, in one line

**Start with the built-ins. Add a library when you hit one of the four things it adds — not
before, and not by default.** The reverse order is how a sign-in form with two fields ends up
with a schema, a resolver and a controller wrapper.

## Gotchas

**Symptom:** a two-field form has three form-related dependencies.
**Cause:** a library chosen by default rather than by need.
**Fix:** the built-ins cover submission, pending, errors, optimistic UI and reset.

**Symptom:** client and server validation drift apart.
**Cause:** the rules are written twice.
**Fix:** this is the strongest argument for a schema shared between them.

**Symptom:** a library form stops working with JavaScript disabled.
**Cause:** it requires JS to submit, which removes the progressive-enhancement path.
**Fix:** decide deliberately — that path may be why you chose Actions.

**Symptom:** a library and `useActionState` fight over the submission.
**Cause:** two models — `onSubmit` plus controlled fields versus `<form action>` plus
`FormData`.
**Fix:** pick one per form. Check the library's own current guidance rather than assuming.

**Symptom:** an unsaved-changes prompt is needed and nothing knows whether the form changed.
**Cause:** uncontrolled forms hold no state to compare.
**Fix:** dirty tracking is one of the four things a library exists for.

## Interview questions

**★ What do React 19's built-ins cover, and what do they not?**
They cover submission via `<form action>`, reading every value from `FormData`, pending state
from `useActionState` or `useFormStatus`, server errors as returned state, optimistic UI with
`useOptimistic`, sequential request ordering, automatic reset, and platform validation —
plus progressive enhancement with a Server Component and Server Function. They do not cover
schema validation with inferred types, field arrays, dirty and touched tracking, or per-field
subscriptions.

**★ When are the built-ins enough?**
When the fields are fixed, validation is server-authoritative, nothing needs live
cross-field behaviour while typing, and there is no unsaved-changes prompt. That is most
forms in most applications — sign-in, contact, settings, a comment box. Adding a library
there is cost without return.

**★ What is the strongest single reason to add one?**
A schema shared between client and server, with types inferred from it. Writing validation
twice is exactly the drift MDN warns about when it says server-side validation must be
consistent with the client, and one declaration removes the possibility.

**★ What should you check before pairing a library with Actions?**
Whether it supports a function `action` at all, how it interacts with `useActionState`'s
returned state, and whether it preserves the progressive-enhancement path — a library that
requires JavaScript to submit removes that, which may be exactly the thing you adopted
Actions for. The two models — `onSubmit` with controlled fields versus `<form action>` with
`FormData` — overlap awkwardly, so pick one per form.

**What is the decision rule?**
Start with the built-ins and add a library when you hit one of the four things it actually
adds. The reverse order is how a two-field sign-in form acquires a schema, a resolver and a
controller wrapper.

---

← Prev: [⚠ `useFormState`](13-useformstate.md) ·
Index: [Phase 9](README.md)
