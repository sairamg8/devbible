---
title: "Documentation: Autodocs, MDX Pages & Docgen Comments"
sidebar_label: "Documentation"
sidebar_position: 1
---

# 📖 Documentation: Autodocs, MDX Pages & Docgen Comments

## 1. Under-The-Hood Mechanics

Storybook generates rich, browsable documentation pages through two complementary mechanisms — fully automatic generation from existing stories/types, and hand-authored long-form pages for content that needs more than auto-generation can express.

```
tags: ['autodocs']  (on a story's meta)
        │
        ▼
Storybook AUTOMATICALLY generates a documentation page for that component:
  - a live-rendered example (using one story, usually the first/primary one)
  - a PROPS TABLE, derived from docgen reading the component's actual TypeScript types
  - JSDoc/TSDoc comments on individual props ──► surfaced as descriptions IN that props table
  - every OTHER story in the file, embedded as additional live examples

MDX docs pages (.mdx files) — HAND-AUTHORED long-form documentation:
  - mixes regular Markdown prose with EMBEDDED, LIVE story renders
  - for content that needs MORE than auto-generation provides: usage guidelines,
    design rationale, migration notes, "when to use X vs Y" explanations
```

### Docgen Comments: Documentation That Lives With the Code
```typescript
interface ButtonProps {
  /** The visual style variant. Use 'primary' for the main call-to-action, 'secondary' for less prominent actions. */
  variant: 'primary' | 'secondary';
}
```
A JSDoc/TSDoc comment directly on a prop's type declaration is automatically extracted by docgen and displayed in the autodocs props table — meaning documentation lives **directly alongside** the type it describes, in the same file, rather than in a separate documentation source that can drift out of sync with the component's actual current prop shape.

### MDX: When Auto-Generation Isn't Enough
Autodocs excels at "here's the component and its props" — but genuinely doesn't (and isn't meant to) express prose-heavy content like "here's WHY this component is designed this way," "here's when to use `<Modal>` vs `<Drawer>`," or a migration guide from a deprecated component. MDX pages fill exactly that gap, letting hand-written explanatory content live alongside — and directly embed — live, interactive story examples.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Design System's Documentation Staying Accurate Automatically, Without a Dedicated Technical Writer Maintaining It Separately.
A design system team initially maintained component documentation in a separate wiki, which consistently drifted out of sync with the actual current component API — a prop renamed in code often went unreflected in the wiki for weeks. Switching to `tags: ['autodocs']` plus TSDoc comments directly on prop types meant the props table was **always** accurate, generated fresh from the actual current type definitions on every Storybook build — a prop rename was reflected in the documentation automatically, the same commit that changed the code, with zero separate documentation-update step required at all.

---

## 3. Production-Grade Code Example

```typescript
// Button.tsx — TSDoc comments directly on prop types, surfaced automatically in autodocs
interface ButtonProps {
  /** The visual style variant. Use 'primary' for the main call-to-action. */
  variant: 'primary' | 'secondary';
  /** Disables the button and applies a visually muted style. */
  disabled?: boolean;
  /** Called when the button is clicked. Not called while disabled. */
  onClick?: () => void;
}
```

```tsx
// Button.stories.tsx — tags: ['autodocs'] generates the full documentation page automatically
const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'], // this ONE line generates a full docs page: props table + live examples
};
export default meta;

export const Primary: Story = { args: { variant: 'primary', label: 'Click me' } };
export const Disabled: Story = { args: { variant: 'primary', label: 'Click me', disabled: true } };
```

```mdx
{/* Button.mdx — hand-authored, for content beyond what autodocs alone provides */}
import { Meta, Canvas } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

Use Buttons for the primary interactive action on a page. For less prominent actions
inside a busy toolbar, prefer `IconButton` instead — see the IconButton docs for guidance
on when each is appropriate.

<Canvas of={ButtonStories.Primary} />

## When NOT to use Button

Avoid using Button for navigation — use `Link` styled as a button instead, so the
underlying semantics (and browser behaviors like "open in new tab") remain correct.
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Relying Purely on Autodocs for Content It Genuinely Can't Express
```
❌ INCOMPLETE: autodocs generates a props table and live examples — it does NOT explain
WHY a component is designed a certain way, WHEN to use it vs a similar alternative, or
migration guidance from a deprecated pattern

✅ CORRECT: use MDX pages specifically for the prose-heavy, judgment-based content
autodocs was never meant to auto-generate, keeping autodocs for what it does well
(accurate, always-in-sync prop tables and examples)
```

### ⚠️ Pitfall 2: Letting Docgen Comments Drift From Actual Component Behavior
```typescript
// ❌ RISKY: a docgen comment is still HAND-WRITTEN prose — it can drift from the component's
// ACTUAL current behavior just as easily as separate documentation could, if not updated
// alongside behavior changes
/** Disables the button. */  // but the ACTUAL current behavior also hides it entirely, undocumented
disabled?: boolean;

// ✅ AWARENESS: docgen comments solve the "documentation lives in a SEPARATE file that's
// easy to forget" problem — they do NOT automatically solve "documentation was never
// updated when behavior changed" if the comment itself isn't kept current
```

### ⚠️ Pitfall 3: Auto-Generating Docs for Components Whose Types Don't Reflect Real Usage Constraints
```typescript
// ❌ MISLEADING: if TypeScript types don't capture a REAL runtime constraint (e.g. "these
// two props are mutually exclusive, only one may be set"), the auto-generated props table
// won't reflect that constraint at all, potentially misleading a consumer
interface ModalProps { title?: string; customHeader?: ReactNode; } // NOTHING documents these are mutually exclusive

// ✅ CORRECT: for constraints types alone can't express, supplement autodocs with an
// explicit note in an MDX page, or a docgen comment explicitly calling out the constraint
/** Provide EITHER title OR customHeader, never both. */
```
