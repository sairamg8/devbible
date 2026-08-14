---
title: "03 · Typing stories"
sidebar_label: "03 · Typing stories"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [CSF reference](https://storybook.js.org/docs/api/csf)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Two types, one import, and one choice that decides whether your `args` are
actually checked.

```tsx
import type {Meta, StoryObj} from '@storybook/react';
```

`Meta<T>` types the default export. `StoryObj<T>` types a story. The renderer
package is where they come from — `@storybook/vue3` for Vue, and so on — because
what counts as "a component" is renderer-specific.

## The form to use

```tsx
import type {Meta, StoryObj} from '@storybook/react';
import {Button} from './Button';

const meta = {
  component: Button,
  args: {variant: 'primary'},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;        // ← typeof meta, not typeof Button

export const Primary: Story = {
  args: {label: 'Place order'},
};
```

Two details carry the weight, and both are easy to get subtly wrong.

## `satisfies Meta<…>` rather than `: Meta<…>`

```tsx
const meta: Meta<typeof Button> = {...};        // annotation — widens
const meta = {...} satisfies Meta<typeof Button>;  // satisfies — checks, keeps narrow
```

An annotation **checks and then widens** `meta` to the declared type. `satisfies`
**checks and keeps the literal type**. That matters because the next line reads
`typeof meta`:

```tsx
const meta = {
  component: Button,
  args: {variant: 'primary'},          // ← this default is known to exist…
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

// …so `variant` is not required here. TypeScript knows meta already supplied it.
export const Primary: Story = {args: {label: 'Place order'}};
```

With a plain annotation, `typeof meta` is just `Meta<typeof Button>` — the literal
`args` are erased, and TypeScript can no longer tell that `variant` was already
provided. You then get errors demanding required props that the meta is in fact
supplying.

**Rule:** `satisfies` on the meta, `StoryObj<typeof meta>` for the story type.
Using `StoryObj<typeof Button>` instead is the common near-miss — it type-checks,
but every required prop is required in every story, and `meta.args` stops counting.

## What this actually catches

```tsx
export const Broken: Story = {
  args: {
    varient: 'secondary',      // ❌ typo — not a prop of Button
    label: 42,                 // ❌ number, expects string
    onClick: 'handleClick',    // ❌ string, expects a function
  },
};
```

All three are compile errors. Without the types they are three stories that render
wrong — or render fine and mislead a designer, which is worse.

It also flows into `argTypes`:

```tsx
const meta = {
  component: Button,
  argTypes: {
    varient: {control: 'select'},   // ❌ not a prop
    variant: {control: 'select', options: ['primary', 'secondary']},  // ✅
  },
} satisfies Meta<typeof Button>;
```

## The generic-component problem

A generic component loses its parameter through `typeof`:

```tsx
function DataTable<Row>({rows, columns}: DataTableProps<Row>) {/* … */}
```

`Meta<typeof DataTable>` cannot decide what `Row` is, so `rows` degrades to
something unhelpful. Pin the instantiation instead:

```tsx
import type {Meta, StoryObj} from '@storybook/react';
import {DataTable} from './DataTable';
import type {Order} from '../types';

// Name the concrete instantiation you are telling stories about.
const meta = {
  component: DataTable<Order>,
} satisfies Meta<typeof DataTable<Order>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithOrders: Story = {
  args: {rows: sampleOrders, columns: orderColumns},   // fully checked
};
```

If the component is generic over several parameters that matter, write one story
file per meaningful instantiation. A story is a concrete example by definition —
there is no such thing as a story of a generic.

## Typing `render` and `play`

Both are typed for you when `Story` is right:

```tsx
export const InsideAForm: Story = {
  args: {label: 'Submit'},
  render: (args) => (                       // args: ButtonProps, inferred
    <form onSubmit={(e) => e.preventDefault()}>
      <Button {...args} />
    </form>
  ),
  play: async ({canvas, userEvent, args}) => {   // args typed too
    await userEvent.click(canvas.getByRole('button', {name: args.label}));
  },
};
```

If `args` inside `render` or `play` is coming through as `any`, the cause is
almost always `StoryObj<typeof Button>` where `StoryObj<typeof meta>` was meant.

## Gotchas

**Symptom — TypeScript demands a prop in every story although `meta.args` already
supplies it.** *Cause:* either the meta used a `: Meta<…>` annotation, which widens
away the literal `args`, or the story type is `StoryObj<typeof Button>` rather than
`StoryObj<typeof meta>`. *Fix:* `satisfies` on the meta and `typeof meta` on the
story. Both are needed; either one alone leaves the gap.

**Symptom — args are `any` inside `render` or `play`.** *Cause:* the same
mis-typing. *Fix:* as above. `any` in the play function is the loudest signal,
because it silently disables every assertion's type checking too.

**Symptom — a generic component's `rows` prop accepts anything.** *Cause:* `typeof
GenericComponent` cannot infer the type parameter. *Fix:* pin the instantiation —
`Meta<typeof DataTable<Order>>` — and write a story file per instantiation that
matters.

**Symptom — `Meta` and `StoryObj` cannot be found.** *Cause:* imported from
`storybook` or from `@storybook/test` rather than from the renderer package.
*Fix:* they come from `@storybook/react` (or `@storybook/vue3`, etc.). The
renderer packages were **not** part of the 9.0 consolidation.

**Symptom — a prop shows no control and no docs, though it is typed.** *Cause:*
this is docgen, not story typing — the two are separate systems, and a type that
type-checks can still be one docgen cannot extract. *Fix:* Phase 4. Do not go
looking for a typing error; there is not one.

## Interview questions

**★ Why `satisfies Meta<typeof Button>` rather than `const meta: Meta<typeof
Button>`?**
An annotation checks the object and then widens it to the annotated type, erasing
the literal `args` you wrote. `satisfies` checks it and keeps the literal type. The
next line uses `typeof meta`, so with `satisfies` TypeScript knows which defaults
the meta already supplies and stops demanding them in every story.

**★ Why `StoryObj<typeof meta>` and not `StoryObj<typeof Button>`?**
`typeof meta` carries the meta's own `args`, so a story only has to supply what the
meta did not. `typeof Button` knows only the component's props, so every required
prop becomes required in every story and `meta.args` stops counting. It compiles
either way, which is what makes it easy to miss.

**How do you type stories for a generic component?**
Pin the instantiation — `Meta<typeof DataTable<Order>>` — because `typeof` on a
generic function cannot infer its parameter. If several instantiations matter,
write a story file for each; a story is a concrete example, so there is no
meaningful story of a generic.

**Where do `Meta` and `StoryObj` come from, and why there?**
From the renderer package — `@storybook/react`, `@storybook/vue3` — because what
counts as a component and what its props are is renderer-specific. Renderer
packages were not consolidated in 9.0, so those imports are unchanged on 10.x.

**Your `play` function's `args` is `any`. What is wrong?**
The story type, almost always `StoryObj<typeof Button>` instead of `StoryObj<typeof
meta>`. It matters more here than elsewhere because `any` also disables type
checking on every assertion in the play function.

---

**← Prev** [02 · File structure and the stories glob](./02-file-structure-and-the-glob.md) ·
**Next →** [04 · CSF factories](./04-csf-factories.md)
