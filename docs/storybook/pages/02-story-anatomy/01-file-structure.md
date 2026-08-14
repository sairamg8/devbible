---
title: "Story Anatomy: Meta, Named Exports, `args`, `argTypes` & `render`"
sidebar_label: "Story Anatomy"
sidebar_position: 1
---

# 📖 Story Anatomy: Meta, Named Exports, `args`, `argTypes` & `render`

## 1. Under-The-Hood Mechanics

Every `.stories.tsx` file follows a consistent, two-level structure — one **default export** (the "meta") establishing shared configuration, and any number of **named exports**, each one an individual, independently-addressable story.

```typescript
// Meta (default export) — SHARED across every story in this file
const meta: Meta<typeof Button> = {
  component: Button,           // which component this file's stories are for
  title: 'Components/Button',    // where it appears in Storybook's sidebar navigation tree
  tags: ['autodocs'],              // opt into auto-generated documentation
  parameters: { layout: 'centered' }, // shared display parameters for EVERY story below
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary'] } }, // shared control config
};
export default meta;

// Named exports — EACH one is an independent, addressable story
export const Primary: Story = { args: { variant: 'primary', label: 'Click' } };
export const Secondary: Story = { args: { variant: 'secondary', label: 'Click' } };
```

### `args`: Declarative Props Driving the Rendered Story
`args` are simply the props passed to the component for that specific story — but unlike hardcoding them directly in JSX, `args` are **data**, which is what lets Storybook's Controls addon (see [addons ecosystem](../03-addons-ecosystem/01-essential-addons.md)) generate a live-editing UI for them, and what lets a `play` function (see [interaction testing](../05-interaction-testing/01-play-functions.md)) read/assert against them.

### `argTypes`: Controlling How Controls Are Displayed
While Storybook can auto-infer sensible controls from TypeScript prop types via docgen, `argTypes` lets you override/refine that inference explicitly — constraining a `variant` prop's control to a `select` dropdown with specific allowed options, rather than a free-text input, for instance.

### `render`: Custom Rendering When `args` Alone Can't Express a Story
Most stories need nothing beyond `args` (Storybook renders `<Component {...args} />` automatically) — but a story needing custom wrapping JSX, multiple component instances, or non-trivial composition logic can supply its own `render` function instead, taking full control of exactly what gets rendered for that specific story.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Story Needing to Render Two Instances of a Component Side-by-Side for Visual Comparison, Beyond What `args` Alone Could Express.
A design review needed a story showing a "before" and "after" version of a redesigned card component rendered side-by-side, for direct visual comparison — a single `args` object mapping to one component instance couldn't express this composition. A custom `render` function for that specific story rendered two `<Card>` instances directly, with different prop sets each, wrapped in a flex container — going beyond what the standard `args`-driven single-component rendering could represent, while every OTHER simpler story in the same file continued using the standard, more concise `args`-only pattern.

---

## 3. Production-Grade Code Example

```tsx
// Card.stories.tsx — meta with shared parameters/argTypes, standard args-driven stories, and one custom render
import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Components/Card',
  parameters: { layout: 'padded' }, // shared display setting for every story below
  argTypes: {
    variant: { control: 'select', options: ['default', 'highlighted', 'archived'] },
  },
};
export default meta;

type Story = StoryObj<typeof Card>;

// Standard args-driven story — the common case
export const Default: Story = {
  args: { title: 'Product Card', variant: 'default' },
};

export const Highlighted: Story = {
  args: { title: 'Featured Product', variant: 'highlighted' },
};

// Custom render — beyond what a single args object can express
export const BeforeAfterComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <Card title="Old Design" variant="default" />
      <Card title="New Design" variant="highlighted" />
    </div>
  ),
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Overusing `render` When Plain `args` Would Have Sufficed
```tsx
// ❌ UNNECESSARY: this story could be expressed as a plain args object — using render
// here adds complexity (and disables some automatic Controls-panel integration) for no benefit
export const Primary: Story = {
  render: (args) => <Button {...args} />, // literally identical to just using args directly
  args: { variant: 'primary', label: 'Click' },
};

// ✅ CORRECT: let Storybook's default args-driven rendering handle the common case
export const Primary: Story = { args: { variant: 'primary', label: 'Click' } };
```

### ⚠️ Pitfall 2: Duplicating Shared Configuration Across Every Story Instead of Using Meta
```tsx
// ❌ REPETITIVE: repeating the same parameters/argTypes in every individual story means
// a shared config change requires updating EVERY story, not just the meta object once
export const Primary: Story = { parameters: { layout: 'centered' }, args: {...} };
export const Secondary: Story = { parameters: { layout: 'centered' }, args: {...} }; // duplicated

// ✅ CORRECT: put shared configuration on the meta object ONCE — every story inherits it automatically
const meta: Meta<typeof Button> = { component: Button, parameters: { layout: 'centered' } };
```

### ⚠️ Pitfall 3: Forgetting Story-Level `args` Merge With (Not Replace) Meta-Level `args`
```typescript
// Meta-level args establish DEFAULTS for every story in the file
const meta: Meta<typeof Button> = { component: Button, args: { variant: 'primary' } };

// ❌ MISUNDERSTANDING: this story's args MERGE with the meta's args — variant: 'primary'
// is STILL inherited here, since only `label` was explicitly overridden at the story level
export const WithLongLabel: Story = { args: { label: 'A much longer button label text' } };
// actual resolved args: { variant: 'primary', label: 'A much longer button label text' }

// ✅ AWARENESS: this merging behavior is often exactly what's wanted (DRY defaults), but
// forgetting it's a MERGE (not a replace) can cause confusion about which prop values a
// given story actually ends up rendering with
```
