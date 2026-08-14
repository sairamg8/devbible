---
title: "Actions Panel: Callback Logging, Spies & Event Verification"
sidebar_label: "Actions Panel"
sidebar_position: 2
---

# ⚡ Actions Panel: Callback Logging, Spies & Event Verification

> **What you see:** Bottom panel tab **Actions** on every story.  
> **What it does:** Logs every invocation of wired callback props (and optional DOM events) with arguments and call order.  
> **What drives it:** `action()` / `fn()`, `argTypes` `action` fields, `parameters.actions.argTypesRegex`, and `parameters.actions.handles`.  
> Related: [Essentials overview](./01-essential-addons.md) · [Controls](../04-controls-and-args/01-dynamic-prop-editing.md) · [Interactions / play](../05-interaction-testing/01-play-functions.md)
>
> **📌 Version note:** as of Storybook 9 (current stable: 10), the Actions
> panel itself is core — no `@storybook/addon-actions` / `addon-essentials`
> install needed. `fn()` still comes from `@storybook/test` (also available
> as the unscoped `storybook/test`); the named-log-only `action()` helper
> now lives at `storybook/actions` (the old `@storybook/addon-actions`
> package is gone — see §3.2).

## 1. Under-The-Hood Mechanics

```
Story args include a callback prop (onClick, onChange, onSubmit, …)
        │
        ▼  Wired as action('name') or fn() from @storybook/test
User interacts with the component (or play function does)
        │
        ▼  Component calls the prop: onClick(event) / onChange(value)
Actions panel receives a log entry:
  • action name
  • arguments (serializable preview)
  • call count / order
        │
        ▼  In Interactions tests
fn() is also a mock → expect(args.onClick).toHaveBeenCalledWith(...)
```

### Actions vs `console.log` vs unit-test mocks

| Approach | Visible in Storybook UI? | Assertable in `play`? | Survives design review? |
|---|---|---|---|
| `console.log` in component | Browser console only | No | No (noise, often forgotten) |
| `args: { onClick: () => {} }` | Silent | No | No proof the handler fired |
| `action('onClick')` | **Actions panel** | Limited (legacy) | Yes for manual review |
| `fn()` from `@storybook/test` | Actions panel (SB 7.6+, core since SB9) | **Yes** (`toHaveBeenCalled`) | Best of both worlds |

**Modern default:** use `fn()` from `@storybook/test` for any callback you care about in reviews **or** interaction tests. Use `action()` only when you need a named log without mock matchers.

### Auto-detection via regex

Most projects enable this once in `preview.ts`:

```ts
parameters: {
  actions: { argTypesRegex: "^on[A-Z].*" },
}
```

Any arg whose **name** matches (`onClick`, `onValueChange`, `onOpenChange`) becomes an action automatically — no per-prop boilerplate. Explicit `args.onClick = fn()` still wins when you need a stable mock reference for assertions.

---

## 2. What You See in the Actions UI

| UI element | Meaning |
|---|---|
| **Empty state** | No callbacks fired yet — click the component or run Interactions |
| **Log rows** | Newest calls typically at top; name matches `action('…')` or inferred prop name |
| **Expand row** | Inspect arguments (event objects, payloads) |
| **Clear** | Wipe the log for the current session / story visit |
| **Count** | How many times that action fired |

If you click a button and **nothing appears**, either:

1. The handler prop is not wired (`undefined` / not matching regex), or  
2. The component does not call the prop (bug), or  
3. You’re looking at a different story than the one you clicked.

---

## 3. Wiring Patterns (Production)

### 3.1 Recommended: `fn()` on meta args

```tsx
// Alert.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { fn, expect, userEvent, within } from "@storybook/test";
import { Alert } from "./Alert";

const meta = {
  title: "Feedback/Alert",
  component: Alert,
  args: {
    title: "Unsaved changes",
    onDismiss: fn(),
    onAction: fn(),
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dismissible: Story = {
  args: {
    dismissible: true,
    actionLabel: "Save",
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /dismiss/i }));
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole("button", { name: /save/i }));
    await expect(args.onAction).toHaveBeenCalled();
  },
};
```

### 3.2 Explicit `action()` (legacy / name-only logs)

```tsx
// Storybook 9+: import { action } from "storybook/actions";
// Pre-9 (addon-essentials era): import { action } from "@storybook/addon-actions";
import { action } from "storybook/actions";

args: {
  onDismiss: action("alert-dismissed"), // custom label in the panel
}
```

### 3.3 argTypes `action` field

```ts
argTypes: {
  onSelect: { action: "selected" },
},
```

Storybook injects a logging function for that prop when not provided in `args`.

### 3.4 DOM event handles (non-prop events)

For native events not exposed as React props (or for debugging bubbling):

```ts
// preview.ts or story parameters
parameters: {
  actions: {
    handles: ["mouseover", "click .btn", "load", "error"],
  },
},
```

Use sparingly — prop-level `fn()` is clearer for design-system APIs.

### 3.5 Global preview defaults

```ts
// .storybook/preview.ts
const preview: Preview = {
  parameters: {
    actions: {
      argTypesRegex: "^on[A-Z].*",
      // handles: ['click'], // usually too noisy globally
    },
  },
};
```

---

## 4. Real-World Engineering Scenario

**Scenario:** “The MenuItem looks fine, but selection never reaches the form.”

During design review, product clicked a `MenuItem` and assumed `onSelect` fired because the highlight style changed. Internally the component updated local state but **forgot to call `onSelect`**. Without Actions, the review “passed.” With `onSelect: fn()` and the Actions panel empty after clicks, the bug was obvious in thirty seconds — no debugger required.

Pair with a `play` function that `expect(args.onSelect).toHaveBeenCalledWith('item-id')` so CI catches the regression forever.

---

## 5. Actions + Controls + Interactions Together

```
Controls  → set props (variant, disabled, label)
Actions   → prove callbacks fire with right payloads when user (or play) interacts
Interactions → script the interaction + assert on fn() mocks and DOM outcomes
```

Example flow for a review session:

1. Open story → Controls: set `disabled: false`, `label: "Pay now"`.  
2. Click button → Actions: see `onClick` with the synthetic event / payload.  
3. Open Interactions → re-run `play` → green steps + same action logs.

---

## 6. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Empty handler — silent UI
```tsx
// ❌ No visibility
args: { onClick: () => {} }

// ✅ Review + test
args: { onClick: fn() }
```

### ⚠️ Pitfall 2: Asserting the wrong function reference
```tsx
// ❌
const onSubmit = fn();
export const Story = {
  args: { onSubmit: fn() }, // different mock!
  play: async () => {
    expect(onSubmit).toHaveBeenCalled(); // always fails
  },
};

// ✅
export const Story = {
  args: { onSubmit: fn() },
  play: async ({ args }) => {
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

### ⚠️ Pitfall 3: Regex too broad or too narrow
- Too broad (`.*`) → logs internal props that happen to look like handlers.  
- Too narrow → real `onValueChange` missed if you only match `onClick`.  
  Prefer `^on[A-Z].*` (Storybook default recommendation).

### ⚠️ Pitfall 4: Non-serializable arguments
Huge DOM nodes / circular structures make the Actions panel hard to read. Prefer components that pass **domain payloads** (`{ id, value }`) to callbacks, not entire events, when designing public APIs — better for Actions and for consumers.

### ⚠️ Pitfall 5: Assuming Actions prove business logic
Actions only prove **the component invoked the prop**. They do not prove the parent handled it correctly. That’s app-level testing (RTL/Playwright). In Storybook, stop at the component contract.

### ⚠️ Pitfall 6: Clearing mocks between stories
Storybook re-mounts stories, but if you reuse a module-level `fn()`, call counts can leak. Prefer `args: { onX: fn() }` per meta/story so each story gets a fresh mock.

---

## 7. Checklist

```
[ ] parameters.actions.argTypesRegex enabled in preview
[ ] Public callback props use fn() when interaction tests exist
[ ] Design reviews glance at Actions after clicking interactive stories
[ ] play asserts args.onX — not a detached mock variable
[ ] No silent () => {} on important handlers
[ ] DOM handles only where prop-level actions are insufficient
```

---

## 8. Related panels

| Panel | Relationship |
|---|---|
| **Controls** | Edits non-function args; actions often listed under Events category |
| **Interactions** | Automated clicks/types that should produce Action log lines + mock assertions |
| **Visual tests** | Usually ignore action logs; focus on pixels after interaction if using play + Chromatic |
| **Accessibility** | Independent — but keyboard activation should still fire the same actions as pointer |
