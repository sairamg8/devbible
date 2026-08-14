---
title: "Controls Panel: Live Prop Editing, argTypes & Auto-Inference"
sidebar_label: "Controls Panel"
sidebar_position: 1
---

# 🎛️ Controls Panel: Live Prop Editing, argTypes & Auto-Inference

> **What you see:** Bottom panel tab **Controls** on every story.  
> **What it does:** Renders an interactive form of the story’s `args` so anyone can change props live without editing source.  
> **What drives it:** TypeScript/PropTypes docgen + explicit `argTypes` + `parameters.controls`.  
> Related: [Story anatomy — args/argTypes](../02-story-anatomy/01-file-structure.md) · [Actions panel](../03-addons-ecosystem/02-actions-panel-in-depth.md) · [Advanced preview defaults](../13-build-and-configuration/02-advanced-main-and-preview-customization.md)

## 1. Under-The-Hood Mechanics

```
Component TypeScript props / PropTypes
        │
        ▼  react-docgen / react-docgen-typescript (main.typescript.reactDocgen)
Docgen prop table (name, type, default, description from JSDoc)
        │
        ▼  Storybook infers control widgets
argTypes (meta + story merge)  ──►  Controls panel UI
        │
        ▼  User edits a control
args update in Storybook store  ──►  story re-renders with new props
        │
        ▼  Session-only
Refresh / navigate away  ──►  resets to values declared in the .stories file
```

### Why Controls exist
Stories are **data-driven** (`args`), not frozen JSX snapshots. That single design decision powers:

| Consumer | Benefit |
|---|---|
| Designers / PMs | Explore every prop combination without asking engineering |
| Engineers | Debug edge cases (empty string, max length, rare variants) in seconds |
| Docs (Autodocs) | Same `args`/`argTypes` feed the props table and live canvas |
| `play` functions | Can read **current** args (including live edits during a session) |

### Args composition (what the panel actually edits)

```
Meta.args          (defaults for every story of the component)
  + Story.args     (overrides for this named export)
  + Controls edits (runtime, session-only)
  ────────────────
  = Resolved args passed to the component / render function
```

Story-level args **override** meta args by key; they do not deep-merge nested objects unless you structure them carefully.

---

## 2. What You See in the Controls UI

| UI element | Meaning |
|---|---|
| **Name** | Prop / arg key (from docgen or `argTypes`) |
| **Description** | JSDoc / TSDoc text (when `controls.expanded` or description column shown) |
| **Control widget** | boolean toggle, text, number, select, color, date, object JSON, etc. |
| **Default / reset** | Reset individual control or whole panel to story-declared args |
| **Hide / show** | “Hide no controls” / filter when a prop has `control: false` |

If a story has **no editable args** (everything disabled or no args), the panel shows “This story has no controls.” That usually means you hardcoded JSX in `render` instead of driving the component from `args`.

---

## 3. Control Types Reference

Set explicitly with `argTypes[prop].control`, or let inference pick a default from the prop type.

| `control` value | Best for | Notes |
|---|---|---|
| `'boolean'` | flags | Toggle switch |
| `'text'` | strings | Free text |
| `'number'` / `{ type: 'number', min, max, step }` | numeric props | Prefer `range` for sliders |
| `'range'` | continuous numbers | Same min/max/step options |
| `'select'` | unions / enums | Dropdown; pair with `options` |
| `'radio'` / `'inline-radio'` | short enums | Radio group (inline saves vertical space) |
| `'check'` / `'inline-check'` / `'multi-select'` | string arrays | Multi-value |
| `'object'` | nested config objects | JSON editor — easy to break; validate carefully |
| `'file'` | upload previews | Returns data URLs; not a real file upload API |
| `'color'` | color strings | Hex/rgb; use for design tokens demos |
| `'date'` | date values | Returns Date or number depending on config |
| `false` / `{ disable: true }` | hide control | Still show in docs table if you only disable control |

### Inference from TypeScript (typical)

| Prop type | Inferred control |
|---|---|
| `boolean` | boolean |
| `string` | text |
| `number` | number |
| `'a' \| 'b' \| 'c'` | select with those options |
| `enum` | select |
| complex / unknown | often object or no useful control → set `argTypes` manually |

---

## 4. Production Configuration

### 4.1 Meta + story with precise argTypes

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Save",
    variant: "primary",
    size: "md",
    disabled: false,
    onClick: fn(), // pairs with Actions / Interactions — see Actions deep dive
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost", "danger"],
      description: "Visual weight / intent",
      table: { category: "Appearance", defaultValue: { summary: "primary" } },
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      table: { category: "Appearance" },
    },
    disabled: {
      control: "boolean",
      table: { category: "State" },
    },
    children: {
      control: "text",
      table: { category: "Content" },
    },
    // Hide implementation details from Controls but keep them out of the noise
    className: { control: false, table: { disable: true } },
    asChild: { control: false, table: { disable: true } },
    onClick: {
      // action is auto-detected via parameters.actions.argTypesRegex, or:
      action: "clicked",
      table: { category: "Events" },
    },
  },
  parameters: {
    controls: {
      sort: "requiredFirst",
      expanded: true,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
```

### 4.2 Global Controls defaults (`preview.ts`)

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
      sort: "requiredFirst", // 'none' | 'alpha' | 'requiredFirst'
      matchers: {
        // Auto-pick color/date widgets from prop *names*
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      exclude: ["ref", "key", "asChild"], // never show these
      // include: ['variant', 'size'], // whitelist mode (rare)
    },
  },
};

export default preview;
```

### 4.3 Conditional controls (`if`)

Show a control only when another arg has a certain value:

```ts
argTypes: {
  iconPosition: {
    control: "radio",
    options: ["start", "end"],
    if: { arg: "icon", truthy: true }, // only when icon is set
  },
  dismissLabel: {
    control: "text",
    if: { arg: "dismissible", eq: true },
  },
},
```

### 4.4 Mapping labels ≠ raw values

When the UI should show human labels but the component needs codes:

```ts
argTypes: {
  currency: {
    control: "select",
    options: ["usd", "eur", "jpy"],
    mapping: {
      usd: { code: "USD", symbol: "$" },
      eur: { code: "EUR", symbol: "€" },
      jpy: { code: "JPY", symbol: "¥" },
    },
  },
},
```

The control stores the **option key**; Storybook passes the **mapped value** into the component.

### 4.5 Custom `render` that still respects Controls

```tsx
export const WithTrailingIcon: Story = {
  args: { children: "Continue", variant: "primary" },
  render: (args) => (
    <Button {...args} icon={<ChevronRight aria-hidden />}>
      {args.children}
    </Button>
  ),
};
```

If you hardcode props that also exist in `args`, Controls will appear broken (edits ignored). Always spread `args` onto the component.

### 4.6 Args inside `play` (live values)

```tsx
export const Interactive: Story = {
  args: { label: "Notify me", count: 1 },
  // canvas + userEvent come pre-scoped on the play context (current Storybook) —
  // equivalent to `within(canvasElement)` + `import { userEvent } from "@storybook/test"`,
  // see the Interactions deep dive §1 for both styles.
  play: async ({ args, canvas, userEvent }) => {
    // Reflects Controls-panel edits made *before* re-running play in the same session
    await userEvent.click(canvas.getByRole("button", { name: args.label }));
  },
};
```

---

## 5. Real-World Engineering Scenario

**Scenario:** Design review of a multi-variant `Alert` without 20 named stories.

The design system had severity × layout × dismissible × icon combinations. Naming every matrix cell as a story exploded the sidebar. Instead:

1. One **playground** story with rich `argTypes` (selects + booleans).  
2. A smaller set of **canonical** stories for Chromatic / a11y baselines (`Default`, `Error`, `WithLongMessage`).  
3. Designers used Controls for exploration; CI used named stories for stable snapshots.

**Rule of thumb:** Controls = exploration. Named stories = regression baselines and docs examples.

---

## 6. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Controls changes are not source of truth
```
❌ Expectation: tweak Controls → story file updates
✅ Reality: session-only. Persist by editing .stories.tsx (or “Copy story” tooling if you use it)
```

### ⚠️ Pitfall 2: Widening prop types destroys good controls
```ts
// ❌ status: string  → free-text control
// ✅ status: 'active' | 'inactive' | 'pending'  → select inferred automatically
```

### ⚠️ Pitfall 3: Duplicating what docgen already infers
Only declare `argTypes` when you need different widgets, categories, descriptions, mapping, or to hide noise.

### ⚠️ Pitfall 4: Unfiltered HTML attribute props
Without `typescript.reactDocgen` prop filters, Controls fills with every native DOM prop (`onCopy`, `about`, …). Configure `propFilter` in `main.ts` — see [advanced main customization](../13-build-and-configuration/02-advanced-main-and-preview-customization.md).

### ⚠️ Pitfall 5: `object` control for complex state
JSON editing is brittle for deep trees. Prefer dedicated stories for complex states, or flatten to primitive args the control can edit safely.

### ⚠️ Pitfall 6: Callbacks shown as empty / broken controls
Event handlers should use `action` / `fn()`, not free-form object controls. Prefer Actions auto-detect (`argTypesRegex`) and hide noisy handlers from the Controls table when they clutter review.

---

## 7. Checklist

```
[ ] Component props typed tightly (unions for variants)
[ ] Meta.args cover sensible defaults for the playground story
[ ] argTypes only for overrides: categories, mapping, conditionals, hide list
[ ] parameters.controls.matchers / exclude set globally in preview
[ ] propFilter keeps design-system Controls usable at scale
[ ] Canonical named stories exist for visual/a11y CI (not only a playground)
[ ] Custom render spreads {...args}
[ ] Team knows Controls edits are not persisted
```

---

## 8. Related panels

| Panel | Relationship to Controls |
|---|---|
| **Actions** | Callback args (`onClick`) log here when fired; often wired via `fn()` / `action` |
| **Interactions** | `play` runs against current args; step through behavior after setting Controls |
| **Visual tests** | Named story args (not ad-hoc Controls edits) define Chromatic baselines |
| **Accessibility** | Re-scan after changing args that affect labels, contrast, roles |
