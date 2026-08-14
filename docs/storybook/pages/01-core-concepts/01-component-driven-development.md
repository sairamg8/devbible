---
title: "Core Concepts: Component-Driven Development & CSF3"
sidebar_label: "Core Concepts"
sidebar_position: 1
---

# 📖 Core Concepts: Component-Driven Development & CSF3

## 1. Under-The-Hood Mechanics

Storybook's foundational idea is **isolation**: rendering a single component, in a specific state, completely independent of the app's routing, backend, or global data layer — a fundamentally different development/testing entry point than "run the whole app and navigate to the right page."

```
Traditional workflow:                       Component-Driven workflow:
  run full app ──► navigate through            open Storybook ──► select the EXACT component
  routing/auth/data-fetching to REACH             + state you need to work on, DIRECTLY —
  the component you actually want to work on       no routing, no auth, no backend required
```

### A "Story": One Reproducible Render of One Component State
A story is a small, declarative description of "render this component with these exact props/state" — `<Button variant="primary" disabled />` as its own addressable, isolated, always-reproducible unit. Multiple stories per component (`Default`, `Disabled`, `Loading`, `WithLongText`) collectively document and verify **every meaningful state** a component can be in, independent of whatever real app data happens to produce that state in production.

### Component Story Format 3 (CSF3): The Modern, Object-Based Convention
```typescript
// Button.stories.tsx
const meta = { component: Button, title: 'Components/Button' };  // DEFAULT export — shared config
export default meta;

export const Primary = { args: { variant: 'primary', label: 'Click me' } }; // NAMED export = one story
export const Disabled = { args: { variant: 'primary', label: 'Click me', disabled: true } };
```
CSF3's object-based story shape (each story is a plain object with `args`, not a function returning JSX) is deliberately simple and declarative — the framework handles actually rendering the component with those args, rather than each story needing to hand-write its own render logic (the older, more verbose CSF2 convention).

### Why Isolation Matters: Building Bottom-Up
Developing a component in isolation forces its prop interface and internal states to be genuinely self-contained and well-defined — a component that "only works when rendered inside the real app, with the real Redux store and real routing" often has hidden, implicit dependencies that isolation-based development surfaces and forces to be addressed explicitly (via props, decorators, or mocked context), rather than accidentally relying on ambient app state.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Design System Team Building and Reviewing New Components Without Any Backend or Real App Running.
A design system team building a shared `<DataTable>` component needed to iterate quickly through many visual states (empty, loading, error, paginated, sorted) — building this inside the actual product app would require standing up real data for every state, coordinating with a real backend, and navigating through the app's actual routing just to reach the table. Building it as a set of Storybook stories (`Empty`, `Loading`, `WithData`, `ErrorState`) let the team iterate on every visual state directly, review each one individually with stakeholders (designers, PMs) without needing the full app running at all, and hand the finished, verified component off to consuming teams with its exact valid states already documented as living, interactive examples.

---

## 3. Production-Grade Code Example

```tsx
// Button.tsx — the component under development
interface ButtonProps {
  variant: 'primary' | 'secondary';
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ variant, label, disabled, onClick }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
```

```tsx
// Button.stories.tsx — CSF3 story format, isolated states covering the component's full range
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'], // auto-generates a documentation page — see the documentation doc
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', label: 'Click me' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Click me' },
};

export const Disabled: Story = {
  args: { variant: 'primary', label: 'Click me', disabled: true },
};
```

```bash
# Running Storybook — isolated, independent of the actual app entirely
npm run storybook  # opens a dev server showing EVERY story, navigable independently
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Building Components That Secretly Depend on Ambient App Context
```tsx
// ❌ HIDDEN DEPENDENCY: this component silently assumes a Redux Provider/Router already
// exists somewhere up the tree — rendering it in Storybook's isolation (no app wrapper)
// crashes immediately, revealing a dependency that was never made explicit
function UserBadge() {
  const user = useSelector((state) => state.auth.user); // ❌ crashes without a Provider
  return <span>{user.name}</span>;
}

// ✅ CORRECT: make dependencies explicit via props, OR use a decorator (see the decorators
// doc) to deliberately provide the needed context WITHIN Storybook, matching what the real
// app actually provides
function UserBadge({ user }: { user: User }) { return <span>{user.name}</span>; }
```

### ⚠️ Pitfall 2: Writing Too Few Stories, Missing Meaningful Component States
```tsx
// ❌ INCOMPLETE: only documenting the "happy path" default state misses genuinely important
// states (empty, loading, error, edge-case long text) that the component ALSO needs to handle
export const Default: Story = { args: { items: sampleItems } }; // the ONLY story — misses a lot

// ✅ CORRECT: cover the meaningfully DISTINCT states a component can actually be in
export const Empty: Story = { args: { items: [] } };
export const Loading: Story = { args: { items: [], isLoading: true } };
export const WithManyItems: Story = { args: { items: Array(100).fill(sampleItem) } };
```

### ⚠️ Pitfall 3: Treating Storybook as Purely a "Design Tool," Never Actually Verifying Behavior
Storybook stories that only ever render a static visual state (no interaction testing via play functions, no accessibility scanning) capture only half of what component-driven development can verify — a component can look correct in every story while still being genuinely broken for keyboard navigation, click handling, or focus management. The [interaction testing doc](../05-interaction-testing/01-play-functions.md) covers turning stories into actual behavioral tests, not just visual documentation.
