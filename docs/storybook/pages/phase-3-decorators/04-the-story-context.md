---
title: "04 · The story context"
sidebar_label: "04 · The story context"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [decorators documentation](https://storybook.js.org/docs/writing-stories/decorators)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

The context is the second argument to every decorator, and the object a `render`
and a `play` function also receive. It is how a decorator stops being a fixed
wrapper and starts responding to the story it is wrapping.

```tsx
const withTheme = (Story, context) => (
  <ThemeProvider mode={context.globals.theme}>
    <Story />
  </ThemeProvider>
);
```

## What is on it

| Property | What it is | Typical use in a decorator |
|---|---|---|
| `args` | the story's resolved args | branch on an input the component received |
| `globals` | session-wide toolbar values | theme, locale, direction |
| `parameters` | config about the story | per-story provider settings |
| `id` | the story's unique id | keys, logging, debugging |
| `name` / `title` | display name and sidebar path | labelling |
| `viewMode` | `'story'` or `'docs'` | render differently on a docs page |
| `componentId` | the component's id | grouping |

The same object reaches `render` as its second argument, and `play` as its only
argument — where it additionally carries `canvas`, `userEvent`, `step` and `mount`
(Phase 6).

## Which one should a decorator read?

This is the useful question, and the answer is usually **`globals` or
`parameters`, rarely `args`**.

| Read | When |
|---|---|
| `globals` | the value is a viewing choice a person makes — theme, locale, direction |
| `parameters` | the value is a fact about this story that Storybook or an addon needs — a route, a preloaded state |
| `args` | almost never — args belong to the component, and a decorator reading them couples the wrapper to the component's prop names |

The `args` case is worth spelling out. A global decorator that does this:

```tsx
// ⚠️ Now every component in the project is assumed to have a `theme` prop.
const withTheme = (Story, context) => (
  <ThemeProvider mode={context.args.theme ?? 'light'}>
    <Story />
  </ThemeProvider>
);
```

…has quietly made `theme` a reserved arg name across the entire Storybook. A
component that uses `theme` for something else now fights the decorator. Use a
global for this — that is what globals are for (Phase 2 topic 05).

## `viewMode` — the one that surprises people

A story renders in two places: the canvas, and any docs page that embeds it.
`context.viewMode` tells you which:

```tsx
const withPadding = (Story, context) => (
  <div style={{padding: context.viewMode === 'docs' ? 8 : 32}}>
    <Story />
  </div>
);
```

Worth reaching for when a decorator is right for the canvas and wrong in docs — a
full-height wrapper, a fixed background, a dev-only debug overlay. Do not use it to
make the documentation show something different from the story; that defeats the
purpose of the documentation being generated from stories.

## Parameterising a decorator properly

The pattern from [topic 03](./03-providers-in-decorators.md), stated as a rule:

```tsx
// preview.tsx — the wiring, once
decorators: [(Story, context) => (
  <MemoryRouter initialEntries={[context.parameters.route ?? '/']}>
    <Story />
  </MemoryRouter>
)],
```

```tsx
// any story — data, not a decorator
export const OnOrderDetail: Story = {
  parameters: {route: '/orders/42'},
};
```

**Always provide a default** (`?? '/'`). A decorator that assumes a parameter
exists breaks every story that does not set it, which is most of them — and the
error surfaces far from its cause.

## Reading context in `render`

```tsx
export const CompactWhenDense: Story = {
  render: (args, {globals}) => (
    <Panel {...args} compact={globals.density === 'compact'} />
  ),
};
```

Legitimate for a story that is *about* the global. For anything else prefer the
decorator, because a story that reads globals directly renders differently
depending on toolbar state nobody set deliberately — and that is exactly the
non-determinism that ruins visual snapshots (Phase 8).

## Gotchas

**Symptom — a decorator works for one component and breaks another.** *Cause:* it
reads `context.args`, so it depends on that component's prop names. *Fix:* read
`globals` or `parameters` instead. A global decorator should know nothing about any
specific component.

**Symptom — every story without a particular parameter throws.** *Cause:* the
decorator reads `context.parameters.x` with no fallback. *Fix:* `?? default`. The
error appears in a story that never mentioned the feature, so the cause is hard to
find from the symptom.

**Symptom — a decorator behaves differently on a docs page.** *Cause:* it is
sensitive to `viewMode`, or to layout that differs when a story is embedded.
*Fix:* branch on `context.viewMode` deliberately, rather than discovering it.

**Symptom — a story looks different for two people at the same URL.** *Cause:* it
reads `globals` and the toolbar state differs. *Fix:* pin the global on the story
(`globals: {theme: 'dark'}`) when the value is part of what the story *is*.

**Symptom — you want the component name inside a decorator and reach for
`context.component`.** *Cause:* the ids are the stable identifiers. *Fix:* use
`context.componentId`, `context.id` or `context.title` — those are what the context
is documented to carry.

## Interview questions

**★ What is the story context and where does it appear?**
The second argument to every decorator, the second argument to `render`, and the
argument to `play`. It carries the story's resolved `args`, session `globals`,
`parameters`, `id`, `title`, and `viewMode` — and in a play function additionally
`canvas`, `userEvent`, `step` and `mount`.

**★ Should a global decorator read `context.args`?**
Almost never. Doing so couples the decorator to a particular component's prop
names and effectively reserves that arg name across the whole Storybook — a
component using it for something else then fights the decorator. Viewing choices
belong in `globals`; per-story facts belong in `parameters`.

**★ How do you make one global decorator configurable per story?**
Have it read `context.parameters` with a default —
`initialEntries={[context.parameters.route ?? '/']}` — so a story just sets
`parameters: {route: '/orders/42'}`. The default matters: without it, every story
that does not set the parameter breaks, and the error appears far from its cause.

**What is `viewMode` for?**
Distinguishing a story rendered on the canvas from the same story embedded in a
docs page. It is the escape hatch when a decorator is right in one and wrong in the
other — a full-height wrapper, say. It should not be used to make the documentation
show something different from the story.

**When is it acceptable for a story to read `globals` directly in `render`?**
When the story is *about* the global — a showcase of every density, for instance.
Otherwise it makes the story render according to toolbar state nobody set
deliberately, which is the non-determinism that breaks visual-regression snapshots.

---

**← Prev** [03 · Providers in decorators](./03-providers-in-decorators.md) ·
**Next →** [05 · Loaders and beforeEach](./05-loaders-and-beforeeach.md)
