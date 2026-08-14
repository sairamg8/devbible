---
title: "03 · The Controls panel"
sidebar_label: "03 · Controls"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [Controls documentation](https://storybook.js.org/docs/essentials/controls)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Controls is the panel that turns a story from a picture into an instrument. It is
**core since Storybook 9** — there is nothing to install, and
`@storybook/addon-controls` no longer exists.

Topic 02 covered how to configure it. This page is about what it is *for*, which
is a different question and the one that decides whether anyone outside the team
opens your Storybook twice.

## What the panel shows

| Element | Meaning |
|---|---|
| **Name** | the arg key, from docgen or your `argTypes` |
| **Description** | the JSDoc/TSDoc on the prop |
| **Control** | the widget — toggle, text, select, range, colour, JSON editor |
| **Reset** | back to the args the file declares, per control or for all |

`parameters: {controls: {expanded: true}}` adds the description column. On a
component anyone but you will use, turn it on — an undocumented dropdown of four
strings is a guessing game.

## Who it is actually for

**A designer or PM.** They have a question — *what does this look like with a
40-character name?* — and no way to ask it that does not cost an engineer twenty
minutes. Controls converts that into a text box. This is the single highest-value
thing Storybook does for people who do not write code, and it is entirely
dependent on your stories being args-driven rather than JSX snapshots.

**You, ten minutes into a bug.** Rather than editing the component to try
`disabled` and `loading` together, you toggle two switches. The combination that
reproduces it then becomes a named story, and now it is regression-protected.

**A reviewer on a pull request.** A published static Storybook plus Controls means
"try it" is a link, not a checkout.

## Session-only, and why that is right

Every edit is discarded on reload or on navigating away. That is not a limitation
to work around:

- a story must render identically for everyone, or it stops being a shared
  reference;
- the file stays the single source of truth;
- an interesting combination is *supposed* to graduate into a named export, where
  it gets a URL, a docs entry, and protection from regressions.

**The workflow is: explore in Controls, promote to a story.** If you find yourself
recreating the same control settings twice, that is the signal.

## "This story has no controls"

The most common panel state people report as a bug. Three causes, in order of
likelihood:

1. **The story has no `args`.** It renders something hardcoded.
2. **`render` ignores its `args`.** The args exist; nothing consumes them.
3. **Everything is disabled** — `control: false` or `table: {disable: true}` across
   the board.

All three are the same underlying mistake: the story is a picture, not data. See
[topic 01](./01-args-as-the-source-of-truth.md).

## Making the panel usable on a big component

A component with thirty props produces thirty controls in docgen order, which is
unusable. Three fixes, cheapest first:

```tsx
argTypes: {
  // 1. Hide what nobody should touch.
  innerRef: {table: {disable: true}},
  'data-testid': {table: {disable: true}},

  // 2. Group what remains.
  variant: {table: {category: 'Appearance'}},
  size: {table: {category: 'Appearance'}},
  debounceMs: {table: {category: 'Behaviour'}},
  ariaLabel: {table: {category: 'Accessibility'}},

  // 3. Constrain what is left, so the widget teaches the allowed values.
  variant: {control: 'inline-radio', options: ['primary', 'secondary', 'ghost']},
},
```

A free-text box on a prop that accepts three values is worse than no control — it
invites a value that breaks the component and teaches the reader nothing.

## Gotchas

**Symptom — a control edit disappeared after a page reload.** *Cause:* control
state is session-only by design. *Fix:* if the combination matters, add it as a
named story. This is the intended workflow, not a workaround.

**Symptom — the panel is empty on one story and full on its neighbour.** *Cause:*
the empty one uses `render` with hardcoded props. *Fix:* spread `args` in `render`,
or drop `render` entirely.

**Symptom — a colleague changed a control and reported the component "broken".**
*Cause:* an `object` control is a raw JSON editor with no validation, so an invalid
shape goes straight to the component. *Fix:* flatten the args, or disable the
control on that prop and expose a story-level knob instead.

**Symptom — controls appear but have no descriptions.** *Cause:* either
`controls.expanded` is off, or docgen could not extract the JSDoc. *Fix:* enable
`expanded` first — that is the cheap half. If the descriptions are still missing,
it is a docgen problem, covered in Phase 4.

**Symptom — editing a control re-renders the story and loses component state.**
*Cause:* changing args re-renders, and internal `useState` resets. *Fix:* expected.
If a story needs to be inspected in a post-interaction state, use a `play` function
to drive it there rather than a control.

## Interview questions

**★ Who is the Controls panel actually for?**
Primarily people who cannot change the code — designers, PMs, reviewers. It turns
"what does this look like with a 40-character name" from an engineering request
into a text box. It also shortens the debug loop for engineers, since prop
combinations can be explored without editing anything.

**★ Why are control edits not persisted?**
Because a story has to render identically for everyone to be a shared reference,
and the file has to stay the single source of truth. The intended path is to
explore with controls, then promote an interesting combination to a named story —
which gives it a URL, a docs entry and regression protection.

**A story shows "This story has no controls". What are the possible causes?**
No `args` at all; a `render` that hardcodes props instead of spreading `args`; or
every arg disabled via `control: false` / `table: {disable: true}`. The first two
are the same underlying mistake — the story is markup rather than data.

**How do you keep the Controls panel usable on a component with thirty props?**
Hide genuinely internal props with `table: {disable: true}`, group the rest with
`table.category`, and constrain the remainder to real widgets — `inline-radio` or
`select` with explicit `options` — so the control communicates the allowed values
rather than inviting an invalid one.

**Do you need to install anything for Controls?**
No. Controls became part of core in Storybook 9; `@storybook/addon-controls` and
the `addon-essentials` meta-package that bundled it were both deleted. Seeing
either in a config is a reliable sign the config predates 9.0.

---

**← Prev** [02 · argTypes and control inference](./02-argtypes-and-inference.md) ·
**Next →** [04 · Actions and spies](./04-actions-and-spies.md)
