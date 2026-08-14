---
title: "02 · argTypes and control inference"
sidebar_label: "02 · argTypes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [argTypes reference](https://storybook.js.org/docs/api/arg-types)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

`args` are the values. **`argTypes` describe them** — what kind of control to
render, what the allowed options are, what shows in the docs table, and what to
hide.

Most of the time you write none, because Storybook infers them.

## Where inference comes from

```
Component prop types (TypeScript, or PropTypes)
        │
        ▼  react-docgen / react-docgen-typescript
Docgen table: name · type · default · JSDoc description
        │
        ▼  Storybook picks a control widget per type
argTypes (inferred, then merged with yours)
        │
        ▼
Controls panel  +  Autodocs props table
```

Two things follow that are worth internalising:

- **`argTypes` and the docs table are the same data.** Hiding a control also
  affects the docs unless you are specific about which one you meant.
- **Inference is docgen's output, not TypeScript's.** A type that compiles fine can
  still be one docgen cannot read — see the failure list below.

### What gets inferred

| Prop type | Inferred control |
|---|---|
| `boolean` | toggle |
| `string` | text |
| `number` | number |
| `'a' \| 'b' \| 'c'` | select with those options |
| `enum` | select |
| function | none (use `fn()` — topic 04) |
| complex / unresolved | `object` JSON editor, or nothing useful |

That last row is when you write `argTypes` by hand.

## The control types

```tsx
const meta = {
  component: Button,
  argTypes: {
    variant: {control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger']},
    size: {control: 'select', options: ['sm', 'md', 'lg']},
    count: {control: {type: 'range', min: 0, max: 100, step: 5}},
    accent: {control: 'color'},
    startsAt: {control: 'date'},
    onClick: {control: false},        // no control, still in the docs table
    internalRef: {table: {disable: true}},   // gone from the docs table entirely
  },
} satisfies Meta<typeof Button>;
```

| `control` | Use for | Note |
|---|---|---|
| `'boolean'` | flags | |
| `'text'` | strings | |
| `'number'` / `{type:'number', min, max, step}` | numeric props | |
| `'range'` | continuous numbers | a slider; better than `number` for exploring |
| `'select'` | unions and enums | needs `options` |
| `'radio'` / `'inline-radio'` | short unions | `inline-` saves vertical space |
| `'check'` / `'inline-check'` / `'multi-select'` | arrays of strings | |
| `'object'` | nested objects | a raw JSON editor — easy to break |
| `'color'` | colour strings | |
| `'date'` | dates | returns a `Date` or a number depending on config |
| `'file'` | image previews | returns data URLs, not a real upload |
| `false` | hide the control | **keeps the row in the docs table** |

### `control: false` vs `table: {disable: true}`

The distinction people get wrong:

- **`control: false`** — the prop still appears in the docs table with its type and
  description; it just cannot be edited. Correct for callbacks and for anything a
  reader should know exists.
- **`table: {disable: true}`** — the prop disappears from the docs table entirely.
  Correct for genuinely internal props: refs you forward, `className` passthroughs,
  test ids.

Reach for the first by default. Hiding a prop from the documentation is a decision
about the reader, not about tidiness.

## Where you must write argTypes by hand

**A union that came through a type alias or an import.** Docgen often resolves it
to `string` rather than the three literals, and you get a free-text box where a
dropdown belongs.

```tsx
argTypes: {
  variant: {control: 'select', options: ['primary', 'secondary', 'ghost']},
},
```

**Numbers with a meaningful range.** Inference gives you a number box. A `range`
control turns "what does this look like at 40 items" into a drag.

**Anything you want documented beyond its type:**

```tsx
argTypes: {
  debounceMs: {
    control: {type: 'range', min: 0, max: 2000, step: 50},
    description: 'How long to wait after the last keystroke before searching.',
    table: {
      defaultValue: {summary: '300'},
      category: 'Behaviour',        // groups it in the docs table
    },
  },
},
```

`table.category` is underused and worth knowing: on a component with thirty props,
grouping them into `Appearance`, `Behaviour` and `Accessibility` is the difference
between a usable props table and a wall.

## Merging

`argTypes` merge across the three levels like everything else — global, meta,
story — and **per key, per property**. A story can refine one field of one argType
without restating it:

```tsx
const meta = {
  argTypes: {
    variant: {control: 'select', options: ['primary', 'secondary', 'ghost']},
  },
} satisfies Meta<typeof Button>;

export const DangerOnly: Story = {
  argTypes: {
    variant: {options: ['danger']},    // control: 'select' is inherited
  },
};
```

## Gotchas

**Symptom — a union prop renders as a free-text box instead of a dropdown.**
*Cause:* docgen resolved the type to `string` — usually because the union came
through an alias, an import, or an intersection. *Fix:* write the `argTypes` entry
by hand with `control: 'select'` and explicit `options`. Do not go looking for a
TypeScript error; the type is fine, docgen just could not follow it.

**Symptom — you disabled a control and the prop vanished from the documentation
too.** *Cause:* `table: {disable: true}` rather than `control: false`. *Fix:* use
`control: false` when the prop should still be documented but not edited.

**Symptom — the `object` control breaks the story when edited.** *Cause:* it is a
raw JSON editor with no schema; an invalid shape reaches the component directly.
*Fix:* prefer several flat args, or a story-level knob that builds the object in
`render`. Reserve `object` for cases a reviewer is unlikely to touch.

**Symptom — an `argTypes` key silently does nothing.** *Cause:* it is a typo, and
`argTypes` is keyed by prop name with no checking against reality unless the meta
is properly typed. *Fix:* type the meta with `satisfies Meta<typeof Component>` —
the typo then becomes a compile error (Phase 1 topic 03).

**Symptom — a `select` shows an empty dropdown.** *Cause:* `control: 'select'` with
no `options`. *Fix:* `select`, `radio`, `check` and `multi-select` all require
`options`; only inferred unions get them for free.

## Interview questions

**★ What is the difference between `args` and `argTypes`?**
`args` are the values a story passes to the component. `argTypes` describe those
args — which control widget to render, the allowed options, the docs-table
description and category, and what to hide. Args are data; argTypes are metadata
about that data, and they feed both the Controls panel and the docs table.

**★ A union-typed prop shows a text box instead of a dropdown. Why, and what do you
do?**
Because control inference comes from docgen, not from the compiler, and docgen
often cannot follow a union through an alias, an import or an intersection — it
falls back to `string`. The fix is an explicit `argTypes` entry with
`control: 'select'` and the `options` listed. Nothing is wrong with the TypeScript.

**★ When would you use `control: false` versus `table: {disable: true}`?**
`control: false` keeps the prop in the docs table but makes it non-editable —
right for callbacks and anything a reader should know exists. `table: {disable:
true}` removes it from the documentation altogether — right only for genuinely
internal props like forwarded refs or test ids.

**How do argTypes interact across meta and story?**
They merge per key and per property, so a story can refine one field of one
argType — narrowing `options` while inheriting the `control` type from the meta —
without restating the whole entry.

**How would you make a thirty-prop component's docs table readable?**
`table.category` on each argType, grouping props into `Appearance`, `Behaviour`,
`Accessibility` and so on, plus `table: {disable: true}` on the genuinely internal
ones and real `description` text on the ones whose purpose is not obvious from the
name.

---

**← Prev** [01 · Args as the source of truth](./01-args-as-the-source-of-truth.md) ·
**Next →** [03 · The Controls panel](./03-the-controls-panel.md)
