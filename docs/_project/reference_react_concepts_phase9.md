---
name: devbible-react-concepts-phase9
description: React Phase 9 (forms, Actions, optimistic UI) — the load-bearing claims and their sources, so a later session can review or reuse without re-reading 15 pages
metadata:
  type: reference
---

Written 2026-08-14 by session `2ee7a9a3`, branch `react-phase-7` in the `devbible-react`
worktree. **14 topics · 15 leaf pages · 3,411 lines · 0 files over 300.** No sandbox, no
console blocks. Build-verified: zero broken links and zero MDX errors in `docs/react/`.

## The spine

1. **Controlled is a contract, and React *forces* the value.** It is not observing the
   input — it overwrites the DOM value each render, which is why both halves (supply
   `value`, update **synchronously** in `onChange`) are mandatory. *"If you pass `value`
   without `onChange`, it will be impossible to type into the input."*
2. **An input cannot switch between controlled and uncontrolled** — and the thing that
   breaks it in practice is a `value` of `undefined` on the first render (data not loaded
   yet). Default to `''`, and clear to `''`, never `null`.
3. **A function `<form action>` does four things**: calls it with `FormData`, runs it in a
   **Transition**, tracks pending, and **resets all uncontrolled fields after it
   *succeeds***.
4. **"Succeeds" includes returning an error object.** That single fact drives the whole
   phase: returning `{ errors }` without `values` wipes what the user typed.
5. **Throwing ≠ returning.** A throw shows the nearest error boundary, unmounts the form,
   and **cancels all queued actions**. Returning keeps the form and puts the failure in
   state. *Expected outcomes are values; unexpected failures are exceptions.*
6. **`useActionState` is a reducer** — `(previousState, formData) => nextState` — and React
   *"queues and executes multiple calls sequentially. Each call receives the result of the
   previous call."* That is the request-ordering guarantee Phase 8 pointed at.

## Findings worth not re-deriving

- **File inputs cannot be controlled**, and it is a browser rule, not React's: MDN — *"You
  cannot set the value of a file picker from a script"*, and the value is a `C:\fakepath\`
  string, to stop pages guessing the user's file structure. Read `e.target.files`; clear by
  remounting with a `key`.
- **`<textarea>` takes no children**; **`<select>` puts the value on the select**, not
  `selected` on an option, and a `multiple` select takes an **array**. Radio groups need one
  state with `checked` derived, and use **both** `value` and `checked` — unlike a checkbox,
  where `value` is not the control.
- **A function action forces POST** regardless of the `method` prop — so a bookmarkable GET
  search form must use a **string** action.
- **`FormData` is keyed by `name`**, not `id`. A field with only an `id` renders perfectly
  and never submits. `Object.fromEntries` collapses repeated names (use `getAll`), all
  values are strings or `File`s, unchecked checkboxes are **absent** rather than false, and
  disabled controls are not submitted.
- **`useFormStatus` reads the PARENT form** and never a form rendered by the same component
  — the failure is silent (`pending` always `false`) and has its own troubleshooting entry.
  That rule is the design: it forces the boundary that lets a shared `<SubmitButton>` work
  with no props.
- **`useOptimistic`'s value is the revert**, not the display: on success the optimistic and
  real state *"converge in the same render"* with no extra render to clear it (so no
  flicker, no double item), and on failure it just renders `value` again — **no rollback
  code**. ⚠️ That depends on `value` being the **confirmed** truth. And *"you can catch the
  error to show a message"* is an instruction: a silent revert is not an error message.
- **`formAction` and `useActionState` do not compose.** The hook binds one action; other
  `formAction` buttons bypass it, so their return values go nowhere. Three documented ways
  out, all trade-offs. The classic bug: a **Delete button blocked by an unrelated `required`
  field**, because constraint validation runs for whichever button submits — fix with
  `formNoValidate`.
- **A successful action resets the FORM but not `useActionState`'s state** — so a success
  message can sit above an empty form indefinitely.
- **`requestFormReset` exists for its timing** — it defers to when the transition completes,
  after the transition's DOM mutations are applied, which `form.reset()` does not. Made
  public so UI libraries can build their own action APIs and keep the behaviour.
- **Progressive enhancement needs BOTH** a Server Component rendering the form and a Server
  Function as the action. Before hydration, **anything the platform does survives** (submit,
  constraint validation, `formAction`) and **nothing React does** (`isPending`,
  `useFormStatus`, `useOptimistic`).
- **`minlength`/`maxlength` are only checked on user-provided input** — not on prefilled
  values, even via `checkValidity()`. And **`form.submit()` skips constraint validation**;
  `click()` the submit button.
- **`useFormState` is deprecated** and the rename moved packages (`react-dom` → `react`);
  `useActionState` adds the third return value. ⚠️ **`useFormStatus` is a different, current
  hook also in `react-dom`** — "migrating" it breaks working code.

## Traps hit while writing

- **The `requestFormReset` reference page 404s** on react.dev. Details were taken from the
  React v19 release post and PRs #28804/#28809, and the page says so rather than implying
  reference coverage.
- **Backticks inside `git commit -m "…"` get command-substituted** by bash — one message
  lost a word. Always use `-F -` with a **quoted** heredoc (`<<'EOF'`).
- Editing a markdown table's status cell can drop a column and render broken; check with
  `awk -F'|' '/^\|/ {print NF-2}'`.

## Sources used

react.dev: `<input>` · `<select>` · `<textarea>` · `<form>` · `useActionState` ·
`useFormStatus` · `useOptimistic` · `useId` · `Component` (error boundaries) ·
`useTransition` · React v19 release post.
MDN: `FormData` · `input type=file` · Constraint validation.

Related: [[devbible-react-phase7]] · [[devbible-react-concepts-phase8]] ·
[[devbible-react-syllabus]]
