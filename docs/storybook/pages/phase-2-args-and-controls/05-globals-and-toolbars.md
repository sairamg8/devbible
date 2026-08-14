---
title: "05 · Globals and toolbars"
sidebar_label: "05 · Globals and toolbars"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [globals documentation](https://storybook.js.org/docs/essentials/toolbars-and-globals)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Args belong to a story. **Globals belong to the session** — one value, shared by
every story, changed from the toolbar at the top of the screen.

The distinction is the whole topic:

| | Args | Globals |
|---|---|---|
| Scope | one story | every story |
| Set in | the story file | the toolbar, or `initialGlobals` |
| Answers | *what is this component being given?* | *what environment am I viewing in?* |
| Examples | `variant`, `label`, `orders` | theme, locale, text direction, density |

If you find yourself adding a `theme` prop to forty stories, you wanted a global.

## Declaring one

Two halves, both in `preview.ts`: the toolbar entry that renders the control, and
a decorator that does something with the value.

```tsx
// .storybook/preview.ts
import type {Preview} from '@storybook/react';
import {ThemeProvider} from '../src/theme';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'App theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          {value: 'light', title: 'Light', icon: 'sun'},
          {value: 'dark', title: 'Dark', icon: 'moon'},
        ],
        dynamicTitle: true,
      },
    },
  },

  initialGlobals: {
    theme: 'light',
  },

  decorators: [
    (Story, context) => (
      <ThemeProvider mode={context.globals.theme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

- **`globalTypes`** declares the global and its toolbar UI.
- **`initialGlobals`** sets the starting value. (Older material sets a default
  inside `globalTypes`; `initialGlobals` is the current place for it.)
- **The decorator** is what makes it do anything. A global with no consumer is a
  dropdown that changes nothing — a genuinely common mistake, because the toolbar
  appears and looks like it is working.

`dynamicTitle: true` makes the toolbar show the selected value rather than a fixed
label, which is worth having whenever there are more than two options.

## Reading a global in a story

```tsx
export const RespectsTheme: Story = {
  render: (args, {globals}) => (
    <Panel {...args} compact={globals.density === 'compact'} />
  ),
};
```

And in a `play` function, via the same context. Reading globals in a story is fine
for a story *about* the global — a "here is every density" showcase. For anything
else, prefer the decorator: a story that reads globals directly is one that renders
differently depending on toolbar state nobody set deliberately.

## Pinning a global for one story

```tsx
export const AlwaysDark: Story = {
  globals: {theme: 'dark'},
};
```

This overrides the toolbar for that story only. Two good uses: a story
demonstrating a specifically dark-mode bug, and a visual-regression story that must
snapshot deterministically regardless of what the toolbar happened to be set to
(Phase 8).

## Globals worth having

- **Theme** — light/dark, and any brand variants. The most common by a distance.
- **Locale** — with the copy actually swapped, this catches the German-word-is-40-
  characters class of bug before it ships.
- **Text direction** — an RTL toggle finds layout assumptions nothing else does.
- **Density / viewport-ish knobs** — where your design system has them.

What should *not* be a global: anything only one component cares about. That is an
arg. A toolbar of nine dropdowns, seven of which are irrelevant to whatever you are
looking at, is worse than no toolbar.

## Gotchas

**Symptom — the toolbar dropdown appears but changes nothing.** *Cause:*
`globalTypes` declares the control; **something has to consume the value**. *Fix:*
add a global decorator that reads `context.globals.<name>`. This is the standard
first-time mistake, and it is convincing because the UI looks correct.

**Symptom — the default value is ignored.** *Cause:* the default is being set in
the wrong place — older examples put it inside `globalTypes`. *Fix:* use
`initialGlobals` in `preview.ts`.

**Symptom — visual regression snapshots differ run to run.** *Cause:* the story
inherits whatever the toolbar was last set to. *Fix:* pin it per story with
`globals: {theme: 'dark'}` on any story that gets snapshotted.

**Symptom — a story renders differently for two people looking at the same URL.**
*Cause:* globals are session state, and not all of it is in the URL. *Fix:* pin the
global on the story when the value is part of what the story *is*, rather than part
of how someone happens to be viewing.

**Symptom — the theme changes the component but not Storybook's own chrome (or the
reverse).** *Cause:* two different things called "theme" — the preview and the
manager are separate documents with separate config. *Fix:* Phase 5. Your global
decorator only ever reaches the preview.

## Interview questions

**★ What is the difference between an arg and a global?**
An arg is an input to one story; a global is session-wide state shared by every
story, set from the toolbar. Args answer "what is this component being given",
globals answer "what environment am I viewing in" — theme, locale, text direction.
Adding the same prop to forty stories is the signal that you wanted a global.

**★ You added a toolbar dropdown and it changes nothing. What is missing?**
A consumer. `globalTypes` only declares the control and its toolbar UI; something
has to read `context.globals.<name>` — normally a global decorator in `preview.ts`
that wraps every story. The dropdown rendering correctly is what makes this
convincing rather than obvious.

**How do you stop a global from making a story non-deterministic?**
Pin it on the story with `globals: {theme: 'dark'}`, which overrides the toolbar for
that story. This matters most for visual-regression stories, which would otherwise
snapshot whatever the toolbar was last set to.

**Which things deserve to be globals?**
Ones that apply across the whole Storybook and describe the viewing environment —
theme, locale, text direction, density. Anything only one component cares about is
an arg; putting it in the toolbar makes the toolbar useless for everyone else.

**Why is a locale global more than a nicety?**
Because it makes the "this German string is 40 characters and breaks the layout"
class of bug reproducible in one click, on every component at once, instead of
being discovered in production.

---

**← Prev** [04 · Actions and spies](./04-actions-and-spies.md) ·
**Next →** [06 · Parameters and the merge order](./06-parameters-and-merge-order.md)
